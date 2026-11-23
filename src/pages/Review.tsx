import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Repeat2, X } from "lucide-react";
import { api } from "../lib/api";
import { shuffle } from "../lib/exercises";
import type { ReviewItem } from "../lib/types";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { AudioButtons, useSay } from "../components/Audio";
import { BackButton, Button, EmptyState, PageLoader, Progress } from "../components/ui";

export default function Review() {
  const navigate = useNavigate();
  const toast = useToast();
  const { celebrate } = useLive();
  const say = useSay();
  const [queue, setQueue] = useState<{ items: ReviewItem[]; distractors: { ru: string; en: string }[]; due_total: number } | null>(null);
  const [i, setI] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const [busy, setBusy] = useState(false);
  const [stopped, setStopped] = useState<string | null>(null);

  const load = () => {
    setQueue(null);
    setI(0);
    api.reviewQueue(20).then(setQueue).catch((e) => toast({ title: (e as Error).message, tone: "error" }));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const item = queue?.items[i];
  const choice = !!item && (item.reps === 0 || item.lapses > 0) && item.kind === "word";
  const options = useMemo(() => {
    if (!item || !queue) return [];
    const pool = queue.distractors.map((d) => d.en).filter((e) => e !== item.en);
    return shuffle([item.en, ...shuffle([...new Set(pool)]).slice(0, 3)]);
  }, [item, queue]);

  useEffect(() => {
    setRevealed(false);
    setPicked(null);
    if (item?.kind === "word") say(item.ru);
  }, [i, item?.item_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!queue) return <PageLoader />;
  if (stopped) return <EmptyState icon={<Repeat2 className="size-7" />} title="That's it for today" body={stopped} action={<Button onClick={() => navigate("/practice")}>Back to Practice</Button>} />;
  if (!queue.items.length) {
    return <EmptyState icon={<Repeat2 className="size-7" />} title="Nothing to review right now" body="Complete lessons or save phrases during games — they'll show up here when it's time to review them." action={<Button onClick={() => navigate("/learn")}>Go to lessons</Button>} />;
  }
  if (!item) {
    const total = stats.right + stats.wrong;
    return (
      <div className="mx-auto max-w-md pt-8 text-center">
        <div className="font-display text-3xl font-semibold">Готово!</div>
        <p className="mt-2 text-mist">You reviewed {total} item{total === 1 ? "" : "s"}: {stats.right} remembered, {stats.wrong} to see again soon.</p>
        <div className="mt-6 flex justify-center gap-2">
          {queue.due_total > total && <Button onClick={load}>Review more</Button>}
          <Button variant="secondary" onClick={() => navigate("/practice")}>Done</Button>
        </div>
      </div>
    );
  }

  const grade = async (g: number) => {
    setBusy(true);
    try {
      const r = await api.recordReview(item.kind, item.item_id, g);
      celebrate(r.new_achievements);
      setStats((s) => (g > 0 ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 }));
      setI(i + 1);
    } catch (e) {
      if ((e as { code?: string }).code === "42501") setStopped((e as Error).message);
      else toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <BackButton to="/practice" />
        <Progress value={(i / queue.items.length) * 100} />
        <span className="shrink-0 text-sm tabular-nums text-mist">{i + 1}/{queue.items.length}</span>
      </div>
      <div key={item.item_id + i} className="card animate-rise p-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-mist">{item.kind === "phrase" ? "Saved phrase" : item.pos || "Word"}</div>
        {item.kind === "phrase" ? (
          <>
            <div className="mt-5 text-xl">{item.en || "Say this phrase in Russian"}</div>
            {revealed ? (
              <div className="mt-5 animate-fade-in">
                <div className="ru text-2xl">{item.ru}</div>
                <div className="mt-3 flex justify-center"><AudioButtons text={item.ru} /></div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-mist">Say it in Russian, then check.</p>
            )}
          </>
        ) : (
          <>
            <div className="ru mt-5 text-4xl">{item.stressed}</div>
            <div className="mt-3 flex justify-center"><AudioButtons text={item.ru} /></div>
            {choice ? (
              <div className="mt-6 grid gap-2 text-left">
                {options.map((o) => (
                  <button key={o} disabled={picked != null} onClick={() => setPicked(o)}
                    className={`rounded-xl border px-4 py-3 transition-colors ${picked && o === item.en ? "border-accent bg-accent/10" : picked === o ? "border-danger bg-danger/10" : "border-white/10 hover:border-white/20"}`}>{o}</button>
                ))}
              </div>
            ) : revealed ? (
              <div className="mt-5 animate-fade-in text-xl text-fog">{item.en}{item.note && <div className="mt-1 text-sm text-mist">{item.note}</div>}</div>
            ) : (
              <p className="mt-4 text-sm text-mist">Remember the meaning, then check.</p>
            )}
          </>
        )}
      </div>

      <div className="mt-5">
        {choice ? (
          picked != null && (
            <div className="flex items-center justify-between gap-3">
              <span className={`flex items-center gap-2 text-sm font-semibold ${picked === item.en ? "text-accent-soft" : "text-[#ffb3b3]"}`}>
                {picked === item.en ? <><Check className="size-4" /> Верно!</> : <><X className="size-4" /> It means “{item.en}”.</>}
              </span>
              <Button loading={busy} onClick={() => grade(picked === item.en ? 2 : 0)}>Next</Button>
            </div>
          )
        ) : !revealed ? (
          <Button className="w-full" size="lg" onClick={() => { setRevealed(true); if (item.kind === "phrase") say(item.ru); }}>Show answer</Button>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[["Again", 0, "btn-danger"], ["Hard", 1, "btn-secondary"], ["Good", 2, "btn-primary"], ["Easy", 3, "btn-secondary"]].map(([l, g, cls]) => (
              <button key={l as string} disabled={busy} onClick={() => grade(g as number)} className={`btn ${cls} h-12 text-sm`}>{l}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
