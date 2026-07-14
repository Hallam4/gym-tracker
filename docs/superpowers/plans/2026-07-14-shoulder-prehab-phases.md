# Shoulder Prehab 3-Phase Programme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the shoulder prehab LBA sequencing (squeezes → stretch-loaded → pack/pull) as a 3-phase programme in the Daily Prehab tab, per the approved spec `docs/superpowers/specs/2026-07-14-shoulder-prehab-phases-design.md`.

**Architecture:** Per-exercise `phasePlan` metadata + section-level `phases` in `prehabData.ts`; a pure `phaseDose`/`effectiveExercise`/`visibleExercises` resolver layer in `prehabSession.ts`; a `usePrehabPhase` localStorage hook; a `PrehabPhaseCard` stepper at the top of the Shoulders section. The Closed-Chain Pack ladder and all non-shoulder sections have no `phasePlan` and are provably untouched.

**Tech Stack:** React + TypeScript + Vite, vitest, Tailwind classes inline, localStorage state, Render auto-deploy from `master`.

## Global Constraints

- Frontend-only. No changes under `backend/`, no Google Sheets or API changes (except the payload already produced by `buildLogEntry`, whose shape is unchanged).
- Existing exercise ids MUST NOT change (localStorage tick/weight/ladder state keyed on them). New id allowed: `stretch-ir`.
- UI copy: always "Phase N of 3" and "Level N of 5" in full — never bare codes (collides with U1/U2/L1/L2 split names).
- Do not edit `frontend/version.json` — the pre-commit hook stamps it automatically on every commit.
- The user's workout split, session logging, back-extension ladder, lower-back and proprioception sections must behave identically at every phase.
- All commands run from `frontend/` unless stated. Tests: `npx vitest run src/lib/prehabSession.test.ts`. Full check: `npm run build` (runs `tsc`).
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Repair the stale baseline tests

The suite is currently RED (4 failures): count assertions predate the 12 Jul exercise additions (shoulders 4→7 exercises, lowerback 1→4, overall 6→12). Fix the assertions to match today's data so later tasks start from green.

**Files:**
- Modify: `frontend/src/lib/prehabSession.test.ts:36,41,49,80,82`

**Interfaces:**
- Consumes: existing `PREHAB_SECTIONS` (shoulders 7 exercises, lowerback 4, proprioception 1).
- Produces: a green baseline suite. No API changes.

- [ ] **Step 1: Confirm the baseline failure**

Run: `npx vitest run src/lib/prehabSession.test.ts`
Expected: FAIL — 4 failed | 7 passed. Failures are all count assertions (`total: 4`, `total: 6`, `total: 1`).

- [ ] **Step 2: Update the count assertions**

In `frontend/src/lib/prehabSession.test.ts` apply these five exact edits:

```ts
// line 36 — shoulders now has 7 exercises:
    expect(sectionProgress("shoulders", state)).toEqual({ done: 1, total: 7 });

// line 41 — overall now 12 exercises:
    expect(overallProgress(state)).toEqual({ done: 1, total: 12 });

// line 49 — same total via buildLogEntry:
    expect(entry.total).toBe(12);

// lines 80 and 82 — lowerback now has 4 exercises:
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 1 })).toEqual({ done: 1, total: 4 });
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 3 })).toEqual({ done: 0, total: 4 });
```

Also update the two comments above lines 80/82 ("Level 1 needs 1 set → done" stays accurate; no other changes).

- [ ] **Step 3: Run tests to verify green**

Run: `npx vitest run src/lib/prehabSession.test.ts`
Expected: PASS — 11 passed.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/prehabSession.test.ts
git commit -m "test: repair stale prehab count assertions (12 Jul exercises)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Phase types + shoulders phase data (inert)

Add the phase type definitions and `phasePlan` data to `prehabData.ts`. No resolver exists yet, so behaviour is unchanged — this task is data + invariant tests only. `stretch-ir` is NOT added here (it lands with the resolver in Task 3 so visible counts change only once).

**Files:**
- Modify: `frontend/src/data/prehabData.ts`
- Test: `frontend/src/lib/prehabSession.test.ts` (new describe block)

**Interfaces:**
- Produces (consumed by Tasks 3–5):
  - `interface PhaseDose { sets: number; prescription: string; tags?: string[]; note?: string; maintenance?: boolean }`
  - `interface PrehabPhaseDef { phase: number; name: string; goal: string; advanceWhen: string }`
  - `PrehabExercise.phasePlan?: Record<number, PhaseDose | null>`
  - `PrehabSectionDef.phases?: PrehabPhaseDef[]` (shoulders defines 3)

- [ ] **Step 1: Write the failing invariant tests**

Append to `frontend/src/lib/prehabSession.test.ts` (inside the file, after the existing describe block):

```ts
describe("phase data invariants", () => {
  const shoulders = PREHAB_SECTIONS[0];

  it("shoulders defines exactly 3 phases, numbered 1..3", () => {
    expect(shoulders.phases?.map((p) => p.phase)).toEqual([1, 2, 3]);
  });

  it("only the shoulders section defines phases", () => {
    for (const s of PREHAB_SECTIONS.slice(1)) expect(s.phases).toBeUndefined();
  });

  it("every phasePlan is exhaustive over the section's phases", () => {
    for (const ex of shoulders.exercises) {
      if (!ex.phasePlan) continue;
      for (const p of shoulders.phases!) {
        expect(Object.prototype.hasOwnProperty.call(ex.phasePlan, p.phase),
          `${ex.id} missing phase ${p.phase}`).toBe(true);
      }
    }
  });

  it("no exercise mixes levels with phasePlan; pack ladder has no phasePlan", () => {
    for (const s of PREHAB_SECTIONS) for (const ex of s.exercises) {
      if (ex.levels) expect(ex.phasePlan, `${ex.id} mixes levels+phasePlan`).toBeUndefined();
    }
    const pack = shoulders.exercises.find((e) => e.id === "closed-chain-progression")!;
    expect(pack.phasePlan).toBeUndefined();
  });

  it("no exercise outside shoulders has a phasePlan", () => {
    for (const s of PREHAB_SECTIONS.slice(1)) for (const ex of s.exercises)
      expect(ex.phasePlan).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify the new block fails**

Run: `npx vitest run src/lib/prehabSession.test.ts`
Expected: FAIL — "shoulders defines exactly 3 phases" fails (`phases` undefined); exhaustiveness tests pass vacuously; 15 passed / 1 failed is acceptable — the phases test is the driver.

- [ ] **Step 3: Add types and data to prehabData.ts**

In `frontend/src/data/prehabData.ts`, insert after the `PrehabLevel` interface (line 15):

```ts
export interface PhaseDose {
  sets: number;
  prescription: string;
  tags?: string[];
  note?: string;
  maintenance?: boolean;   // renders the "maintenance" pill
}

export interface PrehabPhaseDef {
  phase: number;        // 1-based, display "Phase 2 of 3"
  name: string;
  goal: string;
  advanceWhen: string;  // manual gate — card copy only, never auto-advances
}
```

Add to `PrehabExercise` (after `levels?`):

```ts
  // When present: per-phase dose override. null = hidden in that phase.
  // Must define EVERY phase of the owning section (test-enforced). Absent = phase-independent.
  phasePlan?: Record<number, PhaseDose | null>;
```

Add to `PrehabSectionDef` (after `exercises`):

```ts
  phases?: PrehabPhaseDef[];   // shoulders only
```

Insert before `PREHAB_SECTIONS`:

```ts
const SHOULDER_PHASES: PrehabPhaseDef[] = [
  { phase: 1, name: "Short-Range Squeezes",
    goal: "Months of easy, pain-free short-range cuff work in adducted, low-provocation positions.",
    advanceWhen: "8–12 weeks all-GREEN (no ache, no apprehension) and target doses feel easy." },
  { phase: 2, name: "Stretch-Loaded",
    goal: "Load the cuff through range with light dumbbells — full comfortable range, slow.",
    advanceWhen: "4–6 weeks GREEN on full-range dumbbell work." },
  { phase: 3, name: "Pack / Pull",
    goal: "Row progressions (C-scoop) as the new stimulus; earlier work drops to maintenance.",
    advanceWhen: "Ongoing — final phase. Pack ladder Level 5 stays gated on being symptom-free." },
];
```

Set `phases: SHOULDER_PHASES` on the shoulders section object, and add `phasePlan` to the six phase-governed exercises (leave `closed-chain-progression` untouched):

```ts
      { id: "ant-delt-iso", name: "Anterior Delt Isometric", kind: "hold", sets: 5, prescription: "5×30–45s", tags: ["easy", "pain-free"],
        phasePlan: {
          1: { sets: 5, prescription: "5×30–45s" },
          2: { sets: 2, prescription: "2×30s", maintenance: true },
          3: { sets: 1, prescription: "1×45s", maintenance: true },
        } },
      { id: "scap-front-raise", name: "Scap-Plane Front Raise", kind: "loaded", sets: 2, prescription: "2×12–15", tags: ["light", "thumb-up", "to shoulder height"], weightStep: 1.25,
        phasePlan: {
          1: null,
          2: { sets: 2, prescription: "2×12–15" },
          3: { sets: 1, prescription: "1×12–15", maintenance: true },
        } },
      { id: "side-lying-er", name: "Side-Lying ER", kind: "loaded", sets: 3, prescription: "3×15", tags: ["light", "cap 45°"], weightStep: 1.25,
        phasePlan: {
          1: { sets: 3, prescription: "3×15", tags: ["light", "cap 45°"] },
          2: { sets: 3, prescription: "3×12–15", tags: ["light", "full comfortable range", "slow"] },
          3: { sets: 2, prescription: "2×12", maintenance: true },
        } },
      { id: "belly-press-ir", name: "Belly-Press IR (subscap)", kind: "loaded", sets: 3, prescription: "3×12–15", tags: ["band/light", "elbow tucked", "anterior stabiliser"], note: "arm adducted — low-provocation", weightStep: 1.25,
        phasePlan: {
          1: { sets: 3, prescription: "3×12–15" },
          2: { sets: 2, prescription: "2×12", maintenance: true },
          3: { sets: 2, prescription: "2×12", maintenance: true },
        } },
      { id: "scap-retraction", name: "Band Pull-Apart / Face Pull", kind: "loaded", sets: 2, prescription: "2×12–15", tags: ["rear delt + mid/lower trap", "squeeze at short range", "C-scoop"], note: "posterior scap — balances the pack ladder; low-provocation", weightStep: 1.25,
        phasePlan: {
          1: { sets: 2, prescription: "2×12–15" },
          2: { sets: 1, prescription: "1×15", maintenance: true },
          3: { sets: 3, prescription: "3×8–12", tags: ["C-scoop", "short-range squeeze", "band row → inverted row / TRX"] },
        } },
```

and on `rhythmic-stab`:

```ts
      { id: "rhythmic-stab", name: "Rhythmic Stabilization", kind: "hold", sets: 3, prescription: "3×20–30s", tags: ["scap plane"],
        phasePlan: {
          1: { sets: 3, prescription: "3×20–30s" },
          2: { sets: 2, prescription: "2×20s", maintenance: true },
          3: { sets: 2, prescription: "2×20s", maintenance: true },
        } },
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/lib/prehabSession.test.ts && npm run build`
Expected: all tests PASS (16 passed); build clean. Counts unchanged (no resolver yet).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/prehabData.ts frontend/src/lib/prehabSession.test.ts
git commit -m "feat: shoulder phase types + phasePlan data (inert until resolver lands)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Phase resolver, stretch-ir, phase-aware progress

Pure-logic layer in `prehabSession.ts` + the new Phase-2 exercise. After this task, default (phase 1) totals change: shoulders 8 exercises, 6 visible; overall 11 visible of 13.

**Files:**
- Modify: `frontend/src/lib/prehabSession.ts`
- Modify: `frontend/src/data/prehabData.ts` (add `stretch-ir`)
- Test: `frontend/src/lib/prehabSession.test.ts`

**Interfaces:**
- Consumes: `PhaseDose`, `phasePlan`, `phases` from Task 2; existing `activeExercise`, `clampLevel`.
- Produces (consumed by Tasks 4–5):
  - `type PhaseResolution = PhaseDose | "hidden" | "default"`
  - `phaseDose(ex: PrehabExercise, phase: number): PhaseResolution`
  - `type EffectiveExercise = PrehabExercise & { maintenance?: boolean }`
  - `effectiveExercise(ex: PrehabExercise, level: number, phase: number): EffectiveExercise`
  - `visibleExercises(section: PrehabSectionDef, phase: number): PrehabExercise[]`
  - `sectionProgress(sectionId, state, levels = {}, phase = 1)`, `overallProgress(state, levels = {}, phase = 1)`, `buildLogEntry(state, levels = {}, phase = 1)` — same names, phase param appended with default 1.

- [ ] **Step 1: Write the failing tests**

Append inside a new describe block in `frontend/src/lib/prehabSession.test.ts`:

```ts
describe("phase resolution", () => {
  const shoulders = PREHAB_SECTIONS[0];
  const sideLyingEr = shoulders.exercises.find((e) => e.id === "side-lying-er")!;
  const frontRaise = shoulders.exercises.find((e) => e.id === "scap-front-raise")!;
  const stretchIr = () => shoulders.exercises.find((e) => e.id === "stretch-ir")!;
  const pack = shoulders.exercises.find((e) => e.id === "closed-chain-progression")!;

  it("stretch-ir exists, hidden in phase 1, full in phase 2, maintenance in phase 3", () => {
    expect(stretchIr()).toBeDefined();
    expect(phaseDose(stretchIr(), 1)).toBe("hidden");
    expect(phaseDose(stretchIr(), 2)).toMatchObject({ sets: 2 });
    expect(phaseDose(stretchIr(), 3)).toMatchObject({ sets: 1, maintenance: true });
  });

  it("phaseDose: default for plan-less exercises, hidden for null, dose otherwise", () => {
    expect(phaseDose(pack, 1)).toBe("default");
    expect(phaseDose(frontRaise, 1)).toBe("hidden");
    expect(phaseDose(sideLyingEr, 2)).toMatchObject({ prescription: "3×12–15" });
  });

  it("effectiveExercise applies the phase dose over the base exercise", () => {
    const p3 = effectiveExercise(sideLyingEr, 1, 3);
    expect(p3.sets).toBe(2);
    expect(p3.maintenance).toBe(true);
    expect(p3.id).toBe("side-lying-er");
    const p1 = effectiveExercise(sideLyingEr, 1, 1);
    expect(p1.sets).toBe(3);
    expect(p1.maintenance).toBeUndefined();
  });

  it("effectiveExercise leaves the pack ladder to its own levels at every phase", () => {
    for (const phase of [1, 2, 3]) {
      expect(effectiveExercise(pack, 2, phase).sets).toBe(pack.levels![1].sets);
    }
  });

  it("visibleExercises: phase 1 hides front raise + stretch-ir; phases 2–3 show all 8", () => {
    expect(visibleExercises(shoulders, 1).map((e) => e.id)).not.toContain("scap-front-raise");
    expect(visibleExercises(shoulders, 1)).toHaveLength(6);
    expect(visibleExercises(shoulders, 2)).toHaveLength(8);
    expect(visibleExercises(shoulders, 3)).toHaveLength(8);
  });

  it("non-shoulders sections are identical at every phase", () => {
    for (const s of PREHAB_SECTIONS.slice(1)) for (const phase of [1, 2, 3]) {
      expect(visibleExercises(s, phase)).toEqual(s.exercises);
    }
  });

  it("sectionProgress counts only visible exercises with phase-effective sets", () => {
    // belly-press-ir needs 3 sets in phase 1 but only 2 in phase 2
    const state = { date: "d", entries: { "belly-press-ir": { setsDone: 2 } } };
    expect(sectionProgress("shoulders", state, {}, 1)).toEqual({ done: 0, total: 6 });
    expect(sectionProgress("shoulders", state, {}, 2)).toEqual({ done: 1, total: 8 });
  });

  it("overallProgress/buildLogEntry respect the phase", () => {
    const state = { date: "d", entries: {} };
    expect(overallProgress(state, {}, 1).total).toBe(11);  // 6 + 4 + 1
    expect(overallProgress(state, {}, 2).total).toBe(13);  // 8 + 4 + 1
    expect(buildLogEntry(state, {}, 2).total).toBe(13);
  });
});
```

Update the three Task-1 assertions that now change because `stretch-ir` exists and default phase is 1 (visible: 6 shoulders / 11 overall):

```ts
// line ~36:
    expect(sectionProgress("shoulders", state)).toEqual({ done: 1, total: 6 });
// line ~41:
    expect(overallProgress(state)).toEqual({ done: 1, total: 11 });
// line ~49:
    expect(entry.total).toBe(11);
```

Add the missing import names to the test file's import list: `phaseDose, effectiveExercise, visibleExercises`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/prehabSession.test.ts`
Expected: FAIL — `phaseDose` not exported (import error).

- [ ] **Step 3: Implement**

Add `stretch-ir` to `frontend/src/data/prehabData.ts`, directly after the `belly-press-ir` entry:

```ts
      { id: "stretch-ir", name: "Stretch-Loaded IR", kind: "loaded", sets: 2, prescription: "2×12", tags: ["light dumbbell", "arm supported", "lengthened emphasis"], weightStep: 1.25,
        phasePlan: {
          1: null,
          2: { sets: 2, prescription: "2×12" },
          3: { sets: 1, prescription: "1×12", maintenance: true },
        } },
```

In `frontend/src/lib/prehabSession.ts`, extend the import and add after `activeExercise`:

```ts
import { PREHAB_SECTIONS, PrehabExercise, PrehabSectionDef, PhaseDose, SectionId } from "../data/prehabData";

export type PhaseResolution = PhaseDose | "hidden" | "default";

/** Resolve an exercise's dose for a phase. Fail-closed: an unknown phase key hides it. */
export function phaseDose(ex: PrehabExercise, phase: number): PhaseResolution {
  if (!ex.phasePlan) return "default";
  const dose = ex.phasePlan[phase];
  return dose === null || dose === undefined ? "hidden" : dose;
}

export type EffectiveExercise = PrehabExercise & { maintenance?: boolean };

/** Ladder level first, then phase dose override. Hidden exercises resolve to base (callers filter first). */
export function effectiveExercise(ex: PrehabExercise, level: number, phase: number): EffectiveExercise {
  const base = activeExercise(ex, level);
  const dose = phaseDose(ex, phase);
  if (dose === "default" || dose === "hidden") return base;
  return {
    ...base,
    sets: dose.sets,
    prescription: dose.prescription,
    tags: dose.tags ?? base.tags,
    note: dose.note ?? base.note,
    maintenance: dose.maintenance,
  };
}

export function visibleExercises(section: PrehabSectionDef, phase: number): PrehabExercise[] {
  return section.exercises.filter((ex) => phaseDose(ex, phase) !== "hidden");
}
```

Replace `sectionProgress`, `overallProgress`, `buildLogEntry` with phase-aware versions (same names/exports):

```ts
export function sectionProgress(sectionId: SectionId, state: DayState, levels: Record<string, number> = {}, phase = 1): SectionProgress {
  const section = PREHAB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { done: 0, total: 0 };
  const visible = visibleExercises(section, phase);
  const done = visible.filter((ex) =>
    isExerciseDone(effectiveExercise(ex, levels[ex.id] ?? 1, phase), state.entries[ex.id])
  ).length;
  return { done, total: visible.length };
}

export function overallProgress(state: DayState, levels: Record<string, number> = {}, phase = 1): SectionProgress {
  return PREHAB_SECTIONS.reduce<SectionProgress>(
    (acc, s) => {
      const p = sectionProgress(s.id, state, levels, phase);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

export function buildLogEntry(state: DayState, levels: Record<string, number> = {}, phase = 1): LogEntry {
  const sections = Object.fromEntries(
    PREHAB_SECTIONS.map((s) => [s.id, sectionProgress(s.id, state, levels, phase)])
  ) as Record<SectionId, SectionProgress>;
  const overall = overallProgress(state, levels, phase);
  return { date: state.date, done: overall.done, total: overall.total, sections };
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npx vitest run src/lib/prehabSession.test.ts && npm run build`
Expected: all PASS (24 tests); build clean (defaulted phase keeps existing call sites compiling).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/prehabSession.ts frontend/src/data/prehabData.ts frontend/src/lib/prehabSession.test.ts
git commit -m "feat: phase resolver + stretch-loaded IR + phase-aware progress

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Phase state hook, PhaseCard, maintenance pill, wiring

**Files:**
- Create: `frontend/src/hooks/usePrehabPhase.ts`
- Create: `frontend/src/components/PrehabPhaseCard.tsx`
- Modify: `frontend/src/components/PrehabExerciseCard.tsx` (maintenance pill; accepts `EffectiveExercise`)
- Modify: `frontend/src/components/PrehabSection.tsx` (phase props, PhaseCard, visible filtering, effective doses)
- Modify: `frontend/src/components/PrehabTab.tsx` (thread phase through progress + completeSession)
- Modify: `frontend/src/hooks/usePrehabSession.ts` (mutation carries phase)

**Interfaces:**
- Consumes: `phaseDose`, `effectiveExercise`, `visibleExercises`, `clampLevel` (Task 3); `PrehabPhaseDef` (Task 2).
- Produces: `usePrehabPhase(): { phase: number; setPhase: (p: number) => void }` (raw, unclamped store — clamp at use sites with `clampLevel(phase, phases.length)`); `completeSession(levels, phase)`.

- [ ] **Step 1: Create the hook** — `frontend/src/hooks/usePrehabPhase.ts` (mirrors `usePrehabLevels`):

```ts
import { useCallback, useEffect, useState } from "react";

const PHASE_KEY = "gym-prehab-phase";

/** Current shoulder-programme phase (1-based). Frontend-only, localStorage. */
export function usePrehabPhase() {
  const [phase, setPhaseState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(PHASE_KEY);
      if (raw) {
        const n = Number(JSON.parse(raw));
        if (Number.isFinite(n)) return n;
      }
    } catch { /* ignore */ }
    return 1;
  });

  useEffect(() => {
    try { localStorage.setItem(PHASE_KEY, JSON.stringify(phase)); } catch { /* ignore */ }
  }, [phase]);

  const setPhase = useCallback((p: number) => { setPhaseState(p); }, []);

  return { phase, setPhase };
}
```

- [ ] **Step 2: Create the PhaseCard** — `frontend/src/components/PrehabPhaseCard.tsx`:

```tsx
import { PrehabPhaseDef } from "../data/prehabData";
import { clampLevel } from "../lib/prehabSession";

interface Props {
  phases: PrehabPhaseDef[];
  phase: number;               // raw persisted value; clamped here
  onPhaseChange: (phase: number) => void;
}

export default function PrehabPhaseCard({ phases, phase, onPhaseChange }: Props) {
  const count = phases.length;
  const cur = clampLevel(phase, count);
  const def = phases[cur - 1];

  return (
    <div className="bg-gray-900 rounded-2xl py-4 px-4 ring-1 ring-emerald-900/50 mb-2.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPhaseChange(clampLevel(cur - 1, count))}
          disabled={cur <= 1}
          aria-label="Previous phase"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9664;</span>
        </button>
        <div className="flex-1 text-center min-w-0">
          <div className="text-xs text-gray-500">Phase {cur} of {count}</div>
          <div className="text-sm font-semibold text-white truncate">{def.name}</div>
        </div>
        <button
          onClick={() => onPhaseChange(clampLevel(cur + 1, count))}
          disabled={cur >= count}
          aria-label="Next phase"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9654;</span>
        </button>
      </div>

      <div className="flex items-center gap-1 mt-3" aria-hidden="true">
        {phases.map((p) => {
          const cls = p.phase === cur ? "bg-emerald-500" : p.phase < cur ? "bg-emerald-800" : "bg-gray-800";
          return <div key={p.phase} className={`flex-1 h-1.5 rounded-full ${cls}`} />;
        })}
      </div>

      <div className="mt-3 space-y-1 text-xs leading-relaxed">
        <p className="text-gray-300"><span className="text-gray-500">Goal: </span>{def.goal}</p>
        <p className="text-emerald-300"><span className="text-gray-500">Advance when: </span>{def.advanceWhen}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Maintenance pill** — in `frontend/src/components/PrehabExerciseCard.tsx`, change the exercise prop type and add the pill. Replace the import and Props:

```tsx
import { EffectiveExercise } from "../lib/prehabSession";
// ...
interface Props {
  exercise: EffectiveExercise;
  entry?: ExerciseEntry;
  onSetsDone: (setsDone: number) => void;
  onWeightChange: (weight: string) => void;
}
```

(Remove the now-unused `PrehabExercise` import.) In the tag row, after the `exercise.note` span, add:

```tsx
            {exercise.maintenance && (
              <span className="text-xs bg-sky-900/40 text-sky-300 px-1.5 py-0.5 rounded">maintenance</span>
            )}
```

- [ ] **Step 4: Wire the section** — in `frontend/src/components/PrehabSection.tsx`:

Imports and Props:

```tsx
import { DayState, SectionProgress, visibleExercises, effectiveExercise } from "../lib/prehabSession";
import PrehabPhaseCard from "./PrehabPhaseCard";
// Props gains:
  phase: number;
  onPhaseChange: (phase: number) => void;
```

Destructure `phase, onPhaseChange` in the component signature. Replace the open block's exercise mapping:

```tsx
      {open && (
        <div className="mt-2">
          {section.phases && (
            <PrehabPhaseCard phases={section.phases} phase={phase} onPhaseChange={onPhaseChange} />
          )}
          {visibleExercises(section, phase).map((ex) =>
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
                exercise={effectiveExercise(ex, levels[ex.id] ?? 1, phase)}
                entry={day.entries[ex.id]}
                onSetsDone={(setsDone) => onSetsDone(ex.id, setsDone)}
                onWeightChange={(w) => onWeightChange(ex.id, w)}
              />
            )
          )}
        </div>
      )}
```

- [ ] **Step 5: Thread phase through the tab and session hook**

`frontend/src/hooks/usePrehabSession.ts` — mutation carries the phase:

```ts
  const mutation = useMutation({
    mutationFn: ({ levels, phase }: { levels: Record<string, number>; phase: number }) =>
      api.completePrehab(buildLogEntry(day, levels, phase) as PrehabCompleteRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prehab-history"] }),
  });
  // ...
  const completeSession = useCallback((levels: Record<string, number>, phase: number) => {
    mutation.mutate({ levels, phase });
  }, [mutation]);
```

`frontend/src/components/PrehabTab.tsx`:

```tsx
import { usePrehabPhase } from "../hooks/usePrehabPhase";
// inside component:
  const { phase, setPhase } = usePrehabPhase();
// progress calls gain the phase:
  const overall = overallProgress(day, levels, phase);
// section render:
          progress={sectionProgress(section.id, day, levels, phase)}
          phase={phase}
          onPhaseChange={setPhase}
// complete:
  const handleComplete = () => {
    setErrorDismissed(false);
    completeSession(levels, phase);
  };
```

(`handleSetsDone`'s rest-timer lookup keeps using `activeExercise` — phase doses never change `kind`, so rest behaviour is unaffected.)

- [ ] **Step 6: Tests + typecheck + dev smoke**

Run: `npx vitest run src/lib/prehabSession.test.ts && npm run build`
Expected: 24 tests PASS; tsc/build clean.

Run: `npm run dev` — open http://localhost:5173, Shoulders section:
- Phase card shows "Phase 1 of 3: Short-Range Squeezes"; 6 exercise cards + pack ladder card; no Front Raise, no Stretch-Loaded IR.
- Advance to Phase 2: Front Raise + Stretch-Loaded IR appear; Delt Iso shows "2×30s" with a blue maintenance pill; ER prescription reads "3×12–15" with "full comfortable range" tag.
- Phase 3: Pull-Apart card shows the C-scoop row prescription "3×8–12"; back to Phase 1 restores today's view. Pack ladder identical in all three.
- Lower Back and Proprioception unchanged throughout. Overall counter reads /11 in Phase 1, /13 in Phases 2–3.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/usePrehabPhase.ts frontend/src/components/PrehabPhaseCard.tsx frontend/src/components/PrehabExerciseCard.tsx frontend/src/components/PrehabSection.tsx frontend/src/components/PrehabTab.tsx frontend/src/hooks/usePrehabSession.ts
git commit -m "feat: shoulder phase card, phase state, maintenance pill, wiring

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Deploy and verify live

**Files:** none (operational).

**Interfaces:**
- Consumes: everything above, on `master`.
- Produces: live deploy verified; paper trail updated.

- [ ] **Step 1: Push**

```bash
git push origin master
```

If this 403s: the active GitHub account is the work one — follow the account-switch dance in `~/.claude/projects/-Users-hobrien/memory/github-auth.md` (repo owner: `Hallam4`), then push, then switch back.

- [ ] **Step 2: Wait for Render, verify via live bundle (NOT version.json — it SPA-rewrites)**

Wait ~3 minutes after push, then:

```bash
BUNDLE=$(curl -s https://gym-tracker-frontend-uhu5.onrender.com/ | grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -s "https://gym-tracker-frontend-uhu5.onrender.com/$BUNDLE" | grep -c "gym-prehab-phase"
```

Expected: `1` or more (the new localStorage key is in the live bundle). Also `curl -s https://gym-tracker-backend-v629.onrender.com/health` → healthy (backend untouched).

- [ ] **Step 3: Post-ship paper trail (orchestrator, not subagent)**

Update: Apple Notes "Prehab Routine" pointer snapshot (new phased structure, date it); memory files `shoulder-rehab-programme.md` + `gym-tracker.md` (+ MEMORY.md hooks) to record the 3-phase programme, `gym-prehab-phase` key, and that the user starts in Phase 1.
