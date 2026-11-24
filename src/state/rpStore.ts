// A small shared store for the role-play conversation, so the panel beside the board,
// the phone pop-up and the practice page all show the same conversation. The heavy
// part (content, engine) lives in lib/roleplay/session.ts and loads on demand.

import { useSyncExternalStore } from "react";
import type { Line, Memory, State, Turn } from "../lib/roleplay/engine";

export type Msg =
  | { id: number; who: "ai"; line: Line; at: number }
  | { id: number; who: "me"; turn: Turn; via: "text" | "voice"; at: number };

export type RpSession = {
  v: 2;
  st: State;
  msgs: Msg[];
  /** The next question, waiting for the opponent's move (in a game). */
  queued: Line[];
  seq: number;
  lastPly: number | null;
  conv: string | null;
  convTurns: number;
  started: number;
  touched: number;
  /** A question was held back for one move (so it doesn't feel like a quiz). */
  held?: boolean;
};

export type RpSnap = { s: RpSession | null; mem: Memory | null; busy: boolean; uid: string | null };

let snap: RpSnap = { s: null, mem: null, busy: false, uid: null };
const subs = new Set<() => void>();

export const rpGet = () => snap;
export function rpSet(p: Partial<RpSnap>) {
  snap = { ...snap, ...p };
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};
export const useRp = () => useSyncExternalStore(subscribe, rpGet, rpGet);

/** The partner's question still waiting for your answer, if any. */
export function rpPending(s: RpSession | null): Line | null {
  if (!s) return null;
  for (let i = s.msgs.length - 1; i >= 0; i--) {
    const m = s.msgs[i];
    if (m.who === "me") return null;
    if (m.line.kind === "ask") return m.line;
  }
  return null;
}

// ---------------------------------------------------------------- moves on the board

export type RpMove = { ply: number; key: string; myKey: string | null; bot: boolean };
type Handlers = { move: (m: RpMove) => void };
let handlers: Handlers | null = null;
let buffered: RpMove | null = null;

/** Called by the game panels after the opponent moves. */
export function rpMove(m: RpMove) {
  if (handlers) handlers.move(m);
  else buffered = m;
}
export function registerRp(h: Handlers) {
  handlers = h;
  if (buffered) {
    const m = buffered;
    buffered = null;
    h.move(m);
  }
}
