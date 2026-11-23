import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, LogOut, Trash2, Volume2 } from "lucide-react";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";
import { EXPERIENCE, INTENSITY, LEVELS } from "../lib/constants";
import { pref, setPref } from "../lib/format";
import { deviceVoiceNames, speak } from "../lib/speech";
import type { Level, Plan, Profile, Voice } from "../lib/types";
import { useEntitlements, useSession } from "../state/session";
import { useToast } from "../state/toast";
import { BOARD_THEMES, type BoardTheme } from "../components/Board";
import { Button, PageHeader, SectionTitle, Segmented, Sheet, Toggle } from "../components/ui";

const FEATURE_LABELS: [keyof Plan["features"], string][] = [
  ["levels", "Course levels"],
  ["daily_reviews", "Daily reviews"],
  ["saved_phrases", "Saved phrases"],
  ["deep_learning", "Deep in-game learning (grammar + exercises)"],
  ["full_analysis", "Deeper engine analysis"],
  ["ai_tutor", "AI conversation partner"],
  ["neural_voices", "Neural Russian voices"],
  ["pronunciation_scoring", "Pronunciation scoring"],
  ["advanced_stats", "Advanced statistics"],
];

function featureValue(v: unknown) {
  if (Array.isArray(v)) return v.join(" · ");
  if (v === null) return "Unlimited";
  if (v === true) return <Check className="ml-auto size-4 text-accent" />;
  if (v === false) return <span className="text-faint">—</span>;
  return String(v);
}

export default function Settings() {
  const { profile, saveProfile, session, signOut, speech, refreshProfile } = useSession();
  const ent = useEntitlements();
  const navigate = useNavigate();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [blocked, setBlocked] = useState<{ id: string; username: string | null; display_name: string }[] | null>(null);
  const [voices, setVoices] = useState<string[]>([]);
  const [theme, setTheme] = useState<BoardTheme>(() => pref("boardTheme", "green"));
  const [name, setName] = useState(profile?.display_name ?? "");
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.myPlan().then((p) => setPlans(p.plans)).catch(() => {});
    api.blocked().then(setBlocked).catch(() => setBlocked([]));
    deviceVoiceNames().then(setVoices);
  }, []);
  if (!profile) return null;

  const set = async (patch: Partial<Profile>) => {
    try {
      await saveProfile(patch);
    } catch (e) {
      toast({ title: (e as Error).message, tone: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />

      <SectionTitle>Learning</SectionTitle>
      <div className="card divide-y divide-white/[0.06] px-4">
        <div className="py-3">
          <div className="font-medium">Russian level</div>
          <div className="mt-0.5 text-sm text-mist">Sets your lessons and the Russian you see during games. Passing a level test moves you up automatically.</div>
          <div className="mt-3"><Segmented value={profile.ru_level} onChange={async (l: Level) => { await api.setLevel(l).catch((e) => toast({ title: (e as Error).message, tone: "error" })); refreshProfile(); }} options={LEVELS.map((l) => ({ v: l.code, l: l.code }))} /></div>
        </div>
        <div className="py-3">
          <div className="font-medium">Forms for yourself</div>
          <div className="mt-0.5 text-sm text-mist"><span className="ru">я сделал</span> or <span className="ru">я сделала</span> — you can always reveal the other form.</div>
          <div className="mt-3"><Segmented value={profile.ru_forms} onChange={(v) => set({ ru_forms: v })} options={[{ v: "m", l: "Masculine" }, { v: "f", l: "Feminine" }]} /></div>
        </div>
        <div className="py-3">
          <div className="font-medium">Russian per move</div>
          <div className="mt-3"><Segmented value={profile.learning_intensity} onChange={(v) => set({ learning_intensity: v })} options={INTENSITY.filter((x) => x.v !== "deep" || ent.deep_learning).map((x) => ({ v: x.v, l: x.l }))} /></div>
        </div>
        <Toggle checked={profile.show_translit} onChange={(v) => set({ show_translit: v })} label="Show transliteration" hint="Latin letters under Russian text." />
        <div className="py-3">
          <div className="flex justify-between"><span className="font-medium">Daily new-word goal</span><span className="tabular-nums text-mist">{profile.daily_goal_words}</span></div>
          <input type="range" className="range mt-3" min={5} max={50} step={5} value={profile.daily_goal_words} onChange={(e) => set({ daily_goal_words: +e.target.value })} />
        </div>
      </div>

      <SectionTitle>Audio & speech</SectionTitle>
      <div className="card divide-y divide-white/[0.06] px-4">
        <div className="py-3 text-sm">
          {speech.tts ? (
            <span className="text-accent-soft">Neural Russian voices are on (Azure).</span>
          ) : (
            <span className="text-mist">Using your device's Russian voice{voices.length ? ` (${voices.length} available: ${voices.slice(0, 2).join(", ")}${voices.length > 2 ? "…" : ""})` : " — none found; install a Russian voice in your system settings for audio"}.</span>
          )}
          {speech.assess ? <span className="block text-accent-soft">Pronunciation scoring is on.</span> : <span className="block text-mist">Speaking feedback uses your device's speech recognizer (word-level, no score).</span>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 py-3">
          <span className="font-medium">Voice</span>
          <Segmented value={profile.voice} onChange={(v: Voice) => set({ voice: v })} options={[{ v: "female", l: "Female" }, { v: "male", l: "Male" }, ...(speech.tts ? [{ v: "female2" as Voice, l: "Female 2" }] : [])]} />
        </div>
        <div className="py-3">
          <div className="flex justify-between"><span className="font-medium">Speaking speed</span><span className="tabular-nums text-mist">{Number(profile.speech_rate).toFixed(2)}×</span></div>
          <input type="range" className="range mt-3" min={0.5} max={1.25} step={0.05} value={profile.speech_rate} onChange={(e) => set({ speech_rate: +e.target.value })} />
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => speak("Привет! Давай сыграем в шахматы.", { voice: profile.voice, userRate: Number(profile.speech_rate) }).catch(() => toast({ title: "Couldn't play audio on this device.", tone: "error" }))}>
            <Volume2 className="size-4" /> Test voice
          </Button>
        </div>
      </div>

      <SectionTitle>Chess</SectionTitle>
      <div className="card divide-y divide-white/[0.06] px-4">
        <div className="py-3">
          <div className="font-medium">Board</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((k) => (
              <button key={k} onClick={() => { setTheme(k); setPref("boardTheme", k); }} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${theme === k ? "border-accent" : "border-white/10"}`}>
                <span className="grid grid-cols-2 overflow-hidden rounded"><span className="size-3" style={{ background: BOARD_THEMES[k].light }} /><span className="size-3" style={{ background: BOARD_THEMES[k].dark }} /><span className="size-3" style={{ background: BOARD_THEMES[k].dark }} /><span className="size-3" style={{ background: BOARD_THEMES[k].light }} /></span>
                {BOARD_THEMES[k].name}
              </button>
            ))}
          </div>
        </div>
        <div className="py-3">
          <div className="font-medium">Experience</div>
          <div className="mt-3"><Segmented size="sm" value={profile.chess_experience} onChange={(v) => set({ chess_experience: v })} options={EXPERIENCE.map((e) => ({ v: e.v, l: e.l.replace(" player", "") }))} /></div>
        </div>
        <Toggle checked={profile.russian_chat} onChange={(v) => set({ russian_chat: v })} label="Prefer Russian-only chat" hint="Pre-selects Russian-only chat when you look for games." />
      </div>

      <SectionTitle>Profile & privacy</SectionTitle>
      <div className="card divide-y divide-white/[0.06] px-4">
        <div className="flex gap-2 py-3">
          <input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Display name" />
          <Button variant="secondary" disabled={!name.trim() || name.trim() === profile.display_name} onClick={() => set({ display_name: name.trim() }).then(() => toast({ title: "Saved" }))}>Save</Button>
        </div>
        <div className="py-3 text-sm text-mist">Username: <span className="text-fog">@{profile.username}</span></div>
        <Toggle checked={profile.show_online} onChange={(v) => set({ show_online: v })} label="Show when I'm online" />
      </div>

      <SectionTitle>Plan</SectionTitle>
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-display text-xl font-semibold">{ent.plan === "premium" ? "Premium" : "Free"}{ent.early_access && <span className="ml-2 tag !bg-gold/10 !text-gold">Early access</span>}</div>
            <div className="mt-0.5 text-sm text-mist">{ent.early_access ? "All Premium features are unlocked while subscriptions are being set up. Pricing hasn't been announced yet." : ent.plan === "premium" ? "Thank you for supporting the academy." : "Upgrade options will appear here when subscriptions launch."}</div>
          </div>
        </div>
        {plans.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-mist">
                  <th className="py-2 font-medium">Feature</th>
                  {plans.map((p) => <th key={p.id} className="py-2 text-right font-medium">{p.name}<div className="text-xs font-normal text-faint">{p.price_cents == null ? "Price TBA" : p.price_cents === 0 ? (p.name.toLowerCase() === "free" ? "\u00a0" : "Free") : `${(p.price_cents / 100).toFixed(2)} ${p.currency ?? ""}/${p.billing_interval ?? "mo"}`}</div></th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {FEATURE_LABELS.map(([k, l]) => (
                  <tr key={k}><td className="py-2 text-fog">{l}</td>{plans.map((p) => <td key={p.id} className="py-2 text-right">{featureValue(p.features[k])}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SectionTitle>Blocked players</SectionTitle>
      <div className="card divide-y divide-white/[0.06]">
        {blocked === null ? <div className="px-4 py-3 text-sm text-mist">Loading…</div> : blocked.length === 0 ? <div className="px-4 py-3 text-sm text-mist">You haven't blocked anyone.</div> : blocked.map((b) => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex-1 font-medium">{b.display_name} {b.username && <span className="text-sm text-mist">@{b.username}</span>}</span>
            <Button size="sm" variant="secondary" onClick={async () => { await api.unblock(b.id).catch(() => {}); setBlocked(await api.blocked()); }}>Unblock</Button>
          </div>
        ))}
      </div>

      <SectionTitle>Account</SectionTitle>
      <div className="card divide-y divide-white/[0.06]">
        <div className="px-4 py-3 text-sm"><div className="text-mist">Signed in as</div><div className="mt-0.5 font-medium">{session?.user.email}</div></div>
        <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left" onClick={async () => { await signOut(); navigate("/", { replace: true }); }}><LogOut className="size-5 text-mist" /> Sign out</button>
        <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-[#ffb3b3]" onClick={() => setDeleting(true)}><Trash2 className="size-5" /> Delete account</button>
      </div>
      <p className="mt-8 text-center text-xs text-faint">Russian Chess Academy · Chess engine: Stockfish 18 (GPLv3, <a className="underline" href={`${import.meta.env.BASE_URL}engine/README.txt`} target="_blank" rel="noreferrer">license & source</a>)</p>

      <Sheet open={deleting} onClose={() => setDeleting(false)} title="Delete your account?">
        <p className="text-fog">This permanently deletes your profile, progress, vocabulary, ratings and game history links. Games in progress end. This can't be undone.</p>
        <p className="mt-4 text-sm text-mist">Type <span className="font-semibold text-white">DELETE</span> to confirm.</p>
        <input className="field mt-2" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoCapitalize="characters" />
        <Button className="mt-4 w-full" size="lg" variant="danger" disabled={confirmText.trim() !== "DELETE"} loading={busy} onClick={async () => {
          setBusy(true);
          try {
            await api.deleteAccount();
            await supabase.auth.signOut().catch(() => {});
            toast({ title: "Your account has been deleted" });
            navigate("/", { replace: true });
          } catch (e) {
            toast({ title: "Couldn't delete your account", body: (e as Error).message, tone: "error" });
          } finally {
            setBusy(false);
          }
        }}>Permanently delete</Button>
      </Sheet>
    </div>
  );
}
