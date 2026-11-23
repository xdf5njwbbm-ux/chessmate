// Turns every chess move into a short, level-appropriate Russian lesson.
// Pure functions: no React, no I/O. Tested in movePhrases.test.ts.
import { Chess, type Move, type Square } from "chess.js";

export type Level = "A1" | "A2" | "B1" | "B2";
export type Forms = "m" | "f";
export type Speaker = "me" | "ai" | "opponent";
export type Word = { ru: string; en: string };
export type Phrase = { ru: string; en: string; words: Word[] };
export type VocabItem = { ru: string; stressed: string; en: string };
export type Reaction = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export type MoveCard = {
  key: string;
  speaker: Speaker;
  level: Level;
  phrase: Phrase;
  reaction?: Phrase;   // AI's comment on the learner's previous move
  plan?: Phrase;       // AI's stated plan ("Я буду защищать центр.")
  question?: Phrase;   // a question about the opponent's move (A2+)
  prompt?: Phrase;     // "Твой ход!"
  vocab: VocabItem[];
  grammar?: { title: string; body: string };
  exercise?: { before: string; after: string; answer: string; options: string[]; en: string };
};

// ---------------------------------------------------------------- pieces
type PieceForms = {
  nom: string; acc: string; gen: string; ins: string; dat: string;
  g: "m" | "f"; en: string; stressed: string;
};
const PIECES: Record<string, PieceForms> = {
  p: { nom: "пешка", acc: "пешку", gen: "пешки", ins: "пешкой", dat: "пешке", g: "f", en: "pawn", stressed: "пе́шка" },
  n: { nom: "конь", acc: "коня", gen: "коня", ins: "конём", dat: "коню", g: "m", en: "knight", stressed: "конь" },
  b: { nom: "слон", acc: "слона", gen: "слона", ins: "слоном", dat: "слону", g: "m", en: "bishop", stressed: "слон" },
  r: { nom: "ладья", acc: "ладью", gen: "ладьи", ins: "ладьёй", dat: "ладье", g: "f", en: "rook", stressed: "ладья́" },
  q: { nom: "ферзь", acc: "ферзя", gen: "ферзя", ins: "ферзём", dat: "ферзю", g: "m", en: "queen", stressed: "ферзь" },
  k: { nom: "король", acc: "короля", gen: "короля", ins: "королём", dat: "королю", g: "m", en: "king", stressed: "коро́ль" },
};
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// possessives that agree with the piece (accusative is animate for masculine pieces)
const MY_ACC = (p: PieceForms) => (p.g === "m" ? "моего" : "мою");
const YOUR_ACC = (p: PieceForms) => (p.g === "m" ? "твоего" : "твою");
const HE_SHE = (p: PieceForms) => (p.g === "m" ? "он" : "она");
const HIM_HER = (p: PieceForms) => (p.g === "m" ? "его" : "её");
const WAS = (p: PieceForms) => (p.g === "m" ? "был" : "была");

const VOCAB: Record<string, VocabItem> = {
  ходить: { ru: "ходить", stressed: "ходи́ть", en: "to move (a piece)" },
  двигать: { ru: "двигать", stressed: "дви́гать", en: "to move, to push" },
  вперёд: { ru: "вперёд", stressed: "вперёд", en: "forward" },
  брать: { ru: "брать", stressed: "брать", en: "to take, to capture" },
  взять: { ru: "взять", stressed: "взять", en: "to take (perfective)" },
  шах: { ru: "шах", stressed: "шах", en: "check" },
  мат: { ru: "мат", stressed: "мат", en: "checkmate" },
  рокировка: { ru: "рокировка", stressed: "рокиро́вка", en: "castling" },
  короткая: { ru: "короткая рокировка", stressed: "коро́ткая рокиро́вка", en: "kingside castling" },
  длинная: { ru: "длинная рокировка", stressed: "дли́нная рокиро́вка", en: "queenside castling" },
  центр: { ru: "центр", stressed: "центр", en: "center" },
  контролировать: { ru: "контролировать", stressed: "контроли́ровать", en: "to control" },
  защищать: { ru: "защищать", stressed: "защища́ть", en: "to protect, to defend" },
  защитить: { ru: "защитить", stressed: "защити́ть", en: "to protect (perfective)" },
  напасть: { ru: "напасть", stressed: "напа́сть", en: "to attack" },
  нападать: { ru: "нападать", stressed: "напада́ть", en: "to attack" },
  выводить: { ru: "выводить", stressed: "выводи́ть", en: "to bring out, to develop" },
  развивать: { ru: "развивать", stressed: "развива́ть", en: "to develop" },
  превращаться: { ru: "превращаться", stressed: "превраща́ться", en: "to turn into" },
  становиться: { ru: "становиться", stressed: "станови́ться", en: "to become" },
  проход: { ru: "на проходе", stressed: "на прохо́де", en: "en passant" },
  отступать: { ru: "отступать", stressed: "отступа́ть", en: "to retreat" },
  угроза: { ru: "угроза", stressed: "угро́за", en: "threat" },
  безопасность: { ru: "безопасность", stressed: "безопа́сность", en: "safety" },
  преимущество: { ru: "преимущество", stressed: "преиму́щество", en: "advantage" },
  соперник: { ru: "соперник", stressed: "сопе́рник", en: "opponent" },
  ход: { ru: "ход", stressed: "ход", en: "move, turn" },
  ошибка: { ru: "ошибка", stressed: "оши́бка", en: "mistake" },
  пат: { ru: "пат", stressed: "пат", en: "stalemate" },
  ничья: { ru: "ничья", stressed: "ничья́", en: "draw" },
  поле: { ru: "поле", stressed: "по́ле", en: "square" },
  размен: { ru: "размен", stressed: "разме́н", en: "exchange (of pieces)" },
};

// ---------------------------------------------------------------- phrase builder
type Tok = [string, string]; // [russian, gloss]
function phrase(en: string, ...toks: (Tok | null | false | undefined)[]): Phrase {
  const words = toks.filter(Boolean) as Tok[];
  let ru = "";
  let capNext = true;
  const out: Word[] = [];
  for (const [w, e] of words) {
    const word = capNext && /\p{L}/u.test(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    if (!ru) ru = word;
    else if (/^[\s,.!?:;…]/.test(word)) ru += word;
    else ru += " " + word;
    if (/\p{L}|\p{N}/u.test(word)) {
      out.push({ ru: word, en: e });
      capNext = false;
    }
    if (/[.!?]$/.test(word)) capNext = true;
  }
  return { ru, en, words: out };
}
const P = (s: string): Tok => [s, ""]; // punctuation
const g = (forms: Forms, m: string, f: string) => (forms === "f" ? f : m);

// ---------------------------------------------------------------- analysis
export type MoveFacts = {
  move: Move;
  piece: PieceForms;
  captured?: PieceForms;
  promoted?: PieceForms;
  check: boolean;
  mate: boolean;
  stalemate: boolean;
  draw: boolean;
  castle?: "short" | "long";
  enPassant: boolean;
  wasInCheck: boolean;
  development: boolean;
  centerPawn: boolean;
  retreat: boolean;
  materialAfter: number; // from the mover's point of view
  materialBefore: number;
  captureWasFree: boolean; // captured piece could not be recaptured
  threat?: { square: Square; piece: PieceForms };
  pawnControls: string[];
  opensLines: boolean;
  canCastle: boolean; // the mover still has castling rights
};

function material(fen: string, color: "w" | "b"): number {
  let d = 0;
  for (const ch of fen.split(" ")[0]) {
    const v = VALUE[ch.toLowerCase()];
    if (v === undefined) continue;
    d += (ch === ch.toUpperCase()) === (color === "w") ? v : -v;
  }
  return d;
}

export function analyzeMove(move: Move, ply: number): MoveFacts {
  const before = new Chess(move.before);
  const after = new Chess(move.after);
  const me = move.color;
  const them = me === "w" ? "b" : "w";
  const piece = PIECES[move.piece];
  const fromRank = +move.from[1];
  const toRank = +move.to[1];
  const homeRank = me === "w" ? 1 : 8;

  let threat: MoveFacts["threat"];
  if (!after.isCheckmate()) {
    let best = -1;
    for (const row of after.board()) {
      for (const sq of row) {
        if (!sq || sq.color !== them || sq.type === "k") continue;
        if (!after.attackers(sq.square, me).includes(move.to as Square)) continue;
        const defended = after.attackers(sq.square, them).length > 0;
        const worth = VALUE[sq.type];
        if ((!defended || worth > VALUE[move.piece]) && worth > best) {
          best = worth;
          threat = { square: sq.square, piece: PIECES[sq.type] };
        }
      }
    }
  }

  const pawnControls: string[] = [];
  if (move.piece === "p") {
    const dir = me === "w" ? 1 : -1;
    const r = toRank + dir;
    for (const df of [-1, 1]) {
      const f = String.fromCharCode(move.to.charCodeAt(0) + df);
      if (f >= "a" && f <= "h" && r >= 1 && r <= 8) pawnControls.push(f + r);
    }
  }

  return {
    move,
    piece,
    captured: move.captured ? PIECES[move.captured] : undefined,
    promoted: move.promotion ? PIECES[move.promotion] : undefined,
    check: after.inCheck(),
    mate: after.isCheckmate(),
    stalemate: after.isStalemate(),
    draw: after.isDraw() && !after.isStalemate(),
    castle: move.isKingsideCastle() ? "short" : move.isQueensideCastle() ? "long" : undefined,
    enPassant: move.isEnPassant(),
    wasInCheck: before.inCheck(),
    development: (move.piece === "n" || move.piece === "b") && fromRank === homeRank && ply < 24 && !move.captured,
    centerPawn: move.piece === "p" && ["d4", "e4", "d5", "e5"].includes(move.to) && !move.captured,
    retreat: !move.captured && move.piece !== "p" && move.piece !== "k" && (me === "w" ? toRank < fromRank : toRank > fromRank),
    materialAfter: material(move.after, me),
    materialBefore: material(move.before, me),
    captureWasFree: !!move.captured && after.attackers(move.to as Square, them).length === 0,
    threat,
    pawnControls,
    opensLines: move.piece === "p" && ["d2", "e2", "d7", "e7"].includes(move.from),
    canCastle: /[KQ]/.test(move.before.split(" ")[2]) && me === "w" || /[kq]/.test(move.before.split(" ")[2]) && me === "b",
  };
}

// ---------------------------------------------------------------- sentences
// Subject + verb for the three speakers. "me" and "ai" speak in the first
// person; a human opponent is described in the third person (соперник).
type Ctx = { f: MoveFacts; level: Level; forms: Forms; speaker: Speaker; ply: number };

function subj(c: Ctx): Tok {
  return c.speaker === "opponent" ? ["соперник", "my_opponent"] : ["я", "I"];
}
function present(c: Ctx, first: [string, string], third: [string, string]): Tok {
  return c.speaker === "opponent" ? third : first;
}
/** Past tense: the learner uses their chosen forms; the AI is masculine; соперник is masculine. */
function past(c: Ctx, m: string, f: string, en: string): Tok {
  return [c.speaker === "me" ? g(c.forms, m, f) : m, en];
}
const who = (c: Ctx, en1: string, en3: string) => (c.speaker === "opponent" ? en3 : en1);
const sq = (s: string): Tok => [s, s];

function variant<T>(c: Ctx, list: T[]): T {
  return list[c.ply % list.length];
}

function describe(c: Ctx): { key: string; phrase: Phrase; vocab: string[] } {
  const { f, level } = c;
  const p = f.piece;
  const to = f.move.to;

  // ---- game-ending moves
  if (f.mate) {
    const byLevel: Record<Level, Phrase> = {
      A1: phrase("Checkmate!", ["Шах", "check"], ["и", "and"], ["мат", "mate"], P("!")),
      A2: phrase(who(c, "It's checkmate. I won!", "It's checkmate. My opponent won."),
        ["это", "this_is"], ["мат", "checkmate"], P("."),
        subj(c), past(c, "выиграл", "выиграла", "won"), P("!")),
      B1: phrase("It's checkmate — the king has no moves left.",
        ["это", "this_is"], ["мат", "checkmate"], P(" —"), ["у", "by"], ["короля", "the_king"], ["больше", "anymore"], ["нет", "there_are_no"], ["ходов", "moves"], P(".")),
      B2: phrase("Checkmate. The game is over: the king can't escape the threat.",
        ["мат", "checkmate"], P("."), ["партия", "the_game"], ["окончена", "is_over"], P(":"), ["король", "the_king"], ["не", "not"], ["может", "can"], ["избежать", "escape"], ["угрозы", "the_threat"], P(".")),
    };
    return { key: "mate", phrase: byLevel[level], vocab: ["мат", "шах"] };
  }
  if (f.stalemate) {
    return {
      key: "stalemate",
      phrase: level === "A1"
        ? phrase("Stalemate! It's a draw.", ["пат", "stalemate"], P("!"), ["ничья", "draw"], P("."))
        : phrase("It's stalemate: the king isn't in check, but it has no moves. It's a draw.",
          ["это", "this_is"], ["пат", "stalemate"], P(":"), ["король", "the_king"], ["не", "not"], ["под", "under"], ["шахом", "check"], P(","), ["но", "but"], ["у", "by"], ["него", "him"], ["нет", "there_are_no"], ["ходов", "moves"], P("."), ["ничья", "draw"], P(".")),
      vocab: ["пат", "ничья"],
    };
  }

  // ---- castling
  if (f.castle) {
    const short = f.castle === "short";
    const kind: Tok = short ? ["короткую", "short"] : ["длинную", "long"];
    const kindEn = short ? "kingside" : "queenside";
    const byLevel: Record<Level, Phrase> = {
      A1: phrase(who(c, "I'm castling.", "My opponent is castling."), subj(c), present(c, ["делаю", "make"], ["делает", "makes"]), ["рокировку", "castling"], P(".")),
      A2: phrase(who(c, `I castled ${kindEn}.`, `My opponent castled ${kindEn}.`), subj(c), past(c, "сделал", "сделала", "made"), kind, ["рокировку", "castling"], P(".")),
      B1: phrase(who(c, "I castled to hide my king.", "My opponent castled to hide his king."),
        subj(c), past(c, "сделал", "сделала", "made"), ["рокировку", "castling"], P(","), ["чтобы", "in_order_to"], ["спрятать", "hide"], ["короля", "the_king"], P(".")),
      B2: phrase(`${short ? "Kingside" : "Queenside"} castling lets ${who(c, "me", "my opponent")} tuck the king away and bring the rook into play.`,
        [short ? "короткая" : "длинная", short ? "short" : "long"], ["рокировка", "castling"], ["позволяет", "allows"], c.speaker === "opponent" ? ["сопернику", "the_opponent"] : ["мне", "me"],
        ["увести", "to_lead_away"], ["короля", "the_king"], ["в", "to"], ["безопасное", "a_safe"], ["место", "place"], ["и", "and"], ["подключить", "to_bring_in"], ["ладью", "the_rook"], ["к", "to"], ["игре", "the_game"], P(".")),
    };
    return { key: "castle", phrase: byLevel[level], vocab: ["рокировка", short ? "короткая" : "длинная", "безопасность"] };
  }

  // ---- promotion
  if (f.promoted) {
    const np = f.promoted;
    const byLevel: Record<Level, Phrase> = {
      A1: phrase(`The pawn becomes a ${np.en}!`, ["пешка", "the_pawn"], ["становится", "becomes"], [np.ins, `a_${np.en}`], P("!")),
      A2: phrase(`The pawn reached the end of the board and became a ${np.en}.`,
        ["пешка", "the_pawn"], ["дошла", "reached"], ["до", "to"], ["конца", "the_end"], ["доски", "of_the_board"], ["и", "and"], ["стала", "became"], [np.ins, `a_${np.en}`], P(".")),
      B1: phrase(who(c, `I'm promoting my pawn to a ${np.en}.`, `My opponent is promoting a pawn to a ${np.en}.`),
        subj(c), present(c, ["превращаю", "turn"], ["превращает", "turns"]), ["пешку", "the_pawn"], ["в", "into"], [np.acc, `a_${np.en}`], P(".")),
      B2: phrase(`The pawn turns into a ${np.en}, completely changing the balance of power on the board.`,
        ["пешка", "the_pawn"], ["превращается", "turns"], ["в", "into"], [np.acc, `a_${np.en}`], P(","), ["полностью", "completely"], ["меняя", "changing"], ["соотношение", "the_balance"], ["сил", "of_power"], ["на", "on"], ["доске", "the_board"], P(".")),
    };
    return { key: "promotion", phrase: byLevel[level], vocab: ["превращаться", "становиться"] };
  }

  // ---- defending the king after a check
  if (f.wasInCheck) {
    const byLevel: Record<Level, Phrase> = {
      A1: phrase(who(c, "I'm protecting the king.", "My opponent is protecting the king."), subj(c), present(c, ["защищаю", "protect"], ["защищает", "protects"]), ["короля", "the_king"], P(".")),
      A2: phrase(who(c, "I want to protect my king.", "My opponent wants to protect his king."),
        subj(c), present(c, ["хочу", "want"], ["хочет", "wants"]), ["защитить", "to_protect"], ["своего", "own"], ["короля", "king"], P(".")),
      B1: phrase(who(c, "I decided to protect the king because it's under threat.", "My opponent decided to protect the king because it's under threat."),
        subj(c), past(c, "решил", "решила", "decided"), ["защитить", "to_protect"], ["короля", "the_king"], P(","), ["потому", "because"], ["что", "(that)"], ["он", "he"], ["находится", "is_located"], ["под", "under"], ["угрозой", "threat"], P(".")),
      B2: phrase(who(c, "I preferred to strengthen the king's position, since my opponent started creating immediate threats.", "My opponent preferred to strengthen his king's position in the face of immediate threats."),
        ...(c.speaker === "opponent"
          ? [subj(c), past(c, "предпочёл", "предпочла", "preferred"), ["укрепить", "to_strengthen"], ["позицию", "the_position"], ["короля", "of_the_king"], P(","), ["столкнувшись", "having_faced"], ["с", "with"], ["непосредственными", "immediate"], ["угрозами", "threats"], P(".")] as Tok[]
          : [subj(c), past(c, "предпочёл", "предпочла", "preferred"), ["укрепить", "to_strengthen"], ["позицию", "the_position"], ["короля", "of_the_king"], P(","), ["поскольку", "since"], ["соперник", "the_opponent"], ["начал", "began"], ["создавать", "creating"], ["непосредственные", "immediate"], ["угрозы", "threats"], P(".")] as Tok[])),
    };
    return { key: "defend-king", phrase: byLevel[level], vocab: ["защищать", "защитить", "угроза"] };
  }

  // ---- en passant
  if (f.enPassant) {
    return {
      key: "en-passant",
      phrase: phrase(who(c, "I'm taking the pawn en passant.", "My opponent takes the pawn en passant."),
        subj(c), present(c, ["беру", "take"], ["берёт", "takes"]), ["пешку", "the_pawn"], ["на", "in"], ["проходе", "passing"], P(".")),
      vocab: ["брать", "проход"],
    };
  }

  // ---- captures
  if (f.captured) {
    const cap = f.captured;
    const owner = c.speaker === "opponent" ? MY_ACC(cap) : YOUR_ACC(cap);
    const ownerEn = c.speaker === "opponent" ? "my" : "your";
    const ahead = f.materialAfter > 0;
    const evened = f.materialAfter === 0 && f.materialBefore < 0;
    const byLevel: Record<Level, Phrase> = {
      A1: phrase(who(c, `I'm taking ${ownerEn} ${cap.en}!`, `My opponent takes my ${cap.en}!`),
        subj(c), present(c, ["беру", "take"], ["берёт", "takes"]), [owner, ownerEn], [cap.acc, cap.en], P("!")),
      A2: phrase(who(c, `I took ${ownerEn} ${cap.en} on ${to}.`, `My opponent took my ${cap.en} on ${to}.`),
        subj(c), past(c, "взял", "взяла", "took"), [owner, ownerEn], [cap.acc, cap.en], ["на", "on"], sq(to), P(".")),
      B1: f.captureWasFree
        ? phrase(who(c, `I took the ${cap.en} because it was undefended.`, `My opponent took the ${cap.en} because it was undefended.`),
          subj(c), past(c, "взял", "взяла", "took"), [cap.acc, `the_${cap.en}`], P(","), ["потому", "because"], ["что", "(that)"], [HE_SHE(cap), "it"], [WAS(cap), "was"], ["без", "without"], ["защиты", "protection"], P("."))
        : phrase(who(c, `I took the ${cap.en}. Let's see if there'll be an exchange.`, `My opponent took the ${cap.en}. Let's see if there'll be an exchange.`),
          subj(c), past(c, "взял", "взяла", "took"), [cap.acc, `the_${cap.en}`], P("."), ["посмотрим", "let's_see"], P(","), ["будет", "will_there_be"], ["ли", "(whether)"], ["размен", "an_exchange"], P(".")),
      B2: ahead
        ? phrase(who(c, `I'm taking the ${cap.en}: now the material advantage is on my side.`, `My opponent takes the ${cap.en}: now the material advantage is on his side.`),
          subj(c), present(c, ["забираю", "take"], ["забирает", "takes"]), [cap.acc, `the_${cap.en}`], P(":"), ["теперь", "now"], ["материальное", "material"], ["преимущество", "advantage"], ["на", "on"],
          c.speaker === "opponent" ? ["его", "his"] : ["моей", "my"], ["стороне", "side"], P("."))
        : evened
          ? phrase(who(c, `By taking the ${cap.en}, I restore the material balance.`, `By taking the ${cap.en}, my opponent restores the material balance.`),
            ["взяв", "having_taken"], [cap.acc, `the_${cap.en}`], P(","), subj(c), present(c, ["восстанавливаю", "restore"], ["восстанавливает", "restores"]), ["материальное", "material"], ["равновесие", "balance"], P("."))
          : phrase(who(c, `I'm taking the ${cap.en} on ${to}, and the character of the position changes.`, `My opponent takes the ${cap.en} on ${to}, and the character of the position changes.`),
            subj(c), present(c, ["забираю", "take"], ["забирает", "takes"]), [cap.acc, `the_${cap.en}`], ["на", "on"], sq(to), P(","), ["и", "and"], ["характер", "the_character"], ["позиции", "of_the_position"], ["меняется", "changes"], P(".")),
    };
    const vocab = level === "A1" ? ["брать"] : ["взять", "брать"];
    if (level === "B1" && !f.captureWasFree) vocab.push("размен");
    if (level === "B2") vocab.push("преимущество");
    return { key: "capture", phrase: byLevel[level], vocab };
  }

  // ---- check (non-capturing)
  if (f.check) {
    const byLevel: Record<Level, Phrase> = {
      A1: phrase("Check! Check to the king!", ["шах", "check"], P("!"), ["шах", "check"], ["королю", "to_the_king"], P("!")),
      A2: phrase(who(c, "I'm giving check!", "My opponent gives check!"), subj(c), present(c, ["ставлю", "put"], ["ставит", "puts"]), ["шах", "check"], P("!")),
      B1: phrase(who(c, "I'm giving check to force the king to retreat.", "My opponent gives check to force my king to retreat."),
        subj(c), present(c, ["ставлю", "give"], ["ставит", "gives"]), ["шах", "check"], P(","), ["чтобы", "in_order_to"], ["заставить", "force"], ["короля", "the_king"], ["отступить", "to_retreat"], P(".")),
      B2: phrase(who(c, "Check! My opponent's king will have to look for shelter.", "Check! My king will have to look for shelter."),
        ["шах", "check"], P("!"), c.speaker === "opponent" ? ["моему", "my"] : ["королю", "the_king"], c.speaker === "opponent" ? ["королю", "king"] : ["соперника", "of_the_opponent"],
        ["придётся", "will_have_to"], ["искать", "look_for"], ["укрытие", "shelter"], P(".")),
    };
    return { key: "check", phrase: byLevel[level], vocab: ["шах"] };
  }

  // ---- threats
  if (f.threat && level !== "A1") {
    const t = f.threat.piece;
    const targetOwner = c.speaker === "opponent" ? MY_ACC(t) : YOUR_ACC(t);
    const ownerEn = c.speaker === "opponent" ? "my" : "your";
    const byLevel: Record<Exclude<Level, "A1">, Phrase> = {
      A2: phrase(who(c, `I'm attacking ${ownerEn} ${t.en}.`, `My opponent is attacking my ${t.en}.`),
        subj(c), present(c, ["нападаю", "attack"], ["нападает", "attacks"]), ["на", "—"], [targetOwner, ownerEn], [t.acc, t.en], P(".")),
      B1: phrase(who(c, `I attacked the ${t.en}, and now my opponent has to defend it.`, `My opponent attacked my ${t.en}, and now I have to defend it.`),
        subj(c), past(c, "напал", "напала", "attacked"), ["на", "—"], [t.acc, `the_${t.en}`], P(","), ["и", "and"],
        ...(c.speaker === "opponent"
          ? [["мне", "to_me"], ["нужно", "it's_necessary"], [HIM_HER(t), "it"], ["защитить", "to_protect"]] as Tok[]
          : [["соперник", "the_opponent"], ["должен", "must"], [HIM_HER(t), "it"], ["защитить", "protect"]] as Tok[]), P(".")),
      B2: phrase(who(c, `By attacking the ${t.en}, I force my opponent to spend time on defence.`, `By attacking my ${t.en}, my opponent forces me to spend time on defence.`),
        ["атакуя", "attacking"], [t.acc, `the_${t.en}`], P(","), subj(c), present(c, ["вынуждаю", "force"], ["вынуждает", "forces"]),
        c.speaker === "opponent" ? ["меня", "me"] : ["соперника", "the_opponent"], ["тратить", "to_spend"], ["время", "time"], ["на", "on"], ["защиту", "defence"], P(".")),
    };
    return { key: "threat", phrase: byLevel[level as Exclude<Level, "A1">], vocab: [level === "A2" ? "нападать" : "напасть", "угроза"] };
  }

  // ---- center pawns
  if (f.centerPawn) {
    const ctrl = f.pawnControls;
    const byLevel: Record<Level, Phrase> = {
      A1: phrase(who(c, "I'm moving the pawn forward.", "My opponent moves a pawn forward."),
        subj(c), present(c, ["двигаю", "move"], ["двигает", "moves"]), ["пешку", "the_pawn"], ["вперёд", "forward"], P(".")),
      A2: phrase(who(c, "I want to control the center.", "My opponent wants to control the center."),
        subj(c), present(c, ["хочу", "want"], ["хочет", "wants"]), ["контролировать", "to_control"], ["центр", "the_center"], P(".")),
      B1: phrase(who(c, "I put a pawn in the center because the center is the most important part of the board.", "My opponent put a pawn in the center: the center is the most important part of the board."),
        subj(c), past(c, "поставил", "поставила", "put"), ["пешку", "a_pawn"], ["в", "in"], ["центр", "the_center"], P(","), ["потому", "because"], ["что", "(that)"],
        ["центр", "the_center"], P(" —"), ["самая", "the_most"], ["важная", "important"], ["часть", "part"], ["доски", "of_the_board"], P(".")),
      B2: f.opensLines && ctrl.length === 2
        ? phrase(`The pawn on ${to} controls the key squares ${ctrl[0]} and ${ctrl[1]} and opens the way for the bishop and queen.`,
          ["пешка", "the_pawn"], ["на", "on"], sq(to), ["контролирует", "controls"], ["ключевые", "the_key"], ["поля", "squares"], sq(ctrl[0]), ["и", "and"], sq(ctrl[1]),
          ["и", "and"], ["освобождает", "clears"], ["дорогу", "the_way"], ["слону", "for_the_bishop"], ["и", "and"], ["ферзю", "the_queen"], P("."))
        : phrase(`The pawn on ${to} fights for the center and cramps the opponent's pieces.`,
          ["пешка", "the_pawn"], ["на", "on"], sq(to), ["борется", "fights"], ["за", "for"], ["центр", "the_center"], ["и", "and"], ["стесняет", "cramps"], ["фигуры", "the_pieces"], ["соперника", "of_the_opponent"], P(".")),
    };
    return { key: "center", phrase: byLevel[level], vocab: level === "A1" ? ["двигать", "вперёд"] : ["центр", "контролировать"] };
  }

  // ---- development
  if (f.development) {
    const byLevel: Record<Level, Phrase> = {
      A1: phrase(who(c, `I'm moving my ${p.en}.`, `My opponent moves a ${p.en}.`), subj(c), present(c, ["хожу", "move"], ["ходит", "moves"]), [p.ins, `(with)_the_${p.en}`], P(".")),
      A2: phrase(who(c, `I'm developing my ${p.en}.`, `My opponent is developing a ${p.en}.`),
        subj(c), present(c, ["вывожу", "bring_out"], ["выводит", "brings_out"]), [p.acc, `the_${p.en}`], P(".")),
      B1: f.canCastle
        ? phrase(who(c, `I'm developing the ${p.en} to prepare to castle.`, `My opponent develops the ${p.en} to prepare to castle.`),
          subj(c), present(c, ["развиваю", "develop"], ["развивает", "develops"]), [p.acc, `the_${p.en}`], P(","), ["чтобы", "in_order_to"], ["подготовить", "prepare"], ["рокировку", "castling"], P("."))
        : phrase(who(c, `I'm developing the ${p.en} to bring it into the game.`, `My opponent develops the ${p.en} to bring it into the game.`),
          subj(c), present(c, ["развиваю", "develop"], ["развивает", "develops"]), [p.acc, `the_${p.en}`], P(","), ["чтобы", "in_order_to"], ["подключить", "bring"], ["его", "it"], ["к", "into"], ["игре", "the_game"], P(".")),
      B2: f.canCastle
        ? phrase(who(c, "By developing my minor pieces, I'm preparing to castle and fight for the center.", "By developing his minor pieces, my opponent prepares to castle and fight for the center."),
          ["развивая", "developing"], ["лёгкие", "the_minor"], ["фигуры", "pieces"], P(","), subj(c), present(c, ["готовлюсь", "prepare"], ["готовится", "prepares"]),
          ["к", "for"], ["рокировке", "castling"], ["и", "and"], ["борьбе", "the_fight"], ["за", "for"], ["центр", "the_center"], P("."))
        : phrase(who(c, "By developing my last minor pieces, I'm completing the mobilisation of my forces.", "By developing his minor pieces, my opponent completes the mobilisation of his forces."),
          ["развивая", "developing"], ["лёгкие", "the_minor"], ["фигуры", "pieces"], P(","), subj(c), present(c, ["завершаю", "complete"], ["завершает", "completes"]),
          ["мобилизацию", "the_mobilisation"], ["сил", "of_forces"], P(".")),
    };
    return { key: "develop", phrase: byLevel[level], vocab: level === "A1" ? ["ходить"] : level === "A2" ? ["выводить"] : ["развивать"] };
  }

  // ---- retreats
  if (f.retreat && level !== "A1") {
    const byLevel: Record<Exclude<Level, "A1">, Phrase> = {
      A2: phrase(who(c, `The ${p.en} retreats.`, `The opponent's ${p.en} retreats.`), [p.nom, `the_${p.en}`], ["отступает", "retreats"], P(".")),
      B1: phrase(who(c, `I'm pulling the ${p.en} back so I don't lose it.`, `My opponent pulls the ${p.en} back so as not to lose it.`),
        subj(c), present(c, ["отвожу", "pull"], ["отводит", "pulls"]), [p.acc, `the_${p.en}`], ["назад", "back"], P(","), ["чтобы", "so_that"], ["не", "not"], ["потерять", "to_lose"], [HIM_HER(p), "it"], P(".")),
      B2: phrase(who(c, `By retreating with the ${p.en}, I keep the piece and regroup.`, `By retreating with the ${p.en}, my opponent keeps the piece and regroups.`),
        ["отступив", "having_retreated"], [p.ins, `with_the_${p.en}`], P(","), subj(c), present(c, ["сохраняю", "keep"], ["сохраняет", "keeps"]), ["фигуру", "the_piece"], ["и", "and"],
        present(c, ["перегруппировываю", "regroup"], ["перегруппировывает", "regroups"]), ["силы", "forces"], P(".")),
    };
    return { key: "retreat", phrase: byLevel[level as Exclude<Level, "A1">], vocab: ["отступать"] };
  }

  // ---- everything else
  const pawnA1 = f.move.piece === "p";
  const byLevel: Record<Level, Phrase> = {
    A1: pawnA1
      ? phrase(who(c, "I'm moving the pawn forward.", "My opponent moves a pawn forward."), subj(c), present(c, ["двигаю", "move"], ["двигает", "moves"]), ["пешку", "the_pawn"], ["вперёд", "forward"], P("."))
      : phrase(who(c, `I move the ${p.en} to ${to}.`, `My opponent moves the ${p.en} to ${to}.`), subj(c), present(c, ["хожу", "move"], ["ходит", "moves"]), [p.ins, `(with)_the_${p.en}`], ["на", "to"], sq(to), P(".")),
    A2: variant(c, [
      phrase(who(c, `I moved my ${p.en} to ${to}.`, `My opponent moved the ${p.en} to ${to}.`), subj(c), past(c, "пошёл", "пошла", "went"), [p.ins, `(with)_the_${p.en}`], ["на", "to"], sq(to), P(".")),
      phrase(who(c, `I put my ${p.en} on ${to}.`, `My opponent put the ${p.en} on ${to}.`), subj(c), past(c, "поставил", "поставила", "put"), [p.acc, `the_${p.en}`], ["на", "on"], sq(to), P(".")),
    ]),
    B1: variant(c, [
      phrase(who(c, `I moved the ${p.en} to ${to} to improve its position.`, `My opponent moved the ${p.en} to ${to} to improve its position.`),
        subj(c), past(c, "перевёл", "перевела", "moved_over"), [p.acc, `the_${p.en}`], ["на", "to"], sq(to), P(","), ["чтобы", "in_order_to"], ["улучшить", "improve"], [p.g === "m" ? "его" : "её", "its"], ["позицию", "position"], P(".")),
      phrase(who(c, `I think the ${p.en} is more active on ${to}.`, `My opponent thinks the ${p.en} is more active on ${to}.`),
        c.speaker === "opponent" ? ["соперник", "my_opponent"] : ["мне", "to_me"], c.speaker === "opponent" ? ["считает", "thinks"] : ["кажется", "it_seems"], P(","),
        ["что", "that"], ["на", "on"], sq(to), [p.nom, `the_${p.en}`], ["активнее", "is_more_active"], P(".")),
    ]),
    B2: variant(c, [
      phrase(`The ${p.en} on ${to} takes up a more active post.`, [p.nom, `the_${p.en}`], ["на", "on"], sq(to), ["занимает", "takes_up"], ["более", "a_more"], ["активную", "active"], ["позицию", "position"], P(".")),
      phrase(who(c, `Moving the ${p.en} to ${to}, I'm strengthening control over the key squares.`, `Moving the ${p.en} to ${to}, my opponent strengthens control over the key squares.`),
        ["переводя", "moving_over"], [p.acc, `the_${p.en}`], ["на", "to"], sq(to), P(","), subj(c), present(c, ["усиливаю", "strengthen"], ["усиливает", "strengthens"]),
        ["контроль", "control"], ["над", "over"], ["ключевыми", "the_key"], ["полями", "squares"], P(".")),
    ]),
  };
  return { key: "move", phrase: byLevel[level], vocab: level === "A1" ? (pawnA1 ? ["двигать", "вперёд"] : ["ходить"]) : ["ход", "поле"] };
}

// ---------------------------------------------------------------- AI talk
export function reactionPhrase(r: Reaction, level: Level, forms: Forms): Phrase {
  const t: Record<Reaction, Record<Level, Phrase>> = {
    best: {
      A1: phrase("Good move!", ["хороший", "good"], ["ход", "move"], P("!")),
      A2: phrase("Good move! I didn't expect that.", ["хороший", "good"], ["ход", "move"], P("!"), ["я", "I"], ["не", "not"], ["ожидал", "expected"], P(".")),
      B1: phrase("Excellent move — you found a strong continuation.", ["отличный", "excellent"], ["ход", "move"], P(" —"), ["ты", "you"], [g(forms, "нашёл", "нашла"), "found"], ["сильное", "a_strong"], ["продолжение", "continuation"], P(".")),
      B2: phrase("A strong move: you assessed the position precisely.", ["сильный", "a_strong"], ["ход", "move"], P(":"), ["ты", "you"], ["точно", "precisely"], [g(forms, "оценил", "оценила"), "assessed"], ["позицию", "the_position"], P(".")),
    },
    good: {
      A1: phrase("Okay. Good.", ["хорошо", "good"], P(".")),
      A2: phrase("A normal move.", ["нормальный", "a_normal"], ["ход", "move"], P(".")),
      B1: phrase("A sensible move.", ["разумный", "a_sensible"], ["ход", "move"], P(".")),
      B2: phrase("A perfectly reasonable decision.", ["вполне", "perfectly"], ["разумное", "reasonable"], ["решение", "decision"], P(".")),
    },
    inaccuracy: {
      A1: phrase("Hmm… interesting.", ["хм", "hmm"], P("…"), ["интересно", "interesting"], P(".")),
      A2: phrase("An interesting move, but there's a better one.", ["интересный", "an_interesting"], ["ход", "move"], P(","), ["но", "but"], ["есть", "there_is"], ["лучше", "better"], P(".")),
      B1: phrase("Not bad, but I think there was a stronger move.", ["неплохо", "not_bad"], P(","), ["но", "but"], ["мне", "to_me"], ["кажется", "it_seems"], P(","), ["был", "there_was"], ["ход", "a_move"], ["сильнее", "stronger"], P(".")),
      B2: phrase("A playable move, though not the most accurate.", ["ход", "the_move"], ["возможный", "is_possible"], P(","), ["хотя", "although"], ["и", "—"], ["не", "not"], ["самый", "the_most"], ["точный", "accurate"], P(".")),
    },
    mistake: {
      A1: phrase("That's a mistake!", ["это", "this_is"], ["ошибка", "a_mistake"], P("!")),
      A2: phrase("I think that's a mistake.", ["мне", "to_me"], ["кажется", "it_seems"], P(","), ["это", "this_is"], ["ошибка", "a_mistake"], P(".")),
      B1: phrase("I think this is a mistake.", ["я", "I"], ["думаю", "think"], P(","), ["что", "that"], ["это", "this_is"], ["ошибка", "a_mistake"], P(".")),
      B2: phrase("I'm afraid this move makes your position worse.", ["боюсь", "I'm_afraid"], P(","), ["этот", "this"], ["ход", "move"], ["ухудшает", "worsens"], ["твою", "your"], ["позицию", "position"], P(".")),
    },
    blunder: {
      A1: phrase("Oh! A big mistake!", ["ой", "oh"], P("!"), ["большая", "a_big"], ["ошибка", "mistake"], P("!")),
      A2: phrase("That's a blunder!", ["это", "this_is"], ["грубая", "a_gross"], ["ошибка", "mistake"], P("!")),
      B1: phrase("That's a blunder — now I can win material.", ["это", "this_is"], ["грубая", "a_gross"], ["ошибка", "mistake"], P(" —"), ["теперь", "now"], ["я", "I"], ["могу", "can"], ["выиграть", "win"], ["материал", "material"], P(".")),
      B2: phrase("That's a serious oversight: the position has swung sharply in my favour.", ["это", "this_is"], ["серьёзный", "a_serious"], ["промах", "oversight"], P(":"), ["позиция", "the_position"], ["резко", "sharply"], ["изменилась", "changed"], ["в", "in"], ["мою", "my"], ["пользу", "favour"], P(".")),
    },
  };
  return t[r][level];
}

function planPhrase(key: string, level: Level): Phrase | undefined {
  if (level === "A1") return undefined;
  const plans: Record<string, Phrase> = {
    center: phrase("I'll defend the center.", ["я", "I"], ["буду", "will"], ["защищать", "defend"], ["центр", "the_center"], P(".")),
    develop: phrase("I'll develop my pieces.", ["я", "I"], ["буду", "will"], ["развивать", "develop"], ["фигуры", "the_pieces"], P(".")),
    castle: phrase("Now my king is safe.", ["теперь", "now"], ["мой", "my"], ["король", "king"], ["в", "in"], ["безопасности", "safety"], P(".")),
    threat: phrase("I'm going on the attack.", ["я", "I"], ["перехожу", "go_over"], ["в", "to"], ["атаку", "the_attack"], P(".")),
    capture: phrase("Material matters!", ["материал", "material"], ["важен", "matters"], P("!")),
    "defend-king": phrase("I have to be careful.", ["мне", "to_me"], ["нужно", "it's_necessary"], ["быть", "to_be"], ["осторожным", "careful"], P(".")),
  };
  return plans[key];
}

export function yourMovePhrase(level: Level): Phrase {
  switch (level) {
    case "A1": return phrase("Your move!", ["твой", "your"], ["ход", "move"], P("!"));
    case "A2": return phrase("Now it's your move.", ["теперь", "now"], ["твой", "your"], ["ход", "move"], P("."));
    case "B1": return phrase("Your move — what will you do?", ["твой", "your"], ["ход", "move"], P(" —"), ["что", "what"], ["ты", "you"], ["будешь", "will"], ["делать", "do"], P("?"));
    case "B2": return phrase("Your move. What are you planning to do next?", ["твой", "your"], ["ход", "move"], P("."), ["что", "what"], ["ты", "you"], ["собираешься", "are_planning"], ["делать", "to_do"], ["дальше", "next"], P("?"));
  }
}

function questionPhrase(level: Level): Phrase | undefined {
  switch (level) {
    case "A1": return undefined;
    case "A2": return phrase("Why did my opponent make this move?", ["почему", "why"], ["соперник", "the_opponent"], ["сделал", "made"], ["этот", "this"], ["ход", "move"], P("?"));
    case "B1": return phrase("What do you think — why did my opponent play this?", ["как", "how"], ["ты", "you"], ["думаешь", "think"], P(","), ["зачем", "what_for"], ["соперник", "the_opponent"], ["сделал", "made"], ["этот", "this"], ["ход", "move"], P("?"));
    case "B2": return phrase("What goal is this move pursuing, in your view?", ["какую", "what"], ["цель", "goal"], P(","), ["по-твоему", "in_your_view"], P(","), ["преследует", "pursues"], ["этот", "this"], ["ход", "move"], P("?"));
  }
}

// ---------------------------------------------------------------- grammar notes
const GRAMMAR: Record<string, Partial<Record<Level, { title: string; body: string }>>> = {
  move: {
    A1: { title: "Moving “with” a piece", body: "Russian says you move *with* a piece, so the piece takes the instrumental case: пешка → пешкой, конь → конём, слон → слоном, ладья → ладьёй, ферзь → ферзём, король → королём. «Хожу конём на f3» = “I move my knight to f3.”" },
    A2: { title: "Past tense and поставить", body: "Пошёл / пошла are the past tense of пойти — a man says пошёл, a woman says пошла. With поставить (to put), the piece is the direct object: поставил коня, поставила ладью. Masculine pieces use the animate accusative (коня, слона, ферзя)." },
    B1: { title: "Чтобы + infinitive", body: "«Чтобы» introduces a purpose: перевёл коня, чтобы улучшить его позицию — “in order to improve its position”. When both parts have the same subject, use the infinitive after чтобы." },
    B2: { title: "Verbal adverbs (-я)", body: "«Переводя коня» means “while moving the knight”. Imperfective verbal adverbs end in -я/-а and describe an action happening at the same time as the main verb. They share the subject of the main clause." },
  },
  develop: {
    A2: { title: "Выводить фигуры", body: "Chess players say выводить фигуры — literally “to bring the pieces out” — for development. The piece is in the accusative: вывожу коня, вывожу слона." },
    B1: { title: "Развивать + чтобы", body: "Развивать (to develop) takes the accusative: развиваю коня. The second half explains why: чтобы подготовить рокировку — “in order to prepare castling”." },
    B2: { title: "Развивая… — at the same time", body: "«Развивая лёгкие фигуры» (“developing the minor pieces”) is an imperfective verbal adverb. Лёгкие фигуры (light pieces) = knights and bishops; тяжёлые фигуры (heavy pieces) = rooks and queens." },
  },
  center: {
    A1: { title: "Accusative of feminine nouns", body: "Пешка is feminine. As the object of a verb it changes -а to -у: двигаю пешку. Вперёд means “forward”." },
    A2: { title: "Хотеть + infinitive", body: "Хочу / хочешь / хочет + infinitive: хочу контролировать центр. Хотеть is irregular: я хочу, ты хочешь, он хочет, мы хотим, вы хотите, они хотят." },
    B1: { title: "Потому что", body: "«Потому что» means “because”. Put a comma before it. The dash in «центр — самая важная часть» replaces “is” between two nouns." },
    B2: { title: "Dative after дорогу", body: "Освобождать дорогу кому? — the dative: слону, ферзю. Ключевые поля = key squares; поле (square) is neuter, plural поля." },
  },
  capture: {
    A1: { title: "Беру / берёт", body: "Брать (to take): я беру, ты берёшь, он берёт. The captured piece is in the accusative: беру пешку, беру коня. “Your” agrees too: твою пешку, твоего коня." },
    A2: { title: "Взял / взяла", body: "Взять is the perfective partner of брать. Past tense: взял (man), взяла (woman), взяли (plural). «Взял слона на d5» = “took the bishop on d5”." },
    B1: { title: "Без + genitive", body: "Без (without) takes the genitive: без защиты — “undefended”. Был / была agrees with the piece: конь был, пешка была." },
    B2: { title: "Материальное преимущество", body: "На моей стороне — “on my side”. Восстанавливать равновесие — “to restore the balance”. Взяв (having taken) is a perfective verbal adverb: the capture happens before the main action." },
  },
  check: {
    A1: { title: "Шах королю", body: "You give check *to* the king, so король goes into the dative: шах королю. Шах и мат = checkmate." },
    A2: { title: "Ставить шах", body: "Russians “put” check: ставлю шах, ставит шах; past tense поставил(а) шах. The perfective future is поставлю шах." },
    B1: { title: "Заставить + infinitive", body: "Заставить (to force) is followed by the person in the accusative and an infinitive: заставить короля отступить." },
    B2: { title: "Придётся", body: "«Кому-то придётся + infinitive» = “someone will have to”. The person is in the dative: королю придётся искать укрытие." },
  },
  castle: {
    A1: { title: "Делать рокировку", body: "Рокировка (castling) is feminine. You “make” castling: делаю рокировку — accusative -у." },
    A2: { title: "Короткая и длинная", body: "Короткая рокировка = kingside (O-O); длинная рокировка = queenside (O-O-O). Adjectives agree in the accusative: сделал короткую рокировку." },
    B1: { title: "Чтобы спрятать", body: "Спрятать (to hide) — чтобы спрятать короля. Masculine pieces take the animate accusative: короля." },
    B2: { title: "Позволять + dative + infinitive", body: "Позволять кому? что делать? — рокировка позволяет мне увести короля. Подключить ладью к игре = to bring the rook into play." },
  },
  promotion: {
    A1: { title: "Становиться + instrumental", body: "Становиться (to become) takes the instrumental: становится ферзём." },
    A2: { title: "Дойти до конца", body: "Дошла до конца доски — “reached the end of the board”. До takes the genitive: конца, доски." },
    B1: { title: "Превращать в + accusative", body: "Превращать что во что? — превращаю пешку в ферзя. Ферзь is masculine and animate in chess, so the accusative is ферзя." },
    B2: { title: "Соотношение сил", body: "Соотношение сил = balance of power. «Меняя» is an imperfective verbal adverb: “changing”." },
  },
  "defend-king": {
    A1: { title: "Защищать короля", body: "Защищать (to protect) + accusative. Король is masculine and treated as animate: короля." },
    A2: { title: "Свой", body: "«Своего короля» — свой means “one's own” and refers back to the subject." },
    B1: { title: "Находиться под угрозой", body: "Под (under) takes the instrumental: под угрозой — “under threat”. Находиться = to be located." },
    B2: { title: "Поскольку", body: "Поскольку (since, because) is more formal than потому что. Непосредственные угрозы = immediate threats." },
  },
  threat: {
    A2: { title: "Нападать на", body: "Нападать на + accusative: нападаю на ферзя, нападаю на твою ладью." },
    B1: { title: "Должен + infinitive", body: "Должен / должна / должны = must. The object pronoun agrees with the piece: его (конь, слон, ферзь), её (пешка, ладья)." },
    B2: { title: "Атакуя… вынуждаю", body: "«Атакуя» (attacking) is a verbal adverb. Вынуждать кого? что делать? — to force someone to do something." },
  },
  retreat: {
    A2: { title: "Отступать", body: "Отступать = to retreat. In the present tense: отступаю, отступаешь, отступает." },
    B1: { title: "Чтобы не", body: "«Чтобы не потерять его» — “so as not to lose it”. Negation goes between чтобы and the infinitive." },
    B2: { title: "Отступив", body: "«Отступив конём» — a perfective verbal adverb (-в): the retreat is completed before the main action." },
  },
  mate: {
    A1: { title: "Шах и мат", body: "Шах = check, мат = checkmate. You'll also hear «Это мат!»." },
    A2: { title: "Выиграл / выиграла", body: "Выиграть = to win. Past tense agrees with the speaker: выиграл (man), выиграла (woman)." },
    B1: { title: "Больше нет", body: "«Больше нет ходов» — “there are no more moves”. Нет takes the genitive plural: ходов." },
    B2: { title: "Избежать + genitive", body: "Избежать чего? — избежать угрозы. Партия окончена = the game is over." },
  },
};

// ---------------------------------------------------------------- exercises
function exerciseFor(ph: Phrase, piece?: PieceForms) {
  if (!piece) return undefined;
  const forms = [piece.nom, piece.acc, piece.gen, piece.ins, piece.dat];
  const target = ph.words.find((w) => forms.includes(w.ru.toLowerCase()));
  if (!target) return undefined;
  const answer = target.ru.toLowerCase();
  const options = Array.from(new Set([answer, ...forms])).slice(0, 4);
  if (options.length < 3) return undefined;
  const idx = ph.ru.toLowerCase().indexOf(answer);
  if (idx < 0) return undefined;
  const sorted = [...options].sort();
  return { before: ph.ru.slice(0, idx), after: ph.ru.slice(idx + answer.length), answer, options: sorted, en: ph.en };
}

// ---------------------------------------------------------------- public API
export type DescribeOptions = {
  move: Move;
  ply: number;
  level: Level;
  forms: Forms;
  speaker: Speaker;
  reactionToPrevious?: Reaction | null;
};

export function describeMove(o: DescribeOptions): MoveCard {
  const facts = analyzeMove(o.move, o.ply);
  const ctx: Ctx = { f: facts, level: o.level, forms: o.forms, speaker: o.speaker, ply: o.ply };
  const d = describe(ctx);
  const piece = d.key === "capture" ? facts.captured : d.key === "promotion" ? facts.promoted : d.key === "threat" ? facts.threat?.piece : facts.piece;
  const vocab: VocabItem[] = [];
  if (piece && d.phrase.words.some((w) => [piece.nom, piece.acc, piece.gen, piece.ins, piece.dat].includes(w.ru.toLowerCase()))) {
    vocab.push({ ru: piece.nom, stressed: piece.stressed, en: piece.en });
  }
  for (const k of d.vocab) if (VOCAB[k]) vocab.push(VOCAB[k]);
  if (o.speaker === "opponent" && d.phrase.words.some((w) => w.ru.toLowerCase() === "соперник")) vocab.push(VOCAB["соперник"]);

  const over = facts.mate || facts.stalemate || facts.draw;
  return {
    key: d.key,
    speaker: o.speaker,
    level: o.level,
    phrase: d.phrase,
    reaction: o.speaker === "ai" && o.reactionToPrevious ? reactionPhrase(o.reactionToPrevious, o.level, o.forms) : undefined,
    plan: o.speaker === "ai" && !over ? planPhrase(d.key, o.level) : undefined,
    question: o.speaker === "opponent" && !over ? questionPhrase(o.level) : undefined,
    prompt: o.speaker !== "me" && !over ? yourMovePhrase(o.level) : undefined,
    vocab,
    grammar: GRAMMAR[d.key]?.[o.level],
    exercise: exerciseFor(d.phrase, piece),
  };
}

/** Classify the learner's move from engine evaluations (centipawns, from the learner's side). */
export function classifyLoss(cpLoss: number): Reaction {
  if (cpLoss <= 10) return "best";
  if (cpLoss <= 50) return "good";
  if (cpLoss <= 120) return "inaccuracy";
  if (cpLoss <= 300) return "mistake";
  return "blunder";
}

// ---------------------------------------------------------------- chat suggestions
export const CHAT_PHRASES: Record<Level, { ru: string; en: string }[]> = {
  A1: [
    { ru: "Привет! Удачи!", en: "Hi! Good luck!" },
    { ru: "Хороший ход!", en: "Good move!" },
    { ru: "Спасибо!", en: "Thanks!" },
    { ru: "Ой!", en: "Oops!" },
    { ru: "Хорошая партия!", en: "Good game!" },
    { ru: "Спасибо за игру!", en: "Thanks for the game!" },
  ],
  A2: [
    { ru: "Удачной игры!", en: "Have a good game!" },
    { ru: "Почему ты сделал этот ход?", en: "Why did you make that move?" },
    { ru: "Мне кажется, это ошибка.", en: "I think that's a mistake." },
    { ru: "Я не ожидал этого хода!", en: "I didn't expect that move!" },
    { ru: "Сыграем ещё?", en: "Shall we play again?" },
    { ru: "Хорошая партия! Спасибо!", en: "Good game! Thanks!" },
  ],
  B1: [
    { ru: "Я думаю, что это ошибка.", en: "I think this is a mistake." },
    { ru: "У тебя есть хороший план.", en: "You have a good plan." },
    { ru: "Интересная позиция!", en: "Interesting position!" },
    { ru: "Давай потом разберём партию.", en: "Let's go over the game afterwards." },
    { ru: "Ты здорово играешь в дебюте.", en: "You play the opening really well." },
    { ru: "Хорошая партия! Было интересно.", en: "Good game! It was interesting." },
  ],
  B2: [
    { ru: "Смелое решение!", en: "A bold decision!" },
    { ru: "Позиция обоюдоострая.", en: "The position is double-edged." },
    { ru: "Ты меня здорово озадачил этим ходом.", en: "You really puzzled me with that move." },
    { ru: "Отличная борьба, спасибо за партию!", en: "A great fight, thanks for the game!" },
    { ru: "Давай после партии обсудим эндшпиль.", en: "Let's discuss the endgame after the game." },
  ],
};
