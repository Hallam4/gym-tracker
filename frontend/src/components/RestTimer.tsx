import { useState, useEffect, useCallback, useRef } from "react";

interface Props {
  defaultSeconds: number;
  onTimerComplete: (elapsed: number) => void;
  onDismiss: () => void;
  visible: boolean;
}

export default function RestTimer({
  defaultSeconds,
  onTimerComplete,
  onDismiss,
  visible,
}: Props) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (visible) {
      setSeconds(defaultSeconds);
      setIsRunning(true);
      startTimeRef.current = Date.now();
    } else {
      setIsRunning(false);
    }
  }, [visible, defaultSeconds]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, defaultSeconds - elapsed);
      setSeconds(remaining);

      if (remaining === 0) {
        setIsRunning(false);
        onTimerComplete(elapsed);
      }
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, defaultSeconds, onTimerComplete]);

  const handleSkip = useCallback(() => {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setIsRunning(false);
    onTimerComplete(elapsed);
    onDismiss();
  }, [onTimerComplete, onDismiss]);

  const handleAdd30 = useCallback(() => {
    startTimeRef.current += 30000;
    setSeconds((s) => s + 30);
  }, []);

  if (!visible) return null;

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const progress = defaultSeconds > 0 ? (defaultSeconds - seconds) / defaultSeconds : 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-2xl p-8 text-center w-72">
        <div className="text-sm text-gray-400 mb-2">Rest Timer</div>

        {/* Circular progress */}
        <div className="relative w-40 h-40 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#1f2937"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${progress * 283} 283`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-bold text-white font-mono">
              {minutes}:{secs.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={handleAdd30}
            className="px-4 py-3 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium touch-target"
          >
            +30s
          </button>
          <button
            onClick={handleSkip}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold touch-target"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
