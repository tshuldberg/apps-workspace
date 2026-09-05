import { isMeerkatOwnSyncDevice } from './sync-peer-authorization';
import type { PublishRendezvousReceipt } from '@mylife/sync';
import { DatabaseSaveStatus } from './storage/DatabaseSaveStatus';
import { acquireDatabaseWriter, DatabaseOwnershipError } from './storage/database-ownership';
// MeerkatProvider (Phase 1B): the single React context that boots the web node
// and exposes a flat, honest API over @mylife/sync. It fuses the roles the
// native app splits across DatabaseProvider + IdentityProvider + SyncProvider +
// ChatProvider into one provider (the brief asks for one MeerkatProvider).
//
// What is REAL here (no fabrication, per apps/meerkat/CLAUDE.md transport
// honesty boundary):
//   - identity: generated + persisted via the real @mylife/sync secret store.
//   - engine: a real NativeSyncEngine over the real browser DatabaseAdapter.
//   - sessions: a real manual relay session via runSyncSessionJob; status comes
//     only from the engine status store + the returned SyncSession. No fake
//     "connected" flag, no fabricated peer count.
//   - community + channel messages: the real protocol create/join/post path.
//   - community feed: a real node pull (community feed P5) + a real P7 join
//     handoff over the relay; counts come straight from @mylife/sync.
// Web is RELAY-ONLY (no LAN in the browser). DEFAULT_RELAY_URL stays ''.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  LwwDocumentManager,
  MailboxListenEngine,
  NativeSyncEngine,
  WebSocketRelayBackend,
  applyJoinGrant,
  applyMemberRemoval,
  approvePublicJoinRequest,
  buildFileDecline,
  buildFileGrant,
  buildJoinRequest,
  parkJoinEnvelopeOnNode,
  communityRole,
  type ProfileNameColorToken,
  communityTransportPolicy,
  transportPolicyAllows,
  completePairing,
  connectRelayPeer,
  applySignedRevocation,
  createSignedRevocation,
  createCommunity,
  createCommunityInvite,
  deriveCommunityJoinToken,
  deriveCommunityRemovalToken,
  deriveDmGroupCommitToken,
  derivePublicJoinToken,
  splitBlobForTransfer,
  removeCommunityMember,
  republishCommunityDescriptor,
  transportAllowedForCommunity,
  type RemoveCommunityMemberResult,
  deriveSas,
  encodeMailboxEnvelope,
  evaluateBundleTrust,
  exportRecoverableIdentity,
  fileRequestId,
  friendCodeToRendezvousId,
  generateRendezvousSecretHalf,
  bytesToHex,
  createHostedAuthBearer,
  deleteStorageAccountData,
  generateDeviceIdentity,
  generateFriendCode,
  generateRecoveryKey,
  openAndRestore,
  parseRecoveryKey,
  getCommunity,
  getPairedDevice,
  getPairedDevices,
  getPinnedIdentity,
  getPublicKeyFingerprint,
  getRecentSyncSessions,
  getSasVerification,
  getSharedSecretHex,
  hasConfiguredSyncSecretStore,
  hexToBytes,
  insertPairedDevice,
  isDeviceRevoked,
  isValidCustomFriendCode,
  joinCommunityFromLink,
  leaveCommunity as leaveCommunityRow,
  listCommunities,
  makeVanityFriendCode,
  nextHlc,
  normalizeMeerkatPairingInput,
  parseCommunityInviteLink,
  processJoinRequest,
  publishIdentityToRendezvous,
  pinIdentity,
  removeWorkspaceMember,
  resolveIdentityFromRendezvous,
  reviseCommunity,
  recordSasVerification,
  parseHumanityToken,
  revisePolicy,
  runAutoConnectJob,
  runMailboxDrainJob,
  recordPresenceBeacon,
  prunePresenceBeacons,
  runSyncSessionJob,
  sasFingerprint,
  sealFileRequestMailbox,
  sealRecovery,
  touchPinnedIdentity,
  upsertCommunity,
  PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
  type ApprovePublicJoinResult,
  type ChannelMessageAttachment,
  type ChannelMessageEvent,
  type CommunityChannel,
  type CommunityTransportPolicy,
  type CommunityChannelCategory,
  type CommunityLayout,
  type CommunityIdentityBanner,
  type CommunityIdentityEvent,
  type CommunityLayoutEvent,
  type DeviceIdentity,
  type DmGroupMember,
  type DmMessageAttachment,
  type DmReceiptState,
  type FileRequestFields,
  type JoinCommunityResult,
  type AutoConnectRoundResult,
  type MailboxDrainPeer,
  type MailboxEnvelope,
  type MailboxEnvelopeHandlers,
  type PairedDevice,
  type PublicJoinRequestPayload,
  type SasResult,
  probeRelays,
  type SignedIdentityBundle,
  type SignedCommunityDescriptor,
  type StoredCommunity,
  type SyncEngineStatus,
  type SyncSession,
} from '@mylife/sync';
import { bootBrowserSync, resetBrowserSyncCache, type BootBrowserSyncOptions } from './browser-sync-init';
import type { BrowserDatabaseAdapter } from './storage/browser-database-adapter';
import { SecretVaultUnreadableError, type BrowserSecretStore } from './storage/browser-secret-store';
import { IDB_NAME, closeMeerkatIdb } from './storage/idb';
import type { BrowserStorageSecretAccess } from './storage/credential-store';
import { BrowserBlobStore } from './storage/browser-blob-store';
import type { BrowserNodeStore } from './storage/browser-node-store';
import { sealCommunityBanner, openCommunityBanner } from './community-banner';
import { DEFAULT_RELAY_URL } from './relay';
import { effectiveRelayUrl, ensureEffectiveRelayUrl } from './effective-relay';
import {
  alignPersonIdentity,
  buildPersonGroupMailboxHandlers,
  drainPersonAnnounceOutbox,
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
} from './person-identity-core';
import {
  getLastAutoConnectRound,
  isAutoConnectEnabled,
  recordAutoConnectRound,
  runComposedAutoConnectRound,
  setAutoConnectEnabled,
  type AutoConnectRoundOutcome,
  type AutoConnectRoundSummary,
  type AutoConnectTrigger,
} from './auto-connect-core';
import { reconcileCommunityPolicyHistory } from './policy-history';
import { reconcileCommunityFileReportTargets } from './community-safety';
import { hasPublicPersonaRecord, runDeleteMyData } from './delete-account-core';
import { createConfiguredWebStorageRegistry } from './storage/configured-registry';
import {
  createBrowserStorageCredentialBroker,
  deleteBrowserStorageCredentialRef,
  STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
} from './storage/credential-store';
import { createWebStorageAccountRemote } from './storage/storage-account-delete';
import { runWebStorageScheduleOnce } from './storage/web-storage-scheduler-run';
import { disableWebPush } from './web-push-registration';
import {
  personaServiceConfig,
  requestPersonaDeletion,
} from './persona-core';
import { emitPresenceBeacons, isAppearOnlineEnabled, planPresenceEmission } from './presence-core';
import { buildHumanityRedeemClient, humanityServiceConfig } from './humanity-core';
import { ensurePersonalWorkspace } from './personal-workspace';
import {
  commitCommunityTemplate,
  type CommitCommunityTemplateInput,
  type CommitCommunityTemplateResult,
} from './community-template-commit';
import { visibleCommunityName } from './community-templates';
import {
  HOSTED_API_URL,
  HOSTED_RELAY_URL,
  clearCachedAppUnlock,
  clearCachedHostedEntitlementToken,
  fetchAppUnlockState,
  getCachedAppUnlock,
  getCachedHostedEntitlementToken,
  isFirstPartyHostedHttpUrl,
  relayRequiresHostedPayment,
  setCachedHostedEntitlementToken,
  subscribeCachedAppUnlock,
} from './hosted-access';
import {
  CM_MESSAGES_TABLE,
  CM_MESSAGE_ATTACHMENTS_TABLE,
  CM_POSTS_TABLE,
  COMMUNITY_MODULE_ID,
  DEFAULT_DISPLAY_NAME,
  MEERKAT_KEYS_MODULE_ID,
  MEERKAT_SYNC_MODULE_ID,
  MEERKAT_SYNC_POLICIES,
  MEERKAT_SYNC_PREFIXES,
  RELAY_URL_SETTING_KEY,
  DEFAULT_RELAY_OPTOUT_KEY,
  writeRelayProbe,
  aggregateCommunityFiles,
  applyPresence,
  buildFileMailboxHandlers,
  buildPresenceMap,
  buildRendezvousToken,
  buildSignedPairingPayload,
  buildCommunityPeerNameMap,
  channelMessageAttachmentRowsFromEvent,
  channelMessageRowFromEvent,
  countUnreadChannelMessages,
  createChannelPostEvent,
  createChannelPostReplyEvent,
  getAutoUpdate,
  getCommunityIdentity,
  getCommunityProfile,
  getCommunityThemeMode,
  publishCommunityIdentity as publishCommunityIdentityRow,
  publishCommunityLayout as publishCommunityLayoutRow,
  tombstoneCommunityLayout as tombstoneCommunityLayoutRow,
  getCommunityLayoutEvent,
  setCommunityThemeMode as setCommunityThemeModeRow,
  tombstoneCommunityIdentity as tombstoneCommunityIdentityRow,
  type CommunityThemeMode,
  type PublishCommunityIdentityFields,
  getFileRequest,
  getChannelMessageEventById,
  getChannelReadState,
  getFriendCode,
  FRIEND_CODE_SECRET_KEY,
  getIdentityRow,
  getLastPulledAt,
  getOutgoingRequestForAttachment,
  getPublicJoinRequest,
  getSetting,
  highestHlc,
  insertMessageAttachmentRows,
  insertMessageRow,
  insertPostHeaderRow,
  mirrorEventToCommunityHost,
  drainCommunityJoinBoxesFromHosts,
  parkJoinRequestOnInviteHost,
  isActiveCommunityMember,
  listActiveOwnReactionEventIds,
  listChannelPostCards,
  listChannelPostThread,
  listChannelMessages,
  listChannelReactions,
  listCommunityChannelUnreadCounts,
  listIncomingPendingRequests,
  markChannelReadRow,
  readBoundaryFromReadState,
  parseSignedPairingPayload,
  pairingDataFromBundle,
  recordPublicJoinRequests,
  refreshCommunityFeed,
  resolveCommunityAvatarImage,
  resolveCommunityAvatarInitial,
  resolveCommunityDisplayName,
  saveFriendCode,
  saveIdentityRow,
  setAutoUpdate,
  setFileRequestStatus,
  setPublicJoinRequestStatus,
  setSetting,
  storeOwnedCommunity,
  updateDisplayName as updateDisplayNameRow,
  upsertFileRequest,
  type FileRequestRow,
  type FriendCodeState,
  type PresentFile,
  type ChannelPostCard,
  type ChannelPostThread,
  type MessageReactionGroup,
  type ReadBoundary,
  type RefreshCommunityFeedResult,
} from './meerkat-data';
import {
  buildDeletedChannelMessage,
  buildEditedChannelMessage,
  buildOutgoingChannelMessage,
  buildReactionEvent,
  buildUnreactionEvent,
  type SendMessageOpts,
} from './chat-compose';
import { newestVisibleEventId } from './channel-view-core';
import { getCurrentPublicationDescriptor, listOwnedPublications } from './public-publish';
import {
  blockCommunityPerson as blockCommunityPersonRow,
  clearCommunitySafetyAction,
  isChannelMuted as isChannelMutedRow,
  isCommunityMuted as isCommunityMutedRow,
  isCommunityPersonBlocked as isCommunityPersonBlockedRow,
  listOwnerReviewItems,
  markSafetyActionReviewed,
  reportCommunityContent as reportCommunityContentRow,
  setChannelMuted as setChannelMutedRow,
  setCommunityMuted as setCommunityMutedRow,
  type CommunitySafetyActionRow,
} from './community-safety';
import {
  removeDmOwnDevice,
  listDmOwnDevices, listDmConversations } from './dm-core';
import {
  listCommunityPrefs,
  setCommunityPrefs,
  type CommunityPrefRow,
  type CommunityPrefsPatch,
} from './community-prefs';
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
} from './dm-provider-core';

const ONBOARDING_SETTING_KEY = 'onboarding_complete';
const LAST_COMMUNITY_SETTING_KEY = 'last_community_id';
const LAST_CHANNEL_SETTING_KEY = 'last_channel_id';

export type AddChannelResult = { ok: true } | { ok: false; error: string };

export interface RunRelaySessionInput {
  phrase: string;
  peerDeviceId: string;
  role: 'initiate' | 'listen';
}

export type SendChannelMessageResult =
  | { ok: true; event: ChannelMessageEvent }
  | { ok: false; error: string };

export type SetCommunityProfileResult =
  | { ok: true }
  | { ok: false; error: string };

export type PairFriendResult =
  | { ok: true; device: PairedDevice }
  | { ok: false; error: string };

/** A file the user picked in the composer, ready to seal + send as an attachment. */
export interface ComposerFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** Outcome of asking the message author to re-send a removed attachment. */
export type RequestFileAgainResult =
  | { ok: true; requestId: string; ownerDeviceId: string }
  | {
      ok: false;
      reason:
        | 'not_paired'
        | 'no_relay'
        | 'revoked'
        | 'not_a_member'
        | 'park_failed'
        | 'payment_required'
        | 'self_author';
    };

/** Outcome of an owner approving / declining an incoming file request. */
export type FileGrantResult =
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
        | 'park_failed'
        | 'payment_required';
    };

/** Real, DB-derived local-device counts shown in Settings. No fabricated peer
 *  or remote numbers: every figure is a count of rows present on THIS device. */
export interface StorageStats {
  communities: number;
  channels: number;
  messages: number;
  localFiles: number;
  localBytes: number;
}

/** A freshly generated recovery key plus the encrypted backup it unlocks. The
 *  key never leaves the device unless the user copies it; the sealed backup is
 *  useless without the key. */
export interface RecoveryMaterial {
  key: string;
  sealed: string;
}

/** Outcome of restoring an identity from a recovery key + encrypted backup. */
export type RestoreIdentityResult =
  | { ok: true }
  | { ok: false; reason: 'bad_key' | 'bad_backup' };

/** What a foreground drain actually moved (honest counts; no faked delivery). */
export interface ForegroundDrainResult {
  ran: boolean;
  applied: number;
  /** Inbound 1:1/group DM messages applied this drain (Plan 21 Phase 9). */
  appliedMessages: number;
  /** Inbound verified DM delivery/read receipts applied this drain. */
  dmReceipts: number;
  /** Inbound DM group epoch-commit handoffs applied this drain. */
  dmGroupCommits: number;
  /** Inbound DM shreds applied this drain (local rows deleted). */
  dmShreds: number;
  fileRequests: number;
  fileGrants: number;
  /** Invite join-request envelopes this device (the owner) served (real grants parked). */
  joinRequestsServed: number;
  /** Join-grant envelopes this device (a joiner) applied (now holds an epoch key). */
  joinGrantsApplied: number;
  /** PUBLIC-join request envelopes recorded into the local review queue (no key handed off). */
  publicJoinRequestsRecorded: number;
  /** Community member-removals this device applied (roster closed + epoch wrap stored, Plan 28). */
  memberRemovalsApplied: number;
  reason?: string;
}

export interface ReportCommunityContentInput {
  communityId: string;
  channelId?: string | null;
  targetKind: 'message' | 'post' | 'file';
  targetId: string;
  targetAuthorDeviceId?: string | null;
  targetLabel?: string | null;
  reason?: string | null;
}

/**
 * Outcome of a joiner parking a join-request for the owner (community feed P7).
 * SOURCE OF TRUTH: apps/meerkat/app/(root)/providers/SyncProvider.tsx
 * QueueJoinRequestResult. Replicated verbatim (App Isolation: never deep-import
 * the native provider). A request is parked ONLY on a real relay park.
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
        | 'park_failed'
        | 'payment_required';
    };

/** Honest counts from a P7 join-handoff drain (owner serve + joiner apply). */
export interface JoinHandoffDrainResult {
  ran: boolean;
  joinRequestsServed: number;
  joinGrantsApplied: number;
  /** PUBLIC-join request envelopes recorded into the local review queue (no key handed off). */
  publicJoinRequestsRecorded: number;
}

/**
 * Outcome of the owner approving a queued public-join request (Plan 19 FF3).
 * Wraps the engine's ApprovePublicJoinResult with one app-level reason
 * ('not_found') for a missing queue row or missing current publication row --
 * the engine itself only ever sees a well-formed request. ok:true means the
 * epoch-key grant really parked (approvePublicJoinRequest never returns ok:true
 * otherwise); the caller must not claim a join before that. SOURCE OF TRUTH:
 * native SyncProvider.ApprovePublicJoinRequestResult.
 */
export type ApprovePublicJoinRequestResult =
  | ApprovePublicJoinResult
  | { ok: false; reason: 'not_found' };

/**
 * Validated app-unlock status. 'cannot_verify' means a cached purchase claim
 * exists but could not be checked (not configured / identity unavailable /
 * network); private features stay locked in that state, but the UI must say so
 * honestly instead of claiming the user is not entitled.
 */
export type AppUnlockStatus = 'checking' | 'unlocked' | 'locked' | 'cannot_verify';

export interface AppUnlockView {
  status: AppUnlockStatus;
  /** Honest one-line explanation for 'cannot_verify' / a definitive negative; null otherwise. */
  detail: string | null;
  /** Re-run validation now (used by the retry affordances). */
  revalidate: () => void;
}

export interface HostedAccessState {
  hostedRelayUrl: string;
  hostedApiUrl: string;
  entitlementToken: string | null;
  setEntitlementToken: (token: string) => void;
  clearEntitlementToken: () => void;
  /** Fresh device-signed bearer for hosted billing and usage requests. */
  createAuthorization: () => string;
  relayRequiresPayment: (relayUrl: string) => boolean;
  canUseRelay: (relayUrl: string) => boolean;
}

/** The resolved input + result for the all-or-nothing template community commit.
 *  One source of truth lives in community-template-commit.ts; re-exported here so
 *  the context type reads locally. The UI resolves the template's themePresetId
 *  into `themeBlob` before calling. */
export type CreateFromTemplateInput = CommitCommunityTemplateInput;
export type CreateFromTemplateResult = CommitCommunityTemplateResult;

export interface MeerkatContextValue {
  identity: DeviceIdentity;
  fingerprint: string;
  displayName: string;
  updateDisplayName: (name: string) => Promise<void>;
  /** This node's current friend code (standard auto-generated or a custom one). */
  friendCode: string;
  /** True when friendCode is a user-chosen vanity code (vanity + random suffix). */
  friendCodeIsCustom: boolean;
  /**
   * Replace the friend code with a custom vanity code: makeVanityFriendCode adds
   * a random Crockford suffix so the total is always >= 12 chars and never the
   * standard 16-char shape. Stores it + its derived rendezvous id. Returns an
   * error string when the vanity is too short, else null.
   */
  setCustomFriendCode: (vanity: string) => string | null;
  /** Roll a fresh auto-generated standard friend code (drops any custom one). */
  regenerateFriendCode: () => void;
  /**
   * Publish this device's signed identity bundle under the CURRENT friend code so
   * a friend who types it can resolve + pair. Custom codes derive the rid via
   * @mylife/sync; standard codes use their embedded rid. Returns the display code
   * actually published. Throws on a missing/invalid relay or sync error.
   */
  publishFriendCode: (onPublished?: (receipt: PublishRendezvousReceipt) => void) => Promise<string>;
  /**
   * Resolve a friendly name for a message author from TRUSTED LOCAL sources only
   * (self -> "You as <community name>" when set, known member -> community name,
   * else the short fingerprint). Never derived from message contents. A name is
   * never proof of identity.
   */
  resolvePeerName: (communityId: string, deviceId: string) => string;
  setCommunityProfile: (
    communityId: string,
    displayName: string,
    avatarInitial?: string | null,
    avatarImage?: string | null,
  ) => SetCommunityProfileResult;
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
  communityDisplayName: (communityId: string, deviceId: string, fallbackName?: string) => string | null;
  communityAvatarInitial: (communityId: string, deviceId: string, fallbackName?: string) => string | null;
  /** The verified base64-JPEG community avatar for a member, or null (Plan 32). */
  communityAvatarImage: (communityId: string, deviceId: string) => string | null;
  communityProfile: (communityId: string, deviceId: string) => ReturnType<typeof getCommunityProfile>;
  // --- Community identity + per-community theme (Plan 38 Phase 1c) -----------
  /** The winning VERIFIED owner-signed community identity, or null (renders defaults). */
  communityIdentity: (communityId: string) => CommunityIdentityEvent | null;
  /** Owner-only: publish the community identity at the next revision. Wired to the
   *  engine record path so the signed row replicates like a profile. Throws (honest
   *  error) when the caller is not the owner. */
  publishCommunityIdentity: (
    communityId: string,
    fields: PublishCommunityIdentityFields,
  ) => CommunityIdentityEvent;
  /** Owner-only: clear the community identity back to defaults (signed tombstone). */
  tombstoneCommunityIdentity: (communityId: string) => CommunityIdentityEvent;
  /** The winning VERIFIED owner-signed layout event, or null (legacy rendering). */
  communityLayoutEvent: (communityId: string) => CommunityLayoutEvent | null;
  /** Owner-only (composition Phase 1): publish the composition document (a
   *  meerkat-layout codec blob) as one signed cm_layout revision. Throws
   *  (honest error) for a non-owner or malformed blob. */
  publishCommunityLayout: (communityId: string, layoutBlob: string) => CommunityLayoutEvent;
  /** Owner-only: clear the layout back to the classic rendering (signed tombstone). */
  tombstoneCommunityLayout: (communityId: string) => CommunityLayoutEvent;
  /** The engine recordChange rail (Plan 56 canvas writes ride it directly). */
  recordLocalChange: (
    table: string,
    operation: 'INSERT' | 'UPDATE',
    rowId: string,
    data: Record<string, unknown>,
  ) => void;
  /** Seal downscaled banner bytes under the community's current epoch, store the
   *  blocks locally, and return the signed-row banner descriptor. Owner path. */
  sealCommunityBanner: (communityId: string, bytes: Uint8Array) => Promise<CommunityIdentityBanner>;
  /** Open a community's banner from LOCAL blocks as a data URI, or null when it is
   *  not (fully) local / will not decrypt for this device (renders nothing extra). */
  communityBannerImage: (communityId: string) => Promise<string | null>;
  /** The member's per-community theme choice (device-local; default 'community'). */
  communityThemeMode: (communityId: string) => CommunityThemeMode;
  setCommunityThemeMode: (communityId: string, mode: CommunityThemeMode) => void;
  /**
   * The full trusted name map for a community (owner-signed descriptor members,
   * paired devices, and verified community profile events), so a list can
   * resolve every author in one pass instead of rebuilding the map per row.
   */
  communityPeerNames: (communityId: string) => Map<string, string>;
  onboardingComplete: boolean;
  completeOnboarding: (name?: string) => Promise<void>;
  engine: NativeSyncEngine;
  db: BrowserDatabaseAdapter;
  /** The on-device raw-bytes blob store wired into the engine's blob phase.
   *  Slice-4B file methods read/write attachment bytes through this. */
  blobStore: BrowserBlobStore;
  /** The sealed-block NodeStore (OPFS/IndexedDB) the library layer seals into and
   *  fetches from. Plan 38: the browse/ingest UI passes this to library-store. */
  nodeStore: BrowserNodeStore;
  /** The auto-created personal workspace id backing the "My Library" hub (Plan 38,
   *  personal-first). Null only before boot resolves. */
  personalWorkspaceId: string | null;
  status: SyncEngineStatus;
  relayUrl: string;
  setRelayUrl: (url: string) => void;
  /** Whether the user turned the free default connection server off (Plan 20, AC-4). */
  defaultRelayOptedOut: boolean;
  setDefaultRelayOptedOut: (optedOut: boolean) => void;
  /** Whether this build ships a free default connection server URL at all. */
  defaultRelayConfigured: boolean;
  hostedAccess: HostedAccessState;
  /** Validated app-unlock state (single source of truth for the shell + settings). */
  appUnlock: AppUnlockView;
  createCommunity: (name: string) => SignedCommunityDescriptor;
  /**
   * Owner path (Plan 38 Phase 7, amendment C.1): create a community from a
   * template in ONE all-or-nothing commit -- the genesis descriptor (chat
   * channels + categories + layout), every library channel + its owner-signed
   * cm_libraries row, and the community identity (theme/accent/description) are
   * staged inside a single db transaction. Any failure rolls the whole thing
   * back so nothing persists, and returns an honest error. The UI resolves the
   * template's themePresetId into the codec themeBlob before calling.
   */
  createCommunityFromTemplate: (input: CreateFromTemplateInput) => CreateFromTemplateResult;
  joinFromLink: (link: string) => JoinCommunityResult;
  /**
   * Joiner side (community feed P7): after joinFromLink, seal + park a
   * join-request for the community OWNER on the owner's community-derived join
   * token. The owner serves a grant on its next drain; runJoinHandoffDrain
   * applies it (giving this device an epoch key + descriptor membership). Returns
   * ok ONLY on a real park. Pass the raw invite link (it carries the owner
   * descriptor). SOURCE OF TRUTH: native SyncProvider.queueJoinRequest.
   */
  queueJoinRequest: (link: string) => Promise<QueueJoinRequestResult>;
  /**
   * Run the P7 join handoff over the relay: drain my own community join tokens
   * (owner: serve incoming join-requests; pending joiner: apply the owner's
   * grant). Best-effort; a no-op with no relay configured. Honest counts only.
   * SOURCE OF TRUTH: native SyncProvider.runForegroundDrain (join slice).
   */
  runJoinHandoffDrain: () => Promise<JoinHandoffDrainResult>;
  /**
   * Owner side (Plan 19 FF3): approve a queued public-join request recorded by
   * runJoinHandoffDrain (via recordPublicJoinRequests). Loads the queue row,
   * reconstructs this device's CURRENT owner-signed publication descriptor for
   * publicationId, and calls the @mylife/sync approvePublicJoinRequest engine
   * function (add member + park the epoch-key grant through the shared
   * invite-path rail). On ok:true the queue row flips to 'approved'; on
   * ok:false the row stays 'pending' so a transient failure (e.g. 'not_parked'
   * with no relay reachable) can be retried later. Never claims a join before
   * the engine reports ok:true. SOURCE OF TRUTH: native
   * SyncProvider.approvePublicJoinRequestById.
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
   * SOURCE OF TRUTH: native SyncProvider.removeCommunityMemberById.
   */
  removeCommunityMemberById: (
    communityId: string,
    removedDeviceId: string,
  ) => Promise<RemoveCommunityMemberResult>;
  createInviteLink: (communityId: string) => string | null;
  addChannel: (communityId: string, name: string, kind?: 'chat' | 'canvas') => AddChannelResult;
  /** Plan 56 C1 (4.4): promote a member page to a 'page'-kind tab / demote it.
   *  ONE owner-signed revision; writes locally only (members re-join to see it,
   *  exactly like addChannel). Throws honest errors for non-owners. */
  promotePageChannel: (communityId: string, canvasId: string, tabName: string) => void;
  demotePageChannel: (communityId: string, canvasId: string) => void;
  /**
   * Owner-only (Plan 38 Phase 2): commit a full channel-manager edit as ONE
   * signed descriptor revision. All draft edits (create/rename/reorder/topic/
   * category/archive) are batched by the caller and land in a single
   * reviseCommunity, so a save never fans out into many revisions. Like
   * addChannel this writes LOCALLY only: existing members pick the change up by
   * rejoining from a fresh invite link (descriptors do not auto-sync).
   */
  saveCommunityOrganization: (
    communityId: string,
    changes: { channels: CommunityChannel[]; categories: CommunityChannelCategory[] },
  ) => AddChannelResult;
  /** Owner-only (Plan 27 P4, item 13): set the community transport policy as ONE
   *  signed revisePolicy revision + record it into the observed ledger. Members
   *  converge on the newer descriptor; this writes locally and never claims a push. */
  setCommunityTransportPolicy: (communityId: string, policy: CommunityTransportPolicy) => AddChannelResult;
  /** Owner-only (Plan 38 Phase 7, G10/B.1): set the community presentation layout
   *  in ONE reviseCommunity revision. library_first opens the community on its
   *  Libraries home; chat_first is the default. Presentation only -- no data
   *  moves and no other field changes. */
  setCommunityLayout: (communityId: string, layout: CommunityLayout) => AddChannelResult;
  /** Device-local Communities-list organization rows (pin / manual sort / folder). */
  communityPrefs: () => CommunityPrefRow[];
  /** Merge a change into one community's device-local list pref (never synced). */
  setCommunityPref: (communityId: string, patch: CommunityPrefsPatch) => void;
  /** Assign a manual sort_index to each community by its position in orderedIds. */
  reorderCommunities: (orderedIds: string[]) => void;
  leaveCommunity: (communityId: string) => void;
  listCommunities: () => StoredCommunity[];
  listChannelMessages: (communityId: string, channelId: string) => ChannelMessageEvent[];
  listChannelPostCards: (communityId: string, channelId: string) => ChannelPostCard[];
  listChannelPostThread: (
    communityId: string,
    channelId: string,
    postId: string,
  ) => ChannelPostThread | null;
  sendChannelMessage: (
    communityId: string,
    channelId: string,
    body: string,
    opts?: SendMessageOpts,
  ) => SendChannelMessageResult;
  sendChannelPost: (communityId: string, channelId: string, body: string) => SendChannelMessageResult;
  replyToPost: (parent: ChannelMessageEvent, body: string) => SendChannelMessageResult;
  /**
   * Verified, safety-filtered reaction groups keyed by the reacted-to event id
   * (Plan 30). Never a fabricated chip; every group derives from a signed react
   * event this device holds locally.
   */
  channelReactions: (communityId: string, channelId: string) => Map<string, MessageReactionGroup[]>;
  /** React to a target message/post with one emoji (rides the same record+refresh
   *  path as a message, so the open channel re-reads with a real local echo). */
  sendReaction: (
    communityId: string,
    channelId: string,
    target: { eventId: string; postId?: string },
    emoji: string,
  ) => SendChannelMessageResult;
  /** Un-react by tombstoning this device's own prior reaction event. */
  removeReaction: (
    communityId: string,
    channelId: string,
    myEventId: string,
  ) => SendChannelMessageResult;
  /**
   * Seal each picked file into the on-device blob store, build signed
   * ChannelMessageAttachment metadata, and record a single signed channel
   * message carrying all of them. Bytes ride the engine blob phase on the next
   * session; nothing is sent here. An empty body is allowed when files are
   * present.
   */
  attachAndSend: (
    communityId: string,
    channelId: string,
    body: string,
    files: ComposerFile[],
    opts?: SendMessageOpts,
  ) => Promise<SendChannelMessageResult>;
  editMessage: (event: ChannelMessageEvent, body: string) => SendChannelMessageResult;
  deleteMessage: (event: ChannelMessageEvent) => SendChannelMessageResult;
  /** Write this channel's read marker to the newest event. Web-only: writes the
   *  cm_read_state row LOCALLY and never records it through the engine. */
  markChannelRead: (communityId: string, channelId: string) => void;
  /** Advance the read cursor to the newest VISIBLE event, passing its author so
   *  the (wall,counter,author) tiebreak is live (Plan 30 m3). Screen-owned: called
   *  only while the newest message is on screen so scrolled-up arrivals stay unread. */
  markChannelReadLatest: (communityId: string, channelId: string) => void;
  /** The last-read boundary for a channel, or null on a first visit (anchors the
   *  "New messages" divider; the screen snapshots it on focus BEFORE advancing). */
  channelReadBoundary: (communityId: string, channelId: string) => ReadBoundary | null;
  unreadCount: (communityId: string, channelId: string) => number;
  communityUnreadCounts: (communityId: string) => Record<string, number>;
  /** This device's authenticated pairing payload, as JSON for out-of-band copy. */
  myPairingPayload: () => string;
  pairFromPayload: (json: string) => PairFriendResult;
  /** Resolve a friend's code from the configured relay and pair with TOFU pinning. */
  pairWithFriendCode: (code: string) => Promise<PairFriendResult>;
  /** The five-emoji safety code for a paired friend, derived from the shared secret. */
  getPeerSas: (peerDeviceId: string) => SasResult | null;
  /** Whether this friend has been safety-code checked on this device. */
  isPeerSasVerified: (peerDeviceId: string) => boolean;
  /** Record that this friend's safety code matched out of band. */
  confirmPeerSas: (peerDeviceId: string) => boolean;
  /** Whether this peer is locally blocked/revoked. */
  isPeerRevoked: (peerDeviceId: string) => boolean;
  /** Block/revoke a peer locally so future sync handshakes reject it here. */
  revokePeer: (peerDeviceId: string, reason?: string) => void;
  pairedDevices: () => PairedDevice[];
  recentSessions: () => SyncSession[];
  runRelaySession: (input: RunRelaySessionInput) => Promise<SyncSession | null>;
  /**
   * Pull this community's feed NOW (community feed P5). Tries the configured
   * community-node http(s) host via the browser fetch and returns the REAL
   * source + applied count. Web has no peer-backfill queue wired, so this omits
   * enqueuePeerBackfill: with no node it honestly reports 'no host reachable',
   * and a node that rejects this device reports 'removed'. Bumps `revision` when
   * applied > 0 so the feed re-renders.
   */
  refreshFeed: (communityId: string) => Promise<RefreshCommunityFeedResult>;
  /** Per-member auto-update preference (personal, never synced). Default OFF. */
  getAutoUpdate: (communityId: string) => boolean;
  setAutoUpdate: (communityId: string, on: boolean) => void;
  /** Local-only community safety state. Never claims remote moderation. */
  isCommunityMuted: (communityId: string) => boolean;
  setCommunityMuted: (communityId: string, muted: boolean, label?: string) => void;
  isChannelMuted: (communityId: string, channelId: string) => boolean;
  setChannelMuted: (communityId: string, channelId: string, muted: boolean, label?: string) => void;
  isCommunityPersonBlocked: (communityId: string, deviceId: string) => boolean;
  setCommunityPersonBlocked: (communityId: string, deviceId: string, blocked: boolean, label?: string) => void;
  blockCommunityPerson: (communityId: string, deviceId: string, label?: string) => void;
  reportCommunityContent: (input: ReportCommunityContentInput) => void;
  ownerReviewItems: (communityId: string) => CommunitySafetyActionRow[];
  /**
   * D.2: 'reviewed' acknowledges but KEEPS the content hidden (stays in the queue
   * with a "Reviewed - still hidden" pill); 'dismissed' un-hides it for this device
   * and removes it from the queue. Defaults to 'reviewed'.
   */
  markSafetyReviewed: (id: string, status?: 'reviewed' | 'dismissed') => void;
  /** The real time of the last SUCCESSFUL node pull, or null (never pulled). */
  getLastPulledAt: (communityId: string) => string | null;
  // --- Slice 4 (files) -------------------------------------------------------
  /** Raw verified plaintext bytes for a blob hash, or null when absent locally. */
  getBlob: (hash: string) => Promise<Uint8Array | null>;
  /** Free this device's local copy of a blob (ref-count aware, local-only). */
  removeLocalBlob: (hash: string) => Promise<import('./storage/blob-store-core').RemoveBlobResult>;
  /** Is the blob on this device right now (live IndexedDB check, never cached). */
  hasBlob: (hash: string) => Promise<boolean>;
  /** Image data: URI for a present blob, or null when absent. */
  blobPreviewDataUri: (hash: string, mimeType: string) => Promise<string | null>;
  /** Per-community file index aggregated from signed, resolved messages, with
   *  live on-device presence resolved (a real has() pass, never a cached flag). */
  listChannelFiles: (communityId: string) => Promise<PresentFile[]>;
  /** The live outgoing request row for an attachment slot, if any. */
  outgoingRequestFor: (communityId: string, channelId: string, attachmentId: string) => FileRequestRow | null;
  /** Open incoming requests awaiting this owner's Approve/Decline. */
  incomingFileRequests: (communityId: string) => FileRequestRow[];
  /** Requester side: seal + park a FILE_REQUEST to the message author. */
  requestFileAgain: (event: ChannelMessageEvent, attachment: ChannelMessageAttachment) => Promise<RequestFileAgainResult>;
  /**
   * Fields-based twin of {@link requestFileAgain} for callers that hold only the
   * aggregated file-row primitives (the Files index, D.1). Same gates + honest
   * row-on-real-park path.
   */
  requestFileAgainByFields: (input: {
    communityId: string;
    channelId: string;
    messageId: string;
    attachmentId: string;
    blobHash: string;
    ownerDeviceId: string;
  }) => Promise<RequestFileAgainResult>;
  /** Owner side: approve an incoming request, re-verify bytes, park the grant. */
  approveFileRequest: (requestId: string) => Promise<FileGrantResult>;
  /** Owner side: decline an incoming request and park the decline. */
  declineFileRequest: (requestId: string) => Promise<FileGrantResult>;
  // --- Direct messages (Plan 21 Phase 9) ------------------------------------
  // Every method drives the SAME pure @mylife/sync + dm-provider-core path the
  // mobile SyncProvider uses (byte-identical cores). Honest by construction: a
  // message is 'parked' only on a real relay park; 'delivered'/'read' come only
  // from a verified signed receipt the drain applies. dm_ never replicates.
  /** Build + locally echo a signed DM, then seal + park it to the peer's devices
   *  (and this user's own linked devices). Honest no-relay no-op. */
  queueDmMessage: (
    conversationId: string,
    body: string,
    attachments?: DmMessageAttachment[],
  ) => Promise<QueueDmMessageResult>;
  /** Seal + park a signed delivery/read receipt to the message author (honors the
   *  conversation's read-receipts-enabled flag for 'read'). */
  queueDmReceipt: (
    conversationId: string,
    messageId: string,
    state: DmReceiptState,
  ) => Promise<QueueDmReceiptResult>;
  /** Shred (delete-for-everyone) my own DM messages via a signed DM_SHRED. */
  queueDmShred: (conversationId: string, messageIds: string[]) => Promise<QueueDmShredResult>;
  /** Record another device of THIS user as a DM mirror target (own-device convergence). */
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
  /** Create a group DM (this device is the admin) + hand off epoch 1. */
  createDmGroup: (title: string, members: DmGroupMember[]) => Promise<CreateDmGroupCoreResult>;
  /** Add a member to a group DM (admin-only). */
  dmGroupAddMember: (conversationId: string, added: DmGroupMember) => Promise<DmGroupMutationCoreResult>;
  /** Remove a member from a group DM (admin-only; rotates the epoch). */
  dmGroupRemoveMember: (conversationId: string, removedDeviceId: string) => Promise<DmGroupMutationCoreResult>;
  /** Block a DM participant (a real local revocation). */
  blockDmParticipant: (deviceId: string, reason?: string) => void;
  /** Record a local DM report (dm_reports). Nothing is sent. */
  reportDm: (input: ReportDmInput) => void;
  /** Run the REAL mailbox drain in the foreground (best-effort, honest counts). */
  runForegroundDrain: () => Promise<ForegroundDrainResult>;
  /**
   * Live-wake seam (docs/plans/features/meerkat/live-wake.md): what the
   * persistent mailbox listeners need, each resolved fresh from the current
   * closure so the engine never holds a stale handler set.
   */
  liveWake: {
    relayUrl: () => Promise<string | null>;
    entitlementToken: () => string | undefined;
    peers: () => MailboxDrainPeer[];
    extraTokens: () => { token: string; label: string }[];
    handlers: () => MailboxEnvelopeHandlers;
    onApplied: () => void;
  };
  /** Whether automatic dialing is opted in on this device (default off). */
  autoConnectEnabled: boolean;
  /** Toggle automatic dialing (Plan 29). Opt-in only. */
  setAutoConnect: (enabled: boolean) => void;
  /** The last real composed round summary, or null when none has run. */
  lastAutoConnectRound: AutoConnectRoundSummary | null;
  lastAutoConnectError: string | null;
  /**
   * Run ONE shared foreground round: the mailbox drain, then the auto-connect
   * session sync over real recorded sessions (+ gossip once the engine seam
   * lands). Best-effort and honest: real sessions only, never a fabricated dial.
   */
  autoConnectRound: (trigger: AutoConnectTrigger) => Promise<AutoConnectRoundOutcome>;
  lastSession: SyncSession | null;
  lastSessionError: string | null;
  /** The last community/channel the user was viewing, persisted to mk_settings. */
  lastCommunityId: string | null;
  lastChannelId: string | null;
  rememberLocation: (communityId: string | null, channelId: string | null) => void;
  // --- Slice 5 (settings) ----------------------------------------------------
  /** True when the @mylife/sync secret store is wired (device keys are stored in
   *  this browser's secure storage). Read straight from the sync package. */
  secureStorageConfigured: boolean;
  /** Real, DB-derived local-device counts (communities, channels, messages,
   *  files on this device). Never a fabricated remote or peer figure. */
  storageStats: () => StorageStats;
  /** Generate a printable recovery key and the encrypted identity backup it
   *  unlocks. Nothing is persisted or sent; the recoverable material is real and
   *  proven, and restoreIdentity below brings it back on a fresh install. */
  generateRecovery: () => RecoveryMaterial;
  /**
   * Restore this device's identity from a recovery key + its encrypted backup
   * (Plan 23 / AM8). Full flow: decrypt + verify the export, write the private
   * keys to the browser secure store (openAndRestore), persist mk_identity, mint
   * a fresh friend code, mark onboarding complete, flush both stores, then reload
   * on the restored identity. Fail-closed: a wrong key or a tampered/corrupt/
   * inconsistent backup returns an honest reason and changes nothing.
   */
  restoreIdentity: (recoveryKey: string, sealedBackup: string) => Promise<RestoreIdentityResult>;
  /** Permanently discard the current identity and reload the app on a brand new
   *  one (create-then-swap, never delete-then-create). The old identity is gone
   *  and cannot be recovered. */
  resetIdentity: () => Promise<void>;
  /**
   * B.2 "Delete my data": wipe EVERYTHING this browser stored (identity, content,
   * communities, direct messages, settings, secret keys) and reload into a clean
   * first-run. Best-effort + idempotent; deletes only local data (anything already
   * synced to a peer stays on their device).
   */
  deleteMyData: (deleteRemoteStorageData: boolean) => Promise<void>;
  /**
   * Delete a single secret from the browser vault by its ref. Used by the public-persona
   * GDPR delete to remove the persona seed immediately (best-effort). No-op if the store
   * cannot delete.
   */
  deleteSecret: (ref: string) => void;
  /** Credential-only access for storage adapters. Secret values never enter SQLite. */
  storageSecretAccess: BrowserStorageSecretAccess;
  /** Monotonic counter bumped after any state-changing write, to drive re-renders. */
  revision: number;
  refresh: () => void;
}

/**
 * Settings key prefix for a PENDING join's invite link (P7).
 * SOURCE OF TRUTH: apps/meerkat/app/(root)/providers/SyncProvider.tsx
 * PENDING_JOIN_LINK_PREFIX. Keep the value in lockstep across both surfaces.
 */
const PENDING_JOIN_LINK_PREFIX = 'pending_join_link:';

/**
 * Park an already-sealed envelope on a relay mailbox token (fresh backend per
 * park). Returns true ONLY on a real park, so the join request/grant counts stay
 * honest. SOURCE OF TRUTH: native SyncProvider.parkEnvelopeOnRelay.
 */
async function parkEnvelopeOnRelay(
  relayUrl: string,
  token: string,
  envelope: MailboxEnvelope,
  entitlementToken?: string,
): Promise<boolean> {
  if (!relayUrl.startsWith('ws')) return false;
  const backend = new WebSocketRelayBackend();
  try {
    const session = await backend.connect(relayUrl, token, { entitlementToken });
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
}

const MeerkatContext = createContext<MeerkatContextValue | null>(null);

export function useMeerkat(): MeerkatContextValue {
  const ctx = useContext(MeerkatContext);
  if (!ctx) throw new Error('useMeerkat must be used within MeerkatProvider');
  return ctx;
}

interface Boot {
  db: BrowserDatabaseAdapter;
  secrets: BrowserSecretStore;
  identity: DeviceIdentity;
  engine: NativeSyncEngine;
  blobStore: BrowserBlobStore;
  nodeStore: BrowserNodeStore;
}

function storageSecretAccess(secrets: BrowserSecretStore): BrowserStorageSecretAccess {
  return {
    get: (ref) => secrets.getSecret(ref),
    set: (ref, value) => secrets.setSecret(ref, value),
    delete: (ref) => { secrets.deleteSecret?.(ref); },
    flush: () => secrets.flush(),
  };
}

/**
 * Resolve (or first-launch create) the device identity with the MK-001 web
 * durability guarantee. The native MK-001 fix relies on the OS keychain being
 * synchronous + durable; on web both stores persist on a debounce, so a freshly
 * created identity tab-closed inside that window would ORPHAN the device keys
 * (the private key parked only in the secret store's in-memory Map, the row
 * pointing at an unflushed ref). The fix: flush BOTH stores BEFORE proceeding.
 *
 * Flush ORDER matters: secrets first (the private key bytes), then db (the row
 * that references them), so a crash between flushes never leaves a row pointing
 * at an unflushed key.
 */
export async function resolveOrCreateIdentity(
  db: BrowserDatabaseAdapter,
  secrets: BrowserSecretStore,
): Promise<DeviceIdentity> {
  const row = getIdentityRow(db);
  if (row) {
    // Half-state detection: an identity row whose signing key is gone from the
    // vault (a clobbered or re-keyed vault) means NOTHING can be signed. Fail
    // the boot with the typed recovery error instead of letting every later
    // sign attempt throw "Sync signing private key is unavailable" deep in the
    // engine with no surfaced path out.
    if (secrets.getSecret(row.private_key_ref) === null) {
      throw new SecretVaultUnreadableError(
        'signing_key_missing',
        'This browser has a Meerkat identity, but its signing key is missing from the encrypted vault.',
      );
    }
    return {
      publicKey: row.public_key,
      privateKeyRef: row.private_key_ref,
      dhPublicKey: row.dh_public_key,
      displayName: row.display_name,
      createdAt: row.created_at,
    };
  }
  const created = generateDeviceIdentity(DEFAULT_DISPLAY_NAME);
  saveIdentityRow(db, {
    public_key: created.publicKey,
    dh_public_key: created.dhPublicKey,
    private_key_ref: created.privateKeyRef,
    display_name: created.displayName,
    created_at: created.createdAt,
  });
  // MK-001 DURABILITY: flush BOTH stores before the engine/UI can touch the keys.
  await secrets.flush();
  await db.flush();
  return created;
}

/**
 * Resolve (or first-launch create) this node's friend code. Mirrors the native
 * IdentityProvider.loadOrCreateFriendCode: an auto-generated standard code on
 * first use, persisted with its 8-byte rendezvous id. All entropy + the rid come
 * from @mylife/sync (generateFriendCode); this app owns no cryptography.
 */
function loadOrCreateFriendCode(db: BrowserDatabaseAdapter): FriendCodeState {
  const existing = getFriendCode(db);
  if (existing) return existing;
  const { code, rendezvousId } = generateFriendCode();
  saveFriendCode(db, code, rendezvousId, false);
  return { code, isCustom: false };
}

/**
 * D.5: load this device's persistent rendezvous seal secret half, creating and
 * persisting one on first use. Hex-encoded in mk_settings; never transmitted to
 * the relay (only shared as part of the extended friend code). Mirrors mobile.
 */
function loadOrCreateFriendCodeSecret(db: BrowserDatabaseAdapter): Uint8Array {
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

export function MeerkatProvider({
  children,
  bootOptions,
}: {
  children: React.ReactNode;
  /** Node tests inject the sql.js `locateFile`. Omitted in the browser. */
  bootOptions?: BootBrowserSyncOptions;
}) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [databaseForRecovery, setDatabaseForRecovery] = useState<BrowserDatabaseAdapter | null>(null);
  const [ownershipError, setOwnershipError] = useState<DatabaseOwnershipError | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [lastSession, setLastSession] = useState<SyncSession | null>(null);
  const [lastSessionError, setLastSessionError] = useState<string | null>(null);
  const [relayUrl, setRelayUrlState] = useState<string>(DEFAULT_RELAY_URL);
  // Free-default opt-out (Plan 20). effectiveRelayUrl(db) reads default_relay_optout
  // so toggling this off stops every dial of the free default (AC-4).
  const [defaultRelayOptedOut, setDefaultRelayOptedOutState] = useState<boolean>(false);
  const [displayName, setDisplayNameState] = useState<string>('');
  const [friendCode, setFriendCodeState] = useState<string>('');
  const [friendCodeIsCustom, setFriendCodeIsCustom] = useState<boolean>(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean>(false);
  const [lastCommunityId, setLastCommunityId] = useState<string | null>(null);
  const [lastChannelId, setLastChannelId] = useState<string | null>(null);
  const [personalWorkspaceId, setPersonalWorkspaceId] = useState<string | null>(null);
  const [hostedEntitlementToken, setHostedEntitlementTokenState] = useState<string | null>(() =>
    getCachedHostedEntitlementToken(),
  );
  // Auto-connect (Plan 29, item 12): opt-in flag + honest last-round snapshot.
  // Seeded from the db once boot lands (both are device-local mk_settings rows).
  const [autoConnectEnabled, setAutoConnectEnabledState] = useState<boolean>(false);
  const [lastAutoConnectError, setLastAutoConnectError] = useState<string | null>(null);
  const [lastAutoConnectRound, setLastAutoConnectRound] = useState<AutoConnectRoundSummary | null>(null);
  // Validated app-unlock machine (Plan 22 hardening, 2026-08-30). Four honest
  // states instead of a boolean derived from the cache: 'checking' (a cached
  // claim is being re-validated), 'unlocked' (server-verified this session),
  // 'locked' (no claim, or a definitive negative), 'cannot_verify' (a cached
  // claim exists but validation could not run: not configured, identity
  // unavailable, or network failure). Private features stay LOCKED in
  // 'cannot_verify' (fail-closed, NC-2), but the UI can now say so honestly
  // with a retry instead of conflating it with not-entitled.
  const [appUnlockStatus, setAppUnlockStatus] = useState<AppUnlockStatus>(() =>
    getCachedAppUnlock()?.unlocked === true ? 'checking' : 'locked',
  );
  const [appUnlockDetail, setAppUnlockDetail] = useState<string | null>(null);
  const appUnlockSeqRef = useRef(0);
  const appUnlocked = appUnlockStatus === 'unlocked';
  const [bootRecovery, setBootRecovery] = useState<SecretVaultUnreadableError | null>(null);
  // Honest surface for a failing background secret persist (null = healthy).
  const [secretPersistFailure, setSecretPersistFailure] = useState<string | null>(null);
  const bootRef = useRef<Boot | null>(null);
  const liveWakeDepsRef = useRef<MeerkatContextValue['liveWake'] | null>(null);
  const liveWakeEngineRef = useRef<MailboxListenEngine | null>(null);
  // Latest autoConnectRound (defined inside the value memo). The visibility
  // trigger reads it through this ref so the effect never re-subscribes per round.
  const autoConnectRoundRef = useRef<((trigger: AutoConnectTrigger) => Promise<unknown>) | null>(null);

  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  /**
   * Re-validate the cached unlock claim against the hosted API. Seq-guarded so
   * a stale in-flight validation can never overwrite a newer answer. Loop-free
   * by construction: cache-change notifications ADOPT the cached value (every
   * in-session cache write is a real server answer) and never re-fetch.
   */
  const revalidateAppUnlock = useCallback((): void => {
    const seq = ++appUnlockSeqRef.current;
    const cached = getCachedAppUnlock();
    if (!cached?.unlocked) {
      setAppUnlockStatus('locked');
      setAppUnlockDetail(null);
      return;
    }
    if (!HOSTED_API_URL.trim()) {
      setAppUnlockStatus('cannot_verify');
      setAppUnlockDetail(
        'A purchase is saved in this browser, but this build has no connection server configured to verify it. Private features stay locked until it can be verified.',
      );
      return;
    }
    let authorization: string;
    try {
      const current = bootRef.current;
      if (!current) throw new Error('Meerkat identity is not ready.');
      authorization = createHostedAuthBearer(current.identity);
    } catch {
      setAppUnlockStatus('cannot_verify');
      setAppUnlockDetail(
        'A purchase is saved in this browser, but the local identity needed to verify it is not available. Private features stay locked until verification succeeds.',
      );
      return;
    }
    setAppUnlockStatus('checking');
    setAppUnlockDetail(null);
    void fetchAppUnlockState(authorization, undefined, cached.grant)
      .then((state) => {
        if (appUnlockSeqRef.current !== seq) return;
        if (state.unlocked) {
          setAppUnlockStatus('unlocked');
          setAppUnlockDetail(null);
        } else {
          clearCachedAppUnlock();
          setAppUnlockStatus('locked');
          setAppUnlockDetail('Your purchase is no longer active on this account.');
        }
      })
      .catch(() => {
        if (appUnlockSeqRef.current !== seq) return;
        setAppUnlockStatus('cannot_verify');
        setAppUnlockDetail(
          'Your saved purchase could not be verified right now (the connection server did not answer). Private features stay locked until verification succeeds.',
        );
      });
  }, []);

  // Adopt cache changes. During a session the cache is written ONLY from real
  // server answers (fetchAppUnlockState / redeemAppUnlockLink) or an explicit
  // clear, so adopting is honest and cannot loop (no re-fetch on notify).
  useEffect(
    () => subscribeCachedAppUnlock(() => {
      ++appUnlockSeqRef.current;
      const cached = getCachedAppUnlock();
      setAppUnlockStatus(cached?.unlocked === true ? 'unlocked' : 'locked');
      setAppUnlockDetail(null);
    }),
    [],
  );

  // Validate the cached claim once the identity is available (the bearer needs
  // it); before boot the status stays 'checking' rather than a false negative.
  useEffect(() => {
    if (boot) revalidateAppUnlock();
  }, [boot, revalidateAppUnlock]);

  // Surface secret-store persist failures (backoff + honest banner, 2026-08-30).
  useEffect(() => {
    if (!boot) return undefined;
    setSecretPersistFailure(boot.secrets.getPersistFailure());
    return boot.secrets.subscribePersistFailure(() => {
      setSecretPersistFailure(boot.secrets.getPersistFailure());
    });
  }, [boot]);

  const setHostedEntitlementToken = useCallback((token: string): void => {
    const trimmed = token.trim();
    if (!trimmed) return;
    setCachedHostedEntitlementToken(trimmed);
    setHostedEntitlementTokenState(trimmed);
  }, []);

  const clearHostedEntitlementToken = useCallback((): void => {
    clearCachedHostedEntitlementToken();
    setHostedEntitlementTokenState(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let builtEngine: NativeSyncEngine | null = null;
    // Meerkat's on-device crypto (identity keys, the encrypted secret store) needs
    // WebCrypto SubtleCrypto, which browsers expose ONLY in a secure context
    // (HTTPS, or http on localhost/127.0.0.1). Over plain http on a LAN IP,
    // crypto.subtle is undefined and the secret store throws during boot; without
    // this guard the boot promise rejects unhandled and the app hangs on "Booting
    // Meerkat…" forever. Fail fast with honest guidance instead.
    if (typeof globalThis.isSecureContext === 'boolean' && !globalThis.isSecureContext
      || !globalThis.crypto?.subtle) {
      setBootError(
        'Meerkat needs a secure connection. Open it over HTTPS, or on http://localhost or http://127.0.0.1. '
        + 'Browsers only allow the on-device encryption Meerkat depends on in a secure context.',
      );
      return () => { cancelled = true; };
    }
    void (async () => {
      try {
      const wired = await bootBrowserSync(bootOptions);
      if (cancelled) return;
      setDatabaseForRecovery(wired.db);
      const identity = await resolveOrCreateIdentity(wired.db, wired.secrets);
      // Plan 38 (personal-first): ensure the auto personal workspace exists for
      // this device so the "My Library" hub works with zero communities.
      const personalId = ensurePersonalWorkspace(wired.db, identity);
      await wired.db.flush();
      if (!cancelled) setPersonalWorkspaceId(personalId);
      // Slice 4: the real browser blob store backs the engine's blob phase and
      // is exposed on the context so slice-4B file methods can read/write bytes.
      const blobStore = new BrowserBlobStore(wired.db);
      const engine = new NativeSyncEngine({
        db: wired.db,
        identity,
        modulePrefixes: MEERKAT_SYNC_PREFIXES,
        // MEERKAT_KEYS_MODULE_ID carries the community epoch-key wraps (community
        // feed P0): enabling it lets the engine replicate the group keys members
        // need to decrypt the feed.
        enabledModules: [MEERKAT_SYNC_MODULE_ID, COMMUNITY_MODULE_ID, MEERKAT_KEYS_MODULE_ID],
        modulePolicies: MEERKAT_SYNC_POLICIES,
        isOwnDevice: (peerId) => isMeerkatOwnSyncDevice(wired.db, identity.publicKey, peerId),
        // Use the plain-JSON LWW document manager so the web node speaks the
        // SAME CRDT wire format as native Meerkat nodes (which resolve
        // document-manager.native.ts = LwwDocumentManager) and as other web
        // nodes. The default Automerge DocumentManager would produce an
        // incompatible binary snapshot the relay session cannot scope-filter.
        documentManager: new LwwDocumentManager() as unknown as ConstructorParameters<
          typeof NativeSyncEngine
        >[0]['documentManager'],
        blobProvider: blobStore,
        // Plan 27/28 P4 (item 10, AM11): enable the session gossip phase so every
        // session (including the composed auto-connect foreground round) exchanges
        // signed revocations + community descriptors and reconciles the roster,
        // converging a revocation or member-removal issued anywhere across the mesh.
        gossip: true,
      });
      await engine.initialize();
      builtEngine = engine;
      // Seed the in-memory LWW document with any existing channel messages so
      // the first outbound session carries existing rows (mirrors SyncProvider).
      seedExistingMessages(wired.db, engine);
      // D.3 one-time local reconciliation: rewrite any legacy file report rows to
      // the canonical `${channelId}:${attachmentId}` target id so files reported
      // before the canonical helper existed stay hidden. Idempotent + safe on a
      // fresh install (a no-op once every file row is canonical).
      try {
        reconcileCommunityFileReportTargets(wired.db);
      } catch {
        // cm_safety_actions may not exist yet on a brand-new install; harmless.
      }
      if (cancelled) {
        await engine.destroy();
        return;
      }
      const built: Boot = { db: wired.db, secrets: wired.secrets, identity, engine, blobStore, nodeStore: wired.nodeStore };
      bootRef.current = built;
      setRelayUrlState(effectiveRelayUrl(wired.db));
      setDefaultRelayOptedOutState(getSetting(wired.db, DEFAULT_RELAY_OPTOUT_KEY) === '1');
      // Plan 20: write a real /healthz probe for the effective candidate so the
      // health gate can flip the free default from "waiting" to dialed, then
      // refresh the displayed URL (closes the Phase-0 P2-1 staleness). Honest:
      // only a real probe result is recorded; never an optimistic flag.
      void (async () => {
        const cfg = getSetting(wired.db, RELAY_URL_SETTING_KEY)?.trim() ?? '';
        const oo = getSetting(wired.db, DEFAULT_RELAY_OPTOUT_KEY) === '1';
        const candidate = cfg || (oo ? '' : DEFAULT_RELAY_URL);
        if (candidate) {
          const [health] = await probeRelays({ candidates: [candidate] });
          if (health && !cancelled) writeRelayProbe(wired.db, health);
        }
        if (!cancelled) setRelayUrlState(effectiveRelayUrl(wired.db));
      })();
      setDisplayNameState(identity.displayName);
      const fc = loadOrCreateFriendCode(wired.db);
      await wired.db.flush();
      setFriendCodeState(fc.code);
      setFriendCodeIsCustom(fc.isCustom);
      setOnboardingComplete(getSetting(wired.db, ONBOARDING_SETTING_KEY) === '1');
      setLastCommunityId(getSetting(wired.db, LAST_COMMUNITY_SETTING_KEY) || null);
      setLastChannelId(getSetting(wired.db, LAST_CHANNEL_SETTING_KEY) || null);
      setAutoConnectEnabledState(isAutoConnectEnabled(wired.db));
      setLastAutoConnectRound(getLastAutoConnectRound(wired.db));
      setBoot(built);
      } catch (error) {
        // Any boot failure (storage init, identity resolve, schema) must surface an
        // honest error rather than sit on the "Booting Meerkat…" gate forever.
        if (!cancelled) {
          if (error instanceof DatabaseOwnershipError) {
            setOwnershipError(error);
          } else if (error instanceof SecretVaultUnreadableError) {
            // Half-state (key-vs-vault mismatch or a signing key gone): render
            // the honest recovery screen instead of a generic error line.
            setBootRecovery(error);
          } else {
            const described = error instanceof Error
              ? (error.message || error.name)
              : String(error);
            setBootError(
              described
                ? `Meerkat could not start: ${described}`
                : 'Meerkat could not start. Reload the page; if this keeps happening, clear the site data.',
            );
          }
        }
      }
    })();
    return () => {
      cancelled = true;
      // Tear down an engine built by this run (covers StrictMode double-mount in
      // dev). The cached db/secrets singleton persists across remounts by design.
      void builtEngine?.destroy();
    };
  }, [bootOptions]);

  // MK-001 best-effort last-ditch flush for LATER writes (settings, messages).
  // The explicit await flush() at identity creation is the real guarantee for
  // the device keys; these handlers cover writes after boot. pagehide +
  // visibilitychange(hidden) cover mobile-Safari/BFCache where beforeunload
  // never fires.
  useEffect(() => {
    if (!boot) return;
    if (typeof window === 'undefined') return;
    const flushAll = (): void => {
      // flush() now rejects on a failed attempt (MK-001 loud durability); at
      // unload there is nothing left to do, and the persist-failure banner is
      // the honest in-session surface, so swallow here.
      void boot.secrets.flush().catch(() => undefined);
      void boot.db.flush().catch(() => undefined);
    };
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flushAll();
    };
    window.addEventListener('beforeunload', flushAll);
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flushAll);
      window.removeEventListener('pagehide', flushAll);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [boot]);

  // Auto-connect trigger (Plan 29, item 12): when the tab becomes visible and
  // auto-connect is opted in, run ONE composed round. Web has no LAN peer-found
  // trigger. Safe to fire repeatedly (engine backoff / min-interval skip an
  // over-eager round); a disabled toggle fires nothing.
  useEffect(() => {
    if (!boot || !autoConnectEnabled || !appUnlocked) return undefined;
    if (typeof document === 'undefined') return undefined;
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void autoConnectRoundRef.current?.('foreground').catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [appUnlocked, boot, autoConnectEnabled]);

  // Browser storage schedules are best effort while this tab is open. Run once
  // after boot and again when the tab returns to the foreground. The pure due
  // decision records no last-run timestamp; only a verified backup job does.
  useEffect(() => {
    if (!boot || !appUnlocked || typeof document === 'undefined') return undefined;
    let cancelled = false;
    const run = (): void => {
      void runWebStorageScheduleOnce({
        db: boot.db,
        identity: boot.identity,
        secrets: storageSecretAccess(boot.secrets),
        flush: () => boot.db.flush(),
      }).then((report) => {
        if (!cancelled && (report.ran || report.retentionDeleted > 0 || report.repairedObjects > 0)) {
          refresh();
        }
      }).catch(() => {
        // The storage screen derives paused/error state from real rows on open.
      });
    };
    run();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') run();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [appUnlocked, boot, refresh]);

  // Real engine status; never a fabricated "connected" or peer count. Subscribe
  // unconditionally (hooks rules) with a stable fallback before boot.
  const status = useEngineStatus(boot?.engine ?? null);

  const setRelayUrl = useCallback(
    (url: string): void => {
      const b = bootRef.current;
      if (!b) return;
      const trimmed = url.trim();
      setSetting(b.db, RELAY_URL_SETTING_KEY, trimmed);
      void b.db.flush().catch(() => undefined);
      setRelayUrlState(trimmed);
    },
    [],
  );

  const setDefaultRelayOptedOut = useCallback((optedOut: boolean): void => {
    const b = bootRef.current;
    if (!b) return;
    setSetting(b.db, DEFAULT_RELAY_OPTOUT_KEY, optedOut ? '1' : '0');
    void b.db.flush().catch(() => undefined);
    setDefaultRelayOptedOutState(optedOut);
    // Refresh the displayed URL so the dial choke point and the display agree.
    setRelayUrlState(effectiveRelayUrl(b.db));
  }, []);

  const setAutoConnect = useCallback((enabled: boolean): void => {
    const b = bootRef.current;
    if (!b) return;
    setAutoConnectEnabled(b.db, enabled);
    void b.db.flush().catch(() => undefined);
    setAutoConnectEnabledState(enabled);
  }, []);

  const entitlementTokenForRelay = useCallback(
    (url: string): string | undefined => {
      if (!relayRequiresHostedPayment(url)) return undefined;
      return hostedEntitlementToken ?? undefined;
    },
    [hostedEntitlementToken],
  );

  const canUseRelay = useCallback(
    (url: string): boolean => !relayRequiresHostedPayment(url) || hostedEntitlementToken !== null,
    [hostedEntitlementToken],
  );

  const hostedAccess = useMemo<HostedAccessState>(() => ({
    hostedRelayUrl: HOSTED_RELAY_URL,
    hostedApiUrl: HOSTED_API_URL,
    entitlementToken: hostedEntitlementToken,
    setEntitlementToken: setHostedEntitlementToken,
    clearEntitlementToken: clearHostedEntitlementToken,
    createAuthorization: () => {
      const current = bootRef.current;
      if (!current) throw new Error('Meerkat identity is not ready.');
      return createHostedAuthBearer(current.identity);
    },
    relayRequiresPayment: relayRequiresHostedPayment,
    canUseRelay,
  }), [
    hostedEntitlementToken,
    setHostedEntitlementToken,
    clearHostedEntitlementToken,
    canUseRelay,
  ]);

  const fetchWithHostedEntitlement = useCallback<typeof fetch>(
    (input, init) => {
      const targetUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      if (!hostedEntitlementToken || !isFirstPartyHostedHttpUrl(targetUrl)) {
        return fetch(input, init);
      }
      const inputHeaders = typeof Request !== 'undefined' && input instanceof Request
        ? input.headers
        : undefined;
      const headers = new Headers(init?.headers ?? inputHeaders);
      headers.set('Authorization', `Bearer ${hostedEntitlementToken}`);
      return fetch(input, { ...init, headers });
    },
    [hostedEntitlementToken],
  );

  // Reset to a brand new identity. CREATE-THEN-SWAP (never delete-then-create):
  // generateDeviceIdentity writes the new private key into the secret store; we
  // flush the SECRET bytes first (so the key is durable), then INSERT OR REPLACE
  // the 'self' row, clear onboarding (so the new identity re-onboards), then
  // flush the DB AFTER the key. A crash between the two flushes leaves the OLD
  // row pointing at a durable old key (still valid), never a row pointing at an
  // unflushed key. A full reload then rebuilds the engine on the new identity
  // (the boot effect path), which is far less fragile than an in-place rebuild.
  // The old secret ref is orphaned and harmless.
  const resetIdentity = useCallback(async (): Promise<void> => {
    const b = bootRef.current;
    if (!b) return;
    const created = generateDeviceIdentity(DEFAULT_DISPLAY_NAME);
    await b.secrets.flush();
    saveIdentityRow(b.db, {
      public_key: created.publicKey,
      dh_public_key: created.dhPublicKey,
      private_key_ref: created.privateKeyRef,
      display_name: created.displayName,
      created_at: created.createdAt,
    });
    setSetting(b.db, ONBOARDING_SETTING_KEY, '');
    // A fresh identity gets a fresh auto-generated friend code so the old code's
    // rendezvous record can never resolve to the new (unrelated) identity.
    const fresh = generateFriendCode();
    saveFriendCode(b.db, fresh.code, fresh.rendezvousId, false);
    await b.db.flush();
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  // B.2 "Delete my data": compose the existing wipes into one auditable action
  // and reload into a clean first-run. Best-effort + idempotent.
  const deleteMyData = useCallback(async (deleteRemoteStorageData: boolean): Promise<void> => {
    const b = bootRef.current;
    if (!b) return;
    // Unsubscribe and revoke push wake before any identity or local data is removed.
    await disableWebPush(b.db).catch(() => undefined);
    const storageSecrets = storageSecretAccess(b.secrets);
    const storageCredentialBroker = createBrowserStorageCredentialBroker({
      baseUrl: HOSTED_API_URL,
      identity: b.identity,
      allowInsecureLoopback: STORAGE_BROKER_ALLOW_INSECURE_LOOPBACK,
    });
    const storageRegistry = createConfiguredWebStorageRegistry({
      db: b.db,
      identity: b.identity,
      secrets: storageSecrets,
    });
    const remoteStorage = createWebStorageAccountRemote(b.identity);
    const result = await runDeleteMyData({
      db: b.db,
      identityPrivateKeyRef: b.identity.privateKeyRef,
      hasPublicPersona: hasPublicPersonaRecord(b.db),
      deleteRemotePersona: () => requestPersonaDeletion(b.db, personaServiceConfig()),
      deleteStorageData: () => deleteStorageAccountData({
        db: b.db,
        deleteRemoteData: deleteRemoteStorageData,
        resolveAdapter: storageRegistry.resolveRouterDestination,
        deleteBrokerVault: remoteStorage.deleteBrokerVault,
        deleteHostedAccount: remoteStorage.deleteHostedAccount,
        deleteCredential: (ref) => deleteBrowserStorageCredentialRef(
          storageSecrets,
          storageCredentialBroker,
          ref,
        ),
        now: () => new Date().toISOString(),
      }),
      clearNodeBytes: () => b.nodeStore.clearAll(),
      clearBlobBytes: () => b.blobStore.clearAll(),
      deleteSecret: (ref) => {
        if (!b.secrets.deleteSecret) throw new Error('Browser secret deletion is unavailable.');
        b.secrets.deleteSecret(ref);
      },
      flushSecrets: () => b.secrets.flush(),
      createFreshIdentity: async () => {
        const created = generateDeviceIdentity(DEFAULT_DISPLAY_NAME);
        await b.secrets.flush();
        saveIdentityRow(b.db, {
          public_key: created.publicKey,
          dh_public_key: created.dhPublicKey,
          private_key_ref: created.privateKeyRef,
          display_name: created.displayName,
          created_at: created.createdAt,
        });
        setSetting(b.db, ONBOARDING_SETTING_KEY, '');
        const fresh = generateFriendCode();
        saveFriendCode(b.db, fresh.code, fresh.rendezvousId, false);
        await b.db.flush();
      },
    });
    if (!result.ok) throw new Error(result.reason);
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  // Plan 23 / AM8: restore a wiped identity from its recovery key + backup, then
  // reload on the restored identity (resolveOrCreateIdentity reads the saved
  // mk_identity row on the next boot). All persistence (secure store, mk_identity,
  // friend code, onboarding flag) is flushed BEFORE the reload so the reboot never
  // races a half-written identity. Fail-closed: a wrong key or bad backup changes
  // nothing and returns an honest reason.
  const restoreIdentity = useCallback(
    async (recoveryKey: string, sealedBackup: string): Promise<RestoreIdentityResult> => {
      const b = bootRef.current;
      if (!b) return { ok: false, reason: 'bad_backup' };
      const bytes = parseRecoveryKey(recoveryKey.trim());
      if (!bytes) return { ok: false, reason: 'bad_key' };
      const restored = openAndRestore(sealedBackup.trim(), bytes);
      if (!restored) return { ok: false, reason: 'bad_backup' };
      // openAndRestore wrote the restored private keys into the browser secret
      // store; flush it, then persist mk_identity over any freshly-minted one.
      await b.secrets.flush();
      saveIdentityRow(b.db, {
        public_key: restored.publicKey,
        dh_public_key: restored.dhPublicKey,
        private_key_ref: restored.privateKeyRef,
        display_name: restored.displayName,
        created_at: restored.createdAt,
      });
      setSetting(b.db, ONBOARDING_SETTING_KEY, '1');
      const fresh = generateFriendCode();
      saveFriendCode(b.db, fresh.code, fresh.rendezvousId, false);
      await b.db.flush();
      if (typeof window !== 'undefined') window.location.reload();
      return { ok: true };
    },
    [],
  );

  const value = useMemo<MeerkatContextValue | null>(() => {
    if (!boot) return null;
    const { db, identity, engine, blobStore, nodeStore, secrets } = boot;

    // Owner side: approve or decline an incoming request. On approve, re-read the
    // local bytes, re-verify the hash (buildFileGrant), and park the grant; on
    // decline park a decline grant. Re-checks the requester is still a member and
    // not revoked before any token is derived. The relay send is fire-and-forget;
    // 'parked' just means send() did not throw, never a delivery confirmation.
    const runFileGrant = async (
      requestId: string,
      decision: 'approve' | 'decline',
    ): Promise<FileGrantResult> => {
      const row = getFileRequest(db, requestId);
      if (!row) return { ok: false, reason: 'not_found' };
      if (row.direction !== 'incoming') return { ok: false, reason: 'not_incoming' };

      const requesterDeviceId = row.counterparty_device_id;
      if (isDeviceRevoked(db, requesterDeviceId)) return { ok: false, reason: 'revoked' };
      if (!isActiveCommunityMember(db, row.community_id, requesterDeviceId)) {
        setFileRequestStatus(db, requestId, 'declined', 'Requester is no longer a member.');
        await db.flush();
        refresh();
        return { ok: false, reason: 'not_a_member' };
      }

      const relay = await ensureEffectiveRelayUrl(db);
      const resolved = resolvePairedSecret(db, requesterDeviceId);
      if (!resolved) return { ok: false, reason: 'not_paired' };
      if (!relay.startsWith('ws')) return { ok: false, reason: 'no_relay' };
      const relayEntitlementToken = entitlementTokenForRelay(relay);
      if (relayRequiresHostedPayment(relay) && !relayEntitlementToken) {
        return { ok: false, reason: 'payment_required' };
      }

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
          // The owner no longer holds the bytes: park the decline so the
          // requester is not left waiting forever, with the honest reason.
          const backend = new WebSocketRelayBackend();
          let parked = false;
          try {
            const session = await backend.connect(relay, sealed.token, {
              entitlementToken: relayEntitlementToken,
            });
            try { await session.send(encodeMailboxEnvelope(sealed.envelope)); parked = true; }
            finally { await session.close(); }
          } catch { parked = false; } finally { backend.destroy(); }
          if (!parked) return { ok: false, reason: 'park_failed' };
          setFileRequestStatus(db, requestId, 'declined', 'You no longer have this file on this device.');
          await db.flush();
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

      const backend = new WebSocketRelayBackend();
      let parked = false;
      try {
        const session = await backend.connect(relay, sealed.token, {
          entitlementToken: relayEntitlementToken,
        });
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
      await db.flush();
      refresh();
      return { ok: true, decision };
    };

    const applyTrustedBundle = (signed: SignedIdentityBundle): PairFriendResult => {
      const data = pairingDataFromBundle(signed);
      if (data.publicKey === identity.publicKey) {
        return { ok: false, error: "That is this device's own identity." };
      }

      const pinnedRow = getPinnedIdentity(db, data.publicKey);
      const trust = evaluateBundleTrust(
        signed,
        pinnedRow ? { deviceId: pinnedRow.deviceId, dhPublicKey: pinnedRow.dhPublicKey } : null,
      );
      if (trust === 'invalid_signature') {
        return {
          ok: false,
          error: 'This identity failed signature verification. Do not pair: it may be a man-in-the-middle.',
        };
      }
      if (trust === 'key_changed') {
        return {
          ok: false,
          error: `${data.displayName}'s safety identity changed since you last paired. Pairing is blocked until you verify the change out of band.`,
        };
      }
      if (getPairedDevice(db, data.publicKey)) {
        touchPinnedIdentity(db, data.publicKey, new Date().toISOString());
        return { ok: false, error: 'Already paired with that device.' };
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
      return { ok: true, device };
    };

    // --- Plan 19 FF3 parity fix: shared join-handoff drain builders ---------
    // Mobile uses a SINGLE buildDrainHandlers (file + history + join + public-
    // join) for its foreground drain, so an OWNER records public-join requests
    // on every channel-open drain. Web previously split these: only
    // runJoinHandoffDrain (the joiner onboarding path) carried the join/public-
    // join handlers, so a web owner's channel-open runForegroundDrain never
    // recorded a parked public-join request and the "Requests to join" panel
    // stayed empty (the request was lost at mailbox TTL). These builders are now
    // shared by BOTH runForegroundDrain and runJoinHandoffDrain, matching
    // mobile's single shared drain. SOURCE OF TRUTH: native SyncProvider
    // buildDrainHandlers + resolveJoinExtraTokens + requeuePendingJoinRequests.

    // Re-park a fresh join-request for every community that is still PENDING (the
    // descriptor is stored but I am not yet listed) and whose join link we kept.
    // A no-op for an owner (no pending join link), so it is safe on every drain.
    const reparkPendingJoinRequests = async (
      relay: string,
      relayEntitlementToken: string | undefined,
    ): Promise<void> => {
      for (const community of listCommunities(db)) {
        const d = community.descriptor;
        const key = `${PENDING_JOIN_LINK_PREFIX}${d.communityId}`;
        const link = getSetting(db, key);
        if (!link) continue;
        if (communityRole(d, identity.publicKey) !== null) {
          setSetting(db, key, ''); // landed: stop re-parking (web has no deleteSetting)
          continue;
        }
        const parsed = parseCommunityInviteLink(link);
        // Plan 27 P3: never re-park a proximity-gated community's join on the relay.
        if (parsed && !transportPolicyAllows(communityTransportPolicy(parsed.descriptor.descriptor), 'wan_relay')) {
          continue;
        }
        const built = parsed ? buildJoinRequest(identity, parsed) : null;
        if (!built || !parsed) continue;
        // Plan 57 W4: the durable host box first, then the TTL-bound relay rail.
        await parkJoinRequestOnInviteHost(parsed.descriptor, built.token, built.envelope).catch(() => false);
        if (relay.startsWith('ws')) await parkEnvelopeOnRelay(relay, built.token, built.envelope, relayEntitlementToken);
      }
    };

    // The join-handoff owner+joiner handler set: SERVE invite join-requests
    // (processJoinRequest), APPLY join-grants (applyJoinGrant), and RECORD
    // verified public-join requests into the local review queue
    // (recordPublicJoinRequests, FF3). No auto-approve: the epoch key hands off
    // ONLY through an explicit approvePublicJoinRequestById call.
    const buildJoinHandoffHandlers = (
      relay: string,
      relayEntitlementToken: string | undefined,
    ): MailboxEnvelopeHandlers => ({
      ...processJoinRequest({
        db,
        owner: identity,
        parkEnvelope: (token, env) => parkEnvelopeOnRelay(relay, token, env, relayEntitlementToken),
        recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
      }),
      ...applyJoinGrant({ db, self: identity }),
      // Plan 28 P2: APPLY side (survivor) of a community member removal. Verifies
      // the owner-signed strictly-newer revision against the local predecessor,
      // closes the removed device's roster row, and stores this device's new-epoch
      // wrap, so old-epoch sessions with the removed device are refused.
      ...applyMemberRemoval({ db, self: identity }),
      ...recordPublicJoinRequests({
        db,
        owner: identity,
        redeem: buildHumanityRedeemClient(humanityServiceConfig()) ?? undefined,
        servicePublicKeyHex: humanityServiceConfig().servicePublicKeyHex,
      }),
    });

    // Community-derived extra drain tokens: an OWNER drains its invite join-
    // request token; a PENDING joiner drains its join-grant token. Same per-
    // recipient token shape as mobile.
    //
    // Plan 19 FF3 delivery fix: a request-policy PUBLIC-join request is parked by
    // the joiner on derivePublicJoinToken(publicationId, grantId, ownerDeviceId)
    // (public-join.ts queuePublicJoinRequest), a DISTINCT mailbox from the invite
    // deriveCommunityJoinToken. The owner must therefore ALSO drain the public-
    // join token of every owned, ACTIVE, advertised publication or the request
    // is never received and the review queue stays empty (the record handler
    // alone cannot fire on a token that is never drained). See the report note:
    // mobile has the same gap in its resolveJoinExtraTokens / background-sync
    // buildExtraTokens and needs the identical addition.
    const resolveJoinExtraTokens = (): { token: string; label: string }[] => {
      const tokens: { token: string; label: string }[] = [];
      for (const community of listCommunities(db)) {
        const d = community.descriptor;
        // Plan 27 P2 (AC-2): a local_only community's mailboxes never touch the
        // relay -- not even its opaque rendezvous tokens. Join handoffs and
        // removal delivery for such a community ride local sessions instead.
        if (!transportAllowedForCommunity(db, d.communityId, 'wan_relay')) continue;
        const role = communityRole(d, identity.publicKey);
        if (role === 'owner') {
          tokens.push({
            token: deriveCommunityJoinToken(d.genesisNonce, d.communityId, identity.publicKey),
            label: `join-request:${d.communityId}`,
          });
        } else if (role === null) {
          tokens.push({
            token: deriveCommunityJoinToken(d.genesisNonce, d.communityId, identity.publicKey),
            label: `join-grant:${d.communityId}`,
          });
        }
        // Plan 28 P2: every LISTED member drains its own member-removal token,
        // re-derived from persisted community state (the FF3 trap: a token nobody
        // polls never delivers). This is how a survivor learns a removal + its
        // new-epoch wrap even when the owner is long offline.
        if (role !== null) {
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
      return tokens;
    };

    // --- Direct-message rails (Plan 21 Phase 9) -----------------------------
    // The single relay-dial choke point for DMs: effectiveRelayUrl only, hosted
    // payment gated, honest false on no relay. dm_ mailbox parks ride the same
    // parkEnvelopeOnRelay fire-and-forget primitive the file/join paths use.
    const dmRelay = async (): Promise<{ url: string; entitlementToken: string | undefined; available: boolean }> => {
      const url = await ensureEffectiveRelayUrl(db);
      const entitlementToken = entitlementTokenForRelay(url);
      const available = url.startsWith('ws')
        && (!relayRequiresHostedPayment(url) || entitlementToken !== undefined);
      return { url, entitlementToken, available };
    };
    const dmParkEnvelope = async (token: string, envelope: MailboxEnvelope): Promise<boolean> => {
      const { url, entitlementToken, available } = await dmRelay();
      if (!available) return false;
      return parkEnvelopeOnRelay(url, token, envelope, entitlementToken);
    };
    const resolveDmPairSecret = (deviceId: string): string | null =>
      resolvePairedSecret(db, deviceId)?.sharedSecretHex ?? null;
    const resolveDmPeerDhKey = (deviceId: string): string | null =>
      resolvePairedSecret(db, deviceId)?.peer.dhPublicKey ?? null;

    // Every group DM this device belongs to drains its conversation-scoped
    // DM_GROUP_COMMIT token (re-derived from persisted state; the FF3 trap: a
    // token nobody polls never delivers), so a member learns each new epoch.
    const resolveDmExtraTokens = (): { token: string; label: string }[] => {
      const tokens: { token: string; label: string }[] = [];
      for (const conv of listDmConversations(db, { includeArchived: true })) {
        if (conv.kind !== 'group') continue;
        tokens.push({
          token: deriveDmGroupCommitToken(conv.id, identity.publicKey),
          label: `dm-group-commit:${conv.id}`,
        });
      }
      return tokens;
    };

    // The DM drain handler set, shared by runForegroundDrain (web has no
    // background drain). buildDmMailboxHandlers carries delivered-on-drain +
    // own-device skip + verify-then-pin attachments; the group + shred handlers
    // apply epoch commits and author-signed deletes.
    const buildDmDrainHandlers = (): MailboxEnvelopeHandlers => ({
      ...buildDmMailboxHandlers({
        db,
        identity,
        resolvePeerDhKey: resolveDmPeerDhKey,
        resolvePairSecret: resolveDmPairSecret,
        parkEnvelope: dmParkEnvelope,
        pinAttachments: async (hash, bytes, mimeType) => {
          await blobStore.put(hash, bytes, { moduleId: 'dm', mimeType });
        },
      }),
      ...buildDmGroupMailboxHandlers({ db, identity }),
      ...buildDmShredHandler({ db, identity, deleteBlob: async (hash) => { await blobStore.removeLocal(hash); } }),
      // Plan 52 P1/P2: the person-group attestation exchange and DM-peer
      // person proofs. listOwnDeviceIds is the LOAD-BEARING trust gate -- it
      // must be the own-device-LINKED list (dm_own_devices), never the paired
      // list, because a merely-paired friend must never get this device to
      // attest a person group.
      ...buildPersonGroupMailboxHandlers({
        db,
        identity,
        listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
        listDmPeerIds: () => getPairedDevices(db)
          .filter((peer) => peer.isActive)
          .map((peer) => peer.deviceId),
        resolvePairedDevice: (deviceId) => {
          const resolved = resolvePairedSecret(db, deviceId);
          return resolved
            ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
            : null;
        },
        parkEnvelope: dmParkEnvelope,
        recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
      }),
    } as MailboxEnvelopeHandlers);

    // The single shared foreground drain (also the "mailbox drain" leg of the
    // composed auto-connect round). Extracted to a local const so autoConnectRound
    // can reuse the EXACT same drain (AM11) instead of a parallel copy.
    // The ONE foreground handler set, shared by runForegroundDrain and the
    // live-wake listeners so the polling and live delivery paths cannot drift.
    const buildForegroundHandlers = (
      relay: string,
      relayEntitlementToken: string | undefined,
    ): MailboxEnvelopeHandlers => ({
      ...buildFileMailboxHandlers({
        db,
        blobStore,
        isActiveMember: (cid, did) => isActiveCommunityMember(db, cid, did),
      }),
      ...buildJoinHandoffHandlers(relay, relayEntitlementToken),
      // Plan 21 Phase 9: the DM message/receipt + group-commit + shred handlers
      // (web has no background drain, so the foreground drain owns DM catch-up).
      ...buildDmDrainHandlers(),
      // Plan 29 P6: APPLY a verified, FRESH presence beacon (dispatch already
      // verified envelope + beacon signature + freshness + roster binding).
      // Records device-local only; never replicated.
      presenceBeacon: (_senderDeviceId: string, beacon) => {
        recordPresenceBeacon(db, beacon);
        return true;
      },
    });

    const resolveDrainPeers = (): MailboxDrainPeer[] => getPairedDevices(db)
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
      });

    const runForegroundDrain = async (): Promise<ForegroundDrainResult> => {
      // Plan 57 W4: drain the durable join boxes on attached community servers
      // FIRST -- this rail works with or without a relay. The owner serves joins
      // parked while it slept (the grant goes back to the node's durable box AND
      // the relay when one is dialable); a pending joiner applies its grant.
      // SOURCE OF TRUTH: native SyncProvider.runForegroundDrain (host-join slice).
      const hostRelay = await ensureEffectiveRelayUrl(db);
      const hostJoin = await drainCommunityJoinBoxesFromHosts(
        db,
        identity,
        (communityId, hostUrl) => ({
          ...buildForegroundHandlers(hostRelay, entitlementTokenForRelay(hostRelay)),
          ...processJoinRequest({
            db,
            owner: identity,
            parkEnvelope: async (token, env) => {
              // The grant targets the JOINER's token (not in the node's roster),
              // so the owner parks over the node's AUTHENTICATED lane.
              const nodeParked = await parkJoinEnvelopeOnNode({
                baseUrl: hostUrl, communityId, token, envelope: env, identity,
                entitlementToken: hostedAccess.entitlementToken ?? undefined,
              }).then((r) => r.ok).catch(() => false);
              const relayParked = hostRelay.startsWith('ws')
                ? await parkEnvelopeOnRelay(hostRelay, token, env, entitlementTokenForRelay(hostRelay)).catch(() => false)
                : false;
              return nodeParked || relayParked;
            },
            recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
          }),
        }),
        { entitlementToken: hostedAccess.entitlementToken ?? undefined },
      ).catch(() => ({ communities: 0, fetched: 0, applied: 0, rejected: 0 }));
      if (hostJoin.applied > 0) {
        await db.flush();
        refresh();
      }

      const relay = hostRelay;
      if (!relay.startsWith('ws')) {
        // Keep the pending-join re-park alive over the host rail even with no
        // relay, then report the relay drain honestly as a genuine no-op.
        await reparkPendingJoinRequests(relay, undefined);
        return {
          ran: false,
          applied: 0,
          appliedMessages: 0,
          dmReceipts: 0,
          dmGroupCommits: 0,
          dmShreds: 0,
          fileRequests: 0,
          fileGrants: 0,
          joinRequestsServed: 0,
          joinGrantsApplied: 0,
          publicJoinRequestsRecorded: 0,
          memberRemovalsApplied: 0,
          reason: 'No connection server configured; nothing to drain.',
        };
      }
      const relayEntitlementToken = entitlementTokenForRelay(relay);
      if (relayRequiresHostedPayment(relay) && !relayEntitlementToken) {
        return {
          ran: false,
          applied: 0,
          appliedMessages: 0,
          dmReceipts: 0,
          dmGroupCommits: 0,
          dmShreds: 0,
          fileRequests: 0,
          fileGrants: 0,
          joinRequestsServed: 0,
          joinGrantsApplied: 0,
          publicJoinRequestsRecorded: 0,
          memberRemovalsApplied: 0,
          reason: 'The hosted Meerkat connection server requires an active subscription.',
        };
      }
      // Plan 19 FF3 parity fix: mirror mobile's SINGLE shared drain. The owner's
      // channel-open drain must run the join-handoff handler set (serve invite
      // join-requests, apply grants, RECORD public-join requests) with the
      // owned-community extra tokens, or a web owner never records a parked
      // public-join request and the "Requests to join" panel stays empty. File
      // and join handlers share no key, so a single spread is safe.
      await reparkPendingJoinRequests(relay, relayEntitlementToken);
      const handlers = buildForegroundHandlers(relay, relayEntitlementToken);
      const peers = resolveDrainPeers();
      const backend = new WebSocketRelayBackend();
      try {
        const drain = await runMailboxDrainJob({
          identity,
          backend,
          relayUrl: relay,
          peers,
          handlers,
          extraTokens: [...resolveJoinExtraTokens(), ...resolveDmExtraTokens()],
          entitlementToken: relayEntitlementToken,
        });
        if (
          drain.applied > 0
          || drain.fileRequests > 0
          || drain.fileGrants > 0
          || drain.joinGrants > 0
          || drain.joinRequests > 0
          || drain.publicJoinRequests > 0
          || drain.memberRemovals > 0
          || drain.dmMessages > 0
          || drain.dmReceipts > 0
          || drain.dmGroupCommits > 0
          || drain.dmShreds > 0
        ) {
          await db.flush();
          refresh();
        }
        // A member-removal revision (or any adopted descriptor) may have changed a
        // community's transport policy: reconcile the observed ledger so the member
        // policy-change notice reflects the real signed change (idempotent).
        reconcileCommunityPolicyHistory(db);
        // Plan 53 P3: park any still-queued DM-peer person announces. An add
        // completed while the relay was unreachable queues one; this is its
        // retry point, so the announce eventually reaches the new friend.
        await drainPersonAnnounceOutbox({
          db,
          identity,
          listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
          resolvePairedDevice: (deviceId: string) => {
            const resolved = resolvePairedSecret(db, deviceId);
            return resolved
              ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
              : null;
          },
          parkEnvelope: dmParkEnvelope,
        });
        // Plan 29 P6: drop presence beacons whose TTL elapsed (honest freshness).
        prunePresenceBeacons(db);
        // Plan 29 P6 EMIT: when opted into appearing online, sign + seal + park a
        // beacon to every reachable co-member peer (per community whose policy
        // allows relay). Bounded + honest; each park is best-effort.
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
            pairSharedSecretHex: resolvePairedSecret(db, peer.deviceId)?.sharedSecretHex ?? null,
            isActive: peer.isActive,
            revoked: isDeviceRevoked(db, peer.deviceId),
          }));
          const presenceTargets = planPresenceEmission({
            selfDeviceId: identity.publicKey,
            communities: presenceCommunities,
            pairedPeers: presencePeers,
          });
          if (presenceTargets.length > 0) {
            await emitPresenceBeacons({
              identity,
              targets: presenceTargets,
              park: async (token, envelope) => {
                const b = new WebSocketRelayBackend();
                try {
                  const session = await b.connect(relay, token, { entitlementToken: relayEntitlementToken });
                  try {
                    await session.send(encodeMailboxEnvelope(envelope));
                    return true;
                  } finally {
                    await session.close();
                  }
                } catch {
                  return false;
                } finally {
                  b.destroy();
                }
              },
            });
          }
        }
        void db.flush().catch(() => undefined);
        return {
          ran: true,
          applied: drain.applied,
          appliedMessages: drain.dmMessages,
          dmReceipts: drain.dmReceipts,
          dmGroupCommits: drain.dmGroupCommits,
          dmShreds: drain.dmShreds,
          fileRequests: drain.fileRequests,
          fileGrants: drain.fileGrants,
          joinRequestsServed: drain.joinRequests,
          joinGrantsApplied: drain.joinGrants,
          publicJoinRequestsRecorded: drain.publicJoinRequests,
          memberRemovalsApplied: drain.memberRemovals,
        };
      } finally {
        backend.destroy();
      }
    };

    // Run ONE shared foreground round (AM11): mailbox drain, then the auto-connect
    // session sync over real recorded sessions (+ gossip once the engine seam
    // lands). Web is relay-only (no LAN): the injected connectRelay carries the
    // hosted entitlement so a paid relay authenticates. Every count is real.
    const autoConnectRound = async (trigger: AutoConnectTrigger): Promise<AutoConnectRoundOutcome> => {
      setLastAutoConnectError(null);
      try {
        const relay = await ensureEffectiveRelayUrl(db);
        const relayEntitlementToken = entitlementTokenForRelay(relay);
        const outcome = await runComposedAutoConnectRound({
          trigger,
          runDrain: async () => {
            const drain = await runForegroundDrain();
            // drain.applied is the channel-message count (parity with mobile's
            // appliedMessages); DM catch-up is reported separately by the drain.
            return { ran: drain.ran, appliedMessages: drain.applied };
          },
          runSessions: (): Promise<AutoConnectRoundResult> => runAutoConnectJob({
            db,
            selfDeviceId: identity.publicKey,
            engine,
            relayUrl: relay,
            relayBackendFactory: () => new WebSocketRelayBackend(),
            resolvePeerSecret: (deviceId) => resolvePairedSecret(db, deviceId)?.sharedSecretHex ?? null,
            connectRelay: (opts) => connectRelayPeer({ ...opts, entitlementToken: relayEntitlementToken }),
          }),
          // Gossip (AM11) now rides INSIDE the session sync above: the engine is
          // built with gossip:true, so each auto-connect session runs the gossip
          // phase (signed revocations + descriptors + roster reconcile).
        });
        recordAutoConnectRound(db, outcome.summary);
        await db.flush();
        setLastAutoConnectRound(outcome.summary);
        refresh();
        return outcome;
      } catch (error) {
        setLastAutoConnectError('Could not finish catching up. Check your connection and unsaved changes, then try again.');
        throw error;
      }
    };

    // Shared fields-based file-request core (D.1): drives the SAME sealed
    // FILE_REQUEST park path for both the in-channel card (which has the full
    // signed event + attachment) and the Files index (aggregated row primitives).
    const requestFileAgainByFieldsImpl = async (input: {
      communityId: string;
      channelId: string;
      messageId: string;
      attachmentId: string;
      blobHash: string;
      ownerDeviceId: string;
    }): Promise<RequestFileAgainResult> => {
      const ownerDeviceId = input.ownerDeviceId;
      if (ownerDeviceId === identity.publicKey) return { ok: false, reason: 'self_author' };
      if (isDeviceRevoked(db, ownerDeviceId)) return { ok: false, reason: 'revoked' };

      const relay = await ensureEffectiveRelayUrl(db);
      const resolved = resolvePairedSecret(db, ownerDeviceId);
      if (!resolved) return { ok: false, reason: 'not_paired' };
      if (!relay.startsWith('ws')) return { ok: false, reason: 'no_relay' };
      const relayEntitlementToken = entitlementTokenForRelay(relay);
      if (relayRequiresHostedPayment(relay) && !relayEntitlementToken) {
        return { ok: false, reason: 'payment_required' };
      }

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

      const backend = new WebSocketRelayBackend();
      let parked = false;
      try {
        const session = await backend.connect(relay, sealed.token, {
          entitlementToken: relayEntitlementToken,
        });
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
      await db.flush();
      refresh();
      return { ok: true, requestId: fields.requestId, ownerDeviceId };
    };

    // Plan 52: the ONE writer for a per-community name. Both context entry
    // points call this, so neither can bypass the presentation profile and get
    // reverted by the next alignment pass.
    const applyCommunityPresentation = (
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
      if (!stored) return { ok: false, error: 'Community not found in this browser.' };
      if (communityRole(stored.descriptor, identity.publicKey) === null) {
        return { ok: false, error: 'Join the community before setting a community name.' };
      }
      try {
        const record = (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string, data: Record<string, unknown> | null) =>
          engine.recordChange(table, op, rowId, data);
        setPresentationOverride(db, communityId, displayName, record, appearance);
        alignPersonIdentity(db, identity, record);
        void db.flush().catch(() => undefined);
        refresh();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Could not save community profile.' };
      }
    };

    return {
      identity,
      fingerprint: getPublicKeyFingerprint(identity.publicKey),
      displayName: displayName || identity.displayName,
      updateDisplayName: async (name: string): Promise<void> => {
        const trimmed = name.trim();
        if (!trimmed) return;
        updateDisplayNameRow(db, trimmed);
        identity.displayName = trimmed;
        await db.flush();
        setDisplayNameState(trimmed);
        refresh();
      },
      friendCode,
      friendCodeIsCustom,
      setCustomFriendCode: (vanity: string): string | null => {
        // makeVanityFriendCode normalizes + length-checks the vanity and appends
        // a random Crockford suffix (>= 12 total, never the 16-char standard
        // shape). It throws when the vanity is too short; surface that honestly.
        let code: string;
        try {
          code = makeVanityFriendCode(vanity);
        } catch (error) {
          return error instanceof Error ? error.message : 'That code is too short.';
        }
        // Defense in depth: confirm the produced code is a valid custom code and
        // derives a rendezvous id before we store it (it always should).
        const rid = friendCodeToRendezvousId(code);
        if (!rid || !isValidCustomFriendCode(code)) {
          return 'Could not build a valid friend code. Try a different word.';
        }
        saveFriendCode(db, code, rid, true);
        void db.flush().catch(() => undefined);
        setFriendCodeState(code);
        setFriendCodeIsCustom(true);
        refresh();
        return null;
      },
      regenerateFriendCode: (): void => {
        const { code, rendezvousId } = generateFriendCode();
        saveFriendCode(db, code, rendezvousId, false);
        void db.flush().catch(() => undefined);
        setFriendCodeState(code);
        setFriendCodeIsCustom(false);
        refresh();
      },
      publishFriendCode: async (onPublished?: (receipt: PublishRendezvousReceipt) => void): Promise<string> => {
        const url = await ensureEffectiveRelayUrl(db);
        if (!url.startsWith('ws')) {
          throw new Error('Set a connection server in Settings before you publish your friend code.');
        }
        const relayEntitlementToken = entitlementTokenForRelay(url);
        if (relayRequiresHostedPayment(url) && !relayEntitlementToken) {
          throw new Error('The hosted Meerkat connection server requires an active subscription. Use your own connection server or sign in to hosted access.');
        }
        const stored = getFriendCode(db);
        if (!stored) throw new Error('No friend code to publish yet.');
        const relayHints = [url];
        // D.5: seal the published record with a persistent per-device secret half
        // and return the EXTENDED code (public code + secret half) to share. The
        // secret half never reaches the relay.
        const secretHalf = loadOrCreateFriendCodeSecret(db);
        // Custom codes derive their rid inside @mylife/sync from customCode;
        // standard codes carry their rid in the code, so pass it explicitly.
        if (stored.isCustom) {
          // publishIdentityToRendezvous returns the EXTENDED (sealed) code when a
          // secretHalf is supplied; no caller-side wrapping (that would double the
          // secret half).
          return publishIdentityToRendezvous({
          onPublished,
            url,
            identity,
            customCode: stored.code,
            secretHalf,
            relayHints,
            entitlementToken: relayEntitlementToken,
          });
        }
        const rid = friendCodeToRendezvousId(stored.code);
        if (!rid) throw new Error('Stored friend code is not valid. Make a new one and try again.');
        return publishIdentityToRendezvous({
          onPublished,
          url,
          identity,
          rendezvousId: rid,
          secretHalf,
          relayHints,
          entitlementToken: relayEntitlementToken,
        });
      },
      resolvePeerName: (communityId: string, deviceId: string): string => {
        const name = buildCommunityPeerNameMap(db, communityId).get(deviceId);
        if (deviceId === identity.publicKey) return name ? `You as ${name}` : 'You';
        return name ?? getPublicKeyFingerprint(deviceId);
      },
      // Plan 52 round-3 INFO: this used to write a CommunityProfileEvent
      // DIRECTLY, bypassing the presentation profile. Since alignPersonIdentity
      // is now the single writer of those events, such a write would be
      // reverted on the next alignment pass -- a footgun for any future caller.
      // It now delegates to the presentation rail, so both entry points have
      // one behaviour and one writer.
      setCommunityProfile: (
        communityId: string,
        profileName: string,
        avatarInitial?: string | null,
        avatarImage?: string | null,
      ): SetCommunityProfileResult => applyCommunityPresentation(communityId, profileName, {
        ...(avatarInitial === undefined ? {} : { avatarInitial }),
        ...(avatarImage === undefined ? {} : { avatarImage }),
      }),
      /**
       * Plan 52 P3: the join door's name. Records the per-community override
       * on the presentation profile (so every linked device adopts it) and
       * runs alignment, which signs THIS device's CommunityProfileEvent to
       * match. Alignment is idempotent, so a re-join is a cheap no-op.
       */
      applyJoinDisplayName: (communityId: string, joinName: string): void => {
        setPresentationOverride(db, communityId, joinName, (table, operation, rowId, data) =>
          engine.recordChange(table, operation, rowId, data),
        );
        alignPersonIdentity(db, identity, (table, operation, rowId, data) =>
          engine.recordChange(table, operation, rowId, data),
        );
        void db.flush().catch(() => undefined);
        refresh();
      },
      setCommunityPresentation: applyCommunityPresentation,
      personLinks: (communityId: string): Map<string, string> => {
        const map = new Map<string, string>();
        for (const row of readPersonLinks(db, communityId)) {
          map.set(row.device_id, row.derived_group_id);
        }
        return map;
      },
      communityDisplayName: (communityId: string, deviceId: string, fallbackName?: string): string | null =>
        resolveCommunityDisplayName(db, communityId, deviceId, fallbackName),
      communityAvatarInitial: (communityId: string, deviceId: string, fallbackName?: string): string | null =>
        resolveCommunityAvatarInitial(db, communityId, deviceId, fallbackName),
      communityAvatarImage: (communityId: string, deviceId: string): string | null =>
        resolveCommunityAvatarImage(db, communityId, deviceId),
      communityProfile: (communityId: string, deviceId: string): ReturnType<typeof getCommunityProfile> =>
        getCommunityProfile(db, communityId, deviceId),
      communityIdentity: (communityId: string): CommunityIdentityEvent | null =>
        getCommunityIdentity(db, communityId),
      publishCommunityIdentity: (
        communityId: string,
        fields: PublishCommunityIdentityFields,
      ): CommunityIdentityEvent => {
        const event = publishCommunityIdentityRow(db, identity, communityId, fields, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data),
        );
        void db.flush().catch(() => undefined);
        refresh();
        return event;
      },
      tombstoneCommunityIdentity: (communityId: string): CommunityIdentityEvent => {
        const event = tombstoneCommunityIdentityRow(db, identity, communityId, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data),
        );
        void db.flush().catch(() => undefined);
        refresh();
        return event;
      },
      communityLayoutEvent: (communityId: string): CommunityLayoutEvent | null =>
        getCommunityLayoutEvent(db, communityId),
      recordLocalChange: (table, operation, rowId, data): void => {
        engine.recordChange(table, operation, rowId, data);
      },
      publishCommunityLayout: (communityId: string, layoutBlob: string): CommunityLayoutEvent => {
        const event = publishCommunityLayoutRow(db, identity, communityId, layoutBlob, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data),
        );
        void db.flush().catch(() => undefined);
        refresh();
        return event;
      },
      tombstoneCommunityLayout: (communityId: string): CommunityLayoutEvent => {
        const event = tombstoneCommunityLayoutRow(db, identity, communityId, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data),
        );
        void db.flush().catch(() => undefined);
        refresh();
        return event;
      },
      sealCommunityBanner: async (communityId: string, bytes: Uint8Array): Promise<CommunityIdentityBanner> => {
        const banner = await sealCommunityBanner({ nodeStore, db, owner: identity, communityId, bytes });
        await db.flush();
        return banner;
      },
      communityBannerImage: async (communityId: string): Promise<string | null> => {
        const stored = getCommunity(db, communityId);
        if (!stored) return null;
        const resolvedIdentity = getCommunityIdentity(db, communityId);
        if (!resolvedIdentity?.banner) return null;
        return openCommunityBanner({
          nodeStore,
          db,
          identity,
          communityId,
          ownerDeviceId: stored.descriptor.ownerDeviceId,
          banner: resolvedIdentity.banner,
        });
      },
      communityThemeMode: (communityId: string): CommunityThemeMode =>
        getCommunityThemeMode(db, communityId),
      setCommunityThemeMode: (communityId: string, mode: CommunityThemeMode): void => {
        setCommunityThemeModeRow(db, communityId, mode);
        void db.flush().catch(() => undefined);
        refresh();
      },
      communityPeerNames: (communityId: string): Map<string, string> =>
        buildCommunityPeerNameMap(db, communityId),
      onboardingComplete,
      completeOnboarding: async (name?: string): Promise<void> => {
        const trimmed = name?.trim();
        if (trimmed) {
          updateDisplayNameRow(db, trimmed);
          identity.displayName = trimmed;
          setDisplayNameState(trimmed);
        }
        setSetting(db, ONBOARDING_SETTING_KEY, '1');
        await db.flush();
        setOnboardingComplete(true);
        refresh();
      },
      engine,
      db,
      blobStore,
      nodeStore,
      personalWorkspaceId,
      status,
      relayUrl,
      setRelayUrl,
      hostedAccess,
      createCommunity: (name: string): SignedCommunityDescriptor => {
        // A name whose VISIBLE form is empty (only zero-width/control
        // characters) would create a community that renders as a blank card
        // everywhere; the dialog catches this throw and shows it honestly.
        if (!visibleCommunityName(name)) throw new Error('Give the community a name.');
        const signed = createCommunity(identity, {
          name: name.trim(),
          channels: [{ id: 'general', name: 'general' }],
        });
        // Pass the engine recorder so the freshly minted epoch wrap replicates to
        // members over the next session (community feed P0).
        storeOwnedCommunity(db, identity, signed, undefined, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data),
        );
        void db.flush().catch(() => undefined);
        refresh();
        return signed;
      },
      createCommunityFromTemplate: (input: CreateFromTemplateInput): CreateFromTemplateResult => {
        // The whole staged commit (genesis descriptor + library rows + identity)
        // runs all-or-nothing inside commitCommunityTemplate (storeOwnedCommunity
        // self-transacts first, then one transaction + purge-on-failure; the
        // browser adapter cannot nest BEGINs), with the engine recorder so the
        // new rows replicate on the next session.
        const result = commitCommunityTemplate(db, identity, input, (table, op, rowId, data) =>
          engine.recordChange(table, op, rowId, data),
        );
        // Re-sync in-memory read models either way: on success to show the new
        // community, on failure so a rolled-back partial can never linger.
        if (result.ok) void db.flush().catch(() => undefined);
        refresh();
        return result;
      },
      joinFromLink: (link: string): JoinCommunityResult => {
        const result = joinCommunityFromLink(db, identity, link.trim());
        if (result.ok) {
          void db.flush().catch(() => undefined);
          refresh();
        }
        return result;
      },
      queueJoinRequest: async (link: string): Promise<QueueJoinRequestResult> => {
        const parsed = parseCommunityInviteLink(link.trim());
        if (!parsed) return { ok: false, reason: 'malformed_link' };
        const descriptor = parsed.descriptor.descriptor;

        const stored = getCommunity(db, descriptor.communityId);
        if (stored && communityRole(stored.descriptor, identity.publicKey) !== null) {
          return { ok: false, reason: 'already_member' };
        }

        // Plan 27 P3: a proximity-gated community's join handoff never rides the
        // relay (AC-4). The web app is relay-only (no LAN/Nearby transport), so a
        // local_only community cannot be joined here at all -- refuse fail-closed
        // with an honest reason (read from the SIGNED invite descriptor).
        if (!transportPolicyAllows(communityTransportPolicy(descriptor), 'wan_relay')) {
          return { ok: false, reason: 'needs_local' };
        }

        const built = buildJoinRequest(identity, parsed);
        if (!built) return { ok: false, reason: 'no_owner_dh' };

        // Keep the retry intent even when the first network attempt fails.
        setSetting(db, `${PENDING_JOIN_LINK_PREFIX}${descriptor.communityId}`, link.trim());
        await db.flush();

        // Plan 57 W4: park on the community's OWN server first (the invite's
        // descriptor carries it) -- durable for days, restart-safe, owner asleep
        // is fine. The relay park stays as the second, TTL-bound rail.
        const hostParked = await parkJoinRequestOnInviteHost(parsed.descriptor, built.token, built.envelope)
          .catch(() => false);

        const relay = await ensureEffectiveRelayUrl(db);
        if (!relay.startsWith('ws') && !hostParked) return { ok: false, reason: 'no_relay' };
        const relayEntitlementToken = relay.startsWith('ws') ? entitlementTokenForRelay(relay) : undefined;
        if (relay.startsWith('ws') && relayRequiresHostedPayment(relay) && !relayEntitlementToken && !hostParked) {
          return { ok: false, reason: 'payment_required' };
        }

        const relayParkable = relay.startsWith('ws') && !(relayRequiresHostedPayment(relay) && !relayEntitlementToken);
        const parked = relayParkable
          ? await parkEnvelopeOnRelay(relay, built.token, built.envelope, relayEntitlementToken)
          : false;
        if (!parked && !hostParked) return { ok: false, reason: 'park_failed' };
        return { ok: true, communityId: descriptor.communityId, ownerDeviceId: descriptor.ownerDeviceId };
      },
      runJoinHandoffDrain: async (): Promise<JoinHandoffDrainResult> => {
        const relay = (effectiveRelayUrl(db));
        if (!relay.startsWith('ws')) {
          return { ran: false, joinRequestsServed: 0, joinGrantsApplied: 0, publicJoinRequestsRecorded: 0 };
        }
        const relayEntitlementToken = entitlementTokenForRelay(relay);
        if (relayRequiresHostedPayment(relay) && !relayEntitlementToken) {
          return { ran: false, joinRequestsServed: 0, joinGrantsApplied: 0, publicJoinRequestsRecorded: 0 };
        }

        // Re-park any still-pending join-request before draining (short TTL).
        await reparkPendingJoinRequests(relay, relayEntitlementToken);

        // The SAME shared join-handoff handler set + owned-community extra tokens
        // the owner's foreground drain uses, so the two paths cannot drift.
        const handlers = buildJoinHandoffHandlers(relay, relayEntitlementToken);
        const extraTokens = resolveJoinExtraTokens();

        const backend = new WebSocketRelayBackend();
        try {
          const drain = await runMailboxDrainJob({
            identity,
            backend,
            relayUrl: relay,
            peers: [],
            handlers,
            extraTokens,
            entitlementToken: relayEntitlementToken,
          });
          await db.flush();
          if (drain.joinGrants > 0 || drain.joinRequests > 0 || drain.publicJoinRequests > 0) refresh();
          return {
            ran: true,
            joinRequestsServed: drain.joinRequests,
            joinGrantsApplied: drain.joinGrants,
            publicJoinRequestsRecorded: drain.publicJoinRequests,
          };
        } finally {
          backend.destroy();
        }
      },
      approvePublicJoinRequestById: async (
        publicationId: string,
        senderDeviceId: string,
      ): Promise<ApprovePublicJoinRequestResult> => {
        const row = getPublicJoinRequest(db, publicationId, senderDeviceId);
        if (!row) return { ok: false, reason: 'not_found' };
        // Fail-closed at approve: a queued row was already humanity-gated at RECORD
        // (the service redeem spent its single-use token there), so approve does NOT
        // re-redeem or re-check expiry (a legitimately-queued request must stay
        // approvable as time passes). This only rejects a legacy/pre-AM1 row whose
        // token is structurally absent.
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

        const relay = await ensureEffectiveRelayUrl(db);
        const relayEntitlementToken = entitlementTokenForRelay(relay);

        const result = await approvePublicJoinRequest({
          db,
          owner: identity,
          parkEnvelope: (token, env) => parkEnvelopeOnRelay(relay, token, env, relayEntitlementToken),
          recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
          senderDeviceId,
          payload,
          publication,
        });

        if (result.ok) {
          setPublicJoinRequestStatus(db, publicationId, senderDeviceId, 'approved');
          await db.flush();
          refresh();
        }
        return result;
      },
      declinePublicJoinRequestById: (publicationId: string, senderDeviceId: string): void => {
        setPublicJoinRequestStatus(db, publicationId, senderDeviceId, 'declined');
        void db.flush().catch(() => undefined);
        refresh();
      },
      // Owner side (Plan 28 P3): remove a member for real. One call runs the whole
      // @mylife/sync orchestration: removal revision + survivor-only epoch rotation
      // (recordChange replicates wraps to paired members over the engine) +
      // per-survivor MEMBER_REMOVAL mailbox fan-out (the P2 drain applies it) +
      // descriptor republish to every http(s) node host (the hosted feed then
      // rejects the removed member). Honest counts ride back to the caller. With
      // no ws relay configured the park is a genuine no-op (counts stay 0); the
      // local rotation + node republish still land.
      removeCommunityMemberById: async (
        communityId: string,
        removedDeviceId: string,
      ): Promise<RemoveCommunityMemberResult> => {
        const relay = await ensureEffectiveRelayUrl(db);
        const relayEntitlementToken = entitlementTokenForRelay(relay);
        const result = await removeCommunityMember(
          {
            db,
            owner: identity,
            parkEnvelope: relay.startsWith('ws')
              ? (token, env) => parkEnvelopeOnRelay(relay, token, env, relayEntitlementToken)
              : () => false,
            republishDescriptor: async (nodeUrl, descriptor) =>
              (await republishCommunityDescriptor({ baseUrl: nodeUrl, identity, descriptor })).ok,
            recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
          },
          communityId,
          removedDeviceId,
        );
        if (result.ok) {
          await db.flush();
          refresh();
        }
        return result;
      },
      createInviteLink: (communityId: string): string | null => {
        const stored = getCommunity(db, communityId);
        if (!stored) return null;
        const { link } = createCommunityInvite(identity, {
          descriptor: stored.descriptor,
          signature: stored.signature,
        });
        return link;
      },
      promotePageChannel: (communityId: string, canvasId: string, tabName: string): void => {
        const stored = getCommunity(db, communityId);
        if (!stored) throw new Error('Community not found.');
        if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
          throw new Error('Only the community owner can promote a page.');
        }
        if (stored.descriptor.channels.some((c) => c.id === canvasId)) {
          throw new Error('That page is already a tab.');
        }
        const revised = reviseCommunity(
          identity,
          { descriptor: stored.descriptor, signature: stored.signature },
          { channels: [...stored.descriptor.channels, { id: canvasId, name: tabName, kind: 'page' }] },
        );
        upsertCommunity(db, revised, identity.publicKey);
        void db.flush().catch(() => undefined);
        refresh();
      },
      demotePageChannel: (communityId: string, canvasId: string): void => {
        const stored = getCommunity(db, communityId);
        if (!stored) throw new Error('Community not found.');
        if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
          throw new Error('Only the community owner can demote a page.');
        }
        const revised = reviseCommunity(
          identity,
          { descriptor: stored.descriptor, signature: stored.signature },
          { channels: stored.descriptor.channels.filter((c) => c.id !== canvasId) },
        );
        upsertCommunity(db, revised, identity.publicKey);
        void db.flush().catch(() => undefined);
        refresh();
      },
      addChannel: (communityId: string, name: string, kind: 'chat' | 'canvas' = 'chat'): AddChannelResult => {
        const stored = getCommunity(db, communityId);
        if (!stored) return { ok: false, error: 'Community not found.' };
        if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
          return { ok: false, error: 'Only the community owner can add channels.' };
        }
        const channelName = name.trim();
        const channelId = channelName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        if (!channelId) return { ok: false, error: 'Enter a channel name.' };
        if (stored.descriptor.channels.some((c) => c.id === channelId)) {
          return { ok: false, error: 'A channel with that name already exists.' };
        }
        // VERIFIED PROTOCOL FACT: community descriptors do NOT sync over the
        // engine session. reviseCommunity bumps the revision; members only pick
        // the new channel up by RE-JOINING from a freshly issued invite link
        // (upsertCommunity replaces a stored community when the new descriptor
        // has a higher revision). So this writes locally only -- it is NEVER a
        // push to members. The UI must tell the owner to share a fresh invite.
        const revised = reviseCommunity(
          identity,
          { descriptor: stored.descriptor, signature: stored.signature },
          { channels: [...stored.descriptor.channels, kind === 'canvas' ? { id: channelId, name: channelName, kind } : { id: channelId, name: channelName }] },
        );
        upsertCommunity(db, revised, identity.publicKey);
        void db.flush().catch(() => undefined);
        refresh();
        return { ok: true };
      },
      saveCommunityOrganization: (
        communityId: string,
        changes: { channels: CommunityChannel[]; categories: CommunityChannelCategory[] },
      ): AddChannelResult => {
        const stored = getCommunity(db, communityId);
        if (!stored) return { ok: false, error: 'Community not found.' };
        if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
          return { ok: false, error: 'Only the community owner can organize channels.' };
        }
        if (changes.channels.length === 0) {
          return { ok: false, error: 'A community needs at least one channel.' };
        }
        try {
          // ONE revision for the whole batch of edits (Plan 38 batching rule):
          // reviseCommunity bumps the revision exactly once. Same honesty as
          // addChannel -- writes locally; members rejoin from a fresh link.
          const revised = reviseCommunity(
            identity,
            { descriptor: stored.descriptor, signature: stored.signature },
            { channels: changes.channels, categories: changes.categories },
          );
          upsertCommunity(db, revised, identity.publicKey);
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : 'Could not save organization.' };
        }
      },
      setCommunityTransportPolicy: (communityId: string, policy: CommunityTransportPolicy): AddChannelResult => {
        const stored = getCommunity(db, communityId);
        if (!stored) return { ok: false, error: 'Community not found.' };
        if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
          return { ok: false, error: 'Only the community owner can change the sync policy.' };
        }
        try {
          // ONE signed revisePolicy revision + record the owner's own change into
          // the observed ledger (idempotent). Members converge on the newer
          // descriptor; this writes locally and never claims a live push.
          const revised = revisePolicy(
            identity,
            { descriptor: stored.descriptor, signature: stored.signature },
            policy,
          );
          upsertCommunity(db, revised, identity.publicKey);
          reconcileCommunityPolicyHistory(db);
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : 'Could not save the sync policy.' };
        }
      },
      setCommunityLayout: (communityId: string, layout: CommunityLayout): AddChannelResult => {
        const stored = getCommunity(db, communityId);
        if (!stored) return { ok: false, error: 'Community not found.' };
        if (stored.descriptor.ownerDeviceId !== identity.publicKey) {
          return { ok: false, error: 'Only the community owner can change the layout.' };
        }
        try {
          // ONE revision, presentation only: reviseCommunity carries just `layout`.
          const revised = reviseCommunity(
            identity,
            { descriptor: stored.descriptor, signature: stored.signature },
            { layout },
          );
          upsertCommunity(db, revised, identity.publicKey);
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : 'Could not change the layout.' };
        }
      },
      communityPrefs: (): CommunityPrefRow[] => listCommunityPrefs(db),
      setCommunityPref: (communityId: string, patch: CommunityPrefsPatch): void => {
        setCommunityPrefs(db, communityId, patch);
        void db.flush().catch(() => undefined);
        refresh();
      },
      reorderCommunities: (orderedIds: string[]): void => {
        orderedIds.forEach((id, index) => setCommunityPrefs(db, id, { sortIndex: index }));
        void db.flush().catch(() => undefined);
        refresh();
      },
      leaveCommunity: (communityId: string): void => {
        leaveCommunityRow(db, communityId);
        removeWorkspaceMember(db, communityId, identity.publicKey);
        if (lastCommunityId === communityId) {
          setSetting(db, LAST_COMMUNITY_SETTING_KEY, '');
          setSetting(db, LAST_CHANNEL_SETTING_KEY, '');
          setLastCommunityId(null);
          setLastChannelId(null);
        }
        void db.flush().catch(() => undefined);
        refresh();
      },
      listCommunities: (): StoredCommunity[] => listCommunities(db),
      listChannelMessages: (communityId: string, channelId: string): ChannelMessageEvent[] =>
        listChannelMessages(db, communityId, channelId),
      listChannelPostCards: (communityId: string, channelId: string): ChannelPostCard[] =>
        listChannelPostCards(db, communityId, channelId),
      listChannelPostThread: (
        communityId: string,
        channelId: string,
        postId: string,
      ): ChannelPostThread | null => listChannelPostThread(db, communityId, channelId, postId),
      sendChannelMessage: (
        communityId: string,
        channelId: string,
        body: string,
        opts?: SendMessageOpts,
      ): SendChannelMessageResult => {
        const trimmed = body.trim();
        if (!trimmed) return { ok: false, error: 'Write a message first.' };
        try {
          // A plain message is byte-identical to the pre-Plan-30 v1 builder; any
          // v2 opt (mentions / reply parentId / post threading) forces the v2 path.
          const event = buildOutgoingChannelMessage(identity, {
            communityId,
            channelId,
            body: trimmed,
            attachments: [],
            opts,
            hlc: nextHlc(highestHlc(db, communityId, channelId), new Date().toISOString()),
          });
          insertMessageRow(db, event);
          // Plan 57 W3: best-effort mirror to the community's attached server
          // (live-tail append + owner-throttled snapshot refresh); never blocks.
          mirrorEventToCommunityHost(db, identity, event, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
          engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, {
            ...channelMessageRowFromEvent(event),
          });
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true, event };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      sendChannelPost: (
        communityId: string,
        channelId: string,
        body: string,
      ): SendChannelMessageResult => {
        const trimmed = body.trim();
        if (!trimmed) return { ok: false, error: 'Write a post first.' };
        try {
          const event = createChannelPostEvent(identity, {
            communityId,
            channelId,
            body: trimmed,
            hlc: nextHlc(highestHlc(db, communityId, channelId), new Date().toISOString()),
          });
          insertMessageRow(db, event);
          // Plan 57 W3: best-effort mirror to the community's attached server.
          mirrorEventToCommunityHost(db, identity, event, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
          const postHeader = insertPostHeaderRow(db, event);
          engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, {
            ...channelMessageRowFromEvent(event),
          });
          engine.recordChange(CM_POSTS_TABLE, 'INSERT', postHeader.id, {
            ...postHeader,
          });
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true, event };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      replyToPost: (parent: ChannelMessageEvent, body: string): SendChannelMessageResult => {
        const trimmed = body.trim();
        if (!trimmed) return { ok: false, error: 'Write a reply first.' };
        try {
          const event = createChannelPostReplyEvent(identity, {
            parent,
            body: trimmed,
            hlc: nextHlc(highestHlc(db, parent.communityId, parent.channelId), new Date().toISOString()),
          });
          insertMessageRow(db, event);
          // Plan 57 W3: best-effort mirror to the community's attached server
          // (live-tail append + owner-throttled snapshot refresh); never blocks.
          mirrorEventToCommunityHost(db, identity, event, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
          engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, {
            ...channelMessageRowFromEvent(event),
          });
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true, event };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      attachAndSend: async (
        communityId: string,
        channelId: string,
        body: string,
        files: ComposerFile[],
        opts?: SendMessageOpts,
      ): Promise<SendChannelMessageResult> => {
        const trimmed = body.trim();
        if (!trimmed && files.length === 0) {
          return { ok: false, error: 'Write a message or attach a file first.' };
        }
        try {
          // Seal each file into the on-device blob store and build signed
          // attachment metadata. putLocal hashes + verifies the bytes landed.
          const attachments: ChannelMessageAttachment[] = [];
          for (const file of files) {
            const stored = await blobStore.putLocal(file.bytes, {
              moduleId: COMMUNITY_MODULE_ID,
              mimeType: file.mimeType,
            });
            attachments.push({
              id: stored.hash.slice(0, 16),
              blobHash: stored.hash,
              name: file.name,
              mimeType: file.mimeType,
              size: stored.size,
            });
          }
          // v2 opts (reply parentId / mentions) carry through when present; a plain
          // attach stays byte-identical to the v1 attachment builder.
          const event = buildOutgoingChannelMessage(identity, {
            communityId,
            channelId,
            body: trimmed,
            attachments,
            opts,
            hlc: nextHlc(highestHlc(db, communityId, channelId), new Date().toISOString()),
          });
          insertMessageRow(db, event);
          // Plan 57 W3: best-effort mirror to the community's attached server.
          mirrorEventToCommunityHost(db, identity, event, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
          insertMessageAttachmentRows(db, event);
          engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, {
            ...channelMessageRowFromEvent(event),
          });
          for (const row of channelMessageAttachmentRowsFromEvent(event)) {
            engine.recordChange(CM_MESSAGE_ATTACHMENTS_TABLE, 'INSERT', row.id, { ...row });
          }
          await db.flush();
          refresh();
          return { ok: true, event };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      editMessage: (event: ChannelMessageEvent, body: string): SendChannelMessageResult => {
        const trimmed = body.trim();
        if (!trimmed) return { ok: false, error: 'Write a message first.' };
        if (event.authorDeviceId !== identity.publicKey) {
          return { ok: false, error: 'Only the author device can edit this message.' };
        }
        try {
          // Gate on version === 2 (NOT isChannelPostEvent): a v2 chat REPLY carries
          // parentId but no postId, and a mention-bearing v2 message has neither, so
          // a postId-based gate would re-sign the edit as v1 and DROP
          // parentId/mentions/branchId (de-linking the reply cross-device). The
          // shared builder preserves every v2 field.
          const edited = buildEditedChannelMessage(identity, {
            event,
            body: trimmed,
            hlc: nextHlc(highestHlc(db, event.communityId, event.channelId), new Date().toISOString()),
          });
          insertMessageRow(db, edited);
          // Plan 57 W3: best-effort mirror to the community's attached server.
          mirrorEventToCommunityHost(db, identity, edited, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
          engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', edited.id, {
            ...channelMessageRowFromEvent(edited),
          });
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true, event: edited };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      deleteMessage: (event: ChannelMessageEvent): SendChannelMessageResult => {
        if (event.authorDeviceId !== identity.publicKey) {
          return { ok: false, error: 'Only the author device can delete this message.' };
        }
        try {
          // Same version-gate fix as editMessage: a v2 reply/mention message must
          // tombstone as v2 so the tombstone stays linked + verifies, never re-signed
          // as v1 with the v2 fields stripped.
          const deleted = buildDeletedChannelMessage(identity, {
            event,
            hlc: nextHlc(highestHlc(db, event.communityId, event.channelId), new Date().toISOString()),
          });
          insertMessageRow(db, deleted);
          // Plan 57 W3: best-effort mirror to the community's attached server.
          mirrorEventToCommunityHost(db, identity, deleted, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
          engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', deleted.id, {
            ...channelMessageRowFromEvent(deleted),
          });
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true, event: deleted };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      channelReactions: (
        communityId: string,
        channelId: string,
      ): Map<string, MessageReactionGroup[]> =>
        listChannelReactions(db, communityId, channelId, identity.publicKey),
      sendReaction: (
        communityId: string,
        channelId: string,
        target: { eventId: string; postId?: string },
        emoji: string,
      ): SendChannelMessageResult => {
        // Idempotent: if this device already holds this emoji on the target, do
        // not author a duplicate (a rapid double-tap must not stack two reacts,
        // which would leave a sticky chip after one un-tap).
        const existing = listActiveOwnReactionEventIds(
          db, communityId, channelId, identity.publicKey, target.eventId, emoji,
        );
        if (existing.length > 0) {
          const existingEvent = getChannelMessageEventById(db, existing[0]!);
          if (existingEvent) return { ok: true, event: existingEvent };
        }
        try {
          const event = buildReactionEvent(identity, {
            communityId,
            channelId,
            targetEventId: target.eventId,
            targetPostId: target.postId,
            emoji,
            hlc: nextHlc(highestHlc(db, communityId, channelId), new Date().toISOString()),
          });
          insertMessageRow(db, event);
          // Plan 57 W3: best-effort mirror to the community's attached server
          // (live-tail append + owner-throttled snapshot refresh); never blocks.
          mirrorEventToCommunityHost(db, identity, event, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
          engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, {
            ...channelMessageRowFromEvent(event),
          });
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true, event };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      removeReaction: (
        communityId: string,
        channelId: string,
        myEventId: string,
      ): SendChannelMessageResult => {
        const original = getChannelMessageEventById(db, myEventId);
        if (!original || original.intent !== 'react' || !original.parentId) {
          return { ok: false, error: 'That reaction is no longer available.' };
        }
        if (original.authorDeviceId !== identity.publicKey) {
          return { ok: false, error: 'Only your own reaction can be removed.' };
        }
        // Un-react is TOTAL: tombstone EVERY active react this device holds for the
        // (target, emoji) pair, so an un-tap always leaves zero active reacts even
        // if a duplicate ever slipped through. Already-removed = no-op.
        const targets = listActiveOwnReactionEventIds(
          db, communityId, channelId, identity.publicKey, original.parentId, original.body,
        );
        if (targets.length === 0) return { ok: true, event: original };
        try {
          let last = original;
          for (const reactionEventId of targets) {
            const event = buildUnreactionEvent(identity, {
              communityId,
              channelId,
              parentId: original.parentId,
              postId: original.postId,
              reactionEventId,
              hlc: nextHlc(highestHlc(db, communityId, channelId), new Date().toISOString()),
            });
            insertMessageRow(db, event);
            // Plan 57 W3: best-effort mirror to the community's attached server.
            mirrorEventToCommunityHost(db, identity, event, { entitlementToken: hostedAccess.entitlementToken ?? undefined });
            engine.recordChange(CM_MESSAGES_TABLE, 'INSERT', event.id, {
              ...channelMessageRowFromEvent(event),
            });
            last = event;
          }
          void db.flush().catch(() => undefined);
          refresh();
          return { ok: true, event: last };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
      // Web has NO personal-replica multi-device flow, so the read marker is
      // written to the cm_read_state row LOCALLY ONLY and is NEVER pushed
      // through engine.recordChange. This is strictly safer than native.
      markChannelRead: (communityId: string, channelId: string): void => {
        const top = highestHlc(db, communityId, channelId);
        if (!top) return;
        markChannelReadRow(db, communityId, channelId, top);
        void db.flush().catch(() => undefined);
        refresh();
      },
      // Plan 30 m3: advance the read cursor to the newest VISIBLE event AND pass
      // its authorDeviceId, so markChannelReadRow stores the (wall,counter,author)
      // boundary and the tiebreak is live (a distinct remote event at the exact
      // boundary wall+counter stays unread). The write site is otherwise identical
      // (row-only, never engine.recordChange).
      markChannelReadLatest: (communityId: string, channelId: string): void => {
        const events = listChannelMessages(db, communityId, channelId);
        const newestId = newestVisibleEventId(events, () => false);
        const newest = newestId ? events.find((e) => e.id === newestId) : null;
        if (!newest) return;
        markChannelReadRow(db, communityId, channelId, newest.hlc, newest.authorDeviceId);
        void db.flush().catch(() => undefined);
        refresh();
      },
      channelReadBoundary: (communityId: string, channelId: string): ReadBoundary | null =>
        readBoundaryFromReadState(getChannelReadState(db, communityId, channelId)),
      unreadCount: (communityId: string, channelId: string): number =>
        countUnreadChannelMessages(db, communityId, channelId),
      communityUnreadCounts: (communityId: string): Record<string, number> =>
        listCommunityChannelUnreadCounts(db, communityId),
      myPairingPayload: (): string => JSON.stringify(buildSignedPairingPayload(identity)),
      pairFromPayload: (json: string): PairFriendResult => {
        const parsed = parseSignedPairingPayload(normalizeMeerkatPairingInput(json));
        if (!parsed) {
          return { ok: false, error: 'That pairing code is malformed or its signature did not verify.' };
        }
        const result = applyTrustedBundle(parsed.bundle);
        if (result.ok) {
          void db.flush().catch(() => undefined);
        }
        return result;
      },
      pairWithFriendCode: async (code: string): Promise<PairFriendResult> => {
        const relay = await ensureEffectiveRelayUrl(db);
        if (!relay.startsWith('ws')) {
          return { ok: false, error: 'Set a connection server before adding a friend by code.' };
        }
        const relayEntitlementToken = entitlementTokenForRelay(relay);
        if (relayRequiresHostedPayment(relay) && !relayEntitlementToken) {
          return {
            ok: false,
            error: 'The hosted Meerkat connection server requires an active subscription. Use your own connection server or sign in to hosted access.',
          };
        }
        const resolved = await resolveIdentityFromRendezvous({
          url: relay,
          code: code.trim(),
          entitlementToken: relayEntitlementToken,
        });
        if (!resolved.ok) {
          if (resolved.reason === 'bad_code') return { ok: false, error: 'That friend code is not valid. Check for typos.' };
          if (resolved.reason === 'not_found') {
            return {
              ok: false,
              error: 'No identity is published for that code. It may have expired, been used already, or never published.',
            };
          }
          return {
            ok: false,
            error: 'The resolved identity failed signature verification. Do not pair: it may be a man-in-the-middle.',
          };
        }
        const result = applyTrustedBundle(resolved.bundle);
        if (result.ok) await db.flush();
        return result;
      },
      getPeerSas: (peerDeviceId: string): SasResult | null => {
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
      isPeerSasVerified: (peerDeviceId: string): boolean =>
        getSasVerification(db, peerDeviceId, '') !== null,
      confirmPeerSas: (peerDeviceId: string): boolean => {
        const peer = getPairedDevice(db, peerDeviceId);
        if (!peer?.sharedSecretRef) return false;
        const hex = getSharedSecretHex(peer.sharedSecretRef);
        if (!hex) return false;
        try {
          const sas = deriveSas(hexToBytes(hex));
          recordSasVerification(db, { peerDeviceId, workspaceId: '', sasIndices: sasFingerprint(sas) });
          void db.flush().catch(() => undefined);
          refresh();
          return true;
        } catch {
          return false;
        }
      },
      isPeerRevoked: (peerDeviceId: string): boolean => isDeviceRevoked(db, peerDeviceId),
      revokePeer: (peerDeviceId: string, reason?: string): void => {
        const signed = createSignedRevocation(identity, peerDeviceId, reason);
        applySignedRevocation(db, signed, {
          isAuthorizedRevoker: (revoker) => revoker === identity.publicKey,
        });
        void db.flush().catch(() => undefined);
        refresh();
      },
      pairedDevices: (): PairedDevice[] => getPairedDevices(db),
      recentSessions: (): SyncSession[] => getRecentSyncSessions(db, 20),
      runRelaySession: async (input: RunRelaySessionInput): Promise<SyncSession | null> => {
        setLastSessionError(null);
        const relay = await ensureEffectiveRelayUrl(db);
        const relayEntitlementToken = entitlementTokenForRelay(relay);
        if (relayRequiresHostedPayment(relay) && !relayEntitlementToken) {
          const message = 'The hosted Meerkat connection server requires an active subscription. Use your own connection server or sign in to hosted access.';
          setLastSessionError(message);
          throw new Error(message);
        }
        // Mirror SyncProvider.runRelaySession: one job, fresh backend (the job
        // destroys it). The relay URL comes from real settings only.
        const result = await runSyncSessionJob({
          backend: new WebSocketRelayBackend(),
          relayUrl: relay,
          token: buildRendezvousToken(input.phrase),
          peerDeviceId: input.peerDeviceId,
          entitlementToken: relayEntitlementToken,
          role: input.role,
          engine,
          connect: (opts) => connectRelayPeer(opts),
        });
        await db.flush();
        refresh();
        if (!result.ran && result.error) {
          setLastSessionError(result.error);
          throw new Error(result.error);
        }
        if (result.session) setLastSession(result.session);
        return result.session ?? null;
      },
      refreshFeed: async (communityId: string): Promise<RefreshCommunityFeedResult> => {
        // Web has no peer-backfill queue wired, so enqueuePeerBackfill is omitted:
        // with no reachable node this honestly reports 'no host reachable', and a
        // node that rejects this device reports 'removed'. Browser global fetch.
        const result = await refreshCommunityFeed(db, identity, communityId, {
          fetchFn: fetchWithHostedEntitlement,
        });
        await db.flush();
        // Only a real applied > 0 changes the rendered feed; bump revision so the
        // cached list re-reads. The timestamp/source update is read directly by
        // the caller from the returned result + getLastPulledAt.
        if (result.applied > 0) refresh();
        return result;
      },
      getAutoUpdate: (communityId: string): boolean => getAutoUpdate(db, communityId),
      setAutoUpdate: (communityId: string, on: boolean): void => {
        setAutoUpdate(db, communityId, on);
        void db.flush().catch(() => undefined);
        refresh();
      },
      isCommunityMuted: (communityId: string): boolean => isCommunityMutedRow(db, communityId),
      setCommunityMuted: (communityId: string, muted: boolean, label?: string): void => {
        setCommunityMutedRow(db, communityId, muted, label);
        void db.flush().catch(() => undefined);
        refresh();
      },
      isChannelMuted: (communityId: string, channelId: string): boolean =>
        isChannelMutedRow(db, communityId, channelId),
      setChannelMuted: (communityId: string, channelId: string, muted: boolean, label?: string): void => {
        setChannelMutedRow(db, communityId, channelId, muted, label);
        void db.flush().catch(() => undefined);
        refresh();
      },
      isCommunityPersonBlocked: (communityId: string, deviceId: string): boolean =>
        isCommunityPersonBlockedRow(db, communityId, deviceId),
      setCommunityPersonBlocked: (
        communityId: string,
        deviceId: string,
        blocked: boolean,
        label?: string,
      ): void => {
        if (blocked) {
          blockCommunityPersonRow(db, communityId, deviceId, label);
        } else {
          clearCommunitySafetyAction(db, communityId, 'person', deviceId, 'block');
        }
        void db.flush().catch(() => undefined);
        refresh();
      },
      blockCommunityPerson: (communityId: string, deviceId: string, label?: string): void => {
        blockCommunityPersonRow(db, communityId, deviceId, label);
        void db.flush().catch(() => undefined);
        refresh();
      },
      reportCommunityContent: (input: ReportCommunityContentInput): void => {
        reportCommunityContentRow(db, input);
        void db.flush().catch(() => undefined);
        refresh();
      },
      ownerReviewItems: (communityId: string): CommunitySafetyActionRow[] =>
        listOwnerReviewItems(db, communityId),
      markSafetyReviewed: (id: string, status: 'reviewed' | 'dismissed' = 'reviewed'): void => {
        markSafetyActionReviewed(db, id, status);
        void db.flush().catch(() => undefined);
        refresh();
      },
      getLastPulledAt: (communityId: string): string | null => getLastPulledAt(db, communityId),
      // --- Slice 4 (files) ---------------------------------------------------
      getBlob: (hash: string): Promise<Uint8Array | null> => blobStore.get(hash),
      removeLocalBlob: (hash: string) => blobStore.removeLocal(hash),
      hasBlob: (hash: string): Promise<boolean> => blobStore.has(hash),
      blobPreviewDataUri: (hash: string, mimeType: string): Promise<string | null> =>
        blobStore.previewDataUri(hash, mimeType),
      listChannelFiles: async (communityId: string): Promise<PresentFile[]> => {
        const stored = getCommunity(db, communityId);
        if (!stored) return [];
        const aggregated = aggregateCommunityFiles(db, communityId, stored.descriptor.channels);
        const presence = await buildPresenceMap(aggregated, (hash) => blobStore.has(hash));
        return applyPresence(aggregated, presence);
      },
      outgoingRequestFor: (communityId, channelId, attachmentId): FileRequestRow | null =>
        getOutgoingRequestForAttachment(db, communityId, channelId, attachmentId),
      incomingFileRequests: (communityId: string): FileRequestRow[] =>
        listIncomingPendingRequests(db, communityId),
      // Requester side: seal + park a FILE_REQUEST to the message author, then
      // write the outgoing cm_file_requests row ONLY on a real (non-throwing)
      // park. The relay send is FIRE-AND-FORGET: parked just means send() did
      // not throw, NOT that the relay confirmed a mailbox entry.
      requestFileAgain: async (
        event: ChannelMessageEvent,
        attachment: ChannelMessageAttachment,
      ): Promise<RequestFileAgainResult> =>
        requestFileAgainByFieldsImpl({
          communityId: event.communityId,
          channelId: event.channelId,
          messageId: event.id,
          attachmentId: attachment.id,
          blobHash: attachment.blobHash,
          ownerDeviceId: event.authorDeviceId,
        }),
      // Fields-based twin (D.1): the Files index holds only the aggregated row
      // primitives, not the full signed event + attachment. Same gates + same
      // honest-row-on-real-park path as requestFileAgain.
      requestFileAgainByFields: requestFileAgainByFieldsImpl,
      approveFileRequest: (requestId: string): Promise<FileGrantResult> =>
        runFileGrant(requestId, 'approve'),
      declineFileRequest: (requestId: string): Promise<FileGrantResult> =>
        runFileGrant(requestId, 'decline'),
      // --- Direct messages (Plan 21 Phase 9): the SAME pure cores as mobile ---
      queueDmMessage: async (
        conversationId: string,
        body: string,
        attachments?: DmMessageAttachment[],
      ): Promise<QueueDmMessageResult> => {
        // Split each attachment's cached bytes into wire blocks so the recipient
        // can verify-then-pin. A missing blob just sends metadata (a later
        // re-request pulls it). Mirrors the mobile SyncProvider.queueDmMessage.
        const blocks = [];
        for (const attachment of attachments ?? []) {
          const bytes = await blobStore.get(attachment.blobHash);
          if (!bytes) continue;
          blocks.push(...splitBlobForTransfer(bytes, attachment.blobHash, 'dm', attachment.mimeType));
        }
        const result = await queueDmMessageCore({
          db,
          identity,
          conversationId,
          body,
          attachments,
          blocks: blocks.length > 0 ? blocks : undefined,
          relayAvailable: (await dmRelay()).available,
          resolvePairSecret: resolveDmPairSecret,
          parkEnvelope: dmParkEnvelope,
        });
        await db.flush();
        refresh();
        return result;
      },
      queueDmReceipt: async (
        conversationId: string,
        messageId: string,
        state: DmReceiptState,
      ): Promise<QueueDmReceiptResult> => {
        const result = await queueDmReceiptCore({
          db,
          identity,
          conversationId,
          messageId,
          state,
          relayAvailable: (await dmRelay()).available,
          resolvePairSecret: resolveDmPairSecret,
          parkEnvelope: dmParkEnvelope,
        });
        await db.flush();
        return result;
      },
      queueDmShred: async (conversationId: string, messageIds: string[]): Promise<QueueDmShredResult> => {
        const result = await queueDmShredCore({
          db,
          identity,
          conversationId,
          messageIds,
          relayAvailable: (await dmRelay()).available,
          resolvePairSecret: resolveDmPairSecret,
          parkEnvelope: dmParkEnvelope,
          deleteBlob: async (hash) => { await blobStore.removeLocal(hash); },
        });
        await db.flush();
        refresh();
        return result;
      },
      linkOwnDeviceAsPerson: async (input: {
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
            const resolved = resolvePairedSecret(db, deviceId);
            return resolved
              ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
              : null;
          },
          parkEnvelope: dmParkEnvelope,
          recordChange: (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string, data: Record<string, unknown> | null) =>
            engine.recordChange(table, op, rowId, data),
        };
        // A first link forms the genesis group (this device + the new one);
        // a later link adds to the existing group.
        const add = stored
          ? [{ deviceId: input.deviceId, label: input.label }]
          : [
              { deviceId: identity.publicKey, label: displayName || 'This device' },
              { deviceId: input.deviceId, label: input.label },
            ];
        const result = await proposePersonGroupRevision(ceremonyDeps, { add });
        await db.flush();
        refresh();
        return result;
      },
      hasPendingPersonProposal: (): boolean => listPendingPersonProposals(db).length > 0,
      cancelPendingPersonProposals: (): void => {
        for (const row of listPendingPersonProposals(db)) cancelPersonProposal(db, row.id);
        void db.flush().catch(() => undefined);
        refresh();
      },
      pendingPersonRemovals: (): InboundPersonProposal[] =>
        listInboundPersonApprovals(db, identity.publicKey),
      approvePersonRemoval: async (id: string): Promise<boolean> => {
        const ok = await approveInboundPersonProposal({
          db,
          identity,
          listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
          listDmPeerIds: () => getPairedDevices(db)
            .filter((peer) => peer.isActive)
            .map((peer) => peer.deviceId),
          resolvePairedDevice: (peerId: string) => {
            const resolved = resolvePairedSecret(db, peerId);
            return resolved
              ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
              : null;
          },
          parkEnvelope: dmParkEnvelope,
          recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
        }, id);
        await db.flush();
        refresh();
        return ok;
      },
      declinePersonRemoval: (id: string): void => {
        declineInboundPersonProposal(db, id);
        void db.flush().catch(() => undefined);
        refresh();
      },
      // Round-3 HIGH-1: the user-facing escape from an irreconcilable person group.
      rebuildOwnPersonGroup: (): void => {
        resetPersonGroup(db, (table, op, rowId, data) => engine.recordChange(table, op, rowId, data));
        void db.flush().catch(() => undefined);
        refresh();
      },
      unlinkOwnDeviceFromPerson: async (deviceId: string): Promise<ProposePersonGroupResult> => {
        const result = await removeDevicesFromPerson({
          db,
          identity,
          listOwnDeviceIds: () => listDmOwnDevices(db).map((row) => row.device_id),
          listDmPeerIds: () => getPairedDevices(db)
            .filter((peer) => peer.isActive)
            .map((peer) => peer.deviceId),
          resolvePairedDevice: (id: string) => {
            const resolved = resolvePairedSecret(db, id);
            return resolved
              ? { dhPublicKey: resolved.peer.dhPublicKey, sharedSecretHex: resolved.sharedSecretHex }
              : null;
          },
          parkEnvelope: dmParkEnvelope,
          recordChange: (table, op, rowId, data) => engine.recordChange(table, op, rowId, data),
          revokeOwnDeviceLink: (id: string) => removeDmOwnDevice(db, id),
        }, [deviceId]);
        await db.flush();
        refresh();
        return result;
      },
      linkOwnDevice: (input: { deviceId: string; identityAnchor: string; dhPublicKey: string }): void => {
        linkOwnDeviceCore(db, input);
        void db.flush().catch(() => undefined);
        refresh();
      },
      createDmGroup: async (title: string, members: DmGroupMember[]): Promise<CreateDmGroupCoreResult> => {
        const result = await createDmGroupCore({
          db,
          identity,
          title,
          members,
          relayAvailable: (await dmRelay()).available,
          resolvePairSecret: resolveDmPairSecret,
          parkEnvelope: dmParkEnvelope,
        });
        await db.flush();
        refresh();
        return result;
      },
      dmGroupAddMember: async (conversationId: string, added: DmGroupMember): Promise<DmGroupMutationCoreResult> => {
        const result = await dmGroupAddMemberCore({
          db,
          identity,
          conversationId,
          added,
          relayAvailable: (await dmRelay()).available,
          resolvePairSecret: resolveDmPairSecret,
          parkEnvelope: dmParkEnvelope,
        });
        if (result.ok) { await db.flush(); refresh(); }
        return result;
      },
      dmGroupRemoveMember: async (conversationId: string, removedDeviceId: string): Promise<DmGroupMutationCoreResult> => {
        const result = await dmGroupRemoveMemberCore({
          db,
          identity,
          conversationId,
          removedDeviceId,
          relayAvailable: (await dmRelay()).available,
          resolvePairSecret: resolveDmPairSecret,
          parkEnvelope: dmParkEnvelope,
        });
        if (result.ok) { await db.flush(); refresh(); }
        return result;
      },
      blockDmParticipant: (deviceId: string, reason?: string): void => {
        blockDmParticipantCore(db, identity, deviceId, reason);
        void db.flush().catch(() => undefined);
        refresh();
      },
      reportDm: (input: ReportDmInput): void => {
        reportDmCore(db, input);
        void db.flush().catch(() => undefined);
        refresh();
      },
      runForegroundDrain,
      liveWake: {
        relayUrl: async (): Promise<string | null> => {
          const relay = await ensureEffectiveRelayUrl(db);
          if (!relay.startsWith('ws')) return null;
          // Hosted relays without an entitlement are honestly unavailable,
          // mirroring runForegroundDrain's payment gate.
          if (relayRequiresHostedPayment(relay) && !entitlementTokenForRelay(relay)) return null;
          return relay;
        },
        entitlementToken: (): string | undefined => entitlementTokenForRelay(effectiveRelayUrl(db)),
        peers: resolveDrainPeers,
        extraTokens: () => [...resolveJoinExtraTokens(), ...resolveDmExtraTokens()],
        handlers: (): MailboxEnvelopeHandlers => {
          const relay = effectiveRelayUrl(db);
          return buildForegroundHandlers(relay, entitlementTokenForRelay(relay));
        },
        onApplied: (): void => {
          // Audit 2026-09-01 A1: refresh whether or not the flush persisted.
          // The applied rows are already in the live db; a persist failure is
          // surfaced by the adapter's own failure state, and skipping refresh
          // here only hid a message the drain just counted.
          void db.flush().then(() => refresh(), () => refresh());
        },
      },
      autoConnectEnabled,
      setAutoConnect,
      lastAutoConnectRound,
      lastAutoConnectError,
      autoConnectRound,
      lastSession,
      lastSessionError,
      lastCommunityId,
      lastChannelId,
      rememberLocation: (communityId: string | null, channelId: string | null): void => {
        setSetting(db, LAST_COMMUNITY_SETTING_KEY, communityId ?? '');
        setSetting(db, LAST_CHANNEL_SETTING_KEY, channelId ?? '');
        void db.flush().catch(() => undefined);
        setLastCommunityId(communityId);
        setLastChannelId(channelId);
      },
      // --- Slice 5 (settings) -----------------------------------------------
      secureStorageConfigured: hasConfiguredSyncSecretStore(),
      storageStats: (): StorageStats => {
        const communities = listCommunities(db);
        const channels = communities.reduce(
          (sum, c) => sum + c.descriptor.channels.length,
          0,
        );
        const messages =
          db.query<{ n: number }>('SELECT COUNT(*) AS n FROM cm_messages')[0]?.n ?? 0;
        const blob =
          db.query<{ n: number; bytes: number }>(
            'SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM sync_blobs',
          )[0] ?? { n: 0, bytes: 0 };
        return {
          communities: communities.length,
          channels,
          messages,
          localFiles: blob.n,
          localBytes: blob.bytes,
        };
      },
      restoreIdentity,
      generateRecovery: (): RecoveryMaterial => {
        const { key, bytes } = generateRecoveryKey();
        const sealed = sealRecovery(exportRecoverableIdentity(identity), bytes);
        return { key, sealed };
      },
      resetIdentity,
      deleteMyData,
      deleteSecret: (ref: string) => { secrets.deleteSecret?.(ref); },
      storageSecretAccess: storageSecretAccess(secrets),
  revision,
      refresh,
      defaultRelayOptedOut,
      setDefaultRelayOptedOut,
      defaultRelayConfigured: DEFAULT_RELAY_URL.trim().length > 0,
      appUnlock: {
        status: appUnlockStatus,
        detail: appUnlockDetail,
        revalidate: revalidateAppUnlock,
      },
    };
  }, [
    boot,
    appUnlockStatus,
    appUnlockDetail,
    revalidateAppUnlock,
    status,
    relayUrl,
    setRelayUrl,
    defaultRelayOptedOut,
    setDefaultRelayOptedOut,
    hostedAccess,
    entitlementTokenForRelay,
    fetchWithHostedEntitlement,
    autoConnectEnabled,
    setAutoConnect,
    lastAutoConnectRound,
    lastAutoConnectError,
    displayName,
    friendCode,
    friendCodeIsCustom,
    onboardingComplete,
    lastSession,
    lastSessionError,
    lastCommunityId,
    lastChannelId,
    personalWorkspaceId,
    restoreIdentity,
    resetIdentity,
    deleteMyData,
    revision,
    refresh,
  ]);

  // Keep the visibility trigger pointed at the latest composed round.
  autoConnectRoundRef.current = value?.autoConnectRound ?? null;

  // Live-wake (docs/plans/features/meerkat/live-wake.md): persistent listeners
  // on this device's inbound mailbox tokens while the tab is visible, so a
  // parked envelope arrives the moment the sender ships it instead of on the
  // next poll. The listener IS the drain (a connected session consumes what the
  // relay would otherwise park), so every frame goes through the SAME handler
  // set runForegroundDrain uses; the polling paths stay as idempotent backstops.
  liveWakeDepsRef.current = value?.liveWake ?? null;

  useEffect(() => {
    if (!boot) return undefined;
    const engine = new MailboxListenEngine({
      identity: boot.identity,
      backend: new WebSocketRelayBackend(),
      relayUrl: () => liveWakeDepsRef.current?.relayUrl() ?? null,
      peers: () => liveWakeDepsRef.current?.peers() ?? [],
      extraTokens: () => liveWakeDepsRef.current?.extraTokens() ?? [],
      handlers: () => liveWakeDepsRef.current?.handlers() ?? {},
      entitlementToken: () => liveWakeDepsRef.current?.entitlementToken(),
      onApplied: () => liveWakeDepsRef.current?.onApplied(),
    });
    liveWakeEngineRef.current = engine;
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') engine.start();
      else engine.stop();
    };
    if (document.visibilityState === 'visible') engine.start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      engine.stop();
      liveWakeEngineRef.current = null;
    };
  }, [boot]);

  // A pairing, revocation, join, or group change alters the inbound token set;
  // diff-connect only the delta on every data revision.
  useEffect(() => {
    liveWakeEngineRef.current?.refreshTokens();
  }, [boot, revision]);

  if (!value) {
    if (ownershipError) return <div className="mk-boot" role="alert">
      <h1>{ownershipError.reason === 'busy' ? 'Meerkat is open in another tab' : 'Browser storage unavailable'}</h1>
      <p>{ownershipError.message}</p>
      {ownershipError.reason === 'busy' && <button onClick={() => window.location.reload()}>Open here</button>}
    </div>;
    if (bootRecovery) {
      return <BootRecoveryScreen error={bootRecovery} db={databaseForRecovery} />;
    }
    if (bootError) {
      return (
        <div className="mk-boot" role="alert">
          {databaseForRecovery && <DatabaseSaveStatus db={databaseForRecovery} />}
          <p style={{ maxWidth: 420, textAlign: 'center', lineHeight: 1.5 }}>{bootError}</p>
        </div>
      );
    }
    return <div className="mk-boot">Booting Meerkat…</div>;
  }

  return (
    <MeerkatContext.Provider value={value}>
      {databaseForRecovery && <DatabaseSaveStatus db={databaseForRecovery} />}
      {secretPersistFailure ? (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--mk-danger, #b3413e)',
            color: '#fff',
            padding: '8px 16px',
            fontSize: 13,
            lineHeight: 1.4,
            textAlign: 'center',
          }}
        >
          {secretPersistFailure}
          <button onClick={() => { void boot?.secrets.retryPersistence().catch(() => undefined); }}>Retry saving keys</button>
        </div>
      ) : null}
      {children}
    </MeerkatContext.Provider>
  );
}

/**
 * Honest recovery screen for the secret-vault half-states (2026-08-30): an
 * unreadable vault (key-vs-vault mismatch, failed decrypt) or an identity row
 * whose signing key is gone. States plainly what is lost and what the options
 * are, instead of a messageless "Meerkat could not start." wall.
 */
function BootRecoveryScreen({ error, db }: { error: SecretVaultUnreadableError; db: BrowserDatabaseAdapter | null }): React.ReactElement {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const onStartFresh = (): void => {
    if (
      typeof window !== 'undefined'
      && !window.confirm(
        'Start fresh in this browser?\n\n'
        + 'This deletes all Meerkat data stored in this browser and creates a brand new identity on the next load. '
        + 'The old identity, and anything only it could open, are permanently lost. This cannot be undone.',
      )
    ) {
      return;
    }
    setBusy(true);
    setNotice(null);
    void (async () => {
      // Hold the writer fence through reset. No old image may repopulate it.
      if (db) await resetBrowserSyncCache({ retainOwnership: true });
      else await acquireDatabaseWriter();
      await closeMeerkatIdb();
      const outcome = await new Promise<'deleted' | 'blocked' | 'error'>((resolve) => {
        const request = globalThis.indexedDB.deleteDatabase(IDB_NAME);
        request.onsuccess = () => resolve('deleted');
        request.onerror = () => resolve('error');
        request.onblocked = () => resolve('blocked');
      });
      if (outcome === 'blocked') {
        setNotice('Another Meerkat tab is holding this browser\'s storage open. Close every other Meerkat tab, then try again.');
        setBusy(false);
        return;
      }
      if (outcome === 'error') {
        setNotice('The browser refused to delete Meerkat\'s local storage. Clear site data for this site from your browser settings instead.');
        setBusy(false);
        return;
      }
      window.location.reload();
    })().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : 'Could not prepare browser storage for reset.');
      setBusy(false);
    });
  };

  const explanation = error.reason === 'signing_key_missing'
    ? 'This browser still has a Meerkat identity record, but the private signing key that belongs to it is gone from the encrypted vault. Nothing can be signed, so messages, communities, and sync cannot work.'
    : 'The encrypted vault holding this browser\'s private keys can no longer be read. Nothing sealed or signed by this browser\'s identity can be opened or created here.';

  return (
    <div className="mk-boot" role="alert">
      <div style={{ maxWidth: 480, lineHeight: 1.5, display: 'grid', gap: 12 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>Meerkat cannot read its keys in this browser</h1>
        <p style={{ margin: 0 }}>{explanation}</p>
        <p style={{ margin: 0 }}>
          This usually happens when site data was partly cleared while Meerkat was open. What is lost:
          this browser&apos;s identity and anything only it could decrypt. What is not affected: other
          devices, and any purchase on your account.
        </p>
        <p style={{ margin: 0 }}>
          If you saved a recovery key and a backup, start fresh, finish setup, then open Settings and use
          Restore identity to bring your identity back. Without a backup, starting fresh creates a new
          identity and the old one is permanently lost.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="mk-btn"
            disabled={busy}
            onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }}
          >
            Reload and try again
          </button>
          <button type="button" className="mk-btn mk-btn-secondary" disabled={busy} onClick={onStartFresh}>
            {busy ? 'Deleting local data…' : 'Start fresh in this browser'}
          </button>
        </div>
        {notice ? <p style={{ margin: 0 }}>{notice}</p> : null}
      </div>
    </div>
  );
}

/**
 * Seed the engine's in-memory LWW document with every existing channel message
 * so the first outbound session carries existing rows (mirrors SyncProvider's
 * pad seeding). Seeds each distinct (community, channel) once.
 */
function seedExistingMessages(db: BrowserDatabaseAdapter, engine: NativeSyncEngine): void {
  const channels = db.query<{ community_id: string; channel_id: string }>(
    'SELECT DISTINCT community_id, channel_id FROM cm_messages',
  );
  for (const { community_id, channel_id } of channels) {
    for (const event of listChannelMessages(db, community_id, channel_id)) {
      engine.getDocumentManager().applyChange(COMMUNITY_MODULE_ID, {
        table: CM_MESSAGES_TABLE,
        rowId: event.id,
        operation: 'INSERT',
        data: { ...channelMessageRowFromEvent(event) },
      });
    }
  }
}

/**
 * Resolve a paired peer + its shared secret, applying the same revocation and
 * secret-store checks the channel-message path uses (mirror of SyncProvider's
 * resolvePairedSecret). Null when the peer is not a usable pairing, so
 * request/grant stay disabled with honest copy.
 */
function resolvePairedSecret(
  db: BrowserDatabaseAdapter,
  deviceId: string,
): { peer: PairedDevice; sharedSecretHex: string } | null {
  if (isDeviceRevoked(db, deviceId)) return null;
  const peer = getPairedDevice(db, deviceId);
  if (!peer || !peer.isActive || !peer.dhPublicKey || !peer.sharedSecretRef) return null;
  const sharedSecretHex = getSharedSecretHex(peer.sharedSecretRef);
  if (!sharedSecretHex) return null;
  return { peer, sharedSecretHex };
}

/**
 * Subscribe to the engine status store with a stable pre-boot fallback. The
 * subscribe/snapshot pair is memoized so useSyncExternalStore does not loop.
 */
function useEngineStatus(engine: NativeSyncEngine | null): SyncEngineStatus {
  const fallback = useRef<SyncEngineStatus | null>(null);
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (!engine) return () => undefined;
      return engine.getStatusStore().getSubscribe()(onChange);
    },
    [engine],
  );
  const getSnapshot = useCallback((): SyncEngineStatus => {
    if (engine) return engine.getStatusStore().getSnapshot()();
    if (!fallback.current) {
      fallback.current = {
        state: 'idle',
        pairedDeviceCount: 0,
        onlineDeviceCount: 0,
        pendingChanges: 0,
        lastSyncAt: null,
        currentSessionId: null,
      };
    }
    return fallback.current;
  }, [engine]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
