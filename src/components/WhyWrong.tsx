/** After a wrong answer: why the option the learner picked doesn't fit. */
export function WhyWrong({ picked, note, ru }: { picked: string; note: string | undefined; ru: boolean }) {
  if (!note) return null;
  return (
    <div className="mt-2 animate-rise rounded-xl border border-warn/25 bg-warn/[0.06] px-3 py-2.5" data-why-wrong>
      <div className="text-xs font-semibold text-warn">
        Why not {ru ? <span className="ru text-sm">«{picked}»</span> : `“${picked}”`}?
      </div>
      <p className="mt-1 text-[15px] leading-snug text-fog">{note}</p>
    </div>
  );
}
