import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, EyeOff } from "lucide-react";
import { api } from "../lib/api";
import { TERMINATION, bracket, poolLabel, tcLabel } from "../lib/constants";
import { ago, pct, ratingText } from "../lib/format";
import { blindLevelLabel } from "../lib/blindfold";
import type { BlindfoldStats, ChessStats, Curriculum, Dashboard, GameSummary, Pool } from "../lib/types";
import { useLearner } from "../state/session";
import { Button, EmptyState, Initials, PageHeader, PageLoader, Progress, SectionTitle, Segmented, Stat } from "../components/ui";

export default function Stats() {
  const learner = useLearner();
  const [tab, setTab] = useState<"chess" | "russian">("chess");
  return (
    <div>
      <PageHeader
        title="My Progress"
        subtitle={learner ? "Your chess rating and your Russian progress are tracked separately — they're never combined." : "Your ratings, results and games."}
        right={learner ? <Segmented value={tab} onChange={setTab} options={[{ v: "chess", l: "Chess" }, { v: "russian", l: "Russian" }]} /> : undefined}
      />
      {tab === "chess" || !learner ? <ChessTab /> : <RussianTab />}
    </div>
  );
}

function RatingChart({ points }: { points: { r: number; t: string }[] }) {
  if (points.length < 2) return <div className="grid h-44 place-items-center text-sm text-mist">Play more rated games to see your rating history.</div>;
  const w = 640;
  const h = 170;
  const rs = points.map((p) => p.r);
  const min = Math.min(...rs) - 20;
  const max = Math.max(...rs) + 20;
  const x = (i: number) => 30 + (i / (points.length - 1)) * (w - 40);
  const y = (r: number) => 10 + (1 - (r - min) / Math.max(1, max - min)) * (h - 30);
  const peakIdx = rs.indexOf(Math.max(...rs));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full" role="img" aria-label="Rating history">
      {[min, (min + max) / 2, max].map((v) => (
        <g key={v}>
          <line x1="30" x2={w - 10} y1={y(v)} y2={y(v)} stroke="rgb(255 255 255 / 0.06)" />
          <text x="0" y={y(v) + 4} fill="var(--color-faint)" fontSize="11">{Math.round(v)}</text>
        </g>
      ))}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.r)}`).join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx={x(peakIdx)} cy={y(rs[peakIdx])} r="4.5" fill="var(--color-gold)" />
      <circle cx={x(points.length - 1)} cy={y(rs.at(-1)!)} r="4" fill="var(--color-accent)" />
    </svg>
  );
}

function ChessTab() {
  const navigate = useNavigate();
  const [s, setS] = useState<ChessStats | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);
  const [filter, setFilter] = useState<"all" | "rated" | "casual" | "ai">("all");
  const [games, setGames] = useState<{ total: number; games: GameSummary[] } | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    api.chessStats().then((x) => {
      setS(x);
      setPool((p) => p ?? x.pools[0]?.pool ?? null);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    api.myGames(filter, 20, page * 20).then(setGames).catch(() => {});
  }, [filter, page]);

  if (!s) return <PageLoader />;
  const t = s.totals;
  const decided = t.wins + t.losses + t.draws;
  const cur = s.pools.find((p) => p.pool === pool);

  return (
    <div>
      <div className="card grid grid-cols-2 gap-5 p-5 md:grid-cols-5">
        <Stat label="Games" value={t.games} sub={`${t.rated} rated · ${t.vs_ai} vs AI`} />
        <Stat label="Win rate" value={decided ? `${pct(t.wins, decided)}%` : "—"} sub={`${t.wins}W ${t.losses}L ${t.draws}D`} />
        <Stat label="As White" value={t.as_white ? `${pct(t.as_white_wins, t.as_white)}%` : "—"} sub={`${t.as_white} games`} />
        <Stat label="As Black" value={t.as_black ? `${pct(t.as_black_wins, t.as_black)}%` : "—"} sub={`${t.as_black} games`} />
        <Stat label="vs Stockfish" value={t.vs_ai ? `${t.vs_ai_wins}/${t.vs_ai}` : "—"} sub="wins · unrated" />
      </div>

      <SectionTitle>Ratings by time control</SectionTitle>
      {s.pools.length === 0 ? (
        <div className="card p-5 text-sm text-mist">No rated games yet. Your first five rated games in a time control are placement games; your rating appears after them.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {s.pools.map((p) => (
              <button key={p.pool} onClick={() => setPool(p.pool)} className={`card card-hover p-4 text-left ${pool === p.pool ? "!border-accent/50" : ""}`}>
                <div className="text-xs font-semibold uppercase tracking-wider text-mist">{poolLabel(p.pool)}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">{ratingText(p.rating, p.status)}</div>
                <div className="mt-0.5 text-xs text-mist">{p.rating != null ? `${bracket(p.rating)} · peak ${p.peak ?? "—"}` : `${p.placement_left} placement game${p.placement_left === 1 ? "" : "s"} left`}</div>
                <div className="mt-2 text-xs text-faint">{p.wins}W {p.losses}L {p.draws}D · {p.status}</div>
              </button>
            ))}
          </div>
          {cur && (
            <div className="card mt-3 p-4">
              <div className="mb-2 text-sm font-semibold">{poolLabel(cur.pool)} rating history</div>
              <RatingChart points={cur.history.filter((h) => h.status !== "unrated")} />
            </div>
          )}
        </>
      )}

      {s.advanced && (s.by_opponent?.length || Object.keys(s.terminations ?? {}).length) ? (
        <>
          <SectionTitle>Deeper stats</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="card p-5">
              <div className="mb-3 text-sm font-semibold">Score by opponent rating</div>
              <div className="grid gap-2">
                {(s.by_opponent ?? []).map((b) => (
                  <div key={b.band} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 tabular-nums text-mist">{b.band}–{b.band + 199}</span>
                    <Progress value={b.score} />
                    <span className="w-24 shrink-0 text-right tabular-nums">{b.score}% · {b.games}g</span>
                  </div>
                ))}
                {!s.by_opponent?.length && <div className="text-sm text-mist">Play rated games to fill this in.</div>}
              </div>
            </div>
            <div className="card p-5">
              <div className="mb-3 text-sm font-semibold">How games ended</div>
              <div className="grid gap-1.5 text-sm">
                {Object.entries(s.terminations ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <div key={k} className="flex justify-between"><span className="text-mist">{TERMINATION[k] ?? k}</span><span className="tabular-nums">{v}</span></div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : null}

      <BlindfoldSection />

      <SectionTitle right={<Segmented size="sm" value={filter} onChange={(v) => { setFilter(v); setPage(0); }} options={[{ v: "all", l: "All" }, { v: "rated", l: "Rated" }, { v: "casual", l: "Casual" }, { v: "ai", l: "vs AI" }]} />}>Match history</SectionTitle>
      {!games ? <PageLoader /> : games.games.length === 0 ? (
        <EmptyState title="No games here yet" action={<Button onClick={() => navigate("/play")}>Play a game</Button>} />
      ) : (
        <div className="card divide-y divide-white/[0.06]">
          {games.games.map((g) => {
            const won = (g.result === "1-0" && g.my_color === "white") || (g.result === "0-1" && g.my_color === "black");
            const draw = g.result === "1/2-1/2";
            return (
              <button key={g.id} onClick={() => g.status === "finished" && navigate(`/analysis/${g.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${g.status === "aborted" ? "bg-white/[0.05] text-faint" : won ? "bg-accent/15 text-accent" : draw ? "bg-white/10 text-fog" : "bg-danger/15 text-danger"}`}>
                  {g.status === "aborted" ? "–" : won ? "W" : draw ? "D" : "L"}
                </span>
                {g.opponent_kind === "ai" ? <div className="grid size-9 place-items-center rounded-full bg-white/[0.06]"><Bot className="size-4 text-accent" /></div> : <Initials name={g.opponent?.display_name} size={36} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{g.opponent_kind === "ai" ? `Stockfish ~${g.ai_elo}` : g.opponent?.display_name ?? "Former member"}{g.opponent_rating ? <span className="text-sm text-mist"> ({g.opponent_rating})</span> : null}</div>
                  <div className="text-xs text-mist">{tcLabel(g.time_control)} · {g.rated ? "Rated" : g.opponent_kind === "ai" ? "Practice" : "Casual"} · {TERMINATION[g.termination ?? ""] ?? ""} · {ago(g.finished_at ?? g.updated_at)}</div>
                </div>
                {g.rated && g.my_delta != null && (
                  <span className={`text-sm font-semibold tabular-nums ${g.my_status === "unrated" ? "text-mist" : g.my_delta >= 0 ? "text-accent-soft" : "text-danger"}`}>
                    {g.my_status === "unrated" ? "placement" : `${g.my_delta >= 0 ? "+" : ""}${g.my_delta}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {games && games.total > 20 && (
        <div className="mt-3 flex justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</Button>
          <Button size="sm" variant="secondary" disabled={(page + 1) * 20 >= games.total} onClick={() => setPage(page + 1)}>Older</Button>
        </div>
      )}
    </div>
  );
}

function RussianTab() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [c, setC] = useState<Curriculum | null>(null);
  useEffect(() => {
    api.dashboard().then(setD).catch(() => {});
    api.curriculum().then(setC).catch(() => {});
  }, []);
  if (!d || !c) return <PageLoader />;
  const r = d.russian;
  return (
    <div>
      <div className="card grid grid-cols-2 gap-5 p-5 md:grid-cols-4">
        <Stat label="Current level" value={r.level} sub={r.certified.length ? `certified: ${r.certified.join(", ")}` : "no level tests passed yet"} />
        <Stat label="Lessons" value={`${r.lessons_completed}/${r.lessons_total}`} sub={`${r.overall_progress}% of the course`} />
        <Stat label="Vocabulary" value={r.words} sub={`${r.mastered} mastered · ${r.phrases} phrases`} />
        <Stat label="Streak" value={`${r.streak} days`} sub={`best ${r.streak_best}`} tone={r.streak ? "gold" : undefined} />
        <Stat label="Listening accuracy" value={r.listening.total ? `${pct(r.listening.correct, r.listening.total)}%` : "—"} sub={`${r.listening.total} questions`} />
        <Stat label="Speaking attempts" value={r.speaking.attempts} sub={`${r.speaking.passed} clear`} />
        <Stat label="Pronunciation score" value={r.speaking.avg_score ?? "—"} sub={r.speaking.avg_score != null ? "average" : "needs neural scoring"} />
        <Stat label="Reviews due" value={r.due_reviews} />
      </div>
      <SectionTitle>Progress by level</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {c.levels.map((lv) => {
          const done = lv.lessons.filter((l) => l.completed).length;
          return (
            <div key={lv.code} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold">{lv.code} · {lv.name}</span>
                {lv.test?.passed ? <span className="tag !bg-gold/10 !text-gold">Certified</span> : lv.test?.best_pct != null ? <span className="tag">Test best {lv.test.best_pct}%</span> : null}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={(done / lv.lessons.length) * 100} tone={lv.test?.passed ? "gold" : "accent"} />
                <span className="shrink-0 text-sm tabular-nums text-mist">{done}/{lv.lessons.length}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlindfoldSection() {
  const navigate = useNavigate();
  const [b, setB] = useState<BlindfoldStats | null>(null);
  useEffect(() => {
    api.blindfoldStats().then(setB).catch(() => {});
  }, []);
  useEffect(() => {
    if (b && window.location.hash.endsWith("#blindfold")) document.getElementById("blindfold")?.scrollIntoView({ behavior: "smooth" });
  }, [b]);
  if (!b) return null;
  const t = b.totals;
  const r = b.rating;
  const secs = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);
  return (
    <div id="blindfold" className="scroll-mt-6">
      <SectionTitle>
        <span className="inline-flex items-center gap-2"><EyeOff className="size-5 text-gold" /> Blindfold</span>
      </SectionTitle>
      {t.games === 0 && !r ? (
        <div className="card flex flex-wrap items-center gap-4 p-5">
          <p className="flex-1 text-sm text-mist">Play with invisible pieces against Stockfish or online. Online blindfold games have their own rating, separate from everything else.</p>
          <Button onClick={() => navigate("/play")}>Try blindfold</Button>
        </div>
      ) : (
        <div className="card p-5">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            <Stat label="Blindfold rating" tone="gold"
              value={r?.rating ?? "Unrated"}
              sub={r ? (r.rating == null ? `${r.placement_left} placement game${r.placement_left === 1 ? "" : "s"} left` : `Best ${r.peak ?? r.rating}`) : "Play online blindfold"} />
            <Stat label="Games" value={t.games} sub={`${t.wins}W · ${t.losses}L · ${t.draws}D`} />
            <Stat label="Accuracy" value={t.accuracy == null ? "—" : `${t.accuracy}%`} sub="vs Stockfish" />
            <Stat label="Avg. move time" value={secs(t.avg_response_ms)} />
            <Stat label="Mistakes" value={t.mistakes + t.blunders} sub={`${t.blunders} blunder${t.blunders === 1 ? "" : "s"}`} />
            <Stat label="Reveals" value={t.reveals} sub={`${t.no_reveal_games} game${t.no_reveal_games === 1 ? "" : "s"} without one`} />
            <Stat label="Longest game, no reveal" value={`${t.longest_no_reveal_game}`} sub="your moves" />
            <Stat label="Best blind streak" value={`${t.longest_blind_streak}`} sub="moves in a row" />
          </div>
          {b.by_level.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {b.by_level.map((l) => (
                <span key={l.level} className="tag">{blindLevelLabel(l.level)} · {l.games} game{l.games === 1 ? "" : "s"} · {l.wins} won{l.accuracy != null ? ` · ${l.accuracy}%` : ""}</span>
              ))}
            </div>
          )}
          {b.recent.length > 0 && (
            <div className="mt-5 grid gap-1.5 text-sm">
              {b.recent.slice(0, 8).map((g) => (
                <div key={g.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl bg-white/[0.03] px-3 py-2">
                  <span className={`w-12 font-semibold ${g.result === "win" ? "text-accent-soft" : g.result === "loss" ? "text-danger" : "text-mist"}`}>{g.result === "win" ? "Won" : g.result === "loss" ? "Lost" : "Draw"}</span>
                  <span className="flex-1 text-mist">{g.opponent_kind === "ai" ? `Stockfish ~${g.ai_elo}` : "Online"} · {blindLevelLabel(g.level)}</span>
                  <span className="tabular-nums text-mist">{g.accuracy != null ? `${g.accuracy}% · ` : ""}{g.reveals} reveal{g.reveals === 1 ? "" : "s"} · {ago(g.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
