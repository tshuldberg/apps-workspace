/**
 * Durable, restart-safe DmcaIntakeStore (Plan 39 P13). The first-party node points this at its
 * DATA_DIR volume so received DMCA notices survive a restart -- a lost notice is a lost legal
 * obligation. Filesystem convention matches the other file stores (atomic rename, no new deps).
 *
 * Layout under baseDir:
 *   claims/<id>.json    one versioned claim record
 *   order.log           newline-separated ids in receive order (newest-first list reads it)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import type {
  DmcaClaimRecord,
  DmcaClaimStatus,
  DmcaClaimTransitionInput,
  DmcaClaimTransitionResult,
  DmcaIntakeStore,
} from './dmca-intake';

const ID_RE = /^[0-9a-f]{64}$/;

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJsonFileAtomic(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value), 'utf8');
  await fs.rename(tmp, file);
}

function normalizeRecord(record: DmcaClaimRecord): DmcaClaimRecord {
  return {
    ...record,
    lifecycleVersion: Number.isSafeInteger(record.lifecycleVersion)
      ? record.lifecycleVersion
      : 1,
  };
}

export class FileDmcaIntakeStore implements DmcaIntakeStore {
  private readonly claimsDir: string;
  private readonly orderFile: string;
  private readonly lockFile: string;

  constructor(baseDir: string) {
    this.claimsDir = path.join(baseDir, 'claims');
    this.orderFile = path.join(baseDir, 'order.log');
    this.lockFile = path.join(baseDir, '.dmca-intake.lock');
  }

  private claimFile(id: string): string {
    if (!ID_RE.test(id)) throw new Error('FileDmcaIntakeStore: invalid claim id');
    return path.join(this.claimsDir, `${id}.json`);
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

  create(record: DmcaClaimRecord): Promise<DmcaClaimRecord> {
    return withExclusiveFileLock(this.lockFile, async () => {
      const file = this.claimFile(record.id);
      const existing = await readJsonFile<DmcaClaimRecord>(file);
      if (existing) return normalizeRecord(existing);
      const created = normalizeRecord(record);
      await writeJsonFileAtomic(file, created);
      await fs.mkdir(path.dirname(this.orderFile), { recursive: true });
      await fs.appendFile(this.orderFile, `${record.id}\n`, 'utf8');
      return created;
    });
  }

  async get(id: string): Promise<DmcaClaimRecord | null> {
    if (!ID_RE.test(id)) return null;
    const record = await readJsonFile<DmcaClaimRecord>(this.claimFile(id));
    return record ? normalizeRecord(record) : null;
  }

  async list(filter: { status?: DmcaClaimStatus; limit?: number } = {}): Promise<DmcaClaimRecord[]> {
    const bound = Math.max(1, Math.min(500, Math.floor(filter.limit ?? 100)));
    const order = await this.readOrder();
    const out: DmcaClaimRecord[] = [];
    const seen = new Set<string>();
    for (let i = order.length - 1; i >= 0 && out.length < bound; i -= 1) {
      const id = order[i]!;
      if (seen.has(id)) continue;
      seen.add(id);
      const row = await readJsonFile<DmcaClaimRecord>(this.claimFile(id));
      if (!row) continue;
      if (filter.status && row.status !== filter.status) continue;
      out.push(normalizeRecord(row));
    }
    return out;
  }

  compareAndSetLifecycle(
    input: DmcaClaimTransitionInput,
  ): Promise<DmcaClaimTransitionResult> {
    return withExclusiveFileLock(this.lockFile, async () => {
      const file = this.claimFile(input.id);
      const stored = await readJsonFile<DmcaClaimRecord>(file);
      if (!stored) return { status: 'not_found' };
      const current = normalizeRecord(stored);
      if (current.lifecycleVersion !== input.expectedVersion) {
        return { status: 'conflict', record: current };
      }
      const updated: DmcaClaimRecord = {
        ...current,
        ...structuredClone(input.lifecycle),
        lifecycleVersion: current.lifecycleVersion + 1,
      };
      await writeJsonFileAtomic(file, updated);
      return { status: 'applied', record: updated };
    });
  }
}
