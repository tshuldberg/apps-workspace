/**
 * Full sync session orchestration.
 *
 * A sync session connects to a peer, performs the handshake, then
 * exchanges CRDT sync messages and blob data for each enabled module.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  DeviceIdentity,
  PairedDevice,
  SyncSession,
  SyncTransport,
  SyncSecurityPreference,
  SyncTransportPreference,
  TransportConnection,
  SyncScope,
} from '../types';
import { SYNC_SCOPE_RANK, isScopeWithinMaxScope } from '../types';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import { DocumentManager } from '../crdt/document-manager';
import {
  evaluateInboundChange,
  type InboundSessionAuth,
} from './inbound-policy';
import { ReplayGuard } from './replay-guard';
import { ChangeTracker } from '../crdt/change-tracker';
import * as queries from '../db/queries';
import { initiatorHandshake, responderHandshake } from './handshake';
import {
  createSecurityOffer,
  defaultRequiredSecurityPreference,
  negotiateSecurityAgreement,
  type SyncSecurityAgreement,
  type SyncSecurityOffer,
} from './security-negotiation';
import {
  resolveFrameEnvelopeKeyForPeer,
  wrapConnectionWithFrameEnvelope,
} from './frame-envelope';
import {
  createSecureJsonMessage,
  createSessionPayloadSecurity,
  negotiateKdfVersion,
  parseSecureJsonPayload,
  resolvePayloadEncryptionKey,
  SUPPORTED_KDF_VERSIONS,
  withMessageRatchet,
  type SessionPayloadSecurity,
} from './payload-security';
import {
  encodeMessage,
  decodeMessage,
  createSimpleMessage,
} from './message-codec';
import { recordExpiringEntitiesForChanges } from '../expiry/disappearing-messages';
import { isSignedRowTable, validateSignedInboundRow } from './inbound-row-validators';
import { ensureBlobPolicy } from '../blob/blob-policy';
import { NoiseHandshake } from '../encryption/noise-handshake';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import {
  SYNC_WORKSPACE_KEYS_TABLE,
  deriveEpochContentKey,
  getCurrentEpochKey,
  keyWrapFromSyncedRow,
  storeReceivedKeyWrap,
} from './group-keys';
import {
  assembleStagedBlob,
  blobContentHash,
  clearStagedBlob,
  collectBlobRefs,
  getStagedBlockIndices,
  splitBlobForTransfer,
  stageBlobBlock,
  type BlobAckPayload,
  type BlobDataPayload,
  type BlobRequestPayload,
  type SessionBlobProvider,
} from './blob-transfer';
import { splitSnapshotForWindow } from './sync-window';
import {
  communityTransportPolicy,
  evaluateChannelPost,
  getCommunity,
  verifyDescriptorOwnerSignature,
  transportPolicyAllows,
  type CommunityTransportPolicy,
} from './community';
import { signBatch, verifyBatch } from './batch-signature';
import {
  buildDeleteSql,
  buildInsertSql,
} from '../crdt/schema-adapter';
import {
  applyGossipedRevocations,
  collectRevocationRecords,
} from './revocation-gossip';
import {
  applyGossipedDescriptors,
  collectDescriptorRecords,
} from './descriptor-gossip';
import type { SignedRevocation } from './revocation-record';
import type { SignedCommunityDescriptor } from './community';

const jsonEncoder = new TextEncoder();
const jsonDecoder = new TextDecoder();

interface LwwSnapshotWire {
  tables: Record<string, Record<string, Record<string, unknown>>>;
  tombstones?: Record<string, Record<string, { deletedAt: string }>>;
}

/** Compact preference entry exchanged during workspace negotiation. */
export interface TransportPreferenceEntry {
  layerId: number;
  rank: number;
  enabled: boolean;
}

export interface SyncSessionOptions {
  db: DatabaseAdapter;
  identity: DeviceIdentity;
  pairedDevices: PairedDevice[];
  documentManager: DocumentManager;
  changeTracker: ChangeTracker;
  enabledModules: string[];
  /** Per-module sync policies for inbound scope/ACL enforcement (MK-002). */
  modulePolicies?: Map<string, ModuleSyncPolicy>;
  /** Required for apps pairing friends: only an explicitly verified owner device returns true.
   * Omit only for integrations whose pairing contract already means personal ownership. */
  isOwnDevice?: (peerDeviceId: string) => boolean;
  transport: SyncTransport;
  /** Relay ephemeral token for wan_relay sessions. */
  relayToken?: string;
  /** Workspace scoping this session (null for personal-device sync). */
  workspaceId?: string;
  /** This device's ranked transport preferences for negotiation. */
  transportPreferences?: TransportPreferenceEntry[];
  /** Workspace or direct-contact security settings to confirm with the peer. */
  securityPreference?: SyncSecurityPreference;
  /** KDF versions this side speaks (tests can force v1); default SUPPORTED_KDF_VERSIONS. */
  supportedKdfVersions?: readonly number[];
  /** Set false to behave like a pre-Noise peer (tests/fallback); default true. */
  supportsForwardSecrecy?: boolean;
  /**
   * Blob bytes source/sink (MK-027). When set, the session runs a blob phase:
   * the responder requests blob_hash refs it cannot resolve and the initiator
   * streams the blocks. Absent = no blob phase (sessions behave as before).
   */
  blobProvider?: SessionBlobProvider;
  /**
   * Sliding-window size (MK-028): the N most recently updated rows ship in a
   * priority batch before the backfill remainder, so a cold start renders
   * visible data while history streams. Absent = single-batch (as before).
   */
  syncWindow?: number;
  /**
   * Gossip phase (Plan 27/28 P4, AM6): when BOTH sides set this, the session
   * exchanges signed revocations + signed community descriptors as an explicit
   * GOSSIP message BEFORE the initiator's BYE, so a revocation/removal issued
   * anywhere converges across the mesh over the SAME authenticated, encrypted,
   * frame-enveloped, replay-guarded session channel the data rides. Absent =
   * no gossip phase (sessions behave exactly as before). The shared foreground
   * round (auto-connect) turns this on; unrelated sessions leave it off.
   */
  gossip?: boolean;
  /** Injectable wall clock for inbound timestamp-skew enforcement. */
  inboundNowMs?: () => number;
}

/** Result of transport preference negotiation between two peers. */
export interface NegotiationResult {
  /** The mutually agreed transport layer ID, or null if no match. */
  agreedLayerId: number | null;
  /** The peer's transport preferences (stored for future reference). */
  peerPreferences: TransportPreferenceEntry[];
  /** Relay ephemeral token provided by the peer (only for wan_relay). */
  peerRelayToken?: string;
  /** Bilateral encryption and disappearing-message agreement. */
  securityAgreement?: SyncSecurityAgreement;
  /** Negotiated KDF version for the session data channel (MK-010). */
  kdfVersion?: number;
  /** True when the data channel runs under an ephemeral per-session key (MK-011). */
  forwardSecrecy?: boolean;
  /** Workspace epoch the data channel is keyed under (MK-022 group keys). */
  groupEpoch?: number;
}

/** Noise ephemeral leg carried inside the encrypted negotiation (MK-011). */
interface NoiseLeg {
  /** Ephemeral X25519 public key (hex). */
  e: string;
  /** Encrypted identity proof (hex: nonce || ciphertext). */
  p: string;
}

interface PreferenceNegotiationPayload {
  preferences?: TransportPreferenceEntry[];
  relayToken?: string;
  security?: SyncSecurityOffer;
  /** KDF versions the sender supports, newest first (MK-010). */
  kdfVersions?: number[];
  /** Initiator's Noise hello (in SYNC_OFFER) or responder's reply (in SYNC_ACCEPT). */
  noise?: NoiseLeg;
  /**
   * D.6: set true when the sender explicitly opts out of forward secrecy
   * (`supportsForwardSecrecy === false`). The static-derived data channel is
   * used ONLY when BOTH sides signal this, mirroring the mutual encryption 'off'
   * opt-out. Any one-sided missing leg fails the session instead of downgrading.
   */
  fsOptOut?: boolean;
  /**
   * The sender's current workspace epoch (MK-022). When both sides advertise
   * the SAME epoch, the data channel keys under the group epoch key instead of
   * the pairwise key; any mismatch falls back pairwise (the migration window).
   */
  groupEpoch?: number;
}

interface ReceivedDocumentChange {
  table: string;
  rowId: string;
  operation: string;
  data: Record<string, unknown> | null;
}

const SAFE_SQL_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;
const RFC3339_UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/u;
const SQLITE_UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u;
export const MAX_INBOUND_CLOCK_SKEW_MS = 5 * 60_000;

function isSafeSqlIdentifier(value: string): boolean {
  return SAFE_SQL_IDENTIFIER.test(value);
}

/**
 * Negotiate the best mutual transport layer between initiator and responder.
 *
 * Walks the initiator's preference list top-to-bottom (lowest rank first).
 * The first layer that the responder also has enabled wins. Returns null
 * if no mutual candidate exists; the caller should fall through to the
 * default transport ladder order.
 */
export function negotiateTransportPreference(
  initiatorPrefs: TransportPreferenceEntry[],
  responderPrefs: TransportPreferenceEntry[],
): number | null {
  const responderEnabled = new Set(
    responderPrefs.filter((p) => p.enabled).map((p) => p.layerId),
  );
  const sorted = [...initiatorPrefs]
    .filter((p) => p.enabled)
    .sort((a, b) => a.rank - b.rank);

  for (const pref of sorted) {
    if (responderEnabled.has(pref.layerId)) {
      return pref.layerId;
    }
  }
  return null; // No mutual preference; fall through to default ladder
}

export function rankMutualTransportPreferences(
  initiatorPrefs: TransportPreferenceEntry[],
  responderPrefs: TransportPreferenceEntry[],
): number[] {
  const responderEnabled = new Set(
    responderPrefs.filter((p) => p.enabled).map((p) => p.layerId),
  );
  const seen = new Set<number>();
  const ranked: number[] = [];
  const sorted = [...initiatorPrefs]
    .filter((p) => p.enabled)
    .sort((a, b) => a.rank - b.rank);

  for (const pref of sorted) {
    if (!responderEnabled.has(pref.layerId) || seen.has(pref.layerId)) continue;
    seen.add(pref.layerId);
    ranked.push(pref.layerId);
  }

  return ranked;
}

interface SyncSessionResult {
  session: SyncSession;
  modulesUpdated: string[];
  /** Negotiation result when transport preferences were exchanged. */
  negotiation?: NegotiationResult;
  /** Gossip-phase outcome (present only when the gossip phase ran). */
  gossip?: GossipRoundResult;
}

/** What one session's gossip phase actually exchanged (honest counts). */
export interface GossipRoundResult {
  /** Revocation records sent to the peer. */
  revsSent: number;
  /** Descriptor records sent to the peer. */
  descsSent: number;
  /** Records from the peer that newly took local effect (revocations + descriptors). */
  appliedFromPeer: number;
}

function createRemoteSecurityOffFallback(local: SyncSecurityOffer): SyncSecurityOffer {
  return {
    subjectType: local.subjectType,
    subjectId: local.subjectId,
    encryptionMode: 'off',
    canEncrypt: false,
    disappearingMessagesEnabled: false,
    disappearAfterSeconds: null,
  };
}

function persistPeerTransportPreferences(
  db: DatabaseAdapter,
  peerDeviceId: string,
  preferences: TransportPreferenceEntry[] | undefined,
): void {
  if (!preferences || preferences.length === 0) return;
  const updatedAt = new Date().toISOString();
  const mapped: SyncTransportPreference[] = preferences.map((pref) => ({
    deviceId: peerDeviceId,
    layerId: pref.layerId,
    rank: pref.rank,
    enabled: pref.enabled,
    updatedAt,
  }));
  queries.setTransportPreferences(db, peerDeviceId, mapped);
}

function createPayloadSecurityForPeer(
  options: SyncSessionOptions,
  remoteDeviceId: string,
  agreement: SyncSecurityAgreement | undefined,
  kdfVersion?: number,
): SessionPayloadSecurity {
  if (!options.securityPreference || !agreement?.encryptionConfirmed) {
    return createSessionPayloadSecurity(null, false);
  }

  const key = resolvePayloadEncryptionKey({
    pairedDevices: options.pairedDevices,
    localDeviceId: options.identity.publicKey,
    remoteDeviceId,
    subjectType: options.securityPreference.subjectType,
    subjectId: options.securityPreference.subjectId,
    kdfVersion,
  });
  return createSessionPayloadSecurity(key, agreement.encryptionConfirmed);
}

function createNegotiationPayloadSecurity(
  options: SyncSessionOptions,
  remoteDeviceId: string,
): SessionPayloadSecurity {
  const subjectType = options.securityPreference?.subjectType
    ?? (options.workspaceId ? 'workspace' : 'direct');
  const subjectId = options.securityPreference?.subjectId
    ?? options.workspaceId
    ?? remoteDeviceId;
  const key = resolvePayloadEncryptionKey({
    pairedDevices: options.pairedDevices,
    localDeviceId: options.identity.publicKey,
    remoteDeviceId,
    subjectType,
    subjectId,
  });
  return createSessionPayloadSecurity(key, key !== null);
}

function canEncryptForPeer(
  options: SyncSessionOptions,
  remoteDeviceId: string,
): boolean {
  if (!options.securityPreference) return false;
  return resolvePayloadEncryptionKey({
    pairedDevices: options.pairedDevices,
    localDeviceId: options.identity.publicKey,
    remoteDeviceId,
    subjectType: options.securityPreference.subjectType,
    subjectId: options.securityPreference.subjectId,
  }) !== null;
}

function normalizeSqlValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string' || typeof value === 'number') return value;
  return JSON.stringify(value);
}

function normalizeSqlRecord(
  rowId: string,
  data: Record<string, unknown>,
): Record<string, unknown> | null {
  const normalized: Record<string, unknown> = {};
  const source = data.id === undefined ? { id: rowId, ...data } : data;

  for (const [column, value] of Object.entries(source)) {
    if (!isSafeSqlIdentifier(column)) return null;
    normalized[column] = normalizeSqlValue(value);
  }

  return normalized;
}

function hasAcceptableInboundTimestamp(
  data: Record<string, unknown> | null,
  nowMs: number,
): boolean {
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'updated_at')) return true;
  if (typeof data.updated_at !== 'string') return false;
  const timestampMs = parseLwwTimestamp(data.updated_at);
  return timestampMs !== null && timestampMs <= nowMs + MAX_INBOUND_CLOCK_SKEW_MS;
}

/** Parse only the UTC encodings emitted by Date.toISOString and SQLite datetime(). */
function parseLwwTimestamp(value: string): number | null {
  const rfc3339 = RFC3339_UTC_TIMESTAMP.exec(value);
  let canonical: string;
  if (rfc3339) {
    canonical = `${rfc3339[1]}.${(rfc3339[2] ?? '').padEnd(3, '0')}Z`;
  } else if (SQLITE_UTC_TIMESTAMP.test(value)) {
    canonical = `${value.replace(' ', 'T')}.000Z`;
  } else {
    return null;
  }
  const timestampMs = Date.parse(canonical);
  if (!Number.isFinite(timestampMs)) return null;
  return new Date(timestampMs).toISOString() === canonical ? timestampMs : null;
}

function hasNewerLocalVersion(
  db: DatabaseAdapter,
  table: string,
  rowId: string,
  data: Record<string, unknown>,
  nowMs: number,
): boolean {
  const incomingUpdatedAt = typeof data.updated_at === 'string' ? data.updated_at : null;
  if (!incomingUpdatedAt) return false;
  const incomingMs = parseLwwTimestamp(incomingUpdatedAt);
  if (incomingMs === null) return false;
  // Defense in depth: callers already validate the identifier, but this helper
  // interpolates `table` into SQL, so it must never trust an unguarded name.
  if (!isSafeSqlIdentifier(table)) return false;

  try {
    const rows = db.query<{ updated_at: string | null }>(
      `SELECT updated_at FROM ${table} WHERE id = ?`,
      [rowId],
    );
    const localUpdatedAt = rows[0]?.updated_at;
    if (typeof localUpdatedAt !== 'string') return false;
    const localMs = parseLwwTimestamp(localUpdatedAt);
    return localMs !== null
      && localMs <= nowMs + MAX_INBOUND_CLOCK_SKEW_MS
      && localMs > incomingMs;
  } catch {
    return false;
  }
}

/** Identifies the peer + session for inbound enforcement and audit linkage. */
export interface InboundSessionContext {
  remoteDeviceId: string;
  sessionId: string;
}

/** Resolve the session-level authorization + scope for inbound enforcement. */
function resolveInboundAuth(
  options: SyncSessionOptions,
  remoteDeviceId: string,
): InboundSessionAuth {
  const peerRevoked = queries.isDeviceRevoked(options.db, remoteDeviceId);

  if (options.workspaceId) {
    const workspace = queries.getWorkspace(options.db, options.workspaceId);
    const members = queries.getWorkspaceMembers(options.db, options.workspaceId);
    const sessionScope: SyncScope =
      workspace?.workspaceType === 'personal' ? 'personal_replica' : 'shared_workspace';
    // An archived (or missing) workspace accepts no inbound writes, even from a
    // still-listed member. getWorkspaceMembers already excludes removed members.
    const peerAuthorized =
      workspace !== null
      && workspace.archivedAt === null
      && members.some((m) => m.deviceId === remoteDeviceId && m.removedAt === null);
    // SAS gate (MK-017): a shared workspace admits sensitive data only from a
    // peer whose pairing the user emoji-verified. The 5 emoji derive from the
    // PAIRWISE secret, so verification is a global property of the pairing, not
    // per-workspace -- the gate checks the global record (the one the app
    // writes), so a confirmation actually satisfies workspace sessions. (audit P1)
    const sasVerified = queries.isSasVerified(options.db, remoteDeviceId);
    return { peerRevoked, peerAuthorized, sessionScope, sasVerified, sessionTransport: options.transport };
  }

  // Personal device sync: only the user's own paired devices may write. Own-device
  // sync never crosses the shared_workspace boundary, so the SAS gate is moot.
  const paired = options.pairedDevices.find((d) => d.deviceId === remoteDeviceId && d.isActive !== false);
  const currentPair = options.isOwnDevice ? queries.getPairedDevice(options.db, remoteDeviceId) : null;
  const peerAuthorized = Boolean(paired && (!options.isOwnDevice
    || (currentPair?.isActive && currentPair.dhPublicKey === paired.dhPublicKey)));
  return {
    peerRevoked,
    peerAuthorized,
    sessionScope: options.isOwnDevice && !options.isOwnDevice(remoteDeviceId) ? 'shared_workspace' : 'personal_replica',
    sasVerified: options.isOwnDevice ? queries.isSasVerified(options.db, remoteDeviceId) : true,
    sessionTransport: options.transport,
  };
}

/**
 * Session-lifetime cache of each community's SIGNED transport policy (Plan 27),
 * resolved from the LOCAL store only. Returns null for an id this device holds
 * no community descriptor for (non-community workspaces such as DM groups, or
 * a community not yet joined): no transport gate applies then -- the row gates
 * enforce promises this device actually holds, never guesses about foreign ids.
 */
function makeCommunityPolicyResolver(
  options: SyncSessionOptions,
): (communityId: string) => CommunityTransportPolicy | null {
  const cache = new Map<string, CommunityTransportPolicy | null>();
  return (communityId: string): CommunityTransportPolicy | null => {
    if (!cache.has(communityId)) {
      const community = getCommunity(options.db, communityId);
      cache.set(communityId, community ? communityTransportPolicy(community.descriptor) : null);
    }
    return cache.get(communityId) ?? null;
  };
}

/** The community/workspace id a synced row is attributable to, if any. */
function rowCommunityId(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  if (typeof data.community_id === 'string' && data.community_id.length > 0) return data.community_id;
  if (typeof data.workspace_id === 'string' && data.workspace_id.length > 0) return data.workspace_id;
  return null;
}

/**
 * The maximum scope a table may be replicated at, folding in entity rule,
 * module defaultScope, and the shareable flag. null means no declared policy.
 */
function computeModuleScopeCap(
  options: SyncSessionOptions,
  moduleId: string,
  table: string,
): SyncScope | null {
  const policy = options.modulePolicies?.get(moduleId);
  if (!policy) return null;
  const rule = options.changeTracker.resolveEntityRule(moduleId, table, policy);
  const base = rule?.defaultScope ?? policy.defaultScope;
  let cap: SyncScope = rule?.maxScope ?? base;
  // A non-shareable module can never be replicated beyond personal_replica.
  if (!policy.shareable && SYNC_SCOPE_RANK[cap] > SYNC_SCOPE_RANK.personal_replica) {
    cap = 'personal_replica';
  }
  return cap;
}

function outboundSessionScope(options: SyncSessionOptions, peerDeviceId: string): SyncScope {
  return resolveInboundAuth(options, peerDeviceId).sessionScope;
}

/** Re-read local authorization for every batch and blob; never cache membership across awaits. */
function peerMayReceiveRow(
  options: SyncSessionOptions,
  peerDeviceId: string,
  data: Record<string, unknown> | null | undefined,
): boolean {
  const auth = resolveInboundAuth(options, peerDeviceId);
  if (auth.peerRevoked || !auth.peerAuthorized) return false;
  const communityId = rowCommunityId(data);
  if (!options.isOwnDevice) return true;
  if (options.workspaceId && communityId !== options.workspaceId) return false;
  if (!auth.sasVerified) return false;
  const own = options.isOwnDevice(peerDeviceId);
  if (!communityId) return own && !options.workspaceId;
  const community = getCommunity(options.db, communityId);
  if (!community || !verifyDescriptorOwnerSignature(community)) return false;
  return community.descriptor.members.some((m) => m.deviceId === options.identity.publicKey)
    && (own || community.descriptor.members.some((m) => m.deviceId === peerDeviceId))
    && transportPolicyAllows(communityTransportPolicy(community.descriptor), options.transport);
}

function canSendTableAtScope(
  options: SyncSessionOptions,
  moduleId: string,
  table: string,
  scope: SyncScope,
): boolean {
  const cap = computeModuleScopeCap(options, moduleId, table);
  return cap !== null
    && cap !== 'device_local'
    && isScopeWithinMaxScope(scope, cap);
}

function hasSnapshotEntries(snapshot: LwwSnapshotWire): boolean {
  return Object.values(snapshot.tables).some((rows) => Object.keys(rows).length > 0)
    || Object.values(snapshot.tombstones ?? {}).some((rows) => Object.keys(rows).length > 0);
}

function filterLwwSnapshotForScope(
  message: Uint8Array,
  options: SyncSessionOptions,
  moduleId: string,
  scope: SyncScope,
  peerDeviceId: string,
): Uint8Array | null {
  let snapshot: LwwSnapshotWire;
  try {
    snapshot = JSON.parse(jsonDecoder.decode(message)) as LwwSnapshotWire;
  } catch {
    return options.isOwnDevice || options.workspaceId ? null : message;
  }
  if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.tables !== 'object' || !snapshot.tables || Array.isArray(snapshot.tables)) {
    return options.isOwnDevice || options.workspaceId ? null : message;
  }

  // Plan 27: outbound rows are ALSO gated per row by their community's signed
  // transport policy -- a local_only community's rows must never become
  // wire-visible on a forbidden transport (the relay must not even see their
  // sizes or timing). Community deletes are signed cm_ EVENTS (rows), so the
  // per-table tombstone map below carries no community content to attribute.
  const policyFor = makeCommunityPolicyResolver(options);
  const rowPermitted = (row: unknown): boolean => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    if (!peerMayReceiveRow(options, peerDeviceId, row as Record<string, unknown>)) return false;
    const communityId = rowCommunityId(row as Record<string, unknown>);
    if (!communityId) return true;
    const policy = policyFor(communityId);
    if (!policy) return true;
    return transportPolicyAllows(policy, options.transport);
  };

  const filtered: LwwSnapshotWire = { tables: {} };
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    if (!canSendTableAtScope(options, moduleId, table, scope)) continue;
    if (!rows || typeof rows !== 'object' || Array.isArray(rows)) continue;
    const kept: Record<string, Record<string, unknown>> = {};
    for (const [rowId, row] of Object.entries(rows)) {
      if (!rowPermitted(row)) continue;
      kept[rowId] = row;
    }
    if (Object.keys(kept).length > 0) filtered.tables[table] = kept;
  }
  for (const [table, rows] of Object.entries(snapshot.tombstones ?? {})) {
    if (!canSendTableAtScope(options, moduleId, table, scope)) continue;
    if (!peerMayReceiveRow(options, peerDeviceId, null)) continue;
    (filtered.tombstones ??= {})[table] = rows;
  }

  if (!hasSnapshotEntries(filtered)) return null;
  return jsonEncoder.encode(JSON.stringify(filtered));
}

function recordInboundReject(
  options: SyncSessionOptions,
  context: InboundSessionContext,
  scope: SyncScope,
  fields: { moduleId: string | null; table: string | null; rowId: string | null; operation: string | null },
  reason: string,
): void {
  try {
    queries.insertInboundAudit(options.db, {
      id: `ia_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId: context.sessionId,
      peerDeviceId: context.remoteDeviceId,
      moduleId: fields.moduleId,
      tableName: fields.table,
      rowId: fields.rowId,
      operation: fields.operation,
      outcome: 'rejected',
      reason,
      scope,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Audit logging must never break the session.
  }
}

/**
 * Apply changes received from a peer, enforcing inbound policy (MK-002):
 * revocation, authorization, module ownership, scope caps, and tombstones.
 * Rejected changes are never applied and are written to the audit log.
 *
 * `onAccepted` is invoked for each change that passes policy and is written to
 * SQLite. The session uses it to commit ONLY authorized rows into the in-memory
 * document, so a rejected or laundered row never enters the doc and never
 * re-broadcasts to other peers.
 */
export function applyReceivedDocumentChanges(
  options: SyncSessionOptions,
  moduleId: string,
  changes: ReceivedDocumentChange[],
  context: InboundSessionContext,
  onAccepted?: (change: ReceivedDocumentChange) => void,
): number {
  let applied = 0;
  const inboundNowMs = options.inboundNowMs?.() ?? Date.now();
  const auth = resolveInboundAuth(options, context.remoteDeviceId);
  // MK-043: when this session is a community workspace, channel posting rights
  // come from the signed descriptor and are enforced per change below.
  const communityDescriptor = options.workspaceId
    ? getCommunity(options.db, options.workspaceId)?.descriptor ?? null
    : null;
  // Plan 27: each row's community is resolved from the ROW (community_id /
  // workspace_id), never options.workspaceId -- the Meerkat path is
  // device-scoped, one session carrying every community's rows.
  const policyFor = makeCommunityPolicyResolver(options);

  // Session-level rejection: a revoked or unauthorized peer gets one audit row
  // and zero applied changes, rather than one row per change.
  if (auth.peerRevoked || !auth.peerAuthorized) {
    recordInboundReject(
      options,
      context,
      auth.sessionScope,
      { moduleId, table: null, rowId: null, operation: null },
      auth.peerRevoked ? 'peer_revoked' : 'peer_not_authorized',
    );
    return 0;
  }

  options.db.transaction(() => {
    for (const change of changes) {
      try {
        if (!isSafeSqlIdentifier(change.table)) {
          recordInboundReject(options, context, auth.sessionScope,
            { moduleId, table: change.table, rowId: change.rowId, operation: change.operation }, 'unsafe_table');
          continue;
        }

        if (options.isOwnDevice && !peerMayReceiveRow(options, context.remoteDeviceId, change.data)) {
          recordInboundReject(options, context, auth.sessionScope,
            { moduleId, table: change.table, rowId: change.rowId, operation: change.operation }, 'recipient_not_authorized');
          continue;
        }
        const resolvedModuleId = options.changeTracker.resolveModule(change.table);
        if (!hasAcceptableInboundTimestamp(change.data, inboundNowMs)) {
          recordInboundReject(options, context, auth.sessionScope,
            { moduleId: resolvedModuleId, table: change.table, rowId: change.rowId, operation: change.operation },
            'invalid_timestamp');
          continue;
        }
        const incomingUpdatedAt =
          change.data && typeof change.data.updated_at === 'string' ? change.data.updated_at : null;
        // Tombstones are keyed by module; an unresolved table has no tombstone to
        // look up, and is rejected as unknown_table before the tombstone check.
        const tombstone = resolvedModuleId
          ? queries.getTombstone(options.db, resolvedModuleId, change.table, change.rowId)
          : null;

        const changeCommunityId = rowCommunityId(change.data);
        const decision = evaluateInboundChange(auth, {
          operation: change.operation,
          claimedModuleId: moduleId,
          resolvedModuleId,
          moduleEnabled: resolvedModuleId !== null && options.enabledModules.includes(resolvedModuleId),
          moduleScopeCap: resolvedModuleId
            ? computeModuleScopeCap(options, resolvedModuleId, change.table)
            : null,
          moduleIsSensitive: resolvedModuleId
            ? (options.modulePolicies?.get(resolvedModuleId)?.isSensitive ?? false)
            : false,
          moduleRequiresSasForShare: resolvedModuleId
            ? (options.modulePolicies?.get(resolvedModuleId)?.requiresSasForShare ?? false)
            : false,
          incomingUpdatedAt,
          tombstoneDeletedAt: tombstone?.deletedAt ?? null,
          // Plan 27: the row's OWN community decides its transport gate.
          communityTransportPolicy: changeCommunityId ? policyFor(changeCommunityId) : null,
        });

        if (!decision.allowed) {
          recordInboundReject(options, context, auth.sessionScope,
            { moduleId: resolvedModuleId, table: change.table, rowId: change.rowId, operation: change.operation },
            decision.reason ?? 'rejected');
          continue;
        }

        // MK-043: a community row carrying a channel_id must pass the signed
        // descriptor's posting rules. Rejected at apply, never just in the UI.
        // A table with a dedicated signed-row validator (cm_messages) is gated
        // there instead, against its OWN signed author -- never the transport
        // peer -- so it also enforces on device-scoped sessions where
        // options.workspaceId (and thus communityDescriptor) is null (AM3).
        if (
          communityDescriptor
          && change.data
          && typeof change.data.channel_id === 'string'
          && !isSignedRowTable(change.table)
        ) {
          const verdict = evaluateChannelPost(
            communityDescriptor,
            context.remoteDeviceId,
            change.data.channel_id,
          );
          if (!verdict.allowed) {
            recordInboundReject(options, context, auth.sessionScope,
              { moduleId: resolvedModuleId, table: change.table, rowId: change.rowId, operation: change.operation },
              verdict.reason);
            continue;
          }
        }

        // Plan 38: owner-signed row types (cm_community_identity, later
        // cm_libraries + smart rules) are signature-verified BEFORE insert,
        // so a forged row never lands. Unregistered tables pass through.
        const signedRowVerdict = validateSignedInboundRow(options.db, change);
        if (!signedRowVerdict.ok) {
          recordInboundReject(options, context, auth.sessionScope,
            { moduleId: resolvedModuleId, table: change.table, rowId: change.rowId, operation: change.operation },
            signedRowVerdict.reason);
          continue;
        }

        // resolvedModuleId is guaranteed non-null past a clean decision.
        const ownerModuleId = resolvedModuleId as string;

        // Workspace key wraps carry an epoch secret already sealed to ONE
        // member's DH key. They ride the JSON document with the blob hex-encoded,
        // so the generic INSERT would store that hex string into the BLOB column
        // and never advance the epoch. Route them through storeReceivedKeyWrap so
        // the wrap lands as real bytes AND current_key_version advances (only for
        // a higher epoch; back-wraps for prior epochs are stored without
        // disturbing the current one). onAccepted keeps the wrap in the document
        // so it gossips onward to the next peer.
        if (change.operation !== 'DELETE' && change.table === SYNC_WORKSPACE_KEYS_TABLE) {
          const wrap = change.data ? keyWrapFromSyncedRow(change.data) : null;
          if (!wrap) {
            recordInboundReject(options, context, auth.sessionScope,
              { moduleId: ownerModuleId, table: change.table, rowId: change.rowId, operation: change.operation }, 'unsafe_column');
            continue;
          }
          // Plan 27 defense-in-depth: the key-wrap branch bypasses the generic
          // INSERT, so re-check the transport gate explicitly off the PARSED
          // wrap's workspaceId (the fact path above reads the raw row; a future
          // reorder or shape drift must not open this branch). A workspace this
          // device holds no community descriptor for (e.g. a DM group) carries
          // no community promise and passes.
          const wrapPolicy = policyFor(wrap.workspaceId);
          if (wrapPolicy && !transportPolicyAllows(wrapPolicy, options.transport)) {
            recordInboundReject(options, context, auth.sessionScope,
              { moduleId: ownerModuleId, table: change.table, rowId: change.rowId, operation: change.operation },
              'transport_not_permitted');
            continue;
          }
          storeReceivedKeyWrap(options.db, wrap, options.identity);
          applied += 1;
          onAccepted?.(change);
          continue;
        }

        if (change.operation === 'DELETE') {
          const { sql, params } = buildDeleteSql(change.table, change.rowId);
          options.db.execute(sql, params);
          queries.insertTombstone(options.db, {
            moduleId: ownerModuleId,
            tableName: change.table,
            rowId: change.rowId,
            deletedByDeviceId: context.remoteDeviceId,
            deletedAt: incomingUpdatedAt ?? new Date().toISOString(),
          });
          applied += 1;
          onAccepted?.(change);
          continue;
        }

        if (!change.data) continue;

        // Last-write-wins: a newer local version is not overwritten. This is a
        // legitimate supersede, not a policy rejection, so it is not audited.
        if (hasNewerLocalVersion(options.db, change.table, change.rowId, change.data, inboundNowMs)) {
          continue;
        }

        const data = normalizeSqlRecord(change.rowId, change.data);
        if (!data) {
          recordInboundReject(options, context, auth.sessionScope,
            { moduleId: ownerModuleId, table: change.table, rowId: change.rowId, operation: change.operation }, 'unsafe_column');
          continue;
        }

        const { sql, params } = buildInsertSql(change.table, data);
        options.db.execute(sql, params);
        // A strictly-newer re-creation clears any prior tombstone.
        if (tombstone) queries.deleteTombstone(options.db, ownerModuleId, change.table, change.rowId);
        applied += 1;
        onAccepted?.(change);
      } catch {
        // A single stale or unavailable module table must not poison the session.
      }
    }
  });

  return applied;
}

/**
 * Run a full sync session as the initiator.
 */
/**
 * The gossip exchange payload carried inside one GOSSIP message: the signed
 * revocations and signed community descriptors this side currently holds. Each
 * record self-authenticates on apply (a revocation by a paired signer, a
 * descriptor by the community owner over a monotonic chain), so the message
 * needs no separate batch signature beyond the session's own encryption +
 * frame envelope.
 */
interface GossipExchangePayload {
  rev?: SignedRevocation[];
  desc?: SignedCommunityDescriptor[];
}

/**
 * Collect this device's gossip records for a specific peer, honoring Plan 27
 * transport gating AND membership privacy. Revocations gossip to everyone (they
 * carry no roster and are meant to spread). Descriptors go ONLY for communities
 * the peer is a current member of: a descriptor embeds the full member roster,
 * so sending every held community would leak the membership of communities the
 * peer is not in (the peer would drop them on apply anyway -- convergence-
 * lossless), and a removed device stops receiving post-removal descriptors.
 */
function collectGossipExchange(
  options: SyncSessionOptions,
  transport: SyncTransport,
  peerDeviceId: string,
): { payload: GossipExchangePayload; revsSent: number; descsSent: number } {
  const rev = collectRevocationRecords(options.db);
  const desc = collectDescriptorRecords(options.db, transport, peerDeviceId);
  return { payload: { rev, desc }, revsSent: rev.length, descsSent: desc.length };
}

/**
 * Apply a peer's gossip batch fail-closed and return how many records newly
 * took effect. Revocations apply only from paired signers; descriptors only
 * refresh a KNOWN community by a strictly newer owner-signed revision (and then
 * reconcile its roster, Item 7). Unknown/older/forged records are dropped.
 */
function applyIncomingGossip(
  options: SyncSessionOptions,
  payload: GossipExchangePayload,
  transport: SyncTransport,
): number {
  let applied = 0;
  if (Array.isArray(payload.rev) && payload.rev.length > 0) {
    applied += applyGossipedRevocations(options.db, payload.rev);
  }
  if (Array.isArray(payload.desc) && payload.desc.length > 0) {
    applied += applyGossipedDescriptors(
      options.db,
      payload.desc,
      options.identity.publicKey,
      new Date().toISOString(),
      transport,
    );
  }
  return applied;
}

export async function runInitiatorSession(
  connection: TransportConnection,
  options: SyncSessionOptions,
): Promise<SyncSessionResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const sessionId = `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let changesSent = 0;
  let changesReceived = 0;
  let bytesSent = 0;
  let bytesReceived = 0;
  const modulesUpdated: string[] = [];

  // Required encryption is the default: a caller that passes no preference
  // gets a session that must key its payload channel or fail. Plaintext only
  // ever happens when BOTH sides explicitly opted encryptionMode 'off'.
  options = {
    ...options,
    securityPreference: options.securityPreference ?? defaultRequiredSecurityPreference(),
  };

  // Frame envelope: nothing leaves this session as a bare codec frame. The
  // initiator knows its peer, so a missing envelope key (unpaired or revoked
  // device) fails the session before a single byte crosses the pipe.
  const envelopeKey = resolveFrameEnvelopeKeyForPeer(
    options.identity,
    options.pairedDevices,
    connection.remoteDeviceId,
  );
  if (!envelopeKey) {
    const session = buildSession({
      peerDeviceId: connection.remoteDeviceId || 'unknown',
      transport: options.transport,
      workspaceId: options.workspaceId,
      startedAt,
      durationMs: Date.now() - startTime,
      status: 'failed',
      error: 'Frame envelope key unavailable: peer is not a paired device',
      modulesSynced: [],
      changesSent: 0,
      changesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
    });
    queries.insertSyncSession(options.db, session);
    return { session, modulesUpdated: [] };
  }
  connection = wrapConnectionWithFrameEnvelope(connection, {
    identity: options.identity,
    pairedDevices: options.pairedDevices,
  });

  // Handshake
  const handshake = await initiatorHandshake(
    connection,
    options.identity,
    options.pairedDevices,
    options.enabledModules,
  );

  if (!handshake.success) {
    const session = buildSession({
      peerDeviceId: handshake.remoteDeviceId || 'unknown',
      transport: options.transport,
      workspaceId: options.workspaceId,
      startedAt,
      durationMs: Date.now() - startTime,
      status: 'failed',
      error: handshake.error ?? 'Handshake failed',
      modulesSynced: [],
      changesSent: 0,
      changesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
    });
    queries.insertSyncSession(options.db, session);
    return { session, modulesUpdated: [] };
  }

  // Workspace negotiation: exchange transport preferences, relay token, and
  // the security contract for this workspace or direct connection.
  let negotiation: NegotiationResult | undefined;
  const localSecurityOffer = options.securityPreference
    ? createSecurityOffer(options.securityPreference, {
      canEncrypt: canEncryptForPeer(options, handshake.remoteDeviceId),
    })
    : undefined;
  let payloadSecurity = createSessionPayloadSecurity(null, false);
  // Fail closed on a broken negotiation: a dropped, withheld, or unreadable
  // reply must never silently downgrade the session to plaintext.
  const failNegotiation = (error: string): SyncSessionResult => {
    const session = buildSession({
      peerDeviceId: handshake.remoteDeviceId,
      transport: options.transport,
      workspaceId: options.workspaceId,
      startedAt,
      durationMs: Date.now() - startTime,
      status: 'failed',
      error,
      modulesSynced: [],
      changesSent: 0,
      changesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
    });
    queries.insertSyncSession(options.db, session);
    return { session, modulesUpdated: [] };
  };
  // MK-022: a workspace with a group epoch key always negotiates, so both
  // sides can agree the epoch and key the data channel under it.
  const localEpochKey = options.workspaceId
    ? getCurrentEpochKey(options.db, options.workspaceId, options.identity)
    : null;
  if (
    (options.transportPreferences && options.transportPreferences.length > 0)
    || localSecurityOffer
    || localEpochKey
  ) {
    const negotiationPayloadSecurity = createNegotiationPayloadSecurity(
      options,
      handshake.remoteDeviceId,
    );
    if (!negotiationPayloadSecurity.enabled) {
      const session = buildSession({
        peerDeviceId: handshake.remoteDeviceId,
        transport: options.transport,
        workspaceId: options.workspaceId,
        startedAt,
        durationMs: Date.now() - startTime,
        status: 'failed',
        error: 'Encrypted negotiation channel unavailable',
        modulesSynced: [],
        changesSent: 0,
        changesReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
      });
      queries.insertSyncSession(options.db, session);
      return { session, modulesUpdated: [] };
    }

    const negotiationPayload: PreferenceNegotiationPayload = {};
    if (options.transportPreferences && options.transportPreferences.length > 0) {
      negotiationPayload.preferences = options.transportPreferences;
    }
    if (localSecurityOffer) {
      negotiationPayload.security = localSecurityOffer;
    }
    negotiationPayload.kdfVersions = [...(options.supportedKdfVersions ?? SUPPORTED_KDF_VERSIONS)];

    // Advertise our current workspace epoch (MK-022).
    if (localEpochKey) {
      negotiationPayload.groupEpoch = localEpochKey.epoch;
    }

    // D.6: forward secrecy is mandatory. Offer an ephemeral Noise leg so the
    // data channel runs under a per-session key; a peer that neither provides a
    // leg nor mutually opts out fails the session (no silent static downgrade).
    // The opt-out is explicit on the wire so the mutual signal is auditable,
    // exactly like the encryption 'off' opt-out.
    const localFsOptOut = options.supportsForwardSecrecy === false;
    if (localFsOptOut) {
      negotiationPayload.fsOptOut = true;
    }
    let noise: NoiseHandshake | null = null;
    if (localSecurityOffer && !localFsOptOut) {
      const peerStaticDhKey = options.pairedDevices.find(
        (device) => device.deviceId === handshake.remoteDeviceId,
      )?.dhPublicKey;
      if (peerStaticDhKey) {
        try {
          noise = new NoiseHandshake(options.identity, peerStaticDhKey);
          const hello = noise.initiatorHello();
          negotiationPayload.noise = {
            e: hello.ephemeralPublicKey,
            p: bytesToHex(hello.encryptedPayload),
          };
        } catch {
          noise = null;
        }
      }
    }

    // If this session is relay-backed, include our ephemeral token
    if (options.transport === 'wan_relay' && options.relayToken) {
      negotiationPayload.relayToken = options.relayToken;
    }

    const prefMsg = createSecureJsonMessage(
      'SYNC_OFFER',
      options.identity.publicKey,
      '',
      negotiationPayload,
      negotiationPayloadSecurity,
    );
    await connection.send(encodeMessage(prefMsg));

    // Wait for the responder's preference response
    const prefResponse = await waitForNextMessage(connection, 10_000);
    if (prefResponse) {
      const prefPayload = parseSecureJsonPayload<PreferenceNegotiationPayload>(
        prefResponse,
        negotiationPayloadSecurity,
      );

      if (prefPayload) {
        const agreedLayerId = options.transportPreferences && prefPayload.preferences
          ? negotiateTransportPreference(options.transportPreferences, prefPayload.preferences)
          : null;
        const kdfVersion = negotiateKdfVersion(
          options.supportedKdfVersions ?? SUPPORTED_KDF_VERSIONS,
          prefPayload.kdfVersions,
        );
        negotiation = {
          agreedLayerId,
          peerPreferences: prefPayload.preferences ?? [],
          peerRelayToken: prefPayload.relayToken,
          kdfVersion,
        };
        persistPeerTransportPreferences(options.db, handshake.remoteDeviceId, prefPayload.preferences);

        if (localSecurityOffer) {
          const remoteSecurityOffer = prefPayload.security
            ?? createRemoteSecurityOffFallback(localSecurityOffer);
          const securityAgreement = negotiateSecurityAgreement(localSecurityOffer, remoteSecurityOffer);
          negotiation.securityAgreement = securityAgreement;
          payloadSecurity = createPayloadSecurityForPeer(
            options,
            handshake.remoteDeviceId,
            securityAgreement,
            kdfVersion,
          );

          // MK-011: when the peer completed the Noise leg, the data channel
          // switches to the ephemeral per-session key (forward secrecy).
          if (noise && prefPayload.noise && securityAgreement.encryptionConfirmed) {
            try {
              const sessionKey = noise.initiatorFinalize({
                ephemeralPublicKey: prefPayload.noise.e,
                encryptedPayload: hexToBytes(prefPayload.noise.p),
              });
              // D.6: the data channel runs under the ephemeral per-session key
              // AND a per-message ratchet, so each message uses a distinct key.
              payloadSecurity = withMessageRatchet(createSessionPayloadSecurity(sessionKey, true));
              negotiation.forwardSecrecy = true;
            } catch {
              // A failed leg is NOT a downgrade: the mandatory-FS check below
              // fails the session unless both sides explicitly opted out.
            }
          }

          // D.6: with encryption confirmed, an ephemeral leg is REQUIRED. If it
          // did not complete and no matching group epoch will key this channel,
          // fail closed -- UNLESS both sides explicitly opted out of forward
          // secrecy (the sole sanctioned static-channel path).
          const willGroupKey = Boolean(options.workspaceId && localEpochKey);
          if (
            securityAgreement.encryptionConfirmed
            && !negotiation.forwardSecrecy
            && !willGroupKey
            && !(localFsOptOut && prefPayload.fsOptOut === true)
          ) {
            return failNegotiation('Forward secrecy required: peer did not complete the ephemeral leg');
          }

          queries.recordSecurityConfirmation(options.db, {
            subjectType: localSecurityOffer.subjectType,
            subjectId: localSecurityOffer.subjectId,
            peerDeviceId: handshake.remoteDeviceId,
            localEncryptionMode: localSecurityOffer.encryptionMode,
            remoteEncryptionMode: remoteSecurityOffer.encryptionMode,
            encryptionConfirmed: securityAgreement.encryptionConfirmed,
            disappearingMessagesConfirmed: securityAgreement.disappearingMessagesConfirmed,
            disappearAfterSeconds: securityAgreement.disappearAfterSeconds,
            confirmedAt: new Date().toISOString(),
          });

          if (!securityAgreement.canProceed) {
            const session = buildSession({
              peerDeviceId: handshake.remoteDeviceId,
              transport: options.transport,
              workspaceId: options.workspaceId,
              startedAt,
              durationMs: Date.now() - startTime,
              status: 'failed',
              error: securityAgreement.reason ?? 'Security negotiation failed',
              modulesSynced: [],
              changesSent: 0,
              changesReceived: 0,
              bytesSent: 0,
              bytesReceived: 0,
            });
            queries.insertSyncSession(options.db, session);
            return { session, modulesUpdated: [], negotiation };
          }
        }

        // MK-022: when both sides hold the SAME workspace epoch, the data
        // channel keys under the group epoch key -- retiring the pairwise key
        // for workspace traffic. Applied last so it supersedes both the
        // static-derived key and the Noise per-pair switch: group access
        // control beats per-pair forward secrecy here, and rotation on every
        // membership commit is the group's forward secrecy.
        if (options.workspaceId && localEpochKey) {
          if (prefPayload.groupEpoch === localEpochKey.epoch) {
            payloadSecurity = createSessionPayloadSecurity(
              deriveEpochContentKey(localEpochKey.secret, options.workspaceId, localEpochKey.epoch),
              true,
            );
            negotiation.groupEpoch = localEpochKey.epoch;
            negotiation.forwardSecrecy = false;
          } else {
            // Epoch-keyed workspace, peer on a different epoch: REFUSE to fall
            // back to the pairwise key. A removed member still holds that key
            // and could otherwise force a downgrade to read current group data.
            // The peer must catch up its group key first (MK-023 rotation).
            return failNegotiation('Workspace group-epoch mismatch; refusing pairwise fallback');
          }
        }
      } else {
        return failNegotiation('Security negotiation response unreadable');
      }
    } else {
      return failNegotiation('Security negotiation response missing');
    }
  }

  // MK-027: persistent collector for blob requests. The responder requests as
  // soon as it applies a batch; a one-shot waitForNextMessage attached later
  // would lose those frames, so collect them for the whole session.
  const pendingBlobRequests: import('../types').SyncMessage[] = [];
  if (options.blobProvider) {
    connection.onData((data) => {
      const m = decodeMessage(data);
      if (m?.type === 'BLOB_REQUEST') pendingBlobRequests.push(m);
    });
  }

  // Gossip phase (AM6): a persistent collector for the responder's single GOSSIP
  // reply. Registered here (not after BYE) so the reply is never missed; it
  // rides the SAME encrypted, frame-enveloped channel and is attributed to the
  // authenticated peer only. Records self-authenticate on apply.
  let gossipAppliedFromPeer = 0;
  let gossipRepliesReceived = 0;
  if (options.gossip) {
    connection.onData((data) => {
      const m = decodeMessage(data);
      if (m?.type !== 'GOSSIP' || m.deviceId !== handshake.remoteDeviceId) return;
      const payload = parseSecureJsonPayload<GossipExchangePayload>(m, payloadSecurity);
      if (!payload) return;
      gossipRepliesReceived += 1;
      gossipAppliedFromPeer += applyIncomingGossip(options, payload, connection.transport);
    });
  }

  // Outbound membership gate: never STREAM module data to a peer that is not
  // currently authorized to receive it. For a workspace this is current
  // (non-removed) membership; for personal sync it is an active paired device.
  // Without this, a removed member who still holds the pairwise key could
  // receive current workspace data if the epoch negotiation ever fell back
  // (defense in depth with the epoch-mismatch refusal above).
  const outAuth = resolveInboundAuth(options, handshake.remoteDeviceId);
  const mayPush = !outAuth.peerRevoked && outAuth.peerAuthorized;

  // Sync each module
  const ackedByModule = new Map<string, string[]>();
  const sentBlobRows = new Map<string, Array<Record<string, unknown>>>();
  if (mayPush) {
    for (const moduleId of options.enabledModules) {
      const result = await syncModule(
        connection,
        options,
        moduleId,
        handshake.remoteDeviceId,
        payloadSecurity,
        sentBlobRows,
      );
      changesSent += result.sent;
      changesReceived += result.received;
      bytesSent += result.bytesSent;
      bytesReceived += result.bytesReceived;
      if (result.received > 0) modulesUpdated.push(moduleId);
      if (result.ackedChangeIds.length > 0) ackedByModule.set(moduleId, result.ackedChangeIds);
    }
  }

  // MK-027 blob phase: serve the responder's blob requests until idle. Only
  // runs when a provider is wired, so blob-less sessions keep their timing.
  let blobsSent = 0;
  if (options.blobProvider) {
    const servedHashes = new Set<string>();
    const serveDeadline = Date.now() + 30_000;
    let idleSince = Date.now();
    while (Date.now() < serveDeadline) {
      const reqMsg = pendingBlobRequests.shift();
      if (!reqMsg) {
        if (Date.now() - idleSince > 1_500) break;
        await new Promise((r) => setTimeout(r, 50));
        continue;
      }
      idleSince = Date.now();
      const req = parseSecureJsonPayload<BlobRequestPayload>(reqMsg, payloadSecurity);
      if (reqMsg.deviceId !== handshake.remoteDeviceId || !req?.hash || servedHashes.has(req.hash)) continue;
      servedHashes.add(req.hash);
      const served = await serveBlobRequest(connection, options, req, payloadSecurity, () =>
        (sentBlobRows.get(`${req.moduleId}:${req.hash}`) ?? []).some((row) =>
          peerMayReceiveRow(options, handshake.remoteDeviceId, row)));
      bytesSent += served.bytes;
      if (served.ok) blobsSent += 1;
    }
  }

  // Gossip phase (AM6): after data + blobs, before BYE, send one GOSSIP message
  // carrying this device's signed revocations + descriptors, then give the
  // responder a bounded window to reply with its own (its dataHandler applies
  // ours and replies once). Only to an authorized peer; skipped entirely when
  // gossip is not enabled on this session.
  let gossipResult: GossipRoundResult | undefined;
  if (options.gossip && mayPush) {
    const { payload, revsSent, descsSent } = collectGossipExchange(
      options, connection.transport, handshake.remoteDeviceId,
    );
    const gossipMsg = createSecureJsonMessage(
      'GOSSIP', options.identity.publicKey, '', payload, payloadSecurity,
    );
    await connection.send(encodeMessage(gossipMsg));
    // Wait for the responder's single reply (or a short timeout) before BYE so
    // the round is bidirectional; the persistent collector applies it.
    const gossipDeadline = Date.now() + 3_000;
    while (gossipRepliesReceived === 0 && Date.now() < gossipDeadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    gossipResult = { revsSent, descsSent, appliedFromPeer: gossipAppliedFromPeer };
  }

  // Send BYE
  const byeMsg = createSimpleMessage('BYE', options.identity.publicKey, '');
  const byeBytes = encodeMessage(byeMsg);
  await connection.send(byeBytes);

  // MK-009: receipts + per-peer outbox. Record a receipt for every change this
  // peer acknowledged, then mark a change synced only once EVERY active paired
  // device has a receipt for it. A change delivered to peer 1 stays pending
  // until peer 2 has it too; an un-acked batch is never silently dropped.
  const acknowledgedAt = new Date().toISOString();
  for (const [moduleId, changeIds] of ackedByModule) {
    for (const changeId of changeIds) {
      queries.insertReceipt(options.db, {
        sessionId,
        peerDeviceId: handshake.remoteDeviceId,
        moduleId,
        changeId,
        acknowledgedAt,
      });
    }
  }

  const activePeerIds = options.pairedDevices
    .filter((device) => device.isActive)
    .map((device) => device.deviceId);
  const fullyAcked = options.changeTracker.getUnsynced().filter((change) => {
    const ackedPeers = new Set(queries.getReceiptPeersForChange(options.db, change.id));
    return activePeerIds.every((peerId) => ackedPeers.has(peerId));
  });
  if (fullyAcked.length > 0) {
    recordExpiringEntitiesForChanges(
      options.db,
      fullyAcked,
      negotiation?.securityAgreement?.disappearAfterSeconds ?? null,
    );
    options.changeTracker.markSynced(fullyAcked.map((c) => c.id));
  }

  const session = buildSession({
    peerDeviceId: handshake.remoteDeviceId,
    transport: options.transport,
    workspaceId: options.workspaceId,
    startedAt,
    durationMs: Date.now() - startTime,
    id: sessionId,
    status: 'completed',
    error: null,
    modulesSynced: options.enabledModules,
    changesSent,
    changesReceived,
    bytesSent,
    bytesReceived,
    blobsSent,
  });
  queries.insertSyncSession(options.db, session);

  // Update peer stats
  queries.updatePairedDeviceSyncStats(options.db, handshake.remoteDeviceId, {
    lastSyncAt: new Date().toISOString(),
    lastSyncModule: modulesUpdated[modulesUpdated.length - 1] ?? options.enabledModules[0] ?? '',
    bytesSent,
    bytesReceived,
  });

  return { session, modulesUpdated, negotiation, gossip: gossipResult };
}

/**
 * Run a full sync session as the responder.
 */
export async function runResponderSession(
  connection: TransportConnection,
  options: SyncSessionOptions,
): Promise<SyncSessionResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const sessionId = `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const modulesUpdated: string[] = [];

  // Required encryption by default (mirrors the initiator): plaintext only
  // when BOTH sides explicitly opted encryptionMode 'off'.
  options = {
    ...options,
    securityPreference: options.securityPreference ?? defaultRequiredSecurityPreference(),
  };

  // Frame envelope: the responder cannot know which paired device is dialing
  // until the first frame opens, so the wrapper trial-decrypts against the
  // active paired devices and locks the matched key. Frames from unpaired
  // senders never reach the codec; an idle pipe times out the handshake.
  connection = wrapConnectionWithFrameEnvelope(connection, {
    identity: options.identity,
    pairedDevices: options.pairedDevices,
  });

  const handshake = await responderHandshake(
    connection,
    options.identity,
    options.pairedDevices,
    options.enabledModules,
  );

  if (!handshake.success) {
    const session = buildSession({
      peerDeviceId: handshake.remoteDeviceId || 'unknown',
      transport: options.transport,
      workspaceId: options.workspaceId,
      startedAt,
      durationMs: Date.now() - startTime,
      status: 'failed',
      error: handshake.error ?? 'Handshake failed',
      modulesSynced: [],
      changesSent: 0,
      changesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
    });
    queries.insertSyncSession(options.db, session);
    return { session, modulesUpdated: [] };
  }

  // Workspace negotiation: listen for initiator's preference/security exchange
  let negotiation: NegotiationResult | undefined;
  const localSecurityOffer = options.securityPreference
    ? createSecurityOffer(options.securityPreference, {
      canEncrypt: canEncryptForPeer(options, handshake.remoteDeviceId),
    })
    : undefined;
  let payloadSecurity = createSessionPayloadSecurity(null, false);
  // Fail closed on a broken negotiation (mirrors the initiator).
  const failNegotiation = (error: string): SyncSessionResult => {
    const session = buildSession({
      peerDeviceId: handshake.remoteDeviceId,
      transport: options.transport,
      workspaceId: options.workspaceId,
      startedAt,
      durationMs: Date.now() - startTime,
      status: 'failed',
      error,
      modulesSynced: [],
      changesSent: 0,
      changesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
    });
    queries.insertSyncSession(options.db, session);
    return { session, modulesUpdated: [] };
  };
  // MK-022: a workspace with a group epoch key always negotiates (mirrors the
  // initiator, which always offers in that case).
  const responderEpochKey = options.workspaceId
    ? getCurrentEpochKey(options.db, options.workspaceId, options.identity)
    : null;
  if (
    (options.transportPreferences && options.transportPreferences.length > 0)
    || localSecurityOffer
    || responderEpochKey
  ) {
    const negotiationPayloadSecurity = createNegotiationPayloadSecurity(
      options,
      handshake.remoteDeviceId,
    );
    if (!negotiationPayloadSecurity.enabled) {
      const session = buildSession({
        peerDeviceId: handshake.remoteDeviceId,
        transport: options.transport,
        workspaceId: options.workspaceId,
        startedAt,
        durationMs: Date.now() - startTime,
        status: 'failed',
        error: 'Encrypted negotiation channel unavailable',
        modulesSynced: [],
        changesSent: 0,
        changesReceived: 0,
        bytesSent: 0,
        bytesReceived: 0,
      });
      queries.insertSyncSession(options.db, session);
      return { session, modulesUpdated: [] };
    }

    const prefMsg = await waitForNextMessage(connection, 10_000);
    if (prefMsg && prefMsg.type === 'SYNC_OFFER') {
      const prefPayload = parseSecureJsonPayload<PreferenceNegotiationPayload>(
        prefMsg,
        negotiationPayloadSecurity,
      );

      if (prefPayload) {
        const agreedLayerId = prefPayload.preferences && options.transportPreferences
          ? negotiateTransportPreference(
            prefPayload.preferences, // initiator's prefs walk first
            options.transportPreferences,
          )
          : null;
        const kdfVersion = negotiateKdfVersion(
          options.supportedKdfVersions ?? SUPPORTED_KDF_VERSIONS,
          prefPayload.kdfVersions,
        );
        negotiation = {
          agreedLayerId,
          peerPreferences: prefPayload.preferences ?? [],
          peerRelayToken: prefPayload.relayToken,
          kdfVersion,
        };
        persistPeerTransportPreferences(options.db, handshake.remoteDeviceId, prefPayload.preferences);

        // D.6: forward secrecy is mandatory (mirrors the initiator). The
        // static channel is used ONLY when both sides explicitly opt out.
        const localFsOptOut = options.supportsForwardSecrecy === false;
        let responderNoiseLeg: NoiseLeg | null = null;
        if (localSecurityOffer) {
          const remoteSecurityOffer = prefPayload.security
            ?? createRemoteSecurityOffFallback(localSecurityOffer);
          const securityAgreement = negotiateSecurityAgreement(localSecurityOffer, remoteSecurityOffer);
          negotiation.securityAgreement = securityAgreement;
          payloadSecurity = createPayloadSecurityForPeer(
            options,
            handshake.remoteDeviceId,
            securityAgreement,
            kdfVersion,
          );

          // MK-011: complete the initiator's Noise leg; the data channel then
          // runs under the ephemeral per-session key (forward secrecy).
          if (prefPayload.noise && securityAgreement.encryptionConfirmed && !localFsOptOut) {
            try {
              const responderNoise = new NoiseHandshake(options.identity);
              const reply = responderNoise.responderReply({
                ephemeralPublicKey: prefPayload.noise.e,
                encryptedPayload: hexToBytes(prefPayload.noise.p),
              });
              responderNoiseLeg = {
                e: reply.ephemeralPublicKey,
                p: bytesToHex(reply.encryptedPayload),
              };
              // D.6: ephemeral per-session key + per-message ratchet.
              payloadSecurity = withMessageRatchet(createSessionPayloadSecurity(reply.sessionKey, true));
              negotiation.forwardSecrecy = true;
            } catch {
              // A failed leg is NOT a downgrade: the mandatory-FS check below
              // fails the session unless both sides explicitly opted out.
            }
          }

          queries.recordSecurityConfirmation(options.db, {
            subjectType: localSecurityOffer.subjectType,
            subjectId: localSecurityOffer.subjectId,
            peerDeviceId: handshake.remoteDeviceId,
            localEncryptionMode: localSecurityOffer.encryptionMode,
            remoteEncryptionMode: remoteSecurityOffer.encryptionMode,
            encryptionConfirmed: securityAgreement.encryptionConfirmed,
            disappearingMessagesConfirmed: securityAgreement.disappearingMessagesConfirmed,
            disappearAfterSeconds: securityAgreement.disappearAfterSeconds,
            confirmedAt: new Date().toISOString(),
          });
        }

        // MK-022: same epoch on both sides -> the data channel keys under the
        // group epoch key (supersedes static-derived and Noise; see initiator).
        if (options.workspaceId && responderEpochKey) {
          if (prefPayload.groupEpoch === responderEpochKey.epoch) {
            payloadSecurity = createSessionPayloadSecurity(
              deriveEpochContentKey(responderEpochKey.secret, options.workspaceId, responderEpochKey.epoch),
              true,
            );
            negotiation.groupEpoch = responderEpochKey.epoch;
            negotiation.forwardSecrecy = false;
          } else {
            // Epoch-keyed workspace, peer on a different epoch: refuse the
            // pairwise fallback (mirrors the initiator). The session fails
            // rather than admit data under a key a removed member still holds.
            return failNegotiation('Workspace group-epoch mismatch; refusing pairwise fallback');
          }
        }

        // Reply with our preferences (and relay token if applicable)
        const responsePayload: PreferenceNegotiationPayload = {};
        if (options.transportPreferences && options.transportPreferences.length > 0) {
          responsePayload.preferences = options.transportPreferences;
        }
        if (localSecurityOffer) {
          responsePayload.security = localSecurityOffer;
        }
        if (responderNoiseLeg) {
          responsePayload.noise = responderNoiseLeg;
        }
        // D.6: advertise our forward-secrecy opt-out so the initiator can see
        // the mutual signal (the only sanctioned static-channel path).
        if (localFsOptOut) {
          responsePayload.fsOptOut = true;
        }
        responsePayload.kdfVersions = [...(options.supportedKdfVersions ?? SUPPORTED_KDF_VERSIONS)];
        if (responderEpochKey) {
          responsePayload.groupEpoch = responderEpochKey.epoch;
        }
        if (options.transport === 'wan_relay' && options.relayToken) {
          responsePayload.relayToken = options.relayToken;
        }

        const responseMsg = createSecureJsonMessage(
          'SYNC_ACCEPT',
          options.identity.publicKey,
          '',
          responsePayload,
          negotiationPayloadSecurity,
        );
        await connection.send(encodeMessage(responseMsg));

        // D.6: with encryption confirmed, an ephemeral leg is REQUIRED unless a
        // matching group epoch keyed the channel or both sides explicitly opted
        // out. We send the accept first so the initiator also fails fast (rather
        // than waiting out its negotiation timeout), then fail closed here.
        const willGroupKey = Boolean(options.workspaceId && responderEpochKey);
        if (
          negotiation.securityAgreement?.encryptionConfirmed
          && !negotiation.forwardSecrecy
          && !willGroupKey
          && !(localFsOptOut && prefPayload.fsOptOut === true)
        ) {
          return failNegotiation('Forward secrecy required: peer did not provide the ephemeral leg');
        }

        if (negotiation.securityAgreement && !negotiation.securityAgreement.canProceed) {
          const session = buildSession({
            peerDeviceId: handshake.remoteDeviceId,
            transport: options.transport,
            workspaceId: options.workspaceId,
            startedAt,
            durationMs: Date.now() - startTime,
            status: 'failed',
            error: negotiation.securityAgreement.reason ?? 'Security negotiation failed',
            modulesSynced: [],
            changesSent: 0,
            changesReceived: 0,
            bytesSent: 0,
            bytesReceived: 0,
          });
          queries.insertSyncSession(options.db, session);
          return { session, modulesUpdated: [], negotiation };
        }
      } else {
        return failNegotiation('Security negotiation offer unreadable');
      }
    } else {
      return failNegotiation('Security negotiation offer missing');
    }
  }

  // Wait for sync messages from the initiator
  let totalReceived = 0;
  let totalSent = 0;
  let totalBytesReceived = 0;
  let totalBytesSent = 0;
  // Gossip phase (AM6): records the initiator gossiped that took local effect.
  let gossipAppliedFromPeer = 0;
  let gossipRevsSent = 0;
  let gossipDescsSent = 0;
  let gossipExchanged = false;

  // Process incoming sync messages until BYE
  let done = false;
  // MK-012: reject re-injected frames and stale/future timestamps in the
  // receive loop. One guard per session; rejections are audited.
  const replayGuard = new ReplayGuard();
  const replayAuditScope = resolveInboundAuth(options, handshake.remoteDeviceId).sessionScope;
  // MK-027: blob refs requested this session (dedupe) + completed count.
  const requestedBlobs = new Set<string>();
  let blobsReceived = 0;

  const dataHandler = (data: Uint8Array) => {
    const msg = decodeMessage(data);
    if (!msg) return;

    // Every inbound frame must claim the handshake-authenticated peer. A
    // frame claiming any other device id is injected or misrouted: reject
    // and audit, never attribute it to the authenticated peer.
    if (msg.deviceId !== handshake.remoteDeviceId) {
      recordInboundReject(
        options,
        { remoteDeviceId: handshake.remoteDeviceId, sessionId },
        replayAuditScope,
        { moduleId: null, table: null, rowId: null, operation: msg.type },
        'frame_device_mismatch',
      );
      return;
    }

    const replayVerdict = replayGuard.check(data, msg.timestamp);
    if (!replayVerdict.ok) {
      recordInboundReject(
        options,
        { remoteDeviceId: handshake.remoteDeviceId, sessionId },
        replayAuditScope,
        { moduleId: null, table: null, rowId: null, operation: msg.type },
        replayVerdict.reason,
      );
      return;
    }

    if (msg.type === 'BYE') {
      done = true;
      return;
    }

    // Gossip phase (AM6): the initiator's signed revocations + descriptors,
    // over the same replay-guarded, device-authenticated, encrypted channel.
    // Apply fail-closed (each record self-authenticates), then reply once with
    // ours so the round is bidirectional. Only when gossip is enabled on this
    // session; otherwise the message is ignored.
    if (msg.type === 'GOSSIP') {
      if (!options.gossip) return;
      const payload = parseSecureJsonPayload<GossipExchangePayload>(msg, payloadSecurity);
      if (!payload) return;
      gossipExchanged = true;
      gossipAppliedFromPeer += applyIncomingGossip(options, payload, connection.transport);
      const mine = collectGossipExchange(options, connection.transport, handshake.remoteDeviceId);
      gossipRevsSent = mine.revsSent;
      gossipDescsSent = mine.descsSent;
      const reply = createSecureJsonMessage(
        'GOSSIP', options.identity.publicKey, '', mine.payload, payloadSecurity,
      );
      void connection.send(encodeMessage(reply));
      return;
    }

    // MK-027: a streamed blob block. Stage it durably; when the blob completes,
    // verify the content hash, enforce the size cap, store, and acknowledge.
    if (msg.type === 'BLOB_DATA') {
      if (!options.blobProvider) return;
      const block = parseSecureJsonPayload<BlobDataPayload>(msg, payloadSecurity);
      if (!block || typeof block.hash !== 'string' || typeof block.dataHex !== 'string') return;
      totalBytesReceived += data.length;

      const refuse = (reason: BlobAckPayload['reason']) => {
        clearStagedBlob(options.db, block.hash);
        const nack = createSecureJsonMessage(
          'BLOB_ACK', options.identity.publicKey, '',
          { hash: block.hash, ok: false, reason } satisfies BlobAckPayload,
          payloadSecurity,
        );
        void connection.send(encodeMessage(nack));
      };

      const cap = ensureBlobPolicy(options.db, block.moduleId).maxBlobSizeBytes;
      if (cap > 0 && block.totalBytes > cap) {
        refuse('size_cap');
        return;
      }

      stageBlobBlock(options.db, block);
      const assembled = assembleStagedBlob(options.db, block.hash);
      if (!assembled) return; // more blocks coming (or a resumed gap)

      if (blobContentHash(assembled) !== block.hash) {
        refuse('hash_mismatch');
        return;
      }
      void (async () => {
        try {
          await options.blobProvider!.put(block.hash, assembled, {
            moduleId: block.moduleId,
            mimeType: block.mimeType,
          });
          queries.insertBlob(options.db, {
            hash: block.hash,
            size: assembled.length,
            mimeType: block.mimeType ?? 'application/octet-stream',
            moduleId: block.moduleId,
            refCount: 1,
            storedAt: new Date().toISOString(),
          });
          clearStagedBlob(options.db, block.hash);
          blobsReceived += 1;
          const ack = createSecureJsonMessage(
            'BLOB_ACK', options.identity.publicKey, '',
            { hash: block.hash, ok: true } satisfies BlobAckPayload,
            payloadSecurity,
          );
          await connection.send(encodeMessage(ack));
        } catch {
          // Storage failed: keep the staged blocks so the next session resumes.
        }
      })();
      return;
    }

    if (msg.type === 'SYNC_DATA') {
      const payload = parseSecureJsonPayload<{ moduleId: string; syncData: number[]; changeIds?: string[]; sig?: string }>(
        msg,
        payloadSecurity,
      );
      if (payload && options.enabledModules.includes(payload.moduleId)) {
        const syncData = new Uint8Array(payload.syncData);

        // MK-013, hardened: every batch MUST carry a valid author signature.
        // A missing signature is treated exactly like a forged one -- the
        // optional-verify window the audit flagged (strip the sig field and
        // the batch applied unverified) is closed.
        if (typeof payload.sig !== 'string') {
          recordInboundReject(
            options,
            { remoteDeviceId: handshake.remoteDeviceId, sessionId },
            replayAuditScope,
            { moduleId: payload.moduleId, table: null, rowId: null, operation: 'SYNC_DATA' },
            'missing_batch_signature',
          );
          return;
        }
        const authorVerified = verifyBatch(
          handshake.remoteDeviceId,
          payload.moduleId,
          syncData,
          payload.changeIds ?? [],
          payload.sig,
        );
        if (!authorVerified) {
          recordInboundReject(
            options,
            { remoteDeviceId: handshake.remoteDeviceId, sessionId },
            replayAuditScope,
            { moduleId: payload.moduleId, table: null, rowId: null, operation: 'SYNC_DATA' },
            'bad_batch_signature',
          );
          return;
        }
        // Author cryptographically verified: surface it in the activity trail.
        try {
          queries.insertInboundAudit(options.db, {
            id: `ia_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            sessionId,
            peerDeviceId: handshake.remoteDeviceId,
            moduleId: payload.moduleId,
            tableName: null,
            rowId: null,
            operation: 'SYNC_DATA',
            outcome: 'accepted',
            reason: 'batch_author_verified',
            scope: replayAuditScope,
            createdAt: new Date().toISOString(),
          });
        } catch {
          // The audit trail must never break the session.
        }

        // Prefer the policy-first path: compute candidate changes WITHOUT
        // mutating the document, let inbound policy (MK-002) decide, and commit
        // only AUTHORIZED rows back into the doc. A rejected or laundered row
        // therefore never enters the document and never re-broadcasts. Document
        // managers that cannot diff without merging (the Automerge web path)
        // fall back to the merge-then-enforce behavior.
        const docManager = options.documentManager as DocumentManager & {
          diffSyncMessage?: (moduleId: string, message: Uint8Array) => ReceivedDocumentChange[];
        };
        const policyFirst = typeof docManager.diffSyncMessage === 'function';
        const changes = policyFirst
          ? docManager.diffSyncMessage!(payload.moduleId, syncData)
          : docManager.receiveSyncMessage(payload.moduleId, syncData);
        const appliedChanges = applyReceivedDocumentChanges(
          options,
          payload.moduleId,
          changes,
          { remoteDeviceId: handshake.remoteDeviceId, sessionId },
          policyFirst
            ? (change: ReceivedDocumentChange) => docManager.applyChange(payload.moduleId, {
                table: change.table,
                rowId: change.rowId,
                operation: change.operation as 'INSERT' | 'UPDATE' | 'DELETE',
                data: change.data ?? null,
              })
            : undefined,
        );
        totalReceived += appliedChanges;
        totalBytesReceived += data.length;
        if (appliedChanges > 0) modulesUpdated.push(payload.moduleId);

        // MK-009: record receipts for the sender's covered changes and
        // acknowledge the batch so the sender can track per-peer delivery.
        const coveredChangeIds = payload.changeIds ?? [];
        const receiptAt = new Date().toISOString();
        for (const changeId of coveredChangeIds) {
          try {
            queries.insertReceipt(options.db, {
              sessionId,
              peerDeviceId: handshake.remoteDeviceId,
              moduleId: payload.moduleId,
              changeId,
              acknowledgedAt: receiptAt,
            });
          } catch {
            // A receipt write must never break the session.
          }
        }
        const ackMsg = createSecureJsonMessage(
          'SYNC_ACK',
          options.identity.publicKey,
          '',
          { moduleId: payload.moduleId, changeIds: coveredChangeIds },
          payloadSecurity,
        );
        void connection.send(encodeMessage(ackMsg));
        recordExpiringEntitiesForChanges(
          options.db,
          changes.map((change) => ({
            moduleId: payload.moduleId,
            tableName: change.table,
            rowId: change.rowId,
            operation: change.operation as 'INSERT' | 'UPDATE' | 'DELETE',
            createdAt: new Date().toISOString(),
          })),
          negotiation?.securityAgreement?.disappearAfterSeconds ?? null,
        );

        // MK-027: request blobs the applied rows reference that we cannot
        // resolve locally. `have` carries already-staged block indices so an
        // interrupted transfer resumes instead of restarting.
        if (options.blobProvider) {
          for (const hash of collectBlobRefs(changes)) {
            if (requestedBlobs.has(hash) || queries.getBlob(options.db, hash)) continue;
            requestedBlobs.add(hash);
            const reqMsg = createSecureJsonMessage(
              'BLOB_REQUEST', options.identity.publicKey, '',
              {
                hash,
                moduleId: payload.moduleId,
                have: getStagedBlockIndices(options.db, hash),
              } satisfies BlobRequestPayload,
              payloadSecurity,
            );
            void connection.send(encodeMessage(reqMsg));
          }
        }
      }
    }
  };
  connection.onData(dataHandler);

  // Wait for completion (with timeout)
  const waitStart = Date.now();
  while (!done && Date.now() - waitStart < 60_000) {
    await new Promise((r) => setTimeout(r, 100));
  }

  const session = buildSession({
    peerDeviceId: handshake.remoteDeviceId,
    transport: options.transport,
    workspaceId: options.workspaceId,
    startedAt,
    durationMs: Date.now() - startTime,
    id: sessionId,
    status: done ? 'completed' : 'partial',
    error: done ? null : 'Timeout waiting for BYE',
    modulesSynced: options.enabledModules,
    changesSent: totalSent,
    changesReceived: totalReceived,
    bytesSent: totalBytesSent,
    bytesReceived: totalBytesReceived,
    blobsReceived,
  });
  queries.insertSyncSession(options.db, session);

  const gossip: GossipRoundResult | undefined = gossipExchanged
    ? { revsSent: gossipRevsSent, descsSent: gossipDescsSent, appliedFromPeer: gossipAppliedFromPeer }
    : undefined;
  return { session, modulesUpdated, negotiation, gossip };
}

/**
 * Sync a single module's CRDT document with a peer.
 */
async function syncModule(
  connection: TransportConnection,
  options: SyncSessionOptions,
  moduleId: string,
  remoteDeviceId: string,
  payloadSecurity: SessionPayloadSecurity,
  sentBlobRows: Map<string, Array<Record<string, unknown>>>,
): Promise<{ sent: number; received: number; bytesSent: number; bytesReceived: number; ackedChangeIds: string[] }> {
  // Get peer's known sync state
  const peerState = queries.getPeerModuleState(options.db, remoteDeviceId, moduleId);
  const peerSyncState = peerState?.automergeHeads
    ? new Uint8Array(JSON.parse(peerState.automergeHeads))
    : null;
  const sessionScope = outboundSessionScope(options, remoteDeviceId);

  // The change-log rows this module snapshot covers (MK-009 delivery tracking).
  // Keep this list in the same scope as the outbound snapshot: a shared
  // workspace peer must not receive or ack personal_replica rows such as
  // channel read state. Plan 27: a row the transport-policy filter drops from
  // the snapshot must not be acked either -- it stays unsynced until a
  // permitted (local) session actually delivers it.
  // Freeze candidates before the snapshot: later edits must not receive its acknowledgement.
  const pendingChanges = options.changeTracker.getUnsyncedByModule(moduleId);
  // Receipt IDs are derived from the actual filtered snapshot below.
  const rawSyncMessage = options.documentManager.generateSyncMessage(moduleId, peerSyncState);
  const syncMessage = rawSyncMessage
    ? filterLwwSnapshotForScope(rawSyncMessage, options, moduleId, sessionScope, remoteDeviceId)
    : null;
  let sent = 0;
  let bytesSent = 0;
  let ackedChangeIds: string[] = [];

  // MK-028: sliding window. The most recently updated rows ship as a priority
  // batch before the backfill remainder; the receive path applies batches in
  // arrival order, so visible data lands first on a cold start.
  const batches: Uint8Array[] = [];
  if (syncMessage) {
    const split = options.syncWindow && options.syncWindow > 0
      ? splitSnapshotForWindow(syncMessage, options.syncWindow)
      : null;
    if (split?.backfill) {
      batches.push(split.window, split.backfill);
    } else {
      batches.push(syncMessage);
    }
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = filterLwwSnapshotForScope(
      batches[i]!, options, moduleId, outboundSessionScope(options, remoteDeviceId), remoteDeviceId,
    );
    if (!batch) continue;
    let sentSnapshot: LwwSnapshotWire | null = null;
    try { sentSnapshot = JSON.parse(jsonDecoder.decode(batch)) as LwwSnapshotWire; } catch { /* legacy CRDT */ }
    const coveredChangeIds = pendingChanges.filter((change) => {
      if (!sentSnapshot?.tables) return !options.isOwnDevice && !options.workspaceId;
      return change.operation === 'DELETE'
        ? Boolean(sentSnapshot.tombstones?.[change.tableName]?.[change.rowId])
        : Boolean(sentSnapshot.tables[change.tableName]?.[change.rowId]);
    }).map((change) => change.id);
    for (const rows of Object.values(sentSnapshot?.tables ?? {})) {
      for (const row of Object.values(rows)) {
        for (const hash of collectBlobRefs([{ data: row }])) {
          const key = `${moduleId}:${hash}`;
          sentBlobRows.set(key, [...(sentBlobRows.get(key) ?? []), row]);
        }
      }
    }
    // Each acknowledgement covers only the rows this batch actually carried.
    const batchChangeIds = coveredChangeIds;
    // MK-013, hardened: authorship is bound to EVERY batch. Receivers reject
    // unsigned batches, so an unsignable batch is a hard local failure (it
    // means this device cannot load its own signing key), never a silent
    // unsigned send.
    const batchSignature = signBatch(options.identity, moduleId, batch, batchChangeIds);
    if (!batchSignature) {
      throw new Error('Batch signing unavailable: device signing key could not be loaded');
    }
    const msg = createSecureJsonMessage(
      'SYNC_DATA',
      options.identity.publicKey,
      '',
      {
        moduleId,
        syncData: Array.from(batch),
        changeIds: batchChangeIds,
        sig: batchSignature,
      },
      payloadSecurity,
    );
    const encoded = encodeMessage(msg);
    await connection.send(encoded);
    sent += 1;
    bytesSent += encoded.length;

    // MK-009: a change only counts as delivered to this peer when the peer
    // acknowledges the module batch. No ack, no receipt, no silent drop.
    // MK-027: a BLOB_REQUEST may interleave ahead of the ack (the responder
    // requests as soon as it applies); the session-level collector already
    // queued it, so skip it here and keep waiting for the ack.
    let ackMsg: import('../types').SyncMessage | null = null;
    const ackDeadline = Date.now() + 10_000;
    while (Date.now() < ackDeadline) {
      const next = await waitForNextMessage(connection, ackDeadline - Date.now());
      if (!next) break;
      if (next.type === 'BLOB_REQUEST' || next.type === 'BLOB_ACK') continue;
      // An ack claiming any device but the handshake-authenticated peer is
      // injected or misrouted: never let it satisfy a receipt.
      if (next.deviceId !== remoteDeviceId) continue;
      ackMsg = next;
      break;
    }
    if (ackMsg && ackMsg.type === 'SYNC_ACK') {
      const ackPayload = parseSecureJsonPayload<{ moduleId: string; changeIds?: string[] }>(
        ackMsg,
        payloadSecurity,
      );
      if (ackPayload && ackPayload.moduleId === moduleId) {
        // A receipt may only cover what this batch actually carried: acks are
        // intersected with the sent ids so a forged or over-broad ack can
        // never mark undelivered changes as synced (delivery-loss hardening).
        const claimed = ackPayload.changeIds ?? [];
        const sent = new Set(batchChangeIds);
        ackedChangeIds.push(...claimed.filter((id) => sent.has(id)));
      }
    }
  }

  // Update peer module state
  const docState = options.documentManager.getSyncState(moduleId);
  queries.upsertPeerModuleState(options.db, {
    deviceId: remoteDeviceId,
    moduleId,
    lastSyncedVersion: (peerState?.lastSyncedVersion ?? 0) + 1,
    lastSyncedAt: new Date().toISOString(),
    automergeHeads: JSON.stringify(Array.from(docState)),
  });

  return { sent, received: 0, bytesSent, bytesReceived: 0, ackedChangeIds };
}

/**
 * Serve one blob request (MK-027): stream the missing blocks, refusing blobs
 * we do not hold or that exceed the module's size cap. Returns frame bytes sent.
 */
async function serveBlobRequest(
  connection: TransportConnection,
  options: SyncSessionOptions,
  req: BlobRequestPayload,
  payloadSecurity: SessionPayloadSecurity,
  authorized: () => boolean,
): Promise<{ ok: boolean; bytes: number }> {
  const sendAck = async (ack: BlobAckPayload) => {
    const msg = createSecureJsonMessage('BLOB_ACK', options.identity.publicKey, '', ack, payloadSecurity);
    await connection.send(encodeMessage(msg));
  };

  if (!authorized()) {
    await sendAck({ hash: req.hash, ok: false, reason: 'not_found' });
    return { ok: false, bytes: 0 };
  }
  let bytes: Uint8Array | null = null;
  try {
    bytes = await options.blobProvider!.get(req.hash);
  } catch {
    bytes = null;
  }
  if (!bytes) {
    await sendAck({ hash: req.hash, ok: false, reason: 'not_found' });
    return { ok: false, bytes: 0 };
  }

  // The sender enforces the module's size cap too: a peer cannot pull an
  // over-cap blob just by asking for it.
  const cap = ensureBlobPolicy(options.db, req.moduleId).maxBlobSizeBytes;
  if (cap > 0 && bytes.length > cap) {
    await sendAck({ hash: req.hash, ok: false, reason: 'size_cap' });
    return { ok: false, bytes: 0 };
  }

  const have = new Set(req.have ?? []);
  let sentBytes = 0;
  for (const block of splitBlobForTransfer(bytes, req.hash, req.moduleId, null)) {
    if (!authorized()) return { ok: false, bytes: sentBytes };
    if (have.has(block.index)) continue; // resume: peer already staged it
    const msg = createSecureJsonMessage('BLOB_DATA', options.identity.publicKey, '', block, payloadSecurity);
    const frame = encodeMessage(msg);
    await connection.send(frame);
    sentBytes += frame.length;
  }
  return { ok: true, bytes: sentBytes };
}

/**
 * Wait for the next decoded SyncMessage from a connection with a timeout.
 */
function waitForNextMessage(
  connection: TransportConnection,
  timeoutMs: number,
): Promise<import('../types').SyncMessage | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    connection.onData((data) => {
      clearTimeout(timer);
      resolve(decodeMessage(data));
    });
  });
}

function buildSession(opts: {
  peerDeviceId: string;
  transport: SyncTransport;
  workspaceId?: string;
  startedAt: string;
  durationMs: number;
  status: 'completed' | 'partial' | 'failed';
  error: string | null;
  modulesSynced: string[];
  changesSent: number;
  changesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  blobsSent?: number;
  blobsReceived?: number;
  id?: string;
}): SyncSession {
  return {
    id: opts.id ?? `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    peerDeviceId: opts.peerDeviceId,
    workspaceId: opts.workspaceId ?? null,
    transport: opts.transport,
    direction: 'bidirectional',
    modulesSynced: opts.modulesSynced,
    changesSent: opts.changesSent,
    changesReceived: opts.changesReceived,
    bytesSent: opts.bytesSent,
    bytesReceived: opts.bytesReceived,
    blobsSent: opts.blobsSent ?? 0,
    blobsReceived: opts.blobsReceived ?? 0,
    durationMs: opts.durationMs,
    status: opts.status,
    error: opts.error,
    startedAt: opts.startedAt,
    completedAt: new Date().toISOString(),
  };
}
