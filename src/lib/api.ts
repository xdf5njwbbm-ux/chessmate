import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import type { Filters, FullProfile, Card, Game, Inbox, MatchItem, Mini, Question, TimeControl, GameMode } from "./types";

/** Turns Supabase/PostgREST errors into a sentence a person can read. */
export function friendly(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  if (/failed to fetch|network|load failed/i.test(message)) return "You seem to be offline. Check your connection.";
  if (/jwt|not signed in|please sign in/i.test(message)) return "Please sign in again.";
  if (/permission denied|row-level security/i.test(message)) return "You don't have permission to do that.";
  return message;
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

export const api = {
  discover: (filters: Filters, offset = 0, limit = 20) =>
    rpc<Card[]>("discover", { filters, p_limit: limit, p_offset: offset }),
  profile: (id: string) => rpc<FullProfile | null>("get_profile", { p_user: id }),
  sendChallenge: (to: string, tc: TimeControl, mode: GameMode) =>
    rpc<string>("send_challenge", { p_to: to, p_time_control: tc, p_mode: mode }),
  respondChallenge: (id: string, accept: boolean) =>
    rpc<string | null>("respond_challenge", { p_id: id, p_accept: accept }),
  cancelChallenge: (id: string) => rpc<void>("cancel_challenge", { p_id: id }),
  inbox: () => rpc<Inbox>("inbox"),
  gamePlayers: (id: string) => rpc<{ white: Mini | null; black: Mini | null }>("game_players", { p_game: id }),
  like: (game: string, liked: boolean) => rpc<{ liked: boolean; matched: boolean }>("like_game", { p_game: game, p_liked: liked }),
  likeStatus: (game: string) =>
    rpc<{ liked: boolean | null; matched: boolean; available: boolean }>("like_status", { p_game: game }),
  matches: () => rpc<MatchItem[]>("matches_list"),
  unmatch: (user: string) => rpc<void>("unmatch", { p_user: user }),
  rematch: (game: string, action: "offer" | "accept" | "decline" | "cancel") =>
    rpc<{ status: string; game_id?: string }>("rematch", { p_game: game, p_action: action }),
  block: (user: string) => rpc<void>("block_user", { p_user: user }),
  unblock: (user: string) => rpc<void>("unblock_user", { p_user: user }),
  blocked: () => rpc<{ id: string; first_name: string; photo: string | null; created_at: string }[]>("blocked_users"),
  report: (user: string, reason: string, details: string, game: string | null, block: boolean) =>
    rpc<void>("report_user", { p_user: user, p_reason: reason, p_details: details, p_game: game, p_block: block }),
  heartbeat: () => rpc<void>("heartbeat"),
  serverNow: () => rpc<string>("server_now"),
  deleteAccount: () => rpc<void>("delete_account"),

  async questions(): Promise<Question[]> {
    const { data, error } = await supabase.from("questions").select("*").order("sort");
    if (error) throw new Error(friendly(error.message));
    return data as Question[];
  },
  async myAnswers(uid: string): Promise<Record<string, string[]>> {
    const { data, error } = await supabase.from("answers").select("question_id, answer").eq("user_id", uid);
    if (error) throw new Error(friendly(error.message));
    return Object.fromEntries((data ?? []).map((r) => [r.question_id, r.answer as string[]]));
  },
  async saveAnswers(uid: string, answers: Record<string, string[]>) {
    const rows = Object.entries(answers)
      .filter(([, a]) => a.length > 0)
      .map(([question_id, answer]) => ({ user_id: uid, question_id, answer }));
    if (!rows.length) return;
    const { error } = await supabase.from("answers").upsert(rows, { onConflict: "user_id,question_id" });
    if (error) throw new Error(friendly(error.message));
  },
  async game(id: string): Promise<Game | null> {
    const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(friendly(error.message));
    return data as Game | null;
  },
};

export class GameActionError extends Error {
  code?: string;
  game?: Game;
  serverNow?: number;
  constructor(message: string, code?: string, game?: Game, serverNow?: number) {
    super(message);
    this.code = code;
    this.game = game;
    this.serverNow = serverNow;
  }
}

/** Calls the authoritative `game` edge function. */
export async function gameAction(
  gameId: string,
  action: "move" | "resign" | "abort" | "offer_draw" | "accept_draw" | "decline_draw" | "flag",
  uci?: string,
): Promise<{ game: Game; server_now: number }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new GameActionError("Please sign in again.");
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/game`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ game_id: gameId, action, uci }),
    });
  } catch {
    throw new GameActionError("Connection lost. Check your internet and try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GameActionError(body.error ?? "Something went wrong.", body.code, body.game, body.server_now);
  return body;
}
