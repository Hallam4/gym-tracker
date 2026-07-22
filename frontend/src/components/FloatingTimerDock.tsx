import { ReactNode } from "react";

/**
 * Shared floating shell for the session clock, used by BOTH the Prehab tab
 * (SessionTimer) and the Today workout tab. It owns the fixed dock placement
 * (bottom-right, above the nav bar, safe-area aware) and the single full-screen
 * "GO" overlay. Each tab renders its own timer control as `children` — a gym
 * session and a prehab session are distinct (different rest rules + storage),
 * so timer state stays per-tab. Only the active tab's dock renders (Prehab is
 * conditionally mounted; Today lives under a display:none wrapper), so the two
 * never stack.
 */
export default function FloatingTimerDock({
  showGo,
  onDismissGo,
  children,
}: {
  showGo: boolean;
  onDismissGo: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {showGo && (
        <div
          className="fixed inset-0 z-10 flex flex-col items-center justify-center go-overlay-pulse"
          onClick={onDismissGo}
          role="alert"
          aria-live="assertive"
        >
          <div className="text-7xl font-black text-green-400 go-text-pulse">GO</div>
          <div className="text-sm text-gray-400 mt-4">tap to dismiss</div>
        </div>
      )}

      <div
        className="fixed inset-x-0 z-30 pointer-events-none"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-lg mx-auto px-4 flex items-end justify-end gap-2">
          {children}
        </div>
      </div>
    </>
  );
}
