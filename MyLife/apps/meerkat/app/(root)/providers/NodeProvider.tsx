import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { decodeUTF8, decodeBase64 } from 'tweetnacl-util';
import {
  buildMagnetLink,
  buildShareLink,
  createSealedShare,
  fetchFromStore,
  pinShare,
  unpinShare,
  type CommunityIdentityBanner,
  type NodeShareScope,
  type NodeStore,
  type NodeStoreStats,
  type OpenResult,
  type PinnedManifest,
  type ShareLinkParts,
} from '@mylife/sync';
import { useMeerkatDatabase } from './DatabaseProvider';
import { useIdentity } from './IdentityProvider';
import { ExpoNodeStore } from '../data/expo-node-store';
import type { LibraryPinStore } from '../data/library-storage-core';
import {
  resolveCommunityBannerImage as resolveCommunityBannerImageCore,
  sealCommunityBanner as sealCommunityBannerCore,
} from '../data/community-identity-media';
import { getSetting, setSetting } from '../data/db';
import { effectiveRelayUrl } from '../data/effective-relay';
import {
  discoverShareHosts,
  openRemoteShare,
  type OpenRemoteShareResult,
} from '../data/remote-share';
import {
  FILE_SAVE_DIR_ANDROID,
  requestAndPersistSafDestination,
  saveBytesToDestination,
  saveBytesToDocuments,
  type FileSaveAdapter,
  type FileSaveResult,
} from '../data/file-save';

// Build the real native FileSaveAdapter once. This is the ONLY place the app
// wires expo-file-system/legacy + expo-sharing to the pure save core; tests
// inject a fake adapter instead.
function createNativeFileSaveAdapter(): FileSaveAdapter {
  return {
    platformOS: Platform.OS,
    cacheDirectory: FileSystem.cacheDirectory,
    documentDirectory: FileSystem.documentDirectory,
    getInfoAsync: async (uri) => {
      const info = await FileSystem.getInfoAsync(uri);
      return { exists: info.exists, size: info.exists ? info.size : undefined };
    },
    writeAsStringAsync: (uri, contents, options) =>
      FileSystem.writeAsStringAsync(uri, contents, {
        encoding:
          options.encoding === 'base64'
            ? FileSystem.EncodingType.Base64
            : FileSystem.EncodingType.UTF8,
      }),
    makeDirectoryAsync: (uri) => FileSystem.makeDirectoryAsync(uri, { intermediates: true }),
    safRequestDirectory: (initialUri) =>
      FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync(initialUri ?? undefined),
    safCreateFile: (parentUri, fileName, mimeType) =>
      FileSystem.StorageAccessFramework.createFileAsync(parentUri, fileName, mimeType),
    share: async (uri, options) => {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        throw new Error('This platform cannot open the save sheet from the app sandbox.');
      }
      await Sharing.shareAsync(uri, options);
    },
  };
}

export interface CreateAndPinResult {
  contentId: string;
  name: string;
  scope: NodeShareScope;
  link: string;
  magnet: string;
  linkKey: Uint8Array;
}

export interface SessionLink {
  link: string;
  magnet: string;
  linkKey: Uint8Array;
}

interface NodeContextValue {
  pinned: PinnedManifest[];
  stats: NodeStoreStats;
  /**
   * The on-device sealed store (Plan 38): the library layer seals/opens content
   * and cover blobs through this exact instance, so a "held on this device" badge
   * and an addLibraryItem pin share one store (never a second, drifting index).
   * Typed with the Plan 38 C.7 pin-class/LRU surface so the library storage glue
   * (keep/release/eviction/meter) can drive it directly.
   */
  store: NodeStore & LibraryPinStore;
  refresh: () => Promise<void>;
  createAndPin: (text: string, name: string, scope: NodeShareScope) => Promise<CreateAndPinResult>;
  openFromStore: (contentId: string, linkKey: Uint8Array) => Promise<OpenResult>;
  /**
   * Open a share from remote hosts. `discoveredHosts` is the list a SINGLE prior
   * `discoverHosts` call returned; it is unioned with the pasted `hostText`.
   * Discovery is never re-run here, so an open performs at most one relay lookup
   * (done by the caller). Pass [] (or omit) for the pasted-only path.
   */
  openFromRemoteHosts: (
    parts: ShareLinkParts,
    hostText: string,
    discoveredHosts?: string[],
  ) => Promise<OpenRemoteShareResult>;
  /**
   * Ask the configured relay (RELAY_URL_SETTING_KEY) which web-seed hosts have
   * announced this contentId. Returns the candidate urls actually returned by
   * the relay (deduped, http(s) only) -- an empty array when no relay is set, the
   * relay is down, or nothing was announced. These are candidates, not peers.
   */
  discoverHosts: (contentId: string) => Promise<string[]>;
  /** The configured relay url, or null if the user has not set one. */
  relayUrl: string | null;
  unpin: (contentId: string) => Promise<void>;
  clearAll: () => Promise<void>;
  /**
   * The full share link (with its decrypt key) for content sealed in THIS app
   * session. Held in memory only; link keys are never written to disk, so this
   * returns null for items pinned in a previous launch. That is by design.
   */
  getSessionLink: (contentId: string) => SessionLink | null;
  /**
   * Export ALREADY-DECRYPTED bytes the user explicitly chose to save to a real
   * OS destination, returning a verified result. Android writes to the persisted
   * SAF folder (or returns 'no-destination' so the caller can prompt). iOS stages
   * a verified temp file and opens the OS save sheet. Never goes through the
   * sealed store or any transport.
   */
  saveContent: (args: {
    bytes: Uint8Array;
    name: string;
    mimeType: string;
  }) => Promise<FileSaveResult>;
  /**
   * iOS bulk export path: write a verified copy into the app's Files-visible
   * documents folder (documentDirectory/Meerkat Exports[/subfolder]) in one pass, with no
   * share sheet. Used by the per-community bulk save on iOS so N files land
   * without N share sheets and the "saved" claim is a real on-disk write. Returns
   * the same verified FileSaveResult union.
   */
  saveContentToDocuments: (args: {
    bytes: Uint8Array;
    name: string;
    subfolder?: string;
  }) => Promise<FileSaveResult>;
  /** The persisted Android save folder uri, or null (always null on non-Android). */
  getSaveDestination: () => string | null;
  /**
   * Open the Android SAF folder picker and persist the chosen folder. Returns the
   * granted uri, or null when the user cancelled (no setting is written then).
   * No-op returning null on non-Android (the share sheet is the destination).
   */
  chooseSaveDestination: () => Promise<string | null>;
  /** Forget the persisted Android save folder. */
  clearSaveDestination: () => void;
  /**
   * Plan 38 Phase 1c: seal a community banner image (base64 JPEG) as a library
   * object under the community's current epoch and pin its blocks locally, using
   * the provider's own node store. Returns the signed-row banner value, or null
   * when this device holds no current epoch key (cannot seal). The owner then
   * publishes it through setCommunityAppearance.
   */
  sealCommunityBanner: (communityId: string, base64: string) => Promise<CommunityIdentityBanner | null>;
  /**
   * Plan 38 Phase 1c: the verified banner image as a data URI, or null when there
   * is no verified banner, this device cannot unwrap the epoch, or the sealed
   * blocks are not local yet (render NOTHING extra in that case).
   */
  resolveCommunityBannerImage: (communityId: string) => Promise<string | null>;
}

const EMPTY_STATS: NodeStoreStats = { blockCount: 0, manifestCount: 0, totalBytes: 0 };

const NodeContext = createContext<NodeContextValue | null>(null);

export function useNode(): NodeContextValue {
  const ctx = useContext(NodeContext);
  if (!ctx) throw new Error('useNode must be used within NodeProvider');
  return ctx;
}

export function NodeProvider({ children }: { children: React.ReactNode }) {
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();

  // One store instance per database adapter.
  const storeRef = useRef<ExpoNodeStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new ExpoNodeStore(db);
  }
  const store = storeRef.current;

  // Session-only cache of full share links (key material included). Never
  // persisted; this is the in-memory mirror of "what the link looked like when
  // you created it".
  const sessionLinksRef = useRef<Map<string, SessionLink>>(new Map());

  const [pinned, setPinned] = useState<PinnedManifest[]>([]);
  const [stats, setStats] = useState<NodeStoreStats>(EMPTY_STATS);

  const refresh = useCallback(async () => {
    // Folds: every screen fires this from focus effects as `void refresh()`,
    // so a filesystem read rejection must not become an unhandled rejection.
    // On failure the last-known REAL state stays rendered.
    try {
      const [list, s] = await Promise.all([store.listManifests(), store.stats()]);
      setPinned(list);
      setStats(s);
    } catch {
      // keep last-known real state
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createAndPin = useCallback(
    async (text: string, name: string, scope: NodeShareScope): Promise<CreateAndPinResult> => {
      const content: Uint8Array = decodeUTF8(text);
      const trimmedName = name.trim() || 'Untitled';
      const { share, linkKey } = createSealedShare(content, {
        name: trimmedName,
        identity,
        scope,
      });
      await pinShare(store, share);
      const linkParts = {
        contentId: share.manifest.contentId,
        linkKey,
        authorPublicKey: identity.publicKey,
        name: trimmedName,
      };
      const link = buildShareLink(linkParts);
      const magnet = buildMagnetLink(linkParts);
      sessionLinksRef.current.set(share.manifest.contentId, { link, magnet, linkKey });
      await refresh();
      return {
        contentId: share.manifest.contentId,
        name: trimmedName,
        scope,
        link,
        magnet,
        linkKey,
      };
    },
    [store, identity, refresh],
  );

  const getSessionLink = useCallback(
    (contentId: string): SessionLink | null => sessionLinksRef.current.get(contentId) ?? null,
    [],
  );

  // One native adapter for the lifetime of the provider.
  const fileSaveAdapterRef = useRef<FileSaveAdapter | null>(null);
  if (!fileSaveAdapterRef.current) {
    fileSaveAdapterRef.current = createNativeFileSaveAdapter();
  }
  const fileSaveAdapter = fileSaveAdapterRef.current;

  const getSaveDestination = useCallback(
    (): string | null =>
      Platform.OS === 'android' ? getSetting(db, FILE_SAVE_DIR_ANDROID)?.trim() || null : null,
    [db],
  );

  const saveContent = useCallback(
    async (args: { bytes: Uint8Array; name: string; mimeType: string }): Promise<FileSaveResult> =>
      saveBytesToDestination({
        adapter: fileSaveAdapter,
        bytes: args.bytes,
        name: args.name,
        mimeType: args.mimeType,
        destination: { androidTreeUri: getSaveDestination() },
      }),
    [fileSaveAdapter, getSaveDestination],
  );

  const saveContentToDocuments = useCallback(
    async (args: { bytes: Uint8Array; name: string; subfolder?: string }): Promise<FileSaveResult> =>
      saveBytesToDocuments({
        adapter: fileSaveAdapter,
        bytes: args.bytes,
        name: args.name,
        subfolder: args.subfolder,
      }),
    [fileSaveAdapter],
  );

  const chooseSaveDestination = useCallback(async (): Promise<string | null> => {
    if (Platform.OS !== 'android') return null;
    return requestAndPersistSafDestination({
      adapter: fileSaveAdapter,
      getCurrent: () => getSetting(db, FILE_SAVE_DIR_ANDROID)?.trim() || null,
      persist: (directoryUri) => setSetting(db, FILE_SAVE_DIR_ANDROID, directoryUri),
    });
  }, [fileSaveAdapter, db]);

  const clearSaveDestination = useCallback((): void => {
    setSetting(db, FILE_SAVE_DIR_ANDROID, '');
  }, [db]);

  const openFromStore = useCallback(
    (contentId: string, linkKey: Uint8Array): Promise<OpenResult> => {
      return fetchFromStore(store, contentId, linkKey);
    },
    [store],
  );

  const relayUrl = effectiveRelayUrl(db) || null;

  const openFromRemoteHosts = useCallback(
    async (
      parts: ShareLinkParts,
      hostText: string,
      discoveredHosts?: string[],
    ): Promise<OpenRemoteShareResult> => {
      // The caller already ran discovery once (discoverHosts) and threads the
      // result here, so openRemoteShare unions it with the pasted hosts without
      // a second relay round-trip. With nothing discovered, this is pasted-only.
      const result = await openRemoteShare({ store, parts, hostText, discoveredHosts });
      if (result.ok && result.pinned) await refresh();
      return result;
    },
    [store, refresh],
  );

  const discoverHosts = useCallback(
    async (contentId: string): Promise<string[]> => {
      const relay = effectiveRelayUrl(db);
      if (!relay) return [];
      return discoverShareHosts({ relayUrl: relay, contentId });
    },
    [db],
  );

  const unpin = useCallback(
    async (contentId: string): Promise<void> => {
      await unpinShare(store, contentId);
      await refresh();
    },
    [store, refresh],
  );

  const clearAll = useCallback(async (): Promise<void> => {
    await store.clearAll();
    await refresh();
  }, [store, refresh]);

  const sealCommunityBanner = useCallback(
    async (communityId: string, base64: string): Promise<CommunityIdentityBanner | null> => {
      const banner = await sealCommunityBannerCore({ db, store, identity, communityId, base64 });
      if (banner) await refresh();
      return banner;
    },
    [db, store, identity, refresh],
  );

  const resolveCommunityBannerImage = useCallback(
    (communityId: string): Promise<string | null> =>
      resolveCommunityBannerImageCore({ db, store, identity, communityId }),
    [db, store, identity],
  );

  const value = useMemo<NodeContextValue>(
    () => ({
      pinned,
      stats,
      store,
      refresh,
      createAndPin,
      openFromStore,
      openFromRemoteHosts,
      discoverHosts,
      relayUrl,
      unpin,
      clearAll,
      getSessionLink,
      saveContent,
      saveContentToDocuments,
      getSaveDestination,
      chooseSaveDestination,
      clearSaveDestination,
      sealCommunityBanner,
      resolveCommunityBannerImage,
    }),
    [
      pinned,
      stats,
      store,
      refresh,
      createAndPin,
      openFromStore,
      openFromRemoteHosts,
      discoverHosts,
      relayUrl,
      unpin,
      clearAll,
      getSessionLink,
      saveContent,
      saveContentToDocuments,
      getSaveDestination,
      chooseSaveDestination,
      clearSaveDestination,
      sealCommunityBanner,
      resolveCommunityBannerImage,
    ],
  );

  return <NodeContext.Provider value={value}>{children}</NodeContext.Provider>;
}

// Re-export for screens that decode a link key passed via base64 (e.g. detail).
export function decodeLinkKeyBase64(b64: string): Uint8Array {
  return decodeBase64(b64);
}
