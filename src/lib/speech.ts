// Audio for the academy: neural Russian voices (Azure, via the `speech` edge
// function) with a fallback to the device's own Russian voices; speech
// recognition; and microphone recording as 16 kHz WAV for playback and
// pronunciation scoring.
import { callFunction } from "./api";
import { plain, speakable } from "./russian";
import type { Voice } from "./types";

export type SpeechStatus = { configured: boolean; tts: boolean; assess: boolean };
let status: SpeechStatus = { configured: false, tts: false, assess: false };
export const setSpeechStatus = (s: SpeechStatus) => (status = s);
export const speechStatus = () => status;

// ---------------------------------------------------------------- playback state
type Listener = (s: { text: string | null; word: number }) => void;
const listeners = new Set<Listener>();
let current: { text: string | null; word: number } = { text: null, word: -1 };
function emit(next: { text: string | null; word: number }) {
  current = next;
  listeners.forEach((l) => l(current));
}
export function onSpeaking(l: Listener) {
  listeners.add(l);
  l(current);
  return () => listeners.delete(l);
}

let audioEl: HTMLAudioElement | null = null;
let wordTimer: ReturnType<typeof setInterval> | null = null;
const blobCache = new Map<string, string>();

export function stopSpeaking() {
  if (wordTimer) clearInterval(wordTimer);
  wordTimer = null;
  if (audioEl) {
    audioEl.pause();
    audioEl = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  emit({ text: null, word: -1 });
}

// ---------------------------------------------------------------- device voices
let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;
function deviceVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  voicesReady ??= new Promise((resolve) => {
    const pick = () => window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ru"));
    const now = pick();
    if (now.length) return resolve(now);
    const done = () => resolve(pick());
    window.speechSynthesis.addEventListener?.("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
  return voicesReady;
}
const MALE = /(dmitr|yuri|pavel|maxim|male|муж)/i;
const RANKING = [/google/i, /online|natural|neural/i, /milena|svetlana|dariya|katya|irina/i];
function bestDeviceVoice(list: SpeechSynthesisVoice[], voice: Voice) {
  const wantMale = voice === "male";
  const filtered = list.filter((v) => MALE.test(v.name) === wantMale);
  const pool = filtered.length ? filtered : list;
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
  function score(v: SpeechSynthesisVoice) {
    return RANKING.reduce((s, re, i) => s + (re.test(v.name) ? 10 - i : 0), 0) + (v.localService ? 0 : 1);
  }
}
export async function hasDeviceVoice() {
  return (await deviceVoices()).length > 0;
}
export async function deviceVoiceNames() {
  return (await deviceVoices()).map((v) => v.name);
}

// ---------------------------------------------------------------- speak
export type SpeakOptions = { rate?: number; voice?: Voice; userRate?: number };

/**
 * Speaks Russian text. `rate` is 1, 0.75 or 0.5 (playback speed); `userRate`
 * is the learner's preferred base speed from Settings.
 */
export async function speak(text: string, o: SpeakOptions = {}): Promise<void> {
  const clean = plain(text).trim();
  if (!clean) return;
  stopSpeaking();
  const rate = o.rate ?? 1;
  const voice = o.voice ?? "female";
  const words = clean.split(/\s+/);
  emit({ text: clean, word: 0 });

  if (status.tts) {
    try {
      const eff = rate * (o.userRate ?? 1);
      const rateKey = eff <= 0.6 ? "0.5" : eff < 0.9 ? "0.75" : "1";
      const key = `${voice}|${rateKey}|${clean}`;
      let url = blobCache.get(key);
      if (!url) {
        const blob = await callFunction<Blob>("speech", { action: "tts", text: speakable(clean), voice, rate: rateKey });
        url = URL.createObjectURL(blob);
        blobCache.set(key, url);
      }
      if (current.text !== clean) return; // stopped while loading
      await new Promise<void>((resolve, reject) => {
        const a = new Audio(url);
        audioEl = a;
        a.playbackRate = eff > 1.05 ? Math.min(1.25, eff) : 1;
        a.onended = () => resolve();
        a.onerror = () => reject(new Error("audio"));
        a.onloadedmetadata = () => {
          // Neural audio has no word timings here: estimate the current word by length.
          const total = a.duration * 1000;
          const lens = words.map((w) => w.length + 1);
          const sum = lens.reduce((x, y) => x + y, 0);
          const t0 = performance.now();
          wordTimer = setInterval(() => {
            const elapsed = (performance.now() - t0) * a.playbackRate;
            let acc = 0;
            let idx = 0;
            for (; idx < lens.length; idx++) {
              acc += (lens[idx] / sum) * total;
              if (elapsed < acc) break;
            }
            emit({ text: clean, word: Math.min(idx, words.length - 1) });
          }, 80);
        };
        a.play().catch(reject);
      });
      stopSpeaking();
      return;
    } catch {
      /* fall through to the device voice */
    }
  }

  const list = await deviceVoices();
  if (!("speechSynthesis" in window)) {
    stopSpeaking();
    throw new Error("This browser can't play speech.");
  }
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(speakable(clean));
    u.lang = "ru-RU";
    const v = bestDeviceVoice(list, voice);
    if (v) u.voice = v;
    u.rate = Math.max(0.4, Math.min(1.3, rate * (o.userRate ?? 1)));
    u.onboundary = (e) => {
      if (e.name && e.name !== "word") return;
      const before = clean.slice(0, e.charIndex).trim();
      emit({ text: clean, word: before ? before.split(/\s+/).length : 0 });
    };
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
  stopSpeaking();
}

// ---------------------------------------------------------------- recognition
type Recognition = {
  lang: string; interimResults: boolean; maxAlternatives: number; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
function Recognizer(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export const canRecognize = () => !!Recognizer();

export type Listening = { stop: () => void; result: Promise<{ transcript: string; alternatives: string[] }> };
export function listen(onInterim?: (t: string) => void): Listening {
  const R = Recognizer();
  if (!R) throw new Error("Speech recognition isn't available in this browser. Try Chrome, Edge or Safari.");
  const r = new R();
  r.lang = "ru-RU";
  r.interimResults = true;
  r.maxAlternatives = 3;
  r.continuous = false;
  let finalText = "";
  let alts: string[] = [];
  const result = new Promise<{ transcript: string; alternatives: string[] }>((resolve, reject) => {
    r.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          finalText += res[0].transcript;
          alts = Array.from({ length: res.length }, (_, k) => res[k].transcript);
        } else interim += res[0].transcript;
      }
      onInterim?.((finalText + " " + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") resolve({ transcript: finalText.trim(), alternatives: alts });
      else if (e.error === "not-allowed" || e.error === "service-not-allowed") reject(new Error("Microphone access was blocked. Allow it in your browser settings."));
      else reject(new Error("Speech recognition stopped (" + e.error + ")."));
    };
    r.onend = () => resolve({ transcript: finalText.trim(), alternatives: alts });
  });
  r.start();
  return { stop: () => r.stop(), result };
}

// ---------------------------------------------------------------- recording (16 kHz WAV)
export type Recording = { blob: Blob; url: string; base64: string; durationMs: number };
export type Recorder = { stop: () => Promise<Recording>; cancel: () => void; level: () => number };

export const canRecord = () => !!navigator.mediaDevices?.getUserMedia && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

export async function startRecording(): Promise<Recorder> {
  if (!canRecord()) throw new Error("Recording isn't supported in this browser.");
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
  } catch {
    throw new Error("Microphone access was blocked. Allow it in your browser settings to practise speaking.");
  }
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let peak = 0;
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(data));
    let m = 0;
    for (let i = 0; i < data.length; i += 16) m = Math.max(m, Math.abs(data[i]));
    peak = m;
  };
  src.connect(proc);
  proc.connect(ctx.destination);
  const started = performance.now();
  const cleanup = () => {
    proc.disconnect();
    src.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };
  return {
    level: () => peak,
    cancel: cleanup,
    stop: async () => {
      cleanup();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const pcm = new Float32Array(total);
      let off = 0;
      for (const c of chunks) {
        pcm.set(c, off);
        off += c.length;
      }
      const wav = encodeWav(downsample(pcm, ctx.sampleRate, 16000), 16000);
      const blob = new Blob([wav], { type: "audio/wav" });
      return { blob, url: URL.createObjectURL(blob), base64: toBase64(new Uint8Array(wav)), durationMs: Math.round(performance.now() - started) };
    },
  };
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function playUrl(url: string) {
  stopSpeaking();
  const a = new Audio(url);
  audioEl = a;
  return a.play();
}
