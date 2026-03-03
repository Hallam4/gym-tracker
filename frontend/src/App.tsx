import { useState } from "react";
import TodayWorkout from "./components/TodayWorkout";
import WorkoutBrowser from "./components/WorkoutBrowser";
import ProgressCharts from "./components/ProgressCharts";
import PRBoard from "./components/PRBoard";

type Tab = "today" | "browse" | "progress" | "prs";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "browse", label: "Browse" },
  { key: "progress", label: "Progress" },
  { key: "prs", label: "PRs" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="max-w-lg mx-auto px-4 pb-20">
      <header className="py-5 text-center">
        <h1 className="text-xl font-bold text-white tracking-tight">Gym Tracker</h1>
      </header>

      <main>
        {tab === "today" && <TodayWorkout />}
        {tab === "browse" && <WorkoutBrowser />}
        {tab === "progress" && <ProgressCharts />}
        {tab === "prs" && <PRBoard />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800/50">
        <div className="max-w-lg mx-auto flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-active={tab === t.key}
              className={`tab-btn flex-1 py-3 text-sm font-medium touch-target transition-colors duration-200 ${
                tab === t.key
                  ? "text-blue-400"
                  : "text-gray-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
