import { useEffect, useRef } from "react";

/** Live sound bars driven by a loudness source (0–1). Quiet sources settle to a flat, calm line. */
export function Waves({ level, active, color = "#3fbf7f", bars = 28, height = 36, className = "" }: {
  level: () => number;
  active: boolean;
  color?: string;
  bars?: number;
  height?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const heights = new Array(bars).fill(0);
    const draw = (t: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const v = activeRef.current ? Math.max(level(), 0.06) : level() * 0.4;
      const gap = 3;
      const bw = Math.max(2, (w - gap * (bars - 1)) / bars);
      for (let i = 0; i < bars; i++) {
        // a soft envelope across the bars, wobbling with time
        const env = Math.sin(((i + 0.5) / bars) * Math.PI);
        const wob = 0.55 + 0.45 * Math.sin(t / 90 + i * 1.7) * Math.cos(t / 210 + i * 0.6);
        const target = Math.max(0.06, v * env * (0.6 + 0.8 * wob));
        heights[i] += (target - heights[i]) * 0.3;
        const bh = Math.max(2, heights[i] * h);
        ctx.fillStyle = color;
        ctx.globalAlpha = activeRef.current ? 0.35 + 0.65 * Math.min(1, heights[i] * 2) : 0.18;
        const x = i * (bw + gap);
        const y = (h - bh) / 2;
        const r = Math.min(bw / 2, bh / 2);
        ctx.beginPath();
        if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, bw, bh, r);
        else ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [level, bars, color]);

  return <canvas ref={ref} className={`block w-full ${className}`} style={{ height }} aria-hidden />;
}
