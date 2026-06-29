import { useCallback, useEffect, useState } from "react";
import {
  DayState, LogEntry, emptyDayState, rollIfNewDay, buildLogEntry, appendLog,
} from "../lib/prehabSession";

const DAY_KEY = "gym-prehab-v2-today";
const LOG_KEY = "gym-prehab-v2-log";

const todayStr = () => new Date().toISOString().slice(0, 10);

export function usePrehabSession() {
  const [day, setDay] = useState<DayState>(() => {
    try {
      const raw = localStorage.getItem(DAY_KEY);
      if (raw) return rollIfNewDay(JSON.parse(raw) as DayState, todayStr());
    } catch { /* ignore */ }
    return emptyDayState(todayStr());
  });

  const [log, setLog] = useState<LogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LOG_KEY);
      if (raw) return JSON.parse(raw) as LogEntry[];
    } catch { /* ignore */ }
    return [];
  });

  useEffect(() => {
    try { localStorage.setItem(DAY_KEY, JSON.stringify(day)); } catch { /* ignore */ }
  }, [day]);

  useEffect(() => {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch { /* ignore */ }
  }, [log]);

  const setSetsDone = useCallback((exId: string, setsDone: number) => {
    setDay((d) => ({
      ...d,
      entries: { ...d.entries, [exId]: { ...d.entries[exId], setsDone } },
    }));
  }, []);

  const setWeight = useCallback((exId: string, weight: string) => {
    setDay((d) => ({
      ...d,
      entries: { ...d.entries, [exId]: { setsDone: d.entries[exId]?.setsDone ?? 0, weight } },
    }));
  }, []);

  const completeSession = useCallback(() => {
    setLog((l) => appendLog(l, buildLogEntry(day)));
  }, [day]);

  return { day, log, setSetsDone, setWeight, completeSession };
}
