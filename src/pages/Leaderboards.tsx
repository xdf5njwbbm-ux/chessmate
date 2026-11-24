import { useLearner } from "../state/session";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { api } from "../lib/api";
import { POOLS, bracket } from "../lib/constants";
import { ratingText } from "../lib/format";
import type { LeaderRow, Pool } from "../lib/types";
import { Button, EmptyState, Initials, LevelBadge, PageHeader, PageLoader, Segmented } from "../components/ui";

export default function Leaderboards() {
  const learner = useLearner();
  const navigate = useNavigate();
  const [pool, setPool] = useState<Pool>("rapid");
  const [data, setData] = useState<Awaited<ReturnType<typeof api.leaderboard>> | null>(null);
  useEffect(() => {
    setData(null);
    api.leaderboard(pool).then(setData).catch(() => setData({ pool, rows: [], players: 0, me: null }));
  }, [pool]);

  return (
    <div>
      <PageHeader title="Leaderboards" subtitle="Players appear after their five placement games. Provisional ratings are marked with ?." />
      <Segmented value={pool} onChange={setPool} options={POOLS.map((p) => ({ v: p.id, l: p.label }))} />
      {data?.me && (
        <div className="card mt-4 flex items-center gap-4 border-accent/25 p-4">
          <div className="text-sm text-mist">You</div>
          <div className="text-2xl font-semibold tabular-nums">{ratingText(data.me.rating, data.me.status)}</div>
          <div className="text-sm text-mist">{data.me.rank ? `#${data.me.rank} of ${data.players}` : `${data.me.placement_left} placement game${data.me.placement_left === 1 ? "" : "s"} left`}</div>
        </div>
      )}
      {!data ? <PageLoader /> : data.rows.length === 0 ? (
        <EmptyState icon={<Trophy className="size-7" />} title="No ranked players yet" body="Be the first: finish five rated games in this time control." action={<Button onClick={() => navigate("/play/friend")}>Find a rated game</Button>} />
      ) : (
        <div className="card mt-4 divide-y divide-white/[0.06]">
          {data.rows.map((r: LeaderRow) => (
            <button key={r.id} onClick={() => navigate(`/u/${r.username}`)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] ${r.me ? "bg-accent/[0.05]" : ""}`}>
              <span className={`w-8 shrink-0 text-center font-semibold tabular-nums ${r.rank <= 3 ? "text-gold" : "text-mist"}`}>{r.rank}</span>
              <Initials name={r.display_name} size={36} online={r.online} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="truncate font-medium">{r.display_name}</span>{learner && <LevelBadge level={r.ru_level} />}</div>
                <div className="text-xs text-mist">@{r.username} · {r.games} games · {bracket(r.rating)}</div>
              </div>
              <span className="text-lg font-semibold tabular-nums">{ratingText(r.rating, r.status)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
