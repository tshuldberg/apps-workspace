import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SignableKeyPossession } from '../../../../modules/mynews/src/signing/canonical';
import { signKeyPossession } from '../../../../modules/mynews/src/signing/sign';
import { handleRegisterKeyRequest } from '../index.ts';
import { canonicalKeyPossessionBytes } from '../../_shared/mynews-signing.ts';
import { createInMemoryMyNewsStore } from '../../_shared/mynews-store.ts';

const vectors = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../modules/mynews/src/signing/__fixtures__/signing-vectors.json'),
    'utf8',
  ),
);

const USER_ID = 'auth-user-1';
const OTHER_USER_ID = 'auth-user-2';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// A minimal unsigned JWT with the given sub; the platform verifies the real
// signature before invoking the function, so the handler parses sub only.
function jwtFor(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function post(body: unknown, sub: string | null): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sub) headers.Authorization = `Bearer ${jwtFor(sub)}`;
  return new Request('http://local/mynews-register-key', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function seededStore(pubkey = '') {
  return createInMemoryMyNewsStore({
    profiles: [{ id: 'profile-1', userId: USER_ID, pubkey }],
  });
}

function popSignature(userId: string, pubkey: string): string {
  const signable: SignableKeyPossession = { userId, pubkey };
  return signKeyPossession(signable, vectors.privateKeyHex);
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

describe('canonical key-possession twin parity', () => {
  it('produces byte-identical bytes to the module builder', () => {
    const signable = { userId: USER_ID, pubkey: vectors.publicKeyHex };
    const moduleBytes = toHex(
      // module builder is imported transitively via the fixture; assert the
      // edge twin matches the committed hex vector.
      canonicalKeyPossessionBytes(signable),
    );
    expect(moduleBytes).toBe(vectors.keyPossessionCanonicalHex);
  });

  it('round-trips the committed key-possession vector', () => {
    expect(vectors.keyPossessionSignatureHex).toBe(
      popSignature(USER_ID, vectors.publicKeyHex),
    );
  });
});

describe('handleRegisterKeyRequest', () => {
  const validBody = () => ({
    pubkey: vectors.publicKeyHex,
    signatureHex: popSignature(USER_ID, vectors.publicKeyHex),
  });

  it('rejects non-POST', async () => {
    const { store } = seededStore();
    const res = await handleRegisterKeyRequest(
      new Request('http://local/mynews-register-key', { method: 'GET' }),
      { store },
    );
    expect(res.status).toBe(405);
  });

  it('rejects a missing session', async () => {
    const { store } = seededStore();
    const res = await handleRegisterKeyRequest(post(validBody(), null), { store });
    expect(res.status).toBe(401);
    expect((await readJson(res)).error).toBe('not-signed-in');
  });

  it('rejects an empty pubkey', async () => {
    const { store } = seededStore();
    const res = await handleRegisterKeyRequest(
      post({ pubkey: '', signatureHex: 'ab' }, USER_ID),
      { store },
    );
    expect(res.status).toBe(400);
    expect((await readJson(res)).error).toBe('bad-payload');
  });

  it('sets the key for a valid proof-of-possession over the caller uid', async () => {
    const { store, state } = seededStore();
    const res = await handleRegisterKeyRequest(post(validBody(), USER_ID), { store });
    expect(res.status).toBe(200);
    expect((await readJson(res)).ok).toBe(true);
    expect(state.profiles.get('profile-1')?.pubkey).toBe(vectors.publicKeyHex);
  });

  it('rejects a signature bound to a DIFFERENT uid (replay/transfer)', async () => {
    // Attacker holds a valid signature the victim made over the VICTIM's uid,
    // but presents it under their own session. Because the bytes bind the uid,
    // verifying against the caller's uid fails.
    const { store, state } = seededStore();
    const victimSig = popSignature(OTHER_USER_ID, vectors.publicKeyHex);
    const res = await handleRegisterKeyRequest(
      post({ pubkey: vectors.publicKeyHex, signatureHex: victimSig }, USER_ID),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('bad-signature');
    expect(state.profiles.get('profile-1')?.pubkey).toBe('');
  });

  it('rejects a signature made with the wrong private key', async () => {
    const { store, state } = seededStore();
    const res = await handleRegisterKeyRequest(
      post({ pubkey: vectors.publicKeyHex, signatureHex: 'de'.repeat(64) }, USER_ID),
      { store },
    );
    expect(res.status).toBe(403);
    expect((await readJson(res)).error).toBe('bad-signature');
    expect(state.profiles.get('profile-1')?.pubkey).toBe('');
  });

  it('rejects a caller with no profile row', async () => {
    const { store } = createInMemoryMyNewsStore({ profiles: [] });
    const res = await handleRegisterKeyRequest(post(validBody(), USER_ID), { store });
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toBe('no-profile');
  });

  it('rejects a key already held by another profile (squatting)', async () => {
    const { store } = createInMemoryMyNewsStore({
      profiles: [
        { id: 'profile-1', userId: USER_ID, pubkey: '' },
        { id: 'profile-2', userId: 'auth-user-3', pubkey: vectors.publicKeyHex },
      ],
    });
    const res = await handleRegisterKeyRequest(post(validBody(), USER_ID), { store });
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toBe('pubkey-conflict');
  });

  it('rejects a second key on a profile that already holds one', async () => {
    const { store } = seededStore(vectors.publicKeyHex);
    const res = await handleRegisterKeyRequest(post(validBody(), USER_ID), { store });
    expect(res.status).toBe(409);
    expect((await readJson(res)).error).toBe('already-set');
  });
});
