import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Eye, EyeOff, Mic } from "lucide-react";
import { bare, normalizeRu, plain, pronunciationTips, syllables, translit } from "../lib/russian";
import { api, isPremiumError } from "../lib/api";
import type { Line, Word } from "../lib/types";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { AudioButtons, SpeakPractice, useSpeaking } from "./Audio";
import { Sheet } from "./ui";

export type StressMap = Map<string, string>; // plain lowercase word -> stressed form

const TAG_LABEL = { formal: "вы · formal", informal: "ты · informal", spoken: "spoken" } as const;

/** One Russian sentence with clickable words, audio, translation, transliteration and speaking practice. */
export function RussianLine({
  line,
  stress,
  showEn: showEnDefault = false,
  size = "lg",
  saveSource,
  practiceRef,
  hideActions,
}: {
  line: Line;
  stress?: StressMap;
  showEn?: boolean;
  size?: "md" | "lg" | "xl";
  saveSource?: "lesson" | "game" | "chat" | "practice" | "tutor";
  practiceRef?: string;
  hideActions?: boolean;
}) {
  const { profile } = useSession();
  const toast = useToast();
  const [showEn, setShowEn] = useState(showEnDefault);
  const [showOther, setShowOther] = useState(false);
  const [word, setWord] = useState<Word | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [saved, setSaved] = useState(false);
  const playing = useSpeaking();
  const forms = profile?.ru_forms ?? "m";
  const useF = (forms === "f") !== showOther;
  const text = useF && line.ruF ? line.ruF : line.ru;
  const isPlaying = playing.text != null && normalizeRu(playing.text) === normalizeRu(text);
  const sizes = { md: "text-lg", lg: "text-2xl", xl: "text-[28px] md:text-[32px]" };

  // map each displayed token to its gloss (tokens are space-separated in the same order)
  const tokens = useMemo(() => {
    const out: { text: string; w?: Word }[] = [];
    let wi = 0;
    for (const tok of text.split(" ")) {
      const w = line.words[wi];
      const shown = w ? (useF && w.f ? w.f : w.ru) : null;
      if (w && shown === tok) {
        out.push({ text: tok, w });
        wi++;
      } else out.push({ text: tok });
    }
    return out;
  }, [text, line.words, useF]);

  const save = async () => {
    try {
      await api.savePhrase(text, line.en, saveSource ?? "lesson");
      setSaved(true);
      toast({ title: "Saved to your phrases", body: "It will come back in your reviews.", tone: "success" });
    } catch (e) {
      toast({ title: isPremiumError(e) ? (e as Error).message : "Couldn't save the phrase.", tone: "error" });
    }
  };

  return (
    <div>
      {(line.speaker || line.tag) && (
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-mist">
          {line.speaker && <span className="ru text-sm text-fog">{line.speaker}</span>}
          {line.tag && <span className="tag">{TAG_LABEL[line.tag]}</span>}
        </div>
      )}
      <div className={`ru ${sizes[size]} leading-snug`}>
        {tokens.map((t, i) => (
          <span key={i}>
            {t.w && /\p{L}/u.test(t.text) ? (
              <button type="button" onClick={() => setWord({ ...t.w!, ru: useF && t.w!.f ? t.w!.f : t.w!.ru })} className="word px-[1px]" data-active={isPlaying && playing.word === i}>
                {t.text}
              </button>
            ) : (
              <span className="px-[1px]">{t.text}</span>
            )}{" "}
          </span>
        ))}
      </div>
      {profile?.show_translit && <div className="mt-1 text-sm italic text-faint">{translit(text)}</div>}
      {line.ruF && (
        <button className="mt-1 text-xs font-semibold text-mist hover:text-fog" onClick={() => setShowOther(!showOther)}>
          {useF ? "Show masculine form" : "Show feminine form"}
        </button>
      )}
      {showEn ? (
        <div className="mt-1.5 text-[15px] text-mist">{line.en}</div>
      ) : null}
      {line.note && showEn && <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-fog">{line.note}</div>}
      {!hideActions && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <AudioButtons text={text} />
          <button onClick={() => setShowEn(!showEn)} className="btn btn-ghost h-8 px-2.5 text-xs" title={showEn ? "Hide translation" : "Show translation"}>
            {showEn ? <EyeOff className="size-4" /> : <Eye className="size-4" />} English
          </button>
          <button onClick={() => setSpeaking(!speaking)} className={`btn h-8 px-2.5 text-xs ${speaking ? "btn-secondary" : "btn-ghost"}`}>
            <Mic className="size-4" /> Speak
          </button>
          {saveSource && (
            <button onClick={save} disabled={saved} className="btn btn-ghost h-8 px-2.5 text-xs">
              {saved ? <BookmarkCheck className="size-4 text-accent" /> : <Bookmark className="size-4" />} {saved ? "Saved" : "Save"}
            </button>
          )}
        </div>
      )}
      {speaking && (
        <div className="mt-3">
          <SpeakPractice text={text} refKey={practiceRef} />
        </div>
      )}
      <WordSheet word={word} stress={stress} onClose={() => setWord(null)} />
    </div>
  );
}

/** Word details: meaning, audio, stress, syllables, transliteration, tips and mic practice. */
export function WordSheet({ word, stress, onClose }: { word: (Word & { stressed?: string }) | null; stress?: StressMap; onClose: () => void }) {
  if (!word) return null;
  const w = bare(word.ru);
  const stressed = word.stressed ?? stress?.get(plain(w).toLowerCase()) ?? w;
  const hasStress = stressed.includes("́") || /ё/i.test(stressed);
  const syl = syllables(stressed);
  const tips = pronunciationTips(stressed);
  return (
    <Sheet open onClose={onClose} title={<span className="ru text-2xl">{stressed}</span>}>
      <div className="text-lg text-fog">{word.en || "—"}</div>
      <div className="mt-1 text-sm italic text-faint">{translit(w)}</div>
      <div className="mt-4 flex items-center gap-3">
        <AudioButtons text={w} autoFocus />
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.03] p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-mist">Syllables</div>
          <div className="ru mt-1 text-xl">{syl.join(" · ")}</div>
        </div>
        <div className="rounded-2xl bg-white/[0.03] p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-mist">Stress</div>
          <div className="mt-1 text-sm text-fog">{hasStress ? <span className="ru text-xl">{stressed}</span> : "Listen to the audio for the stressed syllable."}</div>
        </div>
      </div>
      {tips.length > 0 && (
        <ul className="mt-4 grid gap-1.5 text-sm text-fog">
          {tips.map((t) => <li key={t}>• {t}</li>)}
        </ul>
      )}
      <div className="mt-5">
        <SpeakPractice text={w} refKey={`word:${plain(w).toLowerCase()}`} />
      </div>
    </Sheet>
  );
}

/** Build a stress map from vocab entries. */
export function stressMapFrom(list: { ru: string; stressed: string }[]): StressMap {
  const m: StressMap = new Map();
  for (const v of list) m.set(plain(v.ru).toLowerCase(), v.stressed);
  return m;
}
