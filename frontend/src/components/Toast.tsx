import { useEffect } from "react";

interface Props {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
}

export default function Toast({ message, type, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-24 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-50 px-4 py-3 rounded-2xl text-sm font-medium text-center animate-slide-up backdrop-blur-sm shadow-lg ${
        type === "success"
          ? "bg-green-700/90 text-white shadow-green-900/30"
          : "bg-red-700/90 text-white shadow-red-900/30"
      }`}
    >
      {type === "error" && <span aria-hidden="true" className="mr-1">&#9888;</span>}
      {type === "success" && <span aria-hidden="true" className="mr-1">&#10003;</span>}
      {message}
    </div>
  );
}
