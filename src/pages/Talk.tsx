import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Check, CornerDownRight, Eye, EyeOff, Lightbulb, Mic, MessagesSquare, Repeat2, Search, Send, Shuffle, Square, X } from "lucide-react";
import { api } from "../lib/api";
import { canRecognize, listen, type Listening } from "../lib/speech";
import { normalizeRu, similarity } from "../lib/russian";
import { loadSave, writeSave } from "../lib/saved";
import { pref, setPref } from "../lib/format";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { AudioButtons, SpeakPractice, useSay } from "../components/Audio";
import { Button, Chip, PageHeader, PageLoader, Progress, Segmented } from "../components/ui";

type Side = { ru: string; ruF?: string; en: string; speaker?: string };
type Follow = { ru: string; ruF?: string; en: string; link?: string };
export type Exchange = {
  id: string; lesson: string; level: string; category: string; topic: string; topicRu: string; partner: string;
  q: Side; a: Side; note: string; follow: Follow[]; next: string | null; connectors: string[];
  vocab: { ru: string; stressed: string; en: string }[];
};
type Bank = { connectors: { ru: string; en: string }[]; exchanges: Exchange[] };
type TalkProgress = { seen: string[]; missed: string[] };

const SLOT = "talk:progress";
const norm = (t: string) => t.toLowerCase().replace(/́/g, "").replace(/ё/g, "е");

/**
 * Conversations: the question-and-answer bank from the conversation lessons.
 * Practise one by one, have a random conversation where you don't know the next
 * question, or go back over the ones you missed. Search by topic, level or word.
 */
export default function Talk() {
  const { uid, profile } = useSession();
  const navigate = useNavigate();
  const [bank, setBank] = useState<Bank | null>(null);
  const [level, setLevel] = useState<"all" | "A1" | "A2">(() => (profile?.ru_level === "A1" ? "A1" : "all"));
  const [topic, setTopic] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<null | { kind: "one" | "talk" | "review"; deck: Exchange[] }>(null);
  const [progress, setProgressState] = useState<TalkProgress>(() => loadSave<TalkProgress>(uid, SLOT) ?? { seen: [], missed: [] });

  useEffect(() => {
    import("../generated/talk.json").then((m) => setBank(m.default as Bank));
  }, []);

  const mark = (id: string, knew: boolean) => {
    setProgressState((p) => {
      const next = {
        seen: p.seen.includes(id) ? p.seen : [...p.seen, id],
        missed: knew ? p.missed.filter((x) => x !== id) : p.missed.includes(id) ? p.missed : [...p.missed, id],
      };
      writeSave(uid, SLOT, next);
      return next;
    });
    api.recordPractice("phrase", knew, `talk:${id}`).catch(() => {});
  };

  const all = bank?.exchanges ?? [];
  const byLevel = useMemo(() => all.filter((x) => level === "all" || x.level === level), [all, level]);
  const topics = useMemo(() => [...new Map(byLevel.map((x) => [x.lesson, x])).values()], [byLevel]);
  const shown = useMemo(() => {
    const s = norm(q.trim());
    return byLevel.filter((x) => {
      if (topic && x.lesson !== topic) return false;
      if (!s) return true;
      const hay = norm([x.topic, x.topicRu, x.category, x.q.ru, x.q.en, x.a.ru, x.a.en, ...x.vocab.flatMap((v) => [v.ru, v.en])].join(" "));
      return hay.includes(s);
    });
  }, [byLevel, topic, q]);

  if (!bank) return <PageLoader />;
  const byId = new Map(all.map((x) => [x.id, x]));
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

  if (mode) {
    const exit = () => setMode(null);
    if (mode.kind === "talk") return <RandomConversation pool={mode.deck} byId={byId} onMark={mark} onExit={exit} />;
    return <OneByOne deck={mode.deck} review={mode.kind === "review"} onMark={mark} onExit={exit} />;
  }

  const missed = progress.missed.map((id) => byId.get(id)).filter((x): x is Exchange => !!x);
  return (
    <div>
      <PageHeader back="/learn" title="Conversations" subtitle={`${all.length} everyday questions in ${new Set(all.map((x) => x.lesson)).size} linked conversations. Answer, listen, repeat — then follow the conversation wherever it goes.`} />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3">
        <ModeCard Icon={BookOpen} title="One by one" body="Hear a question, answer it, then compare with a natural answer. English stays hidden." onClick={() => setMode({ kind: "one", deck: shuffle(shown) })} disabled={!shown.length} />
        <ModeCard Icon={Shuffle} title="Random conversation" body="Someone asks, you answer, they follow up — you won't know the next question." onClick={() => setMode({ kind: "talk", deck: shown.length ? shown : byLevel })} />
        <ModeCard Icon={Repeat2} title={`Review missed · ${missed.length}`} body="The questions you didn't know yet, until you do." onClick={() => setMode({ kind: "review", deck: shuffle(missed) })} disabled={!missed.length} />
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm text-mist">
        <Progress value={(progress.seen.length / Math.max(1, all.length)) * 100} className="max-w-xs" />
        <span className="shrink-0">{progress.seen.length}/{all.length} practised</span>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Segmented value={level} onChange={(v) => { setLevel(v); setTopic(null); }} options={[{ v: "all", l: "All" }, { v: "A1", l: "A1" }, { v: "A2", l: "A2" }]} />
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
          <input className="field !py-2.5 pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a topic or word — работа, money…" />
        </div>
      </div>
      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        <Chip on={!topic} onClick={() => setTopic(null)}>All topics</Chip>
        {topics.map((t) => <Chip key={t.lesson} on={topic === t.lesson} onClick={() => setTopic(t.lesson)}>{t.topic} · {t.level}</Chip>)}
      </div>

      <div className="mt-4 text-sm text-mist">{shown.length} question{shown.length === 1 ? "" : "s"}{topic || q ? " match" : ""} — “One by one” and “Random conversation” use these.</div>
      <div className="mt-3 grid gap-2">
        {shown.slice(0, 60).map((x) => <ExchangeRow key={x.id} x={x} missed={progress.missed.includes(x.id)} onOpen={() => navigate(`/learn/lesson/${x.lesson}`)} />)}
        {shown.length > 60 && <div className="text-center text-sm text-mist">Showing 60 of {shown.length} — search or pick a topic to narrow it down.</div>}
      </div>
    </div>
  );
}

function ModeCard({ Icon, title, body, onClick, disabled }: { Icon: typeof BookOpen; title: string; body: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="card card-hover flex items-start gap-3 p-4 text-left disabled:opacity-50 md:flex-col md:gap-0 md:p-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 md:mb-2"><Icon className="size-[18px] text-accent" /></span>
      <span className="min-w-0">
        <span className="block font-display text-lg font-semibold leading-tight">{title}</span>
        <span className="mt-1 block text-sm text-mist">{body}</span>
      </span>
    </button>
  );
}

const pickForm = (s: Side | Follow, f: boolean) => (f && s.ruF ? s.ruF : s.ru);

function ExchangeRow({ x, missed, onOpen }: { x: Exchange; missed: boolean; onOpen: () => void }) {
  const { profile } = useSession();
  const f = profile?.ru_forms === "f";
  const [open, setOpen] = useState(false);
  return (
    <div className="card p-4" data-exchange={x.id}>
      <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(!open)}>
        <div className="min-w-0 flex-1">
          <div className="ru text-lg leading-snug">{pickForm(x.q, f)}</div>
          <div className="text-sm text-mist">{x.q.en}</div>
        </div>
        <span className="shrink-0 text-xs text-faint">{x.level} · {x.topic}{missed ? " · missed" : ""}</span>
      </button>
      {open && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1"><div className="ru text-lg">{pickForm(x.a, f)}</div><div className="text-sm text-mist">{x.a.en}</div></div>
            <AudioButtons text={pickForm(x.a, f)} compact />
          </div>
          {x.note && <div className="mt-2 flex gap-2 text-sm text-fog"><Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" />{x.note}</div>}
          <Button size="sm" variant="ghost" className="mt-2" onClick={onOpen}>Open the lesson <ArrowRight className="size-4" /></Button>
        </div>
      )}
    </div>
  );
}

/** One question at a time: answer, reveal, listen and repeat, mark it. */
function OneByOne({ deck, review, onMark, onExit }: { deck: Exchange[]; review: boolean; onMark: (id: string, knew: boolean) => void; onExit: () => void }) {
  const { profile } = useSession();
  const f = profile?.ru_forms === "f";
  const say = useSay();
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [hideEn, setHideEn] = useState<boolean>(() => pref("talkHideEn", true));
  const [showQEn, setShowQEn] = useState(false);
  const [score, setScore] = useState({ knew: 0, missed: 0 });
  const x = deck[i];

  useEffect(() => {
    setReveal(false);
    setShowQEn(false);
    if (x) {
      const t = setTimeout(() => say(pickForm(x.q, f)), 300);
      return () => clearTimeout(t);
    }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (knew: boolean) => {
    onMark(x.id, knew);
    setScore((s) => (knew ? { ...s, knew: s.knew + 1 } : { ...s, missed: s.missed + 1 }));
    setI(i + 1);
  };

  if (!x) {
    return (
      <div className="mx-auto max-w-xl pt-6 text-center">
        <div className="font-display text-3xl font-semibold">{score.missed ? "Хорошо!" : "Отлично!"}</div>
        <p className="mt-2 text-mist">You knew {score.knew} of {score.knew + score.missed}.{score.missed ? " The ones you missed are in Review missed." : ""}</p>
        <Button className="mt-6" onClick={onExit}>Back to Conversations</Button>
      </div>
    );
  }
  const q = pickForm(x.q, f);
  const a = pickForm(x.a, f);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <button className="grid size-9 place-items-center rounded-xl text-mist hover:bg-white/5" onClick={onExit} aria-label="Stop"><X className="size-5" /></button>
        <Progress value={(i / deck.length) * 100} />
        <span className="shrink-0 text-sm tabular-nums text-mist">{i + 1}/{deck.length}</span>
      </div>
      <div key={x.id} className="card animate-rise p-5" data-one-by-one={x.id}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-mist">{review ? "Review · " : ""}{x.topic} · {x.level}</span>
          <button className="flex items-center gap-1 text-xs font-semibold text-mist hover:text-fog" onClick={() => { setHideEn(!hideEn); setPref("talkHideEn", !hideEn); }}>
            {hideEn ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {hideEn ? "English hidden" : "English shown"}
          </button>
        </div>
        <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-sky"><span className="ru normal-case tracking-normal">{x.q.speaker}</span> asks</div>
        <div className="mt-1 flex items-start gap-2">
          <div className="ru min-w-0 flex-1 text-2xl leading-snug">{q}</div>
          <AudioButtons text={q} compact />
        </div>
        {!hideEn || showQEn ? <div className="mt-1 text-mist">{x.q.en}</div> : <button className="mt-1 text-xs font-semibold text-mist hover:text-fog" onClick={() => setShowQEn(true)}>Show English</button>}

        {!reveal ? (
          <div className="mt-5">
            <p className="text-sm text-mist">Answer out loud — about yourself, or like the model would. Then compare.</p>
            <div className="mt-3"><SpeakPractice key={x.id} text={a} refKey={`talk:${x.id}`} label="Answer" /></div>
            <Button className="mt-3" variant="secondary" onClick={() => setReveal(true)}>Show a natural answer</Button>
          </div>
        ) : (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-accent-soft">A natural answer</div>
            <div className="mt-1 flex items-start gap-2">
              <div className="min-w-0 flex-1"><div className="ru text-xl leading-snug">{a}</div><div className="mt-0.5 text-mist">{x.a.en}</div></div>
              <AudioButtons text={a} compact />
            </div>
            {x.note && <div className="mt-3 flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-fog"><Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" /> {x.note}</div>}
            <div className="mt-3"><SpeakPractice key={`${x.id}:a`} text={a} refKey={`talk:${x.id}`} label="Repeat it" /></div>
            {x.follow.length > 0 && (
              <div className="mt-4">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-mist">What could they ask next?</div>
                <div className="grid gap-1.5">
                  {x.follow.map((fu) => (
                    <div key={fu.ru} className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
                      <CornerDownRight className="mt-1 size-4 shrink-0 text-faint" />
                      <div className="min-w-0 flex-1"><div className="ru text-base">{pickForm(fu, f)}</div><div className="text-xs text-mist">{fu.en}</div></div>
                      <AudioButtons text={pickForm(fu, f)} compact />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => done(false)}><X className="size-4" /> I missed it</Button>
              <Button onClick={() => done(true)}><Check className="size-4" /> I knew it</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Msg = { who: "them" | "me"; ru: string; en?: string; x?: Exchange; verdict?: { ok: boolean; model: string; modelEn: string } };

/**
 * A conversation that wanders: after each answer the partner either continues
 * the same conversation or follows one of its follow-up questions into another
 * one. You never know which.
 */
function RandomConversation({ pool, byId, onMark, onExit }: { pool: Exchange[]; byId: Map<string, Exchange>; onMark: (id: string, knew: boolean) => void; onExit: () => void }) {
  const { profile } = useSession();
  const f = profile?.ru_forms === "f";
  const say = useSay();
  const toast = useToast();
  const levels = new Set(pool.map((x) => x.level));
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [current, setCurrent] = useState<Exchange | null>(null);
  const [text, setText] = useState("");
  const [rec, setRec] = useState<Listening | null>(null);
  const [turns, setTurns] = useState(0);
  const asked = useRef(new Set<string>());
  const end = useRef<HTMLDivElement>(null);
  const MAX = 8;

  const ask = (x: Exchange) => {
    asked.current.add(x.id);
    setCurrent(x);
    const q = pickForm(x.q, f);
    setMsgs((m) => [...m, { who: "them", ru: q, en: x.q.en, x }]);
    setTimeout(() => say(q), 250);
  };

  /** Next question: the same conversation goes on, or a follow-up leads somewhere new. */
  const nextAfter = (x: Exchange | null): Exchange | null => {
    const fresh = (y: Exchange | undefined | null): y is Exchange => !!y && !asked.current.has(y.id) && levels.has(y.level);
    const options = [x?.next ? byId.get(x.next) : null, ...(x?.follow ?? []).map((fu) => (fu.link ? byId.get(fu.link) : null))].filter(fresh);
    if (options.length) return options[Math.floor(Math.random() * options.length)];
    const rest = pool.filter((y) => fresh(y));
    return rest.length ? rest[Math.floor(Math.random() * rest.length)] : null;
  };

  useEffect(() => {
    // start at the beginning of a random conversation
    const starts = pool.filter((x) => x.id.endsWith(":1"));
    const first = (starts.length ? starts : pool)[Math.floor(Math.random() * (starts.length || pool.length))];
    if (first) ask(first);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  const reply = (said: string | null) => {
    if (!current) return;
    const model = pickForm(current.a, f);
    const ok = said != null && similarity(normalizeRu(model), normalizeRu(said)) >= 0.55;
    onMark(current.id, ok);
    setMsgs((m) => [...m, { who: "me", ru: said ?? "…", verdict: { ok, model, modelEn: current.a.en } }]);
    setText("");
    const n = turns + 1;
    setTurns(n);
    const nx = n < MAX ? nextAfter(current) : null;
    setCurrent(null);
    if (nx) setTimeout(() => ask(nx), 900);
  };

  const mic = async () => {
    if (rec) return rec.stop();
    try {
      const l = listen((t) => setText(t));
      setRec(l);
      const r = await l.result;
      setRec(null);
      if (r.transcript) reply(r.transcript);
      else toast({ title: "Nothing came through — try again, or type your answer." });
    } catch (e) {
      setRec(null);
      toast({ title: (e as Error).message, tone: "error" });
    }
  };

  const finished = !current && turns > 0 && msgs.at(-1)?.who === "me" && (turns >= MAX || !nextAfter(null));
  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button className="grid size-9 place-items-center rounded-xl text-mist hover:bg-white/5" onClick={onExit} aria-label="Stop"><X className="size-5" /></button>
        <MessagesSquare className="size-5 text-accent" />
        <div className="flex-1 font-semibold">Random conversation</div>
        <span className="text-sm tabular-nums text-mist">{Math.min(turns + (current ? 1 : 0), MAX)}/{MAX}</span>
      </div>
      <p className="mb-4 text-sm text-mist">Answer each question — by voice or by typing. Your partner may continue the topic or jump to a new one.</p>
      <div className="grid gap-3" data-random-conversation>
        {msgs.map((m, k) => (
          <div key={k} className={m.who === "me" ? "ml-auto max-w-[85%]" : "max-w-[90%]"}>
            {m.who === "them" ? (
              <div className="rounded-2xl bg-white/[0.05] px-4 py-3">
                <div className="text-[11px] text-mist"><span className="ru">{m.x?.q.speaker}</span> · {m.x?.topic}</div>
                <div className="flex items-start gap-2"><div className="ru flex-1 text-lg">{m.ru}</div><AudioButtons text={m.ru} compact /></div>
                <details className="text-sm text-mist"><summary className="cursor-pointer text-xs">English</summary>{m.en}</details>
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-accent/15 px-4 py-3"><div className="ru text-lg">{m.ru}</div></div>
                {m.verdict && (
                  <div className={`mt-1.5 rounded-xl px-3 py-2 text-sm ${m.verdict.ok ? "text-accent-soft" : "bg-white/[0.03] text-fog"}`}>
                    {m.verdict.ok ? "✓ Natural answer." : <>A natural answer: <span className="ru text-base text-white">{m.verdict.model}</span> <span className="text-mist">— {m.verdict.modelEn}</span></>}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>

      {finished ? (
        <div className="mt-6 text-center">
          <div className="font-display text-2xl font-semibold">Спасибо за разговор!</div>
          <p className="mt-1 text-sm text-mist">Questions you didn't know are waiting in Review missed.</p>
          <Button className="mt-4" onClick={onExit}>Back to Conversations</Button>
        </div>
      ) : current ? (
        <div className="sticky bottom-3 mt-5 rounded-2xl border border-white/10 bg-ink-900/95 p-3 backdrop-blur">
          {rec && <div className="ru mb-2 text-base text-mist">“{text || "…"}”</div>}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) reply(text.trim()); }}>
            {canRecognize() && (
              <Button type="button" variant={rec ? "danger" : "secondary"} onClick={mic} aria-label={rec ? "Stop" : "Answer by voice"}>
                {rec ? <Square className="size-4 fill-white" /> : <Mic className="size-4" />}
              </Button>
            )}
            <input className="field !py-2.5" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ответь по-русски…" />
            <Button type="submit" disabled={!text.trim() || !!rec}><Send className="size-4" /></Button>
          </form>
          <button className="mt-2 text-xs font-semibold text-mist hover:text-fog" onClick={() => reply(null)}>I don't know — show me</button>
        </div>
      ) : null}
    </div>
  );
}
