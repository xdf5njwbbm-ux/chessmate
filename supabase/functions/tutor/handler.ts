// Russian Chess Academy — `tutor` edge function: the AI conversation partner.
// Uses the Claude API (ANTHROPIC_API_KEY secret; TUTOR_MODEL optional).
// Without a key, the app runs the same scenarios as guided conversations.
import { admin, caller, CORS, entitlements, env, json } from "../_shared/http.ts";

const MODEL = () => env("TUTOR_MODEL") ?? "claude-sonnet-5-5";
const API = () => env("ANTHROPIC_BASE_URL") ?? "https://api.anthropic.com";

const LEVEL_STYLE: Record<string, string> = {
  A1: "A1 (complete beginner): very short, simple sentences (up to about 8 words), present tense, the most common words. Speak slowly and clearly.",
  A2: "A2 (elementary): short everyday sentences; past and future tense are fine; common vocabulary.",
  B1: "B1 (intermediate): natural everyday Russian with opinions, reasons and conditionals; avoid rare words.",
  B2: "B2 (upper-intermediate): natural, nuanced, idiomatic Russian as an educated native speaker would use in conversation.",
};

export type TutorReply = {
  reply_ru: string;
  reply_en: string;
  correction: { corrected: string; explanation: string; natural: string } | null;
  new_words: { ru: string; en: string }[];
};

export function parseTutor(text: string): TutorReply | null {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(text.slice(a, b + 1));
    if (typeof o.reply_ru !== "string" || !o.reply_ru.trim()) return null;
    const c = o.correction;
    return {
      reply_ru: o.reply_ru.trim().slice(0, 1200),
      reply_en: String(o.reply_en ?? "").slice(0, 1200),
      correction: c && typeof c === "object" && (c.corrected || c.natural)
        ? { corrected: String(c.corrected ?? ""), explanation: String(c.explanation ?? ""), natural: String(c.natural ?? "") }
        : null,
      new_words: Array.isArray(o.new_words)
        ? o.new_words.slice(0, 3).filter((w: { ru?: unknown; en?: unknown }) => typeof w?.ru === "string").map((w: { ru: string; en?: string }) => ({ ru: w.ru, en: String(w.en ?? "") }))
        : [],
    };
  } catch {
    return null;
  }
}

function systemPrompt(p: { level: string; forms: string; scenario?: { title: string; description: string; tutor_role: string } | null; words: string[] }) {
  return [
    "You are a warm, patient Russian conversation partner inside Russian Chess Academy, an app where people learn Russian while playing chess.",
    `The learner's level is ${LEVEL_STYLE[p.level] ?? LEVEL_STYLE.A1}`,
    `When the learner talks about themselves, they use ${p.forms === "f" ? "feminine" : "masculine"} forms (e.g. ${p.forms === "f" ? "я сделала, я рада" : "я сделал, я рад"}). Address them with ты unless the scenario is formal, in which case use вы.`,
    p.scenario
      ? `Scenario: "${p.scenario.title}" — ${p.scenario.description} You play ${p.scenario.tutor_role}. Stay in character and keep the conversation moving toward the scenario's goal.`
      : "This is a free conversation about the learner's day, interests and chess.",
    p.words.length ? `Words the learner has studied recently (reuse some naturally): ${p.words.join(", ")}.` : "",
    "Rules:",
    "- reply_ru: your reply, only in Russian, at the learner's level, natural and friendly. End with one follow-up question so the conversation feels continuous.",
    "- If the learner answers with a single word or fragment, gently encourage a complete sentence and give an example.",
    "- If the learner's last message has a grammar, word-choice or spelling mistake, set correction: corrected = their full sentence corrected; explanation = one or two short sentences in English explaining why; natural = how a native speaker would naturally say it (may equal corrected). Be gentle. At A1–A2 correct only real errors, not style. If there is no mistake, correction = null.",
    "- If the learner writes in English, reply in Russian and put the Russian version of their message in correction.natural with a short explanation.",
    "- If a pronunciation note is included with the learner's message, briefly and kindly mention the word(s) to practise in your explanation.",
    "- reply_en: an accurate English translation of reply_ru.",
    "- new_words: up to 3 words from your reply the learner may not know, with the stressed vowel marked with an acute accent (e.g. «пое\u0301здка»), and an English gloss.",
    'Answer with JSON only: {"reply_ru": "...", "reply_en": "...", "correction": null or {"corrected": "...", "explanation": "...", "natural": "..."}, "new_words": [{"ru": "...", "en": "..."}]}',
  ].filter(Boolean).join("\n");
}

async function callClaude(system: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<TutorReply | null> {
  const res = await fetch(`${API()}/v1/messages`, {
    method: "POST",
    headers: {
      "x-api-key": env("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL(), max_tokens: 900, system, messages }),
  });
  if (!res.ok) {
    console.error("anthropic", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const text = (data.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
  return parseTutor(text);
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "Please sign in." }, 401);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const configured = !!env("ANTHROPIC_API_KEY");
  const ent = await entitlements(user.id);
  if (body.action === "status") return json({ ai: configured && ent.ai_tutor === true, configured });
  if (!configured) return json({ error: "The AI tutor isn't configured.", code: "not_configured" }, 503);
  if (ent.ai_tutor !== true) return json({ error: "The AI tutor is part of Premium.", code: "premium" }, 403);

  const db = admin();
  const convId = String(body.conversation_id ?? "");
  const { data: conv } = await db.from("tutor_conversations").select("*").eq("id", convId).maybeSingle();
  if (!conv || conv.user_id !== user.id || conv.mode !== "ai") return json({ error: "Conversation not found." }, 404);
  const { data: scenario } = conv.scenario_id
    ? await db.from("conversation_scenarios").select("*").eq("id", conv.scenario_id).maybeSingle()
    : { data: null };

  if (body.action === "open") {
    const { count } = await db.from("tutor_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id);
    if ((count ?? 0) > 0) return json({ error: "Already started." }, 409);
    const first = (scenario?.script as { who: string; ru: string; en: string }[] | undefined)?.find((s) => s.who === "tutor");
    const opener = first ?? { ru: "Привет! Как прошёл твой день?", en: "Hi! How was your day?" };
    await db.rpc("tutor_log", { u: user.id, p_conversation: conv.id, p_role: "tutor", p_ru: opener.ru, p_en: opener.en, p_correction: null });
    return json({ reply: { reply_ru: opener.ru, reply_en: opener.en, correction: null, new_words: [] } });
  }

  if (body.action !== "reply") return json({ error: "Bad request." }, 400);
  const message = String(body.message ?? "").trim();
  if (!message || message.length > 600) return json({ error: "Messages can be up to 600 characters." }, 400);
  if (conv.turns >= 200) return json({ error: "This conversation is full. Start a new one." }, 409);

  const { data: mine } = await db.from("tutor_conversations").select("id").eq("user_id", user.id);
  const { count: today } = await db.from("tutor_messages").select("id", { count: "exact", head: true })
    .in("conversation_id", (mine ?? []).map((c) => c.id)).eq("role", "user")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((today ?? 0) >= 300) return json({ error: "You've reached today's conversation limit. Come back tomorrow!" }, 429);

  const [{ data: profile }, { data: history }, { data: srs }] = await Promise.all([
    db.from("profiles").select("ru_level, ru_forms").eq("id", user.id).maybeSingle(),
    db.from("tutor_messages").select("role, ru, en").eq("conversation_id", conv.id).order("id", { ascending: false }).limit(24),
    db.from("srs_items").select("item_id").eq("user_id", user.id).eq("kind", "word").order("created_at", { ascending: false }).limit(60),
  ]);
  const ids = (srs ?? []).map((s) => s.item_id);
  const { data: words } = ids.length ? await db.from("vocab").select("ru").in("id", ids) : { data: [] };

  const msgs: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of (history ?? []).reverse()) {
    msgs.push(m.role === "tutor"
      ? { role: "assistant", content: JSON.stringify({ reply_ru: m.ru, reply_en: m.en }) }
      : { role: "user", content: m.ru });
  }
  if (msgs[0]?.role === "assistant") msgs.unshift({ role: "user", content: "(начало разговора)" });
  const note = typeof body.pronunciation_note === "string" && body.pronunciation_note ? `\n[pronunciation note: ${body.pronunciation_note.slice(0, 200)}]` : "";
  msgs.push({ role: "user", content: message + note });

  const reply = await callClaude(
    systemPrompt({ level: conv.level, forms: profile?.ru_forms ?? "m", scenario, words: (words ?? []).map((w) => w.ru) }),
    msgs,
  );
  if (!reply) return json({ error: "The tutor couldn't answer right now. Please try again." }, 502);

  await db.rpc("tutor_log", { u: user.id, p_conversation: conv.id, p_role: "user", p_ru: message, p_en: "", p_correction: reply.correction });
  await db.rpc("tutor_log", { u: user.id, p_conversation: conv.id, p_role: "tutor", p_ru: reply.reply_ru, p_en: reply.reply_en, p_correction: null });
  return json({ reply });
}
