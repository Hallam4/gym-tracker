import { useCallback, useEffect, useState } from "react";

const PHASE_KEY = "gym-prehab-phase";

/** Current shoulder-programme phase (1-based). Frontend-only, localStorage. */
export function usePrehabPhase() {
  const [phase, setPhaseState] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(PHASE_KEY);
      if (raw) {
        const n = Number(JSON.parse(raw));
        if (Number.isFinite(n)) return n;
      }
    } catch { /* ignore */ }
    return 1;
  });

  useEffect(() => {
    try { localStorage.setItem(PHASE_KEY, JSON.stringify(phase)); } catch { /* ignore */ }
  }, [phase]);

  const setPhase = useCallback((p: number) => { setPhaseState(p); }, []);

  return { phase, setPhase };
}
