import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Brain, ChevronDown, ChevronRight, CircleCheck, Clock3, Mic, MicOff, Phone, Sparkles, TrendingUp } from "lucide-react";
import {
  LEVEL_INFO, MODES, nextLevel, topicById, TOPICS, TUTORS, VOICE_LEVELS, type TutorId, type VoiceMode,
} from "../../supabase/functions/_shared/voice/curriculum.ts";
import type { Report, Turn } from "../../supabase/functions/_shared/voice/logic.ts";
import { voiceApi, type VoiceHome, type VoiceStatus } from "../lib/voice/api";
import { micHelp, micPermission, voiceSupport, VoiceCall } from "../lib/voice/engine";
import { useLearner } from "../state/session";
import { Button, PageHeader, PageLoader, Progress, SectionTitle, Spinner } from "../components/ui";
import { TutorAvatar } from "../components/voice/TutorAvatar";
import { CallScreen } from "../components/voice/CallScreen";
import { VoiceReport } from "../components/voice/Report";

type Result = { report: Report; callId: string; tutor: TutorId; turns: Turn[] };

export default function VoicePractice() {
  const navigate = useNavigate();
  const learner = useLearner();
  const [params, setParams] = useSearchParams();
  const [home, setHome] = useState<VoiceHome | null>(null);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mic, setMic] = useState<"granted" | "denied" | "prompt" | "unknown">("unknown");
  const [mode, setMode] = useState<VoiceMode>("beginner");
  const [tutor, setTutor] = useState<TutorId>("anya");
  const [lesson, setLesson] = useState<number | null>(1);
  const [showEn, setShowEn] = useState(true);
  const [showPron, setShowPron] = useState(true);
  const [pickLesson, setPickLesson] = useState(false);
  const [call, setCall] = useState<VoiceCall | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [finishing, setFinishing] = useState(false);
  const callRef = useRef<VoiceCall | null>(null);
  callRef.current = call;
  const support = voiceSupport();

  const load = useCallback(async () => {
    try {
      const h = await voiceApi.home();
      setHome(h);
      setMode(h.profile.mode);
      setTutor(h.profile.tutor);
      setLesson(h.profile.current_lesson);
      setShowEn(h.profile.show_english);
      setShowPron(h.profile.show_translit);
      setLoadError(null);
      return h;
    } catch (e) {
      setLoadError((e as Error).message);
      return null;
    }
  }, []);

  useEffect(() => {
    void load().then(async (h) => {
      // calls left open (tab closed, phone died): finish them so their progress and report count
      const stale = (h?.calls ?? []).filter((c) => c.status === "active" && Date.now() - Date.parse(c.started_at) > 120_000);
      if (!stale.length) return;
      setFinishing(true);
      for (const c of stale) await voiceApi.end(c.id, null, null, null).catch(() => {});
      setFinishing(false);
      void load();
    });
    voiceApi.status().then(setStatus).catch(() => setStatus({ configured: false, allowed: false, ready: false, model: null }));
    void micPermission().then(setMic);
  }, [load]);

  // a lesson or review linked from elsewhere (?lesson=3, ?review=<call>)
  useEffect(() => {
    const l = Number(params.get("lesson"));
    if (l && topicById(l)) setLesson(l);
  }, [params]);

  // when a call ends, show its report
  useEffect(() => {
    if (!call) return;
    return call.subscribe(() => {
      const s = call.getSnapshot();
      if (s.phase === "idle") {
        // hung up before the call connected
        call.dispose();
        setCall(null);
        return;
      }
      if (s.phase === "ended" && s.report && s.callId) {
        setResult({ report: s.report, callId: s.callId, tutor: s.tutor, turns: call.turns() });
        call.dispose();
        setCall(null);
        void load();
        window.scrollTo(0, 0);
      }
    });
  }, [call, load]);

  // leaving the page ends the call (and saves it)
  useEffect(() => () => {
    const c = callRef.current;
    if (c) void c.end().finally(() => c.dispose());
  }, []);

  const save = (patch: Parameters<typeof voiceApi.settings>[0]) => void voiceApi.settings(patch).catch(() => {});

  /** Must run inside a tap/click: browsers unlock the microphone and audio only from a gesture. */
  const startCall = (o?: { lesson?: number | null; reviewOf?: string | null }) => {
    if (callRef.current) return;
    const c = new VoiceCall({
      mode, tutor, lesson: o && "lesson" in o ? o.lesson ?? null : lesson, slow: home?.profile.slow ?? false, reviewOf: o?.reviewOf ?? null,
    });
    setResult(null);
    setCall(c);
    void c.start().then(() => micPermission().then(setMic));
    if ([...params.keys()].length) setParams({}, { replace: true });
  };

  // ?review=<call id> opens a review call straight away (needs a tap: show a button instead of auto-starting)
  const reviewParam = params.get("review");

  const p = home?.profile;
  const t = TUTORS[tutor];
  const topic = topicById(lesson);
  const usedMin = home ? Math.floor(home.usage.seconds_24h / 60) : 0;
  const leftMin = home ? Math.max(0, Math.floor((home.usage.limit_s - home.usage.seconds_24h) / 60)) : 0;
  const ready = !!status?.ready && support.ok && !!home && leftMin > 0;

  if (!learner) {
    return (
      <div>
        <PageHeader back="/home" title="AI Voice Practice" />
        <div className="card p-6 text-mist">Voice practice is part of Learn Russian. Turn on <button className="font-semibold text-accent-soft" onClick={() => navigate("/settings")}>Learn Russian</button> in Settings to use it.</div>
      </div>
    );
  }

  return (
    <div>
      {call && (
        <CallScreen
          call={call}
          showEn={showEn}
          showPron={showPron}
          onToggleEn={(v) => {
            setShowEn(v);
            save({ show_english: v });
          }}
          onTogglePron={(v) => {
            setShowPron(v);
            save({ show_translit: v });
          }}
          onClose={() => {
            call.dispose();
            setCall(null);
          }}
        />
      )}

      {result ? (
        <div>
          <PageHeader
            title="Call complete"
            subtitle="Here's how it went — and a review made from this call."
            right={<Button variant="secondary" onClick={() => setResult(null)}>Done</Button>}
          />
          <VoiceReport
            report={result.report}
            tutor={result.tutor}
            turns={result.turns}
            onStartLesson={(id) => {
              setLesson(id);
              save({ current_lesson: id });
              startCall({ lesson: id });
            }}
            onReviewCall={() => startCall({ lesson: null, reviewOf: result.callId })}
          />
        </div>
      ) : (
        <div>
          <PageHeader back="/learn" title="AI Voice Practice" subtitle="Real spoken conversations with a patient native Russian tutor — any time, at your level." />

          {loadError && !home ? (
            <div className="card p-6">
              <div className="font-semibold">Voice practice is being set up</div>
              <p className="mt-1 text-mist">{loadError}</p>
              <Button className="mt-4" variant="secondary" onClick={() => void load()}>Try again</Button>
            </div>
          ) : !home ? (
            <PageLoader />
          ) : (
            <>
              {/* hero */}
              <div className="card relative overflow-hidden p-5 md:p-7">
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(600px 300px at 15% 0%, rgb(63 191 127 / 0.12), transparent 70%)" }} />
                <div className="relative flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:gap-8 md:text-left">
                  <div className="-m-6 shrink-0"><TutorAvatar tutor={tutor} size={124} mode="idle" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-soft">Звонок · Voice call</div>
                    <h2 className="mt-1 font-display text-3xl font-semibold leading-tight md:text-4xl">Call {t.ru}</h2>
                    <p className="mt-1 text-mist">{t.bio}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5 md:justify-start">
                      <span className="tag">{MODES[mode].title}</span>
                      <span className="tag !bg-accent/10 !text-accent-soft">Speaking {p!.level}</span>
                      <span className="tag">{reviewParam ? "Review call" : topic ? `${topic.id}. ${topic.title}` : "Free conversation"}</span>
                    </div>
                  </div>
                  <div className="flex w-full flex-col items-center gap-2 md:w-auto">
                    <button
                      type="button"
                      disabled={!ready || finishing}
                      onClick={() => startCall(reviewParam ? { lesson: null, reviewOf: reviewParam } : undefined)}
                      className="btn btn-primary h-14 w-full gap-2.5 rounded-2xl px-8 text-lg shadow-[0_12px_40px_-10px_rgb(63_191_127/0.8)] md:w-auto"
                    >
                      {finishing ? <Spinner className="size-5 text-ink-950" /> : <Phone className="size-5" />}
                      {finishing ? "Saving last call…" : "Start Call"}
                    </button>
                    <div className="text-xs text-faint">No buttons during the call — just talk.</div>
                  </div>
                </div>

                <div className="relative mt-5 grid grid-cols-1 gap-2 border-t border-white/[0.06] pt-4 text-sm sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    {mic === "denied" ? <MicOff className="size-4 text-danger" /> : <Mic className={`size-4 ${mic === "granted" ? "text-accent" : "text-mist"}`} />}
                    <span className={mic === "denied" ? "text-danger" : "text-fog"}>
                      {mic === "granted" ? "Microphone ready" : mic === "denied" ? "Microphone blocked" : "You'll be asked for the microphone"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-fog">
                    <Clock3 className="size-4 text-mist" /> {leftMin} min of calls left today{usedMin ? ` (${usedMin} used)` : ""}
                  </div>
                  <div className="flex items-center gap-2 text-fog">
                    <Brain className="size-4 text-mist" /> {p!.calls ? `${p!.calls} call${p!.calls === 1 ? "" : "s"} · ${Math.round(p!.seconds / 60)} min so far` : "Your first call starts at A1"}
                  </div>
                </div>
                {mic === "denied" && <p className="relative mt-2 text-xs text-mist">{micHelp()}</p>}
                {!support.ok && <p className="relative mt-3 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">{support.reason}</p>}
                {status && !status.configured && (
                  <p className="relative mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm text-mist">
                    Voice calls are almost ready: the server still needs its OpenAI API key (the <code className="text-fog">OPENAI_API_KEY</code> secret in Supabase → Edge Functions → Secrets).
                  </p>
                )}
                {status && status.configured && !status.allowed && <p className="relative mt-3 rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold">AI voice practice is part of Premium.</p>}
                {home && leftMin <= 0 && <p className="relative mt-3 rounded-xl bg-warn/10 px-3 py-2 text-sm text-warn">You've used today's call time. It refills over the next 24 hours.</p>}
              </div>

              <div className="mt-8 grid gap-x-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <div>
                  <SectionTitle>Conversation mode</SectionTitle>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(Object.keys(MODES) as VoiceMode[]).map((m) => {
                      const on = mode === m;
                      return (
                        <button key={m} type="button" onClick={() => { setMode(m); save({ mode: m }); }} aria-pressed={on}
                          className={`card card-hover flex flex-col p-4 text-left ${on ? "!border-accent/60 !bg-accent/[0.06]" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{MODES[m].title}</span>
                            <span className={`grid size-5 place-items-center rounded-full border-2 ${on ? "border-accent" : "border-white/20"}`}>{on && <span className="size-2.5 rounded-full bg-accent" />}</span>
                          </div>
                          <div className="ru text-sm text-mist">{MODES[m].ru}</div>
                          <ul className="mt-2 grid gap-0.5 text-[13px] text-fog">
                            {MODES[m].points.map((x) => <li key={x} className="flex gap-1.5"><span className="text-accent">·</span>{x}</li>)}
                          </ul>
                        </button>
                      );
                    })}
                  </div>

                  <SectionTitle right={<button type="button" onClick={() => setPickLesson((v) => !v)} className="flex items-center gap-1 text-sm font-semibold text-accent-soft">{pickLesson ? "Done" : "Change"} <ChevronDown className={`size-4 transition-transform ${pickLesson ? "rotate-180" : ""}`} /></button>}>
                    Today's conversation
                  </SectionTitle>
                  {!pickLesson ? (
                    <button type="button" onClick={() => setPickLesson(true)} className="card card-hover flex w-full items-center gap-4 p-4 text-left">
                      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/10 font-display text-lg font-semibold text-accent">{topic?.id ?? "∞"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{topic ? topic.title : "Free conversation"} {topic && <span className="ru font-normal text-mist">· {topic.ru}</span>}</span>
                        <span className="block text-sm text-mist">{topic ? topic.goal : "Talk about anything — your day, your life, chess."}</span>
                      </span>
                      <ChevronRight className="size-5 text-faint" />
                    </button>
                  ) : (
                    <div className="card divide-y divide-white/[0.05] overflow-hidden">
                      {[null, ...TOPICS.map((x) => x.id)].map((id) => {
                        const tp = topicById(id);
                        const prog = id ? p!.lessons[id] : null;
                        const done = !!prog?.mastered.includes(p!.level);
                        const on = lesson === id;
                        return (
                          <button key={id ?? "free"} type="button"
                            onClick={() => { setLesson(id); if (id) save({ current_lesson: id }); setPickLesson(false); }}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${on ? "bg-accent/[0.07]" : "hover:bg-white/[0.03]"}`}>
                            <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-semibold ${on ? "bg-accent text-ink-950" : "bg-white/[0.06] text-fog"}`}>{id ?? "∞"}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{tp ? tp.title : "Free conversation"}{tp && <span className="ru ml-1.5 font-normal text-mist">{tp.ru}</span>}</span>
                              {prog && <span className="block text-xs text-faint">{prog.calls} call{prog.calls === 1 ? "" : "s"} · best {prog.best}</span>}
                            </span>
                            {done && <CircleCheck className="size-5 text-accent" aria-label={`Mastered at ${p!.level}`} />}
                            {id === p!.current_lesson && !done && <span className="tag !text-[10px]">Next</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {topic && !pickLesson && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {topic.phrases.slice(0, 4).map((x) => <span key={x.ru} className="rounded-lg border border-white/[0.07] px-2 py-1 text-xs"><span className="ru text-sm text-fog">{x.ru}</span> <span className="text-faint">{x.en}</span></span>)}
                    </div>
                  )}
                </div>

                <div className="max-lg:mt-8">
                  <SectionTitle>Your tutor</SectionTitle>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(TUTORS) as TutorId[]).map((id) => {
                      const on = tutor === id;
                      return (
                        <button key={id} type="button" onClick={() => { setTutor(id); save({ tutor: id }); }} aria-pressed={on}
                          className={`card card-hover flex items-center gap-3 p-3 text-left ${on ? "!border-accent/60 !bg-accent/[0.06]" : ""}`}>
                          <div className="-m-3 shrink-0"><TutorAvatar tutor={id} size={42} /></div>
                          <div className="min-w-0">
                            <div className="font-display text-lg font-semibold leading-tight">{TUTORS[id].ru}</div>
                            <div className="truncate text-xs text-mist">{TUTORS[id].city}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <SectionTitle>Speaking level</SectionTitle>
                  <div className="card p-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="size-5 text-accent" />
                      <span className="font-display text-xl font-semibold">{p!.level} · {LEVEL_INFO[p!.level].name}</span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {VOICE_LEVELS.map((l) => <span key={l} className={`flex-1 rounded-md py-0.5 text-center text-[11px] font-bold ${l === p!.level ? "bg-accent text-ink-950" : VOICE_LEVELS.indexOf(l) < VOICE_LEVELS.indexOf(p!.level) ? "bg-accent/15 text-accent-soft" : "bg-white/[0.05] text-faint"}`}>{l}</span>)}
                    </div>
                    {nextLevel(p!.level) && (
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={p!.level_progress} className="flex-1" />
                        <span className="text-xs tabular-nums text-mist">{p!.level_progress}% → {nextLevel(p!.level)}</span>
                      </div>
                    )}
                    <p className="mt-2 text-sm text-mist">{LEVEL_INFO[p!.level].can}</p>
                    <p className="mt-2 text-xs text-faint">Your speaking level only rises when your calls show it — not just for finishing lessons. Course level: {home.course.level}.</p>
                  </div>

                  <SectionTitle>What {t.ru} remembers</SectionTitle>
                  <div className="card p-4 text-sm">
                    {p!.memory?.facts?.length || p!.memory?.known_words?.length ? (
                      <div className="grid gap-3">
                        {p!.memory.name && <div><span className="text-mist">Your name:</span> {p!.memory.name}</div>}
                        {p!.memory.facts?.length > 0 && (
                          <ul className="grid gap-0.5 text-fog">{p!.memory.facts.slice(-4).map((f) => <li key={f} className="flex gap-1.5"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-gold" />{f}</li>)}</ul>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-mist">
                          <span><span className="font-semibold text-white">{p!.memory.known_words?.length ?? 0}</span> words you've used</span>
                          <span><span className="font-semibold text-white">{p!.memory.grammar?.length ?? 0}</span> grammar point{p!.memory.grammar?.length === 1 ? "" : "s"}</span>
                          <span><span className="font-semibold text-white">{p!.memory.topics?.length ?? 0}</span> topic{p!.memory.topics?.length === 1 ? "" : "s"}</span>
                        </div>
                        {p!.memory.mistakes?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wider text-mist">Working on</div>
                            <ul className="mt-1 grid gap-0.5">{p!.memory.mistakes.slice(0, 3).map((m) => <li key={m.right} className="ru text-fog">{m.wrong ? <><span className="text-faint line-through">{m.wrong}</span> → </> : null}{m.right}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-mist">Nothing yet. {t.ru} remembers your name, what you share, the words you know and the mistakes you're working on — and brings them back in later calls.</p>
                    )}
                  </div>

                  {home.calls.length > 0 && (
                    <>
                      <SectionTitle>Recent calls</SectionTitle>
                      <div className="card divide-y divide-white/[0.05] overflow-hidden">
                        {home.calls.slice(0, 8).map((c) => {
                          const tp = topicById(c.lesson);
                          return (
                            <button key={c.id} type="button" onClick={() => navigate(`/practice/voice/call/${c.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{c.review_of ? "Review call" : tp ? tp.title : "Free conversation"}</div>
                                <div className="text-xs text-faint">
                                  {new Date(c.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {Math.max(1, Math.round(c.duration_s / 60))} min · {c.sentences} sentences
                                </div>
                              </div>
                              {c.scores ? (
                                <span className={`text-lg font-semibold tabular-nums ${c.scores.overall >= 80 ? "text-accent-soft" : c.scores.overall >= 60 ? "text-warn" : "text-mist"}`}>{c.scores.overall}</span>
                              ) : c.status === "active" ? <span className="tag">open</span> : null}
                              <ChevronRight className="size-4 text-faint" />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
