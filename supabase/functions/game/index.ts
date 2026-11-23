// Chessmate — `game` edge function.
// The only way a game changes state. Validates the caller, replays the game
// with chess.js, checks legality and clocks, and writes with an optimistic
// version check so two simultaneous requests can't both apply.
import { createClient } from "@supabase/supabase-js";
import { ACTIONS, applyAction, ratingDeltas, type ActionType, type Game } from "./logic.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (authError || !user || user.is_anonymous) return json({ error: "Please sign in." }, 401);

  let body: { game_id?: string; action?: string; uci?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const gameId = body.game_id ?? "";
  const action = body.action as ActionType;
  if (!UUID_RE.test(gameId) || !ACTIONS.includes(action)) return json({ error: "Bad request." }, 400);

  const { data: game, error: loadError } = await admin.from("games").select("*").eq("id", gameId).maybeSingle();
  if (loadError) return json({ error: "Couldn't load the game." }, 500);
  if (!game || (game.white_id !== user.id && game.black_id !== user.id)) {
    return json({ error: "Game not found." }, 404);
  }

  const now = Date.now();
  const outcome = applyAction(game as Game, user.id, action, body.uci, now);
  if (!outcome.ok) {
    return json({ error: outcome.error, code: outcome.code, game, server_now: now }, outcome.status);
  }
  if (Object.keys(outcome.patch).length === 0) {
    return json({ game, server_now: now });
  }

  const patch: Record<string, unknown> = {
    ...outcome.patch,
    version: game.version + 1,
    updated_at: new Date(now).toISOString(),
  };

  // Competitive games move the in-app rating (never the self-reported Elo).
  let ratingWrites: { id: string; app_rating: number; rated_games: number }[] = [];
  if (patch.status === "finished" && game.mode === "competitive" && game.white_id && game.black_id && patch.result) {
    const { data: players } = await admin
      .from("profiles")
      .select("id, app_rating, rated_games")
      .in("id", [game.white_id, game.black_id]);
    const w = players?.find((p) => p.id === game.white_id);
    const b = players?.find((p) => p.id === game.black_id);
    if (w && b) {
      const d = ratingDeltas(w, b, patch.result as "1-0" | "0-1" | "1/2-1/2");
      patch.white_delta = d.white;
      patch.black_delta = d.black;
      ratingWrites = [
        { id: w.id, app_rating: Math.max(100, w.app_rating + d.white), rated_games: w.rated_games + 1 },
        { id: b.id, app_rating: Math.max(100, b.app_rating + d.black), rated_games: b.rated_games + 1 },
      ];
    }
  }

  const { data: updated, error: saveError } = await admin
    .from("games")
    .update(patch)
    .eq("id", game.id)
    .eq("version", game.version)
    .select("*")
    .maybeSingle();
  if (saveError) return json({ error: "Couldn't save that. Try again." }, 500);
  if (!updated) {
    const { data: fresh } = await admin.from("games").select("*").eq("id", game.id).maybeSingle();
    return json({ error: "The board changed. Try again.", code: "conflict", game: fresh, server_now: Date.now() }, 409);
  }

  for (const r of ratingWrites) {
    await admin.from("profiles").update({ app_rating: r.app_rating, rated_games: r.rated_games }).eq("id", r.id);
  }

  return json({ game: updated, server_now: Date.now() });
});
