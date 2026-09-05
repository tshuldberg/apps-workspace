import type { StorageJobRow, StorageJobState } from './schema';
import type { StorageErrorCode, VerifiedStorageEvidence } from './types';

export type StorageJobPhase = 'writing' | 'verifying';

export interface StorageJobVerification {
  object_id: string;
  verification: VerifiedStorageEvidence;
}

export interface StorageJob extends StorageJobRow {
  phase: StorageJobPhase | null;
  required_object_ids: readonly string[];
  verified_objects: readonly StorageJobVerification[];
  manifest_verification: VerifiedStorageEvidence | null;
}

export const STORAGE_MANIFEST_OBJECT_ID = 'manifest.mkmanifest';

export type StorageJobEvent =
  | { type: 'start'; at: string }
  | {
      type: 'checkpoint';
      completed_objects: number;
      completed_bytes: number;
      cursor_json: string;
      at: string;
    }
  | { type: 'pause'; at: string }
  | { type: 'resume'; at: string }
  | {
      type: 'retryable_error';
      error_code: StorageErrorCode;
      retry_state: 'queued' | 'running';
      cursor_json?: string;
      at: string;
    }
  | {
      type: 'verify_pass';
      target: { kind: 'object'; object_id: string } | { kind: 'manifest' };
      verification: VerifiedStorageEvidence;
      at: string;
    }
  | { type: 'verify_fail'; object_id?: string; at: string }
  | { type: 'cancel'; at: string }
  | { type: 'partial_complete'; missing_object_ids: readonly string[]; at: string }
  | { type: 'succeed'; at: string };

export type StorageJobTransitionErrorCode =
  | 'illegal_transition'
  | 'invalid_job'
  | 'invalid_checkpoint'
  | 'invalid_verification'
  | 'verification_incomplete'
  | 'invalid_partial';

export class StorageJobTransitionError extends Error {
  readonly code: StorageJobTransitionErrorCode;
  readonly state: StorageJobState;
  readonly eventType: StorageJobEvent['type'];

  constructor(
    code: StorageJobTransitionErrorCode,
    job: StorageJob,
    event: StorageJobEvent,
    message: string,
  ) {
    super(message);
    this.name = 'StorageJobTransitionError';
    this.code = code;
    this.state = job.state;
    this.eventType = event.type;
  }
}

const TERMINAL_STATES = new Set<StorageJobState>([
  'cancelled',
  'succeeded',
  'partial',
  'failed',
]);

function fail(
  code: StorageJobTransitionErrorCode,
  job: StorageJob,
  event: StorageJobEvent,
  message: string,
): never {
  throw new StorageJobTransitionError(code, job, event, message);
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isStrongEvidence(value: { kind: string }): boolean {
  const candidate = value as {
    kind: string;
    ciphertextHash?: unknown;
    algorithm?: unknown;
    value?: unknown;
  };
  if (candidate.kind === 'read_back') {
    return typeof candidate.ciphertextHash === 'string'
      && /^[a-f0-9]{128}$/.test(candidate.ciphertextHash);
  }
  if (candidate.kind === 'provider_checksum') {
    return typeof candidate.algorithm === 'string'
      && candidate.algorithm.trim().length > 0
      && typeof candidate.value === 'string'
      && candidate.value.trim().length > 0;
  }
  return false;
}

function validateJob(job: StorageJob, event: StorageJobEvent): void {
  const counters = [
    job.total_objects,
    job.completed_objects,
    job.total_bytes,
    job.completed_bytes,
    job.attempts,
  ];
  if (!counters.every(isNonNegativeInteger)) {
    fail('invalid_job', job, event, 'job counters must be non-negative safe integers');
  }
  if (job.completed_objects > job.total_objects || job.completed_bytes > job.total_bytes) {
    fail('invalid_job', job, event, 'job completed counters exceed totals');
  }
  const uniqueRequired = new Set(job.required_object_ids);
  if (
    uniqueRequired.size !== job.required_object_ids.length
    || uniqueRequired.has(STORAGE_MANIFEST_OBJECT_ID)
    || job.required_object_ids.length !== job.total_objects
  ) {
    fail('invalid_job', job, event, 'required object ids must be unique and match total_objects');
  }
  const verifiedIds = new Set<string>();
  for (const verified of job.verified_objects) {
    if (!uniqueRequired.has(verified.object_id) || verifiedIds.has(verified.object_id)) {
      fail('invalid_job', job, event, 'verified objects must be unique required objects');
    }
    if (!isStrongEvidence(verified.verification)) {
      fail('invalid_job', job, event, 'verification evidence is malformed or absent');
    }
    verifiedIds.add(verified.object_id);
  }
  if (job.manifest_verification !== null && !isStrongEvidence(job.manifest_verification)) {
    fail('invalid_job', job, event, 'manifest verification evidence is malformed or absent');
  }
}

function phaseAfterCheckpoint(job: StorageJob, objects: number, bytes: number): StorageJobPhase {
  return objects === job.total_objects && bytes === job.total_bytes ? 'verifying' : 'writing';
}

function requireState(job: StorageJob, event: StorageJobEvent, state: StorageJobState): void {
  if (job.state !== state) {
    fail('illegal_transition', job, event, `${event.type} requires ${state}, received ${job.state}`);
  }
}

function requireVerifying(job: StorageJob, event: StorageJobEvent): void {
  requireState(job, event, 'running');
  if (job.phase !== 'verifying') {
    fail('illegal_transition', job, event, `${event.type} requires the verifying phase`);
  }
}

function expectedMissingObjectIds(job: StorageJob): string[] {
  const verified = new Set(job.verified_objects.map((item) => item.object_id));
  const missing = job.required_object_ids.filter((id) => !verified.has(id));
  if (job.manifest_verification === null) missing.push(STORAGE_MANIFEST_OBJECT_ID);
  return [...missing].sort();
}

export function reduceStorageJob(job: StorageJob, event: StorageJobEvent): StorageJob {
  validateJob(job, event);
  if (TERMINAL_STATES.has(job.state)) {
    fail('illegal_transition', job, event, `${job.state} is terminal`);
  }

  switch (event.type) {
    case 'start': {
      requireState(job, event, 'queued');
      const phase = job.phase
        ?? phaseAfterCheckpoint(job, job.completed_objects, job.completed_bytes);
      return { ...job, state: 'running', phase, updated_at: event.at };
    }
    case 'checkpoint': {
      requireState(job, event, 'running');
      if (job.phase !== 'writing') {
        fail('illegal_transition', job, event, 'checkpoint requires the writing phase');
      }
      if (
        !isNonNegativeInteger(event.completed_objects)
        || !isNonNegativeInteger(event.completed_bytes)
        || (event.completed_objects === 0 && event.completed_bytes === 0)
      ) {
        fail('invalid_checkpoint', job, event, 'checkpoint increments must be bounded positive progress');
      }
      const completedObjects = job.completed_objects + event.completed_objects;
      const completedBytes = job.completed_bytes + event.completed_bytes;
      if (completedObjects > job.total_objects || completedBytes > job.total_bytes) {
        fail('invalid_checkpoint', job, event, 'checkpoint exceeds declared totals');
      }
      return {
        ...job,
        phase: phaseAfterCheckpoint(job, completedObjects, completedBytes),
        completed_objects: completedObjects,
        completed_bytes: completedBytes,
        cursor_json: event.cursor_json,
        updated_at: event.at,
      };
    }
    case 'pause': {
      requireState(job, event, 'running');
      return { ...job, state: 'paused', updated_at: event.at };
    }
    case 'resume': {
      requireState(job, event, 'paused');
      if (job.phase === null) {
        fail('invalid_job', job, event, 'paused jobs must preserve their phase');
      }
      return { ...job, state: 'running', updated_at: event.at };
    }
    case 'retryable_error': {
      requireState(job, event, 'running');
      if (job.phase === null) {
        fail('invalid_job', job, event, 'running jobs must have a phase');
      }
      return {
        ...job,
        state: event.retry_state,
        attempts: job.attempts + 1,
        last_error_code: event.error_code,
        cursor_json: event.cursor_json ?? job.cursor_json,
        updated_at: event.at,
      };
    }
    case 'verify_pass': {
      requireVerifying(job, event);
      if (!isStrongEvidence(event.verification)) {
        fail('invalid_verification', job, event, 'verification evidence is malformed or absent');
      }
      if (event.target.kind === 'manifest') {
        if (job.manifest_verification !== null) {
          fail('invalid_verification', job, event, 'manifest is already verified');
        }
        return {
          ...job,
          manifest_verification: event.verification,
          last_error_code: null,
          updated_at: event.at,
        };
      }
      const objectId = event.target.object_id;
      if (!job.required_object_ids.includes(objectId)) {
        fail('invalid_verification', job, event, 'object is not required by this job');
      }
      if (job.verified_objects.some((item) => item.object_id === objectId)) {
        fail('invalid_verification', job, event, 'object is already verified');
      }
      return {
        ...job,
        verified_objects: [
          ...job.verified_objects,
          { object_id: objectId, verification: event.verification },
        ],
        last_error_code: null,
        updated_at: event.at,
      };
    }
    case 'verify_fail': {
      requireVerifying(job, event);
      if (
        event.object_id !== undefined
        && event.object_id !== STORAGE_MANIFEST_OBJECT_ID
        && !job.required_object_ids.includes(event.object_id)
      ) {
        fail('invalid_verification', job, event, 'failed verification target is not required');
      }
      return {
        ...job,
        state: 'failed',
        phase: null,
        last_error_code: 'corrupt_ciphertext',
        updated_at: event.at,
      };
    }
    case 'cancel': {
      if (job.state !== 'queued' && job.state !== 'running' && job.state !== 'paused') {
        fail('illegal_transition', job, event, `cannot cancel from ${job.state}`);
      }
      return { ...job, state: 'cancelled', phase: null, updated_at: event.at };
    }
    case 'partial_complete': {
      requireVerifying(job, event);
      const supplied = [...event.missing_object_ids].sort();
      const expected = expectedMissingObjectIds(job);
      if (
        supplied.length === 0
        || new Set(supplied).size !== supplied.length
        || supplied.length !== expected.length
        || supplied.some((id, index) => id !== expected[index])
      ) {
        fail('invalid_partial', job, event, 'partial completion must list every and only missing object');
      }
      return {
        ...job,
        state: 'partial',
        phase: null,
        cursor_json: JSON.stringify({ missingObjectIds: supplied }),
        updated_at: event.at,
      };
    }
    case 'succeed': {
      requireVerifying(job, event);
      if (
        job.completed_objects !== job.total_objects
        || job.completed_bytes !== job.total_bytes
        || expectedMissingObjectIds(job).length !== 0
      ) {
        fail(
          'verification_incomplete',
          job,
          event,
          'success requires verified evidence for every object and the manifest',
        );
      }
      return {
        ...job,
        state: 'succeeded',
        phase: null,
        last_error_code: null,
        updated_at: event.at,
      };
    }
  }
}
