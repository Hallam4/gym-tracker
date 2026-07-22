import { useSessionTimer } from "../hooks/useSessionTimer";

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

const HOLD_PRESETS = [30, 60, 90];

export default function SessionTimer({ timer }: { timer: ReturnType<typeof useSessionTimer> }) {
  const { seconds, running, restCountdown, restDone, restActive, toggleRun, dismissRest, startRest, longPress } = timer;

  return (
    <>
      {restDone && (
        <div
          className="fixed inset-0 z-10 flex flex-col items-center justify-center go-overlay-pulse"
          onClick={dismissRest}
          role="alert"
          aria-live="assertive"
        >
          <div className="text-7xl font-black text-green-400 go-text-pulse">GO</div>
          <div className="text-sm text-gray-400 mt-4">tap to dismiss</div>
        </div>
      )}

      {/* Floating, always-visible clock cluster. PrehabTab is the only mount point, so it
          shows only during prehab. Sits just above the fixed bottom nav bar. */}
      <div className="fixed inset-x-0 bottom-20 z-30 pointer-events-none">
        <div className="max-w-lg mx-auto px-4 flex items-end justify-end gap-2">
          {/* Hold-countdown presets — hidden while a countdown is already running (single channel) */}
          {!restActive && (
            <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-gray-900/90 ring-1 ring-gray-800/60 backdrop-blur-sm px-2 py-1 shadow-lg">
              <span className="text-[10px] uppercase tracking-wide text-gray-500 mr-0.5">hold</span>
              {HOLD_PRESETS.map((s) => (
                <button
                  key={s}
                  onClick={() => startRest(s)}
                  aria-label={`Start ${s} second hold countdown`}
                  className="min-w-[32px] h-8 px-2 rounded-full bg-gray-800 text-gray-200 text-xs font-mono tabular-nums active:scale-90 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Stopwatch (up-count) / rest+hold countdown */}
          <button
            onClick={toggleRun}
            {...longPress}
            aria-label={restActive
              ? (restDone ? "Countdown complete. Long-press to dismiss." : `Countdown: ${restCountdown} seconds. Tap to ${running ? "pause" : "resume"} stopwatch.`)
              : (running ? "Pause stopwatch. Long-press to reset." : "Start stopwatch. Long-press to reset.")}
            className={`pointer-events-auto rounded-2xl px-5 py-2 shadow-lg ring-1 ring-gray-800/60 touch-target active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${restDone ? "bg-green-600/20 rest-done-flash" : "bg-gray-900/90 backdrop-blur-sm hover:bg-gray-800/90"}`}
            role="timer"
          >
            {restActive ? (
              <div className="text-center">
                {restDone ? (
                  <div className="text-2xl font-bold text-green-400">GO</div>
                ) : (
                  <div className="text-2xl font-mono font-bold text-white tabular-nums">{fmt(restCountdown ?? 0)}</div>
                )}
                <div className={`text-xs font-mono mt-0.5 ${running ? "text-gray-300" : "text-gray-500"}`}>
                  {!running && seconds > 0 && <span className="mr-1">❚❚</span>}
                  {fmt(seconds)}
                </div>
              </div>
            ) : (
              <span className={`text-xl font-mono tabular-nums ${running ? "text-white" : "text-gray-400"}`}>
                {!running && seconds > 0 && <span className="text-gray-500 mr-1 text-base">❚❚</span>}
                {fmt(seconds)}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
