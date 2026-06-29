import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_REST_S = 60;

interface Persisted {
  seconds: number;
  running: boolean;
  restEnd: number | null;
}

function readPersisted(storageKey: string): Persisted | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch { /* ignore */ }
  return null;
}

export function useSessionTimer(storageKey: string) {
  const [seconds, setSeconds] = useState<number>(() => readPersisted(storageKey)?.seconds ?? 0);
  const [running, setRunning] = useState<boolean>(() => readPersisted(storageKey)?.running ?? false);
  const [restEnd, setRestEnd] = useState<number | null>(() => {
    const p = readPersisted(storageKey);
    return p?.restEnd && p.restEnd > Date.now() ? p.restEnd : null;
  });
  const [restCountdown, setRestCountdown] = useState<number | null>(null);
  const [restDone, setRestDone] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval>>();
  const soundRef = useRef<ReturnType<typeof setInterval>>();
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressFired = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ seconds, running, restEnd }));
    } catch { /* ignore */ }
  }, [storageKey, seconds, running, restEnd]);

  // Stopwatch tick
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!running) return;
    tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [running]);

  const initAudio = useCallback(() => {
    try {
      if (!audioRef.current || audioRef.current.state === "closed") {
        audioRef.current = new AudioContext();
      }
      if (audioRef.current.state === "suspended") {
        audioRef.current.resume().catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  const beep = useCallback((count: number) => {
    const ctx = audioRef.current;
    if (!ctx || ctx.state === "closed") return;
    const play = () => {
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.value = 0.4;
      for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        osc.connect(gain);
        osc.frequency.value = 880;
        const t = ctx.currentTime + i * 0.25;
        osc.start(t);
        osc.stop(t + 0.15);
      }
    };
    if (ctx.state === "suspended") ctx.resume().then(play).catch(() => {});
    else play();
  }, []);

  // Rest countdown
  useEffect(() => {
    if (!restEnd) {
      setRestCountdown(null);
      return;
    }
    const run = () => {
      const remaining = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
      setRestCountdown(remaining);
      if (remaining <= 0 && !restDone) {
        setRestDone(true);
        try { navigator.vibrate?.([200, 100, 200, 100, 200]); } catch { /* ignore */ }
        beep(3);
        if (soundRef.current) clearInterval(soundRef.current);
        soundRef.current = setInterval(() => {
          beep(2);
          try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
        }, 3000);
      }
    };
    run();
    const id = setInterval(run, 250);
    return () => clearInterval(id);
  }, [restEnd, restDone, beep]);

  // Cleanup
  useEffect(() => () => {
    if (soundRef.current) clearInterval(soundRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  const startRest = useCallback((secs: number = DEFAULT_REST_S) => {
    initAudio();
    if (soundRef.current) clearInterval(soundRef.current);
    setRestDone(false);
    setRestEnd(Date.now() + secs * 1000);
  }, [initAudio]);

  const dismissRest = useCallback(() => {
    setRestEnd(null);
    setRestCountdown(null);
    setRestDone(false);
    if (soundRef.current) clearInterval(soundRef.current);
  }, []);

  const toggleRun = useCallback(() => {
    initAudio();
    if (!longPressFired.current) setRunning((r) => !r);
  }, [initAudio]);

  const resetStopwatch = useCallback(() => {
    setRunning(false);
    setSeconds(0);
  }, []);

  const onPressStart = useCallback(() => {
    longPressFired.current = false;
    longPressRef.current = setTimeout(() => {
      longPressFired.current = true;
      dismissRest();
      try { navigator.vibrate?.(50); } catch { /* ignore */ }
    }, 500);
  }, [dismissRest]);

  const onPressEnd = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  return {
    seconds,
    running,
    restCountdown,
    restDone,
    restActive: restEnd !== null,
    toggleRun,
    resetStopwatch,
    startRest,
    dismissRest,
    initAudio,
    longPress: {
      onTouchStart: onPressStart,
      onTouchEnd: onPressEnd,
      onMouseDown: onPressStart,
      onMouseUp: onPressEnd,
      onMouseLeave: onPressEnd,
    },
  };
}
