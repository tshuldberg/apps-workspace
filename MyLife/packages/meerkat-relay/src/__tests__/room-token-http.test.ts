import http from 'node:http';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRoomAdmissionRequest,
  generateDeviceIdentity,
  type DeviceIdentity,
  type RoomAdmissionRequest,
  type RoomPermission,
  type WorkspaceMemberRole,
} from '@mylife/sync';
import { CommunityNode } from '../community-node';
import { startCommunityNodeHttp } from '../community-node-http';
import { InMemoryAdmissionGenerationStore, type AdmissionGenerationStore } from '../room-admission-store';
import { handleRoomTokenRoute, type RoomTokenOptions } from '../room-token-http';
import type { LiveKitTokenMintInput, LiveKitTokenMinter, RoomMembershipVerifier } from '../room-token-service';
import type { SeederHttpServer } from '../seeder-http';

const NOW = Date.parse('2026-07-12T15:00:00.000Z');
const COMMUNITY_ID = 'community-http-room';
const ROOM_ID = 'room-http-voice';
const EPOCH = 4;
const REVISION = 12;
const SERVER_SECRET = 'ef'.repeat(32);
const OPERATOR_SECRET = 'operator-room-secret';

interface RawResponse {
  status: number;
  json: any;
  headers: http.IncomingHttpHeaders;
}

function rawRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: Buffer | string } = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch { json = text; }
        resolve({ status: res.statusCode ?? 500, json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

function canBindLoopback(): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = http.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(0, '127.0.0.1', () => {
      probe.close(() => resolve(true));
    });
  });
}

const loopbackAvailable = await canBindLoopback();

async function directRequest(
  options: RoomTokenOptions,
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: Buffer | string } = {},
): Promise<RawResponse> {
  const source = init.body === undefined
    ? []
    : [typeof init.body === 'string' ? Buffer.from(init.body) : init.body];
  const req = Readable.from(source) as unknown as http.IncomingMessage;
  const requestHeaders = Object.fromEntries(
    Object.entries(init.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  Object.assign(req, {
    url,
    method: init.method ?? 'GET',
    headers: requestHeaders,
  });

  let status = 500;
  let body = '';
  let responseHeaders: Record<string, string | number> = {};
  const res = {
    headersSent: false,
    writeHead(nextStatus: number, headers: Record<string, string | number> = {}) {
      status = nextStatus;
      responseHeaders = headers;
      return this;
    },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) body += chunk.toString();
      return this;
    },
  } as unknown as http.ServerResponse;

  const route = await handleRoomTokenRoute(req, res, options);
  if (route === 'unmatched') status = 404;
  let json: any = null;
  try { json = body ? JSON.parse(body) : null; } catch { json = body; }
  return { status, json, headers: responseHeaders as http.IncomingHttpHeaders };
}

class HttpCapturingMinter implements LiveKitTokenMinter {
  readonly calls: LiveKitTokenMintInput[] = [];

  async mint(input: LiveKitTokenMintInput): Promise<string> {
    this.calls.push(structuredClone(input));
    return `http-token-${this.calls.length}`;
  }
}

function makeRequest(
  member: DeviceIdentity,
  overrides: Partial<{
    nonce: string;
    ephemeralParticipantId: string;
    requestedPermissions: readonly RoomPermission[];
  }> = {},
): RoomAdmissionRequest {
  const result = createRoomAdmissionRequest({
    member,
    communityId: COMMUNITY_ID,
    roomId: ROOM_ID,
    descriptorRevision: REVISION,
    epoch: EPOCH,
    ephemeralParticipantId: overrides.ephemeralParticipantId ?? '6'.repeat(32),
    requestedPermissions: overrides.requestedPermissions ?? ['subscribe', 'publish_audio'],
    issuedAt: new Date(NOW - 1_000).toISOString(),
    expiresAt: new Date(NOW + 59_000).toISOString(),
    nonce: overrides.nonce ?? 'http-room-nonce',
  });
  if (!result.ok) throw new Error(`HTTP request fixture failed: ${result.reason}`);
  return result.request;
}

interface HttpHarness {
  member: DeviceIdentity;
  minter: HttpCapturingMinter;
  store: AdmissionGenerationStore;
  options: RoomTokenOptions;
  logs: Array<{ event: string; detail?: Record<string, unknown> }>;
}

function harness(overrides: {
  role?: WorkspaceMemberRole;
  membershipVerifier?: RoomMembershipVerifier;
  admissionStore?: AdmissionGenerationStore;
  minter?: HttpCapturingMinter;
  livekit?: RoomTokenOptions['livekit'];
  operatorSecret?: string;
} = {}): HttpHarness {
  const member = generateDeviceIdentity('room-http-member');
  const minter = overrides.minter ?? new HttpCapturingMinter();
  const store = overrides.admissionStore ?? new InMemoryAdmissionGenerationStore();
  const logs: Array<{ event: string; detail?: Record<string, unknown> }> = [];
  const membershipVerifier = overrides.membershipVerifier ?? (async () => ({
    ok: true as const,
    role: overrides.role ?? 'member',
    epoch: EPOCH,
    descriptorRevision: REVISION,
  }));
  return {
    member,
    minter,
    store,
    logs,
    options: {
      admissionStore: store,
      membershipVerifier,
      livekit: overrides.livekit ?? {
        apiKey: 'livekit-http-key',
        apiSecret: 'livekit-http-secret',
        serverSecretHex: SERVER_SECRET,
      },
      livekitTokenMinter: minter,
      operatorSecret: overrides.operatorSecret === undefined
        ? OPERATOR_SECRET
        : overrides.operatorSecret,
      nowMs: () => NOW,
      log: (event, detail) => logs.push({ event, detail }),
    },
  };
}

let server: SeederHttpServer | null = null;
afterEach(async () => {
  if (server) await server.close();
  server = null;
});

async function start(roomToken?: RoomTokenOptions): Promise<SeederHttpServer> {
  server = await startCommunityNodeHttp({
    node: new CommunityNode({ now: () => NOW }),
    host: '127.0.0.1',
    ...(roomToken ? { roomToken } : {}),
  });
  return server;
}

function postToken(options: RoomTokenOptions, request: unknown): Promise<RawResponse> {
  return directRequest(options, '/api/rooms/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}

describe('POST /api/rooms/token', () => {
  it.skipIf(!loopbackAvailable)('falls through to 404 when the optional mount is absent', async () => {
    const listener = await start();
    const response = await rawRequest(`${listener.url}/api/rooms/token`, {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(404);
  });

  it('returns 503 not_configured when any required LiveKit config is absent', async () => {
    const h = harness({ livekit: { apiKey: 'key', apiSecret: '', serverSecretHex: SERVER_SECRET } });
    const response = await postToken(h.options, makeRequest(h.member));
    expect(response.status).toBe(503);
    expect(response.json).toEqual({ error: 'not_configured' });
    expect(h.minter.calls).toHaveLength(0);
  });

  it('mints a token through the room-token route handler', async () => {
    const h = harness();
    const request = makeRequest(h.member, {
      requestedPermissions: ['subscribe', 'publish_audio', 'publish_data'],
    });
    const response = await postToken(h.options, request);

    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({
      token: 'http-token-1',
      expiresAt: new Date(NOW + 59_000).toISOString(),
      permissions: ['publish_audio', 'publish_data', 'subscribe'],
    });
    expect(response.json.roomName).toMatch(/^[0-9a-f]{64}$/u);
    expect(h.minter.calls[0]).toMatchObject({
      identity: request.ephemeralParticipantId,
      room: response.json.roomName,
      ttlSeconds: 59,
      grants: {
        roomJoin: true,
        canSubscribe: true,
        canPublish: true,
        canPublishData: true,
        canPublishSources: ['microphone'],
      },
    });
    const serializedLogs = JSON.stringify(h.logs);
    expect(serializedLogs).not.toContain(COMMUNITY_ID);
    expect(serializedLogs).not.toContain(ROOM_ID);
    expect(serializedLogs).not.toContain(h.member.publicKey);
    expect(serializedLogs).not.toContain('http-token-1');
  });

  it.skipIf(!loopbackAvailable)('mints a token over the mounted community-node listener', async () => {
    const h = harness();
    const listener = await start(h.options);
    const response = await rawRequest(`${listener.url}/api/rooms/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeRequest(h.member)),
    });
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ token: 'http-token-1' });
  });

  for (const membership of [
    { reason: 'not_member' as const, status: 403 },
    { reason: 'removed' as const, status: 403 },
    { reason: 'unavailable' as const, status: 503 },
  ]) {
    it(`returns ${membership.status} for ${membership.reason}`, async () => {
      const h = harness({
        membershipVerifier: async () => ({ ok: false, reason: membership.reason }),
      });
      const response = await postToken(h.options, makeRequest(h.member));
      expect(response.status).toBe(membership.status);
      expect(response.json).toEqual({ error: 'admission_rejected', reason: membership.reason });
      expect(h.minter.calls).toHaveLength(0);
    });
  }

  it('returns 409 for a replayed signed nonce', async () => {
    const h = harness();
    const request = makeRequest(h.member);
    expect((await postToken(h.options, request)).status).toBe(200);
    const replay = await postToken(h.options, request);
    expect(replay.status).toBe(409);
    expect(replay.json).toEqual({ error: 'admission_rejected', reason: 'replayed_nonce' });
    expect(h.minter.calls).toHaveLength(1);
  });

  it('returns 413 and never calls membership or minting for an oversized body', async () => {
    const verifier = vi.fn<RoomMembershipVerifier>(async () => ({
      ok: false,
      reason: 'not_member',
    }));
    const h = harness({ membershipVerifier: verifier });
    const response = await directRequest(h.options, '/api/rooms/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: Buffer.alloc(16 * 1024 + 1, 0x61),
    });
    expect(response.status).toBe(413);
    expect(response.json).toEqual({ error: 'too_large' });
    expect(verifier).not.toHaveBeenCalled();
    expect(h.minter.calls).toHaveLength(0);
  });

  it('returns 400 for malformed JSON', async () => {
    const h = harness();
    const response = await directRequest(h.options, '/api/rooms/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad-json',
    });
    expect(response.status).toBe(400);
    expect(response.json).toEqual({ error: 'bad_request' });
  });

  it('returns 405 for the wrong method', async () => {
    const h = harness();
    const response = await directRequest(h.options, '/api/rooms/token', { method: 'GET' });
    expect(response.status).toBe(405);
    expect(response.json).toEqual({ error: 'method_not_allowed' });
  });

  it('returns honest 503 when the LiveKit minter throws', async () => {
    const minter = new HttpCapturingMinter();
    minter.mint = vi.fn(async () => { throw new Error('LiveKit unavailable'); });
    const h = harness({ minter });
    const response = await postToken(h.options, makeRequest(h.member));
    expect(response.status).toBe(503);
    expect(response.json).toEqual({
      error: 'admission_rejected',
      reason: 'token_mint_unavailable',
    });
  });
});

describe('POST /api/rooms/:communityId/:roomId/revoke', () => {
  it('returns 503 when the operator secret is missing', async () => {
    const h = harness({ operatorSecret: '' });
    const response = await directRequest(h.options, `/api/rooms/${COMMUNITY_ID}/${ROOM_ID}/revoke`, {
      method: 'POST',
    });
    expect(response.status).toBe(503);
    expect(response.json).toEqual({ error: 'not_configured' });
  });

  for (const authorization of [undefined, 'Bearer wrong-secret']) {
    it(`returns 401 for ${authorization ? 'wrong' : 'missing'} operator bearer`, async () => {
      const h = harness();
      const response = await directRequest(h.options, `/api/rooms/${COMMUNITY_ID}/${ROOM_ID}/revoke`, {
        method: 'POST',
        ...(authorization ? { headers: { Authorization: authorization } } : {}),
      });
      expect(response.status).toBe(401);
      expect(response.json).toEqual({ error: 'unauthorized' });
      expect(await h.store.getGeneration(COMMUNITY_ID, ROOM_ID)).toBe(1);
    });
  }

  it('durably bumps admission generation before returning both opaque room names', async () => {
    const h = harness();
    const response = await directRequest(h.options, `/api/rooms/${COMMUNITY_ID}/${ROOM_ID}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPERATOR_SECRET}` },
    });
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ previousGeneration: 1, generation: 2 });
    expect(response.json.previousRoomName).toMatch(/^[0-9a-f]{64}$/u);
    expect(response.json.roomName).toMatch(/^[0-9a-f]{64}$/u);
    expect(response.json.roomName).not.toBe(response.json.previousRoomName);
    expect(await h.store.getGeneration(COMMUNITY_ID, ROOM_ID)).toBe(2);
  });

  it('returns 503 without success when the durable bump fails', async () => {
    const failingStore: AdmissionGenerationStore = {
      getGeneration: () => 1,
      bumpGeneration: async () => { throw new Error('store unavailable'); },
    };
    const h = harness({ admissionStore: failingStore });
    const response = await directRequest(h.options, `/api/rooms/${COMMUNITY_ID}/${ROOM_ID}/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPERATOR_SECRET}` },
    });
    expect(response.status).toBe(503);
    expect(response.json).toEqual({
      error: 'admission_store_unavailable',
      reason: 'admission_store_unavailable',
    });
  });
});
