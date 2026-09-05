import { createArchiveJob } from '../../protocol/public-archive';
import { createPublication } from '../../protocol/publication';
import { generateDeviceIdentity, verifySignature } from '../../identity/device-identity';
import { hexToBytes } from '../../encryption/keys';
import { sha256Hex } from '../../encryption/sha256';
import { ManagedArchiveClient, ManagedArchiveHttpError } from '../managed-archive-client';
import { describe, expect, it, vi } from 'vitest';

const NOW = '2026-07-15T12:00:00.000Z';

function fixture() {
  const identity = generateDeviceIdentity('Archive client owner');
  const publication = createPublication(identity, {
    kind: 'channel', communityId: 'community', channelId: 'channel', postId: null,
    title: 'Archive', description: 'Archive fixture', category: 'technology',
    contentId: 'content-1', publicKeyHex: 'aa', hostUrls: ['https://host.example'],
    joinPolicy: 'open', now: NOW,
  });
  const objects = [new Uint8Array([1, 2]), new Uint8Array([3])];
  return {
    identity,
    objects,
    signedJob: createArchiveJob(identity, publication, {
      tier: 'managed', hostUrl: 'https://host.example',
      objects: objects.map((bytes, index) => ({ index, hash: sha256Hex(bytes), size: bytes.byteLength })),
      rights: { license: 'cc0', rightsAssertion: 'i_own', provenance: '', consentAt: NOW },
      now: NOW,
    }),
  };
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('ManagedArchiveClient', () => {
  it('creates, hashes, uploads, and completes before reporting a server-derived state', async () => {
    const { identity, signedJob, objects } = fixture();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return String(url).endsWith('/complete') ? json({ status: 'quarantined' }) : json({ ok: true });
    }) as unknown as typeof fetch;
    const client = new ManagedArchiveClient({
      baseUrl: 'https://archive.example/', entitlementToken: 'entitlement', fetchImpl,
    });
    const result = await client.submit(signedJob, identity, objects);
    expect(result).toMatchObject({ status: 'quarantined', expectedBytes: 3, receivedBytes: 3 });
    expect(requests.map((request) => request.init?.method)).toEqual(['POST', 'PUT', 'PUT', 'POST']);
    expect((requests[1]?.init?.headers as Record<string, string>)['X-Mk-Object-Hash']).toMatch(/^[a-f0-9]{64}$/u);
    expect((requests[0]?.init?.headers as Record<string, string>).Authorization).toBe('Bearer entitlement');
  });

  it('signs status authorization over the exact method, path, nonce, timestamp, and body digest', async () => {
    const { identity, signedJob } = fixture();
    let headers: Record<string, string> = {};
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      headers = init?.headers as Record<string, string>;
      return json({ jobId: signedJob.job.jobId, status: 'pinned', lastErrorCode: null,
        expectedBytes: 3, receivedBytes: 3, scanOutcomeClass: 'clean', pinned: true, announced: false });
    }) as unknown as typeof fetch;
    const client = new ManagedArchiveClient({
      baseUrl: 'https://archive.example', entitlementToken: 'entitlement', fetchImpl,
      now: () => new Date(NOW),
    });
    await client.status(signedJob.job.jobId, identity);
    const message = new TextEncoder().encode(JSON.stringify([
      'meerkat-archive-request-auth-v2',
      'GET',
      `/api/archive/jobs/${signedJob.job.jobId}`,
      NOW,
      headers['X-Mk-Nonce'],
      sha256Hex(new Uint8Array(0)),
    ]));
    expect(verifySignature(identity.publicKey, message, hexToBytes(headers['X-Mk-Owner-Sig']!))).toBe(true);
  });

  it('surfaces exact HTTP status and stable server error code', async () => {
    const { identity, signedJob, objects } = fixture();
    const client = new ManagedArchiveClient({
      baseUrl: 'https://archive.example', entitlementToken: 'entitlement',
      fetchImpl: vi.fn(async () => json({ error: 'quota_exceeded' }, 413)) as unknown as typeof fetch,
    });
    await expect(client.submit(signedJob, identity, objects)).rejects.toEqual(
      expect.objectContaining<Partial<ManagedArchiveHttpError>>({ status: 413, code: 'quota_exceeded' }),
    );
  });

  it('rejects malformed or incoherent server status instead of persisting it', async () => {
    const { identity, signedJob } = fixture();
    const client = new ManagedArchiveClient({
      baseUrl: 'https://archive.example',
      fetchImpl: vi.fn(async () => json({
        jobId: signedJob.job.jobId,
        status: 'announced',
        lastErrorCode: null,
        expectedBytes: 3,
        receivedBytes: 4,
        scanOutcomeClass: 'clean',
        pinned: false,
        announced: true,
      })) as unknown as typeof fetch,
    });
    await expect(client.status(signedJob.job.jobId, identity)).rejects.toThrow(
      'Managed archive status response is invalid',
    );
  });

  it('rejects a cancel confirmation for a different job', async () => {
    const { identity, signedJob } = fixture();
    const client = new ManagedArchiveClient({
      baseUrl: 'https://archive.example',
      fetchImpl: vi.fn(async () => json({ jobId: 'f'.repeat(32), status: 'takedown_pending' })) as unknown as typeof fetch,
    });
    await expect(client.cancel(signedJob.job.jobId, identity)).rejects.toThrow(
      'Managed archive cancel response is invalid',
    );
  });
});
