import { useQuery } from "@tanstack/react-query";
import { api } from "../api/gym";
import { fmtDate } from "../utils/formatDate";

export default function PRBoard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["prs"],
    queryFn: api.getPRs,
  });

  if (isLoading) return <div className="text-center py-8 text-gray-400">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-400">Error loading PRs</div>;

  const prs = data?.prs ?? [];

  if (prs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No PRs yet. Complete some workouts to start tracking records.
      </div>
    );
  }

  // Check for recent PRs (last 7 days)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const isRecent = (dateStr: string) => {
    try {
      return new Date(dateStr) >= weekAgo;
    } catch {
      return false;
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Personal Records</h2>

      <div className="space-y-3">
        {prs.map((pr) => {
          const recentWeight = isRecent(pr.best_weight_date);
          const recent1rm = isRecent(pr.estimated_1rm_date);

          return (
            <div key={pr.exercise} className="bg-gray-900 rounded-xl p-4 ring-1 ring-gray-800/60">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-white">{pr.exercise}</span>
                {(recentWeight || recent1rm) && (
                  <span className="text-xs font-semibold bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-2 py-0.5 rounded-full animate-badge-bounce shadow-lg shadow-yellow-500/20">
                    NEW PR
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-gray-500 mb-1">Best Weight</div>
                  <div className={`text-lg font-bold ${recentWeight ? "text-yellow-400" : "text-white"}`}>
                    {pr.best_weight} <span className="text-sm text-gray-500">kg</span>
                  </div>
                  <div className="text-xs text-gray-600">{fmtDate(pr.best_weight_date)}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-gray-500 mb-1">Est. 1RM</div>
                  <div className={`text-lg font-bold ${recent1rm ? "text-yellow-400" : "text-white"}`}>
                    {pr.estimated_1rm.toFixed(1)} <span className="text-sm text-gray-500">kg</span>
                  </div>
                  <div className="text-xs text-gray-600">{fmtDate(pr.estimated_1rm_date)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
