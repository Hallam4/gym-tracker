import { PREHAB_SECTIONS, PrehabExercise, SectionId } from "../data/prehabData";

export interface ExerciseEntry {
  setsDone: number;
  weight?: string;
}

export interface DayState {
  date: string; // YYYY-MM-DD
  entries: Record<string, ExerciseEntry>;
  notes?: string;
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
  notes?: string;
  detail?: PrehabDetail;
}

export interface PrehabDetail {
  shoulderrehab?: SectionProgress;
  weights: Record<string, string>;
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

export function sectionProgress(sectionId: SectionId, state: DayState, levels: Record<string, number> = {}): SectionProgress {
  const section = PREHAB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { done: 0, total: 0 };
  const done = section.exercises.filter((ex) =>
    isExerciseDone(activeExercise(ex, levels[ex.id] ?? 1), state.entries[ex.id])
  ).length;
  return { done, total: section.exercises.length };
}

export function overallProgress(state: DayState, levels: Record<string, number> = {}): SectionProgress {
  return PREHAB_SECTIONS.filter((s) => s.daily !== false).reduce<SectionProgress>(
    (acc, s) => {
      const p = sectionProgress(s.id, state, levels);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

export function buildLogEntry(state: DayState, levels: Record<string, number> = {}): LogEntry {
  const sections = Object.fromEntries(
    PREHAB_SECTIONS.filter((s) => s.daily !== false).map((s) => [s.id, sectionProgress(s.id, state, levels)])
  ) as Record<SectionId, SectionProgress>;
  const overall = overallProgress(state, levels);
  const weights: Record<string, string> = {};
  for (const [exId, entry] of Object.entries(state.entries)) {
    if (entry.weight != null && entry.weight !== "") weights[exId] = entry.weight;
  }
  const detail: PrehabDetail = { shoulderrehab: sectionProgress("shoulderrehab", state, levels), weights };
  return { date: state.date, done: overall.done, total: overall.total, sections, notes: state.notes ?? "", detail };
}

export function weekStartMonday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function shoulderRehabThisWeek(log: LogEntry[], today: string): number {
  const start = weekStartMonday(today);
  return log.filter(
    (e) => e.date >= start && e.date <= today && (e.detail?.shoulderrehab?.done ?? 0) > 0
  ).length;
}
