interface Props {
  title: string;
  summary: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, summary, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm ring-1 ring-gray-800/60 animate-modal-in">
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-gray-400 mb-6">{summary}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 font-medium active:bg-gray-600 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-green-700 text-white font-medium active:bg-green-600 transition-colors duration-150"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
