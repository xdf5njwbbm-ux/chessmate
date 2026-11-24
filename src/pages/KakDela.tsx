import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Layers, ListChecks, MessagesSquare, Mic, Search, Square, Star, TriangleAlert, X } from "lucide-react";
import { api } from "../lib/api";
import { canRecognize, listen, type Listening } from "../lib/speech";
import { normalizeRu, similarity } from "../lib/russian";
import { loadSave, writeSave } from "../lib/saved";
import { ASK_BACK, CATEGORIES, PHRASES, SITUATIONS, TONES, forSpeaker, reaction, sayForm, type KdLevel, type KdPhrase, type Situation, type Tone } from "../lib/kakDela";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { AudioButtons, SpeakPractice, useSay } from "../components/Audio";
import { Button, Chip, LevelBadge, PageHeader, Progress, Segmented } from "../components/ui";

// ---------------------------------------------------------------- progress (kept on this device)

type Stat = { r: number; w: number; last: 0 | 1; t: number };
type KdSave = { fav: number[]; s: Record<number, Stat> };
const SLOT = "kakdela";

/** You're struggling with a phrase you've missed and haven't since got right more often than wrong. */
const struggling = (st?: Stat) => !!st && st.w > 0 && (st.last === 0 || st.w >= st.r);
const mastered = (st?: Stat) => !!st && st.last === 1 && st.r >= 2 && st.r > st.w;

function useKdProgress() {
  const { uid } = useSession();
  const toast = useToast();
  const [data, setData] = useState<KdSave>(() => loadSave<KdSave>(uid, SLOT) ?? { fav: [], s: {} });
  const save = (next: KdSave) => {
    setData(next);
    writeSave(uid, SLOT, next);
  };
  const mark = (n: number, ok: boolean) => {
    setData((d) => {
      const cur = d.s[n] ?? { r: 0, w: 0, last: 0, t: 0 };
      const next = { ...d, s: { ...d.s, [n]: { r: cur.r + (ok ? 1 : 0), w: cur.w + (ok ? 0 : 1), last: (ok ? 1 : 0) as 0 | 1, t: Date.now() } } };
      writeSave(uid, SLOT, next);
      return next;
    });
    api.recordPractice("phrase", ok, `kakdela:${n}`).catch(() => {});
  };
  const toggleFav = (x: KdPhrase) => {
    const on = data.fav.includes(x.n);
    save({ ...data, fav: on ? data.fav.filter((n) => n !== x.n) : [...data.fav, x.n] });
    if (!on) {
      api.savePhrase(x.ru, x.en, "practice")
        .then(() => toast({ title: "Saved to favourites", body: "It'll also come up in your reviews." }))
        .catch(() => toast({ title: "Saved to favourites" }));
    }
  };
  return { data, mark, toggleFav };
}

// ---------------------------------------------------------------- page

type Mode = null | { kind: "listen" | "cards" | "quiz" | "sim"; deck: KdPhrase[] };
const LEVELS: KdLevel[] = ["A1", "A2", "B1", "B2"];

/**
 * "Как дела?" — a course on answering "How are you?": 100 real answers in 10
 * categories, each with audio (normal and slow), its tone and who it's for,
 * gender forms, favourites, speaking practice, flashcards, quizzes and a
 * simulator where different people ask how you are.
 */
export default function KakDela() {
  const { profile } = useSession();
  const forms = (profile?.ru_forms ?? "m") as "m" | "f";
  const prog = useKdProgress();
  const [mode, setMode] = useState<Mode>(null);
  const [cat, setCat] = useState<number | null>(null);
  const [level, setLevel] = useState<"all" | KdLevel>("all");
  const [tone, setTone] = useState<Tone | null>(null);
  const [only, setOnly] = useState<null | "fav" | "struggling">(null);
  const [q, setQ] = useState("");

  const shown = useMemo(() => {
    const s = normalizeRu(q).trim();
    const sEn = q.trim().toLowerCase();
    return PHRASES.filter((x) =>
      (cat == null || x.cat === cat) &&
      (level === "all" || x.level === level) &&
      (!tone || x.tone === tone) &&
      (only !== "fav" || prog.data.fav.includes(x.n)) &&
      (only !== "struggling" || struggling(prog.data.s[x.n])) &&
      (!q.trim() || normalizeRu(x.ru).includes(s) || x.en.toLowerCase().includes(sEn) || x.note.toLowerCase().includes(sEn)),
    );
  }, [cat, level, tone, only, q, prog.data]);

  if (mode) {
    const exit = () => setMode(null);
    if (mode.kind === "listen") return <ListenRepeat deck={mode.deck} forms={forms} onMark={prog.mark} onExit={exit} />;
    if (mode.kind === "cards") return <Flashcards deck={mode.deck} forms={forms} onMark={prog.mark} onExit={exit} />;
    if (mode.kind === "quiz") return <Quiz deck={mode.deck} forms={forms} onMark={prog.mark} onExit={exit} />;
    return <Simulator forms={forms} level={(profile?.ru_level ?? "A1") as KdLevel} onMark={prog.mark} onExit={exit} />;
  }

  const stats = prog.data.s;
  const practised = PHRASES.filter((x) => stats[x.n]).length;
  const nMastered = PHRASES.filter((x) => mastered(stats[x.n])).length;
  const nStruggling = PHRASES.filter((x) => struggling(stats[x.n])).length;
  const mine = forSpeaker(shown, forms);
  const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
  const filtered = cat != null || level !== "all" || tone || only || q.trim();

  return (
    <div>
      <PageHeader back="/learn" title="How are you? · Как дела?" subtitle="100 answers Russians really use, in 10 categories — with audio, speaking practice, flashcards, quizzes and a conversation simulator." />

      <div className="card p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-mist">Then ask back — every time</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {ASK_BACK.map((a) => (
            <div key={a.ru} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
              <div className="min-w-0 flex-1"><div className="ru text-lg">{a.ru}</div><div className="text-xs text-mist">{a.en}</div></div>
              <AudioButtons text={a.ru} compact />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <ModeTile Icon={MessagesSquare} title="Conversation" body="Someone asks «Как дела?» — you answer" onClick={() => setMode({ kind: "sim", deck: [] })} />
        <ModeTile Icon={Mic} title="Listen & repeat" body="Hear it, say it, see which words were off" onClick={() => setMode({ kind: "listen", deck: shuffle(mine).slice(0, 15) })} disabled={!mine.length} />
        <ModeTile Icon={Layers} title="Flashcards" body="See the English, remember the Russian" onClick={() => setMode({ kind: "cards", deck: shuffle(mine).slice(0, 20) })} disabled={!mine.length} />
        <ModeTile Icon={ListChecks} title="Quiz" body="Multiple choice and fill in the blank" onClick={() => setMode({ kind: "quiz", deck: mine.length >= 4 ? mine : forSpeaker(PHRASES, forms) })} />
      </div>
      <p className="mt-2 text-xs text-mist">{filtered ? `Listen & repeat, flashcards and the quiz use the ${mine.length} phrase${mine.length === 1 ? "" : "s"} you've filtered.` : "Practice uses the phrases you'd say yourself — filter below to focus on some."}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mist">
        <span className="flex min-w-[200px] flex-1 items-center gap-2"><Progress value={practised} /> <span className="shrink-0">{practised}/100 practised</span></span>
        <span>{nMastered} mastered</span>
        <button className={`font-semibold ${only === "struggling" ? "text-white" : "text-[#ffb3b3]"}`} onClick={() => setOnly(only === "struggling" ? null : "struggling")} disabled={!nStruggling}>
          <TriangleAlert className="mr-1 inline size-3.5" />{nStruggling} to work on
        </button>
        <button className={`font-semibold ${only === "fav" ? "text-white" : "text-gold"}`} onClick={() => setOnly(only === "fav" ? null : "fav")}>
          <Star className="mr-1 inline size-3.5" />{prog.data.fav.length} favourites
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Segmented value={level} onChange={setLevel} options={[{ v: "all", l: "All" }, ...LEVELS.map((l) => ({ v: l, l }))]} />
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" />
          <input className="field !py-2.5 pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search — устал, busy, романтика…" />
        </div>
      </div>
      <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
        <Chip on={!tone} onClick={() => setTone(null)}>Any tone</Chip>
        {(Object.keys(TONES) as Tone[]).map((t) => <Chip key={t} on={tone === t} onClick={() => setTone(tone === t ? null : t)}>{TONES[t].label}</Chip>)}
      </div>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
        <Chip on={cat == null} onClick={() => setCat(null)}>All 10 categories</Chip>
        {CATEGORIES.map((c) => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(cat === c.id ? null : c.id)}>{c.id}. {c.title}</Chip>)}
      </div>
      {tone && <p className="mt-2 text-sm text-mist"><b className="text-fog">{TONES[tone].label}:</b> {TONES[tone].who}</p>}

      {CATEGORIES.map((c) => {
        const xs = shown.filter((x) => x.cat === c.id);
        if (!xs.length) return null;
        return (
          <section key={c.id} className="mt-7" data-category={c.id}>
            <h2 className="font-display text-xl font-semibold">{c.id}. {c.title} <span className="ru font-normal text-mist">· {c.ru}</span></h2>
            <p className="mb-3 text-sm text-mist">{c.blurb}</p>
            <div className="grid gap-2">
              {xs.map((x) => <PhraseCard key={x.n} x={x} fav={prog.data.fav.includes(x.n)} stat={prog.data.s[x.n]} onFav={() => prog.toggleFav(x)} onMark={prog.mark} />)}
            </div>
          </section>
        );
      })}
      {!shown.length && <div className="card mt-6 p-6 text-center text-mist">Nothing matches — try fewer filters.</div>}
    </div>
  );
}

function ModeTile({ Icon, title, body, onClick, disabled }: { Icon: typeof Mic; title: string; body: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="card card-hover flex flex-col p-4 text-left disabled:opacity-50">
      <Icon className="size-5 text-accent" />
      <span className="mt-2 font-semibold leading-tight">{title}</span>
      <span className="mt-0.5 text-xs text-mist">{body}</span>
    </button>
  );
}

function ToneTag({ tone }: { tone: Tone }) {
  return <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${TONES[tone].cls}`} title={TONES[tone].who}>{TONES[tone].label}</span>;
}

function WhoTags({ x }: { x: KdPhrase }) {
  return (
    <>
      {x.speaker && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-fog">{x.speaker === "m" ? "♂ said by a man" : "♀ said by a woman"}</span>}
      {x.toMan && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-fog">to a woman</span>}
    </>
  );
}

function PhraseCard({ x, fav, stat, onFav, onMark }: { x: KdPhrase; fav: boolean; stat?: Stat; onFav: () => void; onMark: (n: number, ok: boolean) => void }) {
  const [speak, setSpeak] = useState(false);
  return (
    <div className="card p-4" data-phrase={x.n}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 w-6 shrink-0 text-right text-xs tabular-nums text-faint">{x.n}</span>
        <div className="min-w-0 flex-1">
          <div className="ru text-xl leading-snug">{x.ru}</div>
          <div className="text-sm text-mist">{x.en}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <LevelBadge level={x.level} />
            <ToneTag tone={x.tone} />
            <WhoTags x={x} />
            {struggling(stat) && <span className="rounded-md bg-danger/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#ffb3b3]">work on this</span>}
            {mastered(stat) && <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-accent-soft">mastered</span>}
          </div>
          {x.other && <div className="mt-2 text-sm"><span className="text-mist">{x.speaker === "m" ? "A woman says:" : "A man says:"}</span> <span className="ru text-base">{x.other}</span></div>}
          {x.toMan && <div className="mt-2 text-sm"><span className="text-mist">To a man:</span> <span className="ru text-base">{x.toMan}</span></div>}
          <p className="mt-2 text-sm text-fog">{x.note}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AudioButtons text={x.ru} />
            <Button size="sm" variant={speak ? "primary" : "secondary"} onClick={() => setSpeak(!speak)}><Mic className="size-4" /> Practise</Button>
            <button className={`grid size-9 place-items-center rounded-xl ${fav ? "text-gold" : "text-mist hover:text-fog"}`} onClick={onFav} aria-label={fav ? "Remove from favourites" : "Save to favourites"} aria-pressed={fav}>
              <Star className={`size-5 ${fav ? "fill-current" : ""}`} />
            </button>
          </div>
          {speak && <div className="mt-3"><SpeakPractice text={x.ru} refKey={`kakdela:${x.n}`} onResult={(ok) => onMark(x.n, ok)} compact /></div>}
        </div>
      </div>
    </div>
  );
}

function Header({ title, i, n, onExit }: { title: string; i: number; n: number; onExit: () => void }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <button className="grid size-9 place-items-center rounded-xl text-mist hover:bg-white/5" onClick={onExit} aria-label="Stop"><X className="size-5" /></button>
      <span className="shrink-0 text-sm font-semibold">{title}</span>
      <Progress value={(i / Math.max(1, n)) * 100} />
      <span className="shrink-0 text-sm tabular-nums text-mist">{Math.min(i + 1, n)}/{n}</span>
    </div>
  );
}

function Done({ title, body, onExit }: { title: string; body: string; onExit: () => void }) {
  return (
    <div className="mx-auto max-w-xl pt-6 text-center">
      <div className="font-display text-3xl font-semibold">{title}</div>
      <p className="mt-2 text-mist">{body}</p>
      <Button className="mt-6" onClick={onExit}>Back to Как дела?</Button>
    </div>
  );
}

// ---------------------------------------------------------------- listen & repeat

function ListenRepeat({ deck, forms, onMark, onExit }: { deck: KdPhrase[]; forms: "m" | "f"; onMark: (n: number, ok: boolean) => void; onExit: () => void }) {
  const say = useSay();
  const [i, setI] = useState(0);
  const [passed, setPassed] = useState(0);
  const x = deck[i];
  useEffect(() => {
    if (!x) return;
    const t = setTimeout(() => say(sayForm(x, forms)), 350);
    return () => clearTimeout(t);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!x) return <Done title={passed >= deck.length * 0.7 ? "Отлично!" : "Хорошая работа!"} body={`The recognizer understood ${passed} of ${deck.length}. Phrases that didn't come through are marked "work on this".`} onExit={onExit} />;
  const ru = sayForm(x, forms);
  return (
    <div className="mx-auto max-w-2xl">
      <Header title="Listen & repeat" i={i} n={deck.length} onExit={onExit} />
      <div key={x.n} className="card animate-rise p-5" data-listen-repeat={x.n}>
        <div className="flex flex-wrap items-center gap-1.5"><LevelBadge level={x.level} /><ToneTag tone={x.tone} /><WhoTags x={x} /></div>
        <div className="ru mt-3 text-2xl leading-snug">{ru}</div>
        <div className="mt-1 text-mist">{x.en}</div>
        <div className="mt-4"><AudioButtons text={ru} /></div>
        <p className="mt-3 text-sm text-fog">{x.note}</p>
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <div className="mb-2 text-sm text-mist">Listen, then say it. Words the recognizer didn't catch are marked so you know what to work on.</div>
          <SpeakPractice key={x.n} text={ru} refKey={`kakdela:${x.n}`} onResult={(ok) => { onMark(x.n, ok); if (ok) setPassed((p) => p + 1); }} label="Say it" />
        </div>
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={() => setI(i + 1)}>{i < deck.length - 1 ? "Next" : "Finish"} <ArrowRight className="size-4" /></Button></div>
    </div>
  );
}

// ---------------------------------------------------------------- flashcards

function Flashcards({ deck, forms, onMark, onExit }: { deck: KdPhrase[]; forms: "m" | "f"; onMark: (n: number, ok: boolean) => void; onExit: () => void }) {
  const [queue, setQueue] = useState(deck);
  const [flipped, setFlipped] = useState(false);
  const [again, setAgain] = useState<Record<number, number>>({});
  const [done, setDone] = useState(0);
  const x = queue[0];
  if (!x) return <Done title="Готово!" body={`You went through ${deck.length} cards. The ones you marked "Again" are saved as phrases to work on.`} onExit={onExit} />;
  const ru = sayForm(x, forms);
  const answer = (ok: boolean) => {
    onMark(x.n, ok);
    setFlipped(false);
    if (ok) {
      setDone(done + 1);
      setQueue(queue.slice(1));
    } else {
      // comes back a few cards later (at most twice)
      const times = (again[x.n] ?? 0) + 1;
      setAgain({ ...again, [x.n]: times });
      const rest = queue.slice(1);
      setQueue(times <= 2 ? [...rest.slice(0, 3), x, ...rest.slice(3)] : rest);
      if (times > 2) setDone(done + 1);
    }
  };
  return (
    <div className="mx-auto max-w-2xl">
      <Header title="Flashcards" i={done} n={deck.length} onExit={onExit} />
      <div key={`${x.n}:${again[x.n] ?? 0}`} className="card animate-rise p-6 text-center" data-flashcard={x.n}>
        <div className="flex flex-wrap items-center justify-center gap-1.5"><ToneTag tone={x.tone} /><WhoTags x={x} /></div>
        <div className="mt-4 text-2xl font-semibold leading-snug">{x.en}</div>
        <div className="mt-1 text-sm text-mist">How do you say it in Russian? Say it out loud, then check.</div>
        {!flipped ? (
          <Button className="mt-6" onClick={() => setFlipped(true)}>Show the Russian</Button>
        ) : (
          <div className="mt-6 border-t border-white/[0.06] pt-5">
            <div className="ru text-2xl leading-snug">{ru}</div>
            <div className="mt-3 flex justify-center"><AudioButtons text={ru} autoFocus /></div>
            <p className="mt-3 text-sm text-fog">{x.note}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => answer(false)}><X className="size-4" /> Again</Button>
              <Button onClick={() => answer(true)}><Check className="size-4" /> Got it</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- quiz

type QuizQ = { kind: "en-ru" | "ru-en" | "blank" | "gender" | "tone"; x: KdPhrase; prompt: string; show?: string; audio?: string; options: string[]; answer: string; ruOptions: boolean };

const words = (s: string) => s.replace(/[.,!?«»—]/g, " ").split(/\s+/).filter(Boolean);
const pick = <T,>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const distinct = (correct: string, pool: string[], n = 3) => pick([...new Set(pool.filter((p) => p !== correct))], n);

function buildQuiz(deck: KdPhrase[], forms: "m" | "f"): QuizQ[] {
  const all = forSpeaker(PHRASES, forms);
  const out: QuizQ[] = [];
  const shuffled = pick(deck, deck.length);
  const kinds: QuizQ["kind"][] = ["en-ru", "blank", "ru-en", "tone", "blank", "en-ru", "gender", "ru-en", "blank", "en-ru"];
  let k = 0;
  for (const kind of kinds) {
    const x = shuffled[k++ % shuffled.length];
    if (!x) break;
    const ru = sayForm(x, forms);
    if (kind === "en-ru") {
      const same = all.filter((y) => y.cat === x.cat && y.n !== x.n).map((y) => sayForm(y, forms));
      out.push({ kind, x, prompt: "Choose the Russian", show: x.en, options: pick([ru, ...distinct(ru, same.length >= 3 ? same : all.map((y) => y.ru))], 4), answer: ru, ruOptions: true });
    } else if (kind === "ru-en") {
      out.push({ kind, x, prompt: "Listen. What does it mean?", audio: ru, options: pick([x.en, ...distinct(x.en, all.map((y) => y.en))], 4), answer: x.en, ruOptions: false });
    } else if (kind === "blank") {
      // A one-word phrase would leave nothing but "___!" — use a longer one from the deck (or the whole list).
      const bx = words(ru).length >= 2 ? x : (shuffled.find((y) => words(sayForm(y, forms)).length >= 2) ?? all.find((y) => words(sayForm(y, forms)).length >= 2)!);
      const bru = sayForm(bx, forms);
      const ws = words(bru).filter((w) => w.length >= 4);
      const target = ws.sort((a, b) => b.length - a.length)[0] ?? words(bru)[0];
      // Match the distractors' capitalisation to the missing word so the case doesn't give it away.
      const cap = target[0] !== target[0].toLowerCase();
      const fit = (w: string) => (cap ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase());
      const pool = [...new Set(all.flatMap((y) => words(sayForm(y, forms))).filter((w) => w.length >= 4).map(fit))].filter((w) => w.toLowerCase() !== target.toLowerCase());
      out.push({ kind, x: bx, prompt: `Fill in the missing word — “${bx.en}”`, show: bru.replace(target, "___"), options: pick([target, ...distinct(target, pool)], 4), answer: target, ruOptions: true });
    } else if (kind === "gender") {
      const g = PHRASES.filter((y) => y.speaker && y.other);
      const y = g[Math.floor(Math.random() * g.length)];
      const a = words(y.ru), b = words(y.other!);
      const idx = a.findIndex((w, j) => w !== b[j]);
      if (idx < 0) continue;
      const woman = y.speaker === "f";
      out.push({ kind, x: y, prompt: woman ? "A woman says:" : "A man says:", show: words(y.ru).map((w, j) => (j === idx ? "___" : w)).join(" "), options: pick([a[idx], b[idx]], 2), answer: a[idx], ruOptions: true });
    } else {
      const boss = Math.random() < 0.5;
      const good = all.filter((y) => (boss ? y.tone === "formal" || y.tone === "neutral" : y.tone === "romantic"));
      const bad = all.filter((y) => (boss ? y.tone === "romantic" || y.tone === "funny" || y.tone === "casual" : y.tone === "formal" || y.tone === "funny"));
      const right = good[Math.floor(Math.random() * good.length)];
      const opts = [sayForm(right, forms), ...pick(bad, 3).map((y) => sayForm(y, forms))];
      out.push({ kind, x: right, prompt: boss ? "Your boss asks «Как ваши дела?» Which answer fits?" : "Your girlfriend asks «Как ты?» Which answer is romantic?", options: pick(opts, 4), answer: sayForm(right, forms), ruOptions: true });
    }
  }
  return out;
}

function Quiz({ deck, forms, onMark, onExit }: { deck: KdPhrase[]; forms: "m" | "f"; onMark: (n: number, ok: boolean) => void; onExit: () => void }) {
  const say = useSay();
  const [qs] = useState(() => buildQuiz(deck, forms));
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [right, setRight] = useState(0);
  const q = qs[i];
  useEffect(() => {
    if (q?.audio) {
      const t = setTimeout(() => say(q.audio!), 300);
      return () => clearTimeout(t);
    }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!q) return <Done title={`${right}/${qs.length}`} body={right === qs.length ? "Perfect score — отлично!" : "The phrases you missed are marked \"work on this\"."} onExit={onExit} />;
  const ok = picked === q.answer;
  const choose = (o: string) => {
    if (picked) return;
    setPicked(o);
    onMark(q.x.n, o === q.answer);
    if (o === q.answer) setRight(right + 1);
  };
  const full = sayForm(q.x, forms);
  return (
    <div className="mx-auto max-w-2xl">
      <Header title="Quiz" i={i} n={qs.length} onExit={onExit} />
      <div key={i} className="card animate-rise p-5" data-quiz={q.kind}>
        <div className="text-xs font-semibold uppercase tracking-wider text-mist">{q.prompt}</div>
        {q.show && <div className={`mt-3 text-2xl leading-snug ${q.kind === "en-ru" ? "" : "ru"}`}>{q.show}</div>}
        {q.audio && <div className="mt-3"><AudioButtons text={q.audio} /></div>}
        <div className="mt-5 grid gap-2">
          {q.options.map((o) => (
            <button key={o} disabled={!!picked} onClick={() => choose(o)}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${picked && o === q.answer ? "border-accent bg-accent/10" : picked === o ? "border-danger bg-danger/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
              <span className={q.ruOptions ? "ru text-lg" : ""}>{o}</span>
            </button>
          ))}
        </div>
        {picked && (
          <div className={`mt-4 rounded-xl px-4 py-3 ${ok ? "bg-accent/10" : "bg-danger/10"}`}>
            <div className={`text-sm font-semibold ${ok ? "text-accent-soft" : "text-[#ffb3b3]"}`}>{ok ? "Верно!" : "Not quite."}</div>
            <div className="mt-1 flex items-start gap-2">
              <div className="min-w-0 flex-1"><span className="ru text-lg">{full}</span> <span className="text-sm text-mist">— {q.x.en}</span></div>
              <AudioButtons text={full} compact />
            </div>
            <p className="mt-1 text-sm text-fog">{q.kind === "gender" ? `${q.x.speaker === "f" ? "A man" : "A woman"} says: ${q.x.other}` : q.kind === "tone" ? `${TONES[q.x.tone].label}: ${TONES[q.x.tone].who}` : q.x.note}</p>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end"><Button disabled={!picked} onClick={() => { setPicked(null); setI(i + 1); }}>{i < qs.length - 1 ? "Next" : "Finish"} <ArrowRight className="size-4" /></Button></div>
    </div>
  );
}

// ---------------------------------------------------------------- conversation simulator

const UP_TO: Record<KdLevel, KdLevel[]> = { A1: ["A1", "A2"], A2: ["A1", "A2", "B1"], B1: LEVELS, B2: LEVELS };

function optionsFor(s: Situation, forms: "m" | "f", level: KdLevel): KdPhrase[] {
  const pool = forSpeaker(PHRASES, forms).filter((x) => UP_TO[level].includes(x.level));
  const fits = pool.filter((x) => s.good.includes(x.tone));
  const best = s.best ? fits.filter((x) => s.best!.includes(x.cat)) : [];
  const badTones = Object.keys(s.bad) as Tone[];
  const misfit = pool.filter((x) => badTones.includes(x.tone));
  const chosen = new Map<number, KdPhrase>();
  for (const x of [...pick(best, 1), ...pick(fits, 3), ...pick(misfit, 1)]) {
    if (chosen.size >= 4) break;
    chosen.set(x.n, x);
  }
  // make sure there's one answer that doesn't fit, so the choice teaches something
  if (misfit.length && ![...chosen.values()].some((x) => badTones.includes(x.tone))) {
    const keep = [...chosen.values()].slice(0, 3);
    chosen.clear();
    [...keep, pick(misfit, 1)[0]].forEach((x) => chosen.set(x.n, x));
  }
  return pick([...chosen.values()], chosen.size);
}

function Simulator({ forms, level, onMark, onExit }: { forms: "m" | "f"; level: KdLevel; onMark: (n: number, ok: boolean) => void; onExit: () => void }) {
  const say = useSay();
  const toast = useToast();
  const [order] = useState(() => pick(SITUATIONS, SITUATIONS.length));
  const [i, setI] = useState(0);
  const [stage, setStage] = useState<"answer" | "react" | "back">("answer");
  const [mine, setMine] = useState<KdPhrase | null>(null);
  const [back, setBack] = useState<string | null>(null);
  const [rec, setRec] = useState<Listening | null>(null);
  const [heard, setHeard] = useState("");
  const [score, setScore] = useState(0);
  const s = order[i];
  const opts = useMemo(() => (s ? optionsFor(s, forms, level) : []), [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!s) return;
    setStage("answer");
    setMine(null);
    setBack(null);
    setHeard("");
    const t = setTimeout(() => say(s.q), 400);
    return () => clearTimeout(t);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return <Done title="Отлично поговорили!" body={`${score} of ${order.length} answers fit the person and the moment.`} onExit={onExit} />;

  const choose = (x: KdPhrase) => {
    const fit = s.good.includes(x.tone);
    setMine(x);
    setStage("react");
    onMark(x.n, fit);
    if (fit) setScore(score + 1);
    const r = reaction(x.cat, s, forms);
    setTimeout(() => say(r.ru), 500);
  };

  const mic = async () => {
    if (rec) return rec.stop();
    try {
      const l = listen(setHeard);
      setRec(l);
      const r = await l.result;
      setRec(null);
      if (!r.transcript) return toast({ title: "Nothing came through — try again, or tap an answer." });
      const scored = opts.map((x) => ({ x, sc: similarity(normalizeRu(sayForm(x, forms)), normalizeRu(r.transcript)) })).sort((a, b) => b.sc - a.sc);
      if (scored[0] && scored[0].sc >= 0.45) choose(scored[0].x);
      else toast({ title: `We heard «${r.transcript}»`, body: "Say one of the answers below, or tap it." });
    } catch (e) {
      setRec(null);
      toast({ title: (e as Error).message, tone: "error" });
    }
  };

  const fit = mine ? s.good.includes(mine.tone) : false;
  const best = mine && fit && s.best?.includes(mine.cat);
  const r = mine ? reaction(mine.cat, s, forms) : null;
  const rightBack = s.vy ? "А у вас?" : "А у тебя?";

  return (
    <div className="mx-auto max-w-2xl">
      <Header title="Conversation" i={i} n={order.length} onExit={onExit} />
      <div className="text-sm text-mist">{s.who}{s.vy ? " — you call them вы" : ""}</div>
      <div className="mt-2 max-w-[90%] rounded-2xl bg-white/[0.05] px-4 py-3" data-sim={s.id}>
        <div className="text-[11px] text-mist ru">{s.whoRu}</div>
        <div className="flex items-start gap-2"><div className="ru flex-1 text-xl">{s.q}</div><AudioButtons text={s.q} compact /></div>
        <div className="text-sm text-mist">{s.qEn}</div>
      </div>

      {stage === "answer" && (
        <div className="mt-5">
          <div className="text-sm font-semibold">Answer — tap one, or say it:</div>
          <div className="mt-2 grid gap-2">
            {opts.map((x) => (
              <button key={x.n} onClick={() => choose(x)} className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left hover:border-white/20">
                <span className="ru text-lg">{sayForm(x, forms)}</span>
              </button>
            ))}
          </div>
          {canRecognize() && (
            <div className="mt-3 flex items-center gap-3">
              <Button variant={rec ? "danger" : "secondary"} onClick={mic}>{rec ? <><Square className="size-4 fill-white" /> Stop</> : <><Mic className="size-4" /> Say your answer</>}</Button>
              {rec && <span className="ru truncate text-mist">{heard || "…"}</span>}
            </div>
          )}
        </div>
      )}

      {stage !== "answer" && mine && r && (
        <>
          <div className="ml-auto mt-3 max-w-[85%] rounded-2xl bg-accent/15 px-4 py-3">
            <div className="ru text-lg">{sayForm(mine, forms)}</div>
            <div className="text-sm text-mist">{mine.en}</div>
          </div>
          <div className={`mt-2 rounded-xl px-4 py-3 text-sm ${fit ? "bg-accent/10 text-accent-soft" : "bg-gold/10 text-gold"}`}>
            <b>{best ? "Perfect choice here." : fit ? "Natural here." : "Hmm — not the best fit."}</b>{" "}
            <span className="text-fog">{fit ? `${TONES[mine.tone].label}: ${TONES[mine.tone].who}` : s.bad[mine.tone] ?? "Try an answer that fits who's asking."}</span>
          </div>
          <div className="mt-3 max-w-[90%] rounded-2xl bg-white/[0.05] px-4 py-3">
            <div className="text-[11px] text-mist ru">{s.whoRu}</div>
            <div className="flex items-start gap-2"><div className="ru flex-1 text-lg">{r.ru}</div><AudioButtons text={r.ru} compact /></div>
            <div className="text-sm text-mist">{r.en}</div>
          </div>
        </>
      )}

      {stage === "react" && (
        <div className="mt-5">
          <div className="text-sm font-semibold">Now ask back:</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {["А у тебя?", "А у вас?"].map((a) => (
              <button key={a} onClick={() => { setBack(a); setStage("back"); say(a === rightBack ? s.back.ru : a); }} className="ru rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-lg hover:border-white/20">{a}</button>
            ))}
          </div>
        </div>
      )}

      {stage === "back" && back && (
        <>
          <div className="ml-auto mt-3 max-w-[85%] rounded-2xl bg-accent/15 px-4 py-3"><div className="ru text-lg">{back}</div></div>
          <div className={`mt-2 rounded-xl px-4 py-3 text-sm ${back === rightBack ? "bg-accent/10 text-accent-soft" : "bg-gold/10 text-gold"}`}>
            {back === rightBack
              ? <><b>Right.</b> <span className="text-fog">{s.vy ? "You call them вы, so: А у вас?" : "You're on ты terms, so: А у тебя?"}</span></>
              : <><b>{s.vy ? "Use вы here." : "Use ты here."}</b> <span className="text-fog">{s.vy ? `${s.whoRu} is someone you call вы — say «А у вас?».` : `With ${s.whoRu} you're on ты terms — «А у вас?» sounds oddly formal.`}</span></>}
          </div>
          {back === rightBack && (
            <div className="mt-3 max-w-[90%] rounded-2xl bg-white/[0.05] px-4 py-3">
              <div className="text-[11px] text-mist ru">{s.whoRu}</div>
              <div className="flex items-start gap-2"><div className="ru flex-1 text-lg">{s.back.ru}</div><AudioButtons text={s.back.ru} compact /></div>
              <div className="text-sm text-mist">{s.back.en}</div>
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            {back !== rightBack && <Button variant="secondary" onClick={() => { setBack(null); setStage("react"); }}>Try again</Button>}
            <Button onClick={() => setI(i + 1)}>{i < order.length - 1 ? "Next person" : "Finish"} <ArrowRight className="size-4" /></Button>
          </div>
        </>
      )}
    </div>
  );
}
