from datetime import date, datetime, timedelta
import sheets_client
from models import Exercise, HistoryRow, ExerciseProgress, PREntry, ExerciseSummary, StreakData

HISTORY_TAB = "History"
HISTORY_HEADER = [
    "Date", "Day", "Exercise", "Weight", "Sets",
    "Set 1", "Set 2", "Set 3", "Set 4", "Set 5",
    "Rest 1", "Rest 2", "Rest 3", "Rest 4", "Notes",
]


def _safe_get(row: list[str], idx: int) -> str:
    if idx < len(row):
        return row[idx].strip()
    return ""


def _ensure_history_tab():
    """Check if History tab exists, create header if needed."""
    try:
        rows = sheets_client.fetch_tab(HISTORY_TAB)
        if not rows:
            sheets_client.append_rows(HISTORY_TAB, [HISTORY_HEADER])
    except Exception:
        # Tab might not exist yet — user needs to create it manually
        pass


def append_workout(day: str, exercises: list[Exercise], workout_date: str | None = None):
    """Append completed exercises to the History tab."""
    today = workout_date or date.today().isoformat()
    rows = []
    for ex in exercises:
        # Only log exercises that have at least one set recorded
        if not any(s for s in ex.set_results if s):
            continue
        row = [
            today,
            day,
            ex.name,
            ex.weight,
            ex.sets,
            *[s if s else "" for s in (ex.set_results + [""] * 5)[:5]],
            *[r if r else "" for r in (ex.rest_times + [""] * 4)[:4]],
            ex.notes,
        ]
        rows.append(row)

    if rows:
        sheets_client.append_rows(HISTORY_TAB, rows)


def get_all_history() -> list[HistoryRow]:
    """Read all history rows."""
    try:
        rows = sheets_client.fetch_tab(HISTORY_TAB)
    except Exception:
        return []

    if len(rows) <= 1:
        return []

    result = []
    for row in rows[1:]:  # Skip header
        if not _safe_get(row, 0):
            continue
        result.append(
            HistoryRow(
                date=_safe_get(row, 0),
                day=_safe_get(row, 1),
                exercise=_safe_get(row, 2),
                weight=_safe_get(row, 3),
                sets=_safe_get(row, 4),
                set1=_safe_get(row, 5),
                set2=_safe_get(row, 6),
                set3=_safe_get(row, 7),
                set4=_safe_get(row, 8),
                set5=_safe_get(row, 9),
                rest1=_safe_get(row, 10),
                rest2=_safe_get(row, 11),
                rest3=_safe_get(row, 12),
                rest4=_safe_get(row, 13),
                notes=_safe_get(row, 14),
            )
        )
    return result


def _parse_weight(s: str) -> float:
    try:
        return float(s.replace("kg", "").replace("lbs", "").strip())
    except (ValueError, AttributeError):
        return 0.0


def _parse_reps(s: str) -> int:
    try:
        return int(s.strip())
    except (ValueError, AttributeError):
        return 0


def get_exercise_progress(exercise_name: str) -> list[ExerciseProgress]:
    """Get progress data for a specific exercise."""
    history = get_all_history()
    exercise_name_lower = exercise_name.lower()

    progress = []
    for row in history:
        if row.exercise.lower() != exercise_name_lower:
            continue

        weight = _parse_weight(row.weight)
        set_reps = [
            _parse_reps(s)
            for s in [row.set1, row.set2, row.set3, row.set4, row.set5]
            if s
        ]
        total_reps = sum(set_reps)
        best_reps = max(set_reps) if set_reps else 0
        volume = weight * total_reps

        estimated_1rm = round(weight * (1 + best_reps / 30), 1) if weight > 0 and best_reps > 0 else 0.0

        progress.append(
            ExerciseProgress(
                date=row.date,
                weight=weight,
                volume=volume,
                best_reps=best_reps,
                estimated_1rm=estimated_1rm,
            )
        )

    return progress


def get_prs() -> list[PREntry]:
    """Get personal records for all exercises."""
    history = get_all_history()

    # Group by exercise
    by_exercise: dict[str, list[HistoryRow]] = {}
    for row in history:
        name = row.exercise
        if name not in by_exercise:
            by_exercise[name] = []
        by_exercise[name].append(row)

    prs = []
    for exercise, rows in by_exercise.items():
        best_weight = 0.0
        best_weight_date = ""
        best_1rm = 0.0
        best_1rm_date = ""

        for row in rows:
            w = _parse_weight(row.weight)
            set_reps = [
                _parse_reps(s)
                for s in [row.set1, row.set2, row.set3, row.set4, row.set5]
                if s
            ]

            if w > best_weight:
                best_weight = w
                best_weight_date = row.date

            # Epley 1RM per set: weight × (1 + reps / 30)
            for reps in set_reps:
                if reps > 0 and w > 0:
                    e1rm = w * (1 + reps / 30)
                    if e1rm > best_1rm:
                        best_1rm = e1rm
                        best_1rm_date = row.date

        prs.append(
            PREntry(
                exercise=exercise,
                best_weight=best_weight,
                best_weight_date=best_weight_date,
                estimated_1rm=round(best_1rm, 1),
                estimated_1rm_date=best_1rm_date,
            )
        )

    prs.sort(key=lambda p: p.exercise)
    return prs


def compute_workout_summary(exercises: list[Exercise], today_date: str) -> list[ExerciseSummary]:
    """Compute per-exercise summary comparing current session to prior history.

    Must be called BEFORE append_workout so current session isn't in history.
    """
    history = get_all_history()

    # Build per-exercise prior data: best weight, best 1RM, most recent weight
    prior: dict[str, dict] = {}
    for row in history:
        name = row.exercise
        if name not in prior:
            prior[name] = {"best_weight": 0.0, "best_1rm": 0.0, "recent_weight": 0.0, "recent_date": ""}
        w = _parse_weight(row.weight)
        if w > prior[name]["best_weight"]:
            prior[name]["best_weight"] = w
        # Most recent by date
        if row.date > prior[name]["recent_date"]:
            prior[name]["recent_date"] = row.date
            prior[name]["recent_weight"] = w
        # Best 1RM
        set_reps = [_parse_reps(s) for s in [row.set1, row.set2, row.set3, row.set4, row.set5] if s]
        for reps in set_reps:
            if reps > 0 and w > 0:
                e1rm = w * (1 + reps / 30)
                if e1rm > prior[name]["best_1rm"]:
                    prior[name]["best_1rm"] = e1rm

    summaries = []
    for ex in exercises:
        if not any(s for s in ex.set_results if s):
            continue
        w = _parse_weight(ex.weight)
        set_reps = [_parse_reps(s) for s in ex.set_results if s]
        current_1rm = max((w * (1 + r / 30) for r in set_reps if r > 0 and w > 0), default=0.0)

        p = prior.get(ex.name)
        prev_weight = p["recent_weight"] if p and p["recent_weight"] > 0 else None
        weight_change = round(w - prev_weight, 2) if prev_weight is not None else None
        is_weight_pr = w > p["best_weight"] if p and w > 0 else False
        is_1rm_pr = current_1rm > p["best_1rm"] if p and current_1rm > 0 else False

        summaries.append(ExerciseSummary(
            exercise=ex.name,
            weight=w,
            prev_weight=prev_weight,
            weight_change=weight_change,
            is_weight_pr=is_weight_pr,
            is_1rm_pr=is_1rm_pr,
        ))

    return summaries


def get_streak_data() -> StreakData:
    """Compute workout streak data from history."""
    history = get_all_history()

    # Extract distinct workout dates
    dates_set: set[str] = set()
    for row in history:
        if row.date:
            dates_set.add(row.date)

    workout_dates = sorted(dates_set)
    total_workouts = len(workout_dates)

    today = date.today()

    # This week (Monday = 0)
    week_start = today - timedelta(days=today.weekday())
    week_start_str = week_start.isoformat()
    workouts_this_week = sum(1 for d in workout_dates if d >= week_start_str)

    # This month
    month_start_str = today.replace(day=1).isoformat()
    workouts_this_month = sum(1 for d in workout_dates if d >= month_start_str)

    # Weekly streaks: group dates into ISO weeks, walk backwards from current week
    date_objects = []
    for d_str in workout_dates:
        try:
            date_objects.append(datetime.strptime(d_str, "%Y-%m-%d").date())
        except ValueError:
            continue

    weeks_with_workouts: set[tuple[int, int]] = set()
    for d in date_objects:
        iso = d.isocalendar()
        weeks_with_workouts.add((iso[0], iso[1]))

    # Walk backwards from current week
    current_streak = 0
    best_streak = 0
    streak = 0
    check = today
    # Start from current week
    while True:
        iso = check.isocalendar()
        if (iso[0], iso[1]) in weeks_with_workouts:
            streak += 1
            best_streak = max(best_streak, streak)
        else:
            if streak > 0 and current_streak == 0:
                current_streak = streak
            streak = 0
        # Go to previous week
        check = check - timedelta(weeks=1)
        # Stop if we've gone past all history
        if date_objects and check < date_objects[0] - timedelta(weeks=1):
            break
        if not date_objects:
            break

    # If we never broke the streak, current = streak
    if current_streak == 0:
        current_streak = streak
    best_streak = max(best_streak, streak)

    return StreakData(
        current_streak=current_streak,
        best_streak=best_streak,
        workouts_this_week=workouts_this_week,
        workouts_this_month=workouts_this_month,
        total_workouts=total_workouts,
        workout_dates=workout_dates,
    )
