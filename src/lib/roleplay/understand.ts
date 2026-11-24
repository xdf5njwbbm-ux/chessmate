// What did the player mean? Turns a typed or spoken answer into a Meaning:
// mood, yes/no, questions (and which ones), topics, numbers, a name, likes…
// Also: Latin-letter Russian ("privet, kak dela") → Cyrillic, and English detection.

import type { Topic } from "./types.ts";

export const low = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/́/g, "");
export const tokens = (s: string) => (low(s).match(/[\p{L}\p{N}-]+/gu) ?? []).map((w) => w.replace(/^-+|-+$/g, "")).filter(Boolean);

// ---------------------------------------------------------------- script fixes

const HOMO: Record<string, string> = { a: "а", e: "е", o: "о", p: "р", c: "с", x: "х", y: "у", k: "к", m: "м", t: "т", h: "н", b: "в", A: "А", E: "Е", O: "О", P: "Р", C: "С", X: "Х", K: "К", M: "М", T: "Т", H: "Н", B: "В" };

/** Latin look-alike letters inside Cyrillic words (a phone keyboard slip) → Cyrillic. */
export function fixHomoglyphs(s: string): string {
  return s.replace(/[\p{L}]+/gu, (w) => (/[а-яё]/i.test(w) && /[a-z]/i.test(w) ? [...w].map((c) => HOMO[c] ?? c).join("") : w));
}

const MULTI: [string, string][] = [["shch", "щ"], ["sch", "щ"], ["zh", "ж"], ["kh", "х"], ["ch", "ч"], ["sh", "ш"], ["ts", "ц"], ["yo", "ё"], ["yu", "ю"], ["ya", "я"], ["ye", "е"], ["ju", "ю"], ["ja", "я"], ["jo", "ё"], ["''", "ъ"]];
const ONE: Record<string, string> = { a: "а", b: "б", v: "в", g: "г", d: "д", e: "е", z: "з", i: "и", j: "й", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", t: "т", u: "у", f: "ф", h: "х", c: "к", w: "в", q: "к", "'": "ь" };

/** One Latin-letter word → its most likely Cyrillic spelling ("horosho" → "хорошо"). */
export function latinWord(w: string): string {
  const s = w.toLowerCase();
  let out = "";
  for (let i = 0; i < s.length; ) {
    const m = MULTI.find(([l]) => s.startsWith(l, i));
    if (m) {
      out += m[1];
      i += m[0].length;
      continue;
    }
    const ch = s[i];
    if (ch === "y") out += /[aeiouy]/.test(s[i - 1] ?? "") ? "й" : "ы";
    else if (ch === "x") out += "кс";
    else out += ONE[ch] ?? ch;
    i++;
  }
  return out;
}

/** Closest known word, if one is close enough (for translit, which loses ь, ы/и…). */
export function nearest(w: string, lex: Set<string>, min = 0.78): string | null {
  if (lex.has(w)) return w;
  let best: string | null = null;
  let bs = 0;
  for (const x of lex) {
    if (Math.abs(x.length - w.length) > 2 || x[0] !== w[0]) continue;
    const s = sim(x, w);
    if (s > bs) [bs, best] = [s, x];
  }
  return bs >= min ? best : null;
}

export function sim(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return 1 - prev[n] / Math.max(m, n);
}

const EN_COMMON = new Set("i you he she it we they am is are was were be been the a an and or but to of in on at for with my your his her our their me him us them this that what how why who where when do does did not no yes yeah ok okay good great fine thanks thank hi hello hey well very so too also like love have has had go went going today work tired bad sorry please just really".split(" "));

/** Latin text → Cyrillic when it's transliterated Russian; flags English. */
export function script(text: string, lex: Set<string>): { text: string; translit: boolean; english: boolean } {
  const t = fixHomoglyphs(text.trim());
  const latin = t.match(/[a-z']+/gi) ?? [];
  const cyr = t.match(/[а-яё]+/gi) ?? [];
  if (!latin.length) return { text: t, translit: false, english: false };
  let ru = 0;
  let en = 0;
  const conv = new Map<string, string>();
  for (const w of latin) {
    const c = latinWord(w);
    const k = nearest(low(c), lex, 0.8);
    const isEn = EN_COMMON.has(w.toLowerCase());
    if (k && !isEn) {
      ru++;
      conv.set(w, k === low(c) ? c : k);
    } else en++;
  }
  // mostly English words → English; otherwise it's Russian typed with Latin letters
  if (en > ru) return { text: t, translit: false, english: cyr.length < latin.length };
  const out = t.replace(/[a-z']+/gi, (w) => {
    const c = conv.get(w) ?? latinWord(w);
    return /^[A-Z]/.test(w) ? c[0].toUpperCase() + c.slice(1) : c;
  });
  return { text: out, translit: true, english: false };
}

// ---------------------------------------------------------------- meaning

export type Meaning = {
  text: string;
  norm: string;
  words: string[];
  english: boolean;
  translit: boolean;
  good: boolean; bad: boolean; ok: boolean; tired: boolean; sick: boolean; busy: boolean;
  yes: boolean; no: boolean; q: boolean; askback: boolean; dontknow: boolean;
  like: boolean; dislike: boolean; agree: boolean; disagree: boolean; thanks: boolean;
  number: boolean;
  numbers: number[];
  topics: string[];
  likes: string[];
  dislikes: string[];
  name?: string;
  /** Which questions the player asked (keys of a character's answers). */
  asks: string[];
  short: boolean;
  long: boolean;
};

const has = (n: string, re: RegExp) => re.test(n);
/** A word that isn't negated right before ("не хорошо", "не очень хорошо"). */
function positive(words: string[], set: RegExp): boolean {
  return words.some((w, i) => set.test(w) && words[i - 1] !== "не" && !(words[i - 1] === "очень" && words[i - 2] === "не"));
}

const GOOD = /^(хорошо|отлично|прекрасно|замечательно|супер|класс|классно|здорово|великолепно|чудесно|шикарно|неплохо|ок|окей|окэй|отл|потрясающе|прекрасный|отличный|хороший|замечательный|бодрый|бодрая|счастлив|счастлива|весело|радостно|кайф|огонь)$/;
const BAD = /^(плохо|ужасно|грустно|печально|тяжело|фигово|хреново|паршиво|отстой|скучно|одиноко|расстроен|расстроена|нервничаю|переживаю|стресс|грустный|грустная|хуже|кошмар)$/;
const OK = /^(нормально|норм|ничего|потихоньку|помаленьку|средне|терпимо|сойдет|сойдёт|обычно)$/;

const NUMW: Record<string, number> = {
  ноль: 0, один: 1, одна: 1, одно: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9, десять: 10,
  одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
  двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90, сто: 100, полтора: 1.5,
};

export function numbers(words: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (/^\d+([.,]\d+)?$/.test(w)) out.push(Number(w.replace(",", ".")));
    else if (w in NUMW) {
      let v = NUMW[w];
      if (v >= 20 && v % 10 === 0 && v < 100 && words[i + 1] in NUMW && NUMW[words[i + 1]] < 10) v += NUMW[words[++i]];
      out.push(v);
    }
  }
  return out;
}

const NOT_Q = /^(как обычно|как всегда|как-то|что-то|где-то|когда-то|кто-то|как раз|как будто|как сказать)/;
const QW = /^(как|что|где|когда|почему|зачем|кто|сколько|какой|какая|какое|какие|чем|откуда|куда|чей|чья|чье|правда|серьезно|можно|хочешь|хотите|любишь|любите|ты|вы|у)$/;
const YOU = /^(ты|вы|тебя|вас|тебе|вам|твой|твоя|твое|твои|ваш|ваша|ваше|ваши|у|сам|сама|себя|тобой|вами|прошел|прошла|дела|любишь|любите|хочешь|хотите|часто|сейчас|любимый|любимая|любимое|давно|когда|там|еще)$/;

/** Questions the player can ask a partner, and the answer key each one gets. */
const ASKS: [string, RegExp][] = [
  ["myname", /как (тебя|вас) зовут|как твое имя|как ваше имя|как (тебя|вас) называют/],
  ["age", /сколько (тебе|вам) лет/],
  ["from", /откуда (ты|вы)|(ты|вы) откуда/],
  ["live", /где (ты|вы) (живешь|живете)|(ты|вы) где живешь/],
  ["job", /кем (ты|вы) работаешь|кем (ты|вы) работаете|где (ты|вы) работаешь|где (ты|вы) работаете|чем (ты|вы) занимаешься|чем (ты|вы) занимаетесь|какая у (тебя|вас) работа|(ты|вы) работаешь|(ты|вы) работаете/],
  ["feel", /как (ты|вы) себя чувству/],
  ["day", /что (ты|вы) (сегодня )?(делал|делала|делали)|чем (ты|вы) (сегодня )?(занимался|занималась|занимались)|как (прошел|прошла) (твой|ваш|у тебя|у вас) (день|неделя)|как (твой|ваш) день|как день/],
  ["new", /что нового|что у (тебя|вас) нового/],
  ["weekend", /(планы|что (ты|вы) (будешь|будете) делать|куда (ты|вы) (пойдешь|пойдете)|чем (займешься|займетесь)).*(выходн|вечер|завтра|сегодня)|на выходных|какие (у тебя |у вас )?планы/],
  ["hobby", /хобби|что (ты|вы) (любишь|любите) делать|чем (ты|вы) (увлекаешься|увлекаетесь)|свободное время/],
  ["chess", /шахмат|(ты|вы) (часто )?играешь|давно играешь|любимый дебют/],
  ["family", /семь|брат|сестр|родител|дети|детей|мама|папа/],
  ["food", /любимая еда|(любишь|любите) (есть|готовить)|какая кухня|что (ты|вы) (ешь|ел|ела)|готовишь/],
  ["film", /фильм|сериал|кино/],
  ["music", /музык|песн|слушаешь/],
  ["pets", /собак|кошк|кот\b|животн|питом/],
  ["travel", /путешеств|(ты|вы) (был|была|были) в|ездил|ездила|в отпуск|где (ты|вы) (был|была|бывал)/],
  ["love", /у (тебя|вас) есть (парень|девушка|муж|жена)|(ты|вы) (женат|замужем)/],
  ["sport", /спорт|спортзал|трениру|бегаешь|в зал/],
  ["work_how", /как (на|у тебя на|у вас на) работе|как работа/],
  ["hay", /как (у )?(тебя|вас) дела|как дела у (тебя|вас)|как твои дела|как ваши дела|как (ты|вы)\b(?! себя)|^а (у )?(тебя|вас)\b|^а (ты|вы)\b|как сам\b|как сама\b|как жизнь|как настроение|у (тебя|вас) как/],
];

export function understand(text: string, topics: Record<string, Topic>, lex: Set<string>): Meaning {
  const sc = script(text, lex);
  const t = sc.text;
  const norm = low(t).replace(/[^\p{L}\p{N}\s?-]/gu, " ").replace(/\s+/g, " ").trim();
  const words = tokens(t);
  const first = words[0] ?? "";
  const plainNorm = norm.replace(/\?/g, "").trim();

  // what they asked the partner — only when it's a question (a topic word alone isn't)
  const qish = t.includes("?") || QW.test(first) || /^а\s/.test(plainNorm) || words.includes("ли");
  const asks: string[] = [];
  for (const [k, re] of ASKS) if ((k === "hay" || qish) && re.test(plainNorm)) asks.push(k);
  const askback = asks.includes("hay") || /(^|\s)а (у )?(тебя|вас)( как)?\s*\??$/.test(norm) || /(^|\s)а (ты|вы)( как)?\s*\??$/.test(norm);
  if (askback && !asks.includes("hay")) asks.push("hay");
  const q = t.includes("?") || askback || asks.length > 0 || (QW.test(first) && YOU.test(words[1] ?? "") && !NOT_Q.test(plainNorm)) || words.includes("ли");

  const tired = has(norm, /устал|уставш|вымотал|вымотан|выжат|сонн|не выспал|хочу спать|без сил|нет сил/);
  const sick = has(norm, /болею|заболел|болит|простуд|температур|кашля|кашель|грипп|плохо себя чувству|приболел/);
  const busy = has(norm, /занят|много работы|много дел|завал|некогда|нет времени|загружен|работы много|дел много/);
  const negOK = /не очень|так себе|бывало (и )?лучше|бывает (и )?лучше|могло быть лучше|не очень хорошо|не хорошо|не супер|не здорово|не отлично/.test(norm);
  const good = !negOK && (positive(words, GOOD) || /все (хорошо|отлично|супер|ок|в порядке|прекрасно|замечательно)|в порядке|лучше всех|намного лучше|гораздо лучше|не жалуюсь|не могу жаловаться|не плохо/.test(norm));
  const bad = !good && (negOK || positive(words, BAD) || tired || sick || /не очень|не супер/.test(norm));
  const ok = !good && !bad && (positive(words, OK) || /как обычно|как всегда|по-старому|по старому|так себе|ничего особенного|жить можно|потихоньку|нормально/.test(norm));

  const yes = /^(да|ага|угу|конечно|естественно|разумеется|точно|обязательно|давай|давайте|пожалуй|еще бы|ещё бы|с удовольствием|yes|конечно же|именно|безусловно|бывает|иногда)$/.test(first) || /^да\b/.test(norm) || words.slice(0, 4).some((w) => w === "да" || w === "конечно");
  const no = /^(нет|неа|не-а|никогда|вряд|ни разу|нисколько|совсем нет)$/.test(first) || /^нет\b/.test(norm);
  const dontknow = /не знаю|без понятия|сложно сказать|трудно сказать|понятия не имею|не уверен|хз|не помню/.test(norm);
  const dislike = /не (очень )?(люблю|нравится|нравятся|любил|любила)|ненавижу|терпеть не могу|не фанат|не мое|не моё|не особо/.test(norm);
  const like = !dislike && /(люблю|нравится|нравятся|обожаю|кайфую|фанат|в восторге|любил|любила|увлекаюсь|любимый|любимая|любимое)/.test(norm);
  const disagree = /не (совсем )?согласен|не (совсем )?согласна|не думаю|не совсем|по-моему нет|по-моему, нет|я так не думаю|наоборот|не уверен|не уверена|не прав|не права|сомневаюсь/.test(norm);
  const agree = !disagree && /согласен|согласна|ты прав|ты права|вы правы|точно|верно|именно|так и есть|абсолютно|полностью|соглашусь|правда/.test(norm);
  const thanks = /спасибо|благодарю|спс|благодарен|благодарна/.test(norm);
  const nums = numbers(words);

  const found: string[] = [];
  for (const tp of Object.values(topics)) {
    if (tp.stems.some((s) => (s.startsWith("=") ? words.includes(s.slice(1)) : s.includes(" ") ? norm.includes(s) : words.some((w) => w.startsWith(s))))) found.push(tp.id);
  }

  let name: string | undefined;
  const nm = t.match(/меня зовут\s+([А-ЯЁA-Z]?[а-яёa-z-]{2,})/i) ?? t.match(/(?:мо[её]|мое) имя\s*[-—:]?\s*([А-ЯЁ][а-яё-]{2,})/i) ?? t.match(/(?:^|[\s,.!])я\s*[-—]?\s*([А-ЯЁ][а-яё-]{2,})(?:[\s,.!]|$)/);
  if (nm) {
    const cand = nm[1];
    if (!lex.has(low(cand)) || /меня зовут|имя/i.test(nm[0])) name = cand[0].toUpperCase() + cand.slice(1).toLowerCase();
  }

  return {
    text: t, norm, words, english: sc.english, translit: sc.translit,
    good, bad, ok, tired, sick, busy, yes, no, q, askback, dontknow, like, dislike, agree, disagree, thanks,
    number: nums.length > 0, numbers: nums,
    topics: found, likes: like ? found : [], dislikes: dislike ? found : [],
    name, asks, short: words.length <= 2, long: words.length >= 7,
  };
}
