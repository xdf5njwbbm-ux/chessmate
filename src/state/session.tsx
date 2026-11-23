import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import type { Profile, Question } from "../lib/types";

type SessionCtx = {
  ready: boolean;
  session: Session | null;
  uid: string | null;
  profile: Profile | null;
  setProfile: (p: Profile | null) => void;
  refreshProfile: () => Promise<Profile | null>;
  questions: Question[];
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
  const [questions, setQuestions] = useState<Question[]>([]);
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
    api.questions().then(setQuestions).catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);

  // Anonymous sessions aren't Chessmate accounts.
  const uid = session?.user && !session.user.is_anonymous ? session.user.id : null;

  // Tidy the ?code=… left behind by email links once the session is established.
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

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoadedFor(null);
      return;
    }
    refreshProfile();
  }, [uid, refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const ready = authReady && (uid === null || loadedFor === uid);

  return (
    <Ctx.Provider
      value={{
        ready,
        session,
        uid,
        profile,
        setProfile,
        refreshProfile,
        questions,
        recovery,
        endRecovery: () => setRecovery(false),
        signOut,
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
