import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Crown, LoaderCircle, Lock, X } from "lucide-react";
import type { RatingStatus } from "../lib/types";
import { ratingText } from "../lib/format";

type BtnVariant = "primary" | "secondary" | "gold" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const sizes = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-13 px-6 text-base" };
  return (
    <button {...rest} disabled={rest.disabled || loading} className={`btn btn-${variant} ${sizes[size]} ${className}`}>
      {loading ? <LoaderCircle className="size-5 animate-spin" /> : children}
    </button>
  );
}

export function IconButton({ label, children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} {...rest} className={`grid size-10 shrink-0 place-items-center rounded-xl text-fog transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40 ${className}`}>
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <LoaderCircle className={`size-6 animate-spin text-accent ${className}`} />;
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="size-7" />
    </div>
  );
}

export function BackButton({ to }: { to?: string }) {
  const navigate = useNavigate();
  return (
    <IconButton label="Back" onClick={() => (to ? navigate(to) : window.history.length > 1 ? navigate(-1) : navigate("/home"))}>
      <ChevronLeft className="size-5" />
    </IconButton>
  );
}

export function PageHeader({ title, subtitle, back, right }: { title: ReactNode; subtitle?: ReactNode; back?: boolean | string; right?: ReactNode }) {
  return (
    <header className="mb-6 flex items-start gap-2">
      {back && <BackButton to={typeof back === "string" ? back : undefined} />}
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight md:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-1 text-mist">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}

export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full animate-sheet-in md:animate-pop ${wide ? "md:max-w-2xl" : "md:max-w-lg"}`}>
        <div className="safe-bottom max-h-[90dvh] overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-900 shadow-2xl md:rounded-3xl">
          <div className="sticky top-0 z-10 bg-ink-900/95 px-5 pb-2 pt-3 backdrop-blur">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15 md:hidden" />
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-xl font-semibold">{title}</div>
              <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-xl bg-white/5 text-white hover:bg-white/10">
                <X className="size-5" />
              </button>
            </div>
          </div>
          <div className="px-5 pb-6 pt-2">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-3 text-left disabled:opacity-50">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-mist">{hint}</span>}
      </span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-white/15"}`} aria-hidden>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Chip({ on, onClick, children, disabled }: { on?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} data-on={!!on} className="chip disabled:opacity-40">
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: { value: T; onChange: (v: T) => void; options: { v: T; l: ReactNode }[]; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-lg font-semibold transition-colors ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"} ${value === o.v ? "bg-white/10 text-white" : "text-mist hover:text-fog"}`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, tone = "accent", className = "" }: { value: number; tone?: "accent" | "gold"; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08] ${className}`}>
      <div className={`h-full rounded-full transition-all duration-700 ${tone === "gold" ? "bg-gold" : "bg-accent"}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 6, tone = "accent", children }: { value: number; size?: number; stroke?: number; tone?: "accent" | "gold"; children?: ReactNode }) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.08)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tone === "gold" ? "var(--color-gold)" : "var(--color-accent)"} strokeWidth={stroke}
          strokeLinecap="round" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex animate-rise flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/5 text-accent">{icon}</div>}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {body && <p className="mt-2 max-w-sm text-mist">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3 first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">{children}</h2>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "accent" | "gold" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-mist">{label}</div>
      <div className={`mt-0.5 truncate text-2xl font-semibold tabular-nums tracking-tight ${tone === "gold" ? "text-gold" : tone === "accent" ? "text-accent-soft" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function Confirm({ open, onClose, title, body, confirmLabel, danger, onConfirm }: {
  open: boolean; onClose: () => void; title: string; body?: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <div className="text-mist">{body}</div>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}

export function Logo({ size = 28, full = true }: { size?: number; full?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={size} height={size} className="rounded-[26%]" />
      {full && (
        <span className="leading-none">
          <span className="block font-display font-semibold tracking-tight" style={{ fontSize: size * 0.62 }}>Russian Chess</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.28em] text-gold">Academy</span>
        </span>
      )}
    </span>
  );
}

export function Initials({ name, size = 40, online }: { name?: string | null; size?: number; online?: boolean }) {
  const letters = (name ?? "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="grid size-full place-items-center rounded-full bg-gradient-to-br from-ink-600 to-ink-750 font-semibold text-fog" style={{ fontSize: size * 0.38 }}>
        {letters}
      </div>
      {online && <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-ink-950 bg-accent" aria-label="Online" />}
    </div>
  );
}

export function LevelBadge({ level, className = "" }: { level: string; className?: string }) {
  return <span className={`inline-flex items-center rounded-md border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-soft ${className}`}>{level}</span>;
}

export function RatingBadge({ rating, status, placementLeft }: { rating: number | null | undefined; status: RatingStatus | string | null | undefined; placementLeft?: number }) {
  if (rating == null || status === "unrated") {
    return <span className="text-sm text-mist">{placementLeft ? `Unrated · ${placementLeft} placement game${placementLeft === 1 ? "" : "s"} left` : "Unrated"}</span>;
  }
  return (
    <span className="font-semibold tabular-nums">
      {ratingText(rating, status)}
      {status === "provisional" && <span className="ml-1 text-xs font-normal text-mist">provisional</span>}
    </span>
  );
}

export function PremiumLock({ title = "Part of Premium", body }: { title?: string; body?: ReactNode }) {
  return (
    <div className="card flex items-start gap-3 border-gold/25 p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold"><Lock className="size-4" /></div>
      <div>
        <div className="font-semibold text-gold-bright">{title}</div>
        <div className="mt-0.5 text-sm text-mist">{body ?? "Upgrade options will appear here once subscriptions launch."}</div>
      </div>
    </div>
  );
}

export function TierIcon({ tier, className = "size-5" }: { tier: "bronze" | "silver" | "gold"; className?: string }) {
  const color = tier === "gold" ? "text-gold" : tier === "silver" ? "text-fog" : "text-[#c08a5b]";
  return <Crown className={`${className} ${color}`} />;
}
