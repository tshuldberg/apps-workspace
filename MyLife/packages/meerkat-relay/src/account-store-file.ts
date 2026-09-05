/**
 * Plan 51 P1: durable, restart-safe AccountStore for a single shared POSIX data
 * directory (self-host mode). Accounts, entitlements, per-epoch issuance quota
 * rows, and sealed epoch keys live in one atomic JSON ledger guarded by one
 * cross-process lock, mirroring FileHumanityStore's single-ledger discipline (a
 * split across files would leave an unrecoverable crash window between the account
 * row and its issuance/entitlement rows).
 *
 * THE WALL holds here too: the ledger schema carries no serial, persona, or device
 * field. Serials live only in the credential-bridge ledger (a separate file).
 */

import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import {
  accountDay,
  canIssueCredential,
  type IssuanceEligibility,
  canRecordCredentialIssuance,
  isCredentialIssuanceReplay,
  accountSubjectTombstoneHash,
  applyCarriedAntiAbuse,
  carriedAntiAbuseFromRecord,
  mergeCarriedAntiAbuse,
  type AccountAgeSource,
  type AccountAgeStatus,
  type AccountProvider,
  type AccountRecord,
  type AccountStore,
  type AccountStoreStats,
  type CarriedAntiAbuseState,
  type DeleteAccountInput,
  type EntitlementRecord,
  type RecordEntitlementInput,
  type RecordIssuanceOutcome,
  type UpsertAccountInput,
} from './account-store';

/** A subject tombstone: quota timer + the anti-abuse flags carried across delete. */
interface TombstoneEntry {
  recreateAfterMs: number;
  carried: CarriedAntiAbuseState;
}

interface AccountLedger {
  version: 3;
  accounts: Record<string, AccountRecord>; // accountId -> record
  entitlements: Record<string, EntitlementRecord[]>; // accountId -> rows
  issuances: Record<string, number[]>; // accountId -> epochs
  sealedKeys: Record<string, string>; // epoch -> sealed private key
  deletedSubjects: Record<string, TombstoneEntry>; // subject marker -> tombstone
}

/** A carried state with no flags, for migrating a legacy numeric tombstone. */
function emptyCarried(): CarriedAntiAbuseState {
  return { ageStatus: 'unknown', parentalConsentState: 'not_required' };
}

function emptyLedger(): AccountLedger {
  return {
    version: 3,
    accounts: {},
    entitlements: {},
    issuances: {},
    sealedKeys: {},
    deletedSubjects: {},
  };
}

/**
 * Migrate a legacy deletedSubjects map (v1 absent / v2 `Record<string, number>`)
 * to the v3 tombstone shape. A legacy numeric entry keeps its recreate timer and
 * gets empty carried flags (no anti-abuse state was recorded before v3).
 */
function migrateDeletedSubjects(raw: unknown): Record<string, TombstoneEntry> {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Record<string, TombstoneEntry> = {};
  for (const [hash, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number') {
      out[hash] = { recreateAfterMs: value, carried: emptyCarried() };
    } else if (value && typeof value === 'object' && typeof (value as TombstoneEntry).recreateAfterMs === 'number') {
      const entry = value as TombstoneEntry;
      out[hash] = {
        recreateAfterMs: entry.recreateAfterMs,
        carried: entry.carried && typeof entry.carried === 'object' ? entry.carried : emptyCarried(),
      };
    }
  }
  return out;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

function normalizeLedger(value: unknown): AccountLedger {
  const candidate = value as {
    version?: unknown;
    accounts?: unknown;
    entitlements?: unknown;
    issuances?: unknown;
    sealedKeys?: unknown;
    deletedSubjects?: unknown;
  };
  if (!candidate || (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3)
    || typeof candidate.accounts !== 'object' || candidate.accounts === null
    || typeof candidate.entitlements !== 'object' || candidate.entitlements === null
    || typeof candidate.issuances !== 'object' || candidate.issuances === null
    || typeof candidate.sealedKeys !== 'object' || candidate.sealedKeys === null) {
    throw new Error('Account ledger is invalid.');
  }
  // v1 had no tombstones; v2 stored numeric recreate timers; v3 stores tombstones
  // with carried anti-abuse flags. Migrate whichever we find.
  const deletedSubjects = migrateDeletedSubjects(candidate.version === 1 ? {} : candidate.deletedSubjects);
  return {
    version: 3,
    accounts: candidate.accounts as Record<string, AccountRecord>,
    entitlements: candidate.entitlements as Record<string, EntitlementRecord[]>,
    issuances: candidate.issuances as Record<string, number[]>,
    sealedKeys: candidate.sealedKeys as Record<string, string>,
    deletedSubjects,
  };
}

function providerSubjectKey(provider: AccountProvider, providerSubject: string): string {
  return `${provider}\u0000${providerSubject}`;
}

export class FileAccountStore implements AccountStore {
  private readonly ledgerFile: string;
  private readonly ledgerLockFile: string;
  private readonly subjectHashSecret?: string;

  constructor(private readonly baseDir: string, options?: { subjectHashSecret?: string }) {
    this.ledgerFile = path.join(baseDir, 'account-ledger.json');
    this.ledgerLockFile = path.join(baseDir, '.account-ledger.lock');
    this.subjectHashSecret = options?.subjectHashSecret;
  }

  private async readLedger(): Promise<AccountLedger> {
    let raw: string;
    try {
      raw = await fs.readFile(this.ledgerFile, 'utf8');
    } catch (error) {
      if (isMissing(error)) return emptyLedger();
      throw error;
    }
    return normalizeLedger(JSON.parse(raw) as unknown);
  }

  private async writeLedger(ledger: AccountLedger): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    const temporary = `${this.ledgerFile}.${process.pid}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(ledger), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temporary, this.ledgerFile);
  }

  private async mutate<T>(operation: (ledger: AccountLedger) => T): Promise<T> {
    return withExclusiveFileLock(this.ledgerLockFile, async () => {
      const ledger = await this.readLedger();
      const result = operation(ledger);
      await this.writeLedger(ledger);
      return result;
    });
  }

  private findByProviderSubject(ledger: AccountLedger, provider: AccountProvider, providerSubject: string): AccountRecord | null {
    const target = providerSubjectKey(provider, providerSubject);
    for (const record of Object.values(ledger.accounts)) {
      if (providerSubjectKey(record.provider, record.providerSubject) === target) return record;
    }
    return null;
  }

  async upsertAccount(input: UpsertAccountInput): Promise<AccountRecord | null> {
    return this.mutate((ledger) => {
      const subjectHash = accountSubjectTombstoneHash(input.provider, input.providerSubject, this.subjectHashSecret);
      const tombstone = ledger.deletedSubjects[subjectHash];
      if (tombstone !== undefined) {
        if (input.nowMs < tombstone.recreateAfterMs) return null;
        delete ledger.deletedSubjects[subjectHash];
      }
      const existing = this.findByProviderSubject(ledger, input.provider, input.providerSubject);
      if (existing) {
        if (input.relayEmail && !existing.relayEmail) existing.relayEmail = input.relayEmail;
        if (!existing.humanVerifiedAt) existing.humanVerifiedAt = new Date(input.nowMs).toISOString();
        return existing;
      }
      const record: AccountRecord = {
        accountId: randomUUID(),
        provider: input.provider,
        providerSubject: input.providerSubject,
        ...(input.relayEmail ? { relayEmail: input.relayEmail } : {}),
        humanVerifiedAt: new Date(input.nowMs).toISOString(),
        ageStatus: 'unknown',
        parentalConsentState: 'not_required',
        createdDay: accountDay(input.nowMs),
      };
      // Re-seed anti-abuse flags carried on the tombstone (HIGH-1).
      if (tombstone) applyCarriedAntiAbuse(record, tombstone.carried);
      ledger.accounts[record.accountId] = record;
      return record;
    });
  }

  async getAccountById(accountId: string): Promise<AccountRecord | null> {
    const ledger = await this.readLedger();
    return ledger.accounts[accountId] ?? null;
  }

  async getAccountByProviderSubject(provider: AccountProvider, providerSubject: string): Promise<AccountRecord | null> {
    const ledger = await this.readLedger();
    return this.findByProviderSubject(ledger, provider, providerSubject);
  }

  async setAgeStatus(accountId: string, status: AccountAgeStatus, source: AccountAgeSource): Promise<void> {
    await this.mutate((ledger) => {
      const record = ledger.accounts[accountId];
      if (!record) return;
      record.ageStatus = status;
      record.ageSource = source;
    });
  }

  async flagRenewal(accountId: string, reasonCode: string, nowMs: number): Promise<void> {
    await this.mutate((ledger) => {
      const record = ledger.accounts[accountId];
      if (!record) return;
      if (!record.renewalFlaggedAt) record.renewalFlaggedAt = new Date(nowMs).toISOString();
      record.flagReasonCode = reasonCode;
    });
  }

  async recordEntitlement(input: RecordEntitlementInput): Promise<void> {
    await this.mutate((ledger) => {
      const rows = ledger.entitlements[input.accountId] ?? [];
      const next: EntitlementRecord = {
        accountId: input.accountId,
        product: input.product,
        rail: input.rail,
        status: input.status,
        ...(input.validUntil !== undefined ? { validUntil: input.validUntil } : {}),
        updatedAt: new Date(input.nowMs).toISOString(),
      };
      const index = rows.findIndex((row) => row.product === input.product);
      if (index >= 0) rows[index] = next;
      else rows.push(next);
      ledger.entitlements[input.accountId] = rows;
    });
  }

  async getEntitlements(accountId: string): Promise<EntitlementRecord[]> {
    const ledger = await this.readLedger();
    return [...(ledger.entitlements[accountId] ?? [])];
  }

  async recordIssuance(accountId: string, epoch: number, _nowMs: number, expectedPreviousEpoch?: number | null, requestHash?: string, eligibility?: IssuanceEligibility): Promise<RecordIssuanceOutcome> {
    return this.mutate((ledger) => {
      const epochs = ledger.issuances[accountId] ?? [];
      const account = ledger.accounts[accountId];
      if (eligibility && !canIssueCredential(account, ledger.entitlements[accountId] ?? [], eligibility.now(), eligibility.blockMinorIssuance)) return 'already_issued';
      if (account && isCredentialIssuanceReplay(account, epoch, requestHash)) return 'recorded';
      const latest = Math.max(account?.latestIssuedEpoch ?? -1, ...epochs);
      if (!account || !canRecordCredentialIssuance(latest < 0 ? undefined : latest, expectedPreviousEpoch, epoch)
        || epochs.includes(epoch)) return 'already_issued';
      account.latestIssuedEpoch = Math.max(latest, epoch);
      account.latestIssuedRequestHash = requestHash;
      epochs.push(epoch);
      ledger.issuances[accountId] = epochs;
      return 'recorded';
    });
  }

  async putSealedEpochKey(epoch: number, sealedPrivateKey: string): Promise<void> {
    await this.mutate((ledger) => {
      const key = String(epoch);
      if (ledger.sealedKeys[key] === undefined) ledger.sealedKeys[key] = sealedPrivateKey;
    });
  }

  async getSealedEpochKey(epoch: number): Promise<string | null> {
    const ledger = await this.readLedger();
    return ledger.sealedKeys[String(epoch)] ?? null;
  }

  async deleteAccount(input: DeleteAccountInput): Promise<void> {
    await this.mutate((ledger) => {
      const { accountId } = input;
      const record = ledger.accounts[accountId];
      if (
        !record
        || record.provider !== input.provider
        || record.providerSubject !== input.providerSubject
      ) return;
      const latest = Math.max(record.latestIssuedEpoch ?? -1, ...(ledger.issuances[accountId] ?? []));
      if (latest >= 0) record.latestIssuedEpoch = latest;
      const subjectHash = accountSubjectTombstoneHash(record.provider, record.providerSubject, this.subjectHashSecret);
      const prior = ledger.deletedSubjects[subjectHash];
      ledger.deletedSubjects[subjectHash] = {
        recreateAfterMs: Math.max(prior?.recreateAfterMs ?? 0, input.recreateAfterMs),
        carried: mergeCarriedAntiAbuse(prior?.carried, carriedAntiAbuseFromRecord(record)),
      };
      delete ledger.accounts[accountId];
      delete ledger.entitlements[accountId];
      delete ledger.issuances[accountId];
    });
  }

  async stats(): Promise<AccountStoreStats> {
    const ledger = await this.readLedger();
    let entitlements = 0;
    for (const rows of Object.values(ledger.entitlements)) entitlements += rows.length;
    let issuances = 0;
    for (const epochs of Object.values(ledger.issuances)) issuances += epochs.length;
    return { accounts: Object.keys(ledger.accounts).length, entitlements, issuances };
  }
}
