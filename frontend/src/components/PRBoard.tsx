import { useQuery } from "@tanstack/react-query";
import { api } from "../api/gym";
import { fmtDate } from "../utils/formatDate";

export default function PRBoard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["prs"],
    queryFn: api.getPRs,
  });

  if (isLoading) return (
    <div className="space-y-3 py-4" role="status">
      <div className="h-6 w-40 bg-gray-800 rounded animate-pulse mb-4" />
      {[1,2,3].map(i => <div key={i} className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60 animate-pulse">
        <div className="h-4 w-1/3 bg-gray-800 rounded mb-3" />
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <div className="h-3 w-2/3 bg-gray-700 rounded" />
            <div className="h-6 w-1/2 bg-gray-700 rounded" />
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <div className="h-3 w-2/3 bg-gray-700 rounded" />
            <div className="h-6 w-1/2 bg-gray-700 rounded" />
          </div>
        </div>
      </div>)}
    </div>
  );
  if (error) return (
    <div className="text-center py-12" role="alert">
      <div className="text-red-400 font-medium mb-2">Could not load PRs</div>
      <p className="text-sm text-gray-500">Check your connection and try again.</p>
    </div>
  );

  const prs = data?.prs ?? [];

  if (prs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
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
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-white">Personal Records</h2>

      <ul className="space-y-3" role="list">
        {prs.map((pr) => {
          const recentWeight = isRecent(pr.best_weight_date);
          const recent1rm = isRecent(pr.estimated_1rm_date);

          return (
            <li key={pr.exercise} className="bg-gray-900 rounded-2xl p-4 ring-1 ring-gray-800/60">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-white">{pr.exercise}</h3>
                {(recentWeight || recent1rm) && (
                  <span className="text-xs font-semibold bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-2 py-0.5 rounded-full animate-badge-bounce shadow-lg shadow-yellow-500/20">
                    NEW PR
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-gray-400 mb-1">Best Weight</div>
                  <div className={`text-lg font-bold ${recentWeight ? "text-yellow-400" : "text-white"}`}>
                    {recentWeight && <span className="text-xs mr-1">&#9733;</span>}{pr.best_weight} <span className="text-sm text-gray-400">kg</span>
                    <span className="sr-only">, achieved on {fmtDate(pr.best_weight_date)}</span>
                  </div>
                  <div className="text-xs text-gray-400" aria-hidden="true">{fmtDate(pr.best_weight_date)}</div>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <div className="text-gray-400 mb-1">Est. 1RM</div>
                  <div className={`text-lg font-bold ${recent1rm ? "text-yellow-400" : "text-white"}`}>
                    {recent1rm && <span className="text-xs mr-1">&#9733;</span>}{pr.estimated_1rm.toFixed(1)} <span className="text-sm text-gray-400">kg</span>
                    <span className="sr-only">, achieved on {fmtDate(pr.estimated_1rm_date)}</span>
                  </div>
                  <div className="text-xs text-gray-400" aria-hidden="true">{fmtDate(pr.estimated_1rm_date)}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
