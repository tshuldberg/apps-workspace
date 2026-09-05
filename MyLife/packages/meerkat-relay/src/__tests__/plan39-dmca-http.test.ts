/**
 * Plan 39 P13: the PUBLIC DMCA intake HTTP boundary on the community node. Real node:http
 * server. Covers: 404 when intake is not wired, the agent info route, a valid notice persists
 * (200 + claimId), a malformed notice is rejected 400 (zod, fail closed), an oversized body 413,
 * and the surfaced record is retrievable via the injected service.
 */

import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import {
  CommunityNode,
  DmcaIntakeService,
  InMemoryDmcaIntakeStore,
  startCommunityNodeHttp,
  DMCA_REGISTERED_AGENT,
} from '../index';
import type { SeederHttpServer } from '../seeder-http';

interface RawResponse { status: number; json: () => unknown }
function req(url: string, init: { method?: string; body?: string } = {}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const r = http.request(url, { method: init.method ?? 'GET', headers: { 'Content-Type': 'application/json' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode ?? 500, json: () => (text ? JSON.parse(text) : null) });
      });
    });
    r.on('error', reject);
    if (init.body) r.write(init.body);
    r.end();
  });
}

const servers: SeederHttpServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => s.close())); });

async function start(withIntake: boolean): Promise<{ url: string; dmca: DmcaIntakeService }> {
  const dmca = new DmcaIntakeService(new InMemoryDmcaIntakeStore());
  const server = await startCommunityNodeHttp({
    node: new CommunityNode(),
    port: 0,
    ...(withIntake ? { dmcaIntake: dmca } : {}),
  });
  servers.push(server);
  return { url: server.url, dmca };
}

const validClaim = {
  workDescription: 'My song',
  claimedPostIds: ['post-123'],
  claimedUrls: [],
  claimant: { name: 'Alex', email: 'alex@example.com', address: '1 Road' },
  goodFaithStatement: true,
  accuracyStatement: true,
  signature: 'Alex',
};

describe('DMCA intake HTTP route', () => {
  it('404s when DMCA intake is not wired (honestly off)', async () => {
    const { url } = await start(false);
    expect((await req(`${url}/public/dmca/notice`, { method: 'POST', body: JSON.stringify(validClaim) })).status).toBe(404);
    expect((await req(`${url}/public/dmca/agent`)).status).toBe(404);
  });

  it('serves the founder-filled registered-agent block', async () => {
    const { url } = await start(true);
    const res = await req(`${url}/public/dmca/agent`);
    expect(res.status).toBe(200);
    expect((res.json() as { agent: typeof DMCA_REGISTERED_AGENT }).agent.configured).toBe(false);
  });

  it('persists a valid notice and returns a claimId', async () => {
    const { url, dmca } = await start(true);
    const res = await req(`${url}/public/dmca/notice`, { method: 'POST', body: JSON.stringify(validClaim) });
    expect(res.status).toBe(200);
    const body = res.json() as { ok: boolean; claimId: string };
    expect(body.ok).toBe(true);
    expect(await dmca.getClaim(body.claimId)).not.toBeNull();
  });

  it('rejects a malformed notice 400 (missing perjury attestation, fail closed)', async () => {
    const { url } = await start(true);
    const res = await req(`${url}/public/dmca/notice`, { method: 'POST', body: JSON.stringify({ ...validClaim, accuracyStatement: false }) });
    expect(res.status).toBe(400);
  });

  it('rejects an oversized body 413', async () => {
    const { url } = await start(true);
    const huge = { ...validClaim, workDescription: 'x'.repeat(20 * 1024) };
    const res = await req(`${url}/public/dmca/notice`, { method: 'POST', body: JSON.stringify(huge) });
    expect(res.status).toBe(413);
  });
});
