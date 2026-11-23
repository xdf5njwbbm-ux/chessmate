import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Chess, type Move } from "chess.js";
import { BarChart3, EyeOff, Flag, RotateCcw } from "lucide-react";
import { Engine, cpLoss } from "../lib/engine";
import { classifyLoss } from "../lib/movePhrases";
import { blindLevelLabel, moveAccuracy } from "../lib/blindfold";
import { api, recordAiGame } from "../lib/api";
import { TERMINATION } from "../lib/constants";
import { uuid } from "../lib/format";
import type { Game, Level } from "../lib/types";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { Board, capturedPieces } from "../components/Board";
import { AnnouncementStrip, BlindfoldPanel, RevealButton, useBlindfold, type BlindSummary } from "../components/Blindfold";
import { MoveList, PlayerBar } from "../components/GameParts";
import { BackButton, Button, Confirm, Spinner } from "../components/ui";

const BOT_MIN_THINK_MS = 1100;
const BOT_THINK_JITTER_MS = 700;

type Ended = { result: string; termination: string; saved?: Game; summary: BlindSummary & { accuracy: number | null; mistakes: number; blunders: number } };

/** Blindfold practice against Stockfish. Unrated: results only feed your blindfold training stats. */
export default function BlindfoldGame() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const { celebrate } = useLive();
  const toast = useToast();
  const elo = Math.max(100, Math.min(3000, Number(params.get("elo")) || 900));
  const color: "w" | "b" = params.get("color") === "black" ? "b" : "w";
  const ruLevel = (profile?.ru_level ?? "A1") as Level;

  const [gameKey, setGameKey] = useState(0);
  const [moves, setMoves] = useState<Move[]>([]);
  const [thinking, setThinking] = useState(false);
  const [engineState, setEngineState] = useState<"loading" | "ready" | "error">("loading");
  const [ended, setEnded] = useState<Ended | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const engine = useRef<Engine | null>(null);
  const evalForUser = useRef<number | null>(null);
  const quality = useRef<{ acc: number[]; mistakes: number; blunders: number }>({ acc: [], mistakes: 0, blunders: 0 });
  const ref = useRef(uuid());
  const generation = useRef(0);
  const endCard = useRef<HTMLDivElement>(null);

  const fen = moves.at(-1)?.after ?? new Chess().fen();
  const bf = useBlindfold({ moves, myColor: color, over: !!ended, ruLevel, gameKey: String(gameKey) });

  useEffect(() => {
    const e = new Engine();
    engine.current = e;
    let alive = true;
    e.ready.then(() => alive && setEngineState("ready")).catch(() => alive && setEngineState("error"));
    return () => {
      alive = false;
      e.destroy();
    };
  }, []);

  const finish = useCallback(
    async (all: Move[], claim: "over" | "resign") => {
      const end = new Chess(all.at(-1)?.after ?? new Chess().fen());
      const result = claim === "resign" ? (color === "w" ? "0-1" : "1-0") : end.isCheckmate() ? (end.turn() === "w" ? "0-1" : "1-0") : "1/2-1/2";
      const termination = claim === "resign" ? "resign" : end.isCheckmate() ? "checkmate" : end.isStalemate() ? "stalemate" : end.isInsufficientMaterial() ? "insufficient" : end.isThreefoldRepetition() ? "threefold" : "fifty_move";
      const q = quality.current;
      const accuracy = q.acc.length ? Math.round((q.acc.reduce((a, b) => a + b, 0) / q.acc.length) * 10) / 10 : null;
      const summary = { ...bf.summary(), accuracy, mistakes: q.mistakes, blunders: q.blunders };
      setEnded({ result, termination, summary });

      let saved: Game | undefined;
      if (all.length >= 2) {
        try {
          saved = (await recordAiGame({ client_ref: ref.current, moves: all.map((m) => m.from + m.to + (m.promotion ?? "")), color, ai_elo: elo, claim, undo_count: 0 })).game;
          setEnded({ result, termination, summary, saved });
        } catch {
          /* still keep the training stats below */
        }
      }
      const mine = result === "1/2-1/2" ? "draw" : (result === "1-0") === (color === "w") ? "win" : "loss";
      try {
        const r = await api.recordBlindfold({
          client_ref: ref.current, game_id: saved?.id ?? null, level: bf.level, color: color === "w" ? "white" : "black", result: mine,
          ai_elo: elo, my_moves: summary.my_moves, accuracy, avg_response_ms: summary.avg_response_ms, mistakes: q.mistakes, blunders: q.blunders,
          reveals: summary.reveals, reveal_ms: summary.reveal_ms, longest_blind_streak: summary.longest_blind_streak,
        });
        celebrate(r.new_achievements);
      } catch (e) {
        toast({ title: "Your blindfold stats couldn't be saved.", body: (e as Error).message, tone: "error" });
      }
    },
    [color, elo, bf, toast, celebrate],
  );

  // run the end-of-game summary after the final move has been counted
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const finishSoon = (all: Move[]) => setTimeout(() => finishRef.current(all, "over"), 60);

  const isOver = !!ended;
  useEffect(() => {
    if (isOver) setTimeout(() => endCard.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }, [isOver]);

  const aiTurn = useCallback(
    async (history: Move[]) => {
      const e = engine.current;
      if (!e) return;
      const gen = generation.current;
      setThinking(true);
      const started = performance.now();
      try {
        await e.ready;
        const before = history.at(-1)?.after ?? new Chess().fen();
        const uci = await e.botMove(before, elo);
        if (gen !== generation.current || !uci) return;
        const wait = BOT_MIN_THINK_MS + Math.random() * BOT_THINK_JITTER_MS - (performance.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (gen !== generation.current) return;
        const c = new Chess(before);
        const mv = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
        const next = [...history, mv];
        setMoves(next);
        if (c.isGameOver()) {
          finishSoon(next);
          return;
        }
        evalForUser.current = null;
        e.evaluate(c.fen(), 10).then((r) => {
          if (gen === generation.current) evalForUser.current = r.score;
        }).catch(() => {});
      } catch {
        toast({ title: "The engine stopped responding. Try starting a new game.", tone: "error" });
      } finally {
        if (gen === generation.current) setThinking(false);
      }
    },
    [elo, toast], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // the engine opens when you have black; otherwise get a baseline evaluation for your first move
  useEffect(() => {
    if (engineState !== "ready" || moves.length !== 0 || ended) return;
    if (color === "b") aiTurn([]);
    else engine.current?.evaluate(new Chess().fen(), 10).then((r) => (evalForUser.current = r.score)).catch(() => {});
  }, [engineState, gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = async (from: string, to: string, promotion?: string) => {
    if (thinking || ended) return;
    const c = new Chess(fen);
    let mv: Move;
    try {
      mv = c.move({ from, to, promotion });
    } catch {
      return;
    }
    const next = [...moves, mv];
    setMoves(next);
    if (c.isGameOver()) {
      finishSoon(next);
      return;
    }
    const before = evalForUser.current;
    if (before != null && engine.current) {
      try {
        setThinking(true);
        const after = await engine.current.evaluate(c.fen(), 10);
        quality.current.acc.push(moveAccuracy(before, after.score));
        const kind = classifyLoss(cpLoss(before, after.score));
        if (kind === "mistake") quality.current.mistakes++;
        if (kind === "blunder") quality.current.blunders++;
      } catch {
        /* accuracy is best-effort */
      }
    }
    aiTurn(next);
  };

  const newGame = () => {
    generation.current++;
    ref.current = uuid();
    quality.current = { acc: [], mistakes: 0, blunders: 0 };
    setMoves([]);
    setEnded(null);
    setThinking(false);
    evalForUser.current = null;
    setGameKey((k) => k + 1);
  };

  const cap = capturedPieces(fen);
  const aiColor = color === "w" ? "b" : "w";
  const won = ended && ((ended.result === "1-0" && color === "w") || (ended.result === "0-1" && color === "b"));
  const draw = ended?.result === "1/2-1/2";
  const myTurn = !thinking && !ended && new Chess(fen).turn() === color;
  const hidden = !bf.revealed;
  const fmtS = (ms: number | null) => (ms == null ? "—" : `${(ms / 1000).toFixed(1)} s`);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="mx-auto w-full max-w-[600px]">
        <div className="mb-1 flex items-center gap-2">
          <BackButton to="/play" />
          <div className="flex flex-1 flex-wrap items-center gap-1.5 font-semibold">
            <EyeOff className="size-4 text-gold" /> Blindfold vs Stockfish <span className="tag">~{elo}</span> <span className="tag">{blindLevelLabel(bf.level)}</span> <span className="tag">Unrated</span>
          </div>
          {engineState === "loading" && <span className="flex items-center gap-2 text-xs text-mist"><Spinner className="size-4" /> Loading engine…</span>}
        </div>
        <PlayerBar name="Stockfish" ai sub={`Strength ~${elo}`} captured={aiColor === "w" ? cap.byWhite : cap.byBlack}
          plus={aiColor === "w" ? Math.max(0, cap.diff) : Math.max(0, -cap.diff)} color={aiColor} note={thinking ? "thinking…" : null} />
        <div data-blindfold={hidden ? "hidden" : "revealed"}>
          <Board
            id={`blind-${gameKey}`}
            fen={fen}
            orientation={color === "w" ? "white" : "black"}
            movable={!thinking && !ended && engineState === "ready" ? color : null}
            lastMove={moves.at(-1) ? moves.at(-1)!.from + moves.at(-1)!.to : null}
            onMove={onMove}
            hidePieces={hidden}
            lastMoveMode={hidden ? bf.caps.highlight : "both"}
            showCheck={!hidden || bf.caps.check}
          />
        </div>
        <AnnouncementStrip bf={bf} moves={moves} myColor={color} over={isOver} ruLevel={ruLevel} myTurn={myTurn} />
        <RevealButton bf={bf} over={isOver} />
        <PlayerBar name="You" level={ruLevel} captured={color === "w" ? cap.byWhite : cap.byBlack}
          plus={color === "w" ? Math.max(0, cap.diff) : Math.max(0, -cap.diff)} color={color} />
        {(bf.caps.moveList || isOver) && <MoveList sans={moves.map((m) => m.san)} />}

        {engineState === "error" && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">Stockfish couldn't start in this browser. Try reloading, or use a current version of Chrome, Edge, Firefox or Safari.</div>
        )}

        {ended ? (
          <div ref={endCard} className="card mt-4 animate-rise scroll-mb-24 p-5 text-center">
            <div className={`font-display text-3xl font-semibold ${won ? "text-gold" : ""}`}>{draw ? "Draw" : won ? "You won blindfold!" : "Stockfish won"}</div>
            <div className="mt-1 text-sm text-mist">{TERMINATION[ended.termination] ?? ""} · {blindLevelLabel(bf.level)} · practice, no rating change</div>
            <div className="ru mt-3 text-lg">{draw ? "Ничья!" : won ? "Отлично! Ты играешь вслепую!" : "Ничего страшного — играть вслепую трудно!"}</div>
            <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-2 text-left">
              {[
                ["Accuracy", ended.summary.accuracy == null ? "—" : `${ended.summary.accuracy}%`],
                ["Avg. move time", fmtS(ended.summary.avg_response_ms)],
                ["Mistakes", `${ended.summary.mistakes + ended.summary.blunders}`],
                ["Reveals", `${ended.summary.reveals}`],
                ["Best streak", `${ended.summary.longest_blind_streak} move${ended.summary.longest_blind_streak === 1 ? "" : "s"}`],
                ["Your moves", `${ended.summary.my_moves}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-white/[0.04] px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wider text-mist">{k}</div>
                  <div className="font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={newGame}><RotateCcw className="size-4" /> Play again</Button>
              {ended.saved && <Button variant="secondary" onClick={() => navigate(`/analysis/${ended.saved!.id}`)}><BarChart3 className="size-4" /> Analyze</Button>}
              <Button variant="ghost" onClick={() => navigate("/stats#blindfold")}>Blindfold stats</Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={moves.length < 2} onClick={() => setConfirmResign(true)}><Flag className="size-4" /> Resign</Button>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <BlindfoldPanel bf={bf} moves={moves} fen={fen} myColor={color} over={isOver} ruLevel={ruLevel} myTurn={myTurn} />
      </div>

      <Confirm open={confirmResign} onClose={() => setConfirmResign(false)} title="Resign this game?" body="It's a practice game — your rating won't change." confirmLabel="Resign" danger onConfirm={() => finish(moves, "resign")} />
    </div>
  );
}
