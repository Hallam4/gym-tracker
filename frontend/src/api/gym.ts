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
}

export interface WorkoutSession {
  day: string;
  date: string;
  tab_name: string;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  sessions: WorkoutSession[];
}

export interface TabInfo {
  tab_name: string;
  workout_type: string;
  type_label: string;
}

export interface TabsResponse {
  latest: Record<string, TabInfo>;
  all_tabs: Record<string, TabInfo[]>;
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

export const api = {
  getTabs: () => fetchJSON<TabsResponse>("/api/tabs"),
  getWorkouts: () => fetchJSON<WorkoutPlan>("/api/workouts"),
  getWorkoutByType: (type: string) =>
    fetchJSON<WorkoutSession>(`/api/workouts/by-type/${type}`),
  getWorkoutByTab: (tabName: string) =>
    fetchJSON<WorkoutSession>(`/api/workouts/tab/${encodeURIComponent(tabName)}`),
  logWorkout: (tabName: string, updates: { row: number; col: number; value: string }[]) =>
    postJSON<{ status: string }>(`/api/workouts/tab/${encodeURIComponent(tabName)}/log`, { updates }),
  completeWorkout: (tabName: string) =>
    postJSON<WorkoutSummaryResponse>(
      `/api/workouts/tab/${encodeURIComponent(tabName)}/complete`
    ),
  getProgress: (exercise: string) =>
    fetchJSON<ProgressResponse>(`/api/progress/${encodeURIComponent(exercise)}`),
  getPRs: () => fetchJSON<PRsResponse>("/api/prs"),
  getStreaks: () => fetchJSON<StreakResponse>("/api/streaks"),
};
