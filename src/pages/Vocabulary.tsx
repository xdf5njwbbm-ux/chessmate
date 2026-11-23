import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Library, Repeat2, Search, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { ago } from "../lib/format";
import type { SavedPhrase, VocabWord } from "../lib/types";
import { useEntitlements } from "../state/session";
import { useToast } from "../state/toast";
import { AudioButtons } from "../components/Audio";
import { WordSheet } from "../components/RussianText";
import { Button, Chip, EmptyState, PageHeader, PageLoader, Segmented, Stat } from "../components/ui";

const status = (w: { reps: number | null; interval_days: number | null }) =>
  !w.reps ? "new" : (w.interval_days ?? 0) >= 21 ? "mastered" : "learning";
const STATUS_STYLE = { new: "bg-white/[0.06] text-fog", learning: "bg-sky/10 text-sky", mastered: "bg-gold/10 text-gold" };

export default function Vocabulary() {
  const navigate = useNavigate();
  const toast = useToast();
  const ent = useEntitlements();
  const [data, setData] = useState<{ words: VocabWord[]; phrases: SavedPhrase[] } | null>(null);
  const [tab, setTab] = useState<"words" | "phrases">("words");
  const [q, setQ] = useState("");
  const [lvl, setLvl] = useState<string | null>(null);
  const [st, setSt] = useState<string | null>(null);
  const [word, setWord] = useState<VocabWord | null>(null);

  const load = () => api.vocabulary().then(setData).catch((e) => toast({ title: (e as Error).message, tone: "error" }));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const words = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.words ?? []).filter((w) =>
      (!needle || w.ru.toLowerCase().includes(needle) || w.en.toLowerCase().includes(needle)) && (!lvl || w.level === lvl) && (!st || status(w) === st || (st === "weak" && w.lapses > 0)));
  }, [data, q, lvl, st]);
  const phrases = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.phrases ?? []).filter((p) => !needle || p.ru.toLowerCase().includes(needle) || p.en.toLowerCase().includes(needle));
  }, [data, q]);

  if (!data) return <PageLoader />;
  const counts = { new: 0, learning: 0, mastered: 0, weak: 0 };
  for (const w of data.words) {
    counts[status(w)]++;
    if (w.lapses > 0) counts.weak++;
  }

  return (
    <div>
      <PageHeader title="Vocabulary" subtitle="Words from your completed lessons and the phrases you've saved. Everything here comes back in spaced reviews."
        right={<Button onClick={() => navigate("/practice/review")}><Repeat2 className="size-4" /> Review</Button>} />
      <div className="card grid grid-cols-2 gap-5 p-5 md:grid-cols-4">
        <Stat label="Words" value={data.words.length} />
        <Stat label="Learning" value={counts.learning} />
        <Stat label="Mastered" value={counts.mastered} tone="gold" sub="interval of 3+ weeks" />
        <Stat label="Saved phrases" value={data.phrases.length} sub={ent.saved_phrases != null ? `limit ${ent.saved_phrases}` : undefined} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ v: "words", l: `Words (${data.words.length})` }, { v: "phrases", l: `Phrases (${data.phrases.length})` }]} />
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-mist" />
          <input className="field !py-2.5 pl-10" placeholder="Search Russian or English" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {tab === "words" ? (
        <>
          <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
            {["A1", "A2", "B1", "B2"].map((l) => <Chip key={l} on={lvl === l} onClick={() => setLvl(lvl === l ? null : l)}>{l}</Chip>)}
            <span className="mx-1 w-px bg-white/10" />
            {(["new", "learning", "mastered", "weak"] as const).map((s) => <Chip key={s} on={st === s} onClick={() => setSt(st === s ? null : s)}>{s === "weak" ? "Often missed" : s[0].toUpperCase() + s.slice(1)} · {counts[s]}</Chip>)}
          </div>
          {words.length === 0 ? (
            <EmptyState icon={<Library className="size-7" />} title={data.words.length ? "No matches" : "No words yet"} body={data.words.length ? undefined : "Complete a lesson and its vocabulary lands here."} action={!data.words.length && <Button onClick={() => navigate("/learn")}>Start a lesson</Button>} />
          ) : (
            <div className="card mt-4 divide-y divide-white/[0.06]">
              {words.map((w) => (
                <button key={w.id} onClick={() => setWord(w)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="ru text-lg">{w.stressed}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLE[status(w)]}`}>{status(w)}</span>
                      {w.lapses > 0 && <span className="text-[11px] text-warn">missed {w.lapses}×</span>}
                    </div>
                    <div className="truncate text-sm text-mist">{w.en} <span className="text-faint">· {w.level} · {w.lesson_title}</span></div>
                  </div>
                  <span onClick={(e) => e.stopPropagation()}><AudioButtons text={w.ru} compact /></span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : phrases.length === 0 ? (
        <EmptyState icon={<Library className="size-7" />} title="No saved phrases" body="Tap Save on any sentence — in lessons, during games or in conversations." />
      ) : (
        <div className="card mt-4 divide-y divide-white/[0.06]">
          {phrases.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="ru text-lg">{p.ru}</div>
                <div className="text-sm text-mist">{p.en} <span className="text-faint">· from {p.source} · {ago(p.created_at)}</span></div>
              </div>
              <AudioButtons text={p.ru} compact />
              <button aria-label="Delete phrase" className="grid size-8 place-items-center rounded-lg text-mist hover:bg-white/5 hover:text-danger" onClick={async () => {
                await api.deletePhrase(p.id).catch(() => {});
                load();
              }}><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      )}
      <WordSheet word={word} onClose={() => setWord(null)} />
    </div>
  );
}
