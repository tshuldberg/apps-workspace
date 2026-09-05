/**
 * Plan 39 P2: the persona service HTTP surface + the durable file store. Real node:http
 * server + real fetch; a real durable FilePersonaRegistryStore over a temp DATA_DIR. Proves
 * the wire contract end-to-end (register -> resolve -> session issue -> verify), the honest
 * fail-closed rejects, restart durability, and the O_EXCL atomic squat-race winner.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  bytesToHex,
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  extractPersonaPrivateKeyHex,
  generatePublicPersona,
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  serializeHumanityToken,
  sha512Hex,
  signMessage,
  type PublicPersona,
} from '@mylife/sync';
import {
  createHumanityRouteGuard,
  FilePersonaRegistryStore,
  PersonaRegistryService,
  personaSessionChallengeBytes,
  startPersonaService,
  type HumanityRouteGuard,
  type PersonaServiceServer,
} from '../index';

const humanityKp = humanityServiceKeypairFromSeed('cd'.repeat(32));
const encoder = new TextEncoder();

/** The humanity-token commitment hash, identical to the server's bindingHash (sha512Hex). */
function bindingHash(input: string): string {
  return sha512Hex(encoder.encode(input));
}

/** A fresh, real humanity token the session-issuance guard will verify + spend. */
function mintGuardToken(): string {
  const [token] = issueHumanityTokenBatch({
    servicePrivateKeyHex: humanityKp.privateKeyHex,
    count: 1,
    randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)),
  });
  return serializeHumanityToken(token);
}

/**
 * A real session-issuance humanity guard: verifies the token against the humanity keypair's
 * public key, then spends it (single-use). A replay of the same bearer is 'already_spent'.
 */
function makeSessionGuard(): HumanityRouteGuard {
  const spent = new Set<string>();
  return createHumanityRouteGuard({
    policy: {
      required: true,
      servicePublicKeyHex: humanityKp.publicKeyHex,
      redeem: async (bearer: string) => {
        if (spent.has(bearer)) return { ok: false, reason: 'already_spent' as const };
        spent.add(bearer);
        return { ok: true as const };
      },
    },
  });
}

function makeAccount(alias: string) {
  const persona = generatePublicPersona(alias);
  const [token] = issueHumanityTokenBatch({
    servicePrivateKeyHex: humanityKp.privateKeyHex,
    count: 1,
    randomBytes: (n) => new Uint8Array(nodeRandomBytes(n)),
  });
  const binding = bindingHash(token.tokenId);
  const claim = createPersonaClaim({ persona, humanityBinding: binding });
  return { persona, claim, wireToken: serializeHumanityToken(token) };
}

function signChallenge(persona: PublicPersona, nonce: string): string {
  const priv = extractPersonaPrivateKeyHex(persona.privateKeyRef, persona.personaPubkey);
  return bytesToHex(signMessage(priv, personaSessionChallengeBytes(nonce, persona.personaPubkey)));
}

function spendingRedeem() {
  const spent = new Set<string>();
  return async (token: string) => {
    if (spent.has(token)) return { ok: false, reason: 'already_spent' };
    spent.add(token);
    return { ok: true };
  };
}

let dir: string;
let server: PersonaServiceServer | null = null;

async function post(base: string, route: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  dir = mkdtempSync(path.join(tmpdir(), 'persona-registry-'));
});

afterEach(async () => {
  if (server) { await server.close(); server = null; }
  rmSync(dir, { recursive: true, force: true });
});

describe('persona service HTTP + durable store', () => {
  it('uses an exact browser origin allowlist for preflight and error responses', async () => {
    const service = new PersonaRegistryService({
      store: new FilePersonaRegistryStore(dir),
      sessionSecret: 'http-session-secret-0000000000000000',
      humanityRequired: false,
    });
    server = await startPersonaService({
      service,
      host: '127.0.0.1',
      corsAllowedOrigins: ['https://app.meerkat.example'],
    });
    const allowed = await fetch(`${server.url}/persona/resolve`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.meerkat.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://app.meerkat.example');
    const blocked = await fetch(`${server.url}/persona/resolve`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(blocked.status).toBe(403);
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('fails closed for account deletion and export when the full coordinator is absent', async () => {
    const service = new PersonaRegistryService({
      store: new FilePersonaRegistryStore(dir),
      sessionSecret: 'http-session-secret-0000000000000000',
      humanityRequired: false,
    });
    server = await startPersonaService({ service, host: '127.0.0.1' });
    const body = { personaPubkey: 'aa'.repeat(32), issuedAt: Date.now(), signature: 'bb'.repeat(64) };
    expect((await post(server.url, '/persona/delete', body)).status).toBe(503);
    expect((await post(server.url, '/persona/export', body)).status).toBe(503);
  });

  it('registers, resolves, issues + verifies a session over the wire', async () => {
    const service = new PersonaRegistryService({
      store: new FilePersonaRegistryStore(dir),
      sessionSecret: 'http-session-secret-0000000000000000',
      redeemHumanity: spendingRedeem(),
    });
    server = await startPersonaService({ service, host: '127.0.0.1', sessionHumanityGuard: makeSessionGuard() });
    const base = server.url;
    const a = makeAccount('alice');

    const reg = await post(base, '/persona/register', { claim: a.claim }, { 'x-mk-humanity': a.wireToken });
    expect(reg.status).toBe(200);
    expect(reg.json).toMatchObject({ ok: true, alias: 'alice', personaPubkey: a.persona.personaPubkey });

    const resolve = await post(base, '/persona/resolve', { alias: 'ALICE' });
    expect(resolve.status).toBe(200);
    expect(resolve.json.personaPubkey).toBe(a.persona.personaPubkey);

    const challenge = await post(base, '/persona/session/challenge', { personaPubkey: a.persona.personaPubkey });
    expect(challenge.status).toBe(200);
    // Issuance now spends a humanity token (Plan 39 P7).
    const issued = await post(base, '/persona/session/issue', {
      challengeId: challenge.json.challengeId,
      personaPubkey: a.persona.personaPubkey,
      signature: signChallenge(a.persona, challenge.json.nonce as string),
    }, { 'x-mk-humanity': mintGuardToken() });
    expect(issued.status).toBe(200);
    const verify = await post(base, '/persona/session/verify', { token: issued.json.token });
    expect(verify.status).toBe(200);
    expect(verify.json.personaPubkey).toBe(a.persona.personaPubkey);

    // Reverse-resolve: registered keys map to aliases; an unregistered key is absent (never faked).
    const unregistered = makeAccount('nobody').persona.personaPubkey;
    const rk = await post(base, '/persona/resolve-keys', { personaPubkeys: [a.persona.personaPubkey, unregistered] });
    expect(rk.status).toBe(200);
    expect(rk.json.ok).toBe(true);
    const aliases = rk.json.aliases as Record<string, string>;
    expect(aliases[a.persona.personaPubkey.toLowerCase()]).toBe('alice');
    expect(aliases[unregistered.toLowerCase()]).toBeUndefined();
  });

  it('session issuance is humanity-gated (Plan 39 P7): 500 unconfigured, 401 missing, 409 replay', async () => {
    const service = new PersonaRegistryService({
      store: new FilePersonaRegistryStore(dir),
      sessionSecret: 'http-session-secret-0000000000000000',
      redeemHumanity: spendingRedeem(),
    });
    // No guard wired but required (default) => issuance fails closed with 500.
    server = await startPersonaService({ service, host: '127.0.0.1' });
    const a = makeAccount('alice');
    await post(server.url, '/persona/register', { claim: a.claim }, { 'x-mk-humanity': a.wireToken });
    const ch1 = await post(server.url, '/persona/session/challenge', { personaPubkey: a.persona.personaPubkey });
    const noGuard = await post(server.url, '/persona/session/issue', {
      challengeId: ch1.json.challengeId, personaPubkey: a.persona.personaPubkey, signature: signChallenge(a.persona, ch1.json.nonce as string),
    });
    expect(noGuard.status).toBe(500);
    expect(noGuard.json.reason).toBe('humanity_not_configured');
    await server.close();

    // Fresh service WITH a guard: a missing token is 401, a replayed token is 409.
    const service2 = new PersonaRegistryService({
      store: new FilePersonaRegistryStore(dir),
      sessionSecret: 'http-session-secret-0000000000000000',
      redeemHumanity: spendingRedeem(),
    });
    server = await startPersonaService({ service: service2, host: '127.0.0.1', sessionHumanityGuard: makeSessionGuard() });
    const b = makeAccount('bob');
    await post(server.url, '/persona/register', { claim: b.claim }, { 'x-mk-humanity': b.wireToken });

    const chMissing = await post(server.url, '/persona/session/challenge', { personaPubkey: b.persona.personaPubkey });
    const missing = await post(server.url, '/persona/session/issue', {
      challengeId: chMissing.json.challengeId, personaPubkey: b.persona.personaPubkey, signature: signChallenge(b.persona, chMissing.json.nonce as string),
    }); // no x-mk-humanity header
    expect(missing.status).toBe(401);

    const token = mintGuardToken();
    const chA = await post(server.url, '/persona/session/challenge', { personaPubkey: b.persona.personaPubkey });
    const first = await post(server.url, '/persona/session/issue', {
      challengeId: chA.json.challengeId, personaPubkey: b.persona.personaPubkey, signature: signChallenge(b.persona, chA.json.nonce as string),
    }, { 'x-mk-humanity': token });
    expect(first.status).toBe(200);
    const chB = await post(server.url, '/persona/session/challenge', { personaPubkey: b.persona.personaPubkey });
    const replay = await post(server.url, '/persona/session/issue', {
      challengeId: chB.json.challengeId, personaPubkey: b.persona.personaPubkey, signature: signChallenge(b.persona, chB.json.nonce as string),
    }, { 'x-mk-humanity': token }); // same token again
    expect(replay.status).toBe(409);
  });

  it('rejects registration with no humanity token (fail-closed, no fabricated success)', async () => {
    const service = new PersonaRegistryService({
      store: new FilePersonaRegistryStore(dir),
      sessionSecret: 'http-session-secret-0000000000000000',
      redeemHumanity: spendingRedeem(),
    });
    server = await startPersonaService({ service, host: '127.0.0.1' });
    const a = makeAccount('alice');
    const reg = await post(server.url, '/persona/register', { claim: a.claim }); // no header
    expect(reg.status).toBe(400);
    expect(reg.json).toMatchObject({ ok: false, reason: 'humanity_invalid' });
    // Nothing was registered.
    const resolve = await post(server.url, '/persona/resolve', { alias: 'alice' });
    expect(resolve.status).toBe(404);
  });

  it('survives a restart: a registered alias resolves from a fresh service on the same dir', async () => {
    const store1 = new FilePersonaRegistryStore(dir);
    const svc1 = new PersonaRegistryService({ store: store1, sessionSecret: 's'.repeat(36), redeemHumanity: spendingRedeem() });
    const a = makeAccount('persistent');
    expect((await svc1.register({ claim: a.claim, humanityToken: a.wireToken })).ok).toBe(true);

    // A brand new service instance over the SAME dir (simulating a process restart).
    const store2 = new FilePersonaRegistryStore(dir);
    const svc2 = new PersonaRegistryService({ store: store2, sessionSecret: 's'.repeat(36), redeemHumanity: spendingRedeem() });
    expect(await svc2.resolve('persistent')).toEqual({ alias: 'persistent', personaPubkey: a.persona.personaPubkey });
    // A duplicate register on the restarted service loses to the durable row.
    const b = makeAccount('persistent');
    const dup = await svc2.register({ claim: b.claim, humanityToken: b.wireToken });
    expect(dup.ok).toBe(false);
  });

  it('O_EXCL atomic: two concurrent file-store registrations of one alias, exactly one wins', async () => {
    const store = new FilePersonaRegistryStore(dir);
    const a = makeAccount('rivals');
    const b = makeAccount('rivals');
    const [ra, rb] = await Promise.all([
      store.tryRegister({ version: 1, alias: 'rivals', personaPubkey: a.persona.personaPubkey, humanityBinding: 'a', claim: a.claim, createdAt: 'now' }),
      store.tryRegister({ version: 1, alias: 'rivals', personaPubkey: b.persona.personaPubkey, humanityBinding: 'b', claim: b.claim, createdAt: 'now' }),
    ]);
    expect([ra, rb].filter((r) => r === 'ok').length).toBe(1);
    expect([ra, rb].filter((r) => r === 'alias_taken').length).toBe(1);
  });

  it('one persona key owns at most one alias (two-key uniqueness)', async () => {
    const store = new FilePersonaRegistryStore(dir);
    const a = makeAccount('firstname');
    expect(await store.tryRegister({ version: 1, alias: 'firstname', personaPubkey: a.persona.personaPubkey, humanityBinding: 'a', claim: a.claim, createdAt: 'now' })).toBe('ok');
    // Same persona key, different alias -> rejected (pubkey already owns an alias).
    expect(await store.tryRegister({ version: 1, alias: 'secondname', personaPubkey: a.persona.personaPubkey, humanityBinding: 'a', claim: a.claim, createdAt: 'now' })).toBe('pubkey_taken');
    // The rolled-back alias is free and unregistered.
    expect(await store.getByAlias('secondname')).toBeNull();
  });
});
