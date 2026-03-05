import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, HistorySession, HistoryExercise } from "../api/gym";
import { fmtDate } from "../utils/formatDate";

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
  const [selectedSession, setSelectedSession] = useState<{ date: string; day: string } | null>(null);
  const [search, setSearch] = useState("");

  const { data: sessionsData } = useQuery({
    queryKey: ["history-sessions", selectedType],
    queryFn: () => api.getHistorySessions({ type: selectedType }),
  });

  const { data: sessionDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["history-session", selectedSession?.date, selectedSession?.day],
    queryFn: () => api.getHistorySession(selectedSession!.date, selectedSession!.day),
    enabled: !!selectedSession,
  });

  const sessions = sessionsData?.sessions ?? [];

  // Filter by search (match date or exercise names)
  const filteredSessions = sessions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    if (fmtDate(s.date).toLowerCase().includes(q)) return true;
    if (s.date.includes(q)) return true;
    return s.exercises.some((ex) => ex.exercise.toLowerCase().includes(q));
  });

  return (
    <div>
      {/* Type selector */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3" role="group" aria-label="Workout type filter">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => {
              setSelectedType(t);
              setSelectedSession(null);
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

      {/* Session list or detail */}
      {!selectedSession ? (
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
          {filteredSessions.map((s) => (
            <button
              key={`${s.date}-${s.day}`}
              onClick={() => setSelectedSession({ date: s.date, day: s.day })}
              className="w-full text-left px-4 py-3 bg-gray-900 rounded-2xl text-gray-300 ring-1 ring-gray-800/60 transition-all duration-150 hover:bg-gray-800/80 active:bg-gray-800 active:scale-[0.99] touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
            >
              <div className="font-medium">{fmtDate(s.date)}</div>
              <div className="text-sm text-gray-500">
                {TYPE_LABELS[s.day] || s.day} &middot; {s.exercises.length} exercises
              </div>
            </button>
          ))}
          {filteredSessions.length === 0 && !search && (
            <div className="text-center py-12 text-gray-500">
              <div className="text-gray-400 font-medium mb-1">No sessions found</div>
              <p className="text-sm">Complete a workout to see it here.</p>
            </div>
          )}
          {search && filteredSessions.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No sessions matching &ldquo;{search}&rdquo;
            </div>
          )}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelectedSession(null)}
            className="text-sm text-blue-400 mb-4 hover:text-blue-300 active:text-blue-200 transition-colors duration-150 min-h-[44px] inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            &larr; Back to list
          </button>

          {detailLoading && (
            <div className="space-y-3 py-4 animate-pulse" role="status">
              {[1,2,3].map(i => <div key={i} className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 space-y-2">
                <div className="h-4 w-1/2 bg-gray-800 rounded" />
                <div className="h-3 w-full bg-gray-800 rounded" />
                <div className="h-3 w-2/3 bg-gray-800 rounded" />
              </div>)}
            </div>
          )}

          {sessionDetail && (
            <HistoryDetail session={sessionDetail} />
          )}
        </div>
      )}
    </div>
  );
}

function HistoryDetail({ session }: { session: HistorySession }) {
  return (
    <article>
      <div className="text-sm text-gray-400 mb-4">
        {TYPE_LABELS[session.day] || session.day} &mdash; {fmtDate(session.date)}
      </div>

      <div className="space-y-3">
        {session.exercises.map((ex, i) => (
          <HistoryExerciseCard key={i} exercise={ex} />
        ))}
      </div>
    </article>
  );
}

function HistoryExerciseCard({ exercise: ex }: { exercise: HistoryExercise }) {
  const sets = [ex.set1, ex.set2, ex.set3, ex.set4, ex.set5].filter((s) => s);

  return (
    <div className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 mb-3">
      <h3 className="font-medium text-white mb-2">{ex.exercise}</h3>
      <div className="grid grid-cols-3 gap-2 text-sm text-gray-400">
        <div>
          <span className="text-gray-400">Sets:</span> {ex.sets}
        </div>
        <div>
          <span className="text-gray-400">Weight:</span> {ex.weight}
        </div>
      </div>
      {sets.length > 0 && (
        <div className="mt-2 flex gap-2 flex-wrap text-sm" aria-label={`Set results for ${ex.exercise}`}>
          {sets.map((s, j) => (
            <span
              key={j}
              className="bg-gray-800 px-2 py-1 rounded-md text-gray-300 tabular-nums"
            >
              <span className="sr-only">Set {j + 1}:</span>
              <span aria-hidden="true">S{j + 1}: </span>{s}
            </span>
          ))}
        </div>
      )}
      {ex.notes && (
        <div className="text-sm text-gray-400 mt-2 italic">
          {ex.notes}
        </div>
      )}
    </div>
  );
}
