import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { CapturedRow } from "./Board";
import { Initials, LevelBadge } from "./ui";
import { clock } from "../lib/format";

export function PlayerBar({
  name,
  sub,
  level,
  ai,
  online,
  captured,
  plus,
  color,
  ms,
  ticking,
  perMove,
  note,
}: {
  name: string;
  sub?: string;
  level?: string;
  ai?: boolean;
  online?: boolean;
  captured: string[];
  plus: number;
  color: "w" | "b";
  ms?: number | null;
  ticking?: boolean;
  perMove?: boolean;
  note?: string | null;
}) {
  const low = ms != null && !perMove && ms < 20_000;
  return (
    <div className="flex items-center gap-3 py-2">
      {ai ? (
        <div className="grid size-10 place-items-center rounded-full bg-white/[0.07]"><Bot className="size-5 text-accent" /></div>
      ) : (
        <Initials name={name} size={40} online={online} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span className={`size-3 shrink-0 rounded-full border ${color === "w" ? "border-white/40 bg-white" : "border-white/30 bg-ink-950"}`} />
          {level && <LevelBadge level={level} />}
          {note && <span className="text-xs font-semibold text-gold">{note}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-mist">
          {sub && <span className="shrink-0">{sub}</span>}
          <CapturedRow pieces={captured} plus={plus} color={color === "w" ? "b" : "w"} />
        </div>
      </div>
      {ms != null && (
        <div className={`min-w-[88px] rounded-xl px-3 py-1.5 text-right font-mono text-xl font-semibold tabular-nums transition-colors ${ticking ? (low ? "bg-danger text-white" : "bg-white text-ink-950") : "bg-white/[0.06] text-fog"}`}>
          {clock(ms, perMove)}
        </div>
      )}
    </div>
  );
}

export function MoveList({ sans, onPick, active }: { sans: string[]; onPick?: (ply: number) => void; active?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll the strip horizontally only, so the page itself never jumps
    const el = box.current;
    if (!el) return;
    const target = active == null ? null : el.querySelector<HTMLElement>('[data-active="true"]');
    if (!target) el.scrollLeft = el.scrollWidth;
    else el.scrollLeft = Math.max(0, target.offsetLeft - el.clientWidth / 2);
  }, [sans.length, active]);
  const pairs: { n: number; w?: string; b?: string }[] = [];
  sans.forEach((s, i) => {
    if (i % 2 === 0) pairs.push({ n: i / 2 + 1, w: s });
    else pairs[pairs.length - 1].b = s;
  });
  if (!pairs.length) return <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm text-mist">No moves yet.</div>;
  const cell = (ply: number, s?: string) =>
    s ? (
      <button
        data-active={active === ply}
        onClick={() => onPick?.(ply)}
        className={`rounded px-1 font-medium ${active === ply ? "bg-accent/25 text-white" : onPick ? "hover:bg-white/10" : ""}`}
      >
        {s}
      </button>
    ) : null;
  return (
    <div ref={box} data-moves={sans.join(" ")} className="no-scrollbar relative flex items-center gap-3 overflow-x-auto rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm">
      {pairs.map((p) => (
        <span key={p.n} className="flex shrink-0 gap-1">
          <span className="text-faint">{p.n}.</span>
          {cell((p.n - 1) * 2, p.w)}
          {cell((p.n - 1) * 2 + 1, p.b)}
        </span>
      ))}
    </div>
  );
}
