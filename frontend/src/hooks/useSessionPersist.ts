import { useCallback, useRef, useEffect } from "react";

export interface SessionState {
  setResults: Record<string, (number | null)[]>; // keyed by exercise name
  weights: Record<string, string>;
  notes: Record<string, string>;
  setTimes: Record<string, (number | null)[]>; // timer timestamps per set
  timerSeconds: number;
  timerRunning: boolean;
  restTimerEnd?: number | null; // absolute timestamp (ms) when rest countdown expires
}

const EMPTY_STATE: SessionState = {
  setResults: {},
  weights: {},
  notes: {},
  setTimes: {},
  timerSeconds: 0,
  timerRunning: false,
};

function storageKey(type: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `gym-session-${type}-${today}`;
}

export function useSessionPersist(type: string) {
  const key = storageKey(type);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load state (returns empty if stale/missing/corrupted)
  const loadState = useCallback((): SessionState => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Validate shape — fall back to empty if corrupted
        if (
          typeof parsed !== "object" || parsed === null ||
          typeof parsed.setResults !== "object" ||
          typeof parsed.weights !== "object" ||
          typeof parsed.notes !== "object" ||
          typeof parsed.setTimes !== "object" ||
          typeof parsed.timerSeconds !== "number"
        ) {
          localStorage.removeItem(key);
          return { ...EMPTY_STATE };
        }
        // Ensure setResults values are arrays
        for (const k of Object.keys(parsed.setResults)) {
          if (!Array.isArray(parsed.setResults[k])) {
            localStorage.removeItem(key);
            return { ...EMPTY_STATE };
          }
        }
        return parsed;
      }
    } catch {
      localStorage.removeItem(key);
    }
    return { ...EMPTY_STATE };
  }, [key]);

  // Debounced save
  const saveState = useCallback(
    (state: SessionState) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem(key, JSON.stringify(state));
      }, 500);
    },
    [key]
  );

  const clearState = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  // Clean up stale sessions (different dates) on mount
  useEffect(() => {
    const prefix = `gym-session-${type}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix) && k !== key) {
        localStorage.removeItem(k);
      }
    }
  }, [type, key]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { loadState, saveState, clearState };
}
