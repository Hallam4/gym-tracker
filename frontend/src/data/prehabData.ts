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
