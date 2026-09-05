import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  communityDescriptorHash,
  createCommunity,
  createManifest,
  extractSigningPrivateKeyHex,
  generateDeviceIdentity,
  signSealedTailEntry,
} from '@mylife/sync';
import {
  InMemoryCommunityPrivateStateStore,
  type CommunityPrivateStateStore,
} from '../community-private-state';
import { FileCommunityPrivateStateStore } from '../community-private-state-store-file';
import { CommunityNode } from '../community-node';
import { InMemorySeederPieceStore } from '../seeder-node';

const NOW = Date.parse('2026-07-10T16:00:00.000Z');
const TTL = 120_000;
const WINDOW = 60_000;

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true })));
});

function fixture() {
  const owner = generateDeviceIdentity('Owner');
  const member = generateDeviceIdentity('Member');
  const descriptor = createCommunity(owner, {
    name: 'Durable Private State',
    channels: [{ id: 'general', name: 'General' }],
    members: [{
      deviceId: member.publicKey,
      role: 'member',
      displayName: member.displayName,
      dhPublicKey: member.dhPublicKey,
    }],
    now: new Date(NOW).toISOString(),
  });
  return {
    owner,
    member,
    descriptor,
    communityId: descriptor.descriptor.communityId,
    descriptorHash: communityDescriptorHash(descriptor),
  };
}

function nonce(index: number): string {
  return index.toString(16).padStart(48, '0');
}

async function activate(store: CommunityPrivateStateStore, fx: ReturnType<typeof fixture>): Promise<void> {
  const publishDigest = 'ab'.repeat(32);
  const stageId = 'cd'.repeat(32);
  expect(await store.beginPublish({
    communityId: fx.communityId,
    expectedDescriptorHash: null,
    descriptor: fx.descriptor,
    descriptorHash: fx.descriptorHash,
    publishDigest,
    stageId,
    snapshots: [],
    stageTtlMs: TTL,
    nowMs: NOW,
  })).toEqual({ outcome: 'staged', stageId });
  expect(await store.commitPublish({
    communityId: fx.communityId,
    stageId,
    publishDigest,
    nowMs: NOW,
  })).toEqual({ outcome: 'committed', previousInfoHashes: [] });
}

async function issue(
  store: CommunityPrivateStateStore,
  communityId: string,
  index: number,
  nowMs = NOW,
): Promise<string> {
  const value = nonce(index);
  const challenge = await store.issueChallenge({
    communityId,
    nonce: value,
    ttlMs: TTL,
    ceilingPerCommunity: 30,
    maxUnclaimedCommunities: 100,
    nowMs,
  });
  expect(challenge?.nonce).toBe(value);
  return value;
}

function conformance(
  name: string,
  createStore: () => Promise<{ store: CommunityPrivateStateStore; cleanup?: () => Promise<void> }>,
): void {
  describe(`${name} private-state conformance`, () => {
    it('enforces one-use challenges and shared authenticated rate windows', async () => {
      const { store, cleanup } = await createStore();
      const fx = fixture();
      await activate(store, fx);

      const readNonce = await issue(store, fx.communityId, 1);
      const context = await store.inspectChallenge(fx.communityId, readNonce, NOW);
      expect(context.outcome).toBe('ready');
      const authorization = {
        communityId: fx.communityId,
        nonce: readNonce,
        expectedDescriptorHash: fx.descriptorHash,
        consume: false,
        action: 'pull' as const,
        principalHash: '11'.repeat(32),
        ceiling: 1,
        windowMs: WINDOW,
        nowMs: NOW,
      };
      expect(await store.authorizeRequest(authorization)).toBe('accepted');
      expect(await store.authorizeRequest(authorization)).toBe('rate_limited');

      const mutationNonce = await issue(store, fx.communityId, 2);
      const mutation = {
        communityId: fx.communityId,
        nonce: mutationNonce,
        expectedDescriptorHash: fx.descriptorHash,
        consume: true,
        nowMs: NOW,
      };
      expect(await store.authorizeRequest(mutation)).toBe('accepted');
      expect(await store.authorizeRequest(mutation)).toBe('bad_nonce');
      await cleanup?.();
    });

    it('deduplicates sealed-tail replay and keeps the stored list bounded', async () => {
      const { store, cleanup } = await createStore();
      const fx = fixture();
      await activate(store, fx);
      const entry = signSealedTailEntry(fx.member, {
        communityId: fx.communityId,
        channelId: 'general',
        authorDeviceId: fx.member.publicKey,
        hlcWall: new Date(NOW).toISOString(),
        hlcCounter: 0,
      }, new Uint8Array([1, 2, 3, 4]));
      const base = {
        communityId: fx.communityId,
        expectedDescriptorHash: fx.descriptorHash,
        consume: true,
        action: 'append' as const,
        principalHash: '22'.repeat(32),
        ceiling: 10,
        windowMs: WINDOW,
        nowMs: NOW,
        entry,
        replayKey: '33'.repeat(32),
        maximumEntriesPerChannel: 1,
      };
      expect(await store.appendTail({ ...base, nonce: await issue(store, fx.communityId, 3) }))
        .toEqual({ outcome: 'inserted' });
      expect(await store.appendTail({ ...base, nonce: await issue(store, fx.communityId, 4) }))
        .toEqual({ outcome: 'duplicate' });
      expect(await store.appendTail({
        ...base,
        nonce: await issue(store, fx.communityId, 5),
        replayKey: '66'.repeat(32),
      })).toEqual({ outcome: 'tail_full' });
      expect((await store.getState(fx.communityId))?.tail).toEqual([entry]);

      const snapshotBytes = new Uint8Array([7, 7, 7]);
      const manifest = createManifest({
        title: 'Compacted opaque snapshot',
        description: '',
        files: [{ path: 'sealed.bin', data: snapshotBytes, mimeType: 'application/octet-stream' }],
        access: 'encrypted',
        category: 'other',
        tags: [],
        creatorPublicKey: fx.owner.publicKey,
        creatorDisplayName: fx.owner.displayName,
        creatorPrivateKey: extractSigningPrivateKeyHex(fx.owner.privateKeyRef),
      });
      const compactStageId = '99'.repeat(32);
      const compactDigest = 'aa'.repeat(32);
      expect(await store.beginPublish({
        communityId: fx.communityId,
        expectedDescriptorHash: fx.descriptorHash,
        descriptor: fx.descriptor,
        descriptorHash: fx.descriptorHash,
        publishDigest: compactDigest,
        stageId: compactStageId,
        snapshots: [{
          channelId: 'general',
          manifest,
          record: { epoch: 1, infoHash: manifest.infoHash },
        }],
        stageTtlMs: TTL,
        nowMs: NOW,
      })).toEqual({ outcome: 'staged', stageId: compactStageId });
      const appendedAfterStage = signSealedTailEntry(fx.member, {
        communityId: fx.communityId,
        channelId: 'general',
        authorDeviceId: fx.member.publicKey,
        hlcWall: new Date(NOW + 1).toISOString(),
        hlcCounter: 1,
      }, new Uint8Array([5, 6, 7]));
      expect(await store.appendTail({
        ...base,
        nonce: await issue(store, fx.communityId, 6),
        entry: appendedAfterStage,
        replayKey: 'bb'.repeat(32),
        maximumEntriesPerChannel: 2,
      })).toEqual({ outcome: 'inserted' });
      expect((await store.commitPublish({
        communityId: fx.communityId,
        stageId: compactStageId,
        publishDigest: compactDigest,
        nowMs: NOW,
      })).outcome).toBe('committed');
      expect((await store.getState(fx.communityId))?.tail).toEqual([appendedAfterStage]);
      await cleanup?.();
    });
  });
}

conformance('memory', async () => ({ store: new InMemoryCommunityPrivateStateStore() }));

conformance('file', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'meerkat-private-state-'));
  temporaryDirectories.push(directory);
  return { store: new FileCommunityPrivateStateStore(directory) };
});

describe('file private-state restart and staged publish recovery', () => {
  it('resumes an idempotent stage after restart without exposing it before commit', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'meerkat-private-restart-'));
    temporaryDirectories.push(directory);
    const first = new FileCommunityPrivateStateStore(directory);
    const fx = fixture();
    const publishDigest = '44'.repeat(32);
    const stageId = '55'.repeat(32);
    const input = {
      communityId: fx.communityId,
      expectedDescriptorHash: null,
      descriptor: fx.descriptor,
      descriptorHash: fx.descriptorHash,
      publishDigest,
      stageId,
      snapshots: [],
      stageTtlMs: TTL,
      nowMs: NOW,
    };
    expect(await first.beginPublish(input)).toEqual({ outcome: 'staged', stageId });
    expect(await first.getState(fx.communityId)).toBeNull();

    const restarted = new FileCommunityPrivateStateStore(directory);
    expect(await restarted.beginPublish(input)).toEqual({ outcome: 'idempotent', stageId });
    expect(await restarted.commitPublish({
      communityId: fx.communityId,
      stageId,
      publishDigest,
      nowMs: NOW,
    })).toEqual({ outcome: 'committed', previousInfoHashes: [] });
    expect((await restarted.getState(fx.communityId))?.descriptorHash).toBe(fx.descriptorHash);
  });

  it('reconciles orphaned staged pieces before acknowledging stage cleanup', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'meerkat-private-reconcile-'));
    temporaryDirectories.push(directory);
    const store = new FileCommunityPrivateStateStore(directory);
    const pieces = new InMemorySeederPieceStore();
    const fx = fixture();
    const bytes = new Uint8Array([9, 8, 7, 6]);
    const manifest = createManifest({
      title: 'Opaque staged piece',
      description: '',
      files: [{ path: 'sealed.bin', data: bytes, mimeType: 'application/octet-stream' }],
      access: 'encrypted',
      category: 'other',
      tags: [],
      creatorPublicKey: fx.owner.publicKey,
      creatorDisplayName: fx.owner.displayName,
      creatorPrivateKey: extractSigningPrivateKeyHex(fx.owner.privateKeyRef),
    });
    await pieces.put(manifest.infoHash, 0, bytes);
    const stageId = '77'.repeat(32);
    await store.beginPublish({
      communityId: fx.communityId,
      expectedDescriptorHash: null,
      descriptor: fx.descriptor,
      descriptorHash: fx.descriptorHash,
      publishDigest: '88'.repeat(32),
      stageId,
      snapshots: [{
        channelId: 'general',
        manifest,
        record: { epoch: 1, infoHash: manifest.infoHash },
      }],
      stageTtlMs: 1,
      nowMs: NOW,
    });

    const node = new CommunityNode({
      pieceStore: pieces,
      privateStateStore: store,
      now: () => NOW + 2,
    });
    expect(await node.reconcilePrivatePublishStages()).toEqual({
      stagesCompleted: 1,
      contentRemoved: 1,
    });
    expect(await pieces.get(manifest.infoHash, 0)).toBeNull();
    expect(await store.listExpiredPublishStages(10, NOW + 2)).toEqual([]);
  });
});
