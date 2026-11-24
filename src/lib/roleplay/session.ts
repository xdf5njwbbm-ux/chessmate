// Runs the role-play conversation for the app: loads and saves it on this device,
// paces it with the game (the next question arrives after the opponent's move),
// adds the partner's chess remarks, logs turns to your conversation history, and —
// when the AI tutor is switched on for the app — lets Claude play the partner.

import { api, callFunction } from "../api";
import { loadSave, writeSave } from "../saved";
import { pref, setPref } from "../format";
import { newMemory, newState, open, respond, remark, scenarioById, charOf, type Line, type Memory, type Mode, type Turn } from "./engine";
import { latinWord } from "./understand";
import type { Beat, Lvl } from "./types";
import { registerRp, rpGet, rpSet, type Msg, type RpMove, type RpSession } from "../../state/rpStore";

type Ctx = { uid: string; forms: "m" | "f"; level: Lvl; myName: string | null; ai: boolean };
let ctx: Ctx | null = null;
const FRESH_AFTER = 3 * 60 * 60 * 1000;

/** "Grant" → "Грант"; Cyrillic names stay as they are. */
export function ruName(display: string | null | undefined): string | null {
  const w = (display ?? "").trim().split(/\s+/)[0];
  if (!w) return null;
  if (/^[А-ЯЁа-яё-]+$/.test(w)) return w[0].toUpperCase() + w.slice(1);
  if (!/^[A-Za-z'-]+$/.test(w)) return null;
  const c = latinWord(w);
  return c[0].toUpperCase() + c.slice(1);
}

function persist() {
  const { s, mem, uid } = rpGet();
  if (!uid) return;
  if (s) writeSave(uid, "rp-session", s);
  if (mem) writeSave(uid, "rp-mem", mem);
}
function update(s: RpSession, mem?: Memory) {
  rpSet({ s: { ...s, touched: Date.now() }, ...(mem ? { mem } : {}) });
  persist();
}

let seq = 0;
type MsgIn = { who: "ai"; line: Line } | { who: "me"; turn: Turn; via: "text" | "voice" };
const msg = (m: MsgIn): Msg => ({ ...m, id: Date.now() * 100 + (seq++ % 100), at: Date.now() }) as Msg;

/** Loads (or starts) the conversation for this account. Safe to call on every render. */
export function ensure(c: Ctx) {
  const changed = !ctx || ctx.uid !== c.uid;
  ctx = c;
  const snap = rpGet();
  if (!changed && snap.s) {
    if (snap.s.st.forms !== c.forms) update({ ...snap.s, st: { ...snap.s.st, forms: c.forms } });
    return;
  }
  const mem = loadSave<Memory>(c.uid, "rp-mem") ?? newMemory();
  const saved = loadSave<RpSession>(c.uid, "rp-session");
  rpSet({ uid: c.uid, mem, s: saved && saved.v === 2 && Date.now() - saved.touched < FRESH_AFTER ? saved : null });
  if (!rpGet().s) start();
}

/** A new conversation (optionally in another mode, with another partner or scenario). */
export function start(o: { mode?: Mode; scenario?: string | null; partner?: string } = {}) {
  if (!ctx) return;
  const mode = o.mode ?? pref<Mode>("rpMode", "normal");
  const partner = o.partner ?? pref<string>("rpPartner", "nastya");
  const scenario = o.scenario !== undefined ? o.scenario : pref<string | null>("rpScenario", null);
  setPref("rpMode", mode);
  setPref("rpPartner", partner);
  if (mode === "roleplay") setPref("rpScenario", scenario ?? "greet");
  const mem = { ...(rpGet().mem ?? newMemory()) };
  const level = (mem.level ?? ctx.level) as Lvl;
  const st0 = newState({ mode, scenario: scenario ?? "greet", partner, forms: ctx.forms, level });
  const { st, lines } = open(st0, mem, { myName: ctx.myName });
  const s: RpSession = { v: 2, st, msgs: lines.map((line) => msg({ who: "ai", line })), queued: [], seq: 0, lastPly: null, conv: null, convTurns: 0, started: Date.now(), touched: Date.now() };
  update(s, mem);
  for (const l of lines) if (l.kind === "ask") log("tutor", l.ru, l.en, null);
}

/** Show the waiting question now. */
export function flush() {
  const { s } = rpGet();
  if (!s || !s.queued.length) return;
  const lines = s.queued;
  update({ ...s, queued: [], st: { ...s.st, curAt: Date.now() }, msgs: [...s.msgs, ...lines.map((line) => msg({ who: "ai", line }))].slice(-80) });
  for (const l of lines) if (l.kind === "ask") log("tutor", l.ru, l.en, null);
}

let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Your answer, typed or spoken. In a game, the next question waits for the opponent's move. */
export async function answer(text: string, via: "text" | "voice", inGame: boolean) {
  const snap = rpGet();
  if (!snap.s || !snap.mem || !ctx || snap.busy || !text.trim()) return;
  if (snap.s.queued.length) flush();
  const s0 = rpGet().s!;
  const local = respond(s0.st, snap.mem, text.trim(), { myName: ctx.myName });
  let { turn, st } = local;
  const mem = local.mem;

  if (ctx.ai && !turn.english) {
    rpSet({ busy: true, s: { ...s0, msgs: [...s0.msgs, msg({ who: "me", turn: { ...turn, reaction: [], next: [] }, via })] } });
    const ai = await askClaude(s0, text.trim()).catch(() => null);
    rpSet({ busy: false });
    if (ai) ({ turn, st } = merge(turn, st, ai));
    const cur = rpGet().s!;
    const msgs = cur.msgs.slice(0, -1);
    return finish({ ...cur, msgs }, st, mem, turn, via, inGame);
  }
  finish(s0, st, mem, turn, via, inGame);
}

function finish(s0: RpSession, st: RpSession["st"], mem: Memory, turn: Turn, via: "text" | "voice", inGame: boolean) {
  const msgs = [...s0.msgs, msg({ who: "me", turn, via }), ...turn.reaction.map((line) => msg({ who: "ai", line }))];
  const holdNext = inGame && !turn.english && st.mode !== "quick";
  update({ ...s0, st, msgs: msgs.slice(-80), queued: holdNext ? turn.next : [] }, mem);
  if (!holdNext) {
    if (flushTimer) clearTimeout(flushTimer);
    const lines = turn.next;
    flushTimer = setTimeout(() => {
      const s = rpGet().s;
      if (s) update({ ...s, st: { ...s.st, curAt: Date.now() }, msgs: [...s.msgs, ...lines.map((line) => msg({ who: "ai", line }))].slice(-80) });
      for (const l of lines) if (l.kind === "ask") log("tutor", l.ru, l.en, null);
    }, turn.english ? 400 : 900);
  }
  const real = turn.fixes.filter((f) => !f.soft);
  log("user", turn.said, "", real.length || turn.natural ? { corrected: turn.corrected, explanation: real.map((f) => f.why).join(" "), natural: turn.natural?.ru ?? turn.corrected } : null);
  for (const l of turn.reaction) log("tutor", l.ru, l.en, null);
  if (via === "voice") api.recordPractice("speaking", turn.understood, "roleplay").catch(() => {});
}

// ---------------------------------------------------------------- the board

registerRp({
  move(m: RpMove) {
    const { s, mem } = rpGet();
    if (!s || !mem || s.lastPly === m.ply) return;
    let st = s.st;
    const msgs = [...s.msgs];
    const notable = (k: string | null) => !!k && ["capture", "check", "promotion", "castle"].includes(k);
    const r = remark(st, mem, notable(m.myKey) ? { key: m.myKey!, mine: true, bot: m.bot } : { key: m.key, mine: false, bot: m.bot }, { myName: ctx?.myName });
    st = r.st;
    if (r.line) msgs.push(msg({ who: "ai", line: r.line }));
    let queued = s.queued;
    let held = s.held ?? false;
    // now and then a move passes without a new question, so it doesn't feel like a quiz
    const varied = ["normal", "native", "beginner", "roleplay"].includes(st.mode);
    if (queued.length && varied && !held && Math.random() < 0.18) held = true;
    else if (queued.length) {
      msgs.push(...queued.map((line) => msg({ who: "ai", line })));
      for (const l of queued) if (l.kind === "ask") log("tutor", l.ru, l.en, null);
      queued = [];
      held = false;
      st = { ...st, curAt: Date.now() };
    }
    update({ ...s, st, msgs: msgs.slice(-80), queued, lastPly: m.ply, held });
  },
});

// ---------------------------------------------------------------- conversation history (best effort)

let chain: Promise<unknown> = Promise.resolve();
function log(role: "tutor" | "user", ru: string, en: string, correction: unknown) {
  if (!ru) return;
  chain = chain.then(async () => {
    const { s } = rpGet();
    if (!s || !ctx) return;
    try {
      let conv = s.conv;
      let turns = s.convTurns;
      if (!conv || turns >= 190) {
        conv = await api.startConversation(null, s.st.level, "guided");
        turns = 0;
      }
      await api.logTurn(conv, role, ru, en, correction);
      const cur = rpGet().s;
      if (cur) rpSet({ s: { ...cur, conv, convTurns: turns + 1 } });
    } catch {
      /* history is optional */
    }
  });
}

// ---------------------------------------------------------------- Claude as the partner

type AiReply = {
  reaction_ru: string; reaction_en: string; next_ru: string; next_en: string;
  correction: { corrected: string; explanation: string; natural: string; why: string } | null;
  new_words: { ru: string; en: string }[];
  examples: { ru: string; en: string }[];
  understood: boolean;
};

let aiConv: string | null = null;
async function askClaude(s: RpSession, text: string): Promise<AiReply | null> {
  if (!ctx) return null;
  if (!aiConv) aiConv = await api.startConversation(null, s.st.level, "ai");
  const ch = charOf(s.st);
  const sc = s.st.mode === "roleplay" ? scenarioById(s.st.scenario) : null;
  const recent = s.msgs.slice(-12).map((m) => (m.who === "me" ? { role: "user", ru: m.turn.said } : { role: "partner", ru: m.line.ru })).filter((m) => m.ru);
  const res = await callFunction<{ reply: AiReply }>("tutor", {
    action: "roleplay",
    conversation_id: aiConv,
    message: text,
    context: {
      mode: s.st.mode, level: s.st.level, forms: ctx.forms,
      partner: { name: ch.name.ru, gender: ch.g, about: ch.about, vy: ch.vy },
      scenario: sc ? { title: sc.title.en, about: sc.about, goal: sc.goal } : null,
      question: s.st.cur?.ai.ru ?? null,
      memory: { name: rpGet().mem?.name ?? null, topics: Object.keys(rpGet().mem?.topics ?? {}).slice(0, 10) },
      recent,
    },
  });
  return res.reply?.reaction_ru || res.reply?.next_ru ? res.reply : null;
}

function merge(turn: Turn, st: RpSession["st"], ai: AiReply): { turn: Turn; st: RpSession["st"] } {
  const fixes = ai.correction && ai.correction.corrected && ai.correction.corrected !== turn.said
    ? [{ kind: "grammar" as const, from: turn.said, to: ai.correction.corrected, why: ai.correction.explanation }]
    : turn.fixes.filter((f) => f.soft);
  const next: Line[] = ai.next_ru ? [{ ru: ai.next_ru, en: ai.next_en, kind: "ask", words: ai.new_words?.length ? ai.new_words : undefined }] : turn.next;
  const beat: Beat = { id: `ai.${Date.now()}`, ai: { ru: ai.next_ru, en: ai.next_en }, models: ai.examples ?? [], reactions: [], words: [] };
  return {
    turn: {
      ...turn,
      fixes,
      corrected: ai.correction?.corrected || turn.said,
      natural: ai.correction?.natural && ai.correction.natural !== turn.said ? { ru: ai.correction.natural, en: "", why: ai.correction.why || ai.correction.explanation } : null,
      perfect: !ai.correction,
      understood: ai.understood ?? turn.understood,
      reaction: ai.reaction_ru ? [{ ru: ai.reaction_ru, en: ai.reaction_en, kind: "say" }] : turn.reaction,
      next,
    },
    st: ai.next_ru ? { ...st, cur: beat } : st,
  };
}
