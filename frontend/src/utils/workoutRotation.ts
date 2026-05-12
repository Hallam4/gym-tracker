const ROTATION = ["U1", "L1", "U2", "L2"] as const;

const LABEL_TO_CODE: Record<string, string> = {
  "Upper 1": "U1",
  "Lower 1": "L1",
  "Upper 2": "U2",
  "Lower 2": "L2",
  Arms: "Arm",
};

const CODE_TO_LABEL: Record<string, string> = {
  U1: "Upper 1 — Strength",
  L1: "Lower 1 — Strength",
  U2: "Upper 2 — Hypertrophy",
  L2: "Lower 2 — Hypertrophy",
};

export function getNextWorkoutType(sessions: { day: string }[]): {
  code: string;
  label: string;
} | null {
  for (const session of sessions) {
    const code = LABEL_TO_CODE[session.day];
    if (!code || code === "Arm") continue;
    const idx = ROTATION.indexOf(code as (typeof ROTATION)[number]);
    if (idx === -1) continue;
    const nextCode = ROTATION[(idx + 1) % ROTATION.length];
    return { code: nextCode, label: CODE_TO_LABEL[nextCode] };
  }
  return { code: "U1", label: CODE_TO_LABEL["U1"] };
}
