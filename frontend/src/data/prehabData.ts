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

// Pack & pull ladders restructured 14 Jul 2026 (evening) to mirror the LBA shoulder
// protocol video (F27vP8dTNxw) at the user's instruction: floor → overhead statics →
// dynamic; warm-up section deliberately omitted. One level at a time, ≥4–6 wks/level.
const SHOULDER_PACK_LEVELS: PrehabLevel[] = [
  { level: 1, name: "Plank Pack Hold", kind: "hold", sets: 2, prescription: "build to 30s+ holds",
    tags: ["push-up plank", "scap pushes", "regress to wall/incline if needed"],
    action: "Hold a push-up plank and add slow scap pushes — sink between the shoulder blades, then push the floor away. Start with hands on a wall or bench if the floor is too much.",
    purpose: "Teaches the shoulder to accept load pressed into the joint — serratus and deep stabilisers in the safest, horizontal position.",
    goal: "Comfortable 30s+ holds with controlled scap pushes." },
  { level: 2, name: "Overhead Pack Hold", kind: "hold", sets: 2, prescription: "build to 30s",
    tags: ["downward dog → pike → handstand", "anti-shrug", "push the floor away"],
    action: "Take the same hold more vertical: downward dog, then a feet-elevated pike with head through the arms, working toward handstand holds — pushing away from the ground throughout.",
    purpose: "Builds overhead packing tolerance; the video's benchmark 30-second hold is what restored pressing without deep capsule fatigue.",
    goal: "A 30-second overhead hold." },
  { level: 3, name: "Dynamic Pack (Bear Crawls)", kind: "reps", sets: 2, prescription: "crawls fwd + back",
    tags: ["vary speed", "backward loads shoulders more", "optional plate"],
    action: "Bear crawls forward and backward, from slow and gentle up to quicker, springier steps; add a plate on the back once easy.",
    purpose: "Adds movement and unpredictability so the joint learns to stabilise reactively under changing load.",
    goal: "Smooth crawls both directions at varying speeds." },
];

const PULL_LEVELS: PrehabLevel[] = [
  { level: 1, name: "Horizontal Pull (TRX Row Hold)", kind: "hold", sets: 3, prescription: "row in + hold",
    tags: ["inverted hang", "C-scoop", "retract + hold"],
    action: "Hang under a TRX or low bar, let the joint stretch, then row in and hold with the shoulder blades retracted in a C-scoop.",
    purpose: "Trains the joint against distraction in the horizontal plane first — the least provocative pull position.",
    goal: "Controlled row-in holds with a clean C-scoop." },
  { level: 2, name: "Hang + Gentle Swings", kind: "hold", sets: 3, prescription: "build toward arms-to-ears",
    tags: ["feet may assist", "small side-to-side swings"],
    action: "Dead hang — feet on the floor taking some weight at first — settling toward arms beside the ears, then add small, gentle side-to-side swings.",
    purpose: "Vertical distraction, introduced statically and then with light movement.",
    goal: "A relaxed full hang with gentle swings." },
  { level: 3, name: "Dynamic Pull (Monkey Bars)", kind: "reps", sets: 2, prescription: "traverses · 1-arm hang 5–10s",
    tags: ["unpredictable directions", "smooth transfers"],
    action: "Traverse monkey bars hand over hand, varying rhythm and direction; build single-arm hang tolerance toward 5–10 seconds.",
    purpose: "The most exposing pull — dynamic, unpredictable distraction with rotation through the ball and socket.",
    goal: "A full traverse run and a 5–10s single-arm hang." },
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
        name: "Pack",
        kind: SHOULDER_PACK_LEVELS[0].kind,
        sets: SHOULDER_PACK_LEVELS[0].sets,
        prescription: SHOULDER_PACK_LEVELS[0].prescription,
        tags: SHOULDER_PACK_LEVELS[0].tags,
        note: "≥4–6 wks/level · stop on apprehension",
        levels: SHOULDER_PACK_LEVELS,
      },
      {
        id: "pull-ladder",
        name: "Pull",
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
