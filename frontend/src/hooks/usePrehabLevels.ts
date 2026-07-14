import { useCallback, useEffect, useState } from "react";

const LEVELS_KEY = "gym-prehab-levels";
// One-shot per device (14 Jul 2026): Pack & Pull ladders went 5→3 levels, so stored
// positions no longer mean what they did — reset both to Level 1 once, then never again.
const LADDER_RESET_FLAG = "gym-prehab-ladder-reset-2026-07-14";

/** Current progression level per exercise id (1-based). Frontend-only, localStorage. */
export function usePrehabLevels() {
  const [levels, setLevels] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LEVELS_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
      if (!localStorage.getItem(LADDER_RESET_FLAG)) {
        parsed["closed-chain-progression"] = 1;
        parsed["pull-ladder"] = 1;
        localStorage.setItem(LADDER_RESET_FLAG, "done");
      }
      return parsed;
    } catch { /* ignore */ }
    return {};
  });

  useEffect(() => {
    try { localStorage.setItem(LEVELS_KEY, JSON.stringify(levels)); } catch { /* ignore */ }
  }, [levels]);

  const setLevel = useCallback((exId: string, level: number) => {
    setLevels((m) => ({ ...m, [exId]: level }));
  }, []);

  return { levels, setLevel };
}
