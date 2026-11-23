import { useEffect, useState } from "react";
import { Check, Headphones, X } from "lucide-react";
import { api } from "../lib/api";
import type { Test, TestResult } from "../lib/types";
import { useToast } from "../state/toast";
import { AudioButtons, useSay } from "./Audio";
import { Button, PageLoader, Progress } from "./ui";

/** Runs a placement or level test; grading happens on the server. */
export function TestRunner({ testId, onDone }: { testId: string; onDone: (r: TestResult, t: Test) => void }) {
  const toast = useToast();
  const say = useSay();
  const [test, setTest] = useState<Test | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.test(testId).then(setTest).catch((e) => setErr((e as Error).message));
  }, [testId]);

  const item = test?.items[i];
  useEffect(() => {
    if (item?.kind === "listening" && item.ru) {
      const t = setTimeout(() => say(item.ru!), 350);
      return () => clearTimeout(t);
    }
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="card p-6 text-mist">{err}</div>;
  if (!test || !item) return <PageLoader />;

  const chosen = answers[item.id];
  const last = i === test.items.length - 1;
  const submit = async () => {
    setBusy(true);
    try {
      onDone(await api.submitTest(test.id, answers), test);
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Progress value={((i + (chosen != null ? 1 : 0)) / test.items.length) * 100} />
        <span className="shrink-0 text-sm tabular-nums text-mist">{i + 1} / {test.items.length}</span>
      </div>
      <div key={item.id} className="card animate-rise p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-mist">
          {item.kind === "listening" && <Headphones className="size-4" />}
          {item.kind} · {item.level}
        </div>
        <h2 className="mt-3 text-xl font-semibold">{item.prompt}</h2>
        {item.ru && item.kind === "listening" && (
          <div className="mt-4 flex items-center gap-3">
            <AudioButtons text={item.ru} />
            <span className="text-sm text-mist">Listen as many times as you like.</span>
          </div>
        )}
        {item.ru && item.kind !== "listening" && <div className="ru mt-4 text-2xl leading-snug">{item.ru}</div>}
        <div className="mt-6 grid gap-2">
          {item.options.map((o, k) => (
            <button
              key={k}
              onClick={() => setAnswers({ ...answers, [item.id]: k })}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${chosen === k ? "border-accent bg-accent/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
            >
              <span className={/[а-яё]/i.test(o) ? "ru text-lg" : ""}>{o}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 flex justify-between gap-3">
        <Button variant="ghost" disabled={i === 0} onClick={() => setI(i - 1)}>Back</Button>
        {last ? (
          <Button loading={busy} disabled={Object.keys(answers).length < test.items.length} onClick={submit}>Finish test</Button>
        ) : (
          <Button disabled={chosen == null} onClick={() => setI(i + 1)}>Next</Button>
        )}
      </div>
      {last && Object.keys(answers).length < test.items.length && (
        <p className="mt-3 text-right text-sm text-mist">Answer every question to finish.</p>
      )}
    </div>
  );
}

/** Correct/incorrect review shown after a test. */
export function TestReview({ test, result }: { test: Test; result: TestResult }) {
  return (
    <div className="grid gap-2">
      {test.items.map((it) => {
        const r = result.results.find((x) => x.id === it.id);
        return (
          <div key={it.id} className="card flex items-start gap-3 p-4">
            <div className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${r?.correct ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger"}`}>
              {r?.correct ? <Check className="size-4" /> : <X className="size-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm text-mist">{it.prompt}</div>
              {it.ru && <div className="ru text-lg">{it.ru}</div>}
              <div className="mt-1 text-sm">
                <span className="text-accent-soft">{it.options[r?.answer ?? 0]}</span>
                {!r?.correct && r?.chosen != null && <span className="text-mist"> · you chose <span className="text-danger">{it.options[r.chosen]}</span></span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
