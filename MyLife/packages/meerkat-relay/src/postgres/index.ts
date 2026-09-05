export {
  createMeerkatPostgresPool,
  createMeerkatPostgresPoolConfig,
} from './pool';
export type {
  MeerkatPostgresPoolOptions,
  MeerkatPostgresSslMode,
} from './pool';

export { resolveMeerkatStoreRuntimeConfig } from './runtime-config';
export type {
  MeerkatDeploymentProfile,
  MeerkatStoreBackend,
  MeerkatStoreRuntimeConfig,
  ResolveMeerkatStoreRuntimeConfigOptions,
} from './runtime-config';
export { createMeerkatStoreRuntime } from './runtime';
export type {
  CreateMeerkatStoreRuntimeOptions,
  MeerkatStoreRuntime,
} from './runtime';

export {
  POSTGRES_ADVISORY_LOCK_KEY_MAX_BYTES,
  POSTGRES_ADVISORY_LOCK_NAMESPACE_MAX_BYTES,
  PostgresStoreContext,
  PostgresStoreUnavailableError,
  toPostgresStoreUnavailableError,
} from './store-context';

export {
  BOOTSTRAP_MIGRATION_LEDGER_SQL,
  runPostgresMigrations,
} from './migrate';
export type {
  PostgresMigrationClient,
  PostgresMigrationPool,
  PostgresMigrationResult,
  RunPostgresMigrationsOptions,
} from './migrate';

export {
  MEERKAT_POSTGRES_MIGRATIONS,
  MEERKAT_POSTGRES_SCHEMA_VERSION,
  calculateMigrationChecksum,
  validateMigrationSet,
} from './migrations';
export type { MeerkatPostgresMigration } from './migrations';

export {
  assertPostgresSchemaCompatibility,
  readPostgresSchemaState,
} from './schema-guard';
export type {
  PostgresSchemaCompatibility,
  PostgresSchemaQuery,
  PostgresSchemaState,
} from './schema-guard';

export {
  MEERKAT_POSTGRES_SCHEMAS,
  MUTABLE_STORE_INVENTORY,
  validateMutableStoreInventory,
} from './store-inventory';
export type {
  MeerkatPostgresSchema,
  MutableStoreInventoryEntry,
  StoreMigrationState,
} from './store-inventory';

export {
  MEERKAT_DATABASE_ROLES,
  renderMeerkatRoleGrants,
} from './roles';
export type {
  MeerkatDatabaseFunctionAccess,
  MeerkatDatabasePrivilege,
  MeerkatDatabaseRole,
  MeerkatDatabaseTableAccess,
} from './roles';

export { runStoreConformanceSuite } from './conformance/store-conformance';
export type {
  StoreConformanceResult,
  StoreConformanceScenario,
  StoreConformanceSuite,
} from './conformance/store-conformance';

export { PostgresHumanityStore } from './stores/humanity-store';
export { PostgresMeerkatBillingStore } from './stores/hosted-billing-store';
export { PostgresHostedStorageMetadataStore } from './stores/hosted-storage-metadata-store';
export { PostgresOAuthBrokerStore } from './stores/oauth-broker-store';
export { PostgresPersonaRegistryStore } from './stores/persona-registry-store';
export { PostgresOperatorConsoleStore } from './stores/operator-console-store';
export { PostgresNcmecReportQueueStore } from './stores/ncmec-queue-store';
export { PostgresDmcaIntakeStore } from './stores/dmca-intake-store';
export {
  PostgresCommunityDescriptorStore,
  PostgresKillStore,
  PostgresPublicationStore,
  PostgresPublicPostStore,
  PostgresReportStore,
} from './stores/community-stores';
export {
  PostgresDirectoryHostAnnouncementStore,
  PostgresPublicDirectoryRepository,
} from './stores/directory-store';
export type { PostgresDirectoryHostAnnouncementStoreOptions } from './stores/directory-store';
export { PostgresArchiveLifecycleStore } from './stores/archive-lifecycle-store';
export { PostgresAdmissionGenerationStore } from './stores/room-admission-store';
export {
  PostgresPushAttemptStore,
  PostgresPushRegistrationStore,
} from './stores/push-stores';
export { PostgresCommunityPrivateStateStore } from './stores/community-private-state-store';
export type {
  AppendPrivateTailInput,
  AppendPrivateTailOutcome,
  AuthorizeAndCheckPrivateContentOutcome,
  AuthorizeAndReadPrivateStateOutcome,
  AuthorizePrivateRequestInput,
  AuthorizePrivateRequestOutcome,
  BeginPrivatePublishInput,
  BeginPrivatePublishOutcome,
  CommitPrivatePublishInput,
  CommitPrivatePublishOutcome,
  CommunityPrivateStateStore,
  ExpiredPrivatePublishStage,
  InspectPrivateChallengeOutcome,
  IssuePrivateChallengeInput,
  PrivateChallengeContext,
  PrivateCommunityIdentityState,
  PrivateRateLimitAction,
  StoredPrivateCommunityState,
  StoredPrivateSnapshot,
} from '../community-private-state';

export { PostgresOperationsStore } from './stores/operations-store';
export type {
  BackupRestoreProof,
  BackupRestoreProofCursor,
  CompleteIdempotencyInput,
  IdempotencyClaim,
  IdempotencyClaimInput,
  JobLease,
  JobLeaseClaimInput,
  ReleaseManifestCursor,
  ReleaseManifestRecord,
} from './stores/operations-store';

// Plan 44 WP-2C: object reference accounting, fenced deletion jobs, and reconciliation
// bookkeeping over migration 8.
export { PostgresObjectReferenceLedger } from './stores/object-reference-store';
export { PostgresObjectDeletionJobStore } from './stores/object-deletion-store';
export {
  PostgresOrphanFirstSeenStore,
  PostgresReconcileCursorStore,
} from './stores/object-reconciliation-store';
// Plan 43 WP-43B follow-up: durable pin-reconcile resume cursor over migration 14.
export { PostgresPinReconcileCursorStore } from './stores/archive-pin-cursor-store';
