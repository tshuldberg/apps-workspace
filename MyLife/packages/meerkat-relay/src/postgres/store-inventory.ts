export const MEERKAT_POSTGRES_SCHEMAS = [
  'community',
  'directory',
  'humanity',
  'persona',
  'hosted',
  'moderation',
  'push',
  'archive',
  'ops',
  'rooms',
  'account',
  'credential',
] as const;

export type MeerkatPostgresSchema = (typeof MEERKAT_POSTGRES_SCHEMAS)[number];

export type StoreMigrationState = 'existing_contract' | 'plan_contract';

export interface MutableStoreInventoryEntry {
  id: string;
  schema: MeerkatPostgresSchema;
  source: string;
  contract: string;
  state: StoreMigrationState;
  securitySensitiveMutations: readonly string[];
  invariants: readonly string[];
}

/**
 * Complete inventory for first-party mutable state at the Plan 44 Phase 0 boundary.
 * Existing contracts retain their public interfaces. Plan contracts reserve the
 * durable boundaries required by Plans 41 through 43 before their adapters land.
 */
export const MUTABLE_STORE_INVENTORY: readonly MutableStoreInventoryEntry[] = [
  {
    id: 'community.descriptor-revisions',
    schema: 'community',
    source: 'src/community-node.ts',
    contract: 'CommunityDescriptorStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['recordRevision'],
    invariants: ['revision never decreases', 'equal revision keeps an authoritative descriptor hash'],
  },
  {
    id: 'community.publications',
    schema: 'community',
    source: 'src/community-node.ts',
    contract: 'PublicationStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['put'],
    invariants: ['one latest record per publication', 'signed descriptor and snapshot metadata remain atomic'],
  },
  {
    id: 'community.kills',
    schema: 'community',
    source: 'src/community-node.ts',
    contract: 'KillStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['recordKill'],
    invariants: ['a verified kill survives restart', 'a kill cannot be removed by a publication write'],
  },
  {
    id: 'community.reports',
    schema: 'community',
    source: 'src/community-node.ts',
    contract: 'ReportStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['put'],
    invariants: ['report lists stay bounded', 'signed report payloads are replaced atomically'],
  },
  {
    id: 'community.public-posts',
    schema: 'community',
    source: 'src/community-node.ts',
    contract: 'PublicPostStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['withPublicationWriteLock', 'blockPersona', 'putPosts', 'putTombstones', 'putFreeze', 'putSubmits'],
    invariants: ['one publication writer wins at a time', 'tombstones and freezes survive restart', 'flood windows are durable'],
  },
  {
    id: 'community.private-state',
    schema: 'community',
    source: 'src/community-private-state.ts',
    contract: 'CommunityPrivateStateStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'issueChallenge', 'authorizeRequest', 'appendTail', 'beginPublish',
      'commitPublish', 'completeExpiredPublishStage', 'sweepExpired',
    ],
    invariants: [
      'descriptor revision never decreases and publish is idempotent per digest',
      'one publish stage owns a community at a time and expires atomically',
      'challenge nonces are single use and bounded per community',
      'tail entries verify against their descriptor and replay keys are unique',
    ],
  },
  {
    id: 'directory.publications',
    schema: 'directory',
    source: 'src/public-directory-node.ts',
    contract: 'PublicationDirectoryStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['put', 'delete'],
    invariants: ['one current signed record per publication', 'expiry and search buckets change atomically'],
  },
  {
    id: 'directory.kills',
    schema: 'directory',
    source: 'src/public-directory-node.ts (FileKillStore)',
    contract: 'KillStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['recordKill'],
    invariants: [
      'a verified directory takedown survives restart',
      'cutover imports the directory FileKillStore independently of the community-node kill ledger',
      'signed kill payloads are append only',
    ],
  },
  {
    id: 'directory.host-freshness',
    schema: 'directory',
    source: 'src/public-directory-node.ts',
    contract: 'DirectoryHostAnnouncementStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['announceHost', 'pruneExpiredHosts'],
    invariants: ['one live slot exists per registry id and announcer hash', 'database time controls host expiry', 'raw IP addresses are never stored'],
  },
  {
    id: 'humanity.verification',
    schema: 'humanity',
    source: 'src/humanity-service.ts',
    contract: 'HumanityStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'trySpend', 'redeemRegistrationAttempt', 'incrementIssuanceCount', 'markSpent', 'prune',
    ],
    invariants: [
      'one token hash can be spent once',
      'registration redemption results replay only for the identical attempt and request digest',
      'issuance increments are atomic',
      'database time controls expiry',
    ],
  },
  {
    id: 'persona.registry',
    schema: 'persona',
    source: 'src/persona-registry.ts',
    contract: 'PersonaRegistryStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'beginRegistrationAttempt', 'markRegistrationHumanityVerified',
      'commitRegistrationAttempt', 'cancelRegistrationAttempt',
      'tryRegister', 'release', 'revoke', 'unrevoke',
    ],
    invariants: [
      'alias and persona public key are independently unique',
      'provisional registration attempts are not resolvable records',
      'humanity-verified attempts commit idempotently after a crash',
      'release tombstones preserve cooldown',
    ],
  },
  {
    id: 'hosted.billing',
    schema: 'hosted',
    source: 'src/hosted-api.ts',
    contract: 'MeerkatHostedBillingStore + MeerkatAppBillingStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['applySubscriptionEvent', 'applyAppPurchaseEvent', 'redeemLink', 'bindAppUnlockPersona', 'releaseAppUnlockPersona'],
    invariants: ['provider events are idempotent and monotonic', 'one link redemption wins', 'one purchase binds to one persona'],
  },
  {
    id: 'hosted.storage-metadata',
    schema: 'hosted',
    source: 'src/hosted-storage-metadata.ts',
    contract: 'HostedStorageMetadataStore + HostedStorageObjectStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'reserve', 'stage', 'activate', 'release', 'fail', 'expireDue',
      'putManifest', 'deleteManifest', 'recordApiUploadBlock', 'completeApiObject',
      'deleteApiObject', 'putBackupLocator', 'deleteApiTenant',
    ],
    invariants: [
      'quota reservations are atomic and fenced',
      'PostgreSQL stores metadata and references but never object bytes',
      'activation requires an exact checksum, size, and object version observation',
      'release of active bytes requires an exact deletion receipt',
      'retries do not double charge quota',
      'hosted storage API rows are isolated by subject id and ordered by stable cursors',
      'tenant deletion uses one owner-scoped capability and returns pre-delete row counts',
    ],
  },
  {
    id: 'hosted.oauth-broker',
    schema: 'hosted',
    source: 'src/oauth-broker.ts',
    contract: 'OAuthBrokerStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'putPendingConnect', 'consumePendingConnect', 'putVault', 'replaceVault', 'takeVault',
      'takeVaultsForSubject', 'recordSession', 'appendAudit',
    ],
    invariants: [
      'pending state is single use even when callback validation fails',
      'refresh-token plaintext never enters PostgreSQL',
      'browser sessions bind one destination and explicit operation set with a ten-minute maximum',
      'audit rows contain no provider token values',
    ],
  },
  {
    id: 'moderation.console',
    schema: 'moderation',
    source: 'src/operator-console.ts',
    contract: 'OperatorConsoleStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['appendAudit', 'putTriage', 'deleteTriage'],
    invariants: ['audit rows are append only', 'audit sequence is monotonic', 'triage state does not rewrite audit history'],
  },
  {
    id: 'moderation.ncmec',
    schema: 'moderation',
    source: 'src/ncmec-queue.ts',
    contract: 'NcmecReportQueueStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['enqueue', 'setStatus'],
    invariants: ['evidence id makes enqueue idempotent', 'status changes preserve the original evidence record'],
  },
  {
    id: 'moderation.dmca',
    schema: 'moderation',
    source: 'src/dmca-intake.ts',
    contract: 'DmcaIntakeStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['put'],
    invariants: ['claim id is stable', 'claim lifecycle never discards unresolved items'],
  },
  {
    id: 'hosted.seeder-pieces',
    schema: 'hosted',
    source: 'src/seeder-node.ts',
    contract: 'SeederPieceStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['put', 'removeContent'],
    invariants: ['piece bytes match the content manifest hash', 'managed bytes move behind object storage before HA use'],
  },
  {
    id: 'hosted.seeder-manifests',
    schema: 'hosted',
    source: 'src/seeder-node.ts (MeerkatSeederNode.manifests)',
    contract: 'HostedStorageMetadataStore manifest methods',
    state: 'existing_contract',
    securitySensitiveMutations: ['recordManifest', 'unpin', 'pruneExpired'],
    invariants: [
      'a stored piece is not serveable without its verified manifest',
      'manifest and pin policy survive restart',
      'database time controls managed expiry',
    ],
  },
  {
    id: 'push.delivery',
    schema: 'push',
    source: 'src/push-store.ts',
    contract: 'PushRegistrationStore + PushAttemptStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'register', 'rotateToken', 'revokeRegistration', 'mintCapability',
      'revokeCapability', 'invalidateProviderToken', 'enqueue', 'claim',
      'renew', 'complete', 'cancelByCapability', 'prune',
    ],
    invariants: [
      'provider tokens are encrypted at rest behind a KMS seam',
      'capability tokens do not reveal stable identity',
      'token generations overlap without two active generations',
      'one worker owns an attempt lease and stale workers cannot complete it',
      'idempotency keys are bound to canonical request digests and expire independently',
      'provider acceptance is never represented as device delivery',
      'attempt rows contain no wake payload or application identity',
    ],
  },
  {
    id: 'archive.lifecycle',
    schema: 'archive',
    source: 'src/archive-lifecycle.ts',
    contract: 'ArchiveJobStore + ArchiveObjectStore + ArchiveScanStore + ArchivePinStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'enqueue', 'recordQuarantineObject', 'markQuarantined', 'claimJobs',
      'completeScan', 'markObjectDurable', 'activatePin', 'requestTakedown',
      'markObjectDeleted', 'confirmRemoval',
    ],
    invariants: [
      'quarantine is never publicly served',
      'one worker owns a lease and stale workers cannot commit',
      'takedown disables serving before deletion',
      'object deletion requires verified absence and preserves shared references',
    ],
  },
  {
    id: 'ops.release-recovery',
    schema: 'ops',
    source: 'Plan 44',
    contract: 'OperationsStore',
    state: 'plan_contract',
    securitySensitiveMutations: ['claimJob', 'recordRestoreProof', 'recordReleaseManifest'],
    invariants: ['migration checksums are immutable', 'job claims are lease bounded', 'backup health requires restore proof'],
  },
  {
    id: 'ops.object-accounting',
    schema: 'ops',
    source: 'src/object-reference-ledger.ts + src/object-deletion-jobs.ts + src/object-reconciler.ts',
    contract: 'ObjectReferenceLedger + ObjectDeletionJobStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'addReference', 'removeReference', 'enqueueDeletion', 'claimDeletion',
      'completeDeletion', 'rescheduleDeletion', 'poisonDeletion', 'recordReconcileCursor',
    ],
    invariants: [
      'a reference edge is idempotent per (objectKey, referrer) and a key is removable only at zero references',
      'a key is deletion-eligible only after it has dropped to zero references',
      'deletion jobs run under a fenced lease so two workers never double-run one key',
      'a deletion that exhausts its retry budget becomes a durable poison finding, never an infinite loop',
      'reconciliation never auto-repairs drift or serves a referenced-but-missing object',
    ],
  },
  {
    id: 'account.verification-accounts',
    schema: 'account',
    source: 'src/account-store.ts',
    contract: 'AccountStore',
    state: 'existing_contract',
    securitySensitiveMutations: [
      'createAccount', 'recordEntitlement', 'recordIssuance', 'flagRenewal',
      'sealEpochSigningKey', 'deleteAccount',
    ],
    invariants: [
      'no table in the account schema ever contains a credential serial, persona key, or device identifier',
      'credential issuance bookkeeping is one row per (account, epoch) at day granularity, never a token',
      'epoch private keys are stored only AES-256-GCM sealed under an env secret',
      'account deletion cascades entitlements and issuance and never touches inner-layer data',
    ],
  },
  {
    id: 'credential.anonymous-bridge',
    schema: 'credential',
    source: 'src/credential-bridge-store.ts',
    contract: 'CredentialBridgeStore',
    state: 'existing_contract',
    securitySensitiveMutations: ['publishEpochKey', 'revokeSerial'],
    invariants: [
      'no table in the credential schema ever contains an account, persona, or device identifier',
      'revocation is keyed by credential serial only and is append-only',
      'epoch keys expose only the public half; verifier roles hold SELECT and nothing else',
    ],
  },
] as const;

export function validateMutableStoreInventory(
  entries: readonly MutableStoreInventoryEntry[] = MUTABLE_STORE_INVENTORY,
): void {
  const ids = new Set<string>();
  const schemas = new Set<string>(MEERKAT_POSTGRES_SCHEMAS);

  for (const entry of entries) {
    if (!entry.id.trim() || ids.has(entry.id)) {
      throw new Error(`Mutable store inventory contains an empty or duplicate id: ${entry.id}`);
    }
    if (!schemas.has(entry.schema)) {
      throw new Error(`Mutable store inventory uses an unknown schema: ${entry.schema}`);
    }
    if (entry.securitySensitiveMutations.length === 0 || entry.invariants.length === 0) {
      throw new Error(`Mutable store inventory entry lacks security detail: ${entry.id}`);
    }
    ids.add(entry.id);
  }
}
