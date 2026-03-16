export interface Break {
  exercise: string;
  afterSet: number;
  duration: number;
}

export interface TimingAnalysis {
  activeSeconds: number;
  totalSeconds: number;
  breaks: Break[];
}

export function analyzeTimings(
  setTimesMap: Record<string, (number | null)[]>,
  totalDuration: number,
  breakThreshold = 1500 // 25 minutes
): TimingAnalysis {
  // Collect all timestamps with their exercise context
  const stamps: { time: number; exercise: string; setIndex: number }[] = [];
  for (const [exercise, times] of Object.entries(setTimesMap)) {
    for (let i = 0; i < times.length; i++) {
      if (times[i] != null) {
        stamps.push({ time: times[i]!, exercise, setIndex: i });
      }
    }
  }

  stamps.sort((a, b) => a.time - b.time);

  const breaks: Break[] = [];
  let breakTotal = 0;

  for (let i = 1; i < stamps.length; i++) {
    const delta = stamps[i].time - stamps[i - 1].time;
    if (delta >= breakThreshold) {
      breaks.push({
        exercise: stamps[i - 1].exercise,
        afterSet: stamps[i - 1].setIndex + 1,
        duration: delta,
      });
      breakTotal += delta;
    }
  }

  return {
    activeSeconds: totalDuration - breakTotal,
    totalSeconds: totalDuration,
    breaks,
  };
}

export function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ""}`;
  return `${m}m`;
}
