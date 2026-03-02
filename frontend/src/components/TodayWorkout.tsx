import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, WorkoutSession } from "../api/gym";
import ExerciseCard from "./ExerciseCard";
import RestTimer from "./RestTimer";

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
  const [restVisible, setRestVisible] = useState(false);
  const [restSeconds, setRestSeconds] = useState(90);
  const queryClient = useQueryClient();

  const { data: session, isLoading, error } = useQuery({
    queryKey: ["workout-type", selectedType],
    queryFn: () => api.getWorkoutByType(selectedType),
  });

  const logMutation = useMutation({
    mutationFn: (vars: { tabName: string; updates: { row: number; col: number; value: string }[] }) =>
      api.logWorkout(vars.tabName, vars.updates),
    onError: (_err, vars) => {
      const pending = loadPendingWrites();
      pending.push(vars);
      savePendingWrites(pending);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (tabName: string) => api.completeWorkout(tabName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-type", selectedType] });
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
      logMutation.mutate({
        tabName: session.tab_name,
        updates: [{ row: exercise.sheet_row, col: setCol, value: reps.toString() }],
      });
    },
    [session, logMutation]
  );

  const handleWeightChange = useCallback(
    (exercise: WorkoutSession["exercises"][0], weight: string) => {
      if (!session) return;
      logMutation.mutate({
        tabName: session.tab_name,
        updates: [{ row: exercise.sheet_row, col: 3, value: weight }],
      });
    },
    [session, logMutation]
  );

  const handleStartRest = useCallback(
    (exercise: WorkoutSession["exercises"][0], restIndex: number) => {
      const restStr = exercise.rest_times[restIndex];
      const parsedRest = parseInt(restStr);
      setRestSeconds(parsedRest > 0 ? parsedRest : 90);
      setRestVisible(true);
    },
    []
  );

  const handleRestComplete = useCallback((_elapsed: number) => {
    setRestVisible(false);
  }, []);

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
            onClick={() => setSelectedType(t)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap touch-target ${
              selectedType === t
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Workout info */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-500">
          {session.day} {session.date && `— ${session.date}`}
        </div>
        <div className="text-xs text-gray-600">{session.tab_name}</div>
      </div>

      {/* Exercise cards */}
      {session.exercises.map((ex, i) => (
        <ExerciseCard
          key={`${session.tab_name}-${i}`}
          exercise={ex}
          onSetComplete={(setIdx, reps) => handleSetComplete(ex, setIdx, reps)}
          onWeightChange={(w) => handleWeightChange(ex, w)}
          onStartRest={(restIdx) => handleStartRest(ex, restIdx)}
        />
      ))}

      {/* Complete workout button */}
      <button
        onClick={() => completeMutation.mutate(session.tab_name)}
        disabled={completeMutation.isPending}
        className="w-full mt-4 py-4 bg-green-700 text-white rounded-lg font-bold text-lg touch-target disabled:opacity-50"
      >
        {completeMutation.isPending
          ? "Saving..."
          : completeMutation.isSuccess
            ? "Saved!"
            : "Complete Workout"}
      </button>

      <RestTimer
        defaultSeconds={restSeconds}
        onTimerComplete={handleRestComplete}
        onDismiss={() => setRestVisible(false)}
        visible={restVisible}
      />
    </div>
  );
}
