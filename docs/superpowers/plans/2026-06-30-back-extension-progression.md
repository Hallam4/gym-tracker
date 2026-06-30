# Back Extension 5-Level Progression — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Lower Back section's three flat exercises with a single level-aware Back Extension progression (the 5-level Low Back Ability ladder), with the current level stored in localStorage and switchable on the card.

**Architecture:** Extend `prehabData.ts` with a `PrehabLevel` type and an optional `levels` field. A pure `activeExercise()` resolver collapses a progression + current level into the flat shape existing done-tracking expects, so `sectionProgress`/`overallProgress`/`buildLogEntry` gain an optional `levels` map. A thin `usePrehabLevels` hook persists the current level to localStorage. The set-button grid and weight ± adjuster are extracted into shared `SetButtonGrid`/`WeightAdjuster` presentational components used by both the existing `PrehabExerciseCard` and the new `PrehabProgressionCard` (which adds the level stepper, per-level Action/Purpose/Goal, and a progress ladder). `PrehabSection` picks the progression card when `ex.levels` is present.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind, vitest. `@tanstack/react-query` (existing, untouched here).

## Global Constraints

- **Run all commands from `frontend/`.** Test: `npm test` (vitest run). Type-check + bundle: `npm run build` (runs `tsc && vite build`).
- **Pure-logic tests only.** The repo has **no** component/hook test infra (no `@testing-library`, no jsdom). Do **NOT** add it. Logic goes in `lib/`/`data/` and is unit-tested; UI (`*.tsx`) and the thin hook are gated by `npm run build` (tsc) + manual verification — mirroring the untested `usePrehabSession.ts`.
- **Frontend-only.** Do NOT touch `backend/` or `frontend/src/api/gym.ts`. The backend stores per-section `done/total` generically; no API change.
- **Section ids unchanged:** `shoulders`, `lowerback`, `proprioception` (backend `SECTION_ORDER` depends on these).
- **localStorage key for levels:** `gym-prehab-levels` — distinct from the daily `gym-prehab-v2-today`.
- **Default level = 1**, clamped to `1..levels.length`.
- **Match the existing visual idiom** from `PrehabExerciseCard.tsx` (dark `rounded-2xl` cards, `ring-1`, gray/green/amber pills, `touch-target`, `h-11` set buttons). The set-button grid and weight adjuster are shared via `SetButtonGrid`/`WeightAdjuster` (Task 4) — both cards use them, so there is **no** duplicated set/weight markup.
- **A pre-commit hook auto-bumps `frontend/version.json`** — it appears in every commit's diff. Expected; not a per-task concern.
- **Every commit message ends with this trailer** (kept out of the per-step `-m` text below for brevity — append it to each commit):
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- Work happens on the existing branch `prehab-back-extension-progression`.

---

### Task 1: Data model — `PrehabLevel` + replace Lower Back content

**Files:**
- Modify: `frontend/src/data/prehabData.ts`
- Test: `frontend/src/data/prehabData.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface PrehabLevel { level: number; name: string; kind: ExerciseKind; sets: number; prescription: string; tags: string[]; weightStep?: number; action: string; purpose: string; goal: string }`
  - `PrehabExercise` gains optional `levels?: PrehabLevel[]`.
  - The `lowerback` section contains exactly one exercise: `{ id: "back-ext-progression", name: "Back Extension", levels: [L1..L5], note: "≥6 weeks per level", ... }` whose top-level `kind/sets/prescription/tags` mirror Level 1.

- [ ] **Step 1: Update the data tests (they will fail against current data)**

In `frontend/src/data/prehabData.test.ts`, change the "8 exercises" test to 6 and add a progression-shape test. Replace the `it("has 8 exercises total", ...)` block with:

```ts
  it("has 6 exercises total", () => {
    const count = PREHAB_SECTIONS.reduce((n, s) => n + s.exercises.length, 0);
    expect(count).toBe(6);
  });

  it("lower back is a single 5-level back-extension progression", () => {
    const lb = PREHAB_SECTIONS.find((s) => s.id === "lowerback")!;
    expect(lb.exercises).toHaveLength(1);
    const prog = lb.exercises[0];
    expect(prog.id).toBe("back-ext-progression");
    expect(prog.levels).toBeDefined();
    expect(prog.levels!.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
    for (const l of prog.levels!) {
      expect(["loaded", "hold", "reps"]).toContain(l.kind);
      expect(l.sets).toBeGreaterThanOrEqual(1);
      expect(l.action).toBeTruthy();
      expect(l.purpose).toBeTruthy();
      expect(l.goal).toBeTruthy();
      if (l.kind === "loaded") expect(l.weightStep ?? 0).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 2: Run the data tests to verify they fail**

Run: `npm test -- prehabData`
Expected: FAIL — current data has 8 exercises and 3 flat Lower Back items (no `levels`).

- [ ] **Step 3: Add the `PrehabLevel` type and `levels` field**

In `frontend/src/data/prehabData.ts`, after the `ExerciseKind` type and before `PrehabExercise`, add:

```ts
export interface PrehabLevel {
  level: number;         // 1-based, for display ("Level 2 of 5")
  name: string;
  kind: ExerciseKind;
  sets: number;
  prescription: string;
  tags: string[];
  weightStep?: number;   // loaded levels only
  action: string;
  purpose: string;
  goal: string;
}
```

Add one optional field to `PrehabExercise` (leave all existing fields unchanged):

```ts
  levels?: PrehabLevel[];   // when present → progression exercise (active level overrides top-level kind/sets/etc.)
```

- [ ] **Step 4: Define the 5 levels and replace the Lower Back exercises**

In `frontend/src/data/prehabData.ts`, above `export const PREHAB_SECTIONS`, add:

```ts
const BACK_EXT_LEVELS: PrehabLevel[] = [
  { level: 1, name: "Two-Leg Isometric Hold", kind: "hold", sets: 1, prescription: "build to 2-min hold",
    tags: ["reverse plank", "no spasms"],
    action: "Hold a straight-body reverse-plank position on the machine.",
    purpose: "Teaches the nervous system to fire the muscles safely without triggering spasms.",
    goal: "Build to a continuous 2-minute hold." },
  { level: 2, name: "Single-Leg Isometric Hold", kind: "hold", sets: 2, prescription: "build to 1 min/leg",
    tags: ["one leg off pad", "resist twist"],
    action: "Remove one leg from the pad, forcing the body to resist twisting.",
    purpose: "Activates the deep paraspinals and multifidus to handle diagonal forces.",
    goal: "Build to a 1-minute hold per leg." },
  { level: 3, name: "Full-Range Reps", kind: "reps", sets: 3, prescription: "build to 30 reps",
    tags: ["flat-back hinge → segmented", "controlled"],
    action: "Start with a flat-back hinge, then gradually move into segmented spinal flexing and extending.",
    purpose: "Rounding at the bottom decompresses the vertebrae; coming up re-compresses them under strength.",
    goal: "Build to 30 controlled reps." },
  { level: 4, name: "Single-Leg Reps", kind: "reps", sets: 2, prescription: "build to 20 slow reps/leg",
    tags: ["one leg", "slow"],
    action: "Perform full-range extensions using only one leg at a time.",
    purpose: "Evens out left-to-right muscular imbalance in the lower back and glutes.",
    goal: "Build to 20 slow reps per leg." },
  { level: 5, name: "Loaded Extensions", kind: "loaded", sets: 3, prescription: "progressive load", weightStep: 2.5,
    tags: ["plate / barbell", "perfect form"],
    action: "Add progressive resistance by holding a weight plate or barbell.",
    purpose: "Maximises tissue resilience and bulletproofs the spine against heavy lifting or impact.",
    goal: "Scale the weight up over time while keeping perfect form." },
];
```

Then in `PREHAB_SECTIONS`, replace the entire `lowerback` section's `exercises` array (the current Back Extension / Reverse Hyper / Jefferson Curl entries) with this single entry:

```ts
    exercises: [
      {
        id: "back-ext-progression",
        name: "Back Extension",
        kind: BACK_EXT_LEVELS[0].kind,            // mirror Level 1 (default/fallback)
        sets: BACK_EXT_LEVELS[0].sets,
        prescription: BACK_EXT_LEVELS[0].prescription,
        tags: BACK_EXT_LEVELS[0].tags,
        note: "≥6 weeks per level",
        levels: BACK_EXT_LEVELS,
      },
    ],
```

- [ ] **Step 5: Run the data tests to verify they pass**

Run: `npm test -- prehabData`
Expected: PASS (all 5 data tests, including the new progression-shape test).

- [ ] **Step 6: Commit**

```bash
git add src/data/prehabData.ts src/data/prehabData.test.ts
git commit -m "feat(prehab): add PrehabLevel model + replace Lower Back with 5-level back-extension progression"
```
(append the Co-Authored-By trailer)

---

### Task 2: Level-aware done-tracking — `clampLevel` + `activeExercise`

**Files:**
- Modify: `frontend/src/lib/prehabSession.ts`
- Test: `frontend/src/lib/prehabSession.test.ts`

**Interfaces:**
- Consumes: `PrehabExercise`, `PREHAB_SECTIONS` (Task 1).
- Produces:
  - `clampLevel(level: number, count: number): number` — bounds to `[1, count]` (returns 1 if `count <= 0`).
  - `activeExercise(ex: PrehabExercise, level: number): PrehabExercise` — for a progression exercise, returns a copy with `name/kind/sets/prescription/tags/weightStep` taken from `levels[clampLevel(level,len)-1]`; for a simple exercise returns `ex` unchanged (same reference).
  - `sectionProgress(sectionId, state, levels?: Record<string, number>)`, `overallProgress(state, levels?)`, `buildLogEntry(state, levels?)` — gain an optional trailing `levels` arg (default `{}`), resolving each exercise via `activeExercise` before counting. Backward compatible with existing 2-arg / 1-arg calls.

- [ ] **Step 1: Update existing "8 total" expectations and add the new tests**

In `frontend/src/lib/prehabSession.test.ts`:

(a) Update the import to add the two new helpers:
```ts
import {
  emptyDayState, rollIfNewDay, isExerciseDone,
  sectionProgress, overallProgress, buildLogEntry,
  clampLevel, activeExercise,
} from "./prehabSession";
```

(b) Add a reference to the progression exercise near the top, beside `antDelt`:
```ts
const backExt = PREHAB_SECTIONS[1].exercises[0]; // lowerback progression, id "back-ext-progression"
```

(c) Change the two `8` totals to `6`:
- In `it("overallProgress sums across all sections (8 total)", ...)`: rename to `(6 total)` and change `total: 8` → `total: 6`.
- In `it("buildLogEntry captures date + per-section + overall", ...)`: change `expect(entry.total).toBe(8)` → `expect(entry.total).toBe(6)`.

(d) Append these new tests inside the `describe` block:
```ts
  it("clampLevel bounds to [1, count]", () => {
    expect(clampLevel(0, 5)).toBe(1);
    expect(clampLevel(-3, 5)).toBe(1);
    expect(clampLevel(3, 5)).toBe(3);
    expect(clampLevel(9, 5)).toBe(5);
    expect(clampLevel(2, 0)).toBe(1);
  });

  it("activeExercise resolves the active level's tracking fields", () => {
    expect(activeExercise(backExt, 1).kind).toBe("hold");
    expect(activeExercise(backExt, 1).sets).toBe(1);
    expect(activeExercise(backExt, 3).kind).toBe("reps");
    expect(activeExercise(backExt, 3).sets).toBe(3);
    expect(activeExercise(backExt, 5).kind).toBe("loaded");
    expect(activeExercise(backExt, 99).sets).toBe(backExt.levels![4].sets); // clamps to L5
  });

  it("activeExercise returns simple exercises unchanged", () => {
    expect(activeExercise(antDelt, 3)).toBe(antDelt);
  });

  it("sectionProgress for lowerback respects the active level's set count", () => {
    const state = { date: "d", entries: { "back-ext-progression": { setsDone: 1 } } };
    // Level 1 needs 1 set → done
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 1 })).toEqual({ done: 1, total: 1 });
    // Level 3 needs 3 sets → not done with only 1 logged
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 3 })).toEqual({ done: 0, total: 1 });
  });
```

- [ ] **Step 2: Run the lib tests to verify they fail**

Run: `npm test -- prehabSession`
Expected: FAIL — `clampLevel`/`activeExercise` are not exported; totals are still 8; `sectionProgress` ignores the `levels` arg.

- [ ] **Step 3: Implement the helpers and thread the `levels` arg**

In `frontend/src/lib/prehabSession.ts`, add after `isExerciseDone`:

```ts
export function clampLevel(level: number, count: number): number {
  if (count <= 0) return 1;
  return Math.min(Math.max(Math.round(level), 1), count);
}

export function activeExercise(ex: PrehabExercise, level: number): PrehabExercise {
  if (!ex.levels || ex.levels.length === 0) return ex;
  const lvl = ex.levels[clampLevel(level, ex.levels.length) - 1];
  return { ...ex, name: lvl.name, kind: lvl.kind, sets: lvl.sets, prescription: lvl.prescription, tags: lvl.tags, weightStep: lvl.weightStep };
}
```

Replace `sectionProgress`, `overallProgress`, and `buildLogEntry` with level-aware versions:

```ts
export function sectionProgress(sectionId: SectionId, state: DayState, levels: Record<string, number> = {}): SectionProgress {
  const section = PREHAB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { done: 0, total: 0 };
  const done = section.exercises.filter((ex) =>
    isExerciseDone(activeExercise(ex, levels[ex.id] ?? 1), state.entries[ex.id])
  ).length;
  return { done, total: section.exercises.length };
}

export function overallProgress(state: DayState, levels: Record<string, number> = {}): SectionProgress {
  return PREHAB_SECTIONS.reduce<SectionProgress>(
    (acc, s) => {
      const p = sectionProgress(s.id, state, levels);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

export function buildLogEntry(state: DayState, levels: Record<string, number> = {}): LogEntry {
  const sections = Object.fromEntries(
    PREHAB_SECTIONS.map((s) => [s.id, sectionProgress(s.id, state, levels)])
  ) as Record<SectionId, SectionProgress>;
  const overall = overallProgress(state, levels);
  return { date: state.date, done: overall.done, total: overall.total, sections };
}
```

(`isExerciseDone` is unchanged — it still reads `ex.sets` on the already-resolved exercise.)

- [ ] **Step 4: Run the full test suite to verify it passes**

Run: `npm test`
Expected: PASS — all `prehabData`, `prehabSession`, and any other existing suites green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prehabSession.ts src/lib/prehabSession.test.ts
git commit -m "feat(prehab): level-aware done-tracking (clampLevel + activeExercise resolver)"
```
(append the Co-Authored-By trailer)

---

### Task 3: `usePrehabLevels` hook (localStorage current-level)

**Files:**
- Create: `frontend/src/hooks/usePrehabLevels.ts`

**Interfaces:**
- Consumes: nothing (thin localStorage wrapper; clamping happens in the card + `activeExercise`).
- Produces: `usePrehabLevels(): { levels: Record<string, number>; setLevel: (exId: string, level: number) => void }`. Persists `levels` to localStorage key `gym-prehab-levels`.

> No unit test — there is no hook-test infra (see Global Constraints), and this mirrors the untested `usePrehabSession.ts`. The gate is `npm run build` (tsc) in Step 2, plus integration/manual in Tasks 6–7.

- [ ] **Step 1: Create the hook**

Create `frontend/src/hooks/usePrehabLevels.ts` (pattern mirrors `usePrehabSession.ts`'s localStorage day-state):

```ts
import { useCallback, useEffect, useState } from "react";

const LEVELS_KEY = "gym-prehab-levels";

/** Current progression level per exercise id (1-based). Frontend-only, localStorage. */
export function usePrehabLevels() {
  const [levels, setLevels] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LEVELS_KEY);
      if (raw) return JSON.parse(raw) as Record<string, number>;
    } catch { /* ignore */ }
    return {};
  });

  useEffect(() => {
    try { localStorage.setItem(LEVELS_KEY, JSON.stringify(levels)); } catch { /* ignore */ }
  }, [levels]);

  const setLevel = useCallback((exId: string, level: number) => {
    setLevels((m) => ({ ...m, [exId]: level }));
  }, []);

  return { levels, setLevel };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS — `tsc` reports no errors and the Vite bundle builds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePrehabLevels.ts
git commit -m "feat(prehab): usePrehabLevels hook (localStorage current-level)"
```
(append the Co-Authored-By trailer)

---

### Task 4: Extract shared `SetButtonGrid` + `WeightAdjuster`

Pull the set-button grid and the weight ± adjuster out of `PrehabExerciseCard` into two reusable presentational components, then refactor `PrehabExerciseCard` to use them. This is a behaviour-preserving refactor that lets the new progression card (Task 5) reuse the exact same controls with no duplication.

**Files:**
- Create: `frontend/src/components/SetButtonGrid.tsx`
- Create: `frontend/src/components/WeightAdjuster.tsx`
- Modify: `frontend/src/components/PrehabExerciseCard.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `SetButtonGrid` — `default export`, props `{ sets: number; setsDone: number; label: string; onSetsDone: (setsDone: number) => void }`. Owns the tap-to-fill / tap-to-undo logic (`onSetsDone(i < setsDone ? i : i + 1)`); root has `mt-3`.
  - `WeightAdjuster` — `default export`, props `{ weight: string; step: number; onWeightChange: (weight: string) => void }`. Owns the ±-step logic; root has `mt-4`.

> No unit test (presentational, no component-test infra). Gate: `npm run build` (tsc) + `npm test` still green + manual in Task 7. Behaviour must be identical to the current card.

- [ ] **Step 1: Create `SetButtonGrid`**

Create `frontend/src/components/SetButtonGrid.tsx`:

```tsx
interface Props {
  sets: number;
  setsDone: number;
  label: string;      // used in the group aria-label
  onSetsDone: (setsDone: number) => void;
}

export default function SetButtonGrid({ sets, setsDone, label, onSetsDone }: Props) {
  // Tapping set i: if it's already filled, undo down to i; else fill up to i+1.
  const tapSet = (i: number) => onSetsDone(i < setsDone ? i : i + 1);

  return (
    <div className="grid gap-2.5 mt-3" style={{ gridTemplateColumns: `repeat(${Math.min(sets, 5)}, minmax(0, 1fr))` }} role="group" aria-label={`Sets for ${label}`}>
      {Array.from({ length: sets }, (_, i) => {
        const done = i < setsDone;
        return (
          <button
            key={i}
            onClick={() => tapSet(i)}
            aria-label={done ? `Set ${i + 1} done. Tap to undo.` : `Log set ${i + 1}.`}
            className={`h-11 rounded-lg font-bold text-base touch-target transition-all duration-150 active:scale-95 ${done ? "bg-green-700 text-white" : "bg-gray-800 text-gray-400"}`}
          >
            {done ? <span aria-hidden="true">&#10003;</span> : `S${i + 1}`}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `WeightAdjuster`**

Create `frontend/src/components/WeightAdjuster.tsx`:

```tsx
interface Props {
  weight: string;
  step: number;
  onWeightChange: (weight: string) => void;
}

export default function WeightAdjuster({ weight, step, onWeightChange }: Props) {
  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight) || 0;
    onWeightChange(String(Math.max(0, current + delta)));
  };

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <button
        onClick={() => adjustWeight(-step)}
        aria-label={`Decrease weight by ${step}kg`}
        className="w-11 h-11 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 active:scale-90 transition-all duration-150"
      >
        −
      </button>
      <div className="text-center min-w-[72px]">
        <div className="text-2xl font-bold text-white tabular-nums">{weight === "" ? 0 : weight} <span className="text-sm font-normal text-gray-300">kg</span></div>
      </div>
      <button
        onClick={() => adjustWeight(step)}
        aria-label={`Increase weight by ${step}kg`}
        className="w-11 h-11 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 active:scale-90 transition-all duration-150"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Refactor `PrehabExerciseCard` to use them**

In `frontend/src/components/PrehabExerciseCard.tsx`:

(a) Add imports at the top:
```ts
import SetButtonGrid from "./SetButtonGrid";
import WeightAdjuster from "./WeightAdjuster";
```

(b) Delete the now-unused local handlers and the `step` const: remove `const step = exercise.weightStep ?? 2.5;`, the `tapSet` function, and the `adjustWeight` function. Keep `setsDone`, `weight`, and `allDone`.

(c) Replace the **Weight adjuster** block (the `{exercise.kind === "loaded" && ( ... )}` JSX) with:
```tsx
      {exercise.kind === "loaded" && (
        <WeightAdjuster weight={weight} step={exercise.weightStep ?? 2.5} onWeightChange={onWeightChange} />
      )}
```

(d) Replace the **Set buttons** block (the `<div className="grid gap-2.5 mt-3" ...>` … `</div>`) with:
```tsx
      <SetButtonGrid sets={exercise.sets} setsDone={setsDone} label={exercise.name} onSetsDone={onSetsDone} />
```

- [ ] **Step 4: Type-check and confirm the suite still passes**

Run: `npm run build && npm test`
Expected: PASS — no `tsc` errors; existing tests unchanged and green (this is a presentational refactor).

- [ ] **Step 5: Commit**

```bash
git add src/components/SetButtonGrid.tsx src/components/WeightAdjuster.tsx src/components/PrehabExerciseCard.tsx
git commit -m "refactor(prehab): extract shared SetButtonGrid + WeightAdjuster from PrehabExerciseCard"
```
(append the Co-Authored-By trailer)

---

### Task 5: `PrehabProgressionCard` component

**Files:**
- Create: `frontend/src/components/PrehabProgressionCard.tsx`

**Interfaces:**
- Consumes: `PrehabExercise` (Task 1), `ExerciseEntry` + `clampLevel` (Task 2), `SetButtonGrid` + `WeightAdjuster` (Task 4).
- Produces: `default export function PrehabProgressionCard(props)` where
  `props = { exercise: PrehabExercise; level: number; entry?: ExerciseEntry; onLevelChange: (level: number) => void; onSetsDone: (setsDone: number) => void; onWeightChange: (weight: string) => void }`.

> No unit test (no component-test infra). Gate is `npm run build` (tsc) + manual in Task 7.

- [ ] **Step 1: Create the component**

Create `frontend/src/components/PrehabProgressionCard.tsx`:

```tsx
import { PrehabExercise } from "../data/prehabData";
import { ExerciseEntry, clampLevel } from "../lib/prehabSession";
import SetButtonGrid from "./SetButtonGrid";
import WeightAdjuster from "./WeightAdjuster";

interface Props {
  exercise: PrehabExercise;   // must have .levels
  level: number;              // current 1-based level
  entry?: ExerciseEntry;
  onLevelChange: (level: number) => void;
  onSetsDone: (setsDone: number) => void;
  onWeightChange: (weight: string) => void;
}

export default function PrehabProgressionCard({ exercise, level, entry, onLevelChange, onSetsDone, onWeightChange }: Props) {
  const levels = exercise.levels ?? [];
  const count = levels.length;
  const cur = clampLevel(level, count);
  const lvl = levels[cur - 1];

  const setsDone = entry?.setsDone ?? 0;
  const weight = entry?.weight ?? "";
  const allDone = setsDone >= lvl.sets;

  return (
    <div className={`bg-gray-900 rounded-2xl py-4 px-4 ring-1 mb-2.5 ${allDone ? "ring-green-800/50" : "ring-gray-800/60"}`}>
      {/* Header: name + note + done badge */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-white truncate">{exercise.name}</span>
        {exercise.note && (
          <span className="text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded shrink-0">{exercise.note}</span>
        )}
        <span className={`shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded-md ml-auto ${allDone ? "bg-green-900/50 text-green-400" : "bg-gray-800/70 text-gray-400"}`}>
          {allDone && <span className="mr-0.5" aria-hidden="true">&#10003;</span>}
          {setsDone}/{lvl.sets}
        </span>
      </div>

      {/* Level stepper */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => onLevelChange(clampLevel(cur - 1, count))}
          disabled={cur <= 1}
          aria-label="Previous level"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9664;</span>
        </button>
        <div className="flex-1 text-center min-w-0">
          <div className="text-xs text-gray-500">Level {cur} of {count}</div>
          <div className="text-sm font-semibold text-white truncate">{lvl.name}</div>
        </div>
        <button
          onClick={() => onLevelChange(clampLevel(cur + 1, count))}
          disabled={cur >= count}
          aria-label="Next level"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9654;</span>
        </button>
      </div>

      {/* Ladder */}
      <div className="flex items-center gap-1 mt-3" aria-hidden="true">
        {levels.map((l) => {
          const cls = l.level === cur ? "bg-emerald-500" : l.level < cur ? "bg-emerald-800" : "bg-gray-800";
          return <div key={l.level} className={`flex-1 h-1.5 rounded-full ${cls}`} />;
        })}
      </div>

      {/* Prescription + tags */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{lvl.prescription}</span>
        {lvl.tags.map((t) => (
          <span key={t} className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{t}</span>
        ))}
      </div>

      {/* Action / Purpose / Goal */}
      <div className="mt-3 space-y-1 text-xs leading-relaxed">
        <p className="text-gray-300"><span className="text-gray-500">Action: </span>{lvl.action}</p>
        <p className="text-gray-300"><span className="text-gray-500">Purpose: </span>{lvl.purpose}</p>
        <p className="text-emerald-300"><span className="text-gray-500">Goal: </span>{lvl.goal}</p>
      </div>

      {/* Weight adjuster (loaded level only) + set buttons — shared components */}
      {lvl.kind === "loaded" && (
        <WeightAdjuster weight={weight} step={lvl.weightStep ?? 2.5} onWeightChange={onWeightChange} />
      )}
      <SetButtonGrid sets={lvl.sets} setsDone={setsDone} label={lvl.name} onSetsDone={onSetsDone} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build`
Expected: PASS — no `tsc` errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PrehabProgressionCard.tsx
git commit -m "feat(prehab): PrehabProgressionCard (level stepper + action/purpose/goal + ladder)"
```
(append the Co-Authored-By trailer)

---

### Task 6: Wire it together — `PrehabSection`, `PrehabTab`, `usePrehabSession`

**Files:**
- Modify: `frontend/src/components/PrehabSection.tsx`
- Modify: `frontend/src/components/PrehabTab.tsx`
- Modify: `frontend/src/hooks/usePrehabSession.ts`

**Interfaces:**
- Consumes: `usePrehabLevels` (Task 3), `PrehabProgressionCard` (Task 5), `activeExercise`/level-aware progress (Task 2).
- Produces: a working Lower Back progression card in the running app; `Lower Back` logs as `1/1` when the active level's sets are complete.

- [ ] **Step 1: `PrehabSection` — render the progression card when `ex.levels` is present**

In `frontend/src/components/PrehabSection.tsx`:

(a) Add the import:
```ts
import PrehabProgressionCard from "./PrehabProgressionCard";
```

(b) Add two props to the `Props` interface:
```ts
  levels: Record<string, number>;
  onLevelChange: (exId: string, level: number) => void;
```
and add `levels` + `onLevelChange` to the destructured params of `PrehabSection`.

(c) Replace the `section.exercises.map(...)` block with a branch on `ex.levels`:
```tsx
          {section.exercises.map((ex) =>
            ex.levels ? (
              <PrehabProgressionCard
                key={ex.id}
                exercise={ex}
                level={levels[ex.id] ?? 1}
                entry={day.entries[ex.id]}
                onLevelChange={(lvl) => onLevelChange(ex.id, lvl)}
                onSetsDone={(setsDone) => onSetsDone(ex.id, setsDone)}
                onWeightChange={(w) => onWeightChange(ex.id, w)}
              />
            ) : (
              <PrehabExerciseCard
                key={ex.id}
                exercise={ex}
                entry={day.entries[ex.id]}
                onSetsDone={(setsDone) => onSetsDone(ex.id, setsDone)}
                onWeightChange={(w) => onWeightChange(ex.id, w)}
              />
            )
          )}
```

- [ ] **Step 2: `usePrehabSession` — pass the levels map into `buildLogEntry`**

In `frontend/src/hooks/usePrehabSession.ts`:

(a) Change the mutation to take the levels map as its variable:
```ts
  const mutation = useMutation({
    mutationFn: (levels: Record<string, number>) =>
      api.completePrehab(buildLogEntry(day, levels) as PrehabCompleteRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prehab-history"] }),
  });
```

(b) Change `completeSession` to accept and forward the map:
```ts
  const completeSession = useCallback((levels: Record<string, number>) => { mutation.mutate(levels); }, [mutation]);
```

- [ ] **Step 3: `PrehabTab` — own the levels map; make progress + rest-start level-aware**

In `frontend/src/components/PrehabTab.tsx`:

(a) Update imports:
```ts
import { overallProgress, sectionProgress, activeExercise } from "../lib/prehabSession";
import { usePrehabLevels } from "../hooks/usePrehabLevels";
```

(b) Add the hook next to `usePrehabSession`:
```ts
  const { levels, setLevel } = usePrehabLevels();
```

(c) Make overall progress level-aware:
```ts
  const overall = overallProgress(day, levels);
```

(d) In `handleSetsDone`, resolve the **active** level before deciding to start a rest (so L3/L4 reps and L5 loaded start a rest, but L1/L2 holds don't):
```ts
  const handleSetsDone = (exId: string, setsDone: number) => {
    const prev = day.entries[exId]?.setsDone ?? 0;
    setSetsDone(exId, setsDone);
    const raw = exById(exId);
    const ex = raw ? activeExercise(raw, levels[exId] ?? 1) : undefined;
    if (ex && setsDone > prev && (ex.kind === "loaded" || ex.kind === "reps")) {
      timer.startRest();
    }
  };
```

(e) In the `PREHAB_SECTIONS.map(...)`, make section progress level-aware and pass the two new props:
```tsx
        <PrehabSection
          key={section.id}
          section={section}
          day={day}
          progress={sectionProgress(section.id, day, levels)}
          levels={levels}
          open={open[section.id]}
          onToggle={() => setOpen((o) => ({ ...o, [section.id]: !o[section.id] }))}
          onSetsDone={handleSetsDone}
          onWeightChange={setWeight}
          onLevelChange={setLevel}
        />
```

(f) Update `handleComplete` to pass the levels map:
```ts
  const handleComplete = () => {
    setErrorDismissed(false);
    completeSession(levels);
  };
```

- [ ] **Step 4: Type-check and run the full test suite**

Run: `npm run build && npm test`
Expected: PASS — no `tsc` errors; all unit tests green (the level-aware progress funcs are covered by Task 2; existing 1-/2-arg calls still compile via the default `levels = {}`).

- [ ] **Step 5: Commit**

```bash
git add src/components/PrehabSection.tsx src/components/PrehabTab.tsx src/hooks/usePrehabSession.ts
git commit -m "feat(prehab): wire level-aware card into PrehabSection/PrehabTab/usePrehabSession"
```
(append the Co-Authored-By trailer)

---

### Task 7: Manual verification (running app)

**Files:** none (verification only).

> Per the user's deploy-verify workflow, confirm behaviour in the running app before considering this done. If anything fails, fix under the relevant task above and re-commit.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the printed local URL and go to the **Daily Prehab** tab; expand **Lower Back**.

- [ ] **Step 2: Walk the checklist**

- [ ] Lower Back shows **one** card titled "Back Extension" with a `≥6 weeks per level` pill and a `Level 1 of 5` stepper (◀ disabled at L1).
- [ ] Tapping ▶ advances through L2…L5: the name, prescription, tags, Action/Purpose/Goal, the ladder highlight, and the set-button count all update; ▶ disables at L5.
- [ ] On **L5** a weight ± adjuster appears (±2.5 kg); it does not appear on L1–L4.
- [ ] Ticking the active level's set(s) flips the card + the Lower Back section header to done; the overall progress bar counts Lower Back as **1** item (overall `…/6`).
- [ ] Logging a set on **L3/L4/L5** starts the rest timer; logging on **L1/L2** (holds) does **not**.
- [ ] Reload the page mid-session: the **current level persists** (localStorage `gym-prehab-levels`); the day's set ticks persist as before.
- [ ] The Shoulders + Proprioception cards still render and behave exactly as before (regression check on the `SetButtonGrid`/`WeightAdjuster` extraction).
- [ ] Tap **Complete Session**, then check the Recent Log / backend `Prehab` tab shows today with `Lower Back: 1/1` when the active level was completed.

- [ ] **Step 3 (after merge): deploy-verify**

Once merged to `master` and Render redeploys (~3 min), confirm the live frontend bundle contains the change (e.g. curl live `index.html` → grab `assets/index-*.js` → `grep` for `back-ext-progression` or `Single-Leg Isometric`), per the repo's frontend deploy-verify note.

---

## Self-Review

**Spec coverage:**
- §1/§3 replace Lower Back with one progression → Task 1.
- §2 `PrehabLevel` type + `levels?` field → Task 1.
- §4 the 5 levels (content + set counts) → Task 1 `BACK_EXT_LEVELS`.
- §5.1 data model → Task 1.
- §5.2 `usePrehabLevels` localStorage (`gym-prehab-levels`) → Task 3.
- §5.3 `activeExercise` resolver + level-aware `sectionProgress`/`overallProgress`/`buildLogEntry` → Task 2.
- §5.4 progression card (stepper, ladder, Action/Purpose/Goal, set/weight controls) + set-state-persists-across-level-switch (uses per-`exId` `entry`) → Task 5 + Task 6 wiring. Set/weight controls are the shared `SetButtonGrid`/`WeightAdjuster` (Task 4).
- §5.5 `PrehabSection` branch on `ex.levels` → Task 6.
- §8 testing (data shape, resolver/progress) → Tasks 1, 2; UI/hook gated by build → Tasks 3, 4, 5; manual → Task 7.
- §9 migration (new key; dropped exIDs harmless) → no code needed; covered by Task 1 replacing the array.
- Rest-start must use the **active** level's kind (not the L1-mirror top-level) → Task 6 Step 3(d). ✓
- DRY decision (pre-flight): set/weight controls extracted to shared components, used by both cards → Task 4; Task 5 consumes them. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code; commands have expected output. ✓

**Type consistency:** `activeExercise(ex, level)` and `clampLevel(level, count)` signatures match between Task 2 (definition) and Tasks 5/6 (use). `SetButtonGrid` props `{ sets, setsDone, label, onSetsDone }` and `WeightAdjuster` props `{ weight, step, onWeightChange }` match between Task 4 (definition) and their use in `PrehabExerciseCard` (Task 4) and `PrehabProgressionCard` (Task 5). `levels: Record<string, number>` is consistent across `usePrehabLevels` (Task 3), the progress funcs (Task 2), and `PrehabSection`/`PrehabTab`/`usePrehabSession` (Task 6). `completeSession(levels)` matches between Task 6 Step 2 (definition) and Step 3(f) (call). The progression entry id `back-ext-progression` is consistent across Tasks 1, 2 tests. ✓
