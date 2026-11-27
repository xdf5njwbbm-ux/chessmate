// AI Voice Practice — the call itself.
//
// The browser talks to OpenAI's Realtime API over WebRTC: the microphone goes
// up as a live audio track, the tutor's voice comes back as one, and a data
// channel carries events (transcripts, turn-taking). The `voice` edge function
// signs the connection with the server-side API key and the tutor's
// instructions, so no secret ever reaches this code.
//
// Turn-taking is done by the server's semantic voice-activity detection: you
// just talk, pause, and the tutor answers — no buttons between sentences.
import { ApiError } from "../api";
import { voiceApi } from "./api";
import { speedFor, TUTORS, type TutorId, type VoiceLevel, type VoiceMode } from "../../../supabase/functions/_shared/voice/curriculum.ts";
import type { CallStats, Report, Suggestion, Turn } from "../../../supabase/functions/_shared/voice/logic.ts";

export type CallPhase = "idle" | "mic" | "connecting" | "live" | "reconnecting" | "ending" | "ended" | "failed";
export type Activity = "listening" | "learner" | "thinking" | "tutor";
export type ErrorKind = "mic" | "network" | "limit" | "server" | "setup" | "premium" | "unsupported";

export type Line = Turn & {
  final: boolean;
  analysing: boolean;
  /** Recording of what the tutor actually said (object URL), for replay. */
  audio?: string | null;
  interrupted?: boolean;
  failed?: boolean;
};

export type CallOptions = { mode: VoiceMode; tutor: TutorId; lesson: number | null; slow: boolean; reviewOf?: string | null };

export type Snapshot = {
  phase: CallPhase;
  activity: Activity;
  error: string | null;
  errorKind: ErrorKind | null;
  callId: string | null;
  elapsed: number;
  remaining: number | null;
  muted: boolean;
  speakerMuted: boolean;
  volume: number;
  slow: boolean;
  lines: Line[];
  suggestions: Suggestion[];
  /** The learner has been quiet for a while after a question. */
  quiet: boolean;
  /** The browser blocked audio until the next tap. */
  needsTap: boolean;
  /** A replay or a sentence is playing locally (the mic is paused meanwhile). */
  playing: string | null;
  reconnectAttempt: number;
  report: Report | null;
  level: VoiceLevel | null;
  mode: VoiceMode;
  tutor: TutorId;
  lesson: number | null;
  review: boolean;
};

// ---------------------------------------------------------------- microphone
export class MicError extends Error {
  kind: "blocked" | "missing" | "busy" | "insecure" | "unsupported" | "unknown";
  constructor(kind: MicError["kind"], message: string) {
    super(message);
    this.kind = kind;
  }
}

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/i.test(navigator.userAgent);

export function micHelp(): string {
  if (isIOS()) return "On iPhone: tap «aA» in the address bar → Website Settings → Microphone → Allow (or Settings → Safari → Microphone), then reload.";
  if (isAndroid()) return "On Android: tap the lock icon next to the address → Permissions → Microphone → Allow, then reload.";
  return "Click the lock or settings icon next to the address bar → Site settings → Microphone → Allow, then reload the page.";
}

export function voiceSupport(): { ok: boolean; reason?: string } {
  if (typeof window === "undefined") return { ok: false, reason: "No browser." };
  if (!window.isSecureContext) return { ok: false, reason: "Voice calls need a secure (https) connection." };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "This browser can't use the microphone. Try Chrome, Safari or Edge." };
  if (typeof RTCPeerConnection === "undefined") return { ok: false, reason: "This browser doesn't support live calls. Try Chrome, Safari or Edge." };
  return { ok: true };
}

/** "granted" | "denied" | "prompt" | "unknown" — without asking. */
export async function micPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    const st = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return (st?.state as "granted" | "denied" | "prompt") ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function openMic(): Promise<MediaStream> {
  const sup = voiceSupport();
  if (!sup.ok) throw new MicError(window.isSecureContext ? "unsupported" : "insecure", sup.reason!);
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch (e) {
    const name = (e as DOMException)?.name ?? "";
    if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError")
      throw new MicError("blocked", `Microphone access is blocked for this site. ${micHelp()}`);
    if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError")
      throw new MicError("missing", "No microphone was found. Connect a headset or microphone, check your device's sound settings, and try again.");
    if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError")
      throw new MicError("busy", "Your microphone is busy — another app or a phone call may be using it. Close it and try again.");
    throw new MicError("unknown", "Couldn't start the microphone. Check that it's connected and allowed, then try again.");
  }
}

// ---------------------------------------------------------------- audio helpers
type Meter = { analyser: AnalyserNode; buf: Uint8Array<ArrayBuffer> };
function meter(ctx: AudioContext, stream: MediaStream): Meter | null {
  try {
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    return { analyser, buf: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
  } catch {
    return null;
  }
}
function read(m: Meter | null): number {
  if (!m) return 0;
  m.analyser.getByteTimeDomainData(m.buf);
  let sum = 0;
  for (let i = 0; i < m.buf.length; i++) {
    const v = (m.buf[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / m.buf.length) * 3.2);
}
function recorderMime(): string | undefined {
  const MR = (window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR) return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MR.isTypeSupported?.(t));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seconds of silence after the tutor finishes before they gently help. */
const QUIET_HINT_MS = 6_000;
const NUDGE_MS: Record<VoiceMode, number> = { beginner: 12_000, natural: 15_000, immersion: 20_000 };

// ---------------------------------------------------------------- the call
type Ev = Record<string, unknown> & { type: string };

export class VoiceCall {
  private o: CallOptions;
  private snap: Snapshot;
  private listeners = new Set<() => void>();
  private emitQueued = false;

  private ctx: AudioContext | null = null;
  private mic: MediaStream | null = null;
  private micMeter: Meter | null = null;
  private tutorMeter: Meter | null = null;
  private remote: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private wake: { release: () => Promise<void> } | null = null;

  private lines: Line[] = [];
  private respItems = new Map<string, string>();
  private recorders = new Map<string, { rec: MediaRecorder; chunks: Blob[] }>();
  private urls: string[] = [];
  private ttsCache = new Map<string, string>();
  private player: HTMLAudioElement | null = null;

  private startedAt = 0;
  private limitAt: number | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private tick: ReturnType<typeof setInterval> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private quietTimer: ReturnType<typeof setTimeout> | null = null;
  private nudgeTimer: ReturnType<typeof setTimeout> | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;
  private dropTimer: ReturnType<typeof setTimeout> | null = null;
  private nudges = 0;
  private reconnecting = false;
  private closed = false;
  private responseActive = false;
  private warnedLimit = false;
  private stats: CallStats = { nudges: 0, helps: 0, repeats: 0, english: 0, reconnects: 0 };
  private analyses = 0;

  constructor(o: CallOptions) {
    this.o = { ...o };
    this.snap = {
      phase: "idle", activity: "listening", error: null, errorKind: null, callId: null, elapsed: 0, remaining: null,
      muted: false, speakerMuted: false, volume: 1, slow: o.slow, lines: [], suggestions: [], quiet: false, needsTap: false,
      playing: null, reconnectAttempt: 0, report: null, level: null, mode: o.mode, tutor: o.tutor, lesson: o.lesson, review: !!o.reviewOf,
    };
  }

  // ---------------------------------------------------------------- store
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snap;
  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.queueEmit();
  }
  private queueEmit() {
    if (this.emitQueued) return;
    this.emitQueued = true;
    const run = () => {
      this.emitQueued = false;
      this.listeners.forEach((l) => l());
    };
    if (typeof requestAnimationFrame === "function" && document.visibilityState === "visible") requestAnimationFrame(run);
    else setTimeout(run, 16);
  }
  private commitLines() {
    this.set({ lines: [...this.lines] });
  }

  /** Live loudness (0–1) of your microphone and the tutor's voice, for the visualisations. */
  levels() {
    return { mic: this.snap.muted ? 0 : read(this.micMeter), tutor: read(this.tutorMeter) };
  }

  // ---------------------------------------------------------------- start
  /** Call from a tap/click handler: browsers only allow audio after a user gesture. */
  async start() {
    if (this.snap.phase !== "idle" && this.snap.phase !== "failed") return;
    this.closed = false;
    // Audio has to be unlocked synchronously inside the gesture (iOS especially).
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx ??= new Ctx();
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    if (!this.audioEl) {
      const a = new Audio();
      a.autoplay = true;
      a.setAttribute("playsinline", "");
      this.audioEl = a;
    }
    this.set({ phase: "mic", error: null, errorKind: null });
    try {
      if (!this.mic || this.mic.getAudioTracks().every((t) => t.readyState === "ended")) this.mic = await openMic();
    } catch (e) {
      if (!this.closed) this.fail("mic", (e as Error).message);
      return;
    }
    if (this.closed) {
      // hung up while the permission prompt was open
      this.mic.getTracks().forEach((t) => t.stop());
      this.mic = null;
      return;
    }
    this.mic.getAudioTracks()[0].onended = () => {
      if (this.snap.phase === "live") this.fail("mic", "The microphone was disconnected. Reconnect it and start the call again.");
    };
    if (this.ctx) this.micMeter = meter(this.ctx, this.mic);
    this.set({ phase: "connecting" });
    try {
      await this.openPeer(false);
    } catch (e) {
      this.closePeer();
      if (this.closed) return;
      const err = e as ApiError;
      const kind: ErrorKind = err.code === "limit" ? "limit" : err.code === "not_configured" ? "setup" : err.code === "premium" ? "premium" : /offline|connection/i.test(err.message) ? "network" : "server";
      this.fail(kind, err.message || "Couldn't connect the call. Please try again.");
      return;
    }
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    document.addEventListener("visibilitychange", this.onVisible);
  }

  private async openPeer(resume: boolean) {
    const pc = new RTCPeerConnection();
    this.pc = pc;
    const track = this.mic!.getAudioTracks()[0];
    track.enabled = !this.snap.muted && !this.snap.playing;
    pc.addTrack(track, this.mic!);

    pc.ontrack = (e) => {
      if (this.pc !== pc) return;
      this.remote = e.streams[0] ?? new MediaStream([e.track]);
      const a = this.audioEl!;
      a.srcObject = this.remote;
      a.muted = this.snap.speakerMuted;
      a.volume = this.snap.volume;
      a.play().then(() => this.set({ needsTap: false })).catch(() => this.set({ needsTap: true }));
      if (this.ctx) this.tutorMeter = meter(this.ctx, this.remote);
    };

    const dc = pc.createDataChannel("oai-events");
    this.dc = dc;
    const opened = new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new ApiError("The connection timed out. Check your internet and try again.")), 20_000);
      dc.onopen = () => {
        clearTimeout(t);
        resolve();
      };
    });
    opened.catch(() => {}); // awaited below; don't report it as unhandled if signalling fails first
    dc.onmessage = (e) => {
      if (this.pc !== pc) return;
      try {
        this.onEvent(JSON.parse(e.data));
      } catch {
        /* ignore malformed */
      }
    };
    dc.onclose = () => {
      if (this.pc === pc && (this.snap.phase === "live" || this.snap.phase === "connecting")) void this.lost();
    };
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return;
      const st = pc.connectionState;
      if (st === "connected") {
        if (this.dropTimer) clearTimeout(this.dropTimer);
        this.dropTimer = null;
      } else if (st === "disconnected") {
        // often recovers by itself within a few seconds (network hiccup, Wi-Fi ↔ mobile)
        if (this.dropTimer) clearTimeout(this.dropTimer);
        this.dropTimer = setTimeout(() => {
          if (this.pc === pc && pc.connectionState !== "connected") void this.lost();
        }, 4_000);
      } else if (st === "failed") {
        void this.lost();
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const r = await voiceApi.connect({
      sdp: offer.sdp ?? "",
      call_id: this.snap.callId ?? undefined,
      mode: this.o.mode,
      tutor: this.o.tutor,
      lesson: this.o.lesson,
      slow: this.snap.slow,
      review_of: this.o.reviewOf ?? null,
      resume: resume ? this.lines.filter((l) => l.final && l.text).slice(-14).map((l) => ({ role: l.role, text: l.text })) : undefined,
    });
    if (this.pc !== pc || this.closed) {
      pc.close();
      return;
    }
    this.o.lesson = r.lesson;
    if (!this.startedAt) {
      this.limitAt = Math.max(60, r.limit_s - r.used_s);
    }
    this.set({ callId: r.call_id, level: r.level, mode: r.mode, tutor: r.tutor, lesson: r.lesson, review: r.review });
    await pc.setRemoteDescription({ type: "answer", sdp: r.sdp });
    await opened;
    this.onLive();
  }

  private onLive() {
    if (!this.startedAt) {
      this.startedAt = Date.now();
      this.tick = setInterval(() => this.onTick(), 1000);
      this.heartbeat = setInterval(() => void this.syncNow(), 30_000);
    }
    this.set({ phase: "live", reconnectAttempt: 0, error: null, errorKind: null });
    void this.keepAwake();
    // The tutor speaks first ("Привет! Как дела?"), or picks up again after a reconnection.
    this.send({ type: "response.create" });
  }

  private onTick() {
    const elapsed = Math.round((Date.now() - this.startedAt) / 1000);
    const remaining = this.limitAt != null ? Math.max(0, this.limitAt - elapsed) : null;
    this.set({ elapsed, remaining });
    if (remaining != null && remaining <= 60 && !this.warnedLimit && this.snap.phase === "live") {
      this.warnedLimit = true;
      this.system("[Only one minute is left of today's call time. Start wrapping up the conversation naturally.]", false);
    }
    if (remaining === 0 && this.snap.phase === "live") {
      this.system("[Today's call time is over. Say a warm goodbye in one short sentence.]", true);
      this.later(() => void this.end(), 9_000);
    }
  }

  // ---------------------------------------------------------------- events
  private send(ev: Record<string, unknown>) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(ev));
  }
  /** A note from the app to the tutor (never read aloud), optionally asking for a reply now. */
  private system(text: string, reply: boolean) {
    this.send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } });
    if (reply) {
      if (this.responseActive) {
        this.send({ type: "response.cancel" });
        this.send({ type: "output_audio_buffer.clear" });
      }
      this.send({ type: "response.create" });
    }
  }

  private onEvent(ev: Ev) {
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        this.clearQuiet();
        this.nudges = 0;
        this.set({ activity: "learner", quiet: false });
        break;
      case "input_audio_buffer.speech_stopped":
        this.set({ activity: "thinking" });
        break;
      case "conversation.item.added":
      case "conversation.item.created": {
        const it = ev.item as { id?: string; type?: string; role?: string; content?: { type?: string }[] } | undefined;
        if (!it?.id || it.type !== "message") break;
        if (it.role === "user" && it.content?.some((c) => c.type === "input_audio")) this.ensureLine(it.id, "learner");
        else if (it.role === "assistant") this.ensureLine(it.id, "tutor");
        break;
      }
      case "conversation.item.input_audio_transcription.delta":
        this.appendText(String(ev.item_id), "learner", String(ev.delta ?? ""));
        break;
      case "conversation.item.input_audio_transcription.completed":
        this.finishLine(String(ev.item_id), "learner", String(ev.transcript ?? ""));
        break;
      case "conversation.item.input_audio_transcription.failed":
        this.finishLine(String(ev.item_id), "learner", "", true);
        break;
      case "response.created": {
        this.responseActive = true;
        const id = (ev.response as { id?: string } | undefined)?.id;
        if (id) this.startRecording(id);
        if (this.snap.activity !== "tutor") this.set({ activity: "thinking" });
        break;
      }
      case "response.output_item.added": {
        const it = ev.item as { id?: string; type?: string; role?: string } | undefined;
        if (it?.id && it.type === "message" && it.role === "assistant") {
          this.ensureLine(it.id, "tutor");
          if (ev.response_id) this.respItems.set(String(ev.response_id), it.id);
        }
        break;
      }
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        if (ev.response_id && ev.item_id) this.respItems.set(String(ev.response_id), String(ev.item_id));
        this.appendText(String(ev.item_id), "tutor", String(ev.delta ?? ""));
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
        this.finishLine(String(ev.item_id), "tutor", String(ev.transcript ?? ""));
        break;
      case "output_audio_buffer.started":
        this.clearQuiet();
        this.set({ activity: "tutor", quiet: false });
        break;
      case "output_audio_buffer.stopped":
        this.stopRecording(ev.response_id as string | undefined);
        this.set({ activity: "listening" });
        this.armQuiet();
        break;
      case "output_audio_buffer.cleared": {
        // You started talking over the tutor: it stops, like a real call.
        const item = this.respItems.get(String(ev.response_id ?? ""));
        const l = item ? this.lines.find((x) => x.id === item) : null;
        if (l) this.updateLine(l.id, { interrupted: true });
        this.stopRecording(ev.response_id as string | undefined);
        break;
      }
      case "response.done": {
        this.responseActive = false;
        const r = ev.response as { id?: string; status?: string; status_details?: { error?: { message?: string } } } | undefined;
        if (r?.status === "failed") console.warn("[voice] response failed", r.status_details?.error?.message);
        if (r?.id) this.later(() => this.stopRecording(r.id), 1_500);
        if (this.snap.activity === "thinking") this.later(() => this.snap.activity === "thinking" && this.set({ activity: "listening" }), 1_200);
        break;
      }
      case "error": {
        const err = ev.error as { message?: string; code?: string; type?: string } | undefined;
        const code = err?.code ?? "";
        if (/response_cancel_not_active|conversation_already_has_active_response|input_audio_buffer_commit_empty/.test(code)) break;
        console.warn("[voice] server error", code, err?.message);
        if (/session_expired|session_closed/.test(code) || /expired/i.test(err?.message ?? "")) void this.lost();
        break;
      }
    }
  }

  // ---------------------------------------------------------------- transcript
  private at() {
    return this.startedAt ? Date.now() - this.startedAt : 0;
  }
  private ensureLine(id: string, role: "tutor" | "learner") {
    if (this.lines.some((l) => l.id === id)) return;
    this.lines.push({ id, role, text: "", at: this.at(), final: false, analysing: false });
    this.commitLines();
  }
  private updateLine(id: string, patch: Partial<Line>) {
    const i = this.lines.findIndex((l) => l.id === id);
    if (i < 0) return;
    this.lines[i] = { ...this.lines[i], ...patch };
    this.commitLines();
  }
  private appendText(id: string, role: "tutor" | "learner", delta: string) {
    if (!id || id === "undefined") return;
    this.ensureLine(id, role);
    const l = this.lines.find((x) => x.id === id)!;
    if (l.final) return;
    this.updateLine(id, { text: l.text + delta });
  }
  private finishLine(id: string, role: "tutor" | "learner", transcript: string, failed = false) {
    if (!id || id === "undefined") return;
    this.ensureLine(id, role);
    const text = (transcript || this.lines.find((x) => x.id === id)?.text || "").replace(/\s+/g, " ").trim();
    if (!text) {
      if (role === "learner" && !failed) {
        // noise, a cough — nothing was said
        this.lines = this.lines.filter((l) => l.id !== id);
        this.commitLines();
      } else this.updateLine(id, { final: true, failed: true, text: "" });
      return;
    }
    this.updateLine(id, { text, final: true });
    if (role === "tutor" && this.o.mode !== "immersion") this.set({ suggestions: [] });
    void this.analyse(id);
    this.scheduleSync();
  }

  private async analyse(id: string) {
    const line = this.lines.find((l) => l.id === id);
    const callId = this.snap.callId;
    if (!line || !callId) return;
    const idx = this.lines.indexOf(line);
    const prev = [...this.lines.slice(0, idx)].reverse().find((l) => l.role !== line.role && l.final && l.text)?.text ?? "";
    this.updateLine(id, { analysing: true });
    // keep a few in flight at most
    while (this.analyses >= 3) await sleep(150);
    this.analyses++;
    try {
      const { analysis } = await voiceApi.analyze(callId, line.role, line.text, prev);
      this.updateLine(id, { analysis, analysing: false });
      if (analysis.kind === "tutor") {
        const latestTutor = [...this.lines].reverse().find((l) => l.role === "tutor" && l.final);
        if (latestTutor?.id === id) this.set({ suggestions: analysis.suggestions });
      } else if (analysis.lang === "en") this.stats.english++;
      this.scheduleSync();
    } catch {
      this.updateLine(id, { analysing: false });
    } finally {
      this.analyses--;
    }
  }

  /** The finished part of the conversation, as saved to your account. */
  turns(): Turn[] {
    return this.lines.filter((l) => l.final && l.text).map(({ id, role, text, at, analysis }) => ({ id, role, text, at, analysis: analysis ?? null }));
  }

  private scheduleSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => void this.syncNow(), 5_000);
  }
  private async syncNow(keepalive = false) {
    const id = this.snap.callId;
    if (!id || this.snap.phase === "ended" || this.snap.phase === "ending") return;
    try {
      const r = await voiceApi.sync(id, this.turns(), keepalive);
      if (r.over_limit && this.snap.phase === "live") {
        this.system("[Today's call time is over. Say a warm goodbye in one short sentence.]", true);
        this.later(() => void this.end(), 9_000);
      }
    } catch {
      /* the next sync or the end of the call will catch up */
    }
  }
  /** Best-effort save when the page is being closed. */
  flush() {
    if (this.snap.phase === "live" || this.snap.phase === "reconnecting") void this.syncNow(true);
  }

  // ---------------------------------------------------------------- silence
  private clearQuiet() {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    if (this.nudgeTimer) clearTimeout(this.nudgeTimer);
    this.quietTimer = this.nudgeTimer = null;
  }
  private armQuiet() {
    this.clearQuiet();
    if (this.snap.muted || this.snap.phase !== "live") return;
    this.quietTimer = setTimeout(() => this.set({ quiet: true }), QUIET_HINT_MS);
    const wait = NUDGE_MS[this.o.mode];
    this.nudgeTimer = setTimeout(() => {
      if (this.nudges >= 2 || this.snap.phase !== "live" || this.snap.muted || this.snap.playing) return;
      this.nudges++;
      this.stats.nudges++;
      this.system(
        `[The learner has been quiet for about ${Math.round(wait / 1000)} seconds. Gently help them: ${this.o.mode === "immersion" ? "repeat or simplify your question in Russian" : "say your question again more simply, or offer an easy answer they can copy"}. Keep it short and kind.]`,
        true,
      );
    }, wait);
  }

  // ---------------------------------------------------------------- controls
  setMuted(muted: boolean) {
    const t = this.mic?.getAudioTracks()[0];
    if (t) t.enabled = !muted && !this.snap.playing;
    this.set({ muted });
    if (muted) this.clearQuiet();
    else if (this.snap.activity === "listening") this.armQuiet();
  }
  setSpeakerMuted(speakerMuted: boolean) {
    if (this.audioEl) this.audioEl.muted = speakerMuted;
    this.set({ speakerMuted });
  }
  setVolume(volume: number) {
    if (this.audioEl) this.audioEl.volume = volume;
    if (this.player) this.player.volume = volume;
    this.set({ volume });
  }
  async setOutputDevice(deviceId: string) {
    const a = this.audioEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    await a?.setSinkId?.(deviceId);
    const p = this.player as (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    await p?.setSinkId?.(deviceId).catch(() => {});
  }
  /** Slow down (or speed back up) the tutor's live speech. */
  setSlow(slow: boolean) {
    this.set({ slow });
    this.send({ type: "session.update", session: { type: "realtime", audio: { output: { speed: speedFor(this.o.mode, slow) } } } });
    void voiceApi.settings({ slow }).catch(() => {});
  }
  resumeAudio() {
    void this.ctx?.resume();
    this.audioEl?.play().then(() => this.set({ needsTap: false })).catch(() => {});
  }
  /** Ask the tutor to say it again, slower. */
  askRepeat() {
    this.stats.repeats++;
    this.system("[The learner asked you to repeat what you just said, more slowly and clearly. Repeat it — don't add anything new.]", true);
  }
  /** "I'm stuck": the tutor gives an answer to copy. */
  askHelp() {
    this.stats.helps++;
    this.set({ quiet: false });
    this.system(
      `[The learner pressed Help: they don't know how to answer. Give them one short model answer to repeat${this.o.mode === "immersion" ? " (Russian only)" : ", in Russian with a quick English meaning"}, then wait for them to say it.]`,
      true,
    );
  }
  /** "Explain in English" — the only way English comes up in immersion mode. */
  askEnglish() {
    this.stats.english++;
    this.system("[The learner asked for help in English. Briefly explain in English what you just said and how they could answer, then continue in Russian.]", true);
  }

  // ---------------------------------------------------------------- replay
  private recordable() {
    return !!this.remote && !!(window as unknown as { MediaRecorder?: unknown }).MediaRecorder;
  }
  private startRecording(responseId: string) {
    if (!this.recordable() || this.recorders.has(responseId)) return;
    try {
      const mime = recorderMime();
      const rec = new MediaRecorder(this.remote!, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
        const item = this.respItems.get(responseId);
        if (!item || blob.size < 1500) return;
        const url = URL.createObjectURL(blob);
        this.urls.push(url);
        this.updateLine(item, { audio: url });
      };
      rec.start();
      this.recorders.set(responseId, { rec, chunks });
      this.later(() => this.stopRecording(responseId), 90_000);
    } catch {
      /* replay falls back to the synthesized voice */
    }
  }
  private stopRecording(responseId?: string) {
    const ids = responseId ? [responseId] : [...this.recorders.keys()];
    for (const id of ids) {
      const r = this.recorders.get(id);
      if (!r) continue;
      this.recorders.delete(id);
      setTimeout(() => {
        if (r.rec.state !== "inactive") r.rec.stop();
      }, 250);
    }
  }

  /** Plays a URL locally. The mic pauses meanwhile so the tutor doesn't hear the replay as you. */
  private async playLocal(key: string, url: string, rate: number) {
    this.stopPlaying();
    const a = new Audio(url);
    this.player = a;
    a.playbackRate = rate;
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    a.volume = this.snap.volume;
    a.muted = this.snap.speakerMuted;
    const t = this.mic?.getAudioTracks()[0];
    if (t) t.enabled = false;
    this.clearQuiet();
    this.set({ playing: key });
    try {
      await new Promise<void>((resolve) => {
        a.onended = () => resolve();
        a.onerror = () => resolve();
        a.play().catch(() => resolve());
      });
    } finally {
      if (this.player === a) {
        this.player = null;
        if (t) t.enabled = !this.snap.muted;
        this.set({ playing: null });
        if (this.snap.activity === "listening") this.armQuiet();
      }
    }
  }
  stopPlaying() {
    if (!this.player) return;
    this.player.pause();
    this.player = null;
    const t = this.mic?.getAudioTracks()[0];
    if (t) t.enabled = !this.snap.muted;
    this.set({ playing: null });
  }
  /** Replays a tutor line: the original recording, or the tutor's voice reading it. */
  async replay(lineId: string, rate = 1) {
    const l = this.lines.find((x) => x.id === lineId);
    if (!l) return;
    if (l.audio) return this.playLocal(`${lineId}@${rate}`, l.audio, rate);
    const ru = l.analysis?.kind === "tutor" ? l.analysis.segments.filter((s) => s.lang === "ru").map((s) => s.text).join(" ") : l.text;
    return this.say(ru || l.text, rate, `${lineId}@${rate}`);
  }
  replayLast(rate = 1) {
    const l = [...this.lines].reverse().find((x) => x.role === "tutor" && x.final && x.text);
    if (l) void this.replay(l.id, rate);
  }
  /** Any Russian sentence in the tutor's voice (corrections, suggestions, single sentences). */
  async say(text: string, rate = 1, key = `tts:${text}@${rate}`) {
    let url = this.ttsCache.get(text);
    if (!url) {
      this.set({ playing: key });
      try {
        const blob = await voiceApi.tts(text, this.o.tutor);
        url = URL.createObjectURL(blob);
        this.urls.push(url);
        this.ttsCache.set(text, url);
      } catch {
        this.set({ playing: null });
        return;
      }
    }
    return this.playLocal(key, url, rate);
  }

  // ---------------------------------------------------------------- connection loss
  private onOnline = () => {
    if (this.snap.phase === "reconnecting" && !this.reconnecting) void this.lost();
  };
  private onOffline = () => {
    if (this.snap.phase === "live") this.set({ phase: "reconnecting" });
  };
  private onVisible = () => {
    if (document.visibilityState === "visible" && this.snap.phase === "live") void this.keepAwake();
  };

  private async lost() {
    if (this.closed || this.reconnecting) return;
    if (this.snap.phase !== "live" && this.snap.phase !== "reconnecting" && this.snap.phase !== "connecting") return;
    if (!this.snap.callId) return;
    this.reconnecting = true;
    this.stats.reconnects++;
    this.clearQuiet();
    this.stopRecording();
    this.set({ phase: "reconnecting", activity: "listening" });
    for (let attempt = 1; attempt <= 5 && !this.closed; attempt++) {
      this.set({ reconnectAttempt: attempt });
      for (let w = 0; !navigator.onLine && w < 30 && !this.closed; w++) await sleep(1000);
      await sleep(attempt === 1 ? 400 : Math.min(8000, 1000 * 2 ** (attempt - 1)));
      if (this.closed) break;
      try {
        this.closePeer();
        await this.openPeer(true);
        this.reconnecting = false;
        return;
      } catch (e) {
        const code = (e as ApiError).code;
        if (code === "ended" || code === "limit" || code === "premium" || code === "not_configured") break;
      }
    }
    this.reconnecting = false;
    if (this.closed) return;
    this.closePeer();
    this.fail("network", "The call dropped and couldn't reconnect. Your conversation so far is saved — end the call to get your report, or try reconnecting.");
  }
  /** Manual "Reconnect" after a failed reconnection. */
  async reconnect() {
    if (!this.snap.callId) return this.start();
    this.set({ phase: "reconnecting", error: null, errorKind: null });
    await this.lost();
  }

  // ---------------------------------------------------------------- end
  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }
  private closePeer() {
    this.stopRecording();
    try {
      this.dc?.close();
    } catch {
      /* closed */
    }
    try {
      this.pc?.close();
    } catch {
      /* closed */
    }
    this.dc = null;
    this.pc = null;
    this.responseActive = false;
  }
  private async keepAwake() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl && !this.wake) this.wake = await wl.request("screen");
    } catch {
      /* not supported or not allowed */
    }
  }
  private fail(kind: ErrorKind, message: string) {
    this.clearQuiet();
    this.set({ phase: "failed", error: message, errorKind: kind, activity: "listening" });
  }
  private stopMedia() {
    this.clearQuiet();
    [this.tick, this.heartbeat].forEach((t) => t && clearInterval(t));
    [this.syncTimer, this.dropTimer, ...this.timers].forEach((t) => t && clearTimeout(t));
    this.tick = this.heartbeat = this.syncTimer = this.dropTimer = null;
    this.timers = [];
    this.stopPlaying();
    this.closePeer();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
    }
    void this.wake?.release().catch(() => {});
    this.wake = null;
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
    document.removeEventListener("visibilitychange", this.onVisible);
  }

  /** Hangs up and builds the post-call report. Safe to call more than once. */
  async end(): Promise<Report | null> {
    if (this.snap.phase === "ending") return null;
    if (this.snap.phase === "ended") return this.snap.report;
    this.closed = true;
    const elapsed = this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
    this.stopMedia();
    const id = this.snap.callId;
    if (!id) {
      this.set({ phase: "idle" });
      return null;
    }
    this.set({ phase: "ending", elapsed: elapsed || this.snap.elapsed });
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { report } = await voiceApi.end(id, this.turns(), elapsed || null, this.stats);
        this.set({ phase: "ended", report });
        return report;
      } catch (e) {
        lastErr = e as Error;
        await sleep(1500 * (attempt + 1));
      }
    }
    this.set({ phase: "failed", errorKind: "network", error: `${lastErr?.message ?? "Couldn't save the call."} Your call is stored — you can get the report later from Recent calls.` });
    return null;
  }

  /** Releases everything (leaving the page). */
  dispose() {
    this.closed = true;
    this.stopMedia();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls = [];
    this.listeners.clear();
  }

  get tutorInfo() {
    return TUTORS[this.snap.tutor];
  }
}
