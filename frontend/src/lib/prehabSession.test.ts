import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "../data/prehabData";
import {
  emptyDayState, rollIfNewDay, isExerciseDone,
  sectionProgress, overallProgress, buildLogEntry,
  clampLevel, activeExercise,
} from "./prehabSession";

const bellyPressIr = PREHAB_SECTIONS[0].exercises[0]; // sets: 3
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
    expect(isExerciseDone(bellyPressIr, undefined)).toBe(false);
    expect(isExerciseDone(bellyPressIr, { setsDone: 2 })).toBe(false);
    expect(isExerciseDone(bellyPressIr, { setsDone: 3 })).toBe(true);
    expect(isExerciseDone(bellyPressIr, { setsDone: 4 })).toBe(true);
  });

  it("sectionProgress counts finished exercises in a section", () => {
    const state = { date: "d", entries: { "belly-press-ir": { setsDone: 3 } } };
    expect(sectionProgress("shoulders", state)).toEqual({ done: 1, total: 4 });
  });

  it("overallProgress sums across all sections (6 total)", () => {
    const state = { date: "d", entries: { "single-leg-stand": { setsDone: 1 } } };
    expect(overallProgress(state)).toEqual({ done: 1, total: 9 });
  });

  it("buildLogEntry captures date + per-section + overall", () => {
    const state = { date: "2026-06-29", entries: { "single-leg-stand": { setsDone: 1 } } };
    const entry = buildLogEntry(state);
    expect(entry.date).toBe("2026-06-29");
    expect(entry.done).toBe(1);
    expect(entry.total).toBe(9);
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
    expect(activeExercise(bellyPressIr, 3)).toBe(bellyPressIr);
  });

  it("sectionProgress for lowerback respects the active level's set count", () => {
    const state = { date: "d", entries: { "back-ext-progression": { setsDone: 1 } } };
    // Level 1 needs 1 set → done
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 1 })).toEqual({ done: 1, total: 4 });
    // Level 3 needs 3 sets → not done with only 1 logged
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 3 })).toEqual({ done: 0, total: 4 });
  });

  it("pull ladder resolves its levels like other progressions", () => {
    const pull = PREHAB_SECTIONS[0].exercises.find((e) => e.id === "pull-ladder")!;
    expect(pull.levels).toHaveLength(3);
    expect(activeExercise(pull, 1).sets).toBe(3);
    expect(activeExercise(pull, 3).kind).toBe("reps");
    expect(activeExercise(pull, 99).sets).toBe(pull.levels![2].sets);
  });

  it("pack ladder resolves its levels like other progressions", () => {
    const pack = PREHAB_SECTIONS[0].exercises.find((e) => e.id === "closed-chain-progression")!;
    expect(pack.levels).toHaveLength(3);
    expect(activeExercise(pack, 1).kind).toBe("hold");
    expect(activeExercise(pack, 3).kind).toBe("reps");
    expect(activeExercise(pack, 99).sets).toBe(pack.levels![2].sets);
  });

  it("overallProgress and buildLogEntry exclude the non-daily assessment section", () => {
    const state = { date: "d", entries: {} };
    expect(PREHAB_SECTIONS.length).toBe(4);            // 4 sections exist…
    expect(overallProgress(state)).toEqual({ done: 0, total: 9 }); // …but only 9 daily exercises count
    const entry = buildLogEntry(state);
    expect(entry.total).toBe(9);
    expect(entry.sections.assessment).toBeUndefined();
  });

  it("buildLogEntry carries notes through", () => {
    const state = { date: "2026-06-29", entries: {}, notes: "R felt tweaky" };
    expect(buildLogEntry(state).notes).toBe("R felt tweaky");
  });

});
