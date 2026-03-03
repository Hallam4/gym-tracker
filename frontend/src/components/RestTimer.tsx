import { useState, useEffect } from "react";

interface Props {
  exerciseName: string;
  durationSeconds: number;
  onDismiss: () => void;
}

export default function RestTimer({ exerciseName, durationSeconds, onDismiss }: Props) {
  const [remaining, setRemaining] = useState(durationSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onDismiss();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining, onDismiss]);

  const pct = (remaining / durationSeconds) * 100;
  const display =
    remaining >= 60
      ? `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, "0")}`
      : `${remaining}s`;

  // Color transitions as time runs out
  let barColor: string;
  if (pct > 50) {
    barColor = "bg-blue-400";
  } else if (pct > 20) {
    barColor = "bg-amber-400";
  } else {
    barColor = "bg-red-400";
  }

  return (
    <div className="sticky top-0 z-40 bg-blue-900/95 backdrop-blur-md rounded-xl p-4 mb-4 ring-1 ring-blue-700/40 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-blue-300">Rest — {exerciseName}</div>
        <button
          onClick={onDismiss}
          className="text-xs text-blue-400 px-3 py-1.5 rounded-lg bg-blue-800/50 active:bg-blue-700/50 transition-colors touch-target"
        >
          Skip
        </button>
      </div>
      <div className="text-3xl font-bold font-mono text-white text-center mb-2">
        {display}
      </div>
      <div className="h-2 bg-blue-950 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-1000 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
