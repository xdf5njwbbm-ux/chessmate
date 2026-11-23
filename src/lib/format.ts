export function miles(km: number | null | undefined): string | null {
  if (km == null) return null;
  const mi = Math.max(1, Math.round(km * 0.621371));
  return `${mi} mi away`;
}

export function clock(ms: number, perMove = false): string {
  const t = Math.max(0, ms);
  if (perMove || t >= 3_600_000) {
    const d = Math.floor(t / 86_400_000);
    const h = Math.floor((t % 86_400_000) / 3_600_000);
    const m = Math.floor((t % 3_600_000) / 60_000);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor((t % 60_000) / 1000)}s`;
  }
  const m = Math.floor(t / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  if (t < 10_000) return `${s}.${Math.floor((t % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ageFrom(birthdate: string): number {
  const b = new Date(birthdate + "T00:00:00");
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

export function maxBirthdate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}
