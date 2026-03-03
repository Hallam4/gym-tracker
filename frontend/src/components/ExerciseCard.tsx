import { useState, useCallback, useEffect } from "react";
import { Exercise } from "../api/gym";

interface Props {
  exercise: Exercise;
  onSetComplete: (setIndex: number, reps: number) => void;
  onWeightChange: (weight: string) => void;
  onProgressChange?: (done: number, total: number) => void;
  className?: string;
}

export default function ExerciseCard({
  exercise,
  onSetComplete,
  onWeightChange,
  onProgressChange,
  className = "mb-3",
}: Props) {
  const [localWeight, setLocalWeight] = useState(exercise.weight);
  const [completedSets, setCompletedSets] = useState<(number | null)[]>(
    exercise.set_results.map((s) => (s ? parseInt(s) || null : null))
  );

  const totalSets = parseInt(exercise.sets) || 3;
  const targetReps = parseInt(exercise.reps) || 10;

  const doneCount = completedSets.filter((s) => s !== null).length;

  useEffect(() => {
    onProgressChange?.(doneCount, totalSets);
  }, [doneCount, totalSets, onProgressChange]);

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
      if (newSets[setIndex] !== null) {
        // Already done — toggle off
        newSets[setIndex] = null;
      } else {
        newSets[setIndex] = targetReps;
        onSetComplete(setIndex, targetReps);
      }
      setCompletedSets(newSets);
    },
    [completedSets, targetReps, onSetComplete]
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

  return (
    <div className={`bg-gray-900 rounded-lg p-4 ${className}`}>
      {/* Exercise header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-medium text-white">{exercise.name}</div>
          <div className="text-sm text-gray-500">
            {exercise.sets} x {exercise.reps}
            {exercise.target && ` — ${exercise.target}`}
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {doneCount}/{totalSets}
        </div>
      </div>

      {/* Weight adjuster */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => adjustWeight(-2.5)}
          className="w-12 h-12 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center"
        >
          -
        </button>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{localWeight}</div>
          <div className="text-xs text-gray-500">kg</div>
        </div>
        <button
          onClick={() => adjustWeight(2.5)}
          className="w-12 h-12 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center"
        >
          +
        </button>
      </div>

      {/* Set buttons */}
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: totalSets }, (_, i) => {
          const isDone = completedSets[i] !== null;
          const reps = completedSets[i];
          return (
            <div key={i} className="text-center">
              <button
                onClick={() => handleSetTap(i)}
                className={`w-full h-12 rounded-lg font-bold text-lg touch-target ${
                  isDone
                    ? "bg-green-700 text-white"
                    : "bg-gray-800 text-gray-400"
                }`}
              >
                {isDone ? reps : `S${i + 1}`}
              </button>
              {isDone && (
                <div className="flex justify-center gap-1 mt-1">
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

      {/* Notes */}
      {exercise.notes && (
        <div className="text-sm text-gray-500 mt-3 italic">{exercise.notes}</div>
      )}
    </div>
  );
}
