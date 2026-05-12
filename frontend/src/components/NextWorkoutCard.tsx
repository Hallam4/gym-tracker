import { useQuery } from "@tanstack/react-query";
import { api } from "../api/gym";

interface Props {
  nextType: string;
  nextLabel: string;
  doneToday: boolean;
  onStartWorkout: () => void;
}

export default function NextWorkoutCard({
  nextType,
  nextLabel,
  doneToday,
  onStartWorkout,
}: Props) {
  const { data } = useQuery({
    queryKey: ["structure", nextType],
    queryFn: () => api.getStructure(nextType),
  });

  const exercises = data?.exercises ?? [];
  const previewCount = 4;
  const shown = exercises.slice(0, previewCount).map((e) => e.name);
  const remaining = exercises.length - previewCount;

  return (
    <button
      onClick={onStartWorkout}
      className={`w-full text-left bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 transition-all active:scale-[0.98] ${
        doneToday ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">
            {doneToday ? "Done today — next up" : "Next up"}
          </p>
          <p className="text-base font-bold text-white mt-0.5">
            {nextType} — {nextLabel}
          </p>
        </div>
        <span className="text-gray-500 text-xl">&#8250;</span>
      </div>
      {shown.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">
          {shown.join(", ")}
          {remaining > 0 && ` +${remaining} more`}
        </p>
      )}
    </button>
  );
}
