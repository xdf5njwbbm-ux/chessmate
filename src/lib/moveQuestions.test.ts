// Run: npm run test:questions
import assert from "node:assert/strict";
import { nextQuestion, type QuestionPool } from "./moveQuestions.ts";

const pool: QuestionPool = {
  levels: ["A1", "A2"],
  lines: Array.from({ length: 20 }, (_, i) => ({ ru: `Фраза номер ${i}.`, ruF: i === 3 ? "Я рада." : null, en: `Sentence ${i}.`, level: i % 2 ? "A2" : "A1", lesson: "L" })),
  drills: Array.from({ length: 8 }, (_, i) => ({ q: `Я ___ ${i}.`, answer: "иду", options: ["иду", "идёт", "идут", "идёшь"], en: `I go ${i}.`, level: "A1", why: { идёт: "он form", идут: "они form", идёшь: "ты form" } })),
  vocab: Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, ru: `слово${i}`, stressed: `сло́во${i}`, en: `word ${i}`, level: "A1" })),
};

const used = new Set<string>();
const seen = new Set<string>();
const kinds = new Set<string>();
for (let n = 0; n < 40; n++) {
  const q = nextQuestion(pool, used, n, "f");
  assert.ok(q, `question ${n}`);
  assert.ok(!seen.has(q.key), `repeat at ${n}: ${q.key}`);
  seen.add(q.key);
  kinds.add(q.kind);
  assert.ok(q.options.includes(q.answer), "answer among options");
  assert.equal(new Set(q.options).size, q.options.length, "no duplicate options");
  assert.ok(q.options.length >= 3);
  // every wrong option comes with a reason, and the right answer never does
  for (const o of q.options) {
    if (o === q.answer) assert.equal(q.why[o], undefined, `no note for the answer (${q.kind})`);
    else assert.ok(q.why[o], `${q.kind}: note for wrong option "${o}"`);
  }
}
assert.equal(kinds.size, 6, "all six question types appear");
// consecutive questions differ in type
const u2 = new Set<string>();
const types = [0, 1, 2, 3, 4, 5].map((n) => nextQuestion(pool, u2, n, "m")!.kind);
assert.equal(new Set(types).size, 6);
console.log("  ✓ 40 questions, no repeats, all six types, answers always offered, every wrong option explained\n\n1 move-question test passed");
