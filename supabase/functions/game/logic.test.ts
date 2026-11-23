// Run: npm run test:chess
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { applyAction, cannotMate, replay, validateAiGame, type Game } from "./logic.ts";

const W = "white-user";
const B = "black-user";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function newGame(over: Partial<Game> = {}): Game {
  return {
    id: "g1", white_id: W, black_id: B, time_control: "blitz5", opponent_kind: "human", rated: true,
    initial_ms: 300000, increment_ms: 0, per_move: false, status: "active", result: null,
    termination: null, fen: START, moves: [], sans: [], white_ms: 300000, black_ms: 300000,
    turn_started_at: new Date(0).toISOString(), draw_offer_from: null, version: 0, ...over,
  };
}

/** Apply a sequence of UCI moves as alternating players, `step` ms apart. */
function play(g: Game, ucis: string[], start = 1_000_000, step = 1000): { g: Game; t: number } {
  let t = start;
  for (const u of ucis) {
    const who = g.moves.length % 2 === 0 ? W : B;
    const out = applyAction(g, who, "move", u, t);
    assert.ok(out.ok, `move ${u} failed: ${!out.ok ? out.error : ""}`);
    g = { ...g, ...(out.patch as Partial<Game>), version: g.version + 1 };
    t += step;
  }
  return { g, t };
}

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ✓ " + name);
}

test("legal opening move is accepted and SAN recorded", () => {
  const { g } = play(newGame(), ["e2e4"]);
  assert.deepEqual(g.moves, ["e2e4"]);
  assert.deepEqual(g.sans, ["e4"]);
  assert.match(g.fen, / b KQkq/);
});

test("illegal move is rejected", () => {
  const out = applyAction(newGame(), W, "move", "e2e5", 1);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.code, "illegal");
});

test("garbage input is rejected", () => {
  const out = applyAction(newGame(), W, "move", "'; drop table", 1);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.code, "bad_move");
});

test("moving out of turn is rejected", () => {
  const out = applyAction(newGame(), B, "move", "e7e5", 1);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.code, "not_your_turn");
});

test("outsider cannot act", () => {
  const out = applyAction(newGame(), "stranger", "resign", undefined, 1);
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.status, 403);
});

test("fool's mate is checkmate, black wins", () => {
  const { g } = play(newGame(), ["f2f3", "e7e5", "g2g4", "d8h4"]);
  assert.equal(g.status, "finished");
  assert.equal(g.result, "0-1");
  assert.equal(g.termination, "checkmate");
});

test("castling kingside works", () => {
  const { g } = play(newGame(), ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "g8f6", "e1g1"]);
  assert.equal(g.sans.at(-1), "O-O");
});

test("en passant works", () => {
  const { g } = play(newGame(), ["e2e4", "a7a6", "e4e5", "d7d5", "e5d6"]);
  assert.equal(g.sans.at(-1), "exd6");
  assert.equal(replay(g.moves).get("d5"), undefined);
});

test("promotion to queen and underpromotion", () => {
  const seq = ["h2h4", "g7g5", "h4g5", "h7h6", "g5h6", "f8g7", "h6g7", "a7a6"];
  const { g } = play(newGame(), [...seq, "g7h8q"]);
  assert.equal(g.sans.at(-1), "gxh8=Q");
  const { g: g2 } = play(newGame(), [...seq, "g7h8n"]);
  assert.equal(g2.sans.at(-1), "gxh8=N");
});

test("threefold repetition ends in a draw", () => {
  const knights = ["g1f3", "g8f6", "f3g1", "f6g8"];
  const { g } = play(newGame(), [...knights, ...knights]);
  assert.equal(g.status, "finished");
  assert.equal(g.result, "1/2-1/2");
  assert.equal(g.termination, "threefold");
});

test("stalemate is detected", () => {
  // Shortest known stalemate (Sam Loyd, 10 moves)
  const seq = ["e2e3","a7a5","d1h5","a8a6","h5a5","h7h5","h2h4","a6h6","a5c7","f7f6",
               "c7d7","e8f7","d7b7","d8d3","b7b8","d3h7","b8c8","f7g6","c8e6"];
  const { g } = play(newGame(), seq);
  assert.equal(g.termination, "stalemate");
  assert.equal(g.result, "1/2-1/2");
});

test("first move of each side is untimed, then the clock runs", () => {
  let g = newGame();
  ({ g } = play(g, ["e2e4"], 0, 60_000));        // white thinks 60s on move 1
  assert.equal(g.white_ms, 300000);
  const out = applyAction(g, B, "move", "e7e5", 60_000 + 90_000); // black thinks 90s
  assert.ok(out.ok);
  g = { ...g, ...(out.patch as Partial<Game>) };
  assert.equal(g.black_ms, 300000);
  const out2 = applyAction(g, W, "move", "g1f3", 150_000 + 12_000); // white thinks 12s
  assert.ok(out2.ok);
  g = { ...g, ...(out2.patch as Partial<Game>) };
  assert.equal(g.white_ms, 300000 - 12_000);
});

test("moving after your time ran out loses on time", () => {
  let { g, t } = play(newGame({ white_ms: 5000, black_ms: 5000 }), ["e2e4", "e7e5"]);
  const out = applyAction(g, W, "move", "g1f3", t + 6000);
  assert.ok(out.ok && out.finished);
  if (out.ok) {
    assert.equal(out.patch.result, "0-1");
    assert.equal(out.patch.termination, "timeout");
    assert.equal(out.patch.white_ms, 0);
  }
});

test("flag only succeeds once the clock really is out", () => {
  const { g, t } = play(newGame({ white_ms: 5000, black_ms: 5000 }), ["e2e4", "e7e5"]);
  const early = applyAction(g, B, "flag", undefined, t + 1000);
  assert.equal(early.ok, false);
  const late = applyAction(g, B, "flag", undefined, t + 5001);
  assert.ok(late.ok && late.finished);
  if (late.ok) assert.equal(late.patch.result, "0-1");
});

test("insufficient mating material is recognised per side (timeout rule)", () => {
  assert.equal(cannotMate(new Chess("8/8/8/4k3/8/8/8/4K2q w - - 0 1"), "w"), true);   // lone king
  assert.equal(cannotMate(new Chess("8/8/8/4k3/8/8/8/4K2q w - - 0 1"), "b"), false);  // has a queen
  assert.equal(cannotMate(new Chess("8/8/8/4k3/8/8/8/4KN1q w - - 0 1"), "w"), true);  // king + knight
  assert.equal(cannotMate(new Chess("8/8/8/4k3/8/8/P7/4KN1q w - - 0 1"), "w"), false); // pawn can promote
});

test("draw offer, then opponent accepts", () => {
  let { g, t } = play(newGame(), ["e2e4", "e7e5"]);
  const offer = applyAction(g, W, "offer_draw", undefined, t);
  assert.ok(offer.ok);
  g = { ...g, ...(offer.patch as Partial<Game>) };
  assert.equal(g.draw_offer_from, W);
  const acc = applyAction(g, B, "accept_draw", undefined, t + 10);
  assert.ok(acc.ok && acc.finished);
  if (acc.ok) assert.equal(acc.patch.termination, "agreement");
});

test("you cannot accept your own draw offer", () => {
  let { g, t } = play(newGame(), ["e2e4", "e7e5"]);
  const offer = applyAction(g, W, "offer_draw", undefined, t);
  g = { ...g, ...((offer.ok ? offer.patch : {}) as Partial<Game>) };
  const acc = applyAction(g, W, "accept_draw", undefined, t + 10);
  assert.equal(acc.ok, false);
});

test("moving declines the opponent's draw offer", () => {
  let { g, t } = play(newGame(), ["e2e4", "e7e5", "g1f3"]);
  const offer = applyAction(g, W, "offer_draw", undefined, t);
  g = { ...g, ...((offer.ok ? offer.patch : {}) as Partial<Game>) };
  const mv = applyAction(g, B, "move", "b8c6", t + 100);
  assert.ok(mv.ok);
  if (mv.ok) assert.equal(mv.patch.draw_offer_from, null);
});

test("abort allowed only before both sides moved", () => {
  const a1 = applyAction(newGame(), B, "abort", undefined, 1);
  assert.ok(a1.ok);
  if (a1.ok) assert.equal(a1.patch.status, "aborted");
  const { g } = play(newGame(), ["e2e4", "e7e5"]);
  const a2 = applyAction(g, W, "abort", undefined, 1);
  assert.equal(a2.ok, false);
});

test("resign gives the win to the opponent", () => {
  const out = applyAction(newGame(), W, "resign", undefined, 1);
  assert.ok(out.ok);
  if (out.ok) assert.equal(out.patch.result, "0-1");
});

test("correspondence resets the per-move deadline", () => {
  const corr = newGame({ time_control: "correspondence", per_move: true, initial_ms: 259200000,
                         white_ms: 259200000, black_ms: 259200000 });
  const { g } = play(corr, ["e2e4", "e7e5", "g1f3"], 0, 3_600_000);
  assert.equal(g.white_ms, 259200000);
  assert.equal(g.black_ms, 259200000);
});

test("no actions after the game is over", () => {
  const out = applyAction(newGame({ status: "finished", result: "1-0" }), W, "move", "e2e4", 1);
  assert.equal(out.ok, false);
});

test("increment is added after each timed move", () => {
  let g = newGame({ increment_ms: 2000, white_ms: 180000, black_ms: 180000, initial_ms: 180000 });
  ({ g } = play(g, ["e2e4", "e7e5"], 0, 1000));
  const out = applyAction(g, W, "move", "g1f3", Date.parse(g.turn_started_at) + 5000);
  assert.ok(out.ok);
  if (out.ok) assert.equal(out.patch.white_ms, 180000 - 5000 + 2000);
});

test("AI game: checkmate is accepted with the right winner", () => {
  const r = validateAiGame({ moves: ["f2f3", "e7e5", "g2g4", "d8h4"], color: "w", ai_elo: 1500, claim: "over", undo_count: 0 });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.result, "0-1");
    assert.equal(r.termination, "checkmate");
  }
});

test("AI game: resigning gives the engine the win", () => {
  const r = validateAiGame({ moves: ["e2e4", "e7e5", "g1f3"], color: "b", ai_elo: 800, claim: "resign", undo_count: 2 });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.result, "1-0");
});

test("AI game: an unfinished game can't be claimed as over", () => {
  const r = validateAiGame({ moves: ["e2e4", "e7e5"], color: "w", ai_elo: 1500, claim: "over", undo_count: 0 });
  assert.equal(r.ok, false);
});

test("AI game: illegal or garbage moves are rejected", () => {
  assert.equal(validateAiGame({ moves: ["e2e5", "e7e5"], color: "w", ai_elo: 1500, claim: "resign", undo_count: 0 }).ok, false);
  assert.equal(validateAiGame({ moves: ["e2e4", "drop table"], color: "w", ai_elo: 1500, claim: "resign", undo_count: 0 }).ok, false);
  assert.equal(validateAiGame({ moves: ["e2e4", "e7e5"], color: "w", ai_elo: 99999, claim: "resign", undo_count: 0 }).ok, false);
});

test("AI game: moves after mate are rejected", () => {
  const r = validateAiGame({ moves: ["f2f3", "e7e5", "g2g4", "d8h4", "e1f2"], color: "w", ai_elo: 1500, claim: "over", undo_count: 0 });
  assert.equal(r.ok, false);
});

console.log(`\n${passed} tests passed`);
