import { PrehabExercise } from "../data/prehabData";
import { ExerciseEntry, clampLevel } from "../lib/prehabSession";
import SetButtonGrid from "./SetButtonGrid";
import WeightAdjuster from "./WeightAdjuster";

interface Props {
  exercise: PrehabExercise;   // must have .levels
  level: number;              // current 1-based level
  entry?: ExerciseEntry;
  onLevelChange: (level: number) => void;
  onSetsDone: (setsDone: number) => void;
  onWeightChange: (weight: string) => void;
}

export default function PrehabProgressionCard({ exercise, level, entry, onLevelChange, onSetsDone, onWeightChange }: Props) {
  const levels = exercise.levels ?? [];
  const count = levels.length;
  const cur = clampLevel(level, count);
  const lvl = levels[cur - 1];

  const setsDone = entry?.setsDone ?? 0;
  const weight = entry?.weight ?? "";
  const allDone = setsDone >= lvl.sets;

  return (
    <div className={`bg-gray-900 rounded-2xl py-4 px-4 ring-1 mb-2.5 ${allDone ? "ring-green-800/50" : "ring-gray-800/60"}`}>
      {/* Header: name + note + done badge */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-white truncate">{exercise.name}</span>
        {exercise.note && (
          <span className="text-xs bg-amber-900/40 text-amber-300 px-1.5 py-0.5 rounded shrink-0">{exercise.note}</span>
        )}
        <span className={`shrink-0 text-xs tabular-nums px-1.5 py-0.5 rounded-md ml-auto ${allDone ? "bg-green-900/50 text-green-400" : "bg-gray-800/70 text-gray-400"}`}>
          {allDone && <span className="mr-0.5" aria-hidden="true">&#10003;</span>}
          {setsDone}/{lvl.sets}
        </span>
      </div>

      {/* Level stepper */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => onLevelChange(clampLevel(cur - 1, count))}
          disabled={cur <= 1}
          aria-label="Previous level"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9664;</span>
        </button>
        <div className="flex-1 text-center min-w-0">
          <div className="text-xs text-gray-500">Level {cur} of {count}</div>
          <div className="text-sm font-semibold text-white truncate">{lvl.name}</div>
        </div>
        <button
          onClick={() => onLevelChange(clampLevel(cur + 1, count))}
          disabled={cur >= count}
          aria-label="Next level"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9654;</span>
        </button>
      </div>

      {/* Ladder */}
      <div className="flex items-center gap-1 mt-3" aria-hidden="true">
        {levels.map((l) => {
          const cls = l.level === cur ? "bg-emerald-500" : l.level < cur ? "bg-emerald-800" : "bg-gray-800";
          return <div key={l.level} className={`flex-1 h-1.5 rounded-full ${cls}`} />;
        })}
      </div>

      {/* Prescription + tags */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{lvl.prescription}</span>
        {lvl.tags.map((t) => (
          <span key={t} className="text-xs bg-gray-800/70 text-gray-300 px-1.5 py-0.5 rounded">{t}</span>
        ))}
      </div>

      {/* Action / Purpose / Goal */}
      <div className="mt-3 space-y-1 text-xs leading-relaxed">
        <p className="text-gray-300"><span className="text-gray-500">Action: </span>{lvl.action}</p>
        <p className="text-gray-300"><span className="text-gray-500">Purpose: </span>{lvl.purpose}</p>
        <p className="text-emerald-300"><span className="text-gray-500">Goal: </span>{lvl.goal}</p>
      </div>

      {/* Weight adjuster (loaded level only) + set buttons — shared components */}
      {lvl.kind === "loaded" && (
        <WeightAdjuster weight={weight} step={lvl.weightStep ?? 2.5} onWeightChange={onWeightChange} />
      )}
      <SetButtonGrid sets={lvl.sets} setsDone={setsDone} label={lvl.name} onSetsDone={onSetsDone} />
    </div>
  );
}
