import { useState, useCallback, useEffect, useRef } from "react";
import { Exercise } from "../api/gym";

const MAX_SETS = 5;

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

interface Props {
  exercise: Exercise;
  timerSeconds: number;
  lastGroupSetTime: number | null;
  onSetComplete: (setIndex: number, reps: number) => void;
  onWeightChange: (weight: string) => void;
  onNotesChange?: (notes: string) => void;
  onProgressChange?: (done: number, total: number) => void;
  hideSetInfo?: boolean;
  className?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export default function ExerciseCard({
  exercise,
  timerSeconds,
  lastGroupSetTime,
  onSetComplete,
  onWeightChange,
  onNotesChange,
  onProgressChange,
  hideSetInfo,
  className = "mb-3",
  expanded: controlledExpanded,
  onToggleExpand,
}: Props) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const isExpanded = controlledExpanded ?? localExpanded;
  const toggleExpand = onToggleExpand ?? (() => setLocalExpanded((e) => !e));
  const [localWeight, setLocalWeight] = useState(exercise.suggested_weight ?? exercise.weight);
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
  const targetReps = parseInt(exercise.suggested_target ?? "") || parseInt(exercise.target) || parseInt(exercise.reps) || 10;

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
      const newTimes = [...setTimes];
      newTimes[setIndex] = timerSeconds;
      setSetTimes(newTimes);
      onSetComplete(setIndex, newReps);
    },
    [completedSets, setTimes, targetReps, timerSeconds, onSetComplete]
  );

  const handleNotesChange = useCallback(
    (value: string) => {
      setLocalNotes(value);
      onNotesChange?.(value);
    },
    [onNotesChange]
  );

  return (
    <div className={`bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 ${className}`}>
      {/* Exercise header */}
      <button
        type="button"
        className="flex items-center justify-between w-full cursor-pointer select-none text-left min-h-[44px] active:opacity-80 transition-opacity duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        onClick={toggleExpand}
        aria-expanded={isExpanded}
        aria-controls={`exercise-details-${exercise.sheet_row}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-gray-400 text-sm transition-transform duration-200 shrink-0 ${
              isExpanded ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            &#9656;
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">{exercise.name}</span>
              <div className={`shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded-md ${
                allDone
                  ? "bg-green-900/50 text-green-400"
                  : "bg-gray-800/70 text-gray-400"
              }`}>
                {allDone && <span className="mr-0.5" aria-hidden="true">&#10003;</span>}
                <span className="sr-only">{normalDone} of {totalSets} sets completed{bonusDone > 0 ? `, plus ${bonusDone} bonus` : ""}</span>
                <span aria-hidden="true">
                  {normalDone}/{totalSets}
                  {bonusDone > 0 && (
                    <span className="text-blue-400"> +{bonusDone}</span>
                  )}
                </span>
              </div>
              {lastGroupSetTime != null && (
                <span className="shrink-0 text-[10px] font-mono text-gray-400" aria-label={`Last set at ${fmtTime(lastGroupSetTime)}`}>
                  {fmtTime(lastGroupSetTime)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {!hideSetInfo && (
                <span className="text-xs bg-gray-800/70 text-gray-400 px-1.5 py-0.5 rounded">
                  {exercise.sets} sets
                </span>
              )}
              <span className="text-xs bg-gray-800/70 text-gray-400 px-1.5 py-0.5 rounded">
                {exercise.reps} reps
              </span>
              {exercise.target && (
                <span className="text-xs bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">
                  Target {targetReps} @ {localWeight}kg
                </span>
              )}
              {exercise.sessions_at_ceiling != null && exercise.sessions_at_ceiling > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  exercise.sessions_at_ceiling >= 2
                    ? "bg-green-900/40 text-green-400"
                    : "bg-yellow-900/40 text-yellow-400"
                }`}>
                  {exercise.sessions_at_ceiling}/2
                </span>
              )}
            </div>
            {exercise.prev_sets && exercise.prev_sets.length > 0 && (
              <div className="text-[10px] text-gray-500 mt-0.5">
                Last: {exercise.prev_sets.join(", ")}
                {exercise.prev_weight != null && ` @ ${exercise.prev_weight}kg`}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* Expand/collapse with CSS grid animation */}
      <div
        id={`exercise-details-${exercise.sheet_row}`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          isExpanded ? "grid-rows-expand" : "grid-rows-collapse"
        }`}
      >
        <div className="grid-expand-inner">
          {/* Weight adjuster */}
          <fieldset className="flex items-center justify-center gap-4 mb-4 mt-3 border-0 p-0 m-0">
            <legend className="sr-only">Weight for {exercise.name}</legend>
            <button
              onClick={() => adjustWeight(-2.5)}
              aria-label={`Decrease weight by 2.5kg for ${exercise.name}`}
              className="w-12 h-12 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-all duration-150 ring-1 ring-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              -
            </button>
            <div className="text-center" aria-live="polite">
              <div className="text-2xl font-bold text-white">{localWeight}</div>
              <div className="text-xs text-gray-400">kg</div>
            </div>
            <button
              onClick={() => adjustWeight(2.5)}
              aria-label={`Increase weight by 2.5kg for ${exercise.name}`}
              className="w-12 h-12 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center hover:bg-gray-700 active:scale-90 transition-all duration-150 ring-1 ring-gray-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              +
            </button>
          </fieldset>

          {/* Set buttons */}
          <div className="grid grid-cols-5 gap-2.5" role="group" aria-label={`Sets for ${exercise.name}`}>
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
                btnClass = "bg-gray-800/50 text-gray-500 border border-dashed border-gray-700";
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

              const ariaLabel = isDone
                ? `Set ${i + 1}: ${reps} reps completed. Tap to undo.`
                : isBonus
                  ? `Bonus set ${i + 1 - totalSets}. Tap to log.`
                  : `Set ${i + 1}. Tap to log ${targetReps} reps.`;

              return (
                <div key={i} className="text-center">
                  <button
                    onClick={() => handleSetTap(i)}
                    aria-label={ariaLabel}
                    className={`set-btn w-full h-12 rounded-lg font-bold text-lg touch-target transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${btnClass} ${
                      justCompleted === i ? "animate-pop" : ""
                    }`}
                  >
                    {label}
                  </button>
                  {isDone && setTimes[i] != null && (
                    <div className="text-[10px] font-mono text-gray-400 mt-0.5" aria-hidden="true">
                      {fmtTime(setTimes[i]!)}
                    </div>
                  )}
                  {isDone && (
                    <div className="flex justify-center gap-1 mt-0.5">
                      <button
                        onClick={() => handleRepsAdjust(i, -1)}
                        aria-label={`Decrease reps for set ${i + 1}`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-800 active:bg-gray-700 active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        -
                      </button>
                      <button
                        onClick={() => handleRepsAdjust(i, 1)}
                        aria-label={`Increase reps for set ${i + 1}`}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-sm font-medium text-gray-400 rounded-lg hover:bg-gray-800 active:bg-gray-700 active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Notes -- editable textarea */}
          <label className="sr-only" htmlFor={`notes-${exercise.sheet_row}`}>
            Notes for {exercise.name}
          </label>
          <textarea
            id={`notes-${exercise.sheet_row}`}
            value={localNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Notes..."
            rows={1}
            className="w-full mt-3 bg-gray-800/50 text-sm text-gray-300 placeholder:text-gray-500 rounded-lg px-3 py-2.5 resize-y min-h-[44px] max-h-32 ring-1 ring-gray-700/50 focus-visible:ring-blue-500/70 focus-visible:outline-none transition-shadow duration-200"
          />
        </div>
      </div>
    </div>
  );
}
