import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  Captions, CaptionsOff, LifeBuoy, Languages, Mic, MicOff, PhoneOff, RotateCcw, Settings2, Snail, Volume2, VolumeX, Wifi, WifiOff,
} from "lucide-react";
import { MODES, TUTORS, topicById } from "../../../supabase/functions/_shared/voice/curriculum.ts";
import { micHelp, type VoiceCall } from "../../lib/voice/engine";
import { Button, Sheet, Spinner, Toggle } from "../ui";
import { TutorAvatar } from "./TutorAvatar";
import { Suggestions, Transcript } from "./Transcript";
import { Waves } from "./Waves";

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function RoundButton({ on, onClick, label, children, danger, big, disabled }: {
  on?: boolean; onClick: () => void; label: string; children: React.ReactNode; danger?: boolean; big?: boolean; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={on}
        className={`grid place-items-center rounded-full transition-all active:scale-95 disabled:opacity-40 ${big ? "size-[68px]" : "size-14"} ${
          danger ? "bg-danger text-white shadow-[0_10px_30px_-8px_rgb(239_91_91/0.7)] hover:bg-[#f26b6b]" : on ? "bg-white text-ink-950" : "bg-white/[0.09] text-white hover:bg-white/[0.15]"
        }`}
      >
        {children}
      </button>
      <span className="text-[11px] font-medium text-mist">{label}</span>
    </div>
  );
}

export function CallScreen({ call, showEn, showPron, onToggleEn, onTogglePron, onClose }: {
  call: VoiceCall;
  showEn: boolean;
  showPron: boolean;
  onToggleEn: (v: boolean) => void;
  onTogglePron: (v: boolean) => void;
  /** After a failed start, leave the call screen. */
  onClose: () => void;
}) {
  const s = useSyncExternalStore(call.subscribe, call.getSnapshot);
  const [settings, setSettings] = useState(false);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const tutor = TUTORS[s.tutor];
  const topic = topicById(s.lesson);
  const tutorLevel = useCallback(() => call.levels().tutor, [call]);
  const micLevel = useCallback(() => call.levels().mic, [call]);
  const live = s.phase === "live";
  const immersion = s.mode === "immersion";
  const showSuggestions = s.suggestions.length > 0 && live && s.activity === "listening" && (!immersion || s.quiet);

  const actions = useMemo(() => ({
    say: (text: string, rate = 1) => void call.say(text, rate),
    replay: (id: string, rate = 1) => void call.replay(id, rate),
    playing: s.playing,
  }), [call, s.playing]);

  // leaving the page mid-call: warn, and save what we have
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (call.getSnapshot().phase === "live") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const hide = () => call.flush();
    window.addEventListener("beforeunload", before);
    window.addEventListener("pagehide", hide);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("pagehide", hide);
    };
  }, [call]);

  // the call covers the page: stop the page behind it from scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const canPick = "setSinkId" in HTMLMediaElement.prototype;
    if (!canPick || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((d) => setOutputs(d.filter((x) => x.kind === "audiooutput" && x.deviceId))).catch(() => {});
  }, [settings]);

  const status = (() => {
    switch (s.phase) {
      case "mic": return "Allow your microphone…";
      case "connecting": return `Calling ${tutor.ru}…`;
      case "reconnecting": return s.reconnectAttempt ? `Reconnecting… (try ${s.reconnectAttempt})` : "Connection lost — reconnecting…";
      case "ending": return "Saving your call…";
      case "failed": return "Call interrupted";
      default:
        if (s.playing) return "Playing — your mic is paused";
        if (s.muted) return "You're muted";
        return { listening: "Listening — your turn", learner: "You're speaking…", thinking: `${tutor.ru} is thinking…`, tutor: `${tutor.ru} is speaking` }[s.activity];
    }
  })();

  const avatarMode = s.phase === "connecting" || s.phase === "mic" || s.phase === "reconnecting" ? "connecting" : s.phase === "live" ? s.activity : "idle";

  const body = (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-ink-950 text-white" role="dialog" aria-label={`Voice call with ${tutor.ru}`}>
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(900px 520px at 50% -10%, rgb(63 191 127 / 0.14), transparent 65%), radial-gradient(700px 500px at 100% 100%, rgb(122 167 255 / 0.08), transparent 60%)" }} />

      {/* header */}
      <header className="safe-top relative z-10 flex items-center gap-3 px-4 pb-2 pt-3 md:px-6">
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          live ? "bg-accent/15 text-accent-soft" : s.phase === "reconnecting" || s.phase === "failed" ? "bg-warn/15 text-warn" : "bg-white/[0.07] text-fog"
        }`}>
          {s.phase === "reconnecting" || s.phase === "failed" ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
          {live ? "Connected" : s.phase === "reconnecting" ? "Reconnecting" : s.phase === "failed" ? "Disconnected" : s.phase === "ending" ? "Ending" : "Connecting"}
        </div>
        <div className="tabular-nums text-sm font-semibold text-fog" aria-label="Call duration">{clock(s.elapsed)}</div>
        {s.remaining != null && s.remaining <= 300 && live && (
          <div className="whitespace-nowrap text-xs text-warn">{Math.max(1, Math.ceil(s.remaining / 60))} min left</div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onToggleEn(!showEn)} aria-pressed={showEn} title={showEn ? "Hide English" : "Show English"}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold ${showEn ? "bg-white/10 text-white" : "text-mist hover:bg-white/5"}`}>
            {showEn ? <Captions className="size-4" /> : <CaptionsOff className="size-4" />} EN
          </button>
          <button type="button" onClick={() => onTogglePron(!showPron)} aria-pressed={showPron} title={showPron ? "Hide pronunciation guide" : "Show pronunciation guide"}
            className={`h-9 rounded-xl px-2.5 text-xs font-bold ${showPron ? "bg-white/10 text-white" : "text-mist hover:bg-white/5"}`}>
            Aa
          </button>
          <button type="button" onClick={() => setSettings(true)} aria-label="Call settings" className="grid size-9 place-items-center rounded-xl text-fog hover:bg-white/5">
            <Settings2 className="size-[18px]" />
          </button>
        </div>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:mx-auto lg:w-full lg:max-w-6xl lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-1 lg:gap-6 lg:px-6">
        {/* stage */}
        <section className="flex flex-col items-center px-4 lg:justify-center">
          <div className="hidden lg:block"><TutorAvatar tutor={s.tutor} size={190} level={tutorLevel} mic={micLevel} mode={avatarMode} /></div>
          <div className="lg:hidden"><TutorAvatar tutor={s.tutor} size={s.lines.length > 1 ? 104 : 150} level={tutorLevel} mic={micLevel} mode={avatarMode} /></div>
          <div className="-mt-1 text-center lg:mt-2">
            <div className="font-display text-2xl font-semibold leading-tight lg:text-3xl">{tutor.ru}</div>
            <div className="text-xs text-mist lg:text-sm">
              {MODES[s.mode].title}{s.level ? ` · ${s.level}` : ""}{s.review ? " · Review call" : topic ? ` · ${topic.title}` : " · Free conversation"}
            </div>
          </div>
          <div className={`mt-2 text-sm font-medium ${s.activity === "learner" && live ? "text-sky" : "text-fog"}`} aria-live="polite">{status}</div>
          <div className="mt-2 w-40 lg:w-56">
            <Waves level={micLevel} active={live && s.activity === "learner" && !s.muted} color="#7aa7ff" height={22} bars={22} />
          </div>
          {s.needsTap && (
            <Button className="mt-3" onClick={() => call.resumeAudio()}>
              <Volume2 className="size-4" /> Tap to hear {tutor.ru}
            </Button>
          )}
          {s.phase === "failed" && (
            <div className="mt-3 w-full max-w-md rounded-2xl border border-warn/30 bg-warn/[0.07] p-4 text-sm">
              <div className="font-semibold text-warn">{s.errorKind === "mic" ? "Microphone problem" : s.errorKind === "limit" ? "Daily limit reached" : s.errorKind === "setup" ? "Voice calls aren't set up yet" : "Call interrupted"}</div>
              <p className="mt-1 text-fog">{s.error}</p>
              {s.errorKind === "mic" && !/blocked/i.test(s.error ?? "") && <p className="mt-1 text-xs text-mist">{micHelp()}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {s.callId && s.errorKind === "network" && <Button size="sm" onClick={() => void call.reconnect()}>Reconnect</Button>}
                {!s.callId && (s.errorKind === "mic" || s.errorKind === "network" || s.errorKind === "server") && <Button size="sm" onClick={() => void call.start()}>Try again</Button>}
                {s.callId ? (
                  <Button size="sm" variant="secondary" onClick={() => void call.end()}>End call &amp; get report</Button>
                ) : (
                  <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
                )}
              </div>
            </div>
          )}
          {s.phase === "reconnecting" && (
            <div className="mt-3 flex items-center gap-2 rounded-full bg-warn/10 px-3 py-1.5 text-xs text-warn">
              <Spinner className="size-3.5 text-warn" /> Hold on — your conversation is safe.
            </div>
          )}
          {/* suggestions sit under the tutor on big screens */}
          <div className="mt-4 hidden w-full max-w-lg lg:block">
            {showSuggestions && <Suggestions items={s.suggestions} showEn={showEn && !immersion} showPron={showPron} actions={actions} highlight={s.quiet} />}
          </div>
        </section>

        {/* transcript */}
        <section className="relative mt-2 flex min-h-0 flex-col rounded-t-3xl border-t border-white/[0.07] bg-ink-900/70 backdrop-blur lg:my-4 lg:rounded-3xl lg:border">
          <div className="flex items-center justify-between px-4 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-mist">
            <span>Live transcript</span>
            <span className="normal-case tracking-normal text-faint">Tap Russian to hear it</span>
          </div>
          <div className="min-h-0 flex-1 [mask-image:linear-gradient(to_bottom,transparent,black_18px)]">
            <Transcript
              lines={s.lines}
              tutor={s.tutor}
              showEn={showEn}
              showPron={showPron}
              actions={actions}
              empty={<div className="grid h-full place-items-center px-6 text-center text-sm text-mist">{live ? `${tutor.ru} is about to say hello. Just talk — no buttons needed.` : "The conversation will appear here."}</div>}
            />
          </div>
          {showSuggestions && <div className="px-3 pb-2 lg:hidden"><Suggestions items={s.suggestions} showEn={showEn && !immersion} showPron={showPron} actions={actions} highlight={s.quiet} /></div>}
        </section>
      </div>

      {/* controls */}
      <footer className="safe-bottom relative z-10 border-t border-white/[0.06] bg-ink-950/90 backdrop-blur">
        <div className="no-scrollbar mx-auto flex max-w-xl gap-2 overflow-x-auto px-4 pt-3">
          <button type="button" disabled={!live} onClick={() => call.askHelp()} className="chip shrink-0 !py-1.5 text-xs"><LifeBuoy className="size-3.5 text-gold" /> Help me answer</button>
          <button type="button" disabled={!live} onClick={() => call.askRepeat()} className="chip shrink-0 !py-1.5 text-xs"><Snail className="size-3.5 text-accent" /> Repeat slower</button>
          <button type="button" disabled={!live} onClick={() => call.askEnglish()} className="chip shrink-0 !py-1.5 text-xs"><Languages className="size-3.5 text-sky" /> In English</button>
        </div>
        <div className="mx-auto flex max-w-xl items-start justify-between px-5 pb-3 pt-3 sm:justify-center sm:gap-6">
          <RoundButton on={s.muted} onClick={() => call.setMuted(!s.muted)} label={s.muted ? "Unmute" : "Mute"} disabled={!live}>
            {s.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
          </RoundButton>
          <RoundButton on={s.speakerMuted} onClick={() => call.setSpeakerMuted(!s.speakerMuted)} label={s.speakerMuted ? "Speaker off" : "Speaker"}>
            {s.speakerMuted ? <VolumeX className="size-6" /> : <Volume2 className="size-6" />}
          </RoundButton>
          <RoundButton danger big onClick={() => (s.phase === "failed" && !s.callId ? onClose() : void call.end())} label="End" disabled={s.phase === "ending"}>
            <PhoneOff className="size-7" />
          </RoundButton>
          <RoundButton on={s.slow} onClick={() => call.setSlow(!s.slow)} label={s.slow ? "Slow: on" : "Slow"}>
            <Snail className="size-6" />
          </RoundButton>
          <RoundButton onClick={() => call.replayLast(s.slow ? 0.75 : 1)} label="Repeat" disabled={!s.lines.some((l) => l.role === "tutor" && l.final)}>
            <RotateCcw className="size-6" />
          </RoundButton>
        </div>
      </footer>

      {s.phase === "ending" && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/80 backdrop-blur-sm">
          <div className="flex flex-col items-center text-center">
            <Spinner className="size-8" />
            <div className="mt-4 font-display text-2xl font-semibold">Call ended · {clock(s.elapsed)}</div>
            <div className="mt-1 text-mist">{tutor.ru} is writing your report…</div>
          </div>
        </div>
      )}

      <Sheet open={settings} onClose={() => setSettings(false)} title="Call settings">
        <div className="divide-y divide-white/[0.06]">
          <Toggle checked={showEn} onChange={onToggleEn} label="English translations" hint="Hide them once you're comfortable." />
          <Toggle checked={showPron} onChange={onTogglePron} label="Pronunciation guide" hint="Stress in CAPITALS, written the way it sounds." />
          <Toggle checked={s.slow} onChange={(v) => call.setSlow(v)} label="Slow speech" hint={`${tutor.ru} speaks more slowly.`} />
          <Toggle checked={!s.speakerMuted} onChange={(v) => call.setSpeakerMuted(!v)} label="Speaker" hint="Turn the tutor's voice on or off." />
          <div className="py-3">
            <div className="flex items-center justify-between text-sm font-medium"><span>Volume</span><span className="tabular-nums text-mist">{Math.round(s.volume * 100)}%</span></div>
            <input type="range" className="range mt-3" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => call.setVolume(Number(e.target.value))} aria-label="Volume" />
            <p className="mt-2 text-xs text-faint">On iPhone, use the side buttons for volume.</p>
          </div>
          {outputs.length > 1 && (
            <label className="block py-3">
              <span className="text-sm font-medium">Play through</span>
              <select className="field mt-2" onChange={(e) => void call.setOutputDevice(e.target.value)} defaultValue="">
                <option value="" disabled>Choose speaker or headphones</option>
                {outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Audio output"}</option>)}
              </select>
            </label>
          )}
        </div>
      </Sheet>
    </div>
  );
  return createPortal(body, document.body);
}
