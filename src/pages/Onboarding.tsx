import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { api } from "../lib/api";
import type { Profile, Question } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { FullScreenLoader, Logo, Progress } from "../components/ui";
import { PROFILE_STEPS } from "../components/ProfileSteps";

function firstIncomplete(p: Profile | null, answers: Record<string, string[]>, questions: Question[]): number {
  if (!p) return 0;
  if (!p.interested_in.length) return 1;
  if (!p.city && p.lat == null) return 2;
  if (p.photos.length < 3) return 3;
  if (!p.intentions || p.bio.trim().length < 10) return 4;
  if (!p.experience || !p.formats.length) return 5;
  if (p.interests.length < 3) return 6;
  for (const [i, section] of (["chess", "fun", "dating"] as const).entries()) {
    if (questions.filter((q) => q.section === section).some((q) => !answers[q.id]?.length)) return 7 + i;
  }
  return PROFILE_STEPS.length;
}

export default function Onboarding() {
  const { uid, profile, questions, refreshProfile, signOut } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!uid || !questions.length || step !== null) return;
    (async () => {
      const answers = profile ? await api.myAnswers(uid).catch(() => ({})) : {};
      const s = firstIncomplete(profile, answers, questions);
      if (s >= PROFILE_STEPS.length && profile?.onboarding_complete) navigate("/discover", { replace: true });
      else setStep(Math.min(s, PROFILE_STEPS.length - 1));
    })();
  }, [uid, profile, questions, step, navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  if (step === null) return <FullScreenLoader />;

  const def = PROFILE_STEPS[step];
  const last = step === PROFILE_STEPS.length - 1;

  const next = async () => {
    if (!last) return setStep(step + 1);
    const p = await refreshProfile();
    if (p?.onboarding_complete) {
      toast({ title: `Welcome to Chessmate, ${p.first_name}`, body: "Find someone you click with and challenge them.", tone: "success" });
      navigate("/discover", { replace: true });
    } else {
      // something required is still missing: jump to it
      const answers = await api.myAnswers(uid!).catch(() => ({}));
      setStep(Math.min(firstIncomplete(p, answers, questions), PROFILE_STEPS.length - 1));
    }
  };

  return (
    <div className="safe-top mx-auto min-h-dvh max-w-md px-5">
      <header className="sticky top-0 z-20 -mx-5 bg-ink-950/90 px-5 pb-3 pt-3 backdrop-blur">
        <div className="mb-3 flex h-10 items-center justify-between">
          {step > 0 ? (
            <button aria-label="Back" onClick={() => setStep(step - 1)} className="-ml-2 grid size-10 place-items-center rounded-full text-fog hover:bg-white/5">
              <ChevronLeft className="size-6" />
            </button>
          ) : (
            <Logo size={24} />
          )}
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">
            Step {step + 1} of {PROFILE_STEPS.length}
          </span>
          {step === 0 ? (
            <button className="text-sm text-mist hover:text-white" onClick={() => signOut()}>
              Sign out
            </button>
          ) : (
            <span className="w-10" />
          )}
        </div>
        <Progress value={(step + 1) / PROFILE_STEPS.length} />
      </header>

      <div key={def.key} className="animate-rise pt-4">
        <h1 className="font-display text-[32px] font-semibold leading-tight tracking-tight">{def.title}</h1>
        <p className="mt-2 text-fog">{def.subtitle}</p>
        <def.Component cta={last ? "Finish & start playing" : "Continue"} onDone={next} />
      </div>
    </div>
  );
}
