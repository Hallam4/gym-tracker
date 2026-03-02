import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api/gym";

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
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Progress</h2>

      {/* Exercise search */}
      <input
        type="text"
        placeholder="Search exercise..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 mb-3 border border-gray-800 focus:border-blue-500 focus:outline-none touch-target"
      />

      {/* Exercise list */}
      {!exercise && (
        <div className="space-y-1 mb-4 max-h-60 overflow-y-auto">
          {filteredExercises.map((name) => (
            <button
              key={name}
              onClick={() => {
                setExercise(name);
                setSearchInput(name);
              }}
              className="w-full text-left px-3 py-2 rounded bg-gray-900 text-gray-300 hover:bg-gray-800 text-sm touch-target"
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
          className="text-sm text-blue-400 mb-4"
        >
          &larr; Back to exercise list
        </button>
      )}

      {isLoading && (
        <div className="text-center py-8 text-gray-400">Loading...</div>
      )}

      {exercise && chartData.length > 0 && (
        <div className="space-y-6">
          {/* Weight over time */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Weight Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Volume over time */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Volume Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Best reps over time */}
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">
              Best Reps Over Time
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="best_reps"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {exercise && chartData.length === 0 && !isLoading && (
        <div className="text-center py-8 text-gray-500">
          No history for this exercise yet. Complete a workout to start tracking.
        </div>
      )}
    </div>
  );
}
