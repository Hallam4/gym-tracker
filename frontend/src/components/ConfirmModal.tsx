import { useEffect, useRef } from "react";

interface Props {
  title: string;
  summary: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, summary, onConfirm, onCancel }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusableEls = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];
    firstEl?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl?.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl?.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-summary"
      ref={modalRef}
    >
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm ring-1 ring-gray-800/60 animate-modal-in">
        <h2 id="confirm-title" className="text-lg font-bold text-white mb-2">{title}</h2>
        <p id="confirm-summary" className="text-sm text-gray-400 mb-6">{summary}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl bg-gray-700 text-gray-300 font-medium touch-target hover:bg-gray-600 active:bg-gray-600 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-2xl bg-green-700 text-white font-medium touch-target hover:bg-green-600 active:bg-green-600 active:scale-[0.98] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
