interface Props {
  title: string;
  summary: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, summary, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-400 mb-6">{summary}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg bg-gray-700 text-gray-300 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-lg bg-green-700 text-white font-medium"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
