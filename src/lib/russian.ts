// Small Russian-language helpers shared by lessons, games and speech.

const LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "'", э: "e", ю: "yu", я: "ya",
};
const VOWELS = "аеёиоуыэюяaeiouy";

/** Learner-friendly romanization (е → "ye" at the start of a word or after a vowel). */
export function translit(text: string): string {
  const s = text.replace(/́/g, "");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const lower = ch.toLowerCase();
    let r = LAT[lower];
    if (r === undefined) {
      out += ch;
      continue;
    }
    if (lower === "е") {
      const prev = s[i - 1]?.toLowerCase() ?? " ";
      if (!/[а-яё]/.test(prev) || VOWELS.includes(prev) || prev === "ъ" || prev === "ь") r = "ye";
    }
    if (ch !== lower && r) r = r[0].toUpperCase() + r.slice(1);
    out += r;
  }
  return out;
}

/** Removes stress marks. */
export const plain = (s: string) => s.replace(/́/g, "");

/** Strips punctuation around a word ("«Мат»." → "Мат"). */
export const bare = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

const FILES: Record<string, string> = { a: "а", b: "бэ", c: "цэ", d: "дэ", e: "е", f: "эф", g: "жэ", h: "аш" };
const RANKS = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь"];

/** Makes chess notation pronounceable for a Russian voice: "на e4" → "на е-четыре". */
export function speakable(text: string): string {
  return plain(text)
    .replace(/\bO-O-O\b/g, "длинная рокировка")
    .replace(/\bO-O\b/g, "короткая рокировка")
    .replace(/\b([a-h])([1-8])\b/g, (_, f: string, r: string) => `${FILES[f]}-${RANKS[+r]}`);
}

/** Vowel positions → a simple syllable split for display ("пешка" → "пеш·ка"). Approximate by design. */
export function syllables(word: string): string[] {
  const w = word.replace(/́/g, "\u0001"); // keep stress marks attached
  const isV = (c: string) => "аеёиоуыэюяАЕЁИОУЫЭЮЯ".includes(c);
  const chars = [...w];
  const vowelIdx = chars.map((c, i) => (isV(c) ? i : -1)).filter((i) => i >= 0);
  if (vowelIdx.length <= 1) return [word];
  const cuts: number[] = [];
  for (let k = 0; k < vowelIdx.length - 1; k++) {
    const a = vowelIdx[k];
    const b = vowelIdx[k + 1];
    let consonants = 0;
    for (let i = a + 1; i < b; i++) if (/[^\u0001ьъ]/.test(chars[i])) consonants++;
    // one consonant goes with the next vowel; in a cluster, й/sonorants close the syllable
    let cut = a + 1;
    while (cut < b && /[\u0001]/.test(chars[cut])) cut++;
    if (consonants >= 2) {
      const first = chars[cut];
      if (/[йлмнрЙЛМНР]/.test(first)) cut++;
      while (cut < b && /[ьъ\u0001]/.test(chars[cut])) cut++;
    }
    cuts.push(cut);
  }
  const parts: string[] = [];
  let start = 0;
  for (const c of cuts) {
    parts.push(chars.slice(start, c).join(""));
    start = c;
  }
  parts.push(chars.slice(start).join(""));
  return parts.map((p) => p.replace(/\u0001/g, "́"));
}

/** Pronunciation tips for a single word, from spelling rules (not from audio analysis). */
export function pronunciationTips(stressed: string): string[] {
  const w = stressed.toLowerCase();
  const p = plain(w);
  const tips: string[] = [];
  const stressIdx = w.indexOf("́") - 1;
  if (stressIdx >= 0) tips.push(`Stress falls on «${w[stressIdx]}» — say that syllable longer and louder.`);
  if (stressIdx >= 0 && [...w].some((c, i) => c === "о" && i !== stressIdx)) tips.push("Unstressed «о» sounds like «а».");
  if (stressIdx >= 0 && [...w].some((c, i) => (c === "е" || c === "я") && i !== stressIdx && i > 0)) tips.push("Unstressed «е» and «я» sound close to «и».");
  if (p.includes("ы")) tips.push("«ы»: say \"ee\" while pulling your tongue back.");
  if (p.includes("щ")) tips.push("«щ» is a long, soft \"sh\" — like \"fresh sheet\" said fast.");
  if (p.includes("ж") || p.includes("ш")) tips.push("«ж» and «ш» are always hard, with the tongue pulled back.");
  if (p.includes("ц")) tips.push("«ц» is \"ts\" and always hard.");
  if (p.includes("ч")) tips.push("«ч» is a soft, light \"ch\".");
  if (p.includes("ь")) tips.push("«ь» softens the consonant before it: raise the middle of your tongue.");
  if (p.includes("р")) tips.push("«р» is rolled: tap the tip of your tongue behind your teeth.");
  if (/[бвгдзж]$/.test(p)) tips.push("A voiced consonant at the end is devoiced: б→п, д→т, г→к, в→ф, з→с, ж→ш.");
  if (p.startsWith("здравств")) tips.push("The first «в» is silent: [здра́ствуйте].");
  if (/го$|его$/.test(p) && p.length > 3) tips.push("In the ending -ого/-его, «г» is pronounced «в».");
  return tips;
}

/** Normalizes text for comparing what someone said with what they should have said. */
export function normalizeRu(s: string): string {
  return plain(s)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Word-level comparison of a spoken attempt with the target sentence. */
export function compareWords(target: string, heard: string): { word: string; ok: boolean }[] {
  const t = normalizeRu(target).split(" ").filter(Boolean);
  const h = normalizeRu(heard).split(" ").filter(Boolean);
  const pool = [...h];
  return normalizeRu(target)
    .split(" ")
    .filter(Boolean)
    .map((w, i) => {
      const idx = pool.findIndex((x) => x === w || similarity(x, w) >= 0.8);
      if (idx >= 0) pool.splice(idx, 1);
      return { word: t[i], ok: idx >= 0 };
    });
}

/** Normalized Levenshtein similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
