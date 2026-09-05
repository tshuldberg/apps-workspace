import type { DatabaseAdapter } from '@mylife/db';
import { sha512Hex } from '../node/hkdf';
import {
  insertStorageJob,
  listStorageBackups,
  listStorageObjects,
  updateStorageBackupState,
  updateStorageJob,
  updateStorageObjectState,
  upsertStorageObject,
  type StorageDestinationRow,
  type StorageJobRow,
  type StorageObjectRow,
} from './schema';
import { remoteBackupManifestObjectId, remoteBackupPrefix } from './remote-backups';
import {
  StorageAdapterError,
  type StorageDestinationAdapter,
  type StorageResumeToken,
  type StorageWriteResult,
} from './types';

const MAXIMUM_RESUME_STEPS = 10_000;

export type RepairImpossibleCode = 'no_verified_copy' | 'target_unavailable';

export interface RepairPlanItem {
  object: StorageObjectRow;
  source: StorageObjectRow;
}

export interface RepairImpossibleItem {
  object: StorageObjectRow;
  code: RepairImpossibleCode;
}

export interface StorageRepairPlan {
  items: RepairPlanItem[];
  impossible: RepairImpossibleItem[];
}

export interface PlanRepairJobInput {
  objects: readonly StorageObjectRow[];
  destinations: readonly StorageDestinationRow[];
  targetDestinationId?: string;
}

export type RepairOutcomeCode = RepairImpossibleCode
  | 'source_unavailable'
  | 'source_corrupt'
  | 'target_unavailable'
  | 'target_write_failed'
  | 'target_verification_failed';

export interface RepairObjectOutcome {
  objectId: string;
  destinationId: string;
  sourceDestinationId: string | null;
  status: 'repaired' | 'failed' | 'impossible';
  code: RepairOutcomeCode | null;
}

export interface RepairJobReport {
  planned: number;
  repaired: number;
  failed: number;
  impossible: number;
  backupsReverified: number;
  complete: boolean;
  jobs: StorageJobRow[];
  outcomes: RepairObjectOutcome[];
}

export interface RunRepairJobInput {
  db: DatabaseAdapter;
  plan: StorageRepairPlan;
  resolveAdapter(destinationId: string): StorageDestinationAdapter | null;
  now(): string;
  random(): string;
}

export function planRepairJob(input: PlanRepairJobInput): StorageRepairPlan {
  const destinations = new Map(input.destinations.map((destination) => [destination.id, destination]));
  const items: RepairPlanItem[] = [];
  const impossible: RepairImpossibleItem[] = [];
  const verifiedByObject = new Map<string, Map<string, StorageObjectRow>>();
  for (const candidate of input.objects) {
    if (candidate.state !== 'verified'
      || !destinationCanSource(destinations.get(candidate.destination_id))) continue;
    const key = repairCopyKey(candidate);
    const byDestination = verifiedByObject.get(key) ?? new Map<string, StorageObjectRow>();
    const current = byDestination.get(candidate.destination_id);
    if (current === undefined || compareSource(candidate, current, destinations) < 0) {
      byDestination.set(candidate.destination_id, candidate);
    }
    verifiedByObject.set(key, byDestination);
  }
  const rankedSources = new Map<string, StorageObjectRow[]>();
  for (const [key, byDestination] of verifiedByObject) {
    rankedSources.set(key, [...byDestination.values()].sort((left, right) => (
      compareSource(left, right, destinations)
    )));
  }
  const targets = input.objects.filter((row) => (row.state === 'missing' || row.state === 'error')
    && (input.targetDestinationId === undefined || row.destination_id === input.targetDestinationId))
    .sort((left, right) => left.destination_id.localeCompare(right.destination_id)
      || left.object_id.localeCompare(right.object_id));

  for (const object of targets) {
    const target = destinations.get(object.destination_id);
    if (target === undefined || target.state === 'revoked' || target.state === 'error') {
      impossible.push({ object, code: 'target_unavailable' });
      continue;
    }
    const sources = rankedSources.get(repairCopyKey(object)) ?? [];
    const source = sources[0]?.destination_id === object.destination_id ? sources[1] : sources[0];
    if (source === undefined) impossible.push({ object, code: 'no_verified_copy' });
    else items.push({ object, source });
  }
  return { items, impossible };
}

function repairCopyKey(row: StorageObjectRow): string {
  return JSON.stringify([row.object_id, row.ciphertext_hash, row.encrypted_bytes]);
}

function compareSource(
  left: StorageObjectRow,
  right: StorageObjectRow,
  destinations: ReadonlyMap<string, StorageDestinationRow>,
): number {
  return sourceRank(destinations.get(left.destination_id))
    - sourceRank(destinations.get(right.destination_id))
    || left.destination_id.localeCompare(right.destination_id)
    || (left.remote_ref ?? '').localeCompare(right.remote_ref ?? '');
}

export async function runRepairJob(input: RunRepairJobInput): Promise<RepairJobReport> {
  const outcomes: RepairObjectOutcome[] = input.plan.impossible.map(({ object, code }) => ({
    objectId: object.object_id,
    destinationId: object.destination_id,
    sourceDestinationId: null,
    status: 'impossible',
    code,
  }));
  const jobs: StorageJobRow[] = [];
  const byDestination = new Map<string, RepairPlanItem[]>();
  for (const item of input.plan.items) {
    const group = byDestination.get(item.object.destination_id) ?? [];
    group.push(item);
    byDestination.set(item.object.destination_id, group);
  }

  for (const [destinationId, items] of byDestination) {
    const job = createJob(destinationId, items, input.now(), input.random());
    insertStorageJob(input.db, job);
    job.state = 'running';
    job.attempts = 1;
    job.updated_at = input.now();
    updateStorageJob(input.db, job);
    for (const item of items) {
      const outcome = await repairObject(input, item);
      outcomes.push(outcome);
      if (outcome.status === 'repaired') {
        job.completed_objects += 1;
        job.completed_bytes += item.object.encrypted_bytes;
      } else {
        job.last_error_code = outcome.code;
      }
      job.updated_at = input.now();
      updateStorageJob(input.db, job);
    }
    const repaired = outcomes.filter((outcome) => outcome.destinationId === destinationId
      && outcome.status === 'repaired').length;
    job.state = repaired === items.length ? 'succeeded' : repaired > 0 ? 'partial' : 'failed';
    job.updated_at = input.now();
    updateStorageJob(input.db, job);
    jobs.push({ ...job });
  }

  const repaired = outcomes.filter((outcome) => outcome.status === 'repaired').length;
  const failed = outcomes.filter((outcome) => outcome.status === 'failed').length;
  const impossible = outcomes.filter((outcome) => outcome.status === 'impossible').length;
  const backupsReverified = reverifyRepairedBackups(input.db, outcomes, input.now());
  return {
    planned: outcomes.length,
    repaired,
    failed,
    impossible,
    backupsReverified,
    complete: failed === 0 && impossible === 0,
    jobs,
    outcomes,
  };
}

function reverifyRepairedBackups(
  db: DatabaseAdapter,
  outcomes: readonly RepairObjectOutcome[],
  now: string,
): number {
  const repairedDestinations = new Set(outcomes
    .filter((outcome) => outcome.status === 'repaired')
    .map((outcome) => outcome.destinationId));
  let count = 0;
  for (const destinationId of repairedDestinations) {
    const objects = listStorageObjects(db, destinationId);
    for (const backup of listStorageBackups(db, destinationId)) {
      if (backup.state === 'deleted') continue;
      const prefix = remoteBackupPrefix(backup.backup_id);
      const rows = objects.filter((row) => row.object_id.startsWith(prefix) && row.state !== 'deleted');
      const manifest = rows.find((row) => row.object_id === remoteBackupManifestObjectId(backup.backup_id));
      if (manifest?.ciphertext_hash !== backup.manifest_ciphertext_hash
        || rows.length !== backup.object_count + 1
        || rows.some((row) => row.state !== 'verified')) continue;
      if (backup.state !== 'complete') {
        updateStorageBackupState(db, backup.backup_id, destinationId, 'complete', backup.completed_at ?? now);
        count += 1;
      }
    }
  }
  return count;
}

async function repairObject(
  input: RunRepairJobInput,
  item: RepairPlanItem,
): Promise<RepairObjectOutcome> {
  const base = {
    objectId: item.object.object_id,
    destinationId: item.object.destination_id,
    sourceDestinationId: item.source.destination_id,
  };
  const sourceAdapter = input.resolveAdapter(item.source.destination_id);
  if (sourceAdapter === null) return { ...base, status: 'failed', code: 'source_unavailable' };
  const targetAdapter = input.resolveAdapter(item.object.destination_id);
  if (targetAdapter === null) return { ...base, status: 'failed', code: 'target_unavailable' };

  let bytes: Uint8Array | null;
  try {
    bytes = await sourceAdapter.getObject({
      objectId: item.source.object_id,
      ...(item.source.remote_ref === null ? {} : { remoteRef: item.source.remote_ref }),
    });
  } catch {
    return { ...base, status: 'failed', code: 'source_unavailable' };
  }
  if (bytes === null || bytes.length !== item.source.encrypted_bytes
    || sha512Hex(bytes) !== item.source.ciphertext_hash) {
    return { ...base, status: 'failed', code: 'source_corrupt' };
  }

  try {
    const result = await putComplete(targetAdapter, {
      objectId: item.object.object_id,
      dataClass: item.object.data_class,
      ciphertext: bytes,
      ciphertextHash: item.object.ciphertext_hash,
      encryptedBytes: item.object.encrypted_bytes,
    });
    const readBack = await targetAdapter.getObject({
      objectId: item.object.object_id,
      remoteRef: result.remoteRef,
    });
    if (readBack === null || readBack.length !== bytes.length
      || sha512Hex(readBack) !== item.object.ciphertext_hash) {
      updateStorageObjectState(input.db, item.object.object_id, item.object.destination_id, 'error');
      return { ...base, status: 'failed', code: 'target_verification_failed' };
    }
    upsertStorageObject(input.db, {
      ...item.object,
      remote_ref: result.remoteRef,
      remote_version: result.remoteVersion,
      state: 'verified',
      last_verified_at: input.now(),
    });
    return { ...base, status: 'repaired', code: null };
  } catch {
    updateStorageObjectState(input.db, item.object.object_id, item.object.destination_id, 'error');
    return { ...base, status: 'failed', code: 'target_write_failed' };
  } finally {
    bytes.fill(0);
  }
}

async function putComplete(
  adapter: StorageDestinationAdapter,
  object: Parameters<StorageDestinationAdapter['putObject']>[0],
): Promise<Extract<StorageWriteResult, { complete: true }>> {
  let resume: StorageResumeToken | undefined;
  let lastOffset = -1;
  for (let step = 0; step < MAXIMUM_RESUME_STEPS; step += 1) {
    const result = await adapter.putObject(object, resume);
    if (result.complete) return result;
    if (result.resumeToken.offset <= lastOffset) {
      throw new StorageAdapterError('provider_error', 'repair upload made no progress', false);
    }
    lastOffset = result.resumeToken.offset;
    resume = result.resumeToken;
  }
  throw new StorageAdapterError('provider_error', 'repair upload exceeded its resume bound', false);
}

function createJob(
  destinationId: string,
  items: readonly RepairPlanItem[],
  now: string,
  random: string,
): StorageJobRow {
  const totalBytes = items.reduce((total, item) => total + item.object.encrypted_bytes, 0);
  if (!Number.isSafeInteger(totalBytes)) throw new Error('repair byte total exceeds the safe integer range');
  return {
    id: `storage-repair-${random}`,
    kind: 'repair',
    destination_id: destinationId,
    state: 'queued',
    cursor_json: null,
    total_objects: items.length,
    completed_objects: 0,
    total_bytes: totalBytes,
    completed_bytes: 0,
    attempts: 0,
    last_error_code: null,
    created_at: now,
    updated_at: now,
  };
}

function destinationCanSource(destination: StorageDestinationRow | undefined): boolean {
  return destination !== undefined && destination.state !== 'revoked' && destination.state !== 'error';
}

function sourceRank(destination: StorageDestinationRow | undefined): number {
  return destination?.kind === 'local_device' ? 0 : 1;
}
