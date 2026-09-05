import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { SURF_MODULE } from '../../definition';
import {
  createSpot,
  createSession,
  getSessions,
  deleteSession,
  countSessions,
} from '../crud';

describe('@mylife/surf - sessions CRUD', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('surf', SURF_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;

    // Seed a spot to reference
    createSpot(adapter, 'spot-1', {
      name: 'Ocean Beach',
      region: 'san_francisco',
      breakType: 'beach',
    });
  });

  afterEach(() => {
    closeDb();
  });

  // ── createSession + getSessions ──

  it('creates a session and retrieves it', () => {
    createSession(adapter, 'sess-1', {
      spotId: 'spot-1',
      sessionDate: '2026-03-08',
      durationMin: 90,
      rating: 4,
      notes: 'Great waves today',
    });

    const sessions = getSessions(adapter);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.id).toBe('sess-1');
    expect(sessions[0]!.spotId).toBe('spot-1');
    expect(sessions[0]!.sessionDate).toBe('2026-03-08');
    expect(sessions[0]!.durationMin).toBe(90);
    expect(sessions[0]!.rating).toBe(4);
    expect(sessions[0]!.notes).toBe('Great waves today');
  });

  it('creates a session without notes', () => {
    createSession(adapter, 'sess-1', {
      spotId: 'spot-1',
      sessionDate: '2026-03-08',
      durationMin: 60,
      rating: 3,
    });

    const sessions = getSessions(adapter);
    expect(sessions[0]!.notes).toBeNull();
  });

  // ── getSessions with filters ──

  it('filters sessions by spotId', () => {
    createSpot(adapter, 'spot-2', {
      name: 'Fort Point',
      region: 'san_francisco',
      breakType: 'point',
    });

    createSession(adapter, 'sess-1', {
      spotId: 'spot-1',
      sessionDate: '2026-03-08',
      durationMin: 90,
      rating: 4,
    });
    createSession(adapter, 'sess-2', {
      spotId: 'spot-2',
      sessionDate: '2026-03-07',
      durationMin: 60,
      rating: 3,
    });

    const spot1Sessions = getSessions(adapter, { spotId: 'spot-1' });
    expect(spot1Sessions).toHaveLength(1);
    expect(spot1Sessions[0]!.spotId).toBe('spot-1');
  });

  it('limits results', () => {
    for (let i = 0; i < 5; i++) {
      createSession(adapter, `sess-${i}`, {
        spotId: 'spot-1',
        sessionDate: `2026-03-0${i + 1}`,
        durationMin: 60,
        rating: 3,
      });
    }
    const limited = getSessions(adapter, { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('orders sessions by date descending', () => {
    createSession(adapter, 'sess-old', {
      spotId: 'spot-1',
      sessionDate: '2026-03-01',
      durationMin: 60,
      rating: 3,
    });
    createSession(adapter, 'sess-new', {
      spotId: 'spot-1',
      sessionDate: '2026-03-08',
      durationMin: 90,
      rating: 5,
    });

    const sessions = getSessions(adapter);
    expect(sessions[0]!.sessionDate).toBe('2026-03-08');
    expect(sessions[1]!.sessionDate).toBe('2026-03-01');
  });

  // ── deleteSession ──

  it('deletes a session by id', () => {
    createSession(adapter, 'sess-1', {
      spotId: 'spot-1',
      sessionDate: '2026-03-08',
      durationMin: 90,
      rating: 4,
    });
    expect(countSessions(adapter)).toBe(1);

    deleteSession(adapter, 'sess-1');
    expect(countSessions(adapter)).toBe(0);
  });

  // ── countSessions ──

  it('counts all sessions', () => {
    expect(countSessions(adapter)).toBe(0);
    createSession(adapter, 'sess-1', {
      spotId: 'spot-1',
      sessionDate: '2026-03-08',
      durationMin: 90,
      rating: 4,
    });
    createSession(adapter, 'sess-2', {
      spotId: 'spot-1',
      sessionDate: '2026-03-07',
      durationMin: 60,
      rating: 3,
    });
    expect(countSessions(adapter)).toBe(2);
  });

  // ── Empty state ──

  it('returns empty array when no sessions exist', () => {
    expect(getSessions(adapter)).toEqual([]);
  });
});
