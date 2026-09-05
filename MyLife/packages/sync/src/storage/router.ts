import type { DatabaseAdapter } from '@mylife/db';
import { sha256Bytes, sha256Hex } from '../encryption/sha256';
import { md5Hex } from '../encryption/md5';
import { sha512Hex } from '../node/hkdf';
import {
  assertNotSecretLike,
  checkpointStorageRouterState,
  getStorageBackup,
  getStorageDestination,
  getStorageHealth,
  getStorageJob,
  getStorageObject,
  getStoragePolicy,
  insertStorageBackup,
  insertStorageDestination,
  insertStorageJob,
  insertStoragePolicy,
  listStorageDestinations,
  listStorageJobs,
  listStorageObjects,
  updateStorageBackupState,
  updateStorageBackupManifestRef,
  updateStorageDestinationState,
  updateStorageJob,
  updateStoragePolicy,
  upsertStorageHealth,
  upsertStorageObject,
  type StorageDestinationRow,
  type StorageDestinationState,
  type StorageHealthRow,
  type StorageJobKind,
  type StorageJobRow,
  type StorageObjectRow,
  type StorageObjectState,
  type StoragePolicyRow,
  type StorageRouterCheckpoint,
} from './schema';
import {
  STORAGE_MANIFEST_OBJECT_ID,
  reduceStorageJob,
  type StorageJob,
  type StorageJobEvent,
} from './job-reducer';
import {
  StorageAdapterError,
  type EncryptedStorageObject,
  type StorageCapabilities,
  type StorageDestinationAdapter,
  type StorageResumeToken,
  type StorageWriteResult,
  type VerifiedStorageEvidence,
} from './types';
import { bytesToBase64 } from './adapters/http';

const HASH_PATTERN = /^[a-f0-9]{128}$/;
const DEFAULT_HEALTH_MAX_AGE_MS = 30_000;
const TERMINAL_JOB_STATES = new Set<StorageJobRow['state']>([
  'cancelled',
  'succeeded',
  'partial',
  'failed',
]);

export type PersonalStorageDataClass =
  | 'encrypted_recovery_bundle'
  | 'sqlite_snapshot'
  | 'attachment'
  | 'library_object'
  | 'backup_metadata'
  | 'plaintext_download';

export type StoragePolicyRejectionReason =
  | 'device_private_keys_never_routable'
  | 'destination_credentials_never_routable'
  | 'published_content_uses_publication_policy'
  | 'unknown_data_class';

export type StorageRouterErrorCode =
  | 'destination_not_found'
  | 'destination_unavailable'
  | 'destination_not_ready'
  | 'ineligible_data_class'
  | 'invalid_policy'
  | 'invalid_job_input'
  | 'job_not_found'
  | 'job_context_unavailable'
  | 'job_already_running'
  | 'invalid_job_state'
  | 'quota_exceeded'
  | 'adapter_error';

export class StorageRouterError extends Error {
  readonly code: StorageRouterErrorCode;
  readonly destinationId?: string;
  readonly dataClass?: string;
  readonly rejectionReason?: StoragePolicyRejectionReason;
  readonly requiredBytes?: number;
  readonly availableBytes?: number;

  constructor(
    code: StorageRouterErrorCode,
    message: string,
    details: {
      destinationId?: string;
      dataClass?: string;
      rejectionReason?: StoragePolicyRejectionReason;
      requiredBytes?: number;
      availableBytes?: number;
    } = {},
  ) {
    super(message);
    this.name = 'StorageRouterError';
    this.code = code;
    this.destinationId = details.destinationId;
    this.dataClass = details.dataClass;
    this.rejectionReason = details.rejectionReason;
    this.requiredBytes = details.requiredBytes;
    this.availableBytes = details.availableBytes;
  }
}

/**
 * Ciphertext-only router input. Callers encrypt private data before constructing
 * this value. The router never accepts plaintext private data and never encrypts.
 */
export type RouterEncryptedStorageObject = EncryptedStorageObject;

export type StorageRouterEvent =
  | {
      type: 'destination_registered';
      destinationId: string;
      state: StorageDestinationState;
    }
  | {
      type: 'destination_state_changed';
      destinationId: string;
      state: StorageDestinationState;
    }
  | { type: 'destination_unavailable'; destinationId: string }
  | {
      type: 'policy_changed';
      dataClass: string;
      primaryDestinationId: string;
      mirrorDestinationId: string | null;
    }
  | {
      type: 'job_planned';
      jobId: string;
      kind: StorageJobKind;
      destinationId: string;
      totalObjects: number;
      totalBytes: number;
    }
  | {
      type: 'job_transition';
      jobId: string;
      eventType: StorageJobEvent['type'];
      state: StorageJobRow['state'];
      completedObjects: number;
      totalObjects: number;
      completedBytes: number;
      totalBytes: number;
      errorCode: string | null;
    }
  | {
      type: 'object_state_changed';
      jobId: string;
      destinationId: string;
      objectId: string;
      state: StorageObjectState;
    }
  | {
      type: 'quota_exceeded';
      jobId: string;
      destinationId: string;
      requiredBytes: number;
      availableBytes: number | null;
    }
  | {
      type: 'health_checked';
      destinationId: string;
      state: StorageHealthRow['state'];
      verifiedReadWrite: boolean;
      usedBytes: number | null;
      capBytes: number | null;
      cached: boolean;
      errorCode: string | null;
    };

export interface StorageRouterDeps {
  db: DatabaseAdapter;
  adapters?: ReadonlyMap<string, StorageDestinationAdapter>;
  adapterResolver?: (destination: StorageDestinationRow) => StorageDestinationAdapter | null;
  resolveAdapter?: (destination: StorageDestinationRow) => StorageDestinationAdapter | null;
  now: () => string;
  random: () => string;
  onEvent?: (event: StorageRouterEvent) => void;
  healthMaxAgeMs?: number;
  maxAgeMs?: number;
  /** Durable ciphertext staging used by production backup jobs and crash recovery. */
  payloadStore?: StorageJobPayloadStore;
}

export interface StorageJobPayloadStore {
  put(jobId: string, object: RouterEncryptedStorageObject): Promise<void>;
  get(jobId: string, objectId: string): Promise<Uint8Array | null>;
  deleteJob(jobId: string): Promise<void>;
}

/** Ciphertext metadata whose bytes already live in a StorageJobPayloadStore. */
export type RouterStagedStorageObject = Omit<RouterEncryptedStorageObject, 'ciphertext'>;
export type RouterWriteStorageObject = RouterEncryptedStorageObject | RouterStagedStorageObject;

export interface RegisterStorageDestinationInput {
  id: string;
  kind: StorageDestinationRow['kind'];
  label: string;
  accountHint?: string | null;
  credentialRef?: string | null;
  rootRef?: string | null;
  state?: StorageDestinationState;
  capabilities: StorageCapabilities;
  createdAt?: string;
}

export interface SetStoragePolicyInput {
  dataClass: string;
  primaryDestinationId: string;
  mirrorDestinationId?: string | null;
  localCacheBytes: number;
  retention: Readonly<Record<string, unknown>> | string;
}

export interface StorageWriteJobPlan {
  jobId?: string;
  destinationId?: string;
  dataClass?: string;
  objects: readonly RouterWriteStorageObject[];
  manifest: RouterWriteStorageObject;
  /** Store namespace containing staged ciphertext. Defaults to jobId when supplied. */
  payloadSourceJobId?: string;
}

export interface StorageBackupJobPlan extends StorageWriteJobPlan {
  backupId?: string;
  schemaVersion: number;
}

export interface StorageMirrorJobPlan extends StorageBackupJobPlan {
  primaryDestinationId?: string;
}

export interface StorageMoveJobPlan extends StorageWriteJobPlan {
  sourceDestinationId: string;
  backupId?: string;
  schemaVersion?: number;
}

export interface StorageRepairJobPlan extends StorageWriteJobPlan {
  sourceDestinationId?: string;
  backupId?: string;
  schemaVersion?: number;
}

export interface StorageExistingJobPlan {
  jobId?: string;
  destinationId: string;
  objectIds?: readonly string[];
  manifestObjectId?: string;
  backupId?: string;
}

export interface StorageRestoreJobPlan extends StorageExistingJobPlan {
  /** Receives verified ciphertext for staging outside this pure coordinator. */
  onCiphertext?: (
    object: Readonly<StorageObjectRow>,
    ciphertext: Uint8Array,
  ) => void | Promise<void>;
  /** Optional platform-neutral verifier when provider metadata has no hash. */
  verifyCiphertext?: (
    object: Readonly<StorageObjectRow>,
    ciphertext: Uint8Array,
  ) => boolean | Promise<boolean>;
}

export interface StorageHealthCheckOptions {
  refresh?: boolean;
  force?: boolean;
}

export interface StorageDestinationRouter {
  getPolicy(dataClass: string): StoragePolicyRow | null;
  setPolicy(input: SetStoragePolicyInput | StoragePolicyRow): StoragePolicyRow;
  registerDestination(
    input: RegisterStorageDestinationInput | StorageDestinationRow,
  ): StorageDestinationRow;
  getDestination(destinationId: string): StorageDestinationRow | null;
  listDestinations(): StorageDestinationRow[];
  updateDestinationState(
    destinationId: string,
    state: StorageDestinationState,
  ): StorageDestinationRow;
  planBackupJob(input: StorageBackupJobPlan): StorageJob;
  planMirrorJob(input: StorageMirrorJobPlan): StorageJob;
  planVerifyJob(input: StorageExistingJobPlan): StorageJob;
  planRestoreJob(input: StorageRestoreJobPlan): StorageJob;
  planDeleteJob(input: StorageExistingJobPlan): StorageJob;
  planRepairJob(input: StorageRepairJobPlan): StorageJob;
  planMoveJob(input: StorageMoveJobPlan): StorageJob;
  getJob(jobId: string): StorageJob | null;
  listJobs(destinationId?: string): StorageJobRow[];
  pauseJob(jobId: string): StorageJob;
  resumeJob(jobId: string): StorageJob;
  cancelJob(jobId: string): StorageJob;
  runJob(jobId: string): Promise<StorageJob>;
  checkHealth(
    destinationId: string,
    options?: StorageHealthCheckOptions | boolean,
  ): Promise<StorageHealthRow>;
  canEvictLocalCopy(objectId: string, options?: { force?: boolean }): boolean;
}

type JobMode = 'write' | 'inspect' | 'restore' | 'delete';

interface JobTarget {
  logicalId: string;
  objectId: string;
  isManifest: boolean;
  encryptedBytes: number;
  ciphertextHash: string;
  dataClass: string;
  object: RouterEncryptedStorageObject | null;
}

interface TrackedBackup {
  backupId: string;
  destinationId: string;
  successState: 'complete' | 'deleted';
}

interface RouterJobContext {
  job: StorageJob;
  mode: JobMode;
  targets: readonly JobTarget[];
  nextTargetIndex: number;
  uploadedBytes: Map<string, number>;
  resumeTokens: Map<string, StorageResumeToken>;
  evidence: Map<string, VerifiedStorageEvidence>;
  failedObjectIds: Set<string>;
  backup: TrackedBackup | null;
  moveSourceDestinationId: string | null;
  payloadSourceJobId: string | null;
  onCiphertext?: StorageRestoreJobPlan['onCiphertext'];
  verifyCiphertext?: StorageRestoreJobPlan['verifyCiphertext'];
}

interface PersistedRouterCursor {
  version: 1 | 2;
  phase: StorageJob['phase'];
  nextTargetIndex: number;
  requiredObjectIds: readonly string[];
  verifiedObjects: StorageJob['verified_objects'];
  pendingEvidence?: readonly [string, VerifiedStorageEvidence][];
  manifestVerification: StorageJob['manifest_verification'];
  uploadedBytes: readonly [string, number][];
  resumeTokens: readonly [string, StorageResumeToken][];
  failedObjectIds: readonly string[];
  missingObjectIds: readonly string[];
  manifestObjectId: string;
  backupId: string | null;
  moveSourceDestinationId: string | null;
  payloadSourceJobId?: string | null;
}

const DATA_CLASS_ALIASES: Readonly<Record<string, PersonalStorageDataClass>> = {
  encrypted_recovery_bundle: 'encrypted_recovery_bundle',
  recovery_bundle: 'encrypted_recovery_bundle',
  sqlite_app_snapshot: 'sqlite_snapshot',
  sqlite_snapshot: 'sqlite_snapshot',
  database: 'sqlite_snapshot',
  database_snapshot: 'sqlite_snapshot',
  attachment: 'attachment',
  attachments: 'attachment',
  library_object: 'library_object',
  library_objects: 'library_object',
  attachment_library_object: 'library_object',
  backup_metadata: 'backup_metadata',
  backup_locator: 'backup_metadata',
  plaintext_download: 'plaintext_download',
  plaintext_downloads: 'plaintext_download',
};

const REJECTED_DATA_CLASSES: Readonly<Record<string, StoragePolicyRejectionReason>> = {
  device_private_key: 'device_private_keys_never_routable',
  device_private_keys: 'device_private_keys_never_routable',
  identity_private_key: 'device_private_keys_never_routable',
  private_key: 'device_private_keys_never_routable',
  destination_credential: 'destination_credentials_never_routable',
  destination_credentials: 'destination_credentials_never_routable',
  credential: 'destination_credentials_never_routable',
  credentials: 'destination_credentials_never_routable',
  published_blob: 'published_content_uses_publication_policy',
  published_blobs: 'published_content_uses_publication_policy',
  public_publication: 'published_content_uses_publication_policy',
  public_publication_bytes: 'published_content_uses_publication_policy',
  publication: 'published_content_uses_publication_policy',
};

function normalizeDataClass(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function classifyDataClass(dataClass: string): PersonalStorageDataClass {
  const normalized = normalizeDataClass(dataClass);
  const rejectionReason = REJECTED_DATA_CLASSES[normalized];
  if (rejectionReason !== undefined) {
    throw new StorageRouterError(
      'ineligible_data_class',
      'this data class cannot use personal storage destinations',
      { dataClass, rejectionReason },
    );
  }
  const canonical = DATA_CLASS_ALIASES[normalized];
  if (canonical === undefined) {
    throw new StorageRouterError(
      'ineligible_data_class',
      'the storage data class is not recognized',
      { dataClass, rejectionReason: 'unknown_data_class' },
    );
  }
  return canonical;
}

function checkedAdd(left: number, right: number, label: string): number {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new StorageRouterError('invalid_job_input', `${label} exceeds the safe integer range`);
  }
  return value;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function validateCapabilities(value: StorageCapabilities): void {
  const flags = [
    value.backgroundWrite,
    value.resumableUpload,
    value.list,
    value.delete,
    value.quota,
    value.serverChecksum,
  ];
  if (
    flags.some((flag) => typeof flag !== 'boolean')
    || !Number.isSafeInteger(value.maximumObjectBytes)
    || value.maximumObjectBytes <= 0
  ) {
    throw new StorageRouterError('invalid_job_input', 'destination capabilities are malformed');
  }
}

function validateEncryptedObject(
  object: RouterWriteStorageObject,
  allowManifestClass = false,
): void {
  if (
    object.objectId.trim().length === 0
    || !Number.isSafeInteger(object.encryptedBytes)
    || object.encryptedBytes <= 0
    || !HASH_PATTERN.test(object.ciphertextHash)
  ) {
    throw new StorageRouterError('invalid_job_input', 'encrypted storage object is malformed');
  }
  if ('ciphertext' in object && (
    !(object.ciphertext instanceof Uint8Array)
    || object.encryptedBytes !== object.ciphertext.length
  )) {
    throw new StorageRouterError('invalid_job_input', 'encrypted storage object is malformed');
  }
  if (!(allowManifestClass && normalizeDataClass(object.dataClass) === 'backup_manifest')) {
    classifyDataClass(object.dataClass);
  }
}

function normalizeAdapterError(error: unknown): StorageAdapterError {
  if (error instanceof StorageAdapterError) return error;
  return new StorageAdapterError('provider_error', 'storage adapter operation failed', false);
}

function strongWriteEvidence(
  result: Extract<StorageWriteResult, { complete: true }>,
  expectedHash: string,
  ciphertext: Uint8Array,
): VerifiedStorageEvidence | null {
  if (!result.verified) return null;
  if (result.verification.kind === 'read_back') {
    if (result.verification.ciphertextHash !== expectedHash) {
      throw new StorageAdapterError('corrupt_ciphertext', 'read-back hash does not match ciphertext', false);
    }
    return result.verification;
  }
  const algorithm = result.verification.algorithm.toLowerCase().replace(/-/g, '');
  const value = result.verification.value.trim();
  const sha512Matches = algorithm === 'sha512' && value.toLowerCase() === expectedHash;
  const sha256Matches = algorithm === 'sha256'
    && (
      value.toLowerCase() === sha256Hex(ciphertext)
      || value === bytesToBase64(sha256Bytes(ciphertext))
    );
  const md5Matches = algorithm === 'md5' && value.toLowerCase() === md5Hex(ciphertext);
  if (!sha512Matches && !sha256Matches && !md5Matches) {
    throw new StorageAdapterError('corrupt_ciphertext', 'provider checksum cannot verify ciphertext', false);
  }
  return result.verification;
}

function isFresh(checkedAt: string, now: string, maxAgeMs: number): boolean {
  const checked = Date.parse(checkedAt);
  const current = Date.parse(now);
  return Number.isFinite(checked)
    && Number.isFinite(current)
    && current >= checked
    && current - checked <= maxAgeMs;
}

class StorageDestinationRouterImpl implements StorageDestinationRouter {
  private readonly db: DatabaseAdapter;
  private readonly adapters?: ReadonlyMap<string, StorageDestinationAdapter>;
  private readonly adapterResolver?: StorageRouterDeps['adapterResolver'];
  private readonly now: () => string;
  private readonly random: () => string;
  private readonly onEvent?: StorageRouterDeps['onEvent'];
  private readonly healthMaxAgeMs: number;
  private readonly payloadStore?: StorageJobPayloadStore;
  private readonly jobContexts = new Map<string, RouterJobContext>();
  private readonly runningJobs = new Set<string>();

  constructor(deps: StorageRouterDeps) {
    if (deps.adapters === undefined && deps.adapterResolver === undefined && deps.resolveAdapter === undefined) {
      throw new StorageRouterError('destination_unavailable', 'an adapter map or resolver is required');
    }
    const healthMaxAgeMs = deps.healthMaxAgeMs ?? deps.maxAgeMs ?? DEFAULT_HEALTH_MAX_AGE_MS;
    if (!Number.isSafeInteger(healthMaxAgeMs) || healthMaxAgeMs < 0) {
      throw new StorageRouterError('invalid_job_input', 'health maxAgeMs must be a non-negative integer');
    }
    this.db = deps.db;
    this.adapters = deps.adapters;
    this.adapterResolver = deps.adapterResolver ?? deps.resolveAdapter;
    this.now = deps.now;
    this.random = deps.random;
    this.onEvent = deps.onEvent;
    this.healthMaxAgeMs = healthMaxAgeMs;
    this.payloadStore = deps.payloadStore;
    this.reconcilePersistedCheckpoints();
  }

  getPolicy(dataClass: string): StoragePolicyRow | null {
    const canonical = classifyDataClass(dataClass);
    return getStoragePolicy(this.db, canonical);
  }

  setPolicy(input: SetStoragePolicyInput | StoragePolicyRow): StoragePolicyRow {
    const normalized = this.normalizePolicy(input);
    const canonical = classifyDataClass(normalized.data_class);
    const policy = { ...normalized, data_class: canonical };
    const primary = this.requireDestinationForNewWrite(policy.primary_destination_id);
    if (
      canonical === 'plaintext_download'
      && primary.kind !== 'file_provider'
    ) {
      throw new StorageRouterError(
        'invalid_policy',
        'plaintext downloads require an explicit file-provider destination',
        { destinationId: primary.id, dataClass: policy.data_class },
      );
    }
    if (policy.mirror_destination_id !== null) {
      if (policy.mirror_destination_id === policy.primary_destination_id) {
        throw new StorageRouterError('invalid_policy', 'primary and mirror destinations must differ');
      }
      if (canonical === 'plaintext_download') {
        throw new StorageRouterError(
          'invalid_policy',
          'plaintext downloads are explicit actions and cannot use a mirror policy',
          { dataClass: policy.data_class },
        );
      }
      this.requireDestinationForNewWrite(policy.mirror_destination_id);
    }
    if (!Number.isSafeInteger(policy.local_cache_bytes) || policy.local_cache_bytes < 0) {
      throw new StorageRouterError('invalid_policy', 'local cache bytes must be a non-negative integer');
    }
    if (getStoragePolicy(this.db, policy.data_class) === null) {
      insertStoragePolicy(this.db, policy);
    } else {
      updateStoragePolicy(this.db, policy);
    }
    this.emit({
      type: 'policy_changed',
      dataClass: policy.data_class,
      primaryDestinationId: policy.primary_destination_id,
      mirrorDestinationId: policy.mirror_destination_id,
    });
    return policy;
  }

  registerDestination(
    input: RegisterStorageDestinationInput | StorageDestinationRow,
  ): StorageDestinationRow {
    const row = this.normalizeDestination(input);
    if (getStorageDestination(this.db, row.id) !== null) {
      throw new StorageRouterError('invalid_job_input', 'destination id is already registered', {
        destinationId: row.id,
      });
    }
    const adapterAvailable = this.resolveDestinationAdapter(row) !== null;
    const persisted = adapterAvailable ? row : { ...row, state: 'error' as const };
    insertStorageDestination(this.db, persisted);
    this.emit({
      type: 'destination_registered',
      destinationId: persisted.id,
      state: persisted.state,
    });
    if (!adapterAvailable) this.emit({ type: 'destination_unavailable', destinationId: row.id });
    return persisted;
  }

  getDestination(destinationId: string): StorageDestinationRow | null {
    return getStorageDestination(this.db, destinationId);
  }

  listDestinations(): StorageDestinationRow[] {
    return listStorageDestinations(this.db);
  }

  updateDestinationState(
    destinationId: string,
    state: StorageDestinationState,
  ): StorageDestinationRow {
    const destination = this.requireDestination(destinationId);
    if (state === 'ready' && this.resolveDestinationAdapter(destination) === null) {
      updateStorageDestinationState(this.db, destinationId, 'error', this.now());
      this.emit({ type: 'destination_unavailable', destinationId });
      throw new StorageRouterError(
        'destination_unavailable',
        'this platform cannot serve the destination kind',
        { destinationId },
      );
    }
    const updatedAt = this.now();
    updateStorageDestinationState(this.db, destinationId, state, updatedAt);
    this.emit({ type: 'destination_state_changed', destinationId, state });
    return { ...destination, state, updated_at: updatedAt };
  }

  planBackupJob(input: StorageBackupJobPlan): StorageJob {
    const destinationId = this.resolvePlannedDestination(input, 'primary');
    const backupId = input.backupId ?? this.allocateId('storage-backup');
    return this.jobSnapshot(this.createWriteJob('backup', destinationId, input, {
      backupId,
      schemaVersion: input.schemaVersion,
    }));
  }

  planMirrorJob(input: StorageMirrorJobPlan): StorageJob {
    const destinationId = this.resolvePlannedDestination(input, 'mirror');
    if (input.primaryDestinationId !== undefined) {
      this.assertVerifiedSource(input.primaryDestinationId, input.objects, input.manifest);
    }
    const backupId = input.backupId ?? this.allocateId('storage-backup');
    return this.jobSnapshot(this.createWriteJob('mirror', destinationId, input, {
      backupId,
      schemaVersion: input.schemaVersion,
    }));
  }

  planVerifyJob(input: StorageExistingJobPlan): StorageJob {
    return this.jobSnapshot(this.createExistingJob('verify', 'inspect', input));
  }

  planRestoreJob(input: StorageRestoreJobPlan): StorageJob {
    const job = this.createExistingJob('restore', 'restore', input);
    const context = this.requireJobContext(job.id);
    context.onCiphertext = input.onCiphertext;
    context.verifyCiphertext = input.verifyCiphertext;
    this.persistContext(context);
    return this.jobSnapshot(context.job);
  }

  planDeleteJob(input: StorageExistingJobPlan): StorageJob {
    return this.jobSnapshot(this.createExistingJob('delete', 'delete', input));
  }

  planRepairJob(input: StorageRepairJobPlan): StorageJob {
    const destinationId = this.resolvePlannedDestination(input, 'primary');
    if (input.sourceDestinationId !== undefined) {
      this.assertVerifiedSource(input.sourceDestinationId, input.objects, input.manifest);
    }
    return this.jobSnapshot(this.createWriteJob(
      'repair',
      destinationId,
      input,
      input.backupId === undefined || input.schemaVersion === undefined
        ? null
        : { backupId: input.backupId, schemaVersion: input.schemaVersion },
    ));
  }

  planMoveJob(input: StorageMoveJobPlan): StorageJob {
    const destinationId = this.resolvePlannedDestination(input, 'primary');
    if (destinationId === input.sourceDestinationId) {
      throw new StorageRouterError('invalid_job_input', 'move source and destination must differ');
    }
    this.assertVerifiedSource(input.sourceDestinationId, input.objects, input.manifest);
    const job = this.createWriteJob(
      'move',
      destinationId,
      input,
      input.backupId === undefined || input.schemaVersion === undefined
        ? null
        : { backupId: input.backupId, schemaVersion: input.schemaVersion },
    );
    const context = this.requireJobContext(job.id);
    context.moveSourceDestinationId = input.sourceDestinationId;
    this.persistContext(context);
    return this.jobSnapshot(context.job);
  }

  getJob(jobId: string): StorageJob | null {
    const context = this.jobContexts.get(jobId) ?? this.rehydrateJobContext(jobId);
    return context === null ? null : this.jobSnapshot(context.job);
  }

  listJobs(destinationId?: string): StorageJobRow[] {
    return listStorageJobs(this.db, destinationId);
  }

  pauseJob(jobId: string): StorageJob {
    const context = this.requireJobContext(jobId);
    if (context.job.state !== 'running') {
      throw new StorageRouterError('invalid_job_state', 'only a running job can be paused');
    }
    this.applyJobEvent(context, { type: 'pause', at: this.now() });
    return this.jobSnapshot(context.job);
  }

  resumeJob(jobId: string): StorageJob {
    const context = this.requireJobContext(jobId);
    if (context.job.state !== 'paused') {
      throw new StorageRouterError('invalid_job_state', 'only a paused job can be resumed');
    }
    this.applyJobEvent(context, { type: 'resume', at: this.now() });
    return this.jobSnapshot(context.job);
  }

  cancelJob(jobId: string): StorageJob {
    const context = this.requireJobContext(jobId);
    if (TERMINAL_JOB_STATES.has(context.job.state)) return this.jobSnapshot(context.job);
    this.applyJobEvent(context, { type: 'cancel', at: this.now() });
    return this.jobSnapshot(context.job);
  }

  async runJob(jobId: string): Promise<StorageJob> {
    const persisted = getStorageJob(this.db, jobId);
    if (persisted === null) {
      throw new StorageRouterError('job_not_found', 'storage job was not found');
    }
    const context = this.jobContexts.get(jobId) ?? this.rehydrateJobContext(jobId);
    if (context === null) {
      throw new StorageRouterError(
        'job_context_unavailable',
        'job ciphertext or callback context must be reattached before running',
      );
    }
    if (this.runningJobs.has(jobId)) {
      throw new StorageRouterError('job_already_running', 'storage job is already running');
    }
    if (TERMINAL_JOB_STATES.has(context.job.state)) return this.jobSnapshot(context.job);

    this.runningJobs.add(jobId);
    try {
      const requestedControlState = persisted.state;
      if (requestedControlState === 'cancelled') {
        this.applyJobEvent(context, { type: 'cancel', at: this.now() });
        return this.jobSnapshot(context.job);
      }
      if (context.job.state === 'queued') {
        this.applyJobEvent(context, { type: 'start', at: this.now() });
      }
      if (requestedControlState === 'paused' && context.job.state === 'running') {
        this.applyJobEvent(
          context,
          { type: 'pause', at: this.now() },
          persisted.last_error_code,
        );
        return this.jobSnapshot(context.job);
      }
      if (this.honorControlFlags(context) || context.job.state !== 'running') {
        return this.jobSnapshot(context.job);
      }

      const destination = this.requireDestination(context.job.destination_id);
      if (!this.destinationCanContinue(destination, context)) return this.jobSnapshot(context.job);
      const adapter = this.resolveDestinationAdapter(destination);
      if (adapter === null) {
        this.emit({ type: 'destination_unavailable', destinationId: destination.id });
        this.pauseRunningJob(context, 'provider_error');
        return this.jobSnapshot(context.job);
      }

      if (context.mode === 'write') {
        const canWrite = await this.preflightQuota(context, adapter);
        if (!canWrite) return this.jobSnapshot(context.job);
        await this.runWriteTargets(context, adapter);
      } else if (context.mode === 'delete') {
        await this.runDeleteTargets(context, adapter);
      } else {
        await this.runInspectionTargets(context, adapter);
      }
      if (context.job.state === 'running' && context.job.phase === 'verifying') {
        await this.finalizeVerification(context);
      }
      return this.jobSnapshot(context.job);
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  async checkHealth(
    destinationId: string,
    options: StorageHealthCheckOptions | boolean = {},
  ): Promise<StorageHealthRow> {
    const refreshOptions = typeof options === 'boolean' ? { refresh: options } : options;
    const destination = this.requireDestination(destinationId);
    const checkedAt = this.now();
    const cached = getStorageHealth(this.db, destinationId);
    if (destination.state === 'revoked') {
      const revoked: StorageHealthRow = {
        destination_id: destinationId,
        state: 'revoked',
        used_bytes: null,
        cap_bytes: null,
        verified_read_write: 0,
        checked_at: checkedAt,
        error_code: 'revoked',
      };
      upsertStorageHealth(this.db, revoked);
      this.emitHealth(revoked, false);
      return revoked;
    }
    if (
      (destination.state === 'ready' || destination.state === 'degraded')
      && !refreshOptions.refresh
      && !refreshOptions.force
      && cached !== null
      && isFresh(cached.checked_at, checkedAt, this.healthMaxAgeMs)
    ) {
      this.emitHealth(cached, true);
      return cached;
    }

    const adapter = this.resolveDestinationAdapter(destination);
    if (adapter === null) {
      const unavailable: StorageHealthRow = {
        destination_id: destinationId,
        state: 'unreachable',
        used_bytes: null,
        cap_bytes: null,
        verified_read_write: 0,
        checked_at: checkedAt,
        error_code: 'destination_unavailable',
      };
      upsertStorageHealth(this.db, unavailable);
      updateStorageDestinationState(this.db, destinationId, 'error', checkedAt);
      this.emit({ type: 'destination_unavailable', destinationId });
      this.emitHealth(unavailable, false);
      return unavailable;
    }

    let row: StorageHealthRow;
    try {
      const health = await adapter.health();
      const quota = health.state === 'ok' || health.state === 'degraded'
        ? await adapter.quota()
        : { usedBytes: null, capBytes: null, estimated: false };
      row = {
        destination_id: destinationId,
        state: health.state,
        used_bytes: quota.usedBytes,
        cap_bytes: quota.capBytes,
        verified_read_write:
          health.verifiedReadWrite && (health.state === 'ok' || health.state === 'degraded') ? 1 : 0,
        checked_at: checkedAt,
        error_code: health.errorCode ?? null,
      };
    } catch (error) {
      const adapterError = normalizeAdapterError(error);
      row = {
        destination_id: destinationId,
        state: adapterError.code === 'auth_required'
          ? 'auth_required'
          : adapterError.code === 'revoked'
            ? 'revoked'
            : 'unreachable',
        used_bytes: null,
        cap_bytes: null,
        verified_read_write: 0,
        checked_at: checkedAt,
        error_code: adapterError.code,
      };
    }
    upsertStorageHealth(this.db, row);
    this.persistHealthDestinationState(destination, row, checkedAt);
    this.emitHealth(row, false);
    return row;
  }

  canEvictLocalCopy(objectId: string, options: { force?: boolean } = {}): boolean {
    if (options.force === true) return true;
    const destinations = new Map(
      listStorageDestinations(this.db).map((destination) => [destination.id, destination]),
    );
    return listStorageObjects(this.db).some((object) => {
      if (object.object_id !== objectId || object.state !== 'verified') return false;
      const destination = destinations.get(object.destination_id);
      return destination !== undefined
        && destination.kind !== 'local_device'
        && destination.state !== 'revoked'
        && destination.state !== 'error';
    });
  }

  private normalizePolicy(input: SetStoragePolicyInput | StoragePolicyRow): StoragePolicyRow {
    if ('data_class' in input) {
      try {
        JSON.parse(input.retention_json) as unknown;
      } catch {
        throw new StorageRouterError('invalid_policy', 'retention must be valid JSON');
      }
      return { ...input, updated_at: this.now() };
    }
    let retentionJson: string;
    if (typeof input.retention === 'string') {
      try {
        JSON.parse(input.retention) as unknown;
      } catch {
        throw new StorageRouterError('invalid_policy', 'retention must be valid JSON');
      }
      retentionJson = input.retention;
    } else {
      retentionJson = JSON.stringify(input.retention);
    }
    return {
      data_class: input.dataClass,
      primary_destination_id: input.primaryDestinationId,
      mirror_destination_id: input.mirrorDestinationId ?? null,
      local_cache_bytes: input.localCacheBytes,
      retention_json: retentionJson,
      updated_at: this.now(),
    };
  }

  private normalizeDestination(
    input: RegisterStorageDestinationInput | StorageDestinationRow,
  ): StorageDestinationRow {
    if ('capability_json' in input) {
      if (input.credential_ref !== null) assertNotSecretLike(input.credential_ref);
      let parsed: unknown;
      try {
        parsed = JSON.parse(input.capability_json) as unknown;
      } catch {
        throw new StorageRouterError('invalid_job_input', 'destination capabilities are not valid JSON');
      }
      if (typeof parsed !== 'object' || parsed === null) {
        throw new StorageRouterError('invalid_job_input', 'destination capabilities are malformed');
      }
      return input;
    }
    validateCapabilities(input.capabilities);
    if (input.credentialRef !== undefined && input.credentialRef !== null) {
      assertNotSecretLike(input.credentialRef);
    }
    if (input.id.trim().length === 0 || input.label.trim().length === 0) {
      throw new StorageRouterError('invalid_job_input', 'destination id and label are required');
    }
    const timestamp = input.createdAt ?? this.now();
    return {
      id: input.id,
      kind: input.kind,
      label: input.label,
      account_hint: input.accountHint ?? null,
      credential_ref: input.credentialRef ?? null,
      root_ref: input.rootRef ?? null,
      state: input.state ?? 'authorizing',
      capability_json: JSON.stringify(input.capabilities),
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  private resolvePlannedDestination(
    input: StorageWriteJobPlan,
    leg: 'primary' | 'mirror',
  ): string {
    if (input.destinationId !== undefined) {
      this.requireDestinationForNewWrite(input.destinationId);
      return input.destinationId;
    }
    const dataClass = input.dataClass ?? input.objects[0]?.dataClass;
    if (dataClass === undefined) {
      throw new StorageRouterError(
        'invalid_job_input',
        'a policy data class is required when destinationId is omitted',
      );
    }
    const canonical = classifyDataClass(dataClass);
    const policy = getStoragePolicy(this.db, canonical);
    if (policy === null) {
      throw new StorageRouterError('invalid_policy', 'no storage policy exists for the data class', {
        dataClass,
      });
    }
    const destinationId = leg === 'primary'
      ? policy.primary_destination_id
      : policy.mirror_destination_id;
    if (destinationId === null) {
      throw new StorageRouterError('invalid_policy', 'the storage policy has no mirror destination', {
        dataClass,
      });
    }
    this.requireDestinationForNewWrite(destinationId);
    return destinationId;
  }

  private createWriteJob(
    kind: Extract<StorageJobKind, 'backup' | 'mirror' | 'move' | 'repair'>,
    destinationId: string,
    input: StorageWriteJobPlan,
    backupInput: { backupId: string; schemaVersion: number } | null,
  ): StorageJob {
    const destination = this.requireDestinationForNewWrite(destinationId);
    validateEncryptedObject(input.manifest, true);
    const hasStagedPayload = !('ciphertext' in input.manifest)
      || input.objects.some((object) => !('ciphertext' in object));
    if (hasStagedPayload && this.payloadStore === undefined) {
      throw new StorageRouterError('invalid_job_input', 'staged ciphertext requires a payload store');
    }
    const seen = new Set<string>();
    let totalBytes = input.manifest.encryptedBytes;
    const objectTargets: JobTarget[] = [];
    for (const object of input.objects) {
      validateEncryptedObject(object);
      const canonical = classifyDataClass(object.dataClass);
      if (
        canonical === 'plaintext_download'
        && (destination.kind !== 'file_provider' || kind === 'mirror')
      ) {
        throw new StorageRouterError(
          'invalid_policy',
          'plaintext downloads require an explicit, non-mirrored file-provider destination',
          { destinationId, dataClass: canonical },
        );
      }
      if (
        object.objectId === STORAGE_MANIFEST_OBJECT_ID
        || object.objectId === input.manifest.objectId
        || seen.has(object.objectId)
      ) {
        throw new StorageRouterError('invalid_job_input', 'job object ids must be unique');
      }
      seen.add(object.objectId);
      totalBytes = checkedAdd(totalBytes, object.encryptedBytes, 'job total bytes');
      objectTargets.push(this.writeTarget(object, false));
    }
    const targets = [...objectTargets, this.writeTarget(input.manifest, true)];
    const jobId = input.jobId ?? this.allocateId('storage-job');
    this.assertUnusedJobId(jobId);
    const payloadSourceJobId = input.payloadSourceJobId ?? (hasStagedPayload ? jobId : null);
    if (hasStagedPayload && (payloadSourceJobId === null || payloadSourceJobId.trim().length === 0)) {
      throw new StorageRouterError('invalid_job_input', 'staged ciphertext requires a payload source job id');
    }
    const now = this.now();
    const job: StorageJob = {
      id: jobId,
      kind,
      destination_id: destinationId,
      state: 'queued',
      cursor_json: null,
      total_objects: objectTargets.length,
      completed_objects: 0,
      total_bytes: totalBytes,
      completed_bytes: 0,
      attempts: 0,
      last_error_code: null,
      created_at: now,
      updated_at: now,
      phase: null,
      required_object_ids: objectTargets.map((target) => target.logicalId),
      verified_objects: [],
      manifest_verification: null,
    };
    const context = this.createContext(job, 'write', targets, backupInput === null ? null : {
      backupId: backupInput.backupId,
      destinationId,
      successState: 'complete',
    });
    context.payloadSourceJobId = payloadSourceJobId;
    job.cursor_json = this.serializeCursor(context);

    this.db.transaction(() => {
      for (const target of targets) {
        upsertStorageObject(this.db, {
          object_id: target.objectId,
          destination_id: destinationId,
          data_class: target.isManifest ? 'backup_manifest' : target.dataClass,
          ciphertext_hash: target.ciphertextHash,
          plaintext_hash_encrypted: null,
          encrypted_bytes: target.encryptedBytes,
          remote_ref: null,
          remote_version: null,
          state: 'queued',
          last_verified_at: null,
        });
      }
      insertStorageJob(this.db, job);
      if (backupInput !== null) {
        if (getStorageBackup(this.db, backupInput.backupId, destinationId) !== null) {
          throw new StorageRouterError('invalid_job_input', 'backup already exists at destination');
        }
        insertStorageBackup(this.db, {
          backup_id: backupInput.backupId,
          destination_id: destinationId,
          manifest_ref: input.manifest.objectId,
          manifest_ciphertext_hash: input.manifest.ciphertextHash,
          schema_version: backupInput.schemaVersion,
          object_count: objectTargets.length,
          encrypted_bytes: totalBytes,
          state: 'writing',
          completed_at: null,
        });
      }
    });
    this.jobContexts.set(jobId, context);
    this.emitJobPlanned(job);
    return context.job;
  }

  private createExistingJob(
    kind: Extract<StorageJobKind, 'verify' | 'restore' | 'delete'>,
    mode: Extract<JobMode, 'inspect' | 'restore' | 'delete'>,
    input: StorageExistingJobPlan,
  ): StorageJob {
    this.requireDestinationForNewWrite(input.destinationId);
    const allRows = listStorageObjects(this.db, input.destinationId)
      .filter((row) => row.state !== 'deleted');
    const manifestObjectId = input.manifestObjectId
      ?? allRows.find((row) => row.data_class === 'backup_manifest')?.object_id
      ?? (allRows.some((row) => row.object_id === STORAGE_MANIFEST_OBJECT_ID)
        ? STORAGE_MANIFEST_OBJECT_ID
        : undefined);
    if (manifestObjectId === undefined) {
      throw new StorageRouterError('invalid_job_input', 'job requires a tracked backup manifest');
    }
    const selectedIds = input.objectIds === undefined ? null : new Set(input.objectIds);
    if (selectedIds?.has(STORAGE_MANIFEST_OBJECT_ID)) selectedIds.delete(STORAGE_MANIFEST_OBJECT_ID);
    const manifestRow = allRows.find((row) => row.object_id === manifestObjectId);
    if (manifestRow === undefined) {
      throw new StorageRouterError('invalid_job_input', 'tracked backup manifest was not found');
    }
    const objectRows = allRows
      .filter((row) => row.object_id !== manifestObjectId)
      .filter((row) => selectedIds === null || selectedIds.has(row.object_id))
      .sort((left, right) => left.object_id.localeCompare(right.object_id));
    if (selectedIds !== null) {
      for (const objectId of selectedIds) {
        if (!objectRows.some((row) => row.object_id === objectId)) {
          throw new StorageRouterError('invalid_job_input', 'a requested storage object was not found');
        }
      }
    }
    let totalBytes = manifestRow.encrypted_bytes;
    for (const row of objectRows) {
      classifyDataClass(row.data_class);
      totalBytes = checkedAdd(totalBytes, row.encrypted_bytes, 'job total bytes');
    }
    const targets = [
      ...objectRows.map((row) => this.rowTarget(row, false)),
      this.rowTarget(manifestRow, true),
    ];
    const jobId = input.jobId ?? this.allocateId('storage-job');
    this.assertUnusedJobId(jobId);
    const now = this.now();
    const job: StorageJob = {
      id: jobId,
      kind,
      destination_id: input.destinationId,
      state: 'queued',
      cursor_json: null,
      total_objects: objectRows.length,
      completed_objects: 0,
      total_bytes: totalBytes,
      completed_bytes: 0,
      attempts: 0,
      last_error_code: null,
      created_at: now,
      updated_at: now,
      phase: null,
      required_object_ids: objectRows.map((row) => row.object_id),
      verified_objects: [],
      manifest_verification: null,
    };
    const existingBackup = input.backupId === undefined
      ? null
      : getStorageBackup(this.db, input.backupId, input.destinationId);
    if (input.backupId !== undefined && existingBackup === null) {
      throw new StorageRouterError('invalid_job_input', 'tracked backup was not found');
    }
    const context = this.createContext(job, mode, targets, existingBackup === null ? null : {
      backupId: existingBackup.backup_id,
      destinationId: existingBackup.destination_id,
      successState: kind === 'delete' ? 'deleted' : 'complete',
    });
    job.cursor_json = this.serializeCursor(context);
    insertStorageJob(this.db, job);
    this.jobContexts.set(jobId, context);
    this.emitJobPlanned(job);
    return context.job;
  }

  private createContext(
    job: StorageJob,
    mode: JobMode,
    targets: readonly JobTarget[],
    backup: TrackedBackup | null,
  ): RouterJobContext {
    return {
      job,
      mode,
      targets,
      nextTargetIndex: 0,
      uploadedBytes: new Map(),
      resumeTokens: new Map(),
      evidence: new Map(),
      failedObjectIds: new Set(),
      backup,
      moveSourceDestinationId: null,
      payloadSourceJobId: null,
    };
  }

  private writeTarget(object: RouterWriteStorageObject, isManifest: boolean): JobTarget {
    return {
      logicalId: isManifest ? STORAGE_MANIFEST_OBJECT_ID : object.objectId,
      objectId: object.objectId,
      isManifest,
      encryptedBytes: object.encryptedBytes,
      ciphertextHash: object.ciphertextHash,
      dataClass: object.dataClass,
      object: 'ciphertext' in object ? object : null,
    };
  }

  private rowTarget(row: StorageObjectRow, isManifest: boolean): JobTarget {
    return {
      logicalId: isManifest ? STORAGE_MANIFEST_OBJECT_ID : row.object_id,
      objectId: row.object_id,
      isManifest,
      encryptedBytes: row.encrypted_bytes,
      ciphertextHash: row.ciphertext_hash,
      dataClass: row.data_class,
      object: null,
    };
  }

  private async runWriteTargets(
    context: RouterJobContext,
    adapter: StorageDestinationAdapter,
  ): Promise<void> {
    while (context.nextTargetIndex < context.targets.length && context.job.state === 'running') {
      if (this.honorControlFlags(context)) return;
      const destination = this.requireDestination(context.job.destination_id);
      if (!this.destinationCanContinue(destination, context)) return;
      const target = context.targets[context.nextTargetIndex];
      if (target === undefined) {
        throw new StorageRouterError('job_context_unavailable', 'write job ciphertext is unavailable');
      }
      const object = await this.loadWriteObject(context, target);
      try {
        this.persistObjectState(context, target, 'writing');
        const priorBytes = context.uploadedBytes.get(target.logicalId) ?? 0;
        const resume = context.resumeTokens.get(target.logicalId);
        let result: StorageWriteResult;
        try {
          result = await adapter.putObject(object, resume);
          this.validateWriteResult(target, result, priorBytes);
        } catch (error) {
          const shouldContinue = await this.handleTargetError(
            context,
            target,
            normalizeAdapterError(error),
          );
          if (!shouldContinue) return;
          continue;
        }

        if (!result.complete) {
          const delta = result.encryptedBytes - priorBytes;
          context.uploadedBytes.set(target.logicalId, result.encryptedBytes);
          context.resumeTokens.set(target.logicalId, result.resumeToken);
          this.persistObjectState(context, target, 'writing', result.remoteRef, result.remoteVersion);
          this.applyJobEvent(context, {
            type: 'checkpoint',
            completed_objects: 0,
            completed_bytes: delta,
            cursor_json: this.serializeCursor(context),
            at: this.now(),
          });
          continue;
        }

        let evidence: VerifiedStorageEvidence | null;
        try {
          evidence = strongWriteEvidence(result, target.ciphertextHash, object.ciphertext);
        } catch (error) {
          const shouldContinue = await this.handleTargetError(
            context,
            target,
            normalizeAdapterError(error),
          );
          if (!shouldContinue) return;
          continue;
        }
        const delta = target.encryptedBytes - priorBytes;
        context.uploadedBytes.set(target.logicalId, target.encryptedBytes);
        context.resumeTokens.delete(target.logicalId);
        if (evidence !== null) context.evidence.set(target.logicalId, evidence);
        this.persistObjectState(context, target, 'verifying', result.remoteRef, result.remoteVersion);
        context.nextTargetIndex += 1;
        this.applyJobEvent(context, {
          type: 'checkpoint',
          completed_objects: target.isManifest ? 0 : 1,
          completed_bytes: delta,
          cursor_json: this.serializeCursor(context),
          at: this.now(),
        });
      } finally {
        if (target.object === null) object.ciphertext.fill(0);
      }
    }
    if (context.backup !== null && context.job.phase === 'verifying') {
      const backup = getStorageBackup(
        this.db,
        context.backup.backupId,
        context.backup.destinationId,
      );
      if (backup?.state !== 'corrupt') {
        updateStorageBackupState(
          this.db,
          context.backup.backupId,
          context.backup.destinationId,
          'verifying',
        );
      }
    }
  }

  private async runInspectionTargets(
    context: RouterJobContext,
    adapter: StorageDestinationAdapter,
  ): Promise<void> {
    while (context.nextTargetIndex < context.targets.length && context.job.state === 'running') {
      if (this.honorControlFlags(context)) return;
      const destination = this.requireDestination(context.job.destination_id);
      if (!this.destinationCanContinue(destination, context)) return;
      const target = context.targets[context.nextTargetIndex];
      if (target === undefined) break;
      let evidence: VerifiedStorageEvidence | null = null;
      try {
        const metadata = await adapter.headObject({ objectId: target.objectId });
        if (metadata === null) {
          this.persistObjectState(context, target, 'missing');
          context.failedObjectIds.add(target.logicalId);
        } else if (
          metadata.encryptedBytes !== target.encryptedBytes
          || (metadata.ciphertextHash !== null && metadata.ciphertextHash !== target.ciphertextHash)
        ) {
          this.persistObjectState(context, target, 'error');
          context.failedObjectIds.add(target.logicalId);
          this.markBackupCorrupt(context);
        } else if (metadata.ciphertextHash === target.ciphertextHash) {
          evidence = {
            kind: 'provider_checksum',
            algorithm: 'sha512',
            value: target.ciphertextHash,
          };
        }

        let ciphertext: Uint8Array | null = null;
        if (context.mode === 'restore' || evidence === null) {
          ciphertext = await adapter.getObject({ objectId: target.objectId, remoteRef: metadata?.remoteRef });
          if (ciphertext === null || ciphertext.length !== target.encryptedBytes) {
            evidence = null;
            context.failedObjectIds.add(target.logicalId);
            this.persistObjectState(context, target, ciphertext === null ? 'missing' : 'error');
          } else if (evidence === null) {
            const verified = target.object !== null
              ? bytesEqual(ciphertext, target.object.ciphertext)
              : await context.verifyCiphertext?.(
                this.requireObjectRow(context, target),
                ciphertext,
              ) ?? false;
            if (verified) {
              evidence = { kind: 'read_back', ciphertextHash: target.ciphertextHash };
            } else {
              context.failedObjectIds.add(target.logicalId);
            }
          }
        }
        if (evidence !== null) {
          context.evidence.set(target.logicalId, evidence);
          if (context.mode === 'restore' && ciphertext !== null && context.onCiphertext !== undefined) {
            await context.onCiphertext(this.requireObjectRow(context, target), ciphertext);
          }
        }
      } catch (error) {
        const shouldContinue = await this.handleTargetError(
          context,
          target,
          normalizeAdapterError(error),
        );
        if (!shouldContinue) return;
        continue;
      }
      context.nextTargetIndex += 1;
      this.applyJobEvent(context, {
        type: 'checkpoint',
        completed_objects: target.isManifest ? 0 : 1,
        completed_bytes: target.encryptedBytes,
        cursor_json: this.serializeCursor(context),
        at: this.now(),
      });
    }
  }

  private async runDeleteTargets(
    context: RouterJobContext,
    adapter: StorageDestinationAdapter,
  ): Promise<void> {
    while (context.nextTargetIndex < context.targets.length && context.job.state === 'running') {
      if (this.honorControlFlags(context)) return;
      const destination = this.requireDestination(context.job.destination_id);
      if (!this.destinationCanContinue(destination, context)) return;
      const target = context.targets[context.nextTargetIndex];
      if (target === undefined) break;
      try {
        this.persistObjectState(context, target, 'deleting');
        await adapter.deleteObject({ objectId: target.objectId });
        const remaining = await adapter.headObject({ objectId: target.objectId });
        if (remaining === null) {
          context.evidence.set(target.logicalId, {
            kind: 'provider_checksum',
            algorithm: 'remote-absence',
            value: target.objectId,
          });
          this.persistObjectState(context, target, 'deleted');
        } else {
          context.failedObjectIds.add(target.logicalId);
          this.persistObjectState(context, target, 'error');
        }
      } catch (error) {
        const shouldContinue = await this.handleTargetError(
          context,
          target,
          normalizeAdapterError(error),
        );
        if (!shouldContinue) return;
        continue;
      }
      context.nextTargetIndex += 1;
      this.applyJobEvent(context, {
        type: 'checkpoint',
        completed_objects: target.isManifest ? 0 : 1,
        completed_bytes: target.encryptedBytes,
        cursor_json: this.serializeCursor(context),
        at: this.now(),
      });
    }
  }

  private async finalizeVerification(context: RouterJobContext): Promise<void> {
    for (const target of context.targets) {
      const evidence = context.evidence.get(target.logicalId);
      if (evidence === undefined) continue;
      const alreadyVerified = target.isManifest
        ? context.job.manifest_verification !== null
        : context.job.verified_objects.some((item) => item.object_id === target.logicalId);
      if (alreadyVerified) continue;
      const verifiedAt = this.now();
      const event: StorageJobEvent = target.isManifest
        ? { type: 'verify_pass', target: { kind: 'manifest' }, verification: evidence, at: verifiedAt }
        : {
            type: 'verify_pass',
            target: { kind: 'object', object_id: target.logicalId },
            verification: evidence,
            at: verifiedAt,
          };
      const objects = context.mode === 'delete'
        ? []
        : [this.storageObjectRow(context, target, 'verified', undefined, undefined, verifiedAt)];
      this.applyJobEvent(context, event, undefined, { objects });
    }

    const verified = new Set(context.job.verified_objects.map((item) => item.object_id));
    const missing = context.job.required_object_ids.filter((objectId) => !verified.has(objectId));
    if (context.job.manifest_verification === null) missing.push(STORAGE_MANIFEST_OBJECT_ID);
    if (missing.length > 0) {
      this.applyJobEvent(context, {
        type: 'partial_complete',
        missing_object_ids: [...missing].sort(),
        at: this.now(),
      });
      return;
    }
    if (
      context.moveSourceDestinationId !== null
      && !await this.deleteVerifiedMoveSource(context, context.moveSourceDestinationId)
    ) {
      return;
    }
    const completedAt = this.now();
    this.applyJobEvent(context, { type: 'succeed', at: completedAt }, undefined, {
      ...(context.backup === null ? {} : {
        backup: {
          backupId: context.backup.backupId,
          destinationId: context.backup.destinationId,
          state: context.backup.successState,
          completedAt: context.backup.successState === 'complete' ? completedAt : null,
        },
      }),
    });
  }

  private validateWriteResult(
    target: JobTarget,
    result: StorageWriteResult,
    priorBytes: number,
  ): void {
    if (
      result.remoteRef.trim().length === 0
      || result.ciphertextHash !== target.ciphertextHash
      || !Number.isSafeInteger(result.encryptedBytes)
      || result.encryptedBytes <= priorBytes
      || result.encryptedBytes > target.encryptedBytes
      || (result.complete && result.encryptedBytes !== target.encryptedBytes)
      || (!result.complete && result.resumeToken.offset !== result.encryptedBytes)
    ) {
      throw new StorageAdapterError('corrupt_ciphertext', 'adapter write result is inconsistent', false);
    }
  }

  private async handleTargetError(
    context: RouterJobContext,
    target: JobTarget,
    error: StorageAdapterError,
  ): Promise<boolean> {
    if (error.code === 'auth_required' || error.code === 'revoked') {
      const destinationState = error.code === 'revoked' ? 'revoked' : 'error';
      updateStorageDestinationState(this.db, context.job.destination_id, destinationState, this.now());
      this.pauseRunningJob(context, 'auth_required');
      return false;
    }
    if (error.code === 'quota_exceeded') {
      this.stopForQuota(context, context.job.total_bytes - context.job.completed_bytes, null);
    }
    if (error.retryable) {
      this.applyJobEvent(context, {
        type: 'retryable_error',
        error_code: error.code,
        retry_state: 'queued',
        cursor_json: this.serializeCursor(context),
        at: this.now(),
      }, error.code);
      return false;
    }

    context.failedObjectIds.add(target.logicalId);
    this.persistObjectState(context, target, 'error');
    if (error.code === 'corrupt_ciphertext' || error.code === 'conflict') {
      this.markBackupCorrupt(context);
    }
    const priorBytes = context.uploadedBytes.get(target.logicalId) ?? 0;
    const remainingBytes = target.encryptedBytes - priorBytes;
    context.uploadedBytes.set(target.logicalId, target.encryptedBytes);
    context.resumeTokens.delete(target.logicalId);
    context.nextTargetIndex += 1;
    this.applyJobEvent(context, {
      type: 'checkpoint',
      completed_objects: target.isManifest ? 0 : 1,
      completed_bytes: remainingBytes,
      cursor_json: this.serializeCursor(context),
      at: this.now(),
    }, error.code);
    return true;
  }

  private async preflightQuota(
    context: RouterJobContext,
    adapter: StorageDestinationAdapter,
  ): Promise<boolean> {
    try {
      const quota = await adapter.quota();
      if (quota.capBytes === null || quota.usedBytes === null) return true;
      const availableBytes = Math.max(0, quota.capBytes - quota.usedBytes);
      const requiredBytes = context.job.total_bytes - context.job.completed_bytes;
      if (availableBytes < requiredBytes) this.stopForQuota(context, requiredBytes, availableBytes);
      return true;
    } catch (error) {
      if (error instanceof StorageRouterError && error.code === 'quota_exceeded') throw error;
      const adapterError = normalizeAdapterError(error);
      if (adapterError.code === 'quota_exceeded') {
        this.stopForQuota(context, context.job.total_bytes - context.job.completed_bytes, null);
      }
      if (adapterError.code === 'auth_required' || adapterError.code === 'revoked') {
        this.pauseRunningJob(context, 'auth_required');
        return false;
      }
      if (adapterError.retryable) {
        this.applyJobEvent(context, {
          type: 'retryable_error',
          error_code: adapterError.code,
          retry_state: 'queued',
          cursor_json: this.serializeCursor(context),
          at: this.now(),
        }, adapterError.code);
        return false;
      }
      this.pauseRunningJob(context, adapterError.code);
      return false;
    }
  }

  private stopForQuota(
    context: RouterJobContext,
    requiredBytes: number,
    availableBytes: number | null,
  ): never {
    this.pauseRunningJob(context, 'quota_exceeded');
    this.emit({
      type: 'quota_exceeded',
      jobId: context.job.id,
      destinationId: context.job.destination_id,
      requiredBytes,
      availableBytes,
    });
    throw new StorageRouterError(
      'quota_exceeded',
      'destination quota is insufficient for the remaining encrypted bytes',
      {
        destinationId: context.job.destination_id,
        requiredBytes,
        ...(availableBytes === null ? {} : { availableBytes }),
      },
    );
  }

  private destinationCanContinue(
    destination: StorageDestinationRow,
    context: RouterJobContext,
  ): boolean {
    if (destination.state === 'ready' || destination.state === 'degraded') return true;
    this.pauseRunningJob(
      context,
      destination.state === 'revoked' || destination.state === 'authorizing'
        ? 'auth_required'
        : 'provider_error',
    );
    return false;
  }

  private honorControlFlags(context: RouterJobContext): boolean {
    const row = getStorageJob(this.db, context.job.id);
    if (row === null) throw new StorageRouterError('job_not_found', 'storage job was removed');
    if (row.state === 'cancelled' && !TERMINAL_JOB_STATES.has(context.job.state)) {
      this.applyJobEvent(context, { type: 'cancel', at: this.now() });
      return true;
    }
    if (row.state === 'paused' && context.job.state === 'running') {
      this.applyJobEvent(context, { type: 'pause', at: this.now() }, row.last_error_code);
      return true;
    }
    return context.job.state !== 'running';
  }

  private pauseRunningJob(context: RouterJobContext, errorCode: string): void {
    if (context.job.state === 'running') {
      this.applyJobEvent(context, { type: 'pause', at: this.now() }, errorCode);
    }
  }

  private applyJobEvent(
    context: RouterJobContext,
    event: StorageJobEvent,
    lastErrorCode?: string | null,
    checkpoint: Omit<StorageRouterCheckpoint, 'job'> = {},
  ): void {
    const reduced = reduceStorageJob(context.job, event);
    const nextJob = lastErrorCode === undefined
      ? reduced
      : { ...reduced, last_error_code: lastErrorCode };
    const persistedJob = {
      ...nextJob,
      cursor_json: this.serializeCursor(context, nextJob),
    };
    checkpointStorageRouterState(this.db, {
      job: persistedJob,
      ...checkpoint,
    });
    context.job = persistedJob;
    this.emit({
      type: 'job_transition',
      jobId: context.job.id,
      eventType: event.type,
      state: context.job.state,
      completedObjects: context.job.completed_objects,
      totalObjects: context.job.total_objects,
      completedBytes: context.job.completed_bytes,
      totalBytes: context.job.total_bytes,
      errorCode: context.job.last_error_code,
    });
    for (const object of checkpoint.objects ?? []) {
      this.emitObjectState(context.job.id, object);
    }
    if (TERMINAL_JOB_STATES.has(context.job.state)) this.releaseJobPayload(context);
  }

  private persistContext(context: RouterJobContext): void {
    context.job = { ...context.job, cursor_json: this.serializeCursor(context) };
    updateStorageJob(this.db, context.job);
  }

  private serializeCursor(context: RouterJobContext, job: StorageJob = context.job): string {
    const manifestObjectId = context.targets.find((target) => target.isManifest)?.objectId;
    if (manifestObjectId === undefined) {
      throw new StorageRouterError('invalid_job_input', 'job has no manifest target');
    }
    const cursor: PersistedRouterCursor = {
      version: 2,
      phase: job.phase,
      nextTargetIndex: context.nextTargetIndex,
      requiredObjectIds: job.required_object_ids,
      verifiedObjects: job.verified_objects,
      pendingEvidence: [...context.evidence.entries()]
        .sort(([left], [right]) => left.localeCompare(right)),
      manifestVerification: job.manifest_verification,
      uploadedBytes: [...context.uploadedBytes.entries()].sort(([left], [right]) => left.localeCompare(right)),
      resumeTokens: [...context.resumeTokens.entries()].sort(([left], [right]) => left.localeCompare(right)),
      failedObjectIds: [...context.failedObjectIds].sort(),
      missingObjectIds: job.state === 'partial'
        ? [
            ...job.required_object_ids.filter(
              (objectId) => !job.verified_objects.some(
                (verified) => verified.object_id === objectId,
              ),
            ),
            ...(job.manifest_verification === null ? [STORAGE_MANIFEST_OBJECT_ID] : []),
          ].sort()
        : [],
      manifestObjectId,
      backupId: context.backup?.backupId ?? null,
      moveSourceDestinationId: context.moveSourceDestinationId,
      payloadSourceJobId: context.payloadSourceJobId,
    };
    return JSON.stringify(cursor);
  }

  private persistObjectState(
    context: RouterJobContext,
    target: JobTarget,
    state: StorageObjectState,
    remoteRef?: string,
    remoteVersion?: string | null,
    lastVerifiedAt?: string,
  ): void {
    const row = this.storageObjectRow(
      context,
      target,
      state,
      remoteRef,
      remoteVersion,
      lastVerifiedAt,
    );
    upsertStorageObject(this.db, row);
    if (target.isManifest && remoteRef !== undefined && context.backup !== null) {
      updateStorageBackupManifestRef(
        this.db,
        context.backup.backupId,
        context.backup.destinationId,
        remoteRef,
      );
    }
    this.emitObjectState(context.job.id, row);
  }

  private storageObjectRow(
    context: RouterJobContext,
    target: JobTarget,
    state: StorageObjectState,
    remoteRef?: string,
    remoteVersion?: string | null,
    lastVerifiedAt?: string,
  ): StorageObjectRow {
    const current = getStorageObject(this.db, target.objectId, context.job.destination_id);
    return {
      object_id: target.objectId,
      destination_id: context.job.destination_id,
      data_class: target.isManifest ? 'backup_manifest' : target.dataClass,
      ciphertext_hash: target.ciphertextHash,
      plaintext_hash_encrypted: current?.plaintext_hash_encrypted ?? null,
      encrypted_bytes: target.encryptedBytes,
      remote_ref: remoteRef === undefined ? current?.remote_ref ?? null : remoteRef,
      remote_version: remoteVersion === undefined ? current?.remote_version ?? null : remoteVersion,
      state,
      last_verified_at: lastVerifiedAt ?? (state === 'verified' ? this.now() : current?.last_verified_at ?? null),
    };
  }

  private emitObjectState(jobId: string, row: StorageObjectRow): void {
    this.emit({
      type: 'object_state_changed',
      jobId,
      destinationId: row.destination_id,
      objectId: row.object_id,
      state: row.state,
    });
  }

  private requireObjectRow(context: RouterJobContext, target: JobTarget): StorageObjectRow {
    const row = getStorageObject(this.db, target.objectId, context.job.destination_id);
    if (row === null) throw new StorageRouterError('invalid_job_input', 'tracked object was not found');
    return row;
  }

  private markBackupCorrupt(context: RouterJobContext): void {
    if (context.backup !== null) {
      updateStorageBackupState(
        this.db,
        context.backup.backupId,
        context.backup.destinationId,
        'corrupt',
      );
    }
  }

  private async deleteVerifiedMoveSource(
    context: RouterJobContext,
    sourceDestinationId: string,
  ): Promise<boolean> {
    const source = this.requireDestination(sourceDestinationId);
    if (source.state !== 'ready' && source.state !== 'degraded') {
      this.pauseRunningJob(
        context,
        source.state === 'revoked' || source.state === 'authorizing'
          ? 'auth_required'
          : 'provider_error',
      );
      return false;
    }
    const adapter = this.resolveDestinationAdapter(source);
    if (adapter === null) {
      this.emit({ type: 'destination_unavailable', destinationId: sourceDestinationId });
      this.pauseRunningJob(context, 'provider_error');
      return false;
    }
    for (const target of context.targets) {
      const sourceRow = getStorageObject(this.db, target.objectId, sourceDestinationId);
      if (sourceRow === null || sourceRow.state === 'deleted') continue;
      this.persistMoveSourceState(context, sourceRow, 'deleting');
      try {
        await adapter.deleteObject({ objectId: target.objectId, remoteRef: sourceRow.remote_ref ?? undefined });
        const remaining = await adapter.headObject({
          objectId: target.objectId,
          remoteRef: sourceRow.remote_ref ?? undefined,
        });
        if (remaining !== null) {
          this.persistMoveSourceState(context, sourceRow, 'error');
          this.pauseRunningJob(context, 'provider_error');
          return false;
        }
        this.persistMoveSourceState(context, sourceRow, 'deleted');
      } catch (error) {
        const adapterError = normalizeAdapterError(error);
        this.persistMoveSourceState(context, sourceRow, 'error');
        if (adapterError.code === 'auth_required' || adapterError.code === 'revoked') {
          this.pauseRunningJob(context, 'auth_required');
        } else if (adapterError.retryable) {
          this.applyJobEvent(context, {
            type: 'retryable_error',
            error_code: adapterError.code,
            retry_state: 'queued',
            cursor_json: this.serializeCursor(context),
            at: this.now(),
          }, adapterError.code);
        } else {
          this.pauseRunningJob(context, adapterError.code);
        }
        return false;
      }
    }
    if (context.backup !== null) {
      const sourceBackup = getStorageBackup(this.db, context.backup.backupId, sourceDestinationId);
      if (sourceBackup !== null) {
        updateStorageBackupState(
          this.db,
          sourceBackup.backup_id,
          sourceBackup.destination_id,
          'deleted',
        );
      }
    }
    return true;
  }

  private persistMoveSourceState(
    context: RouterJobContext,
    row: StorageObjectRow,
    state: StorageObjectState,
  ): void {
    upsertStorageObject(this.db, {
      ...row,
      state,
    });
    this.emit({
      type: 'object_state_changed',
      jobId: context.job.id,
      destinationId: row.destination_id,
      objectId: row.object_id,
      state,
    });
  }

  private assertVerifiedSource(
    sourceDestinationId: string,
    objects: readonly RouterWriteStorageObject[],
    manifest: RouterWriteStorageObject,
  ): void {
    this.requireDestination(sourceDestinationId);
    for (const object of [...objects, manifest]) {
      const row = getStorageObject(this.db, object.objectId, sourceDestinationId);
      if (
        row === null
        || row.state !== 'verified'
        || row.ciphertext_hash !== object.ciphertextHash
        || row.encrypted_bytes !== object.encryptedBytes
      ) {
        throw new StorageRouterError(
          'invalid_job_input',
          'move, mirror, and repair sources must be verified ciphertext copies',
          { destinationId: sourceDestinationId },
        );
      }
    }
  }

  private persistHealthDestinationState(
    destination: StorageDestinationRow,
    health: StorageHealthRow,
    checkedAt: string,
  ): void {
    if (destination.state === 'revoked') return;
    const nextState: StorageDestinationState = health.state === 'ok'
      ? 'ready'
      : health.state === 'degraded' || health.state === 'unreachable'
        ? 'degraded'
        : health.state === 'revoked'
          ? 'revoked'
          : 'error';
    updateStorageDestinationState(this.db, destination.id, nextState, checkedAt);
  }

  private emitHealth(row: StorageHealthRow, cached: boolean): void {
    this.emit({
      type: 'health_checked',
      destinationId: row.destination_id,
      state: row.state,
      verifiedReadWrite: row.verified_read_write === 1,
      usedBytes: row.used_bytes,
      capBytes: row.cap_bytes,
      cached,
      errorCode: row.error_code,
    });
  }

  private emitJobPlanned(job: StorageJob): void {
    this.emit({
      type: 'job_planned',
      jobId: job.id,
      kind: job.kind,
      destinationId: job.destination_id,
      totalObjects: job.total_objects,
      totalBytes: job.total_bytes,
    });
  }

  private jobSnapshot(job: StorageJob): StorageJob {
    return {
      ...job,
      required_object_ids: [...job.required_object_ids],
      verified_objects: job.verified_objects.map((item) => ({
        object_id: item.object_id,
        verification: { ...item.verification },
      })),
      manifest_verification: job.manifest_verification === null
        ? null
        : { ...job.manifest_verification },
    };
  }

  private releaseJobPayload(context: RouterJobContext): void {
    for (const target of context.targets) target.object = null;
    context.resumeTokens.clear();
    context.uploadedBytes.clear();
    context.evidence.clear();
    context.onCiphertext = undefined;
    context.verifyCiphertext = undefined;
  }

  private emit(event: StorageRouterEvent): void {
    try {
      this.onEvent?.(event);
    } catch {
      // Observability cannot mutate job truth or interrupt storage safety.
    }
  }

  private requireDestination(destinationId: string): StorageDestinationRow {
    const destination = getStorageDestination(this.db, destinationId);
    if (destination === null) {
      throw new StorageRouterError('destination_not_found', 'storage destination was not found', {
        destinationId,
      });
    }
    return destination;
  }

  private requireDestinationForNewWrite(destinationId: string): StorageDestinationRow {
    const destination = this.requireDestination(destinationId);
    if (destination.state !== 'ready' && destination.state !== 'degraded') {
      throw new StorageRouterError(
        'destination_not_ready',
        'storage destination is not eligible for new writes',
        { destinationId },
      );
    }
    if (this.resolveDestinationAdapter(destination) === null) {
      this.emit({ type: 'destination_unavailable', destinationId });
      throw new StorageRouterError(
        'destination_unavailable',
        'this platform cannot serve the destination kind',
        { destinationId },
      );
    }
    return destination;
  }

  private resolveDestinationAdapter(
    destination: StorageDestinationRow,
  ): StorageDestinationAdapter | null {
    const mapped = this.adapters?.get(destination.id);
    if (mapped !== undefined) return mapped;
    return this.adapterResolver?.(destination) ?? null;
  }

  /** Repair checkpoints written by pre-atomic router versions before serving jobs. */
  private reconcilePersistedCheckpoints(): void {
    for (const row of listStorageJobs(this.db)) {
      const cursor = this.parsePersistedCursor(row.cursor_json);
      if (cursor === null) continue;

      const objects: StorageObjectRow[] = [];
      if (row.kind !== 'delete' && row.state === 'running') {
        for (const verified of cursor.verifiedObjects) {
          const object = getStorageObject(this.db, verified.object_id, row.destination_id);
          if (object?.state === 'verifying') {
            objects.push({ ...object, state: 'verified', last_verified_at: row.updated_at });
          }
        }
        if (cursor.manifestVerification !== null) {
          const manifest = getStorageObject(this.db, cursor.manifestObjectId, row.destination_id);
          if (manifest?.state === 'verifying') {
            objects.push({ ...manifest, state: 'verified', last_verified_at: row.updated_at });
          }
        }
      }

      let backup: StorageRouterCheckpoint['backup'];
      if (row.state === 'succeeded' && cursor.backupId !== null) {
        const current = getStorageBackup(this.db, cursor.backupId, row.destination_id);
        const desiredState = row.kind === 'delete' ? 'deleted' : 'complete';
        const shouldReconcile = current !== null && (
          desiredState === 'deleted'
            ? current.state !== 'deleted'
            : current.state === 'writing' || current.state === 'verifying'
        );
        if (current !== null && shouldReconcile) {
          backup = {
            backupId: current.backup_id,
            destinationId: current.destination_id,
            state: desiredState,
            completedAt: desiredState === 'complete' ? row.updated_at : null,
          };
        }
      }

      if (objects.length > 0 || backup !== undefined) {
        checkpointStorageRouterState(this.db, {
          job: row,
          objects,
          ...(backup === undefined ? {} : { backup }),
        });
      }
    }
  }

  private parsePersistedCursor(value: string | null): PersistedRouterCursor | null {
    if (value === null) return null;
    try {
      const cursor = JSON.parse(value) as PersistedRouterCursor;
      if ((cursor.version !== 1 && cursor.version !== 2)
        || !Array.isArray(cursor.requiredObjectIds)
        || !cursor.requiredObjectIds.every((objectId) => typeof objectId === 'string')
        || !Array.isArray(cursor.verifiedObjects)
        || !cursor.verifiedObjects.every((verified) => (
          typeof verified === 'object'
          && verified !== null
          && typeof verified.object_id === 'string'
        ))
        || (cursor.manifestVerification !== null
          && (typeof cursor.manifestVerification !== 'object'
            || cursor.manifestVerification === undefined))
        || !Array.isArray(cursor.uploadedBytes)
        || !Array.isArray(cursor.resumeTokens)
        || !Array.isArray(cursor.failedObjectIds)
        || typeof cursor.manifestObjectId !== 'string'
        || cursor.manifestObjectId.length === 0
        || (cursor.backupId !== null && typeof cursor.backupId !== 'string')
        || !Number.isSafeInteger(cursor.nextTargetIndex)
        || cursor.nextTargetIndex < 0) return null;
      return cursor;
    } catch {
      return null;
    }
  }

  private requireJobContext(jobId: string): RouterJobContext {
    const context = this.jobContexts.get(jobId) ?? this.rehydrateJobContext(jobId);
    if (context === null) {
      throw new StorageRouterError('job_not_found', 'storage job was not found');
    }
    return context;
  }

  private async loadWriteObject(
    context: RouterJobContext,
    target: JobTarget,
  ): Promise<RouterEncryptedStorageObject> {
    if (target.object !== null) return target.object;
    if (this.payloadStore === undefined || context.payloadSourceJobId === null) {
      throw new StorageRouterError('job_context_unavailable', 'write job ciphertext is unavailable');
    }
    const ciphertext = await this.payloadStore.get(context.payloadSourceJobId, target.objectId);
    if (ciphertext === null
      || ciphertext.length !== target.encryptedBytes
      || sha512Hex(ciphertext) !== target.ciphertextHash) {
      ciphertext?.fill(0);
      throw new StorageRouterError('job_context_unavailable', 'staged write ciphertext is missing or corrupt');
    }
    return {
      objectId: target.objectId,
      dataClass: target.dataClass,
      ciphertext,
      ciphertextHash: target.ciphertextHash,
      encryptedBytes: target.encryptedBytes,
    };
  }

  private rehydrateJobContext(jobId: string): RouterJobContext | null {
    const row = getStorageJob(this.db, jobId);
    if (row === null) return null;
    try {
      const cursor = this.parsePersistedCursor(row.cursor_json);
      if (cursor === null) return null;
      const objectRows = cursor.requiredObjectIds.map((objectId) => (
        getStorageObject(this.db, objectId, row.destination_id)
      ));
      const manifestRow = getStorageObject(this.db, cursor.manifestObjectId, row.destination_id);
      if (objectRows.some((object) => object === null) || manifestRow === null) return null;
      const mode: JobMode = row.kind === 'delete'
        ? 'delete'
        : row.kind === 'restore'
          ? 'restore'
          : row.kind === 'verify'
            ? 'inspect'
            : 'write';
      if (mode === 'restore') return null;
      const job: StorageJob = {
        ...row,
        phase: cursor.phase,
        required_object_ids: [...cursor.requiredObjectIds],
        verified_objects: [...cursor.verifiedObjects],
        manifest_verification: cursor.manifestVerification,
      };
      const targets = [
        ...objectRows.map((object) => this.rowTarget(object!, false)),
        this.rowTarget(manifestRow, true),
      ];
      const backupRow = cursor.backupId === null
        ? null
        : getStorageBackup(this.db, cursor.backupId, row.destination_id);
      const context = this.createContext(job, mode, targets, backupRow === null ? null : {
        backupId: backupRow.backup_id,
        destinationId: backupRow.destination_id,
        successState: row.kind === 'delete' ? 'deleted' : 'complete',
      });
      context.nextTargetIndex = Math.min(cursor.nextTargetIndex, targets.length);
      context.uploadedBytes = new Map(cursor.uploadedBytes);
      context.resumeTokens = new Map(cursor.resumeTokens);
      context.evidence = new Map(cursor.pendingEvidence
        ?? cursor.verifiedObjects.map((item) => [item.object_id, item.verification]));
      if (cursor.manifestVerification !== null) {
        context.evidence.set(STORAGE_MANIFEST_OBJECT_ID, cursor.manifestVerification);
      }
      context.failedObjectIds = new Set(cursor.failedObjectIds);
      context.moveSourceDestinationId = cursor.moveSourceDestinationId;
      context.payloadSourceJobId = cursor.payloadSourceJobId ?? null;
      this.jobContexts.set(jobId, context);
      return context;
    } catch {
      return null;
    }
  }

  private allocateId(prefix: string): string {
    const randomPart = this.random().trim();
    if (randomPart.length === 0) {
      throw new StorageRouterError('invalid_job_input', 'random id source returned an empty value');
    }
    return `${prefix}-${randomPart}`;
  }

  private assertUnusedJobId(jobId: string): void {
    if (jobId.trim().length === 0 || getStorageJob(this.db, jobId) !== null) {
      throw new StorageRouterError('invalid_job_input', 'job id is empty or already exists');
    }
  }
}

export function createStorageRouter(deps: StorageRouterDeps): StorageDestinationRouter {
  return new StorageDestinationRouterImpl(deps);
}
