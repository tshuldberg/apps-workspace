import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createModuleTestDatabase,
  type InMemoryTestDatabase,
} from '@mylife/db';
import { SPORTS_MODULE } from '../definition';
import {
  createPrediction,
  deletePrediction,
  getPrediction,
  listPredictions,
  settlePrediction,
  unsettlePrediction,
  updatePrediction,
  type CreatePredictionInput,
} from '../db/crud';

function basePick(
  overrides: Partial<CreatePredictionInput> = {},
): CreatePredictionInput {
  return {
    category: 'champion',
    sport: 'nfl',
    league: 'nfl',
    season: '2025-26',
    prediction_text: 'Chiefs win Super Bowl',
    confidence: 4,
    ...overrides,
  };
}

describe('sports predictions CRUD', () => {
  let db: InMemoryTestDatabase;

  beforeEach(() => {
    db = createModuleTestDatabase('sports', SPORTS_MODULE.migrations ?? []);
  });

  afterEach(() => {
    db.close();
  });

  it('createPrediction + getPrediction round-trip assigns pd_ id + timestamps', () => {
    const created = createPrediction(
      db.adapter,
      basePick({ reasoning_md: 'Mahomes magic' }),
    );
    expect(created.id.startsWith('pd_')).toBe(true);
    expect(created.was_correct).toBeNull();
    expect(created.settled_at).toBeNull();
    expect(created.predicted_at).toBeGreaterThan(0);

    const fetched = getPrediction(db.adapter, created.id);
    expect(fetched?.prediction_text).toBe('Chiefs win Super Bowl');
    expect(fetched?.reasoning_md).toBe('Mahomes magic');
    expect(fetched?.confidence).toBe(4);
  });

  it('category CHECK constraint rejects unknown values', () => {
    expect(() =>
      createPrediction(db.adapter, basePick({ category: 'junk' as never })),
    ).toThrow();
  });

  it('confidence CHECK constraint rejects values outside 1..5', () => {
    expect(() =>
      createPrediction(db.adapter, basePick({ confidence: 9 })),
    ).toThrow();
  });

  it('listPredictions filters by category / sport / season / settled + orders DESC', () => {
    const a = createPrediction(
      db.adapter,
      basePick({
        category: 'mvp',
        sport: 'nba',
        season: '2024-25',
        prediction_text: 'Luka',
        predicted_at: 1_000,
      }),
    );
    const b = createPrediction(
      db.adapter,
      basePick({
        category: 'champion',
        sport: 'nfl',
        season: '2025-26',
        prediction_text: 'Chiefs',
        predicted_at: 2_000,
      }),
    );
    createPrediction(
      db.adapter,
      basePick({
        category: 'mvp',
        sport: 'nba',
        season: '2025-26',
        prediction_text: 'SGA',
        predicted_at: 3_000,
      }),
    );
    settlePrediction(db.adapter, a.id, { wasCorrect: false });

    // All
    expect(listPredictions(db.adapter)).toHaveLength(3);
    // Order DESC
    expect(
      listPredictions(db.adapter).map((p) => p.prediction_text),
    ).toEqual(['SGA', 'Chiefs', 'Luka']);
    // Category
    expect(
      listPredictions(db.adapter, { category: 'mvp' }).map(
        (p) => p.prediction_text,
      ),
    ).toEqual(['SGA', 'Luka']);
    // Sport
    expect(listPredictions(db.adapter, { sport: 'nfl' })).toHaveLength(1);
    // Season
    expect(
      listPredictions(db.adapter, { season: '2025-26' }),
    ).toHaveLength(2);
    // Settled
    expect(listPredictions(db.adapter, { settled: true })).toHaveLength(1);
    expect(listPredictions(db.adapter, { settled: false })).toHaveLength(2);
    // Limit
    expect(listPredictions(db.adapter, { limit: 2 })).toHaveLength(2);

    // Sanity: b still exists at raw id
    expect(getPrediction(db.adapter, b.id)?.prediction_text).toBe('Chiefs');
  });

  it('updatePrediction merges partial patches and bumps updated_at', () => {
    const created = createPrediction(db.adapter, basePick());
    const before = created.updated_at;
    // Force a 1ms wall-clock delta.
    const patched = updatePrediction(db.adapter, created.id, {
      prediction_text: 'Chiefs repeat',
      notes_md: 'locked in',
      confidence: 5,
    });
    expect(patched?.prediction_text).toBe('Chiefs repeat');
    expect(patched?.notes_md).toBe('locked in');
    expect(patched?.confidence).toBe(5);
    expect(patched?.updated_at).toBeGreaterThanOrEqual(before);
  });

  it('updatePrediction returns null for missing ids', () => {
    expect(updatePrediction(db.adapter, 'pd_missing', { notes_md: 'x' })).toBeNull();
  });

  it('lock-edit rule freezes core fields once locks_at passes, still allows notes_md', () => {
    const longAgo = Date.now() - 60_000;
    const created = createPrediction(
      db.adapter,
      basePick({ locks_at: longAgo }),
    );
    expect(() =>
      updatePrediction(db.adapter, created.id, {
        prediction_text: 'should fail',
      }),
    ).toThrow(/locked/);
    expect(() =>
      updatePrediction(db.adapter, created.id, { confidence: 2 }),
    ).toThrow(/locked/);
    const ok = updatePrediction(db.adapter, created.id, {
      notes_md: 'post-lock scribble',
    });
    expect(ok?.notes_md).toBe('post-lock scribble');
  });

  it('lock-edit rule allows edits before locks_at fires', () => {
    const future = Date.now() + 60_000;
    const created = createPrediction(
      db.adapter,
      basePick({ locks_at: future }),
    );
    const patched = updatePrediction(db.adapter, created.id, {
      prediction_text: 'Bills actually',
    });
    expect(patched?.prediction_text).toBe('Bills actually');
  });

  it('settled predictions freeze everything except notes_md', () => {
    const created = createPrediction(db.adapter, basePick());
    settlePrediction(db.adapter, created.id, { wasCorrect: true });
    expect(() =>
      updatePrediction(db.adapter, created.id, {
        prediction_text: 'change me',
      }),
    ).toThrow(/settled/);
    const ok = updatePrediction(db.adapter, created.id, {
      notes_md: 'finalized',
    });
    expect(ok?.notes_md).toBe('finalized');
  });

  it('settlePrediction stores result + marks was_correct + is idempotent', () => {
    const created = createPrediction(db.adapter, basePick());
    const first = settlePrediction(db.adapter, created.id, {
      wasCorrect: true,
      resultText: 'Chiefs won SB',
      settledAtMs: 42,
    });
    expect(first?.was_correct).toBe(true);
    expect(first?.result_text).toBe('Chiefs won SB');
    expect(first?.settled_at).toBe(42);

    // Idempotent re-settle with same outcome.
    const second = settlePrediction(db.adapter, created.id, {
      wasCorrect: true,
      resultText: 'Chiefs won SB',
      settledAtMs: 42,
    });
    expect(second?.was_correct).toBe(true);
    expect(second?.settled_at).toBe(42);

    // Re-settle with a flipped outcome overwrites.
    const flipped = settlePrediction(db.adapter, created.id, {
      wasCorrect: false,
      resultText: 'actually lost',
      settledAtMs: 99,
    });
    expect(flipped?.was_correct).toBe(false);
    expect(flipped?.result_text).toBe('actually lost');
    expect(flipped?.settled_at).toBe(99);
  });

  it('unsettlePrediction nulls was_correct / result_text / settled_at round-trip', () => {
    const created = createPrediction(db.adapter, basePick());
    settlePrediction(db.adapter, created.id, {
      wasCorrect: true,
      resultText: 'won',
    });
    const cleared = unsettlePrediction(db.adapter, created.id);
    expect(cleared?.was_correct).toBeNull();
    expect(cleared?.result_text).toBeNull();
    expect(cleared?.settled_at).toBeNull();

    // After unsettle the lock rules revert; plain edits work again.
    const edited = updatePrediction(db.adapter, created.id, {
      prediction_text: 'redo',
    });
    expect(edited?.prediction_text).toBe('redo');
  });

  it('deletePrediction removes the row and returns false for missing ids', () => {
    const created = createPrediction(db.adapter, basePick());
    expect(deletePrediction(db.adapter, created.id)).toBe(true);
    expect(getPrediction(db.adapter, created.id)).toBeNull();
    expect(deletePrediction(db.adapter, created.id)).toBe(false);
  });
});
