interface Props {
  sets: number;
  setsDone: number;
  label: string;      // used in the group aria-label
  onSetsDone: (setsDone: number) => void;
}

export default function SetButtonGrid({ sets, setsDone, label, onSetsDone }: Props) {
  // Tapping set i: if it's already filled, undo down to i; else fill up to i+1.
  const tapSet = (i: number) => onSetsDone(i < setsDone ? i : i + 1);

  return (
    <div className="grid gap-2.5 mt-3" style={{ gridTemplateColumns: `repeat(${Math.min(sets, 5)}, minmax(0, 1fr))` }} role="group" aria-label={`Sets for ${label}`}>
      {Array.from({ length: sets }, (_, i) => {
        const done = i < setsDone;
        return (
          <button
            key={i}
            onClick={() => tapSet(i)}
            aria-label={done ? `Set ${i + 1} done. Tap to undo.` : `Log set ${i + 1}.`}
            className={`h-11 rounded-lg font-bold text-base touch-target transition-all duration-150 active:scale-95 ${done ? "bg-green-700 text-white" : "bg-gray-800 text-gray-400"}`}
          >
            {done ? <span aria-hidden="true">&#10003;</span> : `S${i + 1}`}
          </button>
        );
      })}
    </div>
  );
}
