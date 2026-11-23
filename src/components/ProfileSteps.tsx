import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Camera, Check, LocateFixed, Plus, Star, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { api, friendly } from "../lib/api";
import { deletePhotos, uploadPhoto } from "../lib/photos";
import { EXPERIENCE, GENDERS, INTENTIONS, INTERESTS, TIME_CONTROLS } from "../lib/constants";
import { ageFrom, maxBirthdate } from "../lib/format";
import type { Experience, Gender, Intentions, Profile, TimeControl } from "../lib/types";
import { useSession } from "../state/session";
import { Button, Chip, Photo, RangeSlider, Spinner, Toggle } from "./ui";

export type StepProps = { cta: string; onDone: () => void };

export function useSaveProfile() {
  const { uid, setProfile } = useSession();
  return async (patch: Partial<Profile>) => {
    const { data, error } = await supabase.from("profiles").update(patch).eq("id", uid!).select("*").single();
    if (error) throw new Error(friendly(error.message));
    setProfile(data as Profile);
    return data as Profile;
  };
}

function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function Footer({ cta, disabled, busy, error, onClick, hint }: { cta: string; disabled?: boolean; busy?: boolean; error?: string | null; onClick: () => void; hint?: ReactNode }) {
  return (
    <div className="safe-bottom sticky bottom-0 -mx-5 mt-8 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-5 pb-4 pt-8">
      {error && <div className="mb-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-[#ffb3b3]">{error}</div>}
      {hint && <div className="mb-3 text-center text-sm text-mist">{hint}</div>}
      <Button size="lg" className="w-full" disabled={disabled} loading={busy} onClick={onClick}>
        {cta}
      </Button>
    </div>
  );
}

function Label({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-baseline justify-between">
      <span className="text-sm font-semibold text-fog">{children}</span>
      {aside && <span className="text-xs text-mist">{aside}</span>}
    </div>
  );
}

function OptionRow({ on, onClick, title, hint, lead }: { on: boolean; onClick: () => void; title: ReactNode; hint?: ReactNode; lead?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
        on ? "border-gold/70 bg-gold/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
      }`}
    >
      {lead && <span className="text-xl">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        {hint && <span className="mt-0.5 block text-sm text-mist">{hint}</span>}
      </span>
      <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${on ? "border-gold bg-gold text-ink-950" : "border-white/20"}`}>
        {on && <Check className="size-4" strokeWidth={3} />}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
export function StepBasics({ cta, onDone }: StepProps) {
  const { uid, profile, setProfile } = useSession();
  const save = useSaveProfile();
  const [name, setName] = useState(profile?.first_name ?? "");
  const [dob, setDob] = useState(profile?.birthdate ?? "");
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const { busy, error, run } = useRunner();
  const age = dob ? ageFrom(dob) : null;
  const tooYoung = !profile && age !== null && age < 18;
  const valid = name.trim().length > 0 && !!gender && (!!profile || (age !== null && age >= 18 && age < 110));

  const submit = () =>
    run(async () => {
      if (!profile) {
        const { data, error } = await supabase
          .from("profiles")
          .insert({ id: uid, first_name: name.trim(), birthdate: dob, gender })
          .select("*")
          .single();
        if (error) throw new Error(friendly(error.message));
        setProfile(data as Profile);
      } else {
        await save({ first_name: name.trim(), gender: gender! });
      }
      onDone();
    });

  return (
    <>
      <Label>First name</Label>
      <input className="field" value={name} maxLength={30} autoComplete="given-name" placeholder="Your first name" onChange={(e) => setName(e.target.value)} />

      <Label aside={profile ? "Can't be changed" : "You must be 18+"}>Date of birth</Label>
      {profile ? (
        <div className="field text-mist">{ageFrom(profile.birthdate)} years old</div>
      ) : (
        <input className="field [color-scheme:dark]" type="date" max={maxBirthdate()} min="1920-01-01" value={dob} onChange={(e) => setDob(e.target.value)} />
      )}
      {tooYoung && <p className="mt-2 text-sm text-[#ffb3b3]">Chessmate is only for people 18 and older.</p>}

      <Label>I am a</Label>
      <div className="grid gap-2">
        {GENDERS.map((g) => (
          <OptionRow key={g.v} on={gender === g.v} onClick={() => setGender(g.v)} title={g.l} />
        ))}
      </div>
      <Footer cta={cta} disabled={!valid} busy={busy} error={error} onClick={submit} />
    </>
  );
}

// ---------------------------------------------------------------------------
const KM_PER_MI = 1.609344;
export function StepLookingFor({ cta, onDone }: StepProps) {
  const { profile } = useSession();
  const save = useSaveProfile();
  const [into, setInto] = useState<Gender[]>(profile?.interested_in ?? []);
  const [ageMin, setAgeMin] = useState(profile?.age_min ?? 18);
  const [ageMax, setAgeMax] = useState(Math.min(profile?.age_max ?? 45, 80));
  const anywhereInit = (profile?.max_distance_km ?? 80) >= 20000;
  const [anywhere, setAnywhere] = useState(anywhereInit);
  const [miles, setMiles] = useState(anywhereInit ? 100 : Math.round((profile?.max_distance_km ?? 80) / KM_PER_MI));
  const { busy, error, run } = useRunner();

  return (
    <>
      <Label>Show me</Label>
      <div className="flex flex-wrap gap-2">
        {GENDERS.map((g) => (
          <Chip key={g.v} on={into.includes(g.v)} onClick={() => setInto(into.includes(g.v) ? into.filter((x) => x !== g.v) : [...into, g.v])}>
            {g.plural}
          </Chip>
        ))}
      </div>

      <Label aside={`${ageMin} – ${ageMax >= 80 ? "80+" : ageMax}`}>Age range</Label>
      <div className="card px-4 py-5">
        <RangeSlider
          label="Age"
          min={18}
          max={80}
          low={ageMin}
          high={ageMax}
          onChange={(lo, hi) => {
            setAgeMin(lo);
            setAgeMax(hi);
          }}
        />
      </div>

      <Label aside={anywhere ? "Anywhere" : `Within ${miles} mi`}>Distance</Label>
      <div className="card px-4 py-4">
        <input className="range" type="range" min={5} max={250} step={5} value={miles} disabled={anywhere} onChange={(e) => setMiles(+e.target.value)} />
        <div className="mt-2">
          <Toggle checked={anywhere} onChange={setAnywhere} label="Anywhere" hint="Great for correspondence games" />
        </div>
      </div>

      <Footer
        cta={cta}
        disabled={!into.length}
        busy={busy}
        error={error}
        onClick={() =>
          run(async () => {
            await save({
              interested_in: into,
              age_min: ageMin,
              age_max: ageMax >= 80 ? 99 : ageMax,
              max_distance_km: anywhere ? 20000 : Math.round(miles * KM_PER_MI),
            });
            onDone();
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export function StepLocation({ cta, onDone }: StepProps) {
  const { profile } = useSession();
  const save = useSaveProfile();
  const [city, setCity] = useState(profile?.city ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null,
  );
  const [locating, setLocating] = useState(false);
  const { busy, error, setError, run } = useRunner();

  const locate = () => {
    if (!("geolocation" in navigator)) return setError("Your browser can't share location. Enter your city instead.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 });
        setLocating(false);
        setError(null);
      },
      () => {
        setLocating(false);
        setError("We couldn't get your location. You can type your city instead.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 },
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={locate}
        className={`mt-6 flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all ${
          coords ? "border-mint/40 bg-mint/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
        }`}
      >
        <span className={`grid size-11 place-items-center rounded-2xl ${coords ? "bg-mint/20 text-mint" : "bg-electric/15 text-electric-soft"}`}>
          {locating ? <Spinner className="size-5 text-electric-soft" /> : coords ? <Check className="size-5" /> : <LocateFixed className="size-5" />}
        </span>
        <span>
          <span className="block font-semibold">{coords ? "Location set" : "Use my current location"}</span>
          <span className="block text-sm text-mist">{coords ? "Approximate, to about a kilometer" : "Most accurate distances"}</span>
        </span>
      </button>

      <Label>City</Label>
      <input className="field" placeholder="e.g. Jacksonville, FL" value={city} maxLength={60} onChange={(e) => setCity(e.target.value)} />
      <p className="mt-3 text-sm text-mist">Others only see your city and a rounded distance, never your exact location.</p>

      <Footer
        cta={cta}
        disabled={!city.trim() && !coords}
        busy={busy}
        error={error}
        onClick={() =>
          run(async () => {
            await save({ city: city.trim() || null, lat: coords?.lat ?? null, lng: coords?.lng ?? null });
            onDone();
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export function StepPhotos({ cta, onDone }: StepProps) {
  const { uid, profile } = useSession();
  const save = useSaveProfile();
  const [photos, setPhotos] = useState<string[]>(profile?.photos ?? []);
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const { busy, error, setError, run } = useRunner();

  const persist = async (next: string[]) => {
    setPhotos(next);
    await save({ photos: next });
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, 6 - photos.length);
    setUploading(list.length);
    let next = [...photos];
    for (const f of list) {
      try {
        const path = await uploadPhoto(uid!, f);
        next = [...next, path];
        await persist(next);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((u) => u - 1);
      }
    }
    if (input.current) input.current.value = "";
  };

  const remove = (path: string) =>
    run(async () => {
      await persist(photos.filter((p) => p !== path));
      deletePhotos([path]).catch(() => {});
    });
  const makeMain = (path: string) => run(() => persist([path, ...photos.filter((p) => p !== path)]));

  const slots = Array.from({ length: 6 }, (_, i) => photos[i] ?? null);
  const canAdd = photos.length + uploading < 6;

  return (
    <>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {slots.map((p, i) => {
          const isUploadingSlot = !p && i < photos.length + uploading;
          return (
            <div key={p ?? `empty-${i}`} className={`relative ${i === 0 ? "col-span-2 row-span-2" : "aspect-[4/5]"}`}>
              <div className="relative size-full overflow-hidden rounded-2xl">
                {p ? (
                  <>
                    <Photo path={p} className="absolute inset-0" />
                    <button
                      aria-label="Remove photo"
                      onClick={() => remove(p)}
                      className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur"
                    >
                      <X className="size-4" />
                    </button>
                    {i === 0 ? (
                      <span className="absolute bottom-2 left-2 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-ink-950">Main</span>
                    ) : (
                      <button
                        aria-label="Make main photo"
                        onClick={() => makeMain(p)}
                        className="absolute bottom-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-gold backdrop-blur"
                      >
                        <Star className="size-4" />
                      </button>
                    )}
                  </>
                ) : isUploadingSlot ? (
                  <div className="skeleton absolute inset-0 grid place-items-center">
                    <Spinner className="size-5" />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canAdd}
                    onClick={() => input.current?.click()}
                    className="absolute inset-0 grid place-items-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] text-mist transition hover:border-gold/50 hover:text-gold"
                  >
                    {i === 0 ? (
                      <span className="flex flex-col items-center gap-2">
                        <Camera className="size-8" />
                        <span className="text-sm font-medium">Add your main photo</span>
                      </span>
                    ) : (
                      <Plus className="size-6" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-mist">Clear, recent photos of you, with no one else in them, get the most games. Tap ★ to set your main photo.</p>
      <Footer
        cta={cta}
        disabled={photos.length < 3 || uploading > 0}
        busy={busy}
        error={error}
        hint={photos.length < 3 ? `Add ${3 - photos.length} more photo${3 - photos.length === 1 ? "" : "s"}` : undefined}
        onClick={onDone}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export function StepAbout({ cta, onDone }: StepProps) {
  const { profile } = useSession();
  const save = useSaveProfile();
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [intent, setIntent] = useState<Intentions | null>(profile?.intentions ?? null);
  const { busy, error, run } = useRunner();
  return (
    <>
      <Label aside={`${bio.length}/500`}>Bio</Label>
      <textarea
        className="field min-h-32 resize-none leading-relaxed"
        maxLength={500}
        placeholder="Tell people what makes you, you. Favorite way to spend a Sunday? Best checkmate you've ever pulled off?"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />
      <Label>I'm looking for</Label>
      <div className="grid gap-2">
        {INTENTIONS.map((i) => (
          <OptionRow key={i.v} on={intent === i.v} onClick={() => setIntent(i.v)} title={i.l} lead={i.emoji} />
        ))}
      </div>
      <Footer
        cta={cta}
        disabled={!intent || bio.trim().length < 10}
        busy={busy}
        error={error}
        hint={bio.trim().length < 10 ? "Write at least a sentence about yourself" : undefined}
        onClick={() =>
          run(async () => {
            await save({ bio: bio.trim(), intentions: intent! });
            onDone();
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export function StepChess({ cta, onDone }: StepProps) {
  const { profile } = useSession();
  const save = useSaveProfile();
  const [exp, setExp] = useState<Experience | null>(profile?.experience ?? null);
  const [noRating, setNoRating] = useState(profile ? profile.elo == null && !!profile.experience : false);
  const [elo, setElo] = useState(profile?.elo ? String(profile.elo) : "");
  const [formats, setFormats] = useState<TimeControl[]>(profile?.formats ?? []);
  const { busy, error, run } = useRunner();
  const eloNum = Number(elo);
  const eloValid = noRating || (elo !== "" && Number.isInteger(eloNum) && eloNum >= 100 && eloNum <= 3500);

  return (
    <>
      <Label>Experience</Label>
      <div className="grid gap-2">
        {EXPERIENCE.map((e) => (
          <OptionRow key={e.v} on={exp === e.v} onClick={() => setExp(e.v)} title={e.l} hint={e.hint} />
        ))}
      </div>

      <Label aside="Chess.com / Lichess / FIDE">Elo rating</Label>
      <input
        className="field"
        inputMode="numeric"
        placeholder="e.g. 1200"
        value={noRating ? "" : elo}
        disabled={noRating}
        onChange={(e) => setElo(e.target.value.replace(/\D/g, "").slice(0, 4))}
      />
      {!noRating && elo !== "" && !eloValid && <p className="mt-2 text-sm text-[#ffb3b3]">Enter a rating between 100 and 3500.</p>}
      <div className="mt-1">
        <Toggle checked={noRating} onChange={setNoRating} label="I don't have a rating yet" hint="No problem. You'll get a Chessmate rating as you play." />
      </div>

      <Label>Favorite formats</Label>
      <div className="flex flex-wrap gap-2">
        {TIME_CONTROLS.map((t) => (
          <Chip key={t.v} on={formats.includes(t.v)} onClick={() => setFormats(formats.includes(t.v) ? formats.filter((x) => x !== t.v) : [...formats, t.v])}>
            {t.l}
          </Chip>
        ))}
      </div>

      <Footer
        cta={cta}
        disabled={!exp || !eloValid || !formats.length}
        busy={busy}
        error={error}
        onClick={() =>
          run(async () => {
            await save({ experience: exp!, elo: noRating ? null : eloNum, formats });
            onDone();
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export function StepInterests({ cta, onDone }: StepProps) {
  const { profile } = useSession();
  const save = useSaveProfile();
  const [picked, setPicked] = useState<string[]>(profile?.interests ?? []);
  const { busy, error, run } = useRunner();
  const toggle = (i: string) =>
    setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : picked.length >= 12 ? picked : [...picked, i]);
  return (
    <>
      <Label aside={`${picked.length}/12`}>Interests</Label>
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((i) => (
          <Chip key={i} on={picked.includes(i)} onClick={() => toggle(i)}>
            {i}
          </Chip>
        ))}
      </div>
      <Footer
        cta={cta}
        disabled={picked.length < 3}
        busy={busy}
        error={error}
        hint={picked.length < 3 ? `Pick ${3 - picked.length} more` : undefined}
        onClick={() =>
          run(async () => {
            await save({ interests: picked });
            onDone();
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export function QuestionSection({ section, cta, onDone }: StepProps & { section: "chess" | "fun" | "dating" }) {
  const { uid, questions } = useSession();
  const qs = questions.filter((q) => q.section === section);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);
  const { busy, error, setError, run } = useRunner();

  useEffect(() => {
    if (!uid) return;
    api
      .myAnswers(uid)
      .then((a) => setAnswers(a))
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, [uid, setError]);

  if (!loaded || !qs.length) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  const pick = (qid: string, v: string, multi: boolean, max: number) => {
    setAnswers((a) => {
      const cur = a[qid] ?? [];
      if (!multi) return { ...a, [qid]: [v] };
      if (cur.includes(v)) return { ...a, [qid]: cur.filter((x) => x !== v) };
      if (cur.length >= max) return a;
      return { ...a, [qid]: [...cur, v] };
    });
  };
  const answered = qs.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;

  return (
    <>
      <div className="mt-6 grid gap-4">
        {qs.map((q, idx) => (
          <div key={q.id} className="card animate-rise p-4" style={{ animationDelay: `${idx * 40}ms` }}>
            <div className="mb-3 font-semibold leading-snug">{q.prompt}</div>
            {q.kind === "multi" ? (
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <Chip key={o.v} on={answers[q.id]?.includes(o.v)} onClick={() => pick(q.id, o.v, true, q.max_select)}>
                    {o.l}
                  </Chip>
                ))}
              </div>
            ) : (
              <div className={`grid gap-2 ${q.options.length <= 3 && q.options.every((o) => o.l.length < 14) ? "grid-cols-3" : ""}`}>
                {q.options.map((o) => {
                  const on = answers[q.id]?.[0] === o.v;
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => pick(q.id, o.v, false, 1)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                        on ? "border-gold/80 bg-gold/15 text-white" : "border-white/10 bg-white/[0.03] text-fog hover:bg-white/[0.06]"
                      }`}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <Footer
        cta={cta}
        disabled={answered < qs.length}
        busy={busy}
        error={error}
        hint={answered < qs.length ? `${answered} of ${qs.length} answered` : undefined}
        onClick={() =>
          run(async () => {
            const mine = Object.fromEntries(qs.map((q) => [q.id, answers[q.id] ?? []]));
            await api.saveAnswers(uid!, mine);
            onDone();
          })
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
export type StepDef = { key: string; title: string; subtitle: string; Component: ComponentType<StepProps> };

export const PROFILE_STEPS: StepDef[] = [
  { key: "basics", title: "Let's start with you", subtitle: "This is how you'll appear to other players.", Component: StepBasics },
  { key: "looking", title: "Who would you like to meet?", subtitle: "You can change this anytime.", Component: StepLookingFor },
  { key: "location", title: "Where are you?", subtitle: "We use this to show you people nearby.", Component: StepLocation },
  { key: "photos", title: "Show them your best side", subtitle: "Add 3 to 6 photos. The first one is your main photo.", Component: StepPhotos },
  { key: "about", title: "About you", subtitle: "A few lines and what you're hoping to find.", Component: StepAbout },
  { key: "chess", title: "Your chess", subtitle: "Your rating helps you find good opponents. It never affects compatibility.", Component: StepChess },
  { key: "interests", title: "What are you into?", subtitle: "Pick at least 3. Shared interests boost your compatibility.", Component: StepInterests },
  { key: "q-chess", title: "Your chess personality", subtitle: "There are no wrong answers. Except the Bongcloud.", Component: (p) => <QuestionSection section="chess" {...p} /> },
  { key: "q-fun", title: "A few fun ones", subtitle: "These say a lot about how you'd be across the board.", Component: (p) => <QuestionSection section="fun" {...p} /> },
  { key: "q-dating", title: "Dating & relationships", subtitle: "Last step. This is where compatibility really comes from.", Component: (p) => <QuestionSection section="dating" {...p} /> },
];
