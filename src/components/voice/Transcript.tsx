import { memo, useEffect, useRef } from "react";
import { CircleCheck, Languages, PencilLine, Play, Snail, Square, Volume2 } from "lucide-react";
import { ISSUE_LABEL, type Issue, type IssueType, type Suggestion } from "../../../supabase/functions/_shared/voice/logic.ts";
import { TUTORS, type TutorId } from "../../../supabase/functions/_shared/voice/curriculum.ts";
import { translit } from "../../lib/russian";
import type { Line } from "../../lib/voice/engine";

export const ISSUE_TONE: Record<IssueType, string> = {
  grammar: "border-warn/40 bg-warn/10 text-warn",
  word_choice: "border-sky/40 bg-sky/10 text-sky",
  pronunciation: "border-gold/40 bg-gold/10 text-gold-bright",
  ending: "border-danger/40 bg-danger/10 text-[#ff9a9a]",
  structure: "border-[#b48cff]/40 bg-[#b48cff]/10 text-[#cdb5ff]",
  unnatural: "border-white/20 bg-white/[0.06] text-fog",
};

export function IssueTag({ type }: { type: IssueType }) {
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${ISSUE_TONE[type]}`}>{ISSUE_LABEL[type]}</span>;
}

export const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Actions = {
  /** Play any Russian sentence in the tutor's voice. */
  say: (text: string, rate?: number) => void;
  /** Replay what the tutor actually said on a line. */
  replay: (lineId: string, rate?: number) => void;
  playing: string | null;
};

function PlayButton({ active, onClick, label, slow, small }: { active: boolean; onClick: () => void; label: string; slow?: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid ${small ? "size-7" : "size-8"} shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-accent text-ink-950" : "bg-white/[0.06] text-fog hover:bg-white/[0.12] hover:text-white"}`}
    >
      {active ? <Square className="size-3 fill-current" /> : slow ? <Snail className="size-3.5" /> : <Volume2 className="size-3.5" />}
    </button>
  );
}

const TutorLine = memo(function TutorLine({ line, tutor, showEn, showPron, a }: { line: Line; tutor: TutorId; showEn: boolean; showPron: boolean; a: Actions }) {
  const t = TUTORS[tutor];
  const an = line.analysis?.kind === "tutor" ? line.analysis : null;
  const pending = !line.final;
  return (
    <div className="flex animate-rise gap-2.5">
      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent-soft">{t.ru[0]}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-faint">
          <span className="font-semibold text-mist">{t.ru}</span>
          <span className="tabular-nums">{mmss(line.at)}</span>
          {line.interrupted && <span className="tag !py-0 !text-[10px]">interrupted</span>}
          {line.final && line.text && (
            <span className="ml-auto flex items-center gap-1">
              <PlayButton small active={a.playing === `${line.id}@1`} onClick={() => a.replay(line.id, 1)} label="Replay" />
              <PlayButton small slow active={a.playing === `${line.id}@0.7`} onClick={() => a.replay(line.id, 0.7)} label="Replay slowly" />
            </span>
          )}
        </div>
        {pending && !line.text ? (
          <div className="mt-1.5 flex gap-1" aria-label="Speaking">
            {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-pulse rounded-full bg-mist" style={{ animationDelay: `${i * 150}ms` }} />)}
          </div>
        ) : an ? (
          <div className="mt-1 grid gap-2">
            {an.segments.map((s, i) =>
              s.lang === "ru" ? (
                <div key={i} className="group">
                  <button type="button" onClick={() => a.say(s.text)} className={`ru text-left text-[19px] leading-snug transition-colors ${a.playing === `tts:${s.text}@1` ? "text-accent-soft" : "text-white hover:text-accent-soft"}`} title="Tap to hear this sentence">
                    {s.text}
                  </button>
                  {showPron && (s.pron || s.text) && <div className="mt-0.5 text-[13px] italic text-sky/90">{s.pron || translit(s.text)}</div>}
                  {showEn && s.en && <div className="mt-0.5 text-sm text-mist">{s.en}</div>}
                </div>
              ) : (
                <div key={i} className="flex items-start gap-1.5 text-sm text-mist">
                  <Languages className="mt-0.5 size-3.5 shrink-0 text-faint" /> <span className="italic">{s.text}</span>
                </div>
              ),
            )}
            {an.words.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {an.words.map((w) => (
                  <button key={w.ru} type="button" onClick={() => a.say(w.ru)} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-left text-xs hover:border-white/20">
                    <span className="ru text-sm text-white">{w.ru}</span>
                    {showEn && w.en && <span className="ml-1.5 text-mist">{w.en}</span>}
                  </button>
                ))}
              </div>
            )}
            {an.correction && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-xs text-mist">
                <PencilLine className="size-3.5 text-accent-soft" />
                <IssueTag type={an.correction.type} />
                {an.correction.said && <span className="ru text-sm text-faint line-through">{an.correction.said}</span>}
                <span className="ru text-sm text-accent-soft">{an.correction.right}</span>
                {showEn && an.correction.note && <span className="basis-full">{an.correction.note}</span>}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-1">
            <div className="ru text-[19px] leading-snug text-white">{line.text}</div>
            {line.final && showPron && /[а-яё]/i.test(line.text) && <div className="mt-0.5 text-[13px] italic text-sky/70">{translit(line.text)}</div>}
            {line.analysing && <div className="mt-1 h-3 w-40 rounded skeleton" />}
          </div>
        )}
      </div>
    </div>
  );
});

function Fix({ issue, showEn }: { issue: Issue; showEn: boolean }) {
  return (
    <li className="text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <IssueTag type={issue.type} />
        {issue.wrong && <span className="ru text-faint line-through">{issue.wrong}</span>}
        <span className="ru text-fog">→ {issue.right}</span>
      </div>
      {showEn && issue.note && <div className="mt-0.5 text-mist">{issue.note}</div>}
    </li>
  );
}

const LearnerLine = memo(function LearnerLine({ line, showEn, showPron, a }: { line: Line; showEn: boolean; showPron: boolean; a: Actions }) {
  const an = line.analysis?.kind === "learner" ? line.analysis : null;
  const better = an ? an.natural || an.corrected : null;
  return (
    <div className="flex animate-rise justify-end">
      <div className="w-full max-w-[92%] sm:max-w-[85%]">
        <div className="mb-1 flex items-center justify-end gap-2 text-xs text-faint">
          <span className="tabular-nums">{mmss(line.at)}</span>
          <span className="font-semibold text-mist">You</span>
        </div>
        <div className="rounded-2xl rounded-tr-md border border-sky/20 bg-sky/[0.08] px-3.5 py-2.5">
          {line.failed ? (
            <div className="text-sm text-mist">Couldn't catch that — try saying it again.</div>
          ) : !line.final ? (
            <div className="ru text-[17px] text-fog">{line.text || <span className="text-sm text-mist">Listening…</span>}</div>
          ) : (
            <>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sky/70">Heard</div>
              <div className="ru text-[17px] leading-snug text-white">{line.text}</div>
              {line.analysing && !an && <div className="mt-2 h-3 w-32 rounded skeleton" />}
              {an && an.lang !== "en" && an.ok && !better && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-accent-soft">
                  <CircleCheck className="size-3.5" /> Natural Russian
                  {showEn && an.en && <span className="font-normal text-mist">· {an.en}</span>}
                </div>
              )}
              {an && an.lang === "en" && (
                <div className="mt-1.5 text-xs text-mist">You said this in English.{better ? " In Russian:" : ""}</div>
              )}
              {an && better && (
                <div className="mt-2 rounded-xl border border-accent/25 bg-accent/[0.07] px-3 py-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-accent-soft">{an.lang === "en" ? "Say it in Russian" : an.natural ? "More natural" : "Corrected"}</div>
                      <button type="button" onClick={() => a.say(better)} className="ru text-left text-[17px] leading-snug text-white hover:text-accent-soft">{better}</button>
                      {showPron && <div className="text-[13px] italic text-sky/90">{an.pron || translit(better)}</div>}
                      {showEn && an.en && <div className="text-sm text-mist">{an.en}</div>}
                    </div>
                    <div className="flex flex-col gap-1">
                      <PlayButton active={a.playing === `tts:${better}@1`} onClick={() => a.say(better)} label="Hear it" />
                      <PlayButton slow active={a.playing === `tts:${better}@0.7`} onClick={() => a.say(better, 0.7)} label="Hear it slowly" />
                    </div>
                  </div>
                </div>
              )}
              {an && an.issues.length > 0 && <ul className="mt-2 grid gap-1.5">{an.issues.map((i, k) => <Fix key={k} issue={i} showEn={showEn} />)}</ul>}
              {an && showEn && !an.ok && !better && an.en && <div className="mt-1 text-sm text-mist">{an.en}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export function Transcript({ lines, tutor, showEn, showPron, actions, empty }: { lines: Line[]; tutor: TutorId; showEn: boolean; showPron: boolean; actions: Actions; empty?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);
  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      }}
      className="h-full overflow-y-auto overscroll-contain px-4 py-4"
      aria-live="polite"
    >
      {lines.length === 0 ? empty : (
        <div className="grid gap-4">
          {lines.map((l) =>
            l.role === "tutor"
              ? <TutorLine key={l.id} line={l} tutor={tutor} showEn={showEn} showPron={showPron} a={actions} />
              : <LearnerLine key={l.id} line={l} showEn={showEn} showPron={showPron} a={actions} />,
          )}
        </div>
      )}
    </div>
  );
}

export function Suggestions({ items, showEn, showPron, actions, highlight }: { items: Suggestion[]; showEn: boolean; showPron: boolean; actions: Actions; highlight?: boolean }) {
  if (!items.length) return null;
  return (
    <div className={`rounded-2xl border px-3 py-2.5 transition-colors ${highlight ? "border-gold/40 bg-gold/[0.07]" : "border-white/[0.07] bg-white/[0.02]"}`}>
      <div className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${highlight ? "text-gold" : "text-mist"}`}>{highlight ? "Need a hand? You could say:" : "You could say:"}</div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {items.map((s) => (
          <button key={s.ru} type="button" onClick={() => actions.say(s.ru)}
            className={`min-w-[9rem] shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${actions.playing === `tts:${s.ru}@1` ? "border-accent/60 bg-accent/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
            <div className="flex items-center gap-1.5">
              <Play className="size-3 shrink-0 text-accent" />
              <span className="ru text-[15px] text-white">{s.ru}</span>
            </div>
            {showPron && s.pron && <div className="text-xs italic text-sky/80">{s.pron}</div>}
            {showEn && s.en && <div className="text-xs text-mist">{s.en}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}
