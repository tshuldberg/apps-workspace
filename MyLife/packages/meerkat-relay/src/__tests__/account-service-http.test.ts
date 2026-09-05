/**
 * Plan 51 P1: account-service HTTP route tests. Boots the real node:http server over
 * an in-memory service and drives real requests: sign-in + status happy path, age
 * signal, issuance, the not_configured webhook refusals, and malformed-body bounds.
 */

import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CREDENTIAL_EPOCH_GENESIS_MS,
  credentialEpochAt,
  finalizeBlindCredential,
  parseRsaPublicKeySpki,
  prepareBlindCredentialRequest,
} from '@mylife/sync';
import { AccountService } from '../account-service';
import { InMemoryAccountStore } from '../account-store';
import { InMemoryCredentialBridgeStore } from '../credential-bridge-store';
import { startAccountService, type AccountServiceServer } from '../account-service-http';
import type { SsoProvider, SsoTokenVerifier, SsoVerifyResult } from '../sso-token-verify';

const NOW = CREDENTIAL_EPOCH_GENESIS_MS + 10 * 24 * 60 * 60 * 1000;
const ORIGINS = ['https://app.example.test'];
const randomBytes = (length: number) => new Uint8Array(nodeRandomBytes(length));

function fakeSso(): SsoTokenVerifier {
  return {
    async verify(provider: SsoProvider, token: string): Promise<SsoVerifyResult> {
      if (provider === 'apple' && token === 'tok-a') return { ok: true, provider, subject: 'apple-sub-a' };
      return { ok: false, reason: 'invalid' };
    },
  };
}

let server: AccountServiceServer;
let accountStore: InMemoryAccountStore;
let bridgeStore: InMemoryCredentialBridgeStore;
let service: AccountService;
const now = { value: NOW };

beforeEach(async () => {
  now.value = NOW;
  accountStore = new InMemoryAccountStore();
  bridgeStore = new InMemoryCredentialBridgeStore();
  service = new AccountService({
    accountStore,
    bridgeStore,
    sessionSecret: 'http-session-secret-value-000000000000',
    ssoVerifier: fakeSso(),
    epochKeySecret: 'http-epoch-seal-secret-value-000000000',
    now: () => now.value,
    // No rail secrets configured => every webhook answers not_configured.
  });
  server = await startAccountService({ service, corsAllowedOrigins: ORIGINS });
});

afterEach(async () => {
  await server.close();
});

const headers = { 'content-type': 'application/json', origin: ORIGINS[0] };

async function signIn(): Promise<string> {
  const res = await fetch(`${server.url}/account/sign-in`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ provider: 'apple', providerToken: 'tok-a' }),
  });
  const body = (await res.json()) as { ok: boolean; token: string };
  expect(res.status).toBe(200);
  return body.token;
}

describe('account-service HTTP routes', () => {
  it('signs in and returns a session bearer', async () => {
    const token = await signIn();
    expect(typeof token).toBe('string');
    const status = await fetch(`${server.url}/account/status`, { headers: { authorization: `Bearer ${token}`, origin: ORIGINS[0] } });
    const body = (await status.json()) as { ok: boolean; provider: string; renewalFlagged: boolean };
    expect(status.status).toBe(200);
    expect(body.provider).toBe('apple');
    expect(body.renewalFlagged).toBe(false);
  });

  it('rejects sign-in for an unverifiable token with 401', async () => {
    const res = await fetch(`${server.url}/account/sign-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider: 'apple', providerToken: 'bogus' }),
    });
    expect(res.status).toBe(401);
  });

  it('blocks delete-and-recreate during the same credential epoch', async () => {
    await signIn();
    const deleted = await fetch(`${server.url}/account/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider: 'apple', providerToken: 'tok-a' }),
    });
    expect(deleted.status).toBe(200);

    const recreate = await fetch(`${server.url}/account/sign-in`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ provider: 'apple', providerToken: 'tok-a' }),
    });
    expect(recreate.status).toBe(403);
    expect(await recreate.json()).toEqual({ ok: false, reason: 'account_deleted' });
  });

  it('rejects client age/source assertions and preserves an existing minor restriction', async () => {
    const token = await signIn();
    const account = await accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await accountStore.setAgeStatus(account!.accountId, 'store_minor', 'apple_store');
    for (const source of ['apple_store', 'google_store', 'in_app_gate']) {
      const res = await fetch(`${server.url}/account/age-signal`, {
        method: 'POST', headers: { ...headers, authorization: `Bearer ${token}` },
        body: JSON.stringify({ signal: 'adult', source }),
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false, reason: 'not_configured' });
      expect((await service.getStatus(token))!.ageStatus).toBe('store_minor');
    }
    expect(await service.recordStoreAgeSignal({ token: 'invalid', signal: 'adult', source: 'apple_store' }))
      .toEqual({ ok: false, reason: 'unauthenticated' });
  });

  it('does not present legacy unattested adult rows as store verification', async () => {
    const token = await signIn();
    const account = await accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await accountStore.setAgeStatus(account!.accountId, 'store_adult', 'apple_store');
    expect((await service.getStatus(token))!.ageStatus).toBe('unknown');
  });

  it('issues a credential the client finalizes over the wire', async () => {
    const token = await signIn();
    const account = await accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await accountStore.recordEntitlement({ accountId: account!.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs: now.value });
    const epoch = credentialEpochAt(now.value);

    // Discover the epoch public key over the public route (the real client flow).
    const keyRes = await fetch(`${server.url}/account/credential/epoch-key?epoch=${epoch}`, { headers: { origin: ORIGINS[0] } });
    const keyBody = (await keyRes.json()) as { ok: boolean; publicKey: string };
    expect(keyRes.status).toBe(200);

    const prepared = prepareBlindCredentialRequest(epoch, keyBody.publicKey, randomBytes)!;
    const res = await fetch(`${server.url}/account/credential/issue`, {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${token}` },
      body: JSON.stringify({ blindedMessage: prepared.blindedMessageBase64, epoch }),
    });
    const body = (await res.json()) as { ok: boolean; blindSignature: string; publicKey: string; epoch: number };
    expect(res.status).toBe(200);
    const credential = finalizeBlindCredential(prepared.state, body.publicKey, body.blindSignature);
    expect(credential).not.toBeNull();
  });

  it('answers 503 not_configured for every unconfigured webhook', async () => {
    for (const path of ['apple', 'google', 'stripe']) {
      const res = await fetch(`${server.url}/account/webhooks/${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ signedPayload: 'x' }),
      });
      expect(res.status).toBe(503);
      const body = (await res.json()) as { reason: string };
      expect(body.reason).toBe('not_configured');
    }
  });

  it('rejects a malformed sign-in body with 400 and a schema-oversize token with 400', async () => {
    const bad = await fetch(`${server.url}/account/sign-in`, { method: 'POST', headers, body: JSON.stringify({ provider: 'nope' }) });
    expect(bad.status).toBe(400);
    // A token over the zod max (8192) but under the body cap is a clean 400, never a throw.
    const overSchema = 'a'.repeat(9000);
    const rejected = await fetch(`${server.url}/account/sign-in`, { method: 'POST', headers, body: JSON.stringify({ provider: 'apple', providerToken: overSchema }) });
    expect(rejected.status).toBe(400);
    const badJson = await fetch(`${server.url}/account/sign-in`, { method: 'POST', headers, body: 'not json' });
    expect(badJson.status).toBe(400);
  });

  it('rejects an unauthenticated status call with 401', async () => {
    const res = await fetch(`${server.url}/account/status`, { headers: { origin: ORIGINS[0] } });
    expect(res.status).toBe(401);
  });

  it('serves a bare /healthz', async () => {
    const res = await fetch(`${server.url}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('serves the public epoch key (unauthenticated) that parses and matches a later issue response', async () => {
    const epoch = credentialEpochAt(now.value);
    const res = await fetch(`${server.url}/account/credential/epoch-key?epoch=${epoch}`, { headers: { origin: ORIGINS[0] } });
    const body = (await res.json()) as { ok: boolean; epoch: number; publicKey: string };
    expect(res.status).toBe(200);
    expect(body.epoch).toBe(epoch);
    // The returned key is a valid RSA-2048 SPKI DER public key the pure client parses.
    expect(parseRsaPublicKeySpki(body.publicKey)).not.toBeNull();

    // It matches the publicKey a subsequent issue response returns for the same epoch.
    const token = await signIn();
    const account = await accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await accountStore.recordEntitlement({ accountId: account!.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs: now.value });
    const prepared = prepareBlindCredentialRequest(epoch, body.publicKey, randomBytes)!;
    const issueRes = await fetch(`${server.url}/account/credential/issue`, {
      method: 'POST',
      headers: { ...headers, authorization: `Bearer ${token}` },
      body: JSON.stringify({ blindedMessage: prepared.blindedMessageBase64, epoch }),
    });
    const issueBody = (await issueRes.json()) as { ok: boolean; publicKey: string; blindSignature: string };
    expect(issueRes.status).toBe(200);
    expect(issueBody.publicKey).toBe(body.publicKey);
    // The client can finalize against the discovered key end to end.
    expect(finalizeBlindCredential(prepared.state, issueBody.publicKey, issueBody.blindSignature)).not.toBeNull();
  });

  it('defaults a missing epoch param to the current epoch', async () => {
    const res = await fetch(`${server.url}/account/credential/epoch-key`, { headers: { origin: ORIGINS[0] } });
    const body = (await res.json()) as { ok: boolean; epoch: number };
    expect(res.status).toBe(200);
    expect(body.epoch).toBe(credentialEpochAt(now.value));
  });

  it('refuses an out-of-window epoch with invalid_epoch (no key oracle)', async () => {
    const res = await fetch(`${server.url}/account/credential/epoch-key?epoch=999`, { headers: { origin: ORIGINS[0] } });
    expect(res.status).toBe(400);
    expect((await res.json() as { reason: string }).reason).toBe('invalid_epoch');
  });

  it('answers 503 not_configured for epoch-key when the epoch key secret is unset', async () => {
    const unconfigured = new AccountService({
      accountStore, bridgeStore,
      sessionSecret: 'http-session-secret-value-000000000000',
      ssoVerifier: fakeSso(),
      epochKeySecret: '', // unset => issuance/epoch-key is not_configured
      now: () => now.value,
    });
    const unconfiguredServer = await startAccountService({ service: unconfigured, corsAllowedOrigins: ORIGINS });
    try {
      const res = await fetch(`${unconfiguredServer.url}/account/credential/epoch-key`, { headers: { origin: ORIGINS[0] } });
      expect(res.status).toBe(503);
      expect((await res.json() as { reason: string }).reason).toBe('not_configured');
    } finally {
      await unconfiguredServer.close();
    }
  });
});

describe('credential recovery HTTP boundary', () => {
  it('requires authentication and refuses recovery-only probes without allocating a pass', async () => {
    const key = await service.getEpochKey(0);
    if (!key.ok) throw new Error('key unavailable');
    const prepared = prepareBlindCredentialRequest(0, key.publicKeySpkiDerBase64, randomBytes)!;
    const body = JSON.stringify({ epoch: 0, blindedMessage: prepared.blindedMessageBase64 });
    expect((await fetch(`${server.url}/account/credential/recover`, { method: 'POST', headers, body })).status).toBe(401);
    const token = await signIn();
    const account = await accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await accountStore.recordEntitlement({ accountId: account!.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs: NOW });
    const authenticated = { ...headers, authorization: `Bearer ${token}` };
    const response = await fetch(`${server.url}/account/credential/recover`, { method: 'POST', headers: authenticated, body });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, reason: 'refused' });
    expect((await accountStore.getAccountById(account!.accountId))?.latestIssuedEpoch).toBeUndefined();
    expect((await fetch(`${server.url}/account/credential/issue`, { method: 'POST', headers: authenticated, body })).status).toBe(200);
  });

  it('recovers byte-identical responses and rejects client secret fields', async () => {
    const token = await signIn();
    const account = await accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await accountStore.recordEntitlement({ accountId: account!.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs: NOW });
    const key = await service.getEpochKey(0);
    if (!key.ok) throw new Error('key unavailable');
    const prepared = prepareBlindCredentialRequest(0, key.publicKeySpkiDerBase64, randomBytes)!;
    const body = { epoch: 0, blindedMessage: prepared.blindedMessageBase64 };
    const request = (path: string, bearer: string, payload: unknown) => fetch(`${server.url}/account/credential/${path}`, {
      method: 'POST', headers: { ...headers, authorization: `Bearer ${bearer}` }, body: JSON.stringify(payload),
    });
    const issued = await (await request('issue', token, body)).json();
    now.value += 60_000;
    const rotated = await signIn();
    const recovered = await request('recover', rotated, body);
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual(issued);
    const invalid = await request('recover', rotated, { ...body, blindBase64: prepared.state.blindBase64 });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ ok: false, reason: 'bad_request' });
  });
});
