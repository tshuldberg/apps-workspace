import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import { createChallenge } from '../../db/challenges';
import { logChallengeProgress, getTotalProgress } from '../../db/challenge-progress';
import {
  getChallengeStatus,
  getActiveChallengeStatuses,
  logBookCompletion,
  logReadingMinutes,
} from '../challenge-engine';

describe('challenge engine', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('books', BOOKS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ── Helpers ──

  function insertTestBook(id: string) {
    const now = new Date().toISOString();
    adapter.execute(
      `INSERT INTO bk_books (id, title, authors, language, format, added_source, created_at, updated_at)
       VALUES (?, ?, ?, 'en', 'physical', 'manual', ?, ?)`,
      [id, 'Test Book', '["Author"]', now, now],
    );
  }

  function createBooksCountChallenge(
    id: string,
    target: number,
    overrides: Record<string, unknown> = {},
  ) {
    return createChallenge(adapter, id, {
      name: `Read ${target} books`,
      challenge_type: 'books_count',
      target_value: target,
      target_unit: 'books',
      time_frame: 'yearly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.999Z',
      ...overrides,
    });
  }

  function createPagesCountChallenge(id: string, target: number) {
    return createChallenge(adapter, id, {
      name: `Read ${target} pages`,
      challenge_type: 'pages_count',
      target_value: target,
      target_unit: 'pages',
      time_frame: 'yearly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.999Z',
    });
  }

  function createMinutesCountChallenge(id: string, target: number) {
    return createChallenge(adapter, id, {
      name: `Read ${target} minutes`,
      challenge_type: 'minutes_count',
      target_value: target,
      target_unit: 'minutes',
      time_frame: 'yearly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.999Z',
    });
  }

  function createThemedChallenge(id: string, target: number, theme: string) {
    return createChallenge(adapter, id, {
      name: theme,
      challenge_type: 'themed',
      target_value: target,
      target_unit: 'books',
      time_frame: 'monthly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-01-31T23:59:59.999Z',
      theme_prompt: theme,
    });
  }

  // ── getChallengeStatus ──

  describe('getChallengeStatus', () => {
    it('returns null for nonexistent challenge', () => {
      const result = getChallengeStatus(adapter, 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns 0% for challenge with no progress', () => {
      createBooksCountChallenge('c1', 12);
      const status = getChallengeStatus(adapter, 'c1');
      expect(status).not.toBeNull();
      expect(status!.currentValue).toBe(0);
      expect(status!.targetValue).toBe(12);
      expect(status!.percentComplete).toBe(0);
      expect(status!.isComplete).toBe(false);
    });

    it('returns correct percentage for partial completion', () => {
      createBooksCountChallenge('c1', 10);
      logChallengeProgress(adapter, 'cp1', {
        challenge_id: 'c1',
        value_added: 3,
      });
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(3);
      expect(status!.percentComplete).toBe(30);
      expect(status!.isComplete).toBe(false);
    });

    it('returns 50% for half completion', () => {
      createBooksCountChallenge('c1', 20);
      logChallengeProgress(adapter, 'cp1', {
        challenge_id: 'c1',
        value_added: 10,
      });
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.percentComplete).toBe(50);
    });

    it('returns 100% and isComplete for exact completion', () => {
      createBooksCountChallenge('c1', 5);
      logChallengeProgress(adapter, 'cp1', {
        challenge_id: 'c1',
        value_added: 5,
      });
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.percentComplete).toBe(100);
      expect(status!.isComplete).toBe(true);
    });

    it('caps at 100% when exceeding target', () => {
      createBooksCountChallenge('c1', 5);
      logChallengeProgress(adapter, 'cp1', {
        challenge_id: 'c1',
        value_added: 8,
      });
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.percentComplete).toBe(100);
      expect(status!.isComplete).toBe(true);
      expect(status!.currentValue).toBe(8); // actual value exceeds target
    });

    it('aggregates multiple progress entries', () => {
      createBooksCountChallenge('c1', 10);
      logChallengeProgress(adapter, 'cp1', {
        challenge_id: 'c1',
        value_added: 2,
      });
      logChallengeProgress(adapter, 'cp2', {
        challenge_id: 'c1',
        value_added: 3,
      });
      logChallengeProgress(adapter, 'cp3', {
        challenge_id: 'c1',
        value_added: 1,
      });
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(6);
      expect(status!.percentComplete).toBe(60);
    });

    it('rounds percentComplete to integer', () => {
      createBooksCountChallenge('c1', 3);
      logChallengeProgress(adapter, 'cp1', {
        challenge_id: 'c1',
        value_added: 1,
      });
      const status = getChallengeStatus(adapter, 'c1');
      // 1/3 * 100 = 33.33... -> rounded to 33
      expect(status!.percentComplete).toBe(33);
    });
  });

  // ── getActiveChallengeStatuses ──

  describe('getActiveChallengeStatuses', () => {
    it('returns empty array when no challenges exist', () => {
      const statuses = getActiveChallengeStatuses(adapter);
      expect(statuses).toEqual([]);
    });

    it('returns statuses for all active challenges', () => {
      createBooksCountChallenge('c1', 12);
      createPagesCountChallenge('c2', 5000);
      logChallengeProgress(adapter, 'cp1', {
        challenge_id: 'c1',
        value_added: 4,
      });

      const statuses = getActiveChallengeStatuses(adapter);
      expect(statuses).toHaveLength(2);
      const booksStatus = statuses.find((s) => s.challenge.id === 'c1');
      const pagesStatus = statuses.find((s) => s.challenge.id === 'c2');
      expect(booksStatus!.currentValue).toBe(4);
      expect(pagesStatus!.currentValue).toBe(0);
    });

    it('excludes inactive challenges', () => {
      createBooksCountChallenge('c1', 12);
      createBooksCountChallenge('c2', 24, { is_active: 0 });

      const statuses = getActiveChallengeStatuses(adapter);
      expect(statuses).toHaveLength(1);
      expect(statuses[0].challenge.id).toBe('c1');
    });
  });

  // ── logBookCompletion ──

  describe('logBookCompletion', () => {
    it('increments books_count challenges by 1', () => {
      createBooksCountChallenge('c1', 10);
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1');
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(1);
    });

    it('increments themed challenges by 1', () => {
      createThemedChallenge('c1', 5, 'Read 5 sci-fi books');
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1');
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(1);
    });

    it('increments pages_count challenges by page count', () => {
      createPagesCountChallenge('c1', 5000);
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1', 350);
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(350);
    });

    it('does not increment pages_count challenge without page count', () => {
      createPagesCountChallenge('c1', 5000);
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1');
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(0);
    });

    it('does not increment pages_count challenge with 0 pages', () => {
      createPagesCountChallenge('c1', 5000);
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1', 0);
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(0);
    });

    it('increments both books_count and pages_count for same book', () => {
      createBooksCountChallenge('c1', 10);
      createPagesCountChallenge('c2', 5000);
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1', 400);

      const booksStatus = getChallengeStatus(adapter, 'c1');
      const pagesStatus = getChallengeStatus(adapter, 'c2');
      expect(booksStatus!.currentValue).toBe(1);
      expect(pagesStatus!.currentValue).toBe(400);
    });

    it('does not affect minutes_count challenges', () => {
      createMinutesCountChallenge('c1', 1000);
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1', 300);
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(0);
    });

    it('does not affect inactive challenges', () => {
      createBooksCountChallenge('c1', 10, { is_active: 0 });
      insertTestBook('book-1');
      logBookCompletion(adapter, 'book-1');
      // getActiveChallenges filters to active, so no progress logged
      const total = getTotalProgress(adapter, 'c1');
      expect(total).toBe(0);
    });
  });

  // ── logReadingMinutes ──

  describe('logReadingMinutes', () => {
    it('increments minutes_count challenges', () => {
      createMinutesCountChallenge('c1', 1000);
      insertTestBook('book-1');
      logReadingMinutes(adapter, 'book-1', 30);
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(30);
    });

    it('does not increment for 0 minutes', () => {
      createMinutesCountChallenge('c1', 1000);
      insertTestBook('book-1');
      logReadingMinutes(adapter, 'book-1', 0);
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(0);
    });

    it('does not increment for negative minutes', () => {
      createMinutesCountChallenge('c1', 1000);
      insertTestBook('book-1');
      logReadingMinutes(adapter, 'book-1', -10);
      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(0);
    });

    it('does not affect books_count or pages_count challenges', () => {
      createBooksCountChallenge('c1', 10);
      createPagesCountChallenge('c2', 5000);
      insertTestBook('book-1');
      logReadingMinutes(adapter, 'book-1', 60);

      expect(getChallengeStatus(adapter, 'c1')!.currentValue).toBe(0);
      expect(getChallengeStatus(adapter, 'c2')!.currentValue).toBe(0);
    });

    it('accumulates across multiple sessions', () => {
      createMinutesCountChallenge('c1', 1000);
      insertTestBook('book-1');
      insertTestBook('book-2');
      logReadingMinutes(adapter, 'book-1', 30);
      logReadingMinutes(adapter, 'book-1', 45);
      logReadingMinutes(adapter, 'book-2', 20);

      const status = getChallengeStatus(adapter, 'c1');
      expect(status!.currentValue).toBe(95);
    });
  });
});
