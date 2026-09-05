/**
 * Plan 51 P2/P4: the anonymous-credential ALTERNATIVE proof on persona
 * REGISTRATION, and the enforcement chain over a captured registration serial.
 *
 * Real node:http persona service, real durable file store, real credential
 * issuance/verification. A first-party service requires humanity by default; a
 * valid credential presentation registers WITHOUT a humanity token. Coverage:
 *  - valid credential registers where humanity would (no humanity redeem needed);
 *  - forged / expired / revoked presentations are refused with honest reasons;
 *  - with NO verifier wired, the legacy humanity path is byte-identical;
 *  - NC-1: a revoked serial is refused on registration;
 *  - enforcement chain: register with credential -> serial captured ->
 *    revokeCredentialSerial -> the same credential refused on a later register;
 *    and no account-shaped field exists in any touched record.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  generatePublicPersona,
  credentialEpochWindow,
  publicPostNodeKeypairFromSeed,
} from '@mylife/sync';
import {
  FilePersonaRegistryStore,
  PersonaRegistryService,
  startPersonaService,
  InMemoryCredentialEvidenceSink,
  InMemoryCredentialRevocationSink,
  OperatorConsoleService,
  InMemoryOperatorConsoleStore,
  type PersonaServiceServer,
} from '../index';
import {
  CredentialTestAuthority,
  EPOCH_0,
  NOW_MS_IN_EPOCH_0,
} from './support/credential-test-harness';

const OPERATOR = publicPostNodeKeypairFromSeed('99'.repeat(32));

/** A persona + a claim carrying an arbitrary humanity binding (credential path never spends one). */
function makeAccount(alias: string) {
  const persona = generatePublicPersona(alias);
  // The claim commits to SOME binding; for the credential path the binding value
  // is not verified against a humanity token (the credential is the proof).
  const claim = createPersonaClaim({ persona, humanityBinding: 'a'.repeat(128) });
  return { persona, claim };
}

async function post(base: string, route: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

let dir: string;
let server: PersonaServiceServer | null = null;

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
  dir = mkdtempSync(path.join(tmpdir(), 'persona-cred-'));
});
afterEach(async () => {
  if (server) { await server.close(); server = null; }
  rmSync(dir, { recursive: true, force: true });
});

interface Boot {
  server: PersonaServiceServer;
  evidence: InMemoryCredentialEvidenceSink;
  authority: CredentialTestAuthority;
}

async function boot(options: {
  withVerifier?: boolean;
  verifierNowMs?: number;
  authority?: CredentialTestAuthority;
} = {}): Promise<Boot> {
  const service = new PersonaRegistryService({
    store: new FilePersonaRegistryStore(dir),
    sessionSecret: 'http-session-secret-0000000000000000',
    // First-party default: humanity IS required, so a successful register with no
    // humanity token proves the credential satisfied the gate.
    humanityRequired: true,
    // A redeem seam must exist for the humanity path; the credential path never calls it.
    redeemHumanity: async () => ({ ok: false, reason: 'invalid' }),
  });
  const evidence = new InMemoryCredentialEvidenceSink();
  const authority = options.authority ?? new CredentialTestAuthority();
  const nowMs = options.verifierNowMs ?? NOW_MS_IN_EPOCH_0;
  server = await startPersonaService({
    service,
    sessionHumanityRequired: false,
    ...(options.withVerifier === false ? {} : {
      credentialVerifier: authority.verifier(nowMs),
      credentialEvidence: evidence,
    }),
  });
  return { server, evidence, authority };
}

describe('Plan 51 P2: credential as the alternative humanity proof on registration', () => {
  it('registers with a valid credential and NO humanity token', async () => {
    const { server: srv, evidence, authority } = await boot();
    const { persona, claim } = makeAccount('crednaut');
    const { bearer, serial } = authority.mint(EPOCH_0);
    const res = await post(srv.url, '/persona/register', { claim }, { 'x-mk-credential': bearer });
    expect(res.status).toBe(200);
    expect(res.json.ok).toBe(true);
    expect(res.json.personaPubkey).toBe(persona.personaPubkey);
    // The serial was captured as registration evidence, co-located with the persona.
    const rows = evidence.forSubject(persona.personaPubkey);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.serial).toBe(serial);
    expect(rows[0]!.surface).toBe('persona_registration');
  });

  it('refuses a forged credential (401 credential_invalid)', async () => {
    const { server: srv } = await boot();
    const { claim } = makeAccount('forger');
    const res = await post(srv.url, '/persona/register', { claim }, { 'x-mk-credential': 'nope' });
    expect(res.status).toBe(401);
    expect(res.json.reason).toBe('credential_invalid');
  });

  it('refuses an expired credential', async () => {
    const wayLater = credentialEpochWindow(EPOCH_0).notAfterMs + 60_000;
    const { server: srv, authority } = await boot({ verifierNowMs: wayLater });
    const { claim } = makeAccount('staler');
    const { bearer } = authority.mint(EPOCH_0);
    const res = await post(srv.url, '/persona/register', { claim }, { 'x-mk-credential': bearer });
    expect(res.status).toBe(401);
    expect(res.json.reason).toBe('credential_invalid');
  });

  it('NC-1: a revoked serial is refused on registration', async () => {
    const { server: srv, authority } = await boot();
    const { claim } = makeAccount('revoked');
    const { bearer, serial } = authority.mint(EPOCH_0);
    authority.revoke(serial, EPOCH_0, 'test');
    const res = await post(srv.url, '/persona/register', { claim }, { 'x-mk-credential': bearer });
    expect(res.status).toBe(401);
    expect(res.json.reason).toBe('credential_invalid');
  });

  it('with NO verifier wired, a credential header is ignored and legacy humanity applies', async () => {
    const { server: srv, authority } = await boot({ withVerifier: false });
    const { claim } = makeAccount('legacy');
    const { bearer } = authority.mint(EPOCH_0);
    // No verifier: the credential header is ignored, so the legacy humanity path
    // runs -- and this redeem seam always rejects, so register fails on humanity,
    // NOT on the credential. Byte-identical legacy behavior.
    const res = await post(srv.url, '/persona/register', { claim }, { 'x-mk-credential': bearer });
    expect(res.status).not.toBe(200);
    expect(String(res.json.reason)).not.toContain('credential');
  });
});

describe('Plan 51 P4 (AC-3): registration enforcement chain', () => {
  it('register with credential -> serial captured -> revoke -> same credential refused; no account field', async () => {
    const authority = new CredentialTestAuthority();
    const { server: srv, evidence } = await boot({ authority });
    const { persona, claim } = makeAccount('enforced');
    const { bearer, serial } = authority.mint(EPOCH_0);

    const reg = await post(srv.url, '/persona/register', { claim }, { 'x-mk-credential': bearer });
    expect(reg.status).toBe(200);
    const captured = evidence.forSubject(persona.personaPubkey);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.serial).toBe(serial);

    // Operator revokes through the enforcement lane; the sink also drives the
    // authority the verifier reads, so the revocation reaches the presentation path.
    const revocationSink = new InMemoryCredentialRevocationSink();
    const console_ = new OperatorConsoleService({
      node: {
        recordPublicPostTombstone: async () => ({ ok: true }),
        recordPostingFreeze: async () => ({ ok: true }),
        recordPublicationKill: async () => true,
      },
      publications: { get: async () => null, list: async () => [] },
      reports: { get: async () => [] },
      posts: { listPosts: async () => [], listTombstones: async () => [], getFreeze: async () => null },
      store: new InMemoryOperatorConsoleStore(),
      operator: { publicKeyHex: OPERATOR.publicKeyHex, privateKeyHex: OPERATOR.privateKeyHex },
      credentialRevocation: {
        revokeSerial: (s, e, r) => { revocationSink.revokeSerial(s, e, r); authority.revoke(s, e, r); },
      },
    });
    const revoke = await console_.revokeCredentialSerial({ serial, epoch: captured[0]!.epoch, reasonCode: 'repeat_infringer' });
    expect(revoke.ok).toBe(true);

    // A DIFFERENT persona presenting the SAME (now revoked) credential is refused.
    const second = makeAccount('enforcedtwo');
    const refused = await post(srv.url, '/persona/register', { claim: second.claim }, { 'x-mk-credential': bearer });
    expect(refused.status).toBe(401);
    expect(refused.json.reason).toBe('credential_invalid');

    // AC-2 scan: no account-identifier-shaped key in any touched record.
    const scanForAccountKeys = (value: unknown): void => {
      const json = JSON.stringify(value);
      const keys = json.match(/"([^"]+)"\s*:/g) ?? [];
      for (const key of keys) expect(key).not.toMatch(/account/i);
    };
    scanForAccountKeys(evidence.list());
    scanForAccountKeys(revoke.audit);
  });
});
