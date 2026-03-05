import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/gym";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-3 ring-1 ring-gray-800/60 text-center">
      <div className="text-xl font-bold text-white" aria-label={`${label}: ${value}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5" aria-hidden="true">{label}</div>
    </div>
  );
}

function getWeekDates(weeksBack: number): Date[] {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() + mondayOffset);

  const startMonday = new Date(currentMonday);
  startMonday.setDate(currentMonday.getDate() - weeksBack * 7);

  const dates: Date[] = [];
  const d = new Date(startMonday);
  const endDate = new Date(currentMonday);
  endDate.setDate(endDate.getDate() + 6);
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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtTooltipDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

interface TooltipInfo {
  date: string;
  hasWorkout: boolean;
  exerciseCount: number;
  workoutName: string | null;
  x: number;
  y: number;
}

export default function StreakDashboard() {
  const { data } = useQuery({
    queryKey: ["streaks"],
    queryFn: api.getStreaks,
  });

  const { data: workouts } = useQuery({
    queryKey: ["workouts"],
    queryFn: api.getWorkouts,
  });

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const workoutInfoMap = useCallback(() => {
    const map = new Map<string, { name: string; exerciseCount: number }>();
    if (!workouts?.sessions) return map;
    for (const session of workouts.sessions) {
      if (session.date) {
        map.set(session.date, {
          name: session.day,
          exerciseCount: session.exercises.length,
        });
      }
    }
    return map;
  }, [workouts])();

  const showTooltip = useCallback((iso: string, hasWorkout: boolean, el: HTMLElement) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    const rect = el.getBoundingClientRect();
    const containerRect = heatmapRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const info = workoutInfoMap.get(iso);
    setTooltip({
      date: iso,
      hasWorkout,
      exerciseCount: info?.exerciseCount ?? 0,
      workoutName: info?.name ?? null,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top,
    });
  }, [workoutInfoMap]);

  const hideTooltip = useCallback(() => {
    tooltipTimerRef.current = setTimeout(() => setTooltip(null), 200);
  }, []);

  if (!data) return null;

  const { streaks } = data;
  const workoutSet = new Set(streaks.workout_dates);

  const WEEKS_BACK = 11;
  const allDates = getWeekDates(WEEKS_BACK);
  const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
  const FULL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const weeks: Date[][] = [];
  for (let i = 0; i < allDates.length; i += 7) {
    weeks.push(allDates.slice(i, i + 7));
  }

  const today = toISODate(new Date());
  const totalWorkouts = streaks.workout_dates.length;

  return (
    <section aria-label="Training streak and activity" className="space-y-3">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Training statistics">
        <StatCard
          label="Streak"
          value={`${streaks.current_streak}w`}
        />
        <StatCard label="Best" value={`${streaks.best_streak}w`} />
        <StatCard label="This Week" value={streaks.workouts_this_week} />
        <StatCard label="This Month" value={streaks.workouts_this_month} />
      </div>

      {/* Heatmap */}
      <div
        className="bg-gray-900 rounded-2xl p-3 ring-1 ring-gray-800/60 relative"
        ref={heatmapRef}
        role="img"
        aria-label={`Workout activity heatmap for the last 12 weeks. ${totalWorkouts} workouts completed.`}
      >
        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-1.5" aria-hidden="true">
            {DAYS.map((d, i) => (
              <div
                key={i}
                className="w-3.5 h-3.5 flex items-center justify-center text-[9px] text-gray-500"
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
                    className={`w-3.5 h-3.5 rounded-[3px] transition-opacity duration-150 ${
                      isFuture
                        ? "bg-gray-800/30"
                        : hasWorkout
                          ? "bg-green-500 hover:opacity-80"
                          : "bg-gray-800 hover:opacity-70"
                    }`}
                    role="presentation"
                    aria-label={`${FULL_DAYS[di]}, ${iso}${hasWorkout ? " - workout completed" : isFuture ? " - future" : " - rest day"}`}
                    onMouseEnter={(e) => !isFuture && showTooltip(iso, hasWorkout, e.currentTarget)}
                    onMouseLeave={hideTooltip}
                    onTouchStart={(e) => { if (!isFuture) { e.preventDefault(); showTooltip(iso, hasWorkout, e.currentTarget); } }}
                    onTouchEnd={hideTooltip}
                  />
                );
              })}
            </div>
          ))}
        </div>

        {/* Custom tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none animate-fade-in"
            role="tooltip"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y - 4}px`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="bg-gray-800 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg ring-1 ring-gray-700/60 whitespace-nowrap">
              <div className="font-medium">{fmtTooltipDate(tooltip.date)}</div>
              {tooltip.hasWorkout ? (
                <div className="text-green-400 mt-0.5">
                  {tooltip.workoutName ? (
                    <span>{tooltip.workoutName}</span>
                  ) : (
                    <span>Workout</span>
                  )}
                  {tooltip.exerciseCount > 0 && (
                    <span className="text-gray-400"> -- {tooltip.exerciseCount} exercises</span>
                  )}
                </div>
              ) : (
                <div className="text-gray-500 mt-0.5">Rest day</div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
