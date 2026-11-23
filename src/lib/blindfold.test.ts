// Run: npm run test:blindfold
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { announceRu, announceEn, myMoveRu, speakableRu, describePosition, legalMoveGroups, moveAccuracy } from "./blindfold.ts";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log("  ✓ " + name); };
const play = (sans: string[]) => { const c = new Chess(); return sans.map((s) => c.move(s)); };

test("quiet moves at every level", () => {
  const [, e5] = play(["e4", "e5"]);
  assert.equal(announceRu(e5, "A1"), "Пешка на e5.");
  assert.equal(announceRu(e5, "A2"), "Пешка идёт на e5.");
  assert.equal(announceRu(e5, "B1"), "Чёрная пешка пошла с e7 на e5.");
  assert.equal(announceRu(e5, "B2"), "Чёрные сыграли пешкой с e7 на e5.");
  assert.equal(announceEn(e5), "Black moved the pawn from e7 to e5.");
  const [nf3] = play(["Nf3"]);
  assert.equal(announceRu(nf3, "B1"), "Белый конь пошёл с g1 на f3.");
  assert.equal(myMoveRu(nf3), "Я хожу конём на f3.");
});

test("captures, checks, mate, castling, promotion", () => {
  const ms = play(["e4", "d5", "exd5"]);
  assert.equal(announceRu(ms[2], "A1"), "Пешка берёт на d5.");
  assert.equal(announceRu(ms[2], "A2"), "Пешка берёт пешку на d5.");
  assert.equal(announceRu(ms[2], "B1"), "Белая пешка взяла пешку на d5.");
  assert.equal(myMoveRu(ms[2]), "Я беру пешку на d5.");
  const mate = play(["f3", "e5", "g4", "Qh4#"]);
  assert.equal(announceRu(mate[3], "A1"), "Ферзь на h4. Мат!");
  assert.match(announceEn(mate[3]), /Checkmate!$/);
  const chk = play(["e4", "f6", "Qh5+"]);
  assert.equal(announceRu(chk[2], "A2"), "Ферзь идёт на h5. Шах!");
  const castle = play(["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "O-O"]);
  assert.equal(announceRu(castle[6], "A1"), "Рокировка.");
  assert.equal(announceRu(castle[6], "B1"), "Белые сделали короткую рокировку.");
  assert.equal(myMoveRu(castle[6]), "Я рокируюсь.");
  assert.equal(announceEn(castle[6]), "White castled kingside.");
  const c = new Chess("8/P6k/8/8/8/8/8/K7 w - - 0 1");
  const promo = c.move("a8=Q");
  assert.equal(announceRu(promo, "A2"), "Пешка идёт на a8 и становится ферзём.");
  assert.match(announceEn(promo), /promoted to a queen/);
});

test("speakable squares, position, legal moves, accuracy", () => {
  assert.equal(speakableRu("Конь на f3."), "Конь на эф три.");
  const d = describePosition(new Chess().fen());
  assert.match(d.en, /^White to move\. White: king e1; queen d1; rooks a1, h1;/);
  assert.match(d.ru, /Белые: король e1; ферзь d1; ладьи a1, h1;/);
  const g = legalMoveGroups(new Chess().fen());
  assert.equal(g.reduce((n, x) => n + x.moves.length, 0), 20);
  assert.equal(g[0].piece, "Knight b1");
  assert.ok(moveAccuracy(30, -30) > 99);
  assert.ok(moveAccuracy(30, 300) < 40);
});

console.log(`\n${passed} blindfold tests passed`);
