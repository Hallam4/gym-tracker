import { useState, useEffect } from "react";
import { PREHAB_SECTIONS, SectionId, PrehabExercise } from "../data/prehabData";
import { usePrehabSession } from "../hooks/usePrehabSession";
import { useSessionTimer } from "../hooks/useSessionTimer";
import { overallProgress, sectionProgress, activeExercise } from "../lib/prehabSession";
import { usePrehabLevels } from "../hooks/usePrehabLevels";
import SessionTimer from "./SessionTimer";
import PrehabSection from "./PrehabSection";
import Toast from "./Toast";

const TIMER_KEY = "gym-prehab-v2-timer";

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function PrehabTab() {
  const { day, log, setSetsDone, setWeight, setNotes, completeSession, isSaving, isSaved, saveError } = usePrehabSession();
  const { levels, setLevel } = usePrehabLevels();
  const timer = useSessionTimer(TIMER_KEY);
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    shoulderrehab: true,
    shoulders: false,
    lowerback: false,
    proprioception: false,
    assessment: false,
  });
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Show "Saved!" briefly after a successful save, then revert (mutation.isSuccess stays true).
  useEffect(() => {
    if (!isSaved) return;
    setJustSaved(true);
    timer.resetStopwatch(); // clock resets when a session is completed
    const t = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(t);
  }, [isSaved]);

  const overall = overallProgress(day, levels);
  const pct = overall.total > 0 ? Math.round((overall.done / overall.total) * 100) : 0;

  // Look up an exercise to decide whether logging a set should start a rest.
  const exById = (exId: string): PrehabExercise | undefined =>
    PREHAB_SECTIONS.flatMap((s) => s.exercises).find((e) => e.id === exId);

  const handleSetsDone = (exId: string, setsDone: number) => {
    const prev = day.entries[exId]?.setsDone ?? 0;
    setSetsDone(exId, setsDone);
    const raw = exById(exId);
    const ex = raw ? activeExercise(raw, levels[exId] ?? 1) : undefined;
    if (ex && setsDone > prev && (ex.kind === "loaded" || ex.kind === "reps")) {
      timer.startRest();
    }
  };

  const handleComplete = () => {
    setErrorDismissed(false);
    completeSession(levels);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-white">Daily Prehab</h2>
        <span className="text-xs text-gray-500">{fmtDate(day.date)}</span>
      </div>

      <SessionTimer timer={timer} />

      {/* Overall progress */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2.5 bg-gray-800 rounded-full overflow-hidden" role="progressbar" aria-valuenow={overall.done} aria-valuemin={0} aria-valuemax={overall.total}>
          <div className="h-full rounded-full bg-gradient-to-r from-green-600 to-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-xs tabular-nums ${pct >= 100 ? "text-green-400" : "text-gray-300"}`}>
          {overall.done}/{overall.total}
        </span>
      </div>

      {/* Sections */}
      {PREHAB_SECTIONS.map((section) => (
        <PrehabSection
          key={section.id}
          section={section}
          day={day}
          progress={sectionProgress(section.id, day, levels)}
          levels={levels}
          open={open[section.id]}
          onToggle={() => setOpen((o) => ({ ...o, [section.id]: !o[section.id] }))}
          onSetsDone={handleSetsDone}
          onWeightChange={setWeight}
          onLevelChange={setLevel}
        />
      ))}

      {/* Notes (saved with today's session) */}
      <div className="mt-4">
        <label htmlFor="prehab-notes" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes</label>
        <textarea
          id="prehab-notes"
          value={day.notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Niggles, loads, how a level felt… (saved with today's session)"
          rows={2}
          className="w-full rounded-xl bg-gray-900 ring-1 ring-gray-800/60 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />
      </div>

      {/* Complete */}
      <button
        onClick={handleComplete}
        disabled={overall.done === 0 || isSaving}
        className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg touch-target transition-all duration-200 active:scale-[0.98] ${
          justSaved
            ? "bg-green-600 text-white"
            : overall.done === 0 || isSaving
              ? "bg-gray-800 text-gray-600 cursor-not-allowed"
              : "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-700/25 hover:brightness-110"
        }`}
      >
        {isSaving ? "Saving…" : justSaved ? "Saved!" : `Complete Session (${overall.done}/${overall.total})`}
      </button>

      {/* Recent log */}
      {log.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Log</h3>
          <div className="space-y-2">
            {log.slice(0, 20).map((entry) => (
              <div key={entry.date} className="px-4 py-2.5 bg-gray-800/40 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{fmtDate(entry.date)}</span>
                  <span className={`text-sm font-medium ${entry.done === entry.total ? "text-green-400" : "text-gray-400"}`}>
                    {entry.done}/{entry.total}
                  </span>
                </div>
                {entry.notes && (
                  <p className="mt-1 text-xs text-gray-400 whitespace-pre-wrap">📝 {entry.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {saveError && !errorDismissed && (
        <Toast
          message="Couldn't save — check your connection and try again."
          type="error"
          onDismiss={() => setErrorDismissed(true)}
        />
      )}

      {/* Spacer so the floating clock doesn't cover the last content */}
      <div aria-hidden="true" className="h-20" />
    </div>
  );
}
