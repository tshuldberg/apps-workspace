import { isMeerkatOwnSyncDevice } from '../data/sync-peer-authorization';
import type { PublishRendezvousReceipt } from '@mylife/sync';
import { createMeerkatRelayBackend, hostedRelayAccess } from '../data/hosted-relay';
// SyncProvider (MK-008): mounts the native SyncEngine over the app database.
//
// Owns the engine lifecycle, device pairing (X25519 DH via the sync package's
// pairing flow), and manual relay sessions: both devices join a relay on a
// token derived from a shared phrase, one listens (responder) and one syncs
// (initiator). The pad row is the bellwether entity that moves between them.
// Only real sessions are ever shown; nothing here fakes connectivity.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';
import {
  MailboxListenEngine,
  CallSignalTransport,
  NativeSyncEngine,
  applyJoinGrant,
  applyMemberRemoval,
  approvePublicJoinRequest,
  buildFileGrant,
  buildFileDecline,
  buildJoinRequest,
  connectRelayPeer,
  connectLanPeer,
  startLanListener,
  applySignedRevocation,
  completePairing,
  createSignedRevocation,
  deriveCommunityJoinToken,
  deriveCommunityRemovalToken,
  deriveDmGroupCommitToken,
  removeCommunityMember,
  republishCommunityDescriptor,
  reviseCommunity,
  revisePolicy,
  runAutoConnectJob,
  upsertCommunity,
  transportAllowedForCommunity,
  type AutoConnectRoundResult,
  type CommunityTransportPolicy,
  type RemoveCommunityMemberResult,
  derivePublicJoinToken,
  deriveSas,
  encodeMailboxEnvelope,
  evaluateBundleTrust,
  fileRequestId,
  friendCodeToRendezvousId,
  generateRendezvousSecretHalf,
  bytesToHex,
  isValidCustomFriendCode,
  getPairedDevice,
  getPairedDevices,
  getPinnedIdentity,
  getRecentSyncSessions,
  getSasVerification,
  getSharedSecretHex,
  getTransportRungStats,
  hexToBytes,
  insertPairedDevice,
  isDeviceRevoked,
  getCommunity,
  listCommunities,
  normalizeMeerkatPairingInput,
  parseHumanityToken,
  pinIdentity,
  processJoinRequest,
  publishIdentityToRendezvous,
  recordSasVerification,
  resolveIdentityFromRendezvous,
  runMailboxDrainJob,
  recordPresenceBeacon,
  prunePresenceBeacons,
  runSyncSessionJob,
  sasFingerprint,
  sealChannelMessageMailboxDelta,
  sealFileRequestMailbox,
  sealHistoryRequestMailbox,
  splitBlobForTransfer,
  historyRequestId,
  parseCommunityInviteLink,
  communityRole,
  type ProfileNameColorToken,
  communityTransportPolicy,
  transportPolicyAllows,
  touchPinnedIdentity,
  PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
  type ApprovePublicJoinResult,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
  type DmGroupMember,
  type DmMessageAttachment,
  type DmReceiptState,
  type FileRequestFields,
  type HistoryRequestFields,
  type MailboxDrainPeer,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type ParsedInviteLink,
  type PublicJoinRequestPayload,
  LANDiscovery,
  type DiscoveredPeer,
  type LanListener,
  type PairedDevice,
  type SasResult,
  type SignedIdentityBundle,
  type SyncEngineStatus,
  type SyncRungStats,
  type SyncSession,
} from '@mylife/sync';
import {
  LAN_RECOVERY_GUIDANCE,
  loadDiscoveryBackend,
  loadLanSocketBackend,
} from '../data/lan-backend';
import {
  dataTransportFactories,
  getDataTransportAvailability,
  nativeLayerAllowedAcrossCommunities,
  type DataTransportAvailability,
} from '../data/transport-backends';
import { WebRTCSyncSignaling } from '../data/webrtc-sync-signaling';
import {
  ensureCallTables,
  hasSeenCallNonce,
  pruneCallNonces,
  recordCallNonce,
} from '../data/call-store';
import { ExpoBlobStore } from '../data/expo-blob-store';
import { ensurePersonalWorkspace } from '../data/library-hub-core';
import {
  getIdentityRow, FRIEND_CODE_KEY, FRIEND_CODE_SECRET_KEY, getSetting, setSetting, deleteSetting } from '../data/db';
import { effectiveRelayUrl, ensureEffectiveRelayUrl } from '../data/effective-relay';
import {
  alignPersonIdentity,
  buildPersonGroupMailboxHandlers,
  ensurePersonIdentityTables,
  proposePersonGroupRevision,
  cancelPersonProposal,
  listPendingPersonProposals,
  removeDevicesFromPerson,
  resetPersonGroup,
  listInboundPersonApprovals,
  approveInboundPersonProposal,
  declineInboundPersonProposal,
  type InboundPersonProposal,
  readPersonGroup,
  readPersonLinks,
  setPresentationOverride,
  type ProposePersonGroupResult,
  announcePersonToDmPeer,
  drainPersonAnnounceOutbox,
} from '../data/person-identity-core';
import type { DatabaseAdapter } from '@mylife/db';
import { useMeerkatDatabase } from './DatabaseProvider';
import { useIdentity } from './IdentityProvider';
import {
  MEERKAT_KEYS_MODULE_ID,
  MEERKAT_SYNC_MODULE_ID,
  MEERKAT_SYNC_PREFIXES,
  MEERKAT_SYNC_POLICIES,
  PAD_TABLE,
  PAD_ROW_ID,
  buildRendezvousToken,
  buildSignedPairingPayload,
  ensureSyncSchema,
  getPadRow,
  pairingDataFromBundle,
  parseSignedPairingPayload,
  savePadRow,
  type PadRow,
} from '../data/sync-core';
import {
  COMMUNITY_MODULE_ID,
  getPublicJoinRequest,
  publishCommunityIdentity as publishCommunityIdentityRow,
  publishCommunityLayout as publishCommunityLayoutRow,
  recordPublicJoinRequests,
  setPublicJoinRequestStatus,
  tombstoneCommunityIdentity as tombstoneCommunityIdentityRow,
  tombstoneCommunityLayout as tombstoneCommunityLayoutRow,
  type PublishCommunityIdentityFields,
} from '../data/community-core';
import {
  buildFileMailboxHandlers,
  getFileRequest,
  isActiveCommunityMember,
  setFileRequestStatus,
  upsertFileRequest,
} from '../data/file-request-core';
import { buildHistoryBackfillHandlers } from '../data/history-backfill-core';
import { getFeedCursor, reconcileCommunityPolicyHistory } from '../data/community-core';
import {
  drainCommunityJoinBoxesFromHosts,
  mirrorEventToCommunityHost,
  parkJoinRequestOnInviteHost,
} from '../data/community-core';
import { parkJoinEnvelopeOnNode } from '@mylife/sync';
import { reconcileCommunityFileReportTargets } from '../data/community-safety';
import { emitPresenceBeacons, isAppearOnlineEnabled, planPresenceEmission } from '../data/presence-core';
import { getCurrentPublicationDescriptor, listOwnedPublications } from '../data/public-publish';
import {
  blockDmParticipantCore,
  buildDmGroupMailboxHandlers,
  buildDmMailboxHandlers,
  buildDmShredHandler,
  createDmGroupCore,
  dmGroupAddMemberCore,
  dmGroupRemoveMemberCore,
  linkOwnDeviceCore,
  queueDmMessageCore,
  queueDmReceiptCore,
  queueDmShredCore,
  reportDmCore,
  type CreateDmGroupCoreResult,
  type DmGroupMutationCoreResult,
  type QueueDmMessageResult,
  type QueueDmReceiptResult,
  type QueueDmShredResult,
  type ReportDmInput,
} from '../data/dm-provider-core';
import {
  removeDmOwnDevice,
  listDmOwnDevices, listDmConversations } from '../data/dm-core';
import { buildOrganizationChanges, type OrganizationDraft } from '../data/community-org-core';
import {
  getLastAutoConnectRound,
  isAutoConnectEnabled,
  recordAutoConnectRound,
  runComposedAutoConnectRound,
  setAutoConnectEnabled,
  type AutoConnectRoundOutcome,
  type AutoConnectRoundSummary,
  type AutoConnectTrigger,
} from '../data/auto-connect-core';
import { useAutoConnectTriggers } from '../data/use-auto-connect-triggers';
import { buildHumanityRedeemClient, humanityServiceConfig } from '../data/humanity-core';

export type RelaySessionRole = 'initiate' | 'listen';

export interface RunRelaySessionInput {
  relayUrl: string;
  phrase: string;
  peerDeviceId: string;
  role: RelaySessionRole;
}

export interface RunLanSessionInput {
  host: string;
  port: number;
  peerDeviceId: string;
}

export interface QueueChannelMessageMailboxResult {
  attempted: number;
  queued: number;
  skipped: number;
  failed: number;
}

/** Outcome of asking the owner to re-send a removed file (Files Phase 3). */
export type QueueFileRequestResult =
  | { ok: true; requestId: string; ownerDeviceId: string }
  | {
      ok: false;
      reason:
        | 'not_paired'
        | 'no_relay'
        | 'revoked'
        | 'not_a_member'
        | 'park_failed'
        | 'self_author';
    };

/** Outcome of an owner approving / declining an incoming file request. */
export type QueueFileGrantResult =
  | { ok: true; decision: 'approve' | 'decline' }
  | {
      ok: false;
      reason:
        | 'not_found'
        | 'not_incoming'
        | 'not_paired'
        | 'no_relay'
        | 'revoked'
        | 'not_a_member'
        | 'owner_no_longer_has_file'
        | 'park_failed';
    };

/** Outcome of asking a peer member to backfill a channel's history (P3). */
export type QueueHistoryRequestResult =
  | { ok: true; requestId: string; peerDeviceId: string }
  | {
      ok: false;
      reason:
        | 'not_paired'
        | 'no_relay'
        | 'revoked'
        | 'not_a_member'
        | 'self_peer'
        | 'park_failed';
    };

/**
 * Outcome of a joiner parking a join-request for the owner (P7). A request is
 * parked ONLY on a real relay park; this never claims a pending join is done.
 */
export type QueueJoinRequestResult =
  | { ok: true; communityId: string; ownerDeviceId: string }
  | {
      ok: false;
      reason:
        | 'malformed_link'
        | 'no_owner_dh'
        | 'no_relay'
        | 'needs_local'
        | 'already_member'
        | 'park_failed';
    };

/** What a foreground drain actually moved (honest counts; no faked delivery). */
export interface ForegroundDrainResult {
  ran: boolean;
  appliedMessages: number;
  /** Inbound verified DM delivery/read receipts applied this drain. */
  dmReceipts: number;
  fileRequests: number;
  fileGrants: number;
  /** History-request envelopes this device served (real backfill grants parked). */
  historyRequestsServed: number;
  /** History-grant envelopes this device applied (verified events merged). */
  historyGrantsApplied: number;
  /** Join-request envelopes this device (the owner) served (real join grants parked). */
  joinRequestsServed: number;
  /** Join-grant envelopes this device (a joiner) applied (now holds an epoch key). */
  joinGrantsApplied: number;
  /** PUBLIC-join request envelopes recorded into the local review queue (no key handed off). */
  publicJoinRequestsRecorded: number;
  /** Community member-removals this device applied (roster closed + epoch wrap stored, Plan 28). */
  memberRemovalsApplied: number;
}

export type SetCommunityProfileResult =
  | { ok: true }
  | { ok: false; error: string };

/** Owner-only result of publishing or clearing a community's cosmetic identity. */
export type SetCommunityAppearanceResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Owner-only result of saving the channel manager draft (Plan 38 Phase 2). One
 * Save commits the WHOLE draft (channels + categories) as a single signed
 * reviseCommunity revision -- never one revision per drag.
 */
export type SaveCommunityOrganizationResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Outcome of the owner approving a queued public-join request (Plan 19 FF3).
 * Wraps the engine's ApprovePublicJoinResult with one app-level reason
 * ('not_found') for a missing queue row or missing current publication row --
 * the engine itself only ever sees a well-formed request. ok:true means the
 * epoch-key grant really parked (approvePublicJoinRequest never returns ok:true
 * otherwise); the caller must not claim a join before that.
 */
export type ApprovePublicJoinRequestResult =
  | ApprovePublicJoinResult
  | { ok: false; reason: 'not_found' };

interface SyncContextValue {
  ready: boolean;
  /** Set when the engine failed to initialize: ready stays false and the UI must say why, not spin forever. */
  initError: string | null;
  status: SyncEngineStatus;
  pad: PadRow | null;
  savePad: (body: string) => void;
  recordLocalChange: (
    table: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    rowId: string,
    data: Record<string, unknown> | null,
  ) => void;
  /**
   * Plan 52 P3: record a join-time community name. Writes the presentation
   * -profile override (so every linked device adopts it) and immediately signs
   * the CommunityProfileEvent for this device via alignment.
   */
  applyJoinDisplayName: (communityId: string, displayName: string) => void;
  /**
   * Plan 52: set (or clear, with a null name) this person's presentation in
   * ONE community. Writes the presentation-profile override -- the single
   * source of truth, so every linked device adopts it -- then re-signs this
   * device's community profile through alignment. Use this rather than
   * setCommunityProfile, which only ever named the local device and would be
   * overwritten by the next alignment pass.
   */
  setCommunityPresentation: (
    communityId: string,
    displayName: string | null,
    appearance: {
      avatarInitial?: string | null;
      avatarImage?: string | null;
      bio?: string | null;
      pronouns?: string | null;
      nameColor?: ProfileNameColorToken | null;
    },
  ) => SetCommunityProfileResult;
  /**
   * Plan 52 P4: device id -> derived group id for one community, from
   * VERIFIED announces only. An absent entry means the device renders as its
   * own row; nothing here is ever inferred.
   */
  personLinks: (communityId: string) => Map<string, string>;
  setCommunityProfile: (
    communityId: string,
    displayName: string,
    avatarInitial?: string | null,
    avatarImage?: string | null,
  ) => SetCommunityProfileResult;
  /**
   * Owner-only (Plan 38): publish the community's cosmetic identity (description,
   * accent, icon, sealed banner, theme blob) as one signed revision and record it
   * for replication. The banner must be pre-sealed by the caller (sealCommunityBanner)
   * so this stays decoupled from the node store. Refuses with an honest error when
   * the caller is not the community owner.
   */
  setCommunityAppearance: (
    communityId: string,
    fields: PublishCommunityIdentityFields,
  ) => SetCommunityAppearanceResult;
  /** Owner-only (Plan 38): clear the community identity back to defaults (signed tombstone). */
  clearCommunityAppearance: (communityId: string) => SetCommunityAppearanceResult;
  /**
   * Owner-only (composition Phase 1): publish the community's composition
   * document (an @mylife/meerkat-layout codec blob) as one signed cm_layout
   * revision and record it for replication. Refuses (honest error) for a
   * non-owner or a malformed blob.
   */
  setCommunityLayout: (communityId: string, layoutBlob: string) => SetCommunityAppearanceResult;
  /** Owner-only: clear the layout back to the classic rendering (signed tombstone). */
  clearCommunityLayout: (communityId: string) => SetCommunityAppearanceResult;
  /**
   * Owner-only (Plan 38 Phase 2, W2 fix): commit the channel-manager draft as ONE
   * signed reviseCommunity revision (channels with kind/categoryId/order/topic/
   * archived + the categories array) and store it locally. This is the mobile
   * channel-creation path (previously absent): a new channel is added to the draft
   * and saved here. Refuses with an honest error when the caller is not the owner.
   */
  saveCommunityOrganization: (
    communityId: string,
    draft: OrganizationDraft,
  ) => SaveCommunityOrganizationResult;
  /**
   * Owner-only (Plan 27 P4): set the community's transport policy as ONE signed
   * revisePolicy revision and store it locally. Members converge when they
   * receive the newer descriptor (a fresh invite re-join or gossip), exactly like
   * every other owner revision; this writes locally only and never claims a live
   * push. Refuses with an honest error when the caller is not the owner.
   */
  setCommunityTransportPolicy: (
    communityId: string,
    policy: CommunityTransportPolicy,
  ) => SaveCommunityOrganizationResult;
  /** Best-effort store-and-forward parking for one signed channel event (MK-057). */
  queueChannelMessageMailbox: (
    event: ChannelMessageEvent,
  ) => Promise<QueueChannelMessageMailboxResult>;
  /**
   * Ask the message author to re-send a removed attachment (Files Phase 3).
   * Seals + parks a FILE_REQUEST and writes the outgoing cm_file_requests row
   * ONLY on a real park. Owner-only, paired-members-only.
   */
  queueFileRequest: (
    event: ChannelMessageEvent,
    attachment: ChannelMessageAttachment,
  ) => Promise<QueueFileRequestResult>;
  /**
   * Fields-based twin of {@link queueFileRequest} for callers that hold only the
   * aggregated file-row primitives (the Files index, D.1) rather than the full
   * signed event + attachment. Same gates, same honest-row-on-real-park path.
   */
  queueFileRequestByFields: (input: {
    communityId: string;
    channelId: string;
    messageId: string;
    attachmentId: string;
    blobHash: string;
    ownerDeviceId: string;
  }) => Promise<QueueFileRequestResult>;
  /** Owner side: approve or decline an incoming file request and park the grant. */
  queueFileGrant: (
    requestId: string,
    decision: 'approve' | 'decline',
  ) => Promise<QueueFileGrantResult>;
  /**
   * Ask a paired peer member to backfill a channel's history from THIS device's
   * current feed cursor (P3). Seals + parks a HISTORY_REQUEST on the peer's
   * mailbox token; the peer serves the verified events back on its next drain,
   * which this device re-verifies and merges. Returns ok only after a real park.
   */
  queueHistoryRequest: (
    peerDeviceId: string,
    communityId: string,
    channelId: string,
  ) => Promise<QueueHistoryRequestResult>;
  /**
   * Joiner side (P7): after joinCommunityFromLink, seal + park a join-request for
   * the community OWNER on the owner's community-derived join token. The owner
   * drains it, adds this device + mints an epoch, and parks a join-grant back on
   * this device's join token (drained by runForegroundDrain). Returns ok ONLY on
   * a real park. Safe to re-queue: the request id is stable and the owner is
   * idempotent. Pass the raw invite link (it carries the owner descriptor).
   */
  queueJoinRequest: (link: string) => Promise<QueueJoinRequestResult>;
  /**
   * Plan 21 Phase 4: build + locally echo a signed 1:1 DM event, then seal +
   * park it to every peer participant device AND (separately) to this user's
   * own other linked devices (dm_own_devices), so a second device converges.
   * dm_delivery is set to 'parked' per device ONLY on a real park; 'queued'
   * otherwise (no relay, or not a usable pairing). Never fabricates
   * 'delivered' or 'read' -- those come only from a real inbound receipt.
   */
  queueDmMessage: (
    conversationId: string,
    body: string,
    attachments?: DmMessageAttachment[],
  ) => Promise<QueueDmMessageResult>;
  /**
   * Plan 21 Phase 4: build a signed delivery/read receipt for a message and
   * park it to the message's author device, plus mirror it to this user's own
   * other devices. Honors the conversation's read_receipts_enabled: a 'read'
   * receipt is never built or sent while receipts are disabled.
   */
  queueDmReceipt: (
    conversationId: string,
    messageId: string,
    state: DmReceiptState,
  ) => Promise<QueueDmReceiptResult>;
  /**
   * Plan 21 Phase 4: record another device of THIS user as a DM mirror target
   * (dm_own_devices). The pairing secret already exists via the normal
   * Meerkat device-pairing flow; this only marks the relationship so
   * queueDmMessage/queueDmReceipt fan out to it too.
   */
  linkOwnDevice: (input: { deviceId: string; identityAnchor: string; dhPublicKey: string }) => void;
  /**
   * Plan 52 P1: link a device AND start the person-group ceremony for it, so
   * the two devices present as one person. Returns what really happened; a
   * refusal (for example another ceremony still pending) is reported, never
   * swallowed into a fake success.
   */
  linkOwnDeviceAsPerson: (input: {
    deviceId: string;
    identityAnchor: string;
    dhPublicKey: string;
    label: string;
  }) => Promise<ProposePersonGroupResult>;
  /**
   * Plan 52: remove a device from this person (lost, stolen, or retired). This
   * rotates the group secret so the removed device cannot derive future
   * per-context ids, records a tombstone so no later revision can silently
   * re-admit it, and revokes its own-device link.
   */
  unlinkOwnDeviceFromPerson: (deviceId: string) => Promise<ProposePersonGroupResult>;
  /** Plan 52: is a device-linking confirmation still waiting on another device? */
  hasPendingPersonProposal: () => boolean;
  /** Plan 52: abandon that pending confirmation so a new one can start. */
  cancelPendingPersonProposals: () => void;
  /**
   * Discard this device's person group and start over (round-3 HIGH-1). The
   * escape hatch for a group that can no longer agree with its siblings. Local
   * only: the other devices keep theirs until each is rebuilt and relinked.
   */
  rebuildOwnPersonGroup: () => void;
  /** Removal requests from your other devices waiting on your approval (L2). */
  pendingPersonRemovals: () => InboundPersonProposal[];
  approvePersonRemoval: (id: string) => Promise<boolean>;
  declinePersonRemoval: (id: string) => void;
  /**
   * Plan 21 Phase 7: create a group DM. Mints a real epoch key (no replication,
   * NC-9), persists the admin-signed descriptor + roster locally, and parks a
   * per-member DM_GROUP_COMMIT handoff. This device is the admin. `members` are
   * the other participants (deviceId + X25519 dhPublicKey).
   */
  createDmGroup: (title: string, members: DmGroupMember[]) => Promise<CreateDmGroupCoreResult>;
  /** Plan 21 Phase 7: add a member (admin-only). Advances the epoch, hands off to all members. */
  dmGroupAddMember: (conversationId: string, added: DmGroupMember) => Promise<DmGroupMutationCoreResult>;
  /** Plan 21 Phase 7: remove a member (admin-only). Rotates the epoch, hands off to remaining members. */
  dmGroupRemoveMember: (conversationId: string, removedDeviceId: string) => Promise<DmGroupMutationCoreResult>;
  /**
   * Plan 21 Phase 8: block a device from a DM. This is a REAL local revocation
   * (sync_device_revocations): the drain stops accepting its DMs and sends never
   * address it. Gossip-ready like any revocation.
   */
  blockDmParticipant: (deviceId: string, reason?: string) => void;
  /** Plan 21 Phase 8: record a LOCAL report (dm_reports). Nothing is sent. */
  reportDm: (input: ReportDmInput) => void;
  /**
   * Plan 21 Phase 8: shred (disappear) one or more of THIS device's own DM
   * messages. Builds an author-signed DM_SHRED, fans it to the conversation's
   * recipients, and deletes the local copies + cached blobs. Only messages this
   * device authored are shreddable.
   */
  queueDmShred: (conversationId: string, messageIds: string[]) => Promise<QueueDmShredResult>;
  /**
   * Owner side (Plan 19 FF3): approve a queued public-join request recorded by
   * runForegroundDrain (via recordPublicJoinRequests). Loads the queue row,
   * reconstructs this device's CURRENT owner-signed publication descriptor for
   * publicationId, and calls the @mylife/sync approvePublicJoinRequest engine
   * function (add member + park the epoch-key grant through the shared
   * invite-path rail). On ok:true the queue row flips to 'approved'; on
   * ok:false the row stays 'pending' so a transient failure (e.g. 'not_parked'
   * with no relay reachable) can be retried later. Never claims a join before
   * the engine reports ok:true.
   */
  approvePublicJoinRequestById: (
    publicationId: string,
    senderDeviceId: string,
  ) => Promise<ApprovePublicJoinRequestResult>;
  /**
   * Owner side (Plan 19 FF3): decline a queued public-join request. Row-only
   * (flips the queue row to 'declined'); no engine call, and the joiner is never
   * notified (a decline is silent locally, mirroring how a block is local-only).
   */
  declinePublicJoinRequestById: (publicationId: string, senderDeviceId: string) => void;
  /**
   * Owner side (Plan 28 P3): remove a member FOR REAL in one action -- signed
   * descriptor revision + fresh epoch wrapped only for survivors + per-survivor
   * mailbox fan-out + community-node republish. Owner-only (the engine refuses
   * an admin, AC-4). Result counts are honest: envelopesParked/nodesRepublished
   * report what actually happened; convergence is per-device as survivors
   * drain (epoch-boundary honest), never "removed instantly everywhere".
   */
  removeCommunityMemberById: (
    communityId: string,
    removedDeviceId: string,
  ) => Promise<RemoveCommunityMemberResult>;
  /**
   * Run the REAL mailbox drain in the foreground (channel-open / app-foreground)
   * so request/approve/restore advance when both users are active. Best-effort,
   * a no-op when no relay is configured. Never claims delivery it did not move.
   */
  runForegroundDrain: () => Promise<ForegroundDrainResult>;
  /**
   * Resolve an active paired device's pairing shared secret (hex), or null when
   * the device is unknown, inactive, or revoked. Plan 25 WP-25G: CallProvider
   * derives the pair-private call-signal tokens and frame keys from this, so a
   * call can only ever address a real trusted pairing.
   */
  resolvePairSecret: (deviceId: string) => string | null;
  /** Whether automatic dialing is opted in on this device (default off). */
  autoConnectEnabled: boolean;
  /**
   * Toggle automatic dialing (Plan 29). Opt-in only; NEVER flips background sync
   * (NC-4). When on, useAutoConnectTriggers fires autoConnectRound on app
   * foreground and when a paired peer is seen on the local network.
   */
  setAutoConnect: (enabled: boolean) => void;
  /** The last real composed round summary, or null when none has run. */
  lastAutoConnectRound: AutoConnectRoundSummary | null;
  lastAutoConnectError: string | null;
  /**
   * Run ONE shared foreground round: the mailbox drain, then the auto-connect
   * session sync over real recorded sessions (+ gossip once the engine seam
   * lands). Best-effort and honest: a success is a real completed session, a
   * failure a real failed session + backoff, never a fabricated dial or count.
   */
  autoConnectRound: (trigger: AutoConnectTrigger) => Promise<AutoConnectRoundOutcome>;
  myPairingJson: string;
  /** Pair with a payload pasted from the other device. Null = success. */
  pairWithJson: (json: string) => string | null;
  /**
   * Pair with a bundle a proximity ceremony already verified (Plan 53). Routes
   * through the SAME TOFU + pairing path as pasted codes and friend codes, so
   * an in-person add is byte-equivalent to the MKPAIR1 flow (AC-5). Null =
   * success; the "Already paired with that device." result is the benign
   * two-generals re-run, not a failure.
   */
  pairWithVerifiedBundle: (bundle: SignedIdentityBundle) => string | null;
  /**
   * Plan 53 P3: best-effort person announce to a newly added FRIEND, so they
   * render this person's linked devices as one person. Queues when offline;
   * never blocks or fails the pairing that already committed.
   */
  announcePersonToFriend: (peerDeviceId: string) => Promise<void>;
  /** Publish this device's signed identity under a fresh friend code (MK-016). */
  publishFriendCode: (relayUrl: string, onPublished?: (receipt: PublishRendezvousReceipt) => void) => Promise<string>;
  /** Resolve a friend's code from the relay and pair (TOFU). Null = success. */
  pairWithFriendCode: (relayUrl: string, code: string) => Promise<string | null>;
  /** The five-emoji SAS for a peer, derived from the pairing secret (MK-017). */
  getPeerSas: (peerDeviceId: string) => SasResult | null;
  /** Whether the user confirmed this peer's SAS match. */
  isPeerSasVerified: (peerDeviceId: string) => boolean;
  /** Record that the user confirmed this peer's five emoji matched. */
  confirmPeerSas: (peerDeviceId: string) => boolean;
  /** Whether a peer has been revoked (rejected at handshake from now on). */
  isPeerRevoked: (peerDeviceId: string) => boolean;
  /** Revoke a peer: sign + record locally so the handshake rejects it (MK-019). */
  revokePeer: (peerDeviceId: string, reason?: string) => void;
  pairedDevices: PairedDevice[];
  sessions: SyncSession[];
  /** Per-rung attempts/successes aggregated from real local sessions (MK-029). */
  rungStats: SyncRungStats[];
  /** Run one manual relay session. Throws on connection/session failure. */
  runRelaySession: (input: RunRelaySessionInput) => Promise<void>;
  /** Dial a peer's LAN listener and sync (MK-007). Throws with recovery guidance. */
  runLanSession: (input: RunLanSessionInput) => Promise<void>;
  /** Bound LAN listener port, or null when not listening. */
  lanPort: number | null;
  /** Start accepting inbound LAN sessions (and advertise + browse via mDNS). */
  startLanListening: (port: number) => Promise<number>;
  stopLanListening: () => Promise<void>;
  /** Peers found on this network via mDNS while listening. */
  discoveredPeers: DiscoveredPeer[];
  /**
   * Real availability of the native data-transport rungs (WebRTC / Nearby / BLE
   * wake) on THIS build, resolved through the engine's isRealBackend() gate. A
   * build without the native module reports the rung unavailable, so the UI
   * never presents a Simulated backend as a live rung (NC-11 / L8).
   */
  dataTransportAvailability: DataTransportAvailability;
  refresh: () => void;
}

/**
 * mk_settings key prefix for a PENDING join's invite link (P7). Stored on
 * queueJoinRequest so a still-pending join can re-park its request on later
 * drains (short mailbox TTL); deleted once this device lands in the descriptor.
 */
const PENDING_JOIN_LINK_PREFIX = 'pending_join_link:';

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * D.5: load this device's persistent rendezvous seal secret half, creating and
 * persisting one on first use. Hex-encoded in mk_settings; never transmitted to
 * the relay (only shared as part of the extended friend code).
 */
function loadOrCreateFriendCodeSecret(db: DatabaseAdapter): Uint8Array {
  const existing = getSetting(db, FRIEND_CODE_SECRET_KEY)?.trim();
  if (existing) {
    try {
      const bytes = hexToBytes(existing);
      if (bytes.length === 16) return bytes;
    } catch {
      // fall through and regenerate a valid secret half
    }
  }
  const secret = generateRendezvousSecretHalf();
  setSetting(db, FRIEND_CODE_SECRET_KEY, bytesToHex(secret));
  return secret;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}

export function SyncProvider({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const [ready, setReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [pad, setPad] = useState<PadRow | null>(null);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [sessions, setSessions] = useState<SyncSession[]>([]);
  const [rungStats, setRungStats] = useState<SyncRungStats[]>([]);
  const [lanPort, setLanPort] = useState<number | null>(null);
  const [discoveredPeers, setDiscoveredPeers] = useState<DiscoveredPeer[]>([]);
  const [autoConnectEnabled, setAutoConnectEnabledState] = useState(() => isAutoConnectEnabled(db));
  const [lastAutoConnectError, setLastAutoConnectError] = useState<string | null>(null);
  const [lastAutoConnectRound, setLastAutoConnectRound] = useState<AutoConnectRoundSummary | null>(
    () => getLastAutoConnectRound(db),
  );
  const lanListenerRef = useRef<LanListener | null>(null);
  const discoveryRef = useRef<LANDiscovery | null>(null);
  const blobStore = useMemo(() => new ExpoBlobStore(db), [db]);
  // Resolve a paired peer + its shared secret, applying the same revocation and
  // secret-store checks used by mailbox delivery and WebRTC signaling.
  const resolvePairedSecret = useCallback(
    (deviceId: string): { peer: PairedDevice; sharedSecretHex: string } | null => {
      if (isDeviceRevoked(db, deviceId)) return null;
      const peer = getPairedDevice(db, deviceId);
      if (!peer || !peer.isActive || !peer.dhPublicKey || !peer.sharedSecretRef) return null;
      const sharedSecretHex = getSharedSecretHex(peer.sharedSecretRef);
      if (!sharedSecretHex) return null;
      return { peer, sharedSecretHex };
    },
    [db],
  );
  const webRTCSignaling = useMemo(() => {
    // The signed sync-signal replay floor persists in call_signal_nonces
    // (shared with call signaling: both are random 48-hex nonces with expiry).
    ensureCallTables(db);
    return new WebRTCSyncSignaling({
      identity,
      transport: new CallSignalTransport({
        backend: createMeerkatRelayBackend(identity),
        relayUrl: () => effectiveRelayUrl(db),
      }),
      listPeers: () => getPairedDevices(db)
        .map((peer) => resolvePairedSecret(peer.deviceId))
        .filter((resolved): resolved is NonNullable<typeof resolved> => resolved !== null),
      resolvePeer: resolvePairedSecret,
      hasSeenNonce: (nonce) => hasSeenCallNonce(db, nonce),
      recordNonce: (nonce, expiresAtMs) => recordCallNonce(db, nonce, expiresAtMs),
      pruneNonces: (nowMs) => pruneCallNonces(db, nowMs),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, identity.publicKey, resolvePairedSecret]);
  // Resolve the real native transports ONCE. This runs the app's real
  // loadWebRTCBackend / loadNearbyBackend / loadBleBackend factories through the
  // engine's isRealBackend() gate, so an Expo Go / no-native-module build reports
  // every native rung unavailable instead of using a Simulated stand-in.
  const dataTransportAvailability = useMemo(
    () => getDataTransportAvailability({ externalWebRTCSignaling: webRTCSignaling.isAvailable() }),
    [webRTCSignaling],
  );

  const engine = useMemo(
    () =>
      new NativeSyncEngine({
        db,
        identity,
        modulePrefixes: MEERKAT_SYNC_PREFIXES,
        enabledModules: [MEERKAT_SYNC_MODULE_ID, COMMUNITY_MODULE_ID, MEERKAT_KEYS_MODULE_ID],
        modulePolicies: MEERKAT_SYNC_POLICIES,
        isOwnDevice: (peerId) => isMeerkatOwnSyncDevice(db, identity.publicKey, peerId),
        blobProvider: blobStore,
        // Plan 27/28 P4 (item 10, AM11): enable the session gossip phase so every
        // session (including the composed auto-connect foreground round) exchanges
        // signed revocations + community descriptors and reconciles the roster.
        // This is the "gossip" leg of the AM11 composed round; it converges a
        // revocation or member-removal issued anywhere across the mesh. A peer on
        // the same build also has it on; against a peer without it the gossip phase
        // is a bounded no-op (the session itself still completes).
        gossip: true,
        // AM5/15b: inject the app's REAL native data-transport factories (WebRTC /
        // Nearby / BLE) so the engine can dial + accept native P2P sessions. Each
        // factory lazy-requires its native module and returns null when absent
        // (Expo Go / no dev build), so the rung is simply unavailable there -- never
        // a fabricated dial. BLE stays wake-only and never carries data.
        dataTransportFactories,
        webRTCSignaling,
      }),
    // Rebuild only when the device identity itself changes (identity reset).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, identity.publicKey, blobStore, webRTCSignaling],
  );

  const refresh = useCallback(() => {
    setPad(getPadRow(db));
    setPairedDevices(getPairedDevices(db));
    setSessions(getRecentSyncSessions(db, 20));
    setRungStats(getTransportRungStats(db));
    webRTCSignaling.refreshPeerListeners();
  }, [db, webRTCSignaling]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setInitError(null);
    ensureSyncSchema(db);
    // Plan 52: device-local person-identity ceremony state (mk_ prefix: the
    // pending-proposal and announce-outbox tables never replicate).
    ensurePersonIdentityTables(db);
    // Plan 38 personal-first: the Meerkat node boots its own app identity and
    // never ran ensureSyncBootstrap, so create the auto personal workspace here
    // (idempotent). Without it the "My Library" hub reads a null workspace and
    // "New library" is a silent no-op. Web mirrors this in MeerkatProvider boot.
    ensurePersonalWorkspace(db, identity);
    // D.3 one-time local reconciliation: rewrite any legacy file report rows to the
    // canonical `${channelId}:${attachmentId}` target id so files reported before the
    // canonical helper existed stay hidden. Idempotent + a no-op once canonical.
    try {
      reconcileCommunityFileReportTargets(db);
    } catch {
      // cm_safety_actions may not exist yet on a brand-new install; harmless no-op.
    }
    if (!enabled) {
      refresh();
      return () => {
        cancelled = true;
        void engine.destroy();
      };
    }
    void engine.initialize().then(() => {
      if (cancelled) return;
      // Seed the LWW document with the current pad so the first outbound
      // session carries existing state (the document is in-memory only).
      const existing = getPadRow(db);
      if (existing) {
        engine.getDocumentManager().applyChange(MEERKAT_SYNC_MODULE_ID, {
          table: PAD_TABLE,
          rowId: PAD_ROW_ID,
          operation: 'INSERT',
          data: { ...existing },
        });
      }
      refresh();
      setReady(true);
    }).catch((error: unknown) => {
      // Audit 2026-09-01 A1: an initialize() rejection used to be unhandled, so
      // the app sat on "Starting engine..." forever with no cause. Record it.
      if (cancelled) return;
      setInitError(error instanceof Error ? error.message : String(error));
    });
    return () => {
      cancelled = true;
      discoveryRef.current?.destroy();
      discoveryRef.current = null;
      void lanListenerRef.current?.close();
      lanListenerRef.current = null;
      setLanPort(null);
      void engine.destroy();
    };
  }, [engine, db, enabled, refresh, identity]);

  const status = useSyncExternalStore(
    engine.getStatusStore().getSubscribe(),
    engine.getStatusStore().getSnapshot(),
  );

  const savePad = useCallback(
    (body: string) => {
      const existed = getPadRow(db) !== null;
      const row = savePadRow(db, body);
      engine.recordChange(PAD_TABLE, existed ? 'UPDATE' : 'INSERT', PAD_ROW_ID, { ...row });
      setPad(row);
    },
    [db, engine],
  );

  const recordLocalChange = useCallback(
    (
      table: string,
      operation: 'INSERT' | 'UPDATE' | 'DELETE',
      rowId: string,
      data: Record<string, unknown> | null,
    ): void => {
      engine.recordChange(table, operation, rowId, data);
    },
    [engine],
  );

  /**
   * Plan 52 P3: the join door's name. Records the per-community override on
   * the presentation profile (so every linked device adopts it) and runs
   * alignment, which signs THIS device's CommunityProfileEvent to match.
   * Alignment is idempotent, so a re-join is a cheap no-op.
   */
  const applyJoinDisplayName = useCallback(
    (communityId: string, joinName: string): void => {
      setPresentationOverride(db, communityId, joinName, (table, operation, rowId, data) =>
        engine.recordChange(table, operation, rowId, data),
      );
      alignPersonIdentity(db, identity, (table, operation, rowId, data) =>
        engine.recordChange(table, operation, rowId, data),
      );
      refresh();
    },
    [db, engine, identity, refresh],
  );

  const personLinks = useCallback(
    (communityId: string): Map<string, string> => {
      const map = new Map<string, string>();
      for (const row of readPersonLinks(db, communityId)) {
        map.set(row.device_id, row.derived_group_id);
      }
      return map;
    },
    [db],
  );

  const setCommunityPresentation = useCallback(
    (
      communityId: string,
      displayName: string | null,
      appearance: {
        avatarInitial?: string | null;
        avatarImage?: string | null;
        bio?: string | null;
        pronouns?: string | null;
        nameColor?: ProfileNameColorToken | null;
      },
    ): SetCommunityProfileResult => {
      const stored = getCommunity(db, communityId);
      if (!stored) return { ok: false, error: 'Community not found on this device.' };
      if (communityRole(stored.descriptor, identity.publicKey) === null) {
        return { ok: false, error: 'Join the community before setting a community name.' };
      }
      try {
        const record = (
          table: string,
          operation: 'INSERT' | 'UPDATE' | 'DELETE',
          rowId: string,
          data: Record<string, unknown> | null,
        ) => engine.recordChange(table, operation, rowId, data);
        setPresentationOverride(db, communityId, displayName, record, appearance);
        alignPersonIdentity(db, identity, record);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not save community profile.' };
      }
    },
    [db, engine, identity, refresh],
  );

  // Plan 52 round-3 INFO: this used to write a CommunityProfileEvent DIRECTLY,
  // bypassing the presentation profile. Since alignPersonIdentity is now the
  // single writer of those events, such a write would be reverted on the next
  // alignment pass -- a footgun for any future caller. It now delegates to the
  // presentation rail, so both entry points have one behaviour and one writer.
  const setCommunityProfile = useCallback(
    (
      communityId: string,
      displayName: string,
      avatarInitial?: string | null,
      avatarImage?: string | null,
    ): SetCommunityProfileResult => setCommunityPresentation(communityId, displayName, {
      ...(avatarInitial === undefined ? {} : { avatarInitial }),
      ...(avatarImage === undefined ? {} : { avatarImage }),
    }),
    [setCommunityPresentation],
  );

  // Owner-only (Plan 38): publish the signed community identity + record the change
  // for replication (same rail as setCommunityProfile). The data layer refuses a
  // non-owner, so the error surfaces honestly instead of a silent no-op.
  const setCommunityAppearance = useCallback(
    (communityId: string, fields: PublishCommunityIdentityFields): SetCommunityAppearanceResult => {
      try {
        publishCommunityIdentityRow(db, identity, communityId, fields, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data));
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not save community appearance.' };
      }
    },
    [db, identity, engine, refresh],
  );

  const clearCommunityAppearance = useCallback(
    (communityId: string): SetCommunityAppearanceResult => {
      try {
        tombstoneCommunityIdentityRow(db, identity, communityId, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data));
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not clear community appearance.' };
      }
    },
    [db, identity, engine, refresh],
  );

  // Owner-only (composition Phase 1): publish/clear the signed composition
  // document on the same rail as the identity events.
  const setCommunityLayout = useCallback(
    (communityId: string, layoutBlob: string): SetCommunityAppearanceResult => {
      try {
        publishCommunityLayoutRow(db, identity, communityId, layoutBlob, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data));
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not save the community layout.' };
      }
    },
    [db, identity, engine, refresh],
  );

  const clearCommunityLayout = useCallback(
    (communityId: string): SetCommunityAppearanceResult => {
      try {
        tombstoneCommunityLayoutRow(db, identity, communityId, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data));
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not reset the community layout.' };
      }
    },
    [db, identity, engine, refresh],
  );

  // Owner-only (Plan 38 Phase 2, the W2 fix). The mobile app previously had NO
  // channel-creation path: SyncProvider exposed no descriptor-revision method and
  // no screen reached reviseCommunity, so an owner could never add a channel after
  // creation (only the two defaults baked in at createCommunity existed). This is
  // that missing trace. It folds the whole draft into ONE CommunityRevisionChanges
  // (one-revision-per-save, never per drag) and upserts the new signed revision
  // locally. Like every other owner revision, members converge when they receive
  // the updated descriptor (a fresh invite re-join, upsertCommunity replacing on
  // the higher revision); this writes locally only and never claims a live push.
  const saveCommunityOrganization = useCallback(
    (communityId: string, draft: OrganizationDraft): SaveCommunityOrganizationResult => {
      const stored = getCommunity(db, communityId);
      if (!stored) return { ok: false, error: 'Community not found on this device.' };
      if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
        return { ok: false, error: 'Only the community owner can organize channels.' };
      }
      try {
        const revised = reviseCommunity(
          identity,
          { descriptor: stored.descriptor, signature: stored.signature },
          buildOrganizationChanges(draft),
        );
        upsertCommunity(db, revised, identity.publicKey);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not save channel organization.' };
      }
    },
    [db, identity, refresh],
  );

  // Owner-only (Plan 27 P4): set the transport policy as ONE signed revisePolicy
  // revision + store locally. Mirrors saveCommunityOrganization's owner gate and
  // honest-error discipline; members converge on the newer descriptor, never a push.
  const setCommunityTransportPolicy = useCallback(
    (communityId: string, policy: CommunityTransportPolicy): SaveCommunityOrganizationResult => {
      const stored = getCommunity(db, communityId);
      if (!stored) return { ok: false, error: 'Community not found on this device.' };
      if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
        return { ok: false, error: 'Only the community owner can change the sync policy.' };
      }
      try {
        const revised = revisePolicy(
          identity,
          { descriptor: stored.descriptor, signature: stored.signature },
          policy,
        );
        upsertCommunity(db, revised, identity.publicKey);
        // Record the owner's own change into the observed ledger so the notice +
        // history reflect it immediately (idempotent per revision).
        reconcileCommunityPolicyHistory(db);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not save the sync policy.' };
      }
    },
    [db, identity, refresh],
  );

  const queueChannelMessageMailbox = useCallback(
    async (event: ChannelMessageEvent): Promise<QueueChannelMessageMailboxResult> => {
      // Plan 57 W3: best-effort mirror to the community's attached server so
      // the event lands in the always-on live tail (and, for owners, refresh
      // the rolling snapshots at most once per interval). Fire-and-forget: the
      // local record + mailbox path never wait on (or fake) the host, and a
      // community with no host is a cheap no-op.
      mirrorEventToCommunityHost(db, identity, event);
      const relayUrl = await ensureEffectiveRelayUrl(db);
      const activeMemberIds = new Set(
        db.query<{ device_id: string }>(
          `SELECT device_id
           FROM sync_workspace_members
           WHERE workspace_id = ? AND removed_at IS NULL`,
          [event.communityId],
        ).map((row) => row.device_id),
      );
      const peers = getPairedDevices(db).filter((peer) => (
        peer.isActive
        && peer.deviceId !== identity.publicKey
        && activeMemberIds.has(peer.deviceId)
        && !isDeviceRevoked(db, peer.deviceId)
      ));
      if (!relayUrl?.startsWith('ws')) {
        return { attempted: 0, queued: 0, skipped: peers.length, failed: 0 };
      }

      const result: QueueChannelMessageMailboxResult = {
        attempted: 0,
        queued: 0,
        skipped: 0,
        failed: 0,
      };
      for (const peer of peers) {
        const sharedSecretHex = peer.sharedSecretRef ? getSharedSecretHex(peer.sharedSecretRef) : null;
        if (!peer.dhPublicKey || !sharedSecretHex) {
          result.skipped += 1;
          continue;
        }

        const sealed = sealChannelMessageMailboxDelta({
          sender: identity,
          recipient: { deviceId: peer.deviceId, dhPublicKey: peer.dhPublicKey },
          pairSharedSecretHex: sharedSecretHex,
          communityId: event.communityId,
          channelId: event.channelId,
          events: [event],
        });
        if (!sealed.ok) {
          result.skipped += 1;
          continue;
        }

        result.attempted += 1;
        const backend = createMeerkatRelayBackend(identity);
        try {
          const session = await backend.connect(relayUrl, sealed.token);
          try {
            await session.send(encodeMailboxEnvelope(sealed.envelope));
            result.queued += 1;
          } finally {
            await session.close();
          }
        } catch {
          result.failed += 1;
        } finally {
          backend.destroy();
        }
      }
      return result;
    },
    [db, identity],
  );

  // Files Phase 3: is a device a current, non-removed member of a community?
  // Reuses the EXACT gate queueChannelMessageMailbox uses (removed_at IS NULL),
  // via the shared helper so the foreground + background paths agree.
  const isActiveMember = useCallback(
    (communityId: string, deviceId: string): boolean =>
      isActiveCommunityMember(db, communityId, deviceId),
    [db],
  );

  // Requester side: seal + park a FILE_REQUEST to the message author, then write
  // the outgoing cm_file_requests row ONLY on a real park (queued > 0). Authority:
  // the owner is event.authorDeviceId from the requester's verified local event.
  // Fields-based core so BOTH the in-channel AttachmentCard (which has the full
  // signed event + attachment) and the Files index (which has only the aggregated
  // row primitives) can drive the SAME live request/park path (D.1). No fabricated
  // event object; the honest gates and honest-row-on-real-park discipline are shared.
  const queueFileRequestByFields = useCallback(
    async (input: {
      communityId: string;
      channelId: string;
      messageId: string;
      attachmentId: string;
      blobHash: string;
      ownerDeviceId: string;
    }): Promise<QueueFileRequestResult> => {
      const ownerDeviceId = input.ownerDeviceId;
      if (ownerDeviceId === identity.publicKey) {
        // You authored this file; "request from the owner" is meaningless.
        return { ok: false, reason: 'self_author' };
      }
      if (isDeviceRevoked(db, ownerDeviceId)) return { ok: false, reason: 'revoked' };

      const relayUrl = await ensureEffectiveRelayUrl(db);
      const resolved = resolvePairedSecret(ownerDeviceId);
      if (!resolved) return { ok: false, reason: 'not_paired' };
      if (!relayUrl?.startsWith('ws')) return { ok: false, reason: 'no_relay' };

      const base = {
        communityId: input.communityId,
        channelId: input.channelId,
        messageId: input.messageId,
        attachmentId: input.attachmentId,
        blobHash: input.blobHash,
      };
      const fields: FileRequestFields = { ...base, requestId: fileRequestId(base, identity.publicKey) };

      const sealed = sealFileRequestMailbox({
        sender: identity,
        recipient: { deviceId: resolved.peer.deviceId, dhPublicKey: resolved.peer.dhPublicKey },
        pairSharedSecretHex: resolved.sharedSecretHex,
        fields,
      });

      const backend = createMeerkatRelayBackend(identity);
      let parked = false;
      try {
        const session = await backend.connect(relayUrl, sealed.token);
        try {
          await session.send(encodeMailboxEnvelope(sealed.envelope));
          parked = true;
        } finally {
          await session.close();
        }
      } catch {
        parked = false;
      } finally {
        backend.destroy();
      }

      if (!parked) return { ok: false, reason: 'park_failed' };

      // Honest pending state: the row is written ONLY after a real park.
      upsertFileRequest(db, {
        id: fields.requestId,
        communityId: fields.communityId,
        channelId: fields.channelId,
        messageId: fields.messageId,
        attachmentId: fields.attachmentId,
        blobHash: fields.blobHash,
        direction: 'outgoing',
        counterpartyDeviceId: ownerDeviceId,
        status: 'requested',
      });
      refresh();
      return { ok: true, requestId: fields.requestId, ownerDeviceId };
    },
    [db, identity, refresh, resolvePairedSecret],
  );

  const queueFileRequest = useCallback(
    (
      event: ChannelMessageEvent,
      attachment: ChannelMessageAttachment,
    ): Promise<QueueFileRequestResult> =>
      queueFileRequestByFields({
        communityId: event.communityId,
        channelId: event.channelId,
        messageId: event.id,
        attachmentId: attachment.id,
        blobHash: attachment.blobHash,
        ownerDeviceId: event.authorDeviceId,
      }),
    [queueFileRequestByFields],
  );

  // Owner side: approve or decline an incoming request. On approve, re-read the
  // local bytes, re-verify the hash (buildFileGrant), and park the grant; on
  // decline park a decline grant. Re-checks the requester is still a member and
  // not revoked before any token is derived. Manual only: no silent auto-send.
  const queueFileGrant = useCallback(
    async (requestId: string, decision: 'approve' | 'decline'): Promise<QueueFileGrantResult> => {
      const row = getFileRequest(db, requestId);
      if (!row) return { ok: false, reason: 'not_found' };
      if (row.direction !== 'incoming') return { ok: false, reason: 'not_incoming' };

      const requesterDeviceId = row.counterparty_device_id;
      if (isDeviceRevoked(db, requesterDeviceId)) return { ok: false, reason: 'revoked' };
      if (!isActiveMember(row.community_id, requesterDeviceId)) {
        setFileRequestStatus(db, requestId, 'declined', 'Requester is no longer a member.');
        refresh();
        return { ok: false, reason: 'not_a_member' };
      }

      const relayUrl = await ensureEffectiveRelayUrl(db);
      const resolved = resolvePairedSecret(requesterDeviceId);
      if (!resolved) return { ok: false, reason: 'not_paired' };
      if (!relayUrl?.startsWith('ws')) return { ok: false, reason: 'no_relay' };

      const request: FileRequestFields = {
        communityId: row.community_id,
        channelId: row.channel_id,
        messageId: row.message_id,
        attachmentId: row.attachment_id,
        blobHash: row.blob_hash,
        requestId: row.id,
      };
      const recipient = { deviceId: resolved.peer.deviceId, dhPublicKey: resolved.peer.dhPublicKey };

      let sealed;
      if (decision === 'approve') {
        sealed = await buildFileGrant({
          owner: identity,
          recipient,
          pairSharedSecretHex: resolved.sharedSecretHex,
          request,
          moduleId: COMMUNITY_MODULE_ID,
          getBlobBytes: (hash) => blobStore.get(hash),
        });
        if (sealed.payload.decision === 'decline') {
          // The owner no longer holds the bytes: surface the honest reason and
          // still park the decline so the requester is not left waiting forever.
          const backend = createMeerkatRelayBackend(identity);
          let parked = false;
          try {
            const session = await backend.connect(relayUrl, sealed.token);
            try { await session.send(encodeMailboxEnvelope(sealed.envelope)); parked = true; }
            finally { await session.close(); }
          } catch { parked = false; } finally { backend.destroy(); }
          if (!parked) return { ok: false, reason: 'park_failed' };
          setFileRequestStatus(db, requestId, 'declined', 'You no longer have this file on this device.');
          refresh();
          return { ok: false, reason: 'owner_no_longer_has_file' };
        }
      } else {
        sealed = buildFileDecline({
          owner: identity,
          recipient,
          pairSharedSecretHex: resolved.sharedSecretHex,
          request,
        });
      }

      const backend = createMeerkatRelayBackend(identity);
      let parked = false;
      try {
        const session = await backend.connect(relayUrl, sealed.token);
        try { await session.send(encodeMailboxEnvelope(sealed.envelope)); parked = true; }
        finally { await session.close(); }
      } catch { parked = false; } finally { backend.destroy(); }

      if (!parked) return { ok: false, reason: 'park_failed' };

      setFileRequestStatus(
        db,
        requestId,
        decision === 'approve' ? 'approved' : 'declined',
        decision === 'approve' ? null : 'You declined this request.',
      );
      refresh();
      return { ok: true, decision };
    },
    [db, identity, blobStore, isActiveMember, refresh, resolvePairedSecret],
  );

  // Requester side (P3): seal + park a HISTORY_REQUEST to a paired peer member,
  // asking it to serve every channel event after THIS device's feed cursor. The
  // peer re-verifies + role-gates each event before serving; this device re-
  // verifies + merges on apply. Returns ok ONLY after a real park. Cloned from
  // queueFileRequest (same gates, same honest-row-on-real-park discipline).
  const queueHistoryRequest = useCallback(
    async (
      peerDeviceId: string,
      communityId: string,
      channelId: string,
    ): Promise<QueueHistoryRequestResult> => {
      if (peerDeviceId === identity.publicKey) return { ok: false, reason: 'self_peer' };
      if (isDeviceRevoked(db, peerDeviceId)) return { ok: false, reason: 'revoked' };
      // The peer must be an active member of this community (it can only serve a
      // feed it is entitled to read; non-members are dropped serve-side anyway).
      if (!isActiveMember(communityId, peerDeviceId)) return { ok: false, reason: 'not_a_member' };

      const relayUrl = await ensureEffectiveRelayUrl(db);
      const resolved = resolvePairedSecret(peerDeviceId);
      if (!resolved) return { ok: false, reason: 'not_paired' };
      if (!relayUrl?.startsWith('ws')) return { ok: false, reason: 'no_relay' };

      const cursor = getFeedCursor(db, communityId, channelId);
      const fields: HistoryRequestFields = {
        communityId,
        channelId,
        sinceWall: cursor?.wall ?? null,
        sinceCounter: cursor?.counter ?? null,
        requestId: '',
      };
      fields.requestId = historyRequestId(
        {
          communityId,
          channelId,
          sinceWall: fields.sinceWall,
          sinceCounter: fields.sinceCounter,
        },
        identity.publicKey,
      );

      const sealed = sealHistoryRequestMailbox({
        sender: identity,
        recipient: { deviceId: resolved.peer.deviceId, dhPublicKey: resolved.peer.dhPublicKey },
        pairSharedSecretHex: resolved.sharedSecretHex,
        fields,
      });

      const backend = createMeerkatRelayBackend(identity);
      let parked = false;
      try {
        const session = await backend.connect(relayUrl, sealed.token);
        try {
          await session.send(encodeMailboxEnvelope(sealed.envelope));
          parked = true;
        } finally {
          await session.close();
        }
      } catch {
        parked = false;
      } finally {
        backend.destroy();
      }

      if (!parked) return { ok: false, reason: 'park_failed' };
      return { ok: true, requestId: fields.requestId, peerDeviceId };
    },
    [db, identity, isActiveMember, resolvePairedSecret],
  );

  // Park an already-sealed envelope on a mailbox token (the relay store-and-
  // forward). Used by the SERVE side of history backfill so a peer's grant is
  // parked for the requester. A grant is parked ONLY when this really succeeds.
  const parkEnvelopeOnRelay = useCallback(
    async (token: string, envelope: MailboxEnvelope): Promise<boolean> => {
      const relayUrl = await ensureEffectiveRelayUrl(db);
      if (!relayUrl?.startsWith('ws')) return false;
      const backend = createMeerkatRelayBackend(identity);
      try {
        const session = await backend.connect(relayUrl, token);
        try {
          await session.send(encodeMailboxEnvelope(envelope));
          return true;
        } finally {
          await session.close();
        }
      } catch {
        return false;
      } finally {
        backend.destroy();
      }
    },
    [db, identity],
  );

  // Joiner side (P7): seal + park a join-request for the community OWNER, derived
  // from the invite link's descriptor (genesisNonce + owner device id). The
  // request carries this device's signed bundle + the signed invite; the owner
  // re-verifies both, adds this device, mints an epoch, and parks a join-grant on
  // this device's join token. A request is parked ONLY on a real relay park, and
  // skipped when this device is already a member (the gap is already closed).
  const queueJoinRequest = useCallback(
    async (link: string): Promise<QueueJoinRequestResult> => {
      const parsed: ParsedInviteLink | null = parseCommunityInviteLink(link);
      if (!parsed) return { ok: false, reason: 'malformed_link' };
      const descriptor = parsed.descriptor.descriptor;

      // Already a member of the stored descriptor? The handoff is already done.
      const stored = getCommunity(db, descriptor.communityId);
      if (stored && communityRole(stored.descriptor, identity.publicKey) !== null) {
        return { ok: false, reason: 'already_member' };
      }

      // Plan 27 P3: a proximity-gated community's join handoff must NEVER ride the
      // relay -- the transport policy covers the handoff (AC-4). If the signed
      // policy forbids the relay transport, refuse the relay park with an honest
      // reason; the local handoff (runLocalJoinAsJoiner over LAN/Nearby) is the
      // only path in. This gate reads the SIGNED invite descriptor (restrictive on
      // an unknown value) so a tampered/absent policy fails closed.
      if (!transportPolicyAllows(communityTransportPolicy(descriptor), 'wan_relay')) {
        return { ok: false, reason: 'needs_local' };
      }

      const built = buildJoinRequest(identity, parsed);
      if (!built) return { ok: false, reason: 'no_owner_dh' };

      // Retain intent before the first network attempt, including failed/offline parks.
      setSetting(db, `${PENDING_JOIN_LINK_PREFIX}${descriptor.communityId}`, link);

      // Plan 57 W4: park on the community's OWN server first (the invite's
      // descriptor carries it) -- durable for days, restart-safe, owner asleep
      // is fine. The relay park stays as the second, TTL-bound rail.
      const hostParked = await parkJoinRequestOnInviteHost(parsed.descriptor, built.token, built.envelope)
        .catch(() => false);

      const relayUrl = await ensureEffectiveRelayUrl(db);
      let relayParked = false;
      if (relayUrl?.startsWith('ws')) {
        relayParked = await parkEnvelopeOnRelay(built.token, built.envelope);
      }
      if (!hostParked && !relayParked) {
        return { ok: false, reason: relayUrl?.startsWith('ws') ? 'park_failed' : 'no_relay' };
      }
      return { ok: true, communityId: descriptor.communityId, ownerDeviceId: descriptor.ownerDeviceId };
    },
    [db, identity, parkEnvelopeOnRelay],
  );

  // Re-park a fresh join-request for every community that is still PENDING (the
  // descriptor is stored but I am not yet listed) and whose join link we kept.
  // The owner is idempotent (stable request id; re-package + re-park, no re-mint),
  // so re-queueing until confirmed is safe. Drops the stored link once I land in
  // the descriptor (the handoff is complete).
  const requeuePendingJoinRequests = useCallback(async (): Promise<void> => {
    const relayUrl = await ensureEffectiveRelayUrl(db);
    const relayUsable = !!relayUrl?.startsWith('ws');
    for (const community of listCommunities(db)) {
      const d = community.descriptor;
      const key = `${PENDING_JOIN_LINK_PREFIX}${d.communityId}`;
      const link = getSetting(db, key);
      if (!link) continue;
      if (communityRole(d, identity.publicKey) !== null) {
        // No longer pending: the handoff landed. Stop re-parking.
        deleteSetting(db, key);
        continue;
      }
      const parsed = parseCommunityInviteLink(link);
      if (!parsed) {
        deleteSetting(db, key);
        continue;
      }
      // Plan 27 P3: never re-park a proximity-gated community's join on the relay
      // (nor its WAN community server; parkJoinRequestOnInviteHost gates too).
      if (!transportPolicyAllows(communityTransportPolicy(parsed.descriptor.descriptor), 'wan_relay')) {
        continue;
      }
      const built = buildJoinRequest(identity, parsed);
      if (!built) continue;
      // Plan 57 W4: the durable host box first, then the TTL-bound relay rail.
      await parkJoinRequestOnInviteHost(parsed.descriptor, built.token, built.envelope).catch(() => false);
      if (relayUsable) await parkEnvelopeOnRelay(built.token, built.envelope);
    }
  }, [db, identity, parkEnvelopeOnRelay]);

  // Resolve a peer's DH key + shared secret for the serve side. Null when not a
  // usable pairing, so the serve side cannot address a revoked/unpaired peer.
  const resolvePeerForServe = useCallback(
    (deviceId: string): { dhPublicKey: string; sharedSecretHex: string } | null => {
      const resolved = resolvePairedSecret(deviceId);
      if (!resolved) return null;
      return { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex };
    },
    [resolvePairedSecret],
  );

  // Resolve a device's pairing shared secret only (the DM core does not need
  // the full PairedDevice row, just the hex secret it seals with).
  const resolvePairSecret = useCallback(
    (deviceId: string): string | null => resolvePairedSecret(deviceId)?.sharedSecretHex ?? null,
    [resolvePairedSecret],
  );

  // Resolve a paired device's DH public key only (bootstraps a new dm_
  // participant row on an inbound message from a device not yet listed).
  const resolvePeerDhKey = useCallback(
    (deviceId: string): string | null => resolvePeerForServe(deviceId)?.dhPublicKey ?? null,
    [resolvePeerForServe],
  );

  // Plan 21 Phase 4: build + locally echo a signed DM event, then seal + park
  // it to every peer participant device and (separately) to this user's own
  // other linked devices. Mirrors queueChannelMessageMailbox's seal-then-park
  // discipline: a device's dm_delivery only reads 'parked' after a real park.
  const queueDmMessage = useCallback(
    async (
      conversationId: string,
      body: string,
      attachments?: DmMessageAttachment[],
    ): Promise<QueueDmMessageResult> => {
      // Resolve each attachment's cached bytes from the blob store and split them
      // into wire blocks so the recipient can verify-then-pin. A missing blob just
      // sends the metadata (the recipient pulls it via a file re-request later).
      const blocks = [];
      for (const attachment of attachments ?? []) {
        const bytes = await blobStore.get(attachment.blobHash);
        if (!bytes) continue;
        blocks.push(...splitBlobForTransfer(bytes, attachment.blobHash, 'dm', attachment.mimeType));
      }
      return queueDmMessageCore({
        db,
        identity,
        conversationId,
        body,
        attachments,
        blocks: blocks.length > 0 ? blocks : undefined,
        relayAvailable: (await ensureEffectiveRelayUrl(db)).startsWith('ws'),
        resolvePairSecret,
        parkEnvelope: parkEnvelopeOnRelay,
      });
    },
    [db, identity, resolvePairSecret, parkEnvelopeOnRelay, blobStore],
  );

  // Plan 21 Phase 4: seal + park a delivery/read receipt for a message to its
  // author device, plus mirror it to this user's own other devices. Honors
  // the conversation's read_receipts_enabled for 'read' receipts.
  const queueDmReceipt = useCallback(
    async (
      conversationId: string,
      messageId: string,
      state: DmReceiptState,
    ): Promise<QueueDmReceiptResult> => queueDmReceiptCore({
      db,
      identity,
      conversationId,
      messageId,
      state,
      relayAvailable: (await ensureEffectiveRelayUrl(db)).startsWith('ws'),
      resolvePairSecret,
      parkEnvelope: parkEnvelopeOnRelay,
    }),
    [db, identity, resolvePairSecret, parkEnvelopeOnRelay],
  );

  // Plan 21 Phase 4: record another device of THIS user as a DM mirror target.
  const hasPendingPersonProposal = useCallback(
    (): boolean => listPendingPersonProposals(db).length > 0,
    [db],
  );

  const cancelPendingPersonProposals = useCallback((): void => {
    for (const row of listPendingPersonProposals(db)) cancelPersonProposal(db, row.id);
    refresh();
  }, [db, refresh]);

  const unlinkOwnDeviceFromPerson = useCallback(
    async (deviceId: string): Promise<ProposePersonGroupResult> => {
      const result = await removeDevicesFromPerson({
        db,
        identity,
        listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
        listDmPeerIds: () => getPairedDevices(db)
          .filter((peer) => peer.isActive)
          .map((peer) => peer.deviceId),
        resolvePairedDevice: (id: string) => {
          const resolved = resolvePairedSecret(id);
          return resolved
            ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
            : null;
        },
        parkEnvelope: parkEnvelopeOnRelay,
        recordChange: (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string, data: Record<string, unknown> | null) =>
          engine.recordChange(table, op, rowId, data),
        revokeOwnDeviceLink: (id: string) => removeDmOwnDevice(db, id),
      }, [deviceId]);
      refresh();
      return result;
    },
    [db, identity, engine, refresh, resolvePairedSecret, parkEnvelopeOnRelay],
  );

  // Round-3 HIGH-1: the user-facing escape from an irreconcilable person group.
  const pendingPersonRemovals = useCallback(
    (): InboundPersonProposal[] => listInboundPersonApprovals(db, identity.publicKey),
    [db, identity.publicKey],
  );

  const approvePersonRemoval = useCallback(async (id: string): Promise<boolean> => {
    const ok = await approveInboundPersonProposal({
      db,
      identity,
      listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
      listDmPeerIds: () => getPairedDevices(db)
        .filter((peer) => peer.isActive)
        .map((peer) => peer.deviceId),
      resolvePairedDevice: (peerId: string) => {
        const resolved = resolvePairedSecret(peerId);
        return resolved
          ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
          : null;
      },
      parkEnvelope: parkEnvelopeOnRelay,
      recordChange: (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string, data: Record<string, unknown> | null) =>
        engine.recordChange(table, op, rowId, data),
    }, id);
    refresh();
    return ok;
  }, [db, identity, engine, refresh, resolvePairedSecret, parkEnvelopeOnRelay]);

  const declinePersonRemoval = useCallback((id: string): void => {
    declineInboundPersonProposal(db, id);
    refresh();
  }, [db, refresh]);

  const rebuildOwnPersonGroup = useCallback((): void => {
    resetPersonGroup(db, (table, op, rowId, data) => engine.recordChange(table, op, rowId, data));
    refresh();
  }, [db, engine, refresh]);

  const linkOwnDevice = useCallback(
    (input: { deviceId: string; identityAnchor: string; dhPublicKey: string }): void => {
      linkOwnDeviceCore(db, input);
      refresh();
    },
    [db, refresh],
  );

  const linkOwnDeviceAsPerson = useCallback(
    async (input: {
      deviceId: string;
      identityAnchor: string;
      dhPublicKey: string;
      label: string;
    }): Promise<ProposePersonGroupResult> => {
      linkOwnDeviceCore(db, {
        deviceId: input.deviceId,
        identityAnchor: input.identityAnchor,
        dhPublicKey: input.dhPublicKey,
      });
      const stored = readPersonGroup(db, identity.publicKey);
      const ceremonyDeps = {
        db,
        identity,
        listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
        listDmPeerIds: () => getPairedDevices(db)
          .filter((peer) => peer.isActive)
          .map((peer) => peer.deviceId),
        resolvePairedDevice: (deviceId: string) => {
          const resolved = resolvePairedSecret(deviceId);
          return resolved
            ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
            : null;
        },
        parkEnvelope: parkEnvelopeOnRelay,
        recordChange: (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string, data: Record<string, unknown> | null) =>
          engine.recordChange(table, op, rowId, data),
      };
      // A first link forms the genesis group (this device + the new one); a
      // later link adds to the existing group.
      const add = stored
        ? [{ deviceId: input.deviceId, label: input.label }]
        : [
            { deviceId: identity.publicKey, label: getIdentityRow(db)?.display_name ?? 'This device' },
            { deviceId: input.deviceId, label: input.label },
          ];
      const result = await proposePersonGroupRevision(ceremonyDeps, { add });
      refresh();
      return result;
    },
    [db, identity, engine, refresh, resolvePairedSecret, parkEnvelopeOnRelay],
  );

  // Plan 53 P3: after an in-person add commits, announce this person to the
  // new FRIEND so they render the person (all linked devices collapsed)
  // rather than a bare device. Best-effort and honest: no person group or no
  // reachable relay leaves the announce queued (the foreground drain parks it
  // later); it never blocks or fails the pairing that already committed.
  const announcePersonToFriend = useCallback(
    async (peerDeviceId: string): Promise<void> => {
      await announcePersonToDmPeer({
        db,
        identity,
        listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
        listDmPeerIds: () => getPairedDevices(db)
          .filter((peer) => peer.isActive)
          .map((peer) => peer.deviceId),
        resolvePairedDevice: (deviceId: string) => {
          const resolved = resolvePairedSecret(deviceId);
          return resolved
            ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
            : null;
        },
        parkEnvelope: parkEnvelopeOnRelay,
        recordChange: (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string, data: Record<string, unknown> | null) =>
          engine.recordChange(table, op, rowId, data),
      }, peerDeviceId);
      refresh();
    },
    [db, identity, engine, refresh, resolvePairedSecret, parkEnvelopeOnRelay],
  );

  // Plan 21 Phase 7: create a group DM (this device is the admin) + hand off epoch 1.
  const createDmGroup = useCallback(
    async (title: string, members: DmGroupMember[]): Promise<CreateDmGroupCoreResult> => {
      const result = await createDmGroupCore({
        db,
        identity,
        title,
        members,
        relayAvailable: (await ensureEffectiveRelayUrl(db)).startsWith('ws'),
        resolvePairSecret,
        parkEnvelope: parkEnvelopeOnRelay,
      });
      refresh();
      return result;
    },
    [db, identity, resolvePairSecret, parkEnvelopeOnRelay, refresh],
  );

  // Plan 21 Phase 7: add a member to a group DM (admin-only).
  const dmGroupAddMember = useCallback(
    async (conversationId: string, added: DmGroupMember): Promise<DmGroupMutationCoreResult> => {
      const result = await dmGroupAddMemberCore({
        db,
        identity,
        conversationId,
        added,
        relayAvailable: (await ensureEffectiveRelayUrl(db)).startsWith('ws'),
        resolvePairSecret,
        parkEnvelope: parkEnvelopeOnRelay,
      });
      if (result.ok) refresh();
      return result;
    },
    [db, identity, resolvePairSecret, parkEnvelopeOnRelay, refresh],
  );

  // Plan 21 Phase 7: remove a member from a group DM (admin-only, rotates the epoch).
  const dmGroupRemoveMember = useCallback(
    async (conversationId: string, removedDeviceId: string): Promise<DmGroupMutationCoreResult> => {
      const result = await dmGroupRemoveMemberCore({
        db,
        identity,
        conversationId,
        removedDeviceId,
        relayAvailable: (await ensureEffectiveRelayUrl(db)).startsWith('ws'),
        resolvePairSecret,
        parkEnvelope: parkEnvelopeOnRelay,
      });
      if (result.ok) refresh();
      return result;
    },
    [db, identity, resolvePairSecret, parkEnvelopeOnRelay, refresh],
  );

  // Plan 21 Phase 8: block a DM participant (a real local revocation).
  const blockDmParticipant = useCallback(
    (deviceId: string, reason?: string): void => {
      blockDmParticipantCore(db, identity, deviceId, reason);
      refresh();
    },
    [db, identity, refresh],
  );

  // Plan 21 Phase 8: record a local DM report (dm_reports).
  const reportDm = useCallback(
    (input: ReportDmInput): void => {
      reportDmCore(db, input);
      refresh();
    },
    [db, refresh],
  );

  // Plan 21 Phase 8: shred (disappear) my own DM messages, deleting local copies +
  // cached blobs and fanning an author-signed DM_SHRED to the conversation.
  const queueDmShred = useCallback(
    async (conversationId: string, messageIds: string[]): Promise<QueueDmShredResult> => {
      const result = await queueDmShredCore({
        db,
        identity,
        conversationId,
        messageIds,
        relayAvailable: (await ensureEffectiveRelayUrl(db)).startsWith('ws'),
        resolvePairSecret,
        parkEnvelope: parkEnvelopeOnRelay,
        deleteBlob: async (hash) => { await blobStore.removeLocal(hash); },
      });
      refresh();
      return result;
    },
    [db, identity, resolvePairSecret, parkEnvelopeOnRelay, blobStore, refresh],
  );

  // The ONE set of drain handlers, shared by the foreground drain here and the
  // background drain (runBackgroundSyncOnce builds it from the SAME function), so
  // the two paths cannot drift. fail-closed: every handler verifies before write.
  // Channel + file handlers (existing) PLUS the P3 history-backfill serve + apply
  // PLUS the Plan 21 Phase 4 DM message/receipt handlers.
  const buildDrainHandlers = useCallback((): MailboxEnvelopeHandlers => ({
    ...buildFileMailboxHandlers({ db, blobStore, isActiveMember }),
    ...buildHistoryBackfillHandlers({
      db,
      identity,
      resolvePeer: resolvePeerForServe,
      parkEnvelope: parkEnvelopeOnRelay,
    }),
    ...buildDmMailboxHandlers({
      db,
      identity,
      resolvePeerDhKey,
      resolvePairSecret,
      parkEnvelope: parkEnvelopeOnRelay,
      // Plan 21 Phase 8: verify-then-pin inbound attachment blobs (blobStore.put
      // re-verifies the hash, so a tampered blob is never pinned).
      pinAttachments: async (hash, bytes, mimeType) => { await blobStore.put(hash, bytes, { moduleId: 'dm', mimeType }); },
    }),
    // Plan 21 Phase 7: apply an inbound group-DM epoch commit handoff (store the
    // recipient-gated wrap, pin the admin, persist the authoritative descriptor +
    // reconcile the roster). The group-mode dmMessage path is inside buildDmMailboxHandlers.
    ...buildDmGroupMailboxHandlers({ db, identity }),
    // Plan 52 P1/P2: the person-group attestation exchange and DM-peer person
    // proofs. listOwnDeviceIds is the LOAD-BEARING trust gate -- it must be
    // the own-device-LINKED list (dm_own_devices), never the paired list,
    // because a merely-paired friend must never get this device to attest a
    // person group.
    ...buildPersonGroupMailboxHandlers({
      db,
      identity,
      listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
      listDmPeerIds: () => getPairedDevices(db)
        .filter((peer) => peer.isActive)
        .map((peer) => peer.deviceId),
      resolvePairedDevice: (deviceId) => {
        const resolved = resolvePairedSecret(deviceId);
        return resolved
          ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
          : null;
      },
      parkEnvelope: parkEnvelopeOnRelay,
      recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
    }),
    // Plan 21 Phase 8: apply a verified author-signed DM shred (delete the local
    // rows + cached blobs; only messages the shred author actually authored).
    ...buildDmShredHandler({ db, identity, deleteBlob: async (hash) => { await blobStore.removeLocal(hash); } }),
    // P7 owner-side handoff: SERVE join-requests (owner) + APPLY join-grants
    // (joiner). recordChange replicates the new-epoch wraps to already-paired
    // members over the engine.
    ...processJoinRequest({
      db,
      owner: identity,
      parkEnvelope: parkEnvelopeOnRelay,
      recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
    }),
    ...applyJoinGrant({ db, self: identity }),
    // Plan 28 P2: APPLY side (survivor) of a community member removal. Verifies
    // the owner-signed strictly-newer revision against the local predecessor,
    // closes the removed device's roster row, and stores this device's new-epoch
    // wrap, so old-epoch sessions with the removed device are refused.
    ...applyMemberRemoval({ db, self: identity }),
    // Plan 19 FF3: SERVE side (owner) records a verified public-join request into
    // the local review queue. NEVER auto-approves; the epoch key hands off ONLY
    // through an explicit approvePublicJoinRequestById call.
    ...recordPublicJoinRequests({
      db,
      owner: identity,
      redeem: buildHumanityRedeemClient(humanityServiceConfig()) ?? undefined,
      servicePublicKeyHex: humanityServiceConfig().servicePublicKeyHex,
    }),
    // Plan 29 P6: APPLY a verified, FRESH presence beacon a member parked. The
    // dispatch already re-verified the envelope + beacon signature + freshness +
    // roster binding, so this only records it device-local (never replicated).
    presenceBeacon: (_senderDeviceId, beacon) => {
      recordPresenceBeacon(db, beacon);
      return true;
    },
  }),
  [db, blobStore, isActiveMember, identity, resolvePeerForServe, parkEnvelopeOnRelay, engine,
    resolvePeerDhKey, resolvePairSecret, resolvePairedSecret]);

  // Owner side (Plan 19 FF3): approve a queued public-join request. Loads the
  // queue row + this device's CURRENT owner-signed publication descriptor, then
  // calls the engine (add member + park the epoch-key grant). The queue row
  // flips to 'approved' ONLY on ok:true; a failure (including 'not_parked' when
  // no relay is reachable) leaves it 'pending' so the owner can retry.
  const approvePublicJoinRequestById = useCallback(
    async (publicationId: string, senderDeviceId: string): Promise<ApprovePublicJoinRequestResult> => {
      const row = getPublicJoinRequest(db, publicationId, senderDeviceId);
      if (!row) return { ok: false, reason: 'not_found' };
      // Fail-closed at approve: a queued row was already humanity-gated at RECORD
      // (the service redeem spent its single-use token there), so approve does NOT
      // re-redeem (that would fail already_spent) and does NOT re-check expiry (a
      // legitimately-queued request must stay approvable as time passes). This
      // only rejects a legacy/pre-AM1 row whose token is structurally absent.
      if (parseHumanityToken(row.humanity_token) === null) {
        return { ok: false, reason: 'bundle_invalid' };
      }
      const publication = getCurrentPublicationDescriptor(db, publicationId);
      if (!publication) return { ok: false, reason: 'not_found' };

      let bundle: SignedIdentityBundle;
      try {
        bundle = JSON.parse(row.bundle_json) as SignedIdentityBundle;
      } catch {
        return { ok: false, reason: 'bundle_invalid' };
      }

      const payload: PublicJoinRequestPayload = {
        kind: PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
        version: 1,
        publicationId: row.publication_id,
        communityId: row.community_id,
        grantId: row.grant_id,
        bundle,
        // AM1: the joiner's humanity token, persisted at record time, rebuilt
        // byte-exact for the engine (which requires a non-empty token).
        humanityToken: row.humanity_token,
      };

      const result = await approvePublicJoinRequest({
        db,
        owner: identity,
        parkEnvelope: parkEnvelopeOnRelay,
        recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
        senderDeviceId,
        payload,
        publication,
      });

      if (result.ok) {
        setPublicJoinRequestStatus(db, publicationId, senderDeviceId, 'approved');
        refresh();
      }
      return result;
    },
    [db, identity, parkEnvelopeOnRelay, engine, refresh],
  );

  // Owner side (Plan 19 FF3): decline a queued public-join request. Row-only; no
  // engine call, and the joiner is never notified (silent locally, like a block).
  const declinePublicJoinRequestById = useCallback(
    (publicationId: string, senderDeviceId: string): void => {
      setPublicJoinRequestStatus(db, publicationId, senderDeviceId, 'declined');
      refresh();
    },
    [db, refresh],
  );

  // Owner side (Plan 28 P3): remove a member for real. One call runs the whole
  // @mylife/sync orchestration: removal revision + survivor-only epoch rotation
  // (recordChange replicates wraps to paired members over the engine) +
  // per-survivor MEMBER_REMOVAL mailbox fan-out (the P2 drain applies it) +
  // descriptor republish to every http(s) node host (the hosted feed then
  // rejects the removed member). Honest counts ride back to the caller.
  const removeCommunityMemberById = useCallback(
    async (communityId: string, removedDeviceId: string): Promise<RemoveCommunityMemberResult> => {
      const result = await removeCommunityMember(
        {
          db,
          owner: identity,
          parkEnvelope: parkEnvelopeOnRelay,
          republishDescriptor: async (nodeUrl, descriptor) =>
            (await republishCommunityDescriptor({ baseUrl: nodeUrl, identity, descriptor })).ok,
          recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
        },
        communityId,
        removedDeviceId,
      );
      if (result.ok) refresh();
      return result;
    },
    [db, identity, parkEnvelopeOnRelay, engine, refresh],
  );

  // Resolve the drain peer list exactly as background-sync.ts does (active,
  // non-revoked, not self, with a recoverable shared secret).
  const resolveForegroundDrainPeers = useCallback((): MailboxDrainPeer[] => (
    getPairedDevices(db)
      .filter((peer) => peer.deviceId !== identity.publicKey)
      .map((peer) => {
        const revoked = isDeviceRevoked(db, peer.deviceId);
        const sharedSecretHex = !revoked && peer.sharedSecretRef
          ? getSharedSecretHex(peer.sharedSecretRef)
          : null;
        return {
          deviceId: peer.deviceId,
          pairSharedSecretHex: sharedSecretHex,
          revoked,
          isActive: peer.isActive,
        };
      })
  ), [db, identity.publicKey]);

  // Community-derived extra tokens for the drain (P7). For each community where I
  // am the OWNER, drain my join-request token (incoming joiner requests). For each
  // community I have joined but where I am NOT YET in the descriptor (a pending
  // join), drain my join-grant token (the owner's grant back to me). Both are the
  // same per-recipient token shape, addressed to ME by id; the relay buffered them.
  //
  // Plan 19 FF3 delivery fix (parity with web resolveJoinExtraTokens, commit
  // 947642f6): a request-policy PUBLIC-join request is parked by the joiner on
  // derivePublicJoinToken(publicationId, grantId, ownerDeviceId) (public-join.ts
  // queuePublicJoinRequest), a DISTINCT mailbox from the invite
  // deriveCommunityJoinToken. The owner must therefore ALSO drain the public-join
  // token of every owned, ACTIVE, advertised publication or the request is never
  // received and the review queue stays empty (recordPublicJoinRequests, already
  // in buildDrainHandlers, cannot fire on a token that is never drained).
  const resolveJoinExtraTokens = useCallback((): { token: string; label: string }[] => {
    const tokens: { token: string; label: string }[] = [];
    for (const community of listCommunities(db)) {
      const d = community.descriptor;
      // Plan 27 P2 (AC-2): a local_only community's mailboxes never touch the
      // relay -- not even its opaque rendezvous tokens. Join handoffs and
      // removal delivery for such a community ride local sessions instead.
      if (!transportAllowedForCommunity(db, d.communityId, 'wan_relay')) continue;
      const myRole = communityRole(d, identity.publicKey);
      if (myRole === 'owner') {
        tokens.push({
          token: deriveCommunityJoinToken(d.genesisNonce, d.communityId, identity.publicKey),
          label: `join-request:${d.communityId}`,
        });
      } else if (myRole === null) {
        // Joined locally (descriptor stored) but not yet listed: a PENDING join.
        tokens.push({
          token: deriveCommunityJoinToken(d.genesisNonce, d.communityId, identity.publicKey),
          label: `join-grant:${d.communityId}`,
        });
      }
      // Plan 28 P2: every LISTED member drains its own member-removal token,
      // re-derived from persisted community state (the FF3 trap: a token nobody
      // polls never delivers). This is how a survivor learns a removal + its
      // new-epoch wrap even when the owner is long offline.
      if (myRole !== null) {
        tokens.push({
          token: deriveCommunityRemovalToken(d.genesisNonce, d.communityId, identity.publicKey),
          label: `member-removal:${d.communityId}`,
        });
      }
    }
    // Public-join request mailboxes for this device's owned advertised
    // publications (the token the joiner actually parks its request on).
    for (const pub of listOwnedPublications(db, identity.publicKey)) {
      if (pub.status !== 'active') continue;
      const signed = getCurrentPublicationDescriptor(db, pub.publicationId);
      const grantId = signed?.descriptor.publicJoin?.grantId;
      if (!grantId) continue;
      tokens.push({
        token: derivePublicJoinToken(pub.publicationId, grantId, identity.publicKey),
        label: `public-join:${pub.publicationId}`,
      });
    }
    // Plan 21 Phase 7: for every group DM this device belongs to, drain the
    // conversation-scoped DM_GROUP_COMMIT token the admin seals epoch handoffs to,
    // re-derived from persisted state (the FF3 trap: a token nobody polls never
    // delivers). Without this, a member would never learn a new epoch.
    for (const conv of listDmConversations(db, { includeArchived: true })) {
      if (conv.kind !== 'group') continue;
      tokens.push({
        token: deriveDmGroupCommitToken(conv.id, identity.publicKey),
        label: `dm-group-commit:${conv.id}`,
      });
    }
    return tokens;
  }, [db, identity.publicKey]);

  // Live-wake (docs/plans/features/meerkat/live-wake.md): persistent listeners
  // on this device's inbound mailbox tokens while the app is foregrounded, so a
  // parked envelope arrives the moment the sender ships it instead of on the
  // next poll. The listener IS the drain (a connected session consumes what the
  // relay would otherwise park), so every frame goes through the SAME handler
  // set the polling drains use; the polling paths stay as idempotent backstops.
  const liveWakeDeps = useRef({
    peers: resolveForegroundDrainPeers,
    extraTokens: resolveJoinExtraTokens,
    handlers: buildDrainHandlers,
    refresh,
  });
  liveWakeDeps.current = {
    peers: resolveForegroundDrainPeers,
    extraTokens: resolveJoinExtraTokens,
    handlers: buildDrainHandlers,
    refresh,
  };

  const liveWakeEngine = useMemo(
    () => new MailboxListenEngine({
      identity,
      backend: createMeerkatRelayBackend(identity),
      relayUrl: () => ensureEffectiveRelayUrl(db),
      peers: () => liveWakeDeps.current.peers(),
      extraTokens: () => liveWakeDeps.current.extraTokens(),
      handlers: () => liveWakeDeps.current.handlers(),
      onApplied: () => {
        liveWakeDeps.current.refresh();
      },
    }),
    // Rebuild only on identity reset, mirroring the engine memo above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, identity.publicKey],
  );

  useEffect(() => {
    liveWakeEngine.start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') liveWakeEngine.start();
      else liveWakeEngine.stop();
    });
    return () => {
      sub.remove();
      liveWakeEngine.stop();
    };
  }, [liveWakeEngine]);

  // A pairing, revocation, join, or group change alters the inbound token set;
  // diff-connect only the delta (refresh() updates pairedDevices after drains).
  useEffect(() => {
    liveWakeEngine.refreshTokens();
  }, [liveWakeEngine, pairedDevices]);

  const runForegroundDrain = useCallback(async (): Promise<ForegroundDrainResult> => {
    // Plan 57 W4: drain the durable join boxes on attached community servers
    // FIRST -- this rail works with or without a relay. The owner serves joins
    // parked while it slept (the grant goes back to the node's durable box AND
    // the relay when one is dialable); a pending joiner applies its grant. The
    // handler set is the SAME kind-dispatched composition as the relay drain,
    // with only the join-request park seam re-pointed at the host.
    const hostJoin = await drainCommunityJoinBoxesFromHosts(
      db,
      identity,
      (communityId, hostUrl) => ({
        ...buildDrainHandlers(),
        ...processJoinRequest({
          db,
          owner: identity,
          parkEnvelope: async (token, envelope) => {
            // The grant targets the JOINER's token (not in the node's roster),
            // so the owner parks over the node's AUTHENTICATED lane.
            const nodeParked = await parkJoinEnvelopeOnNode({
              baseUrl: hostUrl, communityId, token, envelope, identity,
            }).then((r) => r.ok).catch(() => false);
            const relayParked = await parkEnvelopeOnRelay(token, envelope).catch(() => false);
            return nodeParked || relayParked;
          },
          recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
        }),
      }),
    ).catch(() => ({ communities: 0, fetched: 0, applied: 0, rejected: 0 }));
    if (hostJoin.applied > 0) refresh();

    const relayUrl = await ensureEffectiveRelayUrl(db);
    if (!relayUrl.startsWith('ws')) {
      // No relay configured: keep the pending-join re-park alive over the host
      // rail, then report the relay drain honestly as a genuine no-op.
      await requeuePendingJoinRequests();
      return {
        ran: false,
        appliedMessages: 0,
        dmReceipts: 0,
        fileRequests: 0,
        fileGrants: 0,
        historyRequestsServed: 0,
        historyGrantsApplied: 0,
        joinRequestsServed: 0,
        joinGrantsApplied: 0,
        publicJoinRequestsRecorded: 0,
        memberRemovalsApplied: 0,
      };
    }

    // While a joined community is PENDING (I am not yet in its descriptor), re-park
    // a fresh join-request before draining: the mailbox TTL is short, so re-queue
    // until the owner confirms. Reuse the stored descriptor's own invite-less path
    // is not possible (we have no invite link here), so we re-derive the request
    // from the stored descriptor by building a self-contained parsed shape.
    await requeuePendingJoinRequests();

    const backend = createMeerkatRelayBackend(identity);
    try {
      const drain = await runMailboxDrainJob({
        identity,
        backend,
        relayUrl,
        peers: resolveForegroundDrainPeers(),
        handlers: buildDrainHandlers(),
        extraTokens: resolveJoinExtraTokens(),
      });
      if (
        drain.applied > 0
        || drain.dmReceipts > 0
        || drain.fileRequests > 0
        || drain.fileGrants > 0
        || drain.historyGrants > 0
        || drain.joinGrants > 0
        || drain.joinRequests > 0
        || drain.publicJoinRequests > 0
        || drain.memberRemovals > 0
      ) {
        refresh();
      }
      // A member-removal revision (or any adopted descriptor) may have changed a
      // community's transport policy: reconcile the observed ledger so the member
      // policy-change notice reflects the real signed change (idempotent).
      reconcileCommunityPolicyHistory(db);
      // Plan 53 P3: park any still-queued DM-peer person announces. An
      // in-person add completed with no reachable relay queues one; this is
      // its retry point, so the announce eventually reaches the new friend.
      await drainPersonAnnounceOutbox({
        db,
        identity,
        listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
        resolvePairedDevice: (deviceId: string) => {
          const resolved = resolvePairedSecret(deviceId);
          return resolved
            ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
            : null;
        },
        parkEnvelope: parkEnvelopeOnRelay,
      });
      // Plan 29 P6: drop presence beacons whose TTL elapsed (honest freshness).
      prunePresenceBeacons(db);
      // Plan 29 P6 EMIT (PER-COMMUNITY opt-in): for each community the user turned
      // "Appear online" on (default OFF, read per community) whose policy allows
      // relay, sign + seal + park a fresh beacon to every reachable co-member peer.
      // Bounded + honest: a no-op with no opt-in / no reachable peer; each park is
      // best-effort. Never emits for a community the user did not opt into.
      {
        const presenceCommunities = listCommunities(db)
          .filter((c) => communityRole(c.descriptor, identity.publicKey) !== null
            && transportAllowedForCommunity(db, c.communityId, 'wan_relay'))
          .map((c) => ({
            communityId: c.communityId,
            memberDeviceIds: c.descriptor.members.map((m) => m.deviceId),
            relayAllowed: true,
            appearOnline: isAppearOnlineEnabled(db, c.communityId),
          }));
        const presencePeers = getPairedDevices(db).map((peer) => ({
          deviceId: peer.deviceId,
          dhPublicKey: peer.dhPublicKey,
          pairSharedSecretHex: resolvePairSecret(peer.deviceId),
          isActive: peer.isActive,
          revoked: isDeviceRevoked(db, peer.deviceId),
        }));
        const presenceTargets = planPresenceEmission({
          selfDeviceId: identity.publicKey,
          communities: presenceCommunities,
          pairedPeers: presencePeers,
        });
        if (presenceTargets.length > 0) {
          await emitPresenceBeacons({ identity, targets: presenceTargets, park: parkEnvelopeOnRelay });
        }
      }
      return {
        ran: true,
        appliedMessages: drain.applied,
        dmReceipts: drain.dmReceipts,
        fileRequests: drain.fileRequests,
        fileGrants: drain.fileGrants,
        historyRequestsServed: drain.historyRequests,
        historyGrantsApplied: drain.historyGrants,
        joinRequestsServed: drain.joinRequests,
        joinGrantsApplied: drain.joinGrants,
        publicJoinRequestsRecorded: drain.publicJoinRequests,
        memberRemovalsApplied: drain.memberRemovals,
      };
    } finally {
      backend.destroy();
    }
  }, [db, identity, engine, buildDrainHandlers, resolveForegroundDrainPeers, resolveJoinExtraTokens, requeuePendingJoinRequests,
    resolvePairSecret, resolvePairedSecret, parkEnvelopeOnRelay, refresh]);

  // Opt-in toggle for automatic dialing (Plan 29). Opt-in only, and this NEVER
  // touches background_sync_enabled (NC-4): auto-connect is a foreground feature.
  const setAutoConnect = useCallback(
    (enabled: boolean): void => {
      setAutoConnectEnabled(db, enabled);
      setAutoConnectEnabledState(enabled);
    },
    [db],
  );

  // LAN dial for a peer the engine planned for the local-network transport
  // (initiator role only; the listener already answers inbound via
  // startLanListening's onConnection). Absent LAN backend / unknown address =>
  // the round records an honest no-op for that peer, never a fake session.
  const connectLanForRound = useCallback(
    async (
      lanAddresses: Map<string, { host: string; port: number }>,
      input: { peerDeviceId: string; role: 'initiate' | 'listen' },
    ) => {
      if (input.role !== 'initiate') {
        // The higher-id peer listens; its running LAN listener handles the
        // inbound session. Dialing out here would double-connect, so no-op.
        throw new Error('listen role is served by the LAN listener');
      }
      const addr = lanAddresses.get(input.peerDeviceId);
      if (!addr) throw new Error('no discovered LAN address for this peer');
      const backend = loadLanSocketBackend();
      if (!backend) throw new Error(LAN_RECOVERY_GUIDANCE);
      return connectLanPeer({
        backend,
        host: addr.host,
        port: addr.port,
        remoteDeviceId: input.peerDeviceId,
      });
    },
    [],
  );

  // Run ONE shared foreground round (AM11): mailbox drain, then the auto-connect
  // session sync over real recorded sessions, then gossip once the engine seam
  // (item 10) is composed in. runComposedAutoConnectRound orders + summarizes;
  // every count comes from a real drain or a real runAutoConnectJob outcome.
  const autoConnectRound = useCallback(
    async (trigger: AutoConnectTrigger): Promise<AutoConnectRoundOutcome> => {
      setLastAutoConnectError(null);
      try {
        const lanAddresses = new Map<string, { host: string; port: number }>(
          discoveredPeers.map((peer) => [peer.deviceId, { host: peer.host, port: peer.port }]),
        );
        const discoveredIds = new Set(discoveredPeers.map((peer) => peer.deviceId));
        // Resolve (and if stale, re-probe) the relay ONCE for the whole round; the
        // session leg's callback below is sync, so it cannot await the choke point.
        const roundRelayUrl = await ensureEffectiveRelayUrl(db);
        const outcome = await runComposedAutoConnectRound({
          trigger,
          runDrain: async () => {
            const drain = await runForegroundDrain();
            return { ran: drain.ran, appliedMessages: drain.appliedMessages };
          },
          runSessions: (): Promise<AutoConnectRoundResult> => runAutoConnectJob({
            db,
            selfDeviceId: identity.publicKey,
            engine,
            relayUrl: roundRelayUrl,
            relayBackendFactory: () => createMeerkatRelayBackend(identity),
            resolvePeerSecret: resolvePairSecret,
            discoveredPeers: discoveredIds,
            connectRelay: (opts) => connectRelayPeer(opts),
            connectLan: (input) => connectLanForRound(lanAddresses, input),
            // AM5/15b Plan 27 (NC-3): the round computes forbiddenLayerIds from THIS
            // predicate. The auto-connect round is PEER-scoped (a peer is not one
            // community), so this resolves CONSERVATIVELY across every community this
            // device belongs to: a native layer is allowed ONLY if EVERY joined
            // community permits its transport. Deny if ANY forbids it, so a single
            // local_only community can never be under-restricted into a WebRTC dial.
            // Without this the dep defaults to () => true (nothing forbidden) -- a leak.
            transportPolicyAllows: (layerId: number) =>
              nativeLayerAllowedAcrossCommunities(
                listCommunities(db)
                  .filter((c) => communityRole(c.descriptor, identity.publicKey) !== null)
                  .map((c) => communityTransportPolicy(c.descriptor)),
                layerId,
              ),
            // AM5/15b: dial a peer over a real native data transport (WebRTC / Nearby)
            // BEFORE relay when one is reachable. nativeDataAvailable is derived from
            // the engine's REAL backend gate, so a build without the native modules
            // reports false and the planner never plans a native dial. The callback
            // forwards the round's per-community forbiddenLayerIds (Plan 27 policy,
            // computed by runAutoConnectJob) into the engine dial, and THROWS on a
            // null dial so a failed attempt records an honest failed row + backoff
            // rather than a fabricated success.
            nativeDataAvailable: engine.getAvailableNativeDataLayers().length > 0,
            connectNativeDataTransport: async ({ peerDeviceId, forbiddenLayerIds }) => {
              const conn = await engine.dialPeerViaNativeDataTransport(peerDeviceId, { forbiddenLayerIds });
              if (!conn) throw new Error('No native data transport reachable for this peer.');
              return conn;
            },
          }),
          // Gossip (AM11) now rides INSIDE the session sync above: the engine is
          // built with gossip:true, so each auto-connect session runs the gossip
          // phase (signed revocations + descriptors + roster reconcile). No separate
          // runGossip step is needed; the composition is drain + gossiping sessions.
        });
        recordAutoConnectRound(db, outcome.summary);
        setLastAutoConnectRound(outcome.summary);
        refresh();
        return outcome;
      } catch (error) {
        setLastAutoConnectError('Could not finish catching up. Check your connection and unsaved changes, then try again.');
        throw error;
      }
    },
    [db, identity, engine, discoveredPeers, runForegroundDrain, resolvePairSecret, connectLanForRound, refresh],
  );

  // Foreground + LAN-peer triggers for automatic dialing (opt-in). Safe to fire
  // repeatedly: the engine backoff / min-interval skip an over-eager round.
  useAutoConnectTriggers({
    enabled: enabled && autoConnectEnabled,
    discoveredPeerCount: discoveredPeers.length,
    run: autoConnectRound,
  });

  const myPairingJson = useMemo(
    () => JSON.stringify(buildSignedPairingPayload(identity)),
    [identity],
  );

  // Shared TOFU + pairing for any verified bundle, whether it arrived as a
  // pasted payload (MK-015) or resolved from a friend code (MK-016). Returns an
  // error string, or null on a successful pair.
  const applyTrustedBundle = useCallback(
    (signed: SignedIdentityBundle): string | null => {
      const data = pairingDataFromBundle(signed);
      if (data.publicKey === identity.publicKey) return 'That is this device\'s own identity.';

      // TOFU: pin the device key on first sight; a known device that shows up
      // with a different DH key is a key change, never silent trust.
      const pinnedRow = getPinnedIdentity(db, data.publicKey);
      const trust = evaluateBundleTrust(
        signed,
        pinnedRow ? { deviceId: pinnedRow.deviceId, dhPublicKey: pinnedRow.dhPublicKey } : null,
      );
      if (trust === 'invalid_signature') {
        return 'This identity failed signature verification. Do not pair: it may be a man-in-the-middle.';
      }
      if (trust === 'key_changed') {
        return `${data.displayName}'s safety identity changed since you last paired. If they did not reset that device, someone may be impersonating them. Pairing blocked.`;
      }
      if (getPairedDevice(db, data.publicKey)) {
        touchPinnedIdentity(db, data.publicKey, new Date().toISOString());
        return 'Already paired with that device.';
      }
      if (trust === 'first_seen') {
        pinIdentity(db, {
          deviceId: data.publicKey,
          dhPublicKey: data.dhPublicKey,
          displayName: data.displayName,
          bundleJson: JSON.stringify(signed.bundle),
          bundleSignature: signed.signature,
        });
      } else {
        touchPinnedIdentity(db, data.publicKey, new Date().toISOString());
      }
      const device = completePairing(identity, data);
      insertPairedDevice(db, device);
      refresh();
      return null;
    },
    [db, identity, refresh],
  );

  const pairWithJson = useCallback(
    (json: string): string | null => {
      const payload = parseSignedPairingPayload(normalizeMeerkatPairingInput(json));
      if (!payload) {
        return 'That is not a valid Meerkat pairing code (unsigned or tampered). Re-copy it from the other device.';
      }
      return applyTrustedBundle(payload.bundle);
    },
    [applyTrustedBundle],
  );

  const publishFriendCode = useCallback(
    async (relayUrl: string, onPublished?: (receipt: PublishRendezvousReceipt) => void): Promise<string> => {
      const url = relayUrl.trim();
      const entitlementToken = await hostedRelayAccess(identity).tokenFor(url);
      // Publish under the user's CURRENT stored friend code (vanity or standard)
      // so the code a friend types is the code their identity is published at.
      // The rid is derived from that exact code via the sync resolver, so publish
      // and resolve meet at the same rendezvous point. No throwaway code.
      const stored = getSetting(db, FRIEND_CODE_KEY)?.trim();
      if (!stored) {
        throw new Error('No friend code is set on this device yet.');
      }
      // D.5: seal the published record with a persistent per-device secret half.
      // The secret half never reaches the relay; it is shared only as part of the
      // extended friend code returned below. Reused across republishes so the
      // extended code the user shares is stable.
      const secretHalf = loadOrCreateFriendCodeSecret(db);
      // A vanity code must publish via customCode: its rid is the domain-separated
      // hash and the SAME vanity string is returned to share. A standard code
      // re-encodes its rid back to the identical checksummed display string.
      if (isValidCustomFriendCode(stored)) {
        // publishIdentityToRendezvous returns the EXTENDED (sealed) code when a
        // secretHalf is supplied, so no caller-side wrapping (that would double
        // the secret half). The returned code is what the user shares.
        return publishIdentityToRendezvous({
          onPublished,
          url,
          identity,
          customCode: stored,
          secretHalf,
          relayHints: [url],
          entitlementToken,
        });
      }
      const rendezvousId = friendCodeToRendezvousId(stored);
      if (!rendezvousId) {
        throw new Error('Your stored friend code is not valid. Regenerate it on the Identity screen.');
      }
      return publishIdentityToRendezvous({
          onPublished,
        url,
        identity,
        rendezvousId,
        secretHalf,
        relayHints: [url],
        entitlementToken,
      });
    },
    [db, identity],
  );

  const pairWithFriendCode = useCallback(
    async (relayUrl: string, code: string): Promise<string | null> => {
      const url = relayUrl.trim();
      const entitlementToken = await hostedRelayAccess(identity).tokenFor(url);
      const result = await resolveIdentityFromRendezvous({ url, code: code.trim(), entitlementToken });
      if (!result.ok) {
        if (result.reason === 'bad_code') return 'That friend code is not valid. Check for typos.';
        if (result.reason === 'not_found') {
          return 'No identity is published for that code. It may have expired, been used already, or never published.';
        }
        return 'The resolved identity failed signature verification. Do not pair: it may be a man-in-the-middle.';
      }
      return applyTrustedBundle(result.bundle);
    },
    [applyTrustedBundle, identity],
  );

  // SAS (MK-017): derive the five-emoji short authentication string for a peer
  // from the pairing shared secret. Both devices computed the same secret during
  // pairing, so honest peers see the same emoji; a first-contact MITM holding two
  // different secrets would show two different strings. Null if the secret is
  // unavailable (e.g. not paired). Real derived data, never a placeholder.
  const getPeerSas = useCallback(
    (peerDeviceId: string): SasResult | null => {
      const peer = getPairedDevice(db, peerDeviceId);
      if (!peer?.sharedSecretRef) return null;
      const hex = getSharedSecretHex(peer.sharedSecretRef);
      if (!hex) return null;
      try {
        return deriveSas(hexToBytes(hex));
      } catch {
        return null;
      }
    },
    [db],
  );

  /** Whether the user has confirmed this peer's SAS for the personal boundary. */
  const isPeerSasVerified = useCallback(
    (peerDeviceId: string): boolean => getSasVerification(db, peerDeviceId, '') !== null,
    [db],
  );

  /** Record that the user confirmed the five emoji matched out of band. */
  const confirmPeerSas = useCallback(
    (peerDeviceId: string): boolean => {
      const sas = getPeerSas(peerDeviceId);
      if (!sas) return false;
      // Record at the canonical global key (''): the 5 emoji derive from the
      // pairwise secret, so verifying the pairing once authenticates the peer
      // for every context, including workspace sessions (the engine gate reads
      // this same global record).
      recordSasVerification(db, { peerDeviceId, workspaceId: '', sasIndices: sasFingerprint(sas) });
      refresh();
      return true;
    },
    [db, getPeerSas, refresh],
  );

  const isPeerRevoked = useCallback(
    (peerDeviceId: string): boolean => isDeviceRevoked(db, peerDeviceId),
    [db],
  );

  /**
   * Revoke a peer (MK-019): sign a revocation with this device and record it
   * locally so the handshake rejects that device from now on. The signed record
   * is gossip-ready -- a future session can forward it so other members lock the
   * device out too. This is real: a revoked device can no longer sync here.
   */
  const revokePeer = useCallback(
    (peerDeviceId: string, reason?: string): void => {
      const signed = createSignedRevocation(identity, peerDeviceId, reason);
      // The user revoking a device from their OWN Sync screen: authority is the
      // local device itself (it authored and signed the revocation). No "any
      // paired device" clause -- that would let a gossiped record from any peer
      // through this local path.
      applySignedRevocation(db, signed, {
        isAuthorizedRevoker: (revoker) => revoker === identity.publicKey,
      });
      refresh();
    },
    [db, identity, refresh],
  );

  const runRelaySession = useCallback(
    async (input: RunRelaySessionInput): Promise<void> => {
      // Manual and background relay sessions both go through runSyncSessionJob so
      // the two paths cannot drift. The job opens the connection, drives the
      // same engine, and always closes the connection + destroys the backend.
      try {
        const result = await runSyncSessionJob({
          backend: createMeerkatRelayBackend(identity),
          relayUrl: input.relayUrl.trim(),
          token: buildRendezvousToken(input.phrase),
          peerDeviceId: input.peerDeviceId,
          role: input.role,
          engine,
          connect: (opts) => connectRelayPeer(opts),
        });
        // Surface a real connection/transport failure to the caller, exactly as
        // the previous direct path did (the engine still records the session row).
        if (!result.ran && result.error) throw new Error(result.error);
      } finally {
        refresh();
      }
    },
    [engine, refresh, identity],
  );

  const runLanSession = useCallback(
    async (input: RunLanSessionInput): Promise<void> => {
      const backend = loadLanSocketBackend();
      if (!backend) throw new Error(LAN_RECOVERY_GUIDANCE);
      const conn = await connectLanPeer({
        backend,
        host: input.host.trim(),
        port: input.port,
        remoteDeviceId: input.peerDeviceId,
      });
      try {
        await engine.syncWithConnection(conn);
      } finally {
        await conn.close();
        refresh();
      }
    },
    [engine, refresh],
  );

  const startLanListening = useCallback(
    async (port: number): Promise<number> => {
      const backend = loadLanSocketBackend();
      if (!backend) throw new Error(LAN_RECOVERY_GUIDANCE);
      if (lanListenerRef.current) return lanListenerRef.current.port;
      const listener = await startLanListener({
        backend,
        port,
        onConnection: (conn) => {
          void engine.handleIncomingConnection(conn).finally(refresh);
        },
      });
      lanListenerRef.current = listener;
      setLanPort(listener.port);

      // Advertise + browse via mDNS when the platform module is present.
      // Discovery failing never blocks the listener; manual host:port still works.
      const discoveryBackend = loadDiscoveryBackend();
      if (discoveryBackend && !discoveryRef.current) {
        const discovery = new LANDiscovery({
          deviceId: identity.publicKey,
          displayName: identity.displayName,
          port: listener.port,
          backend: discoveryBackend,
        });
        discovery.on({
          onPeerFound: () => setDiscoveredPeers(discovery.getVisiblePeers()),
          onPeerLost: () => setDiscoveredPeers(discovery.getVisiblePeers()),
        });
        discovery.startAdvertising();
        discovery.startBrowsing();
        discoveryRef.current = discovery;
      }
      return listener.port;
    },
    [engine, identity, refresh],
  );

  const stopLanListening = useCallback(async (): Promise<void> => {
    discoveryRef.current?.destroy();
    discoveryRef.current = null;
    setDiscoveredPeers([]);
    await lanListenerRef.current?.close();
    lanListenerRef.current = null;
    setLanPort(null);
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({
      ready,
      initError,
      status,
      pad,
      savePad,
      recordLocalChange,
      applyJoinDisplayName,
      personLinks,
      setCommunityPresentation,
      setCommunityProfile,
      setCommunityAppearance,
      clearCommunityAppearance,
      setCommunityLayout,
      clearCommunityLayout,
      saveCommunityOrganization,
      setCommunityTransportPolicy,
      queueChannelMessageMailbox,
      queueFileRequest,
      queueFileRequestByFields,
      queueFileGrant,
      queueHistoryRequest,
      queueJoinRequest,
      queueDmMessage,
      queueDmReceipt,
      linkOwnDevice,
      linkOwnDeviceAsPerson,
      unlinkOwnDeviceFromPerson,
      hasPendingPersonProposal,
      cancelPendingPersonProposals,
      rebuildOwnPersonGroup,
      pendingPersonRemovals,
      approvePersonRemoval,
      declinePersonRemoval,
      createDmGroup,
      dmGroupAddMember,
      dmGroupRemoveMember,
      blockDmParticipant,
      reportDm,
      queueDmShred,
      approvePublicJoinRequestById,
      declinePublicJoinRequestById,
      removeCommunityMemberById,
      runForegroundDrain,
      resolvePairSecret,
      autoConnectEnabled,
      setAutoConnect,
      lastAutoConnectRound,
      lastAutoConnectError,
      autoConnectRound,
      myPairingJson,
      pairWithJson,
      pairWithVerifiedBundle: applyTrustedBundle,
      announcePersonToFriend,
      publishFriendCode,
      pairWithFriendCode,
      getPeerSas,
      isPeerSasVerified,
      confirmPeerSas,
      isPeerRevoked,
      revokePeer,
      pairedDevices,
      sessions,
      rungStats,
      runRelaySession,
      runLanSession,
      lanPort,
      startLanListening,
      stopLanListening,
      discoveredPeers,
      dataTransportAvailability,
      refresh,
    }),
    [
      ready, initError, status, pad, savePad, recordLocalChange, applyJoinDisplayName, personLinks,
      setCommunityPresentation, setCommunityProfile,
      setCommunityAppearance, clearCommunityAppearance, setCommunityLayout, clearCommunityLayout, saveCommunityOrganization, setCommunityTransportPolicy, queueChannelMessageMailbox,
      queueFileRequest, queueFileRequestByFields, queueFileGrant, queueHistoryRequest, queueJoinRequest,
      queueDmMessage, queueDmReceipt, linkOwnDevice, linkOwnDeviceAsPerson,
      unlinkOwnDeviceFromPerson, hasPendingPersonProposal, cancelPendingPersonProposals,
      rebuildOwnPersonGroup, pendingPersonRemovals, approvePersonRemoval, declinePersonRemoval,
      createDmGroup, dmGroupAddMember, dmGroupRemoveMember,
      blockDmParticipant, reportDm, queueDmShred,
      approvePublicJoinRequestById, declinePublicJoinRequestById, removeCommunityMemberById, runForegroundDrain,
      resolvePairSecret,
      autoConnectEnabled, setAutoConnect, lastAutoConnectRound, lastAutoConnectError, autoConnectRound,
      myPairingJson, pairWithJson, applyTrustedBundle, announcePersonToFriend, publishFriendCode, pairWithFriendCode,
      getPeerSas, isPeerSasVerified, confirmPeerSas, isPeerRevoked, revokePeer,
      pairedDevices, sessions, rungStats,
      runRelaySession, runLanSession, lanPort, startLanListening, stopLanListening, discoveredPeers,
      dataTransportAvailability, refresh,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
