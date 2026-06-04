"""Tests for the progression engine (history.compute_double_progression).

compute_double_progression is a pure function over a list of HistoryRow, so it
needs no Google Sheets access. These tests pin down the Tier 0 fixes:
  - bonus sets logged beyond the prescription don't block progression
  - a weight increase requires CONFIRMATION_SESSIONS consecutive ceiling sessions
  - deload sessions are excluded from the working set
"""
import history
from history import compute_double_progression, CONFIRMATION_SESSIONS
from models import HistoryRow


def make_row(date: str, weight: float, reps: list[int], prescribed: int, notes: str = "",
             exercise: str = "Bench") -> HistoryRow:
    """Build a HistoryRow with up to 5 sets. `prescribed` -> the Sets column."""
    sets = [str(r) for r in reps] + [""] * (5 - len(reps))
    return HistoryRow(
        date=date, day="Upper 1", exercise=exercise, weight=f"{weight}kg",
        sets=str(prescribed),
        set1=sets[0], set2=sets[1], set3=sets[2], set4=sets[3], set5=sets[4],
        rest1="", rest2="", rest3="", rest4="", notes=notes,
    )


# --- baseline behaviour ---------------------------------------------------

def test_no_history_returns_none():
    assert compute_double_progression("Bench", 8, 12, []) is None


def test_no_matching_exercise_returns_none():
    rows = [make_row("2026-01-01", 80, [12, 12, 12], 3, exercise="Squat")]
    assert compute_double_progression("Bench", 8, 12, rows) is None


# --- 0c: weight increase needs CONFIRMATION_SESSIONS in a row -------------

def test_single_ceiling_session_increases_weight():
    """With CONFIRMATION_SESSIONS=1, one full ceiling session bumps the weight."""
    rows = [make_row("2026-01-03", 80, [12, 12, 12], 3)]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    assert r["sessions_at_ceiling"] == 1
    assert r["sessions_at_ceiling"] >= CONFIRMATION_SESSIONS
    assert float(r["suggested_weight"]) == 82.5
    assert r["suggested_target"] == "8"  # reset to rep_min


def test_two_ceiling_sessions_increase_weight_and_reset_target():
    rows = [
        make_row("2026-01-03", 80, [12, 12, 12], 3),
        make_row("2026-01-01", 80, [12, 12, 12], 3),
    ]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    assert r["sessions_at_ceiling"] >= CONFIRMATION_SESSIONS
    assert float(r["suggested_weight"]) == 82.5
    assert r["suggested_target"] == "8"  # reset to rep_min


def test_recent_miss_blocks_progression():
    """A miss in the most recent session resets the count to 0 — no increase,
    regardless of older ceiling sessions."""
    rows = [
        make_row("2026-01-05", 80, [10, 10, 10], 3),  # most recent: miss
        make_row("2026-01-03", 80, [12, 12, 12], 3),
        make_row("2026-01-01", 80, [12, 12, 12], 3),
    ]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    assert r["sessions_at_ceiling"] == 0
    assert float(r["suggested_weight"]) == 80.0


# --- 0b: bonus sets must not block progression ----------------------------

def test_bonus_set_below_ceiling_does_not_block_ceiling():
    """3 prescribed sets at ceiling + a lighter bonus 4th set still counts."""
    rows = [make_row("2026-01-03", 80, [12, 12, 12, 8], prescribed=3)]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    assert r["sessions_at_ceiling"] == 1  # bonus 8 ignored


def test_bonus_laden_sessions_still_earn_increase():
    rows = [
        make_row("2026-01-03", 80, [12, 12, 12, 8], prescribed=3),
        make_row("2026-01-01", 80, [12, 12, 12, 9], prescribed=3),
    ]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    assert r["sessions_at_ceiling"] >= CONFIRMATION_SESSIONS
    assert float(r["suggested_weight"]) == 82.5


def test_unknown_prescribed_count_falls_back_to_all_sets():
    """If Sets is blank/0, evaluate every logged set (legacy behaviour)."""
    rows = [make_row("2026-01-03", 80, [12, 12, 12, 8], prescribed=0)]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    assert r["sessions_at_ceiling"] == 0  # the trailing 8 now counts


# --- target bump within a weight (double progression) ---------------------

def test_target_bumps_when_hitting_current_target_below_ceiling():
    rows = [make_row("2026-01-03", 80, [10, 10, 10], 3)]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=10)
    assert r["sessions_at_ceiling"] == 0
    assert float(r["suggested_weight"]) == 80.0
    assert r["suggested_target"] == "11"


def test_target_bump_ignores_bonus_set_below_target():
    """A lighter bonus set must not block the within-weight target bump."""
    rows = [make_row("2026-01-03", 80, [10, 10, 10, 6], prescribed=3)]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=10)
    assert r["suggested_target"] == "11"  # bonus 6 ignored


# --- deload handling ------------------------------------------------------

def test_deload_session_excluded_from_working_weight():
    """A [DELOAD] session is the most recent, but the working set ignores it."""
    rows = [
        make_row("2026-01-05", 60, [12, 12, 12], 3, notes="[DELOAD] back week"),
        make_row("2026-01-03", 80, [12, 12, 12], 3),
        make_row("2026-01-01", 80, [12, 12, 12], 3),
    ]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    # prev_* reflects what was actually done last (the deload)
    assert r["prev_weight"] == 60.0
    # but the suggested increase is based on the 80kg working sessions
    assert r["sessions_at_ceiling"] >= CONFIRMATION_SESSIONS
    assert float(r["suggested_weight"]) == 82.5


def test_helper_ignores_bonus_sets_directly():
    assert history._sets_at_ceiling([12, 12, 12, 8], prescribed=3, rep_max=12) is True
    assert history._sets_at_ceiling([12, 12, 11], prescribed=3, rep_max=12) is False
    assert history._sets_at_ceiling([], prescribed=3, rep_max=12) is False
    assert history._sets_at_ceiling([12, 12, 12, 8], prescribed=0, rep_max=12) is False
