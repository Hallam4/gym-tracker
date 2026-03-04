import { useEffect, useRef } from "react";
import { WorkoutSummaryResponse, ExerciseSummary } from "../api/gym";

interface Props {
  data: WorkoutSummaryResponse;
  totalSets: number;
  duration: number; // seconds
  onDismiss: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function ExerciseRow({ ex }: { ex: ExerciseSummary }) {
  const hasPR = ex.is_weight_pr || ex.is_1rm_pr;
  return (
    <div
      className={`flex items-center justify-between py-2 px-3 rounded-lg ${
        hasPR ? "bg-yellow-500/10 ring-1 ring-yellow-500/30" : ""
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-gray-200 truncate">{ex.exercise}</span>
        {ex.is_weight_pr && (
          <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            WEIGHT PR
          </span>
        )}
        {ex.is_1rm_pr && !ex.is_weight_pr && (
          <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
            1RM PR
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span className="text-sm text-gray-400">
          {ex.weight}<span className="sr-only"> kilograms</span>kg
        </span>
        {ex.weight_change != null && ex.weight_change !== 0 && (
          <span
            className={`text-xs font-medium ${
              ex.weight_change > 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            <span className="sr-only">{ex.weight_change > 0 ? "increased by" : "decreased by"}</span>
            {ex.weight_change > 0 ? "+" : ""}
            {ex.weight_change}
          </span>
        )}
      </div>
    </div>
  );
}

export default function WorkoutSummary({ data, totalSets, duration, onDismiss }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableEls = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];
    firstEl?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="summary-title"
      ref={modalRef}
    >
      <div className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto ring-1 ring-gray-800/60 animate-modal-in">
        {/* Header */}
        <div className="text-center pt-6 pb-4 px-4">
          <div className="text-3xl mb-2" aria-hidden="true">
            {data.new_prs_count > 0 ? "\uD83C\uDF1F" : "\u2705"}
          </div>
          <h2 id="summary-title" className="text-xl font-bold text-white">Workout Complete!</h2>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 px-4 mb-4">
          <div className="bg-gray-800/60 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{data.exercises_logged}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Exercises</div>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{totalSets}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Sets</div>
          </div>
          <div className="bg-gray-800/60 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{formatDuration(duration)}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wide">Duration</div>
          </div>
        </div>

        {/* PRs highlight */}
        {data.new_prs_count > 0 && (
          <div className="mx-4 mb-4 bg-yellow-500/10 rounded-xl p-3 ring-1 ring-yellow-500/20">
            <div className="text-sm font-semibold text-yellow-400 mb-1">
              {data.new_prs_count} New PR{data.new_prs_count > 1 ? "s" : ""}!
            </div>
            <div className="text-xs text-yellow-400/70">
              {data.exercise_summaries
                .filter((e) => e.is_weight_pr || e.is_1rm_pr)
                .map((e) => e.exercise)
                .join(", ")}
            </div>
          </div>
        )}

        {/* Exercise list */}
        <div className="px-4 pb-4">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Exercises
          </h3>
          <div className="space-y-1">
            {data.exercise_summaries.map((ex) => (
              <ExerciseRow key={ex.exercise} ex={ex} />
            ))}
          </div>
        </div>

        {/* Done button */}
        <div className="px-4 pb-4 pt-2">
          <button
            onClick={onDismiss}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg touch-target hover:brightness-110 active:scale-[0.98] active:bg-blue-700 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
