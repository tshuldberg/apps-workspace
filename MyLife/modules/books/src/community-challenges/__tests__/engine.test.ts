import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { BOOKS_MODULE } from '../../definition';
import {
  createCommunityChallenge,
  getCommunityChallenge,
  joinChallenge,
  getParticipation,
  getActiveParticipations,
  abandonParticipation,
  completeParticipation,
  updateParticipationProgress,
} from '../../db/community-challenges';
import {
  updateCommunityProgress,
  getGenreDiversity,
  getAuthorDiversity,
  checkThemedMatch,
  getChallengeTimeStatus,
  getCommunityChallengesWithProgress,
} from '../engine';
import { PRESET_IDS } from '../templates';

describe('community challenges engine', () => {
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

  function insertTestBook(id: string, authors: string = '["Author A"]') {
    const now = new Date().toISOString();
    adapter.execute(
      `INSERT INTO bk_books (id, title, authors, language, format, added_source, created_at, updated_at)
       VALUES (?, ?, ?, 'en', 'physical', 'manual', ?, ?)`,
      [id, `Test Book ${id}`, authors, now, now],
    );
  }

  function finishBook(bookId: string, finishedAt: string) {
    const sessionId = `session-${bookId}`;
    const now = new Date().toISOString();
    adapter.execute(
      `INSERT INTO bk_reading_sessions (id, book_id, status, finished_at, current_page, created_at, updated_at)
       VALUES (?, ?, 'finished', ?, 0, ?, ?)`,
      [sessionId, bookId, finishedAt, now, now],
    );
  }

  function addMoodTag(bookId: string, tagType: string, value: string) {
    const id = `tag-${bookId}-${tagType}-${value}`;
    const now = new Date().toISOString();
    adapter.execute(
      `INSERT OR IGNORE INTO bk_mood_tags (id, book_id, tag_type, value, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, bookId, tagType, value, now],
    );
  }

  function createBooksCountChallenge(id: string, target: number, overrides: Record<string, unknown> = {}) {
    return createCommunityChallenge(adapter, id, {
      name: `Read ${target} books`,
      description: `Read ${target} books challenge`,
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
    return createCommunityChallenge(adapter, id, {
      name: `Read ${target} pages`,
      description: `Read ${target} pages challenge`,
      challenge_type: 'pages_count',
      target_value: target,
      target_unit: 'pages',
      time_frame: 'yearly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.999Z',
    });
  }

  function createGenreDiversityChallenge(id: string, target: number) {
    return createCommunityChallenge(adapter, id, {
      name: `${target} genres`,
      description: `Read from ${target} genres challenge`,
      challenge_type: 'genre_diversity',
      target_value: target,
      target_unit: 'genres',
      time_frame: 'yearly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.999Z',
    });
  }

  function createAuthorDiversityChallenge(id: string, target: number) {
    return createCommunityChallenge(adapter, id, {
      name: `${target} authors`,
      description: `Read from ${target} authors challenge`,
      challenge_type: 'author_diversity',
      target_value: target,
      target_unit: 'authors',
      time_frame: 'yearly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.999Z',
    });
  }

  function createThemedChallenge(id: string, target: number, tags: string[]) {
    return createCommunityChallenge(adapter, id, {
      name: `Themed: ${tags.join(', ')}`,
      description: `Read ${target} themed books`,
      challenge_type: 'themed',
      target_value: target,
      target_unit: 'books',
      time_frame: 'yearly',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.999Z',
      theme_tags: JSON.stringify(tags),
    });
  }

  // ── joinChallenge ──

  it('joinChallenge creates participation record', () => {
    createBooksCountChallenge('cc-1', 10);
    const participation = joinChallenge(adapter, 'part-1', 'cc-1');

    expect(participation.id).toBe('part-1');
    expect(participation.challenge_id).toBe('cc-1');
    expect(participation.status).toBe('active');
    expect(participation.current_value).toBe(0);
    expect(participation.completed_at).toBeNull();
  });

  // ── abandonChallenge ──

  it('abandonChallenge sets status to abandoned', () => {
    createBooksCountChallenge('cc-1', 10);
    joinChallenge(adapter, 'part-1', 'cc-1');
    abandonParticipation(adapter, 'part-1');

    const participation = getParticipation(adapter, 'part-1');
    expect(participation).not.toBeNull();
    expect(participation!.status).toBe('abandoned');
  });

  // ── completeChallenge ──

  it('completeChallenge sets status to completed', () => {
    createBooksCountChallenge('cc-1', 10);
    joinChallenge(adapter, 'part-1', 'cc-1');
    completeParticipation(adapter, 'part-1');

    const participation = getParticipation(adapter, 'part-1');
    expect(participation).not.toBeNull();
    expect(participation!.status).toBe('completed');
    expect(participation!.completed_at).not.toBeNull();
  });

  // ── autoProgressBooksCount ──

  it('autoProgressBooksCount increments for books_count challenges', () => {
    createBooksCountChallenge('cc-1', 10);
    joinChallenge(adapter, 'part-1', 'cc-1');
    insertTestBook('book-1');

    const updates = updateCommunityProgress(adapter, 'book-1');

    expect(updates).toHaveLength(1);
    expect(updates[0].newValue).toBe(1);
    expect(updates[0].isComplete).toBe(false);
  });

  // ── autoProgressGenreDiversity ──

  it('autoProgressGenreDiversity counts distinct genres correctly', () => {
    createGenreDiversityChallenge('cc-1', 3);
    joinChallenge(adapter, 'part-1', 'cc-1');

    // Set up books with genres
    insertTestBook('book-1');
    insertTestBook('book-2');
    insertTestBook('book-3');
    finishBook('book-1', '2026-03-15T10:00:00.000Z');
    finishBook('book-2', '2026-03-16T10:00:00.000Z');
    finishBook('book-3', '2026-03-17T10:00:00.000Z');
    addMoodTag('book-1', 'genre', 'science-fiction');
    addMoodTag('book-2', 'genre', 'fantasy');
    addMoodTag('book-3', 'genre', 'mystery');

    const genreCount = getGenreDiversity(adapter, '2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z');
    expect(genreCount).toBe(3);
  });

  // ── autoProgressAuthorDiversity ──

  it('autoProgressAuthorDiversity counts distinct authors correctly', () => {
    createAuthorDiversityChallenge('cc-1', 3);
    joinChallenge(adapter, 'part-1', 'cc-1');

    insertTestBook('book-1', '["Author A"]');
    insertTestBook('book-2', '["Author B"]');
    insertTestBook('book-3', '["Author C"]');
    finishBook('book-1', '2026-03-15T10:00:00.000Z');
    finishBook('book-2', '2026-03-16T10:00:00.000Z');
    finishBook('book-3', '2026-03-17T10:00:00.000Z');

    const authorCount = getAuthorDiversity(adapter, '2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z');
    expect(authorCount).toBe(3);
  });

  // ── autoProgressThemed ──

  it('autoProgressThemed increments when theme_tags match', () => {
    createThemedChallenge('cc-1', 3, ['science-fiction', 'cyberpunk']);
    joinChallenge(adapter, 'part-1', 'cc-1');

    insertTestBook('book-1');
    addMoodTag('book-1', 'genre', 'science-fiction');

    const updates = updateCommunityProgress(adapter, 'book-1');

    expect(updates).toHaveLength(1);
    expect(updates[0].newValue).toBe(1);
  });

  // ── doesNotCountOutsidePeriod ──

  it('doesNotCountOutsidePeriod excludes books finished outside date range', () => {
    createGenreDiversityChallenge('cc-1', 3);
    joinChallenge(adapter, 'part-1', 'cc-1');

    insertTestBook('book-1');
    // Finished in 2025, outside the 2026 challenge period
    finishBook('book-1', '2025-06-15T10:00:00.000Z');
    addMoodTag('book-1', 'genre', 'science-fiction');

    const genreCount = getGenreDiversity(adapter, '2026-01-01T00:00:00.000Z', '2026-12-31T23:59:59.999Z');
    expect(genreCount).toBe(0);
  });

  // ── challengeExpiry ──

  it('challengeExpiry shows past end_date as expired', () => {
    const challenge = createCommunityChallenge(adapter, 'cc-1', {
      name: 'Expired challenge',
      description: 'Already ended',
      challenge_type: 'books_count',
      target_value: 5,
      target_unit: 'books',
      time_frame: 'monthly',
      start_date: '2025-01-01T00:00:00.000Z',
      end_date: '2025-01-31T23:59:59.999Z',
    });

    const { daysRemaining, isExpired } = getChallengeTimeStatus(challenge);
    expect(isExpired).toBe(true);
    expect(daysRemaining).toBe(0);
  });

  // ── multipleActiveChallenges ──

  it('multipleActiveChallenges can be active simultaneously', () => {
    createBooksCountChallenge('cc-1', 10);
    createPagesCountChallenge('cc-2', 5000);
    joinChallenge(adapter, 'part-1', 'cc-1');
    joinChallenge(adapter, 'part-2', 'cc-2');

    insertTestBook('book-1');

    const updates = updateCommunityProgress(adapter, 'book-1', 300);

    // books_count gets +1, pages_count gets +300
    expect(updates).toHaveLength(2);
    const booksUpdate = updates.find((u) => u.challengeId === 'cc-1');
    const pagesUpdate = updates.find((u) => u.challengeId === 'cc-2');
    expect(booksUpdate!.newValue).toBe(1);
    expect(pagesUpdate!.newValue).toBe(300);
  });

  // ── presetTemplatesExist ──

  it('presetTemplatesExist has 12 entries', () => {
    expect(PRESET_IDS).toHaveLength(12);
  });

  // ── participantCountIncrement ──

  it('participantCountIncrement increments when joining', () => {
    createBooksCountChallenge('cc-1', 10);

    const before = getCommunityChallenge(adapter, 'cc-1');
    expect(before!.participant_count).toBe(0);

    joinChallenge(adapter, 'part-1', 'cc-1');

    const after = getCommunityChallenge(adapter, 'cc-1');
    expect(after!.participant_count).toBe(1);
  });
});
