/**
 * Plan 39 P6: FilePublicPostStore durability. A restart (a fresh store over the
 * same directory) must keep accepted posts served, keep tombstones honored (no
 * resurrection), keep the posting freeze in force, and keep the per-persona
 * flood window counting.
 */

import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  createPublicPost,
  createPublicPostTombstone,
  createPublicPostingFreeze,
  publicPostNodeKeypairFromSeed,
  signPublicPostAcceptance,
  type AcceptedPublicPost,
} from '@mylife/sync';
import { FilePublicPostStore } from '../public-post-store-file';

const NOW = '2026-07-06T00:00:00.000Z';
const PUB = 'pub-durable';
const persona = publicPostNodeKeypairFromSeed('88'.repeat(32));
const node = publicPostNodeKeypairFromSeed('99'.repeat(32));

function accepted(body: string): AcceptedPublicPost {
  const post = createPublicPost(persona, { publicationId: PUB, channelId: 'general', body, now: NOW });
  return { post, receipt: signPublicPostAcceptance(node, { post, hlc: { wall: NOW, counter: 0 }, acceptedAt: NOW }) };
}

async function tmpDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mk-public-posts-'));
}

describe('FilePublicPostStore durability (Plan 39 P6)', () => {
  it('posts, tombstones, freeze, and flood windows survive a restart', async () => {
    const dir = await tmpDir();
    const store = new FilePublicPostStore(dir);

    const a = accepted('post a');
    const b = accepted('post b');
    await store.putPosts(PUB, [a, b]);
    const tombstone = createPublicPostTombstone(node, { publicationId: PUB, postId: b.post.postId, now: NOW });
    await store.putTombstones(PUB, [tombstone]);
    const freeze = createPublicPostingFreeze(node, { publicationId: PUB, frozen: true, now: NOW });
    await store.putFreeze(PUB, freeze);
    await store.putSubmits(PUB, persona.publicKeyHex, [1000, 2000, 3000]);

    // "Restart": a brand new store instance over the same directory.
    const reopened = new FilePublicPostStore(dir);
    expect((await reopened.listPosts(PUB)).map((p) => p.post.postId)).toEqual([a.post.postId, b.post.postId]);
    expect((await reopened.listTombstones(PUB)).map((t) => t.postId)).toEqual([b.post.postId]);
    expect((await reopened.getFreeze(PUB))?.signature).toBe(freeze.signature);
    expect(await reopened.listSubmits(PUB, persona.publicKeyHex)).toEqual([1000, 2000, 3000]);
    // Unknown keys/publications degrade to empty, never throw.
    expect(await reopened.listPosts('unknown')).toEqual([]);
    expect(await reopened.getFreeze('unknown')).toBeNull();
    expect(await reopened.listSubmits(PUB, 'other-persona')).toEqual([]);
  });

  it('a corrupt file degrades to empty/absent, never a torn state', async () => {
    const dir = await tmpDir();
    const store = new FilePublicPostStore(dir);
    await store.putPosts(PUB, [accepted('x')]);
    // Corrupt every file for this publication.
    for (const name of await fs.readdir(dir)) {
      await fs.writeFile(path.join(dir, name), '{corrupt', 'utf8');
    }
    expect(await store.listPosts(PUB)).toEqual([]);
    expect(await store.listTombstones(PUB)).toEqual([]);
    expect(await store.getFreeze(PUB)).toBeNull();
    expect(await store.listSubmits(PUB, persona.publicKeyHex)).toEqual([]);
  });

  it('clearing a persona submit window removes the entry', async () => {
    const dir = await tmpDir();
    const store = new FilePublicPostStore(dir);
    await store.putSubmits(PUB, 'p1', [1, 2]);
    await store.putSubmits(PUB, 'p2', [3]);
    await store.putSubmits(PUB, 'p1', []);
    expect(await store.listSubmits(PUB, 'p1')).toEqual([]);
    expect(await store.listSubmits(PUB, 'p2')).toEqual([3]);
  });

  it('shares publication locks and deleted-persona markers across service processes', async () => {
    const dir = await tmpDir();
    const communityProcess = new FilePublicPostStore(dir);
    const personaProcess = new FilePublicPostStore(dir);
    const writes: string[] = [];
    await Promise.all([
      communityProcess.withPublicationWriteLock(PUB, async () => {
        writes.push('community-start');
        await new Promise((resolve) => setTimeout(resolve, 30));
        writes.push('community-end');
      }),
      personaProcess.withPublicationWriteLock(PUB, async () => {
        writes.push('persona-start');
        writes.push('persona-end');
      }),
    ]);
    expect([
      'community-start,community-end,persona-start,persona-end',
      'persona-start,persona-end,community-start,community-end',
    ]).toContain(writes.join(','));

    await personaProcess.blockPersona(persona.publicKeyHex);
    expect(await communityProcess.isPersonaBlocked(persona.publicKeyHex)).toBe(true);
  });
});
