// AI Voice Practice — talking to the database and the `voice` edge function.
import { supabase } from "../supabase";
import { ApiError, callFunction, friendly } from "../api";
import type { TutorId, VoiceLevel, VoiceMode } from "../../../supabase/functions/_shared/voice/curriculum.ts";
import type { Analysis, CallStats, HistoryEntry, LessonProgress, Memory, Report, Turn } from "../../../supabase/functions/_shared/voice/logic.ts";

export type VoiceProfile = {
  level: VoiceLevel;
  level_progress: number;
  mode: VoiceMode;
  tutor: TutorId;
  show_english: boolean;
  show_translit: boolean;
  slow: boolean;
  current_lesson: number;
  memory: Memory;
  lessons: Record<string, LessonProgress>;
  history: HistoryEntry[];
  calls: number;
  seconds: number;
  sentences: number;
};

export type CallSummary = {
  id: string;
  status: "active" | "ended";
  mode: VoiceMode;
  level: VoiceLevel;
  lesson: number | null;
  review_of: string | null;
  started_at: string;
  duration_s: number;
  sentences: number;
  has_report: boolean;
  scores: Report["scores"] | null;
  summary: string | null;
  turns: number;
};

export type VoiceHome = {
  profile: VoiceProfile;
  course: { level: string; forms: "m" | "f"; name: string };
  usage: { seconds_24h: number; limit_s: number };
  calls: CallSummary[];
};

export type VoiceStatus = { configured: boolean; allowed: boolean; ready: boolean; model: string | null };

export type CallRow = {
  id: string;
  status: "active" | "ended";
  mode: VoiceMode;
  level: VoiceLevel;
  lesson: number | null;
  review_of: string | null;
  tutor: TutorId;
  started_at: string;
  last_seen_at: string;
  duration_s: number;
  sentences: number;
  transcript: Turn[];
  report: Report | null;
};

export type ConnectResult = {
  sdp: string;
  call_id: string;
  mode: VoiceMode;
  tutor: TutorId;
  level: VoiceLevel;
  lesson: number | null;
  speed: number;
  used_s: number;
  limit_s: number;
  review: boolean;
};

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ApiError(friendly(error.message), error.code);
  return data as T;
}

export const voiceApi = {
  home: () => rpc<VoiceHome>("voice_home"),
  settings: (patch: Partial<Pick<VoiceProfile, "mode" | "tutor" | "show_english" | "show_translit" | "slow" | "current_lesson">>) =>
    rpc<VoiceProfile>("voice_settings", { p: patch }),
  status: () => callFunction<VoiceStatus>("voice", { action: "status" }),
  async call(id: string): Promise<CallRow | null> {
    const { data, error } = await supabase.from("voice_calls").select("*").eq("id", id).maybeSingle();
    if (error) throw new ApiError(friendly(error.message));
    return data as CallRow | null;
  },
  connect: (body: { sdp: string; call_id?: string; mode: VoiceMode; tutor: TutorId; lesson: number | null; slow: boolean; review_of?: string | null; resume?: { role: string; text: string }[] }) =>
    callFunction<ConnectResult>("voice", { action: "connect", ...body }),
  analyze: (callId: string, role: "tutor" | "learner", text: string, prev: string) =>
    callFunction<{ analysis: Analysis; ok: boolean }>("voice", { action: "analyze", call_id: callId, role, text, prev }),
  tts: (text: string, tutor: TutorId) => callFunction<Blob>("voice", { action: "tts", text, tutor }),
  sync: (callId: string, transcript: Turn[], keepalive = false) =>
    callFunction<{ ok?: boolean; ended?: boolean; used_s?: number; limit_s?: number; over_limit?: boolean }>("voice", { action: "sync", call_id: callId, transcript }, { keepalive }),
  end: (callId: string, transcript: Turn[] | null, elapsed: number | null, stats: CallStats | null) =>
    callFunction<{ report: Report; call_id: string }>("voice", { action: "end", call_id: callId, transcript, elapsed_s: elapsed, stats }),
};
