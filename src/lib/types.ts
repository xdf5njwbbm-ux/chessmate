export type Level = "A1" | "A2" | "B1" | "B2";
export type Forms = "m" | "f";
export type Intensity = "quick" | "standard" | "deep";
export type Pool = "bullet" | "blitz" | "rapid" | "daily" | "blindfold";
export type RatingStatus = "unrated" | "provisional" | "established";
export type Voice = "female" | "male" | "female2";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  /** false = a chess-only account: no Russian anywhere. Missing (older rows) counts as true. */
  learn_russian?: boolean;
  ru_level: Level;
  ru_forms: Forms;
  learning_intensity: Intensity;
  show_translit: boolean;
  speech_rate: number;
  voice: Voice;
  chess_experience: "new" | "casual" | "club" | "advanced";
  russian_chat: boolean;
  daily_goal_words: number;
  timezone: string;
  show_online: boolean;
  streak_current: number;
  streak_best: number;
  last_active_day: string | null;
  created_at: string;
};

export type Entitlements = {
  plan: "free" | "premium";
  early_access: boolean;
  levels: Level[];
  daily_reviews: number | null;
  saved_phrases: number | null;
  deep_learning: boolean;
  full_analysis: boolean;
  ai_tutor: boolean;
  neural_voices: boolean;
  pronunciation_scoring: boolean;
  advanced_stats: boolean;
  personal_plan: boolean;
};

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  features: Partial<Entitlements>;
  price_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
};

export type Mini = {
  id: string;
  username: string;
  display_name: string;
  ru_level: Level;
  online: boolean;
  rating: number | null;
  rating_status: RatingStatus;
  placement_left: number;
};

export type RatingRow = {
  pool: Pool;
  rating: number | null;
  status: RatingStatus;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  peak: number | null;
  placement_left: number;
};

export type GameSummary = {
  id: string;
  time_control: string;
  pool: Pool | "untimed";
  blindfold?: boolean;
  rated: boolean;
  opponent_kind: "human" | "ai";
  ai_elo: number | null;
  status: "active" | "finished" | "aborted";
  result: "1-0" | "0-1" | "1/2-1/2" | null;
  termination: string | null;
  my_color: "white" | "black";
  turn: "w" | "b";
  ply: number;
  white_ms: number;
  black_ms: number;
  turn_started_at: string;
  updated_at: string;
  finished_at: string | null;
  created_at: string;
  my_delta: number | null;
  my_rating: number | null;
  my_status: RatingStatus | null;
  opponent_rating: number | null;
  opponent: Mini | null;
};

export type Game = {
  id: string;
  white_id: string | null;
  black_id: string | null;
  opponent_kind: "human" | "ai";
  ai_elo: number | null;
  time_control: string;
  pool: Pool | "untimed";
  blindfold: boolean;
  rated: boolean;
  russian_chat: boolean;
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
  rematch_offer_from: string | null;
  next_game_id: string | null;
  white_rating: number | null;
  black_rating: number | null;
  white_delta: number | null;
  black_delta: number | null;
  white_status: RatingStatus | null;
  black_status: RatingStatus | null;
  undo_count: number;
  version: number;
  created_at: string;
  finished_at: string | null;
};

export type ChallengeItem = {
  id: string;
  time_control: string;
  rated: boolean;
  blindfold?: boolean;
  russian_chat: boolean;
  color: "random" | "white" | "black";
  created_at: string;
  invite_code?: string | null;
  user: Mini | null;
};

export type Inbox = { incoming: ChallengeItem[]; outgoing: ChallengeItem[]; active: GameSummary[] };

export type GameMessage = { id: number; game_id: string; user_id: string | null; body: string; created_at: string };

export type Word = { ru: string; f?: string; en: string };
/** Something else you could ask after an answer; `link` is the exchange where it's asked and answered. */
export type FollowUp = { ru: string; ruF?: string; en: string; link?: string; linkTopic?: string; linkLevel?: string };
export type Line = {
  ru: string; ruF?: string; en: string; words: Word[]; note?: string; speaker?: string; tag?: "formal" | "informal" | "spoken";
  /** Conversation lessons: question or answer, the exchange id ("a1-15:3") and follow-up questions (on answers). */
  role?: "q" | "a"; x?: string; follow?: FollowUp[];
};
export type LessonSection =
  | { type: "lines"; kind: "dialogue" | "phrases" | "conversation"; title: string; lines: Line[] }
  | { type: "grammar"; title: string; paragraphs: string[]; examples: { ru: string; en: string }[] };
/** `why`: a note for each wrong option, shown when the learner picks it. */
export type Drill = { q: string; answer: string; options: string[]; en: string; why?: Record<string, string> };
export type VocabEntry = { id: string; ru: string; stressed: string; en: string; pos: string; note: string };

export type LessonMeta = {
  id: string;
  title: string;
  title_ru: string;
  summary: string;
  category_id: string;
  sort: number;
  line_count: number;
  vocab_count: number;
  completed: boolean;
  best_score: number | null;
  attempts: number;
};

export type Lesson = {
  id: string;
  level: Level;
  category_id: string;
  title: string;
  title_ru: string;
  summary: string;
  content: { intro: string; sections: LessonSection[]; drills: Drill[] };
  vocab: VocabEntry[];
  progress: { attempts: number; best_score: number; completed_at: string | null } | null;
  next_id: string | null;
};

export type Category = { id: string; name: string; grp: "everyday" | "chess" | "grammar" | "pronunciation"; sort: number };

export type Curriculum = {
  current_level: Level;
  entitlements: Entitlements;
  categories: Category[];
  levels: {
    code: Level;
    name: string;
    description: string;
    locked: boolean;
    lessons: LessonMeta[];
    test: { id: string; title: string; summary: string; pass_pct: number; passed: boolean; best_pct: number | null } | null;
  }[];
};

export type TestItem = { id: string; level: Level; kind: "reading" | "listening" | "grammar" | "vocab"; prompt: string; ru: string | null; options: string[] };
export type Test = { id: string; level: Level | null; title: string; summary: string; pass_pct: number; items: TestItem[] };
export type TestResult = {
  score: number;
  total: number;
  passed?: boolean;
  pass_pct?: number;
  recommended?: Level;
  per_level?: Record<string, number>;
  level_before?: Level;
  level_after?: Level;
  results: { id: string; answer: number; chosen: number | null; correct: boolean }[];
  new_achievements?: string[];
};

export type ReviewItem = {
  kind: "word" | "phrase";
  item_id: string;
  ru: string;
  stressed: string;
  en: string;
  pos: string;
  note: string;
  reps: number;
  lapses: number;
};

export type VocabWord = VocabEntry & {
  level: Level;
  lesson_id: string | null;
  lesson_title: string | null;
  tags: string[];
  reps: number;
  lapses: number;
  correct: number;
  incorrect: number;
  interval_days: number;
  due_at: string;
  added_at: string;
};
export type SavedPhrase = { id: number; ru: string; en: string; source: string; created_at: string; reps: number | null; lapses: number | null; interval_days: number | null; due_at: string | null };

export type Achievement = { id: string; name: string; description: string; tier: "bronze" | "silver" | "gold"; category?: string; earned_at?: string };

export type Dashboard = {
  profile: { display_name: string; username: string; ru_level: Level };
  entitlements: Entitlements;
  russian: {
    level: Level;
    level_lessons_total: number;
    level_lessons_done: number;
    level_test_passed: boolean;
    level_progress: number;
    overall_progress: number;
    lessons_completed: number;
    lessons_total: number;
    words: number;
    mastered: number;
    phrases: number;
    due_reviews: number;
    streak: number;
    streak_best: number;
    active_today: boolean;
    listening: { correct: number; total: number };
    speaking: { attempts: number; passed: number; avg_score: number | null };
    next_lesson: { id: string; title: string; title_ru: string; level: Level; category_id: string; summary: string } | null;
    certified: Level[];
  };
  chess: {
    ratings: RatingRow[];
    totals: { games: number; wins: number; losses: number; draws: number; vs_ai: number };
    recent: GameSummary[];
    active: number;
  };
  objectives: { lesson: number; game: number; words: number; words_goal: number; sentences: number };
  achievements: Achievement[];
  achievement_count: number;
};

export type Scenario = {
  id: string;
  level: Level;
  category_id: string;
  title: string;
  title_ru: string;
  description: string;
  tutor_role: string;
  steps: number;
  locked: boolean;
};
export type ScriptStep = { who: "tutor"; ru: string; en: string } | { who: "user"; hint: string; answers: string[] };
export type TutorReply = {
  reply_ru: string;
  reply_en: string;
  correction: { corrected: string; explanation: string; natural: string } | null;
  new_words: { ru: string; en: string }[];
};

export type Milestone = {
  id: string;
  level: Level;
  title: string;
  summary: string;
  focus: string[];
  pass_count: number;
  item_count: number;
  items: { ru: string; en: string; tip: string }[];
  passed_items: number[];
  locked: boolean;
};
export type PronunciationOverview = {
  milestones: Milestone[];
  stats: { attempts: number; words_practiced: number; sentences_spoken: number; passed: number; speaking_seconds: number; avg_score: number | null; avg_score_7d: number | null; scored: number };
  trend: { day: string; attempts: number; passed: number; avg_score: number | null }[];
  difficult_words: { text: string; fails: number; tries: number }[];
  difficult_sounds: { sound: string; fails: number }[];
  listening: { correct: number; total: number };
};

export type Assessment = {
  recognized: string;
  pron: number | null;
  accuracy: number | null;
  fluency: number | null;
  completeness: number | null;
  prosody: number | null;
  words: { word: string; accuracy: number | null; error: string; syllables: { s: string; accuracy: number | null }[]; phonemes: { p: string; accuracy: number | null }[] }[];
};

export type ChessStats = {
  advanced: boolean;
  pools: (RatingRow & { history: { t: string; r: number; status: RatingStatus; opp: number; s: number; game_id: string | null }[] })[];
  totals: {
    games: number; wins: number; losses: number; draws: number; rated: number; vs_ai: number; vs_ai_wins: number;
    as_white: number; as_white_wins: number; as_black: number; as_black_wins: number;
  };
  terminations: Record<string, number> | null;
  by_opponent: { band: number; games: number; score: number }[] | null;
};

export type LeaderRow = { rank: number; id: string; username: string; display_name: string; ru_level: Level; rating: number; peak: number | null; games: number; status: RatingStatus; online: boolean; me: boolean };

export type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  ru_level: Level;
  joined: string;
  is_me: boolean;
  online: boolean;
  certified: Level[];
  ratings: RatingRow[];
  stats: { games: number; wins: number; losses: number; draws: number };
  achievements: Achievement[];
  lessons_completed: number;
  active_game: string | null;
};

export type BlindfoldRecord = {
  client_ref: string;
  game_id?: string | null;
  level: "beginner" | "intermediate" | "advanced" | "expert" | "master";
  color?: "white" | "black";
  result?: "win" | "loss" | "draw";
  ai_elo?: number;
  my_moves: number;
  accuracy?: number | null;
  avg_response_ms?: number | null;
  mistakes?: number;
  blunders?: number;
  reveals: number;
  reveal_ms: number;
  longest_blind_streak: number;
};

export type BlindfoldStats = {
  rating: { rating: number | null; status: string; games: number; wins: number; losses: number; draws: number; peak: number | null; placement_left: number } | null;
  totals: {
    games: number; wins: number; losses: number; draws: number; accuracy: number | null; avg_response_ms: number | null;
    mistakes: number; blunders: number; reveals: number; no_reveal_games: number; longest_no_reveal_game: number; longest_blind_streak: number;
  };
  by_level: { level: string; games: number; wins: number; accuracy: number | null }[];
  recent: { id: number; game_id: string | null; opponent_kind: "human" | "ai"; ai_elo: number | null; level: string; color: string; result: "win" | "loss" | "draw"; moves: number; accuracy: number | null; avg_response_ms: number | null; mistakes: number; reveals: number; created_at: string }[];
};
