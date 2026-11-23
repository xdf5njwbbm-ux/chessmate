import { supabase, SUPABASE_KEY, SUPABASE_URL } from "./supabase";
import type {
  Assessment, ChallengeItem, ChessStats, Curriculum, Dashboard, Entitlements, Game, GameMessage, GameSummary, Inbox,
  LeaderRow, Lesson, Mini, Plan, PronunciationOverview, PublicProfile, ReviewItem, SavedPhrase, Scenario, ScriptStep,
  Test, TestResult, TutorReply, VocabWord, Pool, Level,
} from "./types";

/** Turns Supabase/PostgREST errors into a sentence a person can read. */
export function friendly(message: string | undefined | null): string {
  if (!message) return "Something went wrong. Please try again.";
  if (/failed to fetch|network|load failed/i.test(message)) return "You seem to be offline. Check your connection.";
  if (/jwt|not signed in|please sign in/i.test(message)) return "Please sign in again.";
  if (/permission denied|row-level security/i.test(message)) return "You don't have permission to do that.";
  return message;
}

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ApiError(friendly(error.message), error.code);
  return data as T;
}

/** True when the error means "this needs Premium". */
export const isPremiumError = (e: unknown) => (e as ApiError)?.code === "42501";

export const api = {
  heartbeat: () => rpc<void>("heartbeat"),
  serverNow: () => rpc<string>("server_now"),
  usernameAvailable: (u: string) => rpc<boolean>("username_available", { p_username: u }),
  setLevel: (l: Level) => rpc<void>("set_ru_level", { p_level: l }),
  myPlan: () => rpc<{ entitlements: Entitlements; subscription: unknown; plans: Plan[] }>("my_plan"),
  dashboard: () => rpc<Dashboard>("dashboard"),

  curriculum: () => rpc<Curriculum>("curriculum"),
  lesson: (id: string) => rpc<Lesson>("get_lesson", { p_id: id }),
  completeLesson: (id: string, score: number) =>
    rpc<{ completed: boolean; first_completion: boolean; best_score: number; words_added: number; new_achievements: string[] }>("complete_lesson", { p_id: id, p_score: score }),
  test: (id: string) => rpc<Test>("get_test", { p_id: id }),
  submitTest: (id: string, answers: Record<string, number>) => rpc<TestResult>("submit_test", { p_id: id, p_answers: answers }),

  reviewQueue: (limit = 20) => rpc<{ due_total: number; items: ReviewItem[]; distractors: { ru: string; en: string; pos: string }[] }>("review_queue", { p_limit: limit }),
  recordReview: (kind: string, item: string, grade: number) => rpc<{ interval_days: number; new_achievements: string[] }>("record_review", { p_kind: kind, p_item: item, p_grade: grade }),
  addWords: (ids: string[]) => rpc<number>("add_words", { p_ids: ids }),
  savePhrase: (ru: string, en: string, source: string) => rpc<number>("save_phrase", { p_ru: ru, p_en: en, p_source: source }),
  deletePhrase: (id: number) => rpc<void>("delete_phrase", { p_id: id }),
  vocabulary: () => rpc<{ words: VocabWord[]; phrases: SavedPhrase[] }>("my_vocabulary"),
  focusWords: () => rpc<{ id: string; ru: string; stressed: string; en: string; tags: string[]; lapses: number; due: boolean }[]>("focus_words"),
  recordPractice: (kind: "listening" | "speaking" | "phrase", correct: boolean, ref?: string) =>
    rpc<{ new_achievements: string[] }>("record_practice", { p_kind: kind, p_correct: correct, p_ref: ref ?? null }),
  recordSpeech: (text: string, ref: string | null, recognized: string, words: unknown, passed: boolean, durationMs: number) =>
    rpc<{ new_achievements: string[] }>("record_speech_attempt", { p_text: text, p_ref: ref, p_recognized: recognized, p_words: words, p_passed: passed, p_duration_ms: durationMs }),
  pronunciation: () => rpc<PronunciationOverview>("pronunciation_overview"),

  scenarios: () => rpc<Scenario[]>("scenarios"),
  scenario: (id: string) => rpc<Scenario & { script: ScriptStep[] }>("get_scenario", { p_id: id }),
  startConversation: (scenario: string | null, level: Level, mode: "ai" | "guided") =>
    rpc<string>("start_conversation", { p_scenario: scenario, p_level: level, p_mode: mode }),
  logTurn: (conv: string, role: "tutor" | "user", ru: string, en: string, correction: unknown) =>
    rpc<void>("log_conversation_turn", { p_conversation: conv, p_role: role, p_ru: ru, p_en: en, p_correction: correction }),
  conversations: () => rpc<{ id: string; scenario_id: string | null; title: string | null; level: Level; mode: string; turns: number; updated_at: string }[]>("conversations"),

  findMatch: (tc: string, rated: boolean, russianChat: boolean) =>
    rpc<{ status: "waiting" | "matched" | "in_game"; game_id?: string; waited_s?: number; window?: number; rating?: number; searching?: number }>("find_match", { p_time_control: tc, p_rated: rated, p_russian_chat: russianChat }),
  cancelSeek: () => rpc<{ game_id: string | null }>("cancel_seek"),
  searchPlayers: (q: string) => rpc<Mini[]>("search_players", { p_query: q }),
  sendChallenge: (username: string, tc: string, rated: boolean, russianChat: boolean, color: string) =>
    rpc<string>("send_challenge", { p_username: username, p_time_control: tc, p_rated: rated, p_russian_chat: russianChat, p_color: color }),
  createInvite: (tc: string, rated: boolean, russianChat: boolean, color: string) =>
    rpc<string>("create_invite", { p_time_control: tc, p_rated: rated, p_russian_chat: russianChat, p_color: color }),
  inviteInfo: (code: string) =>
    rpc<(ChallengeItem & { status: string; game_id: string | null; mine: boolean; from: Mini }) | null>("invite_info", { p_code: code }),
  acceptInvite: (code: string) => rpc<string>("accept_invite", { p_code: code }),
  respondChallenge: (id: string, accept: boolean) => rpc<string | null>("respond_challenge", { p_id: id, p_accept: accept }),
  cancelChallenge: (id: string) => rpc<void>("cancel_challenge", { p_id: id }),
  inbox: () => rpc<Inbox>("inbox"),
  gamePlayers: (id: string) => rpc<{ white: Mini | null; black: Mini | null }>("game_players", { p_game: id }),
  rematch: (id: string, action: "offer" | "accept" | "decline" | "cancel") => rpc<{ status: string; game_id?: string }>("rematch", { p_game: id, p_action: action }),
  sendMessage: (game: string, body: string) => rpc<number>("send_game_message", { p_game: game, p_body: body }),
  myGames: (filter: string, limit = 30, offset = 0) => rpc<{ total: number; games: GameSummary[] }>("my_games", { p_filter: filter, p_limit: limit, p_offset: offset }),
  chessStats: () => rpc<ChessStats>("chess_stats"),
  leaderboard: (pool: Pool) => rpc<{ pool: Pool; rows: LeaderRow[]; players: number; me: { rating: number | null; status: string; placement_left: number; rank: number | null } | null }>("leaderboard", { p_pool: pool, p_limit: 100 }),
  publicProfile: (username: string) => rpc<PublicProfile | null>("public_profile", { p_username: username }),

  block: (user: string) => rpc<void>("block_user", { p_user: user }),
  unblock: (user: string) => rpc<void>("unblock_user", { p_user: user }),
  blocked: () => rpc<{ id: string; username: string | null; display_name: string; created_at: string }[]>("blocked_users"),
  report: (user: string, reason: string, details: string, game: string | null, block: boolean) =>
    rpc<void>("report_user", { p_user: user, p_reason: reason, p_details: details, p_game: game, p_block: block }),
  deleteAccount: () => rpc<void>("delete_account"),

  async game(id: string): Promise<Game | null> {
    const { data, error } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
    if (error) throw new ApiError(friendly(error.message));
    return data as Game | null;
  },
  async messages(game: string): Promise<GameMessage[]> {
    const { data, error } = await supabase.from("game_messages").select("*").eq("game_id", game).order("id").limit(200);
    if (error) throw new ApiError(friendly(error.message));
    return data as GameMessage[];
  },
  async conversationMessages(conv: string) {
    const { data, error } = await supabase.from("tutor_messages").select("*").eq("conversation_id", conv).order("id");
    if (error) throw new ApiError(friendly(error.message));
    return data as { id: number; role: "tutor" | "user"; ru: string; en: string; correction: TutorReply["correction"] }[];
  },
};

/** Calls one of the edge functions with the user's session. */
export async function callFunction<T>(name: "game" | "speech" | "tutor", body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Please sign in again.");
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Connection lost. Check your internet and try again.");
  }
  if ((res.headers.get("content-type") ?? "").includes("audio")) return (await res.blob()) as T;
  const out = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(out.error ?? "Something went wrong.", out.code) as ApiError & { game?: Game; serverNow?: number };
    err.game = out.game;
    err.serverNow = out.server_now;
    throw err;
  }
  return out as T;
}

export type GameActionError = ApiError & { game?: Game; serverNow?: number };
export const gameAction = (gameId: string, action: string, uci?: string) =>
  callFunction<{ game: Game; server_now: number }>("game", { game_id: gameId, action, uci });
export const recordAiGame = (body: { client_ref: string; moves: string[]; color: "w" | "b"; ai_elo: number; claim: "over" | "resign"; undo_count: number }) =>
  callFunction<{ game: Game }>("game", { action: "record_ai", ...body });
export const assessPronunciation = (text: string, ref: string | null, audioBase64: string) =>
  callFunction<{ result: Assessment | null; message?: string }>("speech", { action: "assess", text, ref, audio: audioBase64 });
export const tutorCall = (body: { action: "open" | "reply"; conversation_id: string; message?: string; pronunciation_note?: string }) =>
  callFunction<{ reply: TutorReply }>("tutor", body);
