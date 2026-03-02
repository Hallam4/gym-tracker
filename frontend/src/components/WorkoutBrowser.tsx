import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, WorkoutSession } from "../api/gym";

const TYPES = ["U1", "L1", "U2", "L2", "Arm"] as const;
const TYPE_LABELS: Record<string, string> = {
  U1: "Upper 1",
  L1: "Lower 1",
  U2: "Upper 2",
  L2: "Lower 2",
  Arm: "Arms",
};

export default function WorkoutBrowser() {
  const [selectedType, setSelectedType] = useState<string>("U1");
  const [selectedTab, setSelectedTab] = useState<string | null>(null);

  const { data: tabs } = useQuery({
    queryKey: ["tabs"],
    queryFn: api.getTabs,
  });

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["workout-tab", selectedTab],
    queryFn: () => api.getWorkoutByTab(selectedTab!),
    enabled: !!selectedTab,
  });

  const typeTabs = tabs?.all_tabs[selectedType] ?? [];
  // Show most recent first
  const reversedTabs = [...typeTabs].reverse();

  return (
    <div>
      {/* Type selector */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => {
              setSelectedType(t);
              setSelectedTab(null);
            }}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap touch-target ${
              selectedType === t
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab list or workout detail */}
      {!selectedTab ? (
        <div className="space-y-2">
          {reversedTabs.map((tab) => (
            <button
              key={tab.tab_name}
              onClick={() => setSelectedTab(tab.tab_name)}
              className="w-full text-left px-4 py-3 bg-gray-900 rounded-lg text-gray-300 hover:bg-gray-800 touch-target"
            >
              {tab.tab_name}
            </button>
          ))}
          {reversedTabs.length === 0 && (
            <div className="text-center py-8 text-gray-500">No sessions found</div>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelectedTab(null)}
            className="text-sm text-blue-400 mb-4"
          >
            &larr; Back to list
          </button>

          {sessionLoading && (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          )}

          {session && (
            <WorkoutDetail session={session} />
          )}
        </div>
      )}
    </div>
  );
}

function WorkoutDetail({ session }: { session: WorkoutSession }) {
  return (
    <div>
      <div className="text-sm text-gray-500 mb-4">
        {session.day} {session.date && `— ${session.date}`}
      </div>

      <div className="space-y-3">
        {session.exercises.map((ex, i) => (
          <div key={i} className="bg-gray-900 rounded-lg p-4">
            <div className="font-medium text-white mb-2">{ex.name}</div>
            <div className="grid grid-cols-3 gap-2 text-sm text-gray-400">
              <div>
                <span className="text-gray-600">Sets:</span> {ex.sets}
              </div>
              <div>
                <span className="text-gray-600">Reps:</span> {ex.reps}
              </div>
              <div>
                <span className="text-gray-600">Weight:</span> {ex.weight}
              </div>
            </div>
            {ex.target && (
              <div className="text-sm text-gray-500 mt-1">
                Target: {ex.target}
              </div>
            )}
            {ex.set_results.some((s) => s) && (
              <div className="mt-2 flex gap-2 flex-wrap text-sm">
                {ex.set_results.map(
                  (s, j) =>
                    s && (
                      <span
                        key={j}
                        className="bg-gray-800 px-2 py-1 rounded text-gray-300"
                      >
                        S{j + 1}: {s}
                      </span>
                    )
                )}
              </div>
            )}
            {ex.notes && (
              <div className="text-sm text-gray-500 mt-2 italic">
                {ex.notes}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
