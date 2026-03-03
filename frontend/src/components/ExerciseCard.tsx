import { useState, useCallback, useEffect, useRef } from "react";
import { Exercise } from "../api/gym";

const MAX_SETS = 5;

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

interface Props {
  exercise: Exercise;
  timerSeconds: number;
  onSetComplete: (setIndex: number, reps: number) => void;
  onWeightChange: (weight: string) => void;
  onNotesChange?: (notes: string) => void;
  onProgressChange?: (done: number, total: number) => void;
  hideSetInfo?: boolean;
  className?: string;
}

export default function ExerciseCard({
  exercise,
  timerSeconds,
  onSetComplete,
  onWeightChange,
  onNotesChange,
  onProgressChange,
  hideSetInfo,
  className = "mb-3",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [localWeight, setLocalWeight] = useState(exercise.weight);
  const [localNotes, setLocalNotes] = useState(exercise.notes);
  const [completedSets, setCompletedSets] = useState<(number | null)[]>(() => {
    const parsed = exercise.set_results.map((s) => (s ? parseInt(s) || null : null));
    while (parsed.length < MAX_SETS) parsed.push(null);
    return parsed;
  });
  const [setTimes, setSetTimes] = useState<(number | null)[]>(() =>
    Array.from({ length: MAX_SETS }, () => null)
  );
  const [justCompleted, setJustCompleted] = useState<number | null>(null);
  const popTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const totalSets = parseInt(exercise.sets) || 3;
  const targetReps = parseInt(exercise.target) || parseInt(exercise.reps) || 10;

  const normalDone = completedSets.slice(0, totalSets).filter((s) => s !== null).length;
  const bonusDone = completedSets.slice(totalSets).filter((s) => s !== null).length;
  const allDone = normalDone === totalSets;

  useEffect(() => {
    onProgressChange?.(normalDone, totalSets);
  }, [normalDone, totalSets, onProgressChange]);

  useEffect(() => {
    return () => {
      if (popTimerRef.current) clearTimeout(popTimerRef.current);
    };
  }, []);

  const adjustWeight = useCallback(
    (delta: number) => {
      const current = parseFloat(localWeight) || 0;
      const newWeight = Math.max(0, current + delta).toString();
      setLocalWeight(newWeight);
      onWeightChange(newWeight);
    },
    [localWeight, onWeightChange]
  );

  const handleSetTap = useCallback(
    (setIndex: number) => {
      const newSets = [...completedSets];
      const newTimes = [...setTimes];
      if (newSets[setIndex] !== null) {
        newSets[setIndex] = null;
        newTimes[setIndex] = null;
        setJustCompleted(null);
      } else {
        newSets[setIndex] = targetReps;
        newTimes[setIndex] = timerSeconds;
        onSetComplete(setIndex, targetReps);
        setJustCompleted(setIndex);
        if (popTimerRef.current) clearTimeout(popTimerRef.current);
        popTimerRef.current = setTimeout(() => setJustCompleted(null), 300);
      }
      setCompletedSets(newSets);
      setSetTimes(newTimes);
    },
    [completedSets, setTimes, targetReps, timerSeconds, onSetComplete]
  );

  const handleRepsAdjust = useCallback(
    (setIndex: number, delta: number) => {
      const newSets = [...completedSets];
      const current = newSets[setIndex] ?? targetReps;
      const newReps = Math.max(0, current + delta);
      newSets[setIndex] = newReps;
      setCompletedSets(newSets);
      onSetComplete(setIndex, newReps);
    },
    [completedSets, targetReps, onSetComplete]
  );

  const handleNotesChange = useCallback(
    (value: string) => {
      setLocalNotes(value);
      onNotesChange?.(value);
    },
    [onNotesChange]
  );

  return (
    <div className={`bg-gray-900 rounded-xl p-4 ring-1 ring-gray-800/60 ${className}`}>
      {/* Exercise header */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-gray-500 text-sm transition-transform duration-200 shrink-0 ${
              expanded ? "rotate-90" : ""
            }`}
          >
            ▸
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">{exercise.name}</span>
              <div className={`shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded-md ${
                allDone
                  ? "bg-green-900/50 text-green-400"
                  : "bg-gray-800/70 text-gray-500"
              }`}>
                {allDone && <span className="mr-0.5">&#10003;</span>}
                {normalDone}/{totalSets}
                {bonusDone > 0 && (
                  <span className="text-blue-400"> +{bonusDone}</span>
                )}
              </div>
            </div>
            {!hideSetInfo && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="text-xs bg-gray-800/70 text-gray-400 px-1.5 py-0.5 rounded">
                  {exercise.sets} sets
                </span>
                <span className="text-xs bg-gray-800/70 text-gray-400 px-1.5 py-0.5 rounded">
                  {exercise.reps} reps
                </span>
                {exercise.target && (
                  <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">
                    Target {exercise.target} @ {localWeight}kg
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expand/collapse with CSS grid animation */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          expanded ? "grid-rows-expand" : "grid-rows-collapse"
        }`}
      >
        <div className="grid-expand-inner">
          {/* Weight adjuster */}
          <div className="flex items-center justify-center gap-4 mb-4 mt-3">
            <button
              onClick={() => adjustWeight(-2.5)}
              className="w-12 h-12 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center active:scale-90 transition-transform duration-150 ring-1 ring-gray-700/50"
            >
              -
            </button>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{localWeight}</div>
              <div className="text-xs text-gray-500">kg</div>
            </div>
            <button
              onClick={() => adjustWeight(2.5)}
              className="w-12 h-12 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center active:scale-90 transition-transform duration-150 ring-1 ring-gray-700/50"
            >
              +
            </button>
          </div>

          {/* Set buttons */}
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: MAX_SETS }, (_, i) => {
              const isBonus = i >= totalSets;
              const isDone = completedSets[i] !== null;
              const reps = completedSets[i];

              let btnClass: string;
              if (isDone) {
                if (isBonus) {
                  btnClass = "bg-blue-800 text-blue-200";
                } else if (reps! >= targetReps) {
                  btnClass = "bg-green-700 text-white";
                } else {
                  btnClass = "bg-amber-700 text-white";
                }
              } else if (isBonus) {
                btnClass = "bg-gray-800/50 text-gray-600 border border-dashed border-gray-700";
              } else {
                btnClass = "bg-gray-800 text-gray-400";
              }

              let label: React.ReactNode;
              if (isDone) {
                label = reps;
              } else if (isBonus) {
                label = "+";
              } else {
                label = `S${i + 1}`;
              }

              return (
                <div key={i} className="text-center">
                  <button
                    onClick={() => handleSetTap(i)}
                    className={`set-btn w-full h-12 rounded-lg font-bold text-lg touch-target transition-colors duration-200 ${btnClass} ${
                      justCompleted === i ? "animate-pop" : ""
                    }`}
                  >
                    {label}
                  </button>
                  {isDone && setTimes[i] != null && (
                    <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                      {fmtTime(setTimes[i]!)}
                    </div>
                  )}
                  {isDone && (
                    <div className="flex justify-center gap-1">
                      <button
                        onClick={() => handleRepsAdjust(i, -1)}
                        className="text-xs text-gray-500 px-1"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleRepsAdjust(i, 1)}
                        className="text-xs text-gray-500 px-1"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes — editable textarea */}
          <textarea
            value={localNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Notes..."
            rows={1}
            className="w-full mt-3 bg-gray-800/50 text-sm text-gray-300 placeholder:text-gray-600 rounded-lg px-3 py-2 resize-y min-h-[36px] max-h-32 ring-1 ring-gray-700/50 focus:ring-blue-500/70 focus:outline-none transition-shadow"
          />
        </div>
      </div>
    </div>
  );
}
