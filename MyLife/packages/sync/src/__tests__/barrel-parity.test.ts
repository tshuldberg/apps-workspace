import { describe, expect, it } from 'vitest';
import * as fullBarrel from '../index';
import * as nativeBarrel from '../index.native';

// Guard against silent drift between the two package entry points.
//
// `index.ts` is the Node/`main` barrel; `index.native.ts` is the
// react-native / web barrel (Metro resolves it on device, and the meerkat-web
// vite config aliases @mylife/sync to it). Every app that ships on device or
// in the browser consumes the NATIVE barrel, so a shared value export that is
// added to `index.ts` but forgotten in `index.native.ts` is not a type error
// (types resolve to `index.ts`) - it is a runtime "X is not a function" crash
// on the exact surface users run. That is what happened with
// isValidCommunityAvatarImage / COMMUNITY_AVATAR_MAX_BYTES (Plan 32).
//
// This test compares the RUNTIME value exports of the two barrels. Type-only
// exports are erased at runtime and are not covered here (they cannot cause a
// runtime crash). The two allowlists below are the ONLY intentional
// divergences; anything else must be re-exported from both barrels. When you
// add a genuinely platform-specific export, add it to the correct allowlist in
// the same change so the drift is a conscious decision, not an accident.

// Node-only surface intentionally absent from the native/web barrel: the
// filesystem BlobStore, the BitTorrent seeding/tracker/web-seed stack, the
// Automerge-backed SyncManager, and the Node transport/signaling clients. The
// native + web nodes are relay-only with no Node fs and no torrent stack.
const INDEX_ONLY_VALUE_EXPORTS = new Set<string>([
  'BLOCK_SIZE',
  'BlobStore',
  'CREATE_SYNC_SHARE_LOG',
  'LANTransport',
  'PieceManager',
  'SeedingEngine',
  'SwarmManager',
  'SyncManager',
  'TorrentDownloader',
  'WebSeedClient',
  'applyPlacement',
  'buildCommunityCatalog',
  'catalogAvailability',
  'catalogPieceBytes',
  'computeMerkleRoot',
  'createJsonMessage',
  'createManifest',
  'createSimpleMessage',
  'createSyncManager',
  'decodeMessage',
  'encodeMessage',
  'fetchCatalogFromWebSeed',
  'generateDeepLink',
  'generateMagnetUri',
  'generateShareLink',
  'generateTorrentMagnetUri',
  'getMissingBlockIndices',
  'handleIncomingShare',
  'initiatorHandshake',
  'isTorrentLink',
  'negotiateTransportPreference',
  'parseDeepLink',
  'parseJsonPayload',
  'parseMagnetUri',
  'parseManifest',
  'planReplicaPlacement',
  'publishContent',
  'rankMutualTransportPreferences',
  'reassembleBlocks',
  'responderHandshake',
  'runInitiatorSession',
  'runResponderSession',
  'runShareSession',
  'splitIntoBlocks',
  'verifyBlob',
  'verifyCatalogPiece',
  'verifyManifest',
]);

// Native-only surface intentionally absent from the Node barrel: the on-device
// BLE / nearby-peer / WebRTC transports and their simulated/mock backends,
// which have no meaning in the Node profile.
const NATIVE_ONLY_VALUE_EXPORTS = new Set<string>([
  'BleTransport',
  'NearbyTransport',
  'NearbyTransportError',
  'SimulatedBleBackend',
  'SimulatedNearbyBackend',
  'SimulatedWebRTCBackend',
  'WebRTCTransport',
  'WebRTCTransportError',
  'createMockNearbySession',
]);

describe('@mylife/sync barrel parity (index.ts vs index.native.ts)', () => {
  const fullKeys = Object.keys(fullBarrel);
  const nativeKeys = new Set(Object.keys(nativeBarrel));
  const fullKeySet = new Set(fullKeys);

  it('re-exports every shared value export from the native/web barrel', () => {
    const missingFromNative = fullKeys
      .filter((k) => !nativeKeys.has(k) && !INDEX_ONLY_VALUE_EXPORTS.has(k))
      .sort();
    // A non-empty list means a value export lives in index.ts but not
    // index.native.ts. Add it to index.native.ts (it is a shared surface), or,
    // if it is genuinely Node-only, add it to INDEX_ONLY_VALUE_EXPORTS above.
    expect(missingFromNative).toEqual([]);
  });

  it('does not add unexpected exports only to the native/web barrel', () => {
    const extraInNative = Object.keys(nativeBarrel)
      .filter((k) => !fullKeySet.has(k) && !NATIVE_ONLY_VALUE_EXPORTS.has(k))
      .sort();
    // A non-empty list means a value export lives in index.native.ts but not
    // index.ts. Add it to index.ts, or, if it is genuinely native-only, add it
    // to NATIVE_ONLY_VALUE_EXPORTS above.
    expect(extraInNative).toEqual([]);
  });

  it('keeps the allowlists honest (no stale names that both barrels now share)', () => {
    const staleIndexOnly = [...INDEX_ONLY_VALUE_EXPORTS].filter((k) => nativeKeys.has(k)).sort();
    const staleNativeOnly = [...NATIVE_ONLY_VALUE_EXPORTS].filter((k) => fullKeySet.has(k)).sort();
    // If a name is on an allowlist but is now exported by BOTH barrels, remove
    // it from the allowlist so the guard keeps covering it.
    expect({ staleIndexOnly, staleNativeOnly }).toEqual({ staleIndexOnly: [], staleNativeOnly: [] });
  });
});
