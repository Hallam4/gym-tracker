import { useQuery } from "@tanstack/react-query";
import { api, type PREntry } from "../api/gym";
import { fmtDate } from "../utils/formatDate";
import StreakDashboard from "./StreakDashboard";

type Tab = "home" | "today" | "browse" | "progress" | "prs";

interface Props {
  onNavigate: (tab: Tab) => void;
}

export default function HomeDashboard({ onNavigate }: Props) {
  const { data: prData } = useQuery({
    queryKey: ["prs"],
    queryFn: api.getPRs,
  });

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
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white">Dashboard</h2>
        <p className="text-sm text-gray-500">Your training at a glance</p>
      </div>

      <StreakDashboard />

      {recentPRs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Recent PRs
          </h3>
          <div className="space-y-2">
            {recentPRs.map((pr) => (
              <div
                key={pr.exercise}
                className="bg-gray-900 rounded-xl p-3 ring-1 ring-gray-800/60 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium text-white">{pr.exercise}</span>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {isRecent(pr.best_weight_date) && (
                      <span>{pr.best_weight}kg</span>
                    )}
                    {isRecent(pr.best_weight_date) && isRecent(pr.estimated_1rm_date) && (
                      <span className="mx-1 text-gray-700">|</span>
                    )}
                    {isRecent(pr.estimated_1rm_date) && (
                      <span>1RM {pr.estimated_1rm.toFixed(1)}kg</span>
                    )}
                    <span className="text-gray-700 ml-1">
                      {fmtDate(pr.best_weight_date)}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-yellow-500/20">
                  NEW PR
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onNavigate("today")}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        Start Workout
      </button>
    </div>
  );
}
