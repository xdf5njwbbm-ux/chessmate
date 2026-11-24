import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chess, type Move } from "chess.js";
import { ChevronLeft, ChevronRight, Swords } from "lucide-react";
import { api } from "../lib/api";
import { Engine, cpLoss } from "../lib/engine";
import { classifyLoss, describeMove, reactionPhrase, type Reaction } from "../lib/movePhrases";
import { TERMINATION, tcLabel } from "../lib/constants";
import type { Game, Level, Mini } from "../lib/types";
import { useEntitlements, useLearner, useSession } from "../state/session";
import { Board } from "../components/Board";
import { MoveList } from "../components/GameParts";
import { RussianLine } from "../components/RussianText";
import { BackButton, Button, EmptyState, PageLoader, Progress, Stat } from "../components/ui";

type Evaluated = { score: number; best: string | null }; // from side to move
const LABEL: Record<Reaction, { l: string; c: string }> = {
  best: { l: "Best", c: "text-accent-soft" },
  good: { l: "Good", c: "text-fog" },
  inaccuracy: { l: "Inaccuracy", c: "text-warn" },
  mistake: { l: "Mistake", c: "text-[#f59e6b]" },
  blunder: { l: "Blunder", c: "text-danger" },
};

export default function Analysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { uid, profile } = useSession();
  const ent = useEntitlements();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<{ white: Mini | null; black: Mini | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [evals, setEvals] = useState<Evaluated[]>([]);
  const [sel, setSel] = useState<number>(-1);
  const engine = useRef<Engine | null>(null);
  const depth = ent.full_analysis ? 13 : 9;

  useEffect(() => {
    if (!id) return;
    api.game(id).then((g) => (g ? setGame(g) : setErr("Game not found."))).catch((e) => setErr((e as Error).message));
    api.gamePlayers(id).then(setPlayers).catch(() => {});
  }, [id]);

  const moves = useMemo(() => {
    const c = new Chess();
    const out: Move[] = [];
    for (const u of game?.moves ?? []) out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }));
    return out;
  }, [game?.moves]);
  const fens = useMemo(() => [new Chess().fen(), ...moves.map((m) => m.after)], [moves]);

  useEffect(() => {
    if (!game) return;
    setSel(moves.length - 1);
    const e = new Engine();
    engine.current = e;
    let alive = true;
    (async () => {
      const out: Evaluated[] = [];
      for (const fen of fens) {
        if (!alive) return;
        const c = new Chess(fen);
        if (c.isCheckmate()) out.push({ score: -100000, best: null });
        else if (c.isGameOver()) out.push({ score: 0, best: null });
        else {
          try {
            const r = await e.evaluate(fen, depth);
            out.push({ score: r.score, best: r.best });
          } catch {
            return;
          }
        }
        if (alive) setEvals([...out]);
      }
    })();
    return () => {
      alive = false;
      e.destroy();
    };
  }, [game, fens, depth, moves.length]);

  const done = evals.length === fens.length;
  const verdicts = useMemo(
    () => moves.map((_, i) => (evals[i + 1] && evals[i] ? classifyLoss(cpLoss(evals[i].score, evals[i + 1].score)) : null)),
    [moves, evals],
  );

  if (err) return <EmptyState icon={<Swords className="size-7" />} title="Can't open this game" body={err} action={<Button variant="secondary" onClick={() => navigate("/stats")}>Back</Button>} />;
  if (!game) return <PageLoader />;

  const myColor = game.white_id === uid ? "w" : "b";
  const white = game.opponent_kind === "ai" ? (myColor === "w" ? "You" : `Stockfish ~${game.ai_elo}`) : players?.white?.display_name ?? "White";
  const black = game.opponent_kind === "ai" ? (myColor === "b" ? "You" : `Stockfish ~${game.ai_elo}`) : players?.black?.display_name ?? "Black";
  const whiteScore = (i: number) => (evals[i] ? (i % 2 === 0 ? evals[i].score : -evals[i].score) : null); // white's view
  const accuracy = (color: "w" | "b") => {
    const losses = verdicts.map((v, i) => ({ v, i })).filter(({ i, v }) => v && (i % 2 === 0) === (color === "w")).map(({ i }) => cpLoss(evals[i].score, evals[i + 1].score));
    if (!losses.length) return null;
    const avg = losses.reduce((a, b) => a + b, 0) / losses.length;
    return Math.max(0, Math.min(100, Math.round(103.17 * Math.exp(-0.0435 * (avg / 10) * 1.0) - 3.17)));
  };
  const counts = (color: "w" | "b") => {
    const c = { inaccuracy: 0, mistake: 0, blunder: 0 };
    verdicts.forEach((v, i) => {
      if (v && (i % 2 === 0) === (color === "w") && v in c) c[v as keyof typeof c]++;
    });
    return c;
  };

  const selMove = sel >= 0 ? moves[sel] : null;
  const selVerdict = sel >= 0 ? verdicts[sel] : null;
  const bestBefore = sel >= 0 ? evals[sel]?.best : evals[0]?.best;
  const level = (profile?.ru_level ?? "A1") as Level;
  const learner = useLearner();
  const card = selMove ? describeMove({ move: selMove, ply: sel, level, forms: profile?.ru_forms ?? "m", speaker: selMove.color === myColor ? "me" : game.opponent_kind === "ai" ? "ai" : "opponent" }) : null;
  const comment = selVerdict && selVerdict !== "good" ? reactionPhrase(selVerdict, level, profile?.ru_forms ?? "m") : null;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <BackButton />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-semibold">Game analysis</h1>
          <div className="text-sm text-mist">{white} vs {black} · {game.result ?? "—"} {TERMINATION[game.termination ?? ""] ?? ""} · {tcLabel(game.time_control)}{game.rated ? " · rated" : ""}</div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="mx-auto w-full max-w-[600px]">
          <EvalGraph values={fens.map((_, i) => whiteScore(i))} sel={sel + 1} onPick={(i) => setSel(i - 1)} />
          <div className="mt-3">
            <Board id={`analysis-${game.id}`} fen={fens[sel + 1]} orientation={myColor === "b" ? "black" : "white"} movable={null}
              lastMove={selMove ? selMove.from + selMove.to : null}
              arrows={done && bestBefore && selVerdict && selVerdict !== "best" ? [{ from: bestBefore.slice(0, 2), to: bestBefore.slice(2, 4) }] : undefined} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={sel < 0} onClick={() => setSel(sel - 1)}><ChevronLeft className="size-4" /></Button>
            <div className="min-w-0 flex-1"><MoveList sans={moves.map((m) => m.san)} active={sel} onPick={setSel} /></div>
            <Button size="sm" variant="secondary" disabled={sel >= moves.length - 1} onClick={() => setSel(sel + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        </div>

        <div className="grid content-start gap-4">
          {!done && (
            <div className="card p-4">
              <div className="mb-2 text-sm text-mist">Stockfish is analysing ({evals.length}/{fens.length} positions, depth {depth})…</div>
              <Progress value={(evals.length / fens.length) * 100} />
            </div>
          )}
          <div className="card grid grid-cols-2 gap-4 p-4">
            {(["w", "b"] as const).map((c) => {
              const k = counts(c);
              return (
                <div key={c}>
                  <Stat label={c === "w" ? white : black} value={done && accuracy(c) != null ? `${accuracy(c)}%` : "…"} sub="accuracy (estimate)" />
                  <div className="mt-2 text-xs text-mist">
                    <span className="text-warn">{k.inaccuracy} inaccuracies</span> · <span className="text-[#f59e6b]">{k.mistake} mistakes</span> · <span className="text-danger">{k.blunder} blunders</span>
                  </div>
                </div>
              );
            })}
          </div>
          {selMove && card ? (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-mist">Move {Math.floor(sel / 2) + 1}{sel % 2 ? "…" : "."} {selMove.san}</div>
                {selVerdict && <span className={`text-sm font-semibold ${LABEL[selVerdict].c}`}>{LABEL[selVerdict].l}</span>}
              </div>
              {done && bestBefore && selVerdict && selVerdict !== "best" && (
                <div className="mt-1 text-sm text-mist">Engine preferred <b className="text-fog">{new Chess(fens[sel]).move({ from: bestBefore.slice(0, 2), to: bestBefore.slice(2, 4), promotion: bestBefore[4] || undefined }).san}</b> (green arrow).</div>
              )}
              {learner && <div className="mt-4"><RussianLine line={{ ru: card.phrase.ru, en: card.phrase.en, words: card.phrase.words }} showEn size="md" saveSource="game" /></div>}
              {learner && comment && <div className="mt-4 border-t border-white/[0.06] pt-4"><RussianLine line={{ ru: comment.ru, en: comment.en, words: comment.words }} showEn size="md" saveSource="game" /></div>}
            </div>
          ) : (
            <div className="card p-4 text-sm text-mist">Pick a move to see the engine's verdict{learner ? " and how to talk about it in Russian" : ""}.</div>
          )}
          {!ent.full_analysis && <p className="text-xs text-faint">Free plan analysis runs at depth {depth}. Premium analyses deeper.</p>}
        </div>
      </div>
    </div>
  );
}

function EvalGraph({ values, sel, onPick }: { values: (number | null)[]; sel: number; onPick: (i: number) => void }) {
  const w = 600;
  const h = 90;
  const y = (v: number) => h / 2 - (h / 2 - 4) * (2 / (1 + Math.exp(-v / 400)) - 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => (v == null ? null : `${i * step},${y(v)}`)).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full cursor-pointer rounded-xl bg-ink-800" preserveAspectRatio="none"
      onClick={(e) => {
        const r = (e.currentTarget as SVGElement).getBoundingClientRect();
        onPick(Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)));
      }} role="img" aria-label="Evaluation graph">
      <rect x="0" y="0" width={w} height={h / 2} fill="rgb(255 255 255 / 0.06)" />
      <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="rgb(255 255 255 / 0.15)" />
      {pts && <polyline points={pts} fill="none" stroke="var(--color-accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      <line x1={sel * step} x2={sel * step} y1="0" y2={h} stroke="var(--color-gold)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
