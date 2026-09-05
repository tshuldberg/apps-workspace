// Plan 38 Phase 1c (web): the community BANNER sealed-object bridge. The banner is
// a sealed LIBRARY OBJECT (library-objects.ts): the owner seals the downscaled JPEG
// under the community workspace's CURRENT epoch, stores the sealed blocks in the
// browser node store the way other sealed content is stored, and records the
// {cid, keyEpoch, wrappedKey, manifestJson} descriptor on the signed identity row.
// A member reconstructs the SealedShare from LOCAL blocks and opens it under its own
// epoch-wrap history: if any block is missing or the DEK will not unwrap, the open
// fails and the UI renders NOTHING extra (no spinner lie, D.2).
//
// Every cryptographic + protocol primitive comes from @mylife/sync unchanged.

import type { DatabaseAdapter } from '@mylife/db';
import {
  getCurrentEpochKey,
  openLibraryObject,
  sealLibraryObject,
  unwrapEpochSecret,
  type CommunityIdentityBanner,
  type DeviceIdentity,
  type NodeStore,
  type SealedChunk,
  type SealedShare,
} from '@mylife/sync';

/** Pin context for a community's sealed identity blocks (banner). D.4 pin-context. */
export function communityPinContext(communityId: string): string {
  return `community:${communityId}`;
}

/**
 * Seal downscaled banner bytes as a library object under the community's CURRENT
 * epoch, persist the sealed blocks + manifest into the node store, and return the
 * signed-row banner descriptor. Throws an honest error when this device holds no
 * epoch key for the community (the owner must have joined/keyed the community
 * first). The RAW dek is never returned; only the epoch-wrapped form persists.
 */
export async function sealCommunityBanner(input: {
  nodeStore: NodeStore;
  db: DatabaseAdapter;
  owner: DeviceIdentity;
  communityId: string;
  bytes: Uint8Array;
  name?: string;
}): Promise<CommunityIdentityBanner> {
  const { nodeStore, db, owner, communityId, bytes } = input;
  const epochKey = getCurrentEpochKey(db, communityId, owner);
  if (!epochKey) {
    throw new Error('This community has no encryption key on this device yet.');
  }
  const sealed = sealLibraryObject(bytes, {
    workspaceId: communityId,
    epoch: epochKey.epoch,
    epochSecret: epochKey.secret,
    name: input.name ?? 'banner.jpg',
    identity: owner,
  });
  const sealedChunkIds = sealed.share.sealedChunks.map((chunk) => chunk.sealedId);
  const context = communityPinContext(communityId);
  // Persist blocks first, then the manifest index (putManifest sums block bytes).
  for (const chunk of sealed.share.sealedChunks) {
    await nodeStore.putBlock({ sealedId: chunk.sealedId, payload: chunk.payload });
  }
  await nodeStore.putManifest(
    {
      contentId: sealed.contentId,
      name: sealed.share.manifest.name,
      size: sealed.share.manifest.size,
      scope: sealed.share.manifest.scope,
      authorPublicKey: sealed.share.manifest.authorPublicKey,
      manifestSignature: sealed.share.manifestSignature,
      sealedChunkIds,
      manifestJson: JSON.stringify(sealed.share.manifest),
      pinnedAt: new Date().toISOString(),
      // The owner authored these blocks; never auto-evict them.
      pinClass: 'authored',
    },
    context,
    'authored',
  );
  return {
    cid: sealed.contentId,
    keyEpoch: sealed.keyEpoch,
    wrappedKey: sealed.wrappedKey,
    manifestJson: JSON.stringify({
      manifest: sealed.share.manifest,
      manifestSignature: sealed.share.manifestSignature,
      sealedChunkIds,
    }),
  };
}

interface ParsedBannerManifest {
  manifest: SealedShare['manifest'];
  manifestSignature: string;
  sealedChunkIds: string[];
}

/** Parse the banner row's manifest JSON, or null when malformed. Pure. */
export function parseBannerManifest(banner: CommunityIdentityBanner): ParsedBannerManifest | null {
  try {
    const parsed = JSON.parse(banner.manifestJson) as Partial<ParsedBannerManifest>;
    if (!parsed || typeof parsed.manifestSignature !== 'string') return null;
    if (!Array.isArray(parsed.sealedChunkIds) || parsed.sealedChunkIds.length === 0) return null;
    if (!parsed.sealedChunkIds.every((id) => typeof id === 'string')) return null;
    if (!parsed.manifest || typeof parsed.manifest !== 'object') return null;
    return {
      manifest: parsed.manifest as SealedShare['manifest'],
      manifestSignature: parsed.manifestSignature,
      sealedChunkIds: parsed.sealedChunkIds,
    };
  } catch {
    return null;
  }
}

/**
 * Reconstruct the SealedShare from the manifest + a map of locally-held sealed
 * blocks. PURE + total: returns null when any referenced block is missing (the
 * honest "not local" signal). The chunk index is the manifest's chunk order.
 */
export function reconstructBannerShare(
  parsed: ParsedBannerManifest,
  blocks: Map<string, string>,
): SealedShare | null {
  const sealedChunks: SealedChunk[] = [];
  for (let index = 0; index < parsed.sealedChunkIds.length; index += 1) {
    const sealedId = parsed.sealedChunkIds[index];
    const payload = blocks.get(sealedId);
    if (payload == null) return null;
    sealedChunks.push({ index, sealedId, payload });
  }
  return {
    manifest: parsed.manifest,
    manifestSignature: parsed.manifestSignature,
    sealedChunks,
  };
}

/**
 * Open a community banner from LOCAL blocks and return a `data:` image URI, or null
 * when the banner is not (fully) local or will not decrypt/verify for this device.
 * Fail-closed: a missing block, a missing epoch wrap, or a failed verify all yield
 * null so the UI renders nothing extra. `expectedAuthor` binds the sealed-share
 * author to the community owner.
 */
export async function openCommunityBanner(input: {
  nodeStore: NodeStore;
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  communityId: string;
  ownerDeviceId: string;
  banner: CommunityIdentityBanner;
}): Promise<string | null> {
  const { nodeStore, db, identity, communityId, ownerDeviceId, banner } = input;
  const parsed = parseBannerManifest(banner);
  if (!parsed) return null;
  const blocks = new Map<string, string>();
  for (const sealedId of parsed.sealedChunkIds) {
    const payload = await nodeStore.getBlock(sealedId);
    if (payload == null) return null; // not local -> render nothing extra
    blocks.set(sealedId, payload);
  }
  const share = reconstructBannerShare(parsed, blocks);
  if (!share) return null;
  const epochSecret = unwrapEpochSecret(db, communityId, banner.keyEpoch, identity);
  if (!epochSecret) return null; // no wrap for this epoch -> honest locked (render nothing)
  const result = openLibraryObject(
    share,
    banner.wrappedKey,
    epochSecret,
    communityId,
    banner.keyEpoch,
    { expectedAuthor: ownerDeviceId },
  );
  if (!result.ok) return null;
  return bytesToJpegDataUri(result.content);
}

function bytesToJpegDataUri(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i] ?? 0);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}
