# Back Extension 5-Level Progression — Design Spec

**Date:** 2026-06-30
**Status:** Approved (design), pending spec review → implementation plan
**Component:** `frontend/src/data/prehabData.ts` + new `PrehabProgressionCard.tsx` / `usePrehabLevels.ts`

## 1. Goal

Replace the **Lower Back** section's three flat exercises (Back Extension, Reverse Hyper,
Jefferson Curl) with a single **level-aware Back Extension progression** — the 5-level Low
Back Ability ("Back Ability Zero") ladder. The user works **one level at a time** (≥6 weeks
each) and advances by tapping a stepper on the card. Each level shows its own action,
purpose, and goal.

## 2. Why

- The current Lower Back section is three separate cards with fixed prescriptions. The LBA
  method the user follows is actually a **single qualitative progression** through 5 levels —
  three parallel cards misrepresent it.
- The user wants the full per-level guidance (what to do, why, and the target to build to)
  visible in the app, and wants to flip between levels themselves as they progress.
- Progression is slow (≥6 weeks/level), so the "current level" is long-lived state that must
  persist across days — distinct from the daily set-tracking that resets each day.

## 3. Locked decisions

| Decision | Choice |
|---|---|
| Representation | **Extend the data model** with per-level definitions; render a single **level-aware card** (chosen over a flat "current level" label or five separate cards) |
| Level control | **Tap-to-advance, frontend-only** — current level stored in `localStorage`, adjustable via a `◀ Ln of 5 ▶` stepper on the card |
| Section contents | Lower Back's 3 exercises are **replaced** by the single progression exercise (Reverse Hyper + Jefferson Curl removed) |
| Backend | **None** — no new field/endpoint; `prehab.py` already stores per-section `done/total` generically |
| Section `done/total` | Lower Back becomes **1 item**, done when the **active level's** sets are complete |

### Known tradeoff (accepted)
The current level lives in `localStorage` only, so it **won't sync across devices** and swims
slightly against the recent prehab move from localStorage → backend (commit `49d2a52`). Chosen
deliberately to avoid backend scope. Mitigated by isolating it behind one hook (§5.2) so a
later move to the backend is a one-file change.

## 4. Exercise content — the 5 levels

A `PrehabLevel` carries both the **tracking fields** (`kind`, `sets`, `prescription`, `tags`,
`weightStep`) and the **reference text** (`action`, `purpose`, `goal`). `kind` drives the
card controls: `hold`/`reps` = set-tick buttons only; `loaded` = weight ± plus set buttons.

| Lvl | Name | kind | sets | prescription | Action | Purpose | Goal |
|----|------|------|------|--------------|--------|---------|------|
| 1 | Two-Leg Isometric Hold | hold | 1 | build to 2-min hold | Hold a straight-body reverse-plank position on the machine. | Teaches the nervous system to fire the muscles safely without triggering spasms. | Build to a continuous 2-minute hold. |
| 2 | Single-Leg Isometric Hold | hold | 2 (per leg) | build to 1 min/leg | Remove one leg from the pad, forcing the body to resist twisting. | Activates the deep paraspinals and multifidus to handle diagonal forces. | Build to a 1-minute hold per leg. |
| 3 | Full-Range Reps | reps | 3 | build to 30 reps | Start with a flat-back hinge, then gradually move into segmented spinal flexing and extending. | Rounding at the bottom decompresses the vertebrae; coming up re-compresses them under strength. | Build to 30 controlled reps. |
| 4 | Single-Leg Reps | reps | 2 (per leg) | build to 20 slow reps/leg | Perform full-range extensions using only one leg at a time. | Evens out left-to-right muscular imbalance in the lower back and glutes. | Build to 20 slow reps per leg. |
| 5 | Loaded Extensions | loaded | 3 | progressive load (±2.5kg) | Add progressive resistance by holding a weight plate or barbell. | Maximises tissue resilience and bulletproofs the spine against heavy lifting/impact. | Scale the weight up over time while keeping perfect form. |

- **Section note:** "≥6 weeks per level before progressing."
- **Default level:** 1.
- The `sets` counts are **starting set-tick schemes** (the LBA source gives build-to *goals*,
  not set schemes); they are deliberately simple and can be tuned later by editing data only.

## 5. Architecture

New code is isolated; the existing `PrehabExerciseCard` and all simple exercises are untouched.

```
frontend/src/
  data/
    prehabData.ts            # + PrehabLevel type, levels? on PrehabExercise, replace Lower Back
  lib/
    prehabSession.ts         # done-tracking made level-aware via activeExercise() resolver
  hooks/
    usePrehabLevels.ts       # NEW — localStorage current-level map (isolated persistence)
    usePrehabSession.ts      # wire in current-level map for progress calc + pass to section
  components/
    PrehabProgressionCard.tsx  # NEW — level stepper + ladder + action/purpose/goal + tracking
    PrehabSection.tsx          # picks ProgressionCard when ex.levels present, else normal card
```

### 5.1 Data model (`prehabData.ts`)
```ts
export interface PrehabLevel {
  level: number;            // 1-based, for display ("L2 of 5")
  name: string;             // "Single-Leg Isometric Hold"
  kind: ExerciseKind;       // hold | reps | loaded
  sets: number;             // set-tick count for this level
  prescription: string;     // "build to 1 min/leg"
  tags: string[];
  weightStep?: number;      // loaded levels only
  action: string;
  purpose: string;
  goal: string;
}

export interface PrehabExercise {
  // ...existing fields unchanged...
  levels?: PrehabLevel[];   // when present → progression exercise (render ProgressionCard)
}
```
For the progression entry, the existing flat `kind/sets/prescription/tags/weightStep` mirror
**Level 1** (the default/fallback), so any code that reads `ex.sets` without a resolved level
still behaves sensibly. Source of truth for the active level is `levels[currentLevel-1]`.

### 5.2 Current-level state (`usePrehabLevels.ts`, localStorage)
- Own key **`gym-prehab-levels`** (separate from the daily `gym-prehab-v2-today`, since the
  level persists across days):
  ```ts
  Record<string /*exId*/, number /*1-based level*/>
  ```
- API: `level(exId, fallback) → number` and `setLevel(exId, n)`, **clamped to `1..levels.length`**.
- Defaults to the exercise's default (1) when unset. All persistence lives here, so swapping
  to a backend later touches only this file.

### 5.3 Done-tracking (`prehabSession.ts`)
- New pure resolver `activeExercise(ex, level): PrehabExercise` — for a progression exercise it
  returns a flat exercise using `levels[level-1]`'s fields (preserving `id`); for a simple
  exercise it returns `ex` unchanged.
- `isExerciseDone` / `sectionProgress` / `overallProgress` / `buildLogEntry` take the
  current-level map and resolve via `activeExercise` before counting. Lower Back therefore has
  `total = 1`, `done = 1` once the active level's `sets` are ticked. No change to the backend
  row shape (`Lower Back: done/total`).

### 5.4 `PrehabProgressionCard.tsx`
Renders, for the active level:
- A **`◀ L2 of 5 ▶` stepper** (calls `setLevel`; arrows disabled at the ends).
- Active level **name + prescription pill + tag pills**.
- **Action / Purpose / Goal** text (Goal emphasised as the build-to target).
- A compact **ladder** of all 5 levels: past = ✓, current = ◀ highlight, upcoming = ⋯ muted.
- **Set-tick buttons** (and the ± weight adjuster for the `loaded` level only), bound to the
  **active** level's `sets`/`weightStep`, reusing the existing card's tap-to-fill / tap-to-undo
  and weight-adjust behaviour. Visual language matches `PrehabExerciseCard`.

Set-tick state (`setsDone`/`weight`) is stored per `exId` in the daily day-state, **not per
level**. Switching level therefore re-renders the buttons against the new level's `sets`
(display clamped to the new count) while reusing the same `setsDone`. This is acceptable:
level changes are rare (≥6 weeks apart) and not a same-session action, and `setsDone`
self-corrects as you tap. The day-state still resets each day as today.

### 5.5 `PrehabSection.tsx`
When an exercise has `levels`, render `PrehabProgressionCard` (passing the current level +
`setLevel`); otherwise render the existing `PrehabExerciseCard`. Everything else unchanged.

## 6. Out of scope
- No backend / Google Sheets / API changes.
- No change to the Shoulders or Proprioception sections (the same level pattern *could* later
  unify the "Single-Leg Stand (current level)" entry, but not now — YAGNI).
- No cross-device sync of the current level (see §3 tradeoff).
- No change to the main workout tab, the timer, or `PrehabExerciseCard` internals.

## 7. Safety & content notes
- The 5 levels and the ≥6-weeks-per-level cadence are the **Low Back Ability** progression the
  user already follows; this card is an organiser/tracker, not medical advice.
- Loaded work (Level 5) stays light and form-first ("perfect form" goal); progression is
  qualitative and self-regulated.

## 8. Testing / verification (TDD)
- `prehabData.test.ts` — the progression entry is well-formed: `levels` present, levels are
  1..5 contiguous, each level's `kind` is valid, `loaded` levels carry `weightStep`.
- `prehabSession.test.ts` — `activeExercise` resolves the correct level; `sectionProgress`
  for Lower Back is `0/1` until the active level's sets are complete, then `1/1`; switching
  level changes the required set count.
- `usePrehabLevels` — persists to localStorage, defaults to 1 when unset, clamps to `1..5`.
- `tsc`/Vite build passes (no type errors).
- Manual (per the user's deploy-verify workflow): step through L1→L5, confirm action/purpose/
  goal + prescription update, tick sets to complete Lower Back, reload preserves the level,
  and a completed session still logs `Lower Back: 1/1`.

## 9. Migration
- New `gym-prehab-levels` key; no migration needed. Existing daily/day-state keys untouched.
- Removing Reverse Hyper + Jefferson Curl from the data drops their stale `entries` keys
  harmlessly (the day-state is keyed by exId and simply stops referencing them).
