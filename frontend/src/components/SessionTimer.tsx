import { useSessionTimer } from "../hooks/useSessionTimer";

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export default function SessionTimer({ timer }: { timer: ReturnType<typeof useSessionTimer> }) {
  const { seconds, running, restCountdown, restDone, restActive, toggleRun, dismissRest, longPress } = timer;

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

      <div className={`flex items-center justify-center mb-3 ${restActive ? "sticky top-0 z-20 py-2 -mx-4 px-4 bg-gray-950/90 backdrop-blur-sm" : ""}`}>
        <button
          onClick={toggleRun}
          {...longPress}
          aria-label={restActive
            ? (restDone ? "Rest complete. Long-press to dismiss." : `Rest: ${restCountdown} seconds. Tap to ${running ? "pause" : "resume"} stopwatch.`)
            : (running ? "Pause stopwatch" : "Start stopwatch")}
          className={`rounded-xl px-6 py-2 touch-target hover:bg-gray-700/70 active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${restDone ? "bg-green-600/20 rest-done-flash" : "bg-gray-800/70"}`}
          role="timer"
        >
          {restActive ? (
            <div className="text-center">
              {restDone ? (
                <div className="text-2xl font-bold text-green-400">GO</div>
              ) : (
                <div className="text-2xl font-mono font-bold text-white tabular-nums">{fmt(restCountdown ?? 0)}</div>
              )}
              <div className={`text-xs font-mono mt-1 ${running ? "text-gray-300" : "text-gray-500"}`}>
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
    </>
  );
}
