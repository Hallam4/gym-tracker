# Daily Prehab Tab — Redesign Design Spec

**Date:** 2026-06-29
**Status:** Approved (design), pending spec review → implementation plan
**Component:** `frontend/src/components/PrehabTab.tsx` (+ new supporting files)

## 1. Goal

Replace the current "Prehab" tab (a three-toggle checklist: Warm-Up / Rehab / Proprioception) with a single **daily prehab session** covering three areas — **Shoulders, Lower Back, Proprioception** — that looks and behaves like the main "Today's Workout" tab.

## 2. Why

- The current tab is organised around stale categories, and "Proprioception" (lower-body single-leg balance) is mixed into what is otherwise shoulder work.
- New requirements: train shoulders, lower back, and proprioception **daily**.
  - **Shoulders:** the existing rehab has no direct anterior-deltoid / dynamic-stability work; deep research (see `tasks` output, 2026-06-29) supports adding it for a symptomatic, anterior-unstable right shoulder.
  - **Lower Back:** user is following the **Low Back Ability (LBA)** method (lowbackability.com / ATG "Back Ability Zero") — progressive controlled loaded back extension, qualitative progression.
- User wants the tab to feel like the main workout tab: its unified timer, card styling, progress bar, and green Complete flow.

## 3. Locked decisions

| Decision | Choice |
|---|---|
| Layout | One daily session; **3 collapsible sections** (Shoulders → Lower Back → Proprioception), each with its own progress; tap header to expand/collapse |
| Visual language | Match `TodayWorkout`/`ExerciseCard` — dark cards, pills, badges, progress bar, green gradient Complete button |
| Timer | The main tab's **unified stopwatch + rest countdown + full-screen GO overlay + beeps/vibrate** (replaces the old "Rest 0:30" button) |
| Logging | **Hybrid** — *loaded* moves get a light-weight ± and set buttons; *hold/band/balance* moves are quick tap-to-complete (stopwatch available to time holds) |
| Pain log | **None** — pure exercise tab |
| Day-type / phases | **None** — single flat daily list; intensity self-regulated by the flare rule |
| Heavy pressing | Stays in the workout tab, **not** here (this tab is light daily rehab/activation) |
| Backend | **None** — localStorage only, like the current tab |

## 4. Exercise content

`kind` drives the card UI: `loaded` = weight + set buttons; `hold` = tap (timer optional); `reps` = tap.

### 🦾 Shoulders
| Exercise | kind | Prescription | Tags |
|---|---|---|---|
| Anterior Delt Isometric | hold | 5×30–45s | easy, pain-free |
| Scap-Plane Front Raise | loaded | 2×12–15 | light, thumb-up, to shoulder height |
| Side-Lying ER | loaded | 3×15 | light, **cap 45°** |
| Rhythmic Stabilization | hold | 3×20–30s | scap plane |

### 🔻 Lower Back (Low Back Ability style)
| Exercise | kind | Prescription | Tags |
|---|---|---|---|
| Back Extension | loaded | 2–3×8–10 | **5s eccentric**, bodyweight → add DB |
| Reverse Hyper | reps | 2–3×12–15 | light, controlled |
| Jefferson Curl | loaded | 2×5–6 | light, slow — **progression (2–3×/week)** |

### 🧍 Proprioception
| Exercise | kind | Prescription | Tags |
|---|---|---|---|
| Single-Leg Stand (current level) | hold | 30–60s each | levels: eyes open → closed → cushion → +head turns |

**Total: 8 exercises.** Prescriptions are evidence-/program-informed starting points, deliberately light. Loaded items default to a low/zero starting weight.

## 5. Architecture

New code is isolated so the main workout tab is **not touched** in v1. (A later refactor could share the timer between both tabs.)

```
frontend/src/
  components/
    PrehabTab.tsx            # rewritten — orchestration only
    SessionTimer.tsx         # NEW — timer display + controls (presentational)
    PrehabSection.tsx        # NEW — collapsible section (header + progress + children)
    PrehabExerciseCard.tsx   # NEW — hybrid card (loaded vs hold/reps)
  hooks/
    useSessionTimer.ts       # NEW — stopwatch + rest countdown + audio/vibrate + GO state
    usePrehabSession.ts      # NEW — localStorage day-state + daily log
  data/
    prehabData.ts            # NEW — section + exercise definitions
```

### 5.1 Data model (`prehabData.ts`)
```ts
type SectionId = "shoulders" | "lowerback" | "proprioception";
type ExerciseKind = "loaded" | "hold" | "reps";

interface PrehabExercise {
  id: string;            // stable storage key, e.g. "ant-delt-iso"
  name: string;
  kind: ExerciseKind;
  sets: number;          // number of set "ticks" (hold/reps may be 1+)
  prescription: string;  // e.g. "2–3×8–10"
  tags: string[];        // pills, e.g. ["light", "cap 45°"]
  note?: string;         // e.g. "progression (2–3×/week)"
  weightStep?: number;   // loaded only: ± increment, default 2.5 (1.25 for light shoulder moves)
}

interface PrehabSectionDef { id: SectionId; label: string; icon: string; exercises: PrehabExercise[]; }
const PREHAB_SECTIONS: PrehabSectionDef[];   // ordered
```

### 5.2 Session state + log (`usePrehabSession.ts`, localStorage)
- **`gym-prehab-v2-today`** — current day's progress; auto-resets when the date rolls over:
  ```ts
  { date: string; entries: Record<string /*exId*/, { setsDone: number; weight?: string }> }
  ```
- **`gym-prehab-v2-log`** — completed-session history (most recent first, deduped by date):
  ```ts
  Array<{ date: string; done: number; total: number;
          sections: Record<SectionId, { done: number; total: number }> }>
  ```
- An exercise is **done** when `setsDone >= sets`. Section/overall progress counts **exercises done / total**.

### 5.3 Timer (`useSessionTimer.ts` + `SessionTimer.tsx`)
Replicates the main tab's behaviour as a self-contained, reusable unit:
- **Stopwatch** counts up; tap to pause/resume; **long-press (500ms) dismisses an active rest timer** (mirrors the main workout tab's behavior). Used to time holds.
- **Rest countdown**: `startRest(seconds)` (default **60s** for prehab); on reach 0 → set `done`, fire 3 beeps + vibrate, then repeat 2 beeps + vibrate every 3s until dismissed.
- **Full-screen GO overlay** when rest completes; tap to dismiss.
- Persistent `AudioContext` (init on first user gesture) for reliable iOS sound — mirrors the main tab's approach.
- State persisted via the session hook so a reload mid-session restores stopwatch + rest end.

### 5.4 Hybrid card (`PrehabExerciseCard.tsx`)
- Collapsed header: chevron, name, `done/sets` badge, pills (sets / reps / tags), optional `note`.
- **`loaded`** → expands to a weight ± adjuster (±2.5kg, or ±1.25kg for the light shoulder moves) and a row of set buttons (tap to log a set; tap again to undo). Starting a set may auto-start the rest timer.
- **`hold` / `reps`** → tap the row (or a single "done" control) to mark complete; no weight. Stopwatch is available to time holds.
- Visual styling mirrors `ExerciseCard` (rounded-2xl, ring, set-button grid).

### 5.5 `PrehabTab.tsx`
Renders: title + date → `SessionTimer` (sticky during rest) → overall progress bar → the 3 `PrehabSection`s → green **Complete Session** button → recent log list. Holds the timer + session state via the two hooks. On Complete: write a `gym-prehab-v2-log` entry for today (dedupe by date) and show a brief "Saved!" state.

## 6. Out of scope
- No backend / Google Sheets integration.
- No pain log, no phase/day-type logic.
- No changes to `TodayWorkout.tsx` or `ExerciseCard.tsx` in v1 (timer sharing is a possible future refactor).
- Heavy loaded pressing (landmine/neutral-grip) lives in the workout tab.

## 7. Safety & content notes
- The right shoulder is **actively symptomatic**; this tab is educational and not a substitute for the in-person physio assessment the research and the user's own notes recommend. Shoulder work starts with isometrics and stays light.
- **Flare rule governs progression** (both shoulder and LBA): if a move causes next-day soreness/flare, it drops to every other day / lighter. This is intent, not enforced in code.
- The **Lower Back** list reflects LBA staples; the user should confirm it against their actual LBA level/video (full level list is behind the program login). Jefferson Curl is a 2–3×/week progression, not hard-daily.
- Loaded back work kept **light (LBA "3/10 effort")** even though done daily.

## 8. Testing / verification
- `tsc`/Vite build passes (no type errors).
- Unit test the pure logic: exercise-done calculation, section/overall progress, daily-reset on date rollover, log dedupe-by-date.
- Manual verification in the running app (per user's deploy-verify workflow): expand/collapse sections, log a loaded set + weight, tap a hold done, run the rest timer to GO + dismiss, complete a session and see it logged, reload mid-session restores state.

## 9. Migration
- The old `gym-prehab-log` (keyed by date+type) is left in place; the new tab uses new `gym-prehab-v2-*` keys, so no data migration is required. Old log simply stops growing.
