// Key custody edge actions (plan 48 WP6). These prove what the HANDLER
// enforces, on top of what the store twin already proves: proof verification
// against a SERVER-DERIVED binding, step-up re-auth, the fail-closed no-kit
// recovery gate, and honest copy on every refusal.

import { extractSigningPrivateKeyHex, generateDeviceIdentity } from '@mylife/sync';
import { describe, expect, it, vi } from 'vitest';
import { signKeyCustody, signKeyPossession } from '../../../../modules/mynews/src/signing/sign';
import { canonicalKeyCustodyBytes as moduleCustodyBytes } from '../../../../modules/mynews/src/signing/canonical';
import { handleRegisterKeyRequest, type RegisterKeyDeps } from '../index.ts';
import { canonicalKeyCustodyBytes } from '../../_shared/mynews-signing.ts';
import { createInMemoryMyNewsStore } from '../../_shared/mynews-store.ts';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

function identity() {
  const device = generateDeviceIdentity('MyNews Author');
  return {
    pubkey: device.publicKey,
    privateKeyHex: extractSigningPrivateKeyHex(device.privateKeyRef),
  };
}

const PRIMARY = identity();
const NEXT = identity();
const DEVICE = identity();

/**
 * JWT with an explicit `iat`. `freshSeconds` controls how old the token looks,
 * which is what the step-up gate reads.
 */
function jwtFor(sub: string, iat: number | null): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(iat === null ? { sub } : { sub, iat })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

function post(
  body: unknown,
  options?: { sub?: string | null; iat?: number | null },
): Request {
  const sub = options && 'sub' in options ? options.sub : USER_ID;
  const iat = options && 'iat' in options ? options.iat : Math.floor(NOW / 1000);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub, iat ?? null)}`;
  return new Request('http://local/mynews-register-key', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function fixedRandom(fill: number) {
  return (byteCount: number) => new Uint8Array(byteCount).fill(fill);
}

function deps(
  overrides?: Partial<RegisterKeyDeps> & {
    storeOptions?: Parameters<typeof createInMemoryMyNewsStore>[0];
    now?: () => number;
  },
) {
  const now = overrides?.now ?? (() => NOW);
  const built = createInMemoryMyNewsStore({
    now,
    profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey, handle: 'reporter' }],
    ...overrides?.storeOptions,
  });
  return {
    store: built.store,
    state: built.state,
    deps: {
      store: built.store,
      now,
      randomBytes: overrides?.randomBytes ?? fixedRandom(0xab),
      sha256Hex: overrides?.sha256Hex,
      ...(overrides?.verify ? { verify: overrides.verify } : {}),
    } satisfies RegisterKeyDeps,
  };
}

async function json(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

/** Mint a nonce through the handler, returning the binding it echoed back. */
async function issueNonce(
  d: RegisterKeyDeps,
  purpose: string,
  fill = 0xab,
): Promise<{ nonce: string; profileId: string; oldPubkey: string }> {
  const res = await handleRegisterKeyRequest(post({ action: 'issue-nonce', purpose }), {
    ...d,
    randomBytes: fixedRandom(fill),
  });
  expect(res.status).toBe(200);
  const body = (await json(res)).data as Record<string, string>;
  return { nonce: body.nonce!, profileId: body.profileId!, oldPubkey: body.oldPubkey! };
}

function proof(
  purpose: Parameters<typeof signKeyCustody>[0]['purpose'],
  binding: { profileId: string; oldPubkey: string; nonce: string },
  subject: string,
  privateKeyHex: string,
  overrides?: { userId?: string; profileId?: string; oldPubkey?: string; nonce?: string },
): string {
  return signKeyCustody(
    {
      purpose,
      userId: overrides?.userId ?? USER_ID,
      profileId: overrides?.profileId ?? binding.profileId,
      oldPubkey: overrides?.oldPubkey ?? binding.oldPubkey,
      subject,
      nonce: overrides?.nonce ?? binding.nonce,
    },
    privateKeyHex,
  );
}

describe('custody canonical twin parity', () => {
  it('the edge builder is byte-identical to the module builder', () => {
    const signable = {
      purpose: 'rotation' as const,
      userId: USER_ID,
      profileId: PROFILE_ID,
      oldPubkey: PRIMARY.pubkey,
      subject: NEXT.pubkey,
      nonce: 'ab'.repeat(32),
    };
    expect(Array.from(canonicalKeyCustodyBytes(signable))).toEqual(
      Array.from(moduleCustodyBytes(signable)),
    );
  });

  it('binds the purpose, so a proof cannot be repurposed', () => {
    const base = {
      userId: USER_ID,
      profileId: PROFILE_ID,
      oldPubkey: PRIMARY.pubkey,
      subject: NEXT.pubkey,
      nonce: 'ab'.repeat(32),
    };
    expect(Array.from(canonicalKeyCustodyBytes({ ...base, purpose: 'rotation' }))).not.toEqual(
      Array.from(canonicalKeyCustodyBytes({ ...base, purpose: 'revocation' })),
    );
  });
});

describe('initial bind stays unchanged', () => {
  it('a body with no action still takes the P1 possession path', async () => {
    const { deps: d, state } = deps({
      storeOptions: { profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: '' }] },
    });
    const res = await handleRegisterKeyRequest(
      post({
        pubkey: NEXT.pubkey,
        signatureHex: signKeyPossession(
          { userId: USER_ID, pubkey: NEXT.pubkey },
          NEXT.privateKeyHex,
        ),
      }),
      d,
    );
    expect(res.status).toBe(200);
    expect(state.profiles.get(PROFILE_ID)?.pubkey).toBe(NEXT.pubkey);
  });

  it('writes the initial chain row, so the new key resolves as active', async () => {
    // Without this the resolver would reject every freshly registered key and
    // the profile could never publish.
    const { deps: d, store } = deps({
      storeOptions: { profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: '' }] },
    });
    await handleRegisterKeyRequest(
      post({
        pubkey: NEXT.pubkey,
        signatureHex: signKeyPossession(
          { userId: USER_ID, pubkey: NEXT.pubkey },
          NEXT.privateKeyHex,
        ),
      }),
      d,
    );
    expect(await store.resolveActiveKey(NEXT.pubkey)).toMatchObject({
      verdict: 'active',
      profileId: PROFILE_ID,
      kind: 'primary',
    });
  });

  it('rejects an unknown action rather than falling through to the bind path', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(post({ action: 'take-over' }), d);
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe('bad-payload');
  });
});

describe('issue-nonce', () => {
  it('echoes the server-derived binding the client must sign over', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(
      post({ action: 'issue-nonce', purpose: 'rotation' }),
      d,
    );
    expect(res.status).toBe(200);
    const data = (await json(res)).data as Record<string, unknown>;
    expect(data).toMatchObject({
      profileId: PROFILE_ID,
      oldPubkey: PRIMARY.pubkey,
      purpose: 'rotation',
    });
    expect(data.nonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects an unknown purpose', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(
      post({ action: 'issue-nonce', purpose: 'take-over' }),
      d,
    );
    expect(res.status).toBe(400);
  });

  it('draws the nonce from the CSPRNG seam at the required width', async () => {
    const spy = vi.fn(fixedRandom(1));
    const { deps: d } = deps();
    await handleRegisterKeyRequest(post({ action: 'issue-nonce', purpose: 'rotation' }), {
      ...d,
      randomBytes: spy,
    });
    expect(spy).toHaveBeenCalledWith(32);
  });

  it('refuses a session with no profile', async () => {
    const { deps: d } = deps({ storeOptions: { profiles: [] } });
    const res = await handleRegisterKeyRequest(
      post({ action: 'issue-nonce', purpose: 'rotation' }),
      d,
    );
    expect(res.status).toBe(409);
    expect((await json(res)).error).toBe('no-profile');
  });

  it('refuses without a session at all', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(
      post({ action: 'issue-nonce', purpose: 'rotation' }, { sub: null }),
      d,
    );
    expect(res.status).toBe(401);
  });
});

describe('rotate', () => {
  async function rotateWith(
    d: RegisterKeyDeps,
    options?: {
      authOverrides?: Parameters<typeof proof>[4];
      possessionKey?: string;
      subject?: string;
    },
  ) {
    const binding = await issueNonce(d, 'rotation');
    const subject = options?.subject ?? NEXT.pubkey;
    return handleRegisterKeyRequest(
      post({
        action: 'rotate',
        nonce: binding.nonce,
        newPubkey: subject,
        authorizationSignatureHex: proof(
          'rotation',
          binding,
          subject,
          PRIMARY.privateKeyHex,
          options?.authOverrides,
        ),
        possessionSignatureHex: proof(
          'possession',
          binding,
          subject,
          options?.possessionKey ?? NEXT.privateKeyHex,
        ),
      }),
      d,
    );
  }

  it('rotates with both proofs and reports the new chain row', async () => {
    const { deps: d, store } = deps();
    const res = await rotateWith(d);
    expect(res.status).toBe(200);
    const data = (await json(res)).data as Record<string, unknown>;
    expect(data).toMatchObject({ pubkey: NEXT.pubkey, backupRestore: false });
    expect(data.keyId).toBeTruthy();
    expect(await store.resolveActiveKey(NEXT.pubkey)).toMatchObject({ verdict: 'active' });
    expect(await store.resolveActiveKey(PRIMARY.pubkey)).toMatchObject({ verdict: 'revoked' });
  });

  it('refuses when the OLD key did not authorize', async () => {
    const { deps: d, store } = deps();
    const binding = await issueNonce(d, 'rotation');
    const res = await handleRegisterKeyRequest(
      post({
        action: 'rotate',
        nonce: binding.nonce,
        newPubkey: NEXT.pubkey,
        // Signed by the NEW key, which is not allowed to authorize its own bind.
        authorizationSignatureHex: proof('rotation', binding, NEXT.pubkey, NEXT.privateKeyHex),
        possessionSignatureHex: proof('possession', binding, NEXT.pubkey, NEXT.privateKeyHex),
      }),
      d,
    );
    expect(res.status).toBe(403);
    expect(await json(res)).toMatchObject({
      error: 'bad-signature',
      detail: 'the old key did not authorize this',
    });
    expect(await store.resolveActiveKey(PRIMARY.pubkey)).toMatchObject({ verdict: 'active' });
  });

  it('refuses when the NEW key did not prove possession', async () => {
    const { deps: d, store } = deps();
    const res = await rotateWith(d, { possessionKey: DEVICE.privateKeyHex });
    expect(res.status).toBe(403);
    expect(await json(res)).toMatchObject({
      error: 'bad-signature',
      detail: 'the new key did not prove possession',
    });
    expect(await store.resolveActiveKey(NEXT.pubkey)).toEqual({ verdict: 'unknown' });
  });

  it('refuses a proof signed over a FORGED profile id', async () => {
    // The binding comes from server state, so a proof over a profile of the
    // client's choosing cannot verify. Without server-side re-derivation this
    // would authorize a real rotation from bytes the client made up.
    const { deps: d, store } = deps();
    const res = await rotateWith(d, {
      authOverrides: { profileId: '99999999-9999-4999-8999-999999999999' },
    });
    expect(res.status).toBe(403);
    expect(await store.resolveActiveKey(PRIMARY.pubkey)).toMatchObject({ verdict: 'active' });
  });

  it('refuses a proof signed over a FORGED old pubkey', async () => {
    const { deps: d } = deps();
    const res = await rotateWith(d, { authOverrides: { oldPubkey: DEVICE.pubkey } });
    expect(res.status).toBe(403);
  });

  it('refuses a proof signed over a FORGED uid', async () => {
    const { deps: d } = deps();
    const res = await rotateWith(d, {
      authOverrides: { userId: '00000000-0000-4000-8000-0000000000ff' },
    });
    expect(res.status).toBe(403);
  });

  it('refuses a proof signed over a DIFFERENT nonce', async () => {
    const { deps: d } = deps();
    const res = await rotateWith(d, { authOverrides: { nonce: 'cd'.repeat(32) } });
    expect(res.status).toBe(403);
  });

  it('rejects a replayed nonce after a successful rotation', async () => {
    const { deps: d } = deps();
    const binding = await issueNonce(d, 'rotation');
    const body = {
      action: 'rotate',
      nonce: binding.nonce,
      newPubkey: NEXT.pubkey,
      authorizationSignatureHex: proof('rotation', binding, NEXT.pubkey, PRIMARY.privateKeyHex),
      possessionSignatureHex: proof('possession', binding, NEXT.pubkey, NEXT.privateKeyHex),
    };
    expect((await handleRegisterKeyRequest(post(body), d)).status).toBe(200);
    const replay = await handleRegisterKeyRequest(post(body), d);
    // The head moved, so re-deriving the binding no longer matches the signed
    // bytes; the proof fails before the nonce is even looked up.
    expect(replay.status).toBe(403);
  });

  it('does NOT require step-up re-auth (the old key already proved itself)', async () => {
    const { deps: d } = deps();
    const binding = await issueNonce(d, 'rotation');
    const res = await handleRegisterKeyRequest(
      new Request('http://local/mynews-register-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // A stale token: rotation is authorized by a key, not by session age.
          Authorization: `Bearer ${jwtFor(USER_ID, Math.floor((NOW - 5 * HOUR) / 1000))}`,
        },
        body: JSON.stringify({
          action: 'rotate',
          nonce: binding.nonce,
          newPubkey: NEXT.pubkey,
          authorizationSignatureHex: proof('rotation', binding, NEXT.pubkey, PRIMARY.privateKeyHex),
          possessionSignatureHex: proof('possession', binding, NEXT.pubkey, NEXT.privateKeyHex),
        }),
      }),
      d,
    );
    expect(res.status).toBe(200);
  });

  it('rejects a malformed payload before any store work', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(
      post({ action: 'rotate', nonce: 'short', newPubkey: NEXT.pubkey }),
      d,
    );
    expect(res.status).toBe(400);
  });
});

describe('approve-device', () => {
  it('adds a co-active device key with both proofs', async () => {
    const { deps: d, store } = deps();
    const binding = await issueNonce(d, 'device_approval');
    const res = await handleRegisterKeyRequest(
      post({
        action: 'approve-device',
        nonce: binding.nonce,
        devicePubkey: DEVICE.pubkey,
        authorizationSignatureHex: proof(
          'device-approval',
          binding,
          DEVICE.pubkey,
          PRIMARY.privateKeyHex,
        ),
        possessionSignatureHex: proof(
          'device-possession',
          binding,
          DEVICE.pubkey,
          DEVICE.privateKeyHex,
        ),
      }),
      d,
    );
    expect(res.status).toBe(200);
    expect(await store.resolveActiveKey(PRIMARY.pubkey)).toMatchObject({ verdict: 'active' });
    expect(await store.resolveActiveKey(DEVICE.pubkey)).toMatchObject({
      verdict: 'active',
      kind: 'device',
    });
  });

  it('refuses a device-approval proof reused as a rotation proof', async () => {
    // Purpose is inside the signed bytes, so an approval signature cannot be
    // spent on a rotation even with a matching nonce.
    const { deps: d, store } = deps();
    const binding = await issueNonce(d, 'rotation');
    const res = await handleRegisterKeyRequest(
      post({
        action: 'rotate',
        nonce: binding.nonce,
        newPubkey: DEVICE.pubkey,
        authorizationSignatureHex: proof(
          'device-approval',
          binding,
          DEVICE.pubkey,
          PRIMARY.privateKeyHex,
        ),
        possessionSignatureHex: proof('possession', binding, DEVICE.pubkey, DEVICE.privateKeyHex),
      }),
      d,
    );
    expect(res.status).toBe(403);
    expect(await store.resolveActiveKey(PRIMARY.pubkey)).toMatchObject({ verdict: 'active' });
  });

  it('refuses when the device key does not prove possession', async () => {
    const { deps: d } = deps();
    const binding = await issueNonce(d, 'device_approval');
    const res = await handleRegisterKeyRequest(
      post({
        action: 'approve-device',
        nonce: binding.nonce,
        devicePubkey: DEVICE.pubkey,
        authorizationSignatureHex: proof(
          'device-approval',
          binding,
          DEVICE.pubkey,
          PRIMARY.privateKeyHex,
        ),
        possessionSignatureHex: proof(
          'device-possession',
          binding,
          DEVICE.pubkey,
          NEXT.privateKeyHex,
        ),
      }),
      d,
    );
    expect(res.status).toBe(403);
  });
});

describe('revoke', () => {
  async function withDevice() {
    const built = deps();
    const binding = await issueNonce(built.deps, 'device_approval');
    const res = await handleRegisterKeyRequest(
      post({
        action: 'approve-device',
        nonce: binding.nonce,
        devicePubkey: DEVICE.pubkey,
        authorizationSignatureHex: proof(
          'device-approval',
          binding,
          DEVICE.pubkey,
          PRIMARY.privateKeyHex,
        ),
        possessionSignatureHex: proof(
          'device-possession',
          binding,
          DEVICE.pubkey,
          DEVICE.privateKeyHex,
        ),
      }),
      built.deps,
    );
    const deviceKeyId = ((await json(res)).data as Record<string, string>).keyId!;
    return { ...built, deviceKeyId };
  }

  it('revokes a device key with a fresh session and an active-key proof', async () => {
    const { deps: d, store, deviceKeyId } = await withDevice();
    const binding = await issueNonce(d, 'revocation', 0xcd);
    const res = await handleRegisterKeyRequest(
      post({
        action: 'revoke',
        nonce: binding.nonce,
        targetKeyId: deviceKeyId,
        authorizationSignatureHex: proof(
          'revocation',
          binding,
          deviceKeyId,
          PRIMARY.privateKeyHex,
        ),
      }),
      d,
    );
    expect(res.status).toBe(200);
    expect(await store.resolveActiveKey(DEVICE.pubkey)).toMatchObject({ verdict: 'revoked' });
  });

  it('REQUIRES step-up re-auth: a stale session cannot revoke', async () => {
    const { deps: d, store, deviceKeyId } = await withDevice();
    const binding = await issueNonce(d, 'revocation', 0xcd);
    const res = await handleRegisterKeyRequest(
      new Request('http://local/mynews-register-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtFor(USER_ID, Math.floor((NOW - 5 * HOUR) / 1000))}`,
        },
        body: JSON.stringify({
          action: 'revoke',
          nonce: binding.nonce,
          targetKeyId: deviceKeyId,
          authorizationSignatureHex: proof(
            'revocation',
            binding,
            deviceKeyId,
            PRIMARY.privateKeyHex,
          ),
        }),
      }),
      d,
    );
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('reauth-required');
    expect(await store.resolveActiveKey(DEVICE.pubkey)).toMatchObject({ verdict: 'active' });
  });

  it('fails closed on a token with NO iat: an unageable token is not fresh', async () => {
    const { deps: d, deviceKeyId } = await withDevice();
    const binding = await issueNonce(d, 'revocation', 0xcd);
    const res = await handleRegisterKeyRequest(
      post(
        {
          action: 'revoke',
          nonce: binding.nonce,
          targetKeyId: deviceKeyId,
          authorizationSignatureHex: proof(
            'revocation',
            binding,
            deviceKeyId,
            PRIMARY.privateKeyHex,
          ),
        },
        { iat: null },
      ),
      d,
    );
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('reauth-required');
  });

  it('rejects a token minted far in the FUTURE', async () => {
    const { deps: d, deviceKeyId } = await withDevice();
    const binding = await issueNonce(d, 'revocation', 0xcd);
    const res = await handleRegisterKeyRequest(
      post(
        {
          action: 'revoke',
          nonce: binding.nonce,
          targetKeyId: deviceKeyId,
          authorizationSignatureHex: proof(
            'revocation',
            binding,
            deviceKeyId,
            PRIMARY.privateKeyHex,
          ),
        },
        { iat: Math.floor((NOW + HOUR) / 1000) },
      ),
      d,
    );
    expect(res.status).toBe(401);
  });

  it('refuses a revoke proof bound to a DIFFERENT target key', async () => {
    const { deps: d, store, deviceKeyId } = await withDevice();
    const binding = await issueNonce(d, 'revocation', 0xcd);
    const res = await handleRegisterKeyRequest(
      post({
        action: 'revoke',
        nonce: binding.nonce,
        targetKeyId: deviceKeyId,
        // Signed for another key id, so it must not authorize this one.
        authorizationSignatureHex: proof(
          'revocation',
          binding,
          '77777777-7777-4777-8777-777777777777',
          PRIMARY.privateKeyHex,
        ),
      }),
      d,
    );
    expect(res.status).toBe(403);
    expect(await store.resolveActiveKey(DEVICE.pubkey)).toMatchObject({ verdict: 'active' });
  });

  it('rejects a non-uuid target key id', async () => {
    const { deps: d } = await withDevice();
    const res = await handleRegisterKeyRequest(
      post({
        action: 'revoke',
        nonce: 'ab'.repeat(32),
        targetKeyId: 'mem-key-1',
        authorizationSignatureHex: 'ab',
      }),
      d,
    );
    expect(res.status).toBe(400);
  });
});

describe('escrow', () => {
  const envelope = (pubkey: string) => ({
    v: 1,
    profileId: PROFILE_ID,
    pubkey,
    salt16: 'AAAA',
    nonce: 'BBBB',
    ciphertext: 'CCCC',
    createdAt: '2026-07-30T00:00:00.000Z',
  });

  async function put(d: RegisterKeyDeps, fill = 0xab, override?: Record<string, unknown>) {
    const binding = await issueNonce(d, 'escrow_put', fill);
    return handleRegisterKeyRequest(
      post({
        action: 'escrow-put',
        nonce: binding.nonce,
        pubkey: PRIMARY.pubkey,
        envelope: { ...envelope(PRIMARY.pubkey), ...override },
        authorizationSignatureHex: proof(
          'escrow-put',
          binding,
          PRIMARY.pubkey,
          PRIMARY.privateKeyHex,
        ),
      }),
      d,
    );
  }

  it('stores a kit and returns its version', async () => {
    const { deps: d } = deps();
    const res = await put(d);
    expect(res.status).toBe(200);
    expect((await json(res)).data).toMatchObject({ version: 1 });
  });

  it('REQUIRES step-up re-auth for a put', async () => {
    const { deps: d, state } = deps();
    const binding = await issueNonce(d, 'escrow_put');
    const res = await handleRegisterKeyRequest(
      new Request('http://local/mynews-register-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwtFor(USER_ID, Math.floor((NOW - 5 * HOUR) / 1000))}`,
        },
        body: JSON.stringify({
          action: 'escrow-put',
          nonce: binding.nonce,
          pubkey: PRIMARY.pubkey,
          envelope: envelope(PRIMARY.pubkey),
          authorizationSignatureHex: proof(
            'escrow-put',
            binding,
            PRIMARY.pubkey,
            PRIMARY.privateKeyHex,
          ),
        }),
      }),
      d,
    );
    expect(res.status).toBe(401);
    expect(state.keyEscrow).toHaveLength(0);
  });

  it('rejects an envelope whose pubkey disagrees with the declared key', async () => {
    const { deps: d } = deps();
    const res = await put(d, 0xab, { pubkey: NEXT.pubkey });
    expect(res.status).toBe(400);
    expect((await json(res)).detail).toBe('envelope key does not match the declared key');
  });

  it('rejects an unsupported envelope version', async () => {
    const { deps: d } = deps();
    const res = await put(d, 0xab, { v: 2 });
    expect(res.status).toBe(400);
    expect((await json(res)).detail).toBe('unsupported recovery kit version');
  });

  it('reads back the newest kit', async () => {
    const { deps: d } = deps();
    expect((await put(d, 0xab)).status).toBe(200);
    const res = await handleRegisterKeyRequest(post({ action: 'escrow-get' }), d);
    expect(res.status).toBe(200);
    const data = (await json(res)).data as Record<string, unknown>;
    expect(data).toMatchObject({ version: 1, pubkey: PRIMARY.pubkey });
    expect(data.envelope).toMatchObject({ v: 1 });
  });

  it('does NOT require step-up for a read, but rate limits it to 3 a day', async () => {
    const { deps: d } = deps();
    expect((await put(d, 0xab)).status).toBe(200);
    for (let i = 0; i < 3; i += 1) {
      expect((await handleRegisterKeyRequest(post({ action: 'escrow-get' }), d)).status).toBe(200);
    }
    const res = await handleRegisterKeyRequest(post({ action: 'escrow-get' }), d);
    expect(res.status).toBe(429);
    expect((await json(res)).error).toBe('rate-limited');
  });

  it('says so honestly when there is no kit', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(post({ action: 'escrow-get' }), d);
    expect(res.status).toBe(404);
    expect(await json(res)).toMatchObject({
      error: 'no-kit',
      detail: 'no recovery kit is escrowed for this account',
    });
  });

  it('surfaces the backup-restore transparency flag on a bind after a read', async () => {
    let now = NOW;
    const { deps: d } = deps({ now: () => now });
    expect((await put(d, 0xab)).status).toBe(200);
    expect((await handleRegisterKeyRequest(post({ action: 'escrow-get' }), d)).status).toBe(200);

    now += 2 * HOUR;
    const binding = await issueNonce(d, 'rotation', 0xcd);
    const res = await handleRegisterKeyRequest(
      post(
        {
          action: 'rotate',
          nonce: binding.nonce,
          newPubkey: NEXT.pubkey,
          authorizationSignatureHex: proof('rotation', binding, NEXT.pubkey, PRIMARY.privateKeyHex),
          possessionSignatureHex: proof('possession', binding, NEXT.pubkey, NEXT.privateKeyHex),
        },
        { iat: Math.floor(now / 1000) },
      ),
      d,
    );
    expect(res.status).toBe(200);
    expect((await json(res)).data).toMatchObject({ backupRestore: true });
  });
});

describe('no-kit recovery is fail-closed without a notification channel', () => {
  function possessionOnly(newKey: { pubkey: string; privateKeyHex: string }) {
    return signKeyCustody(
      {
        purpose: 'possession',
        userId: USER_ID,
        profileId: PROFILE_ID,
        oldPubkey: PRIMARY.pubkey,
        subject: newKey.pubkey,
        nonce: '',
      },
      newKey.privateKeyHex,
    );
  }

  it('refuses with an explicit, honest unavailable state', async () => {
    const { deps: d, state } = deps();
    const res = await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        possessionSignatureHex: possessionOnly(NEXT),
      }),
      d,
    );
    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body.error).toBe('notification-channel-required');
    expect(String(body.detail)).toContain('no notification channel configured');
    expect(String(body.detail)).toContain('Use your recovery kit');
    // Nothing was recorded, and nothing pretended to send.
    expect(state.recoveryRequests).toHaveLength(0);
    expect(state.keyEvents).toHaveLength(0);
  });

  it('never returns the raw cancel token to the session', async () => {
    // Even when the gate passes, the response must not carry the token: the
    // response goes to whoever holds the session, which is the attacker the
    // token defends against.
    const { deps: d } = deps({
      storeOptions: {
        profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey }],
        notifyChannels: [{ profileId: PROFILE_ID, confirmedAt: '2026-07-01T00:00:00.000Z' }],
      },
    });
    const res = await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        possessionSignatureHex: possessionOnly(NEXT),
      }),
      d,
    );
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toMatch(/"cancelToken"/);
    expect(raw).toContain('"cancelTokenDelivery":"notification-channel"');
  });

  it('stores only the HASH of the cancel token', async () => {
    const { deps: d, state } = deps({
      storeOptions: {
        profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey }],
        notifyChannels: [{ profileId: PROFILE_ID, confirmedAt: '2026-07-01T00:00:00.000Z' }],
      },
      sha256Hex: async () => 'ab'.repeat(32),
    });
    await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        possessionSignatureHex: possessionOnly(NEXT),
      }),
      d,
    );
    expect(state.recoveryRequests[0]?.cancelTokenHash).toBe('ab'.repeat(32));
    // The token itself (32 bytes of 0xab) is nowhere in the stored row.
    expect(JSON.stringify(state.recoveryRequests[0])).not.toContain('ab'.repeat(32) + 'ab');
  });

  it('requires possession of the pre-committed key at REQUEST time', async () => {
    const { deps: d, state } = deps({
      storeOptions: {
        profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey }],
        notifyChannels: [{ profileId: PROFILE_ID, confirmedAt: '2026-07-01T00:00:00.000Z' }],
      },
    });
    const res = await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        // Signed by a different key than the one being pre-committed.
        possessionSignatureHex: possessionOnly({
          pubkey: NEXT.pubkey,
          privateKeyHex: DEVICE.privateKeyHex,
        }),
      }),
      d,
    );
    expect(res.status).toBe(403);
    expect(state.recoveryRequests).toHaveLength(0);
  });

  it('completes only after the lock, with step-up re-auth and the pre-committed key', async () => {
    let now = NOW;
    const { deps: d, store } = deps({
      now: () => now,
      storeOptions: {
        profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey }],
        notifyChannels: [{ profileId: PROFILE_ID, confirmedAt: '2026-07-01T00:00:00.000Z' }],
      },
    });
    const requested = await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        possessionSignatureHex: possessionOnly(NEXT),
      }),
      d,
    );
    const requestId = ((await json(requested)).data as Record<string, string>).requestId!;

    // Each attempt needs its OWN nonce: a nonce value is never reissued, so
    // reusing the seam fill would fail on issuance rather than on the thing
    // under test.
    let nonceFill = 0x10;
    const completeBody = async (iat: number) => {
      nonceFill += 1;
      const binding = await issueNonce(
        { ...d, now: () => now },
        'recovery_complete',
        nonceFill,
      );
      return post(
        {
          action: 'recovery-complete',
          nonce: binding.nonce,
          requestId,
          newPubkey: NEXT.pubkey,
          possessionSignatureHex: proof('possession', binding, NEXT.pubkey, NEXT.privateKeyHex),
        },
        { iat },
      );
    };

    // Still locked.
    let res = await handleRegisterKeyRequest(await completeBody(Math.floor(now / 1000)), d);
    expect(res.status).toBe(409);
    expect((await json(res)).error).toBe('still-locked');

    now += 73 * HOUR;
    // Stale session after the lock: step-up is checked at COMPLETION time.
    res = await handleRegisterKeyRequest(
      await completeBody(Math.floor((now - 5 * HOUR) / 1000)),
      d,
    );
    expect(res.status).toBe(401);
    expect((await json(res)).error).toBe('reauth-required');
    expect(await store.resolveActiveKey(PRIMARY.pubkey)).toMatchObject({ verdict: 'active' });

    // Fresh session: the recovery completes and every prior key is revoked.
    res = await handleRegisterKeyRequest(await completeBody(Math.floor(now / 1000)), d);
    expect(res.status).toBe(200);
    expect((await json(res)).data).toMatchObject({ pubkey: NEXT.pubkey, recovered: true });
    expect(await store.resolveActiveKey(PRIMARY.pubkey)).toMatchObject({ verdict: 'revoked' });
    expect(await store.resolveActiveKey(NEXT.pubkey)).toMatchObject({ verdict: 'active' });
  });

  it('refuses to complete with a key that was not pre-committed', async () => {
    let now = NOW;
    const { deps: d } = deps({
      now: () => now,
      storeOptions: {
        profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey }],
        notifyChannels: [{ profileId: PROFILE_ID, confirmedAt: '2026-07-01T00:00:00.000Z' }],
      },
    });
    const requested = await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        possessionSignatureHex: possessionOnly(NEXT),
      }),
      d,
    );
    const requestId = ((await json(requested)).data as Record<string, string>).requestId!;
    now += 73 * HOUR;
    const binding = await issueNonce(d, 'recovery_complete', 0xcd);
    const res = await handleRegisterKeyRequest(
      post(
        {
          action: 'recovery-complete',
          nonce: binding.nonce,
          requestId,
          newPubkey: DEVICE.pubkey,
          possessionSignatureHex: proof('possession', binding, DEVICE.pubkey, DEVICE.privateKeyHex),
        },
        { iat: Math.floor(now / 1000) },
      ),
      d,
    );
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe('pubkey-not-precommitted');
  });

  it('cancels with the keyless token and freezes after the second cancel', async () => {
    let now = NOW;
    let token = '';
    const { deps: d } = deps({
      now: () => now,
      storeOptions: {
        profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey }],
        notifyChannels: [{ profileId: PROFILE_ID, confirmedAt: '2026-07-01T00:00:00.000Z' }],
      },
      // Deterministic hash seam so the test can present the same token the
      // request stored, standing in for the notification the channel would send.
      sha256Hex: async (text: string) => {
        token = text;
        return 'cc'.repeat(32);
      },
    });

    const open = async (pubkey: string, privateKeyHex: string) => {
      const res = await handleRegisterKeyRequest(
        post({
          action: 'recovery-request',
          newPubkey: pubkey,
          possessionSignatureHex: signKeyCustody(
            {
              purpose: 'possession',
              userId: USER_ID,
              profileId: PROFILE_ID,
              oldPubkey: PRIMARY.pubkey,
              subject: pubkey,
              nonce: '',
            },
            privateKeyHex,
          ),
        }),
        d,
      );
      expect(res.status).toBe(200);
      return ((await json(res)).data as Record<string, string>).requestId!;
    };

    const firstId = await open(NEXT.pubkey, NEXT.privateKeyHex);
    let res = await handleRegisterKeyRequest(
      post({ action: 'recovery-cancel', requestId: firstId, cancelToken: token }),
      d,
    );
    expect(res.status).toBe(200);
    expect((await json(res)).data).toMatchObject({ cancelled: true, status: 'cancelled' });

    now += 24 * HOUR;
    const secondId = await open(DEVICE.pubkey, DEVICE.privateKeyHex);
    res = await handleRegisterKeyRequest(
      post({ action: 'recovery-cancel', requestId: secondId, cancelToken: token }),
      d,
    );
    expect((await json(res)).data).toMatchObject({ status: 'frozen' });

    // The no-kit path is now shut, with copy that says the kit path still works.
    now += 24 * HOUR;
    res = await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        possessionSignatureHex: signKeyCustody(
          {
            purpose: 'possession',
            userId: USER_ID,
            profileId: PROFILE_ID,
            oldPubkey: PRIMARY.pubkey,
            subject: NEXT.pubkey,
            nonce: '',
          },
          NEXT.privateKeyHex,
        ),
      }),
      d,
    );
    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.error).toBe('recovery-frozen');
    expect(String(body.detail)).toContain('recovery kit still works');
  });

  it('rejects a wrong cancel token', async () => {
    const { deps: d } = deps({
      storeOptions: {
        profiles: [{ id: PROFILE_ID, userId: USER_ID, pubkey: PRIMARY.pubkey }],
        notifyChannels: [{ profileId: PROFILE_ID, confirmedAt: '2026-07-01T00:00:00.000Z' }],
      },
    });
    const requested = await handleRegisterKeyRequest(
      post({
        action: 'recovery-request',
        newPubkey: NEXT.pubkey,
        possessionSignatureHex: signKeyCustody(
          {
            purpose: 'possession',
            userId: USER_ID,
            profileId: PROFILE_ID,
            oldPubkey: PRIMARY.pubkey,
            subject: NEXT.pubkey,
            nonce: '',
          },
          NEXT.privateKeyHex,
        ),
      }),
      d,
    );
    const requestId = ((await json(requested)).data as Record<string, string>).requestId!;
    const res = await handleRegisterKeyRequest(
      post({ action: 'recovery-cancel', requestId, cancelToken: 'not-the-token' }),
      d,
    );
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe('bad-cancel-token');
  });

  it('rejects a cancel with neither token nor proof', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(
      post({ action: 'recovery-cancel', requestId: PROFILE_ID }),
      d,
    );
    expect(res.status).toBe(400);
  });
});

describe('recovery-status', () => {
  it('reports the chain and the honest capability flags', async () => {
    const { deps: d } = deps();
    const res = await handleRegisterKeyRequest(post({ action: 'recovery-status' }), d);
    expect(res.status).toBe(200);
    const data = (await json(res)).data as Record<string, unknown>;
    expect(data).toMatchObject({
      profileId: PROFILE_ID,
      headPubkey: PRIMARY.pubkey,
      notificationChannelConfirmed: false,
      recovery: null,
      recoveryFrozen: false,
    });
    expect(data.keys).toHaveLength(1);
  });

  it('refuses a caller with no profile', async () => {
    const { deps: d } = deps({ storeOptions: { profiles: [] } });
    const res = await handleRegisterKeyRequest(post({ action: 'recovery-status' }), d);
    expect(res.status).toBe(409);
    expect((await json(res)).error).toBe('no-profile');
  });
});
