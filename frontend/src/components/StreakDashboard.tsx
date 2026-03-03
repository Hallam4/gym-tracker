import { useQuery } from "@tanstack/react-query";
import { api } from "../api/gym";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 ring-1 ring-gray-800/60 text-center">
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function getWeekDates(weeksBack: number): Date[] {
  const today = new Date();
  // Start of current week (Monday)
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + mondayOffset);

  const startMonday = new Date(currentMonday);
  startMonday.setDate(currentMonday.getDate() - weeksBack * 7);

  const dates: Date[] = [];
  const d = new Date(startMonday);
  const endDate = new Date(currentMonday);
  endDate.setDate(endDate.getDate() + 6); // Sunday of current week
  while (d <= endDate) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StreakDashboard() {
  const { data } = useQuery({
    queryKey: ["streaks"],
    queryFn: api.getStreaks,
  });

  if (!data) return null;

  const { streaks } = data;
  const workoutSet = new Set(streaks.workout_dates);

  // 12-week heatmap
  const WEEKS_BACK = 11;
  const allDates = getWeekDates(WEEKS_BACK);
  const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

  // Group into weeks (columns)
  const weeks: Date[][] = [];
  for (let i = 0; i < allDates.length; i += 7) {
    weeks.push(allDates.slice(i, i + 7));
  }

  const today = toISODate(new Date());

  return (
    <div className="mb-6">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <StatCard
          label="Streak"
          value={`${streaks.current_streak}w`}
        />
        <StatCard label="Best" value={`${streaks.best_streak}w`} />
        <StatCard label="This Week" value={streaks.workouts_this_week} />
        <StatCard label="This Month" value={streaks.workouts_this_month} />
      </div>

      {/* Heatmap */}
      <div className="bg-gray-900 rounded-xl p-3 ring-1 ring-gray-800/60">
        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {DAYS.map((d, i) => (
              <div
                key={i}
                className="w-3 h-3 flex items-center justify-center text-[8px] text-gray-600"
              >
                {i % 2 === 0 ? d : ""}
              </div>
            ))}
          </div>
          {/* Week columns */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((date, di) => {
                const iso = toISODate(date);
                const hasWorkout = workoutSet.has(iso);
                const isFuture = iso > today;
                return (
                  <div
                    key={di}
                    className={`w-3 h-3 rounded-[2px] ${
                      isFuture
                        ? "bg-gray-800/30"
                        : hasWorkout
                          ? "bg-green-500"
                          : "bg-gray-800"
                    }`}
                    title={`${iso}${hasWorkout ? " - workout" : ""}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
