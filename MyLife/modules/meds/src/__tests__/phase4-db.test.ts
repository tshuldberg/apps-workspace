import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MEDS_MODULE } from '../definition';
import { createA1cRecord, getA1cRecords } from '../db/a1c';
import {
  createCGMReading,
  getCGMReadings,
  getCGMSyncState,
  upsertCGMSyncState,
} from '../db/cgm';

describe('meds phase 4 db helpers', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('meds', MEDS_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('persists and retrieves lab A1c records', () => {
    createA1cRecord(adapter, 'a1c-1', {
      value: 6.4,
      source: 'lab',
      averageGlucose: 136,
      readingCount: 42,
      periodDays: 90,
      notes: 'Lab: Quest',
      recordedAt: '2026-04-01T08:00:00.000Z',
    });

    const records = getA1cRecords(adapter, { source: 'lab' });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'a1c-1',
      value: 6.4,
      source: 'lab',
      averageGlucose: 136,
      readingCount: 42,
    });
  });

  it('persists CGM readings with computed range status', () => {
    createCGMReading(adapter, 'cgm-1', {
      value: 225,
      measuredAt: '2026-04-01T08:00:00.000Z',
      deviceName: 'Dexcom G7',
    });

    const readings = getCGMReadings(adapter);

    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({
      id: 'cgm-1',
      rangeStatus: 'high',
      deviceName: 'Dexcom G7',
    });
  });

  it('upserts CGM sync state', () => {
    expect(getCGMSyncState(adapter)).toBeNull();

    upsertCGMSyncState(adapter, {
      lastSyncAt: '2026-04-01T10:00:00.000Z',
      lastAnchor: 'anchor-1',
      readingsSynced: 48,
    });

    let state = getCGMSyncState(adapter);
    expect(state).not.toBeNull();
    expect(state).toMatchObject({
      lastAnchor: 'anchor-1',
      readingsSynced: 48,
    });

    upsertCGMSyncState(adapter, {
      readingsSynced: 64,
    });

    state = getCGMSyncState(adapter);
    expect(state).not.toBeNull();
    expect(state).toMatchObject({
      lastAnchor: 'anchor-1',
      readingsSynced: 64,
    });
  });
});
