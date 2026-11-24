import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { sameSentence, type Exercise } from "../lib/exercises";
import { AudioButtons, SpeakPractice, useSay } from "./Audio";
import { WhyWrong } from "./WhyWrong";
import { Button } from "./ui";

export const isCorrect = (ex: Exercise, value: string | null) =>
  value != null && (ex.kind === "order" ? sameSentence(value, ex.answer) : "answer" in ex && value === ex.answer);

/**
 * One lesson exercise — the same card in the Lesson page and in the game panel,
 * so a lesson can be continued in either place. `picked` is the learner's answer
 * (null until answered); `onPick` is called once with their choice.
 */
export function ExerciseView({ ex, picked, onPick, refKey, compact }: {
  ex: Exercise;
  picked: string | null;
  onPick: (value: string) => void;
  refKey: string;
  compact?: boolean;
}) {
  const say = useSay();
  const [order, setOrder] = useState<number[]>([]);
  const answered = picked != null;
  const correct = isCorrect(ex, picked);
  const big = compact ? "text-xl" : "text-2xl";

  useEffect(() => {
    setOrder([]);
    if (ex.kind === "listen" && picked == null) {
      const t = setTimeout(() => say(ex.ru), 300);
      return () => clearTimeout(t);
    }
  }, [ex]); // eslint-disable-line react-hooks/exhaustive-deps

  const optionBtn = (o: string, isRu: boolean) => (
    <button key={o} disabled={answered} onClick={() => onPick(o)}
      className={`rounded-xl border text-left transition-colors ${compact ? "px-3 py-2.5" : "px-4 py-3"} ${answered && o === (ex as { answer: string }).answer ? "border-accent bg-accent/10" : answered && o === picked ? "border-danger bg-danger/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
      <span className={isRu ? (compact ? "ru text-[17px]" : "ru text-lg") : compact ? "text-[15px]" : ""}>{o}</span>
    </button>
  );

  return (
    <div data-exercise={ex.kind}>
      <div className="text-xs font-semibold uppercase tracking-wider text-mist">{ex.prompt}</div>

      {ex.kind === "gap" && (
        <div className={`ru mt-3 ${big} leading-snug`}>
          {ex.q.split("___").map((p, k, arr) => (
            <span key={k}>{p}{k < arr.length - 1 && <span className={`mx-1 inline-block min-w-16 border-b-2 text-center ${answered ? (correct ? "border-accent text-accent-soft" : "border-danger text-danger") : "border-white/30"}`}>{picked ?? " "}</span>}</span>
          ))}
        </div>
      )}
      {ex.kind === "gap" && <div className="mt-1.5 text-sm text-mist">{ex.en}</div>}
      {ex.kind === "ru-en" && <div className="mt-3 flex items-start gap-3"><div className={`ru flex-1 ${big} leading-snug`}>{ex.ru}</div><AudioButtons text={ex.ru} compact /></div>}
      {ex.kind === "en-ru" && <div className={`mt-3 ${compact ? "text-lg" : "text-xl"}`}>{ex.en}</div>}
      {ex.kind === "vocab" && <div className="mt-3 flex items-center gap-3"><div className={`ru ${compact ? "text-2xl" : "text-3xl"}`}>{ex.stressed}</div><AudioButtons text={ex.ru} compact /></div>}
      {ex.kind === "listen" && <div className="mt-3"><AudioButtons text={ex.ru} /></div>}
      {ex.kind === "respond" && (
        <div className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{ex.who} asks</div>
          <div className="mt-0.5 flex items-start gap-2"><div className={`ru flex-1 ${compact ? "text-lg" : "text-xl"} leading-snug`}>{ex.q}</div><AudioButtons text={ex.q} compact /></div>
          <div className="text-sm text-mist">{ex.qEn}</div>
        </div>
      )}
      {ex.kind === "order" && (
        <>
          <div className={`mt-2 ${compact ? "text-base" : "text-lg"} text-fog`}>{ex.en}</div>
          <div className={`ru mt-3 min-h-12 rounded-xl border border-dashed border-white/15 p-2.5 ${compact ? "text-lg" : "text-xl"}`}>
            {order.map((k, n) => <button key={n} disabled={answered} onClick={() => setOrder(order.filter((_, m) => m !== n))} className="mb-1.5 mr-1.5 rounded-lg bg-white/10 px-2.5 py-1">{ex.tokens[k]}</button>)}
          </div>
          <div className={`ru mt-2.5 flex flex-wrap gap-1.5 ${compact ? "text-lg" : "text-xl"}`}>
            {ex.tokens.map((t, k) => (order.includes(k) ? null : <button key={k} disabled={answered} onClick={() => setOrder([...order, k])} className="rounded-lg border border-white/10 px-2.5 py-1 hover:border-white/25">{t}</button>))}
          </div>
          {!answered && <Button className="mt-3" size={compact ? "sm" : undefined} disabled={order.length !== ex.tokens.length} onClick={() => onPick(order.map((k) => ex.tokens[k]).join(" "))}>Check</Button>}
          {answered && !correct && <div className="ru mt-2.5 text-lg text-accent-soft">{ex.answer}</div>}
        </>
      )}
      {ex.kind === "speak" && (
        <>
          <div className={`ru mt-3 ${big} leading-snug`}>{ex.ru}</div>
          <div className="mt-1 text-sm text-mist">{ex.en}</div>
          <div className="mt-3 flex items-center gap-2"><AudioButtons text={ex.ru} /></div>
          <div className="mt-3"><SpeakPractice text={ex.ru} refKey={refKey} compact={compact} /></div>
        </>
      )}

      {"options" in ex && (
        <div className={`grid gap-2 ${compact ? "mt-3" : "mt-6"}`}>{ex.options.map((o) => optionBtn(o, ex.kind === "gap" || ex.kind === "en-ru" || ex.kind === "listen" || ex.kind === "respond"))}</div>
      )}

      {answered && (
        <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${correct ? "bg-accent/10 text-accent-soft" : "bg-danger/10 text-[#ffb3b3]"}`}>
          {correct ? <><Check className="size-4" /> Верно! Correct.</> : <><X className="size-4" /> Not quite — the answer is highlighted.</>}
          {ex.kind === "listen" && <span className="ml-auto font-normal text-mist">{ex.ru}</span>}
        </div>
      )}
      {answered && ex.kind === "respond" && (
        <div className="mt-2 flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
          <div className="min-w-0 flex-1"><span className="ru text-base">{ex.answer}</span> <span className="text-mist">— {ex.en}</span></div>
          <AudioButtons text={ex.answer} compact />
        </div>
      )}
      {answered && ex.kind === "respond" && <div className="mt-2"><SpeakPractice text={ex.answer} refKey={refKey} compact label="Say the reply" /></div>}
      {answered && !correct && ex.kind === "gap" && picked && <WhyWrong picked={picked} note={ex.why?.[picked]} ru />}
    </div>
  );
}
