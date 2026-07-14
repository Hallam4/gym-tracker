import { PrehabExercise } from "../data/prehabData";
import { ExerciseEntry } from "../lib/prehabSession";
import SetButtonGrid from "./SetButtonGrid";
import WeightAdjuster from "./WeightAdjuster";

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
        <WeightAdjuster weight={weight} step={exercise.weightStep ?? 2.5} onWeightChange={onWeightChange} />
      )}

      {/* Set buttons */}
      <SetButtonGrid sets={exercise.sets} setsDone={setsDone} label={exercise.name} onSetsDone={onSetsDone} />
    </div>
  );
}
