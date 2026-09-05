/**
 * @mylife/sync/node -- the Meerkat node layer.
 *
 * Real, React-Native-safe primitives for the standalone Meerkat app: HKDF
 * key derivation, friend codes, content addressing, end-to-end sealed shares,
 * and the local seeding store. All built on the package's existing tweetnacl
 * identity and authenticated-encryption primitives, so they run unchanged on
 * Hermes. The transport layer that moves sealed blocks between devices is
 * tracked separately (mesh sync plan 14, M0).
 */

export { hmacSha512, hkdfExtract, hkdfExpand, hkdf, sha512Hex } from './hkdf';

export {
  generateFriendCode,
  encodeFriendCode,
  parseFriendCode,
  isValidFriendCode,
  CUSTOM_FRIEND_CODE_MIN_LENGTH,
  normalizeFriendCodeInput,
  isValidCustomFriendCode,
  makeVanityFriendCode,
  rendezvousIdFromCustomCode,
  friendCodeToRendezvousId,
  isExtendedFriendCode,
  buildExtendedFriendCode,
  generateRendezvousSecretHalf,
  parseExtendedFriendCode,
} from './friend-code';
export type { FriendCodePrng, ExtendedFriendCodeParts } from './friend-code';

export {
  publishIdentityToRendezvous,
  resolveIdentityFromRendezvous,
  deriveRendezvousSealKey,
} from './friend-rendezvous';
export type {
  PublishIdentityInput,
  ResolveIdentityInput,
  ResolveIdentityResult,
} from './friend-rendezvous';

export {
  generateRecoveryKey,
  encodeRecoveryKey,
  parseRecoveryKey,
  exportRecoverableIdentity,
  sealRecovery,
  openRecovery,
  isRecoverableIdentityConsistent,
  restoreIdentityFromRecovery,
  openAndRestore,
} from './recovery-key';
export type { RecoverableIdentity } from './recovery-key';

export {
  DEFAULT_CHUNK_SIZE,
  chunkContent,
  merkleRoot,
  computeContentId,
  reassemble,
} from './content';
export type { ContentChunk } from './content';

export {
  createSealedShare,
  openSealedShare,
} from './sealed-share';
export type {
  NodeManifest,
  NodeShareScope,
  SealedChunk,
  SealedShare,
  CreateSealedShareOptions,
  OpenResult,
} from './sealed-share';

export {
  buildShareLink,
  buildMagnetLink,
  parseShareLink,
} from './share-link';
export type { ShareLinkParts } from './share-link';

export { MeerkatDirectClient } from './direct-client';
export type {
  MeerkatDirectClientOptions,
  SentShare,
  ReceivedShare,
} from './direct-client';

export {
  InMemoryNodeStore,
  pinShare,
  loadSealedShare,
  fetchFromStore,
  unpinShare,
  DEFAULT_PIN_CONTEXT,
  DEFAULT_PIN_CLASS,
} from './store';
export type {
  NodeStore,
  SealedBlock,
  PinnedManifest,
  NodeStoreStats,
  PinClass,
} from './store';

export {
  CREATE_MK_PINNED,
  CREATE_MK_PINNED_BLOCKS,
  ensureMeerkatPinnedTables,
  migrateMeerkatPinnedContext,
} from './pinned-store-schema';

export {
  fetchAndPinFromHosts,
  fetchFromHosts,
  httpNodeSource,
  handleNodeStoreHttp,
} from './remote-store';
export type {
  RemoteNodeSource,
  RemoteFetchResult,
  RemotePinnedFetchResult,
  NodeStoreHttpResponse,
} from './remote-store';

export {
  deriveContentRegistryId,
  deriveContentRegistryKey,
  announceHeldContent,
  lookupContentHosts,
} from './host-registry';
export type {
  AnnounceHeldContentInput,
  LookupContentHostsInput,
} from './host-registry';

export {
  deriveCategoryRid,
  deriveSearchRid,
  announcePublication,
  browsePublications,
  searchPublications,
  lookupPublicationHosts,
} from './public-directory';
export type {
  DirectoryEntry,
  AnnouncePublicationInput,
  BrowsePublicationsInput,
  SearchPublicationsInput,
  LookupPublicationHostsInput,
} from './public-directory';

export {
  pullCommunityFeed,
  republishCommunityDescriptor,
  publishCommunityFeed,
  appendCommunityTail,
} from './feed-node-client';
export type {
  EpochKeyHandle,
  FeedManifestPayload,
  FeedManifestSnapshotEntry,
  PullCommunityFeedChannelResult,
  PullCommunityFeedInput,
  PullCommunityFeedResult,
  RepublishCommunityDescriptorInput,
  RepublishCommunityDescriptorResult,
  PublishCommunityFeedInput,
  PublishCommunityFeedResult,
  AppendCommunityTailInput,
  AppendCommunityTailResult,
} from './feed-node-client';

export {
  parkJoinEnvelopeOnNode,
  fetchJoinBoxFromNode,
  ackJoinBoxOnNode,
  drainJoinBoxFromNode,
} from './join-queue-client';
export type {
  AckJoinBoxResult,
  DrainJoinBoxResult,
  FetchJoinBoxResult,
  FetchedJoinEntry,
  JoinQueueClientDeps,
  ParkJoinOnNodeResult,
} from './join-queue-client';

export { fetchPublicSnapshot, fetchPublicPage, publicSnapshotKeyFromHex } from './public-snapshot-client';
export type {
  FetchPublicSnapshotInput,
  FetchPublicSnapshotResult,
  PublicSnapshotChannelResult,
  FetchPublicPageInput,
  FetchPublicPageResult,
} from './public-snapshot-client';

export { runAutomaticHistorySync } from './community-history-sync';
export type {
  CachedHostReader,
  CachedHostWriter,
  HistoryBatchCommitter,
  HistoryHostPuller,
  HistoryHostResolver,
  HistoryPullChannel,
  HistoryPullResult,
  RunAutomaticHistorySyncInput,
  RunAutomaticHistorySyncResult,
} from './community-history-sync';
