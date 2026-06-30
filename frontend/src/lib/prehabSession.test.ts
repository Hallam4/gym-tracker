import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "../data/prehabData";
import {
  emptyDayState, rollIfNewDay, isExerciseDone,
  sectionProgress, overallProgress, buildLogEntry,
  clampLevel, activeExercise,
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
    expect(sectionProgress("shoulders", state)).toEqual({ done: 1, total: 4 });
  });

  it("overallProgress sums across all sections (6 total)", () => {
    const state = { date: "d", entries: { "single-leg-stand": { setsDone: 1 } } };
    expect(overallProgress(state)).toEqual({ done: 1, total: 6 });
  });

  it("buildLogEntry captures date + per-section + overall", () => {
    const state = { date: "2026-06-29", entries: { "single-leg-stand": { setsDone: 1 } } };
    const entry = buildLogEntry(state);
    expect(entry.date).toBe("2026-06-29");
    expect(entry.done).toBe(1);
    expect(entry.total).toBe(6);
    expect(entry.sections.proprioception).toEqual({ done: 1, total: 1 });
  });

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

});
