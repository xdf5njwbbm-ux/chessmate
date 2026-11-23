// Russian Chess Academy — authoritative game logic (pure, no I/O).
// Used by the `game` edge function; also runs under Node for tests.
// Elo is applied in the database (apply_game_ratings) once a rated game ends.
import { Chess } from "chess.js";

export type Game = {
  id: string;
  white_id: string | null;
  black_id: string | null;
  time_control: string;
  opponent_kind: "human" | "ai";
  rated: boolean;
  initial_ms: number;
  increment_ms: number;
  per_move: boolean;
  status: "active" | "finished" | "aborted";
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  termination: string | null;
  fen: string;
  moves: string[];
  sans: string[];
  white_ms: number;
  black_ms: number;
  turn_started_at: string;
  draw_offer_from: string | null;
  version: number;
};

export type ActionType = "move" | "resign" | "abort" | "offer_draw" | "accept_draw" | "decline_draw" | "flag";
export const ACTIONS: ActionType[] = ["move", "resign", "abort", "offer_draw", "accept_draw", "decline_draw", "flag"];

export type Outcome =
  | { ok: true; patch: Partial<Game> & Record<string, unknown>; finished: boolean }
  | { ok: false; status: number; error: string; code: string };

const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function replay(moves: string[]): Chess {
  const chess = new Chess();
  for (const m of moves) {
    chess.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] || undefined });
  }
  return chess;
}

/** True when `color` cannot possibly deliver mate (lone king, or king + one minor piece). */
export function cannotMate(chess: Chess, color: "w" | "b"): boolean {
  const pieces: string[] = [];
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.color === color && sq.type !== "k") pieces.push(sq.type);
    }
  }
  return pieces.length === 0 || (pieces.length === 1 && (pieces[0] === "n" || pieces[0] === "b"));
}

function fail(status: number, code: string, error: string): Outcome {
  return { ok: false, status, code, error };
}

export function applyAction(game: Game, userId: string, action: ActionType, uci: string | undefined, nowMs: number): Outcome {
  const myColor: "w" | "b" | null = game.white_id === userId ? "w" : game.black_id === userId ? "b" : null;
  if (!myColor) return fail(403, "not_player", "You're not playing in this game.");
  if (game.status !== "active") return fail(409, "game_over", "This game is already over.");

  const opponentId = myColor === "w" ? game.black_id : game.white_id;
  const ply = game.moves.length;
  const turn: "w" | "b" = ply % 2 === 0 ? "w" : "b";
  const clockRunning = ply >= 2; // each side's first move is untimed
  const elapsed = clockRunning ? Math.max(0, nowMs - Date.parse(game.turn_started_at)) : 0;
  const turnMs = turn === "w" ? game.white_ms : game.black_ms;
  const remaining = turnMs - elapsed;
  const nowIso = new Date(nowMs).toISOString();

  const finish = (result: Game["result"], termination: string, extra: Record<string, unknown> = {}): Outcome => ({
    ok: true,
    finished: true,
    patch: {
      status: "finished",
      result,
      termination,
      finished_at: nowIso,
      draw_offer_from: null,
      // freeze the running clock at the moment the game ended
      ...(turn === "w" ? { white_ms: Math.max(0, remaining) } : { black_ms: Math.max(0, remaining) }),
      turn_started_at: nowIso,
      ...extra,
    },
  });

  const winFor = (c: "w" | "b"): Game["result"] => (c === "w" ? "1-0" : "0-1");
  const other = (c: "w" | "b"): "w" | "b" => (c === "w" ? "b" : "w");

  const timeoutFinish = (): Outcome => {
    const chess = replay(game.moves);
    const winner = other(turn);
    if (cannotMate(chess, winner)) return finish("1/2-1/2", "timeout_vs_insufficient");
    return finish(winFor(winner), "timeout");
  };

  switch (action) {
    case "move": {
      if (turn !== myColor) return fail(409, "not_your_turn", "It's not your turn.");
      if (clockRunning && remaining <= 0) return timeoutFinish();
      if (!uci || !UCI_RE.test(uci)) return fail(400, "bad_move", "That move isn't valid.");

      let chess: Chess;
      try {
        chess = replay(game.moves);
      } catch {
        return fail(500, "corrupt", "This game's history couldn't be loaded.");
      }
      let mv;
      try {
        mv = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
      } catch {
        return fail(400, "illegal", "That move isn't legal.");
      }
      if (!mv) return fail(400, "illegal", "That move isn't legal.");

      const canonical = mv.from + mv.to + (mv.promotion ?? "");
      let moverMs = myColor === "w" ? game.white_ms : game.black_ms;
      let oppMs = myColor === "w" ? game.black_ms : game.white_ms;
      if (game.per_move) {
        moverMs = game.initial_ms;
        oppMs = game.initial_ms;
      } else if (clockRunning) {
        moverMs = remaining + game.increment_ms;
      }

      const patch: Record<string, unknown> = {
        fen: chess.fen(),
        moves: [...game.moves, canonical],
        sans: [...game.sans, mv.san],
        white_ms: myColor === "w" ? moverMs : oppMs,
        black_ms: myColor === "b" ? moverMs : oppMs,
        turn_started_at: nowIso,
        // moving declines a pending offer from the opponent; your own offer stands
        draw_offer_from: game.draw_offer_from === userId ? userId : null,
      };

      const end = (result: Game["result"], termination: string): Outcome => ({
        ok: true,
        finished: true,
        patch: { ...patch, status: "finished", result, termination, finished_at: nowIso, draw_offer_from: null },
      });
      if (chess.isCheckmate()) return end(winFor(myColor), "checkmate");
      if (chess.isStalemate()) return end("1/2-1/2", "stalemate");
      if (chess.isInsufficientMaterial()) return end("1/2-1/2", "insufficient");
      if (chess.isThreefoldRepetition()) return end("1/2-1/2", "threefold");
      if (chess.isDrawByFiftyMoves()) return end("1/2-1/2", "fifty_move");
      return { ok: true, finished: false, patch };
    }

    case "resign":
      return finish(winFor(other(myColor)), "resign");

    case "abort":
      if (ply >= 2) return fail(409, "too_late", "It's too late to abort. You can resign instead.");
      return {
        ok: true,
        finished: true,
        patch: { status: "aborted", termination: "abort", finished_at: nowIso, draw_offer_from: null },
      };

    case "offer_draw":
      if (ply < 2) return fail(409, "too_early", "Make your first move before offering a draw.");
      if (clockRunning && remaining <= 0) return timeoutFinish();
      if (game.draw_offer_from && game.draw_offer_from === opponentId) return finish("1/2-1/2", "agreement");
      if (game.draw_offer_from === userId) return { ok: true, finished: false, patch: {} };
      return { ok: true, finished: false, patch: { draw_offer_from: userId } };

    case "accept_draw":
      if (!game.draw_offer_from || game.draw_offer_from !== opponentId) {
        return fail(409, "no_offer", "There's no draw offer to accept.");
      }
      if (clockRunning && remaining <= 0) return timeoutFinish();
      return finish("1/2-1/2", "agreement");

    case "decline_draw":
      if (game.draw_offer_from && game.draw_offer_from === opponentId) {
        return { ok: true, finished: false, patch: { draw_offer_from: null } };
      }
      return { ok: true, finished: false, patch: {} };

    case "flag":
      if (!clockRunning) return fail(409, "not_started", "The clock hasn't started yet.");
      if (remaining > 0) return fail(409, "not_flagged", "There's still time on the clock.");
      return timeoutFinish();
  }
  return fail(400, "unknown_action", "Unknown action.");
}

export type AiRecord = {
  moves: string[];
  color: "w" | "b";
  ai_elo: number;
  claim: "over" | "resign";
  undo_count: number;
};

export type AiOutcome =
  | { ok: true; fen: string; sans: string[]; moves: string[]; result: "1-0" | "0-1" | "1/2-1/2"; termination: string }
  | { ok: false; error: string };

/**
 * Validates a finished game against the engine before it is saved to the
 * player's history. Every move is replayed with chess.js; a result is only
 * accepted when the final position (or the player's resignation) supports it.
 * Games against the engine are never rated.
 */
export function validateAiGame(r: AiRecord): AiOutcome {
  if (!Array.isArray(r.moves) || r.moves.length < 2 || r.moves.length > 800) return { ok: false, error: "Nothing to save yet." };
  if (r.color !== "w" && r.color !== "b") return { ok: false, error: "Bad request." };
  if (!Number.isInteger(r.ai_elo) || r.ai_elo < 100 || r.ai_elo > 3200) return { ok: false, error: "Bad request." };
  const chess = new Chess();
  const moves: string[] = [];
  const sans: string[] = [];
  for (const u of r.moves) {
    if (typeof u !== "string" || !UCI_RE.test(u)) return { ok: false, error: "That game contains an invalid move." };
    try {
      const mv = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      moves.push(mv.from + mv.to + (mv.promotion ?? ""));
      sans.push(mv.san);
    } catch {
      return { ok: false, error: "That game contains an illegal move." };
    }
    if (chess.isGameOver() && moves.length < r.moves.length) return { ok: false, error: "Moves continue after the game ended." };
  }
  const winFor = (c: "w" | "b") => (c === "w" ? "1-0" : "0-1") as "1-0" | "0-1";
  if (r.claim === "resign") {
    if (chess.isGameOver()) return { ok: false, error: "The game was already over." };
    return { ok: true, fen: chess.fen(), sans, moves, result: winFor(r.color === "w" ? "b" : "w"), termination: "resign" };
  }
  if (chess.isCheckmate()) return { ok: true, fen: chess.fen(), sans, moves, result: winFor(chess.turn() === "w" ? "b" : "w"), termination: "checkmate" };
  if (chess.isStalemate()) return { ok: true, fen: chess.fen(), sans, moves, result: "1/2-1/2", termination: "stalemate" };
  if (chess.isInsufficientMaterial()) return { ok: true, fen: chess.fen(), sans, moves, result: "1/2-1/2", termination: "insufficient" };
  if (chess.isThreefoldRepetition()) return { ok: true, fen: chess.fen(), sans, moves, result: "1/2-1/2", termination: "threefold" };
  if (chess.isDrawByFiftyMoves()) return { ok: true, fen: chess.fen(), sans, moves, result: "1/2-1/2", termination: "fifty_move" };
  return { ok: false, error: "The game isn't over yet." };
}
