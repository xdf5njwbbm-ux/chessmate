// Run: npm run test:phrases
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { describeMove, analyzeMove, type Level } from "./movePhrases.ts";
import { translit, speakable, syllables, compareWords } from "./russian.ts";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + name); };
const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

function play(sans: string[]) {
  const c = new Chess();
  return sans.map((s) => c.move(s));
}

test("e4 at every level", () => {
  const [m] = play(["e4"]);
  const out = LEVELS.map((level) => describeMove({ move: m, ply: 0, level, forms: "m", speaker: "me" }).phrase.ru);
  assert.equal(out[0], "Я двигаю пешку вперёд.");
  assert.equal(out[1], "Я хочу контролировать центр.");
  assert.match(out[2], /^Я поставил пешку в центр, потому что центр — самая важная часть доски\.$/);
  assert.equal(out[3], "Пешка на e4 контролирует ключевые поля d5 и f5 и освобождает дорогу слону и ферзю.");
});

test("feminine forms for the learner", () => {
  const [m] = play(["e4"]);
  assert.match(describeMove({ move: m, ply: 0, level: "B1", forms: "f", speaker: "me" }).phrase.ru, /^Я поставила пешку/);
});

test("black's center pawn controls d4 and f4", () => {
  const ms = play(["e4", "e5"]);
  assert.match(describeMove({ move: ms[1], ply: 1, level: "B2", forms: "m", speaker: "ai" }).phrase.ru, /ключевые поля d4 и f4/);
});

test("knight development uses instrumental / accusative correctly", () => {
  const ms = play(["d4", "d5", "Nf3"]);
  const m = ms[2];
  assert.equal(describeMove({ move: m, ply: 2, level: "A1", forms: "m", speaker: "me" }).phrase.ru, "Я хожу конём.");
  assert.equal(describeMove({ move: m, ply: 2, level: "A2", forms: "m", speaker: "me" }).phrase.ru, "Я вывожу коня.");
  assert.equal(describeMove({ move: m, ply: 2, level: "B1", forms: "m", speaker: "opponent" }).phrase.ru, "Соперник развивает коня, чтобы подготовить рокировку.");
});

test("captures, free piece and possessives", () => {
  const ms = play(["e4", "d5", "exd5"]);
  const m = ms[2];
  assert.equal(describeMove({ move: m, ply: 2, level: "A1", forms: "m", speaker: "me" }).phrase.ru, "Я беру твою пешку!");
  assert.equal(describeMove({ move: m, ply: 2, level: "A1", forms: "m", speaker: "opponent" }).phrase.ru, "Соперник берёт мою пешку!");
  assert.equal(describeMove({ move: m, ply: 2, level: "A2", forms: "f", speaker: "me" }).phrase.ru, "Я взяла твою пешку на d5.");
  assert.equal(analyzeMove(m, 2).captureWasFree, false); // the queen recaptures on d5
  assert.equal(describeMove({ move: m, ply: 2, level: "B1", forms: "m", speaker: "me" }).phrase.ru, "Я взял пешку. Посмотрим, будет ли размен.");
  const free = play(["e4", "f5", "exf5"])[2];
  assert.equal(analyzeMove(free, 2).captureWasFree, true);
  assert.equal(describeMove({ move: free, ply: 2, level: "B1", forms: "m", speaker: "me" }).phrase.ru, "Я взял пешку, потому что она была без защиты.");
});

test("check and capitalisation after an exclamation", () => {
  const ms = play(["e4", "f5", "Qh5+"]);
  const m = ms[2];
  assert.equal(describeMove({ move: m, ply: 2, level: "A1", forms: "m", speaker: "me" }).phrase.ru, "Шах! Шах королю!");
  assert.equal(describeMove({ move: m, ply: 2, level: "B2", forms: "m", speaker: "me" }).phrase.ru, "Шах! Королю соперника придётся искать укрытие.");
});

test("answering a check defends the king (spec examples)", () => {
  const ms = play(["e4", "f5", "Qh5+", "g6"]);
  const m = ms[3];
  assert.equal(describeMove({ move: m, ply: 3, level: "A1", forms: "m", speaker: "me" }).phrase.ru, "Я защищаю короля.");
  assert.equal(describeMove({ move: m, ply: 3, level: "B1", forms: "m", speaker: "me" }).phrase.ru, "Я решил защитить короля, потому что он находится под угрозой.");
  assert.equal(describeMove({ move: m, ply: 3, level: "B2", forms: "m", speaker: "me" }).phrase.ru,
    "Я предпочёл укрепить позицию короля, поскольку соперник начал создавать непосредственные угрозы.");
});

test("castling", () => {
  const ms = play(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]);
  const m = ms[6];
  assert.equal(describeMove({ move: m, ply: 6, level: "A1", forms: "m", speaker: "me" }).phrase.ru, "Я делаю рокировку.");
  assert.equal(describeMove({ move: m, ply: 6, level: "A2", forms: "f", speaker: "me" }).phrase.ru, "Я сделала короткую рокировку.");
  assert.match(describeMove({ move: m, ply: 6, level: "B2", forms: "m", speaker: "me" }).phrase.ru, /^Короткая рокировка позволяет мне увести короля/);
});

test("checkmate", () => {
  const ms = play(["f3", "e5", "g4", "Qh4#"]);
  const card = describeMove({ move: ms[3], ply: 3, level: "A2", forms: "m", speaker: "ai" });
  assert.equal(card.phrase.ru, "Это мат. Я выиграл!");
  assert.equal(card.prompt, undefined);
});

test("threats", () => {
  // white knight forks/attacks the queen: after 1.e4 d5 2.exd5 Qxd5 3.Nc3 the queen is attacked
  const ms = play(["e4", "d5", "exd5", "Qxd5", "Nc3"]);
  const card = describeMove({ move: ms[4], ply: 4, level: "A2", forms: "m", speaker: "me" });
  assert.equal(card.key, "threat");
  assert.equal(card.phrase.ru, "Я нападаю на твоего ферзя.");
  assert.equal(describeMove({ move: ms[4], ply: 4, level: "B1", forms: "m", speaker: "opponent" }).phrase.ru, "Соперник напал на ферзя, и мне нужно его защитить.");
});

test("AI card has reaction, plan and prompt", () => {
  const ms = play(["e4", "e5"]);
  const card = describeMove({ move: ms[1], ply: 1, level: "A2", forms: "f", speaker: "ai", reactionToPrevious: "best" });
  assert.equal(card.reaction?.ru, "Хороший ход! Я не ожидал.");
  assert.equal(card.plan?.ru, "Я буду защищать центр.");
  assert.equal(card.prompt?.ru, "Теперь твой ход.");
});

test("human opponent card asks a question at A2+", () => {
  const ms = play(["e4", "e5"]);
  const card = describeMove({ move: ms[1], ply: 1, level: "A2", forms: "m", speaker: "opponent" });
  assert.equal(card.question?.ru, "Почему соперник сделал этот ход?");
});

test("every word in every phrase has a gloss", () => {
  const games = [
    ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O", "h3", "Nb8", "d4", "Nbd7"],
    ["d4", "d5", "c4", "e6", "Nc3", "Nf6", "Bg5", "Be7", "e3", "O-O", "Nf3", "h6", "Bh4", "b6", "cxd5", "Nxd5", "Bxe7", "Qxe7", "Nxd5", "exd5"],
    ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "Be3", "e5", "Nb3", "Be6", "f3", "Be7", "Qd2", "O-O", "O-O-O", "Nbd7", "g4", "b5", "g5", "b4", "Ne2", "Ne8", "f4", "a5", "f5", "a4"],
    ["e4", "e5", "Bc4", "Nc6", "Qh5", "Nf6", "Qxf7#"],
  ];
  let cards = 0;
  for (const g of games) {
    const ms = play(g);
    ms.forEach((m, i) => {
      for (const level of LEVELS) for (const speaker of ["me", "ai", "opponent"] as const) {
        const card = describeMove({ move: m, ply: i, level, forms: i % 2 ? "f" : "m", speaker, reactionToPrevious: "mistake" });
        for (const ph of [card.phrase, card.reaction, card.plan, card.question, card.prompt]) {
          if (!ph) continue;
          for (const w of ph.words) assert.ok(w.en, `no gloss for "${w.ru}" in "${ph.ru}"`);
          assert.ok(!/\s[,.!?]/.test(ph.ru), `spacing: ${ph.ru}`);
          assert.ok(/^[А-ЯЁ]/.test(ph.ru), `capital: ${ph.ru}`);
        }
        cards++;
      }
    });
  }
  console.log(`    (${cards} cards checked)`);
});

test("translit, speakable, syllables, word comparison", () => {
  assert.equal(translit("Привет! Как дела?"), "Privet! Kak dela?");
  assert.equal(translit("ещё ёлка"), "yeshchyo yolka");
  assert.equal(translit("конь"), "kon'");
  assert.equal(speakable("Пешка на e4."), "Пешка на е-четыре.");
  assert.deepEqual(syllables("пешка"), ["пе", "шка"]);
  assert.deepEqual(syllables("карта"), ["кар", "та"]);
  assert.deepEqual(syllables("молоко"), ["мо", "ло", "ко"]);
  const r = compareWords("Я хочу пить.", "я хочу пить");
  assert.ok(r.every((x) => x.ok));
  assert.deepEqual(compareWords("Я хочу пить", "я хочу есть").map((x) => x.ok), [true, true, false]);
});

console.log(`\n${passed} phrase tests passed`);
