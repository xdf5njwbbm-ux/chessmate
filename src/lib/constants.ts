import type { Experience, Gender, Intentions, TimeControl } from "./types";

export const GENDERS: { v: Gender; l: string; plural: string }[] = [
  { v: "woman", l: "Woman", plural: "Women" },
  { v: "man", l: "Man", plural: "Men" },
  { v: "nonbinary", l: "Non-binary", plural: "Non-binary people" },
];

export const INTENTIONS: { v: Intentions; l: string; short: string; emoji: string }[] = [
  { v: "serious", l: "A serious relationship", short: "Serious", emoji: "💍" },
  { v: "casual", l: "Something casual", short: "Casual", emoji: "✨" },
  { v: "friendship", l: "Friendship", short: "Friends", emoji: "🤝" },
  { v: "unsure", l: "Still figuring it out", short: "Open", emoji: "🌙" },
];

export const EXPERIENCE: { v: Experience; l: string; hint: string }[] = [
  { v: "beginner", l: "Beginner", hint: "I know how the pieces move" },
  { v: "intermediate", l: "Intermediate", hint: "I play regularly online" },
  { v: "advanced", l: "Advanced", hint: "I study openings and tactics" },
  { v: "competitive", l: "Competitive", hint: "I play rated events and tournaments" },
];

export const TIME_CONTROLS: { v: TimeControl; l: string; short: string; group: string }[] = [
  { v: "blitz3", l: "3 min blitz", short: "3 min", group: "Blitz" },
  { v: "blitz5", l: "5 min blitz", short: "5 min", group: "Blitz" },
  { v: "rapid10", l: "10 min rapid", short: "10 min", group: "Rapid" },
  { v: "rapid15", l: "15 min rapid", short: "15 min", group: "Rapid" },
  { v: "correspondence", l: "Correspondence", short: "3 days/move", group: "Daily" },
];

export const INTERESTS = [
  "Travel", "Music", "Movies", "Fitness", "Cooking", "Reading", "Gaming", "Hiking",
  "Art", "Coffee", "Photography", "Tech", "Fashion", "Dogs", "Cats", "Sports",
  "Dancing", "Wine", "Podcasts", "Puzzles", "Anime", "Yoga", "Live music", "Foodie",
  "Writing", "Board games", "Nature", "Science",
];

export const PLAY_STYLES: Record<string, string> = {
  aggressive: "Aggressive",
  defensive: "Defensive",
  positional: "Positional",
  strategic: "Strategic",
};

export const REPORT_REASONS: { v: string; l: string }[] = [
  { v: "fake", l: "Fake profile or scam" },
  { v: "inappropriate", l: "Inappropriate photos or bio" },
  { v: "harassment", l: "Harassment or hateful behavior" },
  { v: "underage", l: "May be under 18" },
  { v: "spam", l: "Spam or advertising" },
  { v: "cheating", l: "Cheating at chess" },
  { v: "other", l: "Something else" },
];

export const TERMINATION: Record<string, string> = {
  checkmate: "by checkmate",
  resign: "by resignation",
  timeout: "on time",
  stalemate: "by stalemate",
  insufficient: "by insufficient material",
  threefold: "by threefold repetition",
  fifty_move: "by the 50-move rule",
  agreement: "by agreement",
  abort: "Game aborted",
  timeout_vs_insufficient: "timeout vs. insufficient material",
};

export const label = <T extends { v: string; l: string }>(list: T[], v: string | null | undefined) =>
  list.find((x) => x.v === v)?.l ?? "";
