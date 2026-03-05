import os

from models import Exercise

BODYWEIGHT_KG = int(os.environ.get("BODYWEIGHT_KG", "85"))


def _safe_get(row: list[str], idx: int) -> str:
    """Get a cell value safely, returning empty string if out of range."""
    if idx < len(row):
        return row[idx].strip()
    return ""


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
