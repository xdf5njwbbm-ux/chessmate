import { useEffect, useRef, useState, type ReactNode } from "react";
import { Mic, Play, RotateCcw, Square, Volume2 } from "lucide-react";
import { canRecognize, canRecord, isSpeaking, listen, micIsExclusive, onSpeaking, playUrl, speak, speechStatus, startRecording, stopSpeaking, type Recorder, type Recording } from "../lib/speech";
import { compareWords, normalizeRu, similarity } from "../lib/russian";
import { api, assessPronunciation } from "../lib/api";
import type { Assessment } from "../lib/types";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { Spinner } from "./ui";

/** Current playback (text + word index) for highlighting. */
export function useSpeaking() {
  const [s, setS] = useState<{ text: string | null; word: number }>({ text: null, word: -1 });
  useEffect(() => {
    const off = onSpeaking(setS);
    return () => {
      off();
    };
  }, []);
  return s;
}

export function useSay() {
  const { profile } = useSession();
  const toast = useToast();
  return (text: string, rate = 1) =>
    speak(text, { rate, voice: profile?.voice ?? "female", userRate: Number(profile?.speech_rate ?? 1) }).catch((e) =>
      toast({ title: (e as Error).message || "Couldn't play audio.", tone: "error" }),
    );
}

/** Play at 1×, 0.75× and 0.5×. */
export function AudioButtons({ text, compact, autoFocus }: { text: string; compact?: boolean; autoFocus?: boolean }) {
  const say = useSay();
  const playing = useSpeaking();
  const active = playing.text != null && normalizeRu(playing.text) === normalizeRu(text);
  return (
    <div className="flex items-center gap-1.5">
      <button
        autoFocus={autoFocus}
        aria-label={active ? "Stop" : "Listen"}
        title="Listen"
        onClick={() => (active ? stopSpeaking() : say(text, 1))}
        className={`grid ${compact ? "size-8" : "size-10"} place-items-center rounded-xl transition-colors ${active ? "bg-accent text-ink-950" : "bg-white/[0.07] text-white hover:bg-white/[0.12]"}`}
      >
        {active ? <Square className="size-4 fill-current" /> : <Volume2 className={compact ? "size-4" : "size-[18px]"} />}
      </button>
      {!compact && (
        <>
          <button onClick={() => say(text, 0.75)} className="h-8 rounded-lg bg-white/[0.05] px-2 text-xs font-semibold text-fog hover:bg-white/[0.1]" title="Listen at 0.75×">0.75×</button>
          <button onClick={() => say(text, 0.5)} className="h-8 rounded-lg bg-white/[0.05] px-2 text-xs font-semibold text-fog hover:bg-white/[0.1]" title="Listen at 0.5×">0.5×</button>
        </>
      )}
    </div>
  );
}

type Feedback =
  | { kind: "scored"; a: Assessment }
  | { kind: "recognized"; heard: string; words: { word: string; ok: boolean }[]; passed: boolean; gotSound: boolean }
  | null;

function scoreTone(v: number | null | undefined) {
  if (v == null) return "text-mist";
  if (v >= 80) return "text-accent-soft";
  if (v >= 60) return "text-warn";
  return "text-danger";
}

/** Advice built from Azure's word/phoneme scores (only what the service measured). */
function adviceFrom(a: Assessment): string[] {
  const tips: string[] = [];
  if (a.pron != null) tips.push(a.pron >= 85 ? "Your pronunciation was clear and easy to understand." : a.pron >= 65 ? "Your overall pronunciation was understandable." : "Parts of this were hard to understand — slow down and try again.");
  const weak = a.words.filter((w) => w.error === "Mispronunciation" || (w.accuracy != null && w.accuracy < 60));
  if (weak.length) tips.push(`Work on ${weak.map((w) => `«${w.word}»`).join(", ")}.`);
  const omitted = a.words.filter((w) => w.error === "Omission");
  if (omitted.length) tips.push(`It sounded like you skipped ${omitted.map((w) => `«${w.word}»`).join(", ")}.`);
  const inserted = a.words.filter((w) => w.error === "Insertion");
  if (inserted.length) tips.push("There were extra words — try to say exactly the sentence shown.");
  if (a.fluency != null && a.fluency < 60) tips.push("Try to say it more smoothly, without long pauses between words.");
  if (a.completeness != null && a.completeness < 90) tips.push("Say the whole sentence — some of it wasn't heard.");
  return tips;
}

/**
 * Listen → speak → feedback. With Azure configured, the recording is scored
 * (0–100) on the server. Otherwise the device's recognizer reports which
 * words it understood — useful feedback, but not a pronunciation score.
 */
export function SpeakPractice({ text, refKey, onResult, compact, label = "Say it", leading }: {
  text: string;
  refKey?: string;
  onResult?: (passed: boolean) => void;
  compact?: boolean;
  /** Text on the mic button before the first attempt. */
  label?: string;
  /** Rendered at the start of the button row (e.g. a "Play again" button). */
  leading?: ReactNode;
}) {
  const { entitlements } = useSession();
  const { celebrate } = useLive();
  const toast = useToast();
  const scoring = speechStatus().assess && !!entitlements?.pronunciation_scoring;
  const [state, setState] = useState<"idle" | "recording" | "working">("idle");
  const [interim, setInterim] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [mine, setMine] = useState<Recording | null>(null);
  const [level, setLevel] = useState(0);
  const rec = useRef<Recorder | null>(null);
  const recog = useRef<ReturnType<typeof listen> | null>(null);
  const started = useRef(0);
  const supported = scoring ? canRecord() : canRecognize();

  useEffect(() => () => {
    rec.current?.cancel();
    recog.current?.stop();
  }, []);
  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setLevel(rec.current?.level() ?? 0), 80);
    return () => clearInterval(t);
  }, [state]);
  useEffect(() => {
    setFeedback(null);
    setMine(null);
  }, [text]);

  const start = async () => {
    const wasSpeaking = isSpeaking();
    stopSpeaking();
    setFeedback(null);
    setInterim("");
    started.current = Date.now();
    try {
      if (scoring) {
        rec.current = await startRecording();
        setState("recording");
        return;
      }
      // Device recognizer. On computers, also record alongside it so you can play
      // your attempt back. Phones can't share the microphone between the two —
      // the recording can leave the recognizer with no audio — so there the
      // recognizer gets the mic to itself.
      if (canRecord() && !micIsExclusive()) {
        try {
          rec.current = await startRecording();
        } catch {
          rec.current = null;
        }
      } else if (wasSpeaking) {
        // give the phone a moment to switch from playing audio to listening
        setState("working");
        await new Promise((r) => setTimeout(r, 350));
      }
      recog.current = listen(setInterim);
      setState("recording");
      const { transcript, alternatives, diag } = await recog.current.result;
      recog.current = null;
      const recording = rec.current ? await rec.current.stop() : null;
      rec.current = null;
      setMine(recording);
      const best = [transcript, ...alternatives].sort((a, b) => similarity(normalizeRu(b), normalizeRu(text)) - similarity(normalizeRu(a), normalizeRu(text)))[0] ?? "";
      const words = compareWords(text, best);
      const passed = words.length > 0 && words.filter((w) => w.ok).length / words.length >= 0.8;
      const gotSound = diag.ev.some((e) => /^(sound|speech|result)@/.test(e));
      setFeedback({ kind: "recognized", heard: best, words, passed, gotSound });
      setState("idle");
      api.recordSpeech(text, refKey ?? null, best, words, passed, Date.now() - started.current)
        .then((r) => celebrate(r.new_achievements))
        .catch(() => {})
        .finally(() => onResult?.(passed));
    } catch (e) {
      rec.current?.cancel();
      rec.current = null;
      recog.current = null;
      setState("idle");
      toast({ title: (e as Error).message, tone: "error" });
    }
  };

  const stop = async () => {
    if (recog.current && !scoring) {
      recog.current.stop();
      return;
    }
    if (!rec.current) return;
    setState("working");
    try {
      const recording = await rec.current.stop();
      rec.current = null;
      setMine(recording);
      if (recording.durationMs < 400) throw new Error("That was very short — hold the button a little longer.");
      const r = await assessPronunciation(text, refKey ?? null, recording.base64);
      if (!r.result) {
        toast({ title: r.message ?? "We couldn't hear any speech." });
      } else {
        setFeedback({ kind: "scored", a: r.result });
        onResult?.((r.result.pron ?? 0) >= 70);
      }
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setState("idle");
    }
  };

  if (!supported) {
    return (
      <div>
        {leading && <div className="mb-2 flex flex-wrap items-center gap-2">{leading}</div>}
        <p className="text-sm text-mist">
          Speaking practice needs microphone access and speech recognition. Try Chrome, Edge or Safari on this device.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        {leading}
        {state === "recording" ? (
          <button onClick={stop} className="btn h-11 animate-pulse-ring bg-danger px-4 text-white">
            <Square className="size-4 fill-white" /> Stop
            <span className="ml-1 h-2 w-12 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full bg-white transition-all" style={{ width: `${Math.min(100, level * 260)}%` }} />
            </span>
          </button>
        ) : (
          <button onClick={start} disabled={state === "working"} className="btn btn-primary h-11 px-4">
            {state === "working" ? <Spinner className="size-5 text-ink-950" /> : <Mic className="size-[18px]" />}
            {feedback ? "Try again" : label}
          </button>
        )}
        {mine && state === "idle" && (
          <button onClick={() => playUrl(mine.url)} className="btn btn-secondary h-11 px-3.5" title="Play your recording">
            <Play className="size-4" /> You
          </button>
        )}
        {state === "recording" && interim && <span className="text-sm text-mist">“{interim}”</span>}
      </div>

      {feedback?.kind === "scored" && (
        <div className="mt-4 animate-rise">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <div className="text-xs text-mist">Pronunciation</div>
              <div className={`text-3xl font-semibold tabular-nums ${scoreTone(feedback.a.pron)}`}>{feedback.a.pron != null ? Math.round(feedback.a.pron) : "–"}<span className="text-base text-faint">/100</span></div>
            </div>
            {[["Accuracy", feedback.a.accuracy], ["Fluency", feedback.a.fluency], ["Completeness", feedback.a.completeness]].map(([l, v]) => (
              <div key={l as string}>
                <div className="text-xs text-mist">{l}</div>
                <div className={`text-lg font-semibold tabular-nums ${scoreTone(v as number | null)}`}>{v != null ? Math.round(v as number) : "–"}</div>
              </div>
            ))}
          </div>
          <div className="ru mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xl">
            {feedback.a.words.map((w, i) => (
              <span key={i} className={`rounded px-1 ${w.error === "Omission" ? "text-faint line-through" : scoreTone(w.accuracy)}`} title={w.accuracy != null ? `${Math.round(w.accuracy)}/100` : w.error}>
                {w.word}
              </span>
            ))}
          </div>
          {feedback.a.words.some((w) => w.phonemes.some((p) => p.accuracy != null && p.accuracy < 60)) && (
            <div className="mt-2 text-sm text-mist">
              Sounds to work on:{" "}
              {feedback.a.words.flatMap((w) => w.phonemes.filter((p) => p.accuracy != null && p.accuracy < 60).map((p) => `${p.p} in «${w.word}»`)).slice(0, 4).join(", ")}
            </div>
          )}
          <ul className="mt-3 grid gap-1 text-sm text-fog">
            {adviceFrom(feedback.a).map((t) => <li key={t}>• {t}</li>)}
          </ul>
          <div className="mt-3 flex items-center gap-2 text-xs text-faint">
            <RotateCcw className="size-3.5" /> Compare: play the native audio, then your recording.
          </div>
        </div>
      )}

      {feedback?.kind === "recognized" && (
        <div className="mt-4 animate-rise">
          <div className={`text-sm font-semibold ${feedback.passed ? "text-accent-soft" : "text-warn"}`}>
            {feedback.passed
              ? "Understood! The recognizer heard every key word."
              : feedback.heard
                ? "Almost — some words weren't recognized."
                : feedback.gotSound
                  ? "We heard you, but your phone's recognizer didn't return any words. Tap Try again and speak right after the mic turns red."
                  : "No sound reached the recognizer. Tap Try again — if it keeps happening, reload the page."}
          </div>
          <div className="ru mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xl">
            {feedback.words.map((w, i) => (
              <span key={i} className={w.ok ? "text-accent-soft" : "text-danger underline decoration-dotted underline-offset-4"}>{w.word}</span>
            ))}
          </div>
          {feedback.heard && <div className="mt-2 text-sm text-mist">Heard: “{feedback.heard}”</div>}
          <p className="mt-2 text-xs text-faint">
            Feedback comes from your device's speech recognizer: it shows which words were understood, not a sound-by-sound score.
          </p>
        </div>
      )}
    </div>
  );
}
