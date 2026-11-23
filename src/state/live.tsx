import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import type { Achievement, Inbox } from "../lib/types";
import { useSession } from "./session";
import { useToast } from "./toast";

type LiveCtx = {
  inbox: Inbox | null;
  refreshInbox: () => Promise<void>;
  badge: number;
  /** Shows a gold toast for each newly earned achievement id. */
  celebrate: (ids: string[] | undefined | null) => void;
};

const Ctx = createContext<LiveCtx>({ inbox: null, refreshInbox: async () => {}, badge: 0, celebrate: () => {} });

/** Realtime: challenges, games and presence. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { uid, profile } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const inboxRef = useRef<Inbox | null>(null);
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const achievements = useRef<Map<string, Achievement>>(new Map());
  const enabled = !!uid && !!profile;

  useEffect(() => {
    supabase.from("achievements").select("*").then(({ data }) => {
      for (const a of (data ?? []) as Achievement[]) achievements.current.set(a.id, a);
    });
  }, []);

  const celebrate = useCallback(
    (ids: string[] | undefined | null) => {
      for (const id of ids ?? []) {
        const a = achievements.current.get(id);
        toast({ title: `Achievement unlocked: ${a?.name ?? id}`, body: a?.description, tone: "gold", duration: 6000 });
      }
    },
    [toast],
  );

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
          toast({ title: `${c.user.display_name} challenged you`, body: "Open Play to accept.", action: { label: "View", onClick: () => navigate("/play") } });
        }
      }
    };
    const onOutgoing = async (payload: { eventType: string; new: Record<string, unknown> }) => {
      const prev = inboxRef.current?.outgoing.find((x) => x.id === payload.new.id);
      await refreshInbox();
      if (payload.eventType !== "UPDATE") return;
      const name = prev?.user?.display_name ?? "Your friend";
      if (payload.new.status === "accepted" && payload.new.game_id) {
        const gameId = String(payload.new.game_id);
        if (!pathRef.current.startsWith("/game/")) {
          toast({ title: `${name} accepted. Game on!`, tone: "success" });
          navigate(`/game/${gameId}`);
        } else {
          toast({ title: `${name} accepted your challenge`, action: { label: "Play", onClick: () => navigate(`/game/${gameId}`) } });
        }
      } else if (payload.new.status === "declined") {
        toast({ title: `${name} declined your challenge` });
      }
    };

    const channel = supabase
      .channel(`live:${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `to_id=eq.${uid}` }, onIncoming)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenges", filter: `from_id=eq.${uid}` }, onOutgoing)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `white_id=eq.${uid}` }, () => refreshInbox())
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `black_id=eq.${uid}` }, () => refreshInbox())
      .subscribe();

    const onVisible = () => document.visibilityState === "visible" && refreshInbox();
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => document.visibilityState === "visible" && refreshInbox(), 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [enabled, uid, refreshInbox, toast, navigate]);

  const myTurn = (inbox?.active ?? []).filter((g) => (g.turn === "w") === (g.my_color === "white")).length;
  const badge = (inbox?.incoming.length ?? 0) + myTurn;

  return <Ctx.Provider value={{ inbox, refreshInbox, badge, celebrate }}>{children}</Ctx.Provider>;
}

export const useLive = () => useContext(Ctx);
