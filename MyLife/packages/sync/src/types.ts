/**
 * @mylife/sync -- Core types for the data sync abstraction layer.
 *
 * Defines sync tiers, provider interface, and status types used across
 * all sync providers (local-only, P2P, cloud).
 */

/**
 * Sync tier determines the sync strategy and storage limits.
 *
 * - local_only: No sync, data stays on device (Tier 0)
 * - p2p: Device-to-device sync via WebRTC, no auth required (Tier 1)
 * - free_cloud: 1GB cloud sync via PowerSync, requires auth (Tier 2)
 * - starter_cloud: 5GB cloud sync via PowerSync, requires auth (Tier 3a)
 * - power_cloud: 25GB cloud sync via PowerSync, requires auth (Tier 3b)
 */
export type SyncTier =
  | 'local_only'
  | 'p2p'
  | 'free_cloud'
  | 'starter_cloud'
  | 'power_cloud';

export type SyncScope = 'device_local' | 'personal_replica' | 'shared_workspace' | 'published_blob';
export type WorkspaceType = 'personal' | 'group' | 'community' | 'dm_group';
export type WorkspaceMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export const SYNC_SCOPE_RANK: Record<SyncScope, number> = {
  device_local: 0,
  personal_replica: 1,
  shared_workspace: 2,
  published_blob: 3,
};

export function isScopeWithinMaxScope(scope: SyncScope, maxScope?: SyncScope): boolean {
  if (!maxScope) return true;
  return SYNC_SCOPE_RANK[scope] <= SYNC_SCOPE_RANK[maxScope];
}

/** Current status of the sync provider. */
export interface SyncStatus {
  tier: SyncTier;
  connected: boolean;
  lastSyncedAt: Date | null;
  storageUsedBytes: number;
  storageLimitBytes: number;
  pendingChanges: number;
}

/** Events emitted by a SyncProvider during its lifecycle. */
export type SyncEvent =
  | { type: 'status_change'; status: SyncStatus }
  | { type: 'sync_complete'; timestamp: Date }
  | { type: 'sync_error'; error: Error }
  | { type: 'peer_connected'; peerId: string }
  | { type: 'peer_disconnected'; peerId: string };

export type SyncEventListener = (event: SyncEvent) => void;

/**
 * Abstract interface that all sync providers must implement.
 * The hub creates one active provider at a time based on the user's tier.
 */
export interface SyncProvider {
  /** The tier this provider serves. */
  readonly tier: SyncTier;

  /** Initialize the provider. Must be called before sync(). */
  initialize(): Promise<void>;

  /** Trigger a sync cycle. No-op for local-only. */
  sync(): Promise<void>;

  /** Pause active syncing (keeps connection alive if applicable). */
  pause(): Promise<void>;

  /** Resume syncing after a pause. */
  resume(): Promise<void>;

  /** Get the current sync status snapshot. */
  getStatus(): SyncStatus;

  /** Get the number of bytes used by the local SQLite database. */
  getStorageUsed(): Promise<number>;

  /** Register a listener for sync events. Returns an unsubscribe function. */
  onEvent(listener: SyncEventListener): () => void;

  /** Tear down the provider and release resources. */
  destroy(): Promise<void>;
}

/**
 * Storage limits per cloud tier in bytes.
 * P2P and local-only have no cloud storage limit (Infinity).
 */
export const STORAGE_LIMITS: Record<SyncTier, number> = {
  local_only: Infinity,
  p2p: Infinity,
  free_cloud: 1 * 1024 * 1024 * 1024, // 1 GB
  starter_cloud: 5 * 1024 * 1024 * 1024, // 5 GB
  power_cloud: 25 * 1024 * 1024 * 1024, // 25 GB
};

/** Returns true if the given tier requires Supabase auth. */
export function tierRequiresAuth(tier: SyncTier): boolean {
  return tier === 'free_cloud' || tier === 'starter_cloud' || tier === 'power_cloud';
}

/** Returns true if the given tier is a cloud tier. */
export function isCloudTier(tier: SyncTier): boolean {
  return tierRequiresAuth(tier);
}

// ---------------------------------------------------------------------------
// P2P Sync Types (Spec Sections 3-8, 11)
// ---------------------------------------------------------------------------

import { z } from 'zod';

/** Ed25519 + X25519 keypair generated on first launch. */
export interface DeviceIdentity {
  /** Ed25519 public key (hex-encoded, used as device ID). */
  publicKey: string;
  /** Reference to the private key in secure storage (never the raw key). */
  privateKeyRef: string;
  /** X25519 public key for Diffie-Hellman key agreement (hex-encoded). */
  dhPublicKey: string;
  /** Human-readable device name. */
  displayName: string;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

export const DeviceIdentitySchema = z.object({
  publicKey: z.string().min(1),
  privateKeyRef: z.string().min(1),
  dhPublicKey: z.string().min(1),
  displayName: z.string().min(1),
  createdAt: z.string(),
});

/** A device that has been paired with this one. */
export interface PairedDevice {
  /** Ed25519 public key of the paired device (hex-encoded). */
  deviceId: string;
  /** Human-readable device name. */
  displayName: string;
  /** X25519 public key (hex-encoded). */
  dhPublicKey: string;
  /** Reference to the derived shared secret in secure storage. */
  sharedSecretRef: string;
  /** ISO 8601 last-seen timestamp. */
  lastSeenAt: string | null;
  /** ISO 8601 last sync timestamp. */
  lastSyncAt: string | null;
  /** Last module synced with this device. */
  lastSyncModule: string | null;
  /** Total bytes sent to this device. */
  bytesSent: number;
  /** Total bytes received from this device. */
  bytesReceived: number;
  /** Whether the device is active (not revoked). */
  isActive: boolean;
  /** ISO 8601 pairing timestamp. */
  pairedAt: string;
}

export const PairedDeviceSchema = z.object({
  deviceId: z.string().min(1),
  displayName: z.string().min(1),
  dhPublicKey: z.string().min(1),
  sharedSecretRef: z.string().min(1),
  lastSeenAt: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  lastSyncModule: z.string().nullable(),
  bytesSent: z.number().int().min(0),
  bytesReceived: z.number().int().min(0),
  isActive: z.boolean(),
  pairedAt: z.string(),
});

/** A single row change recorded for outbound sync. */
export interface ChangeRecord {
  /** ULID identifier. */
  id: string;
  /** Module that owns the table. */
  moduleId: string;
  /** Table name (with prefix, e.g. 'bk_books'). */
  tableName: string;
  /** The operation type. */
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Primary key of the affected row. */
  rowId: string;
  /** Serialized row data (null for DELETE). */
  dataJson: string | null;
  /** Device that produced this change. */
  deviceId: string;
  /** Monotonic timestamp. */
  timestamp: number;
  /** Whether this change has been sent to all peers. */
  synced: boolean;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
}

export const ChangeRecordSchema = z.object({
  id: z.string().min(1),
  moduleId: z.string().min(1),
  tableName: z.string().min(1),
  operation: z.enum(['INSERT', 'UPDATE', 'DELETE']),
  rowId: z.string().min(1),
  dataJson: z.string().nullable(),
  deviceId: z.string().min(1),
  timestamp: z.number().int(),
  synced: z.boolean(),
  createdAt: z.string(),
});

/** Per-module sync state tracking what each peer has received. */
export interface PeerModuleState {
  deviceId: string;
  moduleId: string;
  lastSyncedVersion: number;
  lastSyncedAt: string | null;
  automergeHeads: string | null;
}

export const PeerModuleStateSchema = z.object({
  deviceId: z.string().min(1),
  moduleId: z.string().min(1),
  lastSyncedVersion: z.number().int().min(0),
  lastSyncedAt: z.string().nullable(),
  automergeHeads: z.string().nullable(),
});

/** A revoked device that can no longer sync. */
export interface DeviceRevocation {
  deviceId: string;
  revokedByDeviceId: string;
  reason: string | null;
  revokedAt: string;
}

export const DeviceRevocationSchema = z.object({
  deviceId: z.string().min(1),
  revokedByDeviceId: z.string().min(1),
  reason: z.string().nullable(),
  revokedAt: z.string(),
});

/** Metadata for a content-addressed blob stored locally. */
export interface BlobRef {
  /** SHA-256 hash (hex-encoded). */
  hash: string;
  /** Size in bytes. */
  size: number;
  /** MIME type. */
  mimeType: string;
  /** Module that owns this blob. */
  moduleId: string;
  /** Number of references to this blob. */
  refCount: number;
  /** ISO 8601 storage timestamp. */
  storedAt: string;
}

export const BlobRefSchema = z.object({
  hash: z.string().min(1),
  size: z.number().int().min(0),
  mimeType: z.string().min(1),
  moduleId: z.string().min(1),
  refCount: z.number().int().min(0),
  storedAt: z.string(),
});

/** Per-module blob sync policy. */
export type BlobSyncPolicy = 'always' | 'wifi_only' | 'manual' | 'never';

export interface BlobPolicyEntry {
  moduleId: string;
  policy: BlobSyncPolicy;
  maxBlobSizeBytes: number;
  updatedAt: string;
}

export const BlobPolicyEntrySchema = z.object({
  moduleId: z.string().min(1),
  policy: z.enum(['always', 'wifi_only', 'manual', 'never']),
  maxBlobSizeBytes: z.number().int().min(0),
  updatedAt: z.string(),
});

/** Audit trail for a completed sync session. */
export type SyncTransport = 'lan' | 'nearby' | 'ble' | 'wan_webrtc' | 'wan_relay';
export type SyncDirection = 'push' | 'pull' | 'bidirectional';
export type SyncSessionStatus = 'completed' | 'partial' | 'failed';

export interface SyncSession {
  id: string;
  workspaceId?: string | null;
  peerDeviceId: string;
  transport: SyncTransport;
  direction: SyncDirection;
  modulesSynced: string[];
  changesSent: number;
  changesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  blobsSent: number;
  blobsReceived: number;
  durationMs: number;
  status: SyncSessionStatus;
  error: string | null;
  startedAt: string;
  completedAt: string;
}

export const SyncSessionSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1).nullable().optional(),
  peerDeviceId: z.string().min(1),
  transport: z.enum(['lan', 'nearby', 'ble', 'wan_webrtc', 'wan_relay']),
  direction: z.enum(['push', 'pull', 'bidirectional']),
  modulesSynced: z.array(z.string()),
  changesSent: z.number().int().min(0),
  changesReceived: z.number().int().min(0),
  bytesSent: z.number().int().min(0),
  bytesReceived: z.number().int().min(0),
  blobsSent: z.number().int().min(0),
  blobsReceived: z.number().int().min(0),
  durationMs: z.number().int().min(0),
  status: z.enum(['completed', 'partial', 'failed']),
  error: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Sync Protocol Message Types (Spec Section 4.3)
// ---------------------------------------------------------------------------

export type SyncMessageType =
  | 'HELLO'
  | 'HELLO_ACK'
  | 'AUTH_CHALLENGE'
  | 'AUTH_RESPONSE'
  | 'SYNC_OFFER'
  | 'SYNC_ACCEPT'
  | 'SYNC_DATA'
  | 'SYNC_ACK'
  | 'BLOB_REQUEST'
  | 'BLOB_DATA'
  | 'BLOB_ACK'
  | 'GOSSIP'
  | 'BYE';

export interface SyncMessage {
  type: SyncMessageType;
  deviceId: string;
  nonce: string;
  payload: Uint8Array;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Content Distribution / Torrent Types (Spec Section 11)
// ---------------------------------------------------------------------------

export type ContentAccess = 'public' | 'link' | 'paid' | 'encrypted';

export type ContentCategory =
  | 'film'
  | 'music'
  | 'education'
  | 'book'
  | 'software'
  | 'template'
  | 'dataset'
  | 'game'
  | 'art'
  | 'other';

export interface ContentManifest {
  infoHash: string;
  title: string;
  description: string;
  creator: {
    publicKey: string;
    displayName: string;
    signature: string;
  };
  files: {
    path: string;
    size: number;
    hash: string;
    mimeType: string;
  }[];
  pieceLength: number;
  pieces: string[];
  totalSize: number;
  merkleRoot: string;
  access: ContentAccess;
  price?: {
    amount: number;
    currency: string;
    paymentMethods: string[];
  };
  encryptedKey?: string;
  tags: string[];
  category: ContentCategory;
  createdAt: string;
  version: number;
  trackers: string[];
  webSeeds: string[];
}

export const ContentManifestSchema = z.object({
  infoHash: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  creator: z.object({
    publicKey: z.string().min(1),
    displayName: z.string().min(1),
    signature: z.string().min(1),
  }),
  files: z.array(z.object({
    path: z.string().min(1),
    size: z.number().int().min(0),
    hash: z.string().min(1),
    mimeType: z.string().min(1),
  })),
  pieceLength: z.number().int().positive(),
  pieces: z.array(z.string()),
  totalSize: z.number().int().min(0),
  merkleRoot: z.string().min(1),
  access: z.enum(['public', 'link', 'paid', 'encrypted']),
  price: z.object({
    amount: z.number().positive(),
    currency: z.string(),
    paymentMethods: z.array(z.string()),
  }).optional(),
  encryptedKey: z.string().optional(),
  tags: z.array(z.string()),
  category: z.enum([
    'film', 'music', 'education', 'book', 'software',
    'template', 'dataset', 'game', 'art', 'other',
  ]),
  createdAt: z.string(),
  version: z.number().int().positive(),
  trackers: z.array(z.string()),
  webSeeds: z.array(z.string()),
});

export interface SeedingPolicy {
  enabled: boolean;
  maxUploadKbps: number;
  maxSeedStorageMB: number;
  autoDeleteDays: number;
  seedOnCellular: boolean;
  seedWhileCharging: boolean;
  updatedAt: string;
}

export const SeedingPolicySchema = z.object({
  enabled: z.boolean(),
  maxUploadKbps: z.number().int().min(0),
  maxSeedStorageMB: z.number().int().min(0),
  autoDeleteDays: z.number().int().min(0),
  seedOnCellular: z.boolean(),
  seedWhileCharging: z.boolean(),
  updatedAt: z.string(),
});

export type TorrentDownloadStatus =
  | 'downloading'
  | 'completed'
  | 'paused'
  | 'seeding'
  | 'stopped';

export type TorrentPieceStatus = 'missing' | 'downloading' | 'verified';

export type TorrentPaymentDirection = 'incoming' | 'outgoing';
export type TorrentPaymentStatus = 'pending' | 'completed' | 'refunded' | 'failed';

// ---------------------------------------------------------------------------
// Transport Types
// ---------------------------------------------------------------------------

/** Transport connection abstraction for LAN and WAN. */
export interface TransportConnection {
  /** Unique identifier for this connection. */
  id: string;
  /** Remote device ID. */
  remoteDeviceId: string;
  /** Transport type used. */
  transport: SyncTransport;
  /** Send binary data to the remote peer. */
  send(data: Uint8Array): Promise<void>;
  /** Register handler for incoming data. */
  onData(handler: (data: Uint8Array) => void): void;
  /** Close the connection. */
  close(): Promise<void>;
}

/** Discovered peer on the local network. */
export interface DiscoveredPeer {
  deviceId: string;
  displayName: string;
  host: string;
  port: number;
  discoveredAt: number;
}

// ---------------------------------------------------------------------------
// Mesh Sync Types (Workspace, ACL, Conflict, Relay)
// ---------------------------------------------------------------------------

export interface SyncWorkspace {
  id: string;
  displayName: string;
  workspaceType: WorkspaceType;
  createdByDeviceId: string;
  createdAt: string;
  rotatedAt: string | null;
  currentKeyVersion: number;
  archivedAt: string | null;
}

export interface SyncWorkspaceMember {
  workspaceId: string;
  deviceId: string;
  role: WorkspaceMemberRole;
  invitedByDeviceId: string;
  invitedAt: string;
  removedAt: string | null;
}

export interface SyncWorkspaceKeyWrap {
  workspaceId: string;
  keyVersion: number;
  wrappedForDeviceId: string;
  wrappedKeyBlob: Uint8Array;
  validFrom: string;
  validUntil: string | null;
}

/**
 * Community history scope (Meerkat community feed, P0).
 * - `join_point`: a joiner receives wraps for the current epoch onward only;
 *   earlier epochs stay unreadable (matches the epoch-exclusion default).
 * - `full`: the committer ALSO back-wraps every prior epoch secret to the new
 *   member so they can decrypt all historical snapshots. A deliberate,
 *   owner-approved relaxation of forward secrecy for newcomers, surfaced in UI.
 */
export type HistoryScope = 'full' | 'join_point';

/**
 * Admin-set community feed poll cadence (Meerkat community feed, P4). A number is
 * the interval in milliseconds; `'manual'` means no automatic polling.
 */
export type FeedPollIntervalMs = number | 'manual';

export interface SyncEntityAcl {
  moduleId: string;
  tableName: string;
  rowId: string;
  workspaceId: string;
  scope: SyncScope;
  updatedAt: string;
}

export interface SyncTombstone {
  moduleId: string;
  tableName: string;
  rowId: string;
  deletedByDeviceId: string;
  deletedAt: string;
}

export interface SyncReceipt {
  sessionId: string;
  peerDeviceId: string;
  moduleId: string;
  changeId: string;
  acknowledgedAt: string;
}

/** A trust-on-first-use pinned device identity (MK-015). */
export interface SyncPinnedIdentity {
  deviceId: string;
  dhPublicKey: string;
  displayName: string;
  bundleJson: string;
  bundleSignature: string;
  firstSeenAt: string;
  lastSeenAt: string;
  keyChangeCount: number;
}

/** A recorded SAS (emoji) verification for a peer at a trust boundary (MK-017). */
export interface SyncSasVerification {
  peerDeviceId: string;
  /** Workspace id this verification covers, or '' for the personal boundary. */
  workspaceId: string;
  /** The verified five-emoji indices (locale-independent), e.g. "12-3-44-7-60". */
  sasIndices: string;
  verifiedAt: string;
}

export type InboundAuditOutcome = 'accepted' | 'rejected';

/** Audit record for an inbound change decision (MK-002). */
export interface SyncInboundAudit {
  id: string;
  sessionId: string | null;
  peerDeviceId: string;
  moduleId: string | null;
  tableName: string | null;
  rowId: string | null;
  operation: string | null;
  outcome: InboundAuditOutcome;
  reason: string | null;
  scope: SyncScope | null;
  createdAt: string;
}

export interface SyncConflictEntry {
  id: string;
  workspaceId: string;
  moduleId: string;
  tableName: string;
  rowId: string;
  localVersionJson: string;
  remoteVersionJson: string;
  remoteDeviceId: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: 'local' | 'remote' | 'merged' | null;
}

export interface SyncTransportPreference {
  deviceId: string;
  layerId: number;
  rank: number;
  enabled: boolean;
  updatedAt: string;
}

export type SyncSecuritySubjectType = 'default' | 'workspace' | 'direct';
export type SyncEncryptionMode = 'off' | 'opportunistic' | 'required';

export interface SyncSecurityPreference {
  /** default = global fallback, workspace = workspace ID, direct = peer/contact ID. */
  subjectType: SyncSecuritySubjectType;
  subjectId: string;
  encryptionMode: SyncEncryptionMode;
  disappearingMessagesEnabled: boolean;
  disappearAfterSeconds: number | null;
  updatedAt: string;
}

export interface SyncSecurityConfirmation {
  subjectType: SyncSecuritySubjectType;
  subjectId: string;
  peerDeviceId: string;
  localEncryptionMode: SyncEncryptionMode;
  remoteEncryptionMode: SyncEncryptionMode;
  encryptionConfirmed: boolean;
  disappearingMessagesConfirmed: boolean;
  disappearAfterSeconds: number | null;
  confirmedAt: string;
}

export interface SyncExpiringEntity {
  moduleId: string;
  tableName: string;
  rowId: string;
  expiresAt: string;
  deleteAfterSync: boolean;
  createdAt: string;
}

export interface SyncSessionModuleStats {
  sessionId: string;
  moduleId: string;
  changesSent: number;
  changesReceived: number;
  bytesSent: number;
  bytesReceived: number;
}

export interface SyncRelayToken {
  workspaceId: string;
  peerDeviceId: string;
  ephemeralToken: string;
  createdAt: string;
  expiresAt: string;
}

export const SyncScopeSchema = z.enum(['device_local', 'personal_replica', 'shared_workspace', 'published_blob']);
export const WorkspaceTypeSchema = z.enum(['personal', 'group', 'community', 'dm_group']);
export const WorkspaceMemberRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export const SyncSecuritySubjectTypeSchema = z.enum(['default', 'workspace', 'direct']);
export const SyncEncryptionModeSchema = z.enum(['off', 'opportunistic', 'required']);

export const SyncWorkspaceSchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  workspaceType: WorkspaceTypeSchema,
  createdByDeviceId: z.string().min(1),
  createdAt: z.string(),
  rotatedAt: z.string().nullable(),
  currentKeyVersion: z.number().int().positive(),
  archivedAt: z.string().nullable(),
});

export const SyncWorkspaceMemberSchema = z.object({
  workspaceId: z.string().min(1),
  deviceId: z.string().min(1),
  role: WorkspaceMemberRoleSchema,
  invitedByDeviceId: z.string().min(1),
  invitedAt: z.string(),
  removedAt: z.string().nullable(),
});

export const SyncConflictEntrySchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  moduleId: z.string().min(1),
  tableName: z.string().min(1),
  rowId: z.string().min(1),
  localVersionJson: z.string(),
  remoteVersionJson: z.string(),
  remoteDeviceId: z.string().min(1),
  createdAt: z.string(),
  resolvedAt: z.string().nullable(),
  resolution: z.enum(['local', 'remote', 'merged']).nullable(),
});

export const SyncRelayTokenSchema = z.object({
  workspaceId: z.string().min(1),
  peerDeviceId: z.string().min(1),
  ephemeralToken: z.string().min(1),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export const SyncSecurityPreferenceSchema = z.object({
  subjectType: SyncSecuritySubjectTypeSchema,
  subjectId: z.string().min(1),
  encryptionMode: SyncEncryptionModeSchema,
  disappearingMessagesEnabled: z.boolean(),
  disappearAfterSeconds: z.number().int().positive().nullable(),
  updatedAt: z.string(),
});

export const SyncSecurityConfirmationSchema = z.object({
  subjectType: SyncSecuritySubjectTypeSchema,
  subjectId: z.string().min(1),
  peerDeviceId: z.string().min(1),
  localEncryptionMode: SyncEncryptionModeSchema,
  remoteEncryptionMode: SyncEncryptionModeSchema,
  encryptionConfirmed: z.boolean(),
  disappearingMessagesConfirmed: z.boolean(),
  disappearAfterSeconds: z.number().int().positive().nullable(),
  confirmedAt: z.string(),
});

export const SyncExpiringEntitySchema = z.object({
  moduleId: z.string().min(1),
  tableName: z.string().min(1),
  rowId: z.string().min(1),
  expiresAt: z.string(),
  deleteAfterSync: z.boolean(),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Direct Share Types
// ---------------------------------------------------------------------------

export type ShareStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export const ShareStatusSchema = z.enum(['pending', 'sent', 'delivered', 'failed']);

export interface ShareRequest {
  id: string;
  fromDeviceId: string;
  toDeviceId: string;
  moduleId: string;
  tableName: string;
  rowId: string;
  dataJson: string;
  workspaceId: string | null;
  status: ShareStatus;
  transport: SyncTransport | null;
  createdAt: string;
  deliveredAt: string | null;
}

export const ShareRequestSchema = z.object({
  id: z.string().min(1),
  fromDeviceId: z.string().min(1),
  toDeviceId: z.string().min(1),
  moduleId: z.string().min(1),
  tableName: z.string().min(1),
  rowId: z.string().min(1),
  dataJson: z.string(),
  workspaceId: z.string().min(1).nullable(),
  status: ShareStatusSchema,
  transport: z.enum(['lan', 'nearby', 'ble', 'wan_webrtc', 'wan_relay']).nullable(),
  createdAt: z.string(),
  deliveredAt: z.string().nullable(),
});

export interface ShareOffer {
  shareId: string;
  fromDeviceId: string;
  fromDisplayName: string;
  moduleId: string;
  tableName: string;
  rowId: string;
  previewJson: string;
}

export const ShareOfferSchema = z.object({
  shareId: z.string().min(1),
  fromDeviceId: z.string().min(1),
  fromDisplayName: z.string().min(1),
  moduleId: z.string().min(1),
  tableName: z.string().min(1),
  rowId: z.string().min(1),
  previewJson: z.string(),
});

// ---------------------------------------------------------------------------
// Engine Types
// ---------------------------------------------------------------------------

export type SyncEngineState =
  | 'idle'
  | 'discovering'
  | 'connecting'
  | 'syncing'
  | 'error';

export interface SyncEngineStatus {
  state: SyncEngineState;
  pairedDeviceCount: number;
  onlineDeviceCount: number;
  pendingChanges: number;
  lastSyncAt: string | null;
  currentSessionId: string | null;
}
