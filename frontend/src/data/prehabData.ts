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

// Closed-chain scapular/serratus "pack" ladder — progresses load in the SAFE (horizontal)
// plane, gating the overhead position to the very end because it enters the apprehension /
// SLAP peel-back zone for this anterior-instability shoulder. One level at a time.
const SHOULDER_PACK_LEVELS: PrehabLevel[] = [
  { level: 1, name: "Wall Scap Push-up", kind: "reps", sets: 2, prescription: "build to 2×15",
    tags: ["hands chest height", "protract + retract", "most upright"],
    action: "Push-up-plus against a wall — protract (round the upper back) at the top, let the chest settle between the shoulder blades at the bottom. Elbows soft.",
    purpose: "Grooves serratus and scapular control at the lowest possible shoulder load, well below any provocative position.",
    goal: "2×15 with full protraction, no shrug." },
  { level: 2, name: "Incline Scap Push-up", kind: "reps", sets: 2, prescription: "build to 2×15",
    tags: ["hands on bench / rack pins", "more load"],
    action: "Same scap push-up with hands elevated on a bench or rack pins — the lower the hands, the more load.",
    purpose: "Adds load while keeping the torso inclined and the shoulder out of the overhead zone.",
    goal: "2×15 controlled, then lower the hands a notch." },
  { level: 3, name: "Floor Scap Push-up + Plank Pack Hold", kind: "reps", sets: 3, prescription: "2×15 reps + 45s hold",
    tags: ["horizontal", "hands under shoulders", "closed-chain hold"],
    action: "Full scap push-ups on the floor, then hold a tall plank actively pushing the floor away (protracted, ribs down).",
    purpose: "Peak serratus / closed-chain recruitment in the horizontal, safe plane; the static hold builds stabiliser endurance.",
    goal: "2×15 reps plus a 45-second protracted plank hold." },
  { level: 4, name: "Dynamic Closed-Chain", kind: "hold", sets: 3, prescription: "bear crawl / weight-shifts",
    tags: ["controlled perturbation", "stay at/below shoulder height"],
    action: "Bear-crawl holds and slow weight-shift 'clock taps' — hand-support with controlled, slightly unpredictable load. Keep hands at or below shoulder level.",
    purpose: "Adds reactive stability under changing load without entering the overhead position.",
    goal: "Controlled bear crawl and weight-shifts, no shrug, no apprehension." },
  { level: 5, name: "Graded Overhead Pack (late-stage)", kind: "loaded", sets: 3, prescription: "only once apprehension-free", weightStep: 1.25,
    tags: ["incline → pike", "STOP on apprehension", "return-to-press"],
    action: "Progress incline pike holds gradually toward overhead, pushing away from the floor (anti-shrug). This is the bridge back to overhead pressing.",
    purpose: "Rebuilds overhead closed-chain tolerance — but this enters the apprehension / SLAP zone, so it is gated to the end and only attempted when fully symptom-free.",
    goal: "Overhead pike hold pain- and apprehension-free, then reintroduce pressing." },
];

// LBA "pull" ladder — graded overhead-distraction progression (user-adopted 14 Jul 2026).
// One level at a time, ≥4–6 wks/level.
const PULL_LEVELS: PrehabLevel[] = [
  { level: 1, name: "Supported Hang", kind: "hold", sets: 3, prescription: "build to 3×30s",
    tags: ["feet on floor/box", "arms take partial weight"],
    action: "Hang from a bar with feet supported on the floor or a box, letting the arms take a comfortable share of bodyweight.",
    purpose: "Introduces overhead distraction gradually, letting the shoulder acclimatise under partial load.",
    goal: "3×30s relaxed, comfortable." },
  { level: 2, name: "Full Dead Hang", kind: "hold", sets: 3, prescription: "build to 3×45s",
    tags: ["arms to ears", "relaxed grip-width"],
    action: "Hang with full bodyweight, arms overhead, letting the shoulders settle into the stretch.",
    purpose: "Full passive overhead distraction — the core LBA pull position.",
    goal: "3×45s full-bodyweight hang." },
  { level: 3, name: "Gentle Swings", kind: "hold", sets: 3, prescription: "3×20–30s small arcs",
    tags: ["small controlled arcs", "no kipping"],
    action: "From a dead hang, add small, controlled front-to-back swings.",
    purpose: "Adds gentle dynamic load to the overhead position.",
    goal: "3×20–30s of smooth, controlled swinging." },
  { level: 4, name: "Single-Arm-Biased Hang", kind: "hold", sets: 2, prescription: "build to 20–30s/side",
    tags: ["one arm assists lightly"],
    action: "Shift most of your weight onto one arm, keeping the other hand on the bar for light assistance. Alternate sides.",
    purpose: "Progresses distraction load toward single-arm tolerance.",
    goal: "20–30s per side with minimal assist." },
  { level: 5, name: "Brachiation", kind: "reps", sets: 2, prescription: "controlled traverses",
    tags: ["monkey bars", "smooth transfers"],
    action: "Traverse monkey bars hand-over-hand with controlled, unhurried transfers.",
    purpose: "Dynamic single-arm overhead loading — the top of the pull ladder.",
    goal: "Smooth traverses without rushing." },
];

export const PREHAB_SECTIONS: PrehabSectionDef[] = [
  {
    id: "shoulders",
    label: "Shoulders",
    icon: "🦾",
    exercises: [
      { id: "belly-press-ir", name: "Belly-Press IR (subscap)", kind: "loaded", sets: 3, prescription: "3×12–15", tags: ["band/light", "elbow tucked"], weightStep: 1.25 },
      { id: "side-lying-er", name: "Side-Lying ER", kind: "loaded", sets: 3, prescription: "3×12–15", tags: ["light", "full comfortable range"], weightStep: 1.25 },
      {
        id: "closed-chain-progression",
        name: "Closed-Chain Pack",
        kind: SHOULDER_PACK_LEVELS[0].kind,
        sets: SHOULDER_PACK_LEVELS[0].sets,
        prescription: SHOULDER_PACK_LEVELS[0].prescription,
        tags: SHOULDER_PACK_LEVELS[0].tags,
        note: "≥4–6 wks/level · stop on apprehension",
        levels: SHOULDER_PACK_LEVELS,
      },
      {
        id: "pull-ladder",
        name: "Pull (Hang Ladder)",
        kind: PULL_LEVELS[0].kind,
        sets: PULL_LEVELS[0].sets,
        prescription: PULL_LEVELS[0].prescription,
        tags: PULL_LEVELS[0].tags,
        note: "≥4–6 wks/level",
        levels: PULL_LEVELS,
      },
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
      {
        id: "outer-hip-drop-set",
        name: "Outer Hip Drop Set",
        kind: "loaded",
        sets: 2,
        prescription: "2 sets, 3×30s stages",
        tags: ["short-range squeeze", "IR → abduct+rotate → abduct", "then stretch"],
        note: "squeeze-then-stretch, 2×/week · add ankle wt to progress",
        weightStep: 0.5,
      },
      {
        id: "split-squat-hold",
        name: "Split-Squat Hold",
        kind: "hold",
        sets: 2,
        prescription: "1 min/side",
        tags: ["hip-flexor mobility", "back leg straight", "front heel down"],
        note: "2×/week",
      },
      {
        id: "deep-squat-hold",
        name: "Deep-Squat Hold",
        kind: "hold",
        sets: 2,
        prescription: "2×1 min",
        tags: ["groin/adductors", "heels elevated", "tall torso, no butt-wink"],
        note: "2×/week · lower heel elevation over time",
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
