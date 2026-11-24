import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Check, Eye, MessagesSquare, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { buildExercises } from "../lib/exercises";
import { lessonInProgress, lessonSlot, practiceScore, savePractice, validPractice, type LessonSave, type PracticeSave } from "../lib/lessonRun";
import { loadSave } from "../lib/saved";
import { pref, setPref } from "../lib/format";
import type { Lesson } from "../lib/types";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { ExerciseView, isCorrect } from "./ExerciseView";
import { AudioButtons, SpeakPractice } from "./Audio";
import { Button, Progress, Segmented } from "./ui";

/** What the panel next to the board shows between moves: a conversation, your current lesson, or quick questions. */
export type BetweenMoves = "talk" | "lesson" | "mixed";
export function useBetweenMoves(): [BetweenMoves, (m: BetweenMoves) => void] {
  const [mode, setMode] = useState<BetweenMoves>(() => pref<BetweenMoves>("betweenMoves2", "talk"));
  return [mode, (m) => { setMode(m); setPref("betweenMoves2", m); }];
}

export function BetweenMovesSwitch({ mode, onChange }: { mode: BetweenMoves; onChange: (m: BetweenMoves) => void }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-mist">Between moves</span>
      <Segmented size="sm" value={mode} onChange={onChange} options={[{ v: "talk", l: "Talk" }, { v: "lesson", l: "Lesson" }, { v: "mixed", l: "Quiz" }]} />
    </div>
  );
}

type Done = { score: number; passed: boolean; title: string; nextId: string | null };

/**
 * Your lesson, one exercise at a time, inside a game. It reads and writes the
 * same saved progress as the Lesson page: start a lesson there, continue it
 * here (or the other way round). `turn` changes after every opponent move;
 * an exercise you've answered moves on to the next one then.
 */
export function useGameLesson(enabled: boolean, turn: number | null) {
  const { uid, profile } = useSession();
  const { celebrate } = useLive();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [run, setRun] = useState<PracticeSave | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "none" | "error">("idle");
  const [done, setDone] = useState<Done | null>(null);
  const [finishing, setFinishing] = useState(false);
  const lastTurn = useRef(turn);

  const load = useCallback(async (id?: string | null) => {
    setStatus("loading");
    setDone(null);
    try {
      let target = id ?? lessonInProgress(uid);
      if (!target) target = (await api.dashboard()).russian.next_lesson?.id ?? null;
      if (!target) return setStatus("none");
      const l = await api.lesson(target);
      const saved = loadSave<LessonSave>(uid, lessonSlot(target));
      setLesson(l);
      setRun(validPractice(saved?.practice) ? saved!.practice! : { exercises: buildExercises(l, profile?.ru_forms ?? "m"), i: 0, right: 0, wrong: [], picked: null });
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [uid, profile?.ru_forms]);

  useEffect(() => {
    if (enabled && status === "idle") load();
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (next: PracticeSave) => {
    setRun(next);
    if (lesson) savePractice(uid, lesson.id, next);
  };

  const pick = (value: string) => {
    if (!run || !lesson || run.picked != null) return;
    const ex = run.exercises[run.i];
    const ok = isCorrect(ex, value);
    update({ ...run, picked: value, right: run.right + (ok ? 1 : 0), wrong: ok ? run.wrong : [...run.wrong, ex] });
    if (ex.kind === "listen") api.recordPractice("listening", ok, `lesson:${lesson.id}`).catch(() => {});
  };

  const next = async () => {
    if (!run || !lesson || finishing) return;
    const ex = run.exercises[run.i];
    if (run.picked == null && ex.kind !== "speak") return;
    if (run.i < run.exercises.length - 1) return update({ ...run, i: run.i + 1, picked: null });
    const score = practiceScore(run);
    setFinishing(true);
    try {
      const res = await api.completeLesson(lesson.id, score);
      celebrate(res.new_achievements);
    } catch {
      /* the result still shows; the lesson can be redone */
    } finally {
      setFinishing(false);
    }
    savePractice(uid, lesson.id, null);
    setDone({ score, passed: score >= 60, title: lesson.title, nextId: lesson.next_id ?? null });
  };

  // after each opponent move: an answered exercise (or a speaking one you've seen) moves on
  useEffect(() => {
    if (turn === lastTurn.current) return;
    lastTurn.current = turn;
    if (!run || done) return;
    const ex = run.exercises[run.i];
    if (run.picked != null || ex?.kind === "speak") next();
  }, [turn]); // eslint-disable-line react-hooks/exhaustive-deps

  return { status, lesson, run, done, finishing, pick, next, load };
}

export function GameLessonCard({ gl, onMixed }: { gl: ReturnType<typeof useGameLesson>; onMixed: () => void }) {
  const navigate = useNavigate();
  const { status, lesson, run, done } = gl;

  if (status === "loading" || status === "idle") return <div className="rounded-2xl border border-sky/20 bg-sky/[0.04] p-3 text-sm text-mist">Loading your lesson…</div>;
  if (status === "none" || status === "error" || !lesson || !run) {
    return (
      <div className="rounded-2xl border border-sky/20 bg-sky/[0.04] p-3 text-sm">
        <div className="text-mist">{status === "none" ? "You've finished every lesson at your level." : "Your lesson couldn't load right now."}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {status === "error" && <Button size="sm" variant="secondary" onClick={() => gl.load()}><RotateCcw className="size-4" /> Try again</Button>}
          <Button size="sm" variant="secondary" onClick={onMixed}>Mixed questions instead</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-3" data-game-lesson="done">
        <div className="flex items-center gap-2 font-semibold text-accent-soft"><Check className="size-4" /> {done.passed ? "Lesson complete" : "Lesson finished"} · {done.score}%</div>
        <div className="mt-0.5 text-sm text-mist">{done.passed ? `“${done.title}” is done.` : "Score 60% or more to complete it — you can try it again any time."}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {done.passed && done.nextId && <Button size="sm" onClick={() => gl.load(done.nextId)}>Next lesson <ArrowRight className="size-4" /></Button>}
          {!done.passed && <Button size="sm" onClick={() => gl.load(lesson.id)}><RotateCcw className="size-4" /> Try again</Button>}
          <Button size="sm" variant="secondary" onClick={onMixed}>Mixed questions</Button>
        </div>
      </div>
    );
  }

  const ex = run.exercises[run.i];
  const answered = run.picked != null;
  const last = run.i === run.exercises.length - 1;
  return (
    <div className="rounded-2xl border border-sky/25 bg-sky/[0.05] p-3" data-game-lesson={ex.kind}>
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 shrink-0 text-sky" />
        <button className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-fog" onClick={() => navigate(`/learn/lesson/${lesson.id}`)} title="Open the lesson">
          {lesson.title} <span className="font-normal text-mist">· {lesson.level}</span>
        </button>
        <span className="shrink-0 text-xs tabular-nums text-mist">{run.i + 1}/{run.exercises.length}</span>
      </div>
      <Progress value={((run.i + (answered ? 1 : 0)) / run.exercises.length) * 100} className="mt-2 !h-1" />
      <div className="mt-3">
        <ExerciseView key={`${lesson.id}:${run.i}`} ex={ex} picked={run.picked} onPick={gl.pick} refKey={`lesson:${lesson.id}`} compact />
      </div>
      {(answered || ex.kind === "speak") && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-faint">{last ? "" : "Moves on by itself after the next move."}</span>
          <Button size="sm" variant="secondary" loading={gl.finishing} onClick={gl.next}>{last ? "Finish lesson" : "Next exercise"} <ArrowRight className="size-4" /></Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- conversation turns

type TalkExchange = {
  id: string; level: string; topic: string; lesson: string;
  q: { ru: string; ruF?: string; en: string; speaker?: string };
  a: { ru: string; ruF?: string; en: string };
};
const LEVELS_FOR: Record<string, string[]> = { A1: ["A1"], A2: ["A1", "A2"], B1: ["A2"], B2: ["A2"] };

/** Everyday conversation questions from the conversation lessons, never repeated in one game. */
export function useTalkTurns(enabled: boolean) {
  const { profile } = useSession();
  const [bank, setBank] = useState<TalkExchange[] | null>(null);
  const used = useRef(new Set<string>());
  const bySlot = useRef(new Map<number, TalkExchange | null>());
  useEffect(() => {
    if (!enabled || bank) return;
    import("../generated/talk.json").then((m) => setBank((m.default as { exchanges: TalkExchange[] }).exchanges)).catch(() => {});
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const turnFor = (slot: number): TalkExchange | null => {
    if (!bank) return null;
    if (!bySlot.current.has(slot)) {
      const levels = LEVELS_FOR[profile?.ru_level ?? "A1"] ?? ["A1"];
      let pool = bank.filter((x) => levels.includes(x.level) && !used.current.has(x.id));
      if (!pool.length) {
        used.current.clear();
        pool = bank.filter((x) => levels.includes(x.level));
      }
      const x = pool[Math.floor(Math.random() * pool.length)] ?? null;
      if (x) used.current.add(x.id);
      bySlot.current.set(slot, x);
    }
    return bySlot.current.get(slot) ?? null;
  };
  return { turnFor };
}

/** "Between moves": someone asks you an everyday question. Answer in your head (or out loud), then compare. */
export function TalkTurnCard({ x }: { x: TalkExchange }) {
  const { profile } = useSession();
  const f = profile?.ru_forms === "f";
  const q = f && x.q.ruF ? x.q.ruF : x.q.ru;
  const a = f && x.a.ruF ? x.a.ruF : x.a.ru;
  const [showEn, setShowEn] = useState(false);
  const [reveal, setReveal] = useState(false);
  return (
    <div className="rounded-2xl border border-gold/25 bg-gold/[0.05] p-3" data-talk-turn={x.id}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
        <MessagesSquare className="size-3.5" /> Between moves · <span className="ru normal-case tracking-normal">{x.q.speaker ?? "Друг"}</span> asks
      </div>
      <div className="mt-2 flex items-start gap-2">
        <div className="ru min-w-0 flex-1 text-xl leading-snug">{q}</div>
        <AudioButtons text={q} compact />
      </div>
      {showEn ? <div className="text-sm text-mist">{x.q.en}</div> : <button className="text-xs font-semibold text-mist hover:text-fog" onClick={() => setShowEn(true)}><Eye className="mr-1 inline size-3.5" />English</button>}
      {!reveal ? (
        <div className="mt-3">
          <div className="text-xs text-mist">Answer out loud or in your head — then compare with a natural answer.</div>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setReveal(true)}>Show an answer</Button>
        </div>
      ) : (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><div className="ru text-lg leading-snug">{a}</div><div className="text-sm text-mist">{x.a.en}</div></div>
            <AudioButtons text={a} compact />
          </div>
          <div className="mt-2"><SpeakPractice key={x.id} text={a} refKey={`talk:${x.id}`} compact label="Say it" /></div>
          <div className="mt-2 text-xs text-faint">From “{x.topic}” ({x.level}) · more in Learn Russian → Conversations</div>
        </div>
      )}
    </div>
  );
}
