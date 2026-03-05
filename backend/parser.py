import os

from models import Exercise, WorkoutSession

BODYWEIGHT_KG = int(os.environ.get("BODYWEIGHT_KG", "85"))


def _safe_get(row: list[str], idx: int) -> str:
    """Get a cell value safely, returning empty string if out of range."""
    if idx < len(row):
        return row[idx].strip()
    return ""


def parse_tab(tab_name: str, rows: list[list[str]]) -> WorkoutSession:
    """Parse a sheet tab into a WorkoutSession.

    Sheet layout:
      Row 0: ['Day', 'Date']          (labels)
      Row 1: ['U1', '2 February 2026'] (actual values)
      Row 2: []                         (blank)
      Row 3: ['Exercise', 'Reps', 'Sets', 'This Weight', 'This Target', ...]  (header)
      Row 4+: exercise data
    """
    day_str = tab_name
    date_str = ""

    # Row 1 has the actual Day and Date values
    if len(rows) > 1:
        row1 = rows[1]
        if len(row1) >= 1 and row1[0]:
            day_str = row1[0].strip()
        if len(row1) >= 2 and row1[1]:
            date_str = row1[1].strip()

    # Find the header row containing "Exercise"
    header_row_idx = None
    for i, row in enumerate(rows):
        for cell in row:
            if cell.strip().lower() == "exercise":
                header_row_idx = i
                break
        if header_row_idx is not None:
            break

    if header_row_idx is None:
        return WorkoutSession(day=day_str, date=date_str, tab_name=tab_name, exercises=[])

    # Parse the header to find column indices
    header = rows[header_row_idx]
    col_map = {}
    for j, cell in enumerate(header):
        key = cell.strip().lower()
        if key:
            col_map[key] = j

    exercise_col = col_map.get("exercise", 0)
    reps_col = col_map.get("reps", 1)
    sets_col = col_map.get("sets", 2)
    weight_col = col_map.get("this weight", col_map.get("weight", 3))
    target_col = col_map.get("this target", col_map.get("target", 4))
    notes_col = col_map.get("notes")

    # Find Set and Rest columns
    set_cols = []
    rest_cols = []
    for key, idx in sorted(col_map.items(), key=lambda x: x[1]):
        if key.startswith("set ") or key.startswith("set"):
            try:
                int(key.replace("set ", "").replace("set", ""))
                set_cols.append(idx)
            except ValueError:
                pass
        elif key.startswith("rest ") or key.startswith("rest"):
            try:
                int(key.replace("rest ", "").replace("rest", ""))
                rest_cols.append(idx)
            except ValueError:
                pass

    # Parse exercise rows with superset grouping (blank rows separate groups)
    exercises = []
    current_group = 0
    last_was_blank = True
    for i in range(header_row_idx + 1, len(rows)):
        row = rows[i]
        name = _safe_get(row, exercise_col)
        if not name:
            last_was_blank = True
            continue

        if last_was_blank and exercises:
            current_group += 1
        last_was_blank = False

        raw_weight = _safe_get(row, weight_col)
        # Substitute bodyweight for exercises logged at 0 or blank
        if not raw_weight or raw_weight.strip("kg").strip("lbs").strip() in ("0", ""):
            raw_weight = f"{BODYWEIGHT_KG}kg"

        exercise = Exercise(
            name=name,
            reps=_safe_get(row, reps_col),
            sets=_safe_get(row, sets_col),
            weight=raw_weight,
            target=_safe_get(row, target_col),
            set_results=[_safe_get(row, c) for c in set_cols],
            rest_times=[_safe_get(row, c) for c in rest_cols],
            notes=_safe_get(row, notes_col) if notes_col is not None else "",
            notes_col=notes_col,
            sheet_row=i,
            superset_group=current_group,
        )
        exercises.append(exercise)

    return WorkoutSession(day=day_str, date=date_str, tab_name=tab_name, exercises=exercises)


def parse_all_tabs(tabs_data: dict[str, list[list[str]]]) -> list[WorkoutSession]:
    """Parse all tabs into WorkoutSessions."""
    return [parse_tab(name, rows) for name, rows in tabs_data.items()]


def parse_structure_tab(rows: list[list[str]]) -> dict[str, list[Exercise]]:
    """Parse the Structure tab into a dict mapping type code to exercise list.

    Structure layout:
      Row 0: header — Type | Exercise | Reps | Sets | Weight | Target | Notes
      Row 1+: data rows. Type column carries forward if blank.
      Blank rows within same type = superset break.
    """
    if not rows:
        return {}

    # Parse header
    header = rows[0]
    col_map = {}
    for j, cell in enumerate(header):
        key = cell.strip().lower()
        if key:
            col_map[key] = j

    type_col = col_map.get("type", 0)
    exercise_col = col_map.get("exercise", 1)
    reps_col = col_map.get("reps", 2)
    sets_col = col_map.get("sets", 3)
    weight_col = col_map.get("weight", 4)
    target_col = col_map.get("target", 5)
    notes_col = col_map.get("notes", 6)

    result: dict[str, list[Exercise]] = {}
    current_type = ""
    superset_group = 0
    last_was_blank = False

    for i in range(1, len(rows)):
        row = rows[i]
        type_val = _safe_get(row, type_col)
        name = _safe_get(row, exercise_col)

        # New type resets superset grouping
        if type_val:
            if type_val != current_type:
                current_type = type_val
                superset_group = 0
                last_was_blank = False
            # Also handle type + blank exercise (shouldn't happen but be safe)

        # Blank row = superset break within current type
        if not name:
            last_was_blank = True
            continue

        if last_was_blank and current_type in result and len(result[current_type]) > 0:
            superset_group += 1
        last_was_blank = False

        if not current_type:
            continue

        raw_weight = _safe_get(row, weight_col)
        if not raw_weight or raw_weight.strip("kg").strip("lbs").strip() in ("0", ""):
            raw_weight = f"{BODYWEIGHT_KG}kg"

        exercise = Exercise(
            name=name,
            reps=_safe_get(row, reps_col),
            sets=_safe_get(row, sets_col),
            weight=raw_weight,
            target=_safe_get(row, target_col),
            set_results=[],
            rest_times=[],
            notes=_safe_get(row, notes_col),
            notes_col=notes_col,
            sheet_row=i,
            superset_group=superset_group,
        )

        if current_type not in result:
            result[current_type] = []
        result[current_type].append(exercise)

    return result
