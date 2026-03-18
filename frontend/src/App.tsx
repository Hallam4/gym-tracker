import { useState, useRef, useCallback, useEffect, Component, ErrorInfo, ReactNode } from "react";
import TodayWorkout from "./components/TodayWorkout";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Component crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <div className="text-red-400 font-medium mb-2">Something went wrong</div>
          <p className="text-sm text-gray-400 mb-4">Try clearing your session data.</p>
          <button
            onClick={() => {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k?.startsWith("gym-session-")) localStorage.removeItem(k);
              }
              this.setState({ hasError: false });
            }}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-xl text-sm hover:bg-gray-700 active:scale-95 transition-all duration-150"
          >
            Clear &amp; Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
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
  const [workoutActive, setWorkoutActive] = useState(false);

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

  const settingsModalRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLHeadingElement>(null);

  // Focus trap for settings modal
  useEffect(() => {
    if (!showSettings) return;
    const modal = settingsModalRef.current;
    if (!modal) return;

    const focusableEls = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];
    firstEl?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSettings(false);
        settingsTriggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showSettings]);

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
    <div className="max-w-lg mx-auto px-4 pb-24">
      <header className="py-4 flex items-center justify-center relative">
        <h1
          ref={settingsTriggerRef}
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
        <button
          onClick={() => setShowSettings(true)}
          className="absolute right-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-300 active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          aria-label="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      <main>
        {tab === "home" && <HomeDashboard onNavigate={setTab} />}
        {/* TodayWorkout stays mounted so timer/scroll/state survive tab switches */}
        <div style={{ display: tab === "today" ? "block" : "none" }} role="tabpanel" id="tabpanel-today" aria-labelledby="tab-today">
          <ErrorBoundary><TodayWorkout onActiveChange={setWorkoutActive} /></ErrorBoundary>
        </div>
        {tab === "browse" && <WorkoutBrowser />}
        {tab === "progress" && <ProgressCharts />}
        {tab === "prs" && <PRBoard />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800/50" aria-label="Main navigation">
        <div className="max-w-lg mx-auto flex" role="tablist" aria-label="App sections">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              aria-controls={`tabpanel-${t.key}`}
              id={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              data-active={tab === t.key}
              className={`tab-btn flex-1 py-3 text-sm font-medium touch-target transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${
                tab === t.key
                  ? "text-blue-400"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              <span className="relative">
                {t.label}
                {t.key === "today" && workoutActive && tab !== "today" && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 bg-green-500 rounded-full" />
                )}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Settings modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          ref={settingsModalRef}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowSettings(false); settingsTriggerRef.current?.focus(); } }}
        >
          <div className="bg-gray-900 rounded-2xl p-6 w-[85%] max-w-sm ring-1 ring-gray-800/60 animate-modal-in">
            <h2 id="settings-title" className="text-lg font-bold text-white mb-4">Visible Tabs</h2>
            <div className="space-y-3">
              {TABS.filter((t) => t.key !== "home").map((t) => {
                const isHidden = hiddenTabs.has(t.key);
                return (
                  <div key={t.key} className="flex items-center justify-between min-h-[44px]">
                    <span id={`toggle-label-${t.key}`} className="text-sm text-gray-300">{t.label}</span>
                    <button
                      role="switch"
                      aria-checked={!isHidden}
                      aria-labelledby={`toggle-label-${t.key}`}
                      onClick={() => toggleTab(t.key)}
                      className={`relative w-11 h-7 rounded-full transition-colors duration-200 touch-target active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                        isHidden ? "bg-gray-700 hover:bg-gray-600" : "bg-blue-600 hover:bg-blue-500"
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
            <p className="text-gray-500 text-xs text-center mt-4">
              v{__APP_VERSION__} · Built {new Date(__BUILD_TIME__).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })},{" "}
              {new Date(__BUILD_TIME__).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button
              onClick={() => { setShowSettings(false); settingsTriggerRef.current?.focus(); }}
              className="mt-6 w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold touch-target hover:brightness-110 active:scale-[0.98] active:bg-blue-700 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
