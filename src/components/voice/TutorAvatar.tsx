import { useEffect, useId, useRef } from "react";
import type { TutorId } from "../../../supabase/functions/_shared/voice/curriculum.ts";

/**
 * The tutor's animated portrait: an illustrated face that blinks, a mouth that
 * moves with the tutor's real voice level, and rings that pulse while they talk
 * or while you talk.
 */
export function TutorAvatar({
  tutor,
  size = 180,
  level,
  mic,
  mode = "idle",
}: {
  tutor: TutorId;
  size?: number;
  /** Live loudness of the tutor's voice, 0–1. */
  level?: () => number;
  /** Live loudness of your microphone, 0–1. */
  mic?: () => number;
  mode?: "idle" | "connecting" | "listening" | "learner" | "thinking" | "tutor" | "ended";
}) {
  const mouth = useRef<SVGEllipseElement>(null);
  const rings = useRef<(HTMLDivElement | null)[]>([]);
  const glow = useRef<HTMLDivElement>(null);
  const modeRef = useRef(mode);
  // unique per instance: a gradient defined inside a hidden copy would blank out the visible one
  const uid = useId().replace(/:/g, "");
  modeRef.current = mode;

  useEffect(() => {
    let raf = 0;
    let smooth = 0;
    let smoothMic = 0;
    const loop = (t: number) => {
      const m = modeRef.current;
      const raw = level?.() ?? 0;
      // Some browsers can't measure a remote voice: fall back to a gentle synthetic motion while speaking.
      const v = m === "tutor" ? Math.max(raw, 0.12 + 0.2 * Math.abs(Math.sin(t / 110)) * Math.abs(Math.sin(t / 47))) : raw * 0.4;
      smooth += (v - smooth) * 0.35;
      smoothMic += ((m === "learner" ? Math.max(mic?.() ?? 0, 0.12) : (mic?.() ?? 0) * 0.6) - smoothMic) * 0.3;
      if (mouth.current) {
        mouth.current.setAttribute("ry", String(1.3 + Math.min(1, smooth) * 4.2));
        mouth.current.setAttribute("rx", String(6.2 - Math.min(1, smooth) * 1.2));
      }
      const pulse = m === "tutor" ? smooth : m === "learner" ? smoothMic : m === "connecting" || m === "thinking" ? 0.08 + 0.06 * Math.sin(t / 300) : 0;
      rings.current.forEach((r, i) => {
        if (!r) return;
        const s = 1 + pulse * (0.18 + i * 0.16) + (m === "connecting" ? ((t / 1400 + i / 3) % 1) * 0.35 : 0);
        r.style.transform = `scale(${s})`;
        r.style.opacity = String(m === "connecting" ? 0.5 - ((t / 1400 + i / 3) % 1) * 0.5 : Math.min(0.9, 0.12 + pulse * (1.3 - i * 0.3)));
      });
      if (glow.current) glow.current.style.opacity = String(0.35 + pulse * 0.9);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [level, mic]);

  const learnerTone = mode === "learner";
  const ringColor = learnerTone ? "rgb(122 167 255 / 0.55)" : "rgb(63 191 127 / 0.55)";
  const anya = tutor === "anya";

  return (
    <div className="relative grid place-items-center" style={{ width: size * 1.55, height: size * 1.55 }}>
      <div ref={glow} className="absolute rounded-full blur-3xl transition-colors duration-500" style={{ width: size * 1.2, height: size * 1.2, background: learnerTone ? "rgb(122 167 255 / 0.22)" : "rgb(63 191 127 / 0.2)" }} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => {
            rings.current[i] = el;
          }}
          className="absolute rounded-full border-2 transition-[border-color] duration-500"
          style={{ width: size, height: size, borderColor: ringColor, willChange: "transform, opacity" }}
        />
      ))}
      <div className="relative overflow-hidden rounded-full shadow-[0_20px_60px_-15px_rgb(0_0_0/0.7)] ring-1 ring-white/15" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={anya ? "Аня, your tutor" : "Миша, your tutor"}>
          <defs>
            <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={anya ? "#2a8f5c" : "#3a5ba8"} />
              <stop offset="1" stopColor={anya ? "#14402c" : "#1b2a4d"} />
            </linearGradient>
            <linearGradient id={`skin-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f3c9a8" />
              <stop offset="1" stopColor="#e5b08c" />
            </linearGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#bg-${uid})`} />
          {/* shoulders */}
          <path d="M14 100 C16 80 32 74 50 74 C68 74 84 80 86 100 Z" fill={anya ? "#e8e1d4" : "#2f3b52"} />
          <path d="M42 74 L50 84 L58 74 Z" fill={anya ? "#d6cdbd" : "#e9ecf2"} />
          {/* hair behind */}
          {anya && <path d="M24 52 C22 28 36 16 51 16 C67 16 80 28 77 54 C76 66 79 74 82 80 C70 82 64 76 62 70 L38 70 C36 76 30 82 18 80 C22 72 25 64 24 52 Z" fill="#5b3424" />}
          {/* neck */}
          <path d="M43 62 L43 75 C46 78 54 78 57 75 L57 62 Z" fill="#dba684" />
          {/* face */}
          <ellipse cx="50" cy="47" rx="19" ry="22" fill={`url(#skin-${uid})`} />
          {/* ears */}
          <ellipse cx="31" cy="49" rx="3" ry="5" fill="#e3ab88" />
          <ellipse cx="69" cy="49" rx="3" ry="5" fill="#e3ab88" />
          {/* hair front */}
          {anya ? (
            <path d="M30 44 C30 28 40 21 52 21 C63 21 71 29 70 42 C64 34 56 30 46 31 C40 32 34 37 30 44 Z" fill="#6b3d29" />
          ) : (
            <path d="M31 42 C30 27 40 20 51 20 C63 20 71 27 69 41 C66 34 62 31 56 30 C49 29 43 31 39 33 C35 35 33 38 31 42 Z" fill="#3b2a20" />
          )}
          {/* brows */}
          <path d="M38.5 39.5 Q43 37.5 46.5 39.3" stroke={anya ? "#5b3424" : "#2d2019"} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M53.5 39.3 Q57 37.5 61.5 39.5" stroke={anya ? "#5b3424" : "#2d2019"} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          {/* eyes (blink) */}
          <g className="origin-center animate-[blink_5.5s_infinite]" style={{ transformBox: "fill-box" }}>
            <ellipse cx="42.5" cy="45" rx="2.2" ry="2.6" fill="#2a1d17" />
            <ellipse cx="57.5" cy="45" rx="2.2" ry="2.6" fill="#2a1d17" />
            <circle cx="43.3" cy="44.1" r="0.7" fill="#fff" />
            <circle cx="58.3" cy="44.1" r="0.7" fill="#fff" />
          </g>
          {/* nose */}
          <path d="M50 47 Q48.6 53 50.8 53.6" stroke="#c98d6c" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          {/* cheeks */}
          <ellipse cx="38" cy="54" rx="3.6" ry="2.2" fill="#ef9a8a" opacity="0.35" />
          <ellipse cx="62" cy="54" rx="3.6" ry="2.2" fill="#ef9a8a" opacity="0.35" />
          {/* beard shadow (Misha) */}
          {!anya && <path d="M33 52 C34 64 42 69 50 69 C58 69 66 64 67 52 C64 60 58 63 50 63 C42 63 36 60 33 52 Z" fill="#3b2a20" opacity="0.28" />}
          {/* mouth */}
          <ellipse ref={mouth} cx="50" cy="59.5" rx="6.2" ry="1.3" fill="#7a2e33" />
          <path d="M43 58.2 Q50 61.5 57 58.2" stroke="#7a2f2f" strokeWidth="0.9" fill="none" strokeLinecap="round" opacity="0.55" />
        </svg>
      </div>
    </div>
  );
}
