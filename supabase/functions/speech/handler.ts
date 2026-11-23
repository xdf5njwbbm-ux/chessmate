// Russian Chess Academy — `speech` edge function.
//   status  → which neural-speech features are configured
//   tts     → Azure neural Russian voice (mp3), cached in Storage
//   assess  → Azure pronunciation assessment of a 16 kHz mono WAV recording
// Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION secrets. Without them the
// app falls back to the device's voices and speech recognizer.
import { admin, caller, CORS, entitlements, env, json } from "../_shared/http.ts";

const VOICES: Record<string, string> = {
  female: "ru-RU-SvetlanaNeural",
  male: "ru-RU-DmitryNeural",
  female2: "ru-RU-DariyaNeural",
};
const RATES: Record<string, string> = { "1": "0%", "0.75": "-25%", "0.5": "-50%" };

const key = () => env("AZURE_SPEECH_KEY");
const region = () => env("AZURE_SPEECH_REGION");
const ttsUrl = () => env("AZURE_TTS_URL") ?? `https://${region()}.tts.speech.microsoft.com/cognitiveservices/v1`;
const sttUrl = () =>
  env("AZURE_STT_URL") ??
  `https://${region()}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

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

async function tts(userId: string, body: Record<string, unknown>): Promise<Response> {
  const text = String(body.text ?? "").replace(/́/g, "").trim();
  const voice = VOICES[String(body.voice)] ?? VOICES.female;
  const rate = RATES[String(body.rate ?? "1")] ?? "0%";
  if (!text || text.length > 400) return json({ error: "Text must be 1–400 characters." }, 400);
  if (limited(userId, "tts", 240, 60_000)) return json({ error: "Too many requests." }, 429);

  const path = `${await sha256(`${voice}|${rate}|${text}`)}.mp3`;
  const bucket = admin().storage.from("tts");
  try {
    const { data } = await bucket.download(path);
    if (data) return new Response(data, { headers: { ...CORS, "Content-Type": "audio/mpeg", "X-Cache": "hit" } });
  } catch {
    /* not cached */
  }

  const ssml = `<speak version="1.0" xml:lang="ru-RU"><voice name="${voice}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`;
  const res = await fetch(ttsUrl(), {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key()!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "russian-chess-academy",
    },
    body: ssml,
  });
  if (!res.ok) {
    console.error("azure tts", res.status, await res.text().catch(() => ""));
    return json({ error: "The voice service is unavailable right now." }, 502);
  }
  const audio = new Uint8Array(await res.arrayBuffer());
  try {
    await bucket.upload(path, audio, { contentType: "audio/mpeg", upsert: true });
  } catch {
    /* caching is best-effort */
  }
  return new Response(audio, { headers: { ...CORS, "Content-Type": "audio/mpeg", "X-Cache": "miss" } });
}

type AzWord = {
  Word: string;
  AccuracyScore?: number;
  ErrorType?: string;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
  Syllables?: { Syllable: string; AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }[];
  Phonemes?: { Phoneme: string; AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }[];
};

/** Normalizes Azure's detailed response (it has used two shapes over time). */
export function parseAssessment(az: Record<string, unknown>) {
  // deno-lint-ignore no-explicit-any
  const best = (az.NBest as any[] | undefined)?.[0];
  if (az.RecognitionStatus !== "Success" || !best) return null;
  const pa = best.PronunciationAssessment ?? best;
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.round(v * 10) / 10 : null);
  const words = ((best.Words ?? []) as AzWord[]).map((w) => ({
    word: w.Word,
    accuracy: num(w.PronunciationAssessment?.AccuracyScore ?? w.AccuracyScore),
    error: w.PronunciationAssessment?.ErrorType ?? w.ErrorType ?? "None",
    syllables: (w.Syllables ?? []).map((s) => ({ s: s.Syllable, accuracy: num(s.PronunciationAssessment?.AccuracyScore ?? s.AccuracyScore) })),
    phonemes: (w.Phonemes ?? []).map((p) => ({ p: p.Phoneme, accuracy: num(p.PronunciationAssessment?.AccuracyScore ?? p.AccuracyScore) })),
  }));
  return {
    recognized: String(best.Display ?? az.DisplayText ?? ""),
    pron: num(pa.PronScore),
    accuracy: num(pa.AccuracyScore),
    fluency: num(pa.FluencyScore),
    completeness: num(pa.CompletenessScore),
    prosody: num(pa.ProsodyScore),
    words,
  };
}

async function assess(userId: string, body: Record<string, unknown>): Promise<Response> {
  const text = String(body.text ?? "").replace(/́/g, "").trim();
  const audioB64 = String(body.audio ?? "");
  if (!text || text.length > 400) return json({ error: "Text must be 1–400 characters." }, 400);
  if (!audioB64 || audioB64.length > 4_000_000) return json({ error: "Recordings can be up to about 60 seconds." }, 400);
  if (limited(userId, "assess", 60, 60_000)) return json({ error: "Too many requests." }, 429);
  let audio: Uint8Array;
  try {
    audio = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
  } catch {
    return json({ error: "Bad audio." }, 400);
  }
  if (audio.length < 44 || String.fromCharCode(...audio.slice(0, 4)) !== "RIFF") return json({ error: "Audio must be WAV." }, 400);
  const durationMs = Math.round(((audio.length - 44) / 32000) * 1000); // 16 kHz, 16-bit mono

  const config = {
    ReferenceText: text,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    EnableMiscue: true,
  };
  const header = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(config))));
  const res = await fetch(`${sttUrl()}?language=ru-RU&format=detailed`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key()!,
      "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
      Accept: "application/json",
      "Pronunciation-Assessment": header,
    },
    body: audio,
  });
  if (!res.ok) {
    console.error("azure assess", res.status, await res.text().catch(() => ""));
    return json({ error: "The pronunciation service is unavailable right now." }, 502);
  }
  const parsed = parseAssessment(await res.json());
  if (!parsed) return json({ result: null, message: "We couldn't hear any speech. Try again a little closer to the microphone." });

  const { error } = await admin().rpc("record_scored_attempt", {
    u: userId,
    p_text: text,
    p_ref: typeof body.ref === "string" ? body.ref.slice(0, 200) : null,
    p_recognized: parsed.recognized,
    p_pron: parsed.pron,
    p_acc: parsed.accuracy,
    p_flu: parsed.fluency,
    p_comp: parsed.completeness,
    p_pros: parsed.prosody,
    p_words: parsed.words,
    p_duration_ms: durationMs,
  });
  if (error) console.error("record_scored_attempt", error.message);
  return json({ result: parsed });
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
  const configured = !!key() && (!!region() || !!env("AZURE_TTS_URL"));
  const ent = await entitlements(user.id);
  if (body.action === "status") {
    return json({
      configured,
      tts: configured && ent.neural_voices === true,
      assess: configured && ent.pronunciation_scoring === true,
      voices: Object.keys(VOICES),
    });
  }
  if (!configured) return json({ error: "Neural speech isn't configured.", code: "not_configured" }, 503);
  if (body.action === "tts") {
    if (ent.neural_voices !== true) return json({ error: "Neural voices are part of Premium.", code: "premium" }, 403);
    return tts(user.id, body);
  }
  if (body.action === "assess") {
    if (ent.pronunciation_scoring !== true) return json({ error: "Pronunciation scoring is part of Premium.", code: "premium" }, 403);
    return assess(user.id, body);
  }
  return json({ error: "Bad request." }, 400);
}
