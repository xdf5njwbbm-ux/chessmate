import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Compass } from "lucide-react";
import { api } from "../lib/api";
import { EXPERIENCE, INTENTIONS } from "../lib/constants";
import type { Card, Experience, Filters, Intentions } from "../lib/types";
import { useSession } from "../state/session";
import { Button, Chip, EmptyState, Logo, RangeSlider, Sheet } from "../components/ui";
import { ProfileCard, ProfileCardSkeleton } from "../components/ProfileCard";
import { ChallengeSheet } from "../components/ChallengeSheet";

const PAGE = 15;
const KM_PER_MI = 1.609344;
const STORE_KEY = "chessmate.filters.v1";

function loadFilters(): Filters {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function storeFilters(f: Filters) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(f));
  } catch {
    /* storage unavailable */
  }
}

const SORTS = [
  { v: "compat", l: "For you" },
  { v: "elo", l: "Your level" },
  { v: "active", l: "Active now" },
] as const;

export default function Discover() {
  const { profile } = useSession();
  const [filters, setFilters] = useState<Filters>(loadFilters);
  const [items, setItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [challenge, setChallenge] = useState<Card | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const load = useCallback(
    async (reset: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const offset = reset ? 0 : items.length;
        const page = await api.discover(filters, offset, PAGE);
        setItems((prev) => (reset ? page : [...prev, ...page.filter((p) => !prev.some((x) => x.id === p.id))]));
        setDone(page.length < PAGE);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [filters, items.length],
  );

  useEffect(() => {
    storeFilters(filters);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !done && !loadingRef.current && items.length) load(false);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [done, items.length, load]);

  const activeFilters =
    (filters.max_distance_km != null ? 1 : 0) +
    (filters.age_min != null || filters.age_max != null ? 1 : 0) +
    (filters.elo_min != null || filters.elo_max != null ? 1 : 0) +
    (filters.experience?.length ? 1 : 0) +
    (filters.intentions?.length ? 1 : 0) +
    (filters.min_compat ? 1 : 0);

  return (
    <div>
      <header className="glass safe-top sticky top-0 z-30 border-b border-white/5">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo size={26} />
          <button
            onClick={() => setShowFilters(true)}
            className="relative grid size-10 place-items-center rounded-full bg-white/5 text-fog hover:text-white"
            aria-label="Filters"
          >
            <SlidersHorizontal className="size-5" />
            {activeFilters > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid size-[18px] place-items-center rounded-full bg-gold text-[10px] font-bold text-ink-950">
                {activeFilters}
              </span>
            )}
          </button>
        </div>
        <div className="flex gap-1 px-4 pb-3">
          {SORTS.map((s) => (
            <button
              key={s.v}
              onClick={() => setFilters({ ...filters, sort: s.v })}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
                (filters.sort ?? "compat") === s.v ? "bg-white text-ink-950" : "text-mist hover:text-white"
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>
      </header>

      <main className="grid gap-4 px-4 pt-4">
        {items.map((c, i) => (
          <ProfileCard key={c.id} card={c} index={i} onChallenge={() => setChallenge(c)} />
        ))}
        {loading && (items.length ? <ProfileCardSkeleton /> : [0, 1].map((i) => <ProfileCardSkeleton key={i} />))}
        {!loading && error && (
          <EmptyState title="Couldn't load players" body={error} action={<Button variant="secondary" onClick={() => load(true)}>Try again</Button>} />
        )}
        {!loading && !error && !items.length && (
          <EmptyState
            icon={<Compass className="size-8" />}
            title="No one new right now"
            body={activeFilters ? "Try widening your filters to see more people." : "New players join every day. Check back soon or widen your distance."}
            action={
              activeFilters ? (
                <Button variant="secondary" onClick={() => setFilters({ sort: filters.sort })}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}
        {!loading && done && items.length > 0 && <p className="py-8 text-center text-sm text-mist">You've seen everyone for now ♟&#xFE0E;</p>}
        <div ref={sentinel} />
      </main>

      <FilterSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        value={filters}
        myElo={profile?.elo ?? profile?.app_rating ?? 1200}
        onApply={(f) => {
          setFilters(f);
          setShowFilters(false);
        }}
      />
      {challenge && (
        <ChallengeSheet open onClose={() => setChallenge(null)} user={challenge} theirFormats={challenge.formats} />
      )}
    </div>
  );
}

function FilterSheet({
  open,
  onClose,
  value,
  onApply,
  myElo,
}: {
  open: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (f: Filters) => void;
  myElo: number;
}) {
  const { profile } = useSession();
  const [f, setF] = useState<Filters>(value);
  useEffect(() => {
    if (open) setF(value);
  }, [open, value]);

  const distMi = f.max_distance_km != null ? Math.round(f.max_distance_km / KM_PER_MI) : Math.round((profile?.max_distance_km ?? 80) / KM_PER_MI);
  const ageMin = f.age_min ?? profile?.age_min ?? 18;
  const ageMax = Math.min(f.age_max ?? profile?.age_max ?? 60, 80);
  const eloPreset =
    f.elo_min == null && f.elo_max == null ? "any" : f.elo_min === myElo - 200 && f.elo_max === myElo + 200 ? "near" : "custom";

  const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="grid gap-6">
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-bold text-white">Distance</span>
            <span className="font-semibold text-white">{distMi >= 12000 ? "Anywhere" : `Within ${distMi} mi`}</span>
          </div>
          <input
            className="range"
            type="range"
            min={5}
            max={300}
            step={5}
            value={Math.min(distMi, 300)}
            onChange={(e) => setF({ ...f, max_distance_km: Math.round(+e.target.value * KM_PER_MI) })}
          />
        </div>

        <div>
          <div className="mb-3 flex justify-between text-sm">
            <span className="font-bold text-white">Age</span>
            <span className="font-semibold text-white">
              {ageMin} – {ageMax >= 80 ? "80+" : ageMax}
            </span>
          </div>
          <RangeSlider
            label="Age"
            min={18}
            max={80}
            low={ageMin}
            high={ageMax}
            onChange={(lo, hi) => setF({ ...f, age_min: lo, age_max: hi >= 80 ? 99 : hi })}
          />
        </div>

        <div>
          <div className="mb-2 text-sm font-bold text-white">Elo rating</div>
          <div className="flex flex-wrap gap-2">
            <Chip on={eloPreset === "any"} onClick={() => setF({ ...f, elo_min: null, elo_max: null })}>
              Any
            </Chip>
            <Chip on={eloPreset === "near"} onClick={() => setF({ ...f, elo_min: myElo - 200, elo_max: myElo + 200 })}>
              Near mine (±200)
            </Chip>
            <Chip on={eloPreset === "custom"} onClick={() => setF({ ...f, elo_min: f.elo_min ?? 800, elo_max: f.elo_max ?? 1600 })}>
              Custom
            </Chip>
          </div>
          {eloPreset === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input className="field" inputMode="numeric" placeholder="Min" value={f.elo_min ?? ""} onChange={(e) => setF({ ...f, elo_min: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} />
              <input className="field" inputMode="numeric" placeholder="Max" value={f.elo_max ?? ""} onChange={(e) => setF({ ...f, elo_max: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} />
            </div>
          )}
          <p className="mt-2 text-xs font-medium text-white">Elo only helps find good opponents. It never changes compatibility scores.</p>
        </div>

        <div>
          <div className="mb-2 text-sm font-bold text-white">Chess experience</div>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE.map((e) => (
              <Chip key={e.v} on={f.experience?.includes(e.v)} onClick={() => setF({ ...f, experience: toggle<Experience>(f.experience, e.v) })}>
                {e.l}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-bold text-white">Looking for</div>
          <div className="flex flex-wrap gap-2">
            {INTENTIONS.map((i) => (
              <Chip key={i.v} on={f.intentions?.includes(i.v)} onClick={() => setF({ ...f, intentions: toggle<Intentions>(f.intentions, i.v) })}>
                {i.emoji} {i.short}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-bold text-white">Minimum compatibility</span>
            <span className="font-semibold text-white">{f.min_compat ? `${f.min_compat}%+` : "Any"}</span>
          </div>
          <input className="range" type="range" min={0} max={90} step={5} value={f.min_compat ?? 0} onChange={(e) => setF({ ...f, min_compat: +e.target.value })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => onApply({ sort: value.sort })}>
            Reset
          </Button>
          <Button onClick={() => onApply(f)}>Show results</Button>
        </div>
      </div>
    </Sheet>
  );
}
