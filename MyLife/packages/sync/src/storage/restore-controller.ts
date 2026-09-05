import {
  BACKUP_IDENTITY_PATH,
  canonicalBackupManifest,
  type BackupChunkTarget,
  type BackupDecodeError,
  type BackupManifest,
  type OpenBackupManifestResult,
  type VerifyBackupChunkResult,
  type VerifyBackupIdentityResult,
} from './backup-format';

const HASH_PATTERN = /^[a-f0-9]{128}$/;

export type RestoreSelectionMode = 'database_only' | 'objects_only' | 'complete';

export type RestoreDependencyWarningCode =
  | 'objects_not_selected'
  | 'database_not_selected'
  | 'identity_not_selected'
  | 'identity_replacement';

export interface RestoreDependencyWarning {
  code: RestoreDependencyWarningCode;
  message: string;
}

export interface RestoreChunkRequirement {
  chunkId: string;
  target: BackupChunkTarget;
  encryptedBytes: number;
  plaintextBytes: number;
  ciphertextHash: string;
}

export interface CreateRestorePlanOptions {
  mode?: RestoreSelectionMode;
  selection?: RestoreSelectionMode;
  objectIds?: readonly string[];
  includeIdentity?: boolean;
}

export interface RestorePlan {
  backupId: string;
  mode: RestoreSelectionMode;
  manifest: BackupManifest;
  includesDatabase: boolean;
  includesObjects: boolean;
  includesIdentity: boolean;
  selectedObjectIds: readonly string[];
  requiredChunks: readonly RestoreChunkRequirement[];
  identityChunkId: typeof BACKUP_IDENTITY_PATH | null;
  totalEncryptedBytes: number;
  warnings: readonly RestoreDependencyWarning[];
}

export type RestoreFailureCode =
  | 'selection_failed'
  | 'locator_list_failed'
  | 'wrong_key'
  | 'invalid_manifest'
  | 'locator_mismatch'
  | 'unsupported_backup'
  | 'corrupt_chunk'
  | 'missing_chunk'
  | 'integrity_check_failed'
  | 'migration_rehearsal_failed'
  | 'identity_inconsistent'
  | 'staging_failed'
  | 'activation_failed'
  | 'activation_rollback_failed';

export interface RestoreFailureReason {
  code: RestoreFailureCode;
  message: string;
  chunkId?: string;
  report?: string;
}

export class RestorePlanError extends Error {
  readonly code: 'invalid_manifest' | 'invalid_selection';

  constructor(code: RestorePlanError['code'], message: string) {
    super(message);
    this.name = 'RestorePlanError';
    this.code = code;
  }
}

export type RestoreStage =
  | 'select'
  | 'list_locators'
  | 'manifest_open'
  | 'chunks_verifying'
  | 'staged_complete'
  | 'migration_rehearsal'
  | 'awaiting_activation'
  | 'activated'
  | 'rolled_back'
  | 'failed';

export interface RestoreIntegrityEvidence {
  passed: true;
  report: string;
}

export interface RestoreMigrationEvidence {
  passed: true;
  report: string;
}

export interface RestoreIdentityEvidence {
  consistent: true;
  report: string;
}

export interface RestoreControllerState {
  plan: RestorePlan;
  stage: RestoreStage;
  destinationId: string | null;
  selectedBackupId: string | null;
  locatorCount: number | null;
  manifestSignature: string | null;
  verifiedChunks: Readonly<Record<string, number>>;
  identityBundleVerified: boolean;
  integrityCheck: RestoreIntegrityEvidence | null;
  migrationRehearsal: RestoreMigrationEvidence | null;
  identityConsistency: RestoreIdentityEvidence | null;
  activationReport: string | null;
  rollbackReport: string | null;
  failure: RestoreFailureReason | null;
}

export type RestoreControllerEvent =
  | { type: 'destination_selected'; destinationId: string }
  | {
      type: 'locators_listed';
      backupIds: readonly string[];
      selectedBackupId?: string;
    }
  | { type: 'manifest_open_result'; result: OpenBackupManifestResult }
  | {
      type: 'chunk_verification_result';
      chunkId: string;
      result: VerifyBackupChunkResult;
    }
  | { type: 'identity_bundle_result'; result: VerifyBackupIdentityResult }
  | { type: 'integrity_check_result'; passed: boolean; report: string }
  | { type: 'migration_rehearsal_result'; passed: boolean; report: string }
  | { type: 'identity_consistency_result'; consistent: boolean; report: string }
  | { type: 'activation_result'; activated: boolean; report: string; rollbackSucceeded?: boolean }
  | { type: 'activation_failed'; report: string; rollbackSucceeded: boolean }
  | { type: 'rollback'; report: string }
  | { type: 'fail'; reason: RestoreFailureReason };

export class RestoreTransitionError extends Error {
  readonly stage: RestoreStage;
  readonly eventType: RestoreControllerEvent['type'];

  constructor(state: RestoreControllerState, event: RestoreControllerEvent, message: string) {
    super(message);
    this.name = 'RestoreTransitionError';
    this.stage = state.stage;
    this.eventType = event.type;
  }
}

function databaseChunkId(index: number): string {
  return `database/${index.toString().padStart(6, '0')}.mkchunk`;
}

function objectChunkId(objectId: string, index: number): string {
  return `objects/${objectId}/${index.toString().padStart(6, '0')}.mkchunk`;
}

function safeAdd(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RestorePlanError('invalid_manifest', 'restore byte total exceeds safe integer range');
  }
  return value;
}

function validateDescriptor(
  descriptor: BackupManifest['databaseChunks'][number],
  expectedIndex: number,
): void {
  if (
    descriptor.index !== expectedIndex
    || !Number.isSafeInteger(descriptor.plaintextBytes)
    || descriptor.plaintextBytes < 0
    || !Number.isSafeInteger(descriptor.encryptedBytes)
    || descriptor.encryptedBytes <= 0
    || !HASH_PATTERN.test(descriptor.ciphertextHash)
  ) {
    throw new RestorePlanError('invalid_manifest', 'backup chunk descriptor is malformed');
  }
}

function validateManifest(manifest: BackupManifest): void {
  if (
    manifest.formatVersion !== 1
    || manifest.backupId.trim().length === 0
    || manifest.databaseChunks.length === 0
  ) {
    throw new RestorePlanError('invalid_manifest', 'backup manifest is incomplete');
  }
  manifest.databaseChunks.forEach(validateDescriptor);
  const objectIds = new Set<string>();
  for (const object of manifest.objects) {
    if (
      object.objectId.trim().length === 0
      || object.dataClass.trim().length === 0
      || object.chunks.length === 0
      || objectIds.has(object.objectId)
    ) {
      throw new RestorePlanError('invalid_manifest', 'backup object descriptor is malformed');
    }
    objectIds.add(object.objectId);
    object.chunks.forEach(validateDescriptor);
  }
  if (
    manifest.identity !== null
    && (
      !Number.isSafeInteger(manifest.identity.encryptedBytes)
      || manifest.identity.encryptedBytes <= 0
      || !HASH_PATTERN.test(manifest.identity.ciphertextHash)
    )
  ) {
    throw new RestorePlanError('invalid_manifest', 'backup identity descriptor is malformed');
  }
}

export function createRestorePlan(
  manifest: BackupManifest,
  options: CreateRestorePlanOptions = {},
): RestorePlan {
  validateManifest(manifest);
  if (options.mode !== undefined && options.selection !== undefined && options.mode !== options.selection) {
    throw new RestorePlanError('invalid_selection', 'restore mode and selection disagree');
  }
  const mode = options.mode ?? options.selection ?? 'complete';
  const includesDatabase = mode !== 'objects_only';
  const includesObjects = mode !== 'database_only';
  const requestedObjectIds = options.objectIds === undefined
    ? null
    : new Set(options.objectIds);
  if (!includesObjects && requestedObjectIds !== null && requestedObjectIds.size > 0) {
    throw new RestorePlanError('invalid_selection', 'database-only restore cannot select objects');
  }

  const selectedObjects = includesObjects
    ? manifest.objects.filter((object) => requestedObjectIds === null || requestedObjectIds.has(object.objectId))
    : [];
  if (requestedObjectIds !== null) {
    for (const objectId of requestedObjectIds) {
      if (!selectedObjects.some((object) => object.objectId === objectId)) {
        throw new RestorePlanError('invalid_selection', 'selected restore object is not in the manifest');
      }
    }
  }
  const includesIdentity = manifest.identity !== null
    && (options.includeIdentity ?? mode === 'complete');
  const requiredChunks: RestoreChunkRequirement[] = [];
  let totalEncryptedBytes = 0;
  if (includesDatabase) {
    manifest.databaseChunks.forEach((descriptor, index) => {
      requiredChunks.push({
        chunkId: databaseChunkId(index),
        target: { kind: 'database', index },
        encryptedBytes: descriptor.encryptedBytes,
        plaintextBytes: descriptor.plaintextBytes,
        ciphertextHash: descriptor.ciphertextHash,
      });
      totalEncryptedBytes = safeAdd(totalEncryptedBytes, descriptor.encryptedBytes);
    });
  }
  for (const object of selectedObjects) {
    object.chunks.forEach((descriptor, index) => {
      requiredChunks.push({
        chunkId: objectChunkId(object.objectId, index),
        target: { kind: 'object', objectId: object.objectId, index },
        encryptedBytes: descriptor.encryptedBytes,
        plaintextBytes: descriptor.plaintextBytes,
        ciphertextHash: descriptor.ciphertextHash,
      });
      totalEncryptedBytes = safeAdd(totalEncryptedBytes, descriptor.encryptedBytes);
    });
  }
  if (includesIdentity && manifest.identity !== null) {
    totalEncryptedBytes = safeAdd(totalEncryptedBytes, manifest.identity.encryptedBytes);
  }

  const warnings: RestoreDependencyWarning[] = [];
  if (mode === 'database_only' && manifest.objects.length > 0) {
    warnings.push({
      code: 'objects_not_selected',
      message: 'The restored database may reference encrypted objects that are not selected.',
    });
  }
  if (mode === 'objects_only') {
    warnings.push({
      code: 'database_not_selected',
      message: 'Object metadata may be absent because the database is not selected.',
    });
  }
  if (manifest.identity !== null && !includesIdentity) {
    warnings.push({
      code: 'identity_not_selected',
      message: 'The sealed recovery bundle is present but is not selected.',
    });
  }
  if (includesIdentity) {
    warnings.push({
      code: 'identity_replacement',
      message: 'Activation may replace the current recovered identity after consistency verification.',
    });
  }

  return {
    backupId: manifest.backupId,
    mode,
    manifest,
    includesDatabase,
    includesObjects,
    includesIdentity,
    selectedObjectIds: selectedObjects.map((object) => object.objectId),
    requiredChunks,
    identityChunkId: includesIdentity ? BACKUP_IDENTITY_PATH : null,
    totalEncryptedBytes,
    warnings,
  };
}

export function createRestoreController(plan: RestorePlan): RestoreControllerState {
  return {
    plan,
    stage: 'select',
    destinationId: null,
    selectedBackupId: null,
    locatorCount: null,
    manifestSignature: null,
    verifiedChunks: {},
    identityBundleVerified: false,
    integrityCheck: null,
    migrationRehearsal: null,
    identityConsistency: null,
    activationReport: null,
    rollbackReport: null,
    failure: null,
  };
}

export const createRestoreState = createRestoreController;

function failState(
  state: RestoreControllerState,
  reason: RestoreFailureReason,
): RestoreControllerState {
  return {
    ...state,
    stage: 'failed',
    activationReport: null,
    rollbackReport: null,
    failure: reason,
  };
}

function failureFromBackupError(
  error: BackupDecodeError,
  chunkId?: string,
): RestoreFailureReason {
  switch (error.code) {
    case 'wrong_key':
      return { code: 'wrong_key', message: 'The recovery key could not open this backup.' };
    case 'missing_chunk':
      return {
        code: 'missing_chunk',
        message: 'A required backup chunk is missing.',
        chunkId: chunkId ?? error.path,
      };
    case 'locator_mismatch':
      return { code: 'locator_mismatch', message: 'The locator does not match the encrypted manifest.' };
    case 'unsupported_version':
      return { code: 'unsupported_backup', message: 'The backup format version is not supported.' };
    case 'bad_signature':
      return { code: 'invalid_manifest', message: 'The backup manifest signature is invalid.' };
    case 'tampered_chunk':
    case 'truncated':
    case 'chunk_order':
      return {
        code: 'corrupt_chunk',
        message: 'A backup chunk failed cryptographic verification.',
        chunkId: chunkId ?? error.path,
      };
  }
}

function manifestMatchesPlan(result: Extract<OpenBackupManifestResult, { ok: true }>, plan: RestorePlan): boolean {
  if (
    result.locator.backupId !== plan.backupId
    || result.manifest.backupId !== plan.backupId
    || result.manifest.schemaVersion !== plan.manifest.schemaVersion
    || result.manifest.devicePublicKey !== plan.manifest.devicePublicKey
  ) {
    return false;
  }
  try {
    return bytesEqual(
      canonicalBackupManifest(result.manifest),
      canonicalBackupManifest(plan.manifest),
    );
  } catch {
    return false;
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function allChunksVerified(state: RestoreControllerState): boolean {
  return state.plan.requiredChunks.every(
    (chunk) => state.verifiedChunks[chunk.chunkId] !== undefined,
  ) && (!state.plan.includesIdentity || state.identityBundleVerified);
}

function maybeAwaitActivation(state: RestoreControllerState): RestoreControllerState {
  if (state.migrationRehearsal === null) return state;
  if (state.plan.includesIdentity && state.identityConsistency === null) return state;
  return { ...state, stage: 'awaiting_activation' };
}

function requireStage(
  state: RestoreControllerState,
  event: RestoreControllerEvent,
  ...stages: readonly RestoreStage[]
): void {
  if (!stages.includes(state.stage)) {
    throw new RestoreTransitionError(
      state,
      event,
      `${event.type} is not valid during ${state.stage}`,
    );
  }
}

export function reduceRestoreController(
  state: RestoreControllerState,
  event: RestoreControllerEvent,
): RestoreControllerState {
  if (state.stage === 'activated' || state.stage === 'rolled_back' || state.stage === 'failed') {
    throw new RestoreTransitionError(state, event, `${state.stage} is terminal`);
  }
  if (event.type === 'fail') return failState(state, event.reason);

  switch (event.type) {
    case 'destination_selected': {
      requireStage(state, event, 'select');
      if (event.destinationId.trim().length === 0) {
        return failState(state, {
          code: 'selection_failed',
          message: 'A storage destination must be selected.',
        });
      }
      return { ...state, stage: 'list_locators', destinationId: event.destinationId };
    }
    case 'locators_listed': {
      requireStage(state, event, 'list_locators');
      const selectedBackupId = event.selectedBackupId ?? state.plan.backupId;
      if (!event.backupIds.includes(selectedBackupId) || selectedBackupId !== state.plan.backupId) {
        return failState(state, {
          code: 'locator_list_failed',
          message: 'The selected backup locator was not found.',
        });
      }
      return {
        ...state,
        stage: 'manifest_open',
        selectedBackupId,
        locatorCount: event.backupIds.length,
      };
    }
    case 'manifest_open_result': {
      requireStage(state, event, 'manifest_open');
      if (!event.result.ok) return failState(state, failureFromBackupError(event.result.error));
      if (!manifestMatchesPlan(event.result, state.plan)) {
        return failState(state, {
          code: 'invalid_manifest',
          message: 'The opened manifest differs from the selected restore plan.',
        });
      }
      const opened: RestoreControllerState = {
        ...state,
        stage: 'chunks_verifying',
        manifestSignature: event.result.manifestSignature,
      };
      return allChunksVerified(opened) ? { ...opened, stage: 'staged_complete' } : opened;
    }
    case 'chunk_verification_result': {
      requireStage(state, event, 'chunks_verifying');
      const requirement = state.plan.requiredChunks.find((chunk) => chunk.chunkId === event.chunkId);
      if (requirement === undefined || state.verifiedChunks[event.chunkId] !== undefined) {
        throw new RestoreTransitionError(state, event, 'chunk is not required or was already verified');
      }
      if (!event.result.ok) {
        return failState(state, failureFromBackupError(event.result.error, event.chunkId));
      }
      if (event.result.plaintext.length !== requirement.plaintextBytes) {
        return failState(state, {
          code: 'corrupt_chunk',
          message: 'Verified chunk evidence has an unexpected plaintext length.',
          chunkId: event.chunkId,
        });
      }
      const verifiedChunks = {
        ...state.verifiedChunks,
        [event.chunkId]: event.result.plaintext.length,
      };
      const next = { ...state, verifiedChunks };
      return allChunksVerified(next) ? { ...next, stage: 'staged_complete' } : next;
    }
    case 'identity_bundle_result': {
      requireStage(state, event, 'chunks_verifying');
      if (!state.plan.includesIdentity || state.identityBundleVerified) {
        throw new RestoreTransitionError(state, event, 'identity bundle is not required or already verified');
      }
      if (!event.result.ok) {
        return failState(
          state,
          failureFromBackupError(event.result.error, BACKUP_IDENTITY_PATH),
        );
      }
      if (!event.result.sealedRecoveryBundle.includes('.')) {
        return failState(state, {
          code: 'corrupt_chunk',
          message: 'The sealed recovery bundle evidence is malformed.',
          chunkId: BACKUP_IDENTITY_PATH,
        });
      }
      const next = { ...state, identityBundleVerified: true };
      return allChunksVerified(next) ? { ...next, stage: 'staged_complete' } : next;
    }
    case 'integrity_check_result': {
      requireStage(state, event, 'staged_complete');
      if (!event.passed || event.report.trim().length === 0) {
        return failState(state, {
          code: 'integrity_check_failed',
          message: 'The staged database failed integrity_check.',
          report: event.report,
        });
      }
      return {
        ...state,
        stage: 'migration_rehearsal',
        integrityCheck: { passed: true, report: event.report },
      };
    }
    case 'migration_rehearsal_result': {
      requireStage(state, event, 'migration_rehearsal');
      if (!event.passed || event.report.trim().length === 0) {
        return failState(state, {
          code: 'migration_rehearsal_failed',
          message: 'The staged database failed migration rehearsal.',
          report: event.report,
        });
      }
      return maybeAwaitActivation({
        ...state,
        migrationRehearsal: { passed: true, report: event.report },
      });
    }
    case 'identity_consistency_result': {
      requireStage(state, event, 'staged_complete', 'migration_rehearsal');
      if (!state.plan.includesIdentity || !state.identityBundleVerified) {
        throw new RestoreTransitionError(state, event, 'verified identity bundle evidence is required');
      }
      if (!event.consistent || event.report.trim().length === 0) {
        return failState(state, {
          code: 'identity_inconsistent',
          message: 'The recovered identity keypair is inconsistent.',
          report: event.report,
        });
      }
      return maybeAwaitActivation({
        ...state,
        identityConsistency: { consistent: true, report: event.report },
      });
    }
    case 'activation_result': {
      requireStage(state, event, 'awaiting_activation');
      if (event.activated) {
        return { ...state, stage: 'activated', activationReport: event.report };
      }
      if (event.rollbackSucceeded === true) {
        return {
          ...state,
          stage: 'rolled_back',
          rollbackReport: event.report,
          failure: { code: 'activation_failed', message: 'Activation failed and prior data was restored.' },
        };
      }
      return failState(state, {
        code: 'activation_rollback_failed',
        message: 'Activation failed and rollback was not confirmed.',
        report: event.report,
      });
    }
    case 'activation_failed': {
      requireStage(state, event, 'awaiting_activation');
      if (event.rollbackSucceeded) {
        return {
          ...state,
          stage: 'rolled_back',
          rollbackReport: event.report,
          failure: { code: 'activation_failed', message: 'Activation failed and prior data was restored.' },
        };
      }
      return failState(state, {
        code: 'activation_rollback_failed',
        message: 'Activation failed and rollback was not confirmed.',
        report: event.report,
      });
    }
    case 'rollback': {
      requireStage(state, event, 'awaiting_activation');
      return {
        ...state,
        stage: 'rolled_back',
        rollbackReport: event.report,
        failure: { code: 'activation_failed', message: 'Activation failed and prior data was restored.' },
      };
    }
  }
}

export const reduceRestoreState = reduceRestoreController;
