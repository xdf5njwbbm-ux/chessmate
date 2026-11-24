import type { Forms, Lesson, Line } from "./types";
import { bare } from "./russian";

export type Exercise =
  | { kind: "gap"; prompt: string; q: string; answer: string; options: string[]; en: string; why?: Record<string, string> }
  | { kind: "ru-en"; prompt: string; ru: string; answer: string; options: string[] }
  | { kind: "en-ru"; prompt: string; en: string; answer: string; options: string[] }
  | { kind: "listen"; prompt: string; ru: string; en: string; answer: string; options: string[] }
  | { kind: "order"; prompt: string; en: string; answer: string; tokens: string[] }
  | { kind: "vocab"; prompt: string; ru: string; stressed: string; answer: string; options: string[] }
  | { kind: "speak"; prompt: string; ru: string; en: string }
  /** Conversation lessons: someone asks a question, pick the natural reply. */
  | { kind: "respond"; prompt: string; who: string; q: string; qEn: string; answer: string; options: string[]; en: string };

export const shuffle = <T,>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const pick = <T,>(a: T[], n: number) => shuffle(a).slice(0, n);
const lineText = (l: Line, forms: Forms) => (forms === "f" && l.ruF ? l.ruF : l.ru);

function distract(pool: string[], answer: string, n = 3): string[] {
  return shuffle([answer, ...pick([...new Set(pool)].filter((p) => p !== answer), n)]);
}

/** Builds a varied exercise set from a lesson's own sentences, drills and vocabulary. */
export function buildExercises(lesson: Lesson, forms: Forms): Exercise[] {
  const lines = lesson.content.sections.flatMap((s) => (s.type === "lines" ? s.lines : []));
  const usable = lines.filter((l) => l.words.filter((w) => /\p{L}/u.test(w.ru)).length >= 2);
  const ens = lines.map((l) => l.en);
  const rus = lines.map((l) => lineText(l, forms));
  const out: Exercise[] = [];

  for (const d of pick(lesson.content.drills, 3)) {
    out.push({ kind: "gap", prompt: "Choose the word that fits", q: d.q, answer: d.answer, options: shuffle(d.options), en: d.en, why: d.why });
  }
  const chosen = pick(usable, Math.min(8, usable.length));
  chosen.forEach((l, i) => {
    const ru = lineText(l, forms);
    switch (i % 5) {
      case 0:
        out.push({ kind: "ru-en", prompt: "What does this mean?", ru, answer: l.en, options: distract(ens, l.en) });
        break;
      case 1:
        out.push({ kind: "listen", prompt: "Listen and choose what you hear", ru, en: l.en, answer: ru, options: distract(rus, ru) });
        break;
      case 2: {
        const tokens = ru.split(" ");
        if (tokens.length >= 3 && tokens.length <= 9) out.push({ kind: "order", prompt: "Put the words in order", en: l.en, answer: ru, tokens: shuffle(tokens) });
        else out.push({ kind: "en-ru", prompt: "How do you say this in Russian?", en: l.en, answer: ru, options: distract(rus, ru) });
        break;
      }
      case 3:
        out.push({ kind: "en-ru", prompt: "How do you say this in Russian?", en: l.en, answer: ru, options: distract(rus, ru) });
        break;
      case 4:
        out.push({ kind: "speak", prompt: "Say it out loud", ru, en: l.en });
        break;
    }
  });
  // conversation lessons: hear a question, choose the reply that fits (the others answer other questions)
  const pairs = lesson.content.sections.flatMap((s) =>
    s.type === "lines" && s.kind === "conversation" ? s.lines.flatMap((l, k) => (l.role === "q" && s.lines[k + 1] ? [{ q: l, a: s.lines[k + 1] }] : [])) : [],
  );
  if (pairs.length >= 4) {
    const replies = pairs.map((p) => lineText(p.a, forms));
    for (const p of pick(pairs, 3)) {
      const answer = lineText(p.a, forms);
      out.push({ kind: "respond", prompt: "Choose the natural reply", who: p.q.speaker ?? "Someone", q: lineText(p.q, forms), qEn: p.q.en, answer, options: distract(replies, answer), en: p.a.en });
    }
  }
  const vocabEns = lesson.vocab.map((v) => v.en);
  for (const v of pick(lesson.vocab, 3)) {
    out.push({ kind: "vocab", prompt: "What does this word mean?", ru: v.ru, stressed: v.stressed, answer: v.en, options: distract(vocabEns, v.en) });
  }
  // keep speaking near the end, mix the rest
  const speak = out.filter((e) => e.kind === "speak");
  return [...shuffle(out.filter((e) => e.kind !== "speak")), ...speak];
}

/** The Russian and English of an exercise, for the "to review" list. */
export function reviewPair(e: Exercise): { ru: string; en: string } {
  switch (e.kind) {
    case "gap": return { ru: e.q.replace("___", e.answer), en: e.en };
    case "ru-en": return { ru: e.ru, en: e.answer };
    case "vocab": return { ru: e.stressed || e.ru, en: e.answer };
    case "en-ru": case "order": return { ru: e.answer, en: e.en };
    case "respond": return { ru: `${e.q} — ${e.answer}`, en: `${e.qEn} — ${e.en}` };
    default: return { ru: e.ru, en: e.en };
  }
}

export const scored = (e: Exercise) => e.kind !== "speak";
export const sameSentence = (a: string, b: string) =>
  a.split(" ").map((w) => bare(w).toLowerCase()).join(" ") === b.split(" ").map((w) => bare(w).toLowerCase()).join(" ");
