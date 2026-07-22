import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "./prehabData";

describe("prehabData", () => {
  it("has the daily sections in order, plus a non-daily assessment section last", () => {
    expect(PREHAB_SECTIONS.map((s) => s.id)).toEqual(["shoulders", "lowerback", "proprioception", "assessment"]);
    expect(PREHAB_SECTIONS.filter((s) => s.daily !== false).map((s) => s.id)).toEqual(["shoulders", "lowerback", "proprioception"]);
    expect(PREHAB_SECTIONS.find((s) => s.id === "assessment")!.daily).toBe(false);
  });

  it("has 9 daily exercises (10 including the assessment card)", () => {
    const daily = PREHAB_SECTIONS.filter((s) => s.daily !== false).reduce((n, s) => n + s.exercises.length, 0);
    const all = PREHAB_SECTIONS.reduce((n, s) => n + s.exercises.length, 0);
    expect(daily).toBe(9);
    expect(all).toBe(10);
  });

  it("lower back has 4 exercises, including a 5-level back-extension progression", () => {
    const lb = PREHAB_SECTIONS.find((s) => s.id === "lowerback")!;
    expect(lb.exercises).toHaveLength(4);
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

describe("shoulders section", () => {
  const sh = PREHAB_SECTIONS.find((s) => s.id === "shoulders")!;

  it("has the four expected exercises in order", () => {
    expect(sh.exercises.map((e) => e.id)).toEqual([
      "belly-press-ir", "side-lying-er", "closed-chain-progression", "pull-ladder",
    ]);
  });

  it("belly-press IR and side-lying ER are loaded with a positive weight step", () => {
    for (const id of ["belly-press-ir", "side-lying-er"]) {
      const ex = sh.exercises.find((e) => e.id === id)!;
      expect(ex.kind).toBe("loaded");
      expect(ex.weightStep ?? 0).toBeGreaterThan(0);
    }
  });

  it("pack and pull are 3-level progressions with complete level data", () => {
    for (const id of ["closed-chain-progression", "pull-ladder"]) {
      const prog = sh.exercises.find((e) => e.id === id)!;
      expect(prog.levels).toBeDefined();
      expect(prog.levels!.map((l) => l.level)).toEqual([1, 2, 3]);
      for (const l of prog.levels!) {
        expect(["loaded", "hold", "reps"]).toContain(l.kind);
        expect(l.sets).toBeGreaterThanOrEqual(1);
        expect(l.action).toBeTruthy();
        expect(l.purpose).toBeTruthy();
        expect(l.goal).toBeTruthy();
        if (l.kind === "loaded") expect(l.weightStep ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("pack ladder is ordered floor → overhead → dynamic (14 Jul video order)", () => {
    const pack = sh.exercises.find((e) => e.id === "closed-chain-progression")!;
    expect(pack.levels![1].name).toMatch(/overhead/i);
    expect(pack.levels![2].name).toMatch(/dynamic/i);
  });
});
