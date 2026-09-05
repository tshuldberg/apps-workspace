// Plan 38 Phase 1c: the banner sealing + resolve path for community identity.
//
// The ICON is an in-row base64 JPEG (the avatar gate), so it renders in lists
// with no fetch. The BANNER is a SEALED LIBRARY OBJECT (Codex amendment 1): a
// per-object DEK wrapped under the community workspace's CURRENT epoch, its
// ciphertext blocks pinned in the node store, and a signed cm_community_identity
// row that carries the contentId + wrapped DEK + sealed-object manifest. Reading
// it back is membership-gated: a device that holds no epoch wrap, or has not yet
// received the sealed blocks, resolves to null and the header renders NOTHING
// extra (no spinner lie, no broken frame).
//
// Pin CONTEXT is the communityId (Plan 38 D.4 sealing context = workspaceId), and
// the owner pins its own banner as an 'authored' pin (never evicted). The read
// path opens under the same context; a member whose Phase 0 blob transfer has not
// landed the blocks yet simply gets content-not-pinned -> null.

import type { DatabaseAdapter } from '@mylife/db';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import {
  fetchFromStore,
  getCurrentEpochKey,
  isValidCommunityIdentityBanner,
  pinShare,
  sealLibraryObject,
  unwrapLibraryObjectKeyForDevice,
  type CommunityIdentityBanner,
  type DeviceIdentity,
  type NodeStore,
  type SealedShare,
} from '@mylife/sync';
import { getCommunityIdentity } from './community-core';

/** The sealed banner's node-store name (not user-visible). */
const BANNER_OBJECT_NAME = 'community-banner';

/**
 * Build the { manifest, manifestSignature, sealedChunkIds } JSON the signed row
 * carries. sealedChunkIds feed the blob-transfer collector so the banner blocks
 * replicate exactly like library items; the manifest is self-verifying (the
 * sealed-share layer signs it).
 */
function bannerManifestJson(share: SealedShare): string {
  const ordered = [...share.sealedChunks].sort((a, b) => a.index - b.index);
  return JSON.stringify({
    manifest: share.manifest,
    manifestSignature: share.manifestSignature,
    sealedChunkIds: ordered.map((chunk) => chunk.sealedId),
  });
}

export interface SealCommunityBannerArgs {
  db: DatabaseAdapter;
  store: NodeStore;
  identity: DeviceIdentity;
  communityId: string;
  /** Downscaled JPEG bytes as base64 (from pickAndResizeBanner). */
  base64: string;
}

/**
 * Seal a banner image as a library object under the community's CURRENT epoch and
 * pin its blocks locally. Returns the signed-row banner value, or null when this
 * device holds no current epoch key (cannot seal) or the produced banner fails
 * the protocol cap check (fail-closed; the caller then keeps the prior banner).
 */
export async function sealCommunityBanner(
  args: SealCommunityBannerArgs,
): Promise<CommunityIdentityBanner | null> {
  const { db, store, identity, communityId, base64 } = args;
  const epoch = getCurrentEpochKey(db, communityId, identity);
  if (!epoch) return null;

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(base64);
  } catch {
    return null;
  }
  if (bytes.length < 1) return null;

  const sealed = sealLibraryObject(bytes, {
    workspaceId: communityId,
    epoch: epoch.epoch,
    epochSecret: epoch.secret,
    name: BANNER_OBJECT_NAME,
    identity,
  });
  // 'authored' pin under the community sealing context: the owner is the author
  // and must never auto-evict its own banner (Plan 38 C.7 / D.4).
  await pinShare(store, sealed.share, communityId, 'authored');

  const banner: CommunityIdentityBanner = {
    cid: sealed.contentId,
    keyEpoch: sealed.keyEpoch,
    wrappedKey: sealed.wrappedKey,
    manifestJson: bannerManifestJson(sealed.share),
  };
  if (!isValidCommunityIdentityBanner(banner)) return null;
  return banner;
}

export interface ResolveCommunityBannerArgs {
  db: DatabaseAdapter;
  store: NodeStore;
  identity: DeviceIdentity;
  communityId: string;
}

/**
 * The verified banner image as a data URI, or null. Null covers every honest
 * "render nothing extra" case: no verified identity, no banner set, this device
 * cannot unwrap the epoch (not a member / pre-join), or the sealed blocks are not
 * local yet. Verification binds the sealed object to the owner (expectedAuthor),
 * so a forged banner never opens.
 */
export async function resolveCommunityBannerImage(
  args: ResolveCommunityBannerArgs,
): Promise<string | null> {
  const { db, store, identity, communityId } = args;
  const resolved = getCommunityIdentity(db, communityId);
  if (!resolved || !resolved.banner) return null;
  const banner = resolved.banner;

  const dek = unwrapLibraryObjectKeyForDevice(
    db,
    identity,
    communityId,
    banner.keyEpoch,
    banner.wrappedKey,
  );
  if (!dek) return null;

  let result;
  try {
    result = await fetchFromStore(store, banner.cid, dek, { expectedAuthor: resolved.signedBy }, communityId);
  } finally {
    dek.fill(0);
  }
  if (!result.ok) return null;
  return `data:image/jpeg;base64,${encodeBase64(result.content)}`;
}
