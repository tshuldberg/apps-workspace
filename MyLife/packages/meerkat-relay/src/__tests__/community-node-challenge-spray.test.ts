/**
 * Audit 2026-09-01 R1: the open challenge route must not let one client mint
 * unbounded unclaimed community state on a self-host node.
 *
 *  1. The file-backed private-state store removes an unclaimed community's file
 *     once its last challenge expires or is evicted (no file left behind).
 *  2. GET /community/{id}/challenge rides the per-IP public limiter (429 past
 *     the window), and an oversized community id is refused at the edge.
 */
import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CommunityNode, InMemorySeederPieceStore } from '../index';
import { FileCommunityPrivateStateStore } from '../community-private-state-store-file';
import { startCommunityNodeHttp } from '../community-node-http';
import type { SeederHttpServer } from '../seeder-http';

function stateFiles(dir: string): string[] {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.private-state.json'));
}

function get(url: string): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'GET' }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 500 }));
    });
    req.on('error', reject);
    req.end();
  });
}

let server: SeederHttpServer | null = null;
let tmpDir: string | null = null;

afterEach(async () => {
  if (server) await server.close();
  server = null;
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = null;
});

describe('R1: unclaimed community state cannot accumulate on disk', () => {
  it('file store removes an unclaimed community file once its challenges expire, and on eviction', async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-r1-store-'));
    const store = new FileCommunityPrivateStateStore(tmpDir);
    let now = 1_000_000;
    const issue = (id: string) => store.issueChallenge({
      communityId: id, nonce: `n-${id}-${now}`, ttlMs: 1_000,
      ceilingPerCommunity: 30, maxUnclaimedCommunities: 2, nowMs: now,
    });

    // Six unknown ids: the unclaimed cap (2) evicts the oldest as each new one
    // arrives, and an evicted community owns nothing, so its file is removed.
    for (let i = 0; i < 6; i += 1) { await issue(`spray-${i}`); now += 1; }
    expect(stateFiles(tmpDir).length).toBeLessThanOrEqual(2);

    // TTL expiry + sweep: the survivors' challenges expire and their files go too.
    now += 10_000;
    await store.sweepExpired(now);
    expect(stateFiles(tmpDir)).toEqual([]);
    expect(await store.trackedCommunityCount(now)).toBe(0);

    // A community that still holds a live challenge keeps its file.
    await issue('live');
    expect(stateFiles(tmpDir)).toHaveLength(1);
    await store.sweepExpired(now);
    expect(stateFiles(tmpDir)).toHaveLength(1);
  });

  it('challenge route is per-IP rate limited and bounds the community id length', async () => {
    const node = new CommunityNode({ pieceStore: new InMemorySeederPieceStore() });
    server = await startCommunityNodeHttp({
      node, host: '127.0.0.1', publicReadLimits: { requestsPerWindow: 3, windowMs: 60_000 },
    });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      statuses.push((await get(`${server.url}/community/spray-${i}/challenge`)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);

    const tooLong = await get(`${server.url}/community/${'a'.repeat(97)}/challenge`);
    expect(tooLong.status).toBe(404);
  });
});
