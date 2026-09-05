/**
 * Durable, restart-safe HumanityStore for a single shared POSIX data directory.
 *
 * Token spends and registration redemption receipts live in one atomic JSON ledger guarded
 * by one cross-process lock. That single record is intentional: writing a spent marker and an
 * attempt receipt as separate files would leave an unrecoverable crash window between them.
 * Legacy `.spent` files remain readable and prunable during rolling upgrades.
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import {
  InMemoryHumanityStore,
  type ConsumedHumanityChallenge,
  type HumanityRegistrationRedemptionInput,
  type HumanityRegistrationRedemptionOutcome,
  type HumanityStore,
  type StoredChallenge,
} from './humanity-service';

const TOKEN_HASH_RE = /^[0-9a-f]{1,128}$/i;
const DIGEST_RE = /^[0-9a-f]{64}$/;

interface HumanitySpendLedger {
  version: 1;
  tokens: Record<string, { expiresAtMs: number }>;
  registrationAttempts: Record<string, {
    requestDigest: string;
    tokenHash: string;
    result: { ok: true };
    createdAt: string;
  }>;
}

function emptyLedger(): HumanitySpendLedger {
  return { version: 1, tokens: {}, registrationAttempts: {} };
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function validateLedger(value: HumanitySpendLedger): void {
  if (!value || value.version !== 1
    || typeof value.tokens !== 'object' || value.tokens === null
    || typeof value.registrationAttempts !== 'object' || value.registrationAttempts === null) {
    throw new Error('Humanity spend ledger is invalid.');
  }
  for (const [tokenHash, token] of Object.entries(value.tokens)) {
    if (!TOKEN_HASH_RE.test(tokenHash) || !Number.isSafeInteger(token.expiresAtMs)) {
      throw new Error('Humanity spend ledger contains an invalid token record.');
    }
  }
  for (const [attemptId, attempt] of Object.entries(value.registrationAttempts)) {
    if (!DIGEST_RE.test(attemptId)
      || !DIGEST_RE.test(attempt.requestDigest)
      || !TOKEN_HASH_RE.test(attempt.tokenHash)
      || attempt.result?.ok !== true
      || Number.isNaN(Date.parse(attempt.createdAt))) {
      throw new Error('Humanity spend ledger contains an invalid registration receipt.');
    }
  }
}

export class FileHumanityStore implements HumanityStore {
  private readonly spentDir: string;
  private readonly ledgerFile: string;
  private readonly ledgerLockFile: string;
  private readonly volatile = new InMemoryHumanityStore();

  constructor(private readonly baseDir: string) {
    this.spentDir = path.join(baseDir, 'spent');
    this.ledgerFile = path.join(baseDir, 'humanity-spend-ledger.json');
    this.ledgerLockFile = path.join(baseDir, '.humanity-spend-ledger.lock');
  }

  putChallenge(id: string, record: StoredChallenge): void {
    this.volatile.putChallenge(id, record);
  }

  getChallenge(id: string): StoredChallenge | null {
    return this.volatile.getChallenge(id);
  }

  deleteChallenge(id: string): void {
    this.volatile.deleteChallenge(id);
  }

  consumeChallenge(id: string, nowMs: number): ConsumedHumanityChallenge | null {
    return this.volatile.consumeChallenge(id, nowMs);
  }

  getIssuanceCount(keyHash: string, dayBucket: number): number {
    return this.volatile.getIssuanceCount(keyHash, dayBucket);
  }

  incrementIssuanceCount(keyHash: string, dayBucket: number): void {
    this.volatile.incrementIssuanceCount(keyHash, dayBucket);
  }

  tryIncrementIssuanceCount(keyHash: string, dayBucket: number, maximum: number): boolean {
    return this.volatile.tryIncrementIssuanceCount(keyHash, dayBucket, maximum);
  }

  private spentFile(tokenHash: string): string {
    if (!TOKEN_HASH_RE.test(tokenHash)) throw new Error('Invalid spent-token hash.');
    return path.join(this.spentDir, `${tokenHash}.spent`);
  }

  private async readLedger(): Promise<HumanitySpendLedger> {
    let raw: string;
    try {
      raw = await fs.readFile(this.ledgerFile, 'utf8');
    } catch (error) {
      if (isMissing(error)) return emptyLedger();
      throw error;
    }
    const parsed = JSON.parse(raw) as HumanitySpendLedger;
    validateLedger(parsed);
    return parsed;
  }

  private async writeLedger(ledger: HumanitySpendLedger): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const temporary = `${this.ledgerFile}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(ledger), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, this.ledgerFile);
  }

  private async legacySpent(tokenHash: string): Promise<boolean> {
    try {
      await fs.access(this.spentFile(tokenHash));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async trySpend(tokenHash: string, expiresAtMs: number): Promise<boolean> {
    this.spentFile(tokenHash);
    if (!Number.isSafeInteger(expiresAtMs)) throw new TypeError('Invalid spent-token expiry.');
    // Keep the legacy directory present during rolling upgrades. Older processes and recovery
    // tooling may still write/read `.spent` markers while the new ledger is authoritative.
    await fs.mkdir(this.spentDir, { recursive: true });
    return withExclusiveFileLock(this.ledgerLockFile, async () => {
      const ledger = await this.readLedger();
      if (ledger.tokens[tokenHash] || await this.legacySpent(tokenHash)) return false;
      ledger.tokens[tokenHash] = { expiresAtMs };
      await this.writeLedger(ledger);
      return true;
    });
  }

  async redeemRegistrationAttempt(
    input: HumanityRegistrationRedemptionInput,
  ): Promise<HumanityRegistrationRedemptionOutcome> {
    if (!DIGEST_RE.test(input.attemptId)
      || !DIGEST_RE.test(input.requestDigest)
      || !TOKEN_HASH_RE.test(input.tokenHash)
      || !Number.isSafeInteger(input.expiresAtMs)) {
      throw new TypeError('Invalid humanity registration redemption input.');
    }
    return withExclusiveFileLock(this.ledgerLockFile, async () => {
      const ledger = await this.readLedger();
      const existing = ledger.registrationAttempts[input.attemptId];
      if (existing) {
        return existing.requestDigest === input.requestDigest && existing.tokenHash === input.tokenHash
          ? 'replayed'
          : 'attempt_conflict';
      }
      if (!input.allowCreate) return 'not_recorded';
      if (ledger.tokens[input.tokenHash] || await this.legacySpent(input.tokenHash)) {
        return 'already_spent';
      }

      // The token spend and replayable result enter one object and one atomic rename.
      ledger.tokens[input.tokenHash] = { expiresAtMs: input.expiresAtMs };
      ledger.registrationAttempts[input.attemptId] = {
        requestDigest: input.requestDigest,
        tokenHash: input.tokenHash,
        result: { ok: true },
        createdAt: new Date().toISOString(),
      };
      await this.writeLedger(ledger);
      return 'spent';
    });
  }

  async isSpent(tokenHash: string): Promise<boolean> {
    this.spentFile(tokenHash);
    const ledger = await this.readLedger();
    return Boolean(ledger.tokens[tokenHash]) || this.legacySpent(tokenHash);
  }

  async markSpent(tokenHash: string, expiresAtMs: number): Promise<void> {
    this.spentFile(tokenHash);
    if (!Number.isSafeInteger(expiresAtMs)) throw new TypeError('Invalid spent-token expiry.');
    await withExclusiveFileLock(this.ledgerLockFile, async () => {
      const ledger = await this.readLedger();
      const current = ledger.tokens[tokenHash]?.expiresAtMs ?? 0;
      ledger.tokens[tokenHash] = { expiresAtMs: Math.max(current, expiresAtMs) };
      await this.writeLedger(ledger);
    });
  }

  async prune(nowMs: number): Promise<void> {
    await this.volatile.prune(nowMs);
    await withExclusiveFileLock(this.ledgerLockFile, async () => {
      const ledger = await this.readLedger();
      let changed = false;
      for (const [tokenHash, token] of Object.entries(ledger.tokens)) {
        if (token.expiresAtMs <= nowMs) {
          delete ledger.tokens[tokenHash];
          changed = true;
        }
      }
      if (changed) await this.writeLedger(ledger);

      let names: string[];
      try {
        names = await fs.readdir(this.spentDir);
      } catch (error) {
        if (isMissing(error)) return;
        throw error;
      }
      for (const name of names) {
        if (!name.endsWith('.spent')) continue;
        const file = path.join(this.spentDir, name);
        let raw: string;
        try {
          raw = await fs.readFile(file, 'utf8');
        } catch {
          continue;
        }
        const expiresAtMs = Number(raw);
        if (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs) {
          await fs.rm(file, { force: true });
        }
      }
    });
  }

  async stats(): Promise<{ spent: number; issuanceKeys: number; challenges: number }> {
    const volatileStats = await this.volatile.stats();
    const tokenHashes = new Set(Object.keys((await this.readLedger()).tokens));
    try {
      for (const name of await fs.readdir(this.spentDir)) {
        if (name.endsWith('.spent')) tokenHashes.add(name.slice(0, -6));
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    return {
      spent: tokenHashes.size,
      issuanceKeys: volatileStats.issuanceKeys,
      challenges: volatileStats.challenges,
    };
  }
}
