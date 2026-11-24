// Compiles content/*.txt into the curriculum seed migration.
//   node scripts/build-content.mjs          -> writes the migration
//   node scripts/build-content.mjs --check  -> validates only
// Format: see content/README.md
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CONTENT = path.join(ROOT, "content");
const OUT = path.join(ROOT, "supabase/migrations/20261124000500_curriculum_seed.sql");
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

const VOWELS_UP = "АЕЁИОУЫЭЮЯ";
const LAT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};
const slugify = (s) =>
  [...s.toLowerCase().replace(/́/g, "")].map((c) => LAT[c] ?? c).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "пЕшка" -> "пе́шка", "^москвА" -> "Москва́". Returns { stressed, plain }. */
function stress(src, where) {
  let cap = false;
  if (src.startsWith("^")) {
    cap = true;
    src = src.slice(1);
  }
  let out = "";
  for (const ch of src) {
    if (ch === "Ё") out += "ё";
    else if (VOWELS_UP.includes(ch)) out += ch.toLowerCase() + "́";
    else if (/[А-Я]/.test(ch)) {
      fail(where, `uppercase consonant in "${src}"`);
      out += ch.toLowerCase();
    } else out += ch;
  }
  if (cap) out = out[0].toUpperCase() + out.slice(1);
  return { stressed: out, plain: out.replace(/́/g, "") };
}

function seededShuffle(arr, seed) {
  const a = [...arr];
  let h = crypto.createHash("sha256").update(seed).digest();
  for (let i = a.length - 1; i > 0; i--) {
    const j = h[i % h.length] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
    if (i % 16 === 0) h = crypto.createHash("sha256").update(h).digest();
  }
  return a;
}

const TOKEN_VARIANT = /^([«("„]*)([^{]*)\{([^}]+)\}(.*)$/;
/** "Я|I бы|would хотел{хотела}|like кофе|coffee = I'd like coffee" */
function parseSentence(raw, where) {
  let s = raw.trim();
  let tag;
  const tm = s.match(/^@(formal|informal|spoken)\s+/);
  if (tm) {
    tag = tm[1];
    s = s.slice(tm[0].length);
  }
  let speaker;
  const sm = s.match(/^([А-ЯЁ][а-яё]+):\s+/);
  if (sm) {
    speaker = sm[1];
    s = s.slice(sm[0].length);
  }
  const eq = s.lastIndexOf(" = ");
  if (eq < 0) {
    fail(where, `missing " = English" in: ${raw}`);
    return null;
  }
  const left = s.slice(0, eq).trim();
  const en = s.slice(eq + 3).trim();
  const words = [];
  let hasF = false;
  for (const tok of left.split(/\s+/)) {
    const bar = tok.indexOf("|");
    const ruPart = bar >= 0 ? tok.slice(0, bar) : tok;
    const gloss = bar >= 0 ? tok.slice(bar + 1).replace(/_/g, " ") : "";
    const v = ruPart.match(TOKEN_VARIANT);
    let m = ruPart;
    let f;
    if (v) {
      m = v[1] + v[2] + v[4];
      f = v[1] + v[3] + v[4];
      hasF = true;
    }
    if (/[а-яёa-z]/i.test(m) && bar < 0) fail(where, `word without gloss "${m}" in: ${raw}`);
    words.push(f ? { ru: m, f, en: gloss } : { ru: m, en: gloss });
  }
  const ru = words.map((w) => w.ru).join(" ");
  const line = { ru, en, words };
  if (hasF) line.ruF = words.map((w) => w.f ?? w.ru).join(" ");
  if (speaker) line.speaker = speaker;
  if (tag) line.tag = tag;
  if (!en) fail(where, `empty translation in: ${raw}`);
  return line;
}

// ---------------------------------------------------------------- lessons
const lessons = [];
const vocab = [];
const vocabByRu = new Map();
const lessonIds = new Set();

function parseLessons(file, level) {
  const text = fs.readFileSync(path.join(CONTENT, file), "utf8");
  const blocks = text.split(/^# lesson /m).slice(1);
  let sort = 0;
  for (const block of blocks) {
    const lines = block.split("\n");
    const [id, category, title, titleRu] = lines[0].split("|").map((x) => x.trim());
    const where = `${file}:${id}`;
    if (!id?.startsWith(level.toLowerCase() + "-")) fail(where, "lesson id must start with its level");
    if (lessonIds.has(id)) fail(where, "duplicate lesson id");
    lessonIds.add(id);
    sort += 1;
    const lesson = { id, level, category, title, titleRu, summary: "", sort, content: { intro: "", sections: [], drills: [] }, vocab: [] };
    let section = null;
    let mode = null;
    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("summary:")) { lesson.summary = line.slice(8).trim(); continue; }
      if (line.startsWith("intro:")) { lesson.content.intro = line.slice(6).trim(); continue; }
      if (line.startsWith("partner:")) { lesson.partner = line.slice(8).trim(); continue; }
      const h = line.match(/^## (dialogue|phrases|conversation|grammar|drills|vocab)(?::\s*(.*))?$/);
      if (h) {
        mode = h[1];
        if (mode === "dialogue" || mode === "phrases" || mode === "conversation") {
          section = { type: "lines", kind: mode, title: h[2] ?? "", lines: [] };
          lesson.content.sections.push(section);
        } else if (mode === "grammar") {
          section = { type: "grammar", title: h[2] ?? "", paragraphs: [], examples: [] };
          lesson.content.sections.push(section);
        }
        continue;
      }
      if (mode === "dialogue" || mode === "phrases" || mode === "conversation") {
        if (line.startsWith(">")) {
          const prev = section.lines.at(-1);
          if (!prev) fail(where, "note before any line");
          else prev.note = line.slice(1).trim();
          continue;
        }
        if (line.startsWith("+")) {
          // "+ Russian follow-up question? = English" — something else you could ask after this answer
          const prev = section.lines.at(-1);
          const eq = line.lastIndexOf(" = ");
          const ru = line.slice(1, eq).trim();
          const en = line.slice(eq + 3).trim();
          if (mode !== "conversation") fail(where, `follow-ups only belong in conversations: ${line}`);
          else if (!prev) fail(where, "follow-up before any line");
          else if (eq < 0 || !ru || !en) fail(where, `bad follow-up (use "+ Вопрос? = Question?"): ${line}`);
          else if (!ru.endsWith("?") || !en.endsWith("?")) fail(where, `a follow-up is a question: ${line}`);
          else {
            // "был{была}" gives the masculine and feminine forms, as in sentences
            const f = { ru: ru.replace(/([^\s{]*)\{([^}]+)\}/g, "$1"), en };
            if (ru.includes("{")) f.ruF = ru.replace(/([^\s{]*)\{([^}]+)\}/g, (_, m, fem) => fem);
            (prev.follow ??= []).push(f);
          }
          continue;
        }
        const s = parseSentence(line, where);
        if (s) section.lines.push(s);
      } else if (mode === "grammar") {
        if (line.startsWith("ex:")) {
          const [ru, en] = line.slice(3).split(" = ").map((x) => x?.trim());
          if (!ru || !en) fail(where, `bad example: ${line}`);
          else section.examples.push({ ru, en });
        } else section.paragraphs.push(line);
      } else if (mode === "drills") {
        if (line.startsWith(">")) {
          // "> wrong option: why it doesn't fit" — shown when a learner picks that option
          const d = lesson.content.drills.at(-1);
          const m = line.slice(1).trim().match(/^(.+?):\s+(.+)$/);
          if (!d) fail(where, "drill note before any drill");
          else if (!m) fail(where, `bad drill note (use "> option: why"): ${line}`);
          else if (m[1] === d.answer || !d.options.includes(m[1])) fail(where, `drill note for "${m[1]}", which isn't a wrong option of: ${d.q}`);
          else (d.why ??= {})[m[1]] = m[2];
          continue;
        }
        if (!line.startsWith("?")) { fail(where, `bad drill: ${line}`); continue; }
        const parts = line.slice(1).split("|").map((x) => x.trim());
        if (parts.length !== 4) { fail(where, `drill needs 4 parts: ${line}`); continue; }
        const [q, answer, wrong, en] = parts;
        const distractors = wrong.split(",").map((x) => x.trim()).filter(Boolean);
        if (!q.includes("___")) fail(where, `drill without ___: ${q}`);
        if (distractors.includes(answer)) fail(where, `drill answer repeated in options: ${q}`);
        if (new Set(distractors).size !== distractors.length) fail(where, `duplicate drill options: ${q}`);
        const options = seededShuffle([answer, ...distractors], id + q);
        lesson.content.drills.push({ q, answer, options, en });
      } else if (mode === "vocab") {
        const [src, en, pos = "", note = ""] = line.split("|").map((x) => x.trim());
        if (!src || !en) { fail(where, `bad vocab: ${line}`); continue; }
        const { stressed, plain } = stress(src, where);
        const key = plain.toLowerCase();
        const prior = vocabByRu.get(key);
        if (prior && prior.pos === pos) continue; // already taught in an earlier lesson
        let vid = slugify(plain);
        while (vocab.some((v) => v.id === vid)) vid += "-2";
        const item = { id: vid, ru: plain, stressed, en, pos, note, level, lesson_id: id, tags: [] };
        if (category.startsWith("chess")) item.tags.push("chess");
        item.tags.push(category);
        vocab.push(item);
        vocabByRu.set(key, item);
        lesson.vocab.push(item);
      } else fail(where, `content outside a section: ${line}`);
    }
    let exchange = 0;
    for (const sec of lesson.content.sections) {
      if (sec.kind !== "conversation") continue;
      if (sec.lines.length < 2 || sec.lines.length % 2) fail(where, `conversation "${sec.title}" must be question/answer pairs`);
      for (let k = 0; k + 1 < sec.lines.length; k += 2) {
        const q = sec.lines[k];
        const a = sec.lines[k + 1];
        exchange += 1;
        q.role = "q";
        a.role = "a";
        q.x = a.x = `${id}:${exchange}`;
        if (!q.ru.trim().endsWith("?")) fail(where, `question doesn't end with "?": ${q.ru}`);
        if (!q.speaker || !a.speaker || q.speaker === a.speaker) fail(where, `a question and its answer need two different speakers: ${q.ru}`);
        if (q.follow?.length) fail(where, `put follow-ups under the answer, not the question: ${q.ru}`);
        if (!a.note) fail(where, `answer needs a "> note" (grammar or usage): ${a.ru}`);
        const hasNext = k + 2 < sec.lines.length;
        if ((a.follow?.length ?? 0) + (hasNext ? 1 : 0) < 2) fail(where, `answer needs at least two follow-ups (the next question counts as one): ${a.ru}`);
      }
    }
    if (lesson.content.sections.some((s) => s.kind === "conversation") && !lesson.partner) fail(where, "conversation lessons need a partner: line");
    if (!lesson.summary) fail(where, "missing summary");
    if (!lesson.content.sections.some((s) => s.type === "lines")) fail(where, "no sentences");
    if (lesson.content.drills.length < 2) fail(where, "needs at least 2 drills");
    for (const d of lesson.content.drills)
      for (const o of d.options)
        if (o !== d.answer && !d.why?.[o]) fail(where, `drill "${d.q}" needs a "> ${o}: why" note`);
    lessons.push(lesson);
  }
}

for (const lv of ["A1", "A2", "B1", "B2"]) parseLessons(lv.toLowerCase() + ".txt", lv);

// ---------------------------------------------------------------- conversations
// Linking words the conversation lessons teach (also shown as chips in the app).
const CONNECTORS = [
  ["потому что", "because"], ["поэтому", "so, that's why"], ["например", "for example"], ["кстати", "by the way"],
  ["на самом деле", "actually"], ["сначала", "first"], ["потом", "then"], ["после этого", "after that"],
  ["хотя", "although"], ["если", "if"], ["кроме того", "besides"], ["в общем", "all in all, basically"],
  ["честно говоря", "to be honest"], ["с одной стороны", "on the one hand"], ["с другой стороны", "on the other hand"],
];
const normRu = (t) => t.toLowerCase().replace(/́/g, "").replace(/ё/g, "е").replace(/[^а-яa-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const hasPhrase = (text, p) => ` ${normRu(text)} `.includes(` ${normRu(p)} `);
const exchanges = [];
{
  const older = new Set(); // every sentence in the non-conversation material
  for (const l of lessons)
    for (const sec of l.content.sections)
      if (sec.type === "lines" && sec.kind !== "conversation") for (const ln of sec.lines) older.add(normRu(ln.ru));
  for (const l of lessons) {
    for (const sec of l.content.sections) {
      if (sec.kind !== "conversation") continue;
      for (let k = 0; k + 1 < sec.lines.length; k += 2) {
        const [q, a] = [sec.lines[k], sec.lines[k + 1]];
        exchanges.push({ id: q.x, lesson: l.id, level: l.level, category: l.category, topic: l.title, topicRu: l.titleRu, section: sec.title, partner: l.partner, q, a });
      }
    }
  }
  const byQ = new Map();
  for (const x of exchanges) {
    const key = normRu(x.q.ru);
    if (byQ.has(key)) fail(x.id, `question asked twice (also ${byQ.get(key).id}): ${x.q.ru}`);
    if (older.has(key)) fail(x.id, `question already taught in an earlier lesson: ${x.q.ru}`);
    byQ.set(key, x);
  }
  exchanges.forEach((x, n) => {
    const after = exchanges[n + 1];
    if (after && after.lesson === x.lesson && after.section === x.section) x.next = after.id;
    for (const f of x.a.follow ?? []) {
      const hit = byQ.get(normRu(f.ru));
      if (hit && hit.id !== x.id) Object.assign(f, { link: hit.id, linkTopic: hit.topic, linkLevel: hit.level });
    }
    x.connectors = CONNECTORS.filter(([c]) => hasPhrase(x.a.ru, c)).map(([c]) => c);
  });
  for (const [c] of CONNECTORS) {
    const n = exchanges.filter((x) => x.connectors.includes(c)).length;
    if (exchanges.length && n < 2) fail("conversations", `connector «${c}» is used in only ${n} answer(s); use it at least twice`);
  }
}

// ---------------------------------------------------------------- tests
const tests = [];
{
  const text = fs.readFileSync(path.join(CONTENT, "tests.txt"), "utf8");
  let sort = 0;
  for (const block of text.split(/^# test /m).slice(1)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const [id, title, summary, pass] = lines[0].split("|").map((x) => x.trim());
    sort += 1;
    const test = { id, level: id === "placement" ? null : id, title, summary, pass_pct: Number(pass), sort, items: [] };
    lines.slice(1).forEach((l, i) => {
      const where = `tests.txt:${id}#${i + 1}`;
      const parts = l.replace(/^\?\s*/, "").split("|").map((x) => x.trim());
      const [lvl, kind, prompt, ru, ...opts] = parts;
      const correct = opts.filter((o) => o.endsWith("*"));
      if (correct.length !== 1) fail(where, "exactly one option must end with *");
      if (!["reading", "listening", "grammar", "vocab"].includes(kind)) fail(where, `bad kind ${kind}`);
      if (kind === "listening" && !ru) fail(where, "listening item needs Russian text");
      const clean = opts.map((o) => o.replace(/\*$/, "").trim());
      const right = correct[0]?.replace(/\*$/, "").trim();
      const shuffled = seededShuffle(clean, id + i + prompt);
      test.items.push({ id: `${id.toLowerCase()}-${String(i + 1).padStart(2, "0")}`, sort: i + 1, level: lvl, kind, prompt, ru: ru || null, options: shuffled, answer: shuffled.indexOf(right) });
    });
    tests.push(test);
  }
}

// ---------------------------------------------------------------- scenarios
const scenarios = [];
{
  const text = fs.readFileSync(path.join(CONTENT, "scenarios.txt"), "utf8");
  const sorts = {};
  for (const block of text.split(/^# scenario /m).slice(1)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const [id, level, category, title, titleRu, role] = lines[0].split("|").map((x) => x.trim());
    const where = `scenarios.txt:${id}`;
    sorts[level] = (sorts[level] ?? 0) + 1;
    const sc = { id, level, category, title, titleRu, role, description: "", sort: sorts[level], script: [] };
    for (const l of lines.slice(1)) {
      if (l.startsWith("desc:")) sc.description = l.slice(5).trim();
      else if (l.startsWith("T:")) {
        const [ru, en] = l.slice(2).split(" = ").map((x) => x?.trim());
        if (!ru || !en) fail(where, `bad tutor line: ${l}`);
        sc.script.push({ who: "tutor", ru, en });
      } else if (l.startsWith("U:")) {
        const eq = l.indexOf(" = ");
        const hint = l.slice(2, eq).trim();
        const answers = l.slice(eq + 3).split("|").map((x) => x.trim()).filter(Boolean);
        if (eq < 0 || !answers.length) fail(where, `bad user line: ${l}`);
        sc.script.push({ who: "user", hint, answers });
      } else fail(where, `unknown line: ${l}`);
    }
    if (sc.script[0]?.who !== "tutor") fail(where, "script must start with the tutor");
    scenarios.push(sc);
  }
}

// Every conversation lesson is also a guided conversation (and an AI-tutor scenario): the partner
// asks the lesson's questions in order and your replies are compared with the model answers.
for (const l of lessons) {
  const xs = exchanges.filter((x) => x.lesson === l.id);
  if (!xs.length) continue;
  const level = l.level;
  const sort = scenarios.filter((s) => s.level === level).length + 1;
  const script = xs.flatMap((x) => [
    { who: "tutor", ru: x.q.ru, en: x.q.en },
    { who: "user", hint: `Answer: “${x.a.en}”`, answers: [...new Set([x.a.ru, x.a.ruF].filter(Boolean))] },
  ]);
  script.push({ who: "tutor", ru: "Спасибо, было интересно поговорить!", en: "Thanks, it was nice talking!" });
  scenarios.push({ id: `talk-${l.id}`, level, category: l.category, title: l.title, titleRu: l.titleRu, role: l.partner, description: l.summary, sort, script });
}

// ---------------------------------------------------------------- pronunciation
const milestones = [];
{
  const text = fs.readFileSync(path.join(CONTENT, "pronunciation.txt"), "utf8");
  const sorts = {};
  for (const block of text.split(/^# milestone /m).slice(1)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const [id, level, title, pass, focus] = lines[0].split("|").map((x) => x.trim());
    const where = `pronunciation.txt:${id}`;
    sorts[level] = (sorts[level] ?? 0) + 1;
    const m = { id, level, title, pass_count: Number(pass), focus: focus.split(",").map((x) => x.trim()), summary: "", sort: sorts[level], items: [] };
    for (const l of lines.slice(1)) {
      if (l.startsWith("summary:")) m.summary = l.slice(8).trim();
      else if (l.startsWith("- ")) {
        const [left, tip] = l.slice(2).split(" ~ ");
        const [ru, en] = left.split(" = ").map((x) => x.trim());
        if (!ru || !en || !tip) fail(where, `bad item: ${l}`);
        m.items.push({ ru, en, tip: tip?.trim() });
      } else fail(where, `unknown line: ${l}`);
    }
    if (m.pass_count > m.items.length) fail(where, "pass count larger than item count");
    milestones.push(m);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} content error(s).`);
  process.exit(1);
}

const lineCount = (l) => l.content.sections.filter((s) => s.type === "lines").reduce((n, s) => n + s.lines.length, 0);
console.log(
  `lessons ${lessons.length} · sentences ${lessons.reduce((n, l) => n + lineCount(l), 0)} · vocab ${vocab.length} · ` +
    `drills ${lessons.reduce((n, l) => n + l.content.drills.length, 0)} · test items ${tests.reduce((n, t) => n + t.items.length, 0)} · ` +
    `scenarios ${scenarios.length} · pronunciation items ${milestones.reduce((n, m) => n + m.items.length, 0)}`,
);
const linked = exchanges.reduce((n, x) => n + (x.a.follow ?? []).filter((f) => f.link).length, 0);
console.log(
  `conversations: ${exchanges.length} questions (A1 ${exchanges.filter((x) => x.level === "A1").length}, A2 ${exchanges.filter((x) => x.level === "A2").length}) · ` +
    `follow-ups ${exchanges.reduce((n, x) => n + (x.a.follow?.length ?? 0), 0)} (${linked} lead into another conversation)`,
);
if (process.argv.includes("--check")) process.exit(0);

// ---------------------------------------------------------------- talk bank (bundled with the app)
const TALK_OUT = path.join(ROOT, "src/generated/talk.json");
fs.mkdirSync(path.dirname(TALK_OUT), { recursive: true });
const strip = ({ role, x, follow, ...line }) => line; // eslint-disable-line no-unused-vars
fs.writeFileSync(
  TALK_OUT,
  JSON.stringify({
    connectors: CONNECTORS.map(([ru, en]) => ({ ru, en })),
    exchanges: exchanges.map((x) => ({
      id: x.id, lesson: x.lesson, level: x.level, category: x.category, topic: x.topic, topicRu: x.topicRu, partner: x.partner,
      q: strip(x.q), a: strip(x.a), note: x.a.note ?? "", follow: x.a.follow ?? [], next: x.next ?? null, connectors: x.connectors,
      vocab: vocab.filter((v) => v.lesson_id === x.lesson && (hasPhrase(x.q.ru, v.ru) || hasPhrase(x.a.ru, v.ru) || hasPhrase(x.a.ruF ?? "", v.ru))).map((v) => ({ ru: v.ru, stressed: v.stressed, en: v.en })),
    })),
  }),
);
console.log("wrote " + path.relative(ROOT, TALK_OUT));

// ---------------------------------------------------------------- SQL
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
const arr = (a) => `array[${a.map(q).join(",")}]::text[]`;
let sql = `-- =====================================================================
-- Russian Chess Academy — curriculum content (GENERATED, do not edit)
-- Source: content/*.txt · build: npm run content
-- =====================================================================\n\n`;

sql += "insert into public.lessons (id, level, category_id, sort, title, title_ru, summary, content, line_count, vocab_count) values\n";
sql += lessons
  .map((l) => `  (${q(l.id)}, ${q(l.level)}, ${q(l.category)}, ${l.sort}, ${q(l.title)}, ${q(l.titleRu)}, ${q(l.summary)}, ${j(l.content)}, ${lineCount(l)}, ${l.vocab.length})`)
  .join(",\n");
sql += `\non conflict (id) do update set level = excluded.level, category_id = excluded.category_id, sort = excluded.sort,
  title = excluded.title, title_ru = excluded.title_ru, summary = excluded.summary, content = excluded.content,
  line_count = excluded.line_count, vocab_count = excluded.vocab_count;\n\n`;

sql += "insert into public.vocab (id, ru, stressed, en, pos, note, tags, level, lesson_id) values\n";
sql += vocab.map((v) => `  (${q(v.id)}, ${q(v.ru)}, ${q(v.stressed)}, ${q(v.en)}, ${q(v.pos)}, ${q(v.note)}, ${arr(v.tags)}, ${q(v.level)}, ${q(v.lesson_id)})`).join(",\n");
sql += `\non conflict (id) do update set ru = excluded.ru, stressed = excluded.stressed, en = excluded.en, pos = excluded.pos,
  note = excluded.note, tags = excluded.tags, level = excluded.level, lesson_id = excluded.lesson_id;\n\n`;

sql += "insert into public.tests (id, level, title, summary, pass_pct, sort) values\n";
sql += tests.map((t) => `  (${q(t.id)}, ${q(t.level)}, ${q(t.title)}, ${q(t.summary)}, ${t.pass_pct}, ${t.sort})`).join(",\n");
sql += "\non conflict (id) do update set level = excluded.level, title = excluded.title, summary = excluded.summary, pass_pct = excluded.pass_pct, sort = excluded.sort;\n\n";

sql += "insert into public.test_items (id, test_id, sort, level, kind, prompt, ru, options, answer) values\n";
sql += tests
  .flatMap((t) => t.items.map((i) => `  (${q(i.id)}, ${q(t.id)}, ${i.sort}, ${q(i.level)}, ${q(i.kind)}, ${q(i.prompt)}, ${q(i.ru)}, ${j(i.options)}, ${i.answer})`))
  .join(",\n");
sql += "\non conflict (id) do update set test_id = excluded.test_id, sort = excluded.sort, level = excluded.level, kind = excluded.kind,\n  prompt = excluded.prompt, ru = excluded.ru, options = excluded.options, answer = excluded.answer;\n\n";

sql += "insert into public.conversation_scenarios (id, level, category_id, sort, title, title_ru, description, tutor_role, script) values\n";
sql += scenarios
  .map((s) => `  (${q(s.id)}, ${q(s.level)}, ${q(s.category)}, ${s.sort}, ${q(s.title)}, ${q(s.titleRu)}, ${q(s.description)}, ${q(s.role)}, ${j(s.script)})`)
  .join(",\n");
sql += "\non conflict (id) do update set level = excluded.level, category_id = excluded.category_id, sort = excluded.sort, title = excluded.title,\n  title_ru = excluded.title_ru, description = excluded.description, tutor_role = excluded.tutor_role, script = excluded.script;\n\n";

sql += "insert into public.pron_milestones (id, level, sort, title, summary, focus, items, pass_count) values\n";
sql += milestones
  .map((m) => `  (${q(m.id)}, ${q(m.level)}, ${m.sort}, ${q(m.title)}, ${q(m.summary)}, ${arr(m.focus)}, ${j(m.items)}, ${m.pass_count})`)
  .join(",\n");
sql += "\non conflict (id) do update set level = excluded.level, sort = excluded.sort, title = excluded.title, summary = excluded.summary,\n  focus = excluded.focus, items = excluded.items, pass_count = excluded.pass_count;\n";

fs.writeFileSync(OUT, sql);
console.log("wrote " + path.relative(ROOT, OUT) + ` (${(sql.length / 1024).toFixed(0)} KB)`);
