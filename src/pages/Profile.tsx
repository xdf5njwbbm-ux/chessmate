import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Settings, ShieldAlert, Swords } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { POOLS, TIME_CONTROLS, bracket, poolLabel } from "../lib/constants";
import { ratingText } from "../lib/format";
import type { Achievement, PublicProfile } from "../lib/types";
import { useLearner, useSession } from "../state/session";
import { useToast } from "../state/toast";
import { Button, Chip, EmptyState, Initials, LevelBadge, PageLoader, SectionTitle, Segmented, Sheet, Stat, TierIcon, Toggle } from "../components/ui";
import { ReportSheet } from "./OnlineGame";

export default function Profile() {
  const learner = useLearner();
  const { username } = useParams();
  const { profile: me } = useSession();
  const navigate = useNavigate();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  const [all, setAll] = useState<Achievement[]>([]);
  const [challenge, setChallenge] = useState(false);
  const [report, setReport] = useState(false);
  const target = username ?? me?.username ?? "";

  useEffect(() => {
    setP(undefined);
    api.publicProfile(target).then(setP).catch(() => setP(null));
    supabase.from("achievements").select("*").order("sort").then(({ data }) => setAll((data ?? []) as Achievement[]));
  }, [target]);

  if (p === undefined) return <PageLoader />;
  if (p === null) return <EmptyState title="Player not found" body="This profile doesn't exist or isn't available." />;
  const earned = new Map(p.achievements.map((a) => [a.id, a]));
  const decided = p.stats.wins + p.stats.losses + p.stats.draws;

  return (
    <div>
      <div className="card flex flex-wrap items-center gap-5 p-6">
        <Initials name={p.display_name} size={72} online={p.online} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-semibold">{p.display_name}</h1>
            {learner && <LevelBadge level={p.ru_level} />}
            {learner && p.certified.map((l) => <span key={l} className="tag !bg-gold/10 !text-gold">{l} certified</span>)}
          </div>
          <div className="mt-1 text-mist">@{p.username} · joined {new Date(p.joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })}{p.online && !p.is_me ? " · online" : ""}</div>
        </div>
        {p.is_me ? (
          <Button variant="secondary" onClick={() => navigate("/settings")}><Settings className="size-4" /> Settings</Button>
        ) : (
          <div className="flex gap-2">
            {p.active_game ? <Button onClick={() => navigate(`/game/${p.active_game}`)}>Open game</Button> : <Button onClick={() => setChallenge(true)}><Swords className="size-4" /> Challenge</Button>}
            <Button variant="ghost" onClick={() => setReport(true)} aria-label="Report or block"><ShieldAlert className="size-4" /></Button>
          </div>
        )}
      </div>

      <SectionTitle>Chess ratings</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {POOLS.map((pool) => {
          const r = p.ratings.find((x) => x.pool === pool.id);
          return (
            <div key={pool.id} className="card p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-mist">{pool.label}</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{r ? ratingText(r.rating, r.status) : "Unrated"}</div>
              <div className="text-xs text-mist">{r?.rating != null ? `${bracket(r.rating)} · peak ${r.peak ?? "—"}` : r ? `${r.placement_left} placement left` : "No games yet"}</div>
            </div>
          );
        })}
      </div>

      <div className="card mt-4 grid grid-cols-2 gap-5 p-5 md:grid-cols-4">
        <Stat label="Games vs players" value={p.stats.games} />
        <Stat label="Win rate" value={decided ? `${Math.round((100 * p.stats.wins) / decided)}%` : "—"} sub={`${p.stats.wins}W ${p.stats.losses}L ${p.stats.draws}D`} />
        {learner && <Stat label="Russian level" value={p.ru_level} />}
        {learner && <Stat label="Lessons completed" value={p.lessons_completed} />}
      </div>

      <SectionTitle>Achievements · {p.achievements.length}/{all.length}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {all.map((a) => {
          const e = earned.get(a.id);
          return (
            <div key={a.id} className={`card flex items-center gap-3 p-4 ${e ? (a.tier === "gold" ? "border-gold/30" : "") : "opacity-45"}`}>
              <TierIcon tier={a.tier} className={`size-6 ${e ? "" : "grayscale"}`} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{a.name}</div>
                <div className="truncate text-xs text-mist">{a.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!p.is_me && <ChallengeSheet open={challenge} onClose={() => setChallenge(false)} username={p.username} name={p.display_name} />}
      {!p.is_me && <ReportSheet open={report} onClose={() => setReport(false)} userId={p.id} name={p.display_name} gameId={null} onBlocked={() => navigate("/home")} />}
    </div>
  );
}

function ChallengeSheet({ open, onClose, username, name }: { open: boolean; onClose: () => void; username: string; name: string }) {
  const toast = useToast();
  const [tc, setTc] = useState("rapid15_10");
  const [rated, setRated] = useState(false);
  const [ru, setRu] = useState(false);
  const [color, setColor] = useState<"random" | "white" | "black">("random");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={`Challenge ${name}`}>
      {POOLS.map((pool) => (
        <div key={pool.id} className="mb-3">
          <div className="mb-1.5 text-xs font-semibold text-mist">{poolLabel(pool.id)}</div>
          <div className="flex flex-wrap gap-1.5">{TIME_CONTROLS.filter((t) => t.pool === pool.id).map((t) => <Chip key={t.id} on={tc === t.id} onClick={() => setTc(t.id)}>{t.label}</Chip>)}</div>
        </div>
      ))}
      <div className="mt-2 flex items-center gap-3"><span className="text-sm text-mist">You play</span>
        <Segmented size="sm" value={color} onChange={setColor} options={[{ v: "white", l: "White" }, { v: "random", l: "Random" }, { v: "black", l: "Black" }]} />
      </div>
      <Toggle checked={rated} onChange={setRated} label="Rated" />
      <Toggle checked={ru} onChange={setRu} label="Russian-only chat" />
      <Button className="mt-3 w-full" loading={busy} onClick={async () => {
        setBusy(true);
        try {
          await api.sendChallenge(username, tc, rated, ru, color);
          toast({ title: `Challenge sent to ${name}`, tone: "success" });
          onClose();
        } catch (e) {
          toast({ title: (e as Error).message, tone: "error" });
        } finally {
          setBusy(false);
        }
      }}>Send challenge</Button>
    </Sheet>
  );
}
