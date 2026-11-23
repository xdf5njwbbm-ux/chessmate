import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle } from "lucide-react";
import { api } from "../lib/api";
import { ago } from "../lib/format";
import type { MatchItem } from "../lib/types";
import { Button, EmptyState, Photo, TopBar } from "../components/ui";

export default function Matches() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MatchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .matches()
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <TopBar title="Matches" />
      <main className="px-4 pb-6">
        {!items && !error && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton aspect-[3/4] rounded-3xl" />
            ))}
          </div>
        )}
        {error && <EmptyState title="Couldn't load matches" body={error} />}
        {items && items.length === 0 && (
          <EmptyState
            icon={<Heart className="size-8" />}
            title="No matches yet"
            body="Finish a game, then like your opponent. If they like you back, they'll show up here."
            action={<Button onClick={() => navigate("/discover")}>Find a game</Button>}
          />
        )}
        {items && items.length > 0 && (
          <>
            <div className="card mt-4 flex items-start gap-3 p-4">
              <MessageCircle className="mt-0.5 size-5 shrink-0 text-electric-soft" />
              <p className="text-sm text-fog">
                Messaging is coming in the next update. Until then, keep the spark going with a rematch.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {items.map((m, i) =>
                m.user ? (
                  <button
                    key={m.user.id}
                    onClick={() => navigate(`/u/${m.user!.id}`)}
                    className="relative aspect-[3/4] animate-rise overflow-hidden rounded-3xl text-left ring-1 ring-white/10"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <Photo path={m.user.photo} alt={m.user.first_name} className="absolute inset-0" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
                    {m.compat != null && (
                      <span className="glass absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold text-gold">{m.compat}%</span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="font-display text-xl font-semibold leading-tight">
                        {m.user.first_name}
                        <span className="ml-1.5 font-sans text-base font-normal text-fog">{m.user.age}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-mist">
                        {m.user.online && <span className="size-1.5 rounded-full bg-mint" />}
                        Matched {ago(m.created_at)}
                      </div>
                    </div>
                  </button>
                ) : null,
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
