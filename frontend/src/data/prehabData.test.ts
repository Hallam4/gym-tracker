import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "./prehabData";

describe("prehabData", () => {
  it("has shoulderrehab first, then the daily trio, then non-daily assessment", () => {
    expect(PREHAB_SECTIONS.map((s) => s.id)).toEqual([
      "shoulderrehab", "shoulders", "lowerback", "proprioception", "assessment",
    ]);
    expect(PREHAB_SECTIONS.filter((s) => s.daily !== false).map((s) => s.id)).toEqual([
      "shoulders", "lowerback", "proprioception",
    ]);
    expect(PREHAB_SECTIONS.find((s) => s.id === "shoulderrehab")!.daily).toBe(false);
    expect(PREHAB_SECTIONS.find((s) => s.id === "assessment")!.daily).toBe(false);
  });

  it("has 7 daily exercises (15 including shoulder-rehab + assessment)", () => {
    const daily = PREHAB_SECTIONS.filter((s) => s.daily !== false).reduce((n, s) => n + s.exercises.length, 0);
    const all = PREHAB_SECTIONS.reduce((n, s) => n + s.exercises.length, 0);
    expect(daily).toBe(7);
    expect(all).toBe(15);
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

  it("lower back still has 4 exercises incl. the 5-level back-extension progression", () => {
    const lb = PREHAB_SECTIONS.find((s) => s.id === "lowerback")!;
    expect(lb.exercises).toHaveLength(4);
    expect(lb.exercises[0].id).toBe("back-ext-progression");
    expect(lb.exercises[0].levels!.map((l) => l.level)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("shoulders section (own additions only)", () => {
  const sh = PREHAB_SECTIONS.find((s) => s.id === "shoulders")!;
  it("holds only the Pack and Pull ladders", () => {
    expect(sh.exercises.map((e) => e.id)).toEqual(["closed-chain-progression", "pull-ladder"]);
  });
  it("pack and pull are still 3-level progressions", () => {
    for (const id of ["closed-chain-progression", "pull-ladder"]) {
      const prog = sh.exercises.find((e) => e.id === id)!;
      expect(prog.levels!.map((l) => l.level)).toEqual([1, 2, 3]);
    }
  });
});

describe("shoulderrehab section (Adham's prescription)", () => {
  const sr = PREHAB_SECTIONS.find((s) => s.id === "shoulderrehab")!;
  it("has the 7 prescribed exercises in order", () => {
    expect(sr.exercises.map((e) => e.id)).toEqual([
      "sr-prone-ha", "sr-prone-l", "sr-prone-t", "sr-supine-rotation",
      "sr-side-lying-er", "sr-scaption", "sr-banded-ir-90",
    ]);
  });
  it("all 7 are loaded, 3 sets, with a positive weight step", () => {
    for (const e of sr.exercises) {
      expect(e.kind).toBe("loaded");
      expect(e.sets).toBe(3);
      expect(e.weightStep ?? 0).toBeGreaterThan(0);
      expect(e.levels).toBeUndefined();
    }
  });
});
