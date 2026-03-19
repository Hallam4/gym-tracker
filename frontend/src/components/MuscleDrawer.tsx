import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import { api } from "../api/gym";

const MUSCLE_LABELS: Record<string, string> = {
  trapezius: "Trapezius",
  "upper-back": "Upper Back",
  "lower-back": "Lower Back",
  chest: "Chest",
  biceps: "Biceps",
  triceps: "Triceps",
  forearm: "Forearms",
  "back-deltoids": "Rear Delts",
  "front-deltoids": "Front/Side Delts",
  abs: "Abs",
  obliques: "Obliques",
  adductor: "Adductors",
  hamstring: "Hamstrings",
  quadriceps: "Quads",
  abductors: "Abductors",
  calves: "Calves",
  gluteal: "Glutes",
};

interface Props {
  muscle: string;
  currentVolume: number;
  percentile: number | null;
  onClose: () => void;
}

export default function MuscleDrawer({ muscle, currentVolume, percentile, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["muscle-history", muscle],
    queryFn: () => api.getMuscleHistory(muscle, 12),
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const label = MUSCLE_LABELS[muscle] || muscle;

  const chartData = data?.weeks.map((w) => ({
    week: w.week.replace(/^\d{4}-W/, "W"),
    volume: Math.round(w.volume),
  })) ?? [];

  // Compute trend vs prior 4 weeks
  let trendText = "";
  if (chartData.length >= 5) {
    const recent = chartData[chartData.length - 1].volume;
    const prior4 = chartData.slice(-5, -1);
    const avg = prior4.reduce((s, d) => s + d.volume, 0) / prior4.length;
    if (avg > 0) {
      const pct = Math.round(((recent - avg) / avg) * 100);
      const sign = pct >= 0 ? "+" : "";
      trendText = `${sign}${pct}% vs prior 4-week avg`;
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 rounded-t-2xl ring-1 ring-gray-800/60 p-5 pb-8 max-h-[55vh] transition-transform duration-300 ease-out animate-slide-up">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-white">{label}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1"
            aria-label="Close drawer"
          >
            &times;
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-4 text-sm">
          <span className="text-gray-400">
            This week: <span className="text-white font-medium">{Math.round(currentVolume).toLocaleString()}kg</span>
          </span>
          {percentile !== null && (
            <span className="text-violet-400 font-medium">{percentile}th percentile</span>
          )}
        </div>

        {/* Chart */}
        {isLoading ? (
          <div className="h-[180px] flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(value: number) => [`${value.toLocaleString()}kg`, "Volume"]}
                />
                <Area
                  type="monotone"
                  dataKey="volume"
                  fill="#7c3aed"
                  fillOpacity={0.1}
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#a78bfa" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trend */}
        {trendText && (
          <p className="text-xs text-gray-500 text-center mt-2">{trendText}</p>
        )}
      </div>
    </>
  );
}
