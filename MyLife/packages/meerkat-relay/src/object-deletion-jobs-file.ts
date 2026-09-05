/**
 * Crash-safe, cross-process ObjectDeletionJobStore for self-host file mode.
 *
 * The queue is a small serializable ledger (key -> job record), replaced atomically
 * under an exclusive lock, reusing the pure ObjectDeletionJobStateMachine exactly as
 * FileObjectReferenceLedger reuses its state machine. Every mutation reads the ledger,
 * applies the machine, and writes a temp file (fsync + rename) before returning; a
 * crash mid-write leaves the prior ledger intact and a corrupt ledger fails closed,
 * so a fault can never resurrect a deleted job or drop a poison finding.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import {
  toObjectDeletionJobUnavailableError,
  type ClaimObjectDeletionsInput,
  type CommitObjectDeletionResult,
  type CompleteObjectDeletionInput,
  type EnqueueObjectDeletionResult,
  type ObjectDeletionCursor,
  type ObjectDeletionJob,
  type ObjectDeletionJobStore,
  type ObjectDeletionLease,
  type ObjectDeletionPage,
  type PoisonObjectDeletionInput,
  type RescheduleObjectDeletionInput,
} from './object-deletion-jobs';
import {
  emptyObjectDeletionJobLedger,
  ObjectDeletionJobStateMachine,
  type ObjectDeletionJobLedger,
} from './object-deletion-jobs-memory';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateLedger(value: unknown): asserts value is ObjectDeletionJobLedger {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.jobs)) {
    throw new Error('FileObjectDeletionJobStore: deletion ledger is corrupt');
  }
}

export class FileObjectDeletionJobStore implements ObjectDeletionJobStore {
  private readonly ledgerFile: string;
  private readonly lockFile: string;
  private readonly tmpDir: string;

  constructor(baseDir: string) {
    this.ledgerFile = path.join(baseDir, 'object-deletion-jobs.json');
    this.lockFile = path.join(baseDir, '.object-deletion-jobs.lock');
    this.tmpDir = path.join(baseDir, 'tmp');
  }

  private async readLedger(): Promise<ObjectDeletionJobLedger> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.ledgerFile, 'utf8'));
      validateLedger(parsed);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyObjectDeletionJobLedger();
      if (error instanceof SyntaxError) {
        throw new Error('FileObjectDeletionJobStore: deletion ledger is corrupt', { cause: error });
      }
      throw error;
    }
  }

  private async writeLedger(ledger: ObjectDeletionJobLedger): Promise<void> {
    await fs.mkdir(path.dirname(this.ledgerFile), { recursive: true });
    await fs.mkdir(this.tmpDir, { recursive: true });
    const tmp = path.join(
      this.tmpDir,
      `deljobs.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    const handle = await fs.open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(ledger), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.ledgerFile);
  }

  private withLock<T>(operation: () => Promise<T>): Promise<T> {
    return withExclusiveFileLock(this.lockFile, operation, { timeoutMs: 30_000 });
  }

  private async mutate<T>(
    operation: string,
    apply: (machine: ObjectDeletionJobStateMachine) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.withLock(async () => {
        const machine = new ObjectDeletionJobStateMachine(await this.readLedger());
        const result = await apply(machine);
        await this.writeLedger(machine.snapshot());
        return result;
      });
    } catch (error) {
      // Boundary validation is a caller error, not a store fault: let it propagate as-is.
      if (error instanceof TypeError) throw error;
      throw toObjectDeletionJobUnavailableError(operation, error);
    }
  }

  private async read<T>(
    operation: string,
    apply: (machine: ObjectDeletionJobStateMachine) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.withLock(async () =>
        apply(new ObjectDeletionJobStateMachine(await this.readLedger())));
    } catch (error) {
      if (error instanceof TypeError) throw error;
      throw toObjectDeletionJobUnavailableError(operation, error);
    }
  }

  enqueue(objectKey: string, nowMs: number): Promise<EnqueueObjectDeletionResult> {
    return this.mutate('enqueue', (machine) => machine.enqueue(objectKey, nowMs));
  }

  getJob(objectKey: string): Promise<ObjectDeletionJob | null> {
    return this.read('get job', (machine) => machine.getJob(objectKey));
  }

  claim(input: ClaimObjectDeletionsInput): Promise<ObjectDeletionLease[]> {
    return this.mutate('claim', (machine) => machine.claim(input));
  }

  complete(input: CompleteObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    return this.mutate('complete', (machine) => machine.complete(input));
  }

  reschedule(input: RescheduleObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    return this.mutate('reschedule', (machine) => machine.reschedule(input));
  }

  poison(input: PoisonObjectDeletionInput): Promise<CommitObjectDeletionResult> {
    return this.mutate('poison', (machine) => machine.poison(input));
  }

  listPoison(input: {
    after?: ObjectDeletionCursor;
    limit: number;
  }): Promise<ObjectDeletionPage> {
    return this.read('list poison', (machine) => machine.listPoison(input));
  }
}
