// Russian Chess Academy — `voice` edge function: AI Voice Practice.
//
//   status   → whether voice calls are configured and allowed for this account
//   connect  → starts (or resumes) a call: builds the tutor's instructions from the
//              learner's level, mode, lesson and memory, and exchanges the browser's
//              WebRTC offer with OpenAI's Realtime API (the API key never leaves here)
//   analyze  → annotates one transcript line: translation, stress, pronunciation
//              guide, suggested answers; corrections for what the learner said
//   tts      → a sentence in the tutor's voice (cached), for replays and drills
//   sync     → saves the transcript while the call is running
//   end      → post-call report, level evaluation, memory and course progress
//
// Secrets: OPENAI_API_KEY (required). Optional: VOICE_MODEL, VOICE_TEXT_MODEL,
// VOICE_TRANSCRIBE_MODEL, VOICE_TTS_MODEL, VOICE_REASONING, OPENAI_BASE_URL.
import { admin, caller, CORS, entitlements, env, json } from "../_shared/http.ts";
import { isLevel, isMode, isTutor, speedFor, topicById, TUTORS, type TutorId, type VoiceLevel, type VoiceMode } from "../_shared/voice/curriculum.ts";
import {
  buildReport, callMetrics, clamp, evaluateLevel, fallbackScores, type HistoryEntry, type Issue, type LessonProgress, levelOr,
  mergeMemory, nextLesson, overallOf, parseLearnerAnalysis, parseTutorAnalysis, plainRu, readMemory, type Scores, type Turn, updateLessons,
} from "../_shared/voice/logic.ts";
import { learnerAnalysisPrompt, reportPrompt, transcriptText, tutorAnalysisPrompt, tutorInstructions } from "../_shared/voice/prompt.ts";

const OPENAI = () => env("OPENAI_BASE_URL") ?? "https://api.openai.com";
const KEY = () => env("OPENAI_API_KEY");
const VOICE_MODEL = () => env("VOICE_MODEL") ?? "gpt-realtime-2.1";
const TRANSCRIBE_MODEL = () => env("VOICE_TRANSCRIBE_MODEL") ?? "gpt-transcribe";
const TEXT_MODEL = () => env("VOICE_TEXT_MODEL") ?? "gpt-5.4-mini";
const TTS_MODEL = () => env("VOICE_TTS_MODEL") ?? "gpt-4o-mini-tts";
const REASONING = () => env("VOICE_REASONING") ?? "low";

type Body = Record<string, unknown>;
type User = { id: string };

// ---------------------------------------------------------------- helpers
async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// per-instance rate limiting (abuse protection on top of auth + entitlements)
const hits = new Map<string, number[]>();
function limited(userId: string, kind: string, max: number, windowMs: number): boolean {
  const k = userId + ":" + kind;
  const now = Date.now();
  const list = (hits.get(k) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(k, list);
  return list.length > max;
}

const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

/** The learner's own transcript, trimmed to sane sizes. */
export function sanitizeTurns(v: unknown): Turn[] {
  if (!Array.isArray(v)) return [];
  return v.slice(-400).flatMap((t): Turn[] => {
    if (!t || typeof t !== "object") return [];
    const o = t as Record<string, unknown>;
    const role = o.role === "tutor" ? "tutor" : o.role === "learner" ? "learner" : null;
    const text = s(o.text, 1500).trim();
    if (!role || !text) return [];
    const a = o.analysis;
    const analysis = a && typeof a === "object"
      ? role === "tutor" ? parseTutorAnalysis(a, text) : parseLearnerAnalysis(a, text)
      : null;
    return [{ id: s(o.id, 80) || crypto.randomUUID(), role, text, at: clamp(Number(o.at) || 0, 0, 1e8), analysis }];
  });
}

async function usageSeconds(userId: string): Promise<{ used: number; limit: number }> {
  const db = admin();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const [{ data: calls }, { data: cfg }] = await Promise.all([
    db.from("voice_calls").select("status, duration_s, started_at, last_seen_at").eq("user_id", userId).gte("started_at", since),
    db.from("app_config").select("value").eq("key", "voice_daily_minutes").maybeSingle(),
  ]);
  const used = (calls ?? []).reduce((sum, c) =>
    sum + (c.status === "ended" ? c.duration_s : Math.max(0, (Date.parse(c.last_seen_at) - Date.parse(c.started_at)) / 1000)), 0);
  const minutes = Number(cfg?.value ?? 60);
  return { used: Math.round(used), limit: (Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60 };
}

/** One JSON answer from the text model (analysis and reports). */
async function llmJson(system: string, user: string, maxTokens: number, userId: string, timeoutMs: number, effort: "none" | "low" = "none"): Promise<unknown | null> {
  const body: Record<string, unknown> = {
    model: TEXT_MODEL(),
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    response_format: { type: "json_object" },
    max_completion_tokens: maxTokens,
    reasoning_effort: effort,
    safety_identifier: (await sha256("rca:" + userId)).slice(0, 64),
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(`${OPENAI()}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("openai chat", res.status, t.slice(0, 500));
        // Non-reasoning models reject reasoning_effort: retry once without it.
        if (res.status === 400 && /reasoning/i.test(t) && "reasoning_effort" in body) {
          delete body.reasoning_effort;
          continue;
        }
        return null;
      }
      const data = await res.json();
      const text = String(data.choices?.[0]?.message?.content ?? "");
      const a = text.indexOf("{");
      const b = text.lastIndexOf("}");
      if (a < 0 || b <= a) return null;
      return JSON.parse(text.slice(a, b + 1));
    } catch (e) {
      console.error("openai chat failed", (e as Error).message);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Whether the OpenAI key works and the configured models are available to it.
 * Cached per instance; returns booleans only — the key is never returned or logged.
 */
type KeyCheck = { key_ok: boolean | null; voice_model_ok: boolean | null; text_model_ok: boolean | null };
let keyCheck: { at: number; value: KeyCheck } | null = null;
async function checkOpenAI(): Promise<KeyCheck> {
  if (!KEY()) return { key_ok: null, voice_model_ok: null, text_model_ok: null };
  if (keyCheck && Date.now() - keyCheck.at < 10 * 60_000) return keyCheck.value;
  const probe = async (model: string) => {
    try {
      const res = await fetch(`${OPENAI()}/v1/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${KEY()}` }, signal: AbortSignal.timeout(8_000) });
      return res.status;
    } catch {
      return 0;
    }
  };
  const [v, t] = await Promise.all([probe(VOICE_MODEL()), probe(TEXT_MODEL())]);
  if (v === 0 && t === 0) return { key_ok: null, voice_model_ok: null, text_model_ok: null }; // network trouble: don't cache
  const value: KeyCheck = {
    key_ok: !(v === 401 || t === 401),
    voice_model_ok: v === 200 ? true : v === 404 || v === 403 ? false : null,
    text_model_ok: t === 200 ? true : t === 404 || t === 403 ? false : null,
  };
  if (!value.key_ok || value.voice_model_ok === false || value.text_model_ok === false) {
    console.warn("voice: OpenAI check failed", JSON.stringify({ ...value, voice_model: VOICE_MODEL(), text_model: TEXT_MODEL(), voice_status: v, text_status: t }));
  }
  keyCheck = { at: Date.now(), value };
  return value;
}

// ---------------------------------------------------------------- connect
function sessionConfig(o: { instructions: string; voice: string; speed: number; level: VoiceLevel; mode: VoiceMode }, conservative: boolean) {
  const model = VOICE_MODEL();
  const patient = o.level === "A1" || o.level === "A2" || o.mode === "beginner";
  return {
    type: "realtime",
    model,
    instructions: o.instructions,
    output_modalities: ["audio"],
    ...(!conservative && /^gpt-realtime-2/.test(model) && REASONING() !== "none" ? { reasoning: { effort: REASONING() } } : {}),
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: conservative
          ? { model: "gpt-4o-transcribe", language: "ru" }
          : { model: TRANSCRIBE_MODEL(), languages: ["ru", "en"] },
        // Semantic turn detection: the tutor answers when you've finished your thought,
        // not at the first pause — beginners get the most patient setting (up to ~8 s).
        turn_detection: { type: "semantic_vad", eagerness: patient ? "low" : "auto", create_response: true, interrupt_response: true },
      },
      output: { voice: o.voice, speed: o.speed },
    },
  };
}

async function connect(user: User, body: Body): Promise<Response> {
  const sdp = typeof body.sdp === "string" ? body.sdp : "";
  if (!sdp.startsWith("v=") || sdp.length > 40_000) return json({ error: "Bad connection offer." }, 400);
  if (limited(user.id, "connect", 12, 60_000)) return json({ error: "Too many connection attempts. Wait a moment." }, 429);
  const db = admin();

  await db.from("voice_profiles").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  const [{ data: prof }, { data: vp }] = await Promise.all([
    db.from("profiles").select("display_name, ru_level, ru_forms").eq("id", user.id).maybeSingle(),
    db.from("voice_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!prof || !vp) return json({ error: "Finish setting up your account first." }, 400);

  const mode: VoiceMode = isMode(body.mode) ? body.mode : vp.mode;
  const tutor: TutorId = isTutor(body.tutor) ? body.tutor : vp.tutor;
  const slow = typeof body.slow === "boolean" ? body.slow : vp.slow;
  const level: VoiceLevel = isLevel(vp.level) ? vp.level : "A1";
  const lessonIn = body.lesson === null ? null : Number(body.lesson ?? vp.current_lesson);
  const lesson = lessonIn && topicById(lessonIn) ? lessonIn : null;

  // resume an existing call after a dropped connection, or start a new one
  let callId = typeof body.call_id === "string" ? body.call_id : "";
  let created = false;
  let review: Issue[] | null = null;
  let reviewOf: string | null = null;
  const { used, limit } = await usageSeconds(user.id);
  if (callId) {
    const { data: call } = await db.from("voice_calls").select("id, user_id, status, connections, review_of").eq("id", callId).maybeSingle();
    if (!call || call.user_id !== user.id || call.status !== "active") return json({ error: "That call has ended.", code: "ended" }, 409);
    await db.from("voice_calls").update({ connections: call.connections + 1, last_seen_at: new Date().toISOString() }).eq("id", callId);
    reviewOf = call.review_of;
  } else {
    if (used >= limit) {
      return json({ error: `You've used today's ${Math.round(limit / 60)} minutes of voice calls. Come back tomorrow!`, code: "limit" }, 429);
    }
    reviewOf = typeof body.review_of === "string" ? body.review_of : null;
    const { data: call, error } = await db.from("voice_calls")
      .insert({ user_id: user.id, mode, level, lesson, tutor, review_of: reviewOf })
      .select("id").single();
    if (error || !call) {
      console.error("voice_calls insert", error?.message);
      return json({ error: "Couldn't start the call. Please try again." }, 500);
    }
    callId = call.id;
    created = true;
  }
  if (reviewOf) {
    const { data: prev } = await db.from("voice_calls").select("user_id, report").eq("id", reviewOf).maybeSingle();
    if (prev?.user_id === user.id && prev.report) {
      const r = prev.report as { grammar_mistakes?: Issue[]; review?: { items?: { ru: string; en: string; note: string }[] } };
      review = [
        ...(r.grammar_mistakes ?? []),
        ...(r.review?.items ?? []).map((i) => ({ type: "grammar" as const, wrong: "", right: i.ru, note: i.en })),
      ].slice(0, 8);
    }
  }

  const { data: srs } = await db.from("srs_items").select("item_id").eq("user_id", user.id).eq("kind", "word").order("created_at", { ascending: false }).limit(40);
  const ids = (srs ?? []).map((x) => x.item_id);
  const { data: vocab } = ids.length ? await db.from("vocab").select("ru").in("id", ids) : { data: [] as { ru: string }[] };
  const history = (Array.isArray(vp.history) ? vp.history : []) as HistoryEntry[];
  const recent = history.filter((h) => h.sentences >= 6).slice(-3);
  const struggling = recent.length >= 2 && recent.reduce((a, h) => a + h.overall, 0) / recent.length < 50;
  const resume = Array.isArray(body.resume)
    ? (body.resume as Record<string, unknown>[]).slice(-20).map((x) => ({ role: x?.role === "tutor" ? "tutor" as const : "learner" as const, text: s(x?.text, 400) })).filter((x) => x.text)
    : null;

  const instructions = tutorInstructions({
    tutor, mode, level,
    courseLevel: prof.ru_level ?? "A1",
    forms: prof.ru_forms === "f" ? "f" : "m",
    name: prof.display_name ? String(prof.display_name).split(/\s+/)[0] : null,
    lesson: review ? null : lesson,
    firstCall: (vp.calls ?? 0) === 0 && !resume?.length,
    memory: readMemory(vp.memory),
    courseWords: (vocab ?? []).map((v) => v.ru),
    review,
    resume: resume?.length ? resume : null,
    struggling,
  });
  const speed = speedFor(mode, slow);
  const cfg = { instructions, voice: TUTORS[tutor].voice, speed, level, mode };
  const safety = (await sha256("rca:" + user.id)).slice(0, 64);

  let answer: string | null = null;
  let rtcId: string | null = null;
  for (const conservative of [false, true]) {
    const form = new FormData();
    form.set("sdp", sdp);
    form.set("session", JSON.stringify(sessionConfig(cfg, conservative)));
    try {
      const res = await fetch(`${OPENAI()}/v1/realtime/calls`, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY()}`, "OpenAI-Safety-Identifier": safety },
        body: form,
      });
      if (res.ok) {
        answer = await res.text();
        rtcId = (res.headers.get("Location") ?? "").split("/").pop() || null;
        break;
      }
      const t = await res.text().catch(() => "");
      console.error("openai realtime", res.status, conservative ? "(conservative)" : "", t.slice(0, 600));
      if (res.status === 401 || res.status === 403) break;
      if (res.status === 429) break;
      if (res.status !== 400) break;
    } catch (e) {
      console.error("openai realtime failed", (e as Error).message);
      break;
    }
  }
  if (!answer) {
    if (created) await db.from("voice_calls").delete().eq("id", callId);
    return json({ error: "The tutor's line is busy right now. Please try again in a moment.", code: "upstream" }, 502);
  }
  if (rtcId) await db.from("voice_calls").update({ rtc_call_id: rtcId.slice(0, 120) }).eq("id", callId);
  return json({ sdp: answer, call_id: callId, mode, tutor, level, lesson: review ? null : lesson, speed, used_s: used, limit_s: limit, review: !!review });
}

// ---------------------------------------------------------------- analyze / tts
async function analyze(user: User, body: Body): Promise<Response> {
  const text = s(body.text, 1500).trim();
  if (!text) return json({ error: "Nothing to analyse." }, 400);
  if (limited(user.id, "analyze", 90, 60_000)) return json({ error: "Too many requests." }, 429);
  const db = admin();
  const [{ data: call }, { data: prof }] = await Promise.all([
    db.from("voice_calls").select("user_id, level, mode").eq("id", String(body.call_id ?? "")).maybeSingle(),
    db.from("profiles").select("ru_forms").eq("id", user.id).maybeSingle(),
  ]);
  if (!call || call.user_id !== user.id) return json({ error: "Call not found." }, 404);
  const forms = prof?.ru_forms === "f" ? "f" : "m";
  const level = levelOr(call.level, "A1");
  const prev = s(body.prev, 800).trim();
  if (body.role === "tutor") {
    const raw = await llmJson(tutorAnalysisPrompt(level, call.mode, forms), `${prev ? `The learner just said: ${prev}\n` : ""}Tutor line: ${text}`, 2000, user.id, 25_000);
    return json({ analysis: parseTutorAnalysis(raw ?? {}, text), ok: !!raw });
  }
  const raw = await llmJson(learnerAnalysisPrompt(level, forms), `${prev ? `The tutor had just said: ${prev}\n` : ""}Learner said (speech recognition): ${text}`, 2000, user.id, 25_000);
  return json({ analysis: parseLearnerAnalysis(raw ?? {}, text), ok: !!raw });
}

async function tts(user: User, body: Body): Promise<Response> {
  const text = plainRu(s(body.text, 400)).trim();
  if (!text) return json({ error: "Text must be 1–400 characters." }, 400);
  if (limited(user.id, "tts", 120, 60_000)) return json({ error: "Too many requests." }, 429);
  const tutor: TutorId = isTutor(body.tutor) ? body.tutor : "anya";
  const voice = TUTORS[tutor].voice;
  const path = `voice/${await sha256(`${TTS_MODEL()}|${voice}|${text}`)}.mp3`;
  const bucket = admin().storage.from("tts");
  try {
    const { data } = await bucket.download(path);
    if (data) return new Response(data, { headers: { ...CORS, "Content-Type": "audio/mpeg", "X-Cache": "hit" } });
  } catch {
    /* not cached */
  }
  const res = await fetch(`${OPENAI()}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL(),
      voice,
      input: text,
      response_format: "mp3",
      instructions: "Speak Russian like a native speaker from Moscow, clearly and warmly, like a patient tutor reading a sentence to a learner. Natural intonation, correct word stress.",
    }),
  });
  if (!res.ok) {
    console.error("openai tts", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return json({ error: "The voice is unavailable right now." }, 502);
  }
  const audio = new Uint8Array(await res.arrayBuffer());
  try {
    await bucket.upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  } catch {
    /* caching is best-effort */
  }
  return new Response(audio, { headers: { ...CORS, "Content-Type": "audio/mpeg", "X-Cache": "miss" } });
}

// ---------------------------------------------------------------- sync / end
async function sync(user: User, body: Body): Promise<Response> {
  const db = admin();
  const callId = String(body.call_id ?? "");
  const turns = sanitizeTurns(body.transcript);
  const { data: call } = await db.from("voice_calls").select("user_id, status").eq("id", callId).maybeSingle();
  if (!call || call.user_id !== user.id) return json({ error: "Call not found." }, 404);
  if (call.status !== "active") return json({ ended: true });
  const metrics = callMetrics(turns);
  await db.from("voice_calls").update({ transcript: turns, sentences: metrics.sentences, last_seen_at: new Date().toISOString() }).eq("id", callId);
  const { used, limit } = await usageSeconds(user.id);
  return json({ ok: true, used_s: used, limit_s: limit, over_limit: used > limit + 60 });
}

async function end(user: User, body: Body): Promise<Response> {
  const db = admin();
  const callId = String(body.call_id ?? "");
  const { data: call } = await db.from("voice_calls").select("*").eq("id", callId).maybeSingle();
  if (!call || call.user_id !== user.id) return json({ error: "Call not found." }, 404);
  if (call.status === "ended" && call.report) return json({ report: call.report, call_id: callId });
  if (limited(user.id, "end", 10, 60_000)) return json({ error: "Too many requests." }, 429);

  const posted = sanitizeTurns(body.transcript);
  const turns = posted.length >= (Array.isArray(call.transcript) ? call.transcript.length : 0) ? posted : sanitizeTurns(call.transcript);
  const elapsed = Number(body.elapsed_s);
  const duration = clamp(Math.round(Number.isFinite(elapsed) && elapsed > 0 ? elapsed : (Date.parse(call.last_seen_at) - Date.parse(call.started_at)) / 1000), 0, 14_400);
  const st = (body.stats && typeof body.stats === "object" ? body.stats : {}) as Record<string, unknown>;
  const stats = {
    nudges: clamp(Number(st.nudges) || 0, 0, 999), helps: clamp(Number(st.helps) || 0, 0, 999),
    repeats: clamp(Number(st.repeats) || 0, 0, 999), english: clamp(Number(st.english) || 0, 0, 999),
    reconnects: clamp(Number(st.reconnects) || 0, 0, 99),
  };

  const [{ data: prof }, { data: vp }] = await Promise.all([
    db.from("profiles").select("ru_forms").eq("id", user.id).maybeSingle(),
    db.from("voice_profiles").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!vp) return json({ error: "Voice profile missing." }, 400);
  const forms = prof?.ru_forms === "f" ? "f" : "m";
  const level: VoiceLevel = levelOr(vp.level, "A1");
  const callLevel: VoiceLevel = levelOr(call.level, level);
  const metrics = callMetrics(turns);
  const memory = readMemory(vp.memory);
  const at = new Date().toISOString();

  let raw: Record<string, unknown> | null = null;
  if (metrics.learnerTurns > 0 && KEY()) {
    const context = [
      `Duration: ${Math.round(duration / 60)} min ${duration % 60} s. Learner turns: ${metrics.learnerTurns} (${metrics.russianTurns} in Russian, ${metrics.englishTurns} in English). Russian sentences: ${metrics.sentences}. Average words per Russian turn: ${metrics.avgWords}. Turns judged correct by the checker: ${Math.round(metrics.okRate * 100)}%.`,
      `Help used: silent-prompts ${stats.nudges}, help button ${stats.helps}, repeat requests ${stats.repeats}. Reconnections: ${stats.reconnects}.`,
      `Known words before this call: ${memory.known_words.slice(0, 120).map((w) => w.ru).join(", ") || "(none yet)"}`,
      `Existing facts about the learner: ${memory.facts.join("; ") || "(none yet)"}`,
      memory.name ? `Learner's name: ${memory.name}` : "",
      "",
      "TRANSCRIPT",
      transcriptText(turns),
    ].filter((x) => x !== "").join("\n");
    raw = (await llmJson(reportPrompt(callLevel, call.mode, forms, call.lesson), context, 7000, user.id, 90_000, "low")) as Record<string, unknown> | null;
  }

  // scores: the evaluator's judgement, sanity-checked against the numbers
  const fb = fallbackScores(metrics, stats, callLevel);
  const rs = (raw?.scores ?? {}) as Record<string, unknown>;
  const blend = (k: "comprehension" | "confidence" | "accuracy") => {
    const v = Number(rs[k]);
    return Number.isFinite(v) ? clamp(Math.round(0.75 * clamp(v, 0, 100) + 0.25 * fb[k]), 0, 100) : fb[k];
  };
  const scores: Scores = metrics.russianTurns
    ? (() => {
      const comprehension = blend("comprehension"), confidence = blend("confidence"), accuracy = blend("accuracy");
      return { comprehension, confidence, accuracy, overall: overallOf(comprehension, confidence, accuracy) };
    })()
    : fb;
  const estimate = levelOr(raw?.estimate, callLevel);

  const entry: HistoryEntry = { at, level, lesson: call.lesson, ...scores, sentences: metrics.sentences, estimate };
  const lvl = evaluateLevel({ level, progress: vp.level_progress ?? 0, history: (Array.isArray(vp.history) ? vp.history : []) as HistoryEntry[] }, entry);
  const lessons = updateLessons((vp.lessons ?? {}) as Record<string, LessonProgress>, call.lesson, level, scores.overall, metrics.sentences, at);
  const fromLesson = call.lesson ?? vp.current_lesson ?? 1;
  const next = nextLesson(lessons, fromLesson, lvl.level);
  const nextTopic = topicById(next)!;
  const nextReason = call.lesson && next === call.lesson
    ? "Stay with this topic for one more call — it'll feel much easier the second time."
    : `Next up: ${nextTopic.title}.`;

  const report = buildReport(raw, {
    metrics, scores, duration, level: lvl, before: level, estimate, next, lessonTitle: nextTopic.title, nextReason, turns,
  });

  const mem = (raw?.memory ?? {}) as Record<string, unknown>;
  const learnerWords = turns.flatMap((t) => (t.analysis?.kind === "learner" ? t.analysis.words : []));
  const topicTitle = topicById(call.lesson)?.title;
  const newMemory = mergeMemory(memory, {
    name: typeof mem.name === "string" ? mem.name : null,
    facts: Array.isArray(mem.facts) ? mem.facts.filter((f): f is string => typeof f === "string") : null,
    words: [...learnerWords.map((w) => ({ ru: w, en: "" })), ...report.new_vocabulary],
    grammar: Array.isArray(mem.grammar) ? mem.grammar.filter((g): g is string => typeof g === "string").slice(0, 6) : [],
    mistakes: report.grammar_mistakes,
    struggles: [
      ...report.struggled_words.map((w) => ({ ru: w.ru, issue: w.why })),
      ...report.pronunciation.practise.map((x) => ({ ru: x.ru, issue: x.issue })),
    ],
    topics: [...(topicTitle ? [topicTitle] : []), ...(Array.isArray(mem.topics) ? mem.topics.filter((t): t is string => typeof t === "string").slice(0, 4) : [])],
    summary: metrics.learnerTurns ? report.summary : undefined,
    lesson: call.lesson,
  }, at);

  const phrases = report.review.items.map((i) => ({ ru: plainRu(i.ru), en: i.en })).slice(0, 8);
  const words = [...new Set([...learnerWords, ...report.new_vocabulary.map((w) => w.ru)].map(plainRu))].slice(0, 30);
  const { error } = await db.rpc("voice_finish", {
    u: user.id,
    p_call: callId,
    p: {
      duration_s: duration,
      sentences: metrics.sentences,
      transcript: turns,
      report,
      profile: {
        level: lvl.level,
        level_progress: lvl.progress,
        current_lesson: next,
        memory: newMemory,
        lessons,
        history: lvl.history,
      },
      activity: Math.min(20, metrics.sentences),
      phrases: metrics.learnerTurns ? phrases : [],
      words,
    },
  });
  if (error) {
    console.error("voice_finish", error.message);
    return json({ error: "Couldn't save the call. Please try again." }, 500);
  }
  return json({ report, call_id: callId });
}

// ---------------------------------------------------------------- entry
export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "Please sign in." }, 401);
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const configured = !!KEY();
  const ent = await entitlements(user.id);
  const allowed = ent.ai_tutor === true;
  if (body.action === "status") {
    const chk = await checkOpenAI();
    return json({ configured, allowed, ready: configured && allowed && chk.key_ok !== false && chk.voice_model_ok !== false, model: configured ? VOICE_MODEL() : null, ...chk });
  }
  // A call that already happened can always be saved and reported.
  if (body.action === "end") return end(user, body);
  if (body.action === "sync") return sync(user, body);
  if (!configured) return json({ error: "Voice calls aren't set up yet.", code: "not_configured" }, 503);
  if (!allowed) return json({ error: "AI voice practice is part of Premium.", code: "premium" }, 403);
  if (body.action === "connect") return connect(user, body);
  if (body.action === "analyze") return analyze(user, body);
  if (body.action === "tts") return tts(user, body);
  return json({ error: "Bad request." }, 400);
}
