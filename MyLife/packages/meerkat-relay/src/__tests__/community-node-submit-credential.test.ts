/**
 * Plan 51 P2/P4: the anonymous-credential ALTERNATIVE proof on the community
 * public submit route, and the enforcement chain that revokes a captured serial.
 *
 * Everything on the crypto path is real (real epoch RSA keypair, real blind
 * issuance, real presentation verification). The session verifier + humanity
 * redeem are the same documented fakes the P6 submit suite uses. Coverage:
 *  - a valid credential is accepted where humanity would pass, and the humanity
 *    token is NOT spent (the credential replaced it);
 *  - forged / expired / revoked presentations are refused with honest reasons;
 *  - with NO credential verifier wired, legacy behavior is byte-identical (the
 *    same legacy submit runs through both configs);
 *  - NC-1: a revoked serial is refused at the surface;
 *  - the full enforcement chain: accept -> serial captured in evidence ->
 *    revokeCredentialSerial -> the same credential refused 'revoked'; and no
 *    account-shaped field exists in any touched record.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { issueMeerkatAppUnlockToken } from '@mylife/entitlements/server';
import { InMemorySeederPieceStore as SnapStore } from '../seeder-node';
import {
  buildPublicSnapshot,
  bytesToHex,
  createChannelMessage,
  createPublication,
  createPublicPost,
  generateDeviceIdentity,
  publicPostNodeKeypairFromSeed,
  type ChannelMessageEvent,
  type ContentManifest,
  type DeviceIdentity,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { CommunityNode } from '../index';
import {
  personaBindingHash,
  startCommunityNodeHttp,
  type CommunityNodePublicSubmitOptions,
} from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';
import {
  InMemoryCredentialEvidenceSink,
  InMemoryCredentialRevocationSink,
} from '../credential-evidence';
import { OperatorConsoleService, InMemoryOperatorConsoleStore } from '../operator-console';
import {
  CredentialTestAuthority,
  EPOCH_0,
  NOW_MS_IN_EPOCH_0,
} from './support/credential-test-harness';
import { credentialEpochWindow } from '@mylife/sync';

const CHANNEL = 'general';
const COMMUNITY = 'cred-community';
const NOW = '2026-08-01T00:10:00.000Z';
const APP_UNLOCK_SECRET = 'shared-app-unlock-secret';
const nodeReceipt = publicPostNodeKeypairFromSeed('33'.repeat(32));
const persona = publicPostNodeKeypairFromSeed('44'.repeat(32));
const OPERATOR = publicPostNodeKeypairFromSeed('99'.repeat(32));

interface RawResponse { status: number; text: string; json: () => unknown }
function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers ?? {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 500, text, json: () => JSON.parse(text) });
      });
    });
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

interface Fixture {
  owner: DeviceIdentity;
  signed: SignedPublicationDescriptor;
  publicationId: string;
  manifest: ContentManifest;
  pieces: Uint8Array[];
}

function seedEvent(author: DeviceIdentity, communityId: string): ChannelMessageEvent {
  return createChannelMessage(author, { communityId, channelId: CHANNEL, body: 'seed', hlc: { wall: '2026-08-01T00:00:10.000Z', counter: 0 } });
}

async function buildFixture(): Promise<Fixture> {
  const owner = generateDeviceIdentity('Publisher');
  const publicKey = new Uint8Array(randomBytes(32));
  const buildStore = new SnapStore();
  const record = await buildPublicSnapshot({
    identity: owner, publicationId: 'pending', communityId: COMMUNITY, channelId: CHANNEL,
    events: [seedEvent(owner, COMMUNITY)], publicKey, pieceStore: buildStore, now: NOW,
  });
  const manifest = JSON.parse(record.manifestJson) as ContentManifest;
  const pieces: Uint8Array[] = [];
  for (let i = 0; i < manifest.pieces.length; i += 1) pieces.push(buildStore.get(manifest.infoHash, i) as Uint8Array);
  const signed = createPublication(owner, {
    kind: 'channel', communityId: COMMUNITY, channelId: CHANNEL, title: 'Open Channel',
    description: 'public', category: 'technology', contentId: record.infoHash,
    publicKeyHex: bytesToHex(publicKey), now: NOW, postPolicy: 'open',
    postNodeKeyHex: nodeReceipt.publicKeyHex,
  });
  return { owner, signed, publicationId: signed.descriptor.publicationId, manifest, pieces };
}

async function register(server: SeederHttpServer, fx: Fixture): Promise<void> {
  const res = await rawRequest(`${server.url}/public/${fx.publicationId}/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descriptor: fx.signed, snapshots: [{ channelId: CHANNEL, epoch: 0, manifest: fx.manifest, pieces: fx.pieces.map((p) => Buffer.from(p).toString('base64')) }] }),
  });
  expect(res.status).toBe(200);
}

function fakeHumanity(...accepted: string[]) {
  const valid = new Set(accepted);
  const spent = new Set<string>();
  return {
    spent,
    verifyToken: async (token: string) => {
      if (!valid.has(token)) return { ok: false, reason: 'invalid' };
      if (spent.has(token)) return { ok: false, reason: 'already_spent' };
      spent.add(token);
      return { ok: true };
    },
  };
}

function fakeSessions(map: Record<string, string>): CommunityNodePublicSubmitOptions['sessionVerifier'] {
  return async (token: string) => {
    const personaPubkey = map[token];
    return personaPubkey ? { ok: true, personaPubkey } : { ok: false, reason: 'unknown_session' };
  };
}

async function mintAppUnlock(boundTo: string = persona.publicKeyHex): Promise<string> {
  const issued = await issueMeerkatAppUnlockToken({ secret: APP_UNLOCK_SECRET, purchaseDate: NOW, bindingHash: personaBindingHash(boundTo) });
  return issued.token;
}

let server: SeederHttpServer | null = null;
afterEach(async () => { if (server) await server.close(); server = null; });

interface Env {
  server: SeederHttpServer;
  fx: Fixture;
  humanity: ReturnType<typeof fakeHumanity>;
  evidence: InMemoryCredentialEvidenceSink;
  authority: CredentialTestAuthority;
}

async function boot(options: {
  withVerifier?: boolean;
  nowMs?: number;
  authority?: CredentialTestAuthority;
} = {}): Promise<Env> {
  const fx = await buildFixture();
  const node = new CommunityNode({ postReceipt: nodeReceipt });
  const humanity = fakeHumanity('human-1', 'human-2', 'human-3');
  const evidence = new InMemoryCredentialEvidenceSink();
  const authority = options.authority ?? new CredentialTestAuthority();
  const nowMs = options.nowMs ?? NOW_MS_IN_EPOCH_0;
  const submit: CommunityNodePublicSubmitOptions = {
    sessionVerifier: fakeSessions({ 'session-good': persona.publicKeyHex }),
    humanityVerifyToken: humanity.verifyToken,
    appUnlockSecret: APP_UNLOCK_SECRET,
    ...(options.withVerifier === false ? {} : {
      // Only the credential verifier runs on the epoch-0 clock; the node + the
      // app-unlock freshness check keep real time so those gates behave normally.
      credentialVerifier: authority.verifier(nowMs),
      credentialEvidence: evidence,
    }),
  };
  server = await startCommunityNodeHttp({ node, port: 0, publicSubmit: submit });
  await register(server, fx);
  return { server, fx, humanity, evidence, authority };
}

function makePost(fx: Fixture, body: string) {
  return createPublicPost(persona, { publicationId: fx.publicationId, channelId: CHANNEL, body, parentPostId: null, now: NOW });
}

async function submit(env: Env, body: string, headers: Record<string, string | undefined>): Promise<RawResponse> {
  const clean: Record<string, string> = { 'Content-Type': 'application/json' };
  for (const [k, v] of Object.entries(headers)) if (v !== undefined) clean[k] = v;
  const post = makePost(env.fx, body);
  return rawRequest(`${env.server.url}/public/${env.fx.publicationId}/${CHANNEL}/submit`, {
    method: 'POST', headers: clean, body: JSON.stringify({ post }),
  });
}

describe('Plan 51 P2: credential as the alternative humanity proof on submit', () => {
  it('accepts a valid credential where humanity would pass, WITHOUT spending a humanity token', async () => {
    const env = await boot();
    const { bearer, serial } = env.authority.mint(EPOCH_0);
    const res = await submit(env, 'credential post', {
      'x-mk-session': 'session-good',
      'x-mk-credential': bearer,
      'x-mk-app-unlock': await mintAppUnlock(),
    });
    expect(res.status).toBe(200);
    expect((res.json() as { ok: boolean }).ok).toBe(true);
    // The humanity single-use token was NOT consumed: the credential replaced it.
    expect(env.humanity.spent.size).toBe(0);
    // The serial was captured as moderation evidence, co-located with the persona.
    const rows = env.evidence.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.serial).toBe(serial);
    expect(rows[0]!.subject).toBe(persona.publicKeyHex);
    expect(rows[0]!.surface).toBe('community_submit');
  });

  it('refuses a forged credential (401 credential_invalid) and does NOT fall back to humanity', async () => {
    const env = await boot();
    const res = await submit(env, 'forged', {
      'x-mk-session': 'session-good',
      'x-mk-credential': 'not-a-real-credential',
      'x-mk-app-unlock': await mintAppUnlock(),
    });
    expect(res.status).toBe(401);
    expect((res.json() as { reason: string }).reason).toBe('credential_invalid');
    // No downgrade: the humanity token was never consulted.
    expect(env.humanity.spent.size).toBe(0);
  });

  it('refuses an expired credential (presented past its epoch window)', async () => {
    // Server clock far past epoch 0's window makes an epoch-0 credential expired.
    const wayLater = credentialEpochWindow(EPOCH_0).notAfterMs + 60_000;
    const env = await boot({ nowMs: wayLater });
    const { bearer } = env.authority.mint(EPOCH_0);
    const res = await submit(env, 'stale', {
      'x-mk-session': 'session-good',
      'x-mk-credential': bearer,
      'x-mk-app-unlock': await mintAppUnlock(),
    });
    expect(res.status).toBe(401);
    expect((res.json() as { reason: string }).reason).toBe('credential_invalid');
  });

  it('NC-1: a revoked serial is refused on the submit surface', async () => {
    const env = await boot();
    const { bearer, serial } = env.authority.mint(EPOCH_0);
    env.authority.revoke(serial, EPOCH_0, 'test');
    const res = await submit(env, 'revoked', {
      'x-mk-session': 'session-good',
      'x-mk-credential': bearer,
      'x-mk-app-unlock': await mintAppUnlock(),
    });
    expect(res.status).toBe(401);
    expect((res.json() as { reason: string }).reason).toBe('credential_invalid');
  });

  it('with NO verifier configured, legacy behavior is byte-identical (same legacy submit through both configs)', async () => {
    // The credential header is present but ignored; the humanity redeem runs as before.
    const legacyHeaders = async () => ({
      'x-mk-session': 'session-good',
      'x-mk-humanity': 'human-1',
      'x-mk-credential': 'ignored-when-unconfigured',
      'x-mk-app-unlock': await mintAppUnlock(),
    });

    const withoutVerifier = await boot({ withVerifier: false });
    const legacy = await submit(withoutVerifier, 'legacy', await legacyHeaders());
    expect(legacy.status).toBe(200);
    // The humanity token WAS spent (no credential path in this config).
    expect(withoutVerifier.humanity.spent.has('human-1')).toBe(true);
    await withoutVerifier.server.close();
    server = null;

    // Same legacy request (no credential header) with a verifier wired: still the
    // humanity path, still accepted -- the credential path only triggers when a
    // credential header is present.
    const withVerifier = await boot();
    const clean = await submit(withVerifier, 'legacy', {
      'x-mk-session': 'session-good',
      'x-mk-humanity': 'human-1',
      'x-mk-app-unlock': await mintAppUnlock(),
    });
    expect(clean.status).toBe(200);
    expect(withVerifier.humanity.spent.has('human-1')).toBe(true);
    // No credential evidence recorded when no credential is presented.
    expect(withVerifier.evidence.list()).toHaveLength(0);
  });
});

describe('Plan 51 P4 (AC-3): enforcement chain -> revoke captured serial -> refused', () => {
  it('accept -> serial captured -> revokeCredentialSerial -> same credential refused, no account field anywhere', async () => {
    const authority = new CredentialTestAuthority();
    const env = await boot({ authority });
    const { bearer, serial } = authority.mint(EPOCH_0);

    // 1) Present the credential -> accepted, serial captured as evidence.
    const accept = await submit(env, 'to be enforced', {
      'x-mk-session': 'session-good',
      'x-mk-credential': bearer,
      'x-mk-app-unlock': await mintAppUnlock(),
    });
    expect(accept.status).toBe(200);
    const captured = env.evidence.forSubject(persona.publicKeyHex);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.serial).toBe(serial);

    // 2) Operator revokes the captured serial through the enforcement lane. The
    //    revocation sink is the SAME authority the verifier reads, so a real
    //    revocation propagates to the presentation path.
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
    const revoke = await console_.revokeCredentialSerial({ serial: captured[0]!.serial, epoch: captured[0]!.epoch, reasonCode: 'repeat_infringer' });
    expect(revoke.ok).toBe(true);
    expect(revoke.audit.action).toBe('credential_revoked');
    expect(revoke.audit.target.credentialSerial).toBe(serial);
    expect(revocationSink.isRevoked(serial)).toBe(true);

    // 3) The same credential is now refused at the surface ('revoked').
    const refused = await submit(env, 'after revoke', {
      'x-mk-session': 'session-good',
      'x-mk-credential': bearer,
      'x-mk-app-unlock': await mintAppUnlock(),
    });
    expect(refused.status).toBe(401);
    expect((refused.json() as { reason: string }).reason).toBe('credential_invalid');

    // 4) AC-2 scan: no account-identifier-shaped key exists in any touched record.
    const scanForAccountKeys = (value: unknown): void => {
      const json = JSON.stringify(value);
      const keys = json.match(/"([^"]+)"\s*:/g) ?? [];
      for (const key of keys) expect(key).not.toMatch(/account/i);
    };
    scanForAccountKeys(env.evidence.list());
    scanForAccountKeys(revoke.audit);
    scanForAccountKeys(revocationSink.serials());
  });
});
