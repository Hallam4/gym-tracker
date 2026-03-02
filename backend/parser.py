from models import Exercise, WorkoutSession


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

    # Parse exercise rows (after header, skip blank rows)
    exercises = []
    for i in range(header_row_idx + 1, len(rows)):
        row = rows[i]
        name = _safe_get(row, exercise_col)
        if not name:
            continue

        exercise = Exercise(
            name=name,
            reps=_safe_get(row, reps_col),
            sets=_safe_get(row, sets_col),
            weight=_safe_get(row, weight_col),
            target=_safe_get(row, target_col),
            set_results=[_safe_get(row, c) for c in set_cols],
            rest_times=[_safe_get(row, c) for c in rest_cols],
            notes=_safe_get(row, notes_col) if notes_col is not None else "",
            sheet_row=i,
        )
        exercises.append(exercise)

    return WorkoutSession(day=day_str, date=date_str, tab_name=tab_name, exercises=exercises)


def parse_all_tabs(tabs_data: dict[str, list[list[str]]]) -> list[WorkoutSession]:
    """Parse all tabs into WorkoutSessions."""
    return [parse_tab(name, rows) for name, rows in tabs_data.items()]
