// Key custody store twin (plan 48 WP6). These exercise the in-memory mirror of
// migration 20260730000008: return-code priorities, nonce binding and
// consumption, in-transaction head re-assertion, global active-pubkey
// uniqueness, revocation precedence, the escrow rails, and the no-kit recovery
// state machine. The twin is what the edge tests run against, so a divergence
// here is a divergence in what the handlers are proven to do.

import { describe, expect, it } from 'vitest';
import { createInMemoryMyNewsStore } from '../mynews-store.ts';

const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_USER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROFILE = '11111111-1111-1111-1111-111111111111';
const OTHER_PROFILE = '22222222-2222-2222-2222-222222222222';

const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);
const KEY_C = 'c'.repeat(64);
const KEY_D = 'd'.repeat(64);
const NONCE_1 = '1'.repeat(64);
const NONCE_2 = '2'.repeat(64);
const NONCE_3 = '3'.repeat(64);
const TOKEN_HASH = 'f'.repeat(64);
const OTHER_TOKEN_HASH = 'e'.repeat(64);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function setup(options?: {
  now?: () => number;
  journalists?: Array<{ profileId: string; tier: 'open' | 'verified' }>;
  notifyChannels?: Array<{ profileId: string; confirmedAt: string | null }>;
  extraProfiles?: Array<{ id: string; userId?: string; pubkey: string }>;
  recoveryRequests?: NonNullable<Parameters<typeof createInMemoryMyNewsStore>[0]>['recoveryRequests'];
}) {
  return createInMemoryMyNewsStore({
    now: options?.now,
    profiles: [
      { id: PROFILE, userId: USER, pubkey: KEY_A, handle: 'reporter' },
      ...(options?.extraProfiles ?? []),
    ],
    journalists: options?.journalists,
    notifyChannels: options?.notifyChannels,
    recoveryRequests: options?.recoveryRequests,
  });
}

async function issue(
  store: ReturnType<typeof setup>['store'],
  purpose: Parameters<typeof store.issueKeyNonce>[0]['purpose'],
  nonce = NONCE_1,
  userId = USER,
) {
  return store.issueKeyNonce({ userId, nonce, purpose });
}

describe('active-key resolver', () => {
  it('resolves a backfilled initial key as active', async () => {
    const { store } = setup();
    expect(await store.resolveActiveKey(KEY_A)).toMatchObject({
      verdict: 'active',
      profileId: PROFILE,
      kind: 'primary',
    });
  });

  it('returns unknown for a key that was never on any chain', async () => {
    const { store } = setup();
    expect(await store.resolveActiveKey(KEY_Z())).toEqual({ verdict: 'unknown' });
  });

  it('returns unknown for an empty pubkey rather than matching an empty head', async () => {
    const { store } = setup();
    expect(await store.resolveActiveKey('')).toEqual({ verdict: 'unknown' });
  });

  it('returns revoked, not unknown, after a rotation', async () => {
    const { store } = setup();
    await rotate(store, KEY_B);
    expect(await store.resolveActiveKey(KEY_A)).toMatchObject({ verdict: 'revoked' });
    expect(await store.resolveActiveKey(KEY_B)).toMatchObject({ verdict: 'active' });
  });

  it('never resolves an ANONYMIZED profile head as active', async () => {
    // WP5 disposition clears pubkey_ed25519 and stamps pubkey_revoked_at. Such a
    // profile gets no backfilled chain row at all, so its key is unknown, and
    // even a seeded chain row on it resolves as revoked.
    const { store } = createInMemoryMyNewsStore({
      profiles: [
        {
          id: PROFILE,
          userId: undefined,
          pubkey: '',
          deletedAt: '2026-07-01T00:00:00.000Z',
          pubkeyRevokedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
      profileKeys: [{ id: 'stale-key', profileId: PROFILE, pubkey: KEY_A, status: 'active' }],
    });
    expect(await store.resolveActiveKey(KEY_A)).toMatchObject({ verdict: 'revoked' });
  });

  it('is created by an initial bind, so a fresh registration can publish', async () => {
    const { store } = createInMemoryMyNewsStore({
      profiles: [{ id: PROFILE, userId: USER, pubkey: '' }],
    });
    expect(await store.resolveActiveKey(KEY_A)).toEqual({ verdict: 'unknown' });
    expect(await store.setProfilePubkey(USER, KEY_A)).toBe('ok');
    expect(await store.resolveActiveKey(KEY_A)).toMatchObject({
      verdict: 'active',
      profileId: PROFILE,
    });
  });
});

function KEY_Z() {
  return '9'.repeat(64);
}

async function rotate(
  store: ReturnType<typeof setup>['store'],
  newPubkey: string,
  nonce = NONCE_1,
) {
  const issued = await store.issueKeyNonce({ userId: USER, nonce, purpose: 'rotation' });
  expect(issued.outcome).toBe('ok');
  return store.rotateProfileKey({
    userId: USER,
    nonce,
    newPubkey,
    addedVia: 'rotation',
    proof: {},
  });
}

describe('nonce issuance and binding', () => {
  it('binds the nonce to the CURRENT head and echoes it for signing', async () => {
    const { store } = setup();
    const issued = await issue(store, 'rotation');
    expect(issued).toMatchObject({
      outcome: 'ok',
      nonce: NONCE_1,
      profileId: PROFILE,
      oldPubkey: KEY_A,
      purpose: 'rotation',
    });
  });

  it('refuses a profile with no head: there is nothing to bind a proof to', async () => {
    const { store } = createInMemoryMyNewsStore({
      profiles: [{ id: PROFILE, userId: USER, pubkey: '' }],
    });
    expect(await issue(store, 'rotation')).toEqual({ outcome: 'no-active-key' });
  });

  it('refuses a caller with no profile', async () => {
    const { store } = setup();
    expect(await issue(store, 'rotation', NONCE_1, OTHER_USER)).toEqual({ outcome: 'no-profile' });
  });

  it('rejects a malformed nonce value', async () => {
    const { store } = setup();
    expect(await store.issueKeyNonce({ userId: USER, nonce: 'short', purpose: 'rotation' })).toEqual(
      { outcome: 'bad-payload' },
    );
  });

  it('rate limits issuance to 10 per 5 minutes', async () => {
    let now = 1_000_000;
    const { store } = setup({ now: () => now });
    for (let i = 0; i < 10; i += 1) {
      const nonce = i.toString(16).padStart(64, '0');
      expect((await issue(store, 'rotation', nonce)).outcome).toBe('ok');
    }
    expect((await issue(store, 'rotation', 'a'.repeat(63) + '1')).outcome).toBe('rate-limited');
    // The window rolls: after it elapses the expired nonces are swept and
    // issuance resumes.
    now += 6 * 60 * 1000;
    expect((await issue(store, 'rotation', 'a'.repeat(63) + '2')).outcome).toBe('ok');
  });

  it('never reissues the same nonce value', async () => {
    const { store } = setup();
    expect((await issue(store, 'rotation')).outcome).toBe('ok');
    expect((await issue(store, 'device_approval')).outcome).toBe('bad-nonce');
  });
});

describe('rotation', () => {
  it('revokes the old key, activates the new one, moves the head, and emits an event', async () => {
    const { store, state } = setup();
    const result = await rotate(store, KEY_B);
    expect(result.outcome).toBe('ok');
    expect(result.previousKeyId).toBeDefined();
    expect(result.backupRestore).toBe(false);

    const status = await store.getKeyCustodyStatus(USER);
    expect(status.headPubkey).toBe(KEY_B);
    expect(status.keys?.find((k) => k.pubkey === KEY_A)?.status).toBe('revoked');
    expect(status.keys?.find((k) => k.pubkey === KEY_B)).toMatchObject({
      status: 'active',
      kind: 'primary',
      addedVia: 'rotation',
    });
    expect(state.keyEvents.map((e) => e.kind)).toEqual(['rotation']);
  });

  it('links the new row to the previous one, so the chain is walkable', async () => {
    const { store, state } = setup();
    const result = await rotate(store, KEY_B);
    const newRow = state.profileKeys.find((k) => k.id === result.keyId);
    expect(newRow?.prevKeyId).toBe(result.previousKeyId);
  });

  it('consumes the nonce: a replayed rotation fails', async () => {
    const { store } = setup();
    expect((await rotate(store, KEY_B)).outcome).toBe('ok');
    // The nonce is gone, so the second attempt cannot even reach the head check.
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_1,
        newPubkey: KEY_C,
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'bad-nonce' });
  });

  it('rejects an expired nonce', async () => {
    let now = 1_000_000;
    const { store } = setup({ now: () => now });
    expect((await issue(store, 'rotation')).outcome).toBe('ok');
    now += 5 * 60 * 1000 + 1;
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_1,
        newPubkey: KEY_B,
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'bad-nonce' });
  });

  it('rejects a nonce issued for a DIFFERENT purpose', async () => {
    const { store } = setup();
    expect((await issue(store, 'device_approval')).outcome).toBe('ok');
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_1,
        newPubkey: KEY_B,
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'bad-nonce' });
  });

  it('rejects a nonce issued to a DIFFERENT user', async () => {
    const { store } = setup({
      extraProfiles: [{ id: OTHER_PROFILE, userId: OTHER_USER, pubkey: KEY_D }],
    });
    expect((await issue(store, 'rotation', NONCE_1, OTHER_USER)).outcome).toBe('ok');
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_1,
        newPubkey: KEY_B,
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'bad-nonce' });
  });

  it('loses to a CONCURRENT rotation with head-conflict instead of forking the chain', async () => {
    const { store, state } = setup();
    // Two nonces minted against the same head, as two devices racing would.
    expect((await issue(store, 'rotation', NONCE_1)).outcome).toBe('ok');
    expect((await issue(store, 'rotation', NONCE_2)).outcome).toBe('ok');

    expect(
      (
        await store.rotateProfileKey({
          userId: USER,
          nonce: NONCE_1,
          newPubkey: KEY_B,
          addedVia: 'rotation',
          proof: {},
        })
      ).outcome,
    ).toBe('ok');
    // The head moved, so the second proof is void: its nonce still binds KEY_A.
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_2,
        newPubkey: KEY_C,
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'head-conflict' });

    // Exactly one active primary survives, and the loser wrote nothing.
    const active = state.profileKeys.filter((k) => k.status === 'active' && k.kind === 'primary');
    expect(active).toHaveLength(1);
    expect(active[0]?.pubkey).toBe(KEY_B);
    expect(state.profileKeys.some((k) => k.pubkey === KEY_C)).toBe(false);
    expect(state.keyEvents).toHaveLength(1);
  });

  it('refuses to rotate to a key that is active on ANOTHER profile', async () => {
    const { store, state } = setup({
      extraProfiles: [{ id: OTHER_PROFILE, userId: OTHER_USER, pubkey: KEY_D }],
    });
    expect((await issue(store, 'rotation')).outcome).toBe('ok');
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_1,
        newPubkey: KEY_D,
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'pubkey-conflict' });
    // Nothing mutated: the head and the chain are untouched.
    expect((await store.getKeyCustodyStatus(USER)).headPubkey).toBe(KEY_A);
    expect(state.keyEvents).toHaveLength(0);
  });

  it('refuses a no-op rotation to the same key', async () => {
    const { store } = setup();
    expect((await issue(store, 'rotation')).outcome).toBe('ok');
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_1,
        newPubkey: KEY_A,
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'same-key' });
  });

  it('rejects a malformed new pubkey', async () => {
    const { store } = setup();
    expect(
      await store.rotateProfileKey({
        userId: USER,
        nonce: NONCE_1,
        newPubkey: 'nope',
        addedVia: 'rotation',
        proof: {},
      }),
    ).toEqual({ outcome: 'bad-payload' });
  });
});

describe('device approval and co-activity', () => {
  async function approve(store: ReturnType<typeof setup>['store'], pubkey: string, nonce = NONCE_1) {
    expect((await issue(store, 'device_approval', nonce)).outcome).toBe('ok');
    return store.approveDeviceKey({ userId: USER, nonce, devicePubkey: pubkey, proof: {} });
  }

  it('adds a co-active device key without disturbing the primary or the head', async () => {
    const { store } = setup();
    expect((await approve(store, KEY_B)).outcome).toBe('ok');
    const status = await store.getKeyCustodyStatus(USER);
    expect(status.headPubkey).toBe(KEY_A);
    expect(status.keys?.filter((k) => k.status === 'active')).toHaveLength(2);
    expect(await store.resolveActiveKey(KEY_A)).toMatchObject({ verdict: 'active', kind: 'primary' });
    expect(await store.resolveActiveKey(KEY_B)).toMatchObject({ verdict: 'active', kind: 'device' });
  });

  it('allows several co-active device keys', async () => {
    const { store } = setup();
    expect((await approve(store, KEY_B, NONCE_1)).outcome).toBe('ok');
    expect((await approve(store, KEY_C, NONCE_2)).outcome).toBe('ok');
    expect((await store.getKeyCustodyStatus(USER)).keys?.filter((k) => k.status === 'active'))
      .toHaveLength(3);
  });

  it('refuses a device pubkey already active elsewhere', async () => {
    const { store } = setup({
      extraProfiles: [{ id: OTHER_PROFILE, userId: OTHER_USER, pubkey: KEY_D }],
    });
    expect(await approve(store, KEY_D)).toEqual({ outcome: 'pubkey-conflict' });
  });

  it('refuses when the bound key is a DEVICE key: only the primary may approve', async () => {
    // A profile whose head is held by a device key, not the primary. This is the
    // shape a device-held session presents, and a device must not be able to
    // enroll further devices (revocation precedence, design H-1).
    const { store, state } = createInMemoryMyNewsStore({
      profiles: [{ id: PROFILE, userId: USER, pubkey: KEY_B }],
      profileKeys: [{ id: 'dev-1', profileId: PROFILE, pubkey: KEY_B, kind: 'device' }],
    });
    // The backfill made KEY_B a primary too, so drop that row: the seeded device
    // row must be the ONLY active row for the bound key.
    const backfilled = state.profileKeys.findIndex((k) => k.kind === 'primary');
    state.profileKeys.splice(backfilled, 1);

    expect((await issue(store, 'device_approval')).outcome).toBe('ok');
    expect(
      await store.approveDeviceKey({
        userId: USER,
        nonce: NONCE_1,
        devicePubkey: KEY_C,
        proof: {},
      }),
    ).toEqual({ outcome: 'not-primary' });
    expect(await store.resolveActiveKey(KEY_C)).toEqual({ verdict: 'unknown' });
  });

  it('fails closed when the profile has no head to bind an approval to', async () => {
    const { store } = createInMemoryMyNewsStore({
      profiles: [{ id: PROFILE, userId: USER, pubkey: '' }],
    });
    expect((await issue(store, 'device_approval')).outcome).toBe('no-active-key');
  });
});

describe('revocation precedence', () => {
  async function seedWithDevices() {
    const { store, state } = setup();
    expect((await issue(store, 'device_approval', NONCE_1)).outcome).toBe('ok');
    const first = await store.approveDeviceKey({
      userId: USER,
      nonce: NONCE_1,
      devicePubkey: KEY_B,
      proof: {},
    });
    expect((await issue(store, 'device_approval', NONCE_2)).outcome).toBe('ok');
    const second = await store.approveDeviceKey({
      userId: USER,
      nonce: NONCE_2,
      devicePubkey: KEY_C,
      proof: {},
    });
    return { store, state, firstDeviceId: first.keyId!, secondDeviceId: second.keyId! };
  }

  it('lets the primary revoke a device key', async () => {
    const { store, state, firstDeviceId } = await seedWithDevices();
    expect((await issue(store, 'revocation', NONCE_3)).outcome).toBe('ok');
    expect(
      await store.revokeProfileKey({ userId: USER, nonce: NONCE_3, targetKeyId: firstDeviceId }),
    ).toEqual({ outcome: 'ok', keyId: firstDeviceId });
    expect(await store.resolveActiveKey(KEY_B)).toMatchObject({ verdict: 'revoked' });
    expect(state.keyEvents.at(-1)?.kind).toBe('revocation');
  });

  it('refuses to revoke the active PRIMARY: that is a rotation', async () => {
    const { store, state } = setup();
    const primaryId = state.profileKeys[0]!.id;
    expect((await issue(store, 'revocation')).outcome).toBe('ok');
    expect(
      await store.revokeProfileKey({ userId: USER, nonce: NONCE_1, targetKeyId: primaryId }),
    ).toEqual({ outcome: 'use-rotation-for-primary' });
    expect(await store.resolveActiveKey(KEY_A)).toMatchObject({ verdict: 'active' });
  });

  it('refuses a key belonging to another profile', async () => {
    const { store, state } = setup({
      extraProfiles: [{ id: OTHER_PROFILE, userId: OTHER_USER, pubkey: KEY_D }],
    });
    const theirs = state.profileKeys.find((k) => k.profileId === OTHER_PROFILE)!;
    expect((await issue(store, 'revocation')).outcome).toBe('ok');
    expect(
      await store.revokeProfileKey({ userId: USER, nonce: NONCE_1, targetKeyId: theirs.id }),
    ).toEqual({ outcome: 'not-your-key' });
    expect(await store.resolveActiveKey(KEY_D)).toMatchObject({ verdict: 'active' });
  });

  it('refuses an unknown key id and an already-revoked one', async () => {
    const { store, firstDeviceId } = await seedWithDevices();
    expect((await issue(store, 'revocation', NONCE_3)).outcome).toBe('ok');
    expect(
      await store.revokeProfileKey({
        userId: USER,
        nonce: NONCE_3,
        targetKeyId: 'no-such-key',
      }),
    ).toEqual({ outcome: 'unknown-key' });

    const n4 = '4'.repeat(64);
    expect((await issue(store, 'revocation', n4)).outcome).toBe('ok');
    expect(
      (await store.revokeProfileKey({ userId: USER, nonce: n4, targetKeyId: firstDeviceId })).outcome,
    ).toBe('ok');
    const n5 = '5'.repeat(64);
    expect((await issue(store, 'revocation', n5)).outcome).toBe('ok');
    expect(
      await store.revokeProfileKey({ userId: USER, nonce: n5, targetKeyId: firstDeviceId }),
    ).toEqual({ outcome: 'already-revoked' });
  });

  it('lets the OLDER device revoke the newer one but not the reverse', async () => {
    const { store, state, firstDeviceId, secondDeviceId } = await seedWithDevices();
    // Rotate the head onto the older device key so the nonce binds to it: this
    // is how a device-held session presents itself.
    const older = state.profileKeys.find((k) => k.id === firstDeviceId)!;
    const newer = state.profileKeys.find((k) => k.id === secondDeviceId)!;
    expect(older.seq).toBeLessThan(newer.seq);

    // Newer device attempting to revoke the older one loses on precedence.
    const profile = [...state.profiles.values()].find((p) => p.id === PROFILE)!;
    profile.pubkey = KEY_C;
    expect((await issue(store, 'revocation', NONCE_3)).outcome).toBe('ok');
    expect(
      await store.revokeProfileKey({ userId: USER, nonce: NONCE_3, targetKeyId: firstDeviceId }),
    ).toEqual({ outcome: 'revoke-precedence' });

    // Older device revoking the newer one succeeds.
    profile.pubkey = KEY_B;
    const n4 = '4'.repeat(64);
    expect((await issue(store, 'revocation', n4)).outcome).toBe('ok');
    expect(
      (await store.revokeProfileKey({ userId: USER, nonce: n4, targetKeyId: secondDeviceId }))
        .outcome,
    ).toBe('ok');
  });

  it('lets a device revoke ITSELF: the lost-device case', async () => {
    const { store, state, firstDeviceId } = await seedWithDevices();
    const profile = [...state.profiles.values()].find((p) => p.id === PROFILE)!;
    profile.pubkey = KEY_B;
    expect((await issue(store, 'revocation', NONCE_3)).outcome).toBe('ok');
    expect(
      (await store.revokeProfileKey({ userId: USER, nonce: NONCE_3, targetKeyId: firstDeviceId }))
        .outcome,
    ).toBe('ok');
  });
});

describe('escrow', () => {
  const envelope = { v: 1, profileId: PROFILE, pubkey: KEY_A, ciphertext: 'x' };

  async function put(
    store: ReturnType<typeof setup>['store'],
    nonce: string,
    override?: Record<string, unknown>,
  ) {
    expect((await issue(store, 'escrow_put', nonce)).outcome).toBe('ok');
    return store.escrowPutKit({
      userId: USER,
      nonce,
      envelope: { ...envelope, ...override },
      pubkey: KEY_A,
    });
  }

  it('appends versions rather than overwriting', async () => {
    const { store } = setup();
    expect(await put(store, NONCE_1)).toEqual({ outcome: 'ok', version: 1 });
    expect(await put(store, NONCE_2, { ciphertext: 'y' })).toEqual({ outcome: 'ok', version: 2 });
    const status = await store.getKeyCustodyStatus(USER);
    expect(status.escrow?.map((e) => e.version)).toEqual([2, 1]);
  });

  it('keeps only the newest 3 versions', async () => {
    const { store } = setup();
    for (let i = 1; i <= 5; i += 1) {
      expect((await put(store, i.toString(16).padStart(64, '0'))).outcome).toBe('ok');
    }
    const status = await store.getKeyCustodyStatus(USER);
    expect(status.escrow?.map((e) => e.version)).toEqual([5, 4, 3]);
  });

  it('records an owner-visible access event for every put', async () => {
    const { store } = setup();
    await put(store, NONCE_1);
    const status = await store.getKeyCustodyStatus(USER);
    expect(status.escrowAccess?.[0]).toMatchObject({ action: 'put', version: 1 });
  });

  it('consumes its nonce, so a put proof cannot be replayed', async () => {
    const { store } = setup();
    await put(store, NONCE_1);
    expect(
      await store.escrowPutKit({ userId: USER, nonce: NONCE_1, envelope, pubkey: KEY_A }),
    ).toEqual({ outcome: 'bad-nonce' });
  });

  it('returns the newest version on get and logs the read', async () => {
    const { store } = setup();
    await put(store, NONCE_1);
    await put(store, NONCE_2, { ciphertext: 'y' });
    const got = await store.escrowGetKit(USER);
    expect(got).toMatchObject({ outcome: 'ok', version: 2, pubkey: KEY_A });
    expect(got.envelope).toMatchObject({ ciphertext: 'y' });
    const status = await store.getKeyCustodyStatus(USER);
    expect(status.escrowAccess?.[0]).toMatchObject({ action: 'get', version: 2 });
  });

  it('rate limits get to 3 per rolling day and logs each denial', async () => {
    let now = 1_700_000_000_000;
    const { store } = setup({ now: () => now });
    await put(store, NONCE_1);
    for (let i = 0; i < 3; i += 1) expect((await store.escrowGetKit(USER)).outcome).toBe('ok');
    expect(await store.escrowGetKit(USER)).toEqual({ outcome: 'rate-limited' });

    const status = await store.getKeyCustodyStatus(USER);
    expect(status.escrowAccess?.[0]).toMatchObject({
      action: 'get-denied',
      detail: 'daily escrow read limit reached',
    });

    // The window rolls.
    now += DAY + 1;
    expect((await store.escrowGetKit(USER)).outcome).toBe('ok');
  });

  it('reports no-kit honestly and still logs the attempt', async () => {
    const { store } = setup();
    expect(await store.escrowGetKit(USER)).toEqual({ outcome: 'no-kit' });
    const status = await store.getKeyCustodyStatus(USER);
    expect(status.escrowAccess?.[0]).toMatchObject({ action: 'get-denied', detail: 'no escrowed kit' });
  });

  it('rejects a malformed envelope or pubkey without spending the nonce path', async () => {
    const { store } = setup();
    expect(
      await store.escrowPutKit({ userId: USER, nonce: NONCE_1, envelope, pubkey: 'nope' }),
    ).toEqual({ outcome: 'bad-payload' });
  });

  it('publishes a bind within 24h of a read as backup_restore, not a plain rotation', async () => {
    let now = 1_700_000_000_000;
    const { store, state } = setup({ now: () => now });
    await put(store, NONCE_1);
    expect((await store.escrowGetKit(USER)).outcome).toBe('ok');

    now += 2 * HOUR;
    const result = await rotate(store, KEY_B, NONCE_2);
    expect(result.outcome).toBe('ok');
    expect(result.backupRestore).toBe(true);
    expect(state.keyEvents.at(-1)?.kind).toBe('backup_restore');
  });

  it('publishes a plain rotation once the 24h transparency window has passed', async () => {
    let now = 1_700_000_000_000;
    const { store, state } = setup({ now: () => now });
    await put(store, NONCE_1);
    expect((await store.escrowGetKit(USER)).outcome).toBe('ok');

    now += DAY + HOUR;
    const result = await rotate(store, KEY_B, NONCE_2);
    expect(result.backupRestore).toBe(false);
    expect(state.keyEvents.at(-1)?.kind).toBe('rotation');
  });
});

describe('no-kit recovery', () => {
  const CONFIRMED = [{ profileId: PROFILE, confirmedAt: '2026-07-01T00:00:00.000Z' }];

  it('is HARD-DISABLED when no notification channel is confirmed', async () => {
    const { store, state } = setup();
    expect(
      await store.requestKeyRecovery({
        userId: USER,
        newPubkey: KEY_B,
        cancelTokenHash: TOKEN_HASH,
      }),
    ).toEqual({ outcome: 'notification-channel-required' });
    // Nothing was recorded: no request row, no public event, no partial state.
    expect(state.recoveryRequests).toHaveLength(0);
    expect(state.keyEvents).toHaveLength(0);
  });

  it('is also disabled when a channel exists but is UNCONFIRMED', async () => {
    const { store } = setup({ notifyChannels: [{ profileId: PROFILE, confirmedAt: null }] });
    expect(
      (
        await store.requestKeyRecovery({
          userId: USER,
          newPubkey: KEY_B,
          cancelTokenHash: TOKEN_HASH,
        })
      ).outcome,
    ).toBe('notification-channel-required');
  });

  it('reports the gate state so the UI can say the path is unavailable', async () => {
    const { store } = setup();
    expect((await store.getKeyCustodyStatus(USER)).notificationChannelConfirmed).toBe(false);
    const { store: gated } = setup({ notifyChannels: CONFIRMED });
    expect((await gated.getKeyCustodyStatus(USER)).notificationChannelConfirmed).toBe(true);
  });

  it('scales the lock to 72h for an open byline', async () => {
    const now = 1_700_000_000_000;
    const { store } = setup({ now: () => now, notifyChannels: CONFIRMED });
    const result = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    expect(result.outcome).toBe('ok');
    expect(result.standing).toBe('open');
    expect(Date.parse(result.unlocksAt!) - now).toBe(72 * HOUR);
  });

  it('scales the lock to 7 days for a VERIFIED journalist', async () => {
    const now = 1_700_000_000_000;
    const { store } = setup({
      now: () => now,
      notifyChannels: CONFIRMED,
      journalists: [{ profileId: PROFILE, tier: 'verified' }],
    });
    const result = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    expect(result.standing).toBe('verified');
    expect(Date.parse(result.unlocksAt!) - now).toBe(168 * HOUR);
  });

  it('allows only one pending request per profile', async () => {
    const { store } = setup({ notifyChannels: CONFIRMED });
    expect(
      (
        await store.requestKeyRecovery({
          userId: USER,
          newPubkey: KEY_B,
          cancelTokenHash: TOKEN_HASH,
        })
      ).outcome,
    ).toBe('ok');
    expect(
      await store.requestKeyRecovery({
        userId: USER,
        newPubkey: KEY_C,
        cancelTokenHash: TOKEN_HASH,
      }),
    ).toEqual({ outcome: 'already-pending' });
  });

  it('refuses to pre-commit a key that is already live somewhere', async () => {
    const { store } = setup({
      notifyChannels: CONFIRMED,
      extraProfiles: [{ id: OTHER_PROFILE, userId: OTHER_USER, pubkey: KEY_D }],
    });
    expect(
      await store.requestKeyRecovery({
        userId: USER,
        newPubkey: KEY_D,
        cancelTokenHash: TOKEN_HASH,
      }),
    ).toEqual({ outcome: 'pubkey-conflict' });
  });

  it('cancels with the keyless token and rejects a wrong one', async () => {
    const { store, state } = setup({ notifyChannels: CONFIRMED });
    const requested = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    expect(
      await store.cancelKeyRecovery({
        requestId: requested.requestId!,
        cancelTokenHash: OTHER_TOKEN_HASH,
      }),
    ).toEqual({ outcome: 'bad-cancel-token' });
    expect(
      await store.cancelKeyRecovery({
        requestId: requested.requestId!,
        cancelTokenHash: TOKEN_HASH,
      }),
    ).toEqual({ outcome: 'ok', status: 'cancelled' });
    expect(state.keyEvents.map((e) => e.kind)).toEqual([
      'recovery_requested',
      'recovery_cancelled',
    ]);
  });

  it('cancels with a proof from a still-active key', async () => {
    const { store } = setup({ notifyChannels: CONFIRMED });
    const requested = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    expect((await issue(store, 'revocation', NONCE_1)).outcome).toBe('ok');
    expect(
      await store.cancelKeyRecovery({
        requestId: requested.requestId!,
        userId: USER,
        nonce: NONCE_1,
      }),
    ).toEqual({ outcome: 'ok', status: 'cancelled' });
  });

  it('rejects a cancel with neither a token nor a proof', async () => {
    const { store } = setup({ notifyChannels: CONFIRMED });
    const requested = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    expect(await store.cancelKeyRecovery({ requestId: requested.requestId! })).toEqual({
      outcome: 'bad-payload',
    });
  });

  it('FREEZES the no-kit path after 2 cancels in 90 days', async () => {
    let now = 1_700_000_000_000;
    const { store, state } = setup({ now: () => now, notifyChannels: CONFIRMED });

    const first = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    expect(
      (await store.cancelKeyRecovery({ requestId: first.requestId!, cancelTokenHash: TOKEN_HASH }))
        .status,
    ).toBe('cancelled');

    now += DAY;
    const second = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_C,
      cancelTokenHash: TOKEN_HASH,
    });
    // The SECOND cancel lands as frozen, not cancelled.
    expect(
      await store.cancelKeyRecovery({ requestId: second.requestId!, cancelTokenHash: TOKEN_HASH }),
    ).toEqual({ outcome: 'ok', status: 'frozen' });
    expect(state.keyEvents.map((e) => e.kind)).toContain('recovery_frozen');

    // And the path is shut for the window.
    now += DAY;
    expect(
      await store.requestKeyRecovery({
        userId: USER,
        newPubkey: KEY_D,
        cancelTokenHash: TOKEN_HASH,
      }),
    ).toEqual({ outcome: 'recovery-frozen' });
    expect((await store.getKeyCustodyStatus(USER)).recoveryFrozen).toBe(true);
  });

  it('reopens the no-kit path once the 90-day freeze window has passed', async () => {
    let now = 1_700_000_000_000;
    const { store } = setup({ now: () => now, notifyChannels: CONFIRMED });
    const first = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    await store.cancelKeyRecovery({ requestId: first.requestId!, cancelTokenHash: TOKEN_HASH });
    now += DAY;
    const second = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_C,
      cancelTokenHash: TOKEN_HASH,
    });
    await store.cancelKeyRecovery({ requestId: second.requestId!, cancelTokenHash: TOKEN_HASH });

    now += 91 * DAY;
    expect(
      (
        await store.requestKeyRecovery({
          userId: USER,
          newPubkey: KEY_D,
          cancelTokenHash: TOKEN_HASH,
        })
      ).outcome,
    ).toBe('ok');
  });

  it('refuses to complete before the lock elapses', async () => {
    let now = 1_700_000_000_000;
    const { store } = setup({ now: () => now, notifyChannels: CONFIRMED });
    const requested = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    expect((await issue(store, 'recovery_complete', NONCE_1)).outcome).toBe('ok');
    expect(
      await store.completeKeyRecovery({
        userId: USER,
        nonce: NONCE_1,
        requestId: requested.requestId!,
        newPubkey: KEY_B,
        proof: {},
      }),
    ).toEqual({ outcome: 'still-locked' });
  });

  it('refuses to complete with a key that was NOT pre-committed', async () => {
    let now = 1_700_000_000_000;
    const { store } = setup({ now: () => now, notifyChannels: CONFIRMED });
    const requested = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    now += 73 * HOUR;
    expect((await issue(store, 'recovery_complete', NONCE_1)).outcome).toBe('ok');
    expect(
      await store.completeKeyRecovery({
        userId: USER,
        nonce: NONCE_1,
        requestId: requested.requestId!,
        newPubkey: KEY_C,
        proof: {},
      }),
    ).toEqual({ outcome: 'pubkey-not-precommitted' });
  });

  it('completes after the lock, revoking EVERY prior key including devices', async () => {
    let now = 1_700_000_000_000;
    const { store, state } = setup({ now: () => now, notifyChannels: CONFIRMED });
    // Approve a device first so the recovery has more than the primary to revoke.
    expect((await issue(store, 'device_approval', NONCE_2)).outcome).toBe('ok');
    expect(
      (
        await store.approveDeviceKey({
          userId: USER,
          nonce: NONCE_2,
          devicePubkey: KEY_C,
          proof: {},
        })
      ).outcome,
    ).toBe('ok');

    const requested = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    now += 73 * HOUR;
    expect((await issue(store, 'recovery_complete', NONCE_1)).outcome).toBe('ok');
    const result = await store.completeKeyRecovery({
      userId: USER,
      nonce: NONCE_1,
      requestId: requested.requestId!,
      newPubkey: KEY_B,
      proof: {},
    });
    expect(result.outcome).toBe('ok');

    expect(await store.resolveActiveKey(KEY_A)).toMatchObject({ verdict: 'revoked' });
    expect(await store.resolveActiveKey(KEY_C)).toMatchObject({ verdict: 'revoked' });
    expect(await store.resolveActiveKey(KEY_B)).toMatchObject({ verdict: 'active' });

    const status = await store.getKeyCustodyStatus(USER);
    expect(status.headPubkey).toBe(KEY_B);
    expect(status.recovery).toMatchObject({ status: 'completed', newPubkey: KEY_B });
    expect(state.keyEvents.map((e) => e.kind)).toContain('recovery_completed');
  });

  it('refuses to complete a cancelled request', async () => {
    let now = 1_700_000_000_000;
    const { store } = setup({ now: () => now, notifyChannels: CONFIRMED });
    const requested = await store.requestKeyRecovery({
      userId: USER,
      newPubkey: KEY_B,
      cancelTokenHash: TOKEN_HASH,
    });
    await store.cancelKeyRecovery({ requestId: requested.requestId!, cancelTokenHash: TOKEN_HASH });
    now += 73 * HOUR;
    expect((await issue(store, 'recovery_complete', NONCE_1)).outcome).toBe('ok');
    expect(
      await store.completeKeyRecovery({
        userId: USER,
        nonce: NONCE_1,
        requestId: requested.requestId!,
        newPubkey: KEY_B,
        proof: {},
      }),
    ).toEqual({ outcome: 'not-pending' });
  });

  it('refuses to complete another profile request id', async () => {
    let now = 1_700_000_000_000;
    const { store } = setup({ now: () => now, notifyChannels: CONFIRMED });
    now += 73 * HOUR;
    expect((await issue(store, 'recovery_complete', NONCE_1)).outcome).toBe('ok');
    expect(
      await store.completeKeyRecovery({
        userId: USER,
        nonce: NONCE_1,
        requestId: 'mem-recovery-999',
        newPubkey: KEY_B,
        proof: {},
      }),
    ).toEqual({ outcome: 'unknown-request' });
  });

  it('reports an unknown request id on cancel', async () => {
    const { store } = setup({ notifyChannels: CONFIRMED });
    expect(
      await store.cancelKeyRecovery({ requestId: 'nope', cancelTokenHash: TOKEN_HASH }),
    ).toEqual({ outcome: 'unknown-request' });
  });
});

describe('custody status read', () => {
  it('refuses a caller with no profile', async () => {
    const { store } = setup();
    expect(await store.getKeyCustodyStatus(OTHER_USER)).toEqual({ outcome: 'no-profile' });
  });

  it('reports the chain newest first', async () => {
    const { store } = setup();
    await rotate(store, KEY_B);
    const status = await store.getKeyCustodyStatus(USER);
    expect(status.keys?.map((k) => k.pubkey)).toEqual([KEY_B, KEY_A]);
  });
});
