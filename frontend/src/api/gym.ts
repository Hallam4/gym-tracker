const BASE = import.meta.env.VITE_API_URL || "";
const API_KEY = import.meta.env.VITE_API_KEY || "";

export interface Exercise {
  name: string;
  reps: string;
  sets: string;
  weight: string;
  target: string;
  set_results: string[];
  rest_times: string[];
  notes: string;
  notes_col: number | null;
  sheet_row: number;
  superset_group: number;
  suggested_weight?: string | null;
  suggested_target?: string | null;
  prev_sets?: number[] | null;
  prev_weight?: number | null;
  sessions_at_ceiling?: number | null;
  rep_min?: number | null;
  rep_max?: number | null;
  is_amrap?: boolean;
}

export interface WorkoutSession {
  day: string;
  date: string;
  tab_name: string;
  exercises: Exercise[];
}

export interface ExerciseProgress {
  date: string;
  weight: number;
  volume: number;
  best_reps: number;
  estimated_1rm: number;
}

export interface ProgressResponse {
  exercise: string;
  history: ExerciseProgress[];
}

export interface PREntry {
  exercise: string;
  best_weight: number;
  best_weight_date: string;
  estimated_1rm: number;
  estimated_1rm_date: string;
}

export interface PRsResponse {
  prs: PREntry[];
}

export interface ExerciseSummary {
  exercise: string;
  weight: number;
  prev_weight: number | null;
  weight_change: number | null;
  is_weight_pr: boolean;
  is_1rm_pr: boolean;
}

export interface WorkoutSummaryResponse {
  status: string;
  exercises_logged: number;
  exercise_summaries: ExerciseSummary[];
  new_prs_count: number;
}

export interface StreakData {
  current_streak: number;
  best_streak: number;
  workouts_this_week: number;
  workouts_this_month: number;
  total_workouts: number;
  workout_dates: string[];
}

export interface StreakResponse {
  streaks: StreakData;
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJSON<T>(url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  const res = await fetch(`${BASE}${url}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface CompletedExercise {
  name: string;
  weight: string;
  sets: string;
  reps: string;
  target: string;
  set_results: string[];
  rest_times: string[];
  notes: string;
}

export interface CompleteWorkoutRequest {
  day: string;
  exercises: CompletedExercise[];
  is_deload: boolean;
}

export interface HistoryExercise {
  date: string;
  day: string;
  exercise: string;
  weight: string;
  sets: string;
  set1: string;
  set2: string;
  set3: string;
  set4: string;
  set5: string;
  rest1: string;
  rest2: string;
  rest3: string;
  rest4: string;
  notes: string;
}

export interface HistorySession {
  date: string;
  day: string;
  exercises: HistoryExercise[];
}

export interface HistorySessionsResponse {
  sessions: HistorySession[];
}

export interface MuscleVolume {
  volume: number;
  tier: number;
  percentile: number | null;
}

export interface WeekVolumeResponse {
  week: string;
  week_start: string;
  week_end: string;
  is_partial: boolean;
  muscles: Record<string, MuscleVolume>;
  warnings: string[];
}

export interface MuscleWeekEntry {
  week: string;
  volume: number;
  tier: number;
}

export interface MuscleHistoryResponse {
  muscle: string;
  weeks: MuscleWeekEntry[];
}

export const api = {
  // New Structure-based endpoints
  getStructure: (type: string) =>
    fetchJSON<WorkoutSession>(`/api/structure/${type}`),
  completeWorkoutNew: (data: CompleteWorkoutRequest) =>
    postJSON<WorkoutSummaryResponse>("/api/workouts/complete", data),
  getHistorySessions: (params?: { type?: string; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set("type", params.type);
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    const qs = q.toString();
    return fetchJSON<HistorySessionsResponse>(`/api/history/sessions${qs ? `?${qs}` : ""}`);
  },
  getHistorySession: (date: string, day: string) =>
    fetchJSON<HistorySession>(`/api/history/session/${encodeURIComponent(date)}/${encodeURIComponent(day)}`),
  getProgress: (exercise: string) =>
    fetchJSON<ProgressResponse>(`/api/progress/${encodeURIComponent(exercise)}`),
  getPRs: () => fetchJSON<PRsResponse>("/api/prs"),
  getStreaks: () => fetchJSON<StreakResponse>("/api/streaks"),
  getWeekVolume: (date?: string) =>
    fetchJSON<WeekVolumeResponse>(`/api/volume/week${date ? `?date=${date}` : ""}`),
  getMuscleHistory: (muscle: string, weeks?: number) =>
    fetchJSON<MuscleHistoryResponse>(
      `/api/volume/history?muscle=${encodeURIComponent(muscle)}&weeks=${weeks ?? 12}`
    ),
};
