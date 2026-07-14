import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "../data/prehabData";
import {
  emptyDayState, rollIfNewDay, isExerciseDone,
  sectionProgress, overallProgress, buildLogEntry,
  clampLevel, activeExercise,
  phaseDose, effectiveExercise, visibleExercises,
} from "./prehabSession";

const antDelt = PREHAB_SECTIONS[0].exercises[0]; // sets: 5
const backExt = PREHAB_SECTIONS[1].exercises[0]; // lowerback progression, id "back-ext-progression"

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
    expect(sectionProgress("shoulders", state)).toEqual({ done: 1, total: 6 });
  });

  it("overallProgress sums across all sections (6 total)", () => {
    const state = { date: "d", entries: { "single-leg-stand": { setsDone: 1 } } };
    expect(overallProgress(state)).toEqual({ done: 1, total: 11 });
  });

  it("buildLogEntry captures date + per-section + overall", () => {
    const state = { date: "2026-06-29", entries: { "single-leg-stand": { setsDone: 1 } } };
    const entry = buildLogEntry(state);
    expect(entry.date).toBe("2026-06-29");
    expect(entry.done).toBe(1);
    expect(entry.total).toBe(11);
    expect(entry.sections.proprioception).toEqual({ done: 1, total: 1 });
  });

  it("clampLevel bounds to [1, count]", () => {
    expect(clampLevel(0, 5)).toBe(1);
    expect(clampLevel(-3, 5)).toBe(1);
    expect(clampLevel(3, 5)).toBe(3);
    expect(clampLevel(9, 5)).toBe(5);
    expect(clampLevel(2, 0)).toBe(1);
    expect(clampLevel(NaN, 5)).toBe(1);       // corrupted persisted value
    expect(clampLevel(Infinity, 5)).toBe(1);
  });

  it("activeExercise resolves the active level's tracking fields", () => {
    expect(activeExercise(backExt, 1).kind).toBe("hold");
    expect(activeExercise(backExt, 1).sets).toBe(1);
    expect(activeExercise(backExt, 3).kind).toBe("reps");
    expect(activeExercise(backExt, 3).sets).toBe(3);
    expect(activeExercise(backExt, 5).kind).toBe("loaded");
    expect(activeExercise(backExt, 99).sets).toBe(backExt.levels![4].sets); // clamps to L5
    expect(activeExercise(backExt, 1)).not.toBe(backExt); // progression returns a distinct copy
  });

  it("activeExercise returns simple exercises unchanged", () => {
    expect(activeExercise(antDelt, 3)).toBe(antDelt);
  });

  it("sectionProgress for lowerback respects the active level's set count", () => {
    const state = { date: "d", entries: { "back-ext-progression": { setsDone: 1 } } };
    // Level 1 needs 1 set → done
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 1 })).toEqual({ done: 1, total: 4 });
    // Level 3 needs 3 sets → not done with only 1 logged
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 3 })).toEqual({ done: 0, total: 4 });
  });

});

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
