import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, WorkoutSession } from "../api/gym";
import ExerciseCard from "./ExerciseCard";
import RestTimer from "./RestTimer";
import { groupExercises } from "../utils/groupExercises";
import { useWriteQueue } from "../hooks/useWriteQueue";
import Toast from "./Toast";
import ConfirmModal from "./ConfirmModal";

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
  const [workoutStart, setWorkoutStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [restTimer, setRestTimer] = useState<{
    exerciseName: string;
    durationSeconds: number;
  } | null>(null);
  const [progressMap, setProgressMap] = useState<Map<string, { done: number; total: number }>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (workoutStart === null) {
      setElapsed(0);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - workoutStart) / 1000));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [workoutStart]);

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
      setToast({ message: "Save failed — will retry", type: "error" });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-type", selectedType] });
      setToast({ message: "Workout saved!", type: "success" });
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

  useState(() => {
    syncPending();
  });

  const handleSetComplete = useCallback(
    (exercise: WorkoutSession["exercises"][0], setIndex: number, reps: number) => {
      if (!session) return;
      const setCol = 5 + setIndex; // Set 1-5 are columns 5-9
      writeQueue.enqueue({ row: exercise.sheet_row, col: setCol, value: reps.toString() });
      const restSeconds = parseInt(exercise.rest_times[setIndex]) || 0;
      if (restSeconds > 0) {
        setRestTimer({ exerciseName: exercise.name, durationSeconds: restSeconds });
      }
    },
    [session, writeQueue]
  );

  const handleWeightChange = useCallback(
    (exercise: WorkoutSession["exercises"][0], weight: string) => {
      if (!session) return;
      writeQueue.enqueue({ row: exercise.sheet_row, col: 3, value: weight });
    },
    [session, writeQueue]
  );

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

  if (isLoading) return <div className="text-center py-8 text-gray-400">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-400">Error loading workout</div>;
  if (!session) return null;

  return (
    <div>
      {/* Type selector */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => { writeQueue.flush(); setRestTimer(null); setSelectedType(t); setWorkoutStart(Date.now()); }}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-target transition-all duration-200 ${
              selectedType === t
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-gray-800 text-gray-400 ring-1 ring-gray-700/50"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Workout info */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-500">
          {session.day} {session.date && `— ${session.date}`}
        </div>
        {workoutStart !== null && (
          <div className="text-sm font-mono text-blue-400 bg-blue-950/50 px-2 py-0.5 rounded-md">
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
          </div>
        )}
        <div className="text-xs text-gray-600">{session.tab_name}</div>
      </div>

      {/* Progress bar */}
      {totalSets > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${barColorClass} ${
                progressPct >= 90 ? "progress-glow" : ""
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={`text-xs tabular-nums ${progressPct >= 100 ? "text-green-400" : "text-gray-500"}`}>
            {doneSets}/{totalSets}
          </span>
        </div>
      )}

      {/* Rest timer */}
      {restTimer && (
        <RestTimer
          exerciseName={restTimer.exerciseName}
          durationSeconds={restTimer.durationSeconds}
          onDismiss={() => setRestTimer(null)}
        />
      )}

      {/* Exercise cards */}
      {groupExercises(session.exercises).map((group) => (
        <div key={group.groupId} className={group.isSuperset ? "border-l-2 border-blue-500/70 pl-3 mb-3" : ""}>
          {group.isSuperset && (
            <div className="text-xs font-semibold text-blue-400 mb-1">Superset</div>
          )}
          {group.exercises.map((ex, i) => (
            <ExerciseCard
              key={`${session.tab_name}-${group.groupId}-${i}`}
              exercise={ex}
              onSetComplete={(setIdx, reps) => handleSetComplete(ex, setIdx, reps)}
              onWeightChange={(w) => handleWeightChange(ex, w)}
              onProgressChange={(done, total) =>
                handleProgressChange(`${group.groupId}-${i}`, done, total)
              }
              className={group.isSuperset ? "mb-1" : "mb-3"}
            />
          ))}
        </div>
      ))}

      {/* Complete workout button */}
      <button
        onClick={() => setConfirmVisible(true)}
        disabled={completeMutation.isPending}
        className="w-full mt-4 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg touch-target disabled:opacity-50 shadow-lg shadow-green-700/25 active:scale-[0.98] transition-all duration-200"
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
    </div>
  );
}
