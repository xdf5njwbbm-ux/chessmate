import { useCallback, useEffect, useRef, useState } from "react";
import type { Move } from "chess.js";
import { Eye, EyeOff, Headphones, ListChecks, Map as MapIcon, Repeat2, Volume2 } from "lucide-react";
import {
  BLIND_LEVELS, CAPS, announceEn, announceRu, describePosition, legalMoveGroups, myMoveRu, notationLine, speakableRu, type BlindLevel,
} from "../lib/blindfold";
import { pref, setPref } from "../lib/format";
import type { Level } from "../lib/types";
import type { BlindResume } from "../lib/saved";
import { useSay, SpeakPractice } from "./Audio";
import { useLearner } from "../state/session";

/** English speech for "hear it in English" (the device voice; Russian goes through the app's voices). */
function sayEnglish(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    const v = synth.getVoices().find((x) => x.lang?.toLowerCase().startsWith("en"));
    if (v) u.voice = v;
    synth.speak(u);
  } catch {
    /* no English voice on this device */
  }
}

export type BlindSummary = { reveals: number; reveal_ms: number; longest_blind_streak: number; avg_response_ms: number | null; my_moves: number };

/**
 * Blindfold session state shared by the Stockfish and online boards: level,
 * reveal toggling (purely visual — it never touches the game), response
 * times, the no-reveal streak and spoken announcements of the opponent's moves.
 */
export function useBlindfold({ moves, myColor, over, ruLevel, gameKey, resume }: { moves: Move[]; myColor: "w" | "b"; over: boolean; ruLevel: Level; gameKey: string; resume?: BlindResume }) {
  const say = useSay();
  const learner = useLearner();
  const [level, setLevelState] = useState<BlindLevel>(() => pref<BlindLevel>("blindLevel", "intermediate"));
  const [voice, setVoiceState] = useState<boolean>(() => pref("blindVoice", true));
  const [revealed, setRevealed] = useState(false);
  const [counts, setCounts] = useState({ reveals: 0, streak: 0, longest: 0 });
  const revealedRef = useRef(false);
  revealedRef.current = revealed;
  const s = useRef({ revealStart: 0, revealMs: 0, revealedThisMove: false, turnStart: null as number | null, responses: [] as number[], seenPly: -1 });
  const resumeFrom = useRef(resume);

  const setLevel = (l: BlindLevel) => {
    setLevelState(l);
    setPref("blindLevel", l);
  };
  const setVoice = (v: boolean) => {
    setVoiceState(v);
    setPref("blindVoice", v);
  };

  // new game → fresh session (a resumed game carries its counters over, once)
  useEffect(() => {
    const r = resumeFrom.current;
    resumeFrom.current = undefined;
    s.current = { revealStart: 0, revealMs: r?.reveal_ms ?? 0, revealedThisMove: false, turnStart: null, responses: r?.responses ?? [], seenPly: moves.length - 1 };
    setRevealed(false);
    setCounts(r ? { reveals: r.reveals, streak: r.streak, longest: r.longest } : { reveals: 0, streak: 0, longest: 0 });
    if ((moves.length % 2 === 0 ? "w" : "b") === myColor) s.current.turnStart = Date.now();
  }, [gameKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const speakMove = useCallback((m: Move, lang: "ru" | "en") => {
    if (lang === "ru") say(speakableRu(announceRu(m, ruLevel)));
    else sayEnglish(announceEn(m));
  }, [say, ruLevel]);

  // react to each new move
  useEffect(() => {
    const ply = moves.length - 1;
    if (ply <= s.current.seenPly) {
      s.current.seenPly = ply; // undo / takeback
      return;
    }
    s.current.seenPly = ply;
    const last = moves[ply];
    if (!last) return;
    if (last.color === myColor) {
      if (s.current.turnStart != null) s.current.responses.push(Date.now() - s.current.turnStart);
      s.current.turnStart = null;
      const clean = !s.current.revealedThisMove && !revealedRef.current;
      setCounts((c) => {
        const streak = clean ? c.streak + 1 : 0;
        return { ...c, streak, longest: Math.max(c.longest, streak) };
      });
      s.current.revealedThisMove = false;
    } else {
      if (voice && !over) speakMove(last, learner ? "ru" : "en"); // chess-only accounts hear English
      s.current.turnStart = Date.now();
    }
  }, [moves.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleReveal = () => {
    const now = Date.now();
    if (!revealed) {
      if (!over) {
        s.current.revealStart = now;
        s.current.revealedThisMove = true;
        setCounts((c) => ({ ...c, reveals: c.reveals + 1 }));
      }
    } else if (s.current.revealStart) {
      s.current.revealMs += now - s.current.revealStart;
      s.current.revealStart = 0;
    }
    setRevealed(!revealed);
  };

  const summary = (): BlindSummary => {
    const r = s.current.responses;
    const extra = revealed && s.current.revealStart ? Date.now() - s.current.revealStart : 0;
    return {
      reveals: counts.reveals,
      reveal_ms: s.current.revealMs + extra,
      longest_blind_streak: counts.longest,
      avg_response_ms: r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : null,
      my_moves: moves.filter((m) => m.color === myColor).length,
    };
  };

  /** Counters to save with an unfinished game. */
  const snapshot = (): BlindResume => ({
    reveals: counts.reveals,
    streak: counts.streak,
    longest: counts.longest,
    reveal_ms: s.current.revealMs + (revealed && s.current.revealStart ? Date.now() - s.current.revealStart : 0),
    responses: [...s.current.responses],
  });

  return { level, setLevel, caps: CAPS[level], voice, setVoice, revealed: revealed || over, toggleReveal, counts, summary, snapshot, speakMove };
}

export type BlindfoldState = ReturnType<typeof useBlindfold>;

/** The big, always-visible Reveal / Hide button. Purely visual. */
export function RevealButton({ bf, over }: { bf: BlindfoldState; over: boolean }) {
  if (over) return null;
  return (
    <button
      onClick={bf.toggleReveal}
      aria-pressed={bf.revealed}
      className={`mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold tracking-wide transition-colors ${
        bf.revealed ? "bg-gold text-ink-950 hover:bg-gold/90" : "border border-gold/50 bg-gold/10 text-gold hover:bg-gold/20"
      }`}
    >
      {bf.revealed ? <><EyeOff className="size-5" /> HIDE BOARD</> : <><Eye className="size-5" /> REVEAL BOARD</>}
      {bf.counts.reveals > 0 && <span className="ml-1 text-xs font-semibold opacity-75">· {bf.counts.reveals} reveal{bf.counts.reveals > 1 ? "s" : ""}</span>}
    </button>
  );
}

/** Phones: the opponent's last move right under the board, so nobody has to scroll to hear or read it. */
export function AnnouncementStrip({ bf, moves, myColor, over, ruLevel, myTurn }: { bf: BlindfoldState; moves: Move[]; myColor: "w" | "b"; over: boolean; ruLevel: Level; myTurn: boolean }) {
  const learner = useLearner();
  const lastOpp = [...moves].reverse().find((m) => m.color !== myColor) ?? null;
  if (over || !lastOpp) return null;
  const text = bf.caps.text;
  return (
    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-2 pl-3 pr-1.5 lg:hidden" aria-live="polite" data-strip>
      <div className="min-w-0 flex-1">
        {text === "full" ? (
          <>
            {learner ? (
              <>
                <div className="ru truncate text-[17px] leading-tight">{announceRu(lastOpp, ruLevel)}</div>
                <div className="truncate text-xs text-mist">{announceEn(lastOpp)}</div>
              </>
            ) : (
              <div className="truncate text-[17px] leading-tight">{announceEn(lastOpp)}</div>
            )}
          </>
        ) : text === "notation" ? (
          <div className="font-mono text-lg font-semibold">{notationLine(lastOpp)}</div>
        ) : (
          <div className="text-sm text-mist">{myTurn ? "Your move. Listen again if you need to." : "Listen for the move."}</div>
        )}
      </div>
      <button className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[0.07]" aria-label="Hear the move again" onClick={() => bf.speakMove(lastOpp, learner ? "ru" : "en")}>
        <Repeat2 className="size-[18px]" />
      </button>
    </div>
  );
}

/** Announcements, training aids and Russian practice for a blindfold game. */
export function BlindfoldPanel({ bf, moves, fen, myColor, over, ruLevel, myTurn }: {
  bf: BlindfoldState; moves: Move[]; fen: string; myColor: "w" | "b"; over: boolean; ruLevel: Level; myTurn: boolean;
}) {
  const say = useSay();
  const learner = useLearner();
  const [aid, setAid] = useState<null | "repeat" | "describe" | "legal">(null);
  const lastOpp = [...moves].reverse().find((m) => m.color !== myColor) ?? null;
  const lastMine = [...moves].reverse().find((m) => m.color === myColor) ?? null;
  const caps = bf.caps;
  const writtenOk = caps.writtenAids || over;

  useEffect(() => setAid(null), [moves.length]);

  const showText = caps.text === "full" || aid === "repeat" || over;
  return (
    <section className="card overflow-hidden" aria-label="Blindfold">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <EyeOff className="size-[18px] text-gold" />
        <div className="flex-1 text-sm font-semibold">Blindfold</div>
        <label className="sr-only" htmlFor="blind-level">Level</label>
        <select id="blind-level" value={bf.level} onChange={(e) => bf.setLevel(e.target.value as BlindLevel)}
          className="h-8 rounded-lg border border-white/10 bg-ink-900 px-2 text-sm text-fog">
          {BLIND_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        <button onClick={() => bf.setVoice(!bf.voice)} aria-pressed={bf.voice} title="Spoken announcements"
          className={`grid size-8 place-items-center rounded-lg ${bf.voice ? "bg-accent/15 text-accent-soft" : "bg-white/[0.05] text-mist"}`}>
          <Headphones className="size-4" />
        </button>
      </div>

      <div className="px-4 py-4">
        <p className="mb-3 text-xs text-faint">{BLIND_LEVELS.find((l) => l.id === bf.level)?.hint}</p>

        {/* the opponent's last move */}
        <div className="rounded-xl bg-white/[0.03] px-3 py-3" aria-live="polite" data-announcement>
          {!lastOpp ? (
            <div className="text-sm text-mist">{myTurn ? "You start. Tap one of your (invisible) pieces, then its destination." : "Waiting for your opponent's first move…"}</div>
          ) : showText ? (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-mist">Opponent · {lastOpp.san}</div>
              {learner ? (
                <>
                  <div className="ru mt-1 text-xl">{announceRu(lastOpp, ruLevel)}</div>
                  <div className="mt-0.5 text-sm text-mist">{announceEn(lastOpp)}</div>
                </>
              ) : (
                <div className="mt-1 text-xl">{announceEn(lastOpp)}</div>
              )}
            </>
          ) : caps.text === "notation" ? (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-mist">Opponent's move</div>
              <div className="mt-1 font-mono text-2xl font-semibold">{notationLine(lastOpp)}</div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm text-mist"><Volume2 className="size-4" /> Listen for the move{caps.writtenAids ? " — or ask to see it below." : "."}</div>
          )}
          {caps.extra && !over && myTurn && lastOpp && <div className="mt-2 text-sm font-semibold text-accent-soft">Your move{learner && <> · <span className="ru">Твой ход</span></>}</div>}
        </div>

        {/* aids */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button className="chip" disabled={!lastOpp} onClick={() => { if (!lastOpp) return; bf.speakMove(lastOpp, learner ? "ru" : "en"); if (writtenOk) setAid(aid === "repeat" ? null : "repeat"); }}>
            <Repeat2 className="size-4" /> Repeat last move
          </button>
          {learner && (
            <>
              <button className="chip" disabled={!lastOpp} onClick={() => lastOpp && bf.speakMove(lastOpp, "ru")}><Volume2 className="size-4" /> Russian</button>
              <button className="chip" disabled={!lastOpp} onClick={() => lastOpp && bf.speakMove(lastOpp, "en")}><Volume2 className="size-4" /> English</button>
            </>
          )}
          {writtenOk && (
            <>
              <button className={`chip ${aid === "describe" ? "!border-accent !text-accent-soft" : ""}`} onClick={() => setAid(aid === "describe" ? null : "describe")}><MapIcon className="size-4" /> Describe position</button>
              <button className={`chip ${aid === "legal" ? "!border-accent !text-accent-soft" : ""}`} disabled={!myTurn} onClick={() => setAid(aid === "legal" ? null : "legal")}><ListChecks className="size-4" /> Legal moves</button>
            </>
          )}
        </div>

        {aid === "describe" && (() => {
          const d = describePosition(fen);
          return (
            <div className="mt-3 rounded-xl border border-white/[0.06] p-3 text-sm leading-relaxed" data-describe>
              <div>{d.en}</div>
              {learner && <div className="ru mt-2 text-base text-fog">{d.ru}</div>}
              <div className="mt-2 flex gap-2">
                {learner && <button className="chip" onClick={() => say(speakableRu(d.ru))}><Volume2 className="size-4" /> Russian</button>}
                <button className="chip" onClick={() => sayEnglish(d.en)}><Volume2 className="size-4" /> {learner ? "English" : "Listen"}</button>
              </div>
            </div>
          );
        })()}
        {aid === "legal" && (
          <div className="mt-3 grid gap-1 rounded-xl border border-white/[0.06] p-3 text-sm" data-legal>
            {legalMoveGroups(fen).map((g) => (
              <div key={g.piece} className="flex gap-2"><span className="w-24 shrink-0 text-mist">{g.piece}</span><span className="font-mono">{g.moves.join("  ")}</span></div>
            ))}
          </div>
        )}

        {/* say your own move in Russian */}
        {lastMine && learner && (
          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-mist">Say your move in Russian</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="ru text-lg">{myMoveRu(lastMine)}</span>
              <button className="grid size-8 place-items-center rounded-xl bg-white/[0.07]" aria-label="Listen" onClick={() => say(speakableRu(myMoveRu(lastMine)))}><Volume2 className="size-4" /></button>
            </div>
            <div className="mt-2"><SpeakPractice key={lastMine.after} text={speakableRu(myMoveRu(lastMine))} refKey="blindfold" compact /></div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mist">
          <span>Reveals: <b className="text-fog">{bf.counts.reveals}</b></span>
          <span>Moves in a row without revealing: <b className="text-fog">{bf.counts.streak}</b></span>
          <span>Best streak: <b className="text-fog">{bf.counts.longest}</b></span>
        </div>
      </div>
    </section>
  );
}
