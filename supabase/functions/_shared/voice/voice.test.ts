// Run: npm run test:voice — curriculum data, level evaluation, lessons, memory and the tutor's instructions.
import assert from "node:assert/strict";
import { MODES, speedFor, st, TOPICS, TUTORS, VOICE_LEVELS } from "./curriculum.ts";
import {
  ADVANCE_WINDOW, buildReport, callMetrics, countSentences, emptyMemory, evaluateLevel, fallbackScores, type HistoryEntry, mergeMemory,
  nextLesson, parseLearnerAnalysis, parseTutorAnalysis, readMemory, type Turn, updateLessons,
} from "./logic.ts";
import { learnerAnalysisPrompt, reportPrompt, transcriptText, tutorAnalysisPrompt, tutorInstructions, type TutorContext } from "./prompt.ts";

// ---------------------------------------------------------------- curriculum
assert.equal(TOPICS.length, 20, "20 conversation topics");
assert.deepEqual(TOPICS.map((t) => t.id), Array.from({ length: 20 }, (_, k) => k + 1), "numbered 1–20 in order");
assert.equal(new Set(TOPICS.map((t) => t.slug)).size, 20, "unique slugs");
for (const t of TOPICS) {
  assert.ok(t.phrases.length >= 5, `${t.slug}: at least 5 phrases`);
  for (const p of [t.opener, ...t.phrases]) {
    assert.ok(/[а-яё]/i.test(p.ru) && p.en, `${t.slug}: phrase has Russian and English`);
    assert.ok(!p.ru.includes("'"), `${t.slug}: stress apostrophes converted in «${p.ru}»`);
    // at most one stress mark per word
    for (const w of p.ru.split(/[\s—/]+/)) assert.ok((w.match(/́/g) ?? []).length <= 1, `${t.slug}: one stress in «${w}»`);
  }
  assert.ok(t.grammar.length > 20 && t.goal.length > 10, `${t.slug}: grammar and goal`);
  for (const l of ["A2", "B1", "B2", "C1"] as const) assert.ok(t.stretch[l], `${t.slug}: stretch for ${l}`);
}
assert.equal(st("Приве'т"), "Приве́т");
assert.equal(TOPICS[0].opener.ru.replace(/́/g, ""), "Привет! Как тебя зовут?");
assert.equal(TOPICS[1].opener.ru.replace(/́/g, ""), "Привет! Как дела?", "the 'How are you' lesson opens with «Привет! Как дела?»");
assert.ok(speedFor("beginner", false) < 1 && speedFor("beginner", true) < speedFor("beginner", false), "beginner mode is slow, slower when asked");
assert.equal(speedFor("immersion", false), 1, "immersion is natural speed");
for (const m of Object.values(MODES)) assert.ok(m.speed >= 0.25 && m.speed <= 1.5 && m.slowSpeed >= 0.25, "speeds within the API's range");
assert.ok(TUTORS.anya.voice && TUTORS.misha.voice && TUTORS.anya.gender === "f" && TUTORS.misha.gender === "m");

// ---------------------------------------------------------------- level evaluation
const entry = (o: Partial<HistoryEntry>): HistoryEntry => ({
  at: "2026-11-26T00:00:00Z", level: "A1", lesson: 1, comprehension: 80, confidence: 80, accuracy: 80, overall: 80, sentences: 20, estimate: "A1", ...o,
});
{
  // a short call never moves the level
  const r = evaluateLevel({ level: "A1", progress: 50, history: [] }, entry({ sentences: 2, overall: 100 }));
  assert.equal(r.progress, 50);
  assert.equal(r.level, "A1");
  assert.match(r.note, /too short/);
}
{
  // strong calls build progress but one call can't level you up
  const r = evaluateLevel({ level: "A1", progress: 95, history: [] }, entry({ overall: 90, estimate: "A2" }));
  assert.equal(r.progress, 100);
  assert.equal(r.level, "A1", "needs several strong calls, not one");
  assert.match(r.note, /Ready for A2/);
}
{
  // three strong calls at the level, placed at A2 in most of them → A2
  let state = { level: "A1" as const, progress: 70, history: [] as HistoryEntry[] };
  let last = evaluateLevel(state, entry({ overall: 85, estimate: "A2" }));
  for (let i = 1; i < ADVANCE_WINDOW; i++) {
    state = { level: "A1", progress: last.progress, history: last.history };
    last = evaluateLevel(state, entry({ overall: 85, estimate: i === 1 ? "A1" : "A2" }));
  }
  assert.equal(last.level, "A2", "advances on evidence");
  assert.equal(last.advanced, true);
  assert.equal(last.progress, 10);
}
{
  // weak calls lower progress, never the level
  const r = evaluateLevel({ level: "A2", progress: 5, history: [] }, entry({ level: "A2", overall: 30 }));
  assert.equal(r.level, "A2");
  assert.equal(r.progress, 0);
}
{
  // completing lessons alone doesn't advance (lessons don't touch level)
  const lessons = updateLessons({}, 1, "A1", 90, 20, "t");
  assert.deepEqual(lessons[1].mastered, ["A1"]);
  assert.equal(nextLesson(lessons, 1, "A1"), 2, "moves on once mastered");
  assert.equal(nextLesson(updateLessons({}, 3, "A1", 50, 20, "t"), 3, "A1"), 3, "stays until mastered");
  assert.equal(nextLesson(lessons, 1, "A2"), 1, "mastery is per level");
}
assert.equal(VOICE_LEVELS.at(-1), "C1");
assert.match(evaluateLevel({ level: "C1", progress: 100, history: [] }, entry({ level: "C1", estimate: "C1" })).note, /top/);

// ---------------------------------------------------------------- analysis parsing
{
  const a = parseLearnerAnalysis({
    lang: "ru", intended: "I'm fine", ok: false, corrected: "Я хорошо.", natural: "У меня всё хорошо.", en: "I'm doing well.", pron: "u mee-NYA fsyo kha-ra-SHO",
    issues: [{ type: "unnatural", wrong: "Я хорошо", right: "У меня всё хорошо", note: "Use у меня." }, { type: "bogus", right: "x" }, { note: "no right" }],
    words: ["хорошо", "hello"],
  }, "Я хорошо");
  assert.equal(a.corrected, null, "a 'correction' identical to what they said is dropped");
  assert.equal(a.natural, "У меня всё хорошо.");
  assert.equal(a.issues.length, 2, "issues without a right answer are dropped");
  assert.equal(a.issues[1].type, "grammar", "unknown issue types fall back to grammar");
  assert.deepEqual(a.words, ["хорошо"], "only Russian words are kept");
}
{
  const t = parseTutorAnalysis({ segments: [{ lang: "ru", text: "Приве́т!", en: "Hi!", pron: "pree-VYET" }, { lang: "en", text: "Hi!" }, { text: "" }], suggestions: [{ ru: "Хорошо́" }] }, "Привет! Hi!");
  assert.equal(t.segments.length, 2);
  assert.equal(t.suggestions.length, 1);
  assert.equal(t.correction, null);
  const empty = parseTutorAnalysis(null, "Как дела?");
  assert.deepEqual(empty.segments, [{ lang: "ru", text: "Как дела?" }], "falls back to the raw line");
}

// ---------------------------------------------------------------- metrics, scores, report
const turns: Turn[] = [
  { id: "1", role: "tutor", text: "Привет! Как дела? — Hi! How are you?", at: 0 },
  { id: "2", role: "learner", text: "Я хорошо", at: 4000, analysis: parseLearnerAnalysis({ ok: false, natural: "У меня всё хорошо.", issues: [{ type: "unnatural", wrong: "Я хорошо", right: "У меня всё хорошо", note: "…" }] }, "Я хорошо") },
  { id: "3", role: "tutor", text: "Хорошо! Скажи: «У меня всё хорошо».", at: 8000, analysis: parseTutorAnalysis({ correction: { type: "unnatural", said: "Я хорошо", right: "У меня всё хорошо", note: "…" } }, "x") },
  { id: "4", role: "learner", text: "У меня всё хорошо. А у тебя?", at: 12000, analysis: parseLearnerAnalysis({ ok: true }, "У меня всё хорошо. А у тебя?") },
  { id: "5", role: "learner", text: "How do you say tired?", at: 16000, analysis: parseLearnerAnalysis({ lang: "en" }, "How do you say tired?") },
];
const m = callMetrics(turns);
assert.equal(m.learnerTurns, 3);
assert.equal(m.russianTurns, 2);
assert.equal(m.englishTurns, 1);
assert.equal(m.sentences, 3);
assert.equal(m.okRate, 0.5);
assert.equal(m.tutorCorrections, 1);
assert.equal(countSentences("Привет! Как дела?"), 2);
assert.equal(countSentences("да"), 1);
const fb = fallbackScores(m, { nudges: 0, helps: 0, repeats: 0, english: 0, reconnects: 0 }, "A1");
assert.ok(fb.overall > 0 && fb.overall <= 100 && fb.accuracy === 50);
assert.deepEqual(fallbackScores(callMetrics([]), { nudges: 0, helps: 0, repeats: 0, english: 0, reconnects: 0 }, "A1").overall, 0);
{
  const lvl = evaluateLevel({ level: "A1", progress: 0, history: [] }, entry({ sentences: 3 }));
  const r = buildReport(null, { metrics: m, scores: fb, duration: 95, level: lvl, before: "A1", estimate: "A1", next: 2, lessonTitle: "How are you?", nextReason: "Next up.", turns });
  assert.equal(r.duration_s, 95);
  assert.equal(r.sentences, 3);
  assert.ok(r.grammar_mistakes.length >= 1, "mistakes come from the per-turn checks when the AI report is missing");
  assert.ok(r.review.items.length >= 1 && r.review.items[0].ru, "a review lesson is always built");
  assert.equal(r.next_lesson.id, 2);
}

// ---------------------------------------------------------------- memory
{
  let mem = emptyMemory();
  mem = mergeMemory(mem, { name: "Grant", facts: ["Lives in Florida", "Works in car sales"], words: [{ ru: "хорошо", en: "good" }], mistakes: [{ type: "unnatural", wrong: "Я хорошо", right: "У меня всё хорошо", note: "" }], topics: ["How are you?"], summary: "First call.", lesson: 2 }, "2026-11-26T01:00:00Z");
  mem = mergeMemory(mem, { facts: ["Lives in Florida", "Works in car sales", "Has a little brother"], words: [{ ru: "Хорошо́", en: "" }, { ru: "брат", en: "brother" }], mistakes: [{ type: "unnatural", wrong: "я хорошо", right: "У меня всё хорошо.", note: "" }] }, "2026-11-27T01:00:00Z");
  assert.equal(mem.name, "Grant");
  assert.equal(mem.facts.length, 3);
  assert.equal(mem.known_words.find((w) => w.ru === "хорошо")?.n, 2, "stress marks and case don't create duplicate words");
  assert.equal(mem.mistakes.length, 1);
  assert.equal(mem.mistakes[0].n, 2, "repeated mistakes are counted");
  assert.equal(mem.last_call?.summary, "First call.");
  assert.deepEqual(readMemory(JSON.parse(JSON.stringify(mem))), mem, "memory round-trips through JSON");
  assert.deepEqual(readMemory(null), emptyMemory());
}

// ---------------------------------------------------------------- instructions
const ctx: TutorContext = {
  tutor: "anya", mode: "beginner", level: "A1", courseLevel: "A1", forms: "m", name: "Grant", lesson: 2, firstCall: true,
  memory: emptyMemory(), courseWords: ["шахматы"], review: null, resume: null, struggling: false,
};
const first = tutorInstructions(ctx);
assert.match(first, /say exactly: «Привет! Как дела\?»/, "the very first call opens with «Привет! Как дела?»");
assert.match(first, /After EVERY Russian sentence/, "beginner mode translates");
assert.match(first, /feminine forms about yourself/, "Anya speaks about herself in the feminine");
assert.match(first, /masculine forms \(ты устал/, "addresses a male learner in the masculine");
assert.match(first, /Давай попробуем ещё раз/, "has the correction protocol");
assert.match(first, /шахматы/, "reuses known words");
const imm = tutorInstructions({ ...ctx, mode: "immersion", level: "B1", tutor: "misha", firstCall: false, memory: mergeMemory(emptyMemory(), { name: "Grant", facts: ["Has a brother"], summary: "Talked about family." }, "t") });
assert.match(imm, /Russian only/);
assert.match(imm, /ONLY if they explicitly ask for help/);
assert.match(imm, /Has a brother/, "remembers facts across calls");
assert.match(imm, /masculine forms about yourself/, "Misha speaks about himself in the masculine");
assert.doesNotMatch(imm, /After EVERY Russian sentence/);
const resumed = tutorInstructions({ ...ctx, resume: [{ role: "tutor", text: "Как дела?" }, { role: "learner", text: "Хорошо" }] });
assert.match(resumed, /connection dropped/);
assert.doesNotMatch(resumed, /say exactly/, "a resumed call doesn't greet from scratch");
const rev = tutorInstructions({ ...ctx, lesson: null, review: [{ type: "unnatural", wrong: "Я хорошо", right: "У меня всё хорошо", note: "" }] });
assert.match(rev, /REVIEW CALL/);
assert.ok(first.length < 12_000, "instructions stay compact");
for (const p of [tutorAnalysisPrompt("A1", "beginner", "m"), learnerAnalysisPrompt("A1", "f"), reportPrompt("A1", "natural", "m", 3)]) assert.match(p, /JSON only/);
assert.match(transcriptText(turns), /tutor corrected unnatural/);

console.log("voice: all checks passed");
