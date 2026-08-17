import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "../data/prehabData";
import {
  emptyDayState, rollIfNewDay, isExerciseDone,
  sectionProgress, overallProgress, buildLogEntry,
  clampLevel, activeExercise, DayState,
  weekStartMonday, shoulderRehabThisWeek, LogEntry, sessionTotal,
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

  it("overallProgress sums daily sections + shoulder rehab (excludes assessment)", () => {
    const state = { date: "d", entries: { "single-leg-stand": { setsDone: 1 } } };
    expect(overallProgress(state)).toEqual({ done: 1, total: 14 }); // 2+4+1 daily + 7 rehab
  });

  it("buildLogEntry captures date + per-section + overall", () => {
    const state = { date: "2026-06-29", entries: { "single-leg-stand": { setsDone: 1 } } };
    const entry = buildLogEntry(state);
    expect(entry.date).toBe("2026-06-29");
    expect(entry.done).toBe(1);
    expect(entry.total).toBe(14); // rehab now counts toward the total
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
    expect(overallProgress(state)).toEqual({ done: 0, total: 14 }); // …7 daily + 7 rehab; assessment (1) excluded
    const entry = buildLogEntry(state);
    expect(entry.total).toBe(14);
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

  it("keeps the 3 sheet section-columns but counts rehab toward the total", () => {
    const e = buildLogEntry(day({ "sr-scaption": { setsDone: 3, weight: "5" } }));
    expect(Object.keys(e.sections)).toEqual(["shoulders", "lowerback", "proprioception"]);
    expect(e.done).toBe(1);   // sr-scaption (rehab) now counts toward the overall total
    expect(e.total).toBe(14);
    expect(e.detail!.shoulderrehab).toEqual({ done: 1, total: 7 });
  });
});

describe("sessionTotal — displayed total incl. shoulder rehab (robust to older rows)", () => {
  const mk = (over: Partial<LogEntry>): LogEntry => ({
    date: "d", done: 0, total: 0,
    sections: { shoulders: { done: 0, total: 2 }, lowerback: { done: 0, total: 4 }, proprioception: { done: 0, total: 1 } } as any,
    ...over,
  });

  it("adds shoulder rehab to the daily columns (Aug-13-style row saved as Total=0/7)", () => {
    const entry = mk({ done: 0, total: 7, detail: { shoulderrehab: { done: 6, total: 7 }, weights: {} } });
    expect(sessionTotal(entry)).toEqual({ done: 6, total: 14 });
  });

  it("a full rehab-only day reads 7/14 (not complete — old prehab still undone)", () => {
    const entry = mk({ done: 0, total: 7, detail: { shoulderrehab: { done: 7, total: 7 }, weights: {} } });
    const t = sessionTotal(entry);
    expect(t).toEqual({ done: 7, total: 14 });
    expect(t.done === t.total).toBe(false);
  });

  it("equals the daily columns when there is no rehab detail (older prehab-only rows)", () => {
    const entry = mk({ done: 9, total: 9, sections: { shoulders: { done: 4, total: 4 }, lowerback: { done: 4, total: 4 }, proprioception: { done: 1, total: 1 } } as any });
    expect(sessionTotal(entry)).toEqual({ done: 9, total: 9 });
  });
});

describe("shoulder-rehab weekly count", () => {
  it("weekStartMonday returns the Monday of that week", () => {
    expect(weekStartMonday("2026-08-13")).toBe("2026-08-10"); // Thu → Mon 10 Aug
  });

  it("counts distinct in-week days where shoulder rehab was done", () => {
    const mk = (date: string, done: number): LogEntry => ({
      date, done: 0, total: 0, sections: {} as any,
      detail: { shoulderrehab: { done, total: 7 }, weights: {} },
    });
    const log = [
      mk("2026-08-10", 7), // Mon, done
      mk("2026-08-12", 3), // Wed, partial but done>0
      mk("2026-08-11", 0), // Tue, not done
      mk("2026-08-09", 7), // prev-week Sun, excluded
    ];
    expect(shoulderRehabThisWeek(log, "2026-08-13")).toBe(2);
  });
});
