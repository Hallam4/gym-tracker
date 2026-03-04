import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, WorkoutSession } from "../api/gym";
import { groupExercises } from "../utils/groupExercises";
import { fmtDate, fmtTabName } from "../utils/formatDate";

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
  const [search, setSearch] = useState("");

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
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3" role="group" aria-label="Workout type filter">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => {
              setSelectedType(t);
              setSelectedTab(null);
              setSearch("");
            }}
            aria-pressed={selectedType === t}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-target transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
              selectedType === t
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                : "bg-gray-800 text-gray-400 ring-1 ring-gray-700/50 hover:bg-gray-700 hover:text-gray-300"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab list or workout detail */}
      {!selectedTab ? (
        <div className="space-y-3">
          <label htmlFor="session-filter" className="sr-only">Filter sessions</label>
          <input
            id="session-filter"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter sessions..."
            className="w-full bg-gray-900 text-gray-300 ring-1 ring-gray-800/60 rounded-2xl px-4 py-3 touch-target focus-visible:ring-blue-500/70 focus-visible:outline-none transition-shadow duration-200 placeholder:text-gray-500"
          />
          {reversedTabs
            .filter((tab) =>
              fmtTabName(tab.tab_name).toLowerCase().includes(search.toLowerCase())
            )
            .map((tab) => (
              <button
                key={tab.tab_name}
                onClick={() => setSelectedTab(tab.tab_name)}
                className="w-full text-left px-4 py-3 bg-gray-900 rounded-2xl text-gray-300 ring-1 ring-gray-800/60 transition-all duration-150 hover:bg-gray-800/80 active:bg-gray-800 active:scale-[0.99] touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
              >
                {fmtTabName(tab.tab_name)}
              </button>
            ))}
          {reversedTabs.length === 0 && !search && (
            <div className="text-center py-8 text-gray-500">No sessions found</div>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelectedTab(null)}
            className="text-sm text-blue-400 mb-4 hover:text-blue-300 active:text-blue-200 transition-colors duration-150 min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            &larr; Back to list
          </button>

          {sessionLoading && (
            <div className="space-y-3 py-4 animate-pulse" role="status">
              {[1,2,3].map(i => <div key={i} className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 space-y-2">
                <div className="h-4 w-1/2 bg-gray-800 rounded" />
                <div className="h-3 w-full bg-gray-800 rounded" />
                <div className="h-3 w-2/3 bg-gray-800 rounded" />
              </div>)}
            </div>
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
    <article>
      <div className="text-sm text-gray-400 mb-4">
        {session.day} {session.date && `\u2014 ${fmtDate(session.date)}`}
      </div>

      <div className="space-y-3">
        {groupExercises(session.exercises).map((group) => (
          <div key={group.groupId} className={group.isSuperset ? "border-l-2 border-blue-500/70 pl-3" : ""}>
            {group.isSuperset && (
              <div className="text-xs font-semibold text-blue-400 mb-1">Superset</div>
            )}
            {group.exercises.map((ex, i) => (
              <div key={i} className={`bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 ${group.isSuperset ? "mb-1" : "mb-3"}`}>
                <h3 className="font-medium text-white mb-2">{ex.name}</h3>
                <div className="grid grid-cols-3 gap-2 text-sm text-gray-400">
                  <div>
                    <span className="text-gray-400">Sets:</span> {ex.sets}
                  </div>
                  <div>
                    <span className="text-gray-400">Reps:</span> {ex.reps}
                  </div>
                  <div>
                    <span className="text-gray-400">Weight:</span> {ex.weight}
                  </div>
                </div>
                {ex.target && (
                  <div className="text-sm text-gray-400 mt-1">
                    Target: {ex.target}
                  </div>
                )}
                {ex.set_results.some((s) => s) && (
                  <div className="mt-2 flex gap-2 flex-wrap text-sm" aria-label={`Set results for ${ex.name}`}>
                    {ex.set_results.map(
                      (s, j) =>
                        s && (
                          <span
                            key={j}
                            className="bg-gray-800 px-2 py-1 rounded-md text-gray-300 tabular-nums"
                          >
                            <span className="sr-only">Set {j + 1}:</span>
                            <span aria-hidden="true">S{j + 1}: </span>{s}
                          </span>
                        )
                    )}
                  </div>
                )}
                {ex.notes && (
                  <div className="text-sm text-gray-400 mt-2 italic">
                    {ex.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}
