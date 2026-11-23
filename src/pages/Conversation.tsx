import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AudioLines, Bot, Eye, Lightbulb, Lock, Mic, Send, Sparkles, Square, Volume2 } from "lucide-react";
import { api, isPremiumError, tutorCall } from "../lib/api";
import { canRecognize, listen, speak } from "../lib/speech";
import { normalizeRu, similarity } from "../lib/russian";
import type { Level, Scenario, ScriptStep, TutorReply } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { BackButton, Button, EmptyState, LevelBadge, PageHeader, PageLoader, SectionTitle, Toggle } from "../components/ui";

const SPEED: Record<Level, number> = { A1: 0.75, A2: 0.85, B1: 1, B2: 1 };

export default function Conversation() {
  const { id } = useParams();
  return id ? <Chat scenarioId={id} /> : <ScenarioList />;
}

function ScenarioList() {
  const navigate = useNavigate();
  const { tutorAI, profile } = useSession();
  const [list, setList] = useState<Scenario[] | null>(null);
  useEffect(() => {
    api.scenarios().then(setList).catch(() => setList([]));
  }, []);
  if (!list) return <PageLoader />;
  const levels = ["A1", "A2", "B1", "B2"] as const;
  const order = [profile?.ru_level ?? "A1", ...levels.filter((l) => l !== profile?.ru_level)];
  return (
    <div>
      <PageHeader back="/practice" title="Conversation practice" subtitle={tutorAI
        ? "Talk with an AI Russian partner. It speaks at your level, asks follow-up questions and gently corrects mistakes."
        : "Guided conversations: the partner follows a script and checks your replies against natural answers."} />
      <div className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${tutorAI ? "border-accent/25 bg-accent/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
        {tutorAI ? <Bot className="mt-0.5 size-4 shrink-0 text-accent" /> : <Sparkles className="mt-0.5 size-4 shrink-0 text-gold" />}
        <span className="text-fog">{tutorAI
          ? "AI tutor is on. Pick a scenario, or start a free conversation about your day."
          : "Mode: guided scripts. When the AI tutor is enabled for this app, the same scenarios become open-ended conversations."}</span>
      </div>
      {tutorAI && (
        <button onClick={() => navigate("/practice/conversation/free")} className="card card-hover mb-2 flex w-full items-center gap-4 p-5 text-left">
          <div className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent"><AudioLines className="size-5" /></div>
          <div className="flex-1">
            <div className="font-display text-lg font-semibold">Free conversation</div>
            <div className="ru text-mist">Привет! Как прошёл твой день?</div>
          </div>
          <LevelBadge level={profile?.ru_level ?? "A1"} />
        </button>
      )}
      {order.map((lv) => (
        <div key={lv}>
          <SectionTitle>{lv} scenarios</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {list.filter((s) => s.level === lv).map((s) => (
              <button key={s.id} disabled={s.locked} onClick={() => navigate(`/practice/conversation/${s.id}`)} className="card card-hover p-5 text-left disabled:opacity-60">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-lg font-semibold">{s.title}</span>
                  {s.locked ? <Lock className="size-4 text-faint" /> : <LevelBadge level={s.level} />}
                </div>
                <div className="ru text-mist">{s.title_ru}</div>
                <p className="mt-2 text-sm text-mist">{s.description}</p>
                <div className="mt-2 text-xs text-faint">You talk with {s.tutor_role}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

type Msg = { role: "tutor" | "user"; ru: string; en?: string; correction?: TutorReply["correction"]; feedback?: { ok: boolean; model: string } | null };

function Chat({ scenarioId }: { scenarioId: string }) {
  const { tutorAI, profile } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const free = scenarioId === "free";
  const [scenario, setScenario] = useState<(Scenario & { script: ScriptStep[] }) | null>(null);
  const [conv, setConv] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(true);
  const [slow, setSlow] = useState(false);
  const [listening, setListening] = useState<ReturnType<typeof listen> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const level = (scenario?.level ?? profile?.ru_level ?? "A1") as Level;
  const mode: "ai" | "guided" = tutorAI ? "ai" : "guided";

  const say = (ru: string) => voice && speak(ru, { rate: slow ? 0.75 : SPEED[level], voice: profile?.voice ?? "female", userRate: Number(profile?.speech_rate ?? 1) }).catch(() => {});

  useEffect(() => {
    (async () => {
      try {
        const sc = free ? null : await api.scenario(scenarioId);
        if (sc) setScenario(sc as Scenario & { script: ScriptStep[] });
        if (free && !tutorAI) throw new Error("Free conversation needs the AI tutor.");
        const id = await api.startConversation(sc?.id ?? null, (sc?.level ?? profile?.ru_level ?? "A1") as Level, mode);
        setConv(id);
        if (mode === "ai") {
          const r = await tutorCall({ action: "open", conversation_id: id });
          setMsgs([{ role: "tutor", ru: r.reply.reply_ru, en: r.reply.reply_en }]);
          say(r.reply.reply_ru);
        } else if (sc) {
          const first = sc.script[0] as Extract<ScriptStep, { who: "tutor" }>;
          setMsgs([{ role: "tutor", ru: first.ru, en: first.en }]);
          setStep(1);
          api.logTurn(id, "tutor", first.ru, first.en, null).catch(() => {});
          say(first.ru);
        }
      } catch (e) {
        setErr(isPremiumError(e) ? (e as Error).message : (e as Error).message);
      }
    })();
  }, [scenarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs.length]);

  const userStep = scenario && mode === "guided" ? (scenario.script[step] as Extract<ScriptStep, { who: "user" }> | undefined) : undefined;
  const finished = mode === "guided" && scenario != null && step >= scenario.script.length;

  const sendGuided = async (said: string) => {
    if (!scenario || !conv || !userStep) return;
    const best = userStep.answers.map((a) => ({ a, s: similarity(normalizeRu(a), normalizeRu(said)) })).sort((x, y) => y.s - x.s)[0];
    const ok = best.s >= 0.72;
    setMsgs((m) => [...m, { role: "user", ru: said, feedback: { ok, model: ok ? best.a : userStep.answers[0] } }]);
    api.logTurn(conv, "user", said, "", ok ? null : { corrected: userStep.answers[0], explanation: "A natural way to say this", natural: userStep.answers[0] }).catch(() => {});
    setHint(false);
    const next = scenario.script[step + 1] as Extract<ScriptStep, { who: "tutor" }> | undefined;
    if (next?.who === "tutor") {
      setTimeout(() => {
        setMsgs((m) => [...m, { role: "tutor", ru: next.ru, en: next.en }]);
        api.logTurn(conv, "tutor", next.ru, next.en, null).catch(() => {});
        say(next.ru);
      }, 500);
      setStep(step + 2);
    } else setStep(step + 1);
  };

  const sendAI = async (said: string) => {
    if (!conv) return;
    setMsgs((m) => [...m, { role: "user", ru: said }]);
    setBusy(true);
    try {
      const r = await tutorCall({ action: "reply", conversation_id: conv, message: said });
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...copy[copy.length - 1], correction: r.reply.correction };
        return [...copy, { role: "tutor", ru: r.reply.reply_ru, en: r.reply.reply_en }];
      });
      say(r.reply.reply_ru);
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const send = (said: string) => {
    const t = said.trim();
    if (!t) return;
    setText("");
    if (mode === "ai") sendAI(t);
    else sendGuided(t);
  };

  const mic = async () => {
    if (listening) {
      listening.stop();
      return;
    }
    try {
      const l = listen((t) => setText(t));
      setListening(l);
      const r = await l.result;
      setListening(null);
      if (r.transcript) send(r.transcript);
    } catch (e) {
      setListening(null);
      toast({ title: (e as Error).message, tone: "error" });
    }
  };

  if (err) return <EmptyState title="Conversation unavailable" body={err} action={<Button variant="secondary" onClick={() => navigate("/practice/conversation")}>Back</Button>} />;
  if (!conv) return <PageLoader />;

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <div className="mb-3 flex items-center gap-2">
        <BackButton to="/practice/conversation" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-xl font-semibold">{scenario?.title ?? "Free conversation"}</div>
          <div className="text-xs text-mist">{mode === "ai" ? "AI tutor" : "Guided"} · <LevelBadge level={level} /></div>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-x-6 rounded-2xl border border-white/[0.07] px-4">
        <div className="min-w-44"><Toggle checked={voice} onChange={setVoice} label="Speak replies aloud" /></div>
        <div className="min-w-44"><Toggle checked={slow} onChange={setSlow} label="Slow speech" /></div>
      </div>
      {scenario && <p className="mb-4 text-sm text-mist">{scenario.description} You're talking with {scenario.tutor_role}.</p>}

      <div className="grid gap-3">
        {msgs.map((m, k) => (m.role === "tutor" ? <TutorBubble key={k} m={m} onPlay={() => speak(m.ru, { rate: slow ? 0.75 : SPEED[level], voice: profile?.voice ?? "female" })} /> : <UserBubble key={k} m={m} />))}
        {busy && <div className="w-fit rounded-2xl bg-white/[0.05] px-4 py-3 text-sm text-mist">Печатает…</div>}
        <div ref={end} />
      </div>

      {finished ? (
        <div className="card mt-6 p-5 text-center">
          <div className="font-display text-2xl font-semibold">Отлично! Conversation complete.</div>
          <div className="mt-4 flex justify-center gap-2">
            <Button onClick={() => navigate("/practice/conversation")}>More scenarios</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>Practise again</Button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-3 mt-6">
          {userStep && (
            <div className="mb-2 rounded-2xl border border-white/[0.07] bg-ink-900/95 px-4 py-3 text-sm backdrop-blur">
              <div className="flex items-center gap-2"><Lightbulb className="size-4 text-gold" /> <span className="text-fog">{userStep.hint}</span>
                <button className="ml-auto flex items-center gap-1 text-xs font-semibold text-mist hover:text-fog" onClick={() => setHint(!hint)}><Eye className="size-3.5" /> Example</button>
              </div>
              {hint && <div className="ru mt-1 text-lg">{userStep.answers[0]}</div>}
            </div>
          )}
          <form className="glass flex gap-2 rounded-2xl border border-white/10 p-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input className="field !border-0 !bg-transparent" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ответьте по-русски… (answer in Russian)" maxLength={600} disabled={busy} />
            {canRecognize() && (
              <button type="button" onClick={mic} className={`btn h-11 w-11 shrink-0 ${listening ? "animate-pulse-ring bg-danger text-white" : "btn-secondary"}`} aria-label={listening ? "Stop" : "Speak"}>
                {listening ? <Square className="size-4 fill-white" /> : <Mic className="size-[18px]" />}
              </button>
            )}
            <Button type="submit" disabled={!text.trim() || busy}><Send className="size-4" /></Button>
          </form>
        </div>
      )}
    </div>
  );
}

function TutorBubble({ m, onPlay }: { m: Msg; onPlay: () => void }) {
  const [en, setEn] = useState(false);
  return (
    <div className="max-w-[88%] animate-rise rounded-2xl rounded-tl-md bg-white/[0.05] px-4 py-3">
      <div className="ru text-xl leading-snug">{m.ru}</div>
      {en && m.en && <div className="mt-1 text-sm text-mist">{m.en}</div>}
      <div className="mt-2 flex gap-1">
        <button onClick={onPlay} className="btn btn-ghost h-7 px-2 text-xs"><Volume2 className="size-3.5" /> Listen</button>
        {m.en && <button onClick={() => setEn(!en)} className="btn btn-ghost h-7 px-2 text-xs"><Eye className="size-3.5" /> {en ? "Hide" : "Translate"}</button>}
        <button onClick={() => api.savePhrase(m.ru, m.en ?? "", "tutor").then(() => {}).catch(() => {})} className="btn btn-ghost h-7 px-2 text-xs">Save</button>
      </div>
    </div>
  );
}

function UserBubble({ m }: { m: Msg }) {
  return (
    <div className="ml-auto max-w-[88%] animate-rise">
      <div className="rounded-2xl rounded-tr-md bg-accent/15 px-4 py-3"><div className="ru text-xl leading-snug">{m.ru}</div></div>
      {m.feedback && (
        <div className={`mt-1.5 rounded-xl px-3 py-2 text-sm ${m.feedback.ok ? "text-accent-soft" : "border border-gold/25 bg-gold/[0.05] text-fog"}`}>
          {m.feedback.ok ? "✓ Natural answer." : <>A natural way to say it: <span className="ru text-base text-white">{m.feedback.model}</span></>}
        </div>
      )}
      {m.correction && (
        <div className="mt-1.5 rounded-xl border border-gold/25 bg-gold/[0.05] px-3 py-2 text-sm">
          {m.correction.corrected && <div><span className="text-mist">Corrected: </span><span className="ru text-base text-white">{m.correction.corrected}</span></div>}
          {m.correction.explanation && <div className="mt-0.5 text-fog">{m.correction.explanation}</div>}
          {m.correction.natural && m.correction.natural !== m.correction.corrected && <div className="mt-0.5"><span className="text-mist">More natural: </span><span className="ru text-base text-white">{m.correction.natural}</span></div>}
        </div>
      )}
    </div>
  );
}
