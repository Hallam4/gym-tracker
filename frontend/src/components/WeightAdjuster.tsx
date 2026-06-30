interface Props {
  weight: string;
  step: number;
  onWeightChange: (weight: string) => void;
}

export default function WeightAdjuster({ weight, step, onWeightChange }: Props) {
  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight) || 0;
    onWeightChange(String(Math.max(0, current + delta)));
  };

  return (
    <div className="flex items-center justify-center gap-4 mt-4">
      <button
        onClick={() => adjustWeight(-step)}
        aria-label={`Decrease weight by ${step}kg`}
        className="w-11 h-11 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 active:scale-90 transition-all duration-150"
      >
        −
      </button>
      <div className="text-center min-w-[72px]">
        <div className="text-2xl font-bold text-white tabular-nums">{weight === "" ? 0 : weight} <span className="text-sm font-normal text-gray-300">kg</span></div>
      </div>
      <button
        onClick={() => adjustWeight(step)}
        aria-label={`Increase weight by ${step}kg`}
        className="w-11 h-11 rounded-full bg-gray-800 text-white text-lg font-bold touch-target flex items-center justify-center ring-1 ring-gray-700/50 active:scale-90 transition-all duration-150"
      >
        +
      </button>
    </div>
  );
}
