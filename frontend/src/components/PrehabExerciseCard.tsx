import { PrehabExercise } from "../data/prehabData";
import { ExerciseEntry } from "../lib/prehabSession";

interface Props {
  exercise: PrehabExercise;
  entry?: ExerciseEntry;
  onSetsDone: (setsDone: number) => void;
  onWeightChange: (weight: string) => void;
}

export default function PrehabExerciseCard({ exercise, entry, onSetsDone, onWeightChange }: Props) {
  const setsDone = entry?.setsDone ?? 0;
  const weight = entry?.weight ?? "";
  const allDone = setsDone >= exercise.sets;
  const step = exercise.weightStep ?? 2.5;

  // Tapping set i: if it's already filled, undo down to i; else fill up to i+1.
  const tapSet = (i: number) => {
    onSetsDone(i < setsDone ? i : i + 1);
  };

  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight) || 0;
    onWeightChange(String(Math.max(0, current + delta)));
  };

  return (
    <div className={`bg-gray-900 rounded-2xl py-4 px-4 ring-1 mb-2.5 ${allDone ? "ring-green-800/50" : "ring-gray-800/60"}`}>
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{exercise.name}</span>
            <span className={`shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded-md ml-auto ${allDone ? "bg-green-900/50 text-green-400" : "bg-gray-800/70 text-gray-400"}`}>
              {allDone && <span className="mr-0.5" aria-hidden="true">&#10003;</span>}
              {setsDone}/{exercise.sets}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{exercise.prescription}</span>
            {exercise.tags.map((t) => (
              <span key={t} className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{t}</span>
            ))}
            {exercise.note && (
              <span className="text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded">{exercise.note}</span>
            )}
          </div>
        </div>
      </div>

      {/* Weight adjuster (loaded only) */}
      {exercise.kind === "loaded" && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => adjustWeight(-step)}
            aria-label={`Decrease weight by ${step}kg`}
            className="w-11 h-11 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 active:scale-90 transition-all duration-150"
          >
            −
          </button>
          <div className="text-center min-w-[72px]">
            <div className="text-2xl font-bold text-white tabular-nums">{weight === "" ? 0 : weight} <span className="text-sm font-normal text-gray-300">kg</span></div>
          </div>
          <button
            onClick={() => adjustWeight(step)}
            aria-label={`Increase weight by ${step}kg`}
            className="w-11 h-11 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 active:scale-90 transition-all duration-150"
          >
            +
          </button>
        </div>
      )}

      {/* Set buttons */}
      <div className={`grid gap-2.5 mt-3`} style={{ gridTemplateColumns: `repeat(${Math.min(exercise.sets, 5)}, minmax(0, 1fr))` }} role="group" aria-label={`Sets for ${exercise.name}`}>
        {Array.from({ length: exercise.sets }, (_, i) => {
          const done = i < setsDone;
          return (
            <button
              key={i}
              onClick={() => tapSet(i)}
              aria-label={done ? `Set ${i + 1} done. Tap to undo.` : `Log set ${i + 1}.`}
              className={`h-11 rounded-lg font-bold text-base touch-target transition-all duration-150 active:scale-95 ${done ? "bg-green-700 text-white" : "bg-gray-800 text-gray-400"}`}
            >
              {done ? <span aria-hidden="true">&#10003;</span> : `S${i + 1}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
