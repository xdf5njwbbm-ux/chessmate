import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, LoaderCircle, X } from "lucide-react";
import { usePhotoUrl } from "../lib/photos";

type BtnVariant = "primary" | "secondary" | "electric" | "ghost" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const sizes = { sm: "h-9 px-4 text-sm", md: "h-12 px-5 text-[15px]", lg: "h-14 px-6 text-base" };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`btn btn-${variant} ${sizes[size]} ${className}`}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" /> : children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <LoaderCircle className={`size-6 animate-spin text-gold ${className}`} />;
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="size-8" />
    </div>
  );
}

export function TopBar({ title, back, right, transparent }: { title?: ReactNode; back?: boolean | string; right?: ReactNode; transparent?: boolean }) {
  const navigate = useNavigate();
  return (
    <header className={`safe-top sticky top-0 z-30 ${transparent ? "" : "glass border-b border-white/5"}`}>
      <div className="mx-auto flex h-14 max-w-md items-center gap-2 px-3">
        {back ? (
          <button
            aria-label="Back"
            onClick={() => (typeof back === "string" ? navigate(back) : window.history.length > 1 ? navigate(-1) : navigate("/discover"))}
            className="grid size-10 place-items-center rounded-full text-fog hover:bg-white/5"
          >
            <ChevronLeft className="size-6" />
          </button>
        ) : (
          <div className="w-2" />
        )}
        <div className="min-w-0 flex-1 truncate font-display text-xl font-semibold tracking-tight">{title}</div>
        <div className="flex items-center gap-1">{right}</div>
      </div>
    </header>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md animate-sheet-in">
        <div className="safe-bottom max-h-[88dvh] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-ink-900 shadow-2xl">
          <div className="sticky top-0 z-10 bg-ink-900/95 px-5 pb-2 pt-3 backdrop-blur">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
            <div className="flex items-center justify-between gap-3">
              <div className="font-display text-xl font-semibold">{title}</div>
              <button aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/5 text-fog">
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

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-mist">{hint}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-gold" : "bg-white/15"}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Chip({ on, onClick, children }: { on?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} data-on={!!on} className="chip">
      {children}
    </button>
  );
}

export function Photo({ path, className = "", alt = "" }: { path: string | null | undefined; className?: string; alt?: string }) {
  const url = usePhotoUrl(path);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const loaded = !!url && loadedSrc === url;
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} overflow-hidden bg-ink-800 ${className}`}>
      {!loaded && <div className="skeleton absolute inset-0" />}
      {url && (
        <img
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && loadedSrc !== url) setLoadedSrc(url);
          }}
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoadedSrc(url)}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

export function Avatar({
  path,
  name,
  size = 48,
  online,
  ring,
}: {
  path: string | null | undefined;
  name?: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {path ? (
        <Photo path={path} alt={name} className={`size-full rounded-full ${ring ? "ring-2 ring-gold/70 ring-offset-2 ring-offset-ink-950" : ""}`} />
      ) : (
        <div className="grid size-full place-items-center rounded-full bg-ink-700 font-semibold text-mist">{name?.[0] ?? "?"}</div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-ink-950 bg-mint" aria-label="Online" />
      )}
    </div>
  );
}

export function CompatRing({ value, size = 56, stroke = 5, label = true }: { value: number | null | undefined; size?: number; stroke?: number; label?: boolean }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="cm-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f6d796" />
            <stop offset="1" stopColor="#c99a44" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgb(255 255 255 / 0.12)" strokeWidth={stroke} fill="rgb(7 11 22 / 0.55)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#cm-gold)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-semibold leading-none" style={{ fontSize: size * 0.28 }}>
            {value ?? "–"}
            <span className="text-[0.6em] text-gold">%</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex animate-rise flex-col items-center px-8 py-16 text-center">
      {icon && <div className="mb-5 grid size-16 place-items-center rounded-3xl bg-white/5 text-gold">{icon}</div>}
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      {body && <p className="mt-2 max-w-xs text-mist">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between px-1">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">{children}</h2>
      {right}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-gold-deep to-gold-bright transition-all duration-500"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

export function Confirm({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {body && <div className="text-mist">{body}</div>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
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

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={size} height={size} className="rounded-[28%]" />
      <span className="font-display font-semibold tracking-tight" style={{ fontSize: size * 0.8 }}>
        Chess<span className="gold-text">mate</span>
      </span>
    </span>
  );
}
