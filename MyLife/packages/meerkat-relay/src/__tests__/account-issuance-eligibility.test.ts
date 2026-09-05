import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { credentialEpochWindow, prepareBlindCredentialRequest } from '@mylife/sync';
import { AccountService } from '../account-service';
import { InMemoryAccountStore, type AccountStore } from '../account-store';
import { FileAccountStore } from '../account-store-file';
import { InMemoryCredentialBridgeStore } from '../credential-bridge-store';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });

for (const backend of ['memory', 'file'] as const) describe(`atomic eligibility (${backend})`, () => {
  async function fixture() {
    const directory = backend === 'file' ? await mkdtemp(join(tmpdir(), 'meerkat-eligibility-')) : null;
    if (directory) directories.push(directory);
    const store: AccountStore = directory ? new FileAccountStore(directory) : new InMemoryAccountStore();
    const writer: AccountStore = directory ? new FileAccountStore(directory) : store;
    const clock = { now: credentialEpochWindow(1).notBeforeMs + 60_000 };
    let beforeQuota: (() => Promise<void>) | undefined;
    const proxy = new Proxy(store, { get(target, key) {
      if (key === 'recordIssuance') return async (...args: Parameters<AccountStore['recordIssuance']>) => {
        await beforeQuota?.();
        return target.recordIssuance(...args);
      };
      return Reflect.get(target, key);
    } });
    const service = new AccountService({ accountStore: proxy, bridgeStore: new InMemoryCredentialBridgeStore(),
      sessionSecret: 'eligibility-session-fixture', epochKeySecret: 'eligibility-epoch-key-fixture', now: () => clock.now,
      ssoVerifier: { verify: async () => ({ ok: true, provider: 'apple', subject: 'eligibility-fixture' }) },
    });
    const signIn = await service.signIn({ provider: 'apple', providerToken: 'fixture' });
    if (!signIn.ok) throw new Error('sign-in failed');
    const accountId = signIn.accountId;
    async function entitlement(validUntil?: string, status: 'active' | 'revoked' = 'active') {
      await writer.recordEntitlement({ accountId, product: 'app_unlock', rail: 'apple', status, validUntil, nowMs: clock.now });
    }
    await entitlement();
    const key = await service.getEpochKey(1);
    if (!key.ok) throw new Error('key setup failed');
    const request = prepareBlindCredentialRequest(1, key.publicKeySpkiDerBase64, (size) => new Uint8Array(randomBytes(size)))!;
    const input = { token: signIn.token, epoch: 1, blindedMessageBase64: request.blindedMessageBase64 };
    return { service, store, writer, clock, entitlement, input, accountId: signIn.accountId,
      beforeQuota(callback: () => Promise<void>) { beforeQuota = callback; } };
  }

  it('preserves quota for expired active rows and permits a later restored entitlement', async () => {
    const f = await fixture();
    await f.entitlement(new Date(f.clock.now).toISOString());
    expect(await f.service.issueCredential(f.input)).toEqual({ ok: false, reason: 'refused' });
    expect((await f.store.stats()).issuances).toBe(0);
    expect((await f.service.getStatus(f.input.token))?.entitlements[0]?.status).toBe('lapsed');
    await f.entitlement(new Date(f.clock.now + 60_000).toISOString());
    expect((await f.service.issueCredential(f.input)).ok).toBe(true);
  });

  it('rejects malformed expiry instead of treating it as perpetual', async () => {
    const f = await fixture();
    await f.entitlement('invalid-date');
    expect(await f.service.issueCredential(f.input)).toEqual({ ok: false, reason: 'refused' });
    expect((await f.store.stats()).issuances).toBe(0);
  });

  it.each(['flag', 'minor', 'revoke', 'expire'] as const)('rejects %s introduced after the early eligibility read', async (change) => {
    const f = await fixture();
    await f.entitlement(new Date(f.clock.now + 1000).toISOString());
    f.beforeQuota(async () => {
      if (change === 'flag') await f.writer.flagRenewal(f.accountId, 'fixture_flag', f.clock.now);
      if (change === 'minor') await f.writer.setAgeStatus(f.accountId, 'store_minor', 'apple_store');
      if (change === 'revoke') await f.entitlement(undefined, 'revoked');
      if (change === 'expire') f.clock.now += 1000;
    });
    expect(await f.service.issueCredential(f.input)).toEqual({ ok: false, reason: 'refused' });
    expect((await f.store.stats()).issuances).toBe(0);
  });

  it('applies the atomic guard to exact-response recovery too', async () => {
    const f = await fixture();
    expect((await f.service.issueCredential(f.input)).ok).toBe(true);
    f.beforeQuota(async () => { await f.writer.flagRenewal(f.accountId, 'fixture_flag', f.clock.now); });
    expect(await f.service.recoverCredential(f.input)).toEqual({ ok: false, reason: 'refused' });
    expect((await f.store.stats()).issuances).toBe(1);
  });
});
