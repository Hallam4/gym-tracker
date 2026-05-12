import { useState } from "react";

interface Props {
  daysSinceLastWorkout: number;
  currentStreakWeeks: number;
  onStartWorkout: () => void;
}

function getMessage(days: number, streakWeeks: number): string {
  const streakPart =
    streakWeeks > 0
      ? `your ${streakWeeks}-week streak`
      : "your consistency";

  if (days <= 2) return `${days} days idle — keep ${streakPart} alive`;
  if (days <= 4) return `${days} days idle — ${streakPart} is at risk`;
  return `${days} days idle — ${streakPart} is slipping away`;
}

export default function InactivityNudge({
  daysSinceLastWorkout,
  currentStreakWeeks,
  onStartWorkout,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative bg-amber-900/30 ring-1 ring-amber-700/50 rounded-2xl p-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-amber-400/60 hover:text-amber-300 text-lg leading-none"
        aria-label="Dismiss"
      >
        &times;
      </button>
      <p className="text-sm font-medium text-amber-200 pr-6">
        {getMessage(daysSinceLastWorkout, currentStreakWeeks)}
      </p>
      <button
        onClick={onStartWorkout}
        className="mt-3 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:brightness-110 active:scale-[0.97] transition-all"
      >
        Start Workout
      </button>
    </div>
  );
}
