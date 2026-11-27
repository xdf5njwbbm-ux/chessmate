import { useState } from "react";
import { ArrowUpRight, BookOpenCheck, ChevronDown, Lightbulb, Phone, PhoneCall, Repeat2, Snail, Sparkles, Square, TrendingUp, Volume2 } from "lucide-react";
import { levelIndex, nextLevel, topicById, TUTORS, VOICE_LEVELS, type TutorId } from "../../../supabase/functions/_shared/voice/curriculum.ts";
import type { Report, Turn } from "../../../supabase/functions/_shared/voice/logic.ts";
import { playTutor, useTutorPlaying } from "../../lib/voice/play";
import { plain, translit } from "../../lib/russian";
import { SpeakPractice } from "../Audio";
import { Button, Progress, Ring, SectionTitle } from "../ui";
import { IssueTag, Transcript } from "./Transcript";
import type { Line } from "../../lib/voice/engine";

function Listen({ text, tutor }: { text: string; tutor: TutorId }) {
  const playing = useTutorPlaying();
  const t = plain(text);
  return (
    <div className="flex items-center gap-1.5">
      {[1, 0.7].map((rate) => {
        const on = playing === `${t}@${rate}`;
        return (
          <button key={rate} type="button" onClick={() => void playTutor(t, tutor, rate)} aria-label={rate === 1 ? "Listen" : "Listen slowly"} title={rate === 1 ? "Listen" : "Listen slowly"}
            className={`grid size-9 place-items-center rounded-xl transition-colors ${on ? "bg-accent text-ink-950" : "bg-white/[0.07] text-white hover:bg-white/[0.12]"}`}>
            {on ? <Square className="size-3.5 fill-current" /> : rate === 1 ? <Volume2 className="size-4" /> : <Snail className="size-4" />}
          </button>
        );
      })}
    </div>
  );
}

const fmt = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ""}` : `${s} s`);
const tone = (v: number) => (v >= 80 ? "text-accent-soft" : v >= 60 ? "text-warn" : "text-danger");

export function VoiceReport({ report, tutor, turns, onStartLesson, onReviewCall, startedAt }: {
  report: Report;
  tutor: TutorId;
  turns?: Turn[];
  startedAt?: string;
  onStartLesson?: (lesson: number) => void;
  onReviewCall?: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const t = TUTORS[tutor];
  const r = report;
  const next = nextLevel(r.level.speaking);
  const nextTopic = topicById(r.next_lesson.id);
  const lines: Line[] = (turns ?? []).map((x) => ({ ...x, final: true, analysing: false }));
  const transcriptActions = { say: (text: string, rate = 1) => void playTutor(plain(text), tutor, rate), replay: () => {}, playing: null };

  return (
    <div className="animate-rise">
      {/* headline */}
      <div className="card overflow-hidden p-5 md:p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">Call with {t.ru}{startedAt ? ` · ${new Date(startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</div>
            <h2 className="mt-1 font-display text-2xl font-semibold md:text-3xl">{r.level.advanced ? `You're now ${r.level.speaking}! 🎉` : "Your call report"}</h2>
            <p className="mt-2 text-fog">{r.summary}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm sm:max-w-md">
              <div><div className="text-xs text-mist">Duration</div><div className="text-lg font-semibold tabular-nums">{fmt(r.duration_s)}</div></div>
              <div><div className="text-xs text-mist">Russian sentences</div><div className="text-lg font-semibold tabular-nums">{r.sentences}</div></div>
              <div><div className="text-xs text-mist">Words spoken</div><div className="text-lg font-semibold tabular-nums">{r.words_spoken}</div></div>
            </div>
          </div>
          <div className="flex gap-4">
            {([["Comprehension", r.scores.comprehension], ["Confidence", r.scores.confidence], ["Accuracy", r.scores.accuracy]] as const).map(([label, v]) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <Ring value={v} size={68} stroke={6}><span className={`text-lg font-semibold tabular-nums ${tone(v)}`}>{v}</span></Ring>
                <span className="text-[11px] font-medium text-mist">{label}</span>
              </div>
            ))}
          </div>
        </div>
        {r.strengths.length > 0 && (
          <ul className="mt-4 grid gap-1 text-sm text-fog">
            {r.strengths.map((x) => <li key={x} className="flex gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-gold" /> {x}</li>)}
          </ul>
        )}
      </div>

      {/* level */}
      <div className="card mt-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <TrendingUp className="size-5 text-accent" />
          <div className="font-semibold">Speaking level</div>
          <div className="flex gap-1">
            {VOICE_LEVELS.map((l) => (
              <span key={l} className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${l === r.level.speaking ? "bg-accent text-ink-950" : levelIndex(l) < levelIndex(r.level.speaking) ? "bg-accent/15 text-accent-soft" : "bg-white/[0.06] text-faint"}`}>{l}</span>
            ))}
          </div>
          <span className="ml-auto text-xs text-mist">This call sounded like {r.level.estimate}</span>
        </div>
        {next && (
          <div className="mt-3 flex items-center gap-3">
            <Progress value={r.level.progress} className="flex-1" />
            <span className="text-sm tabular-nums text-mist">{r.level.progress}% → {next}</span>
          </div>
        )}
        <p className="mt-2 text-sm text-mist">{r.level.note}</p>
      </div>

      {/* next lesson */}
      {nextTopic && (
        <div className="card mt-4 flex flex-wrap items-center gap-4 p-5">
          <div className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent"><BookOpenCheck className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">Recommended next</div>
            <div className="font-display text-xl font-semibold">{nextTopic.id}. {nextTopic.title} <span className="ru font-normal text-mist">· {nextTopic.ru}</span></div>
            <div className="text-sm text-mist">{r.next_lesson.reason}</div>
          </div>
          {onStartLesson && <Button onClick={() => onStartLesson(nextTopic.id)}><PhoneCall className="size-4" /> Call about this</Button>}
        </div>
      )}

      <div className="mt-8 grid gap-x-4 gap-y-8 lg:grid-cols-2">
        {/* mistakes */}
        <div>
          <SectionTitle>Grammar &amp; word choice</SectionTitle>
          <div className="card p-4">
            {r.grammar_mistakes.length ? (
              <ul className="grid gap-3">
                {r.grammar_mistakes.map((m, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <IssueTag type={m.type} />
                        {m.wrong && <span className="ru text-faint line-through">{m.wrong}</span>}
                      </div>
                      <div className="ru mt-0.5 text-lg text-white">{m.right}</div>
                      {m.note && <div className="text-sm text-mist">{m.note}</div>}
                    </div>
                    <Listen text={m.right} tutor={tutor} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-mist">No grammar mistakes worth mentioning. Отлично!</p>}
          </div>
        </div>

        {/* pronunciation */}
        <div>
          <SectionTitle>Pronunciation</SectionTitle>
          <div className="card p-4">
            {r.pronunciation.improvements.length > 0 && (
              <ul className="mb-3 grid gap-1 text-sm text-fog">
                {r.pronunciation.improvements.map((x) => <li key={x} className="flex gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-accent" /> {x}</li>)}
              </ul>
            )}
            {r.pronunciation.practise.length ? (
              <ul className="grid gap-4">
                {r.pronunciation.practise.map((p, i) => (
                  <li key={i}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="ru text-lg text-white">{p.ru}</div>
                        <div className="text-[13px] italic text-sky/90">{translit(p.ru)}</div>
                        <div className="mt-0.5 text-sm text-mist"><span className="font-semibold text-gold">{p.issue}</span>{p.tip ? ` — ${p.tip}` : ""}</div>
                      </div>
                      <Listen text={p.ru} tutor={tutor} />
                    </div>
                    <div className="mt-2"><SpeakPractice compact text={plain(p.ru)} refKey={`voice:pron:${plain(p.ru)}`} label="Say it" /></div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-mist">Nothing specific to fix this time. Keep listening and copying {t.ru}'s rhythm.</p>}
          </div>
        </div>

        {/* vocabulary */}
        <div>
          <SectionTitle>New vocabulary</SectionTitle>
          <div className="card p-4">
            {r.new_vocabulary.length ? (
              <div className="flex flex-wrap gap-2">
                {r.new_vocabulary.map((w) => (
                  <button key={w.ru} type="button" onClick={() => void playTutor(plain(w.ru), tutor)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left hover:border-white/25">
                    <div className="ru text-base text-white">{w.ru}</div>
                    <div className="text-xs text-mist">{w.en}</div>
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-mist">No new words this time — you reinforced ones you know.</p>}
            <p className="mt-3 text-xs text-faint">Words from the course and your corrected sentences were added to Review.</p>
          </div>
        </div>

        {/* struggled */}
        <div>
          <SectionTitle>Words you struggled with</SectionTitle>
          <div className="card p-4">
            {r.struggled_words.length ? (
              <ul className="grid gap-2.5">
                {r.struggled_words.map((w) => (
                  <li key={w.ru} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="ru text-lg text-white">{w.ru}</span> <span className="text-sm text-mist">· {w.en}</span>
                      {w.why && <div className="text-sm text-faint">{w.why}</div>}
                    </div>
                    <Listen text={w.ru} tutor={tutor} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-mist">Nothing tripped you up. 👏</p>}
          </div>
        </div>
      </div>

      {/* review lesson */}
      <SectionTitle right={onReviewCall && <Button size="sm" variant="secondary" onClick={onReviewCall}><Phone className="size-4" /> Review by phone</Button>}>
        Your personal review
      </SectionTitle>
      <div className="card p-5">
        <div className="flex items-start gap-3">
          <Repeat2 className="mt-1 size-5 shrink-0 text-gold" />
          <div>
            <div className="font-display text-xl font-semibold">{r.review.title}</div>
            <p className="text-sm text-mist">{r.review.intro}</p>
          </div>
        </div>
        <ol className="mt-4 grid gap-3">
          {r.review.items.map((it, i) => <ReviewItem key={i} n={i + 1} item={it} tutor={tutor} />)}
        </ol>
      </div>

      {lines.length > 0 && (
        <div className="mt-6">
          <button type="button" onClick={() => setShowTranscript((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.07] px-4 py-3 text-left text-sm font-semibold hover:bg-white/[0.02]">
            Full transcript ({lines.length} lines)
            <ChevronDown className={`size-4 transition-transform ${showTranscript ? "rotate-180" : ""}`} />
          </button>
          {showTranscript && (
            <div className="card mt-2 max-h-[70vh] overflow-hidden">
              <Transcript lines={lines} tutor={tutor} showEn showPron={false} actions={transcriptActions} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewItem({ n, item, tutor }: { n: number; item: Report["review"]["items"][number]; tutor: TutorId }) {
  const [shown, setShown] = useState(false);
  return (
    <li className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-bold text-mist">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="text-fog">{item.en}</div>
          {shown ? (
            <div className="mt-1.5 animate-rise">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="ru text-xl text-white">{item.ru}</div>
                  <div className="text-[13px] italic text-sky/90">{item.pron || translit(item.ru)}</div>
                  {item.note && <div className="mt-1 flex gap-1.5 text-sm text-mist"><Lightbulb className="mt-0.5 size-3.5 shrink-0 text-gold" /> {item.note}</div>}
                </div>
                <Listen text={item.ru} tutor={tutor} />
              </div>
              <div className="mt-2"><SpeakPractice compact text={plain(item.ru)} refKey={`voice:review:${plain(item.ru)}`} label="Say it" /></div>
            </div>
          ) : (
            <button type="button" onClick={() => setShown(true)} className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-accent-soft">
              Try saying it, then reveal <ArrowUpRight className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
