import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import { api } from "../lib/api";
import { TERMINATION, TIME_CONTROLS } from "../lib/constants";
import { ago, clock } from "../lib/format";
import type { ChallengeItem, GameSummary } from "../lib/types";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { Avatar, Button, EmptyState, SectionTitle, TopBar } from "../components/ui";

const tcLabel = (v: string) => TIME_CONTROLS.find((t) => t.v === v)?.l ?? v;

function ChallengeCard({ c, incoming, onDone }: { c: ChallengeItem; incoming: boolean; onDone: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
      onDone();
    }
  };
  return (
    <div className="card animate-rise p-3">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => c.user && navigate(`/u/${c.user.id}`)}>
        <Avatar path={c.user?.photo} name={c.user?.first_name} size={52} online={c.user?.online} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">
            {c.user?.first_name}
            <span className="font-normal text-mist">, {c.user?.age}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-mist">
            <span className="tag">{tcLabel(c.time_control)}</span>
            <span className={`tag ${c.mode === "competitive" ? "!bg-gold/15 !text-gold" : ""}`}>{c.mode === "competitive" ? "Rated" : "Casual"}</span>
            <span>{ago(c.created_at)}</span>
          </div>
        </div>
        {incoming && c.compat != null && <span className="rounded-full bg-gold/15 px-2.5 py-1 text-sm font-bold text-gold">{c.compat}%</span>}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {incoming ? (
          <>
            <Button size="sm" variant="secondary" loading={busy === "decline"} onClick={() => run("decline", async () => void (await api.respondChallenge(c.id, false)))}>
              Decline
            </Button>
            <Button
              size="sm"
              loading={busy === "accept"}
              onClick={() =>
                run("accept", async () => {
                  const g = await api.respondChallenge(c.id, true);
                  if (g) navigate(`/game/${g}`);
                })
              }
            >
              Accept & play
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center text-sm text-mist">Waiting for a reply…</div>
            <Button size="sm" variant="secondary" loading={busy === "cancel"} onClick={() => run("cancel", () => api.cancelChallenge(c.id))}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function GameRow({ g }: { g: GameSummary }) {
  const navigate = useNavigate();
  const myTurn = g.status === "active" && (g.turn === "w") === (g.my_color === "white");
  const won = (g.result === "1-0" && g.my_color === "white") || (g.result === "0-1" && g.my_color === "black");
  const draw = g.result === "1/2-1/2";
  const myMs = g.my_color === "white" ? g.white_ms : g.black_ms;
  return (
    <button className="card flex w-full animate-rise items-center gap-3 p-3 text-left" onClick={() => navigate(`/game/${g.id}`)}>
      <Avatar path={g.opponent?.photo} name={g.opponent?.first_name} size={48} online={g.opponent?.online} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{g.opponent?.first_name ?? "Former member"}</div>
        <div className="mt-0.5 text-xs text-mist">
          {tcLabel(g.time_control)} · {g.mode === "competitive" ? "Rated" : "Casual"}
          {g.status !== "active" && ` · ${ago(g.finished_at ?? g.updated_at)}`}
        </div>
      </div>
      {g.status === "active" ? (
        myTurn ? (
          <span className="rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-ink-950">
            Your move{g.time_control === "correspondence" ? ` · ${clock(myMs, true)}` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-mist">Their move</span>
        )
      ) : g.status === "aborted" ? (
        <span className="text-xs text-mist">Aborted</span>
      ) : (
        <span className="text-right">
          <span className={`block text-sm font-bold ${won ? "text-mint" : draw ? "text-fog" : "text-danger"}`}>{won ? "Won" : draw ? "Draw" : "Lost"}</span>
          <span className="block text-[11px] text-mist">
            {TERMINATION[g.termination ?? ""]?.replace(/^by /, "")}
            {g.my_delta != null && ` · ${g.my_delta >= 0 ? "+" : ""}${g.my_delta}`}
          </span>
        </span>
      )}
    </button>
  );
}

export default function Games() {
  const { inbox, refreshInbox } = useLive();
  const navigate = useNavigate();
  useEffect(() => {
    refreshInbox();
  }, [refreshInbox]);

  const empty = inbox && !inbox.incoming.length && !inbox.outgoing.length && !inbox.active.length && !inbox.recent.length;
  const active = [...(inbox?.active ?? [])].sort((a, b) => {
    const ta = (a.turn === "w") === (a.my_color === "white") ? 0 : 1;
    const tb = (b.turn === "w") === (b.my_color === "white") ? 0 : 1;
    return ta - tb;
  });

  return (
    <div>
      <TopBar title="Games" />
      <main className="px-4 pb-6">
        {!inbox && (
          <div className="mt-6 grid gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[74px] rounded-3xl" />
            ))}
          </div>
        )}
        {empty && (
          <EmptyState
            icon={<Swords className="size-8" />}
            title="No games yet"
            body="Challenge someone you're curious about. Your first date starts on move one."
            action={<Button onClick={() => navigate("/discover")}>Find someone to play</Button>}
          />
        )}
        {!!inbox?.incoming.length && (
          <>
            <SectionTitle>Challenges for you</SectionTitle>
            <div className="grid gap-3">
              {inbox.incoming.map((c) => (
                <ChallengeCard key={c.id} c={c} incoming onDone={refreshInbox} />
              ))}
            </div>
          </>
        )}
        {!!active.length && (
          <>
            <SectionTitle>In progress</SectionTitle>
            <div className="grid gap-2">
              {active.map((g) => (
                <GameRow key={g.id} g={g} />
              ))}
            </div>
          </>
        )}
        {!!inbox?.outgoing.length && (
          <>
            <SectionTitle>Sent challenges</SectionTitle>
            <div className="grid gap-3">
              {inbox.outgoing.map((c) => (
                <ChallengeCard key={c.id} c={c} incoming={false} onDone={refreshInbox} />
              ))}
            </div>
          </>
        )}
        {!!inbox?.recent.length && (
          <>
            <SectionTitle>Recent games</SectionTitle>
            <div className="grid gap-2">
              {inbox.recent.map((g) => (
                <GameRow key={g.id} g={g} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
