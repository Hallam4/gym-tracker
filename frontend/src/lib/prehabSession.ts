import { PREHAB_SECTIONS, PrehabExercise, PrehabSectionDef, PhaseDose, SectionId } from "../data/prehabData";

export interface ExerciseEntry {
  setsDone: number;
  weight?: string;
}

export interface DayState {
  date: string; // YYYY-MM-DD
  entries: Record<string, ExerciseEntry>;
}

export interface SectionProgress {
  done: number;
  total: number;
}

export interface LogEntry {
  date: string;
  done: number;
  total: number;
  sections: Record<SectionId, SectionProgress>;
}

export function emptyDayState(date: string): DayState {
  return { date, entries: {} };
}

export function rollIfNewDay(state: DayState, today: string): DayState {
  return state.date === today ? state : emptyDayState(today);
}

export function isExerciseDone(ex: PrehabExercise, entry?: ExerciseEntry): boolean {
  if (!entry) return false;
  return entry.setsDone >= ex.sets;
}

export function clampLevel(level: number, count: number): number {
  if (count <= 0) return 1;
  if (!Number.isFinite(level)) return 1; // guard corrupted persisted values (e.g. NaN)
  return Math.min(Math.max(Math.round(level), 1), count);
}

export function activeExercise(ex: PrehabExercise, level: number): PrehabExercise {
  if (!ex.levels || ex.levels.length === 0) return ex;
  const lvl = ex.levels[clampLevel(level, ex.levels.length) - 1];
  return { ...ex, name: lvl.name, kind: lvl.kind, sets: lvl.sets, prescription: lvl.prescription, tags: lvl.tags, weightStep: lvl.weightStep };
}

export type PhaseResolution = PhaseDose | "hidden" | "default";

/** Resolve an exercise's dose for a phase. Fail-closed: an unknown phase key hides it. */
export function phaseDose(ex: PrehabExercise, phase: number): PhaseResolution {
  if (!ex.phasePlan) return "default";
  const dose = ex.phasePlan[phase];
  return dose === null || dose === undefined ? "hidden" : dose;
}

export type EffectiveExercise = PrehabExercise & { maintenance?: boolean };

/** Ladder level first, then phase dose override. Hidden exercises resolve to base (callers filter first). */
export function effectiveExercise(ex: PrehabExercise, level: number, phase: number): EffectiveExercise {
  const base = activeExercise(ex, level);
  const dose = phaseDose(ex, phase);
  if (dose === "default" || dose === "hidden") return base;
  return {
    ...base,
    sets: dose.sets,
    prescription: dose.prescription,
    tags: dose.tags ?? base.tags,
    note: dose.note ?? base.note,
    maintenance: dose.maintenance,
  };
}

export function visibleExercises(section: PrehabSectionDef, phase: number): PrehabExercise[] {
  return section.exercises.filter((ex) => phaseDose(ex, phase) !== "hidden");
}

export function sectionProgress(sectionId: SectionId, state: DayState, levels: Record<string, number> = {}, phase = 1): SectionProgress {
  const section = PREHAB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { done: 0, total: 0 };
  const visible = visibleExercises(section, phase);
  const done = visible.filter((ex) =>
    isExerciseDone(effectiveExercise(ex, levels[ex.id] ?? 1, phase), state.entries[ex.id])
  ).length;
  return { done, total: visible.length };
}

export function overallProgress(state: DayState, levels: Record<string, number> = {}, phase = 1): SectionProgress {
  return PREHAB_SECTIONS.reduce<SectionProgress>(
    (acc, s) => {
      const p = sectionProgress(s.id, state, levels, phase);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

export function buildLogEntry(state: DayState, levels: Record<string, number> = {}, phase = 1): LogEntry {
  const sections = Object.fromEntries(
    PREHAB_SECTIONS.map((s) => [s.id, sectionProgress(s.id, state, levels, phase)])
  ) as Record<SectionId, SectionProgress>;
  const overall = overallProgress(state, levels, phase);
  return { date: state.date, done: overall.done, total: overall.total, sections };
}

