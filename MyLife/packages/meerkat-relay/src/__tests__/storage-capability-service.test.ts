import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { Readable } from 'node:stream';
import {
  MAX_STORAGE_DESCRIPTOR_TTL_MS,
  STORAGE_CHALLENGE_PATH,
  STORAGE_DESCRIPTOR_PATH,
  verifyStorageCapabilityDescriptor,
  verifyStorageChallengeResponse,
  type StorageCapabilityDescriptor,
  type StorageChallengeResponse,
} from '@mylife/sync';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunityNode } from '../community-node';
import { startCommunityNodeHttp } from '../community-node-http';
import {
  handleHostedStorageApiRequest,
  type HostedStorageApiOptions,
} from '../hosted-storage-api';
import { InMemoryHostedStorageMetadataStore } from '../hosted-storage-metadata';
import type { SeederHttpServer } from '../seeder-http';
import {
  StorageCapabilityConfigurationError,
  StorageDescriptorService,
  handleStorageCapabilityHttpRequest,
  loadStorageOperatorKeyFromFile,
} from '../storage-capability-service';

const NOW_MS = Date.parse('2026-07-14T12:00:00.000Z');
const PRIVATE_KEY = '11'.repeat(32);
const ENDPOINT = 'https://storage.example.test/api/storage/v1';
const NONCE_A = 'a'.repeat(64);
const NONCE_B = 'b'.repeat(64);

class CapturingResponse extends EventEmitter {
  statusCode = 200;
  headersSent = false;
  private readonly headers = new Map<string, string>();
  private readonly chunks: Buffer[] = [];

  setHeader(name: string, value: string | number | readonly string[]): this {
    this.headers.set(name.toLowerCase(), Array.isArray(value) ? value.join(', ') : String(value));
    return this;
  }

  getHeader(name: string): string | undefined {
    return this.headers.get(name.toLowerCase());
  }

  writeHead(
    statusCode: number,
    headers?: Record<string, string | number | readonly string[] | undefined>,
  ): this {
    this.statusCode = statusCode;
    for (const [name, value] of Object.entries(headers ?? {})) {
      if (value !== undefined) this.setHeader(name, value);
    }
    this.headersSent = true;
    return this;
  }

  write(chunk: string | Uint8Array): boolean {
    this.chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk));
    this.headersSent = true;
    return true;
  }

  end(chunk?: string | Uint8Array): this {
    if (chunk !== undefined) this.write(chunk);
    this.headersSent = true;
    this.emit('finish');
    return this;
  }

  capture(): CapturedResponse {
    return {
      status: this.statusCode,
      headers: Object.fromEntries(this.headers),
      body: Buffer.concat(this.chunks),
    };
  }
}

interface CapturedResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

function request(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): http.IncomingMessage {
  const encoded = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  const stream = Readable.from(encoded.length === 0 ? [] : [encoded]);
  Object.assign(stream, {
    method,
    url: path,
    headers: {
      host: 'storage.example.test',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    socket: { remoteAddress: '127.0.0.1' },
  });
  return stream as http.IncomingMessage;
}

async function callCapability(
  service: StorageDescriptorService,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  log?: (event: string, detail: Record<string, unknown>) => void,
): Promise<CapturedResponse> {
  const response = new CapturingResponse();
  await handleStorageCapabilityHttpRequest(
    request(method, path, body),
    response as unknown as http.ServerResponse,
    { service, log },
  );
  return response.capture();
}

function decodeJson(response: CapturedResponse): Record<string, unknown> {
  return JSON.parse(response.body.toString('utf8')) as Record<string, unknown>;
}

function service(
  options: Partial<ConstructorParameters<typeof StorageDescriptorService>[0]> = {},
): StorageDescriptorService {
  return new StorageDescriptorService({
    endpoint: ENDPOINT,
    operatorPrivateKeyHex: PRIVATE_KEY,
    maximumObjectBytes: 4 * 1024 * 1024,
    quotaBytes: 64 * 1024 * 1024,
    retention: 'rolling-30-days',
    now: () => NOW_MS,
    ...options,
  });
}

function httpGet(url: string): Promise<CapturedResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode ?? 500,
        headers: Object.fromEntries(
          Object.entries(response.headers)
            .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
            .map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]),
        ),
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', reject);
  });
}

function isLocalhostBindDenied(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'EPERM';
}

describe('StorageDescriptorService', () => {
  it('issues a verifiable descriptor with the plan fields and bounded TTL', () => {
    const issuer = service({ descriptorTtlMs: 120_000 });
    const descriptor = issuer.descriptor();

    expect(verifyStorageCapabilityDescriptor(descriptor, {
      now: () => NOW_MS,
      expectedOperatorKey: descriptor.operatorKey,
    })).toBe(true);
    expect(descriptor).toMatchObject({
      version: 1,
      endpoint: ENDPOINT,
      authDomain: 'meerkat-storage-auth-v1',
      maximumObjectBytes: 4 * 1024 * 1024,
      quotaBytes: 64 * 1024 * 1024,
      retention: 'rolling-30-days',
    });
    expect(Date.parse(descriptor.expiresAt) - Date.parse(descriptor.issuedAt)).toBe(120_000);
  });

  it('caches descriptors, reports remaining cache life, and reissues near expiry', () => {
    let now = NOW_MS;
    const issuer = service({ descriptorTtlMs: 120_000, now: () => now });
    const first = issuer.descriptor();

    now += 60_000;
    expect(issuer.descriptor()).toEqual(first);
    expect(issuer.descriptorCacheSeconds(first)).toBe(60);

    now += 31_000;
    const reissued = issuer.descriptor();
    expect(reissued.issuedAt).not.toBe(first.issuedAt);
    expect(Date.parse(reissued.expiresAt) - Date.parse(reissued.issuedAt)).toBe(120_000);
  });

  it.each([
    ['public HTTP', 'http://storage.example.test/api/storage/v1'],
    ['wrong path', 'https://storage.example.test/api/storage/v2'],
    ['descriptor route instead of API base', `https://storage.example.test${STORAGE_DESCRIPTOR_PATH}`],
    ['query-bearing endpoint', `${ENDPOINT}?tenant=one`],
  ])('rejects %s descriptor endpoints', (_label, endpoint) => {
    expect(() => service({ endpoint })).toThrow(StorageCapabilityConfigurationError);
  });

  it('allows an explicitly configured private-network HTTP endpoint', () => {
    const issuer = service({
      endpoint: 'http://192.168.1.44/api/storage/v1',
      allowInsecureLocalNetwork: true,
    });
    const descriptor = issuer.descriptor();
    expect(verifyStorageCapabilityDescriptor(descriptor, {
      now: () => NOW_MS,
      expectedOperatorKey: descriptor.operatorKey,
      allowInsecureLocalNetwork: true,
    })).toBe(true);
  });

  it('rejects TTL overflow, invalid quotas, and duplicate operations', () => {
    expect(() => service({ descriptorTtlMs: MAX_STORAGE_DESCRIPTOR_TTL_MS + 1 }))
      .toThrow(StorageCapabilityConfigurationError);
    expect(() => service({ maximumObjectBytes: 10, quotaBytes: 9 }))
      .toThrow(StorageCapabilityConfigurationError);
    expect(() => service({ supportedOperations: ['health', 'health'] }))
      .toThrow(StorageCapabilityConfigurationError);
  });

  it('signs a nonce once during its TTL and prunes it after expiry', () => {
    let now = NOW_MS;
    const issuer = service({ descriptorTtlMs: 60_000, challengeTtlMs: 10_000, now: () => now });
    const descriptor = issuer.descriptor();
    const issued = issuer.issueChallenge(NONCE_A);

    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(verifyStorageChallengeResponse(issued.response, descriptor, NONCE_A, {
      now: () => now,
    })).toBe(true);
    expect(issuer.issueChallenge(NONCE_A)).toEqual({ ok: false, reason: 'replayed_nonce' });

    now += 10_001;
    expect(issuer.issueChallenge(NONCE_A).ok).toBe(true);
  });

  it('rejects malformed nonces and fails closed when nonce capacity is exhausted', () => {
    const issuer = service({ challengeCapacity: 1 });
    expect(issuer.issueChallenge('short')).toEqual({ ok: false, reason: 'invalid_nonce' });
    expect(issuer.issueChallenge(NONCE_A).ok).toBe(true);
    expect(issuer.issueChallenge(NONCE_B)).toEqual({ ok: false, reason: 'capacity_exceeded' });
  });
});

describe('storage capability HTTP routes', () => {
  it('serves the signed descriptor without tenant auth', async () => {
    const issuer = service();
    const response = await callCapability(issuer, 'GET', STORAGE_DESCRIPTOR_PATH);
    const descriptor = decodeJson(response);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toMatch(/^public, max-age=\d+$/u);
    expect(verifyStorageCapabilityDescriptor(descriptor, {
      now: () => NOW_MS,
      expectedOperatorKey: issuer.descriptor().operatorKey,
    })).toBe(true);
  });

  it('returns a signed challenge once and never logs nonce or key material', async () => {
    const events: Array<{ event: string; detail: Record<string, unknown> }> = [];
    const issuer = service();
    const response = await callCapability(
      issuer,
      'POST',
      STORAGE_CHALLENGE_PATH,
      { nonce: NONCE_A },
      (event, detail) => events.push({ event, detail }),
    );
    const challenge = decodeJson(response) as unknown as StorageChallengeResponse;

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(verifyStorageChallengeResponse(
      challenge,
      issuer.descriptor(),
      NONCE_A,
      { now: () => NOW_MS },
    )).toBe(true);

    const logged = JSON.stringify(events);
    expect(logged).not.toContain(NONCE_A);
    expect(logged).not.toContain(PRIVATE_KEY);
    expect(logged).not.toContain(challenge.signature);

    const replay = await callCapability(
      issuer,
      'POST',
      STORAGE_CHALLENGE_PATH,
      { nonce: NONCE_A },
    );
    expect(replay.status).toBe(409);
    expect(decodeJson(replay)).toEqual({ error: 'replayed_nonce' });
  });

  it('rejects extra challenge fields, wrong methods, and unknown paths', async () => {
    const issuer = service();
    const extra = await callCapability(
      issuer,
      'POST',
      STORAGE_CHALLENGE_PATH,
      { nonce: NONCE_A, operatorKey: 'attacker' },
    );
    expect(extra.status).toBe(400);
    expect((await callCapability(issuer, 'POST', STORAGE_DESCRIPTOR_PATH)).status).toBe(405);
    expect((await callCapability(issuer, 'GET', '/api/storage/v1/unknown')).status).toBe(404);
  });

  it('fails before issuing a challenge when the route limiter rejects it', async () => {
    const issuer = service();
    const response = new CapturingResponse();
    await handleStorageCapabilityHttpRequest(
      request('POST', STORAGE_CHALLENGE_PATH, { nonce: NONCE_A }),
      response as unknown as http.ServerResponse,
      {
        service: issuer,
        requestLimiter: { check: () => ({ allowed: false, retryAfterSeconds: 17 }) },
      },
    );
    expect(response.capture().status).toBe(429);
    expect(issuer.issueChallenge(NONCE_A).ok).toBe(true);
  });

  it('is mounted on the hosted API before tenant authorization', async () => {
    let authorizationCalls = 0;
    const issuer = service();
    const options: HostedStorageApiOptions = {
      entitlementSecret: 'unused-for-public-descriptor',
      hash: (bytes) => createHash('sha256').update(bytes).digest('hex'),
      authorize: () => {
        authorizationCalls += 1;
        return null;
      },
      resolveStore: () => null,
      provisionTenant: () => false,
      metadata: new InMemoryHostedStorageMetadataStore(),
      storageDescriptor: issuer,
    };
    const response = new CapturingResponse();
    await handleHostedStorageApiRequest(
      request('GET', STORAGE_DESCRIPTOR_PATH),
      response as unknown as http.ServerResponse,
      options,
    );

    expect(response.capture().status).toBe(200);
    expect(authorizationCalls).toBe(0);
  });
});

describe('mounted operator key', () => {
  it('loads a hex seed from a mounted file and zeroes the file buffer', async () => {
    const mounted = Buffer.from(`${PRIVATE_KEY}\n`);
    const key = await loadStorageOperatorKeyFromFile('/run/secrets/storage-key', async () => mounted);

    expect(key.operatorPrivateKeyHex).toBe(PRIVATE_KEY);
    expect(key.operatorKey).toMatch(/^[a-f0-9]{64}$/u);
    expect(mounted.every((byte) => byte === 0)).toBe(true);
  });

  it('fails closed for unreadable and malformed mounted files', async () => {
    await expect(loadStorageOperatorKeyFromFile('/missing', async () => {
      throw new Error('filesystem detail');
    })).rejects.toThrow('Storage operator key file is unreadable');
    await expect(loadStorageOperatorKeyFromFile('/bad', async () => Buffer.from('bad-key')))
      .rejects.toThrow('Storage operator key file must contain');
  });
});

describe('community node storage descriptor surface', () => {
  let server: SeederHttpServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('serves the public descriptor without community authentication', async () => {
    const issuer = service();
    try {
      server = await startCommunityNodeHttp({
        node: new CommunityNode({ now: () => NOW_MS }),
        host: '127.0.0.1',
        storageDescriptor: issuer,
      });
    } catch (error) {
      if (isLocalhostBindDenied(error)) return;
      throw error;
    }

    const response = await httpGet(`${server.url}${STORAGE_DESCRIPTOR_PATH}`);
    const descriptor = decodeJson(response) as unknown as StorageCapabilityDescriptor;
    expect(response.status).toBe(200);
    expect(verifyStorageCapabilityDescriptor(descriptor, {
      now: () => NOW_MS,
      expectedOperatorKey: issuer.descriptor().operatorKey,
    })).toBe(true);
  });
});
