// Your place in a lesson's exercises, kept on this device. The Lesson page and
// the panel next to the chessboard read and write the same save, so a lesson
// started in one can be continued in the other.
import type { Exercise } from "./exercises";
import { clearSave, listSaves, loadSave, writeSave } from "./saved";

export type PracticeSave = { exercises: Exercise[]; i: number; right: number; wrong: Exercise[]; picked: string | null };
/** `y`: how far down the lesson page you'd read. */
export type LessonSave = { phase: "study" | "practice"; y?: number; practice?: PracticeSave };

export const lessonSlot = (id: string) => `lesson:${id}`;

export const validPractice = (p: PracticeSave | undefined | null): p is PracticeSave =>
  !!p && Array.isArray(p.exercises) && p.exercises.length > 0 && Number.isInteger(p.i) && p.i >= 0 && p.i < p.exercises.length && Array.isArray(p.wrong) && Number.isFinite(p.right);

/** Keeps a place in the exercises or a reading position worth coming back to; otherwise forgets the lesson. */
export function writeLessonSave(uid: string | null | undefined, id: string, next: LessonSave) {
  if (next.practice || (next.y ?? 0) > 200) writeSave(uid, lessonSlot(id), next);
  else clearSave(uid, lessonSlot(id));
}

/** Updates just the exercises part of a lesson's save (null = the exercises are finished). */
export function savePractice(uid: string | null | undefined, id: string, practice: PracticeSave | null) {
  const cur = loadSave<LessonSave>(uid, lessonSlot(id)) ?? { phase: "study" };
  writeLessonSave(uid, id, { ...cur, phase: practice ? cur.phase : "study", practice: practice ?? undefined });
}

/** The lesson whose exercises you most recently worked on, if any. */
export function lessonInProgress(uid: string | null | undefined): string | null {
  const hit = listSaves<LessonSave>(uid, "lesson:").find((s) => validPractice(s.data?.practice));
  return hit ? hit.slot.slice("lesson:".length) : null;
}

/** Score out of 100 over the exercises that are marked (speaking isn't). */
export function practiceScore(p: PracticeSave): number {
  const total = p.exercises.filter((e) => e.kind !== "speak").length;
  return Math.round((p.right / Math.max(1, total)) * 100);
}
