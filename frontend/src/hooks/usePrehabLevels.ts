import { useCallback, useEffect, useState } from "react";

const LEVELS_KEY = "gym-prehab-levels";

/** Current progression level per exercise id (1-based). Frontend-only, localStorage. */
export function usePrehabLevels() {
  const [levels, setLevels] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LEVELS_KEY);
      if (raw) return JSON.parse(raw) as Record<string, number>;
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
