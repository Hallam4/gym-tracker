from datetime import date, datetime, timedelta
import sheets_client
from models import Exercise, CompletedExercise, HistoryRow, HistorySession, ExerciseProgress, PREntry, ExerciseSummary, StreakData

# Map short codes to History tab labels and vice versa
_CODE_TO_LABEL = sheets_client.WORKOUT_TYPES  # U1 → Upper 1
_LABEL_TO_CODE = sheets_client.WORKOUT_TYPE_CODES  # Upper 1 → U1

HISTORY_TAB = "History"
HISTORY_HEADER = [
    "Date", "Day", "Exercise", "Weight", "Sets",
    "Set 1", "Set 2", "Set 3", "Set 4", "Set 5",
    "Rest 1", "Rest 2", "Rest 3", "Rest 4", "Notes",
]

# Consecutive working sessions at the rep ceiling required before suggesting a
# weight increase. 1 = classic single-session double progression (bump as soon
# as you hit the top of the range on all prescribed sets). Raise to 2+ to
# require confirmation across sessions.
CONFIRMATION_SESSIONS = 1

# --- Progression modes (Tier 1) -------------------------------------------
# A per-exercise strategy: how the exercise progresses and how the rest timer
# is sized. See docs/tier1-progression-design.md.
#   strength  low reps, suggest-only (never auto-writes weight)
#   evolve    hypertrophy double progression with variable set ranges
#   volume    isolation; log only, no weight chasing
#   amrap     bodyweight/finishers; track rep PRs, no weight progression
MODES = ("strength", "evolve", "volume", "amrap")
DEFAULT_MODE = "evolve"

# Default (set_min, set_max) when the Structure Sets cell is blank.
DEFAULT_SETS_BY_MODE = {
    "strength": (3, 3),
    "evolve": (3, 4),
    "volume": (4, 4),
    "amrap": (3, 3),
}

# Default rest-timer seconds per mode (frontend uses these when present).
REST_BY_MODE = {
    "strength": 180,
    "evolve": 150,
    "volume": 90,
    "amrap": 60,
}


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
    day_label = _CODE_TO_LABEL.get(day, day)

    # Build set of existing (date, exercise) pairs to prevent duplicates
    existing = get_all_history()
    existing_keys: set[tuple[str, str]] = set()
    for row in existing:
        existing_keys.add((row.date, row.exercise))

    rows = []
    for ex in exercises:
        # Only log exercises that have at least one set recorded
        if not any(s for s in ex.set_results if s):
            continue
        # Skip if already logged for this date + exercise
        if (today, ex.name) in existing_keys:
            continue
        row = [
            today,
            day_label,
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


def _parse_set_range(s: str) -> tuple[int, int]:
    """Parse a Sets cell into (set_min, set_max).

    "3-4" -> (3, 4); "4" -> (4, 4); blank/garbage/"0" -> (0, 0) so the caller
    can apply a mode default.
    """
    if not s:
        return (0, 0)
    txt = s.strip()
    try:
        if "-" in txt:
            lo, hi = txt.split("-", 1)
            lo_i, hi_i = int(lo.strip()), int(hi.strip())
            if lo_i <= 0 or hi_i <= 0:
                return (0, 0)
            return (min(lo_i, hi_i), max(lo_i, hi_i))
        n = int(txt)
        return (n, n) if n > 0 else (0, 0)
    except ValueError:
        return (0, 0)


def auto_writes_weight(mode: str) -> bool:
    """Write-back policy: only `evolve` auto-writes weight/target to the sheet.

    strength is suggest-only (the readiness signal shows, but the user bumps the
    weight themselves); volume/amrap never chase weight.
    """
    return mode == "evolve"


def resolve_mode(mode_cell: str, rep_min: int, rep_max: int, is_amrap: bool) -> str:
    """Resolve a progression mode (hybrid: explicit Mode cell wins, else infer).

    Inference: AMRAP -> amrap; rep_max <= 6 -> strength; rep_min >= 12 ->
    volume; otherwise the evolve hypertrophy default.
    """
    if mode_cell:
        m = mode_cell.strip().lower()
        if m in MODES:
            return m
    if is_amrap:
        return "amrap"
    if rep_max and rep_max <= 6:
        return "strength"
    if rep_min and rep_min >= 12:
        return "volume"
    return DEFAULT_MODE


def _sets_at_ceiling(reps: list[int], set_min: int, set_max: int, threshold: int) -> bool:
    """True if at least `set_min` of the first `set_max` sets reach `threshold`.

    Generalizes double progression to variable set ranges (e.g. 3-4): bonus
    sets logged beyond `set_max` are ignored, and you don't need every set at
    the ceiling — just `set_min` of them (order-independent). Falls back to
    evaluating every logged set when the range is unknown (0, 0).
    """
    if not reps:
        return False
    cap = set_max if set_max > 0 else len(reps)
    evaluated = reps[:cap]
    if not evaluated:
        return False
    needed = set_min if set_min > 0 else len(evaluated)
    hits = sum(1 for r in evaluated if r >= threshold)
    return hits >= needed


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

        # Skip exercises with no recorded weight (bodyweight-only or empty)
        if best_weight == 0.0:
            continue

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


def compute_workout_summary(
    exercises: list[Exercise],
    today_date: str,
    day_label: str | None = None,
    history_rows: list[HistoryRow] | None = None,
) -> list[ExerciseSummary]:
    """Compute per-exercise summary comparing current session to prior history.

    Must be called BEFORE append_workout so current session isn't in history.

    When `day_label` is set, the prior comparison is scoped to that session, so a
    light Arms OHP isn't measured against the heavy Upper 1 OHP (which would show
    a false weight drop and suppress Arms PRs). `history_rows` injects the prior
    log for testing; it defaults to the full History tab.
    """
    history = history_rows if history_rows is not None else get_all_history()
    if day_label:
        wanted = _CODE_TO_LABEL.get(day_label, day_label)
        history = [r for r in history if r.day == wanted]

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


def compute_double_progression(
    exercise_name: str,
    rep_min: int,
    rep_max: int,
    history_rows: list[HistoryRow],
    current_target: int | None = None,
    mode: str = DEFAULT_MODE,
    day_label: str | None = None,
) -> dict | None:
    """Compute suggested weight/target for an exercise from its history.

    `mode` selects the progression strategy (see MODES):
      - evolve/strength: double progression. A weight increase is suggested once
        `CONFIRMATION_SESSIONS` consecutive working sessions hit the ceiling
        (>= set_min sets at rep_max). strength is computed identically here; the
        suggest-only (no auto-write) behavior is enforced by the caller.
      - volume/amrap: hold the working weight; no weight/target progression.

    Per-session set ranges are read from each history row's Sets cell, so a
    session is judged against the prescription that was in force at the time.

    When `day_label` is given, history is scoped to that session (matching the
    History tab's Day column) so the same exercise in another session — with a
    different purpose/weight — can't contaminate the suggestion. It accepts both
    a short code (U1/Arm) and the stored long label (Upper 1/Arms). When omitted,
    all sessions for the exercise are pooled (legacy behaviour).
    Returns None if no history exists (use sheet defaults).
    """
    name_lower = exercise_name.lower()
    matching = [r for r in history_rows if r.exercise.lower() == name_lower]
    if day_label:
        wanted = _CODE_TO_LABEL.get(day_label, day_label)
        matching = [r for r in matching if r.day == wanted]
    if not matching:
        return None

    # Group by date, sort descending
    by_date: dict[str, list[HistoryRow]] = {}
    for row in matching:
        by_date.setdefault(row.date, []).append(row)
    sorted_dates = sorted(by_date.keys(), reverse=True)

    # Take up to 6 most recent sessions (to see through deload weeks)
    recent_sessions = []
    for d in sorted_dates[:6]:
        rows = by_date[d]
        # Use first row for that date (one history entry per exercise per date)
        row = rows[0]
        set_reps = [
            _parse_reps(s)
            for s in [row.set1, row.set2, row.set3, row.set4, row.set5]
            if s
        ]
        weight = _parse_weight(row.weight)
        set_min, set_max = _parse_set_range(row.sets)
        recent_sessions.append({
            "date": d,
            "reps": set_reps,
            "weight": weight,
            "notes": row.notes,
            "set_min": set_min,
            "set_max": set_max,
        })

    # Filter deloads: auto-detect by weight threshold + manual [DELOAD] marker.
    # Anchor the threshold to the lifter's CURRENT level — the most recent
    # session that isn't a manual [DELOAD] — not the window maximum. A deload is
    # a *temporary* dip you recover from; a sustained lower weight is your real
    # working weight, not a deload. Referencing the window max meant an old heavy
    # session (e.g. a 1RM test) raised the threshold enough to filter the real
    # current sessions as "deloads", resurrecting the old weight and
    # over-suggesting (did 70kg -> suggested 110kg).
    current = next(
        (s for s in recent_sessions if "[DELOAD]" not in (s.get("notes") or "")),
        recent_sessions[0] if recent_sessions else {"weight": 0},
    )
    working_weight = current["weight"]
    deload_threshold = working_weight * 0.85

    working_sessions = [
        s for s in recent_sessions
        if s["weight"] >= deload_threshold and "[DELOAD]" not in (s.get("notes") or "")
    ]
    if not working_sessions:
        working_sessions = [recent_sessions[0]]  # fallback: treat most recent as working

    # prev_sets/prev_weight = what user actually did last (including deloads)
    prev = recent_sessions[0]
    prev_sets = prev["reps"]
    prev_weight = prev["weight"]

    # Count consecutive working sessions at ceiling (>= set_min sets hit rep_max,
    # bonus sets beyond set_max ignored), judged per-session against the Sets
    # prescription in force at the time.
    sessions_at_ceiling = 0
    for sess in working_sessions:
        if _sets_at_ceiling(sess["reps"], sess["set_min"], sess["set_max"], rep_max):
            sessions_at_ceiling += 1
        else:
            break

    base_weight = working_sessions[0]["weight"]
    if current_target is None:
        current_target = rep_max

    if mode in ("volume", "amrap"):
        # Log-only modes: hold the working weight, no target evolution.
        suggested_weight = str(base_weight) if base_weight > 0 else None
        suggested_target = str(current_target)
    elif sessions_at_ceiling >= CONFIRMATION_SESSIONS:
        suggested_weight = str(base_weight + 2.5)
        suggested_target = str(rep_min)
    else:
        suggested_weight = str(base_weight) if base_weight > 0 else None
        # Bump target if the most recent working session hit current_target on
        # >= set_min sets (bonus sets ignored, same as the ceiling check).
        latest = working_sessions[0]
        if _sets_at_ceiling(latest["reps"], latest["set_min"], latest["set_max"], current_target) and current_target < rep_max:
            suggested_target = str(current_target + 1)
        else:
            suggested_target = str(current_target)

    return {
        "suggested_weight": suggested_weight,
        "suggested_target": suggested_target,
        "prev_sets": prev_sets,
        "prev_weight": prev_weight,
        "sessions_at_ceiling": sessions_at_ceiling,
    }


def get_history_sessions(type_filter: str | None = None, limit: int = 50, offset: int = 0) -> list[HistorySession]:
    """Group all History rows by (date, day), return sorted most-recent-first."""
    all_rows = get_all_history()

    # Resolve filter: accept both short codes (U1) and long labels (Upper 1)
    filter_label = None
    if type_filter:
        upper = type_filter.upper()
        filter_label = _CODE_TO_LABEL.get(type_filter) or _CODE_TO_LABEL.get(upper)
        if not filter_label:
            filter_label = type_filter  # already a long label

    # Group by (date, day)
    grouped: dict[tuple[str, str], list[HistoryRow]] = {}
    for row in all_rows:
        key = (row.date, row.day)
        if filter_label and row.day != filter_label:
            continue
        grouped.setdefault(key, []).append(row)

    # Sort by date descending
    sorted_keys = sorted(grouped.keys(), key=lambda k: k[0], reverse=True)

    sessions = []
    for d, day in sorted_keys[offset:offset + limit]:
        sessions.append(HistorySession(date=d, day=day, exercises=grouped[(d, day)]))
    return sessions


def get_history_session(date_str: str, day: str) -> HistorySession | None:
    """Single session lookup by date and day."""
    day_label = _CODE_TO_LABEL.get(day, day)
    all_rows = get_all_history()
    matching = [r for r in all_rows if r.date == date_str and r.day == day_label]
    if not matching:
        return None
    return HistorySession(date=date_str, day=day, exercises=matching)


def append_completed_workout(day: str, exercises: list[CompletedExercise], is_deload: bool = False, workout_date: str | None = None):
    """Append completed exercises from frontend payload to History tab."""
    today = workout_date or date.today().isoformat()
    day_label = _CODE_TO_LABEL.get(day, day)  # U1 → Upper 1

    existing = get_all_history()
    existing_keys: set[tuple[str, str]] = set()
    for row in existing:
        existing_keys.add((row.date, row.exercise))

    rows = []
    for ex in exercises:
        if not any(s for s in ex.set_results if s):
            continue
        if (today, ex.name) in existing_keys:
            continue
        notes = ex.notes
        if is_deload and "[DELOAD]" not in notes:
            notes = f"[DELOAD] {notes}".strip()
        row = [
            today,
            day_label,
            ex.name,
            ex.weight,
            ex.sets,
            *[s if s else "" for s in (ex.set_results + [""] * 5)[:5]],
            *[r if r else "" for r in (ex.rest_times + [""] * 4)[:4]],
            notes,
        ]
        rows.append(row)

    if rows:
        sheets_client.append_rows(HISTORY_TAB, rows)


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

    # Current streak: walk backwards from current week, count consecutive weeks
    current_streak = 0
    check = today
    while True:
        iso = check.isocalendar()
        if (iso[0], iso[1]) in weeks_with_workouts:
            current_streak += 1
        else:
            break
        check = check - timedelta(weeks=1)
        if not date_objects or check < date_objects[0] - timedelta(weeks=1):
            break

    # Best streak: scan all weeks chronologically
    best_streak = 0
    if date_objects:
        all_weeks = sorted(weeks_with_workouts)
        streak = 1
        for i in range(1, len(all_weeks)):
            prev_year, prev_week = all_weeks[i - 1]
            curr_year, curr_week = all_weeks[i]
            # Check if consecutive: same year and week+1, or year boundary
            prev_date = date.fromisocalendar(prev_year, prev_week, 1)
            curr_date = date.fromisocalendar(curr_year, curr_week, 1)
            if (curr_date - prev_date).days == 7:
                streak += 1
            else:
                best_streak = max(best_streak, streak)
                streak = 1
        best_streak = max(best_streak, streak)
    best_streak = max(best_streak, current_streak)

    return StreakData(
        current_streak=current_streak,
        best_streak=best_streak,
        workouts_this_week=workouts_this_week,
        workouts_this_month=workouts_this_month,
        total_workouts=total_workouts,
        workout_dates=workout_dates,
    )
