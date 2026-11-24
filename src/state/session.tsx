import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { api, callFunction } from "../lib/api";
import { setSpeechStatus, type SpeechStatus } from "../lib/speech";
import type { Entitlements, Profile } from "../lib/types";

type SessionCtx = {
  ready: boolean;
  session: Session | null;
  uid: string | null;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  refreshProfile: () => Promise<Profile | null>;
  saveProfile: (patch: Partial<Profile>) => Promise<void>;
  entitlements: Entitlements | null;
  refreshEntitlements: () => Promise<void>;
  speech: SpeechStatus;
  tutorAI: boolean;
  recovery: boolean;
  endRecovery: () => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [speech, setSpeech] = useState<SpeechStatus>({ configured: false, tts: false, assess: false });
  const [tutorAI, setTutorAI] = useState(false);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const uid = session?.user && !session.user.is_anonymous ? session.user.id : null;

  useEffect(() => {
    if (session && /[?&]code=/.test(window.location.search)) {
      window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    }
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (!uid) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    setProfile((data as Profile) ?? null);
    setLoadedFor(uid);
    return (data as Profile) ?? null;
  }, [uid]);

  const refreshEntitlements = useCallback(async () => {
    if (!uid) return;
    try {
      const plan = await api.myPlan();
      setEntitlements(plan.entitlements);
    } catch {
      /* keep previous */
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoadedFor(null);
      setEntitlements(null);
      return;
    }
    refreshProfile();
    refreshEntitlements();
    callFunction<SpeechStatus>("speech", { action: "status" })
      .then((s) => {
        setSpeechStatus(s);
        setSpeech(s);
      })
      .catch(() => {});
    callFunction<{ ai: boolean }>("tutor", { action: "status" })
      .then((s) => setTutorAI(!!s.ai))
      .catch(() => setTutorAI(false));
  }, [uid, refreshProfile, refreshEntitlements]);

  // keep the stored time zone current (daily objectives and streaks use it)
  useEffect(() => {
    if (!profile) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== profile.timezone) {
      supabase.from("profiles").update({ timezone: tz }).eq("id", profile.id).then(() => {});
    }
  }, [profile]);

  const saveProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!uid) return;
      const { data, error } = await supabase.from("profiles").update(patch).eq("id", uid).select("*").single();
      if (error) throw new Error(error.message);
      setProfile(data as Profile);
    },
    [uid],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const ready = authReady && (uid === null || loadedFor === uid);

  return (
    <Ctx.Provider
      value={{
        ready, session, uid, profile, setProfile, refreshProfile, saveProfile, entitlements, refreshEntitlements,
        speech, tutorAI, recovery, endRecovery: () => setRecovery(false), signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSession outside provider");
  return c;
}

/** Whether this account learns Russian. Chess-only accounts (false) never see Russian. */
export function useLearner(): boolean {
  const { profile } = useSession();
  return profile?.learn_russian !== false;
}

/** Entitlements with safe defaults while loading. */
export function useEntitlements(): Entitlements {
  const { entitlements } = useSession();
  return (
    entitlements ?? {
      plan: "free", early_access: false, levels: ["A1"], daily_reviews: 40, saved_phrases: 50, deep_learning: false,
      full_analysis: false, ai_tutor: false, neural_voices: false, pronunciation_scoring: false, advanced_stats: false, personal_plan: false,
    }
  );
}
