import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Mail } from "lucide-react";
import { supabase, APP_URL } from "../lib/supabase";
import { friendly } from "../lib/api";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { BackButton, Button, Logo } from "../components/ui";

function PasswordField({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="field pr-12"
        type={show ? "text" : "password"}
        placeholder="Password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={8}
        required
      />
      <button
        type="button"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-mist"
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "signin" ? "signin" : params.get("mode") === "forgot" ? "forgot" : "signup";
  const { uid, ready } = useSession();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const next = params.get("next");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | "confirm" | "reset">(null);

  useEffect(() => setError(null), [mode]);

  if (ready && uid) return <Navigate to={next && next.startsWith("/") ? next : "/"} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!agree) throw new Error("Please agree to play fair and treat other learners with respect.");
        if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: APP_URL },
        });
        if (error) throw error;
        if (!data.session) setSent("confirm");
        else navigate("/welcome", { replace: true });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate(next && next.startsWith("/") ? next : "/", { replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: APP_URL });
        if (error) throw error;
        setSent("reset");
      }
    } catch (err) {
      const msg = (err as Error).message ?? "";
      setError(
        /invalid login credentials/i.test(msg)
          ? "That email and password don't match."
          : /email not confirmed/i.test(msg)
            ? "Please confirm your email first. Check your inbox for the link."
            : /rate limit/i.test(msg)
              ? "Too many attempts. Please wait a minute and try again."
              : friendly(msg),
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="safe-top mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10">
        <div className="pt-4"><BackButton to="/" /></div>
        <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
          <div className="mb-6 grid size-16 animate-pop place-items-center rounded-3xl bg-accent/10 text-accent">
            <Mail className="size-8" />
          </div>
          <h1 className="font-display text-3xl font-semibold">Check your inbox</h1>
          <p className="mt-3 text-fog">
            {sent === "confirm"
              ? `We sent a confirmation link to ${email}. Open it, then come back here and sign in.`
              : `If ${email} has an account, a password reset link is on its way.`}
          </p>
          <Button
            className="mt-8 w-full"
            variant="secondary"
            onClick={() => {
              setSent(null);
              setParams(next ? { mode: "signin", next } : { mode: "signin" });
            }}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10">
      <div className="pt-4"><BackButton to="/" /></div>
      <div className="mt-4 animate-rise">
        <Logo size={34} />
        <h1 className="mt-8 font-display text-4xl font-semibold tracking-tight">
          {mode === "signup" ? "Create your account" : mode === "signin" ? "Welcome back" : "Reset your password"}
        </h1>
        <p className="mt-2 text-fog">
          {next?.startsWith("/invite/")
            ? mode === "forgot"
              ? "Enter your email and we'll send you a reset link."
              : "A friend invited you to a game of chess. Sign in or create a free account to play — you don't need to learn Russian."
            : mode === "signup"
              ? "Free to start. Play chess, learn Russian, or both."
              : mode === "signin"
                ? "Your games and lessons are waiting."
                : "Enter your email and we'll send you a reset link."}
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 grid animate-rise gap-3" style={{ animationDelay: "80ms" }}>
        <input
          className="field"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {mode !== "forgot" && (
          <PasswordField value={password} onChange={setPassword} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        )}
        {mode === "signup" && (
          <label className="mt-1 flex items-start gap-3 text-sm text-fog">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 accent-[#3fbf7f]" />
            <span>I'll play fair (no engine help in rated games) and treat other learners with respect.</span>
          </label>
        )}
        {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-[#ffb3b3]">{error}</div>}
        <Button type="submit" size="lg" loading={busy} className="mt-2">
          {mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Send reset link"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3 text-sm text-mist">
        {mode === "signin" && (
          <button className="hover:text-white" onClick={() => setParams({ mode: "forgot" })}>
            Forgot your password?
          </button>
        )}
        {mode === "signup" ? (
          <button onClick={() => setParams(next ? { mode: "signin", next } : { mode: "signin" })}>
            Already have an account? <span className="font-semibold text-accent">Sign in</span>
          </button>
        ) : (
          <button onClick={() => setParams(next ? { mode: "signup", next } : { mode: "signup" })}>
            New here? <span className="font-semibold text-accent">Create an account</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function ResetPassword() {
  const { endRecovery, uid } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="safe-top mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-10">
      <div className="pt-4"><BackButton to="/" /></div>
      <h1 className="mt-6 font-display text-4xl font-semibold">Choose a new password</h1>
      {!uid && <p className="mt-2 text-fog">Open the reset link from your email on this device to continue.</p>}
      <form
        className="mt-8 grid gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (password.length < 8) return setError("Use at least 8 characters.");
          setBusy(true);
          const { error } = await supabase.auth.updateUser({ password });
          setBusy(false);
          if (error) return setError(friendly(error.message));
          endRecovery();
          toast({ title: "Password updated", tone: "success" });
          navigate("/", { replace: true });
        }}
      >
        <PasswordField value={password} onChange={setPassword} autoComplete="new-password" />
        {error && <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-[#ffb3b3]">{error}</div>}
        <Button type="submit" size="lg" loading={busy} disabled={!uid}>
          Save password
        </Button>
      </form>
    </div>
  );
}
