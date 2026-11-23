import type { Level, Pool } from "./types";

export type TimeControl = { id: string; label: string; pool: Pool; initial: number; inc: number; perMove?: boolean };
export const TIME_CONTROLS: TimeControl[] = [
  { id: "bullet1", label: "1 min", pool: "bullet", initial: 60, inc: 0 },
  { id: "bullet2_1", label: "2 | 1", pool: "bullet", initial: 120, inc: 1 },
  { id: "blitz3", label: "3 min", pool: "blitz", initial: 180, inc: 0 },
  { id: "blitz3_2", label: "3 | 2", pool: "blitz", initial: 180, inc: 2 },
  { id: "blitz5", label: "5 min", pool: "blitz", initial: 300, inc: 0 },
  { id: "rapid10", label: "10 min", pool: "rapid", initial: 600, inc: 0 },
  { id: "rapid15_10", label: "15 | 10", pool: "rapid", initial: 900, inc: 10 },
  { id: "rapid30", label: "30 min", pool: "rapid", initial: 1800, inc: 0 },
  { id: "daily", label: "1 day / move", pool: "daily", initial: 86400, inc: 0, perMove: true },
];
export const tcLabel = (id: string) => (id === "untimed" ? "No clock" : TIME_CONTROLS.find((t) => t.id === id)?.label ?? id);

export const POOLS: { id: Pool; label: string; hint: string }[] = [
  { id: "bullet", label: "Bullet", hint: "Under 3 minutes" },
  { id: "blitz", label: "Blitz", hint: "3–5 minutes" },
  { id: "rapid", label: "Rapid", hint: "10–30 minutes · best for learning" },
  { id: "daily", label: "Daily", hint: "One day per move" },
];
export const poolLabel = (p: string) => POOLS.find((x) => x.id === p)?.label ?? (p === "untimed" ? "Practice" : p);

/** Rating brackets used across the app (purely descriptive). */
export const BRACKETS: { min: number; max: number; label: string }[] = [
  { min: 100, max: 499, label: "100–499" },
  { min: 500, max: 799, label: "500–799" },
  { min: 800, max: 999, label: "800–999" },
  { min: 1000, max: 1199, label: "1000–1199" },
  { min: 1200, max: 1399, label: "1200–1399" },
  { min: 1400, max: 1599, label: "1400–1599" },
  { min: 1600, max: 1799, label: "1600–1799" },
  { min: 1800, max: 1999, label: "1800–1999" },
  { min: 2000, max: 2199, label: "2000–2199" },
  { min: 2200, max: 2399, label: "2200–2399" },
  { min: 2400, max: 99999, label: "2400–2500+" },
];
export function bracket(rating: number | null | undefined): string {
  if (rating == null) return "Unrated";
  return BRACKETS.find((b) => rating >= b.min && rating <= b.max)?.label ?? "Unrated";
}

export const LEVELS: { code: Level; name: string; ru: string; can: string }[] = [
  { code: "A1", name: "Beginner", ru: "Начальный", can: "I'm starting from zero, or I know a few words." },
  { code: "A2", name: "Elementary", ru: "Элементарный", can: "I can handle simple everyday conversations." },
  { code: "B1", name: "Intermediate", ru: "Средний", can: "I can talk about my life, opinions and plans." },
  { code: "B2", name: "Upper-intermediate", ru: "Выше среднего", can: "I follow natural speech and discuss complex topics." },
];
export const levelName = (l: string) => LEVELS.find((x) => x.code === l)?.name ?? l;

export const TERMINATION: Record<string, string> = {
  checkmate: "by checkmate",
  resign: "by resignation",
  timeout: "on time",
  stalemate: "by stalemate",
  insufficient: "insufficient material",
  threefold: "threefold repetition",
  fifty_move: "50-move rule",
  agreement: "by agreement",
  abort: "aborted",
  timeout_vs_insufficient: "timeout vs. insufficient material",
};

export const REPORT_REASONS = [
  { v: "cheating", l: "Cheating (engine use)" },
  { v: "harassment", l: "Harassment or hateful chat" },
  { v: "inappropriate", l: "Inappropriate username or messages" },
  { v: "spam", l: "Spam" },
  { v: "other", l: "Something else" },
];

export const EXPERIENCE = [
  { v: "new", l: "New to chess", hint: "I'm still learning how the pieces move" },
  { v: "casual", l: "Casual player", hint: "I play now and then" },
  { v: "club", l: "Club player", hint: "I play regularly and know some openings" },
  { v: "advanced", l: "Advanced", hint: "I play rated events and study seriously" },
] as const;

/** Suggested Stockfish strength by experience (the player can change it). */
export const SUGGESTED_BOT_ELO: Record<string, number> = { new: 500, casual: 900, club: 1400, advanced: 1900 };

export const INTENSITY = [
  { v: "quick", l: "Quick", hint: "One phrase per move" },
  { v: "standard", l: "Standard", hint: "Phrase, translation and vocabulary" },
  { v: "deep", l: "Deep", hint: "Grammar, word breakdown and a mini exercise" },
] as const;
