/**
 * Plan 51 P1: durable, restart-safe CredentialBridgeStore for a single shared POSIX
 * data directory (self-host mode). Published epoch public keys + the serial-keyed
 * revocation list live in one atomic JSON ledger under one cross-process lock.
 *
 * THE WALL: this ledger holds NO account identifier, persona key, or device id. It is
 * the anonymous bridge both the account service and verifier surfaces read.
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import {
  isCredentialSerial,
  type CredentialBridgeStore,
  type CredentialBridgeStoreStats,
  type RevokeSerialOutcome,
} from './credential-bridge-store';

interface StoredEpochKey {
  publicKeySpkiDerBase64: string;
  notBeforeMs: number;
  notAfterMs: number;
}

interface StoredRevocation {
  epoch: number;
  reasonCode: string;
  revokedAt: string;
}

interface CredentialBridgeLedger {
  version: 1;
  epochKeys: Record<string, StoredEpochKey>; // epoch -> key
  revocations: Record<string, StoredRevocation>; // serial -> revocation
}

function emptyLedger(): CredentialBridgeLedger {
  return { version: 1, epochKeys: {}, revocations: {} };
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function validateLedger(value: CredentialBridgeLedger): void {
  if (!value || value.version !== 1
    || typeof value.epochKeys !== 'object' || value.epochKeys === null
    || typeof value.revocations !== 'object' || value.revocations === null) {
    throw new Error('Credential bridge ledger is invalid.');
  }
}

export class FileCredentialBridgeStore implements CredentialBridgeStore {
  private readonly ledgerFile: string;
  private readonly ledgerLockFile: string;

  constructor(private readonly baseDir: string) {
    this.ledgerFile = path.join(baseDir, 'credential-bridge-ledger.json');
    this.ledgerLockFile = path.join(baseDir, '.credential-bridge-ledger.lock');
  }

  private async readLedger(): Promise<CredentialBridgeLedger> {
    let raw: string;
    try {
      raw = await fs.readFile(this.ledgerFile, 'utf8');
    } catch (error) {
      if (isMissing(error)) return emptyLedger();
      throw error;
    }
    const parsed = JSON.parse(raw) as CredentialBridgeLedger;
    validateLedger(parsed);
    return parsed;
  }

  private async writeLedger(ledger: CredentialBridgeLedger): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const temporary = `${this.ledgerFile}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(ledger), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, this.ledgerFile);
  }

  private async mutate<T>(operation: (ledger: CredentialBridgeLedger) => T): Promise<T> {
    return withExclusiveFileLock(this.ledgerLockFile, async () => {
      const ledger = await this.readLedger();
      const result = operation(ledger);
      await this.writeLedger(ledger);
      return result;
    });
  }

  async publishEpochKey(
    epoch: number,
    publicKeySpkiDerBase64: string,
    notBeforeMs: number,
    notAfterMs: number,
  ): Promise<void> {
    await this.mutate((ledger) => {
      const key = String(epoch);
      if (ledger.epochKeys[key] === undefined) {
        ledger.epochKeys[key] = { publicKeySpkiDerBase64, notBeforeMs, notAfterMs };
      }
    });
  }

  async getEpochPublicKey(epoch: number): Promise<string | null> {
    const ledger = await this.readLedger();
    return ledger.epochKeys[String(epoch)]?.publicKeySpkiDerBase64 ?? null;
  }

  async revokeSerial(serial: string, epoch: number, reasonCode: string): Promise<RevokeSerialOutcome> {
    if (!isCredentialSerial(serial)) throw new Error('Serial must be 64 lowercase hex');
    return this.mutate((ledger) => {
      if (ledger.revocations[serial] !== undefined) return 'already_revoked';
      ledger.revocations[serial] = { epoch, reasonCode, revokedAt: new Date().toISOString() };
      return 'revoked';
    });
  }

  async isSerialRevoked(serial: string): Promise<boolean> {
    const ledger = await this.readLedger();
    return ledger.revocations[serial] !== undefined;
  }

  async stats(): Promise<CredentialBridgeStoreStats> {
    const ledger = await this.readLedger();
    return {
      epochKeys: Object.keys(ledger.epochKeys).length,
      revocations: Object.keys(ledger.revocations).length,
    };
  }
}
