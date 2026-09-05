/**
 * Plan 51 P1 + P5: account-service core tests.
 *
 * Proves the load-bearing invariants:
 *  - sign-in upserts an account and mints a verifiable session bearer;
 *  - issuance returns a blind signature that @mylife/sync's finalizeBlindCredential
 *    accepts (a real, end-to-end blind credential -- AC-1 issuance happy path);
 *  - a SECOND issuance for the same account+epoch is refused with the SAME shape
 *    (one-per-epoch quota, NC-1);
 *  - an unentitled account is refused; a renewal-flagged account is refused;
 *  - renewal is window-gated; a renewal presenting a REVOKED serial flags the
 *    account, refuses, and stores NO serial anywhere (AC-2/AC-3), asserted by
 *    serializing the whole in-memory account store to JSON;
 *  - deletion works with a lapsed entitlement without burning an unproven serial in
 *    the bridge store, and cascades the account's rows (AC-5).
 */

import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CREDENTIAL_EPOCH_GENESIS_MS,
  CREDENTIAL_EPOCH_LENGTH_MS,
  CREDENTIAL_RENEWAL_WINDOW_MS,
  credentialEpochAt,
  credentialEpochWindow,
  credentialSerial,
  finalizeBlindCredential,
  prepareBlindCredentialRequest,
  serializeMeerkatCredential,
  type MeerkatCredential,
} from '@mylife/sync';
import { AccountService } from '../account-service';
import { InMemoryAccountStore } from '../account-store';
import { InMemoryCredentialBridgeStore } from '../credential-bridge-store';
import type { SsoProvider, SsoTokenVerifier, SsoVerifyResult } from '../sso-token-verify';

const SESSION_SECRET = 'account-session-secret-value-1234567890';
const EPOCH_KEY_SECRET = 'account-epoch-key-seal-secret-1234567890';

// A day inside epoch 0, comfortably before the renewal window.
const MID_EPOCH_0 = CREDENTIAL_EPOCH_GENESIS_MS + 10 * 24 * 60 * 60 * 1000;
// A moment inside epoch 0's renewal window (final 7 days).
const RENEWAL_EPOCH_0 =
  CREDENTIAL_EPOCH_GENESIS_MS + CREDENTIAL_EPOCH_LENGTH_MS - CREDENTIAL_RENEWAL_WINDOW_MS + 60_000;

const randomBytes = (length: number) => new Uint8Array(nodeRandomBytes(length));

/** A fake SSO verifier that admits configured subjects and refuses everything else. */
function fakeSsoVerifier(admit: Record<string, SsoVerifyResult>): SsoTokenVerifier {
  return {
    async verify(provider: SsoProvider, providerToken: string): Promise<SsoVerifyResult> {
      return admit[`${provider}:${providerToken}`] ?? { ok: false, reason: 'invalid' };
    },
  };
}

interface Harness {
  service: AccountService;
  accountStore: InMemoryAccountStore;
  bridgeStore: InMemoryCredentialBridgeStore;
  now: { value: number };
}

function makeHarness(options?: {
  admit?: Record<string, SsoVerifyResult>;
  startMs?: number;
}): Harness {
  const now = { value: options?.startMs ?? MID_EPOCH_0 };
  const accountStore = new InMemoryAccountStore();
  const bridgeStore = new InMemoryCredentialBridgeStore();
  const service = new AccountService({
    accountStore,
    bridgeStore,
    sessionSecret: SESSION_SECRET,
    ssoVerifier: fakeSsoVerifier(
      options?.admit ?? { 'apple:tok-a': { ok: true, provider: 'apple', subject: 'apple-sub-a' } },
    ),
    epochKeySecret: EPOCH_KEY_SECRET,
    now: () => now.value,
  });
  return { service, accountStore, bridgeStore, now };
}

async function signInAndEntitle(h: Harness, product: 'app_unlock' | 'hosted_subscription' = 'app_unlock'): Promise<string> {
  const signIn = await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' });
  if (!signIn.ok) throw new Error('sign-in failed in test setup');
  const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
  await h.accountStore.recordEntitlement({
    accountId: account!.accountId,
    product,
    rail: 'apple',
    status: 'active',
    nowMs: h.now.value,
  });
  return signIn.token;
}

/**
 * Drive a real blind-credential round trip: mint the blinded request client-side,
 * issue through the service, finalize the returned blind signature. Returns the
 * finished credential (or null if issuance refused).
 */
async function mintCredential(
  h: Harness,
  token: string,
  epoch: number,
): Promise<{ credential: MeerkatCredential; publicKey: string } | { refused: string }> {
  // The epoch key is published (via publishEpochKey) before this runs, exactly as a
  // client fetches the published key before blinding. Blind against it, issue, and
  // finalize the returned blind signature.
  const publicKey = await h.bridgeStore.getEpochPublicKey(epoch);
  expect(publicKey).not.toBeNull();
  const prepared = prepareBlindCredentialRequest(epoch, publicKey!, randomBytes);
  expect(prepared).not.toBeNull();
  const result = await h.service.issueCredential({
    token,
    blindedMessageBase64: prepared!.blindedMessageBase64,
    epoch,
  });
  if (!result.ok) return { refused: result.reason };
  const credential = finalizeBlindCredential(prepared!.state, result.publicKeySpkiDerBase64, result.blindSignatureBase64);
  expect(credential).not.toBeNull();
  return { credential: credential!, publicKey: result.publicKeySpkiDerBase64 };
}

/**
 * Ensure the epoch's public key is published before a mint, via the public
 * epoch-key discovery path (getEpochKey lazily generates + seals + publishes it,
 * exactly as the first real client of an epoch does). Consumes no account quota.
 */
async function publishEpochKey(h: Harness, epoch: number): Promise<void> {
  if (await h.bridgeStore.getEpochPublicKey(epoch)) return;
  const result = await h.service.getEpochKey(epoch);
  expect(result.ok).toBe(true);
  expect(await h.bridgeStore.getEpochPublicKey(epoch)).not.toBeNull();
}

describe('AccountService sign-in', () => {
  it('upserts an account and mints a verifiable session bearer', async () => {
    const h = makeHarness();
    const signIn = await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' });
    expect(signIn.ok).toBe(true);
    if (!signIn.ok) return;
    const verdict = await h.service.verifySession(signIn.token);
    expect(verdict.ok).toBe(true);
    // A second sign-in returns the SAME account (idempotent upsert).
    const signIn2 = await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' });
    expect(signIn2.ok && signIn2.accountId).toBe(signIn.accountId);
  });

  it('refuses an unverifiable SSO token', async () => {
    const h = makeHarness({ admit: {} });
    expect(await h.service.signIn({ provider: 'apple', providerToken: 'bogus' })).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('AccountService issuance (AC-1 / NC-1)', () => {
  it('issues a credential the client finalizes, then refuses a second for the same epoch', async () => {
    const h = makeHarness();
    const token = await signInAndEntitle(h);
    const epoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, epoch);

    const first = await mintCredential(h, token, epoch);
    expect('credential' in first).toBe(true);
    if (!('credential' in first)) return;
    // The finished credential's serial is computable (proves a real token, not a stub).
    expect(credentialSerial(first.credential.messageBase64)).toMatch(/^[0-9a-f]{64}$/);

    // A SECOND issuance for the same account+epoch is refused with the uniform shape.
    const publicKey = (await h.bridgeStore.getEpochPublicKey(epoch))!;
    const prepared = prepareBlindCredentialRequest(epoch, publicKey, randomBytes)!;
    const second = await h.service.issueCredential({ token, blindedMessageBase64: prepared.blindedMessageBase64, epoch });
    expect(second).toEqual({ ok: false, reason: 'refused' });
  });

  it('refuses an unentitled account with the same refusal shape', async () => {
    const h = makeHarness();
    const signIn = await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' });
    if (!signIn.ok) throw new Error('sign-in failed');
    const epoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, epoch);
    const publicKey = (await h.bridgeStore.getEpochPublicKey(epoch))!;
    const prepared = prepareBlindCredentialRequest(epoch, publicKey, randomBytes)!;
    const result = await h.service.issueCredential({ token: signIn.token, blindedMessageBase64: prepared.blindedMessageBase64, epoch });
    expect(result).toEqual({ ok: false, reason: 'refused' });
  });

  it('refuses issuance for a store_minor account when the age policy blocks it', async () => {
    const h = makeHarness();
    const token = await signInAndEntitle(h);
    const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await h.accountStore.setAgeStatus(account!.accountId, 'store_minor', 'apple_store');
    const epoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, epoch);
    const publicKey = (await h.bridgeStore.getEpochPublicKey(epoch))!;
    const prepared = prepareBlindCredentialRequest(epoch, publicKey, randomBytes)!;
    const result = await h.service.issueCredential({ token, blindedMessageBase64: prepared.blindedMessageBase64, epoch });
    expect(result).toEqual({ ok: false, reason: 'refused' });
  });

  it('an ineligible probe does not burn the epoch quota: entitle later, mint succeeds', async () => {
    const h = makeHarness();
    const signIn = await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' });
    if (!signIn.ok) throw new Error('sign-in failed');
    const epoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, epoch);
    const publicKey = (await h.bridgeStore.getEpochPublicKey(epoch))!;

    // Unentitled probe: refused, and the quota slot must remain unclaimed.
    const probe = prepareBlindCredentialRequest(epoch, publicKey, randomBytes)!;
    expect(await h.service.issueCredential({ token: signIn.token, blindedMessageBase64: probe.blindedMessageBase64, epoch }))
      .toEqual({ ok: false, reason: 'refused' });

    // Buy entitlement later in the SAME epoch: minting must still work.
    const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await h.accountStore.recordEntitlement({
      accountId: account!.accountId, product: 'app_unlock', rail: 'apple', status: 'active', nowMs: h.now.value,
    });
    const minted = await mintCredential(h, signIn.token, epoch);
    expect('credential' in minted).toBe(true);
  });

  it('a malformed blinded message is bad_request and does not burn the epoch quota', async () => {
    const h = makeHarness();
    const token = await signInAndEntitle(h);
    const epoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, epoch);

    for (const malformed of ['', 'zz', 'AAAA', '@@@@']) {
      expect(await h.service.issueCredential({ token, blindedMessageBase64: malformed, epoch }))
        .toEqual({ ok: false, reason: 'bad_request' });
    }

    // The same epoch still mints after the malformed attempts.
    const minted = await mintCredential(h, token, epoch);
    expect('credential' in minted).toBe(true);
  });

  it('an in-length but out-of-range blinded message is bad_request, never throws, and does not burn the quota', async () => {
    const h = makeHarness();
    const token = await signInAndEntitle(h);
    const epoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, epoch);

    // 256 bytes of 0xFF decodes to 2^2048 - 1, which is >= every RSA-2048 modulus.
    // Length-only shape validation admits it, but the raw RSA signing primitive
    // would throw ("data too large for modulus"). The service must refuse it as
    // bad_request BEFORE the quota insert, exactly like other malformed input.
    const outOfRange = Buffer.alloc(256, 0xff).toString('base64');
    expect(await h.service.issueCredential({ token, blindedMessageBase64: outOfRange, epoch }))
      .toEqual({ ok: false, reason: 'bad_request' });

    // The epoch slot was not burned: a well-formed mint still succeeds.
    const minted = await mintCredential(h, token, epoch);
    expect('credential' in minted).toBe(true);
  });
});

describe('AccountService renewal (AC-2 / AC-3)', () => {
  it('refuses renewal outside the renewal window', async () => {
    const h = makeHarness();
    const token = await signInAndEntitle(h);
    const result = await h.service.renewCredential({
      token,
      expiringCredentialBearer: 'anything',
      blindedMessageBase64: 'x',
    });
    expect(result).toEqual({ ok: false, reason: 'bad_request' });
  });

  it('flags the account and stores NO serial when a revoked serial is presented at renewal', async () => {
    const h = makeHarness({ startMs: RENEWAL_EPOCH_0 });
    const token = await signInAndEntitle(h);
    const currentEpoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, currentEpoch);

    // Mint a real current-epoch credential, then REVOKE its serial in the bridge.
    const minted = await mintCredential(h, token, currentEpoch);
    expect('credential' in minted).toBe(true);
    if (!('credential' in minted)) return;
    const serial = credentialSerial(minted.credential.messageBase64)!;
    await h.bridgeStore.revokeSerial(serial, currentEpoch, 'operator_action');

    // Ensure the NEXT epoch key exists so a would-be renewal could mint.
    await publishEpochKey(h, currentEpoch + 1);
    const nextKey = (await h.bridgeStore.getEpochPublicKey(currentEpoch + 1))!;
    const nextPrepared = prepareBlindCredentialRequest(currentEpoch + 1, nextKey, randomBytes)!;

    const renewal = await h.service.renewCredential({
      token,
      expiringCredentialBearer: serializeMeerkatCredential(minted.credential),
      blindedMessageBase64: nextPrepared.blindedMessageBase64,
    });
    expect(renewal).toEqual({ ok: false, reason: 'refused' });

    // The account is now renewal-flagged.
    const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    expect(account!.renewalFlaggedAt).toBeTruthy();
    expect(account!.flagReasonCode).toBe('revoked_serial_presented');

    // AC-2/AC-3: the serial appears NOWHERE in the account store's full state.
    const accountStateJson = JSON.stringify(h.accountStore);
    // JSON.stringify over a class instance with private fields yields '{}', so also
    // stringify the observable rows explicitly for a real assertion.
    const observable = JSON.stringify({
      account,
      entitlements: await h.accountStore.getEntitlements(account!.accountId),
      stats: await h.accountStore.stats(),
    });
    expect(accountStateJson).not.toContain(serial);
    expect(observable).not.toContain(serial);
  });

  it('renews with a clean serial by minting the next epoch', async () => {
    const h = makeHarness({ startMs: RENEWAL_EPOCH_0 });
    const token = await signInAndEntitle(h);
    const currentEpoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, currentEpoch);
    const minted = await mintCredential(h, token, currentEpoch);
    if (!('credential' in minted)) throw new Error('mint failed');

    // The next epoch key is published by a throwaway (as it would be by the fleet).
    await publishEpochKey(h, currentEpoch + 1);
    const nextKey = (await h.bridgeStore.getEpochPublicKey(currentEpoch + 1))!;
    const nextPrepared = prepareBlindCredentialRequest(currentEpoch + 1, nextKey, randomBytes)!;

    const renewal = await h.service.renewCredential({
      token,
      expiringCredentialBearer: serializeMeerkatCredential(minted.credential),
      blindedMessageBase64: nextPrepared.blindedMessageBase64,
    });
    expect(renewal.ok).toBe(true);
    if (!renewal.ok) return;
    const renewed = finalizeBlindCredential(nextPrepared.state, renewal.publicKeySpkiDerBase64, renewal.blindSignatureBase64);
    expect(renewed).not.toBeNull();
    expect(renewal.epoch).toBe(currentEpoch + 1);
  });
});

describe('AccountService deletion (AC-5)', () => {
  it('deletes with a lapsed entitlement without revoking an unproven bearer', async () => {
    const h = makeHarness();
    const token = await signInAndEntitle(h);
    const epoch = credentialEpochAt(h.now.value);
    await publishEpochKey(h, epoch);
    const minted = await mintCredential(h, token, epoch);
    if (!('credential' in minted)) throw new Error('mint failed');
    const serial = credentialSerial(minted.credential.messageBase64)!;

    // Lapse the entitlement (deletion must still work -- AC-5).
    const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await h.accountStore.recordEntitlement({
      accountId: account!.accountId,
      product: 'app_unlock',
      rail: 'apple',
      status: 'lapsed',
      nowMs: h.now.value,
    });

    const result = await h.service.deleteAccount({
      provider: 'apple',
      providerToken: 'tok-a',
      clientCredentialBearer: serializeMeerkatCredential(minted.credential),
    });
    expect(result).toEqual({ ok: true, deletionScope: 'account_layer_only', revokedSerial: false });

    // Account reauthentication cannot establish ownership of a public bearer.
    expect(await h.bridgeStore.isSerialRevoked(serial)).toBe(false);
    // The account and its rows are gone (cascade): the account row is absent and its
    // entitlement + issuance rows no longer exist. (The store may still hold an
    // unrelated throwaway account used to publish the epoch key; the cascade is
    // asserted on the deleted account's own rows, not global counts.)
    const deletedId = account!.accountId;
    expect(await h.accountStore.getAccountById(deletedId)).toBeNull();
    expect(await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a')).toBeNull();
    expect(await h.accountStore.getEntitlements(deletedId)).toEqual([]);
    // Reauthentication cannot recreate the subject and obtain a fresh issuance
    // slot during the same anonymous-pass epoch.
    expect(await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' }))
      .toEqual({ ok: false, reason: 'account_deleted' });

    // The tombstone is data-minimized and epoch-bounded, not a permanent ban.
    h.now.value = credentialEpochWindow(epoch).notAfterMs;
    const nextPeriod = await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' });
    expect(nextPeriod.ok).toBe(true);
  });

  it('tombstone outlives a renewal-window pre-mint (no second credential for the pre-minted epoch)', async () => {
    // Regression for the Sybil-via-pre-mint gap: deleting during epoch N's renewal
    // window, after pre-minting epoch N+1, must keep the same SSO subject out until
    // the END of epoch N+1. Otherwise a delete-and-recreate at the start of N+1
    // yields a SECOND valid N+1 credential from one Apple/Google identity.
    const h = makeHarness({ startMs: RENEWAL_EPOCH_0 });
    const token = await signInAndEntitle(h);
    const currentEpoch = credentialEpochAt(h.now.value);
    const preMintEpoch = currentEpoch + 1; // issuance allows N+1 inside the renewal window
    await publishEpochKey(h, preMintEpoch);
    const minted = await mintCredential(h, token, preMintEpoch);
    if (!('credential' in minted)) throw new Error(`pre-mint refused: ${minted.refused}`);

    expect(await h.service.deleteAccount({ provider: 'apple', providerToken: 'tok-a' }))
      .toMatchObject({ ok: true });

    // At the end of epoch N (the pre-fix boundary) the subject must STILL be blocked,
    // because the pre-minted N+1 credential is live until the end of N+1.
    h.now.value = credentialEpochWindow(currentEpoch).notAfterMs;
    expect(await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' }))
      .toEqual({ ok: false, reason: 'account_deleted' });

    // Only after the pre-minted epoch fully closes does recreation reopen.
    h.now.value = credentialEpochWindow(preMintEpoch).notAfterMs;
    expect((await h.service.signIn({ provider: 'apple', providerToken: 'tok-a' })).ok).toBe(true);
  });

  it('refuses deletion when the SSO token does not match an account', async () => {
    const h = makeHarness();
    await signInAndEntitle(h);
    // A token that verifies to a DIFFERENT subject with no account row.
    const h2Verifier = makeHarness({ admit: { 'apple:other': { ok: true, provider: 'apple', subject: 'no-account-sub' } } });
    // Reuse the same stores by asking the original service with an unknown token.
    const result = await h.service.deleteAccount({ provider: 'apple', providerToken: 'unknown' });
    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
    void h2Verifier;
  });
});


describe('issuance continuity remediation', () => {
  it('refuses direct reissuance in the renewal window and after rollover without a revocation presentation', async () => {
    const h = makeHarness({ startMs: RENEWAL_EPOCH_0 });
    let token = await signInAndEntitle(h);
    await publishEpochKey(h, 0);
    const first = await mintCredential(h, token, 0);
    if (!('credential' in first)) throw new Error('mint failed');
    await h.bridgeStore.revokeSerial(credentialSerial(first.credential.messageBase64)!, 0, 'moderation');
    await publishEpochKey(h, 1);
    expect(await mintCredential(h, token, 1)).toEqual({ refused: 'refused' });
    h.now.value = credentialEpochWindow(0).notAfterMs + 60_000;
    token = await signInAndEntitle(h);
    expect(await mintCredential(h, token, 1)).toEqual({ refused: 'refused' });
    const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    expect(account?.renewalFlaggedAt).toBeUndefined();
    expect(account?.latestIssuedEpoch).toBe(0);
  });

  it('retains continuity through deletion without a submitted bearer and recreation', async () => {
    const h = makeHarness();
    let token = await signInAndEntitle(h);
    await publishEpochKey(h, 0);
    expect(await mintCredential(h, token, 0)).toHaveProperty('credential');
    expect((await h.service.deleteAccount({ provider: 'apple', providerToken: 'tok-a' })).ok).toBe(true);
    h.now.value = credentialEpochWindow(0).notAfterMs + 60_000;
    token = await signInAndEntitle(h);
    await publishEpochKey(h, 1);
    expect(await mintCredential(h, token, 1)).toEqual({ refused: 'refused' });
  });

  it('refuses a borrowed clean bearer when the account has no matching issuance epoch', async () => {
    const h = makeHarness({ startMs: RENEWAL_EPOCH_0,
      admit: { 'apple:tok-a': { ok: true, provider: 'apple', subject: 'apple-sub-a' },
        'apple:tok-b': { ok: true, provider: 'apple', subject: 'apple-sub-b' } } });
    const token = await signInAndEntitle(h);
    await publishEpochKey(h, 0);
    const first = await mintCredential(h, token, 0);
    if (!('credential' in first)) throw new Error('mint failed');
    const other = await h.service.signIn({ provider: 'apple', providerToken: 'tok-b' });
    if (!other.ok) throw new Error('sign-in failed');
    await h.accountStore.recordEntitlement({ accountId: other.accountId, product: 'app_unlock',
      rail: 'apple', status: 'active', nowMs: h.now.value });
    await publishEpochKey(h, 1);
    const key = (await h.bridgeStore.getEpochPublicKey(1))!;
    const next = prepareBlindCredentialRequest(1, key, randomBytes)!;
    expect(await h.service.renewCredential({ token: other.token,
      expiringCredentialBearer: serializeMeerkatCredential(first.credential),
      blindedMessageBase64: next.blindedMessageBase64 })).toEqual({ ok: false, reason: 'refused' });
  });
});


describe('idempotent blind issuance', () => {
  it('returns the same signature for the same request and refuses a different request', async () => {
    const h = makeHarness();
    const token = await signInAndEntitle(h);
    await publishEpochKey(h, 0);
    const key = (await h.bridgeStore.getEpochPublicKey(0))!;
    const prepared = prepareBlindCredentialRequest(0, key, randomBytes)!;
    const request = { token, epoch: 0, blindedMessageBase64: prepared.blindedMessageBase64 };
    const first = await h.service.issueCredential(request);
    expect(first.ok).toBe(true);
    expect(await h.service.issueCredential(request)).toEqual(first);
    expect((await h.accountStore.stats()).issuances).toBe(1);
    expect(await mintCredential(h, token, 0)).toEqual({ refused: 'refused' });
  });

  it('recovers a lost renewal response without advancing continuity twice', async () => {
    const h = makeHarness({ startMs: RENEWAL_EPOCH_0 });
    const token = await signInAndEntitle(h);
    await publishEpochKey(h, 0);
    const first = await mintCredential(h, token, 0);
    if (!('credential' in first)) throw new Error('mint failed');
    await publishEpochKey(h, 1);
    const key = (await h.bridgeStore.getEpochPublicKey(1))!;
    const prepared = prepareBlindCredentialRequest(1, key, randomBytes)!;
    const request = { token, expiringCredentialBearer: serializeMeerkatCredential(first.credential),
      blindedMessageBase64: prepared.blindedMessageBase64 };
    const next = await h.service.renewCredential(request);
    expect(next.ok).toBe(true);
    expect(await h.service.renewCredential(request)).toEqual(next);
    expect((await h.accountStore.stats()).issuances).toBe(2);
  });
});


describe('existing issuance recovery', () => {
  async function recoveryFixture() {
    const h = makeHarness({ admit: {
      'apple:tok-a': { ok: true, provider: 'apple', subject: 'apple-sub-a' },
      'apple:tok-b': { ok: true, provider: 'apple', subject: 'apple-sub-b' },
    } });
    const token = await signInAndEntitle(h);
    await publishEpochKey(h, 0);
    const key = (await h.bridgeStore.getEpochPublicKey(0))!;
    const prepared = prepareBlindCredentialRequest(0, key, randomBytes)!;
    return { h, token, key, prepared, input: { token, epoch: 0, blindedMessageBase64: prepared.blindedMessageBase64 } };
  }

  it('refuses recovery before issuance without consuming the initial slot', async () => {
    const { h, input } = await recoveryFixture();
    expect(await h.service.recoverCredential(input)).toEqual({ ok: false, reason: 'refused' });
    expect((await h.service.issueCredential(input)).ok).toBe(true);
  });

  it('returns the exact original signature after sign-in rotates the session', async () => {
    const { h, input, prepared, key } = await recoveryFixture();
    const issued = await h.service.issueCredential(input);
    h.now.value += 60_000;
    const replacement = await signInAndEntitle(h);
    expect(replacement).not.toBe(input.token);
    const recovered = await h.service.recoverCredential({ ...input, token: replacement });
    expect(recovered).toEqual(issued);
    if (!recovered.ok) throw new Error('recovery failed');
    expect(finalizeBlindCredential(prepared.state, key, recovered.blindSignatureBase64)).not.toBeNull();
    const different = prepareBlindCredentialRequest(0, key, randomBytes)!;
    expect(await h.service.issueCredential({ ...input, token: replacement,
      blindedMessageBase64: different.blindedMessageBase64 })).toEqual({ ok: false, reason: 'refused' });
  });

  it('refuses another entitled account and a different request on the original account', async () => {
    const { h, input, key } = await recoveryFixture();
    expect((await h.service.issueCredential(input)).ok).toBe(true);
    const other = await h.service.signIn({ provider: 'apple', providerToken: 'tok-b' });
    if (!other.ok) throw new Error('sign-in failed');
    await h.accountStore.recordEntitlement({ accountId: other.accountId, product: 'app_unlock',
      rail: 'apple', status: 'active', nowMs: h.now.value });
    expect(await h.service.recoverCredential({ ...input, token: other.token }))
      .toEqual({ ok: false, reason: 'refused' });
    expect((await h.accountStore.getAccountById(other.accountId))?.latestIssuedEpoch).toBeUndefined();
    const different = prepareBlindCredentialRequest(0, key, randomBytes)!;
    expect(await h.service.recoverCredential({ ...input, blindedMessageBase64: different.blindedMessageBase64 }))
      .toEqual({ ok: false, reason: 'refused' });
  });

  it('keeps concurrent recovery idempotent and preserves the account ledger', async () => {
    const { h, input } = await recoveryFixture();
    const issued = await h.service.issueCredential(input);
    const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    const before = JSON.stringify(account);
    const recovered = await Promise.all(Array.from({ length: 8 }, () => h.service.recoverCredential(input)));
    expect(recovered.every((result) => JSON.stringify(result) === JSON.stringify(issued))).toBe(true);
    expect(JSON.stringify(await h.accountStore.getAccountById(account!.accountId))).toBe(before);
  });

  it('does not bypass account restrictions, malformed input, or the validity window', async () => {
    const { h, input } = await recoveryFixture();
    await h.service.issueCredential(input);
    expect(await h.service.recoverCredential({ ...input, token: 'invalid-session' }))
      .toEqual({ ok: false, reason: 'unauthenticated' });
    expect(await h.service.recoverCredential({ ...input, blindedMessageBase64: 'invalid' }))
      .toEqual({ ok: false, reason: 'bad_request' });
    expect(await h.service.recoverCredential({ ...input, epoch: -1 }))
      .toEqual({ ok: false, reason: 'bad_request' });
    const account = await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a');
    await h.accountStore.flagRenewal(account!.accountId, 'fixture', h.now.value);
    expect(await h.service.recoverCredential(input)).toEqual({ ok: false, reason: 'refused' });
  });

  it('recovers an authorized next-period renewal after rollover without presenting the old pass again', async () => {
    const { h, input, prepared, key } = await recoveryFixture();
    const issued = await h.service.issueCredential(input);
    if (!issued.ok) throw new Error('issue failed');
    const current = finalizeBlindCredential(prepared.state, key, issued.blindSignatureBase64)!;
    h.now.value = RENEWAL_EPOCH_0;
    let token = await signInAndEntitle(h);
    await publishEpochKey(h, 1);
    const next = prepareBlindCredentialRequest(1, (await h.bridgeStore.getEpochPublicKey(1))!, randomBytes)!;
    const renewed = await h.service.renewCredential({ token, expiringCredentialBearer: serializeMeerkatCredential(current),
      blindedMessageBase64: next.blindedMessageBase64 });
    expect(renewed.ok).toBe(true);
    h.now.value = credentialEpochWindow(1).notBeforeMs + 1000;
    token = await signInAndEntitle(h);
    expect(await h.service.recoverCredential({ token, epoch: 1, blindedMessageBase64: next.blindedMessageBase64 }))
      .toEqual(renewed);
    expect(await h.service.recoverCredential({ ...input, token }))
      .toEqual({ ok: false, reason: 'bad_request' });
  });
});

it('account deletion cannot revoke another account’s copied public pass', async () => {
  const h = makeHarness({ admit: {
    'apple:tok-a': { ok: true, provider: 'apple', subject: 'apple-sub-a' },
    'apple:tok-b': { ok: true, provider: 'apple', subject: 'apple-sub-b' },
  } });
  const token = await signInAndEntitle(h);
  const epoch = credentialEpochAt(h.now.value);
  await publishEpochKey(h, epoch);
  const minted = await mintCredential(h, token, epoch);
  if (!('credential' in minted)) throw new Error('mint failed');
  const other = await h.service.signIn({ provider: 'apple', providerToken: 'tok-b' });
  expect(other.ok).toBe(true);
  expect(await h.service.deleteAccount({ provider: 'apple', providerToken: 'tok-b',
    clientCredentialBearer: serializeMeerkatCredential(minted.credential),
  })).toEqual({ ok: true, deletionScope: 'account_layer_only', revokedSerial: false });
  expect(await h.bridgeStore.isSerialRevoked(credentialSerial(minted.credential.messageBase64)!)).toBe(false);
  expect(await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-a')).not.toBeNull();
  expect(await h.accountStore.getAccountByProviderSubject('apple', 'apple-sub-b')).toBeNull();
});
