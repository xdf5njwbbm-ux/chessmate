// Parses the role-play content (a small line-based format, see content/*.ts) into a Bank.
//
//   @char <id> <m|f> <ty|vy>         name: Ru | En   about: …   <answer-key>: ru | en
//   @topic <id>                      stems: a, b   react: ru | en   like/dislike/callback: ru | en
//   @scenario <id> <lvl> <ty|vy> <char>   title: Ru | En   about: …   goal: …   end: ru | en
//   @openers <lvl>   @quick <lvl>
// Beats (inside topics, scenarios, openers, quick):
//   > [B1] [ask] ru | en      the line the partner says (optionally its level / "player asks" flag)
//   - ru | en                 simpler version (Beginner mode)
//   ~ ru | en                 native version (Native Speaker mode)
//   = ru | en // why          a natural answer, and why it sounds good
//   ? good, tired: ru | en    a reaction when the answer means that   (? else: …)
//   * ru = en                 a word the line teaches
//   ! English tip
// {m|f} picks the learner's form, {{m|f}} the speaker's.

import type { Bank, Beat, Character, Cond, Lvl, Scenario, T, Topic } from "./types.ts";

const COND = new Set(["good", "bad", "ok", "tired", "sick", "busy", "yes", "no", "q", "askback", "number", "dontknow", "like", "dislike", "agree", "disagree", "thanks", "short", "long", "name"]);

function pair(s: string, where: string): T {
  const i = s.indexOf(" | ");
  if (i < 0) throw new Error(`Missing " | " in ${where}: ${s}`);
  const ru = s.slice(0, i).trim();
  const en = s.slice(i + 3).trim();
  if (!ru || !en) throw new Error(`Empty side in ${where}: ${s}`);
  return { ru, en };
}

export function parseBank(...sources: string[]): Bank {
  const bank: Bank = { chars: {}, topics: {}, scenarios: [], openers: [], quick: [] };
  for (const src of sources) parseInto(bank, src);
  return bank;
}

function parseInto(bank: Bank, src: string) {
  let char: Character | null = null;
  let topic: Topic | null = null;
  let scen: Scenario | null = null;
  let list: Beat[] | null = null;
  let prefix = "";
  let level: Lvl = "A2";
  let beat: Beat | null = null;
  let n = 0;
  const where = () => `${prefix || "?"} beat ${n}`;

  const lines = src.split("\n");
  for (let k = 0; k < lines.length; k++) {
    const raw = lines[k];
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const at = `line ${k + 1}`;

    if (line.startsWith("@")) {
      const [kind, ...a] = line.slice(1).split(/\s+/);
      char = topic = scen = null;
      list = null;
      beat = null;
      n = 0;
      if (kind === "char") {
        char = { id: a[0], g: a[1] as "m" | "f", vy: a[2] === "vy", name: { ru: "", en: "" }, about: "", answers: {} };
        bank.chars[char.id] = char;
      } else if (kind === "topic") {
        topic = { id: a[0], stems: [], react: [], beats: [] };
        bank.topics[topic.id] = topic;
        list = topic.beats;
        prefix = `t.${topic.id}`;
        level = "A2";
      } else if (kind === "scenario") {
        scen = { id: a[0], level: a[1] as Lvl, vy: a[2] === "vy", char: a[3], title: { ru: "", en: "" }, about: "", goal: "", end: { ru: "", en: "" }, beats: [] };
        bank.scenarios.push(scen);
        list = scen.beats;
        prefix = `s.${scen.id}`;
        level = scen.level;
      } else if (kind === "openers" || kind === "quick") {
        list = kind === "openers" ? bank.openers : bank.quick;
        prefix = kind === "openers" ? `op.${a[0]}` : `qk.${a[0]}`;
        level = a[0] as Lvl;
      } else throw new Error(`Unknown section @${kind} (${at})`);
      continue;
    }

    const sym = line[0];
    const rest = line.slice(1).trim();

    if (sym === ">") {
      if (!list) throw new Error(`Beat outside a section (${at})`);
      let s = rest;
      let lv: Lvl = level;
      let ask = false;
      for (;;) {
        const m = s.match(/^\[(A1|A2|B1|B2|ask)\]\s*/);
        if (!m) break;
        if (m[1] === "ask") ask = true;
        else lv = m[1] as Lvl;
        s = s.slice(m[0].length);
      }
      n++;
      beat = { id: `${prefix}:${n}`, level: lv, ai: pair(s, where()), models: [], reactions: [], words: [], ask: ask || undefined, topic: topic?.id };
      list.push(beat);
      continue;
    }

    if ("-~=?*!".includes(sym) && beat) {
      if (sym === "-") beat.easy = pair(rest, where());
      else if (sym === "~") beat.native = pair(rest, where());
      else if (sym === "=") {
        const w = rest.indexOf(" // ");
        const body = w >= 0 ? rest.slice(0, w) : rest;
        beat.models.push({ ...pair(body, where()), why: w >= 0 ? rest.slice(w + 4).trim() : undefined });
      } else if (sym === "?") {
        const c = rest.indexOf(":");
        if (c < 0) throw new Error(`Reaction without ":" (${at})`);
        const head = rest.slice(0, c).trim();
        const say = pair(rest.slice(c + 1).trim(), where());
        if (head === "else") beat.reactions.push({ when: "else", say });
        else {
          const conds = head.split(",").map((x) => x.trim()) as Cond[];
          for (const x of conds) if (!COND.has(x) && !/^(topic|has)=\S+$/.test(x)) throw new Error(`Unknown condition "${x}" (${at})`);
          beat.reactions.push({ when: conds, say });
        }
      } else if (sym === "*") {
        const e = rest.indexOf(" = ");
        if (e < 0) throw new Error(`Word without " = " (${at})`);
        beat.words.push({ ru: rest.slice(0, e).trim(), en: rest.slice(e + 3).trim() });
      } else if (sym === "!") beat.tip = rest;
      continue;
    }

    const c = line.indexOf(":");
    if (c < 0) throw new Error(`Can't read ${at}: ${line}`);
    const key = line.slice(0, c).trim();
    const val = line.slice(c + 1).trim();
    if (char) {
      if (key === "name") char.name = pair(val, at);
      else if (key === "about") char.about = val;
      else char.answers[key] = pair(val, `${char.id}.${key}`);
    } else if (topic && !beat) {
      if (key === "stems") topic.stems = val.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      else if (key === "react") topic.react.push(pair(val, at));
      else if (key === "like" || key === "dislike" || key === "callback") topic[key] = pair(val, at);
      else throw new Error(`Unknown topic key ${key} (${at})`);
    } else if (scen && !beat) {
      if (key === "title") scen.title = pair(val, at);
      else if (key === "about") scen.about = val;
      else if (key === "goal") scen.goal = val;
      else if (key === "end") scen.end = pair(val, at);
      else throw new Error(`Unknown scenario key ${key} (${at})`);
    } else throw new Error(`Unexpected "${key}:" (${at})`);
  }
}

/** Picks the learner's {m|f} and the speaker's {{m|f}} forms. */
export function form(s: string, learner: "m" | "f", speaker: "m" | "f" = "f"): string {
  return s
    .replace(/\{\{([^{}|]*)\|([^{}|]*)\}\}/g, (_, m, f) => (speaker === "f" ? f : m))
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m, f) => (learner === "f" ? f : m));
}
