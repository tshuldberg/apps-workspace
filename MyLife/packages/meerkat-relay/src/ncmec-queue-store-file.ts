/**
 * Durable, restart-safe NcmecReportQueueStore (Plan 39 P13). The first-party node points this at
 * its DATA_DIR volume so queued CSAM report records survive a restart -- a forgotten report is a
 * dropped legal obligation. Filesystem convention matches FilePersonaRegistryStore /
 * FileMeerkatBillingStore (no new deps, atomic rename). Records hold only references (hashes +
 * content-derived ids), never bytes or secrets.
 *
 * Layout under baseDir:
 *   reports/<id>.json     report plus fenced export-claim metadata
 *   order.log             newline-separated ids in enqueue order (newest-first list reads it)
 *   export-completion.pending.json  crash-recovery journal for batch completion
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './community-node';
import { withExclusiveFileLock } from './file-lock';
import { validateNcmecReportRecord } from './ncmec-queue';
import { validateFilingCompletionInput } from './ncmec-queue';
import type {
  NcmecExportClaim,
  NcmecExportClaimInput,
  NcmecExportCompletionInput,
  NcmecFilingClaim,
  NcmecFilingClaimInput,
  NcmecFilingCompletionInput,
  NcmecFilingCompletionResult,
  NcmecQueueCounts,
  NcmecReportQueueStore,
  NcmecReportRecord,
  NcmecReportStatus,
} from './ncmec-queue';

const ID_RE = /^[0-9a-f]{64}$/;
const OWNER_RE = /^[A-Za-z0-9_.:@/-]{1,256}$/u;

interface StoredNcmecEnvelope {
  record: NcmecReportRecord;
  claimOwner?: string;
  claimExpiresAtMs?: number;
  fencingToken: number;
  lifecycleVersion: number;
  /** How many times this record has been claimed for filing (attempt cap lives in the worker). */
  filingAttemptCount?: number;
  /** Earliest ms at which a record may be re-claimed for filing (transient backoff). */
  nextAttemptAtMs?: number;
}

interface PendingNcmecCompletion {
  updates: StoredNcmecEnvelope[];
}

function validateClaimInput(input: NcmecExportClaimInput): void {
  if (!OWNER_RE.test(input.owner)
    || !Number.isSafeInteger(input.limit) || input.limit <= 0 || input.limit > 1000
    || !Number.isSafeInteger(input.leaseMs) || input.leaseMs <= 0
    || input.leaseMs > 24 * 60 * 60 * 1000
    || !Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new TypeError('FileNcmecReportQueueStore: invalid export claim input');
  }
}

function validateFilingClaimInput(input: NcmecFilingClaimInput): void {
  if (!OWNER_RE.test(input.owner)
    || !Number.isSafeInteger(input.limit) || input.limit <= 0 || input.limit > 1000
    || !Number.isSafeInteger(input.leaseMs) || input.leaseMs <= 0
    || input.leaseMs > 24 * 60 * 60 * 1000
    || !Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
    throw new TypeError('FileNcmecReportQueueStore: invalid filing claim input');
  }
}

function validateCompletionInput(input: NcmecExportCompletionInput): void {
  if (!OWNER_RE.test(input.owner)
    || (input.status !== 'exported' && input.status !== 'filed')
    || !Number.isSafeInteger(input.nowMs) || input.nowMs < 0
    || input.claims.length > 1000
    || new Set(input.claims.map((claim) => claim.id)).size !== input.claims.length
    || input.claims.some((claim) => !ID_RE.test(claim.id)
      || !Number.isSafeInteger(claim.fencingToken) || claim.fencingToken <= 0)) {
    throw new TypeError('FileNcmecReportQueueStore: invalid export completion input');
  }
}

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function readEnvelope(file: string): Promise<StoredNcmecEnvelope | null> {
  const parsed = await readJsonFile<StoredNcmecEnvelope | NcmecReportRecord>(file);
  if (!parsed) return null;
  const envelope = 'record' in parsed ? parsed : {
    record: parsed,
    fencingToken: 0,
    lifecycleVersion: 1,
  };
  validateNcmecReportRecord(envelope.record);
  return envelope;
}

export class FileNcmecReportQueueStore implements NcmecReportQueueStore {
  private readonly reportsDir: string;
  private readonly orderFile: string;
  private readonly lockFile: string;
  private readonly completionJournalFile: string;

  constructor(baseDir: string) {
    this.reportsDir = path.join(baseDir, 'reports');
    this.orderFile = path.join(baseDir, 'order.log');
    this.lockFile = path.join(baseDir, '.ncmec-queue.lock');
    this.completionJournalFile = path.join(baseDir, 'export-completion.pending.json');
  }

  private reportFile(id: string): string {
    if (!ID_RE.test(id)) throw new Error('FileNcmecReportQueueStore: invalid report id');
    return path.join(this.reportsDir, `${id}.json`);
  }

  private async readOrder(): Promise<string[]> {
    try {
      return (await fs.readFile(this.orderFile, 'utf8'))
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => ID_RE.test(l));
    } catch {
      return [];
    }
  }

  private async writeEnvelope(envelope: StoredNcmecEnvelope): Promise<void> {
    await atomicWriteFile(
      this.reportFile(envelope.record.id),
      JSON.stringify(envelope),
    );
  }

  private async recoverCompletion(): Promise<void> {
    let pending: PendingNcmecCompletion | null;
    try {
      pending = JSON.parse(
        await fs.readFile(this.completionJournalFile, 'utf8'),
      ) as PendingNcmecCompletion;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    if (!pending || !Array.isArray(pending.updates)) {
      throw new Error('FileNcmecReportQueueStore: invalid export completion journal');
    }
    for (const envelope of pending.updates) await this.writeEnvelope(envelope);
    await fs.rm(this.completionJournalFile, { force: true });
  }

  enqueue(record: NcmecReportRecord): Promise<NcmecReportRecord> {
    validateNcmecReportRecord(record);
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const file = this.reportFile(record.id);
      const existing = await readEnvelope(file);
      if (existing) return structuredClone(existing.record);
      await this.writeEnvelope({
        record: structuredClone(record),
        fencingToken: 0,
        lifecycleVersion: 1,
      });
      await fs.mkdir(path.dirname(this.orderFile), { recursive: true });
      await fs.appendFile(this.orderFile, `${record.id}\n`, 'utf8');
      return structuredClone(record);
    });
  }

  get(id: string): Promise<NcmecReportRecord | null> {
    if (!ID_RE.test(id)) return Promise.resolve(null);
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const envelope = await readEnvelope(this.reportFile(id));
      return envelope ? structuredClone(envelope.record) : null;
    });
  }

  list(filter: { status?: NcmecReportStatus; limit?: number } = {}): Promise<NcmecReportRecord[]> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const bound = Math.max(1, Math.min(1000, Math.floor(filter.limit ?? 200)));
      const order = await this.readOrder();
      const out: NcmecReportRecord[] = [];
      const seen = new Set<string>();
      for (let i = order.length - 1; i >= 0 && out.length < bound; i -= 1) {
        const id = order[i]!;
        if (seen.has(id)) continue;
        seen.add(id);
        const envelope = await readEnvelope(this.reportFile(id));
        if (!envelope) continue;
        if (filter.status && envelope.record.status !== filter.status) continue;
        out.push(structuredClone(envelope.record));
      }
      return out;
    });
  }

  claimQueuedForExport(input: NcmecExportClaimInput): Promise<NcmecExportClaim[]> {
    validateClaimInput(input);
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const bound = Math.max(1, Math.min(1000, Math.floor(input.limit)));
      const claimed: NcmecExportClaim[] = [];
      const seen = new Set<string>();
      for (const id of await this.readOrder()) {
        if (claimed.length >= bound || seen.has(id)) continue;
        seen.add(id);
        const envelope = await readEnvelope(this.reportFile(id));
        if (!envelope || envelope.record.status !== 'queued') continue;
        if (envelope.claimOwner && (envelope.claimExpiresAtMs ?? 0) > input.nowMs) continue;
        const updated: StoredNcmecEnvelope = {
          ...envelope,
          claimOwner: input.owner,
          claimExpiresAtMs: input.nowMs + input.leaseMs,
          fencingToken: envelope.fencingToken + 1,
          lifecycleVersion: envelope.lifecycleVersion + 1,
        };
        await this.writeEnvelope(updated);
        claimed.push({
          record: structuredClone(updated.record),
          fencingToken: updated.fencingToken,
        });
      }
      return claimed;
    });
  }

  completeExportClaims(input: NcmecExportCompletionInput): Promise<boolean> {
    validateCompletionInput(input);
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const updates: StoredNcmecEnvelope[] = [];
      for (const claim of input.claims) {
        const envelope = await readEnvelope(this.reportFile(claim.id));
        if (!envelope || envelope.record.status !== 'queued'
          || envelope.claimOwner !== input.owner
          || envelope.fencingToken !== claim.fencingToken
          || (envelope.claimExpiresAtMs ?? 0) <= input.nowMs) {
          return false;
        }
        updates.push({
          ...envelope,
          record: { ...envelope.record, status: input.status },
          claimOwner: undefined,
          claimExpiresAtMs: undefined,
          lifecycleVersion: envelope.lifecycleVersion + 1,
        });
      }
      if (updates.length === 0) return true;
      await atomicWriteFile(
        this.completionJournalFile,
        JSON.stringify({ updates } satisfies PendingNcmecCompletion),
      );
      for (const envelope of updates) await this.writeEnvelope(envelope);
      await fs.rm(this.completionJournalFile, { force: true });
      return true;
    });
  }

  claimQueuedForFiling(input: NcmecFilingClaimInput): Promise<NcmecFilingClaim[]> {
    validateFilingClaimInput(input);
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const bound = Math.max(1, Math.min(1000, Math.floor(input.limit)));
      const claimed: NcmecFilingClaim[] = [];
      const seen = new Set<string>();
      for (const id of await this.readOrder()) {
        if (claimed.length >= bound || seen.has(id)) continue;
        seen.add(id);
        const envelope = await readEnvelope(this.reportFile(id));
        if (!envelope || envelope.record.status !== 'queued') continue;
        if ((envelope.nextAttemptAtMs ?? 0) > input.nowMs) continue;
        if (envelope.claimOwner && (envelope.claimExpiresAtMs ?? 0) > input.nowMs) continue;
        const filingAttemptCount = (envelope.filingAttemptCount ?? 0) + 1;
        const updated: StoredNcmecEnvelope = {
          ...envelope,
          record: { ...envelope.record, filingAttemptCount },
          claimOwner: input.owner,
          claimExpiresAtMs: input.nowMs + input.leaseMs,
          fencingToken: envelope.fencingToken + 1,
          lifecycleVersion: envelope.lifecycleVersion + 1,
          filingAttemptCount,
        };
        await this.writeEnvelope(updated);
        claimed.push({
          record: structuredClone(updated.record),
          fencingToken: updated.fencingToken,
          filingAttemptCount,
        });
      }
      return claimed;
    });
  }

  completeFiling(input: NcmecFilingCompletionInput): Promise<NcmecFilingCompletionResult> {
    validateFilingCompletionInput(input);
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const envelope = await readEnvelope(this.reportFile(input.id));
      if (!envelope || envelope.record.status !== 'queued'
        || envelope.claimOwner !== input.owner
        || envelope.fencingToken !== input.fencingToken
        || (envelope.claimExpiresAtMs ?? 0) <= input.nowMs) {
        return 'lease_lost';
      }
      const { resolution } = input;
      let updated: StoredNcmecEnvelope;
      if (resolution.kind === 'filed') {
        updated = {
          ...envelope,
          record: {
            ...envelope.record,
            status: 'filed',
            providerRef: resolution.providerRef,
            filedAt: new Date(input.nowMs).toISOString(),
            lastFilingErrorCode: undefined,
          },
          claimOwner: undefined,
          claimExpiresAtMs: undefined,
          nextAttemptAtMs: undefined,
          lifecycleVersion: envelope.lifecycleVersion + 1,
        };
      } else if (resolution.kind === 'escalated') {
        updated = {
          ...envelope,
          record: {
            ...envelope.record,
            status: 'escalated',
            lastFilingErrorCode: resolution.errorCode,
          },
          claimOwner: undefined,
          claimExpiresAtMs: undefined,
          nextAttemptAtMs: undefined,
          lifecycleVersion: envelope.lifecycleVersion + 1,
        };
      } else {
        updated = {
          ...envelope,
          record: { ...envelope.record, lastFilingErrorCode: resolution.errorCode },
          claimOwner: undefined,
          claimExpiresAtMs: undefined,
          nextAttemptAtMs: resolution.nextAttemptAtMs,
          lifecycleVersion: envelope.lifecycleVersion + 1,
        };
      }
      await this.writeEnvelope(updated);
      return 'committed';
    });
  }

  counts(): Promise<NcmecQueueCounts> {
    return withExclusiveFileLock(this.lockFile, async () => {
      await this.recoverCompletion();
      const order = await this.readOrder();
      const counts: NcmecQueueCounts = { queued: 0, exported: 0, filed: 0, escalated: 0, total: 0 };
      const seen = new Set<string>();
      for (const id of order) {
        if (seen.has(id)) continue;
        seen.add(id);
        const envelope = await readEnvelope(this.reportFile(id));
        if (!envelope) continue;
        counts[envelope.record.status] += 1;
        counts.total += 1;
      }
      return counts;
    });
  }
}
