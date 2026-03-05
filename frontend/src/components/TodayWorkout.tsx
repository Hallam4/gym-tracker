import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, WorkoutSession, WorkoutSummaryResponse } from "../api/gym";
import ExerciseCard from "./ExerciseCard";
import { groupExercises } from "../utils/groupExercises";
import { useWriteQueue } from "../hooks/useWriteQueue";
import { fmtDate } from "../utils/formatDate";
import Toast from "./Toast";
import ConfirmModal from "./ConfirmModal";
import WorkoutSummary from "./WorkoutSummary";

const TYPES = ["U1", "L1", "U2", "L2", "Arm"] as const;
const TYPE_LABELS: Record<string, string> = {
  U1: "Upper 1",
  L1: "Lower 1",
  U2: "Upper 2",
  L2: "Lower 2",
  Arm: "Arms",
};

interface PendingWrite {
  tabName: string;
  updates: { row: number; col: number; value: string }[];
}

function loadPendingWrites(): PendingWrite[] {
  try {
    return JSON.parse(localStorage.getItem("gym-pending-writes") || "[]");
  } catch {
    return [];
  }
}

function savePendingWrites(writes: PendingWrite[]) {
  localStorage.setItem("gym-pending-writes", JSON.stringify(writes));
}

export default function TodayWorkout() {
  const [selectedType, setSelectedType] = useState<string>("U1");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [lastSetTime, setLastSetTime] = useState<number | null>(null);
  const [groupLastSetTime, setGroupLastSetTime] = useState<Map<number, number>>(new Map());
  const [progressMap, setProgressMap] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [summaryData, setSummaryData] = useState<WorkoutSummaryResponse | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!timerRunning) return;
    intervalRef.current = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning]);

  const { data: session, isLoading, error } = useQuery({
    queryKey: ["workout-type", selectedType],
    queryFn: () => api.getWorkoutByType(selectedType),
  });

  // Reset progress map when session changes
  useEffect(() => {
    setProgressMap(new Map());
  }, [session?.tab_name]);

  const logMutation = useMutation({
    mutationFn: (vars: { tabName: string; updates: { row: number; col: number; value: string }[] }) =>
      api.logWorkout(vars.tabName, vars.updates),
    onError: (_err, vars) => {
      const pending = loadPendingWrites();
      pending.push(vars);
      savePendingWrites(pending);
      setToast({ message: "Save failed \u2014 will retry", type: "error" });
    },
  });

  const writeQueue = useWriteQueue({
    debounceMs: 800,
    onFlush: (updates) => {
      if (!session) return;
      return logMutation.mutateAsync({ tabName: session.tab_name, updates });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (tabName: string) => api.completeWorkout(tabName),
    onSuccess: (data) => {
      setSummaryData(data);
    },
    onError: () => {
      setToast({ message: "Failed to save workout", type: "error" });
    },
  });

  // Sync pending writes on mount
  const syncPending = useCallback(async () => {
    const pending = loadPendingWrites();
    if (pending.length === 0) return;
    const remaining: PendingWrite[] = [];
    for (const write of pending) {
      try {
        await api.logWorkout(write.tabName, write.updates);
      } catch {
        remaining.push(write);
      }
    }
    savePendingWrites(remaining);
  }, []);

  useEffect(() => {
    syncPending();
  }, []);

  const handleSetComplete = useCallback(
    (exercise: WorkoutSession["exercises"][0], setIndex: number, reps: number) => {
      if (!session) return;
      const setCol = 5 + setIndex; // Set 1-5 are columns 5-9
      writeQueue.enqueue({ row: exercise.sheet_row, col: setCol, value: reps.toString() });
      setLastSetTime(timerSeconds);
      setGroupLastSetTime((prev) => {
        const next = new Map(prev);
        next.set(exercise.superset_group, timerSeconds);
        return next;
      });
    },
    [session, writeQueue, timerSeconds]
  );

  const handleWeightChange = useCallback(
    (exercise: WorkoutSession["exercises"][0], weight: string) => {
      if (!session) return;
      writeQueue.enqueue({ row: exercise.sheet_row, col: 3, value: weight });
    },
    [session, writeQueue]
  );

  const handleNotesChange = useCallback(
    (exercise: WorkoutSession["exercises"][0], notes: string) => {
      if (!session || exercise.notes_col == null) return;
      writeQueue.enqueue({ row: exercise.sheet_row, col: exercise.notes_col, value: notes });
    },
    [session, writeQueue]
  );

  const toggleGroup = useCallback((groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }, []);

  const handleProgressChange = useCallback(
    (key: string, done: number, total: number) => {
      setProgressMap((prev) => {
        const next = new Map(prev);
        next.set(key, { done, total });
        return next;
      });
    },
    []
  );

  // Aggregate progress
  let totalSets = 0;
  let doneSets = 0;
  for (const { done, total } of progressMap.values()) {
    totalSets += total;
    doneSets += done;
  }
  const progressPct = totalSets > 0 ? Math.min(100, (doneSets / totalSets) * 100) : 0;

  // Progress bar color
  let barColorClass: string;
  if (progressPct >= 90) {
    barColorClass = "bg-gradient-to-r from-green-500 to-emerald-400";
  } else if (progressPct >= 50) {
    barColorClass = "bg-gradient-to-r from-green-600 to-green-500";
  } else {
    barColorClass = "bg-green-600";
  }

  // Build confirm summary
  const exerciseCount = session?.exercises.length ?? 0;

  if (isLoading) return (
    <div className="space-y-4 py-4" role="status">
      <div className="flex gap-2 pb-3">
        {[1,2,3,4,5].map(i => <div key={i} className="h-10 w-20 bg-gray-800 rounded-full animate-pulse" />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 space-y-3 animate-pulse">
        <div className="h-4 w-2/3 bg-gray-800 rounded" />
        <div className="h-3 w-1/3 bg-gray-800 rounded" />
        <div className="grid grid-cols-5 gap-2">
          {[1,2,3,4,5].map(j => <div key={j} className="h-12 bg-gray-800 rounded-lg" />)}
        </div>
      </div>)}
    </div>
  );
  if (error) return (
    <div className="text-center py-12" role="alert">
      <div className="text-red-400 font-medium mb-2">Could not load workout</div>
      <p className="text-sm text-gray-500 mb-4">Check your connection and try again.</p>
      <button
        onClick={() => queryClient.invalidateQueries({ queryKey: ["workout-type", selectedType] })}
        className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm touch-target hover:bg-gray-700 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Retry
      </button>
    </div>
  );
  if (!session) return null;

  return (
    <div>
      {/* Type selector */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3" role="group" aria-label="Workout type">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => { writeQueue.flush(); setTimerSeconds(0); setTimerRunning(false); setLastSetTime(null); setGroupLastSetTime(new Map()); setSelectedType(t); }}
            aria-pressed={selectedType === t}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-target transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
              selectedType === t
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-gray-800 text-gray-400 ring-1 ring-gray-700/50 hover:bg-gray-700 hover:text-gray-300"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Workout info */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-400">
          {session.day} {session.date && `\u2014 ${fmtDate(session.date)}`}
        </div>
      </div>

      {/* Stopwatch */}
      <div className="flex items-center justify-center gap-2 mb-4" role="timer" aria-label="Workout stopwatch">
        <button
          onClick={() => setTimerRunning((r) => !r)}
          aria-label={timerRunning ? "Pause stopwatch" : "Start stopwatch"}
          className="bg-gray-800/70 rounded-xl px-4 py-2 touch-target hover:bg-gray-700/70 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
        >
          <span className="text-xl font-mono text-white tabular-nums" aria-live="off">
            {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
          </span>
        </button>
        <button
          onClick={() => { setTimerRunning(false); setTimerSeconds(0); setLastSetTime(null); setGroupLastSetTime(new Map()); }}
          className="text-gray-400 text-lg bg-gray-800/50 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-700/50 hover:text-gray-300 active:scale-90 active:bg-gray-700 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          aria-label="Reset stopwatch"
        >
          <span aria-hidden="true">&#8634;</span>
        </button>
      </div>
      {lastSetTime != null && (
        <div className="text-center text-xs font-mono text-gray-400 -mt-2 mb-3" aria-live="polite">
          Last set @ {Math.floor(lastSetTime / 60)}:{(lastSetTime % 60).toString().padStart(2, "0")}
        </div>
      )}

      {/* Progress bar */}
      {totalSets > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <div
            className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={doneSets}
            aria-valuemin={0}
            aria-valuemax={totalSets}
            aria-label={`Workout progress: ${doneSets} of ${totalSets} sets completed`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${barColorClass} ${
                progressPct >= 90 ? "progress-glow" : ""
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={`text-xs tabular-nums ${progressPct >= 100 ? "text-green-400" : "text-gray-400"}`} aria-hidden="true">
            {doneSets}/{totalSets}
          </span>
        </div>
      )}

      {/* Exercise cards */}
      <section aria-label="Exercises">
        {groupExercises(session.exercises).map((group) => (
          <div key={group.groupId} className={group.isSuperset ? "border-l-2 border-blue-500/70 pl-3 mb-3" : ""}>
            {group.isSuperset && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-blue-400">Superset</span>
                <span className="text-xs bg-gray-800/70 text-gray-400 px-1.5 py-0.5 rounded">
                  {group.exercises[0].sets} sets
                </span>
              </div>
            )}
            {group.exercises.map((ex, i) => (
              <ExerciseCard
                key={`${session.tab_name}-${group.groupId}-${i}`}
                exercise={ex}
                timerSeconds={timerSeconds}
                lastGroupSetTime={groupLastSetTime.get(ex.superset_group) ?? null}
                onSetComplete={(setIdx, reps) => handleSetComplete(ex, setIdx, reps)}
                onWeightChange={(w) => handleWeightChange(ex, w)}
                onNotesChange={(notes) => handleNotesChange(ex, notes)}
                onProgressChange={(done, total) =>
                  handleProgressChange(`${group.groupId}-${i}`, done, total)
                }
                hideSetInfo={group.isSuperset}
                className={group.isSuperset ? "mb-1" : "mb-3"}
                {...(group.isSuperset
                  ? {
                      expanded: expandedGroups.has(group.groupId),
                      onToggleExpand: () => toggleGroup(group.groupId),
                    }
                  : {})}
              />
            ))}
          </div>
        ))}
      </section>

      {/* Complete workout button */}
      <button
        onClick={() => setConfirmVisible(true)}
        disabled={completeMutation.isPending}
        className="w-full mt-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-bold text-lg touch-target disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg shadow-green-700/25 hover:brightness-110 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
      >
        {completeMutation.isPending
          ? "Saving..."
          : completeMutation.isSuccess
            ? "Saved!"
            : "Complete Workout"}
      </button>

      {/* Confirm modal */}
      {confirmVisible && (
        <ConfirmModal
          title="Complete workout?"
          summary={`${exerciseCount} exercises, ${doneSets}/${totalSets} sets completed`}
          onCancel={() => setConfirmVisible(false)}
          onConfirm={async () => {
            setConfirmVisible(false);
            await writeQueue.flush();
            completeMutation.mutate(session.tab_name);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Post-workout summary */}
      {summaryData && (
        <WorkoutSummary
          data={summaryData}
          totalSets={doneSets}
          duration={timerSeconds}
          onDismiss={() => {
            setSummaryData(null);
            queryClient.invalidateQueries({ queryKey: ["workout-type", selectedType] });
            queryClient.invalidateQueries({ queryKey: ["streaks"] });
            queryClient.invalidateQueries({ queryKey: ["prs"] });
            setToast({ message: "Workout saved!", type: "success" });
            setTimerSeconds(0);
            setTimerRunning(false);
            setLastSetTime(null);
            setGroupLastSetTime(new Map());
          }}
        />
      )}
    </div>
  );
}
