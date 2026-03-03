import { useRef, useCallback, useEffect } from "react";

export interface QueuedUpdate {
  row: number;
  col: number;
  value: string;
}

interface UseWriteQueueOptions {
  debounceMs?: number;
  onFlush: (updates: QueuedUpdate[]) => Promise<unknown> | void;
}

export interface UseWriteQueueReturn {
  enqueue: (update: QueuedUpdate) => void;
  flush: () => Promise<void>;
}

export function useWriteQueue({
  debounceMs = 800,
  onFlush,
}: UseWriteQueueOptions): UseWriteQueueReturn {
  const queueRef = useRef<Map<string, QueuedUpdate>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    const queue = queueRef.current;
    if (queue.size === 0) return;
    const updates = Array.from(queue.values());
    queue.clear();
    await onFlushRef.current(updates);
  }, []);

  const enqueue = useCallback(
    (update: QueuedUpdate) => {
      const key = `${update.row}:${update.col}`;
      queueRef.current.set(key, update);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, debounceMs);
    },
    [debounceMs, flush]
  );

  // Auto-flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (queueRef.current.size > 0) {
        const updates = Array.from(queueRef.current.values());
        queueRef.current.clear();
        onFlushRef.current(updates);
      }
    };
  }, []);

  return { enqueue, flush };
}
