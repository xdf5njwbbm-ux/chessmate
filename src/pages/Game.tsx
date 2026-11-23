import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chess, type Square } from "chess.js";
import { Chessboard, defaultPieces, type PieceDropHandlerArgs, type SquareHandlerArgs, type PieceHandlerArgs } from "react-chessboard";
import { Ellipsis, Flag, Handshake, Heart, RotateCcw, Swords, UserRound, X } from "lucide-react";
import { api, gameAction, GameActionError } from "../lib/api";
import { supabase } from "../lib/supabase";
import { TERMINATION, TIME_CONTROLS } from "../lib/constants";
import { clock } from "../lib/format";
import type { Game, Mini } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { useLive } from "../state/live";
import { Avatar, Button, Confirm, EmptyState, FullScreenLoader, Sheet, Spinner, TopBar } from "../components/ui";
import { ReportSheet } from "../components/ReportSheet";

type Color = "w" | "b";
type Optimistic = { fen: string; moves: string[]; sans: string[] };

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
function materialDiff(fen: string): number {
  let d = 0;
  for (const ch of fen.split(" ")[0]) {
    const v = VALUES[ch.toLowerCase()];
    if (v === undefined) continue;
    d += ch === ch.toUpperCase() ? v : -v;
  }
  return d;
}

function PlayerBar({
  user,
  color,
  ms,
  ticking,
  perMove,
  material,
  isMe,
  offeredDraw,
}: {
  user: Mini | null | undefined;
  color: Color;
  ms: number;
  ticking: boolean;
  perMove: boolean;
  material: number;
  isMe: boolean;
  offeredDraw: boolean;
}) {
  const low = !perMove && ms < 20_000;
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <Avatar path={user?.photo} name={user?.first_name} size={42} online={!isMe && user?.online} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{user ? (isMe ? "You" : user.first_name) : "Former member"}</span>
          <span className={`size-3 shrink-0 rounded-full border ${color === "w" ? "border-white/40 bg-white" : "border-white/30 bg-ink-950"}`} />
          {material > 0 && <span className="text-xs font-semibold text-mist">+{material}</span>}
        </div>
        <div className="text-xs text-mist">
          {user?.elo ? `${user.elo} Elo · ` : ""}
          {user?.rating ?? ""} rating
          {offeredDraw && <span className="ml-2 font-semibold text-gold">offered a draw</span>}
        </div>
      </div>
      <div
        className={`min-w-[92px] rounded-xl px-3 py-2 text-right font-mono text-xl font-semibold tabular-nums transition-colors ${
          ticking ? (low ? "bg-danger text-white" : "bg-white text-ink-950") : "bg-white/[0.06] text-fog"
        }`}
      >
        {clock(ms, perMove)}
      </div>
    </div>
  );
}

export default function GamePage() {
  const { id } = useParams();
  const { uid } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshInbox } = useLive();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<{ white: Mini | null; black: Mini | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [optimistic, setOptimistic] = useState<Optimistic | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const gameRef = useRef<Game | null>(null);
  const flagFor = useRef<number>(-1);
  const movesEnd = useRef<HTMLDivElement>(null);

  const accept = useCallback((g: Game) => {
    const cur = gameRef.current;
    if (cur && cur.id === g.id && g.version < cur.version) return;
    gameRef.current = g;
    setGame(g);
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    gameRef.current = null;
    setGame(null);
    setPlayers(null);
    setError(null);
    setSelected(null);
    setPromo(null);
    setOptimistic(null);

    const t0 = Date.now();
    api
      .serverNow()
      .then((sn) => alive && setOffset(Date.parse(sn) - (t0 + Date.now()) / 2))
      .catch(() => {});
    const fetchGame = () =>
      api
        .game(id)
        .then((g) => {
          if (!alive) return;
          if (!g) setError("This game doesn't exist or isn't yours.");
          else accept(g);
        })
        .catch((e) => alive && !gameRef.current && setError(e.message));
    fetchGame();
    api.gamePlayers(id).then((p) => alive && setPlayers(p)).catch(() => {});

    const ch = supabase
      .channel(`game:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` }, (payload) =>
        accept(payload.new as Game),
      )
      .subscribe();
    // safety net if a realtime event is missed (backgrounded tab, flaky network)
    const poll = setInterval(() => document.visibilityState === "visible" && fetchGame(), 12_000);
    const onVis = () => document.visibilityState === "visible" && fetchGame();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [id, accept]);

  // follow a rematch
  useEffect(() => {
    if (game?.next_game_id) {
      toast({ title: "Rematch! Colors swapped.", tone: "success" });
      navigate(`/game/${game.next_game_id}`, { replace: true });
    }
  }, [game?.next_game_id, navigate, toast]);

  // refresh the inbox when the game ends
  const status = game?.status;
  useEffect(() => {
    if (status && status !== "active") refreshInbox();
  }, [status, refreshInbox]);

  const myColor: Color | null = game ? (game.white_id === uid ? "w" : game.black_id === uid ? "b" : null) : null;
  const display = optimistic ?? (game ? { fen: game.fen, moves: game.moves, sans: game.sans } : null);
  const chess = useMemo(() => (display ? new Chess(display.fen) : null), [display?.fen]); // eslint-disable-line react-hooks/exhaustive-deps
  const turn = (display?.fen.split(" ")[1] ?? "w") as Color;
  const isActive = game?.status === "active";
  const myTurn = isActive && !!myColor && turn === myColor && !optimistic;
  const serverTurn = (game?.fen.split(" ")[1] ?? "w") as Color;
  const running = !!game && isActive && game.moves.length >= 2;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), game?.per_move ? 1000 : 100);
    return () => clearInterval(t);
  }, [running, game?.per_move]);

  const msFor = (c: Color) => {
    if (!game) return 0;
    const base = c === "w" ? game.white_ms : game.black_ms;
    if (running && serverTurn === c) return base - Math.max(0, now + offset - Date.parse(game.turn_started_at));
    return base;
  };

  // claim a win on time when the side to move runs out
  const flagMs = msFor(serverTurn);
  useEffect(() => {
    if (!game || !running || !myColor || flagMs > 0 || flagFor.current === game.version) return;
    flagFor.current = game.version;
    gameAction(game.id, "flag")
      .then((r) => accept(r.game))
      .catch((e: GameActionError) => {
        if (e.game) accept(e.game);
        // clocks disagreed slightly; try again shortly
        setTimeout(() => (flagFor.current = -1), 1000);
      });
  }, [flagMs, running, game, myColor, accept]);

  useEffect(() => {
    movesEnd.current?.scrollIntoView({ block: "nearest", inline: "end" });
  }, [display?.moves.length]);

  const sendMove = useCallback(
    async (from: string, to: string, promotion?: string) => {
      const g = gameRef.current;
      if (!g) return;
      const c = new Chess(g.fen);
      let mv;
      try {
        mv = c.move({ from, to, promotion });
      } catch {
        return;
      }
      const uci = from + to + (mv.promotion ?? "");
      setOptimistic({ fen: c.fen(), moves: [...g.moves, uci], sans: [...g.sans, mv.san] });
      setSelected(null);
      try {
        const r = await gameAction(g.id, "move", uci);
        accept(r.game);
      } catch (e) {
        const err = e as GameActionError;
        if (err.game) accept(err.game);
        toast({ title: err.message, tone: "error" });
      } finally {
        setOptimistic(null);
      }
    },
    [accept, toast],
  );

  const needsPromotion = (from: string, to: string) =>
    !!chess?.moves({ square: from as Square, verbose: true }).some((m) => m.to === to && m.promotion);
  const isLegal = (from: string, to: string) =>
    !!chess?.moves({ square: from as Square, verbose: true }).some((m) => m.to === to);

  const tryMove = (from: string, to: string): boolean => {
    if (!myTurn || !isLegal(from, to)) return false;
    if (needsPromotion(from, to)) {
      setPromo({ from, to });
      return false;
    }
    sendMove(from, to);
    return true;
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs) =>
    targetSquare ? tryMove(sourceSquare, targetSquare) : false;

  const onSquareClick = ({ square, piece }: SquareHandlerArgs) => {
    if (!myTurn) return;
    if (selected && selected !== square && isLegal(selected, square)) {
      tryMove(selected, square);
      setSelected(null);
      return;
    }
    if (piece && piece.pieceType[0] === myColor) setSelected(selected === square ? null : square);
    else setSelected(null);
  };

  const canDragPiece = ({ piece }: PieceHandlerArgs) => myTurn && piece.pieceType[0] === myColor;

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    const last = display?.moves.at(-1);
    if (last) {
      s[last.slice(0, 2)] = { backgroundColor: "rgba(227,185,100,0.42)" };
      s[last.slice(2, 4)] = { backgroundColor: "rgba(227,185,100,0.55)" };
    }
    if (chess?.inCheck()) {
      for (const row of chess.board())
        for (const sq of row)
          if (sq && sq.type === "k" && sq.color === chess.turn())
            s[sq.square] = { background: "radial-gradient(circle, rgba(255,80,80,0.95) 0%, rgba(255,80,80,0.45) 45%, transparent 75%)" };
    }
    if (selected && chess) {
      s[selected] = { ...(s[selected] ?? {}), backgroundColor: "rgba(76,141,255,0.5)" };
      for (const m of chess.moves({ square: selected as Square, verbose: true })) {
        s[m.to] = {
          ...(s[m.to] ?? {}),
          background: chess.get(m.to as Square)
            ? "radial-gradient(circle, transparent 56%, rgba(11,18,34,0.38) 58%)"
            : "radial-gradient(circle, rgba(11,18,34,0.34) 21%, transparent 23%)",
        };
      }
    }
    return s;
  }, [display?.moves, chess, selected]);

  const act = async (action: "resign" | "abort" | "offer_draw" | "accept_draw" | "decline_draw") => {
    if (!game) return;
    setActing(action);
    try {
      const r = await gameAction(game.id, action);
      accept(r.game);
      if (action === "offer_draw") toast({ title: "Draw offered" });
    } catch (e) {
      const err = e as GameActionError;
      if (err.game) accept(err.game);
      toast({ title: err.message, tone: "error" });
    } finally {
      setActing(null);
    }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-md">
        <TopBar back="/games" />
        <EmptyState icon={<Swords className="size-8" />} title="Game unavailable" body={error} action={<Button variant="secondary" onClick={() => navigate("/games")}>Back to games</Button>} />
      </div>
    );
  }
  if (!game || !display) return <FullScreenLoader />;

  const opponentColor: Color = myColor === "b" ? "w" : "b";
  const me = myColor === "b" ? players?.black : players?.white;
  const opp = myColor === "b" ? players?.white : players?.black;
  const oppId = myColor === "b" ? game.white_id : game.black_id;
  const mat = materialDiff(display.fen);
  const matFor = (c: Color) => (c === "w" ? Math.max(0, mat) : Math.max(0, -mat));
  const tc = TIME_CONTROLS.find((t) => t.v === game.time_control);
  const ply = game.moves.length;
  const oppOfferedDraw = !!game.draw_offer_from && game.draw_offer_from === oppId;
  const iOfferedDraw = !!game.draw_offer_from && game.draw_offer_from === uid;

  const pairs: { n: number; w?: string; b?: string }[] = [];
  display.sans.forEach((san, i) => {
    if (i % 2 === 0) pairs.push({ n: i / 2 + 1, w: san });
    else pairs[pairs.length - 1].b = san;
  });

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <TopBar
        back="/games"
        title={
          <span className="flex items-center gap-2 font-sans text-base font-semibold">
            {tc?.l}
            <span className={`tag ${game.mode === "competitive" ? "!bg-gold/15 !text-gold" : ""}`}>{game.mode === "competitive" ? "Rated" : "Casual"}</span>
          </span>
        }
        right={
          <button aria-label="Game menu" onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-full text-fog hover:bg-white/5">
            <Ellipsis className="size-5" />
          </button>
        }
      />

      <div className="px-3 pt-1">
        <PlayerBar
          user={opp}
          color={opponentColor}
          ms={msFor(opponentColor)}
          ticking={running && serverTurn === opponentColor}
          perMove={game.per_move}
          material={matFor(opponentColor)}
          isMe={false}
          offeredDraw={oppOfferedDraw && isActive}
        />
        <div className="relative">
          <Chessboard
            options={{
              id: `board-${game.id}`,
              position: display.fen,
              boardOrientation: myColor === "b" ? "black" : "white",
              onPieceDrop,
              onSquareClick,
              canDragPiece,
              squareStyles,
              lightSquareStyle: { backgroundColor: "#dfe5f0" },
              darkSquareStyle: { backgroundColor: "#6a7a9f" },
              boardStyle: { borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 60px -25px rgba(0,0,0,0.85)" },
              lightSquareNotationStyle: { color: "#6a7a9f", fontWeight: 600, fontSize: 11 },
              darkSquareNotationStyle: { color: "#dfe5f0", fontWeight: 600, fontSize: 11 },
              dropSquareStyle: { boxShadow: "inset 0 0 0 3px rgba(227,185,100,0.9)" },
              animationDurationInMs: 180,
              allowDrawingArrows: true,
            }}
          />
          {promo && myColor && (
            <div className="absolute inset-0 z-10 grid animate-fade-in place-items-center rounded-[14px] bg-ink-950/70 backdrop-blur-sm">
              <div className="card p-4 text-center">
                <div className="mb-3 text-sm font-semibold text-fog">Promote to</div>
                <div className="flex gap-2">
                  {(["q", "r", "b", "n"] as const).map((p) => {
                    const key = `${myColor}${p.toUpperCase()}`;
                    const Piece = defaultPieces[key];
                    return (
                      <button
                        key={p}
                        aria-label={`Promote to ${p}`}
                        onClick={() => {
                          const { from, to } = promo;
                          setPromo(null);
                          sendMove(from, to, p);
                        }}
                        className="grid size-16 place-items-center rounded-2xl bg-white/10 hover:bg-gold/30"
                      >
                        <div className="size-12">{Piece?.()}</div>
                      </button>
                    );
                  })}
                </div>
                <button className="mt-3 text-sm text-mist" onClick={() => setPromo(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
        <PlayerBar
          user={me}
          color={myColor ?? "w"}
          ms={msFor(myColor ?? "w")}
          ticking={running && serverTurn === myColor}
          perMove={game.per_move}
          material={matFor(myColor ?? "w")}
          isMe
          offeredDraw={false}
        />
      </div>

      {/* move list */}
      <div className="no-scrollbar mx-3 mt-1 flex items-center gap-3 overflow-x-auto rounded-2xl bg-white/[0.03] px-3 py-2.5 text-sm">
        {pairs.length === 0 ? (
          <span className="text-mist">
            {isActive
              ? myTurn
                ? "You have white. Make the first move. The clock starts after both sides have moved."
                : `${opp?.first_name ?? "Your opponent"} moves first. The clock starts after both sides have moved.`
              : "No moves were played."}
          </span>
        ) : (
          pairs.map((p) => (
            <span key={p.n} className="flex shrink-0 gap-1.5">
              <span className="text-mist">{p.n}.</span>
              <span className="font-medium">{p.w}</span>
              {p.b && <span className="font-medium">{p.b}</span>}
            </span>
          ))
        )}
        <div ref={movesEnd} />
      </div>

      {isActive ? (
        <div className="safe-bottom mt-auto px-3 pb-3 pt-3">
          {oppOfferedDraw && (
            <div className="card mb-3 flex animate-rise items-center gap-3 border-gold/30 p-3 pl-4">
              <Handshake className="size-5 shrink-0 text-gold" />
              <span className="flex-1 text-sm font-medium">{opp?.first_name ?? "Your opponent"} offers a draw</span>
              <Button size="sm" variant="secondary" loading={acting === "decline_draw"} onClick={() => act("decline_draw")}>
                No
              </Button>
              <Button size="sm" loading={acting === "accept_draw"} onClick={() => act("accept_draw")}>
                Accept
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 pl-1 text-sm">
              {optimistic ? (
                <>
                  <Spinner className="size-4" /> <span className="text-mist">Sending…</span>
                </>
              ) : myTurn ? (
                <span className="font-semibold text-gold">Your move</span>
              ) : (
                <span className="text-mist">Waiting for {opp?.first_name ?? "opponent"}…</span>
              )}
            </div>
            <div className="flex gap-2">
              {ply < 2 ? (
                <Button size="sm" variant="secondary" loading={acting === "abort"} onClick={() => act("abort")}>
                  <X className="size-4" /> Abort
                </Button>
              ) : (
                <Button size="sm" variant="secondary" disabled={iOfferedDraw} loading={acting === "offer_draw"} onClick={() => act("offer_draw")}>
                  <Handshake className="size-4" /> {iOfferedDraw ? "Offered" : "Draw"}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setConfirmResign(true)}>
                <Flag className="size-4" /> Resign
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <GameOver game={game} myColor={myColor} opp={opp ?? null} oppId={oppId} />
      )}

      <Confirm
        open={confirmResign}
        onClose={() => setConfirmResign(false)}
        title="Resign this game?"
        body={`${opp?.first_name ?? "Your opponent"} will win.${game.mode === "competitive" ? " Your rating will update." : ""}`}
        confirmLabel="Resign"
        danger
        onConfirm={() => act("resign")}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Game">
        <div className="grid gap-2">
          {oppId && (
            <button className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 text-left" onClick={() => navigate(`/u/${oppId}`)}>
              <UserRound className="size-5 text-mist" /> View {opp?.first_name ?? "opponent"}'s profile
            </button>
          )}
          {oppId && opp && (
            <button className="flex items-center gap-3 rounded-2xl bg-danger/10 px-4 py-3.5 text-left text-[#ffb3b3]" onClick={() => (setMenu(false), setReport(true))}>
              <Flag className="size-5" /> Report or block {opp.first_name}
            </button>
          )}
        </div>
      </Sheet>
      {oppId && opp && (
        <ReportSheet open={report} onClose={() => setReport(false)} user={opp} gameId={game.id} onBlocked={() => navigate("/games", { replace: true })} />
      )}
    </div>
  );
}

function GameOver({ game, myColor, opp, oppId }: { game: Game; myColor: Color | null; opp: Mini | null; oppId: string | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { uid } = useSession();
  const { celebrate } = useLive();
  const [like, setLike] = useState<{ liked: boolean | null; matched: boolean; available: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (game.status === "finished") api.likeStatus(game.id).then(setLike).catch(() => {});
  }, [game.id, game.status]);

  const aborted = game.status === "aborted";
  const won = (game.result === "1-0" && myColor === "w") || (game.result === "0-1" && myColor === "b");
  const draw = game.result === "1/2-1/2";
  const delta = myColor === "w" ? game.white_delta : game.black_delta;
  const name = opp?.first_name ?? "Your opponent";

  const title = aborted ? "Game aborted" : draw ? "Draw" : won ? "You won!" : `${name} won`;
  const sub = aborted ? "No result, no rating change." : TERMINATION[game.termination ?? ""] ?? "";

  const decide = async (liked: boolean) => {
    setBusy(liked ? "like" : "pass");
    try {
      const r = await api.like(game.id, liked);
      setLike((l) => ({ available: true, ...(l ?? {}), liked: r.liked, matched: r.matched }));
      if (r.matched && opp) celebrate(opp);
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const rematch = async (action: "offer" | "accept" | "decline" | "cancel") => {
    setBusy(`rematch-${action}`);
    try {
      const r = await api.rematch(game.id, action);
      if (r.status === "started" && r.game_id) navigate(`/game/${r.game_id}`, { replace: true });
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const rematchFromOpp = !!game.rematch_offer_from && game.rematch_offer_from === oppId;
  const rematchFromMe = !!game.rematch_offer_from && game.rematch_offer_from === uid;

  return (
    <div className="safe-bottom mt-auto animate-rise px-3 pb-4 pt-3">
      <div className="card overflow-hidden">
        <div className="relative px-5 pb-4 pt-5 text-center">
          {won && <div className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-28 w-56 rounded-full bg-gold/20 blur-2xl" />}
          <h2 className={`relative font-display text-3xl font-semibold ${won ? "gold-text" : ""}`}>{title}</h2>
          <p className="relative mt-1 text-sm text-mist">
            {sub}
            {game.mode === "competitive" && delta != null && (
              <span className={`ml-2 font-semibold ${delta >= 0 ? "text-mint" : "text-danger"}`}>
                {delta >= 0 ? "+" : ""}
                {delta} rating
              </span>
            )}
          </p>
        </div>

        {!aborted && opp && like?.available && (
          <div className="border-t border-white/5 px-5 py-4">
            {like.matched ? (
              <button className="flex w-full items-center gap-3 text-left" onClick={() => navigate(`/u/${opp.id}`)}>
                <Avatar path={opp.photo} name={opp.first_name} size={44} ring />
                <span className="flex-1">
                  <span className="block font-semibold">You matched with {opp.first_name}</span>
                  <span className="block text-sm text-mist">Messaging is coming soon. Keep playing in the meantime.</span>
                </span>
                <Heart className="size-6 fill-rose text-rose" />
              </button>
            ) : like.liked === true ? (
              <div className="flex items-center gap-3">
                <Avatar path={opp.photo} name={opp.first_name} size={44} />
                <div className="flex-1 text-sm">
                  <span className="font-semibold">You liked {opp.first_name}.</span>{" "}
                  <span className="text-mist">If they like you back, it's a match.</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <Avatar path={opp.photo} name={opp.first_name} size={44} />
                  <div className="flex-1">
                    <div className="font-semibold">{like.liked === false ? `You passed on ${opp.first_name}` : `Did you enjoy playing ${opp.first_name}?`}</div>
                    <div className="text-sm text-mist">{like.liked === false ? "Changed your mind? You can still like them." : "They'll only know if it's mutual."}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                  {like.liked !== false && (
                    <button
                      aria-label="Pass"
                      disabled={!!busy}
                      onClick={() => decide(false)}
                      className="btn btn-secondary size-12"
                    >
                      {busy === "pass" ? <Spinner className="size-5" /> : <X className="size-5" />}
                    </button>
                  )}
                  <button
                    disabled={!!busy}
                    onClick={() => decide(true)}
                    className={`btn h-12 text-white ${like.liked === false ? "col-span-2" : ""}`}
                    style={{ background: "linear-gradient(180deg,#ff8aa3,#ff5c7f)", boxShadow: "0 10px 30px -12px rgba(255,107,139,.8)" }}
                  >
                    {busy === "like" ? <Spinner className="size-5 text-white" /> : <Heart className="size-5 fill-white" />} Like {opp.first_name}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-2 border-t border-white/5 p-3">
          {opp && (
            <>
              {rematchFromOpp ? (
                <div className="flex items-center gap-2 rounded-2xl bg-electric/10 p-2 pl-3">
                  <span className="flex-1 text-sm font-medium">{name} wants a rematch</span>
                  <Button size="sm" variant="secondary" loading={busy === "rematch-decline"} onClick={() => rematch("decline")}>
                    No
                  </Button>
                  <Button size="sm" variant="electric" loading={busy === "rematch-accept"} onClick={() => rematch("accept")}>
                    Play
                  </Button>
                </div>
              ) : rematchFromMe ? (
                <Button variant="secondary" loading={busy === "rematch-cancel"} onClick={() => rematch("cancel")}>
                  <Spinner className="size-4" /> Waiting for {name}… Cancel
                </Button>
              ) : (
                <Button variant="electric" loading={busy === "rematch-offer"} onClick={() => rematch("offer")}>
                  <RotateCcw className="size-4" /> Rematch
                </Button>
              )}
            </>
          )}
          <Button variant="ghost" onClick={() => navigate("/games")}>
            Back to games
          </Button>
        </div>
      </div>
    </div>
  );
}
