import { Chess, type Move } from "chess.js";
import { clearSave, loadSave, type BotMode, type BotSave } from "./saved";

export const toUci = (m: Move) => m.from + m.to + (m.promotion ?? "");

/** Rebuilds the move list; null if any move is illegal (a corrupted save). */
export function replay(uci: string[]): Move[] | null {
  const c = new Chess();
  const out: Move[] = [];
  try {
    for (const u of uci) out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }));
  } catch {
    return null;
  }
  return out;
}

/** A saved game worth resuming: valid moves and the game isn't already over. */
export function loadBotGame(uid: string | null | undefined, mode: BotMode): (BotSave & { history: Move[] }) | null {
  const s = loadSave<BotSave>(uid, mode);
  if (!s || !Array.isArray(s.moves) || !s.moves.length || (s.color !== "w" && s.color !== "b") || !Number.isFinite(s.elo)) return null;
  const history = replay(s.moves);
  if (!history || new Chess(history.at(-1)!.after).isGameOver()) {
    clearSave(uid, mode);
    return null;
  }
  return { ...s, history };
}
