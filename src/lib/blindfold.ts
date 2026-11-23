// Blindfold chess: difficulty levels, move announcements in Russian (pitched
// at the learner's A1–B2 level) and English, position descriptions, and the
// accuracy measure used for training stats. Pure functions, no I/O.
import { Chess, type Move, type Square } from "chess.js";
import type { Level } from "./types";

export type BlindLevel = "beginner" | "intermediate" | "advanced" | "expert" | "master";

export const BLIND_LEVELS: { id: BlindLevel; label: string; hint: string }[] = [
  { id: "beginner", label: "Beginner", hint: "The opponent's from- and to-squares light up, every move is written out and spoken, and checks are highlighted." },
  { id: "intermediate", label: "Intermediate", hint: "Only the destination square lights up. Moves are written out and spoken." },
  { id: "advanced", label: "Advanced", hint: "No highlights. Moves are announced in notation and spoken." },
  { id: "expert", label: "Expert", hint: "Nothing on screen unless you ask. Moves are spoken." },
  { id: "master", label: "Master", hint: "Spoken announcements only. No written help." },
];
export const blindLevelLabel = (l: string) => BLIND_LEVELS.find((x) => x.id === l)?.label ?? l;

export type LevelCaps = {
  /** Which of the opponent's squares are highlighted. */
  highlight: "both" | "to" | "none";
  /** Written announcement shown automatically: full sentence, notation only, or nothing. */
  text: "full" | "notation" | "none";
  /** The move list under the board. */
  moveList: boolean;
  /** Highlight the king in check. */
  check: boolean;
  /** Written aids (describe position, legal moves, last move text) available on request. */
  writtenAids: boolean;
  /** Extra coaching lines ("your turn", captures, threats on the king). */
  extra: boolean;
};

export const CAPS: Record<BlindLevel, LevelCaps> = {
  beginner: { highlight: "both", text: "full", moveList: true, check: true, writtenAids: true, extra: true },
  intermediate: { highlight: "to", text: "full", moveList: true, check: false, writtenAids: true, extra: false },
  advanced: { highlight: "none", text: "notation", moveList: true, check: false, writtenAids: true, extra: false },
  expert: { highlight: "none", text: "none", moveList: false, check: false, writtenAids: true, extra: false },
  master: { highlight: "none", text: "none", moveList: false, check: false, writtenAids: false, extra: false },
};

type Forms = { nom: string; acc: string; ins: string; g: "m" | "f"; en: string; plural: string; enPlural: string };
const P: Record<string, Forms> = {
  p: { nom: "пешка", acc: "пешку", ins: "пешкой", g: "f", en: "pawn", plural: "пешки", enPlural: "pawns" },
  n: { nom: "конь", acc: "коня", ins: "конём", g: "m", en: "knight", plural: "кони", enPlural: "knights" },
  b: { nom: "слон", acc: "слона", ins: "слоном", g: "m", en: "bishop", plural: "слоны", enPlural: "bishops" },
  r: { nom: "ладья", acc: "ладью", ins: "ладьёй", g: "f", en: "rook", plural: "ладьи", enPlural: "rooks" },
  q: { nom: "ферзь", acc: "ферзя", ins: "ферзём", g: "m", en: "queen", plural: "ферзи", enPlural: "queens" },
  k: { nom: "король", acc: "короля", ins: "королём", g: "m", en: "king", plural: "короли", enPlural: "kings" },
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What a move does, in a form the announcement builders share. */
function facts(m: Move) {
  const castle = m.flags.includes("k") ? "short" : m.flags.includes("q") ? "long" : null;
  const after = new Chess(m.after);
  return {
    piece: P[m.piece],
    captured: m.captured ? P[m.captured] : null,
    promoted: m.promotion ? P[m.promotion] : null,
    castle,
    mate: after.isCheckmate(),
    check: after.inCheck() && !after.isCheckmate(),
    white: m.color === "w",
  };
}

/** The opponent's (or any side's) move, third person, at the learner's Russian level. */
export function announceRu(m: Move, level: Level): string {
  const f = facts(m);
  const side = f.white ? "Белые" : "Чёрные";
  const adj = (g: "m" | "f") => (f.white ? (g === "f" ? "Белая" : "Белый") : g === "f" ? "Чёрная" : "Чёрный");
  const past = (g: "m" | "f", m_: string, f_: string) => (g === "f" ? f_ : m_);
  let s: string;
  if (f.castle) {
    const kind = f.castle === "short" ? "короткую" : "длинную";
    s = level === "A1" ? "Рокировка."
      : level === "A2" ? `${side} делают рокировку.`
      : level === "B1" ? `${side} сделали ${kind} рокировку.`
      : `${side} рокировались в ${f.castle === "short" ? "короткую" : "длинную"} сторону.`;
  } else if (f.promoted) {
    s = level === "A1" ? `Пешка на ${m.to}. ${cap(f.promoted.nom)}!`
      : level === "A2" ? `Пешка идёт на ${m.to} и становится ${f.promoted.ins}.`
      : level === "B1" ? `Пешка дошла до ${m.to} и стала ${f.promoted.ins}.`
      : `${side} провели пешку на ${m.to} и превратили её в ${f.promoted.acc}.`;
    if (f.captured) s = s.replace(/\.$/, `, взяв ${f.captured.acc}.`);
  } else if (f.captured) {
    s = level === "A1" ? `${cap(f.piece.nom)} берёт на ${m.to}.`
      : level === "A2" ? `${cap(f.piece.nom)} берёт ${f.captured.acc} на ${m.to}.`
      : level === "B1" ? `${adj(f.piece.g)} ${f.piece.nom} ${past(f.piece.g, "взял", "взяла")} ${f.captured.acc} на ${m.to}.`
      : `${side} взяли ${f.piece.ins} ${f.captured.acc} на ${m.to}.`;
  } else {
    s = level === "A1" ? `${cap(f.piece.nom)} на ${m.to}.`
      : level === "A2" ? `${cap(f.piece.nom)} идёт на ${m.to}.`
      : level === "B1" ? `${adj(f.piece.g)} ${f.piece.nom} ${past(f.piece.g, "пошёл", "пошла")} с ${m.from} на ${m.to}.`
      : `${side} сыграли ${f.piece.ins} с ${m.from} на ${m.to}.`;
  }
  if (f.mate) s += " Мат!";
  else if (f.check) s += " Шах!";
  return s;
}

/** Your own move in the first person — the sentence to practise saying aloud. */
export function myMoveRu(m: Move): string {
  const f = facts(m);
  let s: string;
  if (f.castle) s = f.castle === "short" ? "Я рокируюсь." : "Я делаю длинную рокировку.";
  else if (f.promoted) s = `Пешка идёт на ${m.to} и становится ${f.promoted.ins}.`;
  else if (f.captured) s = `Я беру ${f.captured.acc} на ${m.to}.`;
  else s = `Я хожу ${f.piece.ins} на ${m.to}.`;
  if (f.mate) s += " Мат!";
  else if (f.check) s += " Шах!";
  return s;
}

export function announceEn(m: Move): string {
  const f = facts(m);
  const side = f.white ? "White" : "Black";
  let s: string;
  if (f.castle) s = `${side} castled ${f.castle === "short" ? "kingside" : "queenside"}.`;
  else {
    s = `${side} moved the ${f.piece.en} from ${m.from} to ${m.to}`;
    if (f.captured) s += ` and took the ${f.captured.en}`;
    if (f.promoted) s += ` and promoted to a ${f.promoted.en}`;
    s += ".";
  }
  if (f.mate) s += " Checkmate!";
  else if (f.check) s += " Check!";
  return s;
}

/** Short English form used for notation-level text: "Black: Nf6 (g8 → f6)". */
export function notationLine(m: Move): string {
  return `${m.color === "w" ? "White" : "Black"}: ${m.san}`;
}

const RU_FILES: Record<string, string> = { a: "а", b: "бэ", c: "цэ", d: "дэ", e: "е", f: "эф", g: "жэ", h: "аш" };
const RU_RANKS = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь"];
/** Russian text with board squares spelled out so a Russian voice reads them correctly («эф три»). */
export function speakableRu(text: string): string {
  return text.replace(/\b([a-h])([1-8])\b/g, (_, f: string, r: string) => `${RU_FILES[f]} ${RU_RANKS[+r]}`);
}

const ORDER = ["k", "q", "r", "b", "n", "p"];
function pieceGroups(chess: Chess, color: "w" | "b") {
  const by: Record<string, string[]> = {};
  for (const row of chess.board()) for (const sq of row) if (sq && sq.color === color) (by[sq.type] ??= []).push(sq.square);
  for (const k in by) by[k].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  return ORDER.filter((t) => by[t]?.length).map((t) => ({ t, squares: by[t] }));
}

/** Every piece on the board, in English and Russian, side to move first. */
export function describePosition(fen: string): { en: string; ru: string } {
  const chess = new Chess(fen);
  const side = (c: "w" | "b") => {
    const g = pieceGroups(chess, c);
    return {
      en: g.map(({ t, squares }) => `${squares.length > 1 ? P[t].enPlural : P[t].en} ${squares.join(", ")}`).join("; "),
      ru: g.map(({ t, squares }) => `${squares.length > 1 ? P[t].plural : P[t].nom} ${squares.join(", ")}`).join("; "),
    };
  };
  const w = side("w");
  const b = side("b");
  const turnEn = chess.turn() === "w" ? "White to move." : "Black to move.";
  const turnRu = chess.turn() === "w" ? "Ход белых." : "Ход чёрных.";
  return {
    en: `${turnEn} White: ${w.en}. Black: ${b.en}.${chess.inCheck() ? " The king is in check." : ""}`,
    ru: `${turnRu} Белые: ${w.ru}. Чёрные: ${b.ru}.${chess.inCheck() ? " Шах!" : ""}`,
  };
}

/** The side to move's legal moves in notation, grouped by piece. */
export function legalMoveGroups(fen: string): { piece: string; moves: string[] }[] {
  const chess = new Chess(fen);
  const by = new Map<string, string[]>();
  for (const m of chess.moves({ verbose: true })) {
    const key = `${cap(P[m.piece].en)} ${m.from}`;
    by.set(key, [...(by.get(key) ?? []), m.san]);
  }
  return [...by.entries()]
    .sort((a, b) => ORDER.indexOf(chess.get(a[0].slice(-2) as Square)!.type) - ORDER.indexOf(chess.get(b[0].slice(-2) as Square)!.type) || a[0].localeCompare(b[0]))
    .map(([piece, moves]) => ({ piece, moves }));
}

/** Win chance (0–100) for a centipawn score, as used by common accuracy measures. */
export const winPct = (cp: number) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp)))) - 1);

/** Accuracy (0–100) of one move from the mover's evaluation before and the opponent's after. */
export function moveAccuracy(beforeForMover: number, afterForOpponent: number): number {
  const drop = Math.max(0, winPct(beforeForMover) - winPct(-afterForOpponent));
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
}
