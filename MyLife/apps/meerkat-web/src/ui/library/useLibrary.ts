// Plan 38 Phase 5/3 (WEB): the UI-facing library hook. It binds the shipped,
// import-only data layer (library-store.ts, byte-locked to mobile via its pure
// core) to the live provider handles (db, identity, nodeStore) and bumps the
// provider revision after every write so the browse screens re-read. It adds NO
// business logic: the one local helper (editItemMetadata) re-signs an item row in
// place through the pure createLibraryItemEvent, preserving the sealed content +
// keys, because the store exposes ingest + tombstone but not an in-place edit.

import { useMemo } from 'react';
import type { DeviceIdentity, NodeStore } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import type { LibraryPinPolicy, LibraryPinStore } from '../../lib/library-storage-core';
import { CM_LIBRARY_ITEMS_TABLE } from '../../lib/meerkat-data';
import type { KnownMediaType } from '../../lib/library-metadata-core';
import {
  createLibraryItemEvent,
  libraryItemEventToRow,
  type LibraryConfigEvent,
  type LibraryItemEvent,
  type ResolvedLibraryItem,
} from '../../lib/library-data-core';
import { openLibraryItemCover } from '../../lib/library-media';
import {
  addItemToCollection,
  addLibraryItem,
  addLibraryItemTag,
  createLibrary,
  createLibraryCollection,
  createSmartRule,
  getLibrary,
  getLibraryItem,
  getLibraryProgress,
  ingestFromShareIntake,
  isLibraryItemContentHeld,
  libraryWorkspaceContext,
  listCollectionItemIds,
  listLibraries,
  listLibraryCollections,
  listLibraryItems,
  listLibraryItemTags,
  listSmartRules,
  openLibraryItemContent,
  promoteChannelFile,
  setLibraryProgress,
  tombstoneLibraryItem,
  applyLibraryPinPolicy,
  getLibraryItemPinInfo,
  getLibraryPinPolicy,
  keepLibraryItemOnDevice,
  libraryStorageStats,
  reconcileLibraryPinClasses,
  releaseLibraryItemFromDevice,
  touchLibraryItemUse,
  type AddLibraryItemResult,
  type LibraryItemPinInfo,
  type LibraryProgress,
  type LibraryStorageStats,
} from '../../lib/library-store';
import type { LibraryCollectionEvent, SmartRuleEvent } from '../../lib/library-data-core';

export type LibraryWorkspaceKind = 'personal' | 'community';

export interface EditItemFields {
  title: string;
  sortTitle?: string | null;
  year?: number | null;
  metadata?: Record<string, unknown>;
}

export interface UseLibrary {
  workspaceKind: (workspaceId: string) => LibraryWorkspaceKind | null;
  canCurate: (workspaceId: string, channelId: string) => boolean;
  listLibraries: (workspaceId: string) => LibraryConfigEvent[];
  createLibrary: (workspaceId: string, name: string, mediaType: KnownMediaType) => LibraryConfigEvent;
  getLibrary: (channelId: string) => LibraryConfigEvent | null;
  listItems: (channelId: string) => ResolvedLibraryItem[];
  getItem: (itemId: string) => LibraryItemEvent | null;
  addFile: (args: {
    channelId: string;
    workspaceId: string;
    bytes: Uint8Array;
    title: string;
    mimeType?: string | null;
    sortTitle?: string | null;
    year?: number | null;
    durationMs?: number | null;
    metadata?: Record<string, unknown>;
    metadataSource?: string;
  }) => Promise<AddLibraryItemResult>;
  ingestFromShareIntake: (args: {
    intakeId: string;
    channelId: string;
    workspaceId: string;
    title?: string;
  }) => Promise<AddLibraryItemResult>;
  promoteChannelFile: (args: {
    blobHash: string;
    channelId: string;
    workspaceId: string;
    title: string;
    mimeType?: string | null;
  }) => Promise<AddLibraryItemResult>;
  editItemMetadata: (itemId: string, fields: EditItemFields) => LibraryItemEvent | null;
  tombstoneItem: (itemId: string) => Promise<LibraryItemEvent | null>;
  openContent: (item: LibraryItemEvent) => Promise<Uint8Array | null>;
  isContentHeld: (item: LibraryItemEvent) => Promise<boolean>;
  openCover: (item: LibraryItemEvent) => Promise<Uint8Array | null>;
  listCollections: (channelId: string) => LibraryCollectionEvent[];
  createCollection: (channelId: string, workspaceId: string, name: string, pinned?: boolean) => LibraryCollectionEvent;
  addToCollection: (channelId: string, workspaceId: string, collectionId: string, itemId: string) => void;
  listCollectionItemIds: (channelId: string, collectionId: string) => string[];
  listSmartRules: (channelId: string, collectionId: string) => SmartRuleEvent[];
  createSmartRule: (channelId: string, workspaceId: string, collectionId: string, ruleType: string, rule: Record<string, unknown>) => SmartRuleEvent;
  listTags: (channelId: string, itemId: string) => string[];
  addTag: (channelId: string, workspaceId: string, itemId: string, tag: string) => void;
  getProgress: (itemId: string) => LibraryProgress | null;
  setProgress: (itemId: string, workspaceId: string, positionMs: number, completed: boolean) => void;
  // Plan 38 C.7 pin policy + keep/release + storage stats.
  pinPolicy: (channelId: string) => LibraryPinPolicy;
  setPinPolicy: (channelId: string, policy: LibraryPinPolicy) => Promise<void>;
  storageStats: (channelId: string) => Promise<LibraryStorageStats>;
  reconcilePins: (channelId: string) => Promise<void>;
  itemPinInfo: (item: LibraryItemEvent) => Promise<LibraryItemPinInfo>;
  keepItem: (item: LibraryItemEvent) => Promise<void>;
  releaseItem: (item: LibraryItemEvent) => Promise<void>;
  touchItemUse: (item: LibraryItemEvent) => Promise<void>;
}

export function useLibrary(): UseLibrary {
  const m = useMeerkat();
  const db = m.db;
  const identity = m.identity as DeviceIdentity;
  const store = m.nodeStore as unknown as NodeStore & LibraryPinStore;
  const refresh = m.refresh;

  return useMemo<UseLibrary>(() => {
    const kind = (workspaceId: string): LibraryWorkspaceKind | null => {
      const ctx = libraryWorkspaceContext(db, workspaceId);
      return ctx ? ctx.kind : null;
    };
    return {
      workspaceKind: kind,
      canCurate: (workspaceId, _channelId) => {
        const ctx = libraryWorkspaceContext(db, workspaceId);
        if (!ctx) return false;
        if (ctx.kind === 'personal') return ctx.configSigner === identity.publicKey;
        // Community: only the owner creates libraries; postRoles govern per-item
        // curation. The browse UI gates the create + ingest affordances on owner
        // for now (community-shared ingest lands with the community phase).
        return ctx.descriptor?.ownerDeviceId === identity.publicKey;
      },
      listLibraries: (workspaceId) => listLibraries(db, workspaceId),
      createLibrary: (workspaceId, name, mediaType) => {
        const config = createLibrary(db, identity, { workspaceId, name, mediaType });
        void db.flush();
        refresh();
        return config;
      },
      getLibrary: (channelId) => getLibrary(db, channelId),
      listItems: (channelId) => listLibraryItems(db, channelId),
      getItem: (itemId) => getLibraryItem(db, itemId),
      addFile: async (args) => {
        const result = await addLibraryItem(db, store, identity, {
          channelId: args.channelId,
          workspaceId: args.workspaceId,
          bytes: args.bytes,
          title: args.title,
          mimeType: args.mimeType ?? null,
          sortTitle: args.sortTitle ?? null,
          year: args.year ?? null,
          durationMs: args.durationMs ?? null,
          metadata: args.metadata,
          metadataSource: args.metadataSource,
        });
        await db.flush();
        refresh();
        return result;
      },
      ingestFromShareIntake: async (args) => {
        const result = await ingestFromShareIntake(
          db, store, identity,
          { intakeId: args.intakeId, channelId: args.channelId, workspaceId: args.workspaceId, title: args.title },
          (hash) => m.getBlob(hash),
        );
        await db.flush();
        refresh();
        return result;
      },
      promoteChannelFile: async (args) => {
        const result = await promoteChannelFile(
          db, store, identity,
          { blobHash: args.blobHash, channelId: args.channelId, workspaceId: args.workspaceId, title: args.title, mimeType: args.mimeType ?? null },
          (hash) => m.getBlob(hash),
        );
        await db.flush();
        refresh();
        return result;
      },
      editItemMetadata: (itemId, fields) => {
        const item = getLibraryItem(db, itemId);
        if (!item) return null;
        const edited = createLibraryItemEvent(identity, {
          id: item.id,
          communityId: item.communityId,
          channelId: item.channelId,
          contentCid: item.contentCid,
          coverCid: item.coverCid,
          thumbCid: item.thumbCid,
          keyEpoch: item.keyEpoch,
          wrappedKey: item.wrappedKey,
          coverWrappedKey: item.coverWrappedKey,
          manifestJson: item.manifestJson,
          title: fields.title,
          sortTitle: fields.sortTitle ?? null,
          year: fields.year ?? null,
          durationMs: item.durationMs,
          sizeBytes: item.sizeBytes,
          mimeType: item.mimeType,
          metadataJson: JSON.stringify(fields.metadata ?? {}),
          metadataSource: item.metadataSource,
        });
        const row = libraryItemEventToRow(edited);
        const cols = Object.keys(row);
        db.execute(
          `INSERT OR REPLACE INTO ${CM_LIBRARY_ITEMS_TABLE} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => row[c]),
        );
        void db.flush();
        refresh();
        return edited;
      },
      tombstoneItem: async (itemId) => {
        const result = await tombstoneLibraryItem(db, store, identity, itemId);
        await db.flush();
        refresh();
        return result;
      },
      openContent: (item) => openLibraryItemContent(db, store, identity, item),
      isContentHeld: (item) => isLibraryItemContentHeld(store, item),
      openCover: (item) => openLibraryItemCover(db, store, identity, item),
      listCollections: (channelId) => listLibraryCollections(db, channelId),
      createCollection: (channelId, workspaceId, name, pinned) => {
        const event = createLibraryCollection(db, identity, { channelId, workspaceId, name, pinned });
        void db.flush();
        refresh();
        return event;
      },
      addToCollection: (channelId, workspaceId, collectionId, itemId) => {
        addItemToCollection(db, identity, { channelId, workspaceId, collectionId, itemId });
        void db.flush();
        refresh();
      },
      listCollectionItemIds: (channelId, collectionId) => listCollectionItemIds(db, channelId, collectionId),
      listSmartRules: (channelId, collectionId) => listSmartRules(db, channelId, collectionId),
      createSmartRule: (channelId, workspaceId, collectionId, ruleType, rule) => {
        const event = createSmartRule(db, identity, { channelId, workspaceId, collectionId, ruleType, rule });
        void db.flush();
        refresh();
        return event;
      },
      listTags: (channelId, itemId) => listLibraryItemTags(db, channelId, itemId),
      addTag: (channelId, workspaceId, itemId, tag) => {
        addLibraryItemTag(db, identity, { channelId, workspaceId, itemId, tag });
        void db.flush();
        refresh();
      },
      getProgress: (itemId) => getLibraryProgress(db, itemId),
      setProgress: (itemId, workspaceId, positionMs, completed) => {
        setLibraryProgress(db, itemId, { positionMs, completed, communityId: workspaceId });
        void db.flush();
        refresh();
      },
      pinPolicy: (channelId) => getLibraryPinPolicy(db, channelId),
      setPinPolicy: async (channelId, policy) => {
        await applyLibraryPinPolicy(db, store, channelId, policy);
        await db.flush();
        refresh();
      },
      storageStats: (channelId) => libraryStorageStats(db, store, channelId),
      reconcilePins: async (channelId) => {
        await reconcileLibraryPinClasses(db, store, channelId);
        await db.flush();
      },
      itemPinInfo: (item) => getLibraryItemPinInfo(db, store, item),
      keepItem: async (item) => {
        await keepLibraryItemOnDevice(db, store, item);
        await db.flush();
        refresh();
      },
      releaseItem: async (item) => {
        await releaseLibraryItemFromDevice(db, store, item);
        await db.flush();
        refresh();
      },
      touchItemUse: async (item) => {
        await touchLibraryItemUse(store, item);
        await db.flush();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, identity, store, m, refresh]);
}
