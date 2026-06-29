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
