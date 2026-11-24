import { useNavigate } from "react-router-dom";
import { CornerDownRight, Lightbulb, Link2 } from "lucide-react";
import type { FollowUp, Line } from "../lib/types";
import { connectorsIn } from "../lib/connectors";
import { useSession } from "../state/session";
import { RussianLine, type StressMap } from "./RussianText";
import { AudioButtons } from "./Audio";

/**
 * A conversation lesson: question → answer pairs that lead into each other.
 * Each question and answer has its own audio and speaking practice; English
 * stays hidden until you ask for it. Under every answer: a grammar note and
 * other questions you could ask next (some lead into other conversations).
 */
export function ConversationSection({ section, lessonId, stress }: { section: { title: string; lines: Line[] }; lessonId: string; stress?: StressMap }) {
  const pairs = section.lines.flatMap((l, k) => (l.role === "q" && section.lines[k + 1] ? [{ q: l, a: section.lines[k + 1] }] : []));
  const linking = connectorsIn(pairs.map((p) => p.a.ru).join(" "));
  return (
    <section className="mt-8" data-conversation>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-mist">Conversation{section.title ? ` · ${section.title}` : ""}</h2>
      {linking.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
          <span className="mr-1 text-xs text-faint">Linking words here:</span>
          {linking.map((c) => (
            <span key={c.ru} className="rounded-lg bg-white/[0.05] px-2 py-0.5"><span className="ru text-fog">{c.ru}</span> <span className="text-mist">· {c.en}</span></span>
          ))}
        </div>
      )}
      <div className="grid gap-3">
        {pairs.map(({ q, a }, n) => (
          <div key={n} className="card overflow-hidden" data-exchange={q.x}>
            <div className="p-5 pb-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-sky">Question {n + 1}</div>
              <RussianLine line={q} stress={stress} saveSource="lesson" practiceRef={`lesson:${lessonId}`} />
            </div>
            <div className="border-t border-white/[0.06] bg-white/[0.015] p-5">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-accent-soft">Answer</div>
              <RussianLine line={{ ...a, note: undefined }} stress={stress} saveSource="lesson" practiceRef={`lesson:${lessonId}`} />
              {a.note && (
                <div className="mt-3 flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-sm text-fog">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-gold" /> <span>{a.note}</span>
                </div>
              )}
              {!!a.follow?.length && (
                <div className="mt-4">
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-mist">Keep it going — you could also ask</div>
                  <div className="grid gap-1.5">{a.follow.map((f) => <FollowRow key={f.ru} f={f} lessonId={lessonId} />)}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FollowRow({ f, lessonId }: { f: FollowUp; lessonId: string }) {
  const { profile } = useSession();
  const navigate = useNavigate();
  const ru = profile?.ru_forms === "f" && f.ruF ? f.ruF : f.ru;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-white/[0.03] px-3 py-2">
      <CornerDownRight className="mt-1 size-4 shrink-0 text-faint" />
      <div className="min-w-0 flex-1">
        <div className="ru text-[17px]">{ru}</div>
        <div className="text-xs text-mist">{f.en}</div>
        {f.link && (f.link.startsWith(`${lessonId}:`) ? (
          <button className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sky" onClick={() => document.querySelector(`[data-exchange="${f.link}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <Link2 className="size-3" /> Comes up later in this conversation
          </button>
        ) : (
          <button className="mt-1 inline-flex items-center gap-1 text-left text-xs font-semibold text-sky" onClick={() => navigate(`/learn/lesson/${f.link!.split(":")[0]}`)}>
            <Link2 className="size-3 shrink-0" /> Answered in “{f.linkTopic}”{f.linkLevel ? ` · ${f.linkLevel}` : ""}
          </button>
        ))}
      </div>
      <AudioButtons text={ru} compact />
    </div>
  );
}
