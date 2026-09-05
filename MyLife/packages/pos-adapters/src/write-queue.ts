import type { WriteQueueItem } from './types';

export function createQueueItem(
  connectionId: string,
  operation: WriteQueueItem['operation'],
  payload: Record<string, unknown>,
  maxAttempts: number = 3,
): WriteQueueItem {
  return {
    id: crypto.randomUUID(),
    connectionId,
    operation,
    payload,
    attempts: 0,
    maxAttempts,
    nextAttemptAt: new Date().toISOString(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

export function getBackoffDelay(attempts: number, baseMs: number = 1000): number {
  return Math.min(baseMs * Math.pow(2, attempts), 60000);
}

export function shouldRetry(item: WriteQueueItem): boolean {
  return item.status === 'pending' && item.attempts < item.maxAttempts;
}

export function markAttempt(item: WriteQueueItem, error?: string): WriteQueueItem {
  const attempts = item.attempts + 1;
  const isDeadLetter = attempts >= item.maxAttempts;
  return {
    ...item,
    attempts,
    status: isDeadLetter ? 'dead_letter' : 'pending',
    error,
    nextAttemptAt: isDeadLetter ? item.nextAttemptAt : new Date(Date.now() + getBackoffDelay(attempts)).toISOString(),
  };
}

export function markCompleted(item: WriteQueueItem): WriteQueueItem {
  return { ...item, status: 'completed' };
}

export function getReadyItems(queue: WriteQueueItem[]): WriteQueueItem[] {
  const now = Date.now();
  return queue.filter(
    (item) => item.status === 'pending' && new Date(item.nextAttemptAt).getTime() <= now,
  );
}

export function getDeadLetterItems(queue: WriteQueueItem[]): WriteQueueItem[] {
  return queue.filter((item) => item.status === 'dead_letter');
}
