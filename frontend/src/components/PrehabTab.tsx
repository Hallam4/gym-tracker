import { useState, useEffect, useRef, useCallback } from "react";

type SubView = "warmup" | "rehab";

interface Exercise {
  name: string;
  prescription: string;
}

interface LogEntry {
  date: string;
  type: SubView;
  completed: number;
  total: number;
}

const WARMUP_EXERCISES: Exercise[] = [
  { name: "Band Pull-Aparts", prescription: "2x20" },
  { name: "Band ER (arm at side)", prescription: "2x15 each arm" },
  { name: "Wall Slides", prescription: "2x12" },
  { name: "Band Dislocates", prescription: "2x10" },
  { name: "Scapular Push-Ups", prescription: "1x15" },
  { name: "Light Face Pulls", prescription: "1x15" },
];

const REHAB_EXERCISES: Exercise[] = [
  { name: "Side-lying External Rotation", prescription: "3x15-20" },
  { name: "Band ER at 90/90", prescription: "2-3x12-15" },
  { name: "Band Internal Rotation", prescription: "3x15-20" },
  { name: "Prone Y-T-W Raises", prescription: "2-3x10-12 each" },
  { name: "Ball-on-Wall Circles", prescription: "3x30-45s each direction" },
];

const LOG_KEY = "gym-prehab-log";

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveLog(log: LogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

function playBeep() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.1);
    }
  } catch { /* silent fail */ }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
}

export default function PrehabTab() {
  const [subView, setSubView] = useState<SubView>("warmup");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [log, setLog] = useState<LogEntry[]>(loadLog);
  const [justSaved, setJustSaved] = useState(false);

  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restCountdown, setRestCountdown] = useState<number | null>(null);
  const [restDone, setRestDone] = useState(false);
  const restInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearRestTimer = useCallback(() => {
    if (restInterval.current) clearInterval(restInterval.current);
    restInterval.current = null;
    setRestEnd(null);
    setRestCountdown(null);
    setRestDone(false);
  }, []);

  // Countdown interval
  useEffect(() => {
    if (restEnd === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
      setRestCountdown(remaining);
      if (remaining <= 0) {
        if (restInterval.current) clearInterval(restInterval.current);
        restInterval.current = null;
        setRestEnd(null);
        setRestDone(true);
        playBeep();
        setTimeout(() => setRestDone(false), 2000);
      }
    };
    tick();
    restInterval.current = setInterval(tick, 200);
    return () => {
      if (restInterval.current) clearInterval(restInterval.current);
      restInterval.current = null;
    };
  }, [restEnd]);

  const handleRestTap = () => {
    if (restDone) return;
    if (restEnd !== null) {
      clearRestTimer();
    } else {
      setRestEnd(Date.now() + 30_000);
    }
  };

  const exercises = subView === "warmup" ? WARMUP_EXERCISES : REHAB_EXERCISES;

  // Reset checks when switching sub-view
  useEffect(() => {
    setChecked({});
    setJustSaved(false);
  }, [subView]);

  const completedCount = exercises.filter((e) => checked[e.name]).length;

  const handleComplete = () => {
    const today = new Date().toISOString().slice(0, 10);
    const entry: LogEntry = {
      date: today,
      type: subView,
      completed: completedCount,
      total: exercises.length,
    };

    setLog((prev) => {
      // Dedup: overwrite same (date, type)
      const filtered = prev.filter(
        (e) => !(e.date === today && e.type === subView)
      );
      const next = [entry, ...filtered];
      saveLog(next);
      return next;
    });

    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const recentLog = log.slice(0, 20);

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Prehab</h2>

      {/* Segmented toggle */}
      <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 mb-5">
        {(["warmup", "rehab"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setSubView(v)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              subView === v
                ? "bg-gray-700 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {v === "warmup" ? "Warm-Up" : "Rehab"}
          </button>
        ))}
      </div>

      {/* Rest timer button */}
      <div className="sticky top-0 z-20 backdrop-blur-sm pb-3">
        <button
          onClick={handleRestTap}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
            restDone
              ? "bg-green-600 text-white animate-pulse"
              : restEnd !== null
              ? "bg-blue-600 text-white"
              : "bg-gray-800/60 text-gray-400 ring-1 ring-gray-700/30"
          }`}
        >
          {restDone
            ? "GO"
            : restEnd !== null
            ? `0:${String(restCountdown ?? 0).padStart(2, "0")}`
            : "Rest 0:30"}
        </button>
      </div>

      {/* Exercise list */}
      <div className="space-y-2 mb-5">
        {exercises.map((ex) => (
          <button
            key={ex.name}
            onClick={() =>
              setChecked((prev) => ({ ...prev, [ex.name]: !prev[ex.name] }))
            }
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 active:scale-[0.98] ${
              checked[ex.name]
                ? "bg-green-900/30 ring-1 ring-green-700/50"
                : "bg-gray-800/60 ring-1 ring-gray-700/30"
            }`}
          >
            <div className="text-left">
              <div
                className={`text-sm font-medium ${
                  checked[ex.name] ? "text-green-300" : "text-gray-200"
                }`}
              >
                {ex.name}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {ex.prescription}
              </div>
            </div>
            <div
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-200 ${
                checked[ex.name]
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-500"
              }`}
            >
              {checked[ex.name] && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Complete button */}
      <button
        onClick={handleComplete}
        disabled={completedCount === 0}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
          justSaved
            ? "bg-green-600 text-white"
            : completedCount === 0
            ? "bg-gray-800 text-gray-600 cursor-not-allowed"
            : "bg-blue-600 text-white hover:brightness-110"
        }`}
      >
        {justSaved
          ? "Saved!"
          : `Complete Session (${completedCount}/${exercises.length})`}
      </button>

      {/* Recent log */}
      {recentLog.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Log
          </h3>
          <div className="space-y-2">
            {recentLog.map((entry, i) => (
              <div
                key={`${entry.date}-${entry.type}-${i}`}
                className="flex items-center justify-between px-4 py-2.5 bg-gray-800/40 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-300">
                    {new Date(entry.date + "T12:00:00").toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      entry.type === "warmup"
                        ? "bg-orange-900/40 text-orange-400"
                        : "bg-purple-900/40 text-purple-400"
                    }`}
                  >
                    {entry.type === "warmup" ? "Warm-Up" : "Rehab"}
                  </span>
                </div>
                <span
                  className={`text-sm font-medium ${
                    entry.completed === entry.total
                      ? "text-green-400"
                      : "text-gray-400"
                  }`}
                >
                  {entry.completed}/{entry.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
