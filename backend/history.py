from datetime import date
import sheets_client
from models import Exercise, HistoryRow, ExerciseProgress, PREntry

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


def append_workout(day: str, exercises: list[Exercise]):
    """Append completed exercises to the History tab."""
    today = date.today().isoformat()
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

        progress.append(
            ExerciseProgress(
                date=row.date,
                weight=weight,
                volume=volume,
                best_reps=best_reps,
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
        best_volume = 0.0
        best_volume_date = ""

        for row in rows:
            w = _parse_weight(row.weight)
            set_reps = [
                _parse_reps(s)
                for s in [row.set1, row.set2, row.set3, row.set4, row.set5]
                if s
            ]
            volume = w * sum(set_reps)

            if w > best_weight:
                best_weight = w
                best_weight_date = row.date
            if volume > best_volume:
                best_volume = volume
                best_volume_date = row.date

        prs.append(
            PREntry(
                exercise=exercise,
                best_weight=best_weight,
                best_weight_date=best_weight_date,
                best_volume=best_volume,
                best_volume_date=best_volume_date,
            )
        )

    prs.sort(key=lambda p: p.exercise)
    return prs
