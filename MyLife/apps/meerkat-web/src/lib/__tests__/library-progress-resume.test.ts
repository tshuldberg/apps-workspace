// Plan 38 Phase 6 (WEB): the resume round trip through the REAL cm_library_progress
// column. An encoded epub position (spine index + scroll fraction) survives a
// store write + read + decode, and a cbz page index resumes exactly.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureSyncBootstrap,
} from '@mylife/sync';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { ensureSyncSchema } from '../schema';
import { getLibraryProgress, setLibraryProgress } from '../library-store';
import { decodeReaderPosition, encodeReaderPosition } from '../library-reader-core';

let db: InMemoryTestDatabase;
let personalId: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  const boot = ensureSyncBootstrap(db.adapter);
  ensureSyncSchema(db.adapter);
  personalId = boot.personalWorkspace.id;
});

afterEach(() => db.close());

describe('reader resume through cm_library_progress', () => {
  it('rounds an epub spine index + scroll fraction', () => {
    const packed = encodeReaderPosition('epub', { index: 12, fraction: 0.42 });
    setLibraryProgress(db.adapter, 'item-epub', { positionMs: packed, completed: false, communityId: personalId });
    const stored = getLibraryProgress(db.adapter, 'item-epub');
    expect(stored).not.toBeNull();
    const back = decodeReaderPosition('epub', stored!.positionMs);
    expect(back.index).toBe(12);
    expect(back.fraction).toBeCloseTo(0.42, 3);
    expect(stored!.completed).toBe(false);
  });

  it('rounds a cbz page index and a completed flag', () => {
    const packed = encodeReaderPosition('cbz', { index: 30 });
    setLibraryProgress(db.adapter, 'item-cbz', { positionMs: packed, completed: true, communityId: personalId });
    const stored = getLibraryProgress(db.adapter, 'item-cbz');
    expect(decodeReaderPosition('cbz', stored!.positionMs).index).toBe(30);
    expect(stored!.completed).toBe(true);
  });
});
