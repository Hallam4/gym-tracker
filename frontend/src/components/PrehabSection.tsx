import { PrehabSectionDef } from "../data/prehabData";
import { DayState, SectionProgress } from "../lib/prehabSession";
import PrehabExerciseCard from "./PrehabExerciseCard";

interface Props {
  section: PrehabSectionDef;
  day: DayState;
  progress: SectionProgress;
  open: boolean;
  onToggle: () => void;
  onSetsDone: (exId: string, setsDone: number) => void;
  onWeightChange: (exId: string, weight: string) => void;
}

export default function PrehabSection({ section, day, progress, open, onToggle, onSetsDone, onWeightChange }: Props) {
  const complete = progress.done === progress.total;
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-1 py-2 touch-target"
      >
        <span className="flex items-center gap-2 text-[15px] font-bold text-gray-200">
          <span aria-hidden="true">{section.icon}</span>
          {section.label}
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${complete ? "text-green-400" : "text-gray-500"}`}>
            {progress.done}/{progress.total}
          </span>
          <span className={`text-gray-500 text-sm transition-transform duration-200 ${open ? "rotate-90" : ""}`} aria-hidden="true">&#9656;</span>
        </span>
      </button>

      {open && (
        <div className="mt-2">
          {section.exercises.map((ex) => (
            <PrehabExerciseCard
              key={ex.id}
              exercise={ex}
              entry={day.entries[ex.id]}
              onSetsDone={(setsDone) => onSetsDone(ex.id, setsDone)}
              onWeightChange={(w) => onWeightChange(ex.id, w)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
