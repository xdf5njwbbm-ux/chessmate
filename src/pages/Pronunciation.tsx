import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Lock, Mic } from "lucide-react";
import { api } from "../lib/api";
import { duration, pct } from "../lib/format";
import { syllables, translit } from "../lib/russian";
import type { Milestone, PronunciationOverview } from "../lib/types";
import { useSession } from "../state/session";
import { AudioButtons, SpeakPractice } from "../components/Audio";
import { BackButton, Button, EmptyState, PageHeader, PageLoader, Progress, SectionTitle, Stat } from "../components/ui";

const SOUND_TIPS: Record<string, { tip: string; words: string[] }> = {
  ы: { tip: "Say “ee”, then pull your tongue back without moving your lips.", words: ["мы", "ты", "сын", "сыр"] },
  щ: { tip: "A long, soft “sh” — like “fresh sheet” said quickly.", words: ["щи", "ещё", "борщ", "помощь"] },
  ж: { tip: "Always hard: a deep buzzing “zh” with the tongue pulled back.", words: ["жена", "жук", "жить", "ужин"] },
  ц: { tip: "Always hard “ts”, as in “cats”.", words: ["цена", "центр", "улица", "отец"] },
  ч: { tip: "Always soft and light “ch”.", words: ["чай", "час", "ночь", "ключ"] },
  ш: { tip: "Always hard “sh” with the tongue pulled back.", words: ["шах", "шахматы", "наш", "хорошо"] },
  ь: { tip: "Softens the consonant before it: lift the middle of your tongue.", words: ["мать", "конь", "день", "соль"] },
  р: { tip: "A rolled r: tap the tip of your tongue behind your top teeth.", words: ["рыба", "брат", "рокировка", "ферзь"] },
  х: { tip: "Like the “ch” in Scottish “loch”, softer than a cough.", words: ["хлеб", "хорошо", "ход", "тихо"] },
};

export default function Pronunciation() {
  const { id } = useParams();
  const [o, setO] = useState<PronunciationOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () => api.pronunciation().then(setO).catch((e) => setErr((e as Error).message));
  useEffect(() => {
    load();
  }, [id]);
  if (err) return <EmptyState title="Couldn't load pronunciation" body={err} />;
  if (!o) return <PageLoader />;
  if (id) {
    const m = o.milestones.find((x) => x.id === id);
    return m ? <MilestoneView m={m} onProgress={load} /> : <EmptyState title="Milestone not found" />;
  }
  return <Overview o={o} />;
}

function Overview({ o }: { o: PronunciationOverview }) {
  const navigate = useNavigate();
  const { speech } = useSession();
  const [drill, setDrill] = useState<string | null>(null);
  const levels = ["A1", "A2", "B1", "B2"] as const;
  const maxAttempts = Math.max(1, ...o.trend.map((t) => t.attempts));

  return (
    <div>
      <PageHeader back="/practice" title="Pronunciation" subtitle={speech.assess
        ? "Listen, record and get a 0–100 score with word- and sound-level feedback."
        : "Listen, record and compare. Your device's speech recognizer shows which words came through clearly."} />

      <div className="card grid grid-cols-2 gap-5 p-5 md:grid-cols-5">
        <Stat label="Words practised" value={o.stats.words_practiced} />
        <Stat label="Sentences spoken" value={o.stats.sentences_spoken} />
        <Stat label="Clear attempts" value={o.stats.attempts ? `${pct(o.stats.passed, o.stats.attempts)}%` : "—"} sub={`${o.stats.passed}/${o.stats.attempts}`} />
        <Stat label="Avg score (7 days)" value={o.stats.avg_score_7d ?? "—"} sub={o.stats.scored ? `${o.stats.scored} scored attempts` : "Needs neural scoring"} tone={o.stats.avg_score_7d ? "accent" : undefined} />
        <Stat label="Speaking time" value={duration(o.stats.speaking_seconds)} sub={o.listening.total ? `Listening ${pct(o.listening.correct, o.listening.total)}%` : undefined} />
      </div>

      {o.trend.length > 0 && (
        <>
          <SectionTitle>Last 30 days</SectionTitle>
          <div className="card flex h-36 items-end gap-1 p-4">
            {o.trend.map((t) => (
              <div key={t.day} className="group relative flex flex-1 flex-col items-center justify-end" title={`${t.day}: ${t.attempts} attempts, ${t.passed} clear${t.avg_score != null ? `, avg ${t.avg_score}` : ""}`}>
                <div className="w-full max-w-6 rounded-t bg-white/10" style={{ height: `${(t.attempts / maxAttempts) * 100}%` }}>
                  <div className="w-full rounded-t bg-accent" style={{ height: `${t.attempts ? (t.passed / t.attempts) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 text-xs text-faint">Bar height = attempts · green = clear attempts</div>
        </>
      )}

      {(o.difficult_sounds.length > 0 || o.difficult_words.length > 0) && (
        <>
          <SectionTitle>Practise next</SectionTitle>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="card p-5">
              <div className="text-sm font-semibold">Sounds that trip you up</div>
              <div className="mt-3 grid gap-3">
                {o.difficult_sounds.slice(0, 4).map((s) => (
                  <div key={s.sound}>
                    <div className="flex items-center gap-2"><span className="ru text-2xl">{s.sound}</span><span className="text-xs text-mist">{s.fails} unclear attempt{s.fails > 1 ? "s" : ""}</span></div>
                    <div className="text-sm text-fog">{SOUND_TIPS[s.sound]?.tip}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {SOUND_TIPS[s.sound]?.words.map((w) => <button key={w} onClick={() => setDrill(w)} className="chip ru !py-1 text-base">{w}</button>)}
                    </div>
                  </div>
                ))}
                {!o.difficult_sounds.length && <div className="text-sm text-mist">No problem sounds yet.</div>}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-sm font-semibold">Words and phrases to repeat</div>
              <div className="mt-3 grid gap-2">
                {o.difficult_words.slice(0, 6).map((w) => (
                  <button key={w.text} onClick={() => setDrill(w.text)} className="flex items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.04]">
                    <span className="ru min-w-0 flex-1 truncate text-lg">{w.text}</span>
                    <span className="text-xs text-mist">{w.fails}/{w.tries} unclear</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {drill && (
        <div className="card mt-4 p-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="ru text-3xl">{drill}</div>
              <div className="text-sm italic text-faint">{translit(drill)} · {syllables(drill).join(" · ")}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDrill(null)}>Close</Button>
          </div>
          <div className="mt-3"><AudioButtons text={drill} /></div>
          <div className="mt-4"><SpeakPractice text={drill} refKey="drill" /></div>
        </div>
      )}

      {levels.map((lv) => (
        <div key={lv}>
          <SectionTitle>{lv} milestones</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {o.milestones.filter((m) => m.level === lv).map((m) => {
              const done = m.passed_items.length >= m.pass_count;
              return (
                <button key={m.id} disabled={m.locked} onClick={() => navigate(`/practice/pronunciation/${m.id}`)} className="card card-hover p-5 text-left disabled:opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-lg font-semibold">{m.title}</span>
                    {m.locked ? <Lock className="size-4 text-faint" /> : done ? <Check className="size-5 text-gold" /> : <Mic className="size-4 text-mist" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-mist">{m.summary}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={(Math.min(m.passed_items.length, m.pass_count) / m.pass_count) * 100} tone={done ? "gold" : "accent"} />
                    <span className="shrink-0 text-xs tabular-nums text-mist">{Math.min(m.passed_items.length, m.pass_count)}/{m.pass_count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MilestoneView({ m, onProgress }: { m: Milestone; onProgress: () => void }) {
  const { speech } = useSession();
  const passed = new Set(m.passed_items);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 flex items-center gap-2"><BackButton to="/practice/pronunciation" /><span className="text-sm text-mist">{m.level} milestone</span></div>
      <h1 className="font-display text-3xl font-semibold">{m.title}</h1>
      <p className="mt-2 text-fog">{m.summary}</p>
      <div className="mt-4 flex items-center gap-3">
        <Progress value={(Math.min(passed.size, m.pass_count) / m.pass_count) * 100} tone={passed.size >= m.pass_count ? "gold" : "accent"} className="max-w-xs" />
        <span className="text-sm text-mist">{Math.min(passed.size, m.pass_count)} of {m.pass_count} needed</span>
      </div>
      <p className="mt-2 text-xs text-faint">
        {speech.assess ? "An item counts as passed with a pronunciation score of 70 or more." : "An item counts as passed when the recognizer understands at least 80% of its words."}
      </p>
      <div className="mt-6 grid gap-4">
        {m.items.map((it, k) => (
          <div key={k} className="card p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="ru text-2xl leading-snug">{it.ru}</div>
                <div className="text-sm italic text-faint">{translit(it.ru)}</div>
                <div className="mt-1 text-mist">{it.en}</div>
              </div>
              {passed.has(k) && <span className="tag !bg-accent/10 !text-accent-soft"><Check className="size-3" /> passed</span>}
            </div>
            <div className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-fog">{it.tip}</div>
            <div className="mt-3"><AudioButtons text={it.ru} /></div>
            <div className="mt-3"><SpeakPractice text={it.ru} refKey={`pm:${m.id}:${k}`} onResult={(ok) => ok && onProgress()} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
