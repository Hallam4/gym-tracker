import { PrehabPhaseDef } from "../data/prehabData";
import { clampLevel } from "../lib/prehabSession";

interface Props {
  phases: PrehabPhaseDef[];
  phase: number;               // raw persisted value; clamped here
  onPhaseChange: (phase: number) => void;
}

export default function PrehabPhaseCard({ phases, phase, onPhaseChange }: Props) {
  const count = phases.length;
  const cur = clampLevel(phase, count);
  const def = phases[cur - 1];

  return (
    <div className="bg-gray-900 rounded-2xl py-4 px-4 ring-1 ring-emerald-900/50 mb-2.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPhaseChange(clampLevel(cur - 1, count))}
          disabled={cur <= 1}
          aria-label="Previous phase"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9664;</span>
        </button>
        <div className="flex-1 text-center min-w-0">
          <div className="text-xs text-gray-500">Phase {cur} of {count}</div>
          <div className="text-sm font-semibold text-white truncate">{def.name}</div>
        </div>
        <button
          onClick={() => onPhaseChange(clampLevel(cur + 1, count))}
          disabled={cur >= count}
          aria-label="Next phase"
          className="w-9 h-9 rounded-full bg-gray-800 text-white font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 disabled:opacity-30 active:scale-90 transition-all duration-150"
        >
          <span aria-hidden="true">&#9654;</span>
        </button>
      </div>

      <div className="flex items-center gap-1 mt-3" aria-hidden="true">
        {phases.map((p) => {
          const cls = p.phase === cur ? "bg-emerald-500" : p.phase < cur ? "bg-emerald-800" : "bg-gray-800";
          return <div key={p.phase} className={`flex-1 h-1.5 rounded-full ${cls}`} />;
        })}
      </div>

      <div className="mt-3 space-y-1 text-xs leading-relaxed">
        <p className="text-gray-300"><span className="text-gray-500">Goal: </span>{def.goal}</p>
        <p className="text-emerald-300"><span className="text-gray-500">Advance when: </span>{def.advanceWhen}</p>
      </div>
    </div>
  );
}
