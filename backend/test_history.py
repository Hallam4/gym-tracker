"""Tests for the progression engine (history.compute_double_progression).

compute_double_progression is a pure function over a list of HistoryRow, so it
needs no Google Sheets access. These tests pin down the Tier 0 fixes:
  - bonus sets logged beyond the prescription don't block progression
  - a weight increase requires CONFIRMATION_SESSIONS consecutive ceiling sessions
  - deload sessions are excluded from the working set
"""
import pytest

import history
from history import compute_double_progression, CONFIRMATION_SESSIONS
from models import Exercise, HistoryRow


def make_row(date: str, weight: float, reps: list[int], prescribed, notes: str = "",
             exercise: str = "Bench", day: str = "Upper 1") -> HistoryRow:
    """Build a HistoryRow with up to 5 sets.

    `prescribed` -> the Sets column; accepts an int (e.g. 4) or a range string
    (e.g. "3-4").
    """
    sets = [str(r) for r in reps] + [""] * (5 - len(reps))
    return HistoryRow(
        date=date, day=day, exercise=exercise, weight=f"{weight}kg",
        sets=str(prescribed),
        set1=sets[0], set2=sets[1], set3=sets[2], set4=sets[3], set5=sets[4],
        rest1="", rest2="", rest3="", rest4="", notes=notes,
    )


def make_ex(name: str, weight: float, set_results: list[str],
            reps: str = "8-12", sets: str = "3", target: str = "12") -> Exercise:
    """Build a current-session Exercise (the shape compute_workout_summary takes)."""
    return Exercise(
        name=name, reps=reps, sets=sets, weight=f"{weight}kg", target=target,
        set_results=set_results, rest_times=[], notes="",
        sheet_row=0, superset_group=0,
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


def test_old_heavy_session_does_not_resurrect_working_weight():
    """Regression (live bench bug): a single old heavy session (e.g. a 1RM test)
    in the lookback window must NOT push the deload threshold so high that the
    real, sustained current working weight gets filtered out as a 'deload'.

    Did 70kg for 3x10 across the last three sessions; an old 110kg single sits
    further back. The suggestion must be based on the current 70kg, not the old
    110kg (the original bug suggested 110kg)."""
    rows = [
        make_row("2026-02-05", 70, [10, 10, 10], 3),  # current working weight
        make_row("2026-02-03", 70, [10, 10, 10], 3),
        make_row("2026-02-01", 70, [10, 10, 10], 3),
        make_row("2026-01-10", 110, [1], 3),          # old 1RM-style heavy single
    ]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=10)
    assert r["prev_weight"] == 70.0
    assert float(r["suggested_weight"]) == 70.0  # NOT 110 (old heavy session)
    assert r["suggested_target"] == "11"          # 3x10 hit target 10 -> push 11


def test_helper_ignores_bonus_sets_directly():
    # Fixed sets (set_min == set_max): all prescribed sets must hit the ceiling,
    # bonus sets beyond set_max are ignored.
    assert history._sets_at_ceiling([12, 12, 12, 8], set_min=3, set_max=3, threshold=12) is True
    assert history._sets_at_ceiling([12, 12, 11], set_min=3, set_max=3, threshold=12) is False
    assert history._sets_at_ceiling([], set_min=3, set_max=3, threshold=12) is False
    # Unknown prescribed count (0,0): evaluate every logged set.
    assert history._sets_at_ceiling([12, 12, 12, 8], set_min=0, set_max=0, threshold=12) is False


# ==========================================================================
# Phase 1: mode-driven engine
# ==========================================================================

# --- _parse_set_range -----------------------------------------------------

@pytest.mark.parametrize("raw,expected", [
    ("3-4", (3, 4)),
    ("4", (4, 4)),
    (" 3 - 4 ", (3, 4)),
    ("", (0, 0)),
    ("abc", (0, 0)),
    ("0", (0, 0)),
])
def test_parse_set_range(raw, expected):
    assert history._parse_set_range(raw) == expected


# --- resolve_mode (hybrid: explicit override, else infer) -----------------

def test_resolve_mode_explicit_override_wins():
    assert history.resolve_mode("strength", 8, 12, False) == "strength"
    assert history.resolve_mode("VOLUME", 6, 10, False) == "volume"  # case-insensitive


def test_resolve_mode_infers_from_rep_range():
    assert history.resolve_mode("", 2, 5, False) == "strength"   # low reps
    assert history.resolve_mode("", 4, 6, False) == "strength"   # rep_max <= 6
    assert history.resolve_mode("", 6, 10, False) == "evolve"    # hypertrophy default
    assert history.resolve_mode("", 8, 12, False) == "evolve"
    assert history.resolve_mode("", 12, 15, False) == "volume"   # rep_min >= 12
    assert history.resolve_mode("", 15, 20, False) == "volume"


def test_resolve_mode_amrap_takes_precedence():
    assert history.resolve_mode("", 10, 12, True) == "amrap"


def test_resolve_mode_unknown_string_falls_back_to_inference():
    assert history.resolve_mode("nonsense", 6, 10, False) == "evolve"


# --- generalized _sets_at_ceiling (variable set ranges) -------------------

def test_sets_at_ceiling_variable_range():
    # 3-4 sets, need >= 3 at ceiling (5 reps)
    assert history._sets_at_ceiling([5, 5, 5, 3], set_min=3, set_max=4, threshold=5) is True
    assert history._sets_at_ceiling([5, 5, 3, 3], set_min=3, set_max=4, threshold=5) is False
    # only did 2 sets, min is 3 -> not a full ceiling session
    assert history._sets_at_ceiling([5, 5], set_min=3, set_max=4, threshold=5) is False
    # a 5th set beyond set_max is ignored
    assert history._sets_at_ceiling([5, 5, 5, 5, 2], set_min=3, set_max=4, threshold=5) is True


# --- per-mode compute_double_progression ----------------------------------

def test_evolve_variable_set_progresses_on_3_of_4():
    """OHP-style: 3 of 4 sets at the top rep -> weight up."""
    rows = [make_row("2026-01-03", 80, [5, 5, 5, 3], prescribed="3-4")]
    r = compute_double_progression("Bench", 2, 5, rows, current_target=5, mode="evolve")
    assert r["sessions_at_ceiling"] == 1
    assert float(r["suggested_weight"]) == 82.5
    assert r["suggested_target"] == "2"  # reset to rep_min


def test_strength_mode_still_computes_suggestion():
    """Suggest-only is enforced at the write-back layer; compute still returns
    the suggested weight for display."""
    rows = [make_row("2026-01-03", 80, [5, 5, 5], prescribed=3)]
    r = compute_double_progression("Bench", 2, 5, rows, current_target=5, mode="strength")
    assert r["sessions_at_ceiling"] == 1
    assert float(r["suggested_weight"]) == 82.5


def test_volume_mode_holds_weight_at_ceiling():
    """Volume work doesn't chase weight even when every set hits the top."""
    rows = [make_row("2026-01-03", 80, [15, 15, 15, 15], prescribed=4, exercise="Lateral Raise")]
    r = compute_double_progression("Lateral Raise", 12, 15, rows, current_target=15, mode="volume")
    assert float(r["suggested_weight"]) == 80.0  # held, no +2.5


def test_amrap_mode_holds_weight():
    rows = [make_row("2026-01-03", 0, [25, 22, 20], prescribed=3, exercise="Push-up")]
    r = compute_double_progression("Push-up", 10, 12, rows, current_target=12, mode="amrap")
    assert r["suggested_weight"] in (None, "0.0")  # bodyweight / held


def test_mode_defaults_to_evolve_for_backward_compat():
    """Existing callers that omit mode get the evolve (today's) behavior."""
    rows = [make_row("2026-01-03", 80, [12, 12, 12], 3)]
    r = compute_double_progression("Bench", 8, 12, rows, current_target=12)
    assert float(r["suggested_weight"]) == 82.5


# --- mode config tables ---------------------------------------------------

def test_rest_by_mode_covers_all_modes():
    for m in ("strength", "evolve", "volume", "amrap"):
        assert isinstance(history.REST_BY_MODE[m], int) and history.REST_BY_MODE[m] > 0


def test_default_sets_by_mode_covers_all_modes():
    for m in ("strength", "evolve", "volume", "amrap"):
        lo, hi = history.DEFAULT_SETS_BY_MODE[m]
        assert 0 < lo <= hi


def test_auto_writes_weight_only_for_evolve():
    """Write-back gate: only evolve mutates the sheet."""
    assert history.auto_writes_weight("evolve") is True
    assert history.auto_writes_weight("strength") is False
    assert history.auto_writes_weight("volume") is False
    assert history.auto_writes_weight("amrap") is False


# --- session scoping ------------------------------------------------------
# The same exercise can live in two sessions with different purposes (e.g. OHP
# as a heavy press in Upper 1 and a light pump in Arms). Progression must be
# scoped to the session so the two slots don't contaminate each other.

def test_progression_scoped_to_session_ignores_other_sessions():
    """Regression: OHP is a heavy press in Upper 1 (60kg) and a light 12-rep pump
    in Arms (30kg). The Arms suggestion must be anchored to the 30kg Arms work,
    not the heavier Upper 1 sessions — otherwise the lighter slot inherits a
    wildly too-heavy weight."""
    rows = [
        make_row("2026-03-10", 60, [5, 5, 5], 3, exercise="OHP", day="Upper 1"),
        make_row("2026-03-08", 30, [12, 12, 12], 3, exercise="OHP", day="Arms"),
        make_row("2026-03-03", 60, [5, 5, 5], 3, exercise="OHP", day="Upper 1"),
        make_row("2026-03-01", 30, [12, 12, 12], 3, exercise="OHP", day="Arms"),
    ]
    r = compute_double_progression("OHP", 8, 12, rows, current_target=12, day_label="Arms")
    assert r["prev_weight"] == 30.0
    assert float(r["suggested_weight"]) == 32.5  # 30 + 2.5, from Arms ceiling only


def test_progression_scoping_accepts_short_code():
    """day_label accepts the short code too — the callers pass wtype / req.day
    (e.g. "Arm"), which must resolve to the stored long label ("Arms")."""
    rows = [
        make_row("2026-03-10", 60, [5, 5, 5], 3, exercise="OHP", day="Upper 1"),
        make_row("2026-03-08", 30, [12, 12, 12], 3, exercise="OHP", day="Arms"),
    ]
    r = compute_double_progression("OHP", 8, 12, rows, current_target=12, day_label="Arm")
    assert r["prev_weight"] == 30.0  # resolved "Arm" -> "Arms", Upper 1 ignored


def test_progression_without_day_label_pools_all_sessions():
    """Backward compat: omitting day_label preserves the old name-only pooling,
    so existing callers are unaffected until they opt in. Here the most recent
    session is the 60kg Upper 1 work; the 30kg Arms sets fall below the deload
    threshold and are dropped, so the suggestion is (wrongly) anchored to 60kg —
    exactly the behaviour the day_label fix exists to override."""
    rows = [
        make_row("2026-03-10", 60, [5, 5, 5], 3, exercise="OHP", day="Upper 1"),
        make_row("2026-03-08", 30, [12, 12, 12], 3, exercise="OHP", day="Arms"),
        make_row("2026-03-03", 60, [5, 5, 5], 3, exercise="OHP", day="Upper 1"),
        make_row("2026-03-01", 30, [12, 12, 12], 3, exercise="OHP", day="Arms"),
    ]
    r = compute_double_progression("OHP", 8, 12, rows, current_target=12)
    assert r["prev_weight"] == 60.0
    assert float(r["suggested_weight"]) == 60.0


# --- workout summary scoping ----------------------------------------------
# compute_workout_summary drives the post-workout "vs previous / new PR" panel.
# It must compare like-for-like within a session, or a light Arms OHP looks like
# a huge weight drop vs the heavy Upper 1 OHP and never registers an Arms PR.

def test_workout_summary_scoped_to_session():
    prior = [
        make_row("2026-03-10", 60, [5, 5, 5], 3, exercise="OHP", day="Upper 1"),
        make_row("2026-03-08", 27.5, [12, 12, 12], 3, exercise="OHP", day="Arms"),
    ]
    current = [make_ex("OHP", 30, ["12", "12", "12"])]  # today's Arms OHP — an Arms PR
    summaries = history.compute_workout_summary(
        current, "2026-03-12", day_label="Arms", history_rows=prior
    )
    s = summaries[0]
    assert s.prev_weight == 27.5    # vs prior Arms work, not the 60kg Upper 1
    assert s.weight_change == 2.5   # 30 - 27.5
    assert s.is_weight_pr is True   # beats best Arms (pooled it'd be False vs 60kg)


def test_workout_summary_without_day_label_pools_all_sessions():
    """Backward compat: omitting day_label keeps the old name-only comparison."""
    prior = [
        make_row("2026-03-10", 60, [5, 5, 5], 3, exercise="OHP", day="Upper 1"),
        make_row("2026-03-08", 27.5, [12, 12, 12], 3, exercise="OHP", day="Arms"),
    ]
    current = [make_ex("OHP", 30, ["12", "12", "12"])]
    summaries = history.compute_workout_summary(current, "2026-03-12", history_rows=prior)
    s = summaries[0]
    assert s.prev_weight == 60.0    # most recent OHP overall is the 60kg Upper 1
    assert s.is_weight_pr is False  # 30 < 60


# ==========================================================================
# e1RM integrity: rep cap + mode-aware suppression
# ==========================================================================
# Epley (w × (1 + reps/30)) diverges badly at high reps — a 20-rep calf set
# produced an absurd 226.7kg "PR" on the live board. Reps are capped at
# E1RM_REP_CAP, and volume/amrap exercises don't get an e1RM at all.

def make_struct_ex(name: str, reps: str, target: str = "", mode: str = "") -> Exercise:
    """Build a Structure-tab Exercise (the shape parse_structure_tab produces)."""
    return Exercise(
        name=name, reps=reps, sets="3", weight="20kg", target=target,
        set_results=[], rest_times=[], notes="", mode=mode,
        sheet_row=0, superset_group=0,
    )


# --- epley_e1rm helper ------------------------------------------------------

def test_epley_e1rm_caps_reps_at_12():
    """85kg × 20 reps must score the same as 85kg × 12 — not extrapolate."""
    assert history.epley_e1rm(85, 20) == pytest.approx(85 * (1 + 12 / 30))  # 119.0
    assert history.epley_e1rm(85, 12) == pytest.approx(85 * (1 + 12 / 30))


def test_epley_e1rm_below_cap_unchanged():
    assert history.epley_e1rm(100, 5) == pytest.approx(100 * (1 + 5 / 30))
    assert history.epley_e1rm(80, 1) == pytest.approx(80 * (1 + 1 / 30))


def test_epley_e1rm_zero_inputs_return_zero():
    assert history.epley_e1rm(0, 10) == 0.0
    assert history.epley_e1rm(80, 0) == 0.0
    assert history.epley_e1rm(-5, 10) == 0.0


def test_tracks_e1rm_by_mode():
    """e1RM is meaningful for strength/evolve; meaningless for volume/amrap.
    Unknown/missing mode (exercise not in Structure) keeps the e1RM (capped)."""
    assert history.tracks_e1rm("strength") is True
    assert history.tracks_e1rm("evolve") is True
    assert history.tracks_e1rm("volume") is False
    assert history.tracks_e1rm("amrap") is False
    assert history.tracks_e1rm(None) is True


# --- get_prs ----------------------------------------------------------------

def test_get_prs_caps_high_rep_e1rm():
    """Regression (live calf-raise bug): a 20-rep set must not mint a monster PR."""
    rows = [make_row("2026-01-03", 85, [20, 18, 15], 4, exercise="Calf Raise")]
    prs = history.get_prs(history_rows=rows, modes={})
    assert prs[0].estimated_1rm == pytest.approx(119.0)  # 85 × 1.4, NOT 226.7


def test_get_prs_volume_mode_has_no_e1rm():
    rows = [make_row("2026-01-03", 85, [20, 18, 15], 4, exercise="Calf Raise")]
    prs = history.get_prs(history_rows=rows, modes={"calf raise": "volume"})
    assert prs[0].estimated_1rm == 0.0
    assert prs[0].estimated_1rm_date == ""
    assert prs[0].best_weight == 85.0  # weight PR still tracked


def test_get_prs_amrap_mode_has_no_e1rm():
    rows = [make_row("2026-01-03", 20, [25, 22], 3, exercise="Weighted Push-up")]
    prs = history.get_prs(history_rows=rows, modes={"weighted push-up": "amrap"})
    assert prs[0].estimated_1rm == 0.0


def test_get_prs_strength_mode_keeps_capped_e1rm():
    rows = [make_row("2026-01-03", 100, [5, 5, 5], 3, exercise="Bench")]
    prs = history.get_prs(history_rows=rows, modes={"bench": "strength"})
    assert prs[0].estimated_1rm == pytest.approx(round(100 * (1 + 5 / 30), 1))


# --- get_exercise_progress ---------------------------------------------------

def test_get_exercise_progress_caps_e1rm():
    rows = [make_row("2026-01-03", 85, [20, 18, 15], 4, exercise="Calf Raise")]
    pts = history.get_exercise_progress("Calf Raise", history_rows=rows, modes={})
    assert pts[0].estimated_1rm == pytest.approx(119.0)


def test_get_exercise_progress_volume_mode_zeroes_e1rm():
    rows = [make_row("2026-01-03", 85, [20, 18, 15], 4, exercise="Calf Raise")]
    pts = history.get_exercise_progress(
        "Calf Raise", history_rows=rows, modes={"calf raise": "volume"}
    )
    assert pts[0].estimated_1rm == 0.0
    assert pts[0].volume > 0  # tonnage still tracked


# --- compute_workout_summary --------------------------------------------------

def test_workout_summary_caps_e1rm_for_pr_comparison():
    """A high-rep lighter session must not out-'1RM' a genuinely heavier one.
    Prior: 100kg × 12 (capped e1RM 140). Current: 90kg × 20 — uncapped Epley
    would score 150 and celebrate a false PR; capped it scores 126 → no PR."""
    prior = [make_row("2026-01-01", 100, [12, 12, 12], 3, exercise="Bench")]
    current = [make_ex("Bench", 90, ["20", "18", "15"])]
    s = history.compute_workout_summary(current, "2026-01-03", history_rows=prior, modes={})
    assert s[0].is_1rm_pr is False


def test_workout_summary_no_1rm_pr_for_volume_mode():
    """Volume work never fires the 1RM-PR celebration."""
    prior = [make_row("2026-01-01", 15, [12, 12, 12, 12], 4, exercise="Lateral Raise")]
    current = [make_ex("Lateral Raise", 15, ["15", "15", "15", "15"], reps="12-15", sets="4", target="15")]
    s = history.compute_workout_summary(
        current, "2026-01-03", history_rows=prior, modes={"lateral raise": "volume"}
    )
    assert s[0].is_1rm_pr is False
    assert s[0].is_weight_pr is False  # same weight — and weight logic untouched


def test_workout_summary_capped_e1rm_pr_still_fires_for_real_progress():
    """Sanity: capping must not kill legitimate 1RM PRs (heavier weight, low reps)."""
    prior = [make_row("2026-01-01", 100, [5, 5, 5], 3, exercise="Bench")]
    current = [make_ex("Bench", 105, ["5", "5", "5"], reps="4-6", sets="3", target="5")]
    s = history.compute_workout_summary(current, "2026-01-03", history_rows=prior, modes={})
    assert s[0].is_1rm_pr is True


# --- parse_rep_range (moved from main so history can resolve Structure modes) --

def test_parse_rep_range_basics():
    assert history.parse_rep_range(None, "8-12") == (8, 12)
    assert history.parse_rep_range("10", "8-12") == (8, 12)  # reps wins over target
    assert history.parse_rep_range(None, "5") == (3, 5)      # single value → (n-2, n)
    assert history.parse_rep_range(None, "AMRAP") == (8, 12) # AMRAP → default
    assert history.parse_rep_range(None, None) == (8, 12)


# --- Structure → mode map -----------------------------------------------------

def test_resolve_modes_infers_from_structure():
    by_type = {
        "U1": [make_struct_ex("Bench", reps="4-6")],          # strength
        "L1": [make_struct_ex("Calf Raise", reps="12-15")],   # volume
        "U2": [make_struct_ex("Leg Raise", reps="AMRAP")],    # amrap
    }
    modes = history._resolve_modes(by_type)
    assert modes["bench"] == "strength"
    assert modes["calf raise"] == "volume"
    assert modes["leg raise"] == "amrap"


def test_resolve_modes_explicit_cell_wins():
    by_type = {"U1": [make_struct_ex("Face Pulls", reps="8-12", mode="volume")]}
    assert history._resolve_modes(by_type)["face pulls"] == "volume"


def test_resolve_modes_cross_day_precedence_keeps_e1rm():
    """OHP is heavy strength work in Upper 1 and a light pump in Arms — the
    strength slot means its e1RM is meaningful, so strength must win the map."""
    by_type = {
        "U1": [make_struct_ex("OHP", reps="2-5")],    # strength
        "Arm": [make_struct_ex("OHP", reps="12-15")], # volume
    }
    assert history._resolve_modes(by_type)["ohp"] == "strength"
