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

  return (
    <div className="sticky top-0 z-40 bg-blue-900/95 backdrop-blur-sm rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-blue-300">Rest — {exerciseName}</div>
        <button
          onClick={onDismiss}
          className="text-xs text-blue-400 px-2 py-1 rounded bg-blue-800/50"
        >
          Skip
        </button>
      </div>
      <div className="text-3xl font-bold font-mono text-white text-center mb-2">
        {display}
      </div>
      <div className="h-1.5 bg-blue-950 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-400 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
