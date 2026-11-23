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

export const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0);

/** "1534" for established, "1534?" for provisional, "Unrated" otherwise. */
export function ratingText(rating: number | null | undefined, status: string | null | undefined): string {
  if (rating == null || status === "unrated") return "Unrated";
  return status === "provisional" ? `${rating}?` : String(rating);
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function uuid(): string {
  return crypto.randomUUID?.() ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16));
}

/** Reads a small per-device preference (localStorage may be unavailable). */
export function pref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem("rca:" + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
export function setPref(key: string, value: unknown) {
  try {
    localStorage.setItem("rca:" + key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}
