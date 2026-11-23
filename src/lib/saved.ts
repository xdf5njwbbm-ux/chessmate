/*
 * Your place in an unfinished Stockfish game, blindfold game, lesson or level test, kept on this
 * device. Leaving the page, switching tabs or iOS reloading Safari in the background never loses it.
 * Saves are per account and expire after 30 days without being touched.
 */

const PREFIX = "rca:save:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type Envelope<T> = { v: 1; at: number; data: T };

const keyFor = (uid: string, slot: string) => `${PREFIX}${uid}:${slot}`;

let pruned = false;
function pruneOld() {
  if (pruned) return;
  pruned = true;
  try {
    const stale: string[] = [];
    for (let n = 0; n < localStorage.length; n++) {
      const k = localStorage.key(n);
      if (!k?.startsWith(PREFIX)) continue;
      try {
        const e = JSON.parse(localStorage.getItem(k) ?? "null") as Envelope<unknown> | null;
        if (!e || e.v !== 1 || Date.now() - e.at > MAX_AGE_MS) stale.push(k);
      } catch {
        stale.push(k);
      }
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}

export function loadSave<T>(uid: string | null | undefined, slot: string): T | null {
  if (!uid) return null;
  pruneOld();
  try {
    const raw = localStorage.getItem(keyFor(uid, slot));
    if (!raw) return null;
    const e = JSON.parse(raw) as Envelope<T>;
    if (e?.v !== 1 || Date.now() - e.at > MAX_AGE_MS) {
      localStorage.removeItem(keyFor(uid, slot));
      return null;
    }
    return e.data;
  } catch {
    return null;
  }
}

export function writeSave<T>(uid: string | null | undefined, slot: string, data: T) {
  if (!uid) return;
  try {
    localStorage.setItem(keyFor(uid, slot), JSON.stringify({ v: 1, at: Date.now(), data } satisfies Envelope<T>));
  } catch {
    /* storage full or unavailable: the game still works, it just won't survive a reload */
  }
}

export function clearSave(uid: string | null | undefined, slot: string) {
  if (!uid) return;
  try {
    localStorage.removeItem(keyFor(uid, slot));
  } catch {
    /* storage unavailable */
  }
}

/* ---------- games against Stockfish ---------- */

export type BotMode = "computer" | "blindfold";

/** Blindfold training counters, so the end-of-game summary still covers the whole game. */
export type BlindResume = { reveals: number; streak: number; longest: number; reveal_ms: number; responses: number[] };

export type BotSave = {
  ref: string;
  elo: number;
  color: "w" | "b";
  /** UCI moves, e.g. "e2e4", "e7e8q" */
  moves: string[];
  undos?: number;
  quality?: { acc: number[]; mistakes: number; blunders: number };
  blind?: BlindResume;
};
