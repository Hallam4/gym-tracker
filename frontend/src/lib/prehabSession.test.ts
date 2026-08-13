import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "../data/prehabData";
import {
  emptyDayState, rollIfNewDay, isExerciseDone,
  sectionProgress, overallProgress, buildLogEntry,
  clampLevel, activeExercise, DayState,
} from "./prehabSession";

const srExercise = PREHAB_SECTIONS[0].exercises[0]; // sr-prone-ha from shoulderrehab, sets: 3
const backExt = PREHAB_SECTIONS[2].exercises[0]; // lowerback progression, id "back-ext-progression"

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
    expect(isExerciseDone(srExercise, undefined)).toBe(false);
    expect(isExerciseDone(srExercise, { setsDone: 2 })).toBe(false);
    expect(isExerciseDone(srExercise, { setsDone: 3 })).toBe(true);
    expect(isExerciseDone(srExercise, { setsDone: 4 })).toBe(true);
  });

  it("sectionProgress counts finished exercises in a section", () => {
    const state = { date: "d", entries: { "closed-chain-progression": { setsDone: 2 } } };
    expect(sectionProgress("shoulders", state)).toEqual({ done: 1, total: 2 });
  });

  it("overallProgress sums across all sections (5 total)", () => {
    const state = { date: "d", entries: { "single-leg-stand": { setsDone: 1 } } };
    expect(overallProgress(state)).toEqual({ done: 1, total: 7 });
  });

  it("buildLogEntry captures date + per-section + overall", () => {
    const state = { date: "2026-06-29", entries: { "single-leg-stand": { setsDone: 1 } } };
    const entry = buildLogEntry(state);
    expect(entry.date).toBe("2026-06-29");
    expect(entry.done).toBe(1);
    expect(entry.total).toBe(7);
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
    expect(activeExercise(srExercise, 3)).toBe(srExercise);
  });

  it("sectionProgress for lowerback respects the active level's set count", () => {
    const state = { date: "d", entries: { "back-ext-progression": { setsDone: 1 } } };
    // Level 1 needs 1 set → done
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 1 })).toEqual({ done: 1, total: 4 });
    // Level 3 needs 3 sets → not done with only 1 logged
    expect(sectionProgress("lowerback", state, { "back-ext-progression": 3 })).toEqual({ done: 0, total: 4 });
  });

  it("pull ladder resolves its levels like other progressions", () => {
    const pull = PREHAB_SECTIONS[1].exercises.find((e) => e.id === "pull-ladder")!;
    expect(pull.levels).toHaveLength(3);
    expect(activeExercise(pull, 1).sets).toBe(3);
    expect(activeExercise(pull, 3).kind).toBe("reps");
    expect(activeExercise(pull, 99).sets).toBe(pull.levels![2].sets);
  });

  it("pack ladder resolves its levels like other progressions", () => {
    const pack = PREHAB_SECTIONS[1].exercises.find((e) => e.id === "closed-chain-progression")!;
    expect(pack.levels).toHaveLength(3);
    expect(activeExercise(pack, 1).kind).toBe("hold");
    expect(activeExercise(pack, 3).kind).toBe("reps");
    expect(activeExercise(pack, 99).sets).toBe(pack.levels![2].sets);
  });

  it("overallProgress and buildLogEntry exclude the non-daily assessment section", () => {
    const state = { date: "d", entries: {} };
    expect(PREHAB_SECTIONS.length).toBe(5);            // 5 sections exist…
    expect(overallProgress(state)).toEqual({ done: 0, total: 7 }); // …but only 7 daily exercises count
    const entry = buildLogEntry(state);
    expect(entry.total).toBe(7);
    expect(entry.sections.assessment).toBeUndefined();
  });

  it("buildLogEntry carries notes through", () => {
    const state = { date: "2026-06-29", entries: {}, notes: "R felt tweaky" };
    expect(buildLogEntry(state).notes).toBe("R felt tweaky");
  });

});

const day = (entries: DayState["entries"]): DayState => ({ date: "2026-08-13", entries });

describe("buildLogEntry — detail payload", () => {
  it("collects only non-empty weights, keyed by exercise id", () => {
    const e = buildLogEntry(day({
      "sr-scaption": { setsDone: 3, weight: "5" },
      "sr-prone-l": { setsDone: 1, weight: "" },
      "sr-side-lying-er": { setsDone: 2 },
    }));
    expect(e.detail!.weights).toEqual({ "sr-scaption": "5" });
  });

  it("reports shoulder-rehab section progress", () => {
    const entries: DayState["entries"] = {};
    for (const id of ["sr-prone-ha", "sr-prone-l", "sr-prone-t", "sr-supine-rotation", "sr-side-lying-er", "sr-scaption", "sr-banded-ir-90"]) {
      entries[id] = { setsDone: 3 };
    }
    const e = buildLogEntry(day(entries));
    expect(e.detail!.shoulderrehab).toEqual({ done: 7, total: 7 });
  });

  it("keeps the daily sections list and total unchanged (shoulder-rehab excluded)", () => {
    const e = buildLogEntry(day({ "sr-scaption": { setsDone: 3, weight: "5" } }));
    expect(Object.keys(e.sections)).toEqual(["shoulders", "lowerback", "proprioception"]);
    expect(e.done).toBe(0);
  });
});
