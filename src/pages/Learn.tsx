import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ClipboardCheck, Library, Lock, MessagesSquare, Mic, Smile } from "lucide-react";
import { api } from "../lib/api";
import type { Curriculum, Level } from "../lib/types";
import { Button, Chip, PageHeader, PageLoader, Progress, Segmented } from "../components/ui";

const GROUPS = [
  { v: "all", l: "All" },
  { v: "everyday", l: "Everyday" },
  { v: "chess", l: "Chess" },
  { v: "grammar", l: "Grammar" },
] as const;

export default function Learn() {
  const navigate = useNavigate();
  const [cur, setCur] = useState<Curriculum | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [group, setGroup] = useState<(typeof GROUPS)[number]["v"]>("all");
  const [cat, setCat] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.curriculum().then((c) => {
      setCur(c);
      setLevel((l) => l ?? c.current_level);
    }).catch((e) => setErr((e as Error).message));
  }, []);

  const cats = useMemo(() => new Map((cur?.categories ?? []).map((c) => [c.id, c])), [cur]);
  if (err) return <div className="card p-6 text-mist">{err}</div>;
  if (!cur || !level) return <PageLoader />;
  const lv = cur.levels.find((l) => l.code === level)!;
  const lessons = lv.lessons.filter((l) => {
    const c = cats.get(l.category_id);
    if (group !== "all" && c?.grp !== group) return false;
    if (cat && l.category_id !== cat) return false;
    return true;
  });
  const done = lv.lessons.filter((l) => l.completed).length;
  const usedCats = [...new Set(lv.lessons.map((l) => l.category_id))].map((id) => cats.get(id)!).filter((c) => group === "all" || c.grp === group);

  return (
    <div>
      <PageHeader title="Learn Russian" subtitle="Everyday conversation and chess Russian, from A1 to B2. Every sentence has audio, a word-by-word breakdown and grammar notes." />

      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/learn/how-are-you", Icon: Smile, title: "How are you? · Как дела?", body: "100 real answers · audio, flashcards, quiz, simulator" },
          { to: "/practice/talk", Icon: MessagesSquare, title: "Conversations", body: "112 everyday questions · answer, listen, repeat" },
          { to: "/practice", Icon: Mic, title: "Practice", body: "Reviews, listening, speaking, guided chats" },
          { to: "/vocabulary", Icon: Library, title: "Vocabulary", body: "Every word you've met, searchable" },
        ].map(({ to, Icon, title, body }) => (
          <button key={to} onClick={() => navigate(to)} className="card card-hover flex items-center gap-3 p-4 text-left">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/10"><Icon className="size-5 text-accent" /></span>
            <span className="min-w-0"><span className="block font-semibold">{title}</span><span className="block truncate text-sm text-mist">{body}</span></span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented value={level} onChange={(v) => { setLevel(v); setCat(null); }} options={cur.levels.map((l) => ({ v: l.code, l: <span className="inline-flex items-center gap-1">{l.locked && <Lock className="size-3" />}{l.code}</span> }))} />
        <Segmented size="sm" value={group} onChange={(v) => { setGroup(v); setCat(null); }} options={GROUPS.map((g) => ({ v: g.v, l: g.l }))} />
      </div>

      <div className="card mt-5 flex flex-wrap items-center gap-5 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-semibold">{lv.code} · {lv.name}</span>
            {cur.current_level === lv.code && <span className="tag !bg-accent/10 !text-accent-soft">Your level</span>}
            {lv.test?.passed && <span className="tag !bg-gold/10 !text-gold">Certified</span>}
          </div>
          <p className="mt-1 text-mist">{lv.description}</p>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={(done / Math.max(1, lv.lessons.length)) * 100} className="max-w-sm" />
            <span className="text-sm tabular-nums text-mist">{done}/{lv.lessons.length} lessons</span>
          </div>
        </div>
        {lv.test && (
          <Button variant={lv.test.passed ? "secondary" : "gold"} disabled={lv.locked} onClick={() => navigate(`/learn/test/${lv.test!.id}`)}>
            <ClipboardCheck className="size-4" /> {lv.test.passed ? "Retake level test" : "Take level test"}
          </Button>
        )}
      </div>

      {lv.locked && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gold/25 bg-gold/[0.06] px-4 py-3 text-sm">
          <Lock className="size-4 text-gold" /> {lv.code} is part of Premium. The free plan includes the full A1 course.
        </div>
      )}

      <div className="no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
        <Chip on={!cat} onClick={() => setCat(null)}>All topics</Chip>
        {usedCats.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</Chip>)}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lessons.map((l, i) => (
          <button key={l.id} disabled={lv.locked} onClick={() => navigate(`/learn/lesson/${l.id}`)}
            className="card card-hover flex animate-rise flex-col p-5 text-left disabled:opacity-60" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-mist">{cats.get(l.category_id)?.name}</span>
              {l.completed ? <CheckCircle2 className="size-5 text-accent" /> : lv.locked ? <Lock className="size-4 text-faint" /> : null}
            </div>
            <div className="mt-2 font-display text-xl font-semibold">{l.title}</div>
            <div className="ru text-lg text-mist">{l.title_ru}</div>
            <p className="mt-2 text-sm text-mist">{l.summary}</p>
            <div className="mt-auto flex items-center gap-3 pt-4 text-xs text-faint">
              <span>{l.line_count} sentences</span>
              <span>{l.vocab_count} words</span>
              {l.best_score != null && l.attempts > 0 && <span className="ml-auto font-semibold text-fog">Best {l.best_score}%</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
