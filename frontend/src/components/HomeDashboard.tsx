import { useQuery } from "@tanstack/react-query";
import { api, type PREntry } from "../api/gym";
import { fmtDate } from "../utils/formatDate";
import { getNextWorkoutType } from "../utils/workoutRotation";
import StreakDashboard from "./StreakDashboard";
import BodyMap from "./BodyMap";
import InactivityNudge from "./InactivityNudge";
import NextWorkoutCard from "./NextWorkoutCard";

type Tab = "home" | "today" | "history" | "progress";

interface Props {
  onNavigate: (tab: Tab) => void;
}

export default function HomeDashboard({ onNavigate }: Props) {
  const { data: prData } = useQuery({
    queryKey: ["prs"],
    queryFn: api.getPRs,
  });

  const { data: streakData } = useQuery({
    queryKey: ["streaks"],
    queryFn: api.getStreaks,
  });

  const { data: sessionsData } = useQuery({
    queryKey: ["history-sessions", { limit: 5 }],
    queryFn: () => api.getHistorySessions({ limit: 5 }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const workoutDates = streakData?.streaks.workout_dates ?? [];
  const lastWorkoutDate = workoutDates[workoutDates.length - 1];
  const daysSinceLastWorkout = lastWorkoutDate
    ? Math.floor(
        (Date.now() - new Date(lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;
  const doneToday = lastWorkoutDate === today;

  const sessions = sessionsData?.sessions ?? [];
  const nextWorkout = getNextWorkoutType(sessions);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const isRecent = (dateStr: string) => {
    try {
      return new Date(dateStr) >= weekAgo;
    } catch {
      return false;
    }
  };

  const recentPRs: PREntry[] = (prData?.prs ?? []).filter(
    (pr) => isRecent(pr.best_weight_date) || isRecent(pr.estimated_1rm_date)
  );

  return (
    <div className="space-y-6">
      {daysSinceLastWorkout !== null && daysSinceLastWorkout >= 2 && (
        <InactivityNudge
          daysSinceLastWorkout={daysSinceLastWorkout}
          currentStreakWeeks={streakData?.streaks.current_streak ?? 0}
          onStartWorkout={() => onNavigate("today")}
        />
      )}

      <div>
        <h2 className="text-lg font-bold text-white">Dashboard</h2>
        <p className="text-sm text-gray-400">Your training at a glance</p>
      </div>

      <StreakDashboard />

      {nextWorkout && (
        <NextWorkoutCard
          nextType={nextWorkout.code}
          nextLabel={nextWorkout.label}
          doneToday={doneToday}
          onStartWorkout={() => onNavigate("today")}
        />
      )}

      <BodyMap />

      {recentPRs.length > 0 && (
        <section aria-label="Recent personal records">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Recent PRs
          </h3>
          <ul className="space-y-2" role="list">
            {recentPRs.map((pr, index) => (
              <li
                key={pr.exercise}
                className="bg-gray-900 rounded-xl p-4 ring-1 ring-gray-800/60 flex items-center justify-between animate-fade-in"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
              >
                <div>
                  <span className="text-sm font-medium text-white">{pr.exercise}</span>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {isRecent(pr.best_weight_date) && (
                      <span>{pr.best_weight}kg</span>
                    )}
                    {isRecent(pr.best_weight_date) && isRecent(pr.estimated_1rm_date) && (
                      <span className="mx-1 text-gray-500" aria-hidden="true">|</span>
                    )}
                    {isRecent(pr.estimated_1rm_date) && (
                      <span>1RM {pr.estimated_1rm.toFixed(1)}kg</span>
                    )}
                    <span className="text-gray-500 ml-1">
                      {fmtDate(pr.best_weight_date)}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-yellow-500/20">
                  NEW PR
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        onClick={() => onNavigate("today")}
        className="w-full py-4 rounded-2xl bg-blue-600 text-white font-bold text-base touch-target shadow-lg shadow-blue-600/20 hover:brightness-110 active:scale-[0.98] active:bg-blue-700 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
      >
        Start Workout
      </button>
    </div>
  );
}
