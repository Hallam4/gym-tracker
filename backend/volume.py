from datetime import date, datetime, timedelta
import sheets_client
import history
from models import HistoryRow

MUSCLE_MAP_TAB = "Muscle Map"

# All supported muscle slugs (from react-body-highlighter)
ALL_MUSCLES = [
    "trapezius", "upper-back", "lower-back", "chest", "biceps", "triceps",
    "forearm", "back-deltoids", "front-deltoids", "abs", "obliques",
    "adductor", "hamstring", "quadriceps", "abductors", "calves", "gluteal",
]

PERCENTILE_LOOKBACK_WEEKS = 12
MIN_WEEKS_FOR_PERCENTILE = 4


def _parse_muscle_weights(muscles_str: str, weights_str: str) -> dict[str, float]:
    """Parse comma-separated muscles and weights into {slug: weight}."""
    muscles = [m.strip() for m in muscles_str.split(",") if m.strip()]
    weights = [w.strip() for w in weights_str.split(",") if w.strip()]
    result = {}
    for i, m in enumerate(muscles):
        try:
            w = float(weights[i]) if i < len(weights) else 1.0
        except ValueError:
            w = 1.0
        result[m] = w
    return result


def get_muscle_map() -> dict[str, dict[str, float]]:
    """Fetch and parse the Muscle Map tab.

    Returns {exercise_name: {muscle_slug: weight}}.
    """
    try:
        rows = sheets_client.fetch_tab(MUSCLE_MAP_TAB)
    except Exception:
        return {}

    if len(rows) <= 1:
        return {}

    header = rows[0]
    col_map = {}
    for j, cell in enumerate(header):
        col_map[cell.strip().lower()] = j

    exercise_col = col_map.get("exercise", 0)
    primary_col = col_map.get("primary", 1)
    secondary_col = col_map.get("secondary", 2)
    weights_col = col_map.get("weights", 3)
    sec_weights_col = col_map.get("secondary weights", 4)

    mapping: dict[str, dict[str, float]] = {}
    for row in rows[1:]:
        def _get(idx: int) -> str:
            return row[idx].strip() if idx < len(row) else ""

        name = _get(exercise_col)
        if not name:
            continue

        muscles: dict[str, float] = {}
        # Primary muscles with weights
        primary_str = _get(primary_col)
        weights_str = _get(weights_col)
        if primary_str:
            muscles.update(_parse_muscle_weights(primary_str, weights_str))

        # Secondary muscles with secondary weights
        secondary_str = _get(secondary_col)
        sec_weights_str = _get(sec_weights_col)
        if secondary_str:
            muscles.update(_parse_muscle_weights(secondary_str, sec_weights_str))

        mapping[name] = muscles

    return mapping


def _iso_week(d: date) -> tuple[int, int]:
    iso = d.isocalendar()
    return (iso[0], iso[1])


def _week_start_end(year: int, week: int) -> tuple[date, date]:
    monday = date.fromisocalendar(year, week, 1)
    sunday = date.fromisocalendar(year, week, 7)
    return monday, sunday


def _compute_volume_for_rows(
    rows: list[HistoryRow],
    muscle_map: dict[str, dict[str, float]],
) -> tuple[dict[str, float], list[str]]:
    """Compute per-muscle tonnage from history rows.

    Returns (muscle_volumes, unmapped_exercises).
    """
    volumes: dict[str, float] = {m: 0.0 for m in ALL_MUSCLES}
    unmapped: set[str] = set()

    for row in rows:
        if row.exercise not in muscle_map:
            unmapped.add(row.exercise)
            continue

        weight = history._parse_weight(row.weight)
        set_reps = [
            history._parse_reps(s)
            for s in [row.set1, row.set2, row.set3, row.set4, row.set5]
            if s
        ]
        total_reps = sum(set_reps)
        if total_reps == 0 or weight == 0:
            continue

        exercise_tonnage = total_reps * weight
        for muscle, muscle_weight in muscle_map[row.exercise].items():
            if muscle in volumes:
                volumes[muscle] += exercise_tonnage * muscle_weight

    return volumes, sorted(unmapped)


def _is_deload_row(row: HistoryRow) -> bool:
    return "[DELOAD]" in (row.notes or "")


def _get_weekly_volumes(
    all_rows: list[HistoryRow],
    muscle_map: dict[str, dict[str, float]],
    weeks: list[tuple[int, int]],
) -> dict[tuple[int, int], dict[str, float]]:
    """Compute per-muscle volumes for each specified ISO week."""
    # Group rows by ISO week
    rows_by_week: dict[tuple[int, int], list[HistoryRow]] = {}
    for row in all_rows:
        try:
            d = datetime.strptime(row.date, "%Y-%m-%d").date()
        except ValueError:
            continue
        wk = _iso_week(d)
        if wk in weeks or not weeks:
            rows_by_week.setdefault(wk, []).append(row)

    result = {}
    for wk in weeks:
        week_rows = rows_by_week.get(wk, [])
        volumes, _ = _compute_volume_for_rows(week_rows, muscle_map)
        result[wk] = volumes
    return result


def _compute_percentile_and_tier(
    current_volume: float,
    historical_volumes: list[float],
) -> tuple[int | None, int]:
    """Compute percentile and tier for a muscle's current week volume."""
    if current_volume == 0:
        return None, 0

    if len(historical_volumes) < MIN_WEEKS_FOR_PERCENTILE:
        # Cold start: binary trained/untrained
        return None, 2 if current_volume > 0 else 0

    # Filter out zeros and deload weeks (caller handles deload filtering)
    valid = [v for v in historical_volumes if v > 0]
    if not valid:
        return None, 2 if current_volume > 0 else 0

    # Percentile: what fraction of historical values is current_volume >= to
    count_below = sum(1 for v in valid if current_volume >= v)
    percentile = int(round(count_below / len(valid) * 100))

    # Tier mapping
    if percentile <= 33:
        tier = 1
    elif percentile <= 66:
        tier = 2
    else:
        tier = 3

    return percentile, tier


def get_week_volume(target_date: date | None = None) -> dict:
    """Get per-muscle volume data for the ISO week containing target_date."""
    if target_date is None:
        target_date = date.today()

    year, week, _ = target_date.isocalendar()
    week_start, week_end = _week_start_end(year, week)
    today = date.today()
    is_partial = week_end >= today and week_start <= today

    muscle_map = get_muscle_map()
    all_rows = history.get_all_history()

    # Current week rows
    current_week_rows = []
    for row in all_rows:
        try:
            d = datetime.strptime(row.date, "%Y-%m-%d").date()
        except ValueError:
            continue
        if week_start <= d <= week_end:
            current_week_rows.append(row)

    current_volumes, warnings = _compute_volume_for_rows(current_week_rows, muscle_map)

    # Historical weeks for percentile calculation
    historical_weeks = []
    for i in range(1, PERCENTILE_LOOKBACK_WEEKS + 1):
        past = target_date - timedelta(weeks=i)
        historical_weeks.append(_iso_week(past))

    # Identify deload weeks
    rows_by_week: dict[tuple[int, int], list[HistoryRow]] = {}
    for row in all_rows:
        try:
            d = datetime.strptime(row.date, "%Y-%m-%d").date()
        except ValueError:
            continue
        wk = _iso_week(d)
        rows_by_week.setdefault(wk, []).append(row)

    deload_weeks: set[tuple[int, int]] = set()
    for wk, wk_rows in rows_by_week.items():
        if any(_is_deload_row(r) for r in wk_rows):
            deload_weeks.add(wk)

    # Compute historical volumes (excluding deloads and zero-training weeks)
    hist_volumes = _get_weekly_volumes(all_rows, muscle_map, historical_weeks)

    # Build per-muscle response
    muscles = {}
    for muscle in ALL_MUSCLES:
        # Collect historical values for this muscle, excluding deloads and zeros
        hist_values = []
        for wk in historical_weeks:
            if wk in deload_weeks:
                continue
            vol = hist_volumes.get(wk, {}).get(muscle, 0.0)
            if vol > 0:
                hist_values.append(vol)

        percentile, tier = _compute_percentile_and_tier(
            current_volumes.get(muscle, 0.0), hist_values
        )

        muscles[muscle] = {
            "volume": round(current_volumes.get(muscle, 0.0), 1),
            "tier": tier,
            "percentile": percentile,
        }

    return {
        "week": f"{year}-W{week:02d}",
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "is_partial": is_partial,
        "muscles": muscles,
        "warnings": warnings,
    }


def get_muscle_history(muscle: str, weeks: int = 12) -> dict:
    """Get weekly volume time series for a single muscle."""
    today = date.today()
    muscle_map = get_muscle_map()
    all_rows = history.get_all_history()

    # Build list of weeks (most recent first, then reverse for chronological)
    week_keys = []
    for i in range(weeks - 1, -1, -1):
        d = today - timedelta(weeks=i)
        week_keys.append(_iso_week(d))

    # Identify deload weeks
    rows_by_week: dict[tuple[int, int], list[HistoryRow]] = {}
    for row in all_rows:
        try:
            d = datetime.strptime(row.date, "%Y-%m-%d").date()
        except ValueError:
            continue
        wk = _iso_week(d)
        rows_by_week.setdefault(wk, []).append(row)

    deload_weeks: set[tuple[int, int]] = set()
    for wk, wk_rows in rows_by_week.items():
        if any(_is_deload_row(r) for r in wk_rows):
            deload_weeks.add(wk)

    # Compute volumes for all requested weeks
    all_volumes = _get_weekly_volumes(all_rows, muscle_map, week_keys)

    # Collect non-deload, non-zero values for percentile
    hist_values = []
    for wk in week_keys:
        if wk in deload_weeks:
            continue
        vol = all_volumes.get(wk, {}).get(muscle, 0.0)
        if vol > 0:
            hist_values.append(vol)

    entries = []
    for wk in week_keys:
        year, week_num = wk
        vol = all_volumes.get(wk, {}).get(muscle, 0.0)
        _, tier = _compute_percentile_and_tier(vol, hist_values)
        entries.append({
            "week": f"{year}-W{week_num:02d}",
            "volume": round(vol, 1),
            "tier": tier,
        })

    return {
        "muscle": muscle,
        "weeks": entries,
    }
