import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api/gym";
import { fmtDate } from "../utils/formatDate";
import StreakDashboard from "./StreakDashboard";

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: "12px",
  color: "#fff",
};

export default function ProgressCharts() {
  const [exercise, setExercise] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Fetch all workouts to get exercise list
  const { data: workouts } = useQuery({
    queryKey: ["workouts"],
    queryFn: api.getWorkouts,
  });

  // Fetch progress for selected exercise
  const { data: progress, isLoading } = useQuery({
    queryKey: ["progress", exercise],
    queryFn: () => api.getProgress(exercise),
    enabled: !!exercise,
  });

  // Deduplicated exercise names from all workouts
  const allExercises = Array.from(
    new Set(
      workouts?.sessions.flatMap((s) => s.exercises.map((e) => e.name)) ?? []
    )
  ).sort();

  const filteredExercises = searchInput
    ? allExercises.filter((e) =>
        e.toLowerCase().includes(searchInput.toLowerCase())
      )
    : allExercises;

  const chartData = progress?.history ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">Progress</h2>

      <StreakDashboard />

      {/* Exercise search */}
      <div className="space-y-3">
        <label htmlFor="exercise-search" className="sr-only">Search exercise</label>
        <input
          id="exercise-search"
          type="text"
          placeholder="Search exercise..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full bg-gray-900 text-white rounded-2xl px-4 py-3 ring-1 ring-gray-800 focus-visible:ring-blue-500/70 focus-visible:outline-none touch-target transition-shadow placeholder:text-gray-500"
          role="combobox"
          aria-expanded={!exercise && filteredExercises.length > 0}
          aria-controls="exercise-listbox"
          aria-autocomplete="list"
        />

        {/* Exercise list */}
        {!exercise && (
          <div id="exercise-listbox" role="listbox" aria-label="Exercise options" className="space-y-1.5 max-h-60 overflow-y-auto">
            {filteredExercises.map((name) => (
              <button
                key={name}
                role="option"
                aria-selected={false}
                onClick={() => {
                  setExercise(name);
                  setSearchInput(name);
                }}
                className="w-full text-left px-4 py-3 rounded-xl bg-gray-900 text-gray-300 ring-1 ring-gray-800/60 hover:bg-gray-800 active:bg-gray-700 active:scale-[0.99] text-sm touch-target transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {exercise && (
          <button
            onClick={() => {
              setExercise("");
              setSearchInput("");
            }}
            className="text-sm text-blue-400 hover:text-blue-300 active:text-blue-200 transition-colors duration-150 min-h-[44px] inline-flex items-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            &larr; Back to exercise list
          </button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4" role="status" aria-label="Loading progress charts">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
              <div className="h-4 w-32 bg-gray-800 rounded animate-pulse mb-3" />
              <div className="h-[200px] bg-gray-800/50 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {exercise && chartData.length > 0 && (
        <section aria-label={`Progress charts for ${exercise}`} className="space-y-4">
          {/* Weight over time */}
          <div className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Weight Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} aria-label="Weight over time chart">
                <defs>
                  <linearGradient id="gradWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="weight"
                  fill="url(#gradWeight)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Volume over time */}
          <div className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Volume Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} aria-label="Volume over time chart">
                <defs>
                  <linearGradient id="gradVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="volume"
                  fill="url(#gradVolume)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Best reps over time */}
          <div className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Best Reps Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} aria-label="Best reps over time chart">
                <defs>
                  <linearGradient id="gradReps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="best_reps"
                  fill="url(#gradReps)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="best_reps"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Estimated 1RM over time */}
          <div className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Est. 1RM Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} aria-label="Estimated one rep max over time chart">
                <defs>
                  <linearGradient id="gradE1RM" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="estimated_1rm"
                  fill="url(#gradE1RM)"
                  stroke="none"
                />
                <Line
                  type="monotone"
                  dataKey="estimated_1rm"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {exercise && chartData.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          No history for this exercise yet. Complete a workout to start tracking.
        </div>
      )}
    </div>
  );
}
