// AI Voice Practice — pure logic shared by the `voice` edge function, the app
// and the tests: transcript types, call metrics, level evaluation, lesson
// progress and long-term memory. No I/O here.
import { isLevel, nextLevel, TOPICS, VOICE_LEVELS, type VoiceLevel } from "./curriculum.ts";

// ---------------------------------------------------------------- types
export type IssueType = "grammar" | "word_choice" | "pronunciation" | "ending" | "structure" | "unnatural";
export const ISSUE_TYPES: IssueType[] = ["grammar", "word_choice", "pronunciation", "ending", "structure", "unnatural"];
export const ISSUE_LABEL: Record<IssueType, string> = {
  grammar: "Grammar",
  word_choice: "Word choice",
  pronunciation: "Pronunciation",
  ending: "Word ending",
  structure: "Sentence structure",
  unnatural: "Sounds unnatural",
};
export type Issue = { type: IssueType; wrong: string; right: string; note: string };

/** One Russian or English stretch of a tutor line. */
export type Segment = { lang: "ru" | "en"; text: string; en?: string; pron?: string };
export type Suggestion = { ru: string; en: string; pron: string };

export type TutorAnalysis = {
  kind: "tutor";
  segments: Segment[];
  words: { ru: string; en: string }[];
  suggestions: Suggestion[];
  /** Set when this line corrects what the learner just said (the tutor heard the audio). */
  correction: (Issue & { said?: string }) | null;
};
export type LearnerAnalysis = {
  kind: "learner";
  lang: "ru" | "en" | "mixed";
  intended: string;
  ok: boolean;
  corrected: string | null;
  natural: string | null;
  en: string;
  pron: string;
  issues: Issue[];
  words: string[];
};
export type Analysis = TutorAnalysis | LearnerAnalysis;

export type Turn = {
  id: string;
  role: "tutor" | "learner";
  text: string;
  /** ms since the call started */
  at: number;
  analysis?: Analysis | null;
};

export type CallStats = { nudges: number; helps: number; repeats: number; english: number; reconnects: number };

export type HistoryEntry = {
  at: string;
  level: VoiceLevel;
  lesson: number | null;
  comprehension: number;
  confidence: number;
  accuracy: number;
  overall: number;
  sentences: number;
  estimate: VoiceLevel;
};

export type LessonProgress = { calls: number; best: number; last: string; mastered: VoiceLevel[] };

export type Memory = {
  name?: string;
  facts: string[];
  known_words: { ru: string; en: string; n: number; last: string }[];
  grammar: { topic: string; at: string }[];
  mistakes: { type: IssueType; wrong: string; right: string; note: string; n: number; last: string }[];
  struggles: { ru: string; issue: string; n: number; last: string }[];
  topics: { topic: string; at: string }[];
  last_call?: { at: string; summary: string; lesson: number | null };
};

export type Scores = { comprehension: number; confidence: number; accuracy: number; overall: number };

export type Report = {
  summary: string;
  duration_s: number;
  sentences: number;
  words_spoken: number;
  scores: Scores;
  strengths: string[];
  new_vocabulary: { ru: string; en: string }[];
  grammar_mistakes: Issue[];
  pronunciation: { improvements: string[]; practise: { ru: string; issue: string; tip: string }[] };
  struggled_words: { ru: string; en: string; why: string }[];
  level: { speaking: VoiceLevel; before: VoiceLevel; progress: number; advanced: boolean; estimate: VoiceLevel; note: string };
  next_lesson: { id: number; title: string; reason: string };
  review: { title: string; intro: string; items: { en: string; ru: string; pron: string; note: string }[] };
};

// ---------------------------------------------------------------- small helpers
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const str = (v: unknown, n = 300) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const num = (v: unknown, lo: number, hi: number, fallback: number) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? clamp(Math.round(x), lo, hi) : fallback;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const plainRu = (s: string) => s.replace(/́/g, "");
const key = (s: string) => plainRu(s).toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N} ]+/gu, "").replace(/\s+/g, " ").trim();
const CYR = /[а-яё]/i;

/** Rough sentence count for a spoken turn (at least 1 if it has any words). */
export function countSentences(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  const parts = t.split(/[.!?…]+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 1 && /\p{L}/u.test(s));
  return Math.max(1, parts.length);
}
export const wordCount = (text: string) => (text.match(/[\p{L}\p{N}'-]+/gu) ?? []).length;

// ---------------------------------------------------------------- analysis parsing
const issueType = (v: unknown): IssueType => (ISSUE_TYPES.includes(v as IssueType) ? (v as IssueType) : "grammar");
function parseIssue(v: unknown): Issue | null {
  const o = obj(v);
  const right = str(o.right ?? o.correct, 300);
  if (!right) return null;
  return { type: issueType(o.type), wrong: str(o.wrong ?? o.said, 300), right, note: str(o.note, 300) };
}
const parseSuggestion = (v: unknown): Suggestion | null => {
  const o = obj(v);
  const ru = str(o.ru, 200);
  return ru ? { ru, en: str(o.en, 200), pron: str(o.pron, 240) } : null;
};

export function parseTutorAnalysis(raw: unknown, text: string): TutorAnalysis {
  const o = obj(raw);
  const segments = arr(o.segments)
    .flatMap((s): Segment[] => {
      const x = obj(s);
      const t = str(x.text, 600);
      if (!t) return [];
      const lang: "ru" | "en" = x.lang === "en" ? "en" : x.lang === "ru" ? "ru" : CYR.test(t) ? "ru" : "en";
      return [lang === "ru" ? { lang, text: t, en: str(x.en, 600), pron: str(x.pron, 600) } : { lang, text: t }];
    })
    .slice(0, 16);
  const c = obj(o.correction);
  const correction = c.right || c.correct ? parseIssue(c) : null;
  return {
    kind: "tutor",
    segments: segments.length ? segments : [{ lang: CYR.test(text) ? "ru" : "en", text } as Segment],
    words: arr(o.words ?? o.new_words).map((w) => ({ ru: str(obj(w).ru, 80), en: str(obj(w).en, 120) })).filter((w) => w.ru).slice(0, 5),
    suggestions: arr(o.suggestions).map(parseSuggestion).filter((s): s is Suggestion => !!s).slice(0, 3),
    correction: correction ? { ...correction, said: str(c.said ?? c.wrong, 300) } : null,
  };
}

export function parseLearnerAnalysis(raw: unknown, text: string): LearnerAnalysis {
  const o = obj(raw);
  const issues = arr(o.issues).map(parseIssue).filter((i): i is Issue => !!i).slice(0, 5);
  const corrected = str(o.corrected, 400) || null;
  const natural = str(o.natural, 400) || null;
  const lang = o.lang === "en" || o.lang === "mixed" ? o.lang : CYR.test(text) ? "ru" : "en";
  return {
    kind: "learner",
    lang,
    intended: str(o.intended, 300),
    ok: o.ok === true || (!issues.length && !corrected),
    corrected: corrected && key(corrected) !== key(text) ? corrected : null,
    natural: natural && key(natural) !== key(corrected ?? text) ? natural : null,
    en: str(o.en, 400),
    pron: str(o.pron, 400),
    issues,
    words: arr(o.words).map((w) => str(w, 40)).filter((w) => CYR.test(w)).slice(0, 20),
  };
}

// ---------------------------------------------------------------- metrics
export type Metrics = {
  sentences: number;
  words: number;
  learnerTurns: number;
  russianTurns: number;
  englishTurns: number;
  avgWords: number;
  okRate: number;
  issues: Record<IssueType, number>;
  tutorCorrections: number;
};

export function callMetrics(turns: Turn[]): Metrics {
  const learner = turns.filter((t) => t.role === "learner" && t.text.trim());
  const issues = Object.fromEntries(ISSUE_TYPES.map((t) => [t, 0])) as Record<IssueType, number>;
  let sentences = 0, words = 0, ok = 0, analysed = 0, russian = 0, english = 0, corrections = 0;
  for (const t of learner) {
    const a = t.analysis?.kind === "learner" ? t.analysis : null;
    const isRu = a ? a.lang !== "en" : CYR.test(t.text);
    if (isRu) {
      russian++;
      sentences += countSentences(t.text);
      words += wordCount(t.text);
    } else english++;
    if (a && a.lang !== "en") {
      analysed++;
      if (a.ok) ok++;
      for (const i of a.issues) issues[i.type]++;
    }
  }
  for (const t of turns) if (t.role === "tutor" && t.analysis?.kind === "tutor" && t.analysis.correction) corrections++;
  return {
    sentences,
    words,
    learnerTurns: learner.length,
    russianTurns: russian,
    englishTurns: english,
    avgWords: russian ? Math.round((words / russian) * 10) / 10 : 0,
    okRate: analysed ? ok / analysed : 0,
    issues,
    tutorCorrections: corrections,
  };
}

/** Scores from the numbers alone (used when the AI report isn't available, and to sanity-check it). */
export function fallbackScores(m: Metrics, stats: CallStats, level: VoiceLevel): Scores {
  if (!m.russianTurns) return { comprehension: 0, confidence: 0, accuracy: 0, overall: 0 };
  const expectWords = [4, 6, 9, 12, 14][VOICE_LEVELS.indexOf(level)] ?? 5;
  const help = stats.nudges + stats.helps + stats.repeats;
  const comprehension = clamp(Math.round(92 - (help / Math.max(1, m.learnerTurns)) * 60 - (m.englishTurns / Math.max(1, m.learnerTurns)) * 30), 20, 100);
  const confidence = clamp(Math.round(40 + Math.min(1.2, m.avgWords / expectWords) * 40 + Math.min(20, m.russianTurns * 2) - stats.nudges * 5), 10, 100);
  const accuracy = clamp(Math.round(m.okRate * 100), 0, 100);
  return { comprehension, confidence, accuracy, overall: overallOf(comprehension, confidence, accuracy) };
}
export const overallOf = (comprehension: number, confidence: number, accuracy: number) =>
  Math.round(0.35 * comprehension + 0.3 * confidence + 0.35 * accuracy);

// ---------------------------------------------------------------- level evaluation
/** A call counts toward evaluation only with enough real speaking in it. */
export const MIN_EVAL_SENTENCES = 6;
/** How many recent calls at a level have to be strong before moving up. */
export const ADVANCE_WINDOW = 3;
export const ADVANCE_AVG = 75;
export const ADVANCE_SENTENCES = 45;

export type LevelState = { level: VoiceLevel; progress: number; history: HistoryEntry[] };
export type LevelResult = LevelState & { advanced: boolean; delta: number; note: string };

/**
 * Speaking level moves only on evidence: each evaluated call nudges progress
 * up or down from its overall score; reaching the next level also needs the
 * last few calls at this level to be strong and the evaluator to place you at
 * the next level in most of them. Finishing lessons never moves the level.
 */
export function evaluateLevel(state: LevelState, entry: HistoryEntry): LevelResult {
  const history = [...state.history, entry].slice(-20);
  const eligible = entry.sentences >= MIN_EVAL_SENTENCES;
  const next = nextLevel(state.level);
  let delta = 0;
  if (eligible) {
    delta = clamp(Math.round((entry.overall - 60) / 2), -6, 12);
    if (next && VOICE_LEVELS.indexOf(entry.estimate) > VOICE_LEVELS.indexOf(state.level)) delta += 3;
  }
  let progress = clamp(state.progress + delta, 0, 100);
  let level = state.level;
  let advanced = false;
  let note: string;

  const recent = history.filter((h) => h.level === state.level && h.sentences >= MIN_EVAL_SENTENCES).slice(-ADVANCE_WINDOW);
  const avg = recent.length ? recent.reduce((s, h) => s + h.overall, 0) / recent.length : 0;
  const placedHigher = next ? recent.filter((h) => VOICE_LEVELS.indexOf(h.estimate) >= VOICE_LEVELS.indexOf(next)).length : 0;
  const spoken = recent.reduce((s, h) => s + h.sentences, 0);

  if (!eligible) {
    note = `This call was too short to evaluate your level (speak at least ${MIN_EVAL_SENTENCES} sentences).`;
  } else if (!next) {
    note = "You're at the top speaking level. Calls keep your skills sharp.";
  } else if (progress >= 100 && recent.length >= ADVANCE_WINDOW && avg >= ADVANCE_AVG && placedHigher >= 2 && spoken >= ADVANCE_SENTENCES) {
    level = next;
    progress = 10;
    advanced = true;
    note = `You've shown ${next}-level speaking across your recent calls. Welcome to ${next}!`;
  } else if (progress >= 100) {
    const missing: string[] = [];
    if (recent.length < ADVANCE_WINDOW) missing.push(`${ADVANCE_WINDOW - recent.length} more full call${ADVANCE_WINDOW - recent.length === 1 ? "" : "s"} at ${state.level}`);
    if (recent.length && avg < ADVANCE_AVG) missing.push(`an average score of ${ADVANCE_AVG}+ (now ${Math.round(avg)})`);
    if (placedHigher < 2) missing.push(`speaking at ${next} level in more of your calls`);
    if (spoken < ADVANCE_SENTENCES) missing.push(`more sentences spoken (${spoken}/${ADVANCE_SENTENCES})`);
    note = `Ready for ${next} once you show ${missing.join(", ")}.`;
  } else {
    note = delta >= 0 ? `+${delta}% toward ${next}.` : `${delta}% toward ${next} — the tutor will keep things simpler next time.`;
  }
  return { level, progress, history, advanced, delta, note };
}

// ---------------------------------------------------------------- lessons
export const MASTERY_SCORE = 70;

export function updateLessons(lessons: Record<string, LessonProgress>, lesson: number | null, level: VoiceLevel, overall: number, sentences: number, at: string) {
  const out = { ...lessons };
  if (!lesson) return out;
  const prev = out[lesson] ?? { calls: 0, best: 0, last: at, mastered: [] };
  const mastered = [...prev.mastered];
  if (overall >= MASTERY_SCORE && sentences >= MIN_EVAL_SENTENCES && !mastered.includes(level)) mastered.push(level);
  out[lesson] = { calls: prev.calls + 1, best: Math.max(prev.best, overall), last: at, mastered };
  return out;
}

/** Next lesson: stay on this one until it's mastered at your level, then the next one not yet mastered. */
export function nextLesson(lessons: Record<string, LessonProgress>, current: number, level: VoiceLevel): number {
  const done = (id: number) => (lessons[id]?.mastered ?? []).includes(level);
  if (!done(current)) return current;
  for (let k = 1; k <= TOPICS.length; k++) {
    const id = ((current - 1 + k) % TOPICS.length) + 1;
    if (!done(id)) return id;
  }
  return current;
}

// ---------------------------------------------------------------- memory
export const emptyMemory = (): Memory => ({ facts: [], known_words: [], grammar: [], mistakes: [], struggles: [], topics: [] });

export function readMemory(v: unknown): Memory {
  const o = obj(v);
  const m = emptyMemory();
  if (typeof o.name === "string" && o.name.trim()) m.name = o.name.trim().slice(0, 40);
  m.facts = arr(o.facts).map((f) => str(f, 160)).filter(Boolean).slice(0, 30);
  m.known_words = arr(o.known_words).map((w) => ({ ru: str(obj(w).ru, 60), en: str(obj(w).en, 80), n: num(obj(w).n, 1, 9999, 1), last: str(obj(w).last, 30) })).filter((w) => w.ru);
  m.grammar = arr(o.grammar).map((g) => ({ topic: str(obj(g).topic, 120), at: str(obj(g).at, 30) })).filter((g) => g.topic);
  m.mistakes = arr(o.mistakes).map((x) => {
    const y = obj(x);
    return { type: issueType(y.type), wrong: str(y.wrong, 200), right: str(y.right, 200), note: str(y.note, 200), n: num(y.n, 1, 999, 1), last: str(y.last, 30) };
  }).filter((x) => x.right);
  m.struggles = arr(o.struggles).map((x) => ({ ru: str(obj(x).ru, 80), issue: str(obj(x).issue, 160), n: num(obj(x).n, 1, 999, 1), last: str(obj(x).last, 30) })).filter((x) => x.ru);
  m.topics = arr(o.topics).map((t) => ({ topic: str(obj(t).topic, 80), at: str(obj(t).at, 30) })).filter((t) => t.topic);
  const lc = obj(o.last_call);
  if (lc.at) m.last_call = { at: str(lc.at, 30), summary: str(lc.summary, 400), lesson: typeof lc.lesson === "number" ? lc.lesson : null };
  return m;
}

export type MemoryUpdate = {
  name?: string | null;
  facts?: string[] | null;
  words?: { ru: string; en: string }[];
  grammar?: string[];
  mistakes?: Issue[];
  struggles?: { ru: string; issue: string }[];
  topics?: string[];
  summary?: string;
  lesson?: number | null;
};

/** Folds one call into long-term memory. Lists are capped so the tutor's context stays small. */
export function mergeMemory(prev: Memory, u: MemoryUpdate, at: string): Memory {
  const m: Memory = { ...prev, facts: [...prev.facts], known_words: [...prev.known_words], grammar: [...prev.grammar], mistakes: [...prev.mistakes], struggles: [...prev.struggles], topics: [...prev.topics] };
  if (u.name && u.name.trim()) m.name = u.name.trim().slice(0, 40);
  if (u.facts && u.facts.length) {
    // The report returns the full, corrected list; keep it if it looks complete.
    const next = u.facts.map((f) => f.trim().slice(0, 160)).filter(Boolean);
    m.facts = (next.length >= Math.min(prev.facts.length, 3) ? next : [...prev.facts, ...next]).filter((f, i, a) => a.indexOf(f) === i).slice(-30);
  }
  for (const w of u.words ?? []) {
    const k = key(w.ru);
    if (!k || !CYR.test(k)) continue;
    const i = m.known_words.findIndex((x) => key(x.ru) === k);
    if (i >= 0) m.known_words[i] = { ...m.known_words[i], n: m.known_words[i].n + 1, last: at, en: m.known_words[i].en || w.en };
    else m.known_words.push({ ru: w.ru.slice(0, 60), en: (w.en ?? "").slice(0, 80), n: 1, last: at });
  }
  m.known_words = m.known_words.sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : b.n - a.n)).slice(0, 400);
  for (const g of u.grammar ?? []) {
    const t = g.trim().slice(0, 120);
    if (!t) continue;
    m.grammar = [...m.grammar.filter((x) => x.topic.toLowerCase() !== t.toLowerCase()), { topic: t, at }];
  }
  m.grammar = m.grammar.slice(-40);
  for (const x of u.mistakes ?? []) {
    const i = m.mistakes.findIndex((y) => y.type === x.type && key(y.right) === key(x.right));
    if (i >= 0) m.mistakes[i] = { ...m.mistakes[i], n: m.mistakes[i].n + 1, last: at, wrong: x.wrong || m.mistakes[i].wrong, note: x.note || m.mistakes[i].note };
    else m.mistakes.push({ ...x, n: 1, last: at });
  }
  m.mistakes = m.mistakes.sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : b.n - a.n)).slice(0, 40);
  for (const s of u.struggles ?? []) {
    const i = m.struggles.findIndex((y) => key(y.ru) === key(s.ru));
    if (i >= 0) m.struggles[i] = { ...m.struggles[i], n: m.struggles[i].n + 1, last: at, issue: s.issue || m.struggles[i].issue };
    else m.struggles.push({ ru: s.ru.slice(0, 80), issue: s.issue.slice(0, 160), n: 1, last: at });
  }
  m.struggles = m.struggles.sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : b.n - a.n)).slice(0, 30);
  for (const t of u.topics ?? []) {
    const x = t.trim().slice(0, 80);
    if (!x) continue;
    m.topics = [...m.topics.filter((y) => y.topic.toLowerCase() !== x.toLowerCase()), { topic: x, at }];
  }
  m.topics = m.topics.slice(-30);
  if (u.summary) m.last_call = { at, summary: u.summary.slice(0, 400), lesson: u.lesson ?? null };
  return m;
}

// ---------------------------------------------------------------- report
/** Normalizes the AI-written report and fills in everything the numbers already know. */
export function buildReport(raw: unknown, ctx: {
  metrics: Metrics; scores: Scores; duration: number; level: LevelResult; before: VoiceLevel; estimate: VoiceLevel;
  next: number; lessonTitle: string; nextReason: string; turns: Turn[];
}): Report {
  const o = obj(raw);
  const pr = obj(o.pronunciation);
  const rv = obj(o.review);
  const learnerIssues = ctx.turns.flatMap((t) => (t.analysis?.kind === "learner" ? t.analysis.issues : []));
  const tutorFixes = ctx.turns.flatMap((t) => (t.analysis?.kind === "tutor" && t.analysis.correction ? [t.analysis.correction] : []));
  let mistakes = arr(o.grammar_mistakes).map(parseIssue).filter((i): i is Issue => !!i);
  if (!mistakes.length) mistakes = [...tutorFixes.filter((f) => f.type !== "pronunciation"), ...learnerIssues].slice(0, 8);
  const reviewItems = arr(rv.items)
    .map((x) => ({ en: str(obj(x).en, 200), ru: str(obj(x).ru, 200), pron: str(obj(x).pron, 240), note: str(obj(x).note, 200) }))
    .filter((x) => x.ru)
    .slice(0, 8);
  return {
    summary: str(o.summary, 600) || (ctx.metrics.russianTurns ? "You held a Russian conversation and practised speaking." : "This call was too short to say much — try speaking a few sentences next time."),
    duration_s: ctx.duration,
    sentences: ctx.metrics.sentences,
    words_spoken: ctx.metrics.words,
    scores: ctx.scores,
    strengths: arr(o.strengths).map((s) => str(s, 200)).filter(Boolean).slice(0, 4),
    new_vocabulary: arr(o.new_vocabulary).map((w) => ({ ru: str(obj(w).ru, 80), en: str(obj(w).en, 120) })).filter((w) => w.ru).slice(0, 15),
    grammar_mistakes: mistakes.slice(0, 10),
    pronunciation: {
      improvements: arr(pr.improvements).map((s) => str(s, 200)).filter(Boolean).slice(0, 4),
      practise: arr(pr.practise ?? pr.practice).map((x) => ({ ru: str(obj(x).ru, 120), issue: str(obj(x).issue, 200), tip: str(obj(x).tip, 240) })).filter((x) => x.ru).slice(0, 6),
    },
    struggled_words: arr(o.struggled_words).map((x) => ({ ru: str(obj(x).ru, 80), en: str(obj(x).en, 120), why: str(obj(x).why, 200) })).filter((x) => x.ru).slice(0, 8),
    level: {
      speaking: ctx.level.level,
      before: ctx.before,
      progress: ctx.level.progress,
      advanced: ctx.level.advanced,
      estimate: ctx.estimate,
      note: [ctx.level.note, str(obj(o.level).note, 300)].filter(Boolean).join(" "),
    },
    next_lesson: { id: ctx.next, title: ctx.lessonTitle, reason: str(obj(o.next_lesson).reason, 300) || ctx.nextReason },
    review: {
      title: str(rv.title, 120) || "Your review",
      intro: str(rv.intro, 300) || "Say each sentence out loud. Tap to hear it first.",
      items: reviewItems.length
        ? reviewItems
        : mistakes.slice(0, 6).map((m) => ({ en: m.note, ru: m.right, pron: "", note: m.wrong ? `You said: ${m.wrong}` : "" })),
    },
  };
}

export const levelOr = (v: unknown, fallback: VoiceLevel): VoiceLevel => (isLevel(v) ? v : fallback);
