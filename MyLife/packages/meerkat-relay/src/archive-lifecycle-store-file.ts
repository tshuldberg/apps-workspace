/**
 * Crash-safe, cross-process archive lifecycle store for self-host file mode.
 *
 * The full ledger is replaced atomically while one lease file serializes writers.
 * A corrupt ledger fails closed. It is never interpreted as an empty archive.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './community-node';
import { withExclusiveFileLock } from './file-lock';
import {
  ArchiveLifecycleStateMachine,
  emptyArchiveLifecycleLedger,
  type ArchiveDurableObjectInput,
  type ArchiveDeleteObjectInput,
  type ArchiveEnqueueInput,
  type ArchiveEnqueueResult,
  type ArchiveHostCursor,
  type ArchiveHostPage,
  type ArchivePinCursor,
  type ArchivePinPage,
  type ArchiveJobClaim,
  type ArchiveJobClaimInput,
  type ArchiveJobRecord,
  type ArchiveLeaseInput,
  type ArchiveLifecycleLedger,
  type ArchiveLifecycleStore,
  type ArchiveObjectRecord,
  type ArchiveObjectDeletionResult,
  type ArchivePinInput,
  type ArchivePinRecord,
  type ArchiveQuarantineObjectInput,
  type ArchiveRemovalInput,
  type ArchiveScanCompletionInput,
  type ArchiveScanRecord,
} from './archive-lifecycle';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLedger(value: unknown): asserts value is ArchiveLifecycleLedger {
  if (!isRecord(value) || value.version !== 1
    || !isRecord(value.jobs) || !isRecord(value.idempotency)
    || !isRecord(value.objects) || !isRecord(value.scans) || !isRecord(value.pins)) {
    throw new Error('FileArchiveLifecycleStore: archive ledger is corrupt');
  }
}

export class FileArchiveLifecycleStore implements ArchiveLifecycleStore {
  private readonly ledgerFile: string;
  private readonly lockFile: string;

  constructor(baseDir: string) {
    this.ledgerFile = path.join(baseDir, 'archive-lifecycle.json');
    this.lockFile = path.join(baseDir, '.archive-lifecycle.lock');
  }

  private async readMachine(): Promise<ArchiveLifecycleStateMachine> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.ledgerFile, 'utf8'));
      validateLedger(parsed);
      return new ArchiveLifecycleStateMachine(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return new ArchiveLifecycleStateMachine(emptyArchiveLifecycleLedger());
      }
      if (error instanceof SyntaxError) {
        throw new Error('FileArchiveLifecycleStore: archive ledger is corrupt', { cause: error });
      }
      throw error;
    }
  }

  private withRead<T>(operation: (machine: ArchiveLifecycleStateMachine) => T): Promise<T> {
    return withExclusiveFileLock(this.lockFile, async () => operation(await this.readMachine()));
  }

  private withMutation<T>(operation: (machine: ArchiveLifecycleStateMachine) => T): Promise<T> {
    return withExclusiveFileLock(this.lockFile, async () => {
      const machine = await this.readMachine();
      const result = operation(machine);
      await atomicWriteFile(this.ledgerFile, JSON.stringify(machine.snapshot()));
      return result;
    });
  }

  enqueue(input: ArchiveEnqueueInput): Promise<ArchiveEnqueueResult> {
    return this.withMutation((machine) => machine.enqueue(input));
  }

  getJob(jobId: string): Promise<ArchiveJobRecord | null> {
    return this.withRead((machine) => machine.getJob(jobId));
  }

  usedBytesForOwner(ownerSubjectHashHex: string): Promise<number> {
    return this.withRead((machine) => machine.usedBytesForOwner(ownerSubjectHashHex));
  }

  recordQuarantineObject(input: ArchiveQuarantineObjectInput): Promise<ArchiveObjectRecord | null> {
    return this.withMutation((machine) => machine.recordQuarantineObject(input));
  }

  listObjects(jobId: string): Promise<ArchiveObjectRecord[]> {
    return this.withRead((machine) => machine.listObjects(jobId));
  }

  listObjectsForContent(contentId: string): Promise<ArchiveObjectRecord[]> {
    return this.withRead((machine) => machine.listObjectsForContent(contentId));
  }

  markQuarantined(
    jobId: string,
    expectedJobVersion: number,
    nowMs: number,
  ): Promise<ArchiveJobRecord | null> {
    return this.withMutation((machine) => machine.markQuarantined(jobId, expectedJobVersion, nowMs));
  }

  claimJobs(input: ArchiveJobClaimInput): Promise<ArchiveJobClaim[]> {
    return this.withMutation((machine) => machine.claimJobs(input));
  }

  completeScan(input: ArchiveScanCompletionInput): Promise<ArchiveJobRecord | null> {
    return this.withMutation((machine) => machine.completeScan(input));
  }

  listScans(jobId: string, limit?: number): Promise<ArchiveScanRecord[]> {
    return this.withRead((machine) => machine.listScans(jobId, limit));
  }

  markObjectDurable(input: ArchiveDurableObjectInput): Promise<ArchiveObjectRecord | null> {
    return this.withMutation((machine) => machine.markObjectDurable(input));
  }

  markObjectDeleted(input: ArchiveDeleteObjectInput): Promise<ArchiveObjectDeletionResult> {
    return this.withMutation((machine) => machine.markObjectDeleted(input));
  }

  activatePin(input: ArchivePinInput): Promise<ArchivePinRecord | null> {
    return this.withMutation((machine) => machine.activatePin(input));
  }

  markAnnounced(input: ArchiveLeaseInput): Promise<ArchiveJobRecord | null> {
    return this.withMutation((machine) => machine.markAnnounced(input));
  }

  requestTakedown(jobId: string, nowMs: number): Promise<ArchiveJobRecord | null> {
    return this.withMutation((machine) => machine.requestTakedown(jobId, nowMs));
  }

  confirmRemoval(input: ArchiveRemovalInput): Promise<ArchiveJobRecord | null> {
    return this.withMutation((machine) => machine.confirmRemoval(input));
  }

  isServeable(publicationId: string, hostId: string): Promise<boolean> {
    return this.withRead((machine) => machine.isServeable(publicationId, hostId));
  }

  listActiveHosts(
    publicationId: string,
    options?: { limit?: number; cursor?: ArchiveHostCursor },
  ): Promise<ArchiveHostPage> {
    return this.withRead((machine) => machine.listActiveHosts(publicationId, options));
  }

  listPinsForHost(
    hostId: string,
    options?: { limit?: number; cursor?: ArchivePinCursor },
  ): Promise<ArchivePinPage> {
    return this.withRead((machine) => machine.listPinsForHost(hostId, options));
  }
}
