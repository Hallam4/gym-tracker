from pydantic import BaseModel


class Exercise(BaseModel):
    name: str
    reps: str
    sets: str
    weight: str
    target: str
    set_results: list[str]  # Set 1-5
    rest_times: list[str]   # Rest 1-4
    notes: str
    notes_col: int | None = None  # column index for notes write-back
    sheet_row: int  # 0-indexed row in the sheet for write-back
    superset_group: int  # exercises with same group number form a superset
    suggested_weight: str | None = None
    suggested_target: str | None = None
    prev_sets: list[int] | None = None
    prev_weight: float | None = None
    sessions_at_ceiling: int | None = None  # 0, 1, or 2
    rep_min: int | None = None
    rep_max: int | None = None
    is_amrap: bool = False


class WorkoutSession(BaseModel):
    day: str
    date: str
    tab_name: str
    exercises: list[Exercise]


class HistoryRow(BaseModel):
    date: str
    day: str
    exercise: str
    weight: str
    sets: str
    set1: str
    set2: str
    set3: str
    set4: str
    set5: str
    rest1: str
    rest2: str
    rest3: str
    rest4: str
    notes: str


class ExerciseProgress(BaseModel):
    date: str
    weight: float
    volume: float  # total reps * weight
    best_reps: int
    estimated_1rm: float


class ProgressResponse(BaseModel):
    exercise: str
    history: list[ExerciseProgress]


class PREntry(BaseModel):
    exercise: str
    best_weight: float
    best_weight_date: str
    estimated_1rm: float
    estimated_1rm_date: str


class PRsResponse(BaseModel):
    prs: list[PREntry]


class ExerciseSummary(BaseModel):
    exercise: str
    weight: float
    prev_weight: float | None = None
    weight_change: float | None = None
    is_weight_pr: bool = False
    is_1rm_pr: bool = False


class WorkoutSummaryResponse(BaseModel):
    status: str
    exercises_logged: int
    exercise_summaries: list[ExerciseSummary]
    new_prs_count: int


class StreakData(BaseModel):
    current_streak: int  # consecutive weeks
    best_streak: int
    workouts_this_week: int
    workouts_this_month: int
    total_workouts: int
    workout_dates: list[str]  # ISO date strings


class StreakResponse(BaseModel):
    streaks: StreakData


class CompletedExercise(BaseModel):
    name: str
    weight: str
    sets: str
    reps: str
    target: str
    set_results: list[str]
    rest_times: list[str]
    notes: str


class CompleteWorkoutRequest(BaseModel):
    day: str
    exercises: list[CompletedExercise]
    is_deload: bool = False


class HistorySession(BaseModel):
    date: str
    day: str
    exercises: list[HistoryRow]


class HistorySessionsResponse(BaseModel):
    sessions: list[HistorySession]


class MuscleVolume(BaseModel):
    volume: float
    tier: int  # 0-3
    percentile: int | None


class WeekVolumeResponse(BaseModel):
    week: str
    week_start: str
    week_end: str
    is_partial: bool
    muscles: dict[str, MuscleVolume]
    warnings: list[str]


class MuscleWeekEntry(BaseModel):
    week: str
    volume: float
    tier: int


class MuscleHistoryResponse(BaseModel):
    muscle: str
    weeks: list[MuscleWeekEntry]
