import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, BookOpenCheck, Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { api, isPremiumError } from "../lib/api";
import { buildExercises, reviewPair, sameSentence, scored, type Exercise } from "../lib/exercises";
import type { Lesson as LessonT } from "../lib/types";
import { clearSave, loadSave, writeSave } from "../lib/saved";
import { useSession } from "../state/session";
import { useLive } from "../state/live";
import { useToast } from "../state/toast";
import { RussianLine, WordSheet, stressMapFrom } from "../components/RussianText";
import { AudioButtons, SpeakPractice, useSay } from "../components/Audio";
import { WhyWrong } from "../components/WhyWrong";
import { BackButton, Button, EmptyState, PageLoader, PremiumLock, Progress, Ring } from "../components/ui";

/** Where you are in a lesson, kept on this device: your place in the exercises and how far you'd read. */
type PracticeSave = { exercises: Exercise[]; i: number; right: number; wrong: Exercise[]; picked: string | null };
type LessonSave = { phase: "study" | "practice"; y?: number; practice?: PracticeSave };

const validPractice = (p: PracticeSave | undefined): p is PracticeSave =>
  !!p && Array.isArray(p.exercises) && p.exercises.length > 0 && Number.isInteger(p.i) && p.i >= 0 && p.i < p.exercises.length && Array.isArray(p.wrong) && Number.isFinite(p.right);

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <p>{parts.map((p, i) => (p.startsWith("**") ? <strong key={i} className={/[а-яё]/i.test(p) ? "ru text-[1.05em]" : ""}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}</p>;
}

export default function Lesson() {
  const { id = "" } = useParams();
  const { profile, uid } = useSession();
  const [lesson, setLesson] = useState<LessonT | null>(null);
  const [err, setErr] = useState<{ msg: string; premium: boolean } | null>(null);
  const [phase, setPhase] = useState<"study" | "practice" | "done">("study");
  const [result, setResult] = useState<{ score: number; wrong: Exercise[]; res?: Awaited<ReturnType<typeof api.completeLesson>> } | null>(null);
  const [vocabWord, setVocabWord] = useState<{ ru: string; en: string; stressed: string } | null>(null);
  const [progress, setProgress] = useState<PracticeSave | null>(null);
  const slot = `lesson:${id}`;
  const saved = useRef<LessonSave>({ phase: "study" });
  const restoreY = useRef(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /** Keeps a place in the exercises or a reading position worth coming back to; otherwise forgets the lesson. */
  const persist = (patch: Partial<LessonSave>) => {
    const next = { ...saved.current, ...patch };
    saved.current = next;
    if (next.practice || (next.y ?? 0) > 200) writeSave(uid, slot, next);
    else clearSave(uid, slot);
  };

  useEffect(() => {
    const s = loadSave<LessonSave>(uid, `lesson:${id}`);
    const practice = validPractice(s?.practice) ? s!.practice : undefined;
    saved.current = { phase: practice && s?.phase === "practice" ? "practice" : "study", y: s?.y, practice };
    restoreY.current = saved.current.phase === "study" ? s?.y ?? 0 : 0;
    setProgress(practice ?? null);
    setLesson(null);
    setPhase(saved.current.phase);
    setResult(null);
    window.scrollTo(0, 0);
    api.lesson(id).then(setLesson).catch((e) => setErr({ msg: (e as Error).message, premium: isPremiumError(e) }));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // save which part you're in and your place in the exercises as you go
  useEffect(() => {
    if (lesson && phase !== "done") persist({ phase, practice: progress ?? undefined });
  }, [lesson, phase, progress]); // eslint-disable-line react-hooks/exhaustive-deps

  // reading: come back to the same spot, and remember it as you scroll
  useEffect(() => {
    if (!lesson || phase !== "study") return;
    const y = restoreY.current;
    restoreY.current = 0;
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    let t: number | undefined;
    const onScroll = () => {
      clearTimeout(t);
      t = window.setTimeout(() => phaseRef.current === "study" && persist({ y: Math.round(window.scrollY) }), 300);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [lesson, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const startPractice = () => {
    setPhase("practice");
    window.scrollTo(0, 0);
  };

  const stress = useMemo(() => stressMapFrom(lesson?.vocab ?? []), [lesson]);

  if (err) return err.premium ? <div className="mx-auto max-w-lg pt-10"><PremiumLock body={err.msg} /></div> : <EmptyState title="Lesson unavailable" body={err.msg} />;
  if (!lesson || !profile) return <PageLoader />;

  if (phase === "practice") {
    return (
      <Practice
        lesson={lesson}
        resume={progress}
        onProgress={setProgress}
        onDone={(r) => {
          setResult(r);
          setProgress(null);
          saved.current = { phase: "study" };
          clearSave(uid, slot);
          setPhase("done");
          window.scrollTo(0, 0);
        }}
        onExit={() => {
          restoreY.current = saved.current.y ?? 0;
          setPhase("study");
        }}
      />
    );
  }
  if (phase === "done" && result) {
    return <Results lesson={lesson} result={result} onRetry={() => setPhase("practice")} onStudy={() => setPhase("study")} />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-2">
        <BackButton to="/learn" />
        <span className="text-sm text-mist">{lesson.level} · Lesson</span>
        {lesson.progress?.completed_at && <span className="tag !bg-accent/10 !text-accent-soft"><Check className="size-3" /> Completed · best {lesson.progress.best_score}%</span>}
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{lesson.title}</h1>
      <div className="ru mt-1 text-2xl text-mist">{lesson.title_ru}</div>
      {lesson.content.intro && <p className="mt-4 text-lg leading-relaxed text-fog">{lesson.content.intro}</p>}
      <p className="mt-3 text-sm text-faint">Tap any word for its meaning, stress, syllables and pronunciation practice.</p>

      {lesson.content.sections.map((s, i) =>
        s.type === "lines" ? (
          <section key={i} className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mist">{s.kind === "dialogue" ? "Dialogue" : "Phrases"}{s.title ? ` · ${s.title}` : ""}</h2>
            <div className="card divide-y divide-white/[0.06]">
              {s.lines.map((l, k) => (
                <div key={k} className="p-5"><RussianLine line={l} stress={stress} saveSource="lesson" practiceRef={`lesson:${lesson.id}`} /></div>
              ))}
            </div>
          </section>
        ) : (
          <section key={i} className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-mist"><Lightbulb className="size-4 text-gold" /> Grammar · {s.title}</h2>
            <div className="card prose-lesson grid gap-3 p-5">
              {s.paragraphs.map((p, k) => <Rich key={k} text={p} />)}
              {s.examples.length > 0 && (
                <div className="mt-1 grid gap-2">
                  {s.examples.map((ex, k) => (
                    <div key={k} className="flex items-start gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
                      <div className="min-w-0 flex-1"><div className="ru text-lg">{ex.ru}</div><div className="text-sm text-mist">{ex.en}</div></div>
                      <AudioButtons text={ex.ru.split("→").pop()!.trim()} compact />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ),
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mist">Vocabulary · {lesson.vocab.length} words</h2>
        <div className="card grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-2 sm:divide-y-0">
          {lesson.vocab.map((v) => (
            <button key={v.id} onClick={() => setVocabWord(v)} className="flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] sm:border-b sm:border-white/[0.06]">
              <div className="min-w-0 flex-1">
                <div className="ru text-lg">{v.stressed}</div>
                <div className="truncate text-sm text-mist">{v.en}{v.note ? <span className="text-faint"> · {v.note}</span> : null}</div>
              </div>
              <span onClick={(e) => e.stopPropagation()}><AudioButtons text={v.ru} compact /></span>
            </button>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 mt-10 flex justify-center gap-2">
        {progress ? (
          <>
            <Button size="lg" className="shadow-2xl" onClick={startPractice}>
              <BookOpenCheck className="size-5" /> Resume exercises · {progress.i + 1}/{progress.exercises.length}
            </Button>
            <Button size="lg" variant="secondary" className="!bg-ink-800 !px-4 shadow-2xl" aria-label="Restart the exercises" title="Restart the exercises" onClick={() => { setProgress(null); startPractice(); }}>
              <RotateCcw className="size-5" />
            </Button>
          </>
        ) : (
          <Button size="lg" className="shadow-2xl" onClick={startPractice}>
            <BookOpenCheck className="size-5" /> Start exercises
          </Button>
        )}
      </div>
      <WordSheet word={vocabWord} onClose={() => setVocabWord(null)} />
    </div>
  );
}

function Practice({ lesson, resume, onProgress, onDone, onExit }: {
  lesson: LessonT;
  resume: PracticeSave | null;
  onProgress: (p: PracticeSave) => void;
  onDone: (r: { score: number; wrong: Exercise[]; res?: Awaited<ReturnType<typeof api.completeLesson>> }) => void;
  onExit: () => void;
}) {
  const { profile } = useSession();
  const toast = useToast();
  const { celebrate } = useLive();
  const say = useSay();
  // a resumed set keeps its exact questions and order (they're shuffled when first built)
  const [exercises] = useState(() => resume?.exercises ?? buildExercises(lesson, profile?.ru_forms ?? "m"));
  const [i, setI] = useState(resume?.i ?? 0);
  const [picked, setPicked] = useState<string | null>(resume?.picked ?? null);
  const [order, setOrder] = useState<number[]>([]);
  const [right, setRight] = useState(resume?.right ?? 0);
  const [wrong, setWrong] = useState<Exercise[]>(resume?.wrong ?? []);
  const [busy, setBusy] = useState(false);
  const firstRun = useRef(true);
  const ex = exercises[i];
  const total = exercises.filter(scored).length;

  useEffect(() => {
    onProgress({ exercises, i, right, wrong, picked });
  }, [i, right, wrong, picked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const reopenedAnswered = firstRun.current && picked != null;
    firstRun.current = false;
    if (reopenedAnswered) return; // came back to a question already answered: keep it answered (and scored once)
    setPicked(null);
    setOrder([]);
    if (ex?.kind === "listen") {
      const t = setTimeout(() => say(ex.ru), 300);
      return () => clearTimeout(t);
    }
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ex) return null;
  const answered = picked != null;
  const correct = answered && (ex.kind === "order" ? sameSentence(picked!, ex.answer) : "answer" in ex && picked === ex.answer);

  const check = (value: string) => {
    if (answered) return;
    setPicked(value);
    const ok = ex.kind === "order" ? sameSentence(value, ex.answer) : "answer" in ex && value === ex.answer;
    if (ok) setRight((r) => r + 1);
    else setWrong((w) => [...w, ex]);
    if (ex.kind === "listen") api.recordPractice("listening", ok, `lesson:${lesson.id}`).catch(() => {});
  };

  const next = async () => {
    if (i < exercises.length - 1) return setI(i + 1);
    const score = Math.round((right / Math.max(1, total)) * 100);
    setBusy(true);
    try {
      const res = await api.completeLesson(lesson.id, score);
      celebrate(res.new_achievements);
      onDone({ score, wrong, res });
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
      onDone({ score, wrong });
    } finally {
      setBusy(false);
    }
  };

  const optionBtn = (o: string, isRu: boolean) => (
    <button key={o} disabled={answered} onClick={() => check(o)}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${answered && o === (ex as { answer: string }).answer ? "border-accent bg-accent/10" : answered && o === picked ? "border-danger bg-danger/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}>
      <span className={isRu ? "ru text-lg" : ""}>{o}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <button className="grid size-9 place-items-center rounded-xl text-mist hover:bg-white/5" onClick={onExit} aria-label="Back to the lesson"><X className="size-5" /></button>
        <Progress value={((i + (answered || ex.kind === "speak" ? 1 : 0)) / exercises.length) * 100} />
        <span className="shrink-0 text-sm tabular-nums text-mist">{i + 1}/{exercises.length}</span>
      </div>
      <div key={i} className="card animate-rise p-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-mist">{ex.prompt}</div>

        {ex.kind === "gap" && <div className="ru mt-4 text-2xl leading-snug">{ex.q.split("___").map((p, k, arr) => <span key={k}>{p}{k < arr.length - 1 && <span className={`mx-1 inline-block min-w-16 border-b-2 text-center ${answered ? (correct ? "border-accent text-accent-soft" : "border-danger text-danger") : "border-white/30"}`}>{picked ?? " "}</span>}</span>)}</div>}
        {ex.kind === "gap" && <div className="mt-2 text-sm text-mist">{ex.en}</div>}
        {ex.kind === "ru-en" && <div className="mt-4 flex items-start gap-3"><div className="ru flex-1 text-2xl leading-snug">{ex.ru}</div><AudioButtons text={ex.ru} compact /></div>}
        {ex.kind === "en-ru" && <div className="mt-4 text-xl">{ex.en}</div>}
        {ex.kind === "vocab" && <div className="mt-4 flex items-center gap-3"><div className="ru text-3xl">{ex.stressed}</div><AudioButtons text={ex.ru} compact /></div>}
        {ex.kind === "listen" && <div className="mt-4"><AudioButtons text={ex.ru} /></div>}
        {ex.kind === "order" && (
          <>
            <div className="mt-3 text-lg text-fog">{ex.en}</div>
            <div className="ru mt-4 min-h-14 rounded-xl border border-dashed border-white/15 p-3 text-xl">
              {order.map((k, n) => <button key={n} disabled={answered} onClick={() => setOrder(order.filter((_, m) => m !== n))} className="mr-1.5 mb-1.5 rounded-lg bg-white/10 px-2.5 py-1">{ex.tokens[k]}</button>)}
            </div>
            <div className="ru mt-3 flex flex-wrap gap-1.5 text-xl">
              {ex.tokens.map((t, k) => order.includes(k) ? null : <button key={k} disabled={answered} onClick={() => setOrder([...order, k])} className="rounded-lg border border-white/10 px-2.5 py-1 hover:border-white/25">{t}</button>)}
            </div>
            {!answered && <Button className="mt-4" disabled={order.length !== ex.tokens.length} onClick={() => check(order.map((k) => ex.tokens[k]).join(" "))}>Check</Button>}
            {answered && !correct && <div className="ru mt-3 text-lg text-accent-soft">{ex.answer}</div>}
          </>
        )}
        {ex.kind === "speak" && (
          <>
            <div className="mt-4 flex items-start gap-3"><div className="ru flex-1 text-2xl leading-snug">{ex.ru}</div></div>
            <div className="mt-1 text-sm text-mist">{ex.en}</div>
            <div className="mt-4 flex items-center gap-2"><AudioButtons text={ex.ru} /></div>
            <div className="mt-4"><SpeakPractice text={ex.ru} refKey={`lesson:${lesson.id}`} /></div>
          </>
        )}

        {"options" in ex && (
          <div className="mt-6 grid gap-2">{ex.options.map((o) => optionBtn(o, ex.kind === "gap" || ex.kind === "en-ru" || ex.kind === "listen"))}</div>
        )}

        {answered && (
          <div className={`mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${correct ? "bg-accent/10 text-accent-soft" : "bg-danger/10 text-[#ffb3b3]"}`}>
            {correct ? <><Check className="size-4" /> Верно! Correct.</> : <><X className="size-4" /> Not quite — the answer is highlighted.</>}
            {ex.kind === "listen" && <span className="ml-auto font-normal text-mist">{ex.ru}</span>}
          </div>
        )}
        {answered && !correct && ex.kind === "gap" && picked && <WhyWrong picked={picked} note={ex.why?.[picked]} ru />}
      </div>
      <div className="mt-5 flex justify-end">
        <Button disabled={!answered && ex.kind !== "speak"} loading={busy} onClick={next}>
          {i < exercises.length - 1 ? (ex.kind === "speak" ? "Continue" : "Next") : "Finish"} <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Results({ lesson, result, onRetry, onStudy }: { lesson: LessonT; result: { score: number; wrong: Exercise[]; res?: Awaited<ReturnType<typeof api.completeLesson>> }; onRetry: () => void; onStudy: () => void }) {
  const navigate = useNavigate();
  const passed = result.score >= 60;
  return (
    <div className="mx-auto max-w-xl pt-4 text-center">
      <div className="flex justify-center">
        <Ring value={result.score} size={120} stroke={9} tone={result.score >= 90 ? "gold" : "accent"}>
          <div className="text-3xl font-semibold tabular-nums">{result.score}%</div>
        </Ring>
      </div>
      <h1 className="mt-5 font-display text-3xl font-semibold">{passed ? (result.score >= 90 ? "Отлично!" : "Хорошо!") : "Почти!"}</h1>
      <p className="mt-2 text-mist">
        {passed
          ? result.res?.first_completion
            ? `Lesson complete. ${result.res.words_added} new words were added to your reviews.`
            : "Lesson complete. Nice work reviewing it."
          : "Score 60% or more to complete the lesson. Review the sentences and try again."}
      </p>
      {result.wrong.length > 0 && (
        <div className="card mt-6 p-4 text-left">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist">To review</div>
          <div className="grid gap-2">
            {result.wrong.map(reviewPair).filter((w, k, all) => all.findIndex((x) => x.ru === w.ru) === k).map((w, k) => (
              <div key={k} className="flex items-start gap-3 border-t border-white/[0.06] pt-2 first:border-0 first:pt-0">
                <div className="min-w-0 flex-1">
                  <div className="ru text-base">{w.ru}</div>
                  <div className="text-sm text-mist">{w.en}</div>
                </div>
                <AudioButtons text={w.ru} compact />
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {lesson.next_id && passed && <Button onClick={() => navigate(`/learn/lesson/${lesson.next_id}`)}>Next lesson <ArrowRight className="size-4" /></Button>}
        <Button variant="secondary" onClick={onRetry}><RotateCcw className="size-4" /> Practise again</Button>
        <Button variant="ghost" onClick={onStudy}>Back to the lesson</Button>
        <Button variant="ghost" onClick={() => navigate("/learn")}>All lessons</Button>
      </div>
    </div>
  );
}
