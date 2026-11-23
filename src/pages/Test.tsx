import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Award } from "lucide-react";
import type { Test as TestT, TestResult } from "../lib/types";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { TestReview, TestRunner } from "../components/TestRunner";
import { BackButton, Button, Ring } from "../components/ui";

export default function Test() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { refreshProfile } = useSession();
  const { celebrate } = useLive();
  const [done, setDone] = useState<{ r: TestResult; t: TestT } | null>(null);
  const [run, setRun] = useState(0);

  if (done) {
    const { r, t } = done;
    const p = Math.round((100 * r.score) / Math.max(1, r.total));
    const placement = t.id === "placement";
    return (
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <div className="flex justify-center">
            <Ring value={p} size={120} stroke={9} tone={r.passed || placement ? "gold" : "accent"}>
              <div className="text-2xl font-semibold tabular-nums">{r.score}/{r.total}</div>
            </Ring>
          </div>
          {placement ? (
            <>
              <h1 className="mt-5 font-display text-3xl font-semibold">We recommend {r.recommended}</h1>
              <p className="mt-2 text-mist">Your learning level has been set to {r.recommended}. You can change it in Settings.</p>
            </>
          ) : r.passed ? (
            <>
              <h1 className="mt-5 flex items-center justify-center gap-2 font-display text-3xl font-semibold text-gold"><Award className="size-7" /> {t.level} certified</h1>
              <p className="mt-2 text-mist">
                {r.level_after !== r.level_before ? `Поздравляем! You've moved up to ${r.level_after}.` : "Поздравляем! You passed the test."}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-5 font-display text-3xl font-semibold">Not yet — {p}%</h1>
              <p className="mt-2 text-mist">You need {r.pass_pct}% to pass. Review the questions below, practise, and try again any time.</p>
            </>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => navigate("/learn")}>Back to Learn</Button>
            {!r.passed && !placement && <Button variant="secondary" onClick={() => { setDone(null); setRun(run + 1); }}>Try again</Button>}
          </div>
        </div>
        <h2 className="mb-3 mt-10 text-xs font-semibold uppercase tracking-[0.14em] text-mist">Your answers</h2>
        <TestReview test={t} result={r} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2"><BackButton to="/learn" /><h1 className="font-display text-2xl font-semibold">{id === "placement" ? "Placement test" : `${id} level test`}</h1></div>
      <TestRunner key={run} testId={id} onDone={(r, t) => { setDone({ r, t }); celebrate(r.new_achievements); refreshProfile(); window.scrollTo(0, 0); }} />
    </div>
  );
}
