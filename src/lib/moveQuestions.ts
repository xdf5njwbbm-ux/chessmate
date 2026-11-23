// A different quick Russian question after every move, built from lesson
// material at the learner's level (sentences, fill-in-the-gap drills and
// vocabulary) — not just chess words. Pure functions, no I/O.
import type { Forms } from "./types";

export type QuestionPool = {
  levels: string[];
  lines: { ru: string; ruF: string | null; en: string; level: string; lesson: string }[];
  /** `why`: a note for each wrong option, shown when the learner picks it. */
  drills: { q: string; answer: string; options: string[]; en: string; level: string; why?: Record<string, string> | null }[];
  vocab: { id: string; ru: string; stressed: string; en: string; level: string }[];
};

export type MoveQuestion = {
  key: string;
  kind: "word" | "word-ru" | "meaning" | "say" | "gap" | "listen";
  level: string;
  prompt: string;
  /** Russian shown (and playable) above the options. */
  show?: string;
  /** English shown above the options. */
  showEn?: string;
  /** Russian to play for listening questions (hidden until answered). */
  audio?: string;
  answer: string;
  options: string[];
  /** Options are Russian (styled and playable). */
  ruOptions: boolean;
  /** Full sentence / word with its meaning, shown after answering. */
  reveal: { ru: string; en: string };
  /** Why each wrong option doesn't fit, keyed by option — shown when it's picked. */
  why: Record<string, string>;
};

const shuffle = <T,>(a: T[]): T[] => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const norm = (s: string) => s.toLowerCase().replace(/[́.,!?«»"—–-]/g, "").replace(/\s+/g, " ").trim();
function options(answer: string, pool: string[], n = 3): string[] {
  const seen = new Set([norm(answer)]);
  const out: string[] = [];
  for (const p of shuffle(pool)) {
    const k = norm(p);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length === n) break;
  }
  return shuffle([answer, ...out]);
}

/** For each wrong option, a note built by looking it up: "«X» means “Y”". */
function explain(answer: string, opts: string[], lookup: (o: string) => string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of opts) {
    if (o === answer) continue;
    const note = lookup(o);
    if (note) out[o] = note;
  }
  return out;
}

const ORDER: MoveQuestion["kind"][] = ["word", "meaning", "gap", "say", "listen", "word-ru"];

/** The next unused question; rotates through question types so consecutive moves feel different. */
export function nextQuestion(pool: QuestionPool, used: Set<string>, n: number, forms: Forms): MoveQuestion | null {
  const lineRu = (l: QuestionPool["lines"][number]) => (forms === "f" && l.ruF ? l.ruF : l.ru);
  for (let k = 0; k < ORDER.length; k++) {
    const kind = ORDER[(n + k) % ORDER.length];
    const q = build(kind);
    if (q) {
      used.add(q.key);
      return q;
    }
  }
  return null;

  function build(kind: MoveQuestion["kind"]): MoveQuestion | null {
    if (kind === "word" || kind === "word-ru") {
      const v = shuffle(pool.vocab).find((x) => !used.has("v:" + x.id));
      if (!v || pool.vocab.length < 4) return null;
      if (kind === "word") {
        const opts = options(v.en, pool.vocab.map((x) => x.en));
        const why = explain(v.en, opts, (o) => {
          const w = pool.vocab.find((x) => x.en === o);
          return w && `“${o}” is «${w.stressed}». «${v.stressed}» means “${v.en}”.`;
        });
        return { key: "v:" + v.id, kind, level: v.level, prompt: "What does this word mean?", show: v.stressed, answer: v.en, options: opts, ruOptions: false, reveal: { ru: v.stressed, en: v.en }, why };
      }
      const opts = options(v.stressed, pool.vocab.map((x) => x.stressed));
      const why = explain(v.stressed, opts, (o) => {
        const w = pool.vocab.find((x) => x.stressed === o);
        return w && `«${o}» means “${w.en}”. “${v.en}” is «${v.stressed}».`;
      });
      return { key: "v:" + v.id, kind, level: v.level, prompt: "How do you say this in Russian?", showEn: v.en, answer: v.stressed, options: opts, ruOptions: true, reveal: { ru: v.stressed, en: v.en }, why };
    }
    if (kind === "gap") {
      const d = shuffle(pool.drills).find((x) => !used.has("d:" + x.q));
      if (!d) return null;
      return { key: "d:" + d.q, kind, level: d.level, prompt: "Choose the word that fits", show: d.q, showEn: d.en, answer: d.answer, options: shuffle([...new Set(d.options)]), ruOptions: true, reveal: { ru: d.q.replace("___", d.answer), en: d.en }, why: d.why ?? {} };
    }
    const l = shuffle(pool.lines).find((x) => !used.has("l:" + x.ru));
    if (!l || pool.lines.length < 4) return null;
    const ru = lineRu(l);
    const rus = pool.lines.map(lineRu);
    const meaningOf = (o: string) => pool.lines.find((x) => lineRu(x) === o)?.en;
    if (kind === "meaning") {
      const opts = options(l.en, pool.lines.map((x) => x.en));
      const why = explain(l.en, opts, (o) => {
        const x = pool.lines.find((y) => y.en === o);
        return x && `“${o}” would be «${lineRu(x)}».`;
      });
      return { key: "l:" + l.ru, kind, level: l.level, prompt: "What does this mean?", show: ru, answer: l.en, options: opts, ruOptions: false, reveal: { ru, en: l.en }, why };
    }
    const opts = options(ru, rus);
    if (kind === "say") {
      const why = explain(ru, opts, (o) => meaningOf(o) && `That one means “${meaningOf(o)}”.`);
      return { key: "l:" + l.ru, kind, level: l.level, prompt: "How do you say this in Russian?", showEn: l.en, answer: ru, options: opts, ruOptions: true, reveal: { ru, en: l.en }, why };
    }
    const why = explain(ru, opts, (o) => meaningOf(o) && `That one means “${meaningOf(o)}”. Tap Play again and listen for the difference.`);
    return { key: "l:" + l.ru, kind: "listen", level: l.level, prompt: "Listen. What did you hear?", audio: ru, answer: ru, options: opts, ruOptions: true, reveal: { ru, en: l.en }, why };
  }
}
