import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileAccountStore } from '../account-store-file';

const NOW = Date.parse('2026-08-24T12:00:00.000Z');
let baseDir: string;

beforeEach(async () => {
  baseDir = path.join(os.tmpdir(), `meerkat-account-store-${randomUUID()}`);
  await fs.mkdir(baseDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe('FileAccountStore deletion tombstones', () => {
  it('persists only a subject hash and blocks recreation until the boundary', async () => {
    const providerSubject = 'private-provider-subject';
    const first = new FileAccountStore(baseDir);
    const account = await first.upsertAccount({ provider: 'apple', providerSubject, nowMs: NOW });
    if (!account) throw new Error('account setup was unexpectedly blocked');

    await first.deleteAccount({
      accountId: account.accountId,
      provider: account.provider,
      providerSubject,
      recreateAfterMs: NOW + 60_000,
    });

    const raw = await fs.readFile(path.join(baseDir, 'account-ledger.json'), 'utf8');
    expect(raw).not.toContain(providerSubject);
    const ledger = JSON.parse(raw) as { version: number; deletedSubjects: Record<string, unknown> };
    expect(ledger.version).toBe(3);
    expect(Object.keys(ledger.deletedSubjects)[0]).toMatch(/^[0-9a-f]{64}$/u);

    const restarted = new FileAccountStore(baseDir);
    await expect(restarted.upsertAccount({ provider: 'apple', providerSubject, nowMs: NOW }))
      .resolves.toBeNull();
    await expect(restarted.upsertAccount({ provider: 'apple', providerSubject, nowMs: NOW + 60_000 }))
      .resolves.toMatchObject({ provider: 'apple', providerSubject });
  });

  it('upgrades a version 1 ledger without losing its account rows', async () => {
    const legacyAccount = {
      accountId: randomUUID(),
      provider: 'google',
      providerSubject: 'legacy-subject',
      humanVerifiedAt: new Date(NOW).toISOString(),
      ageStatus: 'unknown',
      parentalConsentState: 'not_required',
      createdDay: '2026-08-24',
    };
    await fs.writeFile(path.join(baseDir, 'account-ledger.json'), JSON.stringify({
      version: 1,
      accounts: { [legacyAccount.accountId]: legacyAccount },
      entitlements: {},
      issuances: {},
      sealedKeys: {},
    }), 'utf8');

    const store = new FileAccountStore(baseDir);
    await expect(store.getAccountById(legacyAccount.accountId)).resolves.toMatchObject(legacyAccount);
    await store.putSealedEpochKey(1, 'sealed');
    const upgraded = JSON.parse(
      await fs.readFile(path.join(baseDir, 'account-ledger.json'), 'utf8'),
    ) as { version: number; deletedSubjects: Record<string, unknown> };
    expect(upgraded.version).toBe(3);
    expect(upgraded.deletedSubjects).toEqual({});
  });

  it('migrates a version 2 numeric tombstone to the v3 carried shape and still blocks', async () => {
    const subjectHash = 'a'.repeat(64);
    await fs.writeFile(path.join(baseDir, 'account-ledger.json'), JSON.stringify({
      version: 2,
      accounts: {},
      entitlements: {},
      issuances: {},
      sealedKeys: {},
      deletedSubjects: { [subjectHash]: NOW + 60_000 }, // legacy numeric timer
    }), 'utf8');

    const store = new FileAccountStore(baseDir);
    // Force a rewrite so the migrated shape is persisted, then assert v3 structure.
    await store.putSealedEpochKey(1, 'sealed');
    const migrated = JSON.parse(
      await fs.readFile(path.join(baseDir, 'account-ledger.json'), 'utf8'),
    ) as { version: number; deletedSubjects: Record<string, { recreateAfterMs: number; carried: unknown }> };
    expect(migrated.version).toBe(3);
    expect(migrated.deletedSubjects[subjectHash]).toMatchObject({
      recreateAfterMs: NOW + 60_000,
      carried: { ageStatus: 'unknown', parentalConsentState: 'not_required' },
    });
  });

  it('carries a minor determination and a renewal flag across delete-and-recreate (HIGH-1)', async () => {
    const providerSubject = 'minor-subject';
    const store = new FileAccountStore(baseDir);
    const account = await store.upsertAccount({ provider: 'apple', providerSubject, nowMs: NOW });
    if (!account) throw new Error('account setup was unexpectedly blocked');
    await store.setAgeStatus(account.accountId, 'store_minor', 'apple_store');
    await store.flagRenewal(account.accountId, 'revoked_serial_presented', NOW);

    await store.deleteAccount({
      accountId: account.accountId,
      provider: 'apple',
      providerSubject,
      recreateAfterMs: NOW + 60_000,
    });

    // Recreate after the boundary: the new account must STILL be store_minor and
    // renewal-flagged, so the delete could not launder the anti-abuse state.
    const recreated = await store.upsertAccount({ provider: 'apple', providerSubject, nowMs: NOW + 60_000 });
    expect(recreated).toMatchObject({
      ageStatus: 'store_minor',
      ageSource: 'apple_store',
      flagReasonCode: 'revoked_serial_presented',
    });
    expect(recreated?.accountId).not.toBe(account.accountId);
    expect(recreated?.renewalFlaggedAt).toBeTruthy();
  });

  it('fails closed when deletion identity fields do not match the account', async () => {
    const store = new FileAccountStore(baseDir);
    const account = await store.upsertAccount({
      provider: 'apple',
      providerSubject: 'correct-subject',
      nowMs: NOW,
    });
    if (!account) throw new Error('account setup was unexpectedly blocked');

    await store.deleteAccount({
      accountId: account.accountId,
      provider: 'apple',
      providerSubject: 'wrong-subject',
      recreateAfterMs: NOW + 60_000,
    });

    await expect(store.getAccountById(account.accountId)).resolves.toMatchObject(account);
  });
});


describe('FileAccountStore issuance continuity', () => {
  it('atomically accepts only one initial epoch across store instances, then a matching renewal', async () => {
    const first = new FileAccountStore(baseDir);
    const second = new FileAccountStore(baseDir);
    const account = await first.upsertAccount({ provider: 'apple', providerSubject: 'continuity', nowMs: NOW });
    if (!account) throw new Error('missing account');
    const results = await Promise.all([
      first.recordIssuance(account.accountId, 0, NOW, null),
      second.recordIssuance(account.accountId, 1, NOW, null),
    ]);
    expect(results.filter((result) => result === 'recorded')).toHaveLength(1);
    const latest = (await second.getAccountById(account.accountId))!.latestIssuedEpoch!;
    expect(await second.recordIssuance(account.accountId, latest + 1, NOW, null)).toBe('already_issued');
    expect(await first.recordIssuance(account.accountId, latest + 1, NOW, latest)).toBe('recorded');
    expect(await second.recordIssuance(account.accountId, latest + 2, NOW, latest)).toBe('already_issued');
  });

  it('migrates old issuance arrays and preserves their epoch across deletion and restarts', async () => {
    const first = new FileAccountStore(baseDir);
    const account = await first.upsertAccount({ provider: 'apple', providerSubject: 'legacy', nowMs: NOW });
    if (!account) throw new Error('missing account');
    await first.recordIssuance(account.accountId, 0, NOW);
    const ledgerPath = path.join(baseDir, 'account-ledger.json');
    const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf8'));
    delete ledger.accounts[account.accountId].latestIssuedEpoch;
    await fs.writeFile(ledgerPath, JSON.stringify(ledger));
    const second = new FileAccountStore(baseDir);
    expect(await second.recordIssuance(account.accountId, 1, NOW, null)).toBe('already_issued');
    await second.deleteAccount({ accountId: account.accountId, provider: 'apple', providerSubject: 'legacy', recreateAfterMs: NOW + 1 });
    const third = new FileAccountStore(baseDir);
    const recreated = await third.upsertAccount({ provider: 'apple', providerSubject: 'legacy', nowMs: NOW + 2 });
    expect(recreated?.latestIssuedEpoch).toBe(0);
    expect(await third.recordIssuance(recreated!.accountId, 1, NOW, null)).toBe('already_issued');
    expect(await third.recordIssuance(recreated!.accountId, 1, NOW, 0)).toBe('recorded');
  });
});


it('recovers the exact blinded request after a file-store restart without allocating a second slot', async () => {
  const store = new FileAccountStore(baseDir);
  const account = await store.upsertAccount({ provider: 'apple', providerSubject: 'request-replay', nowMs: NOW });
  if (!account) throw new Error('missing account');
  const hash = 'a'.repeat(64);
  expect(await store.recordIssuance(account.accountId, 1, NOW, null, hash)).toBe('recorded');
  const restarted = new FileAccountStore(baseDir);
  expect(await restarted.recordIssuance(account.accountId, 1, NOW, null, hash)).toBe('recorded');
  expect(await restarted.recordIssuance(account.accountId, 1, NOW, null, 'b'.repeat(64))).toBe('already_issued');
  expect((await restarted.stats()).issuances).toBe(1);
});


it('equal target/predecessor permits exact replay only, including across file-store instances', async () => {
  const store = new FileAccountStore(baseDir);
  const account = await store.upsertAccount({ provider: 'apple', providerSubject: 'recovery-only', nowMs: NOW });
  if (!account) throw new Error('missing account');
  const hash = 'c'.repeat(64);
  expect(await store.recordIssuance(account.accountId, 1, NOW, 1, hash)).toBe('already_issued');
  expect(await store.recordIssuance(account.accountId, 1, NOW, null, hash)).toBe('recorded');
  const restarted = new FileAccountStore(baseDir);
  expect(await restarted.recordIssuance(account.accountId, 1, NOW, 1, hash)).toBe('recorded');
  expect(await restarted.recordIssuance(account.accountId, 1, NOW, 1, 'd'.repeat(64))).toBe('already_issued');
  expect(await restarted.recordIssuance(account.accountId, 2, NOW, 2, hash)).toBe('already_issued');
  expect((await restarted.stats()).issuances).toBe(1);
});
