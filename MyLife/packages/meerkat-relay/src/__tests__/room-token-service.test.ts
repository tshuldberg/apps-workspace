import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createRoomAdmissionRequest,
  generateDeviceIdentity,
  type DeviceIdentity,
  type RoomAdmissionRequest,
  type RoomPermission,
  type WorkspaceMemberRole,
} from '@mylife/sync';
import { LiveKitAccessTokenMinter } from '../livekit-token-minter';
import {
  FileAdmissionGenerationStore,
  InMemoryAdmissionGenerationStore,
  type AdmissionGenerationStore,
} from '../room-admission-store';
import {
  InMemoryRoomAdmissionNonceStore,
  RoomTokenService,
  deriveRoomName,
  type LiveKitTokenMintInput,
  type LiveKitTokenMinter,
  type RoomMembershipVerifier,
} from '../room-token-service';
import { runPostgresMigrations } from '../postgres/migrate';
import { PostgresStoreContext } from '../postgres/store-context';
import { PostgresAdmissionGenerationStore } from '../postgres/stores/room-admission-store';

const NOW = Date.parse('2026-07-12T12:00:00.000Z');
const SERVER_SECRET = 'ab'.repeat(32);
const COMMUNITY_ID = 'community-room-token-fixture';
const ROOM_ID = 'voice-lounge-fixture';
const CURRENT_EPOCH = 8;
const CURRENT_REVISION = 21;

class CapturingMinter implements LiveKitTokenMinter {
  readonly calls: LiveKitTokenMintInput[] = [];

  async mint(input: LiveKitTokenMintInput): Promise<string> {
    this.calls.push(structuredClone(input));
    return `test-token-${this.calls.length}`;
  }
}

function signedRequest(
  member: DeviceIdentity,
  overrides: Partial<{
    communityId: string;
    roomId: string;
    descriptorRevision: number;
    epoch: number;
    ephemeralParticipantId: string;
    requestedPermissions: readonly RoomPermission[];
    issuedAt: string;
    expiresAt: string;
    nonce: string;
  }> = {},
): RoomAdmissionRequest {
  const result = createRoomAdmissionRequest({
    member,
    communityId: overrides.communityId ?? COMMUNITY_ID,
    roomId: overrides.roomId ?? ROOM_ID,
    descriptorRevision: overrides.descriptorRevision ?? CURRENT_REVISION,
    epoch: overrides.epoch ?? CURRENT_EPOCH,
    ephemeralParticipantId: overrides.ephemeralParticipantId ?? '1'.repeat(32),
    requestedPermissions: overrides.requestedPermissions ?? ['subscribe'],
    issuedAt: overrides.issuedAt ?? new Date(NOW - 1_000).toISOString(),
    expiresAt: overrides.expiresAt ?? new Date(NOW + 59_000).toISOString(),
    nonce: overrides.nonce ?? randomUUID(),
  });
  if (!result.ok) throw new Error(`Room request fixture failed: ${result.reason}`);
  return result.request;
}

interface ServiceHarness {
  service: RoomTokenService;
  minter: CapturingMinter;
  membershipVerifier: ReturnType<typeof vi.fn<RoomMembershipVerifier>>;
}

function serviceHarness(options: {
  role?: WorkspaceMemberRole;
  membershipVerifier?: RoomMembershipVerifier;
  admissionStore?: AdmissionGenerationStore;
  minter?: CapturingMinter;
  nonceStore?: InMemoryRoomAdmissionNonceStore;
  nowMs?: () => number;
} = {}): ServiceHarness {
  const nowMs = options.nowMs ?? (() => NOW);
  const minter = options.minter ?? new CapturingMinter();
  const membershipVerifier = vi.fn<RoomMembershipVerifier>(options.membershipVerifier ?? (async () => ({
    ok: true,
    role: options.role ?? 'member',
    epoch: CURRENT_EPOCH,
    descriptorRevision: CURRENT_REVISION,
  })));
  const nonceStore = options.nonceStore ?? new InMemoryRoomAdmissionNonceStore(nowMs, 100);
  return {
    minter,
    membershipVerifier,
    service: new RoomTokenService({
      admissionStore: options.admissionStore ?? new InMemoryAdmissionGenerationStore(),
      membershipVerifier,
      hasSeenNonce: nonceStore.hasSeenNonce.bind(nonceStore),
      recordNonce: nonceStore.recordNonce.bind(nonceStore),
      livekitTokenMinter: minter,
      serverSecretHex: SERVER_SECRET,
      nowMs,
    }),
  };
}

describe('RoomTokenService role grants', () => {
  const cases: Array<{
    role: WorkspaceMemberRole;
    permissions: RoomPermission[];
    grants: LiveKitTokenMintInput['grants'];
  }> = [
    {
      role: 'owner',
      permissions: ['subscribe', 'publish_audio', 'publish_video', 'publish_screen', 'publish_data'],
      grants: {
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: ['microphone', 'camera', 'screen_share', 'screen_share_audio'],
      },
    },
    {
      role: 'admin',
      permissions: ['subscribe', 'publish_audio', 'publish_screen'],
      grants: {
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishData: false,
        canPublishSources: ['microphone', 'screen_share', 'screen_share_audio'],
      },
    },
    {
      role: 'member',
      permissions: ['subscribe', 'publish_audio', 'publish_video', 'publish_data'],
      grants: {
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: ['microphone', 'camera'],
      },
    },
    {
      role: 'viewer',
      permissions: ['subscribe'],
      grants: {
        roomJoin: true,
        canSubscribe: true,
        canPublish: false,
        canPublishData: false,
        canPublishSources: [],
      },
    },
  ];

  for (const fixture of cases) {
    it(`mints the exact least-privilege grant for ${fixture.role}`, async () => {
      const member = generateDeviceIdentity(`room-${fixture.role}`);
      const harness = serviceHarness({ role: fixture.role });
      const request = signedRequest(member, { requestedPermissions: fixture.permissions });

      const result = await harness.service.requestRoomToken(request);

      expect(result).toMatchObject({
        ok: true,
        permissions: [...fixture.permissions].sort(),
        generation: 1,
      });
      expect(harness.minter.calls).toHaveLength(1);
      expect(harness.minter.calls[0]?.grants).toEqual(fixture.grants);
    });
  }

  it('rejects viewer audio publication', async () => {
    const harness = serviceHarness({ role: 'viewer' });
    const request = signedRequest(generateDeviceIdentity('viewer-denied'), {
      requestedPermissions: ['subscribe', 'publish_audio'],
    });
    await expect(harness.service.requestRoomToken(request))
      .resolves.toEqual({ ok: false, reason: 'permissions_exceed_role' });
    expect(harness.minter.calls).toHaveLength(0);
  });

  it('rejects member screen publication', async () => {
    const harness = serviceHarness({ role: 'member' });
    const request = signedRequest(generateDeviceIdentity('member-denied'), {
      requestedPermissions: ['subscribe', 'publish_screen'],
    });
    await expect(harness.service.requestRoomToken(request))
      .resolves.toEqual({ ok: false, reason: 'permissions_exceed_role' });
    expect(harness.minter.calls).toHaveLength(0);
  });
});

describe('RoomTokenService admission verification', () => {
  it('rejects a non-member without minting', async () => {
    const harness = serviceHarness({ membershipVerifier: async () => ({ ok: false, reason: 'not_member' }) });
    await expect(harness.service.requestRoomToken(signedRequest(generateDeviceIdentity('not-member'))))
      .resolves.toEqual({ ok: false, reason: 'not_member' });
    expect(harness.minter.calls).toHaveLength(0);
  });

  it('rejects a removed member without minting', async () => {
    const harness = serviceHarness({ membershipVerifier: async () => ({ ok: false, reason: 'removed' }) });
    await expect(harness.service.requestRoomToken(signedRequest(generateDeviceIdentity('removed-member'))))
      .resolves.toEqual({ ok: false, reason: 'removed' });
    expect(harness.minter.calls).toHaveLength(0);
  });

  it('reports membership service unavailability without minting', async () => {
    const harness = serviceHarness({ membershipVerifier: async () => ({ ok: false, reason: 'unavailable' }) });
    await expect(harness.service.requestRoomToken(signedRequest(generateDeviceIdentity('membership-down'))))
      .resolves.toEqual({ ok: false, reason: 'unavailable' });
    expect(harness.minter.calls).toHaveLength(0);
  });

  it('looks up current membership before full signature verification', async () => {
    const member = generateDeviceIdentity('membership-order');
    const request = signedRequest(member);
    request.signature = `${request.signature.slice(0, -1)}${request.signature.endsWith('0') ? '1' : '0'}`;
    const harness = serviceHarness();

    await expect(harness.service.requestRoomToken(request))
      .resolves.toEqual({ ok: false, reason: 'invalid_signature' });
    expect(harness.membershipVerifier).toHaveBeenCalledWith(COMMUNITY_ID, member.publicKey);
    expect(harness.minter.calls).toHaveLength(0);
  });

  it('rejects a stale membership epoch', async () => {
    const harness = serviceHarness();
    const request = signedRequest(generateDeviceIdentity('stale-epoch'), { epoch: CURRENT_EPOCH - 1 });
    await expect(harness.service.requestRoomToken(request))
      .resolves.toEqual({ ok: false, reason: 'stale_epoch' });
  });

  it('rejects a stale descriptor revision', async () => {
    const harness = serviceHarness();
    const request = signedRequest(generateDeviceIdentity('stale-revision'), {
      descriptorRevision: CURRENT_REVISION - 1,
    });
    await expect(harness.service.requestRoomToken(request))
      .resolves.toEqual({ ok: false, reason: 'stale_descriptor_revision' });
  });

  it('rejects the second use of an identical signed nonce', async () => {
    const harness = serviceHarness();
    const request = signedRequest(generateDeviceIdentity('replay'));
    expect((await harness.service.requestRoomToken(request)).ok).toBe(true);
    await expect(harness.service.requestRoomToken(request))
      .resolves.toEqual({ ok: false, reason: 'replayed_nonce' });
    expect(harness.minter.calls).toHaveLength(1);
  });

  it('rejects an expired signed request', async () => {
    const request = signedRequest(generateDeviceIdentity('expired'), {
      issuedAt: new Date(NOW - 20_000).toISOString(),
      expiresAt: new Date(NOW - 1).toISOString(),
    });
    const harness = serviceHarness();
    await expect(harness.service.requestRoomToken(request))
      .resolves.toEqual({ ok: false, reason: 'expired' });
  });

  it('caps a valid future-issued request token at 60 seconds', async () => {
    const request = signedRequest(generateDeviceIdentity('ttl-cap'), {
      issuedAt: new Date(NOW + 20_000).toISOString(),
      expiresAt: new Date(NOW + 80_000).toISOString(),
    });
    const harness = serviceHarness();
    const result = await harness.service.requestRoomToken(request);
    expect(result).toMatchObject({ ok: true, expiresAt: new Date(NOW + 60_000).toISOString() });
    expect(harness.minter.calls[0]?.ttlSeconds).toBe(60);
  });

  it('fails closed when the admission store is unavailable', async () => {
    const store: AdmissionGenerationStore = {
      getGeneration: async () => { throw new Error('database down'); },
      bumpGeneration: async () => { throw new Error('database down'); },
    };
    const harness = serviceHarness({ admissionStore: store });
    await expect(harness.service.requestRoomToken(signedRequest(generateDeviceIdentity('store-down'))))
      .resolves.toEqual({ ok: false, reason: 'admission_store_unavailable' });
  });

  it('fails closed when the LiveKit minter is unavailable', async () => {
    const minter = new CapturingMinter();
    minter.mint = vi.fn(async () => { throw new Error('signer down'); });
    const harness = serviceHarness({ minter });
    await expect(harness.service.requestRoomToken(signedRequest(generateDeviceIdentity('minter-down'))))
      .resolves.toEqual({ ok: false, reason: 'token_mint_unavailable' });
  });

  it('fails closed instead of evicting an unexpired nonce at capacity', async () => {
    const nonceStore = new InMemoryRoomAdmissionNonceStore(() => NOW, 1);
    const harness = serviceHarness({ nonceStore });
    const first = signedRequest(generateDeviceIdentity('nonce-one'), { nonce: 'nonce-one' });
    const second = signedRequest(generateDeviceIdentity('nonce-two'), { nonce: 'nonce-two' });
    expect((await harness.service.requestRoomToken(first)).ok).toBe(true);
    await expect(harness.service.requestRoomToken(second))
      .resolves.toEqual({ ok: false, reason: 'nonce_check_failed' });
  });
});

describe('room admission generations and privacy', () => {
  it('moves new tokens to a different opaque room after durable revocation', async () => {
    const member = generateDeviceIdentity('generation-flow');
    const harness = serviceHarness({ role: 'owner' });
    const first = await harness.service.requestRoomToken(signedRequest(member, {
      nonce: 'generation-one',
      ephemeralParticipantId: '2'.repeat(32),
    }));
    const revoked = await harness.service.revokeRoomAdmissions(COMMUNITY_ID, ROOM_ID);
    const second = await harness.service.requestRoomToken(signedRequest(member, {
      nonce: 'generation-two',
      ephemeralParticipantId: '3'.repeat(32),
    }));

    expect(first).toMatchObject({ ok: true, generation: 1 });
    expect(revoked).toMatchObject({ previousGeneration: 1, generation: 2 });
    expect(second).toMatchObject({ ok: true, generation: 2 });
    if (!first.ok || !second.ok) throw new Error('generation fixture did not mint');
    expect(revoked.previousRoomName).toBe(first.roomName);
    expect(revoked.roomName).toBe(second.roomName);
    expect(second.roomName).not.toBe(first.roomName);
  });

  it('derives a stable 64-hex opaque room name for identical inputs', () => {
    const first = deriveRoomName(SERVER_SECRET, COMMUNITY_ID, ROOM_ID, 4);
    const second = deriveRoomName(SERVER_SECRET, COMMUNITY_ID, ROOM_ID, 4);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(first).not.toContain(COMMUNITY_ID);
    expect(first).not.toContain(ROOM_ID);
  });

  it('diverges when generation, room, community, or server secret changes', () => {
    const baseline = deriveRoomName(SERVER_SECRET, COMMUNITY_ID, ROOM_ID, 1);
    const variants = [
      deriveRoomName(SERVER_SECRET, COMMUNITY_ID, ROOM_ID, 2),
      deriveRoomName(SERVER_SECRET, COMMUNITY_ID, `${ROOM_ID}-other`, 1),
      deriveRoomName(SERVER_SECRET, `${COMMUNITY_ID}-other`, ROOM_ID, 1),
      deriveRoomName('cd'.repeat(32), COMMUNITY_ID, ROOM_ID, 1),
    ];
    expect(new Set([baseline, ...variants]).size).toBe(5);
  });

  it('passes no Meerkat identifiers into LiveKit identity, room, metadata, or attributes', async () => {
    const member = generateDeviceIdentity('privacy-capture');
    const ephemeralParticipantId = '4'.repeat(32);
    const harness = serviceHarness();
    const result = await harness.service.requestRoomToken(signedRequest(member, {
      ephemeralParticipantId,
      requestedPermissions: ['subscribe', 'publish_audio'],
    }));
    expect(result.ok).toBe(true);
    const input = harness.minter.calls[0];
    expect(input?.identity).toBe(ephemeralParticipantId);
    expect(Object.keys(input ?? {}).sort()).toEqual(['grants', 'identity', 'room', 'ttlSeconds']);
    const serialized = JSON.stringify(input);
    for (const privateValue of [COMMUNITY_ID, ROOM_ID, member.publicKey]) {
      expect(serialized).not.toContain(privateValue);
    }
  });
});

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

async function fileStore(): Promise<FileAdmissionGenerationStore> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-room-admission-'));
  tempDirs.push(directory);
  return new FileAdmissionGenerationStore(directory, () => NOW);
}

for (const fixture of [
  { name: 'memory', create: async (): Promise<AdmissionGenerationStore> => new InMemoryAdmissionGenerationStore() },
  { name: 'file', create: fileStore },
]) {
  describe(`${fixture.name} admission-generation store contract`, () => {
    it('returns generation 1 when absent and isolates room keys', async () => {
      const store = await fixture.create();
      expect(await store.getGeneration('community-a', 'room-a')).toBe(1);
      await store.bumpGeneration('community-a', 'room-a');
      expect(await store.getGeneration('community-a', 'room-b')).toBe(1);
      expect(await store.getGeneration('community-b', 'room-a')).toBe(1);
    });

    it('serializes concurrent bumps without losing a generation', async () => {
      const store = await fixture.create();
      const bumps = await Promise.all(
        Array.from({ length: 8 }, () => store.bumpGeneration('community-a', 'room-a')),
      );
      expect(bumps.map((entry) => entry.generation).sort((a, b) => a - b))
        .toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
      expect(await store.getGeneration('community-a', 'room-a')).toBe(9);
    });
  });
}

describe('FileAdmissionGenerationStore durability', () => {
  it('persists a committed bump across store instances', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-room-restart-'));
    tempDirs.push(directory);
    const first = new FileAdmissionGenerationStore(directory, () => NOW);
    await expect(first.bumpGeneration('community-restart', 'room-restart'))
      .resolves.toEqual({ previousGeneration: 1, generation: 2 });
    const second = new FileAdmissionGenerationStore(directory, () => NOW + 1_000);
    await expect(second.getGeneration('community-restart', 'room-restart')).resolves.toBe(2);
  });

  it('fails closed on a corrupt ledger instead of resetting generation', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'meerkat-room-corrupt-'));
    tempDirs.push(directory);
    await fs.writeFile(path.join(directory, 'room-admission-state.json'), '{not-json', 'utf8');
    const store = new FileAdmissionGenerationStore(directory, () => NOW);
    await expect(store.getGeneration('community-corrupt', 'room-corrupt'))
      .rejects.toThrow(/ledger is corrupt/);
  });
});

const connectionString = process.env.MEERKAT_TEST_POSTGRES_URL?.trim();
const destructive = process.env.MEERKAT_ALLOW_DESTRUCTIVE_POSTGRES_TESTS === 'true';
const describePostgres = connectionString && destructive ? describe.sequential : describe.skip;

describePostgres('PostgresAdmissionGenerationStore live contract', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const databaseName = `meerkat_test_rooms_${suffix}`;
  let adminPool: Pool;
  let firstPool: Pool;
  let secondPool: Pool;
  let first: PostgresAdmissionGenerationStore;
  let second: PostgresAdmissionGenerationStore;

  beforeAll(async () => {
    adminPool = new Pool({ connectionString, max: 2 });
    const current = await adminPool.query<{ name: string }>('SELECT current_database() AS name');
    if (!/^meerkat_(?:ci|test)(?:_|$)/u.test(current.rows[0]?.name ?? '')) {
      throw new Error('Room admission integration tests require a meerkat_ci or meerkat_test database');
    }
    await adminPool.query(`CREATE DATABASE "${databaseName}"`);
    const databaseUrl = new URL(connectionString!);
    databaseUrl.pathname = `/${databaseName}`;
    firstPool = new Pool({ connectionString: databaseUrl.toString(), max: 2 });
    secondPool = new Pool({ connectionString: databaseUrl.toString(), max: 2 });
    await runPostgresMigrations(firstPool);
    first = new PostgresAdmissionGenerationStore(new PostgresStoreContext(firstPool));
    second = new PostgresAdmissionGenerationStore(new PostgresStoreContext(secondPool));
  });

  afterAll(async () => {
    await firstPool?.end().catch(() => undefined);
    await secondPool?.end().catch(() => undefined);
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`).catch(() => undefined);
      await adminPool.end().catch(() => undefined);
    }
  });

  it('returns implicit generation 1 and atomically serializes two instances', async () => {
    await expect(first.getGeneration('community-pg', 'room-pg')).resolves.toBe(1);
    const bumps = await Promise.all([
      first.bumpGeneration('community-pg', 'room-pg'),
      second.bumpGeneration('community-pg', 'room-pg'),
    ]);
    expect(bumps.map((entry) => entry.generation).sort()).toEqual([2, 3]);
    await expect(first.getGeneration('community-pg', 'room-pg')).resolves.toBe(3);
  });
});

const require = createRequire(import.meta.url);
const liveKitSdkInstalled = (() => {
  try {
    require.resolve('livekit-server-sdk');
    return true;
  } catch {
    return false;
  }
})();

it.skipIf(!liveKitSdkInstalled)('real LiveKit SDK token contains only opaque identity and least-privilege grants', async () => {
  const privateCommunity = 'community-never-in-jwt';
  const privateRoom = 'room-never-in-jwt';
  const privateDevice = 'de'.repeat(32);
  const identity = '5'.repeat(32);
  const room = deriveRoomName(SERVER_SECRET, privateCommunity, privateRoom, 1);
  const minter = new LiveKitAccessTokenMinter('livekit-test-key', 'livekit-test-secret-'.repeat(3));

  const token = await minter.mint({
    identity,
    room,
    ttlSeconds: 60,
    grants: {
      roomJoin: true,
      canSubscribe: true,
      canPublish: true,
      canPublishData: false,
      canPublishSources: ['microphone'],
    },
  });
  const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, any>;

  expect(payload.sub).toBe(identity);
  expect(payload.video).toMatchObject({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: false,
    canPublishSources: ['microphone'],
    canUpdateOwnMetadata: false,
  });
  expect(payload.video).not.toHaveProperty('roomAdmin');
  expect(payload.video).not.toHaveProperty('roomCreate');
  expect(payload.name).toBeUndefined();
  expect(payload.attributes).toBeUndefined();
  expect(payload.metadata === undefined || payload.metadata === '').toBe(true);
  expect((payload.exp as number) - (payload.nbf as number)).toBeLessThanOrEqual(60);
  const serialized = JSON.stringify(payload);
  for (const privateValue of [privateCommunity, privateRoom, privateDevice]) {
    expect(serialized).not.toContain(privateValue);
  }
});
