// Role-play conversations between chess moves — shared types.

export type Lvl = "A1" | "A2" | "B1" | "B2";
export const LEVELS: Lvl[] = ["A1", "A2", "B1", "B2"];
export const lvlRank = (l: Lvl) => LEVELS.indexOf(l);

/** Russian + English. Russian may hold {m|f} (the learner's gender) and {{m|f}} (the speaker's). */
export type T = { ru: string; en: string };

export type Cond =
  | "good" | "bad" | "ok" | "tired" | "sick" | "busy"
  | "yes" | "no" | "q" | "askback" | "number" | "dontknow"
  | "like" | "dislike" | "agree" | "disagree" | "thanks" | "short" | "long" | "name"
  | `topic=${string}` | `has=${string}`;

export type Reaction = { when: Cond[] | "else"; say: T };
export type Model = T & { why?: string };

export type Beat = {
  id: string;
  level?: Lvl;
  ai: T;
  easy?: T;
  native?: T;
  models: Model[];
  reactions: Reaction[];
  words: { ru: string; en: string }[];
  tip?: string;
  /** The player should ask something here (role reversal). */
  ask?: boolean;
  topic?: string;
};

export type Character = {
  id: string;
  g: "m" | "f";
  vy: boolean;
  name: T;
  about: string;
  /** Answers to questions the player asks back: hay, day, from, live, job, name, age, hobby, … */
  answers: Record<string, T>;
};

export type Topic = {
  id: string;
  stems: string[];
  react: T[];
  like?: T;
  dislike?: T;
  callback?: T;
  beats: Beat[];
};

export type Scenario = {
  id: string;
  level: Lvl;
  vy: boolean;
  char: string;
  title: T;
  about: string;
  goal: string;
  end: T;
  beats: Beat[];
};

export type Bank = {
  chars: Record<string, Character>;
  topics: Record<string, Topic>;
  scenarios: Scenario[];
  openers: Beat[];
  quick: Beat[];
};
