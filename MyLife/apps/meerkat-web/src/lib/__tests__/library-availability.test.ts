// Plan 38 Phase 7 (web): transport-honest library availability.
//
// isLibraryItemContentHeld reports whether this device ACTUALLY holds an item's
// sealed content blocks (not merely that a signed row exists). A community item
// whose blocks have not arrived reads false, which drives the honest "Available
// from members who have it, when a sync connects." copy. Guarded against a store
// that holds the blocks (true) and one that does not (false).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  InMemoryNodeStore,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  ensureSyncBootstrap,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureSyncSchema } from '../schema';
import { addLibraryItem, createLibrary, isLibraryItemContentHeld } from '../library-store';
import { LIBRARY_STRINGS } from '../library-browse-core';

let db: InMemoryTestDatabase;
let identity: DeviceIdentity;
let personalId: string;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  db = createInMemoryTestDatabase();
  const boot = ensureSyncBootstrap(db.adapter);
  ensureSyncSchema(db.adapter);
  identity = boot.identity;
  personalId = boot.personalWorkspace.id;
});

afterEach(() => db.close());

describe('isLibraryItemContentHeld', () => {
  it('is true when the sealed blocks are present locally, false against a store without them', async () => {
    const store = new InMemoryNodeStore();
    const lib = createLibrary(db.adapter, identity, { workspaceId: personalId, name: 'Docs', mediaType: 'document' });
    const bytes = new Uint8Array(Array.from({ length: 2048 }, (_, i) => i % 251));
    const { item } = await addLibraryItem(db.adapter, store, identity, {
      channelId: lib.id, workspaceId: personalId, bytes, title: 'Report', mimeType: 'application/pdf',
    });

    // The authoring store holds every block.
    expect(await isLibraryItemContentHeld(store, item)).toBe(true);
    // A fresh device that has the signed row but none of the blocks yet.
    expect(await isLibraryItemContentHeld(new InMemoryNodeStore(), item)).toBe(false);
  });
});

describe('availability copy string', () => {
  it('is the exact transport-honest line', () => {
    expect(LIBRARY_STRINGS.availableFromMembers).toBe(
      'Available from members who have it, when a sync connects.',
    );
  });
});
