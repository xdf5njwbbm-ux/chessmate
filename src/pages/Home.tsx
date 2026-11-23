import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Bot, Check, Flame, Gamepad2, Headphones, Mic, Repeat2, Sparkles, Swords, Users } from "lucide-react";
import { api } from "../lib/api";
import { bracket, poolLabel, tcLabel } from "../lib/constants";
import { pct, ratingText } from "../lib/format";
import type { Dashboard } from "../lib/types";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { Button, LevelBadge, PageLoader, Progress, Ring, SectionTitle, Stat, TierIcon } from "../components/ui";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return ["Доброй ночи", "Good night"];
  if (h < 12) return ["Доброе утро", "Good morning"];
  if (h < 18) return ["Добрый день", "Good afternoon"];
  return ["Добрый вечер", "Good evening"];
}

export default function Home() {
  const { profile } = useSession();
  const { inbox } = useLive();
  const navigate = useNavigate();
  const [d, setD] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard().then(setD).catch((e) => setErr((e as Error).message));
  }, []);

  if (err) return <div className="card p-6 text-mist">{err}</div>;
  if (!d || !profile) return <PageLoader />;
  const [ru, en] = greeting();
  const r = d.russian;
  const c = d.chess;
  const main = [...c.ratings].sort((a, b) => b.games - a.games)[0];
  const rated = c.ratings.filter((x) => x.rating != null);
  const peak = rated.reduce<number | null>((m, x) => (x.peak != null && (m == null || x.peak > m) ? x.peak : m), null);
  const decided = c.totals.wins + c.totals.losses + c.totals.draws;
  const objectives = [
    { label: "Complete one Russian lesson", done: d.objectives.lesson >= 1, value: Math.min(1, d.objectives.lesson), goal: 1, Icon: BookOpen, to: r.next_lesson ? `/learn/lesson/${r.next_lesson.id}` : "/learn" },
    { label: "Play one chess game", done: d.objectives.game >= 1, value: Math.min(1, d.objectives.game), goal: 1, Icon: Swords, to: "/play" },
    { label: `Learn ${d.objectives.words_goal} new words`, done: d.objectives.words >= d.objectives.words_goal, value: Math.min(d.objectives.words, d.objectives.words_goal), goal: d.objectives.words_goal, Icon: Sparkles, to: r.next_lesson ? `/learn/lesson/${r.next_lesson.id}` : "/learn" },
    { label: "Practise five Russian sentences", done: d.objectives.sentences >= 5, value: Math.min(5, d.objectives.sentences), goal: 5, Icon: Mic, to: "/practice" },
  ];
  const doneCount = objectives.filter((o) => o.done).length;
  const myTurn = (inbox?.active ?? []).filter((g) => (g.turn === "w") === (g.my_color === "white"));

  return (
    <div>
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-mist">{en}</div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight md:text-4xl"><span className="ru">{ru}</span>, {profile.display_name}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5">
          <Flame className={`size-5 ${r.streak > 0 ? "text-gold" : "text-faint"}`} />
          <div>
            <div className="text-sm font-semibold">{r.streak} day streak</div>
            <div className="text-xs text-mist">{r.active_today ? "You studied today" : r.streak > 0 ? "Study today to keep it" : "Start one today"} · best {r.streak_best}</div>
          </div>
        </div>
      </header>

      {d.entitlements.early_access && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-sm">
          <Sparkles className="size-4 shrink-0 text-gold" />
          <span><b className="text-gold-bright">Early access:</b> every Premium feature is unlocked while subscriptions are being set up.</span>
        </div>
      )}

      {(myTurn.length > 0 || (inbox?.incoming.length ?? 0) > 0) && (
        <button onClick={() => navigate(myTurn[0] ? `/game/${myTurn[0].id}` : "/play")} className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.08] px-4 py-3 text-left">
          <Gamepad2 className="size-5 text-accent" />
          <span className="flex-1 text-sm font-medium">
            {myTurn.length > 0 ? `It's your move in ${myTurn.length} game${myTurn.length > 1 ? "s" : ""}.` : `${inbox!.incoming.length} challenge${inbox!.incoming.length > 1 ? "s" : ""} waiting for you.`}
          </span>
          <ArrowRight className="size-4 text-accent" />
        </button>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* continue learning */}
        <div className="card flex flex-col p-5 lg:col-span-2">
          <div className="flex items-start gap-5">
            <Ring value={r.level_progress} size={84} stroke={7}>
              <div className="text-center leading-none">
                <div className="text-lg font-bold">{r.level}</div>
                <div className="mt-0.5 text-[10px] text-mist">{r.level_progress}%</div>
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-mist">Russian · level {r.level}</div>
              {r.next_lesson ? (
                <>
                  <div className="mt-1 font-display text-2xl font-semibold">{r.next_lesson.title}</div>
                  <div className="ru text-lg text-mist">{r.next_lesson.title_ru}</div>
                  <p className="mt-1 text-sm text-mist">{r.next_lesson.summary}</p>
                </>
              ) : (
                <>
                  <div className="mt-1 font-display text-2xl font-semibold">{r.level_test_passed ? "Level complete" : `All ${r.level} lessons done`}</div>
                  <p className="mt-1 text-sm text-mist">{r.level_test_passed ? "Move on to the next level from Learn." : `Take the ${r.level} level test to certify it and move up.`}</p>
                </>
              )}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => navigate(r.next_lesson ? `/learn/lesson/${r.next_lesson.id}` : r.level_test_passed ? "/learn" : `/learn/test/${r.level}`)}>
              {r.next_lesson ? "Continue lesson" : r.level_test_passed ? "Open curriculum" : "Take level test"} <ArrowRight className="size-4" />
            </Button>
            {r.due_reviews > 0 && (
              <Button variant="secondary" onClick={() => navigate("/practice/review")}><Repeat2 className="size-4" /> {r.due_reviews} reviews due</Button>
            )}
          </div>
        </div>

        {/* play */}
        <div className="card flex flex-col p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-mist">Play</div>
          <div className="mt-1 font-display text-2xl font-semibold">Играем!</div>
          <p className="mt-1 text-sm text-mist">Every move comes with Russian at your level.</p>
          <div className="mt-auto grid gap-2 pt-5">
            <Button onClick={() => navigate("/play?mode=online")}><Users className="size-4" /> Play someone</Button>
            <Button variant="secondary" onClick={() => navigate("/play/computer")}><Bot className="size-4" /> Play Stockfish</Button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* objectives */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-mist">Today's objectives</div>
            <span className="text-sm text-mist">{doneCount}/4</span>
          </div>
          <div className="mt-4 grid gap-3">
            {objectives.map((o) => (
              <button key={o.label} onClick={() => navigate(o.to)} className="flex items-center gap-3 text-left">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${o.done ? "bg-accent/15 text-accent" : "bg-white/[0.05] text-mist"}`}>
                  {o.done ? <Check className="size-4" /> : <o.Icon className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${o.done ? "text-mist line-through" : "font-medium"}`}>{o.label}</span>
                  <Progress value={(o.value / o.goal) * 100} className="mt-1.5 h-1" />
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-mist">{o.value}/{o.goal}</span>
              </button>
            ))}
          </div>
        </div>

        {/* russian */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-mist">Russian progress</div>
            <LevelBadge level={r.level} />
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm"><span className="text-mist">Course progress</span><span className="tabular-nums">{r.overall_progress}%</span></div>
            <Progress value={r.overall_progress} className="mt-1.5" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <Stat label="Words learned" value={r.words} sub={`${r.mastered} mastered`} />
            <Stat label="Lessons" value={r.lessons_completed} sub={`of ${r.lessons_total}`} />
            <Stat label="Listening" value={r.listening.total ? `${pct(r.listening.correct, r.listening.total)}%` : "—"} sub={`${r.listening.total} answered`} />
            <Stat label="Speaking" value={r.speaking.attempts} sub={r.speaking.avg_score != null ? `avg score ${r.speaking.avg_score}` : "attempts"} />
          </div>
          {r.certified.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{r.certified.map((l) => <span key={l} className="tag !bg-gold/10 !text-gold">{l} certified</span>)}</div>}
        </div>

        {/* chess */}
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-mist">Chess progress</div>
            {main && <span className="tag">{poolLabel(main.pool)}</span>}
          </div>
          <div className="mt-4 flex items-end gap-3">
            <div className="text-4xl font-semibold tabular-nums">{main ? ratingText(main.rating, main.status) : "Unrated"}</div>
            <div className="pb-1 text-sm text-mist">{main?.rating != null ? bracket(main.rating) : main ? `${main.placement_left} placement games left` : "Play 5 rated games to get a rating"}</div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <Stat label="Peak" value={peak ?? "—"} tone={peak ? "gold" : undefined} />
            <Stat label="Games" value={c.totals.games} sub={`${c.totals.vs_ai} vs AI`} />
            <Stat label="Win rate" value={decided ? `${pct(c.totals.wins, decided)}%` : "—"} />
          </div>
          {c.recent.length > 0 && (
            <div className="mt-5 flex gap-1.5">
              {c.recent.map((g) => {
                const won = (g.result === "1-0" && g.my_color === "white") || (g.result === "0-1" && g.my_color === "black");
                const draw = g.result === "1/2-1/2";
                return (
                  <button key={g.id} onClick={() => navigate(`/analysis/${g.id}`)} title={`${g.opponent_kind === "ai" ? "Stockfish" : g.opponent?.display_name ?? "Opponent"} · ${tcLabel(g.time_control)}`}
                    className={`grid size-8 place-items-center rounded-lg text-xs font-bold ${won ? "bg-accent/15 text-accent" : draw ? "bg-white/10 text-fog" : "bg-danger/15 text-danger"}`}>
                    {won ? "W" : draw ? "D" : "L"}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <SectionTitle right={<button className="text-sm text-mist hover:text-white" onClick={() => navigate("/profile")}>All {d.achievement_count}</button>}>Recent achievements</SectionTitle>
      {d.achievements.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {d.achievements.map((a) => (
            <div key={a.id} className="card flex items-center gap-3 p-4">
              <TierIcon tier={a.tier} className="size-6" />
              <div className="min-w-0">
                <div className="truncate font-semibold">{a.name}</div>
                <div className="truncate text-xs text-mist">{a.description}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card flex items-center gap-3 p-4 text-sm text-mist">
          <Headphones className="size-5 text-faint" /> Finish your first lesson or game to earn your first achievement.
        </div>
      )}
    </div>
  );
}
