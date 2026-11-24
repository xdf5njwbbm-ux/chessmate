import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Chess, type Move } from "chess.js";
import { BarChart3, EyeOff, Ellipsis, Flag, Handshake, MessageSquare, RotateCcw, Send, ShieldAlert, Swords, UserRound, X } from "lucide-react";
import { api, gameAction, type GameActionError } from "../lib/api";
import { supabase } from "../lib/supabase";
import { REPORT_REASONS, TERMINATION, tcLabel } from "../lib/constants";
import { ratingText } from "../lib/format";
import { CHAT_PHRASES, describeMove, type MoveCard } from "../lib/movePhrases";
import type { Game, GameMessage, Level, Mini } from "../lib/types";

/** Quick chat for chess-only players (learners get the Russian phrases for their level). */
const EN_CHAT = ["Hi! Good luck!", "Nice move!", "Good game!", "Thanks for the game!", "Rematch?", "Oops!"];
/** English for the Russian quick phrases, so a chess-only friend understands them. */
const PHRASE_EN = new Map(Object.values(CHAT_PHRASES).flat().map((p) => [p.ru, p.en]));
import { useLearner, useSession } from "../state/session";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { Board, capturedPieces } from "../components/Board";
import { LearningPanel, LearningPopup } from "../components/LearningPanel";
import { useWide } from "../lib/useMedia";
import { MoveList, PlayerBar } from "../components/GameParts";
import { AnnouncementStrip, BlindfoldPanel, RevealButton, useBlindfold } from "../components/Blindfold";
import { AudioButtons } from "../components/Audio";
import { BackButton, Button, Confirm, EmptyState, FullScreenLoader, Segmented, Sheet, Spinner, Toggle } from "../components/ui";

type Color = "w" | "b";

export default function OnlineGame() {
  const { id } = useParams();
  const { uid, profile } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshInbox, celebrate } = useLive();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<{ white: Mini | null; black: Mini | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [optimistic, setOptimistic] = useState<{ fen: string; moves: string[] } | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const [tab, setTab] = useState<"learn" | "chat">("learn");
  const wide = useWide();
  const [collapse, setCollapse] = useState(0);
  const boardBox = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const gameRef = useRef<Game | null>(null);
  const flagFor = useRef(-1);
  const level = (profile?.ru_level ?? "A1") as Level;
  const learner = useLearner(); // each player's own setting: a chess-only player never sees the Russian side
  const forms = profile?.ru_forms ?? "m";

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
    setOptimistic(null);
    const t0 = Date.now();
    api.serverNow().then((sn) => alive && setOffset(Date.parse(sn) - (t0 + Date.now()) / 2)).catch(() => {});
    const fetchGame = () =>
      api.game(id).then((g) => {
        if (!alive) return;
        if (!g) setError("This game doesn't exist or isn't yours.");
        else accept(g);
      }).catch((e) => alive && !gameRef.current && setError((e as Error).message));
    fetchGame();
    api.gamePlayers(id).then((p) => alive && setPlayers(p)).catch(() => {});
    const ch = supabase
      .channel(`game:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` }, (p) => accept(p.new as Game))
      .subscribe((status) => alive && setLive(status === "SUBSCRIBED"));
    const onVis = () => document.visibilityState === "visible" && fetchGame();
    document.addEventListener("visibilitychange", onVis);
    const poll = setInterval(() => document.visibilityState === "visible" && fetchGame(), 3000);
    return () => {
      alive = false;
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [id, accept]);

  useEffect(() => {
    if (game?.next_game_id) {
      toast({ title: "Rematch! Colors swapped.", tone: "success" });
      navigate(`/game/${game.next_game_id}`, { replace: true });
    }
  }, [game?.next_game_id, navigate, toast]);

  const status = game?.status;
  useEffect(() => {
    if (status && status !== "active") refreshInbox();
  }, [status, refreshInbox]);

  const myColor: Color | null = game ? (game.white_id === uid ? "w" : game.black_id === uid ? "b" : null) : null;
  const display = optimistic ?? (game ? { fen: game.fen, moves: game.moves } : null);
  const isActive = game?.status === "active";
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

  const flagMs = msFor(serverTurn);
  useEffect(() => {
    if (!game || !running || !myColor || flagMs > 0 || flagFor.current === game.version) return;
    flagFor.current = game.version;
    gameAction(game.id, "flag").then((r) => accept(r.game)).catch((e: GameActionError) => {
      if (e.game) accept(e.game);
      setTimeout(() => (flagFor.current = -1), 1000);
    });
  }, [flagMs, running, game, myColor, accept]);

  // replay moves for SAN, captured pieces and the learning cards
  const replay = useMemo(() => {
    const c = new Chess();
    const list: Move[] = [];
    for (const u of display?.moves ?? []) {
      try {
        list.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }));
      } catch {
        break;
      }
    }
    return list;
  }, [display?.moves]);

  const cards = useMemo(() => {
    if (!myColor) return [];
    return replay.map((m, i) => ({
      ply: i,
      card: describeMove({ move: m, ply: i, level, forms, speaker: m.color === myColor ? "me" : "opponent" }) as MoveCard,
    }));
  }, [replay, myColor, level, forms]);

  // blindfold: pieces hidden, announcements, reveal tracking; stats saved once when a game you played here ends
  const blind = !!game?.blindfold && !!myColor;
  const bf = useBlindfold({ moves: replay, myColor: myColor ?? "w", over: !isActive, ruLevel: level, gameKey: game?.id ?? "none" });
  const sawActive = useRef<string | null>(null);
  const blindSaved = useRef<string | null>(null);
  if (isActive && game) sawActive.current = game.id;
  useEffect(() => {
    if (!blind || !game || game.status !== "finished" || sawActive.current !== game.id || blindSaved.current === game.id) return;
    blindSaved.current = game.id;
    const sm = bf.summary();
    api.recordBlindfold({
      client_ref: game.id, game_id: game.id, level: bf.level, my_moves: sm.my_moves, accuracy: null,
      avg_response_ms: sm.avg_response_ms, reveals: sm.reveals, reveal_ms: sm.reveal_ms, longest_blind_streak: sm.longest_blind_streak,
    }).then((r) => celebrate(r.new_achievements)).catch(() => {});
  }, [blind, game?.status, game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMove = async (from: string, to: string, promotion?: string) => {
    const g = gameRef.current;
    if (!g) return;
    const c = new Chess(g.fen);
    let mv: Move;
    try {
      mv = c.move({ from, to, promotion });
    } catch {
      return;
    }
    const uci = mv.from + mv.to + (mv.promotion ?? "");
    setOptimistic({ fen: c.fen(), moves: [...g.moves, uci] });
    try {
      accept((await gameAction(g.id, "move", uci)).game);
    } catch (e) {
      const err = e as GameActionError;
      if (err.game) accept(err.game);
      toast({ title: err.message, tone: "error" });
    } finally {
      setOptimistic(null);
    }
  };

  const act = async (action: "resign" | "abort" | "offer_draw" | "accept_draw" | "decline_draw") => {
    if (!game) return;
    setActing(action);
    try {
      accept((await gameAction(game.id, action)).game);
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
    return <EmptyState icon={<Swords className="size-7" />} title="Game unavailable" body={error} action={<Button variant="secondary" onClick={() => navigate("/play/friend")}>Back</Button>} />;
  }
  if (!game || !display) return <FullScreenLoader />;

  const oppColor: Color = myColor === "b" ? "w" : "b";
  const me = myColor === "b" ? players?.black : players?.white;
  const opp = myColor === "b" ? players?.white : players?.black;
  const oppId = myColor === "b" ? game.white_id : game.black_id;
  const cap = capturedPieces(display.fen);
  const ply = game.moves.length;
  const myTurn = isActive && !!myColor && serverTurn === myColor && !optimistic;
  const oppOfferedDraw = !!game.draw_offer_from && game.draw_offer_from === oppId;
  const iOfferedDraw = !!game.draw_offer_from && game.draw_offer_from === uid;
  const ratingSub = (p: Mini | null | undefined) => (p ? (p.rating != null ? ratingText(p.rating, p.rating_status) : `Unrated${p.placement_left ? ` · ${p.placement_left} placement left` : ""}`) : "");

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="mx-auto w-full max-w-[600px]">
        <div className="mb-1 flex items-center gap-2">
          <BackButton to="/play/friend" />
          <div className="flex flex-1 flex-wrap items-center gap-1.5 font-semibold">
            {tcLabel(game.time_control)}
            <span className={`tag ${game.rated ? "!bg-accent/10 !text-accent-soft" : ""}`}>{game.rated ? "Rated" : "Casual"}</span>
            {learner && game.russian_chat && <span className="tag">RU chat</span>}
            {game.blindfold && <span className="tag !text-gold"><EyeOff className="mr-1 inline size-3.5" />Blindfold</span>}
            {!live && isActive && <span className="tag" title="The live connection dropped. The game still refreshes every few seconds.">Reconnecting…</span>}
          </div>
          <button aria-label="Game menu" onClick={() => setMenu(true)} className="grid size-10 place-items-center rounded-xl text-fog hover:bg-white/5"><Ellipsis className="size-5" /></button>
        </div>
        <PlayerBar
          name={opp?.display_name ?? "Opponent"}
          sub={ratingSub(opp)}
          level={learner ? opp?.ru_level : undefined}
          online={opp?.online}
          captured={oppColor === "w" ? cap.byWhite : cap.byBlack}
          plus={oppColor === "w" ? Math.max(0, cap.diff) : Math.max(0, -cap.diff)}
          color={oppColor}
          ms={msFor(oppColor)}
          ticking={running && serverTurn === oppColor}
          perMove={game.per_move}
          note={oppOfferedDraw && isActive ? "offers a draw" : null}
        />
        <div ref={boardBox} onPointerDown={() => !wide && setCollapse((n) => n + 1)}>
        <Board
          id={`game-${game.id}`}
          animationMs={display.moves.length && ((display.moves.length - 1) % 2 === 0 ? "w" : "b") !== myColor ? 500 : 200}
          hidePieces={blind && !bf.revealed}
          lastMoveMode={blind && !bf.revealed ? bf.caps.highlight : "both"}
          showCheck={!blind || bf.revealed || bf.caps.check}
          fen={display.fen}
          orientation={myColor === "b" ? "black" : "white"}
          movable={myTurn ? myColor : null}
          lastMove={display.moves.at(-1) ?? null}
          onMove={sendMove}
        />
        </div>
        {blind && <AnnouncementStrip bf={bf} moves={replay} myColor={myColor!} over={!isActive} ruLevel={level} myTurn={myTurn} />}
        {blind && <RevealButton bf={bf} over={!isActive} />}
        <PlayerBar
          name={me?.display_name ?? "You"}
          sub={ratingSub(me)}
          level={learner ? me?.ru_level : undefined}
          captured={myColor === "w" ? cap.byWhite : cap.byBlack}
          plus={myColor === "w" ? Math.max(0, cap.diff) : Math.max(0, -cap.diff)}
          color={myColor ?? "w"}
          ms={msFor(myColor ?? "w")}
          ticking={running && serverTurn === myColor}
          perMove={game.per_move}
        />
        {(!blind || bf.caps.moveList || !isActive) && <MoveList sans={replay.map((m) => m.san)} />}

        {isActive ? (
          <div className="mt-3">
            {oppOfferedDraw && (
              <div className="card mb-3 flex animate-rise items-center gap-3 border-gold/30 p-3 pl-4">
                <Handshake className="size-5 shrink-0 text-gold" />
                <span className="flex-1 text-sm font-medium">{opp?.display_name ?? "Your opponent"} offers a draw</span>
                <Button size="sm" variant="secondary" loading={acting === "decline_draw"} onClick={() => act("decline_draw")}>No</Button>
                <Button size="sm" loading={acting === "accept_draw"} onClick={() => act("accept_draw")}>Accept</Button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 pl-1 text-sm">
                {optimistic ? <><Spinner className="size-4" /><span className="text-mist">Sending…</span></>
                  : myTurn ? <span className="font-semibold text-accent-soft">Your move{learner && <> · <span className="ru">Твой ход</span></>}</span>
                  : <span className="text-mist">Waiting for {opp?.display_name ?? "opponent"}…</span>}
              </div>
              <div className="flex gap-2">
                {ply < 2 ? (
                  <Button size="sm" variant="secondary" loading={acting === "abort"} onClick={() => act("abort")}><X className="size-4" /> Abort</Button>
                ) : (
                  <Button size="sm" variant="secondary" disabled={iOfferedDraw} loading={acting === "offer_draw"} onClick={() => act("offer_draw")}>
                    <Handshake className="size-4" /> {iOfferedDraw ? "Offered" : "Draw"}
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setConfirmResign(true)}><Flag className="size-4" /> Resign</Button>
              </div>
            </div>
            {ply < 2 && <p className="mt-2 text-xs text-faint">The clock starts after both sides have moved. Either player can abort before that.</p>}
          </div>
        ) : (
          <GameOver game={game} myColor={myColor} opp={opp ?? null} oppId={oppId} />
        )}
      </div>

      {wide ? (
        <div className="lg:sticky lg:top-6 lg:self-start">
          {(blind || learner) && (
            <div className="mb-3">
              <Segmented value={tab} onChange={setTab} options={[{ v: "learn", l: blind ? "Blindfold" : "Russian" }, { v: "chat", l: <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-3.5" /> Chat</span> }]} />
            </div>
          )}
          {tab === "learn" && (blind || learner)
            ? blind
              ? <BlindfoldPanel bf={bf} moves={replay} fen={display.fen} myColor={myColor!} over={!isActive} ruLevel={level} myTurn={myTurn} />
              : <LearningPanel cards={cards} />
            : <ChatPanel game={game} players={players} level={level} />}
        </div>
      ) : (
        <>
          {/* phones: the Russian for each move pops up over the screen; chat sits under the board */}
          {blind && <BlindfoldPanel bf={bf} moves={replay} fen={display.fen} myColor={myColor!} over={!isActive} ruLevel={level} myTurn={myTurn} />}
          <div onPointerDown={() => setCollapse((n) => n + 1)} onFocusCapture={() => setCollapse((n) => n + 1)}>
            <ChatPanel game={game} players={players} level={level} />
          </div>
          {isActive && !blind && learner && <LearningPopup cards={cards} collapse={collapse} avoid={boardBox} />}
        </>
      )}

      <Confirm open={confirmResign} onClose={() => setConfirmResign(false)} title="Resign this game?"
        body={`${opp?.display_name ?? "Your opponent"} will win.${game.rated ? " Your rating will update." : ""}`} confirmLabel="Resign" danger onConfirm={() => act("resign")} />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Game">
        <div className="grid gap-2">
          {opp && (
            <button className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 text-left" onClick={() => navigate(`/u/${opp.username}`)}>
              <UserRound className="size-5 text-mist" /> View {opp.display_name}'s profile
            </button>
          )}
          {opp && oppId && (
            <button className="flex items-center gap-3 rounded-2xl bg-danger/10 px-4 py-3.5 text-left text-[#ffb3b3]" onClick={() => { setMenu(false); setReport(true); }}>
              <ShieldAlert className="size-5" /> Report or block {opp.display_name}
            </button>
          )}
        </div>
      </Sheet>
      {oppId && opp && <ReportSheet open={report} onClose={() => setReport(false)} userId={oppId} name={opp.display_name} gameId={game.id} onBlocked={() => navigate("/play/friend", { replace: true })} />}
    </div>
  );
}

function GameOver({ game, myColor, opp, oppId }: { game: Game; myColor: Color | null; opp: Mini | null; oppId: string | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { uid, profile } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const aborted = game.status === "aborted";
  const won = (game.result === "1-0" && myColor === "w") || (game.result === "0-1" && myColor === "b");
  const draw = game.result === "1/2-1/2";
  const delta = myColor === "w" ? game.white_delta : game.black_delta;
  const before = myColor === "w" ? game.white_rating : game.black_rating;
  const st = myColor === "w" ? game.white_status : game.black_status;
  const name = opp?.display_name ?? "Your opponent";
  const f = profile?.ru_forms === "f";

  const rematch = async (action: "offer" | "accept" | "decline" | "cancel") => {
    setBusy(action);
    try {
      const r = await api.rematch(game.id, action);
      if (r.status === "started" && r.game_id) navigate(`/game/${r.game_id}`, { replace: true });
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(null);
    }
  };
  const fromOpp = !!game.rematch_offer_from && game.rematch_offer_from === oppId;
  const fromMe = !!game.rematch_offer_from && game.rematch_offer_from === uid;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    return () => clearTimeout(t);
  }, []);
  const learner = useLearner();
  const phrase = aborted || !learner ? null : draw ? "Ничья! Хорошая партия." : won ? `Я выиграл${f ? "а" : ""}! Спасибо за игру.` : "Хорошая партия! Поздравляю.";

  return (
    <div ref={box} className="card mt-4 animate-rise scroll-mb-24 overflow-hidden">
      <div className="px-5 pb-4 pt-5 text-center">
        <h2 className={`font-display text-3xl font-semibold ${won ? "text-gold" : ""}`}>{aborted ? "Game aborted" : draw ? "Draw" : won ? "You won!" : `${name} won`}</h2>
        <p className="mt-1 text-sm text-mist">
          {aborted ? "No result, no rating change." : TERMINATION[game.termination ?? ""] ?? ""}
          {game.rated && !aborted && delta != null && (
            st === "unrated"
              ? <span> · placement game — your rating appears after 5 games</span>
              : <span className={`ml-2 font-semibold ${delta >= 0 ? "text-accent-soft" : "text-danger"}`}>{delta >= 0 ? "+" : ""}{delta} → {(before ?? 0) + delta}{st === "provisional" ? "?" : ""}</span>
          )}
        </p>
        {phrase && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="ru text-lg">{phrase}</span>
            <AudioButtons text={phrase} compact />
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 border-t border-white/[0.06] p-3 sm:grid-cols-2">
        {!aborted && <Button variant="secondary" onClick={() => navigate(`/analysis/${game.id}`)}><BarChart3 className="size-4" /> Analyze</Button>}
        {opp && (fromOpp ? (
          <div className="flex items-center gap-2 rounded-xl bg-accent/10 p-2 pl-3 sm:col-span-2">
            <span className="flex-1 text-sm font-medium">{name} wants a rematch</span>
            <Button size="sm" variant="secondary" loading={busy === "decline"} onClick={() => rematch("decline")}>No</Button>
            <Button size="sm" loading={busy === "accept"} onClick={() => rematch("accept")}>Play</Button>
          </div>
        ) : fromMe ? (
          <Button variant="secondary" loading={busy === "cancel"} onClick={() => rematch("cancel")}><Spinner className="size-4" /> Waiting… Cancel</Button>
        ) : (
          <Button loading={busy === "offer"} onClick={() => rematch("offer")}><RotateCcw className="size-4" /> Rematch</Button>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({ game, players, level }: { game: Game; players: { white: Mini | null; black: Mini | null } | null; level: Level }) {
  const { uid } = useSession();
  const learner = useLearner();
  const toast = useToast();
  const [msgs, setMsgs] = useState<GameMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const nameOf = (id: string | null) => (id === uid ? "You" : id === players?.white?.id ? players.white.display_name : id === players?.black?.id ? players?.black?.display_name : "Player");

  useEffect(() => {
    let alive = true;
    const load = () => api.messages(game.id).then((m) => alive && setMsgs(m)).catch(() => {});
    load();
    const ch = supabase.channel(`chat:${game.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_messages", filter: `game_id=eq.${game.id}` }, (p) =>
        setMsgs((m) => (m.some((x) => x.id === (p.new as GameMessage).id) ? m : [...m, p.new as GameMessage])))
      .subscribe();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [game.id]);
  useEffect(() => {
    const pane = end.current?.closest<HTMLElement>("[data-chat-pane]");
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [msgs.length]);

  const send = async (body: string) => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.sendMessage(game.id, body);
      setText("");
      setMsgs(await api.messages(game.id));
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card flex max-h-[70vh] flex-col overflow-hidden">
      <div className="border-b border-white/[0.06] px-4 py-2.5 text-sm">
        <span className="font-semibold">Chat</span>
        {learner && game.russian_chat && <span className="ml-2 text-mist">· Russian only (chess notation like e4 is fine)</span>}
      </div>
      <div data-chat-pane className="min-h-[160px] flex-1 overflow-y-auto px-4 py-3">
        {msgs.length === 0 ? <p className="text-sm text-mist">{learner ? "Say hello! Tap a suggested phrase below to practise." : "Say hello!"}</p> : (
          <div className="grid gap-2">
            {msgs.map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.user_id === uid ? "ml-auto bg-accent/15" : "bg-white/[0.05]"}`}>
                <div className="text-[11px] text-mist">{nameOf(m.user_id)}</div>
                <div className={/[а-яё]/i.test(m.body) ? "ru text-[17px]" : ""}>{m.body}</div>
                {!learner && PHRASE_EN.has(m.body) && <div className="text-xs text-mist">“{PHRASE_EN.get(m.body)}”</div>}
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
      </div>
      <div className="border-t border-white/[0.06] p-3">
        <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
          {learner
            ? CHAT_PHRASES[level].map((p) => (
                <button key={p.ru} title={p.en} onClick={() => send(p.ru)} disabled={busy} className="chip ru shrink-0 !py-1.5 text-[15px]">{p.ru}</button>
              ))
            : EN_CHAT.map((p) => (
                <button key={p} onClick={() => send(p)} disabled={busy} className="chip shrink-0 !py-1.5 text-sm">{p}</button>
              ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input className="field !py-2.5" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder={learner && game.russian_chat ? "Напишите по-русски…" : "Message"} />
          <Button type="submit" disabled={!text.trim()} loading={busy}><Send className="size-4" /></Button>
        </form>
      </div>
    </section>
  );
}

export function ReportSheet({ open, onClose, userId, name, gameId, onBlocked }: { open: boolean; onClose: () => void; userId: string; name: string; gameId: string | null; onBlocked?: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("cheating");
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={`Report ${name}`}>
      <div className="grid gap-2">
        {REPORT_REASONS.map((r) => (
          <button key={r.v} onClick={() => setReason(r.v)} className={`rounded-xl border px-4 py-3 text-left text-sm ${reason === r.v ? "border-accent bg-accent/10" : "border-white/10"}`}>{r.l}</button>
        ))}
      </div>
      <textarea className="field mt-3 min-h-20" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Anything else we should know? (optional)" />
      <div className="mt-2"><Toggle checked={block} onChange={setBlock} label={`Also block ${name}`} hint="Ends games in progress and hides you from each other." /></div>
      <Button className="mt-4 w-full" variant="danger" loading={busy} onClick={async () => {
        setBusy(true);
        try {
          await api.report(userId, reason, details, gameId, block);
          toast({ title: "Thanks — our team will review this.", tone: "success" });
          onClose();
          if (block) onBlocked?.();
        } catch (e) {
          toast({ title: (e as Error).message, tone: "error" });
        } finally {
          setBusy(false);
        }
      }}>Send report</Button>
    </Sheet>
  );
}
