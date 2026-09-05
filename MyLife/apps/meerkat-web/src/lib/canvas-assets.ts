// Plan 56 C1 (3.1): canvas node sealed-asset seal + resolve, the banner path
// (community-identity-media.ts) generalized to canvas nodes. This is the
// WEB twin of apps/meerkat/app/(root)/data/canvas-assets.ts, byte-identical
// below the header, parity-locked (CORE_TWINS).
//
// An asset is a sealed library object under the community's CURRENT epoch:
// membership is the read capability; the signed node row carries the
// contentId + epoch-wrapped DEK + self-verifying manifest whose
// sealedChunkIds feed the blob-transfer collector (asset_manifest_json). A
// device that cannot unwrap the epoch or does not hold the blocks yet
// resolves to null and the node renders the honest availability line, never
// a spinner lie or a broken frame.

import type { DatabaseAdapter } from '@mylife/db';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import {
  fetchFromStore,
  getCurrentEpochKey,
  isValidCanvasNodeAsset,
  pinShare,
  sealLibraryObject,
  unwrapLibraryObjectKeyForDevice,
  type CanvasNodeAsset,
  type CommunityCanvasNodeEvent,
  type DeviceIdentity,
  type NodeStore,
  type SealedShare,
} from '@mylife/sync';

const CANVAS_ASSET_OBJECT_NAME = 'canvas-asset';

function assetManifestJson(share: SealedShare): string {
  const ordered = [...share.sealedChunks].sort((a, b) => a.index - b.index);
  return JSON.stringify({
    manifest: share.manifest,
    manifestSignature: share.manifestSignature,
    sealedChunkIds: ordered.map((chunk) => chunk.sealedId),
  });
}

/**
 * Seal image bytes (base64) as a canvas node asset under the community's
 * current epoch and pin its blocks locally ('authored': the placing member is
 * the author and its own decorations never auto-evict). Null when this device
 * holds no current epoch key or the produced asset fails the protocol shape.
 */
export async function sealCanvasImageAsset(args: {
  db: DatabaseAdapter;
  store: NodeStore;
  identity: DeviceIdentity;
  communityId: string;
  base64: string;
}): Promise<CanvasNodeAsset | null> {
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
    name: CANVAS_ASSET_OBJECT_NAME,
    identity,
  });
  await pinShare(store, sealed.share, communityId, 'authored');
  const asset: CanvasNodeAsset = {
    cid: sealed.contentId,
    keyEpoch: sealed.keyEpoch,
    wrappedKey: sealed.wrappedKey,
    manifestJson: assetManifestJson(sealed.share),
  };
  if (!isValidCanvasNodeAsset(asset)) return null;
  return asset;
}

/**
 * A node's verified asset as a data URI, or null (honest not-local /
 * not-a-member / no-asset). Verification binds the sealed object to the
 * node's AUTHOR, so a swapped asset never opens.
 */
export async function resolveCanvasAssetUri(args: {
  db: DatabaseAdapter;
  store: NodeStore;
  identity: DeviceIdentity;
  node: CommunityCanvasNodeEvent;
}): Promise<string | null> {
  const { db, store, identity, node } = args;
  if (!node.asset) return null;
  const dek = unwrapLibraryObjectKeyForDevice(
    db,
    identity,
    node.communityId,
    node.asset.keyEpoch,
    node.asset.wrappedKey,
  );
  if (!dek) return null;
  let result;
  try {
    result = await fetchFromStore(store, node.asset.cid, dek, { expectedAuthor: node.authorDevice }, node.communityId);
  } catch {
    // A thrown fetch is the same honest outcome as a failed one: no image.
    // Without this catch the rejection killed the caller's whole resolve loop.
    return null;
  } finally {
    dek.fill(0);
  }
  if (!result.ok) return null;
  return `data:image/jpeg;base64,${encodeBase64(result.content)}`;
}

/**
 * Re-seal an asset for copy-forward (feature 54): open the sealed bytes from
 * the SOURCE community (membership-gated; null when this device cannot open
 * them or they are not local) and seal a fresh copy under the TARGET
 * community's current epoch. The source object is untouched.
 */
export async function resealCanvasAssetForCommunity(args: {
  db: DatabaseAdapter;
  store: NodeStore;
  identity: DeviceIdentity;
  asset: CanvasNodeAsset;
  fromCommunityId: string;
  toCommunityId: string;
  authorDevice: string;
}): Promise<CanvasNodeAsset | null> {
  const { db, store, identity, asset, fromCommunityId, toCommunityId, authorDevice } = args;
  const dek = unwrapLibraryObjectKeyForDevice(db, identity, fromCommunityId, asset.keyEpoch, asset.wrappedKey);
  if (!dek) return null;
  let result;
  try {
    result = await fetchFromStore(store, asset.cid, dek, { expectedAuthor: authorDevice }, fromCommunityId);
  } catch {
    // A thrown fetch is the same honest outcome as a failed one: no image.
    // Without this catch the rejection killed the caller's whole resolve loop.
    return null;
  } finally {
    dek.fill(0);
  }
  if (!result.ok) return null;
  return sealCanvasImageAsset({ db, store, identity, communityId: toCommunityId, base64: encodeBase64(result.content) });
}

/**
 * Resolve ANY sealed community asset (canvas node or pack item) to a data URI.
 * Same unwrap-fetch-verify path as resolveCanvasAssetUri; null when this
 * device cannot unwrap the epoch or does not hold the blocks yet.
 */
export async function resolveSealedAssetUri(args: {
  db: DatabaseAdapter;
  store: NodeStore;
  identity: DeviceIdentity;
  communityId: string;
  asset: CanvasNodeAsset;
  authorDevice: string;
}): Promise<string | null> {
  const { db, store, identity, communityId, asset, authorDevice } = args;
  const dek = unwrapLibraryObjectKeyForDevice(db, identity, communityId, asset.keyEpoch, asset.wrappedKey);
  if (!dek) return null;
  let result;
  try {
    result = await fetchFromStore(store, asset.cid, dek, { expectedAuthor: authorDevice }, communityId);
  } catch {
    // A thrown fetch is the same honest outcome as a failed one: no image.
    // Without this catch the rejection killed the caller's whole resolve loop.
    return null;
  } finally {
    dek.fill(0);
  }
  if (!result.ok) return null;
  return `data:image/jpeg;base64,${encodeBase64(result.content)}`;
}
