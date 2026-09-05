/**
 * Plan 51 P4 (AC-3): the operator console revoke-credential route + service lane.
 *
 * Real operator console HTTP surface over the DI'd service. Coverage:
 *  - admin auth is required (missing/wrong bearer -> 401);
 *  - a successful revoke writes an append-only audit row carrying credential-serial
 *    evidence ONLY (never any account field) and reaches the injected sink;
 *  - an UNCONFIGURED console (null service / no secret) answers 503;
 *  - a service with NO revocation sink refuses honestly (503) rather than faking.
 */

import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { publicPostNodeKeypairFromSeed } from '@mylife/sync';
import {
  InMemoryOperatorConsoleStore,
  OperatorConsoleService,
  InMemoryCredentialRevocationSink,
} from '../index';
import { startOperatorConsoleHttp, type OperatorConsoleServer } from '../operator-console-http';

const SECRET = 'operator-console-secret-for-tests';
const operator = publicPostNodeKeypairFromSeed('55'.repeat(32));
const SERIAL = 'a'.repeat(64);

interface RawResponse { status: number; text: string; json: () => unknown }
function rawRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: { Connection: 'close', ...(init.headers ?? {}) } }, (res) => {
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

let server: OperatorConsoleServer | null = null;
afterEach(async () => { if (server) await server.close(); server = null; });

function makeService(options: { withSink?: boolean } = {}): { service: OperatorConsoleService; sink: InMemoryCredentialRevocationSink } {
  const sink = new InMemoryCredentialRevocationSink();
  let clock = Date.parse('2026-07-20T00:00:00.000Z');
  const service = new OperatorConsoleService({
    node: {
      recordPublicPostTombstone: async () => ({ ok: true }),
      recordPostingFreeze: async () => ({ ok: true }),
      recordPublicationKill: async () => true,
    },
    publications: { get: async () => null, list: async () => [] },
    reports: { get: async () => [] },
    posts: { listPosts: async () => [], listTombstones: async () => [], getFreeze: async () => null },
    store: new InMemoryOperatorConsoleStore(),
    operator: { publicKeyHex: operator.publicKeyHex, privateKeyHex: operator.privateKeyHex },
    ...(options.withSink === false ? {} : { credentialRevocation: sink }),
    now: () => { clock += 1000; return clock; },
  });
  return { service, sink };
}

async function boot(options: { nullConsole?: boolean; consoleSecret?: string; withSink?: boolean } = {}): Promise<{ server: OperatorConsoleServer; sink: InMemoryCredentialRevocationSink }> {
  const { service, sink } = makeService({ withSink: options.withSink });
  server = await startOperatorConsoleHttp({
    console: options.nullConsole ? null : service,
    consoleSecret: options.consoleSecret ?? SECRET,
    port: 0,
    authFailureLimit: { max: 1000, windowMs: 60_000 },
  });
  return { server, sink };
}

const REVOKE = '/api/actions/revoke-credential';
function body() { return JSON.stringify({ serial: SERIAL, epoch: 0, reason: 'repeat_infringer' }); }

describe('Plan 51 P4: POST /api/actions/revoke-credential', () => {
  it('requires admin auth (missing + wrong bearer -> 401)', async () => {
    const { server: srv } = await boot();
    const bare = await rawRequest(`${srv.url}${REVOKE}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body() });
    expect(bare.status).toBe(401);
    const wrong = await rawRequest(`${srv.url}${REVOKE}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer nope' }, body: body() });
    expect(wrong.status).toBe(401);
  });

  it('revokes a serial: 200, append-only audit row with serial evidence ONLY, sink updated', async () => {
    const { server: srv, sink } = await boot();
    const res = await rawRequest(`${srv.url}${REVOKE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: body(),
    });
    expect(res.status).toBe(200);
    const json = res.json() as { ok: boolean; audit: { action: string; target: Record<string, unknown>; outcome: string } };
    expect(json.ok).toBe(true);
    expect(json.audit.action).toBe('credential_revoked');
    expect(json.audit.outcome).toBe('ok');
    expect(json.audit.target.credentialSerial).toBe(SERIAL);
    expect(json.audit.target.credentialEpoch).toBe(0);
    // No account-shaped field in the audit target (AC-2).
    for (const key of Object.keys(json.audit.target)) expect(key).not.toMatch(/account/i);
    expect(sink.isRevoked(SERIAL)).toBe(true);
  });

  it('rejects a malformed serial (400 bad_request)', async () => {
    const { server: srv } = await boot();
    const res = await rawRequest(`${srv.url}${REVOKE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: JSON.stringify({ serial: 'too-short', epoch: 0, reason: 'r' }),
    });
    expect(res.status).toBe(400);
    expect((res.json() as { reason: string }).reason).toBe('bad_request');
  });

  it('an UNCONFIGURED console (null service) answers 503', async () => {
    const { server: srv } = await boot({ nullConsole: true });
    const res = await rawRequest(`${srv.url}${REVOKE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: body(),
    });
    expect(res.status).toBe(503);
    expect((res.json() as { reason: string }).reason).toBe('console_not_configured');
  });

  it('a console with NO revocation sink refuses honestly (503), never faked', async () => {
    const { server: srv } = await boot({ withSink: false });
    const res = await rawRequest(`${srv.url}${REVOKE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` },
      body: body(),
    });
    expect(res.status).toBe(503);
    const json = res.json() as { ok: boolean; reason: string };
    expect(json.ok).toBe(false);
    expect(json.reason).toBe('credential_revocation_not_configured');
  });
});
