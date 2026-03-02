import { useQuery } from "@tanstack/react-query";
import { api } from "../api/gym";

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
          const recentVolume = isRecent(pr.best_volume_date);

          return (
            <div key={pr.exercise} className="bg-gray-900 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-white">{pr.exercise}</span>
                {(recentWeight || recentVolume) && (
                  <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded-full">
                    NEW PR
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500">Best Weight</div>
                  <div className={`font-bold ${recentWeight ? "text-yellow-400" : "text-white"}`}>
                    {pr.best_weight} kg
                  </div>
                  <div className="text-xs text-gray-600">{pr.best_weight_date}</div>
                </div>
                <div>
                  <div className="text-gray-500">Best Volume</div>
                  <div className={`font-bold ${recentVolume ? "text-yellow-400" : "text-white"}`}>
                    {pr.best_volume.toFixed(0)} kg
                  </div>
                  <div className="text-xs text-gray-600">{pr.best_volume_date}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
