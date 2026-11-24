// Run: npm run test:talk — checks the generated conversation bank and the linking-word helper.
import assert from "node:assert/strict";
import fs from "node:fs";
import { CONNECTORS, connectorsIn } from "./connectors.ts";

type Side = { ru: string; ruF?: string; en: string; speaker?: string; words: { ru: string; en: string }[] };
type X = { id: string; lesson: string; level: string; q: Side; a: Side; note: string; follow: { ru: string; en: string; link?: string }[]; next: string | null; connectors: string[] };
const bank = JSON.parse(fs.readFileSync(new URL("../generated/talk.json", import.meta.url), "utf8")) as { connectors: { ru: string }[]; exchanges: X[] };
const xs = bank.exchanges;
const ids = new Set(xs.map((x) => x.id));

assert.ok(xs.length >= 100, `at least 100 questions (got ${xs.length})`);
const a1 = xs.filter((x) => x.level === "A1").length;
const a2 = xs.filter((x) => x.level === "A2").length;
assert.ok(a1 >= 40 && a2 >= 40, `a real balance of A1 (${a1}) and A2 (${a2})`);
assert.deepEqual(bank.connectors.map((c) => c.ru), CONNECTORS.map((c) => c.ru), "the app's linking words match the build's");

const questions = new Set<string>();
for (const x of xs) {
  assert.ok(x.q.ru.endsWith("?"), `${x.id}: question ends with ?`);
  assert.ok(!questions.has(x.q.ru), `${x.id}: duplicate question`);
  questions.add(x.q.ru);
  assert.ok(x.note.length > 20, `${x.id}: grammar note`);
  assert.ok(x.follow.length + (x.next ? 1 : 0) >= 2, `${x.id}: at least two ways to continue`);
  for (const side of [x.q, x.a]) {
    assert.ok(side.en && side.words.length, `${x.id}: translation and word glosses`);
    for (const w of side.words) if (/[а-яё]/i.test(w.ru)) assert.ok(w.en, `${x.id}: gloss for «${w.ru}»`);
    if (side.ruF) assert.equal(side.ruF.split(" ").length, side.ru.split(" ").length, `${x.id}: feminine form lines up word for word`);
  }
  if (x.next) assert.ok(ids.has(x.next), `${x.id}: next exists`);
  for (const f of x.follow) {
    assert.ok(f.ru.endsWith("?") && f.en.endsWith("?"), `${x.id}: follow-up is a question`);
    if (f.link) assert.ok(ids.has(f.link) && f.link !== x.id, `${x.id}: follow-up link resolves`);
  }
  assert.deepEqual(x.connectors, connectorsIn(x.a.ru).map((c) => c.ru), `${x.id}: linking words detected the same way`);
}
// every conversation is a chain: :1 → :2 → … with no gaps
for (const lesson of new Set(xs.map((x) => x.lesson))) {
  const chain = xs.filter((x) => x.lesson === lesson);
  chain.forEach((x, k) => {
    assert.equal(x.id, `${lesson}:${k + 1}`);
    assert.equal(x.next, k < chain.length - 1 ? `${lesson}:${k + 2}` : null, `${x.id}: chain`);
  });
}
for (const c of CONNECTORS) assert.ok(xs.filter((x) => x.connectors.includes(c.ru)).length >= 2, `«${c.ru}» taught at least twice`);
assert.ok(xs.reduce((n, x) => n + x.follow.filter((f) => f.link).length, 0) >= 20, "conversations link into each other");

// linking-word detection: whole words only, stress marks and ё ignored
assert.deepEqual(connectorsIn("Потому что здесь тепло.").map((c) => c.ru), ["потому что"]);
assert.deepEqual(connectorsIn("Потом я иду домой."), [{ ru: "потом", en: "then" }]);
assert.deepEqual(connectorsIn("С одно́й стороны́, да, а с другой стороны — нет.").map((c) => c.ru), ["с одной стороны", "с другой стороны"]);
assert.equal(connectorsIn("Хотите чаю?").length, 0, "хотите is not хотя");

console.log(`talk bank ok: ${xs.length} questions (A1 ${a1}, A2 ${a2})`);
