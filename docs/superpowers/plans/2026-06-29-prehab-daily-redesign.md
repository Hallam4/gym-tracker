# Daily Prehab Tab Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `Prehab` tab as a single daily session (Shoulders / Lower Back / Proprioception) styled like the main workout tab, with a shared stopwatch+rest timer and hybrid per-exercise logging.

**Architecture:** New, isolated modules under `frontend/src` — a pure-logic layer (`data/prehabData.ts`, `lib/prehabSession.ts`) that is unit-tested with Vitest, two React hooks (`useSessionTimer`, `usePrehabSession`), and three presentational components (`SessionTimer`, `PrehabSection`, `PrehabExerciseCard`) consumed by a rewritten `PrehabTab.tsx`. The existing `TodayWorkout.tsx`/`ExerciseCard.tsx` are **not** touched.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS, localStorage (no backend). Vitest (new dev dependency) for pure-logic tests.

## Global Constraints

- TypeScript strict build must pass: `npm run build` (runs `tsc && vite build`) — copied from `frontend/package.json`.
- No backend / network calls in this tab — localStorage only.
- Reuse existing global CSS classes: `touch-target`, `go-overlay-pulse`, `go-text-pulse`, `rest-done-flash`, `tabular-nums` (defined in `src/index.css`, used by `TodayWorkout`).
- Dark Tailwind palette to match the app: cards `bg-gray-900 ring-1 ring-gray-800/60 rounded-2xl`, pills `bg-gray-800/70 text-gray-300`, green action `bg-gradient-to-r from-green-600 to-emerald-600`.
- localStorage keys for this tab: `gym-prehab-v2-today`, `gym-prehab-v2-log`, `gym-prehab-v2-timer`. The old `gym-prehab-log` key is left untouched (no migration).
- Date strings are `YYYY-MM-DD` via `new Date().toISOString().slice(0, 10)`.
- Each exercise is "done" when `setsDone >= sets`. Progress everywhere counts **exercises done / total exercises** (not sets).
- Per-card expand/collapse is NOT used; collapsing happens at the **section** level only. Inside an open section every exercise shows its controls inline.

---

### Task 1: Vitest setup + exercise data

**Files:**
- Modify: `frontend/package.json` (add devDependency + scripts)
- Create: `frontend/src/data/prehabData.ts`
- Test: `frontend/src/data/prehabData.test.ts`

**Interfaces:**
- Produces: `SectionId`, `ExerciseKind`, `PrehabExercise`, `PrehabSectionDef`, `PREHAB_SECTIONS`.

- [ ] **Step 1: Install Vitest**

Run:
```bash
cd frontend && npm install -D vitest@^2.0.0
```
Expected: `added` lines, `package.json` gains `vitest` under devDependencies.

- [ ] **Step 2: Add test scripts**

In `frontend/package.json`, update the `"scripts"` block to:
```json
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Write the exercise data**

Create `frontend/src/data/prehabData.ts`:
```ts
export type SectionId = "shoulders" | "lowerback" | "proprioception";
export type ExerciseKind = "loaded" | "hold" | "reps";

export interface PrehabExercise {
  id: string;            // stable storage key
  name: string;
  kind: ExerciseKind;    // loaded = weight + set buttons; hold/reps = set buttons only
  sets: number;          // number of set ticks; "done" when setsDone >= sets
  prescription: string;  // e.g. "2–3×8–10"
  tags: string[];        // small pills
  note?: string;         // e.g. "progression (2–3×/week)"
  weightStep?: number;   // loaded only: ± increment (default 2.5)
}

export interface PrehabSectionDef {
  id: SectionId;
  label: string;
  icon: string;
  exercises: PrehabExercise[];
}

export const PREHAB_SECTIONS: PrehabSectionDef[] = [
  {
    id: "shoulders",
    label: "Shoulders",
    icon: "🦾",
    exercises: [
      { id: "ant-delt-iso", name: "Anterior Delt Isometric", kind: "hold", sets: 5, prescription: "5×30–45s", tags: ["easy", "pain-free"] },
      { id: "scap-front-raise", name: "Scap-Plane Front Raise", kind: "loaded", sets: 2, prescription: "2×12–15", tags: ["light", "thumb-up", "to shoulder height"], weightStep: 1.25 },
      { id: "side-lying-er", name: "Side-Lying ER", kind: "loaded", sets: 3, prescription: "3×15", tags: ["light", "cap 45°"], weightStep: 1.25 },
      { id: "rhythmic-stab", name: "Rhythmic Stabilization", kind: "hold", sets: 3, prescription: "3×20–30s", tags: ["scap plane"] },
    ],
  },
  {
    id: "lowerback",
    label: "Lower Back",
    icon: "🔻",
    exercises: [
      { id: "back-extension", name: "Back Extension", kind: "loaded", sets: 3, prescription: "2–3×8–10", tags: ["5s eccentric", "BW → DB"], weightStep: 2.5 },
      { id: "reverse-hyper", name: "Reverse Hyper", kind: "reps", sets: 3, prescription: "2–3×12–15", tags: ["light", "controlled"] },
      { id: "jefferson-curl", name: "Jefferson Curl", kind: "loaded", sets: 2, prescription: "2×5–6", tags: ["light", "slow"], note: "progression (2–3×/week)", weightStep: 2.5 },
    ],
  },
  {
    id: "proprioception",
    label: "Proprioception",
    icon: "🧍",
    exercises: [
      { id: "single-leg-stand", name: "Single-Leg Stand (current level)", kind: "hold", sets: 1, prescription: "30–60s each", tags: ["eyes open → closed → cushion → +head turns"] },
    ],
  },
];
```

- [ ] **Step 4: Write the failing test**

Create `frontend/src/data/prehabData.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "./prehabData";

describe("prehabData", () => {
  it("has the three sections in order", () => {
    expect(PREHAB_SECTIONS.map((s) => s.id)).toEqual(["shoulders", "lowerback", "proprioception"]);
  });

  it("has 8 exercises total", () => {
    const count = PREHAB_SECTIONS.reduce((n, s) => n + s.exercises.length, 0);
    expect(count).toBe(8);
  });

  it("has unique exercise ids", () => {
    const ids = PREHAB_SECTIONS.flatMap((s) => s.exercises.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every exercise has a valid kind and sets >= 1", () => {
    for (const s of PREHAB_SECTIONS) {
      for (const e of s.exercises) {
        expect(["loaded", "hold", "reps"]).toContain(e.kind);
        expect(e.sets).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `cd frontend && npm test`
Expected: 4 tests pass.

- [ ] **Step 6: Commit**
```bash
git add frontend/package.json frontend/package-lock.json frontend/src/data/prehabData.ts frontend/src/data/prehabData.test.ts
git commit -m "feat(prehab): add vitest + daily prehab exercise data"
```

---

### Task 2: Pure session logic

**Files:**
- Create: `frontend/src/lib/prehabSession.ts`
- Test: `frontend/src/lib/prehabSession.test.ts`

**Interfaces:**
- Consumes: `PREHAB_SECTIONS`, `PrehabExercise`, `SectionId` from `../data/prehabData`.
- Produces: `ExerciseEntry`, `DayState`, `SectionProgress`, `LogEntry`, and functions `emptyDayState(date)`, `rollIfNewDay(state, today)`, `isExerciseDone(ex, entry?)`, `sectionProgress(sectionId, state)`, `overallProgress(state)`, `buildLogEntry(state)`, `appendLog(log, entry)`.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/lib/prehabSession.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "../data/prehabData";
import {
  emptyDayState, rollIfNewDay, isExerciseDone,
  sectionProgress, overallProgress, buildLogEntry, appendLog,
} from "./prehabSession";

const antDelt = PREHAB_SECTIONS[0].exercises[0]; // sets: 5

describe("prehabSession", () => {
  it("emptyDayState has the given date and no entries", () => {
    expect(emptyDayState("2026-06-29")).toEqual({ date: "2026-06-29", entries: {} });
  });

  it("rollIfNewDay resets when the date changed", () => {
    const stale = { date: "2026-06-28", entries: { x: { setsDone: 2 } } };
    expect(rollIfNewDay(stale, "2026-06-29")).toEqual({ date: "2026-06-29", entries: {} });
  });

  it("rollIfNewDay keeps state on the same day", () => {
    const same = { date: "2026-06-29", entries: { x: { setsDone: 2 } } };
    expect(rollIfNewDay(same, "2026-06-29")).toBe(same);
  });

  it("isExerciseDone is true only when setsDone >= sets", () => {
    expect(isExerciseDone(antDelt, undefined)).toBe(false);
    expect(isExerciseDone(antDelt, { setsDone: 4 })).toBe(false);
    expect(isExerciseDone(antDelt, { setsDone: 5 })).toBe(true);
    expect(isExerciseDone(antDelt, { setsDone: 6 })).toBe(true);
  });

  it("sectionProgress counts finished exercises in a section", () => {
    const state = { date: "d", entries: { "ant-delt-iso": { setsDone: 5 } } };
    expect(sectionProgress("shoulders", state)).toEqual({ done: 1, total: 4 });
  });

  it("overallProgress sums across all sections (8 total)", () => {
    const state = { date: "d", entries: { "single-leg-stand": { setsDone: 1 } } };
    expect(overallProgress(state)).toEqual({ done: 1, total: 8 });
  });

  it("buildLogEntry captures date + per-section + overall", () => {
    const state = { date: "2026-06-29", entries: { "single-leg-stand": { setsDone: 1 } } };
    const entry = buildLogEntry(state);
    expect(entry.date).toBe("2026-06-29");
    expect(entry.done).toBe(1);
    expect(entry.total).toBe(8);
    expect(entry.sections.proprioception).toEqual({ done: 1, total: 1 });
  });

  it("appendLog prepends and dedupes by date", () => {
    const a = buildLogEntry({ date: "2026-06-28", entries: {} });
    const b = buildLogEntry({ date: "2026-06-29", entries: {} });
    const b2 = buildLogEntry({ date: "2026-06-29", entries: { "single-leg-stand": { setsDone: 1 } } });
    const log = appendLog(appendLog([a], b), b2);
    expect(log.map((e) => e.date)).toEqual(["2026-06-29", "2026-06-28"]);
    expect(log[0].done).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test`
Expected: FAIL — `prehabSession.ts` does not exist / functions undefined.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/prehabSession.ts`:
```ts
import { PREHAB_SECTIONS, PrehabExercise, SectionId } from "../data/prehabData";

export interface ExerciseEntry {
  setsDone: number;
  weight?: string;
}

export interface DayState {
  date: string; // YYYY-MM-DD
  entries: Record<string, ExerciseEntry>;
}

export interface SectionProgress {
  done: number;
  total: number;
}

export interface LogEntry {
  date: string;
  done: number;
  total: number;
  sections: Record<SectionId, SectionProgress>;
}

export function emptyDayState(date: string): DayState {
  return { date, entries: {} };
}

export function rollIfNewDay(state: DayState, today: string): DayState {
  return state.date === today ? state : emptyDayState(today);
}

export function isExerciseDone(ex: PrehabExercise, entry?: ExerciseEntry): boolean {
  if (!entry) return false;
  return entry.setsDone >= ex.sets;
}

export function sectionProgress(sectionId: SectionId, state: DayState): SectionProgress {
  const section = PREHAB_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return { done: 0, total: 0 };
  const done = section.exercises.filter((ex) => isExerciseDone(ex, state.entries[ex.id])).length;
  return { done, total: section.exercises.length };
}

export function overallProgress(state: DayState): SectionProgress {
  return PREHAB_SECTIONS.reduce<SectionProgress>(
    (acc, s) => {
      const p = sectionProgress(s.id, state);
      return { done: acc.done + p.done, total: acc.total + p.total };
    },
    { done: 0, total: 0 }
  );
}

export function buildLogEntry(state: DayState): LogEntry {
  const sections = {} as Record<SectionId, SectionProgress>;
  for (const s of PREHAB_SECTIONS) sections[s.id] = sectionProgress(s.id, state);
  const overall = overallProgress(state);
  return { date: state.date, done: overall.done, total: overall.total, sections };
}

export function appendLog(log: LogEntry[], entry: LogEntry): LogEntry[] {
  return [entry, ...log.filter((e) => e.date !== entry.date)];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test`
Expected: all `prehabSession` + `prehabData` tests pass.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/lib/prehabSession.ts frontend/src/lib/prehabSession.test.ts
git commit -m "feat(prehab): pure session/progress logic with tests"
```

---

### Task 3: Session timer hook + display

**Files:**
- Create: `frontend/src/hooks/useSessionTimer.ts`
- Create: `frontend/src/components/SessionTimer.tsx`

**Interfaces:**
- Produces: `useSessionTimer(storageKey: string)` returning `{ seconds, running, restCountdown, restDone, restActive, toggleRun, resetStopwatch, startRest, dismissRest, initAudio, longPress }`. `SessionTimer` default export taking `{ timer }: { timer: ReturnType<typeof useSessionTimer> }`.
- Consumed by: `PrehabTab` (Task 7).

- [ ] **Step 1: Write the timer hook**

Create `frontend/src/hooks/useSessionTimer.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_REST_S = 60;

interface Persisted {
  seconds: number;
  running: boolean;
  restEnd: number | null;
}

export function useSessionTimer(storageKey: string) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restCountdown, setRestCountdown] = useState<number | null>(null);
  const [restDone, setRestDone] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const soundRef = useRef<ReturnType<typeof setInterval>>();
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressFired = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const restored = useRef(false);

  // Restore persisted timer once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p: Persisted = JSON.parse(raw);
        setSeconds(p.seconds ?? 0);
        setRunning(p.running ?? false);
        if (p.restEnd && p.restEnd > Date.now()) {
          setRestEnd(p.restEnd);
          setRestDone(false);
        }
      }
    } catch { /* ignore */ }
    restored.current = true;
  }, [storageKey]);

  // Persist
  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ seconds, running, restEnd }));
    } catch { /* ignore */ }
  }, [storageKey, seconds, running, restEnd]);

  // Stopwatch tick
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!running) return;
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running]);

  const initAudio = useCallback(() => {
    try {
      if (!audioRef.current || audioRef.current.state === "closed") {
        audioRef.current = new AudioContext();
      }
      if (audioRef.current.state === "suspended") {
        audioRef.current.resume().catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  const beep = useCallback((count: number) => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state === "closed") return;
    const play = () => {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.value = 0.4;
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.frequency.value = 880;
        const t = ctx.currentTime + i * 0.25;
        osc.start(t);
        osc.stop(t + 0.15);
      }
    };
    if (ctx.state === "suspended") ctx.resume().then(play).catch(() => {});
    else play();
  }, []);

  // Rest countdown
  useEffect(() => {
    if (!restEnd) {
      setRestCountdown(null);
      return;
    }
    const run = () => {
      const remaining = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
      setRestCountdown(remaining);
      if (remaining <= 0 && !restDone) {
        setRestDone(true);
        try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch { /* ignore */ }
        beep(3);
        if (soundRef.current) clearInterval(soundRef.current);
        soundRef.current = setInterval(() => {
          beep(2);
          try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
        }, 3000);
      }
    };
    run();
    const id = setInterval(run, 250);
    return () => clearInterval(id);
  }, [restEnd, restDone, beep]);

  // Cleanup
  useEffect(() => () => {
    if (soundRef.current) clearInterval(soundRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  const startRest = useCallback((secs: number = DEFAULT_REST_S) => {
    initAudio();
    if (soundRef.current) clearInterval(soundRef.current);
    setRestDone(false);
    setRestEnd(Date.now() + secs * 1000);
  }, [initAudio]);

  const dismissRest = useCallback(() => {
    setRestEnd(null);
    setRestCountdown(null);
    setRestDone(false);
    if (soundRef.current) clearInterval(soundRef.current);
  }, []);

  const toggleRun = useCallback(() => {
    initAudio();
    if (!longPressFired.current) setRunning((r) => !r);
  }, [initAudio]);

  const resetStopwatch = useCallback(() => {
    setRunning(false);
    setSeconds(0);
  }, []);

  const onPressStart = useCallback(() => {
    longPressFired.current = false;
    longPressRef.current = setTimeout(() => {
      longPressFired.current = true;
      dismissRest();
      try { navigator.vibrate?.(50); } catch { /* ignore */ }
    }, 500);
  }, [dismissRest]);

  const onPressEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  return {
    seconds,
    running,
    restCountdown,
    restDone,
    restActive: restEnd !== null,
    toggleRun,
    resetStopwatch,
    startRest,
    dismissRest,
    initAudio,
    longPress: {
      onTouchStart: onPressStart,
      onTouchEnd: onPressEnd,
      onMouseDown: onPressStart,
      onMouseUp: onPressEnd,
      onMouseLeave: onPressEnd,
    },
  };
}
```

- [ ] **Step 2: Write the timer display component**

Create `frontend/src/components/SessionTimer.tsx`:
```tsx
import { useSessionTimer } from "../hooks/useSessionTimer";

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export default function SessionTimer({ timer }: { timer: ReturnType<typeof useSessionTimer> }) {
  const { seconds, running, restCountdown, restDone, restActive, toggleRun, dismissRest, longPress } = timer;

  return (
    <>
      {restDone && (
        <div
          className="fixed inset-0 z-10 flex flex-col items-center justify-center go-overlay-pulse"
          onClick={dismissRest}
          role="alert"
          aria-live="assertive"
        >
          <div className="text-7xl font-black text-green-400 go-text-pulse">GO</div>
          <div className="text-sm text-gray-400 mt-4">tap to dismiss</div>
        </div>
      )}

      <div className={`flex items-center justify-center mb-3 ${restActive ? "sticky top-0 z-20 py-2 -mx-4 px-4 bg-gray-950/90 backdrop-blur-sm" : ""}`}>
        <button
          onClick={toggleRun}
          {...longPress}
          aria-label={restActive
            ? (restDone ? "Rest complete. Long-press to dismiss." : `Rest: ${restCountdown} seconds. Tap to ${running ? "pause" : "resume"} stopwatch.`)
            : (running ? "Pause stopwatch" : "Start stopwatch")}
          className={`bg-gray-800/70 rounded-xl px-6 py-2 touch-target hover:bg-gray-700/70 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${restDone ? "bg-green-600/20 rest-done-flash" : ""}`}
          role="timer"
        >
          {restActive ? (
            <div className="text-center">
              {restDone ? (
                <div className="text-2xl font-bold text-green-400">GO</div>
              ) : (
                <div className="text-2xl font-mono font-bold text-white tabular-nums">{fmt(restCountdown ?? 0)}</div>
              )}
              <div className={`text-xs font-mono mt-1 ${running ? "text-gray-300" : "text-gray-500"}`}>
                {!running && seconds > 0 && <span className="mr-1">❚❚</span>}
                {fmt(seconds)}
              </div>
            </div>
          ) : (
            <span className={`text-xl font-mono tabular-nums ${running ? "text-white" : "text-gray-400"}`}>
              {!running && seconds > 0 && <span className="text-gray-500 mr-1 text-base">❚❚</span>}
              {fmt(seconds)}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd frontend && npm run build`
Expected: build succeeds, no TS errors. (Component is not yet rendered anywhere; this only proves it compiles.)

- [ ] **Step 4: Commit**
```bash
git add frontend/src/hooks/useSessionTimer.ts frontend/src/components/SessionTimer.tsx
git commit -m "feat(prehab): shared stopwatch + rest timer (hook + display)"
```

---

### Task 4: Hybrid exercise card

**Files:**
- Create: `frontend/src/components/PrehabExerciseCard.tsx`

**Interfaces:**
- Consumes: `PrehabExercise` from `../data/prehabData`; `ExerciseEntry` from `../lib/prehabSession`.
- Produces: default export `PrehabExerciseCard` with props
  `{ exercise: PrehabExercise; entry?: ExerciseEntry; onSetsDone: (setsDone: number) => void; onWeightChange: (weight: string) => void; }`.
- Consumed by: `PrehabSection` (Task 5).

- [ ] **Step 1: Write the component**

Create `frontend/src/components/PrehabExerciseCard.tsx`:
```tsx
import { PrehabExercise } from "../data/prehabData";
import { ExerciseEntry } from "../lib/prehabSession";

interface Props {
  exercise: PrehabExercise;
  entry?: ExerciseEntry;
  onSetsDone: (setsDone: number) => void;
  onWeightChange: (weight: string) => void;
}

export default function PrehabExerciseCard({ exercise, entry, onSetsDone, onWeightChange }: Props) {
  const setsDone = entry?.setsDone ?? 0;
  const weight = entry?.weight ?? "";
  const allDone = setsDone >= exercise.sets;
  const step = exercise.weightStep ?? 2.5;

  // Tapping set i: if it's already filled, undo down to i; else fill up to i+1.
  const tapSet = (i: number) => {
    onSetsDone(i < setsDone ? i : i + 1);
  };

  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight) || 0;
    onWeightChange(String(Math.max(0, current + delta)));
  };

  return (
    <div className={`bg-gray-900 rounded-2xl py-4 px-4 ring-1 mb-2.5 ${allDone ? "ring-green-800/50" : "ring-gray-800/60"}`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{exercise.name}</span>
            <span className={`shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded-md ml-auto ${allDone ? "bg-green-900/50 text-green-400" : "bg-gray-800/70 text-gray-400"}`}>
              {allDone && <span className="mr-0.5" aria-hidden="true">&#10003;</span>}
              {setsDone}/{exercise.sets}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{exercise.prescription}</span>
            {exercise.tags.map((t) => (
              <span key={t} className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{t}</span>
            ))}
            {exercise.note && (
              <span className="text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded">{exercise.note}</span>
            )}
          </div>
        </div>
      </div>

      {/* Weight adjuster (loaded only) */}
      {exercise.kind === "loaded" && (
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
      )}

      {/* Set buttons */}
      <div className={`grid gap-2.5 mt-3`} style={{ gridTemplateColumns: `repeat(${Math.min(exercise.sets, 5)}, minmax(0, 1fr))` }} role="group" aria-label={`Sets for ${exercise.name}`}>
        {Array.from({ length: exercise.sets }, (_, i) => {
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
    </div>
  );
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/PrehabExerciseCard.tsx
git commit -m "feat(prehab): hybrid exercise card (weight + set buttons)"
```

---

### Task 5: Collapsible section

**Files:**
- Create: `frontend/src/components/PrehabSection.tsx`

**Interfaces:**
- Consumes: `PrehabSectionDef` from `../data/prehabData`; `DayState`, `SectionProgress` from `../lib/prehabSession`; `PrehabExerciseCard` from `./PrehabExerciseCard`.
- Produces: default export `PrehabSection` with props
  `{ section: PrehabSectionDef; day: DayState; progress: SectionProgress; open: boolean; onToggle: () => void; onSetsDone: (exId: string, setsDone: number) => void; onWeightChange: (exId: string, weight: string) => void; }`.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/PrehabSection.tsx`:
```tsx
import { PrehabSectionDef } from "../data/prehabData";
import { DayState, SectionProgress } from "../lib/prehabSession";
import PrehabExerciseCard from "./PrehabExerciseCard";

interface Props {
  section: PrehabSectionDef;
  day: DayState;
  progress: SectionProgress;
  open: boolean;
  onToggle: () => void;
  onSetsDone: (exId: string, setsDone: number) => void;
  onWeightChange: (exId: string, weight: string) => void;
}

export default function PrehabSection({ section, day, progress, open, onToggle, onSetsDone, onWeightChange }: Props) {
  const complete = progress.done === progress.total;
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-1 py-2 touch-target"
      >
        <span className="flex items-center gap-2 text-[15px] font-bold text-gray-200">
          <span aria-hidden="true">{section.icon}</span>
          {section.label}
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${complete ? "text-green-400" : "text-gray-500"}`}>
            {progress.done}/{progress.total}
          </span>
          <span className={`text-gray-500 text-sm transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden="true">&#9656;</span>
        </span>
      </button>

      {open && (
        <div className="mt-2">
          {section.exercises.map((ex) => (
            <PrehabExerciseCard
              key={ex.id}
              exercise={ex}
              entry={day.entries[ex.id]}
              onSetsDone={(setsDone) => onSetsDone(ex.id, setsDone)}
              onWeightChange={(w) => onWeightChange(ex.id, w)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/PrehabSection.tsx
git commit -m "feat(prehab): collapsible section with per-section progress"
```

---

### Task 6: Session state hook

**Files:**
- Create: `frontend/src/hooks/usePrehabSession.ts`

**Interfaces:**
- Consumes: `DayState`, `LogEntry`, `emptyDayState`, `rollIfNewDay`, `buildLogEntry`, `appendLog` from `../lib/prehabSession`.
- Produces: `usePrehabSession()` returning `{ day: DayState; log: LogEntry[]; setSetsDone: (exId: string, setsDone: number) => void; setWeight: (exId: string, weight: string) => void; completeSession: () => void; }`.
- Consumed by: `PrehabTab` (Task 7).

- [ ] **Step 1: Write the hook**

Create `frontend/src/hooks/usePrehabSession.ts`:
```ts
import { useCallback, useEffect, useState } from "react";
import {
  DayState, LogEntry, emptyDayState, rollIfNewDay, buildLogEntry, appendLog,
} from "../lib/prehabSession";

const DAY_KEY = "gym-prehab-v2-today";
const LOG_KEY = "gym-prehab-v2-log";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function usePrehabSession() {
  const [day, setDay] = useState<DayState>(() => {
    try {
      const raw = localStorage.getItem(DAY_KEY);
      if (raw) return rollIfNewDay(JSON.parse(raw) as DayState, todayStr());
    } catch { /* ignore */ }
    return emptyDayState(todayStr());
  });

  const [log, setLog] = useState<LogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (raw) return JSON.parse(raw) as LogEntry[];
    } catch { /* ignore */ }
    return [];
  });

  useEffect(() => {
    try { localStorage.setItem(DAY_KEY, JSON.stringify(day)); } catch { /* ignore */ }
  }, [day]);

  useEffect(() => {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }
  }, [log]);

  const setSetsDone = useCallback((exId: string, setsDone: number) => {
    setDay((d) => ({
      ...d,
      entries: { ...d.entries, [exId]: { ...d.entries[exId], setsDone } },
    }));
  }, []);

  const setWeight = useCallback((exId: string, weight: string) => {
    setDay((d) => ({
      ...d,
      entries: { ...d.entries, [exId]: { setsDone: d.entries[exId]?.setsDone ?? 0, weight } },
    }));
  }, []);

  const completeSession = useCallback(() => {
    setLog((l) => appendLog(l, buildLogEntry(day)));
  }, [day]);

  return { day, log, setSetsDone, setWeight, completeSession };
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/hooks/usePrehabSession.ts
git commit -m "feat(prehab): localStorage day-state + daily log hook"
```

---

### Task 7: Rewrite PrehabTab

**Files:**
- Modify (full rewrite): `frontend/src/components/PrehabTab.tsx`

**Interfaces:**
- Consumes: `PREHAB_SECTIONS`; `usePrehabSession`; `useSessionTimer`; `overallProgress`, `sectionProgress` from `../lib/prehabSession`; `SessionTimer`; `PrehabSection`.
- `PrehabTab` is already mounted in `App.tsx` (`{tab === "prehab" && <PrehabTab />}`) — no change to `App.tsx`.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `frontend/src/components/PrehabTab.tsx` with:
```tsx
import { useState } from "react";
import { PREHAB_SECTIONS, SectionId, PrehabExercise } from "../data/prehabData";
import { usePrehabSession } from "../hooks/usePrehabSession";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { overallProgress, sectionProgress } from "../lib/prehabSession";
import SessionTimer from "./SessionTimer";
import PrehabSection from "./PrehabSection";

const TIMER_KEY = "gym-prehab-v2-timer";

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function PrehabTab() {
  const { day, log, setSetsDone, setWeight, completeSession } = usePrehabSession();
  const timer = useSessionTimer(TIMER_KEY);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    shoulders: true,
    lowerback: false,
    proprioception: false,
  });
  const [justSaved, setJustSaved] = useState(false);

  const overall = overallProgress(day);
  const pct = overall.total > 0 ? Math.round((overall.done / overall.total) * 100) : 0;

  // Look up an exercise to decide whether logging a set should start a rest.
  const exById = (exId: string): PrehabExercise | undefined =>
    PREHAB_SECTIONS.flatMap((s) => s.exercises).find((e) => e.id === exId);

  const handleSetsDone = (exId: string, setsDone: number) => {
    const prev = day.entries[exId]?.setsDone ?? 0;
    setSetsDone(exId, setsDone);
    const ex = exById(exId);
    // Start rest only when logging a NEW set (count went up) on loaded/reps moves.
    if (ex && setsDone > prev && (ex.kind === "loaded" || ex.kind === "reps")) {
      timer.startRest();
    }
  };

  const handleComplete = () => {
    completeSession();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-white">Daily Prehab</h2>
        <span className="text-xs text-gray-500">{fmtDate(day.date)}</span>
      </div>

      <SessionTimer timer={timer} />

      {/* Overall progress */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={overall.done} aria-valuemin={0} aria-valuemax={overall.total}>
          <div className="h-full rounded-full bg-gradient-to-r from-green-600 to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs tabular-nums ${pct >= 100 ? "text-green-400" : "text-gray-300"}`}>
          {overall.done}/{overall.total}
        </span>
      </div>

      {/* Sections */}
      {PREHAB_SECTIONS.map((section) => (
        <PrehabSection
          key={section.id}
          section={section}
          day={day}
          progress={sectionProgress(section.id, day)}
          open={open[section.id]}
          onToggle={() => setOpen((o) => ({ ...o, [section.id]: !o[section.id] }))}
          onSetsDone={handleSetsDone}
          onWeightChange={setWeight}
        />
      ))}

      {/* Complete */}
      <button
        onClick={handleComplete}
        disabled={overall.done === 0}
        className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg touch-target transition-all duration-200 active:scale-[0.98] ${
          justSaved
            ? "bg-green-600 text-white"
            : overall.done === 0
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-700/25 hover:brightness-110"
        }`}
      >
        {justSaved ? "Saved!" : `Complete Session (${overall.done}/${overall.total})`}
      </button>

      {/* Recent log */}
      {log.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Log</h3>
          <div className="space-y-2">
            {log.slice(0, 20).map((entry) => (
              <div key={entry.date} className="flex items-center justify-between px-4 py-2.5 bg-gray-800/40 rounded-xl">
                <span className="text-sm text-gray-300">{fmtDate(entry.date)}</span>
                <span className={`text-sm font-medium ${entry.done === entry.total ? "text-green-400" : "text-gray-400"}`}>
                  {entry.done}/{entry.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build type-checks**

Run: `cd frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/components/PrehabTab.tsx
git commit -m "feat(prehab): rewrite tab as daily session (sections + timer + hybrid logging)"
```

---

### Task 8: Full verification + manual checklist

**Files:** none (verification only).

- [ ] **Step 1: Run the unit tests**

Run: `cd frontend && npm test`
Expected: all `prehabData` + `prehabSession` tests pass.

- [ ] **Step 2: Run the production build**

Run: `cd frontend && npm run build`
Expected: `tsc` clean, `vite build` succeeds.

- [ ] **Step 3: Manual smoke test in the dev server**

Run: `cd frontend && npm run dev`, open the app, go to the **Prehab** tab. Verify each:
- [ ] Three sections show; **Shoulders** open by default, the other two collapsed with `0/3` and `0/1`.
- [ ] Tapping a section header expands/collapses it; the chevron rotates.
- [ ] On **Back Extension** (loaded), the weight ± changes by 2.5; on **Scap-Plane Front Raise** it changes by 1.25.
- [ ] Tapping set buttons fills them green left-to-right; the badge updates `n/sets`; tapping a filled set undoes from there.
- [ ] Logging a set on a loaded/reps move starts the rest countdown; it does **not** start on the holds (Anterior Delt Isometric, Rhythmic Stabilization, Single-Leg Stand).
- [ ] Rest reaches 0 → full-screen **GO** + beeps; tapping the timer or overlay dismisses it.
- [ ] Tapping the timer toggles the stopwatch; long-press (held ~0.5s) clears an active rest.
- [ ] Overall progress bar + `done/total` (out of 8) update as exercises complete.
- [ ] **Complete Session** is disabled at 0 done; once tapped it shows "Saved!" and a Recent Log row appears for today's date with `done/total`.
- [ ] Reload the page mid-session: ticked sets, weights, and a running rest timer are restored.

- [ ] **Step 4: Confirm no regression to the workout tab**

In the running app, open **Today's Workout** and confirm its timer/cards still work (we did not modify it; this is a sanity check).

- [ ] **Step 5: Final commit (if any verification fixes were needed)**

```bash
git add -A
git commit -m "chore(prehab): verification fixes"
```
(If no fixes were needed, skip this step.)

---

## Notes for the implementer

- **Do not modify** `TodayWorkout.tsx` or `ExerciseCard.tsx`. The timer is intentionally re-implemented as a small shared hook; a future refactor could migrate the workout tab onto it, but that is out of scope here.
- The old `gym-prehab-log` localStorage key is left as-is; the new tab uses `gym-prehab-v2-*`. No migration.
- Content is a deliberately light starting point for a symptomatic shoulder and an LBA-style lower back. The exercise list lives entirely in `data/prehabData.ts` — editing prescriptions/sets later is a one-file change.
