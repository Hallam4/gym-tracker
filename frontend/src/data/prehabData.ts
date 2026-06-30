export type SectionId = "shoulders" | "lowerback" | "proprioception";
export type ExerciseKind = "loaded" | "hold" | "reps";

export interface PrehabLevel {
  level: number;         // 1-based, for display ("Level 2 of 5")
  name: string;
  kind: ExerciseKind;
  sets: number;
  prescription: string;
  tags: string[];
  weightStep?: number;   // loaded levels only
  action: string;
  purpose: string;
  goal: string;
}

export interface PrehabExercise {
  id: string;            // stable storage key
  name: string;
  kind: ExerciseKind;    // loaded = weight + set buttons; hold/reps = set buttons only
  sets: number;          // number of set ticks; "done" when setsDone >= sets
  prescription: string;  // e.g. "2–3×8–10"
  tags: string[];        // small pills
  note?: string;         // e.g. "progression (2–3×/week)"
  weightStep?: number;   // loaded only: ± increment (default 2.5)
  levels?: PrehabLevel[];   // when present → progression exercise (active level overrides top-level kind/sets/etc.)
}

export interface PrehabSectionDef {
  id: SectionId;
  label: string;
  icon: string;
  exercises: PrehabExercise[];
}

const BACK_EXT_LEVELS: PrehabLevel[] = [
  { level: 1, name: "Two-Leg Isometric Hold", kind: "hold", sets: 1, prescription: "build to 2-min hold",
    tags: ["reverse plank", "no spasms"],
    action: "Hold a straight-body reverse-plank position on the machine.",
    purpose: "Teaches the nervous system to fire the muscles safely without triggering spasms.",
    goal: "Build to a continuous 2-minute hold." },
  { level: 2, name: "Single-Leg Isometric Hold", kind: "hold", sets: 2, prescription: "build to 1 min/leg",
    tags: ["one leg off pad", "resist twist"],
    action: "Remove one leg from the pad, forcing the body to resist twisting.",
    purpose: "Activates the deep paraspinals and multifidus to handle diagonal forces.",
    goal: "Build to a 1-minute hold per leg." },
  { level: 3, name: "Full-Range Reps", kind: "reps", sets: 3, prescription: "build to 30 reps",
    tags: ["flat-back hinge → segmented", "controlled"],
    action: "Start with a flat-back hinge, then gradually move into segmented spinal flexing and extending.",
    purpose: "Rounding at the bottom decompresses the vertebrae; coming up re-compresses them under strength.",
    goal: "Build to 30 controlled reps." },
  { level: 4, name: "Single-Leg Reps", kind: "reps", sets: 2, prescription: "build to 20 slow reps/leg",
    tags: ["one leg", "slow"],
    action: "Perform full-range extensions using only one leg at a time.",
    purpose: "Evens out left-to-right muscular imbalance in the lower back and glutes.",
    goal: "Build to 20 slow reps per leg." },
  { level: 5, name: "Loaded Extensions", kind: "loaded", sets: 3, prescription: "progressive load", weightStep: 2.5,
    tags: ["plate / barbell", "perfect form"],
    action: "Add progressive resistance by holding a weight plate or barbell.",
    purpose: "Maximises tissue resilience and bulletproofs the spine against heavy lifting or impact.",
    goal: "Scale the weight up over time while keeping perfect form." },
];

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
      {
        id: "back-ext-progression",
        name: "Back Extension",
        kind: BACK_EXT_LEVELS[0].kind,            // mirror Level 1 (default/fallback)
        sets: BACK_EXT_LEVELS[0].sets,
        prescription: BACK_EXT_LEVELS[0].prescription,
        tags: BACK_EXT_LEVELS[0].tags,
        note: "≥6 weeks per level",
        levels: BACK_EXT_LEVELS,
      },
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
