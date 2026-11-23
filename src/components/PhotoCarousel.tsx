import { useRef, useState, type ReactNode } from "react";
import { Photo } from "./ui";

export function PhotoCarousel({ photos, name, overlay }: { photos: string[]; name: string; overlay?: ReactNode }) {
  const [idx, setIdx] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(photos.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-ink-800">
      <div
        ref={track}
        className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {photos.map((p, i) => (
          <div key={p} className="relative size-full shrink-0 snap-center">
            <Photo path={p} alt={`${name} photo ${i + 1}`} className="absolute inset-0" />
          </div>
        ))}
      </div>
      {/* tap zones for quick navigation */}
      <button aria-label="Previous photo" className="absolute inset-y-0 left-0 w-1/4" onClick={() => go(idx - 1)} />
      <button aria-label="Next photo" className="absolute inset-y-0 right-0 w-1/4" onClick={() => go(idx + 1)} />
      {photos.length > 1 && (
        <div className="safe-top pointer-events-none absolute inset-x-3 top-2 flex gap-1">
          {photos.map((p, i) => (
            <span key={p} className={`h-1 flex-1 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-transparent to-ink-950/40" />
      {overlay}
    </div>
  );
}
