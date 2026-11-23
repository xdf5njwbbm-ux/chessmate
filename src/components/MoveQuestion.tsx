import { useEffect, useRef, useState } from "react";
import { Check, Sparkles, Volume2, X } from "lucide-react";
import { api } from "../lib/api";
import { nextQuestion, type MoveQuestion, type QuestionPool } from "../lib/moveQuestions";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { SpeakPractice, useSay } from "./Audio";

/** One pool of lesson material per game screen; `questionFor(slot)` gives each move its own, never-repeated question. */
export function useMoveQuestions() {
  const { profile } = useSession();
  const [pool, setPool] = useState<QuestionPool | null>(null);
  const used = useRef(new Set<string>());
  const bySlot = useRef(new Map<number, MoveQuestion | null>());
  useEffect(() => {
    api.moveQuestions().then(setPool).catch(() => {});
  }, [profile?.ru_level]);
  const questionFor = (slot: number): MoveQuestion | null => {
    if (!pool) return null;
    if (!bySlot.current.has(slot)) {
      let q = nextQuestion(pool, used.current, bySlot.current.size, profile?.ru_forms ?? "m");
      if (!q) {
        used.current.clear(); // went through everything — start over
        q = nextQuestion(pool, used.current, bySlot.current.size, profile?.ru_forms ?? "m");
      }
      bySlot.current.set(slot, q);
    }
    return bySlot.current.get(slot) ?? null;
  };
  return { questionFor };
}

export function MoveQuestionCard({ q }: { q: MoveQuestion }) {
  const say = useSay();
  const { celebrate } = useLive();
  const [picked, setPicked] = useState<string | null>(null);
  const done = picked != null;
  const right = picked === q.answer;

  useEffect(() => {
    setPicked(null);
    if (q.audio) {
      const t = setTimeout(() => say(q.audio!), 350);
      return () => clearTimeout(t);
    }
  }, [q.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (o: string) => {
    if (done) return;
    setPicked(o);
    api.recordPractice(q.kind === "listen" ? "listening" : "phrase", o === q.answer, "move-question").then((r) => celebrate(r.new_achievements)).catch(() => {});
  };

  return (
    <div className="rounded-2xl border border-accent/25 bg-accent/[0.05] p-3" data-move-question={q.kind}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accent-soft">
        <Sparkles className="size-3.5" /> Quick question · {q.level}
      </div>
      <div className="mt-1 text-sm font-semibold text-fog">{q.prompt}</div>

      {q.show && (
        <div className="mt-2 flex items-start gap-2">
          <div className="ru min-w-0 flex-1 text-xl leading-snug">{q.show}</div>
          {q.kind !== "gap" && (
            <button className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/[0.07]" aria-label="Listen" onClick={() => say(q.show!)}><Volume2 className="size-4" /></button>
          )}
        </div>
      )}
      {q.showEn && <div className={`${q.show ? "mt-0.5 text-sm text-mist" : "mt-2 text-lg"}`}>{q.kind === "gap" ? `“${q.showEn}”` : q.showEn}</div>}
      {q.audio && !done && (
        <button className="btn btn-secondary mt-2 h-11 px-4" onClick={() => say(q.audio!)}><Volume2 className="size-4" /> Play again</button>
      )}
      {q.audio && done && (
        // Once answered, the learner can repeat the sentence and the mic checks it.
        // (Hidden before answering — its word-by-word feedback would give the answer away.)
        <div className="mt-2">
          <SpeakPractice
            key={q.key}
            compact
            text={q.audio}
            refKey="move-question"
            label="Say sentence"
            leading={<button className="btn btn-secondary h-11 px-4" onClick={() => say(q.audio!)}><Volume2 className="size-4" /> Play again</button>}
          />
        </div>
      )}

      <div className="mt-3 grid gap-1.5">
        {q.options.map((o) => {
          const isAns = o === q.answer;
          const tone = !done ? "border-white/10 hover:border-white/25" : isAns ? "border-accent bg-accent/15 text-accent-soft" : o === picked ? "border-danger/70 bg-danger/10 text-danger" : "border-white/5 opacity-60";
          return (
            <button key={o} disabled={done} onClick={() => choose(o)}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${tone} ${q.ruOptions ? "ru text-[17px]" : "text-[15px]"}`}>
              <span className="flex-1">{o}</span>
              {done && isAns && <Check className="size-4 shrink-0" />}
              {done && o === picked && !isAns && <X className="size-4 shrink-0" />}
            </button>
          );
        })}
      </div>

      {done && (
        <div className="mt-2 flex items-start gap-2 text-sm">
          <div className="min-w-0 flex-1">
            <span className={`font-semibold ${right ? "text-accent-soft" : "text-warn"}`}>{right ? "Правильно! " : "Not quite. "}</span>
            <span className="ru text-base">{q.reveal.ru}</span> <span className="text-mist">— {q.reveal.en}</span>
          </div>
          <button className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/[0.07]" aria-label="Listen" onClick={() => say(q.reveal.ru)}><Volume2 className="size-4" /></button>
        </div>
      )}
    </div>
  );
}
