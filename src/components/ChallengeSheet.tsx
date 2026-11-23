import { useEffect, useState } from "react";
import { Swords, Trophy, Coffee } from "lucide-react";
import { api } from "../lib/api";
import { TIME_CONTROLS } from "../lib/constants";
import type { GameMode, TimeControl } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { useLive } from "../state/live";
import { Button, Sheet } from "./ui";

export function ChallengeSheet({
  open,
  onClose,
  user,
  theirFormats,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  user: { id: string; first_name: string };
  theirFormats?: TimeControl[];
  onSent?: () => void;
}) {
  const { profile } = useSession();
  const toast = useToast();
  const { refreshInbox } = useLive();
  const shared = (theirFormats ?? []).filter((f) => profile?.formats.includes(f));
  const [tc, setTc] = useState<TimeControl>(shared[0] ?? theirFormats?.[0] ?? "blitz5");
  const [mode, setMode] = useState<GameMode>("casual");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTc(shared[0] ?? theirFormats?.[0] ?? "blitz5");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    setBusy(true);
    try {
      await api.sendChallenge(user.id, tc, mode);
      toast({ title: `Challenge sent to ${user.first_name}`, body: "We'll let you know when they respond.", tone: "success" });
      refreshInbox();
      onSent?.();
      onClose();
    } catch (e) {
      toast({ title: "Couldn't send challenge", body: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Challenge ${user.first_name}`}>
      <p className="text-sm text-mist">Pick a time control. {user.first_name} has 24 hours to accept.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {TIME_CONTROLS.map((t) => (
          <button
            key={t.v}
            onClick={() => setTc(t.v)}
            className={`relative rounded-2xl border px-4 py-3 text-left transition-all ${
              t.v === "correspondence" ? "col-span-2" : ""
            } ${tc === t.v ? "border-gold/80 bg-gold/10" : "border-white/10 bg-white/[0.03]"}`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-mist">{t.group}</div>
            <div className="mt-0.5 font-semibold">{t.short}</div>
            {theirFormats?.includes(t.v) && (
              <span className="absolute right-3 top-3 rounded-full bg-electric/20 px-2 py-0.5 text-[10px] font-bold text-electric-soft">
                {shared.includes(t.v) ? "YOU BOTH" : "THEIR FAVE"}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-white/[0.04] p-1">
        {(
          [
            { v: "casual", l: "Casual", Icon: Coffee, hint: "Just for fun" },
            { v: "competitive", l: "Competitive", Icon: Trophy, hint: "Rating on the line" },
          ] as const
        ).map(({ v, l, Icon, hint }) => (
          <button
            key={v}
            onClick={() => setMode(v)}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all ${mode === v ? "bg-ink-700 shadow" : "text-mist"}`}
          >
            <Icon className={`size-5 ${mode === v ? "text-gold" : ""}`} />
            <span>
              <span className="block text-sm font-semibold">{l}</span>
              <span className="block text-xs text-mist">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <Button size="lg" className="mt-6 w-full" loading={busy} onClick={send}>
        <Swords className="size-5" /> Send challenge
      </Button>
    </Sheet>
  );
}
