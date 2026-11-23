import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BookOpen, Check, ChevronDown, ChevronUp, GraduationCap, Lightbulb, X } from "lucide-react";
import type { MoveCard, Phrase } from "../lib/movePhrases";
import type { Intensity, Line } from "../lib/types";
import { api } from "../lib/api";
import { bare, plain } from "../lib/russian";
import { INTENSITY } from "../lib/constants";
import { pref, setPref } from "../lib/format";
import { useEntitlements, useSession } from "../state/session";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { RussianLine, stressMapFrom } from "./RussianText";
import { AudioButtons } from "./Audio";
import { Segmented } from "./ui";
import { MoveQuestionCard, useMoveQuestions } from "./MoveQuestion";

const toLine = (p: Phrase): Line => ({ ru: p.ru, en: p.en, words: p.words });
const WHO = { me: "You", ai: "Stockfish", opponent: "Opponent" } as const;

type FocusWord = { id: string; ru: string; stressed: string; en: string };

/**
 * The compact panel next to the board: one short Russian lesson per move,
 * at the learner's level and chosen intensity.
 */
export function LearningPanel({ cards, focus, onIntensity }: { cards: { ply: number; card: MoveCard }[]; focus?: FocusWord[]; onIntensity?: (i: Intensity) => void }) {
  const { profile, saveProfile } = useSession();
  const ent = useEntitlements();
  const [open, setOpen] = useState(true);
  const [history, setHistory] = useState(false);
  const intensity: Intensity = profile?.learning_intensity === "deep" && !ent.deep_learning ? "standard" : profile?.learning_intensity ?? "standard";
  const latest = cards.at(-1);
  const lastOpp = [...cards].reverse().find((c) => c.card.speaker !== "me");
  const { questionFor } = useMoveQuestions();
  const question = lastOpp ? questionFor(lastOpp.ply) : null;

  const setIntensity = (i: Intensity) => {
    saveProfile({ learning_intensity: i }).catch(() => {});
    onIntensity?.(i);
  };

  return (
    <section className="card overflow-hidden" aria-label="Russian for this move">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <GraduationCap className="size-[18px] text-accent" />
        <div className="flex-1 text-sm font-semibold">Russian for every move</div>
        {open && (
          <Segmented
            size="sm"
            value={intensity}
            onChange={setIntensity}
            options={INTENSITY.filter((x) => x.v !== "deep" || ent.deep_learning).map((x) => ({ v: x.v, l: x.l }))}
          />
        )}
        <button className="grid size-8 place-items-center rounded-lg text-mist hover:bg-white/5" onClick={() => setOpen(!open)} aria-label={open ? "Minimize" : "Expand"}>
          {open ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
        </button>
      </div>
      {!open ? (
        latest && (
          <div className="flex items-center gap-3 px-4 py-3">
            <button className="ru min-w-0 flex-1 truncate text-left text-lg" onClick={() => setOpen(true)}>{latest.card.phrase.ru}</button>
            <AudioButtons text={latest.card.phrase.ru} compact />
          </div>
        )
      ) : !latest ? (
        <div className="px-4 py-6 text-sm text-mist">
          Make a move. Each move gives you a short Russian phrase about what just happened on the board, pitched at your level ({profile?.ru_level}).
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto px-4 py-4 lg:max-h-[calc(100dvh-260px)]">
          {question && <div className="mb-4"><MoveQuestionCard key={question.key} q={question} /></div>}
          <CardView key={latest.ply} ply={latest.ply} card={latest.card} intensity={intensity} focus={focus} />
          {cards.length > 1 && (
            <div className="mt-5 border-t border-white/[0.06] pt-3">
              <button className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mist hover:text-fog" onClick={() => setHistory(!history)}>
                <BookOpen className="size-3.5" /> Earlier moves ({cards.length - 1})
                {history ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
              {history && (
                <div className="mt-3 grid gap-3">
                  {cards.slice(0, -1).reverse().map(({ ply, card }) => (
                    <div key={ply} className="flex items-start gap-3">
                      <span className="w-14 shrink-0 pt-1 text-xs text-faint">{Math.floor(ply / 2) + 1}. {WHO[card.speaker]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="ru text-base">{card.phrase.ru}</div>
                        <div className="text-xs text-mist">{card.phrase.en}</div>
                      </div>
                      <AudioButtons text={card.phrase.ru} compact />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Phones: after your opponent (or Stockfish) replies, the lesson pops up in
 * front of the board — once per turn, with both moves on one card. Tap
 * Continue (or anywhere outside the card) and the board is all yours. A slim
 * bar at the bottom brings it back whenever you want it.
 */
export function LearningPopup({ cards, focus, collapse, avoid, paused }: { cards: { ply: number; card: MoveCard }[]; focus?: FocusWord[]; collapse?: number; avoid?: RefObject<HTMLElement | null>; paused?: boolean }) {
  const { profile, saveProfile } = useSession();
  const ent = useEntitlements();
  const intensity: Intensity = profile?.learning_intensity === "deep" && !ent.deep_learning ? "standard" : profile?.learning_intensity ?? "standard";
  const latest = cards.at(-1);
  const prev = cards.length > 1 ? cards.at(-2)! : null;
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState<boolean>(() => pref("lessonPopup", true));
  const [top, setTop] = useState(12);
  const [more, setMore] = useState(false);
  const { questionFor } = useMoveQuestions();

  useEffect(() => {
    if (collapse) setOpen(false);
  }, [collapse]);

  // pop up once the opponent has replied (after its piece has finished moving)
  useEffect(() => {
    setOpen(false);
    setMore(false);
    if (!latest || latest.card.speaker === "me" || !auto || paused) return;
    const t = setTimeout(() => setOpen(true), 750);
    return () => clearTimeout(t);
  }, [latest?.ply, latest?.card.key, paused]); // eslint-disable-line react-hooks/exhaustive-deps

  // sit on top of the board
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = avoid?.current?.getBoundingClientRect();
      setTop(Math.round(Math.min(Math.max(8, r ? r.top : 12), window.innerHeight * 0.3)));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [open, avoid]);

  if (!latest) return null;
  const standard = intensity !== "quick";
  const close = () => setOpen(false);
  const question = latest.card.speaker !== "me" ? questionFor(latest.ply) : null;
  const toggleAuto = () => {
    setAuto(!auto);
    setPref("lessonPopup", !auto);
  };

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 animate-fade-in bg-ink-950/60 px-3 lg:hidden" onClick={close} data-learning-popup="open">
          <section
            onClick={(e) => e.stopPropagation()}
            style={{ marginTop: top, maxHeight: `calc(100dvh - ${top + 12}px)` }}
            className="mx-auto flex max-w-[560px] animate-pop flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.9)]"
            role="dialog"
            aria-label="Russian for this move"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] py-1 pl-3 pr-1.5">
              <GraduationCap className="size-[18px] shrink-0 text-accent" />
              <Segmented
                size="sm"
                value={intensity}
                onChange={(i: Intensity) => saveProfile({ learning_intensity: i }).catch(() => {})}
                options={INTENSITY.filter((x) => x.v !== "deep" || ent.deep_learning).map((x) => ({ v: x.v, l: x.l }))}
              />
              <div className="flex-1" />
              <button className="grid size-9 place-items-center rounded-lg text-mist hover:bg-white/5" onClick={close} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              {question && <MoveQuestionCard key={question.key} q={question} />}
              {question ? (
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-mist">These moves in Russian</div>
                  <div className="grid gap-1.5">
                    {prev && prev.card.speaker === "me" && <MiniLine label="You" phrase={prev.card.phrase} showEn={standard} />}
                    <MiniLine label={WHO[latest.card.speaker]} phrase={latest.card.phrase} showEn={standard} />
                  </div>
                  <button className="mt-2 flex items-center gap-1 text-xs font-semibold text-mist hover:text-fog" onClick={() => setMore(!more)}>
                    {more ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} More about this move
                  </button>
                  {more && <div className="mt-3"><CardView key={latest.ply} ply={latest.ply} card={latest.card} intensity={intensity} focus={focus} /></div>}
                </div>
              ) : (
                <CardView key={latest.ply} ply={latest.ply} card={latest.card} intensity={intensity} focus={focus} />
              )}
            </div>
            <div className="shrink-0 border-t border-white/[0.06] p-3">
              <button className="btn btn-primary h-12 w-full text-base" onClick={close} autoFocus>
                <Check className="size-5" /> Continue — your move
              </button>
              <button className="mt-1.5 w-full py-1 text-xs text-faint hover:text-mist" onClick={() => { toggleAuto(); close(); }}>
                Don't pop up automatically (tap the bar at the bottom to open it)
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2 pb-[max(8px,env(safe-area-inset-bottom))] lg:hidden" data-learning-popup="min">
          <div className="pointer-events-auto mx-auto flex max-w-[600px] items-center gap-2 rounded-2xl border border-white/10 bg-ink-900/95 py-1.5 pl-4 pr-1.5 shadow-[0_-16px_48px_-12px_rgba(0,0,0,0.85)] backdrop-blur">
            <button className="flex min-w-0 flex-1 items-center gap-3 py-1 text-left" onClick={() => setOpen(true)}>
              <GraduationCap className="size-4 shrink-0 text-accent" />
              <span className="ru min-w-0 flex-1 truncate text-base">{latest.card.phrase.ru}</span>
            </button>
            <AudioButtons text={latest.card.phrase.ru} compact />
            <button className="grid size-9 shrink-0 place-items-center rounded-lg text-mist hover:bg-white/5" onClick={() => setOpen(true)} aria-label="Show the Russian for this move">
              <ChevronUp className="size-5" />
            </button>
            {!auto && (
              <button className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold text-accent-soft" onClick={toggleAuto}>Auto</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function CardView({ ply, card, intensity, focus }: { ply: number; card: MoveCard; intensity: Intensity; focus?: FocusWord[] }) {
  const stress = useMemo(() => stressMapFrom(card.vocab), [card.vocab]);
  const standard = intensity !== "quick";
  const deep = intensity === "deep";
  const review = useMemo(() => {
    if (!focus?.length) return null;
    const words = card.phrase.words.map((w) => plain(bare(w.ru)).toLowerCase());
    return focus.find((f) => words.includes(plain(f.ru).toLowerCase()) || card.vocab.some((v) => v.ru === f.ru)) ?? null;
  }, [card, focus]);

  return (
    <div className="animate-rise">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mist">
        Move {Math.floor(ply / 2) + 1} · {WHO[card.speaker]}
      </div>

      {card.reaction && (
        <div className="mb-3 rounded-xl bg-white/[0.03] px-3 py-2">
          <SmallPhrase p={card.reaction} showEn={standard} />
        </div>
      )}

      <RussianLine key={card.phrase.ru} line={toLine(card.phrase)} stress={stress} showEn={standard} size="lg" saveSource="game" practiceRef={`move:${card.key}`} />

      {standard && card.vocab.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-mist">Vocabulary</div>
          <div className="flex flex-wrap gap-1.5">
            {card.vocab.map((v) => (
              <span key={v.ru} className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1 text-sm">
                <span className="ru text-base">{v.stressed}</span>
                <span className="text-mist">— {v.en}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {deep && (
        <>
          <div className="mt-4">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-mist">Word by word</div>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {card.phrase.words.map((w, i) => (
                <div key={i} className="text-center">
                  <div className="ru text-base">{w.ru}</div>
                  <div className="text-[11px] text-mist">{w.en.replace(/_/g, " ")}</div>
                </div>
              ))}
            </div>
          </div>
          {card.grammar && (
            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4 text-gold" /> {card.grammar.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-fog">{card.grammar.body.replace(/\*/g, "")}</p>
            </div>
          )}
          {card.exercise && <Exercise key={ply} ex={card.exercise} />}
        </>
      )}

      {(card.plan || card.question || card.prompt) && (
        <div className="mt-4 grid gap-2">
          {card.plan && <SmallPhrase p={card.plan} showEn={standard} />}
          {card.question && (
            <div className="rounded-xl border border-sky/20 bg-sky/[0.06] px-3 py-2">
              <div className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-sky">Think about it</div>
              <SmallPhrase p={card.question} showEn={standard} />
            </div>
          )}
          {card.prompt && <SmallPhrase p={card.prompt} showEn={standard} strong />}
        </div>
      )}

      {review && <FocusReview word={review} />}
    </div>
  );
}

function SmallPhrase({ p, showEn, strong }: { p: Phrase; showEn: boolean; strong?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className={`ru text-[17px] ${strong ? "font-semibold text-accent-soft" : ""}`}>{p.ru}</div>
        {showEn && <div className="text-xs text-mist">{p.en}</div>}
      </div>
      <AudioButtons text={p.ru} compact />
    </div>
  );
}

function Exercise({ ex }: { ex: NonNullable<MoveCard["exercise"]> }) {
  const [picked, setPicked] = useState<string | null>(null);
  const { celebrate } = useLive();
  const done = picked != null;
  const right = picked === ex.answer;
  return (
    <div className="mt-4 rounded-xl border border-white/[0.06] p-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-mist">Quick exercise · choose the right form</div>
      <div className="ru mt-2 text-lg">
        {ex.before}
        <span className={`mx-1 inline-block min-w-12 border-b-2 text-center ${done ? (right ? "border-accent text-accent-soft" : "border-danger text-danger") : "border-white/30"}`}>{picked ?? " "}</span>
        {ex.after}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ex.options.map((o) => (
          <button
            key={o}
            disabled={done}
            onClick={() => {
              setPicked(o);
              api.recordPractice("phrase", o === ex.answer, "move-exercise").then((r) => celebrate(r.new_achievements)).catch(() => {});
            }}
            className={`chip ru text-base ${done && o === ex.answer ? "!border-accent !text-accent-soft" : ""}`}
          >
            {o}
          </button>
        ))}
      </div>
      {done && <div className={`mt-2 text-sm ${right ? "text-accent-soft" : "text-warn"}`}>{right ? "Correct!" : `The right form is «${ex.answer}».`} <span className="text-mist">{ex.en}</span></div>}
    </div>
  );
}

function FocusReview({ word }: { word: FocusWord }) {
  const [done, setDone] = useState<null | boolean>(null);
  const toast = useToast();
  const sent = useRef(false);
  useEffect(() => {
    sent.current = false;
    setDone(null);
  }, [word.id]);
  const grade = async (knew: boolean) => {
    if (sent.current) return;
    sent.current = true;
    setDone(knew);
    try {
      await api.recordReview("word", word.id, knew ? 2 : 0);
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    }
  };
  return (
    <div className="mt-4 rounded-xl border border-gold/25 bg-gold/[0.05] p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gold">Word you've been missing</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="ru text-xl">{word.stressed}</span>
        {done != null && <span className="text-sm text-mist">— {word.en}</span>}
      </div>
      {done == null ? (
        <div className="mt-2 flex gap-2">
          <button className="btn btn-secondary h-9 px-3 text-sm" onClick={() => grade(true)}><Check className="size-4" /> I know it</button>
          <button className="btn btn-ghost h-9 px-3 text-sm" onClick={() => grade(false)}><X className="size-4" /> Show me</button>
        </div>
      ) : (
        <div className="mt-1 text-xs text-mist">{done ? "Nice — it moves further out in your reviews." : "It'll come back again soon."}</div>
      )}
    </div>
  );
}

function MiniLine({ label, phrase, showEn }: { label: string; phrase: Phrase; showEn: boolean }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
      <span className="w-[4.5rem] shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</span>
      <div className="min-w-0 flex-1">
        <div className="ru text-[15px]">{phrase.ru}</div>
        {showEn && <div className="text-xs text-mist">{phrase.en}</div>}
      </div>
      <AudioButtons text={phrase.ru} compact />
    </div>
  );
}
