// Run: npm run test:kakdela — checks the "Как дела?" course data.
import assert from "node:assert/strict";
import { CATEGORIES, PHRASES, SITUATIONS, TONES, forSpeaker, reaction, sayForm } from "./kakDela.ts";

assert.equal(PHRASES.length, 100, "100 phrases");
assert.deepEqual(PHRASES.map((x) => x.n), Array.from({ length: 100 }, (_, k) => k + 1), "numbered 1–100 in order");
for (const c of CATEGORIES) assert.equal(PHRASES.filter((x) => x.cat === c.id).length, 10, `10 phrases in category ${c.id}`);
assert.equal(new Set(PHRASES.map((x) => x.ru)).size, 100, "no duplicate phrases");
for (const x of PHRASES) {
  assert.match(x.ru, /[.!?]$/, `#${x.n} ends with punctuation`);
  assert.ok(/[а-яё]/i.test(x.ru) && x.en && x.note.length > 15, `#${x.n} has Russian, English and a note`);
  assert.ok(["A1", "A2", "B1", "B2"].includes(x.level), `#${x.n} level`);
  assert.ok(x.tone in TONES, `#${x.n} tone`);
  if (x.speaker) {
    assert.ok(x.other && x.other !== x.ru, `#${x.n} gives the other gender's form`);
    const a = x.ru.split(" "), b = x.other!.split(" ");
    assert.equal(a.length, b.length, `#${x.n} forms line up word for word`);
    assert.equal(a.filter((w, k) => w !== b[k]).length, 1, `#${x.n} forms differ in exactly one word`);
    const pair = PHRASES.find((y) => y.ru === x.other);
    if (pair) assert.equal(pair.other, x.ru, `#${x.n} and #${pair.n} point at each other`);
  }
  if (x.toMan) assert.equal(x.tone, "romantic", `#${x.n} addressee forms are romantic phrases`);
}
// the user's own forms: a man never practises the woman's version and vice versa
assert.ok(forSpeaker(PHRASES, "m").every((x) => x.speaker !== "f"));
assert.ok(forSpeaker(PHRASES, "f").every((x) => x.speaker !== "m"));
assert.equal(sayForm(PHRASES[60], "f"), "Теперь намного лучше, потому что ты написал.", "a woman texting a man");
for (const s of SITUATIONS) {
  for (const t of Object.keys(s.bad)) assert.ok(!s.good.includes(t as never), `${s.id}: a tone isn't both good and bad`);
  for (let c = 1; c <= 10; c++) assert.ok(reaction(c, s, "m").ru && reaction(c, s, "f").en, `${s.id}: reaction for category ${c}`);
}
console.log(`Как дела ok: ${PHRASES.length} phrases, ${SITUATIONS.length} situations`);
