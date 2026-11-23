import { useEffect, useState } from "react";

/** True while the CSS media query matches (e.g. "(min-width: 1024px)"). */
export function useMedia(query: string): boolean {
  const get = () => typeof window !== "undefined" && !!window.matchMedia?.(query).matches;
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => {
      mq.removeEventListener("change", on);
    };
  }, [query]);
  return match;
}

/** Desktop layout (the learning panel sits beside the board). */
export const useWide = () => useMedia("(min-width: 1024px)");
