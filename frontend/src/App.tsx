import { useState, useRef, useCallback } from "react";
import TodayWorkout from "./components/TodayWorkout";
import WorkoutBrowser from "./components/WorkoutBrowser";
import ProgressCharts from "./components/ProgressCharts";
import PRBoard from "./components/PRBoard";
import HomeDashboard from "./components/HomeDashboard";

type Tab = "home" | "today" | "browse" | "progress" | "prs";

const TABS: { key: Tab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "today", label: "Today" },
  { key: "browse", label: "Browse" },
  { key: "progress", label: "Progress" },
  { key: "prs", label: "PRs" },
];

const STORAGE_KEY = "gym-hidden-tabs";

function loadHiddenTabs(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveHiddenTabs(hidden: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [hiddenTabs, setHiddenTabs] = useState<Set<string>>(loadHiddenTabs);
  const [showSettings, setShowSettings] = useState(false);

  // Long-press handler (3s on header)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePressStart = useCallback(() => {
    pressTimer.current = setTimeout(() => {
      setShowSettings(true);
    }, 3000);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const visibleTabs = TABS.filter((t) => !hiddenTabs.has(t.key));

  const toggleTab = (key: string) => {
    setHiddenTabs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // If hiding the active tab, switch to home
        if (key === tab) setTab("home");
      }
      saveHiddenTabs(next);
      return next;
    });
  };

  return (
    <div className="max-w-lg mx-auto px-4 pb-20">
      <header className="py-5 text-center">
        <h1
          className="text-xl font-bold text-white tracking-tight select-none"
          onTouchStart={(e) => { e.preventDefault(); handlePressStart(); }}
          onTouchEnd={handlePressEnd}
          onTouchCancel={handlePressEnd}
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={handlePressEnd}
        >
          Gym Tracker
        </h1>
      </header>

      <main>
        {tab === "home" && <HomeDashboard onNavigate={setTab} />}
        {tab === "today" && <TodayWorkout />}
        {tab === "browse" && <WorkoutBrowser />}
        {tab === "progress" && <ProgressCharts />}
        {tab === "prs" && <PRBoard />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800/50">
        <div className="max-w-lg mx-auto flex">
          {visibleTabs.map((t) => (
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

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in">
          <div className="bg-gray-900 rounded-2xl p-6 w-[85%] max-w-sm ring-1 ring-gray-800/60 animate-modal-in">
            <h2 className="text-lg font-bold text-white mb-4">Visible Tabs</h2>
            <div className="space-y-3">
              {TABS.filter((t) => t.key !== "home").map((t) => {
                const isHidden = hiddenTabs.has(t.key);
                return (
                  <div key={t.key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">{t.label}</span>
                    <button
                      onClick={() => toggleTab(t.key)}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                        isHidden ? "bg-gray-700" : "bg-blue-600"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                          isHidden ? "translate-x-0" : "translate-x-5"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
