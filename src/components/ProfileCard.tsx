import { useNavigate } from "react-router-dom";
import { MapPin, Swords } from "lucide-react";
import type { Card } from "../lib/types";
import { INTENTIONS, PLAY_STYLES } from "../lib/constants";
import { miles } from "../lib/format";
import { CompatRing, Photo } from "./ui";

export function ProfileCard({ card, onChallenge, index = 0 }: { card: Card; onChallenge: () => void; index?: number }) {
  const navigate = useNavigate();
  const intent = INTENTIONS.find((i) => i.v === card.intentions);
  const where = miles(card.distance_km) ?? card.city;
  return (
    <article className="card animate-rise overflow-hidden" style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}>
      <button className="relative block aspect-[4/5] w-full text-left" onClick={() => navigate(`/u/${card.id}`)}>
        <Photo path={card.photos[0]} alt={card.first_name} className="absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-transparent" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {card.online && (
            <span className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
              <span className="size-2 rounded-full bg-mint" /> Online
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3">
          <CompatRing value={card.compat} size={58} />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-[32px] font-semibold leading-none tracking-tight">
            {card.first_name}
            <span className="ml-2 font-sans text-2xl font-normal text-fog">{card.age}</span>
          </h3>
          {where && (
            <div className="mt-1.5 flex items-center gap-1 text-sm text-fog">
              <MapPin className="size-3.5" /> {where}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="tag bg-white/10">
              <span className="text-gold">♞&#xFE0E;</span> {card.elo ? `${card.elo} Elo` : "Unrated"}
            </span>
            {card.play_style && <span className="tag bg-white/10">{PLAY_STYLES[card.play_style]}</span>}
            {intent && (
              <span className="tag bg-white/10">
                {intent.emoji} {intent.short}
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-3 p-3 pl-4">
        <p className="line-clamp-2 min-w-0 flex-1 text-sm text-mist">
          {card.shared_interests.length ? (
            <>
              You both like <span className="text-fog">{card.shared_interests.slice(0, 3).join(", ")}</span>
            </>
          ) : (
            card.bio || "New to Chessmate"
          )}
        </p>
        <button onClick={onChallenge} className="btn btn-electric h-10 shrink-0 px-4 text-sm">
          <Swords className="size-4" /> Challenge
        </button>
      </div>
    </article>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/5]" />
      <div className="flex items-center gap-3 p-4">
        <div className="skeleton h-4 flex-1 rounded" />
        <div className="skeleton h-10 w-28 rounded-full" />
      </div>
    </div>
  );
}
