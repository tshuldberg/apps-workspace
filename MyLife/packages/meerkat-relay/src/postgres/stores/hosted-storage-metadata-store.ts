import type { QueryResult, QueryResultRow } from 'pg';
import {
  type CompleteHostedStorageApiObjectInput,
  type CompleteHostedStorageApiObjectResult,
  type HostedSeederManifest,
  type HostedStorageApiObject,
  type HostedStorageApiObjectCursor,
  type HostedStorageApiObjectDeleteResult,
  type HostedStorageApiTenantDeleteResult,
  type HostedStorageApiUpload,
  type HostedStorageApiUploadBlock,
  type HostedStorageBackupCursor,
  type HostedStorageBackupLocator,
  type HostedStorageLegacyReadiness,
  type HostedStorageManifestExpiryCursor,
  type HostedStorageMetadataStore,
  type HostedStorageObject,
  type HostedStorageObjectCursor,
  type HostedStoragePage,
  type HostedStoragePolicy,
  type HostedStorageReconciliationCursor,
  type HostedStorageReservation,
  type HostedStorageReservationCursor,
  type HostedStorageTenant,
  type HostedStorageTransitionInput,
  type HostedStorageTransitionResult,
  type ProvisionHostedStorageTenantInput,
  type ProvisionHostedStorageTenantResult,
  type PutHostedStorageBackupLocatorInput,
  type PutHostedStorageBackupLocatorResult,
  type PutHostedSeederManifestInput,
  type PutHostedSeederManifestResult,
  type ReserveHostedStorageInput,
  type ReserveHostedStorageResult,
  type RecordHostedStorageApiUploadBlockInput,
  type RecordHostedStorageApiUploadBlockResult,
} from '../../hosted-storage-metadata';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

const SAFE_ID = /^[A-Za-z0-9_./:@+-]{1,512}$/u;
const SHA256_HEX = /^[a-f0-9]{64}$/u;
const SHA512_HEX = /^[a-f0-9]{128}$/u;
const API_ID = /^[A-Za-z0-9_-]{1,128}$/u;
const API_DATA_CLASS = /^[A-Za-z0-9_.:-]{1,128}$/u;
const API_VERSION = /^[A-Za-z0-9_-]{1,128}$/u;
const MAX_PAGE_SIZE = 1_000;
const MAX_MANIFEST_JSON_BYTES = 1024 * 1024;

interface TenantRow extends QueryResultRow {
  subject_id: unknown;
  cap_bytes: unknown;
  reserved_bytes: unknown;
  committed_bytes: unknown;
  lifecycle_version: unknown;
  updated_at: unknown;
  policy_version: unknown;
  max_object_bytes: unknown;
  max_object_count: unknown;
  max_concurrent_reservations: unknown;
  reservation_ttl_seconds: unknown;
  retention_days: unknown;
}

interface ReservationRow extends QueryResultRow {
  reservation_id: unknown;
  subject_id: unknown;
  content_id: unknown;
  block_index: unknown;
  object_key: unknown;
  checksum: unknown;
  size_bytes: unknown;
  state: unknown;
  fencing_token: unknown;
  lifecycle_version: unknown;
  expires_at: unknown;
  staged_at: unknown;
  activated_at: unknown;
  released_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  cursor_created_at?: unknown;
  cursor_expires_at?: unknown;
}

interface ObjectRow extends QueryResultRow {
  subject_id: unknown;
  content_id: unknown;
  block_index: unknown;
  object_key: unknown;
  checksum: unknown;
  size_bytes: unknown;
  version_id: unknown;
  lifecycle_version: unknown;
  created_at: unknown;
  deleted_at: unknown;
  metadata_status: unknown;
}

interface ManifestRow extends QueryResultRow {
  subject_id: unknown;
  content_id: unknown;
  manifest: unknown;
  is_pinned: unknown;
  auto_delete_at: unknown;
  lifecycle_version: unknown;
  created_at: unknown;
  updated_at: unknown;
  cursor_auto_delete_at?: unknown;
}

interface ApiUploadBlockRow extends QueryResultRow {
  subject_id: unknown;
  object_id: unknown;
  block_index: unknown;
  total_blocks: unknown;
  block_hash: unknown;
  size_bytes: unknown;
  created_at: unknown;
}

interface ApiObjectRow extends QueryResultRow {
  subject_id: unknown;
  object_id: unknown;
  encrypted_bytes: unknown;
  ciphertext_hash: unknown;
  data_class: unknown;
  total_blocks: unknown;
  version: unknown;
  created_at: unknown;
}

interface BackupLocatorRow extends QueryResultRow {
  subject_id: unknown;
  backup_id: unknown;
  format_version: unknown;
  encrypted_manifest_hash: unknown;
  created_at: unknown;
  manifest_object_id: unknown;
}

interface ApiDeleteCountRow extends QueryResultRow {
  tenant_rows: unknown;
  policy_rows: unknown;
  object_rows: unknown;
  upload_block_rows: unknown;
  backup_rows: unknown;
  storage_object_rows: unknown;
  reservation_rows: unknown;
  seeder_manifest_rows: unknown;
}

interface CountRow extends QueryResultRow {
  object_count: unknown;
  reservation_count: unknown;
}

interface LifecycleRow extends QueryResultRow {
  lifecycle_version: unknown;
}

const RESERVATION_STATES = new Set([
  'reserved', 'staged', 'activated', 'released', 'expired', 'failed',
]);

function assertId(name: string, value: string, maximum = 512): void {
  if (typeof value !== 'string'
    || value.length === 0
    || value.length > maximum
    || !SAFE_ID.test(value)) {
    throw new TypeError(`${name} is not a bounded safe identifier.`);
  }
}

function assertChecksum(checksum: string): void {
  if (typeof checksum !== 'string' || !SHA256_HEX.test(checksum)) {
    throw new TypeError('Storage checksum must be a lowercase SHA-256 hex digest.');
  }
}

function assertSafeInteger(name: string, value: number, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be a safe integer greater than or equal to ${minimum}.`);
  }
}

function assertLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(`Page size must be between 1 and ${MAX_PAGE_SIZE}.`);
  }
}

function integer(value: unknown, name: string): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'bigint'
      ? Number(value)
      : typeof value === 'string' && /^-?\d+$/u.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isSafeInteger(parsed)) throw new Error(`PostgreSQL ${name} is not a safe integer.`);
  return parsed;
}

function nonnegativeInteger(value: unknown, name: string): number {
  const parsed = integer(value, name);
  if (parsed < 0) throw new Error(`PostgreSQL ${name} is negative.`);
  return parsed;
}

function timestamp(value: unknown, name: string, nullable = false): string | null {
  if (value === null && nullable) return null;
  const date = value instanceof Date
    ? value
    : typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : null;
  if (!date || !Number.isFinite(date.getTime())) {
    throw new Error(`PostgreSQL ${name} is not a valid timestamp.`);
  }
  return date.toISOString();
}

function cursorTimestamp(value: unknown, name: string): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`PostgreSQL ${name} cursor is not an exact timestamp string.`);
  }
  return value;
}

function jsonObject(value: unknown, name: string): Record<string, unknown> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error(`PostgreSQL ${name} contains invalid JSON.`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`PostgreSQL ${name} is not a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function validatePolicy(policy: HostedStoragePolicy): void {
  assertSafeInteger('Policy version', policy.policyVersion, 1);
  assertSafeInteger('Maximum object bytes', policy.maxObjectBytes, 1);
  assertSafeInteger('Maximum object count', policy.maxObjectCount, 1);
  assertSafeInteger('Maximum concurrent reservations', policy.maxConcurrentReservations, 1);
  assertSafeInteger('Reservation TTL seconds', policy.reservationTtlSeconds, 1);
  assertSafeInteger('Retention days', policy.retentionDays, 0);
}

function validateProvision(input: ProvisionHostedStorageTenantInput): void {
  assertId('Storage subject id', input.subjectId, 256);
  assertSafeInteger('Tenant cap bytes', input.capBytes, 1);
  validatePolicy(input.policy);
}

function validateReserve(input: ReserveHostedStorageInput): void {
  assertId('Reservation id', input.reservationId, 256);
  assertId('Storage subject id', input.subjectId, 256);
  assertId('Content id', input.contentId, 128);
  assertSafeInteger('Block index', input.blockIndex, 0);
  assertId('Object key', input.objectKey, 512);
  assertChecksum(input.checksum);
  assertSafeInteger('Object size bytes', input.sizeBytes, 1);
}

function validateTransition(input: HostedStorageTransitionInput): void {
  assertId('Reservation id', input.reservationId, 256);
  assertSafeInteger('Fencing token', input.fencingToken, 1);
  if (input.observation) {
    assertId('Observed object key', input.observation.objectKey, 512);
    assertChecksum(input.observation.checksum);
    assertSafeInteger('Observed object size bytes', input.observation.sizeBytes, 1);
    assertId('Observed object version id', input.observation.versionId, 512);
  }
  if (input.deletion) {
    assertId('Deleted object key', input.deletion.objectKey, 512);
    assertId('Deleted object version id', input.deletion.versionId, 512);
    if (typeof input.deletion.deleted !== 'boolean') {
      throw new TypeError('Object deletion receipt must declare whether deletion was confirmed.');
    }
  }
}

function assertApiId(name: string, value: string): void {
  if (!API_ID.test(value)) throw new TypeError(`${name} is not a valid hosted storage API id.`);
}

function assertSha512(name: string, value: string): void {
  if (!SHA512_HEX.test(value)) throw new TypeError(`${name} must be a lowercase SHA-512 digest.`);
}

function validateApiUploadBlock(input: RecordHostedStorageApiUploadBlockInput): void {
  assertId('Storage subject id', input.subjectId, 256);
  assertApiId('Storage object id', input.objectId);
  assertSafeInteger('Storage block index', input.blockIndex, 0);
  assertSafeInteger('Storage total blocks', input.totalBlocks, 1);
  if (input.totalBlocks > 100_000 || input.blockIndex >= input.totalBlocks) {
    throw new TypeError('Storage block coordinates are outside the supported bounds.');
  }
  assertChecksum(input.blockHash);
  assertSafeInteger('Storage block size bytes', input.sizeBytes, 0);
}

function validateApiObject(input: CompleteHostedStorageApiObjectInput): void {
  assertId('Storage subject id', input.subjectId, 256);
  assertApiId('Storage object id', input.objectId);
  assertSafeInteger('Storage encrypted bytes', input.encryptedBytes, 0);
  assertSha512('Storage ciphertext hash', input.ciphertextHash);
  if (!API_DATA_CLASS.test(input.dataClass)) {
    throw new TypeError('Storage data class is invalid.');
  }
  assertSafeInteger('Storage total blocks', input.totalBlocks, 1);
  if (input.totalBlocks > 100_000) throw new TypeError('Storage total blocks exceeds the limit.');
  if (!API_VERSION.test(input.version)) throw new TypeError('Storage object version is invalid.');
}

function validateBackupLocator(input: PutHostedStorageBackupLocatorInput): void {
  assertId('Storage subject id', input.subjectId, 256);
  assertApiId('Backup id', input.backupId);
  assertSafeInteger('Backup format version', input.formatVersion, 1);
  assertSha512('Encrypted manifest hash', input.encryptedManifestHash);
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new TypeError('Backup createdAt is invalid.');
  assertApiId('Manifest object id', input.manifestObjectId);
}

function decodeTenant(row: TenantRow): HostedStorageTenant {
  if (typeof row.subject_id !== 'string') throw new Error('PostgreSQL storage tenant id is invalid.');
  const tenant: HostedStorageTenant = {
    subjectId: row.subject_id,
    capBytes: nonnegativeInteger(row.cap_bytes, 'storage tenant cap bytes'),
    reservedBytes: nonnegativeInteger(row.reserved_bytes, 'storage tenant reserved bytes'),
    committedBytes: nonnegativeInteger(row.committed_bytes, 'storage tenant committed bytes'),
    lifecycleVersion: nonnegativeInteger(row.lifecycle_version, 'storage tenant lifecycle version'),
    updatedAt: timestamp(row.updated_at, 'storage tenant updated_at')!,
    policy: {
      policyVersion: nonnegativeInteger(row.policy_version, 'storage policy version'),
      maxObjectBytes: nonnegativeInteger(row.max_object_bytes, 'storage policy max object bytes'),
      maxObjectCount: nonnegativeInteger(row.max_object_count, 'storage policy max object count'),
      maxConcurrentReservations: nonnegativeInteger(
        row.max_concurrent_reservations,
        'storage policy max concurrent reservations',
      ),
      reservationTtlSeconds: nonnegativeInteger(
        row.reservation_ttl_seconds,
        'storage policy reservation ttl',
      ),
      retentionDays: nonnegativeInteger(row.retention_days, 'storage policy retention days'),
    },
  };
  if (tenant.reservedBytes + tenant.committedBytes > tenant.capBytes
    || tenant.lifecycleVersion < 1
    || tenant.policy.policyVersion < 1) {
    throw new Error('PostgreSQL storage tenant counters or versions are incoherent.');
  }
  return tenant;
}

function decodeReservation(row: ReservationRow): HostedStorageReservation {
  if (typeof row.reservation_id !== 'string'
    || typeof row.subject_id !== 'string'
    || typeof row.content_id !== 'string'
    || typeof row.object_key !== 'string'
    || typeof row.checksum !== 'string'
    || typeof row.state !== 'string'
    || !RESERVATION_STATES.has(row.state)) {
    throw new Error('PostgreSQL storage reservation identity or state is invalid.');
  }
  const reservation: HostedStorageReservation = {
    reservationId: row.reservation_id,
    subjectId: row.subject_id,
    contentId: row.content_id,
    blockIndex: nonnegativeInteger(row.block_index, 'storage reservation block index'),
    objectKey: row.object_key,
    checksum: row.checksum,
    sizeBytes: nonnegativeInteger(row.size_bytes, 'storage reservation size bytes'),
    state: row.state as HostedStorageReservation['state'],
    fencingToken: nonnegativeInteger(row.fencing_token, 'storage reservation fencing token'),
    lifecycleVersion: nonnegativeInteger(
      row.lifecycle_version,
      'storage reservation lifecycle version',
    ),
    expiresAt: timestamp(row.expires_at, 'storage reservation expires_at')!,
    stagedAt: timestamp(row.staged_at, 'storage reservation staged_at', true),
    activatedAt: timestamp(row.activated_at, 'storage reservation activated_at', true),
    releasedAt: timestamp(row.released_at, 'storage reservation released_at', true),
    createdAt: timestamp(row.created_at, 'storage reservation created_at')!,
    updatedAt: timestamp(row.updated_at, 'storage reservation updated_at')!,
  };
  assertChecksum(reservation.checksum);
  if (reservation.sizeBytes < 1 || reservation.fencingToken < 1 || reservation.lifecycleVersion < 1) {
    throw new Error('PostgreSQL storage reservation numeric fields are incoherent.');
  }
  return reservation;
}

function decodeObject(row: ObjectRow): HostedStorageObject {
  if (typeof row.subject_id !== 'string'
    || typeof row.content_id !== 'string'
    || typeof row.object_key !== 'string'
    || typeof row.checksum !== 'string'
    || typeof row.version_id !== 'string'
    || row.version_id.length === 0) {
    throw new Error('PostgreSQL storage object metadata is invalid.');
  }
  const object: HostedStorageObject = {
    subjectId: row.subject_id,
    contentId: row.content_id,
    blockIndex: nonnegativeInteger(row.block_index, 'storage object block index'),
    objectKey: row.object_key,
    checksum: row.checksum,
    sizeBytes: nonnegativeInteger(row.size_bytes, 'storage object size bytes'),
    versionId: row.version_id,
    lifecycleVersion: nonnegativeInteger(row.lifecycle_version, 'storage object lifecycle version'),
    createdAt: timestamp(row.created_at, 'storage object created_at')!,
    deletedAt: timestamp(row.deleted_at, 'storage object deleted_at', true),
  };
  assertChecksum(object.checksum);
  if (object.sizeBytes < 1 || object.lifecycleVersion < 1) {
    throw new Error('PostgreSQL storage object numeric fields are incoherent.');
  }
  return object;
}

function decodeManifest(row: ManifestRow): HostedSeederManifest {
  if (typeof row.subject_id !== 'string'
    || typeof row.content_id !== 'string'
    || typeof row.is_pinned !== 'boolean') {
    throw new Error('PostgreSQL hosted manifest identity is invalid.');
  }
  const manifest: HostedSeederManifest = {
    subjectId: row.subject_id,
    contentId: row.content_id,
    manifest: jsonObject(row.manifest, 'hosted seeder manifest'),
    isPinned: row.is_pinned,
    autoDeleteAt: timestamp(row.auto_delete_at, 'hosted manifest auto_delete_at', true),
    lifecycleVersion: nonnegativeInteger(row.lifecycle_version, 'hosted manifest lifecycle version'),
    createdAt: timestamp(row.created_at, 'hosted manifest created_at')!,
    updatedAt: timestamp(row.updated_at, 'hosted manifest updated_at')!,
  };
  if (manifest.lifecycleVersion < 1 || (manifest.isPinned && manifest.autoDeleteAt !== null)) {
    throw new Error('PostgreSQL hosted manifest lifecycle is incoherent.');
  }
  return manifest;
}

function decodeApiUploadBlock(row: ApiUploadBlockRow): HostedStorageApiUploadBlock {
  if (typeof row.subject_id !== 'string'
    || typeof row.object_id !== 'string'
    || typeof row.block_hash !== 'string') {
    throw new Error('PostgreSQL hosted storage upload block is invalid.');
  }
  const block: HostedStorageApiUploadBlock = {
    subjectId: row.subject_id,
    objectId: row.object_id,
    blockIndex: nonnegativeInteger(row.block_index, 'storage API block index'),
    totalBlocks: nonnegativeInteger(row.total_blocks, 'storage API total blocks'),
    blockHash: row.block_hash,
    sizeBytes: nonnegativeInteger(row.size_bytes, 'storage API block bytes'),
    createdAt: timestamp(row.created_at, 'storage API upload created_at')!,
  };
  validateApiUploadBlock(block);
  return block;
}

function decodeApiObject(row: ApiObjectRow): HostedStorageApiObject {
  if (typeof row.subject_id !== 'string'
    || typeof row.object_id !== 'string'
    || typeof row.ciphertext_hash !== 'string'
    || typeof row.data_class !== 'string'
    || typeof row.version !== 'string') {
    throw new Error('PostgreSQL hosted storage API object is invalid.');
  }
  const object: HostedStorageApiObject = {
    subjectId: row.subject_id,
    objectId: row.object_id,
    encryptedBytes: nonnegativeInteger(row.encrypted_bytes, 'storage API encrypted bytes'),
    ciphertextHash: row.ciphertext_hash,
    dataClass: row.data_class,
    totalBlocks: nonnegativeInteger(row.total_blocks, 'storage API total blocks'),
    version: row.version,
    createdAt: timestamp(row.created_at, 'storage API object created_at')!,
  };
  validateApiObject(object);
  return object;
}

function decodeBackupLocator(row: BackupLocatorRow): HostedStorageBackupLocator {
  if (typeof row.subject_id !== 'string'
    || typeof row.backup_id !== 'string'
    || typeof row.encrypted_manifest_hash !== 'string'
    || typeof row.manifest_object_id !== 'string') {
    throw new Error('PostgreSQL hosted storage backup locator is invalid.');
  }
  const locator: HostedStorageBackupLocator = {
    subjectId: row.subject_id,
    formatVersion: nonnegativeInteger(row.format_version, 'backup format version'),
    backupId: row.backup_id,
    encryptedManifestHash: row.encrypted_manifest_hash,
    createdAt: timestamp(row.created_at, 'backup locator created_at')!,
    manifestObjectId: row.manifest_object_id,
  };
  validateBackupLocator(locator);
  return locator;
}

function reservationMatchesInput(
  reservation: HostedStorageReservation,
  input: ReserveHostedStorageInput,
): boolean {
  return reservation.subjectId === input.subjectId
    && reservation.contentId === input.contentId
    && reservation.blockIndex === input.blockIndex
    && reservation.objectKey === input.objectKey
    && reservation.checksum === input.checksum
    && reservation.sizeBytes === input.sizeBytes;
}

function observationMatches(
  reservation: HostedStorageReservation,
  input: HostedStorageTransitionInput,
): boolean {
  return !!input.observation
    && input.observation.objectKey === reservation.objectKey
    && input.observation.checksum === reservation.checksum
    && input.observation.sizeBytes === reservation.sizeBytes
    && input.observation.versionId.length > 0;
}

function deletionMatches(
  object: HostedStorageObject,
  input: HostedStorageTransitionInput,
): boolean {
  return input.deletion?.deleted === true
    && input.deletion.objectKey === object.objectKey
    && input.deletion.versionId === object.versionId;
}

async function query<Row extends QueryResultRow = QueryResultRow>(
  context: PostgresStoreContext,
  operation: string,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  try {
    return await context.query<Row>(text, values);
  } catch (error) {
    throw toPostgresStoreUnavailableError(operation, error);
  }
}

async function available<T>(operation: string, callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    throw toPostgresStoreUnavailableError(operation, error);
  }
}

async function locked<T>(
  context: PostgresStoreContext,
  operation: string,
  subjectId: string,
  callback: () => Promise<T>,
): Promise<T> {
  try {
    return await context.withAdvisoryTransactionLock(
      'hosted.storage-metadata',
      subjectId,
      callback,
    );
  } catch (error) {
    throw toPostgresStoreUnavailableError(operation, error);
  }
}

const TENANT_PROJECTION = `
  tenants.subject_id AS subject_id,
  tenants.cap_bytes AS cap_bytes,
  tenants.reserved_bytes AS reserved_bytes,
  tenants.committed_bytes AS committed_bytes,
  tenants.lifecycle_version AS lifecycle_version,
  tenants.updated_at AS updated_at,
  policies.policy_version AS policy_version,
  policies.max_object_bytes AS max_object_bytes,
  policies.max_object_count AS max_object_count,
  policies.max_concurrent_reservations AS max_concurrent_reservations,
  policies.reservation_ttl_seconds AS reservation_ttl_seconds,
  policies.retention_days AS retention_days
`;

const RESERVATION_PROJECTION = `
  reservations.reservation_id AS reservation_id,
  reservations.subject_id AS subject_id,
  reservations.content_id AS content_id,
  reservations.block_index AS block_index,
  reservations.object_key AS object_key,
  reservations.checksum AS checksum,
  reservations.size_bytes AS size_bytes,
  reservations.state AS state,
  reservations.fencing_token AS fencing_token,
  reservations.lifecycle_version AS lifecycle_version,
  reservations.expires_at AS expires_at,
  reservations.staged_at AS staged_at,
  reservations.activated_at AS activated_at,
  reservations.released_at AS released_at,
  reservations.created_at AS created_at,
  reservations.updated_at AS updated_at
`;

const OBJECT_PROJECTION = `
  objects.subject_id AS subject_id,
  objects.content_id AS content_id,
  objects.block_index AS block_index,
  objects.object_key AS object_key,
  objects.checksum AS checksum,
  objects.size_bytes AS size_bytes,
  objects.version_id AS version_id,
  objects.lifecycle_version AS lifecycle_version,
  objects.created_at AS created_at,
  objects.deleted_at AS deleted_at,
  objects.metadata_status AS metadata_status
`;

const MANIFEST_PROJECTION = `
  manifests.subject_id AS subject_id,
  manifests.content_id AS content_id,
  manifests.manifest AS manifest,
  manifests.is_pinned AS is_pinned,
  manifests.auto_delete_at AS auto_delete_at,
  manifests.lifecycle_version AS lifecycle_version,
  manifests.created_at AS created_at,
  manifests.updated_at AS updated_at
`;

const API_UPLOAD_BLOCK_PROJECTION = `
  upload_blocks.subject_id AS subject_id,
  upload_blocks.object_id AS object_id,
  upload_blocks.block_index AS block_index,
  upload_blocks.total_blocks AS total_blocks,
  upload_blocks.block_hash AS block_hash,
  upload_blocks.size_bytes AS size_bytes,
  upload_blocks.created_at AS created_at
`;

const API_OBJECT_PROJECTION = `
  api_objects.subject_id AS subject_id,
  api_objects.object_id AS object_id,
  api_objects.encrypted_bytes AS encrypted_bytes,
  api_objects.ciphertext_hash AS ciphertext_hash,
  api_objects.data_class AS data_class,
  api_objects.total_blocks AS total_blocks,
  api_objects.version AS version,
  api_objects.created_at AS created_at
`;

const BACKUP_LOCATOR_PROJECTION = `
  locators.subject_id AS subject_id,
  locators.backup_id AS backup_id,
  locators.format_version AS format_version,
  locators.encrypted_manifest_hash AS encrypted_manifest_hash,
  locators.created_at AS created_at,
  locators.manifest_object_id AS manifest_object_id
`;

export class PostgresHostedStorageMetadataStore implements HostedStorageMetadataStore {
  constructor(private readonly context: PostgresStoreContext) {}

  async provisionTenant(
    input: ProvisionHostedStorageTenantInput,
  ): Promise<ProvisionHostedStorageTenantResult> {
    validateProvision(input);
    return locked(this.context, 'provision hosted storage tenant', input.subjectId, async () => {
      const existing = await this.getTenant(input.subjectId);
      if (!existing) {
        await query(
          this.context,
          'insert hosted storage tenant',
          `INSERT INTO hosted.storage_tenants (subject_id, cap_bytes)
           VALUES ($1, $2)`,
          [input.subjectId, input.capBytes],
        );
        await query(
          this.context,
          'insert hosted storage policy',
          `INSERT INTO hosted.storage_tenant_policies (
             subject_id, policy_version, max_object_bytes, max_object_count,
             max_concurrent_reservations, reservation_ttl_seconds, retention_days
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            input.subjectId,
            input.policy.policyVersion,
            input.policy.maxObjectBytes,
            input.policy.maxObjectCount,
            input.policy.maxConcurrentReservations,
            input.policy.reservationTtlSeconds,
            input.policy.retentionDays,
          ],
        );
        return { status: 'created', tenant: (await this.getTenant(input.subjectId))! };
      }
      if (input.policy.policyVersion < existing.policy.policyVersion) return { status: 'conflict' };
      if (input.capBytes < existing.reservedBytes + existing.committedBytes) {
        return { status: 'cap_below_usage' };
      }
      const same = existing.capBytes === input.capBytes
        && JSON.stringify(existing.policy) === JSON.stringify(input.policy);
      if (input.policy.policyVersion === existing.policy.policyVersion && !same) {
        return { status: 'conflict' };
      }
      if (same) return { status: 'replayed', tenant: existing };
      await query(
        this.context,
        'update hosted storage tenant cap',
        `UPDATE hosted.storage_tenants
         SET cap_bytes = $2,
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE subject_id = $1`,
        [input.subjectId, input.capBytes],
      );
      await query(
        this.context,
        'update hosted storage policy',
        `UPDATE hosted.storage_tenant_policies
         SET policy_version = $2,
             max_object_bytes = $3,
             max_object_count = $4,
             max_concurrent_reservations = $5,
             reservation_ttl_seconds = $6,
             retention_days = $7,
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE subject_id = $1`,
        [
          input.subjectId,
          input.policy.policyVersion,
          input.policy.maxObjectBytes,
          input.policy.maxObjectCount,
          input.policy.maxConcurrentReservations,
          input.policy.reservationTtlSeconds,
          input.policy.retentionDays,
        ],
      );
      return { status: 'updated', tenant: (await this.getTenant(input.subjectId))! };
    });
  }

  async getTenant(subjectId: string): Promise<HostedStorageTenant | null> {
    assertId('Storage subject id', subjectId, 256);
    return available('get hosted storage tenant', async () => {
      const result = await query<TenantRow>(
        this.context,
        'get hosted storage tenant',
        `SELECT ${TENANT_PROJECTION}
         FROM hosted.storage_tenants AS tenants
         JOIN hosted.storage_tenant_policies AS policies USING (subject_id)
         WHERE tenants.subject_id = $1`,
        [subjectId],
      );
      return result.rows[0] ? decodeTenant(result.rows[0]) : null;
    });
  }

  async reserve(input: ReserveHostedStorageInput): Promise<ReserveHostedStorageResult> {
    validateReserve(input);
    return locked(this.context, 'reserve hosted storage quota', input.subjectId, async () => {
      await this.expireSubject(input.subjectId);
      const prior = await this.getReservation(input.reservationId);
      if (prior) {
        return reservationMatchesInput(prior, input)
          ? { status: 'replayed', reservation: prior }
          : { status: 'conflict' };
      }
      const tenant = await this.getTenant(input.subjectId);
      if (!tenant) return { status: 'tenant_missing' };
      const existingObject = await this.getObject(
        input.subjectId,
        input.contentId,
        input.blockIndex,
      );
      if (existingObject) {
        return existingObject.checksum === input.checksum
          && existingObject.sizeBytes === input.sizeBytes
          ? { status: 'already_active', object: existingObject }
          : { status: 'conflict' };
      }
      const counts = await query<CountRow>(
        this.context,
        'count hosted storage objects and reservations',
        `SELECT
           (SELECT count(*)::text
            FROM hosted.storage_objects
            WHERE subject_id = $1 AND deleted_at IS NULL) AS object_count,
           (SELECT count(*)::text
            FROM hosted.storage_reservations
            WHERE subject_id = $1 AND state IN ('reserved', 'staged')) AS reservation_count`,
        [input.subjectId],
      );
      const objectCount = nonnegativeInteger(counts.rows[0]?.object_count, 'storage object count');
      const reservationCount = nonnegativeInteger(
        counts.rows[0]?.reservation_count,
        'storage reservation count',
      );
      if (input.sizeBytes > tenant.policy.maxObjectBytes) return { status: 'object_too_large' };
      if (reservationCount >= tenant.policy.maxConcurrentReservations) {
        return { status: 'reservation_limit' };
      }
      if (objectCount + reservationCount >= tenant.policy.maxObjectCount) {
        return { status: 'object_limit' };
      }
      if (tenant.reservedBytes + tenant.committedBytes + input.sizeBytes > tenant.capBytes) {
        return { status: 'quota_exceeded' };
      }
      const inserted = await query<ReservationRow>(
        this.context,
        'insert hosted storage reservation',
        `INSERT INTO hosted.storage_reservations (
           reservation_id, subject_id, content_id, block_index, object_key,
           checksum, size_bytes, state, fencing_token, expires_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 'reserved', 1,
           clock_timestamp() + ($8::double precision * interval '1 second')
         )
         ON CONFLICT DO NOTHING
         RETURNING reservation_id`,
        [
          input.reservationId,
          input.subjectId,
          input.contentId,
          input.blockIndex,
          input.objectKey,
          input.checksum,
          input.sizeBytes,
          tenant.policy.reservationTtlSeconds,
        ],
      );
      if (!inserted.rows[0]) return { status: 'conflict' };
      const charged = await query<LifecycleRow>(
        this.context,
        'charge hosted storage reservation',
        `UPDATE hosted.storage_tenants
         SET reserved_bytes = reserved_bytes + $2,
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE subject_id = $1
         RETURNING lifecycle_version`,
        [input.subjectId, input.sizeBytes],
      );
      const fencingToken = integer(
        charged.rows[0]?.lifecycle_version,
        'storage reservation fencing token',
      );
      if (fencingToken < 1) throw new Error('Storage fencing token is incoherent.');
      const fenced = await query<ReservationRow>(
        this.context,
        'fence hosted storage reservation',
        `UPDATE hosted.storage_reservations AS reservations
         SET fencing_token = $2
         WHERE reservation_id = $1
         RETURNING ${RESERVATION_PROJECTION}`,
        [input.reservationId, fencingToken],
      );
      if (!fenced.rows[0]) throw new Error('Storage reservation vanished before fencing.');
      return { status: 'reserved', reservation: decodeReservation(fenced.rows[0]) };
    });
  }

  async stage(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    validateTransition(input);
    const initial = await this.getReservation(input.reservationId);
    if (!initial) return { status: 'not_found' };
    return locked(this.context, 'stage hosted storage reservation', initial.subjectId, async () => {
      const reservation = await this.getReservationForUpdate(input.reservationId);
      if (!reservation) return { status: 'not_found' };
      if (reservation.fencingToken !== input.fencingToken) return { status: 'stale_fence' };
      if (reservation.state === 'staged') {
        return observationMatches(reservation, input)
          ? { status: 'replayed', reservation }
          : { status: 'metadata_mismatch' };
      }
      if (reservation.state !== 'reserved') return { status: 'invalid_state' };
      if (await this.isExpired(reservation.reservationId)) {
        const expired = await this.expireOne(reservation.reservationId);
        return { status: 'expired', reservation: expired! };
      }
      if (!observationMatches(reservation, input)) return { status: 'metadata_mismatch' };
      const result = await query<ReservationRow>(
        this.context,
        'mark hosted storage reservation staged',
        `UPDATE hosted.storage_reservations AS reservations
         SET state = 'staged', staged_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE reservation_id = $1 AND state = 'reserved' AND fencing_token = $2
         RETURNING ${RESERVATION_PROJECTION}`,
        [input.reservationId, input.fencingToken],
      );
      return result.rows[0]
        ? { status: 'staged', reservation: decodeReservation(result.rows[0]) }
        : { status: 'invalid_state' };
    });
  }

  async activate(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    validateTransition(input);
    const initial = await this.getReservation(input.reservationId);
    if (!initial) return { status: 'not_found' };
    return locked(this.context, 'activate hosted storage reservation', initial.subjectId, async () => {
      const reservation = await this.getReservationForUpdate(input.reservationId);
      if (!reservation) return { status: 'not_found' };
      if (reservation.fencingToken !== input.fencingToken) return { status: 'stale_fence' };
      const existingObject = await this.getObject(
        reservation.subjectId,
        reservation.contentId,
        reservation.blockIndex,
      );
      if (reservation.state === 'activated') {
        return existingObject && observationMatches(reservation, input)
          && existingObject.versionId === input.observation!.versionId
          ? { status: 'replayed', reservation, object: existingObject }
          : { status: 'metadata_mismatch' };
      }
      if (reservation.state !== 'staged') return { status: 'invalid_state' };
      if (await this.isExpired(reservation.reservationId)) {
        const expired = await this.expireOne(reservation.reservationId);
        return { status: 'expired', reservation: expired! };
      }
      if (!observationMatches(reservation, input)) return { status: 'metadata_mismatch' };
      const observation = input.observation!;
      const objectKeyConflict = await query<ObjectRow>(
        this.context,
        'check hosted storage object key',
        `SELECT ${OBJECT_PROJECTION}
         FROM hosted.storage_objects AS objects
         WHERE objects.object_key = $1
           AND (objects.subject_id, objects.content_id, objects.block_index) <> ($2, $3, $4)
         LIMIT 1`,
        [
          reservation.objectKey,
          reservation.subjectId,
          reservation.contentId,
          reservation.blockIndex,
        ],
      );
      if (objectKeyConflict.rows[0]) return { status: 'object_conflict' };
      const objectResult = await query<ObjectRow>(
        this.context,
        'upsert hosted storage object metadata',
        `INSERT INTO hosted.storage_objects AS objects (
           subject_id, content_id, block_index, object_key, checksum, size_bytes,
           version_id, metadata_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'verified')
         ON CONFLICT (subject_id, content_id, block_index) DO UPDATE SET
           object_key = EXCLUDED.object_key,
           checksum = EXCLUDED.checksum,
           size_bytes = EXCLUDED.size_bytes,
           version_id = EXCLUDED.version_id,
           metadata_status = 'verified',
           deleted_at = NULL,
           lifecycle_version = objects.lifecycle_version + 1
         WHERE objects.deleted_at IS NOT NULL
         RETURNING ${OBJECT_PROJECTION}`,
        [
          reservation.subjectId,
          reservation.contentId,
          reservation.blockIndex,
          reservation.objectKey,
          reservation.checksum,
          reservation.sizeBytes,
          observation.versionId,
        ],
      );
      if (!objectResult.rows[0]) return { status: 'object_conflict' };
      await query(
        this.context,
        'commit hosted storage quota',
        `UPDATE hosted.storage_tenants
         SET reserved_bytes = reserved_bytes - $2,
             committed_bytes = committed_bytes + $2,
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE subject_id = $1`,
        [reservation.subjectId, reservation.sizeBytes],
      );
      const updated = await query<ReservationRow>(
        this.context,
        'mark hosted storage reservation activated',
        `UPDATE hosted.storage_reservations AS reservations
         SET state = 'activated', activated_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE reservation_id = $1 AND state = 'staged' AND fencing_token = $2
         RETURNING ${RESERVATION_PROJECTION}`,
        [reservation.reservationId, reservation.fencingToken],
      );
      if (!updated.rows[0]) throw new Error('Storage reservation changed during activation lock.');
      return {
        status: 'activated',
        reservation: decodeReservation(updated.rows[0]),
        object: decodeObject(objectResult.rows[0]),
      };
    });
  }

  release(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    return this.finish(input, 'released');
  }

  fail(input: HostedStorageTransitionInput): Promise<HostedStorageTransitionResult> {
    return this.finish(input, 'failed');
  }

  private async finish(
    input: HostedStorageTransitionInput,
    terminalState: 'released' | 'failed',
  ): Promise<HostedStorageTransitionResult> {
    validateTransition(input);
    const initial = await this.getReservation(input.reservationId);
    if (!initial) return { status: 'not_found' };
    return locked(this.context, `${terminalState} hosted storage reservation`, initial.subjectId, async () => {
      const reservation = await this.getReservationForUpdate(input.reservationId);
      if (!reservation) return { status: 'not_found' };
      if (reservation.fencingToken !== input.fencingToken) return { status: 'stale_fence' };
      if (reservation.state === terminalState) return { status: 'replayed', reservation };
      if (reservation.state === 'released' || reservation.state === 'failed' || reservation.state === 'expired') {
        return { status: 'invalid_state' };
      }
      if (reservation.state === 'activated') {
        const object = await this.getObject(
          reservation.subjectId,
          reservation.contentId,
          reservation.blockIndex,
        );
        if (!object || !deletionMatches(object, input)) {
          return { status: 'delete_not_confirmed' };
        }
        await query(
          this.context,
          'mark hosted storage object deleted',
          `UPDATE hosted.storage_objects
           SET deleted_at = clock_timestamp(), lifecycle_version = lifecycle_version + 1
           WHERE subject_id = $1 AND content_id = $2 AND block_index = $3
             AND deleted_at IS NULL AND version_id = $4`,
          [object.subjectId, object.contentId, object.blockIndex, object.versionId],
        );
        await query(
          this.context,
          'release hosted committed storage quota',
          `UPDATE hosted.storage_tenants
           SET committed_bytes = committed_bytes - $2,
               lifecycle_version = lifecycle_version + 1,
               updated_at = clock_timestamp()
           WHERE subject_id = $1`,
          [reservation.subjectId, reservation.sizeBytes],
        );
      } else {
        await query(
          this.context,
          'release hosted reserved storage quota',
          `UPDATE hosted.storage_tenants
           SET reserved_bytes = reserved_bytes - $2,
               lifecycle_version = lifecycle_version + 1,
               updated_at = clock_timestamp()
           WHERE subject_id = $1`,
          [reservation.subjectId, reservation.sizeBytes],
        );
      }
      const updated = await query<ReservationRow>(
        this.context,
        `mark hosted storage reservation ${terminalState}`,
        `UPDATE hosted.storage_reservations AS reservations
         SET state = $2, released_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE reservation_id = $1 AND fencing_token = $3
         RETURNING ${RESERVATION_PROJECTION}`,
        [reservation.reservationId, terminalState, reservation.fencingToken],
      );
      if (!updated.rows[0]) throw new Error('Storage reservation changed during terminal transition.');
      return { status: terminalState, reservation: decodeReservation(updated.rows[0]) };
    });
  }

  async expireDue(limit: number): Promise<HostedStorageReservation[]> {
    assertLimit(limit);
    return available('expire due hosted storage reservations', async () => {
      const result = await query<ReservationRow>(
        this.context,
        'expire due hosted storage reservations',
        `WITH candidates AS MATERIALIZED (
           SELECT reservation_id
           FROM hosted.storage_reservations
           WHERE state IN ('reserved', 'staged') AND expires_at <= clock_timestamp()
           ORDER BY expires_at, reservation_id
           FOR UPDATE SKIP LOCKED
           LIMIT $1
         ), expired AS (
           UPDATE hosted.storage_reservations AS reservations
           SET state = 'expired', released_at = clock_timestamp(),
               lifecycle_version = lifecycle_version + 1,
               updated_at = clock_timestamp()
           FROM candidates
           WHERE reservations.reservation_id = candidates.reservation_id
           RETURNING reservations.*
         ), debits AS (
           SELECT subject_id, sum(size_bytes)::bigint AS bytes
           FROM expired
           GROUP BY subject_id
         ), tenant_updates AS (
           UPDATE hosted.storage_tenants AS tenants
           SET reserved_bytes = tenants.reserved_bytes - debits.bytes,
               lifecycle_version = tenants.lifecycle_version + 1,
               updated_at = clock_timestamp()
           FROM debits
           WHERE tenants.subject_id = debits.subject_id
           RETURNING tenants.subject_id
         )
         SELECT ${RESERVATION_PROJECTION.replaceAll('reservations.', 'expired.')}
         FROM expired
         JOIN tenant_updates USING (subject_id)
         ORDER BY expired.expires_at, expired.reservation_id`,
        [limit],
      );
      return result.rows.map(decodeReservation);
    });
  }

  async getReservation(reservationId: string): Promise<HostedStorageReservation | null> {
    assertId('Reservation id', reservationId, 256);
    return available('get hosted storage reservation', async () => {
      const result = await query<ReservationRow>(
        this.context,
        'get hosted storage reservation',
        `SELECT ${RESERVATION_PROJECTION}
         FROM hosted.storage_reservations AS reservations
         WHERE reservations.reservation_id = $1`,
        [reservationId],
      );
      return result.rows[0] ? decodeReservation(result.rows[0]) : null;
    });
  }

  private async getReservationForUpdate(
    reservationId: string,
  ): Promise<HostedStorageReservation | null> {
    const result = await query<ReservationRow>(
      this.context,
      'lock hosted storage reservation',
      `SELECT ${RESERVATION_PROJECTION}
       FROM hosted.storage_reservations AS reservations
       WHERE reservations.reservation_id = $1
       FOR UPDATE`,
      [reservationId],
    );
    return result.rows[0] ? decodeReservation(result.rows[0]) : null;
  }

  async listReservations(input: {
    subjectId: string;
    after?: HostedStorageReservationCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageReservation, HostedStorageReservationCursor>> {
    assertId('Storage subject id', input.subjectId, 256);
    assertLimit(input.limit);
    if (input.after) {
      timestamp(input.after.createdAt, 'reservation cursor created_at');
      assertId('Reservation cursor id', input.after.reservationId, 256);
    }
    return available('list hosted storage reservations', async () => {
      const result = await query<ReservationRow>(
        this.context,
        'list hosted storage reservations',
        `SELECT ${RESERVATION_PROJECTION},
           to_char(
             reservations.created_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) AS cursor_created_at
         FROM hosted.storage_reservations AS reservations
         WHERE reservations.subject_id = $1
           AND ($2::timestamptz IS NULL
             OR (reservations.created_at, reservations.reservation_id) < ($2, $3))
         ORDER BY reservations.created_at DESC, reservations.reservation_id DESC
         LIMIT $4`,
        [
          input.subjectId,
          input.after?.createdAt ?? null,
          input.after?.reservationId ?? null,
          input.limit + 1,
        ],
      );
      return this.reservationCreatedPage(result.rows, input.limit);
    });
  }

  async listReconciliation(input: {
    after?: HostedStorageReconciliationCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageReservation, HostedStorageReconciliationCursor>> {
    assertLimit(input.limit);
    if (input.after) {
      timestamp(input.after.expiresAt, 'reconciliation cursor expires_at');
      assertId('Reconciliation cursor id', input.after.reservationId, 256);
    }
    return available('list hosted storage reconciliation candidates', async () => {
      const result = await query<ReservationRow>(
        this.context,
        'list hosted storage reconciliation candidates',
        `SELECT ${RESERVATION_PROJECTION},
           to_char(
             reservations.expires_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) AS cursor_expires_at
         FROM hosted.storage_reservations AS reservations
         WHERE reservations.state = 'staged'
           AND reservations.expires_at > clock_timestamp()
           AND ($1::timestamptz IS NULL
             OR (reservations.expires_at, reservations.reservation_id) > ($1, $2))
         ORDER BY reservations.expires_at, reservations.reservation_id
         LIMIT $3`,
        [input.after?.expiresAt ?? null, input.after?.reservationId ?? null, input.limit + 1],
      );
      return this.reservationExpiryPage(result.rows, input.limit);
    });
  }

  async getObject(
    subjectId: string,
    contentId: string,
    blockIndex: number,
  ): Promise<HostedStorageObject | null> {
    assertId('Storage subject id', subjectId, 256);
    assertId('Content id', contentId, 128);
    assertSafeInteger('Block index', blockIndex, 0);
    return available('get hosted storage object', async () => {
      const result = await query<ObjectRow>(
        this.context,
        'get hosted storage object',
        `SELECT ${OBJECT_PROJECTION}
         FROM hosted.storage_objects AS objects
         WHERE objects.subject_id = $1 AND objects.content_id = $2
           AND objects.block_index = $3 AND objects.deleted_at IS NULL
           AND objects.metadata_status = 'verified'`,
        [subjectId, contentId, blockIndex],
      );
      return result.rows[0] ? decodeObject(result.rows[0]) : null;
    });
  }

  async listObjects(input: {
    subjectId: string;
    after?: HostedStorageObjectCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageObject, HostedStorageObjectCursor>> {
    assertId('Storage subject id', input.subjectId, 256);
    assertLimit(input.limit);
    if (input.after) {
      assertId('Object cursor content id', input.after.contentId, 128);
      assertSafeInteger('Object cursor block index', input.after.blockIndex, 0);
    }
    return available('list hosted storage objects', async () => {
      const result = await query<ObjectRow>(
        this.context,
        'list hosted storage objects',
        `SELECT ${OBJECT_PROJECTION}
         FROM hosted.storage_objects AS objects
         WHERE objects.subject_id = $1 AND objects.deleted_at IS NULL
           AND objects.metadata_status = 'verified'
           AND ($2::text IS NULL OR (objects.content_id, objects.block_index) > ($2, $3))
         ORDER BY objects.content_id, objects.block_index
         LIMIT $4`,
        [
          input.subjectId,
          input.after?.contentId ?? null,
          input.after?.blockIndex ?? null,
          input.limit + 1,
        ],
      );
      const objects = result.rows.map(decodeObject);
      const items = objects.slice(0, input.limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor: objects.length > input.limit && last
          ? { contentId: last.contentId, blockIndex: last.blockIndex }
          : null,
      };
    });
  }

  async getLegacyReadiness(): Promise<HostedStorageLegacyReadiness> {
    return available('get hosted storage legacy readiness', async () => {
      const result = await query<{ legacy_objects: unknown; legacy_bytes: unknown }>(
        this.context,
        'get hosted storage legacy readiness',
        `SELECT count(*)::bigint AS legacy_objects,
           COALESCE(sum(size_bytes), 0)::bigint AS legacy_bytes
         FROM hosted.storage_objects
         WHERE metadata_status = 'legacy_unbound' AND deleted_at IS NULL`,
      );
      return {
        legacyObjects: nonnegativeInteger(
          result.rows[0]?.legacy_objects,
          'legacy storage object count',
        ),
        legacyBytes: nonnegativeInteger(
          result.rows[0]?.legacy_bytes,
          'legacy storage object bytes',
        ),
      };
    });
  }

  async putManifest(input: PutHostedSeederManifestInput): Promise<PutHostedSeederManifestResult> {
    assertId('Storage subject id', input.subjectId, 256);
    assertId('Content id', input.contentId, 128);
    if (typeof input.manifest !== 'object' || input.manifest === null || Array.isArray(input.manifest)
      || Buffer.byteLength(JSON.stringify(input.manifest), 'utf8') > MAX_MANIFEST_JSON_BYTES) {
      throw new TypeError('Hosted manifest must be a bounded JSON object.');
    }
    if (input.expectedLifecycleVersion !== null) {
      assertSafeInteger('Expected manifest lifecycle version', input.expectedLifecycleVersion, 1);
    }
    return locked(this.context, 'put hosted seeder manifest', input.subjectId, async () => {
      const tenant = await this.getTenant(input.subjectId);
      if (!tenant) return { status: 'tenant_missing' };
      const existing = await this.getManifest(input.subjectId, input.contentId);
      if (!existing) {
        if (input.expectedLifecycleVersion !== null) return { status: 'conflict' };
        const inserted = await query<ManifestRow>(
          this.context,
          'insert hosted seeder manifest',
          `INSERT INTO hosted.seeder_manifests AS manifests (
             subject_id, content_id, manifest, is_pinned, auto_delete_at
           ) VALUES (
             $1, $2, $3::jsonb, $4,
             CASE WHEN $4 THEN NULL
               ELSE clock_timestamp() + ($5::double precision * interval '1 day') END
           )
           RETURNING ${MANIFEST_PROJECTION}`,
          [
            input.subjectId,
            input.contentId,
            JSON.stringify(input.manifest),
            input.isPinned,
            tenant.policy.retentionDays,
          ],
        );
        return { status: 'inserted', manifest: decodeManifest(inserted.rows[0]!) };
      }
      if (existing.lifecycleVersion !== input.expectedLifecycleVersion) return { status: 'conflict' };
      const same = JSON.stringify(existing.manifest) === JSON.stringify(input.manifest)
        && existing.isPinned === input.isPinned;
      if (same) return { status: 'replayed', manifest: existing };
      const updated = await query<ManifestRow>(
        this.context,
        'update hosted seeder manifest',
        `UPDATE hosted.seeder_manifests AS manifests
         SET manifest = $3::jsonb,
             is_pinned = $4,
             auto_delete_at = CASE WHEN $4 THEN NULL
               ELSE clock_timestamp() + ($5::double precision * interval '1 day') END,
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE subject_id = $1 AND content_id = $2 AND lifecycle_version = $6
         RETURNING ${MANIFEST_PROJECTION}`,
        [
          input.subjectId,
          input.contentId,
          JSON.stringify(input.manifest),
          input.isPinned,
          tenant.policy.retentionDays,
          input.expectedLifecycleVersion,
        ],
      );
      return updated.rows[0]
        ? { status: 'updated', manifest: decodeManifest(updated.rows[0]) }
        : { status: 'conflict' };
    });
  }

  async getManifest(subjectId: string, contentId: string): Promise<HostedSeederManifest | null> {
    assertId('Storage subject id', subjectId, 256);
    assertId('Content id', contentId, 128);
    return available('get hosted seeder manifest', async () => {
      const result = await query<ManifestRow>(
        this.context,
        'get hosted seeder manifest',
        `SELECT ${MANIFEST_PROJECTION}
         FROM hosted.seeder_manifests AS manifests
         WHERE manifests.subject_id = $1 AND manifests.content_id = $2`,
        [subjectId, contentId],
      );
      return result.rows[0] ? decodeManifest(result.rows[0]) : null;
    });
  }

  async listExpiredManifests(input: {
    after?: HostedStorageManifestExpiryCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedSeederManifest, HostedStorageManifestExpiryCursor>> {
    assertLimit(input.limit);
    if (input.after) {
      timestamp(input.after.autoDeleteAt, 'manifest expiry cursor auto_delete_at');
      assertId('Manifest expiry cursor subject id', input.after.subjectId, 256);
      assertId('Manifest expiry cursor content id', input.after.contentId, 128);
    }
    return available('list expired hosted seeder manifests', async () => {
      const result = await query<ManifestRow>(
        this.context,
        'list expired hosted seeder manifests',
        `SELECT ${MANIFEST_PROJECTION},
           to_char(
             manifests.auto_delete_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) AS cursor_auto_delete_at
         FROM hosted.seeder_manifests AS manifests
         WHERE NOT manifests.is_pinned
           AND manifests.auto_delete_at <= clock_timestamp()
           AND ($1::timestamptz IS NULL
             OR (manifests.auto_delete_at, manifests.subject_id, manifests.content_id)
               > ($1, $2, $3))
         ORDER BY manifests.auto_delete_at, manifests.subject_id, manifests.content_id
         LIMIT $4`,
        [
          input.after?.autoDeleteAt ?? null,
          input.after?.subjectId ?? null,
          input.after?.contentId ?? null,
          input.limit + 1,
        ],
      );
      const manifests = result.rows.map(decodeManifest);
      const items = manifests.slice(0, input.limit);
      const last = items.at(-1);
      const lastRow = result.rows[items.length - 1];
      return {
        items,
        nextCursor: manifests.length > input.limit && last && lastRow
          ? {
            autoDeleteAt: cursorTimestamp(
              lastRow.cursor_auto_delete_at,
              'manifest auto_delete_at',
            ),
            subjectId: last.subjectId,
            contentId: last.contentId,
          }
          : null,
      };
    });
  }

  async deleteManifest(
    subjectId: string,
    contentId: string,
    expectedLifecycleVersion: number,
  ): Promise<'deleted' | 'not_found' | 'conflict'> {
    assertId('Storage subject id', subjectId, 256);
    assertId('Content id', contentId, 128);
    assertSafeInteger('Expected manifest lifecycle version', expectedLifecycleVersion, 1);
    return locked(this.context, 'delete hosted seeder manifest', subjectId, async () => {
      const deleted = await query(
        this.context,
        'delete hosted seeder manifest',
        `DELETE FROM hosted.seeder_manifests
         WHERE subject_id = $1 AND content_id = $2 AND lifecycle_version = $3`,
        [subjectId, contentId, expectedLifecycleVersion],
      );
      if (deleted.rowCount === 1) return 'deleted';
      return (await this.getManifest(subjectId, contentId)) ? 'conflict' : 'not_found';
    });
  }

  async recordApiUploadBlock(
    input: RecordHostedStorageApiUploadBlockInput,
  ): Promise<RecordHostedStorageApiUploadBlockResult> {
    validateApiUploadBlock(input);
    return locked(this.context, 'record hosted storage API upload block', input.subjectId, async () => {
      const existing = await query<ApiUploadBlockRow>(
        this.context,
        'get hosted storage API upload block',
        `SELECT ${API_UPLOAD_BLOCK_PROJECTION}
         FROM hosted.storage_api_upload_blocks AS upload_blocks
         WHERE subject_id = $1 AND object_id = $2 AND block_index = $3`,
        [input.subjectId, input.objectId, input.blockIndex],
      );
      if (existing.rows[0]) {
        const block = decodeApiUploadBlock(existing.rows[0]);
        return block.totalBlocks === input.totalBlocks
          && block.blockHash === input.blockHash
          && block.sizeBytes === input.sizeBytes
          ? { status: 'replayed', block }
          : { status: 'conflict' };
      }
      if (!await this.getTenant(input.subjectId)) return { status: 'tenant_missing' };
      if (await this.getApiObject(input.subjectId, input.objectId)) return { status: 'conflict' };
      const mismatch = await query<QueryResultRow>(
        this.context,
        'check hosted storage API upload shape',
        `SELECT 1
         FROM hosted.storage_api_upload_blocks
         WHERE subject_id = $1 AND object_id = $2 AND total_blocks <> $3
         LIMIT 1`,
        [input.subjectId, input.objectId, input.totalBlocks],
      );
      if (mismatch.rowCount === 1) return { status: 'conflict' };
      const inserted = await query<ApiUploadBlockRow>(
        this.context,
        'insert hosted storage API upload block',
        `INSERT INTO hosted.storage_api_upload_blocks AS upload_blocks (
           subject_id, object_id, block_index, total_blocks, block_hash, size_bytes
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${API_UPLOAD_BLOCK_PROJECTION}`,
        [
          input.subjectId,
          input.objectId,
          input.blockIndex,
          input.totalBlocks,
          input.blockHash,
          input.sizeBytes,
        ],
      );
      return { status: 'inserted', block: decodeApiUploadBlock(inserted.rows[0]!) };
    });
  }

  async getApiUpload(subjectId: string, objectId: string): Promise<HostedStorageApiUpload | null> {
    assertId('Storage subject id', subjectId, 256);
    assertApiId('Storage object id', objectId);
    return available('get hosted storage API upload', async () => {
      const result = await query<ApiUploadBlockRow>(
        this.context,
        'list hosted storage API upload blocks',
        `SELECT ${API_UPLOAD_BLOCK_PROJECTION}
         FROM hosted.storage_api_upload_blocks AS upload_blocks
         WHERE subject_id = $1 AND object_id = $2
         ORDER BY block_index`,
        [subjectId, objectId],
      );
      const blocks = result.rows.map(decodeApiUploadBlock);
      const first = blocks[0];
      return first ? { subjectId, objectId, totalBlocks: first.totalBlocks, blocks } : null;
    });
  }

  async completeApiObject(
    input: CompleteHostedStorageApiObjectInput,
  ): Promise<CompleteHostedStorageApiObjectResult> {
    validateApiObject(input);
    return locked(this.context, 'complete hosted storage API object', input.subjectId, async () => {
      const existing = await this.getApiObject(input.subjectId, input.objectId);
      if (existing) {
        const same = existing.encryptedBytes === input.encryptedBytes
          && existing.ciphertextHash === input.ciphertextHash
          && existing.dataClass === input.dataClass
          && existing.totalBlocks === input.totalBlocks;
        return same ? { status: 'replayed', object: existing } : { status: 'conflict' };
      }
      if (!await this.getTenant(input.subjectId)) return { status: 'tenant_missing' };
      const upload = await this.getApiUpload(input.subjectId, input.objectId);
      if (!upload) return { status: 'upload_missing' };
      const complete = upload.totalBlocks === input.totalBlocks
        && upload.blocks.length === input.totalBlocks
        && upload.blocks.every((block, index) => block.blockIndex === index)
        && upload.blocks.reduce((total, block) => total + block.sizeBytes, 0) === input.encryptedBytes;
      if (!complete) return { status: 'upload_incomplete' };
      const inserted = await query<ApiObjectRow>(
        this.context,
        'insert hosted storage API object',
        `INSERT INTO hosted.storage_api_objects AS api_objects (
           subject_id, object_id, encrypted_bytes, ciphertext_hash,
           data_class, total_blocks, version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${API_OBJECT_PROJECTION}`,
        [
          input.subjectId,
          input.objectId,
          input.encryptedBytes,
          input.ciphertextHash,
          input.dataClass,
          input.totalBlocks,
          input.version,
        ],
      );
      return { status: 'completed', object: decodeApiObject(inserted.rows[0]!) };
    });
  }

  async getApiObject(subjectId: string, objectId: string): Promise<HostedStorageApiObject | null> {
    assertId('Storage subject id', subjectId, 256);
    assertApiId('Storage object id', objectId);
    return available('get hosted storage API object', async () => {
      const result = await query<ApiObjectRow>(
        this.context,
        'get hosted storage API object',
        `SELECT ${API_OBJECT_PROJECTION}
         FROM hosted.storage_api_objects AS api_objects
         WHERE subject_id = $1 AND object_id = $2`,
        [subjectId, objectId],
      );
      return result.rows[0] ? decodeApiObject(result.rows[0]) : null;
    });
  }

  async listApiObjects(input: {
    subjectId: string;
    after?: HostedStorageApiObjectCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageApiObject, HostedStorageApiObjectCursor>> {
    assertId('Storage subject id', input.subjectId, 256);
    assertLimit(input.limit);
    if (input.after) {
      timestamp(input.after.createdAt, 'storage API object cursor created_at');
      assertApiId('Storage API object cursor id', input.after.objectId);
    }
    return available('list hosted storage API objects', async () => {
      const result = await query<ApiObjectRow & { cursor_created_at?: unknown }>(
        this.context,
        'list hosted storage API objects',
        `SELECT ${API_OBJECT_PROJECTION},
           to_char(
             api_objects.created_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) AS cursor_created_at
         FROM hosted.storage_api_objects AS api_objects
         WHERE subject_id = $1
           AND ($2::timestamptz IS NULL OR (created_at, object_id) > ($2, $3))
         ORDER BY created_at, object_id
         LIMIT $4`,
        [input.subjectId, input.after?.createdAt ?? null, input.after?.objectId ?? null, input.limit + 1],
      );
      const objects = result.rows.map(decodeApiObject);
      const items = objects.slice(0, input.limit);
      const last = items.at(-1);
      const lastRow = result.rows[items.length - 1];
      return {
        items,
        nextCursor: objects.length > input.limit && last && lastRow
          ? {
            createdAt: cursorTimestamp(lastRow.cursor_created_at, 'storage API object created_at'),
            objectId: last.objectId,
          }
          : null,
      };
    });
  }

  async deleteApiObject(
    subjectId: string,
    objectId: string,
  ): Promise<HostedStorageApiObjectDeleteResult> {
    assertId('Storage subject id', subjectId, 256);
    assertApiId('Storage object id', objectId);
    return locked(this.context, 'delete hosted storage API object', subjectId, async () => {
      const backups = await query<{ count: unknown }>(
        this.context,
        'count hosted storage API object backups',
        `SELECT count(*)::bigint AS count
         FROM hosted.storage_backup_locators
         WHERE subject_id = $1 AND manifest_object_id = $2`,
        [subjectId, objectId],
      );
      const deletedObject = await query(
        this.context,
        'delete hosted storage API object row',
        `DELETE FROM hosted.storage_api_objects
         WHERE subject_id = $1 AND object_id = $2`,
        [subjectId, objectId],
      );
      const deletedBlocks = await query(
        this.context,
        'delete hosted storage API upload rows',
        `DELETE FROM hosted.storage_api_upload_blocks
         WHERE subject_id = $1 AND object_id = $2`,
        [subjectId, objectId],
      );
      return {
        objectRows: deletedObject.rowCount ?? 0,
        uploadBlockRows: deletedBlocks.rowCount ?? 0,
        backupRows: nonnegativeInteger(backups.rows[0]?.count, 'storage API backup delete count'),
      };
    });
  }

  async putBackupLocator(
    input: PutHostedStorageBackupLocatorInput,
  ): Promise<PutHostedStorageBackupLocatorResult> {
    validateBackupLocator(input);
    return locked(this.context, 'put hosted storage backup locator', input.subjectId, async () => {
      if (!await this.getTenant(input.subjectId)) return { status: 'tenant_missing' };
      const existing = await query<BackupLocatorRow>(
        this.context,
        'get hosted storage backup locator',
        `SELECT ${BACKUP_LOCATOR_PROJECTION}
         FROM hosted.storage_backup_locators AS locators
         WHERE subject_id = $1 AND backup_id = $2`,
        [input.subjectId, input.backupId],
      );
      if (existing.rows[0]) {
        const locator = decodeBackupLocator(existing.rows[0]);
        const same = locator.formatVersion === input.formatVersion
          && locator.encryptedManifestHash === input.encryptedManifestHash
          && locator.createdAt === new Date(input.createdAt).toISOString()
          && locator.manifestObjectId === input.manifestObjectId;
        return same ? { status: 'replayed', locator } : { status: 'conflict' };
      }
      const manifest = await this.getApiObject(input.subjectId, input.manifestObjectId);
      if (!manifest || manifest.ciphertextHash !== input.encryptedManifestHash) {
        return { status: 'manifest_object_missing' };
      }
      const inserted = await query<BackupLocatorRow>(
        this.context,
        'insert hosted storage backup locator',
        `INSERT INTO hosted.storage_backup_locators AS locators (
           subject_id, backup_id, format_version, encrypted_manifest_hash,
           created_at, manifest_object_id
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${BACKUP_LOCATOR_PROJECTION}`,
        [
          input.subjectId,
          input.backupId,
          input.formatVersion,
          input.encryptedManifestHash,
          input.createdAt,
          input.manifestObjectId,
        ],
      );
      return { status: 'inserted', locator: decodeBackupLocator(inserted.rows[0]!) };
    });
  }

  async listBackupLocators(input: {
    subjectId: string;
    after?: HostedStorageBackupCursor;
    limit: number;
  }): Promise<HostedStoragePage<HostedStorageBackupLocator, HostedStorageBackupCursor>> {
    assertId('Storage subject id', input.subjectId, 256);
    assertLimit(input.limit);
    if (input.after) {
      timestamp(input.after.createdAt, 'backup cursor created_at');
      assertApiId('Backup cursor id', input.after.backupId);
    }
    return available('list hosted storage backup locators', async () => {
      const result = await query<BackupLocatorRow & { cursor_created_at?: unknown }>(
        this.context,
        'list hosted storage backup locators',
        `SELECT ${BACKUP_LOCATOR_PROJECTION},
           to_char(
             locators.created_at AT TIME ZONE 'UTC',
             'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
           ) AS cursor_created_at
         FROM hosted.storage_backup_locators AS locators
         WHERE subject_id = $1
           AND ($2::timestamptz IS NULL OR (created_at, backup_id) > ($2, $3))
         ORDER BY created_at, backup_id
         LIMIT $4`,
        [input.subjectId, input.after?.createdAt ?? null, input.after?.backupId ?? null, input.limit + 1],
      );
      const locators = result.rows.map(decodeBackupLocator);
      const items = locators.slice(0, input.limit);
      const last = items.at(-1);
      const lastRow = result.rows[items.length - 1];
      return {
        items,
        nextCursor: locators.length > input.limit && last && lastRow
          ? {
            createdAt: cursorTimestamp(lastRow.cursor_created_at, 'backup locator created_at'),
            backupId: last.backupId,
          }
          : null,
      };
    });
  }

  async deleteApiTenant(subjectId: string): Promise<HostedStorageApiTenantDeleteResult> {
    assertId('Storage subject id', subjectId, 256);
    return locked(this.context, 'delete hosted storage API tenant', subjectId, async () => {
      const counts = await query<ApiDeleteCountRow>(
        this.context,
        'delete hosted storage API tenant rows',
        'SELECT * FROM hosted.delete_storage_api_tenant($1)',
        [subjectId],
      );
      const row = counts.rows[0]!;
      const result: HostedStorageApiTenantDeleteResult = {
        tenantRows: nonnegativeInteger(row.tenant_rows, 'storage tenant delete count'),
        policyRows: nonnegativeInteger(row.policy_rows, 'storage policy delete count'),
        objectRows: nonnegativeInteger(row.object_rows, 'storage API object delete count'),
        uploadBlockRows: nonnegativeInteger(row.upload_block_rows, 'storage API upload delete count'),
        backupRows: nonnegativeInteger(row.backup_rows, 'storage backup delete count'),
        storageObjectRows: nonnegativeInteger(row.storage_object_rows, 'storage object delete count'),
        reservationRows: nonnegativeInteger(row.reservation_rows, 'storage reservation delete count'),
        seederManifestRows: nonnegativeInteger(row.seeder_manifest_rows, 'storage manifest delete count'),
      };
      return result;
    });
  }

  private async isExpired(reservationId: string): Promise<boolean> {
    const result = await query<QueryResultRow>(
      this.context,
      'check hosted storage reservation expiry',
      `SELECT 1
       FROM hosted.storage_reservations
       WHERE reservation_id = $1 AND expires_at <= clock_timestamp()`,
      [reservationId],
    );
    return result.rowCount === 1;
  }

  private async expireOne(reservationId: string): Promise<HostedStorageReservation | null> {
    const result = await query<ReservationRow>(
      this.context,
      'expire hosted storage reservation',
      `WITH expired AS (
         UPDATE hosted.storage_reservations AS reservations
         SET state = 'expired', released_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE reservation_id = $1 AND state IN ('reserved', 'staged')
           AND expires_at <= clock_timestamp()
         RETURNING reservations.*
       ), tenant_update AS (
         UPDATE hosted.storage_tenants AS tenants
         SET reserved_bytes = tenants.reserved_bytes - expired.size_bytes,
             lifecycle_version = tenants.lifecycle_version + 1,
             updated_at = clock_timestamp()
         FROM expired
         WHERE tenants.subject_id = expired.subject_id
         RETURNING tenants.subject_id
       )
       SELECT ${RESERVATION_PROJECTION.replaceAll('reservations.', 'expired.')}
       FROM expired
       JOIN tenant_update USING (subject_id)`,
      [reservationId],
    );
    return result.rows[0] ? decodeReservation(result.rows[0]) : null;
  }

  private async expireSubject(subjectId: string): Promise<void> {
    await query(
      this.context,
      'expire hosted storage reservations for tenant',
      `WITH expired AS (
         UPDATE hosted.storage_reservations
         SET state = 'expired', released_at = clock_timestamp(),
             lifecycle_version = lifecycle_version + 1,
             updated_at = clock_timestamp()
         WHERE subject_id = $1 AND state IN ('reserved', 'staged')
           AND expires_at <= clock_timestamp()
         RETURNING size_bytes
       )
       UPDATE hosted.storage_tenants
       SET reserved_bytes = reserved_bytes - COALESCE((SELECT sum(size_bytes) FROM expired), 0),
           lifecycle_version = lifecycle_version
             + CASE WHEN EXISTS (SELECT 1 FROM expired) THEN 1 ELSE 0 END,
           updated_at = CASE WHEN EXISTS (SELECT 1 FROM expired)
             THEN clock_timestamp() ELSE updated_at END
       WHERE subject_id = $1`,
      [subjectId],
    );
  }

  private reservationCreatedPage(
    rows: ReservationRow[],
    limit: number,
  ): HostedStoragePage<HostedStorageReservation, HostedStorageReservationCursor> {
    const reservations = rows.map(decodeReservation);
    const items = reservations.slice(0, limit);
    const last = items.at(-1);
    const lastRow = rows[items.length - 1];
    return {
      items,
      nextCursor: reservations.length > limit && last && lastRow
        ? {
          createdAt: cursorTimestamp(lastRow.cursor_created_at, 'reservation created_at'),
          reservationId: last.reservationId,
        }
        : null,
    };
  }

  private reservationExpiryPage(
    rows: ReservationRow[],
    limit: number,
  ): HostedStoragePage<HostedStorageReservation, HostedStorageReconciliationCursor> {
    const reservations = rows.map(decodeReservation);
    const items = reservations.slice(0, limit);
    const last = items.at(-1);
    const lastRow = rows[items.length - 1];
    return {
      items,
      nextCursor: reservations.length > limit && last && lastRow
        ? {
          expiresAt: cursorTimestamp(lastRow.cursor_expires_at, 'reservation expires_at'),
          reservationId: last.reservationId,
        }
        : null,
    };
  }
}
