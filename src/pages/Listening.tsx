import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Headphones, X } from "lucide-react";
import { api } from "../lib/api";
import { shuffle } from "../lib/exercises";
import type { Line } from "../lib/types";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { AudioButtons, useSay } from "../components/Audio";
import { BackButton, Button, EmptyState, PageLoader, Progress } from "../components/ui";

type Item = { line: Line; ru: string; mode: "text" | "meaning"; options: string[]; answer: string };

export default function Listening() {
  const navigate = useNavigate();
  const { profile } = useSession();
  const { celebrate } = useLive();
  const say = useSay();
  const [items, setItems] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const forms = profile?.ru_forms ?? "m";

  useEffect(() => {
    (async () => {
      try {
        const cur = await api.curriculum();
        const lv = cur.levels.find((l) => l.code === cur.current_level)!;
        const pool = lv.lessons.filter((l) => l.completed);
        const chosen = shuffle(pool.length >= 2 ? pool : lv.lessons).slice(0, 3);
        const lessons = await Promise.all(chosen.map((l) => api.lesson(l.id)));
        const lines = lessons.flatMap((l) => l.content.sections.flatMap((s) => (s.type === "lines" ? s.lines : [])));
        const text = (l: Line) => (forms === "f" && l.ruF ? l.ruF : l.ru);
        const set = shuffle(lines).slice(0, 10);
        setItems(set.map((line, k) => {
          const mode = k % 2 === 0 ? "text" : "meaning";
          const ru = text(line);
          const answer = mode === "text" ? ru : line.en;
          const others = shuffle(lines.filter((x) => x !== line)).slice(0, 3).map((x) => (mode === "text" ? text(x) : x.en));
          return { line, ru, mode, answer, options: shuffle([answer, ...others]) };
        }));
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [forms]);

  const item = items?.[i];
  useEffect(() => {
    setPicked(null);
    if (item) {
      const t = setTimeout(() => say(item.ru), 300);
      return () => clearTimeout(t);
    }
  }, [i, items]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <EmptyState title="Couldn't load listening practice" body={err} />;
  if (!items) return <PageLoader />;
  if (!items.length) return <EmptyState icon={<Headphones className="size-7" />} title="No sentences yet" body="Start a lesson at your level first." action={<Button onClick={() => navigate("/learn")}>Go to lessons</Button>} />;
  if (!item) {
    return (
      <div className="mx-auto max-w-md pt-8 text-center">
        <div className="font-display text-3xl font-semibold">{right}/{items.length}</div>
        <p className="mt-2 text-mist">{right >= items.length * 0.8 ? "Отлично! Your ear is getting sharper." : "Keep listening — repetition is how it sinks in."}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => { setI(0); setRight(0); setItems(shuffle(items)); }}>Again</Button>
          <Button variant="secondary" onClick={() => navigate("/practice")}>Done</Button>
        </div>
      </div>
    );
  }

  const choose = (o: string) => {
    if (picked) return;
    setPicked(o);
    const ok = o === item.answer;
    if (ok) setRight(right + 1);
    api.recordPractice("listening", ok, "listening").then((r) => celebrate(r.new_achievements)).catch(() => {});
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <BackButton to="/practice" />
        <Progress value={(i / items.length) * 100} />
        <span className="shrink-0 text-sm tabular-nums text-mist">{i + 1}/{items.length}</span>
      </div>
      <div key={i} className="card animate-rise p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-mist">{item.mode === "text" ? "Which sentence did you hear?" : "What does it mean?"}</div>
        <div className="mt-5 flex justify-center"><AudioButtons text={item.ru} /></div>
        <div className="mt-6 grid gap-2">
          {item.options.map((o) => (
            <button key={o} disabled={!!picked} onClick={() => choose(o)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${picked && o === item.answer ? "border-accent bg-accent/10" : picked === o ? "border-danger bg-danger/10" : "border-white/10 hover:border-white/20"}`}>
              <span className={item.mode === "text" ? "ru text-lg" : ""}>{o}</span>
            </button>
          ))}
        </div>
        {picked && (
          <div className="mt-5 rounded-xl bg-white/[0.03] p-3">
            <div className={`mb-1 flex items-center gap-2 text-sm font-semibold ${picked === item.answer ? "text-accent-soft" : "text-[#ffb3b3]"}`}>{picked === item.answer ? <><Check className="size-4" /> Верно!</> : <><X className="size-4" /> Not quite</>}</div>
            <div className="ru text-lg">{item.ru}</div>
            <div className="text-sm text-mist">{item.line.en}</div>
          </div>
        )}
      </div>
      <div className="mt-5 flex justify-end"><Button disabled={!picked} onClick={() => setI(i + 1)}>Next</Button></div>
    </div>
  );
}
