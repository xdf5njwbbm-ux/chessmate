import { useState } from "react";
import { api } from "../lib/api";
import { REPORT_REASONS } from "../lib/constants";
import { useToast } from "../state/toast";
import { Button, Sheet, Toggle } from "./ui";

export function ReportSheet({
  open,
  onClose,
  user,
  gameId,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  user: { id: string; first_name: string };
  gameId?: string | null;
  onBlocked?: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [block, setBlock] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={`Report ${user.first_name}`}>
      <p className="text-sm text-mist">Reports are confidential. {user.first_name} won't know who reported them.</p>
      <div className="mt-4 grid gap-2">
        {REPORT_REASONS.map((r) => (
          <button
            key={r.v}
            onClick={() => setReason(r.v)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
              reason === r.v ? "border-gold/80 bg-gold/10" : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {r.l}
          </button>
        ))}
      </div>
      <textarea
        className="field mt-3 min-h-24 resize-none text-sm"
        maxLength={1000}
        placeholder="Anything else we should know? (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      <Toggle checked={block} onChange={setBlock} label={`Also block ${user.first_name}`} hint="You won't see each other anywhere on Chessmate." />
      <Button
        className="mt-4 w-full"
        size="lg"
        variant="danger"
        disabled={!reason}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.report(user.id, reason!, details, gameId ?? null, block);
            toast({ title: "Thanks for letting us know", body: block ? `${user.first_name} has been blocked.` : "Our team will review this.", tone: "success" });
            onClose();
            if (block) onBlocked?.();
          } catch (e) {
            toast({ title: "Couldn't send report", body: (e as Error).message, tone: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        Submit report
      </Button>
    </Sheet>
  );
}
