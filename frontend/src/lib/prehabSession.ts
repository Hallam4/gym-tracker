import { PREHAB_SECTIONS, PrehabExercise, SectionId } from "../data/prehabData";

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

export function sectionProgress(sectionId: SectionId, state: DayState): SectionProgress {
  const section = PREHAB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { done: 0, total: 0 };
  const done = section.exercises.filter((ex) => isExerciseDone(ex, state.entries[ex.id])).length;
  return { done, total: section.exercises.length };
}

export function overallProgress(state: DayState): SectionProgress {
  return PREHAB_SECTIONS.reduce<SectionProgress>(
    (acc, s) => {
      const p = sectionProgress(s.id, state);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

export function buildLogEntry(state: DayState): LogEntry {
  const sections = {} as Record<SectionId, SectionProgress>;
  for (const s of PREHAB_SECTIONS) sections[s.id] = sectionProgress(s.id, state);
  const overall = overallProgress(state);
  return { date: state.date, done: overall.done, total: overall.total, sections };
}

export function appendLog(log: LogEntry[], entry: LogEntry): LogEntry[] {
  return [entry, ...log.filter((e) => e.date !== entry.date)];
}
