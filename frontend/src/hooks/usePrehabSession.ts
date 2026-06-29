import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, PrehabCompleteRequest } from "../api/gym";
import { DayState, LogEntry, emptyDayState, rollIfNewDay, buildLogEntry } from "../lib/prehabSession";

const DAY_KEY = "gym-prehab-v2-today";
const todayStr = () => new Date().toISOString().slice(0, 10);

export function usePrehabSession() {
  const queryClient = useQueryClient();

  // In-progress day state stays in localStorage.
  const [day, setDay] = useState<DayState>(() => {
    try {
      const raw = localStorage.getItem(DAY_KEY);
      if (raw) return rollIfNewDay(JSON.parse(raw) as DayState, todayStr());
    } catch { /* ignore */ }
    return emptyDayState(todayStr());
  });

  useEffect(() => {
    try { localStorage.setItem(DAY_KEY, JSON.stringify(day)); } catch { /* ignore */ }
  }, [day]);

  // Completed-session log comes from the backend.
  const { data: log = [] } = useQuery({
    queryKey: ["prehab-history"],
    queryFn: () => api.getPrehabHistory().then((r) => r.sessions as LogEntry[]),
  });

  const mutation = useMutation({
    // buildLogEntry(day) is structurally a PrehabCompleteRequest; the cast bridges
    // LogEntry's SectionId-keyed record to the API's string-keyed record.
    mutationFn: () => api.completePrehab(buildLogEntry(day) as PrehabCompleteRequest),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prehab-history"] }),
  });

  const setSetsDone = useCallback((exId: string, setsDone: number) => {
    setDay((d) => ({ ...d, entries: { ...d.entries, [exId]: { ...d.entries[exId], setsDone } } }));
  }, []);

  const setWeight = useCallback((exId: string, weight: string) => {
    setDay((d) => ({
      ...d,
      entries: { ...d.entries, [exId]: { ...d.entries[exId], setsDone: d.entries[exId]?.setsDone ?? 0, weight } },
    }));
  }, []);

  const completeSession = useCallback(() => { mutation.mutate(); }, [mutation]);

  return {
    day,
    log,
    setSetsDone,
    setWeight,
    completeSession,
    isSaving: mutation.isPending,
    isSaved: mutation.isSuccess,
    saveError: mutation.isError,
  };
}
