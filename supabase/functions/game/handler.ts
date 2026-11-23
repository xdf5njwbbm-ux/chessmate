// Russian Chess Academy — `game` edge function.
// The only way a game changes state. Validates the caller, replays the game
// with chess.js, checks legality and clocks, and writes with an optimistic
// version check so two simultaneous requests can't both apply. When a game
// ends, finalize_game() applies Elo (rated games only), activity and
// achievements in one database transaction.
import { ACTIONS, applyAction, validateAiGame, type ActionType, type Game } from "./logic.ts";
import { admin, caller, CORS, json } from "../_shared/http.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function finalize(gameId: string) {
  const db = admin();
  const { error } = await db.rpc("finalize_game", { p_game: gameId });
  if (error) console.error("finalize_game failed", gameId, error.message);
  const { data } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
  return data;
}

async function recordAi(userId: string, body: Record<string, unknown>): Promise<Response> {
  const db = admin();
  const ref = String(body.client_ref ?? "");
  if (!UUID_RE.test(ref)) return json({ error: "Bad request." }, 400);
  const { data: existing } = await db.from("games").select("*").eq("client_ref", ref).maybeSingle();
  if (existing) {
    if (existing.white_id !== userId && existing.black_id !== userId) return json({ error: "Bad request." }, 400);
    return json({ game: existing });
  }
  const { count } = await db.from("games").select("id", { count: "exact", head: true })
    .eq("opponent_kind", "ai").or(`white_id.eq.${userId},black_id.eq.${userId}`)
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= 60) return json({ error: "You've saved a lot of games this hour. Try again later." }, 429);

  const color = body.color === "b" ? "b" : "w";
  const out = validateAiGame({
    moves: Array.isArray(body.moves) ? (body.moves as string[]) : [],
    color,
    ai_elo: Number(body.ai_elo),
    claim: body.claim === "resign" ? "resign" : "over",
    undo_count: Number(body.undo_count) || 0,
  });
  if (!out.ok) return json({ error: out.error }, 400);
  const now = new Date().toISOString();
  const { data: game, error } = await db.from("games").insert({
    white_id: color === "w" ? userId : null,
    black_id: color === "b" ? userId : null,
    opponent_kind: "ai",
    ai_elo: Number(body.ai_elo),
    time_control: "untimed",
    pool: "untimed",
    rated: false,
    status: "finished",
    result: out.result,
    termination: out.termination,
    fen: out.fen,
    moves: out.moves,
    sans: out.sans,
    undo_count: Math.max(0, Math.min(10000, Number(body.undo_count) || 0)),
    client_ref: ref,
    finished_at: now,
    turn_started_at: now,
  }).select("*").single();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      const { data: again } = await db.from("games").select("*").eq("client_ref", ref).maybeSingle();
      return json({ game: again });
    }
    console.error(error);
    return json({ error: "Couldn't save the game." }, 500);
  }
  return json({ game: await finalize(game.id) });
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "Please sign in." }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  if (body.action === "record_ai") return recordAi(user.id, body);

  const db = admin();
  const gameId = String(body.game_id ?? "");
  const action = body.action as ActionType;
  if (!UUID_RE.test(gameId) || !ACTIONS.includes(action)) return json({ error: "Bad request." }, 400);

  const { data: game, error: loadError } = await db.from("games").select("*").eq("id", gameId).maybeSingle();
  if (loadError) return json({ error: "Couldn't load the game." }, 500);
  if (!game || (game.white_id !== user.id && game.black_id !== user.id) || game.opponent_kind !== "human") {
    return json({ error: "Game not found." }, 404);
  }

  const now = Date.now();
  const outcome = applyAction(game as Game, user.id, action, typeof body.uci === "string" ? body.uci : undefined, now);
  if (!outcome.ok) return json({ error: outcome.error, code: outcome.code, game, server_now: now }, outcome.status);
  if (Object.keys(outcome.patch).length === 0) return json({ game, server_now: now });

  const patch = { ...outcome.patch, version: game.version + 1, updated_at: new Date(now).toISOString() };
  const { data: updated, error: saveError } = await db
    .from("games")
    .update(patch)
    .eq("id", game.id)
    .eq("version", game.version)
    .select("*")
    .maybeSingle();
  if (saveError) return json({ error: "Couldn't save that. Try again." }, 500);
  if (!updated) {
    const { data: fresh } = await db.from("games").select("*").eq("id", game.id).maybeSingle();
    return json({ error: "The board changed. Try again.", code: "conflict", game: fresh, server_now: Date.now() }, 409);
  }
  if (updated.status === "finished") {
    return json({ game: (await finalize(updated.id)) ?? updated, server_now: Date.now() });
  }
  return json({ game: updated, server_now: Date.now() });
}
