export type Gender = "woman" | "man" | "nonbinary";
export type Intentions = "serious" | "casual" | "friendship" | "unsure";
export type Experience = "beginner" | "intermediate" | "advanced" | "competitive";
export type TimeControl = "blitz3" | "blitz5" | "rapid10" | "rapid15" | "correspondence";
export type GameMode = "casual" | "competitive";

export type Profile = {
  id: string;
  first_name: string;
  birthdate: string;
  gender: Gender;
  interested_in: Gender[];
  city: string | null;
  lat: number | null;
  lng: number | null;
  max_distance_km: number;
  age_min: number;
  age_max: number;
  bio: string;
  intentions: Intentions | null;
  elo: number | null;
  experience: Experience | null;
  formats: TimeControl[];
  interests: string[];
  photos: string[];
  discoverable: boolean;
  show_online: boolean;
  show_distance: boolean;
  onboarding_complete: boolean;
  app_rating: number;
  rated_games: number;
  last_seen: string;
  created_at: string;
  updated_at: string;
};

export type Question = {
  id: string;
  section: "chess" | "fun" | "dating";
  prompt: string;
  kind: "single" | "multi";
  options: { v: string; l: string }[];
  ordinal: boolean;
  dimension: string;
  weight: number;
  max_select: number;
  sort: number;
};

export type Card = {
  id: string;
  first_name: string;
  age: number;
  city: string | null;
  distance_km: number | null;
  photos: string[];
  bio: string;
  intentions: Intentions | null;
  elo: number | null;
  experience: Experience | null;
  formats: TimeControl[];
  interests: string[];
  rating: number;
  rated_games: number;
  online: boolean;
  play_style: string | null;
  opening: string | null;
  compat: number | null;
  shared_interests: string[];
};

export type Relationship = {
  matched: boolean;
  incoming_challenge: string | null;
  outgoing_challenge: string | null;
  active_game: string | null;
  games_played: number;
  my_like: boolean | null;
};

export type FullProfile = Card & {
  answers: Record<string, string[]>;
  shared_answers: string[];
  stats: { games: number; wins: number; losses: number; draws: number };
  relationship: Relationship | null;
  is_me: boolean;
};

export type Mini = {
  id: string;
  first_name: string;
  age: number;
  photo: string | null;
  elo: number | null;
  rating: number;
  experience: Experience | null;
  online: boolean;
};

export type Game = {
  id: string;
  white_id: string | null;
  black_id: string | null;
  time_control: TimeControl;
  mode: GameMode;
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
  rematch_of: string | null;
  next_game_id: string | null;
  white_rating: number | null;
  black_rating: number | null;
  white_delta: number | null;
  black_delta: number | null;
  version: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export type GameSummary = {
  id: string;
  time_control: TimeControl;
  mode: GameMode;
  status: Game["status"];
  result: Game["result"];
  termination: string | null;
  my_color: "white" | "black";
  turn: "w" | "b";
  white_ms: number;
  black_ms: number;
  turn_started_at: string;
  ply: number;
  updated_at: string;
  finished_at: string | null;
  my_delta: number | null;
  opponent: Mini | null;
};

export type ChallengeItem = {
  id: string;
  time_control: TimeControl;
  mode: GameMode;
  created_at: string;
  user: Mini | null;
  compat?: number | null;
};

export type Inbox = {
  incoming: ChallengeItem[];
  outgoing: ChallengeItem[];
  active: GameSummary[];
  recent: GameSummary[];
};

export type MatchItem = {
  user: Mini | null;
  created_at: string;
  game_id: string | null;
  compat: number | null;
};

export type Filters = {
  max_distance_km?: number;
  age_min?: number;
  age_max?: number;
  elo_min?: number | null;
  elo_max?: number | null;
  experience?: Experience[];
  intentions?: Intentions[];
  min_compat?: number;
  sort?: "compat" | "elo" | "active";
};
