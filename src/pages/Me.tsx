import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ChevronRight, Eye, Heart, MapPin, Settings, Sparkles, Swords, UserRound, Brain, Smile } from "lucide-react";
import { api } from "../lib/api";
import { EXPERIENCE, INTENTIONS } from "../lib/constants";
import { ageFrom } from "../lib/format";
import { useSession } from "../state/session";
import { Photo, SectionTitle, TopBar } from "../components/ui";

export default function Me() {
  const { profile, uid, questions } = useSession();
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ games: number; wins: number; losses: number; draws: number } | null>(null);
  const [unanswered, setUnanswered] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!uid) return;
    api.profile(uid).then((p) => p && setStats(p.stats)).catch(() => {});
    api
      .myAnswers(uid)
      .then((a) => {
        const out: Record<string, number> = {};
        for (const q of questions) if (!a[q.id]?.length) out[q.section] = (out[q.section] ?? 0) + 1;
        setUnanswered(out);
      })
      .catch(() => {});
  }, [uid, questions]);

  if (!profile) return null;
  const intent = INTENTIONS.find((i) => i.v === profile.intentions);

  const rows: { key: string; Icon: typeof Camera; label: string; value?: string; todo?: number }[] = [
    { key: "photos", Icon: Camera, label: "Photos", value: `${profile.photos.length} of 6` },
    { key: "about", Icon: UserRound, label: "About me", value: intent?.short },
    { key: "basics", Icon: Sparkles, label: "Name & gender", value: profile.first_name },
    { key: "chess", Icon: Swords, label: "Chess", value: profile.elo ? `${profile.elo} Elo` : EXPERIENCE.find((e) => e.v === profile.experience)?.l },
    { key: "interests", Icon: Heart, label: "Interests", value: `${profile.interests.length} picked` },
    { key: "looking", Icon: Eye, label: "Dating preferences", value: `${profile.age_min}–${profile.age_max >= 80 ? "80+" : profile.age_max}` },
    { key: "location", Icon: MapPin, label: "Location", value: profile.city ?? "Current location" },
  ];
  const qRows: { key: string; Icon: typeof Camera; label: string; section: string }[] = [
    { key: "q-chess", Icon: Swords, label: "Chess personality", section: "chess" },
    { key: "q-fun", Icon: Smile, label: "Fun questions", section: "fun" },
    { key: "q-dating", Icon: Brain, label: "Dating questions", section: "dating" },
  ];

  return (
    <div>
      <TopBar
        title="Profile"
        right={
          <button aria-label="Settings" onClick={() => navigate("/settings")} className="grid size-10 place-items-center rounded-full text-fog hover:bg-white/5">
            <Settings className="size-5" />
          </button>
        }
      />
      <main className="px-4 pb-8">
        <div className="mt-4 flex animate-rise items-center gap-4">
          <button onClick={() => navigate("/me/edit/photos")} className="relative size-24 shrink-0 overflow-hidden rounded-[28px] ring-2 ring-gold/60 ring-offset-2 ring-offset-ink-950">
            <Photo path={profile.photos[0]} className="absolute inset-0" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-semibold">
              {profile.first_name}, {ageFrom(profile.birthdate)}
            </h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-mist">
              <MapPin className="size-3.5" /> {profile.city ?? "Location set"}
            </div>
            <button onClick={() => navigate(`/u/${profile.id}`)} className="mt-2 text-sm font-semibold text-gold">
              Preview my profile →
            </button>
          </div>
        </div>

        <div className="card mt-5 grid grid-cols-3 divide-x divide-white/5 py-4 text-center">
          <div>
            <div className="text-2xl font-semibold text-gold">{profile.app_rating}</div>
            <div className="text-xs text-mist">Rating</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{stats?.games ?? "–"}</div>
            <div className="text-xs text-mist">Games</div>
          </div>
          <div>
            <div className="text-2xl font-semibold">{stats ? `${stats.wins}–${stats.losses}–${stats.draws}` : "–"}</div>
            <div className="text-xs text-mist">W–L–D</div>
          </div>
        </div>

        {!profile.discoverable && (
          <button onClick={() => navigate("/settings")} className="mt-3 w-full rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-left text-sm">
            <span className="font-semibold text-gold">Your profile is hidden.</span> <span className="text-fog">New people can't find you. Tap to change.</span>
          </button>
        )}

        <SectionTitle>Your profile</SectionTitle>
        <div className="card divide-y divide-white/5">
          {rows.map(({ key, Icon, label, value }) => (
            <button key={key} onClick={() => navigate(`/me/edit/${key}`)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02]">
              <Icon className="size-5 text-mist" />
              <span className="flex-1 font-medium">{label}</span>
              <span className="max-w-[40%] truncate text-sm text-mist">{value}</span>
              <ChevronRight className="size-4 text-mist" />
            </button>
          ))}
        </div>

        <SectionTitle>Questionnaire</SectionTitle>
        <div className="card divide-y divide-white/5">
          {qRows.map(({ key, Icon, label, section }) => (
            <button key={key} onClick={() => navigate(`/me/edit/${key}`)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02]">
              <Icon className="size-5 text-mist" />
              <span className="flex-1 font-medium">{label}</span>
              {unanswered[section] ? (
                <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold">{unanswered[section]} to answer</span>
              ) : (
                <span className="text-sm text-mist">Done</span>
              )}
              <ChevronRight className="size-4 text-mist" />
            </button>
          ))}
        </div>
        <p className="mt-3 px-1 text-xs text-mist">Your answers power your compatibility scores. Elo never affects them.</p>
      </main>
    </div>
  );
}
