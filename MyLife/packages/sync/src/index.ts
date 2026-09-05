/**
 * @mylife/sync -- Data sync abstraction layer.
 *
 * Provides local-only, P2P (WebRTC), and cloud (PowerSync) sync
 * providers behind a unified SyncProvider interface. Includes the
 * full P2P sync engine, CRDT-based conflict resolution, blob storage,
 * transport layer, and content distribution (torrent) subsystem.
 */

// Core types
export type {
  SyncTier,
  SyncStatus,
  SyncEvent,
  SyncEventListener,
  SyncProvider,
  // P2P types
  DeviceIdentity,
  PairedDevice,
  ChangeRecord,
  PeerModuleState,
  DeviceRevocation,
  BlobRef,
  BlobSyncPolicy,
  BlobPolicyEntry,
  SyncSession,
  SyncTransport,
  SyncDirection,
  SyncSessionStatus,
  SyncMessageType,
  SyncMessage,
  // Torrent types
  ContentAccess,
  ContentCategory,
  ContentManifest,
  SeedingPolicy,
  TorrentDownloadStatus,
  TorrentPieceStatus,
  TorrentPaymentDirection,
  TorrentPaymentStatus,
  // Transport types
  TransportConnection,
  DiscoveredPeer,
  // Engine types
  SyncEngineState,
  SyncEngineStatus,
  // Direct share types
  ShareRequest,
  ShareOffer,
  ShareStatus,
  // Mesh sync types
  SyncWorkspace,
  SyncWorkspaceMember,
  SyncWorkspaceKeyWrap,
  HistoryScope,
  FeedPollIntervalMs,
  SyncEntityAcl,
  SyncTombstone,
  SyncReceipt,
  SyncInboundAudit,
  SyncPinnedIdentity,
  SyncSasVerification,
  InboundAuditOutcome,
  SyncConflictEntry,
  SyncTransportPreference,
  SyncSecuritySubjectType,
  SyncEncryptionMode,
  SyncSecurityPreference,
  SyncSecurityConfirmation,
  SyncExpiringEntity,
  SyncSessionModuleStats,
  SyncRelayToken,
  SyncScope,
  WorkspaceType,
  WorkspaceMemberRole,
} from './types';
export {
  STORAGE_LIMITS,
  SYNC_SCOPE_RANK,
  tierRequiresAuth,
  isCloudTier,
  isScopeWithinMaxScope,
  // Zod schemas
  DeviceIdentitySchema,
  PairedDeviceSchema,
  ChangeRecordSchema,
  PeerModuleStateSchema,
  DeviceRevocationSchema,
  BlobRefSchema,
  BlobPolicyEntrySchema,
  SyncSessionSchema,
  ContentManifestSchema,
  SeedingPolicySchema,
  // Direct share schemas
  ShareStatusSchema,
  ShareRequestSchema,
  ShareOfferSchema,
  SyncSecurityPreferenceSchema,
  SyncSecurityConfirmationSchema,
  SyncExpiringEntitySchema,
} from './types';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export { LocalOnlyProvider } from './providers/local-only';
export type { LocalOnlyProviderOptions } from './providers/local-only';

export { P2PProvider } from './providers/p2p';
export type {
  P2PProviderOptions,
  SignalingTransport,
  SignalingMessage,
} from './providers/p2p';

export { CloudProvider } from './providers/cloud';
export type {
  CloudProviderOptions,
  PowerSyncLike,
  SupabaseStorageClient,
} from './providers/cloud';

// ---------------------------------------------------------------------------
// Signaling / pairing (legacy, kept for backward compatibility)
// ---------------------------------------------------------------------------

export {
  generatePairingCode,
  isValidPairingCode,
  createPairingSession,
  isPairingSessionExpired,
  PAIRING_CODE_TTL_MS,
} from './signaling/pairing';
export type { PairingCode, PairingSession } from './signaling/pairing';

export { WebRTCManager } from './signaling/webrtc';
export type {
  SDPDescription,
  ICECandidate,
  RTCPeerConnectionLike,
  RTCDataChannelLike,
  ConnectionState,
  WebRTCManagerOptions,
} from './signaling/webrtc';

// ---------------------------------------------------------------------------
// Changesets (LWW fallback)
// ---------------------------------------------------------------------------

export { applyChangeset } from './changeset';
export type { RowChange, Changeset } from './changeset';

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export {
  generateDeviceIdentity,
  getDeviceId,
  extractDhPrivateKeyHex,
  extractSigningPrivateKeyHex,
  isLegacyRawDevicePrivateKeyRef,
  migrateDeviceIdentityPrivateKeyRef,
  signMessage,
  verifySignature,
  getPublicKeyFingerprint,
} from './identity/device-identity';

export {
  createPairingPayload,
  validatePairingCode,
  derivePairingSharedSecret,
  completePairing,
  createWorkspacePairing,
  validateWorkspacePairing,
} from './identity/pairing';
export type { PairingData, WorkspacePairingPayload } from './identity/pairing';

export {
  MEERKAT_HOSTED_AUTH_DOMAIN,
  MEERKAT_HOSTED_AUTH_MAX_TTL_MS,
  MEERKAT_REVENUECAT_APP_USER_ID_DOMAIN,
  hostedAuthMessage,
  createHostedAuthBearer,
  createRevenueCatAppUserId,
  revenueCatAppUserIdMessage,
  verifyRevenueCatAppUserId,
} from './protocol/hosted-auth';

// revokeFromWorkspace / rotateWorkspaceKey are the DEPRECATED v1 fake rotation
// (no real key minted; Plan 28 P5 NC-2): they THROW unless { legacyOk: true }.
// Real removal is removeCommunityMember / commitMemberRemoval.
export { createRevocation, isRevoked, revokeFromWorkspace, rotateWorkspaceKey } from './identity/revocation';
export type { LegacyRotationOptions } from './identity/revocation';

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

export {
  hexToBytes,
  bytesToHex,
  deriveKey,
  deriveKeyV2,
  generateNonce,
  generateSessionKey,
} from './encryption/keys';
export {
  configureSyncPrng,
  configureSyncPrngFromGlobalCrypto,
  generateSyncRandomBytes,
  generateSyncRandomInt,
  hasConfiguredSyncPrng,
} from './encryption/prng';
export type { SyncRandomBytes } from './encryption/prng';
export {
  configureSyncSecretStore,
  createDeviceIdentitySecretRef,
  createInMemorySyncSecretStore,
  createSharedSecretRef,
  deleteSyncSecret,
  getDeviceIdentitySecrets,
  getSharedSecretHex,
  hasConfiguredSyncSecretStore,
  isDeviceIdentitySecretRef,
  isSharedSecretRef,
  storeDeviceIdentitySecrets,
  storeSharedSecret,
} from './secrets/sync-secret-store';
export type {
  SyncDeviceSecretBundle,
  SyncSecretKind,
  SyncSecretStore,
} from './secrets/sync-secret-store';

export {
  encrypt,
  decrypt,
  encryptString,
  decryptString,
} from './encryption/encrypt';

export { NoiseHandshake } from './encryption/noise-handshake';

// ---------------------------------------------------------------------------
// CRDT
// ---------------------------------------------------------------------------

export { DocumentManager } from './crdt/document-manager';
export type { ModuleDocument, DocumentChange } from './crdt/document-manager';

export { ChangeTracker } from './crdt/change-tracker';
export type { ChangeTrackerOptions } from './crdt/change-tracker';

export { ConflictReporter } from './crdt/conflict-reporter';
export type { SyncConflict } from './crdt/conflict-reporter';

export {
  rowToCrdtData,
  crdtDataToSqlValues,
  buildInsertSql,
  buildUpdateSql,
  buildDeleteSql,
} from './crdt/schema-adapter';

// ---------------------------------------------------------------------------
// Blob Storage
// ---------------------------------------------------------------------------

export { BlobStore } from './blob/blob-store';
export type { BlobStoreOptions } from './blob/blob-store';

export {
  splitIntoBlocks,
  reassembleBlocks,
  verifyBlob,
  getMissingBlockIndices,
  BLOCK_SIZE,
} from './blob/blob-sync';
export type { BlobBlock } from './blob/blob-sync';

export {
  getDefaultPolicy,
  shouldSyncBlob,
  ensureBlobPolicy,
} from './blob/blob-policy';
export type { NetworkConditions } from './blob/blob-policy';

export {
  DEFAULT_UPLOAD_BLOCK_SIZE,
  buildUploadManifest,
  nextMissingBlock,
  missingBlocks,
  markBlockComplete,
  isUploadComplete,
  verifyUploadBlock,
} from './blob/upload-manifest';
export type {
  UploadBlock,
  UploadHashFn,
  UploadManifest,
  BuildUploadManifestOptions,
} from './blob/upload-manifest';

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

export { LANDiscovery, MDNS_SERVICE_TYPE, MDNS_SERVICE_PORT } from './transport/lan-discovery';
export type {
  LANDiscoveryOptions,
  LANDiscoveryEvents,
  DiscoveryBackend,
  ResolvedService,
} from './transport/lan-discovery';

export { LANTransport } from './transport/lan-transport';
export type { LANTransportOptions } from './transport/lan-transport';

export { TransportManager, buildTransportLayerDialOrder, forbiddenLayerIdsForPolicy, selectDialableTransportLayers, DATA_TRANSPORT_LAYER_IDS } from './transport/transport-manager';
export type { TransportManagerOptions, TransportDialOptions } from './transport/transport-manager';
export { RelayTransport, SimulatedRelayBackend, deriveRelayEphemeralToken } from './transport/relay-transport';

// Data-transport backend contract + availability model (Plan 20, Phase 11).
// Pure/type-only, so it is web-safe. Web stays RELAY-ONLY: the real
// WebRTC/Nearby/BLE data backend classes are exported from index.native.ts only
// (mobile). These exports are just the contract + factory injection types + the
// availability gate so shared typing and the selector work everywhere.
export { isRealBackend, TRANSPORT_UNAVAILABLE_MESSAGE } from './transport/data-transport-backend';
export type {
  RealTransportBackendMarker,
  WebRTCBackendFactory,
  NearbyBackendFactory,
  BleBackendFactory,
  DataTransportBackendFactories,
} from './transport/data-transport-backend';
export type { RelayBackend, RelayConnectOptions, RelaySession, RelayTransportOptions } from './transport/relay-transport';

// ---------------------------------------------------------------------------
// Protocol
// ---------------------------------------------------------------------------

export { encodeMessage, decodeMessage, createSimpleMessage, createJsonMessage, parseJsonPayload } from './protocol/message-codec';
export {
  createSecureJsonMessage,
  parseSecureJsonPayload,
  resolvePayloadEncryptionKey,
  createSessionPayloadSecurity,
  negotiateKdfVersion,
  SUPPORTED_KDF_VERSIONS,
} from './protocol/payload-security';
export type { SessionPayloadSecurity } from './protocol/payload-security';
export { initiatorHandshake, responderHandshake } from './protocol/handshake';
export {
  negotiateTransportPreference,
  rankMutualTransportPreferences,
  runInitiatorSession,
  runResponderSession,
} from './protocol/sync-session';
export type { GossipRoundResult } from './protocol/sync-session';
export { signBatch, verifyBatch } from './protocol/batch-signature';
export {
  deriveFrameEnvelopeKey,
  FRAME_ENVELOPE_VERSION,
  openFrame,
  resolveFrameEnvelopeKeyForPeer,
  sealFrame,
  wrapConnectionWithFrameEnvelope,
} from './protocol/frame-envelope';
export {
  createSignedIdentityBundle,
  verifySignedIdentityBundle,
  evaluateBundleTrust,
} from './protocol/identity-bundle';
export type {
  IdentityBundle,
  SignedIdentityBundle,
  TrustStatus,
  PinnedIdentity,
} from './protocol/identity-bundle';
export {
  MEERKAT_PAIRING_CODE_PREFIX,
  decodeMeerkatPairingCode,
  encodeMeerkatPairingCode,
  formatMeerkatPairingCode,
  isMeerkatPairingCode,
  normalizeMeerkatPairingInput,
} from './protocol/pairing-code';
export { deriveSas, sasFingerprint, sasMatches, SAS_EMOJI } from './protocol/sas';
export type { SasResult } from './protocol/sas';
export {
  createIntroduction,
  verifySignedIntroduction,
  applyIntroduction,
} from './protocol/introduction';
export type {
  IntroductionRecord,
  SignedIntroduction,
  ApplyIntroductionResult,
} from './protocol/introduction';
export {
  createSignedRevocation,
  verifySignedRevocation,
  applySignedRevocation,
  isAdminOrSelfRevoker,
} from './protocol/revocation-record';
export type {
  SignedRevocation,
  ApplyRevocationResult,
  ApplyRevocationOptions,
} from './protocol/revocation-record';
export {
  gossipRevocations,
  collectRevocationRecords,
  applyGossipedRevocations,
} from './protocol/revocation-gossip';
export type { RevocationGossipResult, GossipRole, GossipRevocationsOptions } from './protocol/revocation-gossip';
export {
  gossipDescriptors,
  collectDescriptorRecords,
  applyGossipedDescriptors,
} from './protocol/descriptor-gossip';
export type { DescriptorGossipResult, GossipDescriptorsOptions } from './protocol/descriptor-gossip';
export {
  SYNC_WORKSPACE_KEYS_TABLE,
  createGroupCommit,
  commitMemberAdd,
  commitMemberRemoval,
  deriveEpochContentKey,
  getCurrentEpochKey,
  getWorkspaceEpoch,
  keyWrapFromSyncedRow,
  keyWrapSyncRowId,
  keyWrapToSyncedRow,
  storeReceivedKeyWrap,
  unwrapEpochSecret,
} from './protocol/group-keys';
export type {
  GroupMemberKey,
  GroupCommitInput,
  GroupCommitResult,
  MembershipCommitInput,
  RecordKeyWrapChange,
} from './protocol/group-keys';
export {
  destroyEntityKey,
  entityRequiresContentKey,
  getEntityKey,
  getOrCreateEntityKey,
  openEntityPayload,
  sealEntityPayload,
} from './protocol/entity-keys';
export type { EntityKeyRef, SealedEntityPayload } from './protocol/entity-keys';
export {
  BLOB_TRANSFER_BLOCK_SIZE,
  assembleStagedBlob,
  blobContentHash,
  clearStagedBlob,
  collectBlobRefs,
  getStagedBlockIndices,
  isBlobHash,
  sealedBlockBytesToPayload,
  sealedBlockPayloadToBytes,
  splitBlobForTransfer,
  stageBlobBlock,
} from './protocol/blob-transfer';
export type {
  SessionBlobProvider,
  BlobRequestPayload,
  BlobDataPayload,
  BlobAckPayload,
} from './protocol/blob-transfer';
export { splitSnapshotForWindow } from './protocol/sync-window';
export type { WindowSplit } from './protocol/sync-window';
export {
  buildChannelHistory,
  channelHistorySnapshotId,
  fetchChannelHistory,
  mergeChannelHistoryEvents,
  parseChannelHistory,
  verifyChannelHistorySnapshot,
} from './protocol/channel-history';
export type {
  BuildChannelHistoryInput,
  BuildChannelHistoryResult,
  ChannelHistoryScope,
  FetchChannelHistoryInput,
  FetchChannelHistoryResult,
  ParseChannelHistoryInput,
  ParseChannelHistoryResult,
  SignedChannelHistorySnapshot,
} from './protocol/channel-history';
export {
  DEFAULT_MAX_SNAPSHOT_BYTES,
  DEFAULT_MAX_SNAPSHOT_PIECES,
  buildCommunitySnapshots,
  hlcAfter,
  importSnapshotFromPieces,
  parseSnapshotManifest,
  runCommunitySnapshotJob,
} from './protocol/community-snapshots';
export type {
  BuildCommunitySnapshotsInput,
  BuildCommunitySnapshotsResult,
  CommunitySnapshotJobInput,
  CommunitySnapshotJobResult,
  CommunitySnapshotRecord,
  ImportSnapshotFromPiecesInput,
  ImportSnapshotResult,
  OversizedSnapshot,
  SnapshotChannelInput,
  SnapshotPieceStore,
} from './protocol/community-snapshots';
export {
  buildPublicSnapshot,
  derivePublicSnapshotSealKey,
  importPublicSnapshot,
} from './protocol/public-snapshot';
export type {
  BuildPublicSnapshotInput,
  ImportPublicSnapshotInput,
  ImportPublicSnapshotResult,
  PublicSnapshotRecord,
} from './protocol/public-snapshot';
export {
  createFeedChallenge,
  feedAuthCanonical,
  signFeedAuth,
  verifyFeedAuth,
  sealedTailCanonical,
  signSealedTailEntry,
  verifySealedTailEntry,
} from './protocol/feed-auth';
export type {
  CreateFeedChallengeOptions,
  FeedAuthFields,
  FeedAuthVerdict,
  FeedChallenge,
  SealedTailEntry,
  SealedTailEntryFields,
  SealedTailVerdict,
  VerifyFeedAuthInput,
} from './protocol/feed-auth';
export {
  audienceRulesEqual,
  cloneAudienceRule,
  createAudienceRule,
  createCommunityAudienceRule,
  createReplyAudienceRule,
  validateReplyAudience,
} from './protocol/audience-rule';
export type {
  AudienceActorSet,
  AudienceRule,
  AudienceRuleInput,
  AudienceType,
  ReplyAudienceRejectReason,
  ReplyAudienceValidation,
} from './protocol/audience-rule';
export {
  CHANNEL_MESSAGE_TABLE,
  channelMessageEventFromRow,
  channelMessageId,
  compareChannelMessages,
  createChannelMessage,
  createChannelMessageV2,
  isSingleEmojiGrapheme,
  isPackReactionToken,
  packReactionToken,
  parsePackReactionToken,
  nextHlc,
  resolveChannelMessages,
  verifyChannelMessage,
} from './protocol/channel-message';
export type {
  ChannelMessageAttachment,
  ChannelMessageEvent,
  ChannelMessageInput,
  ChannelMessageIntent,
  Hlc,
  MessageAuthorKind,
} from './protocol/channel-message';
export {
  compareDmMessages,
  createDmMessage,
  dmConversationId,
  dmMessageId,
  resolveDmMessages,
  verifyDmMessage,
} from './protocol/dm-message';
export type {
  DmMessageAttachment,
  DmMessageEvent,
  DmMessageInput,
  DmMessageIntent,
} from './protocol/dm-message';
export {
  COMMUNITY_AVATAR_MAX_BYTES,
  PROFILE_BIO_MAX_CHARS,
  PROFILE_NAME_COLOR_TOKENS,
  PROFILE_PRONOUNS_MAX_CHARS,
  compareCommunityProfileEvents,
  communityProfileId,
  createCommunityProfileEvent,
  isValidCommunityAvatarImage,
  normalizeProfileDisplayName,
  verifyCommunityProfileEvent,
} from './protocol/community-profile';
export type {
  CommunityProfileEvent,
  CommunityProfileInput,
  ProfileNameColorToken,
} from './protocol/community-profile';
export {
  ceremonyAdvertisementPayload,
  ceremonyPairingResult,
  ceremonyReducer,
  ceremonySas,
  ceremonySasAgrees,
  ceremonyTranscriptHash,
  deriveCeremonyKey,
  helloFrameFor,
  isValidHelloFrame,
  newCeremonyEphemeral,
  openBundleFrame,
  sealBundleFrame,
  signCeremonyAccept,
  startCeremony,
  verifyCeremonyAccept,
  CEREMONY_ID_BYTES,
  CEREMONY_NONCE_BYTES,
  CEREMONY_SERVICE_TYPE,
  CEREMONY_WINDOW_MS,
} from './protocol/proximity-ceremony';
export type {
  AcceptVerdict,
  CeremonyAcceptFrame,
  CeremonyBundleFrame,
  CeremonyEphemeral,
  CeremonyEvent,
  CeremonyFailure,
  CeremonyFrame,
  CeremonyHelloFrame,
  CeremonyPhase,
  CeremonyState,
} from './protocol/proximity-ceremony';
export {
  acceptPersonGroupRevision,
  checkPersonAttestationLedger,
  personAttestationFor,
  isOrderableTimestamp,
  personGroupSecretCommitment,
  signPersonCanonicalBytes,
  verifyAnnounceDraftAgainstDoc,
  verifyPersonSignatureBytes,
  verifyUnsignedPersonGroupRevision,
  PERSON_MAX_FUTURE_SKEW_MS,
  assemblePersonGroupAnnounce,
  assemblePersonGroupDoc,
  buildPersonGroupAnnounce,
  buildPersonGroupRevision,
  canonicalPersonAnnounceBytes,
  canonicalPersonGroupBytes,
  communityDerivationContext,
  comparePersonGroupDocs,
  createPresentationProfile,
  derivePersonContextId,
  dmPeerDerivationContext,
  DM_PEER_CONTEXT_PREFIX,
  generatePersonGroupId,
  generatePersonGroupSecret,
  isValidPresentationProfile,
  mergePresentationProfiles,
  PERSON_DERIVED_ID_HEX_CHARS,
  PERSON_DEVICE_LABEL_MAX_CHARS,
  PERSON_GROUP_MAX_DEVICES,
  PERSON_GROUP_SECRET_BYTES,
  personGroupDocHash,
  presentationNameForCommunity,
  presentationProfileHash,
  signPersonGroupAnnounce,
  signPersonGroupRevision,
  verifyPersonGroupAnnounce,
  verifyPersonGroupDoc,
} from './protocol/person-group';
export type {
  AnnounceDraftVerdict,
  AttestationVerdict,
  PersonAttestation,
  UnsignedRevisionVerdict,
  AcceptPersonGroupResult,
  BuildPersonGroupRevisionInput,
  BuildPersonGroupRevisionResult,
  PersonGroupAnnounce,
  PersonGroupDevice,
  PersonGroupDoc,
  PresentationOverride,
  PresentationPersona,
  PresentationPersonaInput,
  PresentationProfile,
  PresentationProfileInput,
  UnsignedPersonGroupAnnounce,
  UnsignedPersonGroupDoc,
} from './protocol/person-group';
export {
  PERSON_ANNOUNCE_TABLE,
  PERSON_GROUP_TABLE,
  PERSON_LINKS_TABLE,
  PERSON_SELF_ROW_ID,
  PRESENTATION_PROFILE_TABLE,
  personAnnounceFromRow,
  personAnnounceRowFromAnnounce,
  personGroupDocFromRow,
  personGroupRowFromDoc,
  presentationProfileFromRow,
  presentationProfileRowFromProfile,
  validatePersonAnnounceRow,
  validatePersonGroupRow,
  validatePresentationProfileRow,
} from './protocol/person-group-rows';
export type {
  PersonAnnounceRow,
  PersonGroupRow,
  PresentationProfileRow,
} from './protocol/person-group-rows';
export {
  PERSON_GROUP_ACCEPT_MAILBOX_KIND,
  PERSON_GROUP_ANNOUNCE_MAILBOX_KIND,
  PERSON_GROUP_PROPOSE_MAILBOX_KIND,
  isUnsignedAnnounceDraft,
  parsePersonGroupAcceptPayload,
  parsePersonGroupAnnouncePayload,
  parsePersonGroupProposePayload,
  personGroupProposalHash,
  verifyPersonGroupAccept,
  verifyPersonGroupAnnouncePayload,
  verifyPersonGroupProposePayload,
} from './protocol/person-group-mailbox';
export type {
  PersonGroupAcceptPayload,
  PersonGroupAnnouncePayload,
  PersonGroupProposePayload,
} from './protocol/person-group-mailbox';
export {
  CHANNEL_MESSAGE_MAILBOX_KIND,
  openChannelMessageMailboxDelta,
  sealChannelMessageMailboxDelta,
} from './protocol/channel-mailbox';
export type {
  ChannelMessageMailboxBuildRejectReason,
  ChannelMessageMailboxPayload,
  ChannelMessageMailboxRejectReason,
  OpenChannelMessageMailboxResult,
  SealChannelMessageMailboxInput,
  SealChannelMessageMailboxResult,
} from './protocol/channel-mailbox';
export {
  DM_MESSAGE_MAILBOX_KIND,
  decryptDmGroupEvents,
  openDmGroup,
  openDmMailbox,
  parseDmGroupMailboxPayload,
  sealDmDirect,
  sealDmGroup,
} from './protocol/dm-mailbox';
export type {
  DmDirectMailboxPayload,
  DmDirectRecipient,
  DmGroupMailboxPayload,
  DmGroupSealedEvents,
  DmMailboxBuildRejectReason,
  DmMailboxRejectReason,
  OpenDmGroupResult,
  OpenDmMailboxResult,
  SealDmDirectInput,
  SealDmDirectResult,
  SealDmGroupInput,
  SealDmGroupResult,
  SealedDmDirectEnvelope,
} from './protocol/dm-mailbox';
export {
  createDmGroup,
  createDmGroupDescriptor,
  dmGroupAdd,
  dmGroupRemove,
  verifyDmGroupDescriptor,
} from './protocol/dm-group';
export type {
  CreateDmGroupDescriptorInput,
  CreateDmGroupInput,
  CreateDmGroupResult,
  DmGroupAddInput,
  DmGroupMember,
  DmGroupMutationResult,
  DmGroupRemoveInput,
  SignedDmGroupDescriptor,
} from './protocol/dm-group';
export {
  DM_GROUP_COMMIT_KIND,
  deriveDmGroupCommitToken,
  openDmGroupCommit,
  sealDmGroupCommit,
} from './protocol/dm-group-handoff-mailbox';
export type {
  DmGroupCommitPayload,
  DmGroupCommitRecipient,
  DmGroupCommitRejectReason,
  OpenDmGroupCommitResult,
  SealDmGroupCommitInput,
  SealedDmGroupCommit,
} from './protocol/dm-group-handoff-mailbox';
export { applyDmGroupCommit } from './protocol/dm-group-handoff-core';
export type { ApplyDmGroupCommitDeps } from './protocol/dm-group-handoff-core';
export {
  DM_RECEIPT_MAILBOX_KIND,
  createDmReceipt,
  openDmReceiptMailbox,
  sealDmReceipt,
  verifyDmReceipt,
} from './protocol/dm-receipt';
export type {
  DmReceiptEvent,
  DmReceiptInput,
  DmReceiptMailboxPayload,
  DmReceiptMailboxRejectReason,
  DmReceiptState,
  OpenDmReceiptMailboxResult,
  SealDmReceiptInput,
  SealDmReceiptResult,
} from './protocol/dm-receipt';
export {
  DM_SHRED_MAILBOX_KIND,
  createDmShred,
  openDmShredMailbox,
  sealDmShred,
  verifyDmShred,
} from './protocol/dm-shred';
export type {
  DmShredEvent,
  DmShredInput,
  DmShredMailboxPayload,
  DmShredMailboxRejectReason,
  OpenDmShredMailboxResult,
  SealDmShredInput,
  SealDmShredResult,
} from './protocol/dm-shred';
export {
  KNOWN_CHANNEL_KINDS,
  channelArchived,
  channelKind,
  communityCategories,
  communityDescriptorHash,
  communityLayout,
  communityRole,
  createCommunity,
  createCommunityInvite,
  evaluateChannelPost,
  forkCommunity,
  getCommunity,
  joinCommunityFromLink,
  leaveCommunity,
  communityTransportPolicy,
  listCommunities,
  orderedChannels,
  parseCommunityInviteLink,
  reconcileCommunityRosterFromDescriptor,
  removeMemberRevision,
  reviseCommunity,
  revisePolicy,
  transportAllowedForCommunity,
  transportPolicyAllows,
  upsertCommunity,
  verifyCommunityDescriptor,
  verifyCommunityInvite,
  verifyDescriptorOwnerSignature,
} from './protocol/community';
export type { CommunityTransportPolicy } from './protocol/community';
export {
  COMMUNITY_BANNER_MANIFEST_MAX_CHARS,
  COMMUNITY_BANNER_MAX_BYTES,
  COMMUNITY_DESCRIPTION_MAX_CHARS,
  COMMUNITY_IDENTITY_TABLE,
  COMMUNITY_THEME_BLOB_MAX_CHARS,
  communityIdentityEventFromRow,
  communityIdentityEventId,
  communityIdentityEventToRow,
  createCommunityIdentityEvent,
  isValidCommunityIdentityBanner,
  isValidCommunityThemeBlob,
  resolveCommunityIdentity,
  verifyCommunityIdentityEvent,
} from './protocol/community-identity';
export { isSignedRowTable, validateSignedInboundRow } from './protocol/inbound-row-validators';
export type { InboundRowChange, InboundRowVerdict } from './protocol/inbound-row-validators';
export {
  COMMUNITY_LAYOUT_BLOB_MAX_CHARS,
  COMMUNITY_LAYOUT_BLOB_NAMESPACE,
  COMMUNITY_LAYOUT_TABLE,
  communityLayoutEventFromRow,
  communityLayoutEventId,
  communityLayoutEventToRow,
  createCommunityLayoutEvent,
  isValidCommunityLayoutBlob,
  resolveCommunityLayout,
  verifyCommunityLayoutEvent,
} from './protocol/community-layout';
export type {
  CommunityLayoutEvent,
  CommunityLayoutInput,
} from './protocol/community-layout';
export {
  CANVAS_KINDS,
  CANVAS_LAYERS,
  CANVAS_MARK_KINDS,
  CANVAS_MARK_NOTE_MAX_CHARS,
  CANVAS_MARK_OPTION_MAX,
  CANVAS_POLICY_MAX_CHARS,
  CANVAS_PROPS_MAX_CHARS,
  CANVAS_STROKE_MAX_CHARS,
  COMMUNITY_CANVAS_MARKS_TABLE,
  COMMUNITY_CANVAS_NODES_TABLE,
  COMMUNITY_CANVAS_STROKES_TABLE,
  COMMUNITY_CANVAS_TABLE,
  SYNC_CANVAS_EVENT_RATE_PER_HOUR,
  SYNC_CANVAS_NODE_CAPS,
  SYNC_CANVAS_PAGES_PER_MEMBER_CAP,
  SYNC_CANVAS_STROKE_CAP,
  canvasEventFromRow,
  canvasEventToRow,
  canvasMarkEventFromRow,
  canvasMarkEventId,
  canvasMarkEventToRow,
  canvasNodeEventFromRow,
  canvasNodeEventToRow,
  canvasStrokeEventFromRow,
  canvasStrokeEventId,
  canvasStrokeEventToRow,
  createCanvasEvent,
  createCanvasMarkEvent,
  COMMUNITY_CANVAS_PIXELS_TABLE,
  SYNC_PIXEL_GRID_DEFAULT,
  SYNC_PIXEL_GRID_MAX,
  SYNC_PIXEL_MIN_INTERVAL_SECONDS,
  SYNC_PIXEL_MAX_STORED_PER_MEMBER,
  SYNC_PIXEL_MAX_FUTURE_SKEW_MS,
  SYNC_PIXEL_PALETTE,
  canvasPixelEventFromRow,
  canvasPixelEventId,
  canvasPixelEventToRow,
  createCanvasPixelEvent,
  pixelBoardConfig,
  resolveCanvasPixels,
  validateCanvasPixelRow,
  verifyCanvasPixelEvent,
  createCanvasNodeEvent,
  createCanvasStrokeEvent,
  isValidCanvasNodeAsset,
  mergeCanvasNodeEvents,
  resolveCanvasStrokes,
  verifyCanvasEvent,
  verifyCanvasMarkEvent,
  verifyCanvasNodeEvent,
  verifyCanvasStrokeEvent,
} from './protocol/community-canvas';
export {
  BADGE_NAME_MAX_CHARS,
  BADGE_SUPPLY_MAX,
  BADGE_SUPPLY_MIN,
  COMMUNITY_BADGES_TABLE,
  SYNC_RESERVED_SPOOF_GLYPHS,
  badgeEventFromRow,
  badgeEventId,
  badgeEventToRow,
  badgeGlyphAllowed,
  createBadgeAwardEvent,
  createBadgeMintEvent,
  resolveCommunityBadges,
  verifyBadgeEvent,
} from './protocol/community-badges';
export type {
  CommunityBadgeEvent,
  CommunityBadgeEventKind,
  ResolvedBadge,
} from './protocol/community-badges';
export {
  ASSET_PACK_KINDS,
  ASSET_PACK_NAME_MAX_CHARS,
  COMMUNITY_ASSET_PACKS_TABLE,
  SYNC_ASSET_PACK_EMOJI_MAX_BYTES,
  SYNC_ASSET_PACK_ITEM_CAP,
  SYNC_ASSET_PACK_MANIFEST_MAX_BYTES,
  SYNC_ASSET_PACK_MAX_STORED_ITEMS_PER_PACK,
  SYNC_ASSET_PACK_STICKER_MAX_BYTES,
  assetPackByteCap,
  assetPackEventFromRow,
  assetPackEventId,
  assetPackEventToRow,
  assetPackOwnerPrefix,
  createAssetPackEvent,
  createAssetPackItemEvent,
  deriveAssetPackId,
  packIdBoundToOwner,
  resolveCommunityAssetPacks,
  validateAssetPackRow,
  verifyAssetPackEvent,
} from './protocol/community-asset-packs';
export type {
  AssetPackKind,
  CommunityAssetPackEvent,
  CommunityAssetPackEventKind,
  ResolvedAssetPack,
  ResolvedAssetPackItem,
} from './protocol/community-asset-packs';
export type {
  CanvasNodeAsset,
  CommunityCanvasEvent,
  CommunityCanvasKind,
  CommunityCanvasLayer,
  CommunityCanvasMarkEvent,
  CommunityCanvasPixelEvent,
  CommunityCanvasMarkKind,
  CommunityCanvasNodeEvent,
  CommunityCanvasStrokeEvent,
  CreateCanvasInput,
  CreateCanvasMarkInput,
  CreateCanvasNodeInput,
  CreateCanvasStrokeInput,
} from './protocol/community-canvas';

export type {
  CommunityIdentityBanner,
  CommunityIdentityEvent,
  CommunityIdentityInput,
} from './protocol/community-identity';
export {
  deriveEpochLibraryWrapKey,
  openLibraryObject,
  sealLibraryObject,
  unwrapLibraryObjectKey,
  unwrapLibraryObjectKeyForDevice,
  wrapLibraryObjectKey,
} from './protocol/library-objects';
export type {
  SealLibraryObjectOptions,
  SealedLibraryObject,
} from './protocol/library-objects';
export {
  MEMBER_REMOVAL_MAILBOX_KIND,
  deriveCommunityRemovalToken,
  openMemberRemovalMailbox,
  sealMemberRemovalFanOut,
  verifyMemberRemovalBundle,
} from './protocol/member-removal-mailbox';
export type {
  MemberRemovalPayload,
  MemberRemovalRecipient,
  MemberRemovalRejectReason,
  OpenMemberRemovalResult,
  SealMemberRemovalInput,
  SealedMemberRemoval,
} from './protocol/member-removal-mailbox';
export { applyMemberRemoval, removeCommunityMember } from './protocol/member-removal-core';
export type {
  ApplyMemberRemovalDeps,
  RemoveCommunityMemberDeps,
  RemoveCommunityMemberResult,
} from './protocol/member-removal-core';
export type {
  ChannelPostVerdict,
  CommunityChannel,
  CommunityChannelCategory,
  CommunityChannelKind,
  CommunityLayout,
  CommunityDescriptor,
  CommunityInvite,
  CommunityMember,
  CommunityRevisionChanges,
  CreateCommunityOptions,
  InviteVerdict,
  JoinCommunityResult,
  ParsedInviteLink,
  SignedCommunityDescriptor,
  SignedCommunityInvite,
  StoredCommunity,
} from './protocol/community';
export {
  createPublication,
  createPublicJoinGrant,
  effectivePostPolicy,
  publicationDescriptorHash,
  revisePublication,
  unpublish,
  verifyPublication,
  verifyPublicationOwnerSignature,
  verifyOwnerTakedown,
  verifyPublicJoinGrant,
} from './protocol/publication';
export {
  redeemPublicJoinGrant,
  queuePublicJoinRequest,
  openPublicJoinRequest,
  derivePublicJoinToken,
  PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
} from './protocol/public-join';
export type {
  RedeemPublicJoinResult,
  PublicJoinRequestPayload,
  QueuePublicJoinResult,
  OpenPublicJoinRequestResult,
} from './protocol/public-join';
export {
  HUMANITY_TOKEN_DOMAIN,
  HUMANITY_TOKEN_TTL_MS,
  HUMANITY_BATCH_SIZE,
  canonicalHumanityTokenBytes,
  humanityServiceKeypairFromSeed,
  signHumanityToken,
  issueHumanityTokenBatch,
  verifyHumanityToken,
  serializeHumanityToken,
  parseHumanityToken,
} from './protocol/humanity-credential';
export type {
  HumanityToken,
  UnsignedHumanityToken,
  HumanityTokenVerdict,
  IssueHumanityBatchOptions,
} from './protocol/humanity-credential';
export {
  BLIND_CREDENTIAL_DOMAIN,
  CREDENTIAL_EPOCH_GENESIS_MS,
  CREDENTIAL_EPOCH_LENGTH_MS,
  CREDENTIAL_EPOCH_GRACE_MS,
  CREDENTIAL_RENEWAL_WINDOW_MS,
  CREDENTIAL_MODULUS_BYTES,
  credentialBytesToBase64,
  credentialBase64ToBytes,
  credentialEpochAt,
  credentialEpochWindow,
  isWithinRenewalWindow,
  credentialSerial,
  parseRsaPublicKeySpki,
  prepareBlindCredentialRequest,
  finalizeBlindCredential,
  verifyBlindCredential,
  serializeMeerkatCredential,
  parseMeerkatCredential,
} from './protocol/blind-credential';
export type {
  MeerkatCredential,
  BlindCredentialRequestState,
  BlindCredentialVerdict,
  PreparedBlindCredentialRequest,
  RsaPublicKeyComponents,
} from './protocol/blind-credential';
export { checkHumanityGate } from './protocol/humanity-gate';
export type {
  HumanityGatePolicy,
  HumanityGateReason,
  HumanityGateResult,
  HumanityRedeemClient,
  HumanityRedeemOutcome,
} from './protocol/humanity-gate';
export {
  PERSONA_CLAIM_DOMAIN,
  PERSONA_SECRET_NAMESPACE,
  PERSONA_ALIAS_MIN,
  PERSONA_ALIAS_MAX,
  canonicalizeAlias,
  isCanonicalAlias,
  canonicalPersonaClaimBytes,
  generatePublicPersona,
  extractPersonaPrivateKeyHex,
  createPersonaClaim,
  verifyPersonaClaim,
  PERSONA_SESSION_CHALLENGE_DOMAIN,
  PERSONA_GDPR_DELETE_DOMAIN,
  PERSONA_GDPR_EXPORT_DOMAIN,
  personaSessionChallengeBytes,
  personaRequestBytes,
} from './protocol/public-persona';
export type {
  PublicPersona,
  PersonaClaim,
  UnsignedPersonaClaim,
  PersonaClaimVerdict,
  CreatePersonaClaimInput,
} from './protocol/public-persona';
export {
  PUBLIC_POST_DOMAIN,
  PUBLIC_POST_RECEIPT_DOMAIN,
  PUBLIC_POST_TOMBSTONE_DOMAIN,
  PUBLIC_POSTING_FREEZE_DOMAIN,
  CURRENT_PUBLIC_TERMS_VERSION,
  PUBLIC_POST_TRUST_COPY,
  MAX_PUBLIC_POST_BODY_CHARS,
  MAX_PUBLIC_POST_ATTACHMENTS,
  createPublicPost,
  createPublicPostTombstone,
  createPublicPostingFreeze,
  publicPostEventHash,
  publicPostNodeKeypairFromSeed,
  signPublicPostAcceptance,
  verifyPublicPost,
  verifyPublicPostAuthor,
  verifyPublicPostTombstone,
  verifyPublicPostingFreeze,
} from './protocol/public-post';
export type {
  AcceptedPublicPost,
  CreatePublicPostInput,
  PublicPostEvent,
  PublicPostReceipt,
  PublicPostTombstone,
  PublicPostVerdict,
  PublicPostingFreeze,
  SignPublicPostAcceptanceInput,
} from './protocol/public-post';
export type {
  CreatePublicationOptions,
  PublicJoinGrant,
  PublicationDescriptor,
  PublicationJoinPolicy,
  PublicationKind,
  PublicationPostPolicy,
  PublicationRevisionChanges,
  PublicationStatus,
  PublicationVerdict,
  PublicCategory,
  SignedPublicationDescriptor,
} from './protocol/publication';
export {
  createArchiveJob,
  deriveArchiveIndexKey,
  deriveArchiveObjectManifestRoot,
  verifyArchiveJob,
} from './protocol/public-archive';
export { ManagedArchiveClient, ManagedArchiveHttpError } from './node/managed-archive-client';
export type {
  ManagedArchiveClientOptions,
  ManagedArchiveStatus,
  ManagedArchiveStatusRecord,
} from './node/managed-archive-client';
export type {
  ArchiveJob,
  ArchiveJobVerdict,
  ArchiveLicense,
  ArchiveObjectManifestEntry,
  ArchiveTier,
  CreateArchiveJobOptions,
  PublicationRights,
  RightsAssertion,
  SignedArchiveJob,
} from './protocol/public-archive';
export {
  createAbuseReport,
  createDescriptorKill,
  createPublicAbuseReport,
  createPublicAbuseReportWithKey,
  createPublicReportFetchSignature,
  evaluatePublishBoundary,
  isDescriptorKilled,
  isPriorityPublicReport,
  openAbuseReport,
  verifyDescriptorKill,
  verifyPublicAbuseReport,
  verifyPublicReportFetchSignature,
} from './protocol/abuse-rails';
export type {
  AbuseReport,
  CreatePublicAbuseReportInput,
  DescriptorKill,
  PublicAbuseReport,
  PublicReportReason,
  PublicReportTargetKind,
  PublishBoundaryVerdict,
  SignedDescriptorKill,
  SignedPublicAbuseReport,
} from './protocol/abuse-rails';
export {
  computeHostCredits,
  createHostAttestation,
  hostPerk,
  hostRatioStats,
  verifyHostAttestation,
} from './protocol/host-credits';
export type {
  CreditOptions,
  HostAttestation,
  HostAttestationKind,
  HostCreditSummary,
  HostPerk,
  HostRatioStat,
  SignedHostAttestation,
} from './protocol/host-credits';
export {
  decodeMailboxEnvelope,
  deriveMailboxDrainTokens,
  deriveMailboxToken,
  mailboxSealNowMs,
  resolveMailboxSealClock,
  encodeMailboxEnvelope,
  openMailboxDelta,
  sealMailboxDelta,
} from './protocol/mailbox';
export type { MailboxEnvelope, OpenMailboxResult } from './protocol/mailbox';
export { msUntilNextDayBucket, relayTokenDayBucket } from './protocol/day-bucket';
export {
  deriveSessionRendezvousToken,
  sessionTokenCandidates,
  utcDayBucket,
} from './protocol/session-token';
export {
  CREATE_PRESENCE_BEACONS_TABLE,
  PRESENCE_BEACONS_TABLE,
  PRESENCE_BEACON_MAILBOX_KIND,
  PRESENCE_BEACON_SYNC_RULE,
  PRESENCE_CLOCK_SKEW_MS,
  PRESENCE_MAX_TTL_SECONDS,
  ensurePresenceBeaconTable,
  openPresenceBeaconMailbox,
  presenceCounts,
  prunePresenceBeacons,
  recordPresenceBeacon,
  sealPresenceBeacon,
  signPresenceBeacon,
  verifyPresenceBeacon,
} from './protocol/presence-beacon';
export type {
  OpenPresenceBeaconMailboxResult,
  PresenceBeacon,
  PresenceBeaconInput,
  PresenceBeaconMailboxPayload,
  PresenceBeaconMailboxRejectReason,
  PresenceCountResult,
  PresenceMember,
  PresenceVerdict,
  SealPresenceBeaconInput,
  SealPresenceBeaconResult,
} from './protocol/presence-beacon';
export {
  FEED_POLL_INTERVALS,
  FEED_POLL_PRODUCTION_FLOOR_MS,
  buildCommunityNotifyPing,
  deriveCommunityNotifyToken,
  drainCommunityNotifyPings,
  feedPollIntervalLabel,
  normalizeFeedPollInterval,
  readCommunityNotifyPing,
  shouldEmitMessageNotification,
} from './protocol/community-notify';
export type {
  CommunityNotifyPing,
  DrainCommunityNotifyInput,
  DrainCommunityNotifyResult,
  FeedPollIntervalOption,
  NormalizeFeedPollIntervalOptions,
} from './protocol/community-notify';
export {
  HISTORY_HOST_SNAPSHOT_VERSION,
  deriveCommunityHistoryRegistryId,
  isHistoryHostRecordFresh,
  isHistoryHostUrlTls,
  openCommunityHistoryHost,
  sealCommunityHistoryHost,
  verifyHistoryHostDescriptor,
} from './protocol/community-history-host';
export type { HistoryHostRecord } from './protocol/community-history-host';
export {
  applyDrainedChannelEvents,
  runMailboxDrainJob,
  toMailboxDrainPeers,
} from './protocol/mailbox-drain';
export type {
  ApplyChannelEvents,
  ApplyChannelEventsResult,
  MailboxDrainJobResult,
  MailboxDrainPeer,
  MailboxDrainPeerResult,
  RunMailboxDrainJobOptions,
} from './protocol/mailbox-drain';
export { applyMailboxEnvelope } from './protocol/mailbox-dispatch';
export type {
  MailboxDispatchOutcome,
  MailboxEnvelopeHandlers,
} from './protocol/mailbox-dispatch';
export { MailboxListenEngine } from './protocol/mailbox-listen';
export type {
  MailboxListenCounts,
  MailboxListenEngineOptions,
  MailboxListenStatus,
  MailboxListenToken,
} from './protocol/mailbox-listen';
export {
  FILE_GRANT_MAILBOX_KIND,
  FILE_REQUEST_MAILBOX_KIND,
  applyFileGrant,
  assembleGrantBlocks,
  buildFileDecline,
  buildFileGrant,
  fileRequestId,
  openFileGrantMailbox,
  openFileRequestMailbox,
  restoreFromGrantPayload,
  sealFileGrantMailbox,
  sealFileRequestMailbox,
} from './protocol/file-request-mailbox';
export type {
  ApplyFileGrantInput,
  ApplyFileGrantResult,
  BuildFileGrantInput,
  FileGrantDeclineReason,
  FileGrantMailboxPayload,
  FileRequestFields,
  FileRequestMailboxPayload,
  FileRequestMailboxRejectReason,
  OpenFileGrantResult,
  OpenFileRequestResult,
  RestoreFromGrantPayloadInput,
  SealFileGrantInput,
  SealFileGrantResult,
  SealFileRequestInput,
  SealFileRequestResult,
} from './protocol/file-request-mailbox';
export {
  HISTORY_GRANT_MAILBOX_KIND,
  HISTORY_GRANT_MAX_EVENTS,
  HISTORY_REQUEST_MAILBOX_KIND,
  historyRequestId,
  isAfterCursor,
  isServableEvent,
  openHistoryGrantMailbox,
  openHistoryRequestMailbox,
  sealHistoryGrantMailbox,
  sealHistoryRequestMailbox,
} from './protocol/history-backfill-mailbox';
export type {
  HistoryGrantMailboxPayload,
  HistoryMailboxRejectReason,
  HistoryRequestFields,
  HistoryRequestMailboxPayload,
  OpenHistoryGrantResult,
  OpenHistoryRequestResult,
  SealHistoryGrantInput,
  SealHistoryGrantResult,
  SealHistoryRequestInput,
  SealHistoryRequestResult,
} from './protocol/history-backfill-mailbox';
export {
  JOIN_GRANT_MAILBOX_KIND,
  JOIN_REQUEST_MAILBOX_KIND,
  deriveCommunityJoinToken,
  openJoinGrantMailbox,
  openJoinRequestMailbox,
  sealJoinGrantMailbox,
  sealJoinRequestMailbox,
  verifyJoinBundle,
  verifyJoinInviteAgainstOwnerDescriptor,
} from './protocol/join-handoff-mailbox';
export type {
  JoinGrantPayload,
  JoinMailboxRejectReason,
  JoinRequestPayload,
  OpenJoinGrantResult,
  OpenJoinRequestResult,
  SealJoinGrantInput,
  SealJoinGrantResult,
  SealJoinRequestInput,
  SealJoinRequestResult,
} from './protocol/join-handoff-mailbox';
export {
  applyJoinGrant,
  buildJoinRequest,
  processJoinRequest,
} from './protocol/join-handoff-core';
export type {
  ApplyJoinGrantDeps,
  BuildJoinRequestResult,
  ProcessJoinRequestDeps,
} from './protocol/join-handoff-core';
export {
  runLocalJoinAsJoiner,
  runLocalJoinAsOwner,
} from './protocol/local-join-handoff';
export type {
  LocalJoinJoinerReason,
  LocalJoinJoinerResult,
  LocalJoinOwnerReason,
  LocalJoinOwnerResult,
  RunLocalJoinAsJoinerOptions,
  RunLocalJoinAsOwnerOptions,
} from './protocol/local-join-handoff';
export { approvePublicJoinRequest } from './protocol/public-join-handoff-core';
export type {
  ApprovePublicJoinRequestDeps,
  ApprovePublicJoinResult,
} from './protocol/public-join-handoff-core';
export { ReplayGuard } from './protocol/replay-guard';
export type { ReplayVerdict, ReplayRejectReason, ReplayGuardOptions } from './protocol/replay-guard';
export { evaluateInboundChange } from './protocol/inbound-policy';
export type {
  InboundDecision,
  InboundRejectReason,
  InboundSessionAuth,
  InboundChangeFacts,
} from './protocol/inbound-policy';
export { LwwDocumentManager } from './crdt/lww-document-manager';
export {
  createSecurityOffer,
  negotiateSecurityAgreement,
} from './protocol/security-negotiation';
export type {
  SyncSecurityAgreement,
  SyncSecurityOffer,
} from './protocol/security-negotiation';
export {
  DEFAULT_DISAPPEARING_MESSAGE_TABLES,
  createExpiringEntityFromChange,
  isDisappearingMessageTable,
  pruneExpiredEntities,
  recordExpiringEntitiesForChanges,
} from './expiry/disappearing-messages';
export { runShareSession, handleIncomingShare } from './protocol/share-session';
export type { ShareSessionOptions, ShareSessionResult } from './protocol/share-session';
export { PushRelayClient, PushGatewayClient } from './protocol/push-relay-client';
export type {
  PushRegistrationBinding,
  PushProviderKind,
  PushWakeScope,
  PushWakePriority,
  PushGatewayClientOptions,
  RegisterInput as PushRegisterInput,
  RotateTokenInput as PushRotateTokenInput,
  MintCapabilityInput as PushMintCapabilityInput,
  SendWakeInput as PushSendWakeInput,
  PushClientResult,
  PushClientError,
  WakeAcceptance as PushWakeAcceptance,
  PublicWakeStatus as PushPublicWakeStatus,
  WakeStatusResult as PushWakeStatusResult,
  PushRelayOptions,
  PushNotification,
} from './protocol/push-relay-client';

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export { SyncEngine } from './engine/sync-engine';
export { SyncScheduler } from './engine/sync-scheduler';
export { SyncStatusStore } from './engine/sync-status';

// ---------------------------------------------------------------------------
// Database bootstrap
// ---------------------------------------------------------------------------

export { ensureSyncBootstrap, repairPairedDeviceSharedSecrets } from './db/bootstrap';
export type { SyncBootstrapOptions, SyncBootstrapResult } from './db/bootstrap';

// ---------------------------------------------------------------------------
// Torrent / Content Distribution
// ---------------------------------------------------------------------------

export { createManifest, verifyManifest, parseManifest, computeMerkleRoot } from './torrent/manifest';
export { publishContent, generateMagnetUri } from './torrent/publisher';
export type { PublishOptions, PublishResult } from './torrent/publisher';

export { TorrentDownloader } from './torrent/downloader';
export type { DownloadOptions, DownloadState, DownloadProgress } from './torrent/downloader';

export { SeedingEngine } from './torrent/seeder';
export type { SeedEntry } from './torrent/seeder';

export { PieceManager } from './torrent/piece-manager';

export { SwarmManager } from './torrent/swarm-manager';
export type { SwarmPeer } from './torrent/swarm-manager';

export { WebSeedClient } from './torrent/web-seed';
export type { WebSeedOptions, WebSeedDownload } from './torrent/web-seed';
export {
  applyPlacement,
  buildCommunityCatalog,
  catalogAvailability,
  catalogPieceBytes,
  fetchCatalogFromWebSeed,
  planReplicaPlacement,
  verifyCatalogPiece,
} from './torrent/community-catalog';
export type {
  BuildCommunityCatalogOptions,
  CatalogAvailability,
  CatalogHostState,
  ColdStartResult,
  CommunityCatalog,
  PlacementPlan,
} from './torrent/community-catalog';

export {
  parseDeepLink,
  parseMagnetUri,
  generateShareLink,
  generateDeepLink,
  generateMagnetUri as generateTorrentMagnetUri,
  isTorrentLink,
} from './torrent/deep-link';
export type { ParsedDeepLink } from './torrent/deep-link';

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export { SYNC_TABLES, TORRENT_TABLES, ALL_P2P_TABLES, CREATE_SYNC_SHARE_LOG, createSyncTables, migrateSyncSchema } from './db/schema';
export { SYNC_MIGRATION } from './db/migration';
export * from './db/queries';

// ---------------------------------------------------------------------------
// React Hooks
// ---------------------------------------------------------------------------

export {
  useSyncProvider,
  useSyncStatus,
  useSetSyncTier,
  setSyncProvider,
  getSyncProvider,
  setTierChangeHandler,
  // New P2P hooks
  usePairedDevices,
  useSyncHistory,
  useModuleSyncSettings,
  useTorrentStatus,
} from './hooks';
export type { SetSyncTierFn } from './hooks';

// ---------------------------------------------------------------------------
// DB Integration
// ---------------------------------------------------------------------------

export { SyncManager, createSyncManager } from './db-integration';
export type { SyncManagerOptions } from './db-integration';

// ---------------------------------------------------------------------------
// Meerkat Node Layer (RN-safe content addressing + sealed shares + seeding)
// ---------------------------------------------------------------------------

export * from './node';

// WebSocket relay backend (real transport client for @mylife/meerkat-relay)
export { WebSocketRelayBackend } from './transport/websocket-relay-backend';
export {
  selectRelay,
  rankRelays,
  probeRelays,
  defaultRelayProbe,
  relayHealthUrl,
} from './transport/relay-selector';
export type { RelayHealth, RelayProbe, SelectRelayOptions } from './transport/relay-selector';

// Health-gated default-relay resolution (Plan 20). Exported from both barrels so
// the web client and the native harness share one tested decision core.
export {
  resolveDefaultRelay,
  resolveDefaultRelaySync,
  effectiveRelayUrl,
} from './transport/default-relay';
export type { DefaultRelayInput, ResolvedRelay } from './transport/default-relay';

// Connection card codec (Plan 20, Phase 3). Pure; shared by both clients (adopt)
// and the desktop host companion (card generation).
export { parseConnectionCard, encodeConnectionCard } from './transport/connection-card';
export type { ConnectionCard } from './transport/connection-card';

// OS share-intake model (Plan 20, Phase 8). Pure; device-local staging glue is
// app-side.
export {
  normalizeSharedItem,
  normalizeSharedItems,
  sniffMime,
  isShareUrl,
  DEFAULT_SHARE_MAX_BYTES,
} from './share/share-intake';
export type {
  RawSharedItem,
  NormalizedPayload,
  NormalizeResult,
  ShareIntakeLimits,
  ShareSource,
  ShareIntakeStatus,
  ShareDestination,
  SharePayloadKind,
} from './share/share-intake';
export {
  ensureShareIntakeTables,
  stageShareIntake,
  listShareIntakes,
  getSharePayloads,
  setShareIntakeStatus,
  routeShareIntake,
  discardShareIntake,
  sweepExpiredShareIntakes,
  CREATE_MK_SHARE_INTAKE,
  CREATE_MK_SHARE_PAYLOAD,
} from './share/share-intake-store';
export type {
  StagePayloadInput,
  StageShareIntakeInput,
  ShareIntakeRow,
  SharePayloadRow,
} from './share/share-intake-store';

export type { WebSocketRelayBackendOptions } from './transport/websocket-relay-backend';
export { publishRendezvous, resolveRendezvous } from './transport/rendezvous-client';
export type {
  RendezvousClientOptions,
  PublishRendezvousInput,
  ResolveRendezvousInput,
} from './transport/rendezvous-client';
export { announceHost, lookupHosts } from './transport/registry-client';
export type {
  RegistryClientOptions,
  AnnounceHostInput,
  LookupHostsInput,
} from './transport/registry-client';
export { connectRelayPeer } from './transport/relay-peer-connection';
export type { ConnectRelayPeerOptions } from './transport/relay-peer-connection';
export { encodeFrame, FrameDecoder, MAX_FRAME_BYTES } from './transport/frame-codec';
export {
  connectLanPeer,
  startLanListener,
  lanSocketToConnection,
} from './transport/lan-peer-connection';
export type {
  LanSocket,
  LanListener,
  LanSocketBackend,
  ConnectLanPeerOptions,
  StartLanListenerOptions,
} from './transport/lan-peer-connection';
export { SyncEngine as NativeSyncEngine } from './engine/sync-engine.native';
export type {
  SyncEngineOptions as NativeSyncEngineOptions,
  NativeDataTransportDialOptions,
  NativeWebRTCOffer,
  NativeWebRTCSignaling,
} from './engine/sync-engine.native';
export { runSyncSessionJob } from './engine/session-job';
export type {
  RunSyncSessionJobOptions,
  SyncSessionEngine,
  SyncSessionJobResult,
  SyncSessionJobRole,
} from './engine/session-job';
export {
  DEFAULT_AUTO_CONNECT_POLICY,
  LAN_LAYER_ID,
  NEARBY_LAYER_ID,
  RELAY_LAYER_ID,
  WEBRTC_LAYER_ID,
  nextBackoffMs,
  planAutoConnectRound,
  runAutoConnectJob,
} from './engine/auto-connect';
export type {
  AutoConnectDial,
  AutoConnectDialOutcome,
  AutoConnectPeerInput,
  AutoConnectPolicy,
  AutoConnectRole,
  AutoConnectRoundPlan,
  AutoConnectRoundResult,
  AutoConnectSkip,
  AutoConnectSkipReason,
  AutoConnectTransport,
  PlanAutoConnectRoundInput,
  RunAutoConnectJobDeps,
} from './engine/auto-connect';

// User-controlled encrypted storage destinations (Plan 41).
export * from './storage/types';
export * from './storage/schema';
export * from './storage/job-reducer';
export * from './storage/backup-format';
export * from './storage/conformance';
export * from './storage/fakes';
export * from './storage/router';
export * from './storage/broker-client';
export * from './storage/restore-controller';
export * from './storage/diagnostics';
export * from './storage/connected-descriptor';
export * from './storage/remote-backups';
export * from './storage/retention';
export * from './storage/storage-scheduler';
export * from './storage/repair';
export * from './storage/lifecycle';
export * from './storage/credential-config';
export * from './storage/adapters/http';
export { ProviderStorageAdapterError } from './storage/adapters/provider-common';
export * from './storage/adapters/webdav';
export * from './storage/adapters/s3';
export * from './storage/adapters/google-drive';
export * from './storage/adapters/dropbox';
export * from './storage/adapters/onedrive';
export * from './storage/adapters/box';
export * from './storage/adapters/connected-server';

// Plan 25 WP-25C: community room admission (voice/video rooms). Pure protocol;
// the relay-side room-token service consumes these to mint LiveKit tokens.
export {
  ROOM_ADMISSION_DOMAIN,
  ROOM_ADMISSION_FUTURE_SKEW_MS,
  ROOM_ADMISSION_MAX_TTL_MS,
  ROOM_ADMISSION_REQUEST_FIELDS,
  canonicalRoomAdmissionRequestBytes,
  createRoomAdmissionRequest,
  generateEphemeralParticipantId,
  isPermissionSubset,
  permissionsAllowedForRole,
  verifyRoomAdmissionRequest,
} from './protocol/room-membership';
export type {
  CreateRoomAdmissionRequestInput,
  CreateRoomAdmissionRequestResult,
  RoomAdmissionCreateRejectReason,
  RoomAdmissionRejectReason,
  RoomAdmissionRequest,
  RoomPermission,
  UnsignedRoomAdmissionRequest,
  VerifyRoomAdmissionRequestOptions,
  VerifyRoomAdmissionRequestResult,
} from './protocol/room-membership';

// Plan 25 WP-25B: direct-call signaling (1:1 voice/video). Pure protocol; SDP
// and ICE ride recipient-encrypted payloads over the existing relay mailbox,
// addressed by a pair-secret-derived token an observer cannot compute.
export {
  CALL_INVITE_CHANNEL_ID,
  CALL_SIGNAL_DOMAIN,
  createCallSignal,
  decryptCallPayload,
  deriveCallInviteToken,
  deriveCallSignalToken,
  encryptCallPayload,
  openCallSignalFrame,
  resolveCallGlare,
  sealCallSignalFrame,
  verifyCallSignal,
  createWebRTCSyncSignal,
  decryptWebRTCSyncPayload,
  deriveWebRTCSyncInviteListenTokens,
  deriveWebRTCSyncInviteToken,
  deriveWebRTCSyncSessionToken,
  encryptWebRTCSyncPayload,
  openWebRTCSyncSignalFrame,
  sealWebRTCSyncSignalFrame,
  verifyWebRTCSyncSignal,
  WEBRTC_SYNC_SIGNAL_DOMAIN,
} from './protocol/call-signal';
export type {
  CallSignal,
  CallSignalKind,
  CallSignalRejectReason,
  CreateCallSignalInput,
  CreateCallSignalRejectReason,
  CreateCallSignalResult,
  VerifyCallSignalOptions,
  VerifyCallSignalResult,
  CreateWebRTCSyncSignalInput,
  CreateWebRTCSyncSignalResult,
  VerifyWebRTCSyncSignalResult,
  WebRTCSyncSignal,
  WebRTCSyncSignalKind,
} from './protocol/call-signal';

// Plan 25 WP-25G: near-real-time call-signal transport over the existing relay
// (opaque carrier; sealed frames on pair-private tokens; park-when-offline).
export {
  CallSignalTransport,
  createCallSignalTransport,
} from './transport/call-signal-channel';
export type {
  CallSignalListenerHandle,
  CallSignalListenerStatus,
  CallSignalTransportDeps,
} from './transport/call-signal-channel';

export { selectedWebRtcTransport } from './protocol/webrtc-stats';

// Plan 25 WP-25D: pure 1:1 call media-session state machine. Drives the WP-25B
// signals and an injected WebRTC media backend; 'connected' is set only by a
// real backend connection event (NC-25.1), and every inbound signal passes
// verifyCallSignal before it can ring or advance (NC-25.2).
export {
  CallSession,
  createCallSession,
  DEFAULT_CALL_SESSION_LIMITS,
} from './protocol/call-session';
export type {
  CallEndReason,
  CallIceCandidate,
  CallIceState,
  CallMediaBackend,
  CallMediaConnectionEvent,
  CallMediaConnectionState,
  CallMediaPeerSession,
  CallPhase,
  CallSessionDeps,
  CallSessionDescription,
  CallSessionLimits,
  CallState,
  OutboundCallSignal,
  StartCallPeerConnectionInput,
} from './protocol/call-session';

export {
  AGE_GATE_SETTING_KEY,
  MEERKAT_DEFAULT_MINIMUM_AGE,
  clampMinimumAge,
  decodeAgeGateRecord,
  encodeAgeGateRecord,
  evaluateAgeGateBirthDate,
  exactAgeAt,
  storeAgeSignalSatisfiesGate,
  type AgeGateBirthDate,
  type AgeGateEvaluation,
  type AgeGateRecord,
  type StoreAgeSignal,
} from './protocol/age-gate';

export { createHostedRelayAccess, isHostedRelayTarget, withHostedRelayAccess } from './node/hosted-relay-access';
export type { HostedRelayAccess, HostedRelayAccessOptions } from './node/hosted-relay-access';

export type { PublishRendezvousReceipt } from './transport/rendezvous-client';
