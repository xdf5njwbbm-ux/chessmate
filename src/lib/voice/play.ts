// The tutor's voice outside a call (reports and review lessons): one sentence
// at a time, cached, at normal or slow speed.
import { useEffect, useState } from "react";
import { voiceApi } from "./api";
import { stopSpeaking } from "../speech";
import type { TutorId } from "../../../supabase/functions/_shared/voice/curriculum.ts";

const cache = new Map<string, string>();
let player: HTMLAudioElement | null = null;
let current: string | null = null;
const listeners = new Set<(k: string | null) => void>();
const emit = (k: string | null) => {
  current = k;
  listeners.forEach((l) => l(k));
};

export function stopTutor() {
  player?.pause();
  player = null;
  emit(null);
}

export async function playTutor(text: string, tutor: TutorId, rate = 1): Promise<void> {
  const key = `${text}@${rate}`;
  if (current === key) return stopTutor();
  stopTutor();
  stopSpeaking();
  emit(key);
  try {
    let url = cache.get(`${tutor}|${text}`);
    if (!url) {
      url = URL.createObjectURL(await voiceApi.tts(text, tutor));
      cache.set(`${tutor}|${text}`, url);
    }
    if (current !== key) return;
    const a = new Audio(url);
    player = a;
    a.playbackRate = rate;
    (a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    await new Promise<void>((resolve) => {
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.play().catch(() => resolve());
    });
  } finally {
    if (current === key) emit(null);
  }
}

/** Which sentence (text@rate) is playing right now. */
export function useTutorPlaying() {
  const [k, setK] = useState<string | null>(current);
  useEffect(() => {
    listeners.add(setK);
    return () => {
      listeners.delete(setK);
    };
  }, []);
  return k;
}
