// The conversation itself: who speaks next and what they say, how the partner
// reacts to what you actually said (mood, yes/no, topics, questions you ask back),
// corrections and a natural alternative, scoring, memory across games, an adaptive
// level (A1–B2), and the six modes.

import { BANK, LEX } from "./bank.ts";
import { form } from "./parse.ts";
import { check, realFixes, type Fix } from "./correct.ts";
import { low, sim, tokens, understand, type Meaning } from "./understand.ts";
import type { Beat, Character, Cond, Lvl, T } from "./types.ts";
import { LEVELS, lvlRank } from "./types.ts";

export type Mode = "normal" | "roleplay" | "quick" | "challenge" | "native" | "beginner";
export const MODES: { v: Mode; label: string; ru: string; about: string }[] = [
  { v: "normal", label: "Conversation", ru: "Разговор", about: "Talk naturally while you play. Mention something and they'll ask more about it." },
  { v: "roleplay", label: "Role-play", ru: "Ролевая игра", about: "Practise a real situation: a first date, a restaurant, a furniture store, your job…" },
  { v: "quick", label: "Quick answers", ru: "Быстрые ответы", about: "Short, spontaneous questions. Answer fast — speed counts." },
  { v: "challenge", label: "Challenge", ru: "Вызов", about: "Keep the conversation going for 10 exchanges — no English, no hints." },
  { v: "native", label: "Native speaker", ru: "Как носитель", about: "Natural speed, slang and everyday expressions. English only when you tap." },
  { v: "beginner", label: "Beginner", ru: "Для начинающих", about: "Slow Russian, simple words, English always shown, answers you can tap." },
];

export type Line = { ru: string; en: string; kind: "ask" | "say" | "remark" | "end" | "note"; words?: { ru: string; en: string }[]; tip?: string };

export type Stats = {
  exchanges: number; understood: number; scoreSum: number; grammar: number; spelling: number; english: number;
  askedBack: number; questions: number; challengeBest: number; challengesDone: number; quickRounds: number;
  scenarios: Record<string, number>; days: Record<string, number>; mistakes: Record<string, number>;
};
export type Memory = {
  v: 1;
  name?: string;
  level?: Lvl;
  topics: Record<string, number>;
  seen: Record<string, number>;
  asked: string[];
  recent: number[];
  stats: Stats;
};
export const newMemory = (): Memory => ({
  v: 1, topics: {}, seen: {}, asked: [], recent: [],
  stats: { exchanges: 0, understood: 0, scoreSum: 0, grammar: 0, spelling: 0, english: 0, askedBack: 0, questions: 0, challengeBest: 0, challengesDone: 0, quickRounds: 0, scenarios: {}, days: {}, mistakes: {} },
});

export type State = {
  mode: Mode;
  scenario: string | null;
  partner: string;
  forms: "m" | "f";
  level: Lvl;
  cur: Beat | null;
  curAt: number;
  step: number;
  detour: string[];
  topicRuns: Record<string, number>;
  used: string[];
  exchanges: number;
  sinceCallback: number;
  sinceQuestion: number;
  sinceDetour: number;
  streak: number;
  quick: { n: number; ms: number[]; scores: number[] };
  lastRemark: number;
  moves: number;
  /** Topics from the last few answers (callbacks skip these). */
  recent: string[];
};

export type Turn = {
  said: string;
  translit: boolean;
  english: boolean;
  fixes: Fix[];
  corrected: string;
  natural: { ru: string; en: string; why: string } | null;
  perfect: boolean;
  score: number;
  understood: boolean;
  notes: string[];
  reaction: Line[];
  next: Line[];
  events: ("challenge-done" | "challenge-reset" | "scenario-done" | "level-up" | "level-down" | "quick-round")[];
  ms?: number;
  quickSummary?: { avgMs: number; avgScore: number };
};

type Opts = { rand?: () => number; now?: number; myName?: string | null };

// ---------------------------------------------------------------- lookups

const ALL_BEATS = new Map<string, { beat: Beat; vy: boolean; char?: string }>();
for (const s of BANK.scenarios) for (const b of s.beats) ALL_BEATS.set(b.id, { beat: b, vy: s.vy, char: s.char });
for (const t of Object.values(BANK.topics)) for (const b of t.beats) ALL_BEATS.set(b.id, { beat: b, vy: false });
for (const b of [...BANK.openers, ...BANK.quick]) ALL_BEATS.set(b.id, { beat: b, vy: false });

export const PARTNERS = ["nastya", "dima", "katya"] as const;
export const scenarioById = (id: string | null) => BANK.scenarios.find((s) => s.id === id) ?? null;
export const charOf = (st: State): Character => BANK.chars[scenarioById(st.scenario)?.char ?? st.partner] ?? BANK.chars.nastya;
const isVy = (st: State) => (st.mode === "roleplay" ? scenarioById(st.scenario)?.vy ?? false : false);

function pick<T>(a: T[], r: () => number): T {
  return a[Math.floor(r() * a.length)];
}

/** Renders a line for this learner and partner: {m|f}, {{m|f}}, [name], [me]. */
export function render(t: T, st: State, mem: Memory, myName?: string | null): T {
  const me = mem.name ?? myName ?? "Алекс";
  const g = charOf(st).g;
  const fill = (s: string) =>
    form(s, st.forms, g)
      .replace(/\[([^\]]*?)name([^\]]*)\]/g, (_, a, b) => (mem.name ? `${a}${mem.name}${b}` : ""))
      .replace(/\[me\]/g, me)
      .replace(/\s+([!?.,])/g, "$1");
  return { ru: fill(t.ru), en: t.en.replace(/\[me\]/g, me).replace(/\[([^\]]*?)name([^\]]*)\]/g, (_, a, b) => (mem.name ? `${a}${mem.name}${b}` : "")) };
}

const lineOf = (b: Beat, st: State): T => (st.mode === "beginner" && b.easy) || (st.mode === "native" && b.native) || b.ai;

/** How much help to show: English, answer hints, speech rate. English fades as the level rises. */
export function assist(st: State): { en: "auto" | "tap" | "never"; hints: "open" | "tap" | "none"; rate: number } {
  if (st.mode === "challenge") return { en: "never", hints: "none", rate: st.level === "A1" ? 0.85 : 1 };
  if (st.mode === "beginner") return { en: "auto", hints: "open", rate: 0.7 };
  if (st.mode === "native") return { en: "tap", hints: "tap", rate: 1.05 };
  return { en: st.level === "A1" ? "auto" : "tap", hints: "tap", rate: st.level === "A1" ? 0.8 : st.level === "A2" ? 0.9 : 1 };
}

/** Example answers for the current question, in the learner's forms. */
export function hints(st: State, mem: Memory, myName?: string | null): (T & { why?: string })[] {
  if (!st.cur) return [];
  return st.cur.models.map((m) => ({ ...render(m, st, mem, myName), why: m.why }));
}

// ---------------------------------------------------------------- start

const HELLO_BACK: T[] = [
  { ru: "О, привет снова[, name]! {{Рад|Рада}} тебя видеть. Как дела?", en: "Oh, hi again! Glad to see you. How are you?" },
  { ru: "Привет[, name]! Давно не виделись. Как ты?", en: "Hi! Long time no see. How are you?" },
  { ru: "Привет-привет[, name]! Ну, как жизнь?", en: "Hi there! So, how's life?" },
];

export function newState(o: { mode: Mode; scenario?: string | null; partner?: string; forms: "m" | "f"; level: Lvl }): State {
  const scen = o.mode === "roleplay" ? scenarioById(o.scenario ?? null) ?? BANK.scenarios[0] : null;
  const level = o.mode === "beginner" ? (lvlRank(o.level) > 1 ? "A2" : o.level) : o.level;
  return {
    mode: o.mode, scenario: scen?.id ?? null, partner: scen?.char ?? o.partner ?? "nastya", forms: o.forms, level,
    cur: null, curAt: 0, step: 0, detour: [], topicRuns: {}, used: [], exchanges: 0,
    sinceCallback: 0, sinceQuestion: 0, sinceDetour: 0, streak: 0, quick: { n: 0, ms: [], scores: [] }, lastRemark: -9, moves: 0, recent: [],
  };
}

/** The partner's first words (and the first question). */
export function open(st: State, mem: Memory, o: Opts = {}): { st: State; lines: Line[] } {
  const r = o.rand ?? Math.random;
  const now = o.now ?? Date.now();
  st = { ...st };
  const out: Line[] = [];
  if (st.mode === "roleplay") {
    const sc = scenarioById(st.scenario)!;
    out.push({ ru: sc.title.ru, en: sc.about, kind: "note" });
    const b = sc.beats[0];
    st.step = 1;
    st.cur = b;
  } else if (st.mode === "quick") {
    st.cur = nextQuick(st, mem, r);
  } else {
    const greet = BANK.scenarios.find((s) => s.id === "greet")!.beats[0];
    const back = mem.seen[st.partner] && now - mem.seen[st.partner] > 60_000;
    st.cur = back ? { ...greet, id: "hello", ai: pick(HELLO_BACK, r), native: undefined, easy: undefined } : { ...greet, id: "hello" };
  }
  st.curAt = now;
  mem.seen[st.partner] = now;
  if (st.cur) {
    st.used = [...st.used, st.cur.id];
    out.push(ask(st.cur, st, mem, o.myName));
  }
  return { st, lines: out.filter((l) => l.ru || l.en) };
}

function ask(b: Beat, st: State, mem: Memory, myName?: string | null): Line {
  const t = render(lineOf(b, st), st, mem, myName);
  return { ...t, kind: "ask", words: b.words.length ? b.words : undefined, tip: b.tip };
}

// ---------------------------------------------------------------- choosing the next question

const NUDGE: Beat = {
  id: "nudge", ask: true,
  ai: { ru: "Слушай, а ты меня ни о чём не спрашиваешь! Спроси меня что-нибудь.", en: "Hey, you're not asking me anything! Ask me something." },
  easy: { ru: "Спроси меня что-нибудь! (Ask me something: «А ты как?»)", en: "Ask me something!" },
  models: [
    { ru: "А ты как?", en: "And how are you?" },
    { ru: "А что ты любишь делать?", en: "And what do you like to do?" },
    { ru: "А как прошёл твой день?", en: "And how was your day?" },
  ],
  reactions: [{ when: ["q"], say: { ru: "Вот, другое дело!", en: "There we go!" } }, { when: "else", say: { ru: "Ну ладно, тогда я спрошу.", en: "OK, then I'll ask." } }],
  words: [], tip: "Ask back: «А ты?», «А у тебя?», «А ты что любишь?» — a conversation goes both ways.",
};

const FOLLOW: Record<string, number> = { day: 0.85, hobbies: 0.6, work: 0.5, family: 0.5, weekend: 0.4, travel: 0.4, movies: 0.35, goals: 0.3, feelings: 0.2, meet: 0.35, crush: 0.3, date: 0.3 };

function unused(b: Beat, st: State, mem: Memory) {
  return !st.used.includes(b.id) && !mem.asked.includes(b.id);
}
function byLevel(list: Beat[], level: Lvl, st: State, mem: Memory, r: () => number, maxUp = 0): Beat | null {
  const ok = (b: Beat) => lvlRank(b.level ?? "A2") <= lvlRank(level) + maxUp;
  const fresh = list.filter((b) => ok(b) && unused(b, st, mem));
  if (!fresh.length) return null;
  const exact = fresh.filter((b) => b.level === level);
  const near = fresh.filter((b) => lvlRank(b.level ?? "A2") >= lvlRank(level) - 1);
  return pick(exact.length && r() < 0.7 ? exact : near.length ? near : fresh, r);
}

function topicBeat(topics: string[], st: State, mem: Memory): Beat | null {
  for (const id of topics) {
    if ((st.topicRuns[id] ?? 0) >= 2) continue;
    const tp = BANK.topics[id];
    if (!tp) continue;
    // a topic's questions are written as a sequence: take the next one that fits the level
    const b = tp.beats.find((x) => lvlRank(x.level ?? "A2") <= lvlRank(st.level) + 1 && unused(x, st, mem)) ?? null;
    if (b) return b;
  }
  return null;
}

function callbackBeat(st: State, mem: Memory, r: () => number, exclude: string[]): Beat | null {
  const cands = Object.entries(mem.topics)
    .filter(([id]) => !exclude.includes(id) && BANK.topics[id]?.callback && !st.used.includes(`cb.${id}`))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (!cands.length) return null;
  const [id] = pick(cands, r);
  const tp = BANK.topics[id];
  const first = tp.beats[0];
  return { id: `cb.${id}`, ai: tp.callback!, models: first?.models ?? [], reactions: first?.reactions.filter((x) => x.when !== "else") ?? [], words: [], topic: id };
}

function nextQuick(st: State, mem: Memory, r: () => number): Beat | null {
  const b = byLevel(BANK.quick, st.level, st, mem, r) ?? byLevel(BANK.quick, st.level, st, { ...mem, asked: [] }, r);
  if (b) return b;
  st.used = st.used.filter((id) => !id.startsWith("qk."));
  return byLevel(BANK.quick, st.level, st, { ...mem, asked: [] }, r);
}

function nextFree(st: State, mem: Memory, m: Meaning | null, r: () => number, cur?: string): Beat {
  // 1. follow what they just mentioned (the last-mentioned topic first), or keep going on this one
  const order = m?.topics.length ? [...m.topics].sort((a, b) => lastIndex(m, b) - lastIndex(m, a)) : [];
  if (cur && !order.includes(cur) && r() < 0.6) order.push(cur);
  if (order.length) {
    const b = topicBeat(order, st, mem);
    if (b) return b;
  }
  // 2. bring back something from earlier
  if (st.sinceCallback >= 5 && r() < 0.7) {
    const b = callbackBeat(st, mem, r, [...(m?.topics ?? []), ...st.recent, ...Object.keys(st.topicRuns)]);
    if (b) return b;
  }
  // 3. they haven't asked anything for a while
  if (st.sinceQuestion >= 4 && st.mode !== "quick" && !st.used.includes("nudge") && r() < 0.7) return NUDGE;
  // 4. a new question at their level
  const lv: Lvl = st.mode === "beginner" ? (lvlRank(st.level) > 0 ? "A2" : "A1") : st.level;
  const b = byLevel(BANK.openers, lv, st, mem, r) ?? byLevel(Object.values(BANK.topics).flatMap((t) => t.beats.slice(0, 2)), lv, st, mem, r, 1);
  if (b) return b;
  // everything's been asked — start the cycle again
  mem.asked = mem.asked.slice(-20);
  st.used = [];
  return byLevel(BANK.openers, lv, st, mem, r) ?? BANK.openers[0];
}

function lastIndex(m: Meaning, topic: string): number {
  const tp = BANK.topics[topic];
  let best = -1;
  m.words.forEach((w, i) => {
    if (tp.stems.some((s) => (s.startsWith("=") ? w === s.slice(1) : w.startsWith(s)))) best = i;
  });
  return best;
}

function chooseNext(st: State, mem: Memory, m: Meaning | null, r: () => number): { beat: Beat | null; end?: T } {
  if (st.mode === "quick") return { beat: nextQuick(st, mem, r) };
  if (st.mode === "roleplay") {
    const sc = scenarioById(st.scenario)!;
    if (st.detour.length) {
      const id = st.detour.shift()!;
      return { beat: ALL_BEATS.get(id)?.beat ?? null };
    }
    // an unexpected follow-up about something they mentioned (and maybe one more on it)
    const chance = sc.vy ? 0 : FOLLOW[sc.id] ?? 0.2;
    const cur = st.cur?.topic;
    if (cur && (st.topicRuns[cur] ?? 0) < 2 && r() < chance * 0.8) {
      const b = topicBeat([cur], st, mem);
      if (b) return { beat: b };
    }
    if (m?.topics.length && st.sinceDetour >= 2 && r() < chance) {
      const order = [...m.topics].sort((a, b) => lastIndex(m, b) - lastIndex(m, a));
      const b = topicBeat(order, st, mem);
      if (b) {
        st.sinceDetour = 0;
        return { beat: b };
      }
    }
    if (st.step < sc.beats.length) return { beat: sc.beats[st.step++] };
    return { beat: null, end: sc.end };
  }
  return { beat: nextFree(st, mem, m, r, st.cur?.topic) };
}

/** The scenario after this one: same level first, then the next level up. */
export function nextScenario(id: string | null, mem: Memory) {
  const list = BANK.scenarios;
  const i = Math.max(0, list.findIndex((s) => s.id === id));
  const cur = list[i];
  const rest = [...list.slice(i + 1), ...list.slice(0, i)];
  const fresh = rest.filter((s) => !mem.stats.scenarios[s.id]);
  const pool = fresh.length ? fresh : rest;
  return pool.find((s) => s.level === cur?.level) ?? pool.find((s) => lvlRank(s.level) === lvlRank(cur?.level ?? "A1") + 1) ?? pool[0];
}

// ---------------------------------------------------------------- reacting

const GENERIC: Record<string, T[]> = {
  good: [{ ru: "Отлично!", en: "Great!" }, { ru: "Здорово!", en: "Wonderful!" }, { ru: "Как хорошо!", en: "How good!" }],
  bad: [{ ru: "Ой, сочувствую.", en: "Oh, I'm sorry." }, { ru: "Эх, бывает.", en: "Ah, it happens." }, { ru: "Держись!", en: "Hang in there!" }],
  ok: [{ ru: "Понятно.", en: "I see." }, { ru: "Ну, нормально — это тоже хорошо.", en: "Well, fine is good too." }],
  yes: [{ ru: "Здорово!", en: "Great!" }, { ru: "Класс!", en: "Cool!" }],
  no: [{ ru: "Понятно.", en: "I see." }, { ru: "Ничего страшного.", en: "No big deal." }],
  dontknow: [{ ru: "Ничего, бывает.", en: "That's OK, it happens." }, { ru: "Ну, подумай ещё!", en: "Well, have another think!" }],
  else: [{ ru: "Понятно!", en: "I see!" }, { ru: "Интересно!", en: "Interesting!" }, { ru: "Ясно!", en: "Got it!" }, { ru: "Ага!", en: "Aha!" }],
};
const NATIVE: T[] = [{ ru: "Круто!", en: "Cool!" }, { ru: "Да ладно!", en: "No way!" }, { ru: "Класс!", en: "Nice!" }, { ru: "Ну ты даёшь!", en: "You're something else!" }, { ru: "Офигеть!", en: "Wow!" }];
const RU_PLEASE: T[] = [
  { ru: "По-русски, пожалуйста!", en: "In Russian, please!" },
  { ru: "Ой, а можно по-русски?", en: "Oh, can you say that in Russian?" },
];

function matches(c: Cond, m: Meaning): boolean {
  if (c.startsWith("topic=")) return m.topics.includes(c.slice(6));
  if (c.startsWith("has=")) {
    const stems = c.slice(4).split("/");
    return stems.some((s) => (s.startsWith("=") ? m.words.includes(s.slice(1)) : m.words.some((w) => w.startsWith(s)) || m.norm.includes(s)));
  }
  if (c === "name") return !!m.name;
  return !!(m as unknown as Record<string, unknown>)[c];
}

function reactionFor(b: Beat, m: Meaning): { say: T; matched: boolean; q: boolean } | null {
  for (const x of b.reactions) if (x.when !== "else" && x.when.some((c) => matches(c, m))) return { say: x.say, matched: true, q: x.when.some((c) => c === "q" || c === "askback") };
  const e = b.reactions.find((x) => x.when === "else");
  return e ? { say: e.say, matched: false, q: false } : null;
}

const join = (parts: T[]): T => ({ ru: parts.map((p) => p.ru).filter(Boolean).join(" "), en: parts.map((p) => p.en).filter(Boolean).join(" ") });

// ---------------------------------------------------------------- the main step

export function respond(st0: State, mem: Memory, text: string, o: Opts = {}): { st: State; mem: Memory; turn: Turn } {
  const r = o.rand ?? Math.random;
  const now = o.now ?? Date.now();
  const st: State = { ...st0, used: [...st0.used], detour: [...st0.detour], topicRuns: { ...st0.topicRuns }, quick: { ...st0.quick, ms: [...st0.quick.ms], scores: [...st0.quick.scores] } };
  mem = { ...mem, topics: { ...mem.topics }, asked: [...mem.asked], recent: [...mem.recent], stats: { ...mem.stats, days: { ...mem.stats.days }, mistakes: { ...mem.stats.mistakes }, scenarios: { ...mem.stats.scenarios } } };
  const b = st.cur;
  const vy = isVy(st);
  const ch = charOf(st);
  const m = understand(text, BANK.topics, LEX);
  const turn: Turn = { said: m.text, translit: m.translit, english: m.english, fixes: [], corrected: m.text, natural: null, perfect: false, score: 0, understood: false, notes: [], reaction: [], next: [], events: [] };
  if (st.mode === "quick" && st.curAt) turn.ms = Math.max(0, now - st.curAt);

  // ---- English: ask again, in Russian
  if (m.english) {
    turn.reaction.push({ ...pick(RU_PLEASE, r), kind: "say" });
    if (b) {
      const best = b.models[0];
      if (best) turn.natural = { ...render(best, st, mem, o.myName), why: "Here's one way to say it in Russian." };
    }
    mem.stats.english++;
    if (st.mode === "challenge" && st.streak > 0) {
      st.streak = 0;
      turn.events.push("challenge-reset");
      turn.notes.push("That was English — the challenge starts again from 0.");
    }
    if (b) turn.next.push(ask(b, st, mem, o.myName));
    return { st, mem, turn };
  }

  // ---- corrections
  const c = check(m.text, { forms: st.forms, vy, lex: LEX });
  turn.fixes = c.fixes;
  turn.corrected = c.corrected;
  const real = realFixes(c.fixes);

  // ---- understanding
  const models = b ? b.models.map((x) => ({ ...render(x, st, mem, o.myName), why: x.why })) : [];
  const userN = low(c.corrected);
  const scored = models.map((x) => ({ x, s: sim(low(x.ru).replace(/[^\p{L}\s]/gu, ""), userN.replace(/[^\p{L}\s]/gu, "")) })).sort((a, z) => z.s - a.s);
  const bestSim = scored[0]?.s ?? 0;
  const react = b ? reactionFor(b, m) : null;
  const known = m.words.filter((w) => LEX.has(w)).length;
  const understood = !!react?.matched || m.topics.length > 0 || m.asks.length > 0 || m.good || m.bad || m.ok || m.yes || m.no || m.number || m.dontknow || m.q || bestSim >= 0.45 || (m.words.length >= 3 && known / m.words.length >= 0.6);
  turn.understood = understood;

  // ---- a natural alternative (and why it sounds good)
  const sameMood = (x: T) => {
    const mm = understand(x.ru, BANK.topics, LEX);
    return (m.good && mm.good) || (m.bad && mm.bad) || (m.ok && mm.ok) || (m.yes && mm.yes) || (m.no && mm.no);
  };
  const alt = scored.find((x) => sameMood(x.x) && x.s >= 0.3) ?? scored[0];
  // only offer "a native would say" when they tried to say something like it, made a mistake, or said very little
  if (alt && (alt.s >= 0.35 || (m.words.length <= 2 && !m.q))) {
    const am = understand(alt.x.ru, BANK.topics, LEX);
    if (alt.s >= 0.85 && !real.length) turn.perfect = true;
    else {
      let why = alt.x.why ?? "";
      if (am.askback && !m.askback && !b?.ask) why = "It asks back — «А у тебя?» / «А ты?» keeps the conversation going. Russians expect it.";
      else if (m.words.length <= 2 && tokens(alt.x.ru).length > 3) why = why || "A full sentence sounds friendlier than one or two words.";
      turn.natural = { ru: alt.x.ru, en: alt.x.en, why: why || "This is how a native speaker would typically put it." };
    }
  }
  if (!turn.perfect && !real.length && understood && m.words.length >= 3) turn.notes.push("Correct and clear.");

  // ---- score
  let score = understood ? 70 : 45;
  score += Math.min(20, m.words.length * 4);
  score -= real.length * 12;
  if (m.q || m.askback) score += 10;
  if (turn.perfect) score = Math.max(score, 95);
  if (bestSim >= 0.85 && !real.length) score = Math.max(score, 92);
  turn.score = Math.max(real.length ? 25 : understood ? 50 : 30, Math.min(100, Math.round(score)));

  // ---- memory
  if (m.name) mem.name = m.name;
  for (const t of m.topics) mem.topics[t] = now;
  st.recent = [...(st.recent ?? []), ...m.topics].slice(-6);
  if (b && !b.id.startsWith("cb.") && b.id !== "hello" && b.id !== "nudge") mem.asked = [...mem.asked.filter((x) => x !== b.id), b.id].slice(-220);
  const day = new Date(now).toISOString().slice(0, 10);
  const s = mem.stats;
  s.exchanges++;
  s.days[day] = (s.days[day] ?? 0) + 1;
  if (understood) s.understood++;
  s.scoreSum += turn.score;
  s.grammar += real.length;
  s.spelling += c.fixes.filter((f) => f.kind === "spelling").length;
  for (const f of real) s.mistakes[f.why.slice(0, 60)] = (s.mistakes[f.why.slice(0, 60)] ?? 0) + 1;
  if (m.askback) s.askedBack++;
  if (m.q) s.questions++;
  st.exchanges++;
  st.sinceCallback++;
  st.sinceDetour++;
  st.sinceQuestion = m.q ? 0 : st.sinceQuestion + 1;
  if (b?.topic) st.topicRuns[b.topic] = (st.topicRuns[b.topic] ?? 0) + 1;
  if (b?.id.startsWith("cb.")) st.sinceCallback = 0;
  if (m.askback) turn.notes.push("You asked back — that's exactly what Russians do.");
  else if (m.q && !b?.ask) turn.notes.push("Nice — you asked a question too.");

  // ---- adaptive level
  mem.recent = [...mem.recent, turn.score].slice(-10);
  const avg = mem.recent.reduce((a, x) => a + x, 0) / mem.recent.length;
  const cap: Lvl = st.mode === "beginner" ? "A2" : "B2";
  if (mem.recent.length >= 8 && avg >= 88 && lvlRank(st.level) < lvlRank(cap) && st.mode !== "quick") {
    st.level = LEVELS[lvlRank(st.level) + 1];
    mem.level = st.level;
    mem.recent = [];
    turn.events.push("level-up");
  } else if (mem.recent.length >= 6 && avg < 50 && lvlRank(st.level) > 0) {
    st.level = LEVELS[lvlRank(st.level) - 1];
    mem.level = st.level;
    mem.recent = [];
    turn.events.push("level-down");
  }

  // ---- challenge
  if (st.mode === "challenge") {
    if (understood) st.streak++;
    if (st.streak >= 10) {
      turn.events.push("challenge-done");
      s.challengesDone++;
      s.challengeBest = Math.max(s.challengeBest, 10);
      st.streak = 0;
    } else s.challengeBest = Math.max(s.challengeBest, st.streak);
  }

  // ---- quick round
  if (st.mode === "quick") {
    st.quick.n++;
    if (turn.ms != null) st.quick.ms.push(turn.ms);
    st.quick.scores.push(turn.score);
    if (st.quick.n >= 10) {
      const avgMs = st.quick.ms.length ? st.quick.ms.reduce((a, x) => a + x, 0) / st.quick.ms.length : 0;
      turn.quickSummary = { avgMs, avgScore: Math.round(st.quick.scores.reduce((a, x) => a + x, 0) / st.quick.scores.length) };
      turn.events.push("quick-round");
      s.quickRounds++;
      st.quick = { n: 0, ms: [], scores: [] };
    }
  }

  // ---- the partner's reaction
  const parts: T[] = [];
  const offTopic = !react?.matched && bestSim < 0.3;
  const tpReact = m.topics.map((x) => BANK.topics[x]).find((x) => x?.react.length);
  if (react?.matched) parts.push(react.say);
  else if (m.q && m.asks.length && !b?.ask) {
    /* they asked the partner something — the answer below is the reaction */
  } else if (tpReact && st.mode !== "quick") parts.push(pick(tpReact.react, r));
  else if (m.q && offTopic) {
    /* they asked something instead of answering — the answer below is the reaction */
  } else if (react && !offTopic) parts.push(react.say);
  else {
    const key = m.good ? "good" : m.bad ? "bad" : m.ok ? "ok" : m.yes ? "yes" : m.no ? "no" : m.dontknow ? "dontknow" : "else";
    parts.push(pick(st.mode === "native" && (key === "good" || key === "yes" || key === "else") && r() < 0.6 ? NATIVE : GENERIC[key], r));
  }
  // they asked the partner something: answer it (unless this was a "you ask" moment, already handled)
  if (!b?.ask && !react?.q && st.mode !== "quick") {
    if (m.asks.length) for (const k of m.asks.slice(0, 2)) {
      const a = ch.answers[k] ?? ch.answers.generic;
      if (a) parts.push(a);
    }
    else if (m.q && ch.answers.generic) parts.push(ch.answers.generic);
  }
  // an opinion of their own — sometimes agreeing, sometimes not
  if (!vy && st.mode !== "quick" && m.likes.length) {
    const tp = BANK.topics[m.likes[0]];
    const x = r();
    if (tp?.like && x < 0.4) parts.push(tp.like);
    else if (tp?.dislike && x < 0.65) parts.push(tp.dislike);
  }
  const rx = render(join(parts), st, mem, o.myName);
  turn.reaction.push({ ...rx, kind: "say" });

  // ---- what comes next
  const nx = chooseNext(st, mem, m, r);
  if (nx.end) {
    // scenario finished: say goodbye, then the next scenario begins
    turn.next.push({ ...render(nx.end, st, mem, o.myName), kind: "end" });
    s.scenarios[st.scenario!] = (s.scenarios[st.scenario!] ?? 0) + 1;
    turn.events.push("scenario-done");
    const sc = nextScenario(st.scenario, mem);
    st.scenario = sc.id;
    st.partner = sc.char;
    st.step = 1;
    st.topicRuns = {};
    st.cur = sc.beats[0];
    st.used.push(sc.beats[0].id);
    turn.next.push({ ru: sc.title.ru, en: sc.about, kind: "note" });
    turn.next.push(ask(sc.beats[0], st, mem, o.myName));
  } else if (nx.beat) {
    st.cur = nx.beat;
    st.used.push(nx.beat.id);
    turn.next.push(ask(nx.beat, st, mem, o.myName));
  } else st.cur = null;
  st.curAt = now;
  return { st, mem, turn };
}

// ---------------------------------------------------------------- chess remarks

type Who = "me" | "opp";
const RIVAL: Record<string, Partial<Record<Who, T[]>>> = {
  check: {
    opp: [{ ru: "Шах! Осторожно.", en: "Check! Careful." }, { ru: "А вот и шах!", en: "And here's check!" }],
    me: [{ ru: "Ой, шах! Дай подумать…", en: "Oh, check! Let me think…" }, { ru: "Шах? Ну ты даёшь!", en: "Check? You're something else!" }],
  },
  capture: {
    opp: [{ ru: "Спасибо за подарок!", en: "Thanks for the gift!" }, { ru: "Извини, это моё!", en: "Sorry, that's mine!" }],
    me: [{ ru: "Эй! Это была моя фигура!", en: "Hey! That was my piece!" }, { ru: "Ох… Хороший ход.", en: "Oh… Good move." }],
  },
  castle: { me: [{ ru: "Рокировка — правильно, король в безопасности.", en: "Castling — right, the king is safe." }], opp: [{ ru: "Спрячу-ка я короля.", en: "I think I'll hide my king." }] },
  promotion: { opp: [{ ru: "Новый ферзь! Ха!", en: "A new queen! Ha!" }], me: [{ ru: "Ого, новый ферзь! Это нечестно!", en: "Whoa, a new queen! That's not fair!" }] },
  threat: { opp: [{ ru: "Видишь угрозу?", en: "Do you see the threat?" }] },
};
const BUDDY: Record<string, Partial<Record<Who, T[]>>> = {
  check: { opp: [{ ru: "Ой, тебе шах!", en: "Oh, you're in check!" }], me: [{ ru: "Шах! Отлично!", en: "Check! Excellent!" }] },
  capture: { opp: [{ ru: "Ай, ты потерял{|а} фигуру.", en: "Ouch, you lost a piece." }], me: [{ ru: "Отличный размен!", en: "Great trade!" }, { ru: "Хороший улов!", en: "Nice catch!" }] },
  castle: { me: [{ ru: "Рокировка — молодец!", en: "Castling — well done!" }] },
  promotion: { me: [{ ru: "Новый ферзь! Красиво!", en: "A new queen! Beautiful!" }], opp: [{ ru: "Ой, у соперника новый ферзь…", en: "Uh-oh, your opponent has a new queen…" }] },
};

/** Now and then, the partner reacts to what happened on the board (no answer needed). */
export function remark(st0: State, mem: Memory, move: { key: string; mine: boolean; bot: boolean }, o: Opts = {}): { st: State; line: Line | null } {
  const r = o.rand ?? Math.random;
  const st = { ...st0, moves: st0.moves + 1 };
  if (st.mode === "quick" || st.moves - st.lastRemark < 3 || r() > 0.55) return { st, line: null };
  const table = move.bot ? RIVAL : BUDDY;
  const opts = table[move.key]?.[move.mine ? "me" : "opp"];
  if (!opts?.length) return { st, line: null };
  st.lastRemark = st.moves;
  return { st, line: { ...render(pick(opts, r), st, mem, o.myName), kind: "remark" } };
}

/** Rough "conversation level" summary for progress screens. */
export function summary(mem: Memory) {
  const s = mem.stats;
  const avg = s.exchanges ? Math.round(s.scoreSum / s.exchanges) : 0;
  const understood = s.exchanges ? Math.round((100 * s.understood) / s.exchanges) : 0;
  const top = Object.entries(s.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { avg, understood, top, level: mem.level ?? null };
}
