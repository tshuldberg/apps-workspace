/**
 * Crash-safe, cross-process ObjectReferenceLedger for self-host file mode.
 *
 * The whole register is a small serializable snapshot (key -> referrer set), so unlike
 * the object store's byte files this adapter keeps the entire register in one JSON
 * ledger replaced atomically under an exclusive lock, exactly as
 * FileCommunityPrivateStateStore keeps its state file and ObjectStoreStateMachine
 * backs FileObjectStore. Reference edges are metadata, never bytes, so the whole-store
 * rewrite is O(references) and bounded by the deployment's live object count.
 *
 * Crash-safety: every mutation reads the ledger, applies the pure state machine, and
 * writes a temp file (fsync + rename) BEFORE returning. A crash mid-write leaves the
 * previous ledger intact (the temp file is discarded); a corrupt ledger fails closed
 * and is never read as an empty register, so a fault can never zero out reference
 * counts and trigger wrong deletions.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import {
  toObjectReferenceLedgerUnavailableError,
  type AddReferenceResult,
  type ObjectReference,
  type ObjectReferenceLedger,
  type RemoveReferenceResult,
  type UnreferencedCursor,
  type UnreferencedPage,
} from './object-reference-ledger';
import {
  emptyObjectReferenceLedger,
  ObjectReferenceLedgerStateMachine,
  type ObjectReferenceLedgerSnapshot,
} from './object-reference-ledger-memory';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateSnapshot(value: unknown): asserts value is ObjectReferenceLedgerSnapshot {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.records)) {
    throw new Error('FileObjectReferenceLedger: reference ledger is corrupt');
  }
}

export class FileObjectReferenceLedger implements ObjectReferenceLedger {
  private readonly ledgerFile: string;
  private readonly lockFile: string;
  private readonly tmpDir: string;

  constructor(baseDir: string, private readonly now: () => number = () => Date.now()) {
    this.ledgerFile = path.join(baseDir, 'object-reference-ledger.json');
    this.lockFile = path.join(baseDir, '.object-reference-ledger.lock');
    this.tmpDir = path.join(baseDir, 'tmp');
  }

  private async readSnapshot(): Promise<ObjectReferenceLedgerSnapshot> {
    try {
      const parsed: unknown = JSON.parse(await fs.readFile(this.ledgerFile, 'utf8'));
      validateSnapshot(parsed);
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyObjectReferenceLedger();
      if (error instanceof SyntaxError) {
        throw new Error('FileObjectReferenceLedger: reference ledger is corrupt', { cause: error });
      }
      throw error;
    }
  }

  private async writeSnapshot(snapshot: ObjectReferenceLedgerSnapshot): Promise<void> {
    await fs.mkdir(path.dirname(this.ledgerFile), { recursive: true });
    await fs.mkdir(this.tmpDir, { recursive: true });
    const tmp = path.join(
      this.tmpDir,
      `refs.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`,
    );
    const handle = await fs.open(tmp, 'w', 0o600);
    try {
      await handle.writeFile(JSON.stringify(snapshot), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmp, this.ledgerFile);
  }

  private withLock<T>(operation: () => Promise<T>): Promise<T> {
    return withExclusiveFileLock(this.lockFile, operation, { timeoutMs: 30_000 });
  }

  /** Loads the snapshot into a fresh machine bound to this adapter's clock. */
  private machine(snapshot: ObjectReferenceLedgerSnapshot): ObjectReferenceLedgerStateMachine {
    return new ObjectReferenceLedgerStateMachine(snapshot, this.now);
  }

  private async mutate<T>(
    operation: 'add reference' | 'remove reference',
    apply: (machine: ObjectReferenceLedgerStateMachine) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.withLock(async () => {
        const machine = this.machine(await this.readSnapshot());
        const result = await apply(machine);
        await this.writeSnapshot(machine.snapshot());
        return result;
      });
    } catch (error) {
      // Boundary validation is a caller error, not a store fault: let it propagate as-is.
      if (error instanceof TypeError) throw error;
      throw toObjectReferenceLedgerUnavailableError(operation, error);
    }
  }

  private async read<T>(
    operation: string,
    apply: (machine: ObjectReferenceLedgerStateMachine) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.withLock(async () => apply(this.machine(await this.readSnapshot())));
    } catch (error) {
      if (error instanceof TypeError) throw error;
      throw toObjectReferenceLedgerUnavailableError(operation, error);
    }
  }

  addReference(reference: ObjectReference): Promise<AddReferenceResult> {
    return this.mutate('add reference', (machine) => machine.addReference(reference));
  }

  removeReference(reference: ObjectReference): Promise<RemoveReferenceResult> {
    return this.mutate('remove reference', (machine) => machine.removeReference(reference));
  }

  isReferenced(objectKey: string): Promise<boolean> {
    return this.read('is referenced', (machine) => machine.isReferenced(objectKey));
  }

  referenceCount(objectKey: string): Promise<number> {
    return this.read('reference count', (machine) => machine.referenceCount(objectKey));
  }

  listReferrers(objectKey: string): Promise<string[]> {
    return this.read('list referrers', (machine) => machine.listReferrers(objectKey));
  }

  listUnreferenced(input: {
    after?: UnreferencedCursor;
    limit: number;
  }): Promise<UnreferencedPage> {
    return this.read('list unreferenced', (machine) => machine.listUnreferenced(input));
  }
}
