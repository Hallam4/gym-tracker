import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Model from "react-body-highlighter";
import type { IExerciseData, IMuscleStats, Muscle } from "react-body-highlighter";
import { api } from "../api/gym";
import MuscleDrawer from "./MuscleDrawer";

const TIER_COLORS = ["#4c1d95", "#7c3aed", "#a78bfa"]; // violet-900, violet-600, violet-400
const BODY_COLOR = "#1f2937"; // gray-800

export default function BodyMap() {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["volume-week"],
    queryFn: () => api.getWeekVolume(),
  });

  const handleClick = useCallback((muscleStats: IMuscleStats) => {
    setSelectedMuscle(muscleStats.muscle);
  }, []);

  if (isLoading || !data) {
    return (
      <section aria-label="Muscle volume" className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Muscle Volume
        </h3>
        <div className="h-[200px] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </section>
    );
  }

  // Build exercise data for react-body-highlighter
  // Each tier gets a separate "exercise" entry so frequency maps to tier
  const tierMuscles: Record<number, Muscle[]> = { 1: [], 2: [], 3: [] };
  for (const [muscle, info] of Object.entries(data.muscles)) {
    if (info.tier >= 1 && info.tier <= 3) {
      tierMuscles[info.tier].push(muscle as Muscle);
    }
  }

  const exerciseData: IExerciseData[] = [];
  if (tierMuscles[1].length) {
    exerciseData.push({ name: "Low", muscles: tierMuscles[1], frequency: 1 });
  }
  if (tierMuscles[2].length) {
    exerciseData.push({ name: "Moderate", muscles: tierMuscles[2], frequency: 2 });
  }
  if (tierMuscles[3].length) {
    exerciseData.push({ name: "High", muscles: tierMuscles[3], frequency: 3 });
  }

  const selectedInfo = selectedMuscle ? data.muscles[selectedMuscle] : null;

  // Count trained muscles
  const trainedCount = Object.values(data.muscles).filter((m) => m.tier > 0).length;
  const totalMuscles = Object.keys(data.muscles).length;

  return (
    <section aria-label="Muscle volume" className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          Muscle Volume
        </h3>
        <span className="text-xs text-gray-500">
          {data.is_partial ? "This week so far" : data.week}
        </span>
      </div>

      {/* Body maps side by side */}
      <div className="flex justify-center gap-2">
        <div className="flex-1 max-w-[180px]">
          <Model
            type="anterior"
            data={exerciseData}
            bodyColor={BODY_COLOR}
            highlightedColors={TIER_COLORS}
            onClick={handleClick}
            style={{ width: "100%", cursor: "pointer" }}
          />
        </div>
        <div className="flex-1 max-w-[180px]">
          <Model
            type="posterior"
            data={exerciseData}
            bodyColor={BODY_COLOR}
            highlightedColors={TIER_COLORS}
            onClick={handleClick}
            style={{ width: "100%", cursor: "pointer" }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BODY_COLOR }} /> None
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TIER_COLORS[0] }} /> Low
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TIER_COLORS[1] }} /> Mid
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TIER_COLORS[2] }} /> High
        </span>
      </div>

      {/* Summary */}
      <p className="text-center text-xs text-gray-500 mt-2">
        {trainedCount}/{totalMuscles} muscle groups trained
      </p>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <p className="text-center text-[10px] text-amber-500/70 mt-1">
          {data.warnings.length} unmapped exercise{data.warnings.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Drawer */}
      {selectedMuscle && selectedInfo && (
        <MuscleDrawer
          muscle={selectedMuscle}
          currentVolume={selectedInfo.volume}
          percentile={selectedInfo.percentile}
          onClose={() => setSelectedMuscle(null)}
        />
      )}
    </section>
  );
}
