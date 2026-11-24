// Conversation progress from the saved memory — light enough for progress screens
// (no content or engine imported).
import type { Memory } from "./engine";

export function convoSummary(mem: Memory | null) {
  const s = mem?.stats;
  if (!s || !s.exchanges) return { exchanges: 0, avg: 0, understood: 0, level: mem?.level ?? null, askedBack: 0, challenges: 0, best: 0, scenarios: 0, grammar: 0, top: [] as [string, number][], week: 0 };
  const now = Date.now();
  let week = 0;
  for (const [d, n] of Object.entries(s.days)) if (now - Date.parse(d) < 7 * 86_400_000) week += n;
  return {
    exchanges: s.exchanges,
    avg: Math.round(s.scoreSum / s.exchanges),
    understood: Math.round((100 * s.understood) / s.exchanges),
    level: mem!.level ?? null,
    askedBack: s.askedBack,
    challenges: s.challengesDone,
    best: s.challengeBest,
    scenarios: Object.keys(s.scenarios).length,
    grammar: s.grammar,
    top: Object.entries(s.mistakes).sort((a, b) => b[1] - a[1]).slice(0, 3),
    week,
  };
}
