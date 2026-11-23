import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Chess, type Move } from "chess.js";
import { BarChart3, Flag, RotateCcw, Undo2 } from "lucide-react";
import { Engine, cpLoss } from "../lib/engine";
import { describeMove, classifyLoss, type MoveCard, type Reaction } from "../lib/movePhrases";
import { api, recordAiGame } from "../lib/api";
import { TERMINATION } from "../lib/constants";
import { uuid } from "../lib/format";
import type { Game, Level } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { Board, capturedPieces } from "../components/Board";
import { LearningPanel, LearningPopup } from "../components/LearningPanel";
import { useWide } from "../lib/useMedia";
import { MoveList, PlayerBar } from "../components/GameParts";
import { BackButton, Button, Confirm, Spinner } from "../components/ui";

type FocusWord = { id: string; ru: string; stressed: string; en: string };

/** Stockfish answers in a few milliseconds; a short, human-feeling pause makes its moves easy to follow. */
const BOT_MIN_THINK_MS = 1100;
const BOT_THINK_JITTER_MS = 700;
/** Its piece glides slowly enough to see where it came from. */
const BOT_ANIMATION_MS = 600;

export default function ComputerGame() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useSession();
  const toast = useToast();
  const elo = Math.max(100, Math.min(3000, Number(params.get("elo")) || 900));
  const color: "w" | "b" = params.get("color") === "black" ? "b" : "w";
  const level = (profile?.ru_level ?? "A1") as Level;
  const forms = profile?.ru_forms ?? "m";

  const [gameKey, setGameKey] = useState(0);
  const [moves, setMoves] = useState<Move[]>([]);
  const [cards, setCards] = useState<{ ply: number; card: MoveCard }[]>([]);
  const [thinking, setThinking] = useState(false);
  const [engineState, setEngineState] = useState<"loading" | "ready" | "error">("loading");
  const [ended, setEnded] = useState<null | { result: string; termination: string; saved?: Game }>(null);
  const [undos, setUndos] = useState(0);
  const [confirmResign, setConfirmResign] = useState(false);
  const [focus, setFocus] = useState<FocusWord[]>([]);
  const engine = useRef<Engine | null>(null);
  const evalForUser = useRef<number | null>(null);
  const ref = useRef(uuid());
  const generation = useRef(0);
  const endCard = useRef<HTMLDivElement>(null);
  const wide = useWide();
  const [collapse, setCollapse] = useState(0);
  const boardBox = useRef<HTMLDivElement>(null);

  const fen = moves.at(-1)?.after ?? new Chess().fen();

  useEffect(() => {
    api.focusWords().then((w) => setFocus(w)).catch(() => {});
  }, []);

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
      setEnded({ result, termination });
      if (all.length < 2) return;
      try {
        const r = await recordAiGame({ client_ref: ref.current, moves: all.map((m) => m.from + m.to + (m.promotion ?? "")), color, ai_elo: elo, claim, undo_count: undos });
        setEnded({ result, termination, saved: r.game });
      } catch (e) {
        toast({ title: "The game couldn't be saved to your history.", body: (e as Error).message, tone: "error" });
      }
    },
    [color, elo, undos, toast],
  );

  const isOver = !!ended;
  useEffect(() => {
    if (isOver) {
      setTimeout(() => {
        setCollapse((n) => n + 1); // get the pop-up out of the way of the result card
        endCard.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }, [isOver]);

  const addCard = (ply: number, card: MoveCard) => setCards((c) => [...c.filter((x) => x.ply < ply), { ply, card }]);

  const aiTurn = useCallback(
    async (history: Move[], reaction: Reaction | null) => {
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
        addCard(next.length - 1, describeMove({ move: mv, ply: next.length - 1, level, forms, speaker: "ai", reactionToPrevious: reaction }));
        if (c.isGameOver()) {
          finish(next, "over");
          return;
        }
        // evaluate the learner's new position so we can react to their next move
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
    [elo, level, forms, finish, toast],
  );

  // engine opens when the learner has black
  useEffect(() => {
    if (engineState === "ready" && color === "b" && moves.length === 0 && !thinking && !ended) aiTurn([], null);
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
    addCard(next.length - 1, describeMove({ move: mv, ply: next.length - 1, level, forms, speaker: "me" }));
    if (c.isGameOver()) {
      finish(next, "over");
      return;
    }
    let reaction: Reaction | null = null;
    const before = evalForUser.current;
    if (before != null && engine.current) {
      try {
        setThinking(true);
        const after = await engine.current.evaluate(c.fen(), 10);
        reaction = classifyLoss(cpLoss(before, after.score));
      } catch {
        reaction = null;
      }
    }
    aiTurn(next, reaction);
  };

  const undo = () => {
    if (thinking || ended || !moves.length) return;
    const back = moves.at(-1)!.color === color ? 1 : 2;
    const next = moves.slice(0, Math.max(0, moves.length - back));
    if (next.length === moves.length) return;
    generation.current++;
    setMoves(next);
    setCards((c) => c.filter((x) => x.ply < next.length));
    setUndos((u) => u + 1);
    evalForUser.current = null;
    const e = engine.current;
    const pos = next.at(-1)?.after ?? new Chess().fen();
    if (e && new Chess(pos).turn() === color) {
      const gen = generation.current;
      e.evaluate(pos, 10).then((r) => gen === generation.current && (evalForUser.current = r.score)).catch(() => {});
    }
  };

  const newGame = () => {
    generation.current++;
    ref.current = uuid();
    setMoves([]);
    setCards([]);
    setEnded(null);
    setUndos(0);
    setThinking(false);
    evalForUser.current = null;
    setGameKey((k) => k + 1);
  };

  const cap = capturedPieces(fen);
  const userColor = color;
  const aiColor = color === "w" ? "b" : "w";
  const won = ended && ((ended.result === "1-0" && color === "w") || (ended.result === "0-1" && color === "b"));
  const draw = ended?.result === "1/2-1/2";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="mx-auto w-full max-w-[600px]">
        <div className="mb-1 flex items-center gap-2">
          <BackButton to="/play" />
          <div className="flex-1 font-semibold">Practice vs Stockfish <span className="ml-1 tag">~{elo}</span> <span className="tag">Unrated</span></div>
          {engineState === "loading" && <span className="flex items-center gap-2 text-xs text-mist"><Spinner className="size-4" /> Loading engine…</span>}
        </div>
        <PlayerBar
          name="Stockfish"
          ai
          sub={`Strength ~${elo}`}
          captured={aiColor === "w" ? cap.byWhite : cap.byBlack}
          plus={aiColor === "w" ? Math.max(0, cap.diff) : Math.max(0, -cap.diff)}
          color={aiColor}
          note={thinking ? "thinking…" : null}
        />
        <div ref={boardBox} onPointerDown={() => !wide && setCollapse((n) => n + 1)}>
        <Board
          id={`ai-${gameKey}`}
          animationMs={moves.at(-1)?.color === aiColor ? BOT_ANIMATION_MS : 200}
          fen={fen}
          orientation={color === "w" ? "white" : "black"}
          movable={!thinking && !ended && engineState === "ready" ? userColor : null}
          lastMove={moves.at(-1) ? moves.at(-1)!.from + moves.at(-1)!.to : null}
          onMove={onMove}
        />
        </div>
        <PlayerBar
          name="You"
          level={level}
          captured={userColor === "w" ? cap.byWhite : cap.byBlack}
          plus={userColor === "w" ? Math.max(0, cap.diff) : Math.max(0, -cap.diff)}
          color={userColor}
        />
        <MoveList sans={moves.map((m) => m.san)} />

        {engineState === "error" && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">Stockfish couldn't start in this browser. Try reloading, or use a current version of Chrome, Edge, Firefox or Safari.</div>
        )}

        {ended ? (
          <div ref={endCard} className="card mt-4 animate-rise scroll-mb-24 p-5 text-center">
            <div className={`font-display text-3xl font-semibold ${won ? "text-gold" : ""}`}>{draw ? "Draw" : won ? "You won!" : "Stockfish won"}</div>
            <div className="mt-1 text-sm text-mist">{TERMINATION[ended.termination] ?? ""} · practice game, no rating change{undos ? ` · ${undos} undo${undos > 1 ? "s" : ""}` : ""}</div>
            <div className="ru mt-3 text-lg">{draw ? "Ничья! Хорошая партия." : won ? "Поздравляю! Ты выиграл" + (forms === "f" ? "а" : "") + "!" : "Ничего страшного — в следующий раз!"}</div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={newGame}><RotateCcw className="size-4" /> Play again</Button>
              {ended.saved && <Button variant="secondary" onClick={() => navigate(`/analysis/${ended.saved!.id}`)}><BarChart3 className="size-4" /> Analyze</Button>}
              <Button variant="ghost" onClick={() => navigate("/play")}>Change settings</Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={!moves.length || thinking} onClick={undo}><Undo2 className="size-4" /> Undo</Button>
            <Button size="sm" variant="secondary" disabled={moves.length < 2} onClick={() => setConfirmResign(true)}><Flag className="size-4" /> Resign</Button>
          </div>
        )}
      </div>

      {wide ? (
        <div className="lg:sticky lg:top-6 lg:self-start">
          <LearningPanel cards={cards} focus={focus} />
        </div>
      ) : (
        <LearningPopup cards={cards} focus={focus} collapse={collapse} avoid={boardBox} />
      )}

      <Confirm open={confirmResign} onClose={() => setConfirmResign(false)} title="Resign this game?" body="It's a practice game — your rating won't change." confirmLabel="Resign" danger onConfirm={() => finish(moves, "resign")} />
    </div>
  );
}
