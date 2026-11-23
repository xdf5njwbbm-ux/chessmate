import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import { EXPERIENCE, INTENSITY, LEVELS } from "../lib/constants";
import type { Forms, Intensity, Level, Profile } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { Button, Logo, Progress, Toggle } from "../components/ui";
import { TestRunner } from "../components/TestRunner";

const STEPS = ["You", "Russian", "Forms", "Chess", "Style"];

export default function Welcome() {
  const { uid, session, profile, setProfile } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(() => (session?.user.email ?? "").split("@")[0].replace(/[^a-zA-Z0-9 ]/g, " ").trim().slice(0, 20));
  const [username, setUsername] = useState(() => (session?.user.email ?? "").split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 16));
  const [available, setAvailable] = useState<boolean | null>(null);
  const [level, setLevel] = useState<Level>("A1");
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState<{ level: Level; score: number; total: number } | null>(null);
  const [forms, setForms] = useState<Forms>("m");
  const [exp, setExp] = useState<Profile["chess_experience"]>("casual");
  const [intensity, setIntensity] = useState<Intensity>("standard");
  const [translitOn, setTranslitOn] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) navigate("/home", { replace: true });
  }, [profile, navigate]);

  useEffect(() => {
    setAvailable(null);
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return;
    const t = setTimeout(() => api.usernameAvailable(username).then(setAvailable).catch(() => setAvailable(null)), 350);
    return () => clearTimeout(t);
  }, [username]);

  const finish = async () => {
    if (!uid) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .insert({
          id: uid,
          username,
          display_name: name.trim(),
          ru_level: level,
          ru_forms: forms,
          chess_experience: exp,
          learning_intensity: intensity,
          show_translit: translitOn,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        })
        .select("*")
        .single();
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "That username was just taken. Pick another one." : error.message);
      setProfile(data as Profile);
      toast({ title: `Добро пожаловать, ${name.trim()}!`, body: "Welcome to the academy.", tone: "success" });
      navigate("/home", { replace: true });
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
      if (/username/i.test((e as Error).message)) setStep(0);
    } finally {
      setBusy(false);
    }
  };

  const canNext = step === 0 ? name.trim().length > 0 && available === true : true;

  if (placing) {
    return (
      <div className="safe-top mx-auto min-h-dvh max-w-3xl px-5 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold">Placement test</h1>
          <Button variant="ghost" size="sm" onClick={() => setPlacing(false)}>Cancel</Button>
        </div>
        <TestRunner
          testId="placement"
          onDone={(r) => {
            const rec = (r.recommended ?? "A1") as Level;
            setLevel(rec);
            setPlaced({ level: rec, score: r.score, total: r.total });
            setPlacing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-2xl flex-col px-5 py-8">
      <Logo size={32} />
      <div className="mt-8 flex items-center gap-3">
        <Progress value={((step + 1) / STEPS.length) * 100} />
        <span className="shrink-0 text-sm text-mist">{step + 1} / {STEPS.length}</span>
      </div>

      <div key={step} className="mt-8 flex-1 animate-rise">
        {step === 0 && (
          <>
            <h1 className="font-display text-3xl font-semibold">Welcome to the academy</h1>
            <p className="mt-2 text-mist">How should other players see you?</p>
            <label className="mt-8 block text-sm font-medium text-fog">Display name</label>
            <input className="field mt-2" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Alex" />
            <label className="mt-5 block text-sm font-medium text-fog">Username</label>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-mist">@</span>
              <input className="field pl-8 pr-10" value={username} maxLength={20} autoCapitalize="none" onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="alex_plays" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {/^[a-z0-9_]{3,20}$/.test(username) && (available === null ? <Loader2 className="size-4 animate-spin text-mist" /> : available ? <Check className="size-4 text-accent" /> : <X className="size-4 text-danger" />)}
              </span>
            </div>
            <p className="mt-2 text-sm text-mist">
              {available === false ? "That username is taken." : "3–20 characters: letters, numbers and _. Friends use it to challenge you."}
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="font-display text-3xl font-semibold">How much Russian do you know?</h1>
            <p className="mt-2 text-mist">This sets your lessons and the Russian you'll see during games. You can change it any time.</p>
            {placed && (
              <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm">
                Placement result: <b>{placed.score}/{placed.total}</b> — we recommend starting at <b>{placed.level}</b>.
              </div>
            )}
            <div className="mt-6 grid gap-2">
              {LEVELS.map((l) => (
                <button key={l.code} onClick={() => setLevel(l.code)} className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${level === l.code ? "border-accent bg-accent/10" : "border-white/10 hover:border-white/20"}`}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] font-bold">{l.code}</span>
                  <span>
                    <span className="block font-semibold">{l.name} <span className="ru font-normal text-mist">· {l.ru}</span></span>
                    <span className="block text-sm text-mist">{l.can}</span>
                  </span>
                </button>
              ))}
            </div>
            <button className="mt-4 text-sm font-semibold text-accent hover:text-accent-soft" onClick={() => setPlacing(true)}>
              Not sure? Take the 5-minute placement test →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-3xl font-semibold">Masculine or feminine forms?</h1>
            <p className="mt-2 text-mist">
              In Russian, some words about yourself change: a man says <span className="ru text-fog">«я сделал»</span>, a woman says <span className="ru text-fog">«я сделала»</span>. Which forms should we teach you to use? You'll always be able to see both.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([["m", "Masculine", "я сделал · я рад · я устал"], ["f", "Feminine", "я сделала · я рада · я устала"]] as const).map(([v, l, ex]) => (
                <button key={v} onClick={() => setForms(v)} className={`rounded-2xl border p-5 text-left transition-colors ${forms === v ? "border-accent bg-accent/10" : "border-white/10 hover:border-white/20"}`}>
                  <div className="font-semibold">{l}</div>
                  <div className="ru mt-1 text-lg text-mist">{ex}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-3xl font-semibold">Your chess experience</h1>
            <p className="mt-2 text-mist">We use this to suggest a practice-bot strength. Your real rating starts after five placement games.</p>
            <div className="mt-6 grid gap-2">
              {EXPERIENCE.map((e) => (
                <button key={e.v} onClick={() => setExp(e.v)} className={`rounded-2xl border p-4 text-left transition-colors ${exp === e.v ? "border-accent bg-accent/10" : "border-white/10 hover:border-white/20"}`}>
                  <div className="font-semibold">{e.l}</div>
                  <div className="text-sm text-mist">{e.hint}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="font-display text-3xl font-semibold">How much Russian per move?</h1>
            <p className="mt-2 text-mist">During games, a panel next to the board teaches you Russian for each move. Learning should never make chess frustrating — pick a pace.</p>
            <div className="mt-6 grid gap-2">
              {INTENSITY.map((x) => (
                <button key={x.v} onClick={() => setIntensity(x.v)} className={`rounded-2xl border p-4 text-left transition-colors ${intensity === x.v ? "border-accent bg-accent/10" : "border-white/10 hover:border-white/20"}`}>
                  <div className="font-semibold">{x.l}</div>
                  <div className="text-sm text-mist">{x.hint}</div>
                </button>
              ))}
            </div>
            <div className="card mt-5 px-4">
              <Toggle checked={translitOn} onChange={setTranslitOn} label="Show transliteration" hint="Latin letters under Russian text — e.g. «Привет» → Privet." />
            </div>
          </>
        )}
      </div>

      <div className="mt-10 flex justify-between gap-3">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)}>Continue</Button>
        ) : (
          <Button loading={busy} onClick={finish}>Start learning</Button>
        )}
      </div>
    </div>
  );
}
