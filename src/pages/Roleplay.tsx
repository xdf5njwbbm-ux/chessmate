import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, MessagesSquare } from "lucide-react";
import { useRp } from "../state/rpStore";
import { PageHeader, Spinner } from "../components/ui";
import { convoSummary } from "../lib/roleplay/progress";

const RoleplayChat = lazy(() => import("../components/RoleplayChat"));

/** Talk with a Russian partner without a game — the same conversation that runs between moves. */
export default function Roleplay() {
  const navigate = useNavigate();
  const { mem, s } = useRp();
  const sum = convoSummary(mem);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/practice" title="Real conversations" subtitle="A Russian speaker who remembers what you said, asks follow-ups and corrects you gently. The same conversation continues between moves in your games." />
      {sum.exchanges > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="card px-2 py-3"><div className="font-display text-xl font-semibold">{sum.exchanges}</div><div className="text-[11px] text-mist">answers</div></div>
          <div className="card px-2 py-3"><div className="font-display text-xl font-semibold">{sum.avg}</div><div className="text-[11px] text-mist">avg score</div></div>
          <div className="card px-2 py-3"><div className="font-display text-xl font-semibold">{sum.level ?? s?.st.level ?? "—"}</div><div className="text-[11px] text-mist">talk level</div></div>
        </div>
      )}
      <Suspense fallback={<div className="grid place-items-center py-10"><Spinner /></div>}>
        <RoleplayChat />
      </Suspense>
      <button onClick={() => navigate("/play/solo")} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left hover:bg-white/[0.04]">
        <Crown className="size-5 shrink-0 text-gold" />
        <span className="flex-1 text-sm text-fog">Keep talking while you play — in a game, choose <b>Talk</b> under “Between moves”.</span>
        <MessagesSquare className="size-4 text-mist" />
      </button>
    </div>
  );
}
