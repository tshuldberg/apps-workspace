// Plan 38 Phase 5 (browse UX, WEB): opening a library item's COVER blob. The
// shipped library-store.ts owns opening the item CONTENT (openLibraryItemContent);
// covers are a second sealed object with their own wrapped key, so this small
// helper mirrors that path for the cover_cid + cover_wrapped_key. It uses the
// same @mylife/sync primitives the store uses (no new crypto), and is fail-honest:
// null when this device cannot unwrap the epoch or the sealed blocks are not
// local yet (the UI shows a placeholder poster, never a fake image).

import {
  fetchFromStore,
  unwrapLibraryObjectKeyForDevice,
  type DeviceIdentity,
  type NodeStore,
} from '@mylife/sync';
import type { DatabaseAdapter } from '@mylife/db';
import type { LibraryItemEvent } from './library-data-core';

/**
 * Open a verified item's cover-art bytes from the LOCAL store, or null when the
 * item has no cover, the epoch cannot be unwrapped on this device, or the sealed
 * cover blocks are not local. Verification binds the cover object to the item
 * author (the same expectedAuthor gate the content path uses).
 */
export async function openLibraryItemCover(
  db: DatabaseAdapter,
  store: NodeStore,
  identity: DeviceIdentity,
  item: LibraryItemEvent,
): Promise<Uint8Array | null> {
  if (item.tombstone || !item.coverCid || !item.coverWrappedKey) return null;
  const dek = unwrapLibraryObjectKeyForDevice(
    db, identity, item.communityId, item.keyEpoch, item.coverWrappedKey,
  );
  if (!dek) return null;
  try {
    const result = await fetchFromStore(
      store, item.coverCid, dek, { expectedAuthor: item.authorDeviceId }, item.communityId,
    );
    return result.ok ? result.content : null;
  } finally {
    dek.fill(0);
  }
}
