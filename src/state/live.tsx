import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import type { Inbox, Mini } from "../lib/types";
import { useSession } from "./session";
import { useToast } from "./toast";
import { MatchCelebration } from "../components/MatchCelebration";

type LiveCtx = {
  inbox: Inbox | null;
  refreshInbox: () => Promise<void>;
  badge: number;
  celebrate: (user: Mini) => void;
};

const Ctx = createContext<LiveCtx>({ inbox: null, refreshInbox: async () => {}, badge: 0, celebrate: () => {} });

/** Realtime: incoming challenges, accepted challenges, new matches, presence heartbeat. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { uid, profile } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [match, setMatch] = useState<Mini | null>(null);
  const inboxRef = useRef<Inbox | null>(null);
  const celebrated = useRef(new Set<string>());
  const celebrate = useCallback((u: Mini) => {
    if (celebrated.current.has(u.id)) return;
    celebrated.current.add(u.id);
    setMatch(u);
  }, []);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  const enabled = !!uid && !!profile?.onboarding_complete;

  const refreshInbox = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await api.inbox();
      inboxRef.current = next;
      setInbox(next);
    } catch {
      /* offline — keep the last known inbox */
    }
  }, [enabled]);

  // presence heartbeat
  useEffect(() => {
    if (!enabled) return;
    const beat = () => document.visibilityState === "visible" && api.heartbeat().catch(() => {});
    beat();
    const t = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !uid) return;
    refreshInbox();

    const onIncoming = async (payload: { eventType: string; new: Record<string, unknown> }) => {
      const before = new Set((inboxRef.current?.incoming ?? []).map((c) => c.id));
      await refreshInbox();
      if (payload.eventType === "INSERT") {
        const c = inboxRef.current?.incoming.find((x) => x.id === payload.new.id && !before.has(x.id));
        if (c?.user) {
          toast({
            title: `${c.user.first_name} challenged you`,
            body: "Accept to start the game.",
            action: { label: "View", onClick: () => navigate("/games") },
          });
        }
      }
    };

    const onOutgoing = async (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      const prev = inboxRef.current?.outgoing.find((x) => x.id === payload.new.id);
      await refreshInbox();
      if (payload.eventType !== "UPDATE") return;
      const name = prev?.user?.first_name ?? "They";
      if (payload.new.status === "accepted" && payload.new.game_id) {
        const gameId = String(payload.new.game_id);
        if (!pathRef.current.startsWith("/game/")) {
          toast({ title: `${name} accepted. Game on!`, tone: "success" });
          navigate(`/game/${gameId}`);
        } else {
          toast({
            title: `${name} accepted your challenge`,
            action: { label: "Play", onClick: () => navigate(`/game/${gameId}`) },
          });
        }
      } else if (payload.new.status === "declined") {
        toast({ title: `${name} passed on your challenge`, body: "No worries. There are plenty of players." });
      }
    };

    const onMatch = async (payload: { new: Record<string, unknown> }) => {
      const other = String(payload.new.user_a === uid ? payload.new.user_b : payload.new.user_a);
      try {
        const p = await api.profile(other);
        if (p) {
          celebrate({
            id: p.id,
            first_name: p.first_name,
            age: p.age,
            photo: p.photos[0] ?? null,
            elo: p.elo,
            rating: p.rating,
            experience: p.experience,
            online: p.online,
          });
        }
      } catch {
        /* ignore */
      }
    };

    const channel = supabase
      .channel(`live:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `to_id=eq.${uid}` }, onIncoming)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `from_id=eq.${uid}` }, onOutgoing)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter: `user_a=eq.${uid}` }, onMatch)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches", filter: `user_b=eq.${uid}` }, onMatch)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `white_id=eq.${uid}` }, () => refreshInbox())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `black_id=eq.${uid}` }, () => refreshInbox())
      .subscribe();

    const onVisible = () => document.visibilityState === "visible" && refreshInbox();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [enabled, uid, refreshInbox, toast, navigate, celebrate]);

  const myTurn = (inbox?.active ?? []).filter((g) => (g.turn === "w") === (g.my_color === "white")).length;
  const badge = (inbox?.incoming.length ?? 0) + myTurn;

  return (
    <Ctx.Provider value={{ inbox, refreshInbox, badge, celebrate }}>
      {children}
      {match && <MatchCelebration user={match} onClose={() => setMatch(null)} />}
    </Ctx.Provider>
  );
}

export const useLive = () => useContext(Ctx);
