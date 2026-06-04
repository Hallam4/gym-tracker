# Tier 1 — Mode-driven progression engine (design spec)

Status: **approved design, not yet implemented** · Author pass: 2026-06-04
Builds on Tier 0 (commit `c814469`): bonus-set-aware ceiling check + single
`CONFIRMATION_SESSIONS` source of truth.

## Goal
Replace the one-size-fits-all double-progression engine with per-exercise
**modes**, matching the ANH principle that strength, hypertrophy, isolation and
AMRAP work progress differently. Make **variable set ranges** (e.g. `3-4`) a
first-class concept. (See `~/.claude/.../memory/gym-progression.md` for the ANH
research this derives from.)

## Locked decisions
1. **Strength mode = suggest-only.** Surface a readiness signal; never auto-write
   weight. (ANH: "don't add weight just because you hit the reps.")
2. **Hybrid mode assignment.** Infer a default from the rep range; an explicit
   `Mode` column overrides.
3. **Ceiling rule = order-independent count.** `count(reps[:set_max] >= rep_max)
   >= set_min`. Degrades exactly to today's "all sets" when set_min==set_max.
4. **Rest timer is mode-aware.** Backend returns `rest_seconds` per exercise;
   frontend uses it instead of the fixed 240s constant.

## Modes

| Mode | Reps | Sets default | Progression | Auto-writes weight? | Rest default |
|------|------|--------------|-------------|---------------------|--------------|
| `strength` | 2–6 | 3 (fixed) | Readiness signal at ceiling | **No** (suggest-only) | 180s |
| `evolve` | 6–12 | 3–4 (variable) | Double progression, variable-set ceiling | **Yes** (+2.5kg) | 150s |
| `volume` | 10–20 | 4 (fixed) | Log only, no weight chasing | No | 90s |
| `amrap` | AMRAP | as logged | Track rep PRs | No | 60s |

In all modes the `Weight` column = current working load; mode only changes the
**write-back policy** and the displayed signal.

## Mode resolution (hybrid)
1. If the Structure row has a non-blank `Mode` cell matching a known mode
   (case-insensitive) → use it.
2. Else infer:
   - `reps`/`target` is AMRAP → `amrap`
   - `rep_max <= 6` → `strength`
   - `rep_min >= 12` → `volume`
   - else → `evolve`
3. **Caveat to document for the user:** inference cannot reliably distinguish an
   isolation lift (`volume`) from a compound at the same rep range — so `volume`
   is the one mode worth tagging explicitly. Everything else infers well.

## Backend changes

### `parser.py`
- Read optional `mode` column (`col_map.get("mode")`).
- Keep `sets` as the raw string; parse bounds downstream.

### new helpers in `history.py`
```python
def _parse_set_range(s: str) -> tuple[int, int]:
    # "3-4" -> (3,4); "4" -> (4,4); blank/garbage -> (0,0) (caller applies default)

def resolve_mode(mode_cell: str, rep_min, rep_max, is_amrap) -> str:
    # hybrid resolution per rules above

def _sets_at_ceiling(reps, set_min, set_max, threshold) -> bool:
    # count(reps[:set_max] where r >= threshold) >= set_min
    # generalizes the Tier 0 helper (threshold = rep_max for ceiling,
    # current_target for the within-weight target bump)
```

### `compute_double_progression` → mode-aware
Signature gains `mode`, `set_min`, `set_max`. Behavior:
- `evolve`: variable-set ceiling (count >= set_min hits rep_max) → +2.5kg, reset
  target to rep_min; else target bump if count >= set_min hits current_target.
- `strength`: same ceiling computation, but the result is flagged suggest-only
  (the write-back layer must skip it). `suggested_weight` still populated for
  display.
- `volume` / `amrap`: `suggested_weight = base` (hold); no target evolution.

### `main.py` write-back gate
Only write weight/target back to the sheet when `mode == "evolve"` **and**
`sessions_at_ceiling >= CONFIRMATION_SESSIONS`. Strength is computed-but-not-written.

### `models.py` — `Exercise` additions
- `mode: str`
- `set_min: int`, `set_max: int`
- `rest_seconds: int`
(`sessions_at_ceiling`, `rep_min/max`, `is_amrap` already exist.)

Rest defaults: module-level `REST_BY_MODE = {"strength":180,"evolve":150,"volume":90,"amrap":60}`.

## Frontend changes

### `api/gym.ts`
Add `mode`, `set_min`, `set_max`, `rest_seconds` to the `Exercise` interface.

### `TodayWorkout.tsx`
- Replace the fixed `REST_DURATION_S = 240` with the active exercise's
  `rest_seconds` (superset: take the max across the group).

### `ExerciseCard.tsx`
- **Set buttons:** render `set_max` slots. `1..set_min` required; `set_min+1..set_max`
  "in-range optional" (lighter style); beyond `set_max` = bonus (existing style).
- **Set count pill:** show the range, e.g. "3–4 sets".
- **Progression badge keyed on mode:**
  - `evolve` + increase → "Weight up! Hit your top reps" (existing green)
  - `strength` + at ceiling → "Ready to add weight" (amber/info, no auto-bump)
  - `volume` / `amrap` → no weight-pressure badge

## Backward compatibility
Purely additive. No `Mode` column → inferred. Single-int `sets` → fixed range.
History rows unchanged (bounds parsed from stored `sets` string). Nothing breaks
if the sheet is never edited.

## Test plan (extend `test_history.py`)
- `_parse_set_range`: "3-4", "4", "", "abc", "0".
- `resolve_mode`: explicit override wins; each inference branch; AMRAP.
- `_sets_at_ceiling` generalized: fixed (all-must-hit), variable (3 of 4),
  bonus-beyond-set_max ignored, threshold variants.
- Per-mode `compute_double_progression`: evolve progresses on 3/4; strength
  computes suggestion but flagged suggest-only; volume/amrap hold.
- Real OHP case: `sets="3-4"`, `reps="2-5"`, 3 of 4 sets at 5 reps → progresses.
- Write-back gate (in a main.py-level test or by asserting the suggest-only flag):
  strength not written, evolve written.

## Phased rollout
1. **Backend core** — parsing, helpers, mode-aware compute, model fields, tests.
   (No behavior change until sheet/Mode used; evolve == today for fixed sets.)
2. **Write-back gate** — strength suggest-only in `main.py`.
3. **Frontend** — interface, mode badges, variable set buttons, mode-aware rest.
4. **Sheet** — (user) optionally tag `volume` exercises; everything else infers.

## Risks
- Mis-tagged/mis-inferred mode changes progression behavior → mitigated by
  inference defaults + tests + the fact that `evolve` reproduces today's behavior
  for fixed sets.
- Strength suggest-only stops the auto-write you have today for those lifts —
  intentional and the whole point, but a visible behavior change.
