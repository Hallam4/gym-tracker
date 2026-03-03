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


class WorkoutSession(BaseModel):
    day: str
    date: str
    tab_name: str
    exercises: list[Exercise]


class WorkoutPlan(BaseModel):
    sessions: list[WorkoutSession]


class TabInfo(BaseModel):
    tab_name: str
    workout_type: str  # U1, U2, L1, L2, Arm
    type_label: str    # "Upper 1", "Upper 2", etc.


class TabsResponse(BaseModel):
    latest: dict[str, TabInfo]            # most recent tab per type
    all_tabs: dict[str, list[TabInfo]]    # all tabs grouped by type


class LogSetRequest(BaseModel):
    exercise_index: int
    set_number: int  # 1-5
    reps: int | None = None
    weight: float | None = None


class LogWorkoutRequest(BaseModel):
    updates: list[dict]  # [{sheet_row, column, value}]


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
