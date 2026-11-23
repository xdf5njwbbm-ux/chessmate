import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import type { Mini } from "../lib/types";
import { useSession } from "../state/session";
import { Avatar, Button } from "./ui";

export function MatchCelebration({ user, onClose }: { user: Mini; onClose: () => void }) {
  const navigate = useNavigate();
  const { profile } = useSession();
  return createPortal(
    <div className="fixed inset-0 z-[55] grid animate-fade-in place-items-center bg-ink-950/90 px-6 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-sm text-center">
        <div className="mb-8 flex items-center justify-center">
          <div className="animate-pop" style={{ animationDelay: "60ms" }}>
            <Avatar path={profile?.photos[0]} name={profile?.first_name} size={112} ring />
          </div>
          <div className="z-10 -mx-4 grid size-14 animate-pop place-items-center rounded-full bg-rose shadow-[0_0_40px_rgba(255,107,139,0.6)]" style={{ animationDelay: "220ms" }}>
            <Heart className="size-7 fill-white text-white" />
          </div>
          <div className="animate-pop" style={{ animationDelay: "140ms" }}>
            <Avatar path={user.photo} name={user.first_name} size={112} ring />
          </div>
        </div>
        <h2 className="animate-rise font-display text-5xl font-semibold" style={{ animationDelay: "250ms" }}>
          It's a <span className="gold-text">match</span>
        </h2>
        <p className="mt-3 animate-rise text-fog" style={{ animationDelay: "320ms" }}>
          You and {user.first_name} both want to see where this goes.
        </p>
        <p className="mt-1 animate-rise text-sm text-mist" style={{ animationDelay: "360ms" }}>
          Messaging is coming soon. Until then, keep the conversation going over the board.
        </p>
        <div className="mt-8 grid animate-rise gap-3" style={{ animationDelay: "420ms" }}>
          <Button
            size="lg"
            onClick={() => {
              onClose();
              navigate(`/u/${user.id}`);
            }}
          >
            View {user.first_name}'s profile
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Keep playing
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
