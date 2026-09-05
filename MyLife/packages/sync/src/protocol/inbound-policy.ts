/**
 * Inbound policy enforcement (MK-002).
 *
 * A paired peer is authenticated, but authentication is not authorization.
 * Every document change received from a peer is evaluated here before it is
 * applied to the local database. The rule is fail-closed: a change is applied
 * only if it passes every check. Anything else is rejected and audited.
 *
 * Security lives in the payload, not the channel: even a fully paired, fully
 * encrypted peer cannot write a row that escapes its module's declared scope,
 * targets a module it has no business in, resurrects a tombstoned row, or
 * arrives from a device that has been revoked.
 *
 * This module is pure (no database, no I/O) so the red-team matrix can be
 * exercised exhaustively and deterministically. The database-backed wrapper in
 * sync-session.ts gathers the facts and calls evaluateInboundChange().
 */

import { type SyncScope, type SyncTransport, isScopeWithinMaxScope } from '../types';
import { transportPolicyAllows, type CommunityTransportPolicy } from './community';

/** Why an inbound change was rejected. Persisted in the audit log. */
export type InboundRejectReason =
  | 'peer_revoked'
  | 'peer_not_authorized'
  | 'invalid_operation'
  | 'unknown_table'
  | 'module_mismatch'
  | 'module_disabled'
  | 'scope_device_local'
  | 'scope_exceeds_cap'
  | 'sas_unverified'
  | 'transport_not_permitted'
  | 'invalid_timestamp'
  | 'tombstoned';

/** Session-level authorization facts, computed once per peer/session. */
export interface InboundSessionAuth {
  /** The peer device has been revoked (globally) -- reject everything. */
  peerRevoked: boolean;
  /**
   * The peer is allowed to write at this session's scope: an active member of
   * the workspace for a workspace session, or a paired device for personal sync.
   */
  peerAuthorized: boolean;
  /**
   * The scope at which data arriving on this session is replicated.
   * personal_replica for own-device sync, shared_workspace for a group/community
   * workspace, published_blob for public content.
   */
  sessionScope: SyncScope;
  /**
   * Whether this peer has completed SAS (emoji) verification for this session's
   * trust boundary (MK-017). Required before a sensitive module may replicate at
   * shared_workspace scope; irrelevant for personal_replica own-device sync.
   */
  sasVerified: boolean;
  /**
   * The transport this session actually runs over (Plan 27). Every
   * TransportConnection knows its transport at construction, so the session
   * caller always has this. Optional only for legacy constructors: when a
   * change carries a community transport-policy fact and this is missing, the
   * gate fails CLOSED (transport_not_permitted).
   */
  sessionTransport?: SyncTransport;
}

/** Per-change facts, resolved from the change + module policy + local state. */
export interface InboundChangeFacts {
  operation: string;
  /** moduleId claimed by the SYNC_DATA batch carrying this change. */
  claimedModuleId: string;
  /** moduleId that actually owns the change's table (by prefix), or null. */
  resolvedModuleId: string | null;
  /** Whether the resolved module is enabled locally. */
  moduleEnabled: boolean;
  /**
   * The maximum scope this table may be replicated at, folding in the module's
   * entity rule (maxScope/defaultScope), module defaultScope, and shareable
   * flag. null means no declared policy -> fail closed.
   */
  moduleScopeCap: SyncScope | null;
  /** Whether the resolved module's policy is marked isSensitive (MK-017). */
  moduleIsSensitive: boolean;
  /**
   * Whether the resolved module's policy requires an out-of-band SAS verification
   * before shared-workspace replication, decoupled from isSensitive's per-entity
   * encryption. Treated identically to moduleIsSensitive by the SAS gate.
   */
  moduleRequiresSasForShare: boolean;
  /** updated_at on the incoming row (LWW + tombstone comparison), or null. */
  incomingUpdatedAt: string | null;
  /** deleted_at of an existing tombstone for this row, or null if none. */
  tombstoneDeletedAt: string | null;
  /**
   * The signed transport policy of the community this row belongs to (Plan 27),
   * resolved by the caller from the row's community_id / workspace_id against
   * the LOCALLY stored descriptor (never from the peer). null/undefined when
   * the row is not attributable to a locally known community (non-community
   * rows, DM-group workspaces) -- no transport gate applies then; the row
   * gates only enforce promises this device actually holds.
   */
  communityTransportPolicy?: CommunityTransportPolicy | null;
}

export interface InboundDecision {
  allowed: boolean;
  reason?: InboundRejectReason;
}

/**
 * Decide whether a single received change may be applied locally.
 *
 * Checks run in escalating order of specificity so the audited reason is the
 * most fundamental violation: revoked peer first, then authorization, then
 * structural (operation/table/module), then scope, then tombstone.
 */
export function evaluateInboundChange(
  auth: InboundSessionAuth,
  facts: InboundChangeFacts,
): InboundDecision {
  // A revoked device is untrusted regardless of what it sends.
  if (auth.peerRevoked) return { allowed: false, reason: 'peer_revoked' };

  // Authenticated but not authorized for this scope (not a member / not paired).
  if (!auth.peerAuthorized) return { allowed: false, reason: 'peer_not_authorized' };

  // Only the three CRDT operations are ever applied.
  if (
    facts.operation !== 'INSERT'
    && facts.operation !== 'UPDATE'
    && facts.operation !== 'DELETE'
  ) {
    return { allowed: false, reason: 'invalid_operation' };
  }

  // The table must resolve to a known module...
  if (facts.resolvedModuleId === null) return { allowed: false, reason: 'unknown_table' };

  // ...the same module the batch claims (a peer cannot smuggle a foreign
  // module's table inside another module's sync stream)...
  if (facts.resolvedModuleId !== facts.claimedModuleId) {
    return { allowed: false, reason: 'module_mismatch' };
  }

  // ...and that module must be enabled on this device.
  if (!facts.moduleEnabled) return { allowed: false, reason: 'module_disabled' };

  // No declared sync policy means the data is device-local by default: nothing
  // is accepted inbound. A device_local cap likewise never accepts a peer write.
  const cap = facts.moduleScopeCap;
  if (cap === null || cap === 'device_local') {
    return { allowed: false, reason: 'scope_device_local' };
  }

  // The session's scope must not exceed the entity's cap. This blocks a peer in
  // a shared workspace from pushing data for a module capped at personal_replica.
  if (!isScopeWithinMaxScope(auth.sessionScope, cap)) {
    return { allowed: false, reason: 'scope_exceeds_cap' };
  }

  // SAS gate (MK-017): a module that is isSensitive OR requiresSasForShare may
  // only replicate into a shared workspace from a peer whose key the user has
  // emoji-verified. TOFU alone is not enough across a trust boundary that might
  // have been MITM'd at first contact. Personal own-device sync is exempt.
  if (
    auth.sessionScope === 'shared_workspace'
    && (facts.moduleIsSensitive || facts.moduleRequiresSasForShare)
    && !auth.sasVerified
  ) {
    return { allowed: false, reason: 'sas_unverified' };
  }

  // Transport-policy gate (Plan 27): a row belonging to a community whose
  // SIGNED policy forbids this session's transport is never applied -- the
  // security boundary is the row, not the dial (one device-scoped session
  // carries many communities). Fail closed when the transport is unknown.
  // BLE is rejected by construction (never a data path, NC-2).
  if (facts.communityTransportPolicy != null) {
    if (
      !auth.sessionTransport
      || !transportPolicyAllows(facts.communityTransportPolicy, auth.sessionTransport)
    ) {
      return { allowed: false, reason: 'transport_not_permitted' };
    }
  }

  // Do not resurrect a deleted row: an INSERT/UPDATE no newer than the tombstone
  // is rejected. A strictly newer write is a legitimate re-creation.
  if (
    facts.tombstoneDeletedAt !== null
    && (facts.operation === 'INSERT' || facts.operation === 'UPDATE')
  ) {
    if (!facts.incomingUpdatedAt || facts.incomingUpdatedAt <= facts.tombstoneDeletedAt) {
      return { allowed: false, reason: 'tombstoned' };
    }
  }

  return { allowed: true };
}
