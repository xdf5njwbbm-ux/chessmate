import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Bot, EyeOff } from "lucide-react";
import { loadSave, type BotMode, type BotSave } from "../lib/saved";
import { useSession } from "../state/session";

const MODES: BotMode[] = ["computer", "blindfold"];

/** Unfinished Stockfish games saved on this device, ready to pick up. */
function savedBotGames(uid: string | null) {
  return MODES.map((mode) => ({ mode, save: loadSave<BotSave>(uid, mode) })).filter((g): g is { mode: BotMode; save: BotSave } => !!g.save?.moves?.length);
}

export function ResumeBotGames({ className = "" }: { className?: string }) {
  const { uid } = useSession();
  const navigate = useNavigate();
  const [games] = useState(() => savedBotGames(uid));
  if (!games.length) return null;
  return (
    <div className={`grid gap-2 ${className}`}>
      {games.map(({ mode, save }) => (
        <button key={mode} onClick={() => navigate(`/play/${mode}`)} className="flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.08] px-4 py-3 text-left">
          {mode === "blindfold" ? <EyeOff className="size-5 shrink-0 text-gold" /> : <Bot className="size-5 shrink-0 text-accent" />}
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">Continue your {mode === "blindfold" ? "blindfold " : ""}game vs Stockfish</span>
            <span className="block text-mist">~{save.elo} · you're {save.color === "w" ? "white" : "black"} · move {Math.floor(save.moves.length / 2) + 1}</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-accent" />
        </button>
      ))}
    </div>
  );
}
