import { describe, it, expect } from "vitest";
import { PREHAB_SECTIONS } from "./prehabData";

describe("prehabData", () => {
  it("has the three sections in order", () => {
    expect(PREHAB_SECTIONS.map((s) => s.id)).toEqual(["shoulders", "lowerback", "proprioception"]);
  });

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
