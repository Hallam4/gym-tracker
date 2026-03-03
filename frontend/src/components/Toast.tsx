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
      className={`fixed bottom-20 left-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium text-center animate-slide-up ${
        type === "success"
          ? "bg-green-700 text-white"
          : "bg-red-700 text-white"
      }`}
    >
      {message}
    </div>
  );
}
