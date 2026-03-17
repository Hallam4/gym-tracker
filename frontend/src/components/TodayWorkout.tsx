import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, WorkoutSession, WorkoutSummaryResponse, CompletedExercise } from "../api/gym";
import ExerciseCard from "./ExerciseCard";
import { groupExercises } from "../utils/groupExercises";
import { useSessionPersist, SessionState } from "../hooks/useSessionPersist";
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

const MAX_SETS = 5;
const REST_DURATION_S = 240; // 4 minutes

export default function TodayWorkout() {
  const [selectedType, setSelectedType] = useState<string>("U1");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [groupLastSetTime, setGroupLastSetTime] = useState<Map<number, number>>(new Map());
  const [progressMap, setProgressMap] = useState<Map<string, { done: number; total: number }>>(new Map());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [summaryData, setSummaryData] = useState<WorkoutSummaryResponse | null>(null);
  const [skippedExercises, setSkippedExercises] = useState<Set<number>>(new Set());
  const [isDeload, setIsDeload] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [pendingTypeSwitch, setPendingTypeSwitch] = useState<string | null>(null);
  const [resetConfirmVisible, setResetConfirmVisible] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [restTimerEnd, setRestTimerEnd] = useState<number | null>(null);
  const [restCountdown, setRestCountdown] = useState<number | null>(null);
  const [restTimerDone, setRestTimerDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const restDoneTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressFiredRef = useRef(false);
  const queryClient = useQueryClient();

  // Session state stored in localStorage
  const [sessionState, setSessionState] = useState<SessionState>({
    setResults: {},
    weights: {},
    notes: {},
    setTimes: {},
    timerSeconds: 0,
    timerRunning: false,
  });
  const { loadState, saveState, clearState } = useSessionPersist(selectedType);
  const initializedRef = useRef(false);

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

  // Keep screen on during active workout
  useEffect(() => {
    if (!timerRunning) return;
    let wakeLock: WakeLockSentinel | null = null;

    const request = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch { /* low battery or unsupported — ignore */ }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") request();
    };

    request();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      wakeLock?.release();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [timerRunning]);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimerEnd) {
      setRestCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restTimerEnd - Date.now()) / 1000));
      setRestCountdown(remaining);
      if (remaining <= 0 && !restTimerDone) {
        setRestTimerDone(true);
        try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch {}
        try {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.value = 0.15;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          osc.stop(ctx.currentTime + 0.5);
          setTimeout(() => ctx.close(), 1000);
        } catch {}
        if (restDoneTimerRef.current) clearTimeout(restDoneTimerRef.current);
        restDoneTimerRef.current = setTimeout(() => {
          setRestTimerEnd(null);
          setRestCountdown(null);
          setRestTimerDone(false);
        }, 5000);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [restTimerEnd, restTimerDone]);

  // Clean up rest done timer on unmount
  useEffect(() => {
    return () => {
      if (restDoneTimerRef.current) clearTimeout(restDoneTimerRef.current);
    };
  }, []);

  const { data: session, isLoading, error } = useQuery({
    queryKey: ["workout-structure", selectedType],
    queryFn: () => api.getStructure(selectedType),
  });

  // Load persisted session state when type changes
  useEffect(() => {
    const saved = loadState();
    setSessionState(saved);
    setTimerSeconds(saved.timerSeconds);
    setTimerRunning(saved.timerRunning);
    if (saved.restTimerEnd && saved.restTimerEnd > Date.now()) {
      setRestTimerEnd(saved.restTimerEnd);
      setRestTimerDone(false);
    } else {
      setRestTimerEnd(null);
    }
    initializedRef.current = true;
  }, [selectedType, loadState]);

  // Persist session state on changes (debounced via hook)
  useEffect(() => {
    if (!initializedRef.current) return;
    saveState({ ...sessionState, timerSeconds, timerRunning, restTimerEnd });
  }, [sessionState, timerSeconds, timerRunning, restTimerEnd, saveState]);

  // Reset progress map when session changes
  useEffect(() => {
    setProgressMap(new Map());
  }, [selectedType]);

  const completeMutation = useMutation({
    mutationFn: (data: { day: string; exercises: CompletedExercise[]; is_deload: boolean }) =>
      api.completeWorkoutNew(data),
    onSuccess: (data) => {
      setSummaryData(data);
      clearState();
    },
    onError: () => {
      setToast({ message: "Failed to save workout", type: "error" });
    },
  });

  const updateSessionState = useCallback((updater: (prev: SessionState) => SessionState) => {
    setSessionState((prev) => {
      const next = updater(prev);
      return next;
    });
  }, []);

  const switchToType = useCallback((t: string) => {
    setTimerSeconds(0); setTimerRunning(false); setGroupLastSetTime(new Map()); setSkippedExercises(new Set()); setIsDeload(false); setRestTimerEnd(null); setRestCountdown(null); setRestTimerDone(false); setHeaderExpanded(false); setPendingTypeSwitch(null); setSelectedType(t);
  }, []);

  const handleWorkoutReset = useCallback(() => {
    clearState();
    setSessionState({ setResults: {}, weights: {}, notes: {}, setTimes: {}, timerSeconds: 0, timerRunning: false });
    setTimerSeconds(0);
    setTimerRunning(false);
    setGroupLastSetTime(new Map());
    setSkippedExercises(new Set());
    setRestTimerEnd(null);
    setRestCountdown(null);
    setRestTimerDone(false);
    setProgressMap(new Map());
    setExpandedGroups(new Set());
    setIsDeload(false);
    setHeaderExpanded(false);
    setResetConfirmVisible(false);
    setResetKey((k) => k + 1);
    if (restDoneTimerRef.current) clearTimeout(restDoneTimerRef.current);
  }, [clearState]);

  const handleTimerLongPressStart = useCallback(() => {
    longPressFiredRef.current = false;
    longPressRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setRestTimerEnd(null);
      setRestCountdown(null);
      setRestTimerDone(false);
      if (restDoneTimerRef.current) clearTimeout(restDoneTimerRef.current);
      try { navigator.vibrate?.(50); } catch {}
    }, 500);
  }, []);

  const handleTimerLongPressEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  const handleSetComplete = useCallback(
    (exercise: WorkoutSession["exercises"][0], setIndex: number, reps: number) => {
      // Auto-start timer on first set tap
      if (!timerRunning && timerSeconds === 0) setTimerRunning(true);
      updateSessionState((prev) => {
        const results = { ...prev.setResults };
        const exSets = [...(results[exercise.name] || Array.from({ length: MAX_SETS }, () => null))];
        exSets[setIndex] = reps;
        results[exercise.name] = exSets;
        return { ...prev, setResults: results };
      });

      setGroupLastSetTime((prev) => {
        const next = new Map(prev);
        next.set(exercise.superset_group, timerSeconds);
        return next;
      });
      // Start rest timer (superset-aware)
      const groupExs = session?.exercises.filter(
        (ex) => ex.superset_group === exercise.superset_group
      ) ?? [];
      let shouldStartRest = true;
      if (groupExs.length > 1) {
        // Superset: only start rest when all exercises in group have this set done
        shouldStartRest = groupExs.every((ex) => {
          if (ex.name === exercise.name) return true; // just completed now
          const sets = sessionState.setResults[ex.name];
          return sets != null && sets[setIndex] != null;
        });
      }
      if (shouldStartRest) {
        setRestTimerEnd(Date.now() + REST_DURATION_S * 1000);
        setRestTimerDone(false);
        if (restDoneTimerRef.current) clearTimeout(restDoneTimerRef.current);
      }
    },
    [timerSeconds, updateSessionState, session?.exercises, sessionState.setResults]
  );

  const handleSetUndo = useCallback(
    (exercise: WorkoutSession["exercises"][0], setIndex: number) => {
      updateSessionState((prev) => {
        const results = { ...prev.setResults };
        const exSets = [...(results[exercise.name] || Array.from({ length: MAX_SETS }, () => null))];
        exSets[setIndex] = null;
        results[exercise.name] = exSets;
        return { ...prev, setResults: results };
      });
    },
    [updateSessionState]
  );

  const handleWeightChange = useCallback(
    (exercise: WorkoutSession["exercises"][0], weight: string) => {
      updateSessionState((prev) => ({
        ...prev,
        weights: { ...prev.weights, [exercise.name]: weight },
      }));
    },
    [updateSessionState]
  );

  const handleNotesChange = useCallback(
    (exercise: WorkoutSession["exercises"][0], notes: string) => {
      updateSessionState((prev) => ({
        ...prev,
        notes: { ...prev.notes, [exercise.name]: notes },
      }));
    },
    [updateSessionState]
  );

  const handleSetTimeCapture = useCallback(
    (exercise: WorkoutSession["exercises"][0], setIndex: number, time: number | null) => {
      updateSessionState((prev) => {
        const times = { ...prev.setTimes };
        const exTimes = [...(times[exercise.name] || Array.from({ length: MAX_SETS }, () => null))];
        exTimes[setIndex] = time;
        times[exercise.name] = exTimes;
        return { ...prev, setTimes: times };
      });
    },
    [updateSessionState]
  );

  const handleSkipToggle = useCallback(
    (exercise: WorkoutSession["exercises"][0]) => {
      setSkippedExercises((prev) => {
        const next = new Set(prev);
        if (next.has(exercise.sheet_row)) {
          next.delete(exercise.sheet_row);
        } else {
          next.add(exercise.sheet_row);
          // Clear set results and times for this exercise
          updateSessionState((prev) => {
            const results = { ...prev.setResults };
            const times = { ...prev.setTimes };
            delete results[exercise.name];
            delete times[exercise.name];
            return { ...prev, setResults: results, setTimes: times };
          });
        }
        return next;
      });
    },
    [updateSessionState]
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

  // Build exercises with merged local state for rendering
  const mergedExercises = session?.exercises.map((ex) => {
    const savedSets = sessionState.setResults[ex.name];
    const savedWeight = sessionState.weights[ex.name];
    const savedNotes = sessionState.notes[ex.name];
    return {
      ...ex,
      set_results: savedSets
        ? savedSets.map((s) => (s !== null ? String(s) : ""))
        : ex.set_results.length > 0 ? ex.set_results : Array.from({ length: MAX_SETS }, () => ""),
      weight: savedWeight ?? ex.weight,
      notes: savedNotes ?? ex.notes,
    };
  }) ?? [];

  // Aggregate progress
  let totalSets = 0;
  let doneSets = 0;
  for (const { done, total } of progressMap.values()) {
    totalSets += total;
    doneSets += done;
  }
  const progressPct = totalSets > 0 ? Math.min(100, (doneSets / totalSets) * 100) : 0;

  let barColorClass: string;
  if (progressPct >= 90) {
    barColorClass = "bg-gradient-to-r from-green-500 to-emerald-400";
  } else if (progressPct >= 50) {
    barColorClass = "bg-gradient-to-r from-green-600 to-green-500";
  } else {
    barColorClass = "bg-green-600";
  }

  const exerciseCount = session?.exercises.length ?? 0;
  const skippedCount = skippedExercises.size;

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
        onClick={() => queryClient.invalidateQueries({ queryKey: ["workout-structure", selectedType] })}
        className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm touch-target hover:bg-gray-700 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        Retry
      </button>
    </div>
  );
  if (!session) return null;

  return (
    <div>
      {/* Header: type selector + workout info + deload — collapses once workout starts */}
      {(() => {
        const workoutStarted = timerRunning || timerSeconds > 0 || doneSets > 0;
        if (!workoutStarted || headerExpanded) {
          return (
            <>
              <div className="flex gap-2 overflow-x-auto pb-3 mb-3" role="group" aria-label="Workout type">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { if (t === selectedType) return; if (workoutStarted) { setPendingTypeSwitch(t); } else { switchToType(t); } }}
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
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-300">
                  {session.day} {session.date && `\u2014 ${fmtDate(session.date)}`}
                </div>
                {workoutStarted && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResetConfirmVisible(true)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setHeaderExpanded(false)}
                      className="text-xs text-gray-500 hover:text-gray-400 px-2 py-1"
                    >
                      Collapse
                    </button>
                  </div>
                )}
              </div>
            </>
          );
        }
        return (
          <button
            onClick={() => setHeaderExpanded(true)}
            className="w-full flex items-center justify-center gap-2 mb-3 py-1.5 rounded-full bg-gray-800/50 ring-1 ring-gray-700/40 active:scale-[0.98] transition-all duration-150"
            aria-label="Expand workout type selector"
          >
            <span className="text-sm font-medium text-blue-400">{TYPE_LABELS[selectedType]}</span>
            {isDeload && <span className="text-xs text-amber-400">Deload</span>}
          </button>
        );
      })()}

      {/* Unified timer display — long-press to reset rest timer */}
      <div className="flex items-center justify-center mb-4">
        <button
          onClick={() => { if (!longPressFiredRef.current) setTimerRunning((r) => !r); }}
          onTouchStart={handleTimerLongPressStart}
          onTouchEnd={handleTimerLongPressEnd}
          onMouseDown={handleTimerLongPressStart}
          onMouseUp={handleTimerLongPressEnd}
          onMouseLeave={handleTimerLongPressEnd}
          aria-label={restTimerEnd
            ? (restTimerDone ? "Rest complete. Long-press to dismiss." : `Rest: ${restCountdown} seconds. Tap to ${timerRunning ? "pause" : "resume"} stopwatch. Long-press to reset rest timer.`)
            : (timerRunning ? "Pause stopwatch" : "Start stopwatch")}
          className={`bg-gray-800/70 rounded-xl px-6 py-3 touch-target hover:bg-gray-700/70 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
            restTimerDone ? "bg-green-600/20 rest-done-flash" : ""
          }`}
          role="timer"
        >
          {restTimerEnd ? (
            <div className="text-center">
              {restTimerDone ? (
                <div className="text-2xl font-bold text-green-400" aria-live="assertive">GO</div>
              ) : (
                <div className="text-2xl font-mono font-bold text-white tabular-nums" aria-live="assertive">
                  {Math.floor((restCountdown ?? 0) / 60)}:{((restCountdown ?? 0) % 60).toString().padStart(2, "0")}
                </div>
              )}
              <div className="text-xs font-mono text-gray-300 mt-1" aria-live="off">
                {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
              </div>
            </div>
          ) : (
            <span className="text-xl font-mono text-white tabular-nums" aria-live="off">
              {Math.floor(timerSeconds / 60)}:{(timerSeconds % 60).toString().padStart(2, "0")}
            </span>
          )}
        </button>
      </div>

      {/* Deload toggle — hidden when header is collapsed */}
      {(!timerRunning && timerSeconds === 0 && doneSets === 0) || headerExpanded ? (
        <div className="flex justify-center mb-4">
          <button
            onClick={() => setIsDeload((d) => !d)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
              isDeload
                ? "bg-amber-900/60 text-amber-300 ring-1 ring-amber-700/60"
                : "bg-gray-800/50 text-gray-500 ring-1 ring-gray-700/40 hover:text-gray-400"
            }`}
            aria-pressed={isDeload}
          >
            {isDeload ? "Deload Active" : "Deload"}
          </button>
        </div>
      ) : null}

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
          <span className={`text-xs tabular-nums ${progressPct >= 100 ? "text-green-400" : "text-gray-300"}`} aria-hidden="true">
            {doneSets}/{totalSets}
          </span>
        </div>
      )}

      {/* Exercise cards */}
      <section aria-label="Exercises">
        {groupExercises(mergedExercises).map((group) => (
          <div key={group.groupId} className={group.isSuperset ? "border-l-2 border-blue-500/70 pl-3 mb-3" : ""}>
            {group.isSuperset && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-blue-400">Superset</span>
                <span className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">
                  {group.exercises[0].sets} sets
                </span>
              </div>
            )}
            {group.exercises.map((ex, i) => (
              <ExerciseCard
                key={`${selectedType}-${resetKey}-${group.groupId}-${i}`}
                exercise={ex}
                timerSeconds={timerSeconds}
                lastGroupSetTime={groupLastSetTime.get(ex.superset_group) ?? null}
                onSetComplete={(setIdx, reps) => handleSetComplete(ex, setIdx, reps)}
                onSetUndo={(setIdx) => handleSetUndo(ex, setIdx)}
                onSetTimeCapture={(setIdx, time) => handleSetTimeCapture(ex, setIdx, time)}
                initialSetTimes={sessionState.setTimes[ex.name]}
                onWeightChange={(w) => handleWeightChange(ex, w)}
                onNotesChange={(notes) => handleNotesChange(ex, notes)}
                onProgressChange={(done, total) =>
                  handleProgressChange(`${group.groupId}-${i}`, done, total)
                }
                isDeload={isDeload}
                isSkipped={skippedExercises.has(ex.sheet_row)}
                onSkipToggle={() => handleSkipToggle(ex)}
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

      {/* Reset workout confirmation */}
      {resetConfirmVisible && (
        <ConfirmModal
          title="Reset workout?"
          summary="This will clear all logged sets, weights, notes, and the timer for this session. This cannot be undone."
          onCancel={() => setResetConfirmVisible(false)}
          onConfirm={handleWorkoutReset}
        />
      )}

      {/* Type switch confirmation */}
      {pendingTypeSwitch && (
        <ConfirmModal
          title={`Switch to ${TYPE_LABELS[pendingTypeSwitch]}?`}
          summary="Your current workout timer will reset. Logged sets are saved and will restore if you switch back."
          onCancel={() => setPendingTypeSwitch(null)}
          onConfirm={() => switchToType(pendingTypeSwitch)}
        />
      )}

      {/* Confirm modal */}
      {confirmVisible && (
        <ConfirmModal
          title="Complete workout?"
          summary={`${isDeload ? "Deload workout: " : ""}${exerciseCount} exercises${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}, ${doneSets}/${totalSets} sets completed`}
          onCancel={() => setConfirmVisible(false)}
          onConfirm={() => {
            setConfirmVisible(false);
            // Build CompletedExercise[] from current state
            const completed: CompletedExercise[] = mergedExercises
              .filter((ex) => !skippedExercises.has(ex.sheet_row))
              .map((ex) => ({
                name: ex.name,
                weight: ex.weight,
                sets: ex.sets,
                reps: ex.reps,
                target: ex.target,
                set_results: ex.set_results,
                rest_times: (sessionState.setTimes[ex.name] || [])
                  .slice(0, 4)
                  .map((t) => (t !== null ? String(t) : "")),
                notes: ex.notes,
              }));
            completeMutation.mutate({
              day: session.day,
              exercises: completed,
              is_deload: isDeload,
            });
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
          setTimesMap={sessionState.setTimes}
          onDismiss={() => {
            setSummaryData(null);
            queryClient.invalidateQueries({ queryKey: ["workout-structure", selectedType] });
            queryClient.invalidateQueries({ queryKey: ["streaks"] });
            queryClient.invalidateQueries({ queryKey: ["prs"] });
            queryClient.invalidateQueries({ queryKey: ["history-sessions"] });
            setToast({ message: "Workout saved!", type: "success" });
            setTimerSeconds(0);
            setTimerRunning(false);
                       setGroupLastSetTime(new Map());
            setSkippedExercises(new Set());
            setIsDeload(false);
            setRestTimerEnd(null);
            setRestCountdown(null);
            setRestTimerDone(false);
          }}
        />
      )}
    </div>
  );
}
