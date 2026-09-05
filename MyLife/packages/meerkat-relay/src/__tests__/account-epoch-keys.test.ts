import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { credentialEpochWindow, finalizeBlindCredential, prepareBlindCredentialRequest, verifyBlindCredential } from '@mylife/sync';
import { AccountService } from '../account-service';
import { InMemoryAccountStore, type AccountStore } from '../account-store';
import { InMemoryCredentialBridgeStore, type CredentialBridgeStore } from '../credential-bridge-store';
import { FileAccountStore } from '../account-store-file';
import { FileCredentialBridgeStore } from '../credential-bridge-store-file';
import { generateEpochKeyPair, sealEpochPrivateKey } from '../blind-credential-server';

const secret = 'epoch-key-consistency-test-secret';
const now = credentialEpochWindow(0).notBeforeMs + 60_000;
const pair = generateEpochKeyPair(0);
const other = generateEpochKeyPair(0);

function service(accountStore: AccountStore, bridgeStore: CredentialBridgeStore) {
  return new AccountService({ accountStore, bridgeStore, epochKeySecret: secret,
    sessionSecret: 'epoch-key-session-test-secret', now: () => now,
    ssoVerifier: { verify: async () => ({ ok: true, provider: 'apple', subject: 'test-subject' }) },
  });
}

async function issue(issuer: AccountService, store: AccountStore, publicKey: string) {
  const signedIn = await issuer.signIn({ provider: 'apple', providerToken: 'fixture' });
  if (!signedIn.ok) throw new Error('fixture sign-in failed');
  await store.recordEntitlement({ accountId: signedIn.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs: now });
  const request = prepareBlindCredentialRequest(0, publicKey, (size) => new Uint8Array(randomBytes(size)))!;
  const result = await issuer.issueCredential({ token: signedIn.token, epoch: 0, blindedMessageBase64: request.blindedMessageBase64 });
  return { result, request };
}

describe('account epoch key consistency', () => {
  it('independent workers use the stored winner when both observe an empty epoch', async () => {
    const store = new InMemoryAccountStore();
    const bridge = new InMemoryCredentialBridgeStore();
    let reads = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const racing = new Proxy(store, { get(target, property) {
      if (property === 'getSealedEpochKey') return async (epoch: number) => {
        const value = target.getSealedEpochKey(epoch);
        if (++reads <= 2) {
          if (reads === 2) release();
          await barrier;
        }
        return value;
      };
      return Reflect.get(target, property);
    } });
    const workers = [service(racing, bridge), service(racing, bridge)];
    const keys = await Promise.all(workers.map((worker) => worker.getEpochKey(0)));
    expect(keys[0]).toEqual(keys[1]);
    if (!keys[0]!.ok) throw new Error('key setup failed');
    const publicKey = keys[0]!.publicKeySpkiDerBase64;
    expect(bridge.getEpochPublicKey(0)).toBe(publicKey);
    const { result, request } = await issue(service(store, bridge), store, publicKey);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('issuance failed');
    const credential = finalizeBlindCredential(request.state, publicKey, result.blindSignatureBase64)!;
    expect(verifyBlindCredential(credential, publicKey, now)).toBe('ok');
  });

  it('recovers a saved private key whose public publication was interrupted', async () => {
    const store = new InMemoryAccountStore();
    const bridge = new InMemoryCredentialBridgeStore();
    const sealed = sealEpochPrivateKey(secret, pair.privateKeyPkcs8DerBase64);
    store.putSealedEpochKey(0, sealed);
    expect(await service(store, bridge).getEpochKey(0)).toEqual({ ok: true, epoch: 0, publicKeySpkiDerBase64: pair.publicKeySpkiDerBase64 });
    expect(store.getSealedEpochKey(0)).toBe(sealed);
    expect(bridge.getEpochPublicKey(0)).toBe(pair.publicKeySpkiDerBase64);
  });

  it('rejects conflicting public/private keys before consuming issuance quota', async () => {
    const store = new InMemoryAccountStore();
    const bridge = new InMemoryCredentialBridgeStore();
    store.putSealedEpochKey(0, sealEpochPrivateKey(secret, pair.privateKeyPkcs8DerBase64));
    bridge.publishEpochKey(0, other.publicKeySpkiDerBase64, now, now + 1000);
    const issuer = service(store, bridge);
    expect(await issuer.getEpochKey(0)).toEqual({ ok: false, reason: 'not_configured' });
    const { result } = await issue(issuer, store, other.publicKeySpkiDerBase64);
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(store.stats().issuances).toBe(0);
    expect(bridge.getEpochPublicKey(0)).toBe(other.publicKeySpkiDerBase64);
  });
});


it('independent durable file stores agree on a key and a restarted issuer produces a valid pass', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'meerkat-epoch-keys-'));
  try {
    const workers = Array.from({ length: 4 }, () => service(new FileAccountStore(directory), new FileCredentialBridgeStore(directory)));
    const keys = await Promise.all(workers.map((worker) => worker.getEpochKey(0)));
    expect(keys.every((key) => key.ok)).toBe(true);
    expect(new Set(keys.map((key) => key.ok ? key.publicKeySpkiDerBase64 : null)).size).toBe(1);
    const key = keys[0]!;
    if (!key.ok) throw new Error('key setup failed');
    const store = new FileAccountStore(directory);
    const { result, request } = await issue(service(store, new FileCredentialBridgeStore(directory)), store, key.publicKeySpkiDerBase64);
    if (!result.ok) throw new Error('issuance failed');
    const credential = finalizeBlindCredential(request.state, key.publicKeySpkiDerBase64, result.blindSignatureBase64)!;
    expect(verifyBlindCredential(credential, key.publicKeySpkiDerBase64, now)).toBe('ok');
    expect((await store.stats()).issuances).toBe(1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('retries an interrupted publication with the same saved key after a restart', async () => {
  const store = new InMemoryAccountStore();
  const bridge = new InMemoryCredentialBridgeStore();
  let fail = true;
  const failing = new Proxy(bridge, { get(target, property) {
    if (property === 'publishEpochKey' && fail) return () => { throw new Error('publication interrupted'); };
    return Reflect.get(target, property);
  } });
  await expect(service(store, failing).getEpochKey(0)).rejects.toThrow('publication interrupted');
  const saved = store.getSealedEpochKey(0);
  expect(saved).toBeTruthy();
  expect(bridge.getEpochPublicKey(0)).toBeNull();
  fail = false;
  expect((await service(store, bridge).getEpochKey(0)).ok).toBe(true);
  expect(store.getSealedEpochKey(0)).toBe(saved);
});

it('rejects malformed or wrongly sealed saved keys without publishing or consuming quota', async () => {
  for (const sealed of [
    sealEpochPrivateKey(secret, 'not-a-private-key'),
    sealEpochPrivateKey('different-secret-for-fixture', pair.privateKeyPkcs8DerBase64),
  ]) {
    const store = new InMemoryAccountStore();
    const bridge = new InMemoryCredentialBridgeStore();
    store.putSealedEpochKey(0, sealed);
    const issuer = service(store, bridge);
    expect(await issuer.getEpochKey(0)).toEqual({ ok: false, reason: 'not_configured' });
    const { result } = await issue(issuer, store, pair.publicKeySpkiDerBase64);
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(store.stats().issuances).toBe(0);
    expect(bridge.getEpochPublicKey(0)).toBeNull();
    expect(store.getSealedEpochKey(0)).toBe(sealed);
  }
});

it('requires the generated private key to be durable before publishing it', async () => {
  const store = new InMemoryAccountStore();
  const bridge = new InMemoryCredentialBridgeStore();
  const droppingWrites = new Proxy(store, { get(target, property) {
    if (property === 'putSealedEpochKey') return () => undefined;
    return Reflect.get(target, property);
  } });
  expect(await service(droppingWrites, bridge).getEpochKey(0)).toEqual({ ok: false, reason: 'not_configured' });
  expect(bridge.getEpochPublicKey(0)).toBeNull();
});

it('reads back publication and rejects a conflicting concurrent publisher', async () => {
  const store = new InMemoryAccountStore();
  const bridge = new InMemoryCredentialBridgeStore();
  store.putSealedEpochKey(0, sealEpochPrivateKey(secret, pair.privateKeyPkcs8DerBase64));
  const conflicting = new Proxy(bridge, { get(target, property) {
    if (property === 'publishEpochKey') return () => target.publishEpochKey(0, other.publicKeySpkiDerBase64, now, now + 1000);
    return Reflect.get(target, property);
  } });
  expect(await service(store, conflicting).getEpochKey(0)).toEqual({ ok: false, reason: 'not_configured' });
  expect(bridge.getEpochPublicKey(0)).toBe(other.publicKeySpkiDerBase64);
});
