/**
 * Plan 39 P12: operator admin routes on the persona service
 * (/persona/admin/suspend|unsuspend|status) + the registry's suspend seam.
 * Adversarial: unconfigured admin secret fail-closes EVERY admin route (503),
 * missing/wrong bearer is 401, suspend revokes an issued session's validity via
 * the isRevoked seam, unsuspend restores it, and a GDPR-deleted persona can
 * never be unsuspended (409 not_registered).
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import {
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  extractPersonaPrivateKeyHex,
  generatePublicPersona,
  personaRequestBytes,
  PERSONA_GDPR_DELETE_DOMAIN,
  sha512Hex,
  signMessage,
  type PublicPersona,
} from '@mylife/sync';
import {
  createPersonaSessionVerifier,
  InMemoryPersonaRegistryStore,
  PersonaRegistryService,
  personaSessionChallengeBytes,
  startPersonaService,
  type PersonaServiceServer,
} from '../index';

const SESSION_SECRET = 'admin-test-session-secret-0000000000';
const ADMIN_SECRET = 'admin-test-operator-secret';
const encoder = new TextEncoder();

interface RawResponse { status: number; json: () => unknown }
function post(url: string, body: unknown, bearer?: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        Connection: 'close',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 500, json: () => JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

let store: InMemoryPersonaRegistryStore;
let service: PersonaRegistryService;
let server: PersonaServiceServer | null = null;

afterEach(async () => { if (server) await server.close(); server = null; });
beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  store = new InMemoryPersonaRegistryStore();
  service = new PersonaRegistryService({ store, sessionSecret: SESSION_SECRET, humanityRequired: false });
});

async function registerPersona(alias: string): Promise<PublicPersona> {
  const persona = generatePublicPersona(alias);
  const claim = createPersonaClaim({ persona, humanityBinding: sha512Hex(encoder.encode('t')) });
  const result = await service.register({ claim });
  expect(result.ok).toBe(true);
  return persona;
}

describe('admin route auth (adversarial)', () => {
  it('fail-closes every admin route with 503 when no admin secret is configured', async () => {
    server = await startPersonaService({ service, port: 0 });
    for (const route of ['suspend', 'unsuspend', 'status']) {
      const res = await post(`${server.url}/persona/admin/${route}`, { alias: 'alice' }, ADMIN_SECRET);
      expect(res.status, route).toBe(503);
      expect((res.json() as { reason: string }).reason).toBe('admin_not_configured');
    }
  });

  it('rejects a missing or wrong bearer on every admin route', async () => {
    server = await startPersonaService({ service, port: 0, adminSecret: ADMIN_SECRET });
    for (const route of ['suspend', 'unsuspend', 'status']) {
      expect((await post(`${server!.url}/persona/admin/${route}`, { alias: 'alice' })).status, `${route} bare`).toBe(401);
      expect((await post(`${server!.url}/persona/admin/${route}`, { alias: 'alice' }, 'wrong')).status, `${route} wrong`).toBe(401);
    }
  });
});

describe('suspend / unsuspend semantics', () => {
  it('suspend revokes a LIVE session through the isRevoked seam; unsuspend restores', async () => {
    server = await startPersonaService({ service, port: 0, adminSecret: ADMIN_SECRET });
    const alice = await registerPersona('alice');
    // Issue a real session.
    const challenge = await service.sessionChallenge(alice.personaPubkey);
    expect(challenge.ok).toBe(true);
    if (!challenge.ok) throw new Error('challenge refused');
    const priv = extractPersonaPrivateKeyHex(alice.privateKeyRef, alice.personaPubkey);
    const issued = await service.issueSession({
      challengeId: challenge.challengeId,
      personaPubkey: alice.personaPubkey,
      signatureHex: bytesToHex(signMessage(priv, personaSessionChallengeBytes(challenge.nonce, alice.personaPubkey))),
    });
    expect(issued.ok).toBe(true);
    if (!issued.ok) throw new Error('session refused');
    // The verifier Track B's submit route consumes, honoring the SAME store.
    const verify = createPersonaSessionVerifier({
      secret: SESSION_SECRET,
      isRevoked: (pk) => store.isRevoked(pk),
    });
    expect((await verify(issued.token)).ok).toBe(true);

    const suspended = await post(`${server.url}/persona/admin/suspend`, { alias: 'alice' }, ADMIN_SECRET);
    expect(suspended.status).toBe(200);
    expect((suspended.json() as { alias: string }).alias).toBe('alice');
    const blocked = await verify(issued.token);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('revoked');
    // Idempotent re-suspend.
    const again = await post(`${server.url}/persona/admin/suspend`, { personaPubkey: alice.personaPubkey }, ADMIN_SECRET);
    expect(again.status).toBe(200);
    expect((again.json() as { alreadySuspended: boolean }).alreadySuspended).toBe(true);

    const status = await post(`${server.url}/persona/admin/status`, { alias: 'alice' }, ADMIN_SECRET);
    expect(status.json()).toMatchObject({ ok: true, registered: true, alias: 'alice', suspended: true });

    const unsuspended = await post(`${server.url}/persona/admin/unsuspend`, { alias: 'alice' }, ADMIN_SECRET);
    expect(unsuspended.status).toBe(200);
    expect((unsuspended.json() as { wasSuspended: boolean }).wasSuspended).toBe(true);
    expect((await verify(issued.token)).ok).toBe(true);
  });

  it('unknown alias 404s; a GDPR-deleted persona can never be unsuspended (409)', async () => {
    server = await startPersonaService({ service, port: 0, adminSecret: ADMIN_SECRET });
    expect((await post(`${server.url}/persona/admin/suspend`, { alias: 'ghost' }, ADMIN_SECRET)).status).toBe(404);

    const bob = await registerPersona('bobby');
    const issuedAtMs = Date.now();
    const priv = extractPersonaPrivateKeyHex(bob.privateKeyRef, bob.personaPubkey);
    const signature = bytesToHex(signMessage(priv, personaRequestBytes(PERSONA_GDPR_DELETE_DOMAIN, bob.personaPubkey, issuedAtMs)));
    expect((await service.deleteAccount({ personaPubkey: bob.personaPubkey, issuedAtMs, signatureHex: signature })).ok).toBe(true);

    const res = await post(`${server.url}/persona/admin/unsuspend`, { personaPubkey: bob.personaPubkey }, ADMIN_SECRET);
    expect(res.status).toBe(409);
    expect((res.json() as { reason: string }).reason).toBe('not_registered');
    // The deleted persona's sessions stay revoked forever.
    expect(await store.isRevoked(bob.personaPubkey)).toBe(true);
  });

  it('rejects a target-less body and a malformed pubkey', async () => {
    server = await startPersonaService({ service, port: 0, adminSecret: ADMIN_SECRET });
    expect((await post(`${server.url}/persona/admin/suspend`, {}, ADMIN_SECRET)).status).toBe(400);
    expect((await post(`${server.url}/persona/admin/suspend`, { personaPubkey: 'zz'.repeat(32) }, ADMIN_SECRET)).status).toBe(400);
  });
});
