// node --experimental-strip-types src/lib/roleplay/roleplay.test.ts
import assert from "node:assert/strict";
import { BANK, LEX } from "./bank.ts";
import { form } from "./parse.ts";
import { check, realFixes } from "./correct.ts";
import { understand, script } from "./understand.ts";
import { newMemory, newState, open, respond, remark, hints, nextScenario, type Memory, type State } from "./engine.ts";

let passed = 0;
const t = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
};

// ---------------------------------------------------------------- content
t("content: hundreds of questions, every listed scenario, all characters exist", () => {
  const beats = [...BANK.scenarios.flatMap((s) => s.beats), ...Object.values(BANK.topics).flatMap((x) => x.beats), ...BANK.openers, ...BANK.quick];
  assert.ok(beats.length >= 230, `beats ${beats.length}`);
  assert.ok(beats.reduce((a, b) => a + b.models.length, 0) >= 450);
  const ids = BANK.scenarios.map((s) => s.id);
  for (const id of ["greet", "meet", "crush", "date", "day", "work", "restaurant", "furniture", "hobbies", "movies", "family", "weekend", "travel", "chess", "feelings", "jokes", "disagree", "goals", "howfeel"]) assert.ok(ids.includes(id), id);
  for (const s of BANK.scenarios) {
    assert.ok(BANK.chars[s.char], `${s.id} char`);
    assert.ok(s.title.ru && s.title.en && s.about && s.goal && s.end.ru, `${s.id} header`);
    assert.ok(s.beats.length >= 5, `${s.id} beats`);
  }
  for (const b of beats) {
    assert.ok(b.models.length >= 1, `${b.id} models`);
    assert.ok(b.reactions.length >= 1, `${b.id} reactions`);
    for (const x of [b.ai, b.easy, b.native, ...b.models, ...b.reactions.map((r) => r.say)]) {
      if (!x) continue;
      for (const g of ["m", "f"] as const) {
        const s = form(x.ru, g, "f");
        assert.ok(!/[{}|]/.test(s), `${b.id}: braces left in «${s}»`);
        assert.ok(!/\[(?!me\]|[^\]]*name)/.test(s), `${b.id}: odd bracket in «${s}»`);
      }
      assert.ok(x.en.length > 1, `${b.id}: English missing`);
    }
  }
  for (const c of Object.values(BANK.chars)) {
    assert.ok(c.name.ru.length < 20 && c.name.en.length < 20, `${c.id} name`);
    for (const k of ["hay", "day", "from", "job", "hobby", "myname", "generic"]) assert.ok(c.answers[k], `${c.id}.${k}`);
  }
  for (const tp of Object.values(BANK.topics)) assert.ok(tp.stems.length && tp.beats.length && tp.react.length, tp.id);
});

t("content: example answers and the partners' lines pass the corrector", () => {
  const ctx: { id: string; models: { ru: string }[]; vy: boolean; sp: "m" | "f" }[] = [];
  for (const s of BANK.scenarios) for (const b of s.beats) ctx.push({ id: b.id, models: b.models, vy: s.vy, sp: BANK.chars[s.char].g });
  for (const b of [...Object.values(BANK.topics).flatMap((x) => x.beats), ...BANK.openers, ...BANK.quick]) ctx.push({ id: b.id, models: b.models, vy: false, sp: "f" });
  for (const c of ctx)
    for (const g of ["m", "f"] as const)
      for (const m of c.models) {
        const text = form(m.ru, g, c.sp).replace(/\[me\]/g, "Алекс");
        const r = check(text, { forms: g, vy: c.vy, lex: LEX });
        assert.equal(r.fixes.length, 0, `${c.id} (${g}) «${text}» → ${r.fixes.map((f) => `${f.from}→${f.to}`).join(", ")}`);
      }
  for (const ch of Object.values(BANK.chars))
    for (const [k, a] of Object.entries(ch.answers)) {
      const r = check(form(a.ru, "m", ch.g), { forms: ch.g, vy: false, lex: LEX });
      assert.equal(realFixes(r.fixes).filter((f) => f.kind !== "formality").length, 0, `${ch.id}.${k}`);
    }
});

// ---------------------------------------------------------------- corrections
t("corrections: the mistakes English speakers make", () => {
  const cases: [string, "m" | "f", boolean, string][] = [
    ["Я работать в магазине", "m", false, "Я работаю в магазине"],
    ["Я нравится шахматы", "m", false, "Мне нравится шахматы"],
    ["Я имею собаку", "m", false, "У меня есть собака"],
    ["Я 25 лет", "m", false, "Мне 25 лет"],
    ["Мне 22 лет", "f", false, "Мне 22 года"],
    ["Я пошёл в спортзале", "m", false, "Я пошёл в спортзал"],
    ["Я был в спортзал", "m", false, "Я был в спортзале"],
    ["Я иду дома", "m", false, "Я иду домой"],
    ["Я люблю играть шахматы", "m", false, "Я люблю играть в шахматы"],
    ["Я играю гитару", "f", false, "Я играю на гитаре"],
    ["Я скучаю тебя", "m", false, "Я скучаю по тебе"],
    ["Я работаю как продавец", "m", false, "Я работаю продавцом"],
    ["Я из Америка", "m", false, "Я из Америки"],
    ["Мой день был хорошо", "m", false, "Мой день был хороший"],
    ["Я чувствую хорошо", "f", false, "Я чувствую себя хорошо"],
    ["Хорошо, и ты?", "m", false, "Хорошо, а ты?"],
    ["Очень спасибо!", "m", false, "Большое спасибо!"],
    ["Я устала", "m", false, "Я устал"],
    ["Я устал", "f", false, "Я устала"],
    ["Я рад", "f", false, "Я рада"],
    ["Привет! А у тебя?", "m", true, "Здравствуйте! А у вас?"],
    ["Добрый утро", "m", false, "Доброе утро"],
    ["Я говорю русский", "m", false, "Я говорю по-русски"],
    ["Как твой дела?", "m", false, "Как твои дела?"],
    ["Сколько ты лет?", "m", false, "Сколько тебе лет?"],
  ];
  for (const [inp, g, vy, out] of cases) assert.equal(check(inp, { forms: g, vy, lex: LEX }).corrected, out, inp);
  // correct sentences stay untouched
  for (const ok of ["Я работал и потом пошёл в спортзал.", "Я была в Москве", "Я смотрю сериал", "Я из села", "Мне нравится играть в шахматы", "Хорошо, спасибо! А у тебя?", "Я хочу работать в Москве"])
    assert.equal(check(ok, { forms: ok.includes("была") ? "f" : "m", vy: false, lex: LEX }).fixes.length, 0, ok);
  // spelling is shown but never counted
  const sp = check("Харашо, спосибо", { forms: "m", vy: false, lex: LEX });
  assert.equal(sp.corrected, "Хорошо, спасибо");
  assert.equal(realFixes(sp.fixes).length, 0);
  for (const f of check("Я работать", { forms: "m", vy: false }).fixes) assert.ok(f.why.length > 20, "explained in English");
});

// ---------------------------------------------------------------- understanding
t("understanding: mood, asking back, topics, names, English and Latin letters", () => {
  const u = (s: string) => understand(s, BANK.topics, LEX);
  assert.ok(u("Хорошо, спасибо. А у тебя?").good && u("Хорошо, спасибо. А у тебя?").askback);
  assert.ok(u("Честно говоря, не очень").bad);
  assert.ok(u("Не могу жаловаться").good);
  assert.ok(u("Потихоньку").ok);
  assert.ok(u("Немного устал").tired && u("Немного устал").bad);
  assert.ok(!u("Не очень хорошо").good);
  assert.deepEqual(u("Я работал и потом пошёл в спортзал").topics.sort(), ["gym", "work"]);
  assert.equal(u("Меня зовут Грант").name, "Грант");
  assert.deepEqual(u("Да, стараюсь ходить пять раз в неделю").numbers, [5]);
  assert.ok(u("Откуда ты?").asks.includes("from"));
  assert.ok(!u("Я играю в шахматы").asks.length, "a topic word alone isn't a question");
  assert.ok(u("I am very tired today").english);
  const tr = script("privet, kak dela?", LEX);
  assert.ok(tr.translit && tr.text === "привет, как дела?", tr.text);
  assert.equal(script("horosho, spasibo", LEX).text, "хорошо, спасибо");
});

// ---------------------------------------------------------------- conversations
const zero = () => 0;
const play = (st: State, mem: Memory, said: string) => respond(st, mem, said, { rand: zero, now: 1_800_000_000_000 });

t("the spec's example: answers are understood and followed up", () => {
  let mem = newMemory();
  let { st, lines } = open(newState({ mode: "roleplay", scenario: "day", forms: "m", level: "A2" }), mem, { rand: zero });
  assert.equal(lines.at(-1)!.ru, "Привет! Как дела?");
  let r = play(st, mem, "Хорошо, спасибо. А у тебя?");
  assert.match(r.turn.reaction[0].ru, /Отлично!.*Нормально, спасибо/);
  assert.ok(r.turn.notes.some((n) => /asked back/.test(n)));
  assert.equal(r.turn.next[0].ru, "Чем ты сегодня занимался?");
  r = play(r.st, r.mem, "Я работал и потом пошёл в спортзал.");
  assert.equal(r.turn.reaction[0].ru, "Здорово!");
  assert.equal(r.turn.next[0].ru, "Ты часто ходишь в спортзал?");
  assert.ok(r.mem.topics.gym, "remembered the gym");
  r = play(r.st, r.mem, "Да, стараюсь ходить пять раз в неделю.");
  assert.match(r.turn.reaction[0].ru, /Отлично/);
  assert.equal(r.turn.next[0].ru, "А что ты обычно тренируешь?");
  assert.ok(r.turn.perfect || r.turn.score >= 90);
  ({ st, mem } = r);
  // a female learner gets feminine forms
  const f = open(newState({ mode: "roleplay", scenario: "day", forms: "f", level: "A2" }), newMemory(), { rand: zero });
  assert.equal(respond(f.st, newMemory(), "Хорошо!", { rand: zero }).turn.next[0].ru, "Чем ты сегодня занималась?");
});

t("corrections arrive with a natural alternative and why", () => {
  const mem = newMemory();
  const { st } = open(newState({ mode: "roleplay", scenario: "day", forms: "m", level: "A2" }), mem, { rand: zero });
  const r1 = play(st, mem, "Хорошо");
  const r = play(r1.st, r1.mem, "Я работать и пошла в спортзал");
  assert.equal(r.turn.corrected, "Я работаю и пошёл в спортзал");
  assert.ok(r.turn.fixes.some((f) => f.kind === "gender"));
  assert.ok(r.turn.natural && r.turn.natural.why.length > 10);
  assert.ok(r.turn.score < 80);
  const h = hints(r1.st, r1.mem);
  assert.ok(h.length >= 2 && h[0].ru.includes("работал"));
});

t("English gets a gentle 'in Russian, please' and the same question again", () => {
  const mem = newMemory();
  const { st } = open(newState({ mode: "challenge", forms: "m", level: "A1" }), mem, { rand: zero });
  const a = play(st, mem, "Хорошо, спасибо!");
  assert.equal(a.st.streak, 1);
  const b = play(a.st, a.mem, "I don't know how to say it");
  assert.ok(b.turn.english && b.turn.events.includes("challenge-reset"));
  assert.equal(b.st.streak, 0);
  assert.equal(b.turn.next[0].ru, a.turn.next[0].ru, "asks the same question again");
  // ten Russian answers in a row complete the challenge
  let s = b.st;
  let m = b.mem;
  let done = false;
  for (let i = 0; i < 10; i++) {
    const x = play(s, m, "Да, конечно, я очень люблю это!");
    s = x.st;
    m = x.mem;
    if (x.turn.events.includes("challenge-done")) done = true;
  }
  assert.ok(done && m.stats.challengesDone === 1);
});

t("memory carries over: name, topics, a callback and a 'welcome back'", () => {
  let mem = newMemory();
  let { st } = open(newState({ mode: "normal", partner: "nastya", forms: "m", level: "A2" }), mem, { rand: zero, now: 1000 });
  let r = respond(st, mem, "Меня зовут Грант, я продаю машины", { rand: zero, now: 2000 });
  assert.equal(r.mem.name, "Грант");
  assert.ok(r.mem.topics.car && r.mem.topics.work);
  mem = r.mem;
  const again = open(newState({ mode: "normal", partner: "nastya", forms: "m", level: "A2" }), mem, { rand: zero, now: 10_000_000 });
  assert.match(again.lines.at(-1)!.ru, /Грант/);
  // after a few exchanges, an earlier topic comes back
  st = again.st;
  let seenCallback = false;
  for (let i = 0; i < 9; i++) {
    r = respond(st, mem, "Нормально, ничего особенного.", { rand: zero, now: 10_000_000 + i });
    st = r.st;
    mem = r.mem;
    if (r.turn.next[0]?.ru && Object.values(BANK.topics).some((tp) => tp.callback && r.turn.next[0].ru === form(tp.callback.ru, "m", "f"))) seenCallback = true;
  }
  assert.ok(seenCallback, "brought an earlier topic back");
});

t("asking the partner a question gets a real answer from them", () => {
  const mem = newMemory();
  const { st } = open(newState({ mode: "normal", partner: "dima", forms: "m", level: "A2" }), mem, { rand: zero });
  const r = play(st, mem, "Нормально. А откуда ты?");
  assert.match(r.turn.reaction[0].ru, /Я из Москвы/);
});

t("role-play: finishing a scenario says goodbye and starts the next one", () => {
  let mem = newMemory();
  let st = open(newState({ mode: "roleplay", scenario: "restaurant", forms: "f", level: "A2" }), mem, { rand: zero }).st;
  let ended = false;
  for (let i = 0; i < 12 && !ended; i++) {
    const r = play(st, mem, "Да, пожалуйста.");
    st = r.st;
    mem = r.mem;
    if (r.turn.events.includes("scenario-done")) {
      ended = true;
      assert.equal(r.turn.next[0].kind, "end");
      assert.equal(r.turn.next.at(-1)!.kind, "ask");
    }
  }
  assert.ok(ended && mem.stats.scenarios.restaurant === 1 && st.scenario !== "restaurant");
  assert.ok(nextScenario("restaurant", mem).id !== "restaurant");
});

t("vy scenarios correct ты; ty partners don't", () => {
  const mem = newMemory();
  const rs = open(newState({ mode: "roleplay", scenario: "disagree", forms: "m", level: "B2" }), mem, { rand: zero }).st;
  assert.ok(play(rs, mem, "Я думаю, ты не прав.").turn.fixes.some((f) => f.kind === "formality" && f.to === "вы"));
  const fr = open(newState({ mode: "normal", partner: "dima", forms: "m", level: "A2" }), mem, { rand: zero }).st;
  assert.ok(!play(fr, mem, "Хорошо, а у тебя?").turn.fixes.length);
});

t("quick answers: a round of ten with timing", () => {
  let mem = newMemory();
  let { st } = open(newState({ mode: "quick", forms: "m", level: "A1" }), mem, { rand: zero, now: 0 });
  let summary = null;
  for (let i = 0; i < 10; i++) {
    const r = respond(st, mem, "Да, конечно.", { rand: zero, now: (i + 1) * 4000 });
    st = r.st;
    mem = r.mem;
    if (r.turn.quickSummary) summary = r.turn.quickSummary;
  }
  assert.ok(summary && summary.avgMs > 0);
});

t("level adapts to how you do", () => {
  let mem = newMemory();
  let { st } = open(newState({ mode: "normal", partner: "nastya", forms: "m", level: "A1" }), mem, { rand: zero });
  let up = false;
  for (let i = 0; i < 8; i++) {
    const r = play(st, mem, "Хорошо, спасибо! Я сегодня работал, а вечером играл в шахматы. А у тебя?");
    st = r.st;
    mem = r.mem;
    if (r.turn.events.includes("level-up")) up = true;
  }
  assert.ok(up && st.level === "A2");
});

t("chess remarks are occasional and match the move", () => {
  const mem = newMemory();
  let st = newState({ mode: "normal", partner: "dima", forms: "m", level: "A2" });
  const a = remark(st, mem, { key: "capture", mine: true, bot: true }, { rand: zero });
  assert.ok(a.line && /фигура|ход/i.test(a.line.ru));
  st = a.st;
  assert.equal(remark(st, mem, { key: "check", mine: false, bot: true }, { rand: zero }).line, null, "not twice in a row");
});

console.log(`${passed} role-play tests passed`);
