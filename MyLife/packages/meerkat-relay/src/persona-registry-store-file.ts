/**
 * Durable, restart-safe PersonaRegistryStore (Plan 39, P2).
 *
 * All lifecycle writes share one cross-process registry lock. The coarse lock is deliberate:
 * it preserves the persona-before-alias ordering used by PostgreSQL while making a POSIX data
 * directory safe for multiple service processes. A release writes its tombstone before it
 * frees either uniqueness pointer, and registration checks cooldown plus revocation inside the
 * same critical section that claims both pointers.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { withExclusiveFileLock } from './file-lock';
import { PERSONA_REGISTRATION_RESERVATION_TTL_MS } from './persona-registry';
import type {
  AliasReleaseTombstone,
  BeginPersonaRegistrationOutcome,
  CommitPersonaRegistrationOutcome,
  PersonaRecord,
  PersonaRegistrationAttempt,
  PersonaRegistryStore,
  TryRegisterOutcome,
} from './persona-registry';

const ALIAS_RE = /^[a-z0-9_]{3,20}$/;
const PUBKEY_RE = /^[0-9a-f]{64}$/;
const ATTEMPT_RE = /^[0-9a-f]{64}$/;
const MAX_BATCH_SIZE = 200;

interface RevocationMarker {
  reason: string;
  revokedAt: string;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

async function writeJsonFileAtomic(file: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, file);
}

function isValidTombstone(value: AliasReleaseTombstone, alias: string): boolean {
  return value !== null
    && typeof value === 'object'
    && value.alias === alias
    && PUBKEY_RE.test(value.personaPubkey)
    && Number.isSafeInteger(value.reregisterBlockedUntilMs)
    && Number.isSafeInteger(Date.parse(value.releasedAt))
    && value.reregisterBlockedUntilMs >= Date.parse(value.releasedAt);
}

function normalizeRevocationReason(reason: string | undefined): string {
  const normalized = reason ?? 'unspecified';
  if (normalized.length === 0 || normalized.length > 512) {
    throw new TypeError('Persona revocation reason must be between 1 and 512 characters.');
  }
  return normalized;
}

function validateRegistrationAttempt(attempt: PersonaRegistrationAttempt): void {
  if (attempt.version !== 1
    || !ATTEMPT_RE.test(attempt.attemptId)
    || !ATTEMPT_RE.test(attempt.requestDigest)
    || !ALIAS_RE.test(attempt.record.alias)
    || !PUBKEY_RE.test(attempt.record.personaPubkey)
    || !['reserved', 'humanity_verified', 'committed'].includes(attempt.state)
    || Number.isNaN(Date.parse(attempt.createdAt))
    || Number.isNaN(Date.parse(attempt.updatedAt))) {
    throw new TypeError('Invalid persona registration attempt.');
  }
}

function sameRegistrationAttempt(
  existing: PersonaRegistrationAttempt,
  candidate: PersonaRegistrationAttempt,
): boolean {
  return existing.requestDigest === candidate.requestDigest
    && existing.record.alias === candidate.record.alias
    && existing.record.personaPubkey === candidate.record.personaPubkey
    && existing.record.humanityBinding === candidate.record.humanityBinding
    && existing.record.claim.signature === candidate.record.claim.signature;
}

export class FilePersonaRegistryStore implements PersonaRegistryStore {
  private readonly personasDir: string;
  private readonly pubkeysDir: string;
  private readonly tombstonesDir: string;
  private readonly revokedDir: string;
  private readonly registrationAttemptsDir: string;
  private readonly writeLockFile: string;
  private readonly writeLockContext = new AsyncLocalStorage<boolean>();

  constructor(baseDir: string) {
    this.personasDir = path.join(baseDir, 'personas');
    this.pubkeysDir = path.join(baseDir, 'pubkeys');
    this.tombstonesDir = path.join(baseDir, 'tombstones');
    this.revokedDir = path.join(baseDir, 'revoked');
    this.registrationAttemptsDir = path.join(baseDir, 'registration-attempts');
    this.writeLockFile = path.join(baseDir, '.persona-registry.lock');
  }

  private personaFile(alias: string): string {
    if (!ALIAS_RE.test(alias)) throw new Error('Invalid alias.');
    return path.join(this.personasDir, `${alias}.json`);
  }

  private pubkeyFile(pubkey: string): string {
    if (!PUBKEY_RE.test(pubkey)) throw new Error('Invalid persona pubkey.');
    return path.join(this.pubkeysDir, `${pubkey}.json`);
  }

  private tombstoneFile(alias: string): string {
    if (!ALIAS_RE.test(alias)) throw new Error('Invalid alias.');
    return path.join(this.tombstonesDir, `${alias}.json`);
  }

  private revokedFile(pubkey: string): string {
    if (!PUBKEY_RE.test(pubkey)) throw new Error('Invalid persona pubkey.');
    return path.join(this.revokedDir, pubkey);
  }

  private registrationAttemptFile(attemptId: string): string {
    if (!ATTEMPT_RE.test(attemptId)) throw new Error('Invalid registration attempt id.');
    return path.join(this.registrationAttemptsDir, `${attemptId}.json`);
  }

  private async listRegistrationAttempts(): Promise<PersonaRegistrationAttempt[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.registrationAttemptsDir);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const attempts: PersonaRegistrationAttempt[] = [];
    for (const name of names) {
      if (!name.endsWith('.json')) continue;
      const attempt = await readJsonFile<PersonaRegistrationAttempt>(
        path.join(this.registrationAttemptsDir, name),
      );
      if (!attempt) continue;
      validateRegistrationAttempt(attempt);
      if (`${attempt.attemptId}.json` !== name) {
        throw new Error('Persona registration attempt filename does not match its payload.');
      }
      attempts.push(attempt);
    }
    return attempts;
  }

  private async pruneExpiredRegistrationAttempts(nowMs: number): Promise<void> {
    for (const attempt of await this.listRegistrationAttempts()) {
      if (attempt.state === 'reserved'
        && Date.parse(attempt.createdAt) + PERSONA_REGISTRATION_RESERVATION_TTL_MS <= nowMs) {
        await fs.rm(this.registrationAttemptFile(attempt.attemptId), { force: true });
      }
    }
  }

  private async withRegistryWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    if (this.writeLockContext.getStore()) return operation();
    return withExclusiveFileLock(
      this.writeLockFile,
      () => this.writeLockContext.run(true, operation),
    );
  }

  async withPersonaWriteLock<T>(
    personaPubkey: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!PUBKEY_RE.test(personaPubkey)) throw new Error('Invalid persona pubkey.');
    return this.withRegistryWriteLock(operation);
  }

  async beginRegistrationAttempt(
    attempt: PersonaRegistrationAttempt,
    nowMs = Date.now(),
  ): Promise<BeginPersonaRegistrationOutcome> {
    validateRegistrationAttempt(attempt);
    return this.withRegistryWriteLock(async () => {
      await this.pruneExpiredRegistrationAttempts(nowMs);
      let tombstone: AliasReleaseTombstone | null;
      try {
        tombstone = await this.getTombstone(attempt.record.alias);
      } catch (error) {
        if (error instanceof SyntaxError) return 'alias_cooldown';
        throw error;
      }
      if (tombstone) {
        if (!isValidTombstone(tombstone, attempt.record.alias)
          || tombstone.reregisterBlockedUntilMs > nowMs) {
          return 'alias_cooldown';
        }
        await fs.rm(this.tombstoneFile(attempt.record.alias), { force: true });
      }
      if (await this.isRevoked(attempt.record.personaPubkey)) return 'persona_revoked';

      const existing = await readJsonFile<PersonaRegistrationAttempt>(
        this.registrationAttemptFile(attempt.attemptId),
      );
      if (existing) {
        validateRegistrationAttempt(existing);
        if (!sameRegistrationAttempt(existing, attempt)) return 'attempt_conflict';
        if (existing.state === 'committed') return 'committed';
        return existing.state === 'humanity_verified' ? 'humanity_verified' : 'resume_reserved';
      }
      if (await this.getByAlias(attempt.record.alias)) return 'alias_taken';
      if (await this.getByPubkey(attempt.record.personaPubkey)) return 'pubkey_taken';
      for (const other of await this.listRegistrationAttempts()) {
        if (other.state === 'committed') continue;
        if (other.record.alias === attempt.record.alias) return 'alias_taken';
        if (other.record.personaPubkey === attempt.record.personaPubkey) return 'pubkey_taken';
      }
      await writeJsonFileAtomic(this.registrationAttemptFile(attempt.attemptId), attempt);
      return 'reserved';
    });
  }

  async markRegistrationHumanityVerified(
    attemptId: string,
    requestDigest: string,
  ): Promise<'ok' | 'not_found' | 'attempt_conflict'> {
    if (!ATTEMPT_RE.test(attemptId) || !ATTEMPT_RE.test(requestDigest)) {
      throw new TypeError('Invalid registration attempt identity.');
    }
    return this.withRegistryWriteLock(async () => {
      const attempt = await readJsonFile<PersonaRegistrationAttempt>(
        this.registrationAttemptFile(attemptId),
      );
      if (!attempt) return 'not_found';
      validateRegistrationAttempt(attempt);
      if (attempt.requestDigest !== requestDigest) return 'attempt_conflict';
      if (attempt.state === 'reserved') {
        await writeJsonFileAtomic(this.registrationAttemptFile(attemptId), {
          ...attempt,
          state: 'humanity_verified',
          updatedAt: new Date().toISOString(),
        } satisfies PersonaRegistrationAttempt);
      }
      return 'ok';
    });
  }

  async commitRegistrationAttempt(
    attemptId: string,
    requestDigest: string,
    nowMs = Date.now(),
  ): Promise<CommitPersonaRegistrationOutcome> {
    if (!ATTEMPT_RE.test(attemptId) || !ATTEMPT_RE.test(requestDigest)) {
      throw new TypeError('Invalid registration attempt identity.');
    }
    return this.withRegistryWriteLock(async () => {
      const attempt = await readJsonFile<PersonaRegistrationAttempt>(
        this.registrationAttemptFile(attemptId),
      );
      if (!attempt) return { outcome: 'not_found' };
      validateRegistrationAttempt(attempt);
      if (attempt.requestDigest !== requestDigest) return { outcome: 'attempt_conflict' };
      const record = attempt.record;
      if (attempt.state === 'committed') {
        const active = await this.getByAlias(record.alias);
        return active?.personaPubkey === record.personaPubkey
          ? { outcome: 'ok', record: active }
          : { outcome: 'not_found' };
      }
      if (attempt.state !== 'humanity_verified') return { outcome: 'not_verified' };

      const tombstone = await this.getTombstone(record.alias);
      if (tombstone) {
        if (!isValidTombstone(tombstone, record.alias)
          || tombstone.reregisterBlockedUntilMs > nowMs) {
          return { outcome: 'alias_cooldown' };
        }
        await fs.rm(this.tombstoneFile(record.alias), { force: true });
      }
      if (await this.isRevoked(record.personaPubkey)) return { outcome: 'persona_revoked' };

      const aliasOwner = await this.getByAlias(record.alias);
      if (aliasOwner && aliasOwner.personaPubkey !== record.personaPubkey) {
        return { outcome: 'alias_taken' };
      }
      const pointer = await readJsonFile<{ alias: string }>(this.pubkeyFile(record.personaPubkey));
      if (pointer && pointer.alias !== record.alias) return { outcome: 'pubkey_taken' };

      // The active alias is written only after the durable humanity_verified transition.
      // If the process dies between these writes, retry sees the verified attempt and repairs
      // the missing pointer before marking the saga committed.
      if (!aliasOwner) {
        await fs.mkdir(this.personasDir, { recursive: true });
        await fs.writeFile(this.personaFile(record.alias), JSON.stringify(record), {
          flag: 'wx',
          mode: 0o600,
        });
      }
      if (!pointer) {
        await fs.mkdir(this.pubkeysDir, { recursive: true });
        await fs.writeFile(this.pubkeyFile(record.personaPubkey), JSON.stringify({ alias: record.alias }), {
          flag: 'wx',
          mode: 0o600,
        });
      }
      await writeJsonFileAtomic(this.registrationAttemptFile(attemptId), {
        ...attempt,
        state: 'committed',
        updatedAt: new Date().toISOString(),
      } satisfies PersonaRegistrationAttempt);
      return { outcome: 'ok', record };
    });
  }

  async cancelRegistrationAttempt(attemptId: string, requestDigest: string): Promise<boolean> {
    if (!ATTEMPT_RE.test(attemptId) || !ATTEMPT_RE.test(requestDigest)) {
      throw new TypeError('Invalid registration attempt identity.');
    }
    return this.withRegistryWriteLock(async () => {
      const attempt = await readJsonFile<PersonaRegistrationAttempt>(
        this.registrationAttemptFile(attemptId),
      );
      if (!attempt || attempt.requestDigest !== requestDigest || attempt.state === 'committed') {
        return false;
      }
      await fs.rm(this.registrationAttemptFile(attemptId), { force: true });
      return true;
    });
  }

  async tryRegister(record: PersonaRecord, nowMs = Date.now()): Promise<TryRegisterOutcome> {
    if (!ALIAS_RE.test(record.alias) || !PUBKEY_RE.test(record.personaPubkey)) {
      return 'alias_taken';
    }
    const effectiveNowMs = Number.isSafeInteger(nowMs) ? nowMs : Date.now();
    return this.withRegistryWriteLock(async () => {
      await this.pruneExpiredRegistrationAttempts(effectiveNowMs);
      let tombstone: AliasReleaseTombstone | null;
      try {
        tombstone = await this.getTombstone(record.alias);
      } catch (error) {
        if (error instanceof SyntaxError) return 'alias_cooldown';
        throw error;
      }
      if (tombstone) {
        if (!isValidTombstone(tombstone, record.alias)) return 'alias_cooldown';
        if (tombstone.reregisterBlockedUntilMs > effectiveNowMs) return 'alias_cooldown';
        await fs.rm(this.tombstoneFile(record.alias), { force: true });
      }
      if (await this.isRevoked(record.personaPubkey)) return 'persona_revoked';
      for (const attempt of await this.listRegistrationAttempts()) {
        if (attempt.state === 'committed') continue;
        if (attempt.record.alias === record.alias) return 'alias_taken';
        if (attempt.record.personaPubkey === record.personaPubkey) return 'pubkey_taken';
      }

      await fs.mkdir(this.pubkeysDir, { recursive: true });
      await fs.mkdir(this.personasDir, { recursive: true });
      const pubkeyFile = this.pubkeyFile(record.personaPubkey);
      try {
        await fs.writeFile(pubkeyFile, JSON.stringify({ alias: record.alias }), {
          flag: 'wx',
          mode: 0o600,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'pubkey_taken';
        throw error;
      }

      try {
        await fs.writeFile(this.personaFile(record.alias), JSON.stringify(record), {
          flag: 'wx',
          mode: 0o600,
        });
      } catch (error) {
        await fs.rm(pubkeyFile, { force: true });
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'alias_taken';
        throw error;
      }
      return 'ok';
    });
  }

  async remove(alias: string, expectedPersonaPubkey?: string): Promise<void> {
    if (!ALIAS_RE.test(alias)) return;
    await this.withRegistryWriteLock(async () => {
      const record = await this.getByAlias(alias);
      if (expectedPersonaPubkey && record?.personaPubkey !== expectedPersonaPubkey) return;
      await fs.rm(this.personaFile(alias), { force: true });
      if (record && PUBKEY_RE.test(record.personaPubkey)) {
        await fs.rm(this.pubkeyFile(record.personaPubkey), { force: true });
      }
    });
  }

  async getByAlias(alias: string): Promise<PersonaRecord | null> {
    if (!ALIAS_RE.test(alias)) return null;
    return readJsonFile<PersonaRecord>(this.personaFile(alias));
  }

  async getByPubkey(personaPubkey: string): Promise<PersonaRecord | null> {
    if (!PUBKEY_RE.test(personaPubkey)) return null;
    const pointer = await readJsonFile<{ alias: string }>(this.pubkeyFile(personaPubkey));
    if (!pointer || !ALIAS_RE.test(pointer.alias)) return null;
    const record = await this.getByAlias(pointer.alias);
    return record && record.personaPubkey === personaPubkey ? record : null;
  }

  async getByPubkeys(personaPubkeys: readonly string[]): Promise<PersonaRecord[]> {
    const keys = personaPubkeys.slice(0, MAX_BATCH_SIZE);
    const records = await Promise.all(keys.map((key) => this.getByPubkey(key)));
    return records.filter((record): record is PersonaRecord => record !== null);
  }

  async release(alias: string, tombstone: AliasReleaseTombstone): Promise<void> {
    if (!ALIAS_RE.test(alias)) return;
    if (!isValidTombstone(tombstone, alias)) throw new TypeError('Invalid alias tombstone.');
    await this.withRegistryWriteLock(async () => {
      const record = await this.getByAlias(alias);
      if (record && record.personaPubkey !== tombstone.personaPubkey) {
        throw new Error('Refusing to release an alias owned by another persona.');
      }
      // Tombstone first is the crash-safe ordering. The global lock stops registration from
      // observing the pointer deletion before this durable cooldown write.
      await writeJsonFileAtomic(this.tombstoneFile(alias), tombstone);
      for (const attempt of await this.listRegistrationAttempts()) {
        if (attempt.record.personaPubkey === tombstone.personaPubkey) {
          await fs.rm(this.registrationAttemptFile(attempt.attemptId), { force: true });
        }
      }
      await fs.rm(this.personaFile(alias), { force: true });
      if (record) await fs.rm(this.pubkeyFile(record.personaPubkey), { force: true });
    });
  }

  async getTombstone(alias: string): Promise<AliasReleaseTombstone | null> {
    if (!ALIAS_RE.test(alias)) return null;
    return readJsonFile<AliasReleaseTombstone>(this.tombstoneFile(alias));
  }

  async revoke(personaPubkey: string, reason?: string): Promise<void> {
    if (!PUBKEY_RE.test(personaPubkey)) return;
    const marker: RevocationMarker = {
      reason: normalizeRevocationReason(reason),
      revokedAt: new Date().toISOString(),
    };
    await this.withRegistryWriteLock(async () => {
      await writeJsonFileAtomic(this.revokedFile(personaPubkey), marker);
    });
  }

  async unrevoke(personaPubkey: string): Promise<void> {
    if (!PUBKEY_RE.test(personaPubkey)) return;
    await this.withRegistryWriteLock(async () => {
      await fs.rm(this.revokedFile(personaPubkey), { force: true });
    });
  }

  async isRevoked(personaPubkey: string): Promise<boolean> {
    if (!PUBKEY_RE.test(personaPubkey)) return true;
    try {
      await fs.access(this.revokedFile(personaPubkey));
      return true;
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }

  async prune(nowMs: number): Promise<void> {
    await this.withRegistryWriteLock(async () => {
      await this.pruneExpiredRegistrationAttempts(nowMs);
      for (const attempt of await this.listRegistrationAttempts()) {
        if (attempt.state === 'humanity_verified') {
          await this.commitRegistrationAttempt(attempt.attemptId, attempt.requestDigest, nowMs);
        }
      }
      let names: string[];
      try {
        names = await fs.readdir(this.tombstonesDir);
      } catch (error) {
        if (isMissing(error)) return;
        throw error;
      }
      for (const name of names) {
        if (!name.endsWith('.json')) continue;
        const file = path.join(this.tombstonesDir, name);
        let tombstone: AliasReleaseTombstone | null;
        try {
          tombstone = await readJsonFile<AliasReleaseTombstone>(file);
        } catch {
          continue;
        }
        if (tombstone && isValidTombstone(tombstone, name.slice(0, -5))
          && tombstone.reregisterBlockedUntilMs <= nowMs) {
          await fs.rm(file, { force: true });
        }
      }
    });
  }

  async stats(): Promise<{ personas: number; tombstones: number; revoked: number }> {
    const count = async (dir: string, suffix: string): Promise<number> => {
      try {
        return (await fs.readdir(dir)).filter((name) => name.endsWith(suffix)).length;
      } catch (error) {
        if (isMissing(error)) return 0;
        throw error;
      }
    };
    return {
      personas: await count(this.personasDir, '.json'),
      tombstones: await count(this.tombstonesDir, '.json'),
      revoked: await count(this.revokedDir, ''),
    };
  }
}
