import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Crown, Flame, Languages, Lightbulb, Mic, RotateCcw, Send, Settings2, Sparkles, Square, Timer } from "lucide-react";
import { useSession } from "../state/session";
import { useToast } from "../state/toast";
import { rpPending, useRp, type Msg } from "../state/rpStore";
import { answer, ensure, flush, ruName, start } from "../lib/roleplay/session";
import { MODES, PARTNERS, assist, charOf, hints, type Line, type Mode, type Turn } from "../lib/roleplay/engine";
import { BANK } from "../lib/roleplay/bank";
import { LEVELS, type Lvl } from "../lib/roleplay/types";
import { canRecognize, listen, speak } from "../lib/speech";
import { AudioButtons, SpeakPractice } from "./Audio";
import { Button, LevelBadge, Sheet } from "./ui";

/**
 * The conversation partner, between moves or on its own page: their Russian line
 * (with English and audio), your answer by text or voice, and feedback — corrections
 * explained in English, a native alternative and why, and a "say it" to repeat.
 */
export default function RoleplayChat({ inGame = false, compact = false }: { inGame?: boolean; compact?: boolean }) {
  const { uid, profile, tutorAI } = useSession();
  const { s, mem, busy } = useRp();
  const toast = useToast();
  const [text, setText] = useState("");
  const [rec, setRec] = useState<ReturnType<typeof listen> | null>(null);
  const [settings, setSettings] = useState(false);
  const [showHints, setShowHints] = useState<boolean | null>(null);
  const [older, setOlder] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const spoken = useRef<number>(0);
  const myName = ruName(profile?.display_name);

  useEffect(() => {
    if (uid && profile) ensure({ uid, forms: profile.ru_forms === "f" ? "f" : "m", level: (profile.ru_level ?? "A1") as Lvl, myName, ai: tutorAI });
  }, [uid, profile?.ru_forms, profile?.ru_level, tutorAI]); // eslint-disable-line react-hooks/exhaustive-deps

  // outside a game there's no move to wait for
  useEffect(() => {
    if (!inGame && s?.queued.length) flush();
  }, [inGame, s?.queued.length]);

  const st = s?.st;
  const help = st ? assist(st) : null;
  const pending = rpPending(s);
  const msgs = s?.msgs ?? [];
  const KEEP = 4;
  const shown = compact && !older ? msgs.slice(-KEEP) : msgs;
  const partner = st ? charOf(st) : null;
  const hintList = useMemo(() => (st && mem ? hints(st, mem, myName) : []), [st?.cur?.id, st?.forms, mem?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const hintsOpen = showHints ?? help?.hints === "open";

  // read the partner's new line aloud (once)
  useEffect(() => {
    const last = msgs.at(-1);
    if (!last || last.who !== "ai" || last.id === spoken.current || !help) return;
    spoken.current = last.id;
    if (last.line.kind === "note" || !last.line.ru) return;
    if (Date.now() - last.at > 4000) return;
    const t = setTimeout(() => speak(last.line.ru, { rate: help.rate, voice: profile?.voice ?? "female", userRate: Number(profile?.speech_rate ?? 1) }).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [msgs.length, busy]);

  useEffect(() => {
    setShowHints(null);
  }, [st?.cur?.id]);

  if (!s || !st || !partner || !help) return <div className="rounded-2xl border border-white/10 p-3 text-sm text-mist">Starting the conversation…</div>;

  const send = (via: "text" | "voice", value = text) => {
    if (!value.trim()) return;
    setText("");
    setShowHints(false);
    answer(value, via, inGame);
  };

  const mic = async () => {
    if (rec) return rec.stop();
    if (!canRecognize()) return toast({ title: "Speech recognition isn't available in this browser.", body: "Type your answer instead — Latin letters work too (privet → привет)." });
    try {
      const l = listen((t) => setText(t));
      setRec(l);
      const r = await l.result;
      setRec(null);
      if (!r.transcript) return toast({ title: "Nothing came through — try again closer to the mic, or type it." });
      send("voice", r.transcript);
    } catch (e) {
      setRec(null);
      toast({ title: (e as Error).message, tone: "error" });
    }
  };

  const mode = MODES.find((m) => m.v === st.mode)!;
  const scen = st.mode === "roleplay" ? BANK.scenarios.find((x) => x.id === st.scenario) : null;

  return (
    <div className={compact ? "" : "card p-4"} data-roleplay={st.mode}>
      {/* who you're talking to, and how */}
      <div className="mb-2 flex items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/15 font-display text-sm font-semibold text-accent-soft">{partner.name.ru[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold"><span className="ru">{partner.name.ru}</span> <span className="font-normal text-mist">· {scen ? scen.title.en : mode.label}</span></div>
        </div>
        {st.mode === "challenge" && <span className="flex items-center gap-1 rounded-lg bg-gold/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-gold"><Flame className="size-3.5" />{st.streak}/10</span>}
        {st.mode === "quick" && <span className="flex items-center gap-1 rounded-lg bg-sky/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-sky"><Timer className="size-3.5" />{st.quick.n}/10</span>}
        <LevelBadge level={st.level} />
        <button className="grid size-8 place-items-center rounded-lg text-mist hover:bg-white/5" onClick={() => setSettings(true)} aria-label="Conversation settings">
          <Settings2 className="size-4" />
        </button>
      </div>

      {compact && msgs.length > KEEP && (
        <button className="mb-1 flex items-center gap-1 text-xs font-semibold text-mist hover:text-fog" onClick={() => setOlder(!older)}>
          {older ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />} {older ? "Show less" : `Earlier (${msgs.length - KEEP})`}
        </button>
      )}

      <div className={`grid gap-2 ${compact ? "" : "max-h-[55vh] overflow-y-auto pr-1"}`}>
        {shown.map((m) => (m.who === "ai" ? <AiBubble key={m.id} line={m.line} en={help.en} /> : <MeBubble key={m.id} m={m} forms={st.forms} />))}
        {busy && <div className="w-16 rounded-2xl bg-white/[0.05] px-3 py-2 text-mist"><span className="animate-pulse">•••</span></div>}
        {inGame && s.queued.length > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs text-faint">
            <span>{partner.name.ru} will answer after the next move.</span>
            <button className="font-semibold text-accent-soft" onClick={flush}>Now</button>
          </div>
        )}
      </div>

      {/* your answer */}
      <div className="mt-3">
        {help.hints !== "none" && hintList.length > 0 && pending && (
          <div className="mb-2">
            {hintsOpen ? (
              <div className="grid gap-1.5" data-rp-hints>
                {hintList.slice(0, help.hints === "open" ? 3 : 2).map((h) => (
                  <button key={h.ru} onClick={() => setText(h.ru)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left hover:bg-white/[0.06]">
                    <div className="ru text-[15px]">{h.ru}</div>
                    <div className="text-xs text-mist">{h.en}</div>
                  </button>
                ))}
              </div>
            ) : (
              <button className="flex items-center gap-1 text-xs font-semibold text-mist hover:text-fog" onClick={() => setShowHints(true)}>
                <Lightbulb className="size-3.5 text-gold" /> Help me answer
              </button>
            )}
          </div>
        )}
        <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); send("text"); }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={pending ? "Ответь по-русски…" : "Напиши что-нибудь…"}
            lang="ru"
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="send"
            className="ru h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[17px] outline-none placeholder:text-faint focus:border-accent/50"
            aria-label="Your answer in Russian"
          />
          <button type="button" onClick={mic} aria-label={rec ? "Stop" : "Answer by voice"} className={`grid size-11 shrink-0 place-items-center rounded-xl ${rec ? "bg-danger text-white" : "bg-white/[0.07] text-white hover:bg-white/[0.12]"}`}>
            {rec ? <Square className="size-4 fill-current" /> : <Mic className="size-5" />}
          </button>
          <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-ink-950 disabled:opacity-40">
            <Send className="size-5" />
          </button>
        </form>
        {rec && <div className="mt-1 text-xs text-accent-soft">Listening… speak in Russian, then tap stop.</div>}
        <div ref={end} />
      </div>

      <Settings open={settings} onClose={() => setSettings(false)} current={{ mode: st.mode, scenario: st.scenario, partner: st.partner }} level={st.level} />
    </div>
  );
}

function AiBubble({ line, en }: { line: Line; en: "auto" | "tap" | "never" }) {
  const [show, setShow] = useState(en === "auto");
  if (line.kind === "note") {
    return (
      <div className="rounded-xl border border-sky/20 bg-sky/[0.05] px-3 py-2 text-sm" data-rp="note">
        {line.ru && <div className="ru font-semibold text-sky">{line.ru}</div>}
        <div className="text-mist">{line.en}</div>
      </div>
    );
  }
  const remark = line.kind === "remark";
  return (
    <div className={`max-w-[94%] rounded-2xl px-3 py-2 ${remark ? "border border-white/[0.06] bg-transparent" : "bg-white/[0.06]"}`} data-rp={line.kind}>
      <div className="flex items-start gap-2">
        {remark && <Crown className="mt-1 size-3.5 shrink-0 text-gold" />}
        <div className={`ru min-w-0 flex-1 leading-snug ${remark ? "text-[15px] text-fog" : "text-[18px]"}`}>{line.ru}</div>
        <AudioButtons text={line.ru} compact />
      </div>
      {show ? (
        <div className="mt-0.5 text-sm text-mist">{line.en}</div>
      ) : en === "tap" ? (
        <button className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-faint hover:text-mist" onClick={() => setShow(true)}><Languages className="size-3.5" /> English</button>
      ) : null}
      {line.words && line.kind === "ask" && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {line.words.map((w) => (
            <span key={w.ru} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-xs"><span className="ru text-[13px] text-fog">{w.ru}</span> <span className="text-mist">— {w.en}</span></span>
          ))}
        </div>
      )}
      {line.tip && en !== "never" && <div className="mt-1.5 flex gap-1.5 text-xs text-gold/90"><Lightbulb className="mt-0.5 size-3.5 shrink-0" />{line.tip}</div>}
    </div>
  );
}

function MeBubble({ m, forms }: { m: Extract<Msg, { who: "me" }>; forms: "m" | "f" }) {
  const t: Turn = m.turn;
  const real = t.fixes.filter((f) => !f.soft);
  const soft = t.fixes.filter((f) => f.soft);
  const target = real.length ? t.corrected : t.natural?.ru ?? null;
  return (
    <div className="grid justify-items-end gap-1" data-rp="me">
      <div className="max-w-[90%] rounded-2xl bg-accent/15 px-3 py-2">
        <div className="ru text-[17px] leading-snug">{t.said}</div>
        {t.translit && <div className="text-[11px] text-mist">Converted from Latin letters</div>}
      </div>
      <div className="w-full max-w-[94%] rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm" data-rp-feedback>
        {t.english ? (
          <div className="text-warn">Try it in Russian — here's one way:</div>
        ) : real.length ? (
          <>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-warn">Corrected</div>
                <div className="ru text-[16px]">{t.corrected}</div>
              </div>
              <AudioButtons text={t.corrected} compact />
            </div>
            <ul className="mt-1 grid gap-0.5 text-[13px] text-fog">
              {real.map((f, i) => (
                <li key={i}><span className="ru text-danger line-through decoration-1">{f.from}</span> → <span className="ru text-accent-soft">{f.to}</span>: {f.why}</li>
              ))}
            </ul>
          </>
        ) : t.perfect ? (
          <div className="flex items-center gap-1.5 text-accent-soft"><Check className="size-4" /> Perfect — that's exactly how a native would say it.</div>
        ) : (
          <div className="flex items-center gap-1.5 text-accent-soft"><Check className="size-4" /> {t.understood ? "Understood — no mistakes." : "Hmm, not sure I understood — try a full sentence."}</div>
        )}
        {soft.length > 0 && (
          <div className="mt-1 text-[12px] text-mist">
            {soft.map((f, i) => <span key={i} className="mr-2">✎ <span className="ru">{f.from} → {f.to}</span> <span className="text-faint">({f.why})</span></span>)}
          </div>
        )}
        {t.natural && (
          <div className="mt-2 border-t border-white/[0.06] pt-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-sky">{t.english ? "In Russian" : "A native speaker might say"}</div>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="ru text-[16px]">{t.natural.ru}</div>
                {t.natural.en && <div className="text-xs text-mist">{t.natural.en}</div>}
              </div>
              <AudioButtons text={t.natural.ru} compact />
            </div>
            <div className="mt-0.5 flex gap-1 text-[12px] text-fog"><Sparkles className="mt-0.5 size-3 shrink-0 text-sky" />{t.natural.why}</div>
          </div>
        )}
        {target && (
          <div className="mt-2">
            <SpeakPractice key={target + forms} text={target} refKey="roleplay" compact label="Say it" />
          </div>
        )}
        {t.notes.length > 0 && !t.english && <div className="mt-1.5 text-[12px] text-accent-soft">{t.notes.join(" ")}</div>}
        {t.quickSummary && (
          <div className="mt-2 rounded-lg bg-sky/10 px-2 py-1.5 text-[13px] text-sky">
            Round done: {t.quickSummary.avgScore}/100 · {(t.quickSummary.avgMs / 1000).toFixed(1)} s per answer
          </div>
        )}
        {t.events.includes("challenge-done") && <div className="mt-2 rounded-lg bg-gold/10 px-2 py-1.5 text-[13px] font-semibold text-gold">🎉 10 exchanges in Russian, no English — challenge complete!</div>}
        {t.events.includes("level-up") && <div className="mt-2 text-[13px] font-semibold text-accent-soft">You're doing great — the conversation moves up a level.</div>}
        {t.events.includes("level-down") && <div className="mt-2 text-[13px] text-mist">Let's keep it a little simpler for a while.</div>}
      </div>
    </div>
  );
}

function Settings({ open, onClose, current, level }: { open: boolean; onClose: () => void; current: { mode: Mode; scenario: string | null; partner: string }; level: Lvl }) {
  const [mode, setMode] = useState<Mode>(current.mode);
  const [partner, setPartner] = useState(current.partner);
  useEffect(() => {
    if (open) {
      setMode(current.mode);
      setPartner(PARTNERS.includes(current.partner as never) ? current.partner : "nastya");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = (o: { mode: Mode; scenario?: string | null; partner?: string }) => {
    start(o);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Conversation">
      <div className="grid gap-2">
        {MODES.map((m) => (
          <button key={m.v} onClick={() => setMode(m.v)} className={`rounded-xl border px-3 py-2 text-left ${mode === m.v ? "border-accent/60 bg-accent/[0.08]" : "border-white/10 hover:bg-white/[0.04]"}`}>
            <div className="text-sm font-semibold">{m.label} <span className="ru font-normal text-mist">· {m.ru}</span></div>
            <div className="text-xs text-mist">{m.about}</div>
          </button>
        ))}
      </div>
      {mode === "roleplay" ? (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist">Choose a situation</div>
          {LEVELS.map((lv) => {
            const list = BANK.scenarios.filter((x) => x.level === lv);
            if (!list.length) return null;
            return (
              <div key={lv} className="mb-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-mist"><LevelBadge level={lv} /> {lv === level ? "your level" : ""}</div>
                <div className="grid gap-1.5">
                  {list.map((x) => (
                    <button key={x.id} onClick={() => go({ mode: "roleplay", scenario: x.id })} className={`rounded-xl border px-3 py-2 text-left hover:bg-white/[0.04] ${current.scenario === x.id && current.mode === "roleplay" ? "border-accent/50" : "border-white/10"}`} data-scenario={x.id}>
                      <div className="text-sm font-semibold">{x.title.en} <span className="ru font-normal text-mist">· {x.title.ru}</span></div>
                      <div className="text-xs text-mist">{x.about}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-mist">Talk with</div>
          <div className="grid gap-1.5">
            {PARTNERS.map((p) => {
              const c = BANK.chars[p];
              return (
                <button key={p} onClick={() => setPartner(p)} className={`rounded-xl border px-3 py-2 text-left ${partner === p ? "border-accent/60 bg-accent/[0.08]" : "border-white/10 hover:bg-white/[0.04]"}`}>
                  <div className="ru text-sm font-semibold">{c.name.ru}</div>
                  <div className="text-xs text-mist">{c.about}</div>
                </button>
              );
            })}
          </div>
          <Button className="mt-4 w-full" onClick={() => go({ mode, partner })}>Start talking</Button>
        </div>
      )}
      <button className="mt-4 flex items-center gap-1.5 text-sm text-mist hover:text-fog" onClick={() => go({ mode: current.mode, scenario: current.scenario, partner: current.partner })}>
        <RotateCcw className="size-4" /> Start this conversation over
      </button>
    </Sheet>
  );
}
