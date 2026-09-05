import { describe, it, expect } from 'vitest';
import { createQueueItem, getBackoffDelay, shouldRetry, markAttempt, markCompleted, getReadyItems, getDeadLetterItems } from '../src/write-queue';
import type { WriteQueueItem } from '../src/types';

describe('write-queue', () => {
  describe('createQueueItem', () => {
    it('creates a pending item with correct defaults', () => {
      const item = createQueueItem('conn-1', 'create', { guestName: 'Alice' });
      expect(item.connectionId).toBe('conn-1');
      expect(item.operation).toBe('create');
      expect(item.payload).toEqual({ guestName: 'Alice' });
      expect(item.attempts).toBe(0);
      expect(item.maxAttempts).toBe(3);
      expect(item.status).toBe('pending');
      expect(item.id).toBeTruthy();
    });

    it('respects custom maxAttempts', () => {
      const item = createQueueItem('conn-1', 'update', {}, 5);
      expect(item.maxAttempts).toBe(5);
    });
  });

  describe('getBackoffDelay', () => {
    it('returns exponential backoff', () => {
      expect(getBackoffDelay(0)).toBe(1000);
      expect(getBackoffDelay(1)).toBe(2000);
      expect(getBackoffDelay(2)).toBe(4000);
      expect(getBackoffDelay(3)).toBe(8000);
    });

    it('caps at 60 seconds', () => {
      expect(getBackoffDelay(10)).toBe(60000);
      expect(getBackoffDelay(20)).toBe(60000);
    });

    it('respects custom base', () => {
      expect(getBackoffDelay(0, 500)).toBe(500);
      expect(getBackoffDelay(1, 500)).toBe(1000);
    });
  });

  describe('shouldRetry', () => {
    it('returns true for pending items below max attempts', () => {
      const item = createQueueItem('c1', 'create', {});
      expect(shouldRetry(item)).toBe(true);
    });

    it('returns false for completed items', () => {
      const item = markCompleted(createQueueItem('c1', 'create', {}));
      expect(shouldRetry(item)).toBe(false);
    });

    it('returns false when attempts >= maxAttempts', () => {
      let item = createQueueItem('c1', 'create', {}, 1);
      item = markAttempt(item, 'failed');
      expect(shouldRetry(item)).toBe(false);
    });
  });

  describe('markAttempt', () => {
    it('increments attempt count', () => {
      const item = createQueueItem('c1', 'create', {});
      const updated = markAttempt(item, 'timeout');
      expect(updated.attempts).toBe(1);
      expect(updated.error).toBe('timeout');
      expect(updated.status).toBe('pending');
    });

    it('moves to dead letter when max attempts reached', () => {
      let item = createQueueItem('c1', 'create', {}, 2);
      item = markAttempt(item, 'err1');
      expect(item.status).toBe('pending');
      item = markAttempt(item, 'err2');
      expect(item.status).toBe('dead_letter');
    });
  });

  describe('getReadyItems', () => {
    it('returns items whose nextAttemptAt is in the past', () => {
      const ready = createQueueItem('c1', 'create', {});
      const notReady: WriteQueueItem = {
        ...createQueueItem('c2', 'update', {}),
        nextAttemptAt: new Date(Date.now() + 60000).toISOString(),
      };
      const completed = markCompleted(createQueueItem('c3', 'cancel', {}));

      const result = getReadyItems([ready, notReady, completed]);
      expect(result).toHaveLength(1);
      expect(result[0].connectionId).toBe('c1');
    });
  });

  describe('getDeadLetterItems', () => {
    it('returns only dead letter items', () => {
      const pending = createQueueItem('c1', 'create', {});
      let deadLetter = createQueueItem('c2', 'update', {}, 1);
      deadLetter = markAttempt(deadLetter, 'fatal');

      const result = getDeadLetterItems([pending, deadLetter]);
      expect(result).toHaveLength(1);
      expect(result[0].connectionId).toBe('c2');
    });
  });
});
