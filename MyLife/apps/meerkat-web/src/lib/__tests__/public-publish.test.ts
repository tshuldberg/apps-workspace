import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  approvePublicJoinRequest,
  communityRole,
  createAudienceRule,
  createChannelMessage,
  createCommunity,
  createPublication,
  generateDeviceIdentity,
  getCommunity,
  queuePublicJoinRequest,
  redeemPublicJoinGrant,
  verifyOwnerTakedown,
  verifyPublicJoinGrant,
  verifyPublication,
  PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
  type DeviceIdentity,
  type PublicationJoinPolicy,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import {
  getPublicJoinRequest,
  insertMessageRow,
  listPendingPublicJoinRequests,
  recordPublicJoinRequest,
  recordPublicJoinRequests,
  setPublicJoinRequestStatus,
  storeOwnedCommunity,
} from '../meerkat-data';
import { requestPublicJoin } from '../public-join-client';
import { MEERKAT_HOSTED_MONTHLY_PRODUCT } from '@mylife/billing-config';
import {
  ARCHIVE_COPY,
  ARCHIVE_LICENSE_OPTIONS,
  DEFAULT_PUBLISH_DEPS,
  HOSTED_MONTHLY_PRICE,
  PUBLISH_COPY,
  RIGHTS_ASSERTION_OPTIONS,
  archiveManagedTierLabel,
  archivePublishResultView,
  canConfirmArchivePublish,
  canConfirmPublish,
  cancelManagedArchiveJob,
  formatHostedPrice,
  getCurrentPublicationDescriptor,
  hostedServingPath,
  listManagedArchiveJobs,
  probeServingHost,
  publishChannelPublicly,
  publishResultView,
  refreshManagedArchiveJob,
  unpublishPublicly,
  type ArchiveGateInput,
  type PublishDeps,
  type PublishResult,
} from '../public-publish';

const COMMUNITY = 'cm_unit';
const CHANNEL = 'general';

type Adapter = ReturnType<typeof createInMemoryTestDatabase>['adapter'];

function seedChannel(adapter: Adapter, owner: DeviceIdentity): void {
  const a = createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'first', hlc: { wall: '2026-06-28T00:00:01.000Z', counter: 0 } });
  const b = createChannelMessage(owner, { communityId: COMMUNITY, channelId: CHANNEL, body: 'second', hlc: { wall: '2026-06-28T00:00:02.000Z', counter: 0 } });
  insertMessageRow(adapter, a);
  insertMessageRow(adapter, b);
}

/** A fetch stub that maps host URL -> HTTP status for the register POST. */
function fetchStub(statusByHost: Record<string, number>): typeof fetch {
  return (async (url: string | URL | Request) => {
    const href = typeof url === 'string' ? url : url.toString();
    const host = Object.keys(statusByHost).find((h) => href.startsWith(h.replace(/\/+$/, '')));
    const status = host ? statusByHost[host]! : 404;
    const body = status === 200 ? { ok: true } : { reason: status === 429 ? 'rate_limited' : 'rejected' };
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

function deterministicDeps(over: Partial<PublishDeps> = {}): Partial<PublishDeps> {
  return {
    randomBytes: (n: number) => new Uint8Array(randomBytes(n)),
    now: () => '2026-06-28T00:00:00.000Z',
    announcePublication: vi.fn(async () => {}),
    announceHeldContent: vi.fn(async () => {}),
    ...over,
  };
}

describe('unpublishPublicly (Plan 19 FF1: terminal takedown of a REVISED publication, web twin)', () => {
  it('reconstructs a revision >= 2 row and signs an owner takedown (no cannot_reconstruct)', async () => {
    const { adapter } = createInMemoryTestDatabase();
    ensureSyncSchema(adapter);
    const owner = generateDeviceIdentity('Owner');
    const publicationId = 'pub_ff1_revised';
    const host = 'https://host.example';

    // A REVISED (revision 3) owned publication row -- the prior chain hash is not
    // stored, exactly the case the old reconstructGenesis bailed on (revision !== 1).
    adapter.execute(
      `INSERT INTO cm_publications (publication_id, community_id, channel_id, post_id, kind, title, description, category, owner_device_id, content_id, public_key_hex, host_urls, revision, status, join_policy, signature_hex, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [publicationId, COMMUNITY, CHANNEL, null, 'channel', 'Revised Title', 'desc', 'technology', owner.publicKey, 'content_abc', 'a'.repeat(64), JSON.stringify([host]), 3, 'active', 'request', 'b'.repeat(128), '2026-06-28T00:00:00.000Z', '2026-06-28T00:00:00.000Z'],
    );
    // A local snapshot row so the host re-register path runs (the fetch seam returns
    // 200; a takedown needs no real pieces).
    adapter.execute(
      `INSERT INTO cm_publication_snapshots (publication_id, channel_id, epoch, manifest_json, pieces_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [publicationId, CHANNEL, 0, JSON.stringify({}), JSON.stringify([]), '2026-06-28T00:00:00.000Z'],
    );

    const announceHost = vi.fn(async (..._args: unknown[]) => {});
    const result = await unpublishPublicly(
      {
        fetchFn: vi.fn(fetchStub({ [host]: 200 })),
        announceHost,
        now: () => '2026-06-28T00:01:00.000Z',
      },
      { db: adapter, identity: owner, publicationId, directoryUrl: 'wss://dir.example' },
    );

    // The relaxed reconstruction no longer bails: the takedown is built + propagated.
    expect(result.reason).not.toBe('cannot_reconstruct');
    expect(result.ok).toBe(true);
    expect(result.directoryRemoved).toBe(true);
    expect(result.removedHosts).toBe(1);

    // The local row is now the terminal takedown at revision 4.
    const [row] = adapter.query<{ status: string; revision: number }>(
      'SELECT status, revision FROM cm_publications WHERE publication_id = ?',
      [publicationId],
    );
    expect(row!.status).toBe('unpublished');
    expect(row!.revision).toBe(4);

    // The announced record is a genuine owner-signed takedown the directory/host
    // terminal verifier (verifyOwnerTakedown) accepts against the genesis.
    const announced = JSON.parse((announceHost.mock.calls[0]![0] as { record: string }).record) as SignedPublicationDescriptor;
    expect(announced.descriptor.revision).toBe(4);
    expect(announced.descriptor.status).toBe('unpublished');
    const genesisShape: SignedPublicationDescriptor = {
      descriptor: { ...announced.descriptor, revision: 1, status: 'active', previousHash: null },
      signature: '',
    };
    expect(verifyOwnerTakedown(announced, genesisShape)).toBe(true);
  });
});

const RIGHTS = { license: 'cc_by', rightsAssertion: 'i_own', provenance: 'Original work', consentAt: '2026-06-28T00:00:00.000Z' } as const;

function baseGate(over: Partial<ArchiveGateInput> = {}): ArchiveGateInput {
  return {
    title: 'A public space',
    category: 'technology',
    hostReachable: true,
    audienceIsPublic: true,
    consentChecked: true,
    rightsAssertion: 'i_own',
    license: 'cc_by',
    ...over,
  };
}

function publishWithArchive(
  adapter: Adapter,
  owner: DeviceIdentity,
  rightsOver: { provenance?: string } = {},
): Promise<PublishResult> {
  return publishChannelPublicly(
    deterministicDeps({
      fetchFn: vi.fn(fetchStub({ 'https://h1.example': 200 })),
      announcePublication: vi.fn(async () => {}),
      announceHeldContent: vi.fn(async () => {}),
    }),
    {
      db: adapter,
      identity: owner,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      title: 'Public',
      description: 'd',
      category: 'technology',
      hostUrls: ['https://h1.example'],
      directoryUrl: '',
      archive: { rights: { ...RIGHTS, ...rightsOver }, tier: 'self_host' },
    },
  );
}

describe('durable-archive publish (Plan 19 P9.3e, web twin)', () => {
  describe('canConfirmArchivePublish gate (NC-8: consent + rights required, no default)', () => {
    it('is true only with consent + a rights assertion + a license on top of the publish gate', () => {
      expect(canConfirmArchivePublish(baseGate())).toBe(true);
    });
    it('is false until consent is checked', () => {
      expect(canConfirmArchivePublish(baseGate({ consentChecked: false }))).toBe(false);
    });
    it('is false with no rights assertion (no default)', () => {
      expect(canConfirmArchivePublish(baseGate({ rightsAssertion: null }))).toBe(false);
    });
    it('is false with no license (no default)', () => {
      expect(canConfirmArchivePublish(baseGate({ license: null }))).toBe(false);
    });
    it('is false when the base publish gate fails even with consent + rights', () => {
      expect(canConfirmArchivePublish(baseGate({ audienceIsPublic: false }))).toBe(false);
      expect(canConfirmArchivePublish(baseGate({ hostReachable: false }))).toBe(false);
    });
  });

  describe('honest copy (NC-7: no permanence; price from billing-config; no default selection)', () => {
    it('has no "forever"/"permanent" substring and keeps viewing free', () => {
      const all = Object.values(ARCHIVE_COPY).join(' ').toLowerCase();
      expect(all).not.toContain('forever');
      expect(all).not.toContain('permanent');
      expect(all).toContain('viewing is free');
    });
    it('reads the managed price from billing-config at runtime, never hardcoded', () => {
      const price = MEERKAT_HOSTED_MONTHLY_PRODUCT.price;
      expect(archiveManagedTierLabel(price)).toBe(`Managed always-on (paid, $${price.toFixed(2)}/mo)`);
      expect(archiveManagedTierLabel()).toContain(price.toFixed(2));
    });
    it('rights + license options match the engine taxonomy in order (caller starts null)', () => {
      expect(RIGHTS_ASSERTION_OPTIONS.map((o) => o.value)).toEqual(['i_own', 'i_have_permission', 'public_domain', 'fair_use']);
      expect(ARCHIVE_LICENSE_OPTIONS.map((o) => o.value)).toEqual(['all_rights_reserved', 'cc_by', 'cc_by_sa', 'cc0', 'public_domain', 'other']);
    });
  });

  describe('archivePublishResultView (honest states; no archive Success terminal in this build)', () => {
    const baseResult = (over: Partial<PublishResult> = {}): PublishResult => ({
      state: 'success', message: PUBLISH_COPY.success, publicationId: 'p', link: 'meerkat://public/p', hosts: [], announced: true, ...over,
    });
    it('adds no archive note when no archive was requested', () => {
      expect(archivePublishResultView(baseResult()).archiveNote).toBeNull();
    });
    it('renders the honest QUEUED note (never the archived terminal) for a pending archive', () => {
      const view = archivePublishResultView(baseResult({ archive: { jobId: 'j', tier: 'self_host', moderationState: 'pending', status: 'consented' } }));
      expect(view.archiveNote).toBe(ARCHIVE_COPY.queued);
      expect(view.archiveNoteDetail).toBe(ARCHIVE_COPY.queuedDetail);
      expect(view.archiveNote).not.toBe(ARCHIVE_COPY.archived);
      expect(view.heading).toBe(PUBLISH_COPY.success);
    });
    it('reaches the archived terminal ONLY on a real approved scan; flagged on a real rejected scan', () => {
      expect(archivePublishResultView(baseResult({ archive: { jobId: 'j', tier: 'self_host', moderationState: 'approved', status: 'announced' } })).archiveNote).toBe(ARCHIVE_COPY.archived);
      expect(archivePublishResultView(baseResult({ archive: { jobId: 'j', tier: 'self_host', moderationState: 'rejected', status: 'rejected' } })).archiveNote).toBe(ARCHIVE_COPY.errorFlagged);
    });
  });

  describe('archive persistence + rights round-trip', () => {
    it('persists real snapshot byte counts, rights, pending moderation, and signed descriptor rights', async () => {
      const db = createInMemoryTestDatabase();
      ensureSyncSchema(db.adapter);
      const owner = generateDeviceIdentity('Owner');
      seedChannel(db.adapter, owner);
      const result = await publishWithArchive(db.adapter, owner);
      expect(result.state).toBe('success');
      expect(result.archive?.moderationState).toBe('pending');

      const jobs = db.adapter.query<{ status: string; total_bytes: number; pieces: number; tier: string }>('SELECT status, total_bytes, pieces, tier FROM cm_archive_jobs');
      expect(jobs).toHaveLength(1);
      expect(jobs[0]!.status).toBe('consented');
      expect(jobs[0]!.total_bytes).toBeGreaterThan(0);
      expect(jobs[0]!.pieces).toBeGreaterThan(0);
      expect(jobs[0]!.tier).toBe('self_host');

      const rights = db.adapter.query<{ license: string; rights_assertion: string }>('SELECT license, rights_assertion FROM cm_publication_rights');
      expect(rights[0]!.license).toBe('cc_by');
      expect(rights[0]!.rights_assertion).toBe('i_own');

      const mod = db.adapter.query<{ state: string; scan_result: string }>('SELECT state, scan_result FROM cm_archive_moderation');
      expect(mod[0]!.state).toBe('pending');
      expect(mod[0]!.scan_result).toBe('unscanned');

      const pub = db.adapter.query<{ rights_json: string | null }>('SELECT rights_json FROM cm_publications');
      expect(pub[0]!.rights_json).toBeTruthy();
      expect((JSON.parse(pub[0]!.rights_json!) as { license: string }).license).toBe('cc_by');
      db.close();
    });

    it('authenticates the managed register, uploads every built piece, and persists server state', async () => {
      const db = createInMemoryTestDatabase();
      const owner = generateDeviceIdentity('Managed owner');
      ensureSyncSchema(db.adapter);
      seedChannel(db.adapter, owner);
      const requests: Array<{ url: string; headers: Headers; method: string }> = [];
      const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const href = String(url);
        requests.push({ url: href, headers: new Headers(init?.headers), method: init?.method ?? 'GET' });
        if (href.includes('/public/')) return new Response('{"ok":true}', { status: 200 });
        if (href.endsWith('/complete')) return new Response('{"status":"quarantined"}', { status: 200 });
        return new Response('{"ok":true}', { status: 200 });
      }) as unknown as typeof fetch;
      const result = await publishChannelPublicly(deterministicDeps({ fetchFn }), {
        db: db.adapter, identity: owner, communityId: COMMUNITY, channelId: CHANNEL,
        title: 'Managed public', description: 'd', category: 'technology',
        hostUrls: ['https://managed.example'], directoryUrl: '',
        archive: {
          rights: RIGHTS,
          tier: 'managed',
          managed: { baseUrl: 'https://managed.example', entitlementToken: 'signed-entitlement' },
        },
      });
      expect(result.archive).toMatchObject({ tier: 'managed', status: 'quarantined', moderationState: 'pending' });
      expect(requests[0]?.headers.get('Authorization')).toBe('Bearer signed-entitlement');
      expect(requests.filter((request) => request.url.includes('/objects/'))).toHaveLength(
        db.adapter.query<{ pieces: number }>('SELECT pieces FROM cm_archive_jobs')[0]!.pieces,
      );
      expect(requests.every((request) => request.headers.get('Authorization') === 'Bearer signed-entitlement')).toBe(true);
      expect(db.adapter.query<{ status: string }>('SELECT status FROM cm_archive_jobs')[0]?.status).toBe('quarantined');
      db.close();
    });

    it('keeps a live public registration honest when a managed object upload fails', async () => {
      const db = createInMemoryTestDatabase();
      const owner = generateDeviceIdentity('Managed failure owner');
      ensureSyncSchema(db.adapter);
      seedChannel(db.adapter, owner);
      const fetchFn = vi.fn(async (url: string | URL | Request) => {
        const href = String(url);
        if (href.includes('/public/')) return new Response('{"ok":true}', { status: 200 });
        if (href.includes('/objects/')) {
          return new Response('{"error":"object_store_unavailable"}', { status: 503 });
        }
        return new Response('{"ok":true}', { status: 200 });
      }) as unknown as typeof fetch;
      const result = await publishChannelPublicly(deterministicDeps({ fetchFn }), {
        db: db.adapter, identity: owner, communityId: COMMUNITY, channelId: CHANNEL,
        title: 'Managed failure', description: 'd', category: 'technology',
        hostUrls: ['https://managed.example'], directoryUrl: '',
        archive: {
          rights: RIGHTS,
          tier: 'managed',
          managed: { baseUrl: 'https://managed.example', entitlementToken: 'signed-entitlement' },
        },
      });
      expect(result.state).toBe('success');
      expect(result.archive).toMatchObject({
        moderationState: 'failed', status: 'failed', lastErrorCode: 'object_store_unavailable',
      });
      expect(db.adapter.query<{ status: string }>('SELECT status FROM cm_archive_jobs')[0]?.status).toBe('failed');
      db.close();
    });

    it('refreshes and cancels managed jobs with owner auth and mirrors only server state', async () => {
      const db = createInMemoryTestDatabase();
      ensureSyncSchema(db.adapter);
      const owner = generateDeviceIdentity('Owner');
      seedChannel(db.adapter, owner);
      await publishWithArchive(db.adapter, owner);
      db.adapter.execute("UPDATE cm_archive_jobs SET tier = 'managed'");
      const job = listManagedArchiveJobs(db.adapter)[0]!;
      const statusFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        expect(new Headers(init?.headers).get('X-Mk-Owner-Sig')).toMatch(/^[0-9a-f]{128}$/u);
        return new Response(JSON.stringify({
          jobId: job.jobId, status: 'approved', lastErrorCode: null,
          expectedBytes: 1, receivedBytes: 1, scanOutcomeClass: 'clean', pinned: false, announced: false,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch;
      expect((await refreshManagedArchiveJob(db.adapter, owner, job.jobId, statusFetch)).status).toBe('approved');
      expect(db.adapter.query<{ state: string; scan_result: string }>('SELECT state, scan_result FROM cm_archive_moderation')[0])
        .toMatchObject({ state: 'approved', scan_result: 'clean' });

      const cancelFetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        expect(init?.method).toBe('DELETE');
        expect(new Headers(init?.headers).get('Authorization')).toBeNull();
        return new Response(JSON.stringify({ jobId: job.jobId, status: 'takedown_pending' }), { status: 200 });
      }) as typeof fetch;
      expect((await cancelManagedArchiveJob(db.adapter, owner, job.jobId, cancelFetch)).status).toBe('takedown_pending');
      expect(db.adapter.query<{ status: string }>('SELECT status FROM cm_archive_jobs')[0]?.status).toBe('takedown_pending');
      db.close();
    });

    it('a no-archive publish writes null rights_json + no archive job (legacy behavior preserved)', async () => {
      const db = createInMemoryTestDatabase();
      ensureSyncSchema(db.adapter);
      const owner = generateDeviceIdentity('Owner');
      seedChannel(db.adapter, owner);
      const result = await publishChannelPublicly(
        deterministicDeps({ fetchFn: vi.fn(fetchStub({ 'https://h1.example': 200 })) }),
        { db: db.adapter, identity: owner, communityId: COMMUNITY, channelId: CHANNEL, title: 'Public', description: 'd', category: 'technology', hostUrls: ['https://h1.example'], directoryUrl: '' },
      );
      expect(result.state).toBe('success');
      expect(result.archive).toBeUndefined();
      expect(db.adapter.query('SELECT * FROM cm_archive_jobs')).toHaveLength(0);
      const pub = db.adapter.query<{ rights_json: string | null }>('SELECT rights_json FROM cm_publications');
      expect(pub[0]!.rights_json).toBeNull();
      db.close();
    });

    it('a rev1 rights-bearing publish reconstructs + unpublishes (no cannot_reconstruct); the takedown is owner-valid', async () => {
      const db = createInMemoryTestDatabase();
      ensureSyncSchema(db.adapter);
      const owner = generateDeviceIdentity('Owner');
      seedChannel(db.adapter, owner);
      const pub = await publishWithArchive(db.adapter, owner);
      const announceHost = vi.fn(async (..._a: unknown[]) => {});
      const un = await unpublishPublicly(
        { fetchFn: vi.fn(fetchStub({ 'https://h1.example': 200 })), announceHost, now: () => '2026-06-28T01:00:00.000Z' },
        { db: db.adapter, identity: owner, publicationId: pub.publicationId!, directoryUrl: 'wss://dir.example' },
      );
      expect(un.reason).not.toBe('cannot_reconstruct');
      expect(un.ok).toBe(true);
      const announced = JSON.parse((announceHost.mock.calls[0]![0] as { record: string }).record) as SignedPublicationDescriptor;
      expect(announced.descriptor.rights).toBeTruthy();
      const genesisShape: SignedPublicationDescriptor = { descriptor: { ...announced.descriptor, revision: 1, status: 'active', previousHash: null }, signature: '' };
      expect(verifyOwnerTakedown(announced, genesisShape)).toBe(true);
      db.close();
    });

    it('reconstruction reads cm_publications.rights_json, NOT the device_local mirror: takedown survives deleting cm_publication_rights (Q2)', async () => {
      const db = createInMemoryTestDatabase();
      ensureSyncSchema(db.adapter);
      const owner = generateDeviceIdentity('Owner');
      seedChannel(db.adapter, owner);
      const pub = await publishWithArchive(db.adapter, owner);
      db.adapter.execute('DELETE FROM cm_publication_rights WHERE publication_id = ?', [pub.publicationId]);
      expect(db.adapter.query('SELECT * FROM cm_publication_rights')).toHaveLength(0);
      const un = await unpublishPublicly(
        { fetchFn: vi.fn(fetchStub({ 'https://h1.example': 200 })), announceHost: vi.fn(async () => {}), now: () => '2026-06-28T02:00:00.000Z' },
        { db: db.adapter, identity: owner, publicationId: pub.publicationId!, directoryUrl: '' },
      );
      expect(un.reason).not.toBe('cannot_reconstruct');
      expect(un.ok).toBe(true);
      db.close();
    });

    it('empty provenance round-trips: a rev1 publish with provenance "" still reconstructs + unpublishes', async () => {
      const db = createInMemoryTestDatabase();
      ensureSyncSchema(db.adapter);
      const owner = generateDeviceIdentity('Owner');
      seedChannel(db.adapter, owner);
      const pub = await publishWithArchive(db.adapter, owner, { provenance: '' });
      const un = await unpublishPublicly(
        { fetchFn: vi.fn(fetchStub({ 'https://h1.example': 200 })), announceHost: vi.fn(async () => {}), now: () => '2026-06-28T03:00:00.000Z' },
        { db: db.adapter, identity: owner, publicationId: pub.publicationId!, directoryUrl: '' },
      );
      expect(un.reason).not.toBe('cannot_reconstruct');
      expect(un.ok).toBe(true);
      db.close();
    });
  });
});

describe('publishChannelPublicly (Plan 19 P7a orchestrator, web twin)', () => {
  it('guards an empty channel as the Empty state without building or POSTing', async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    const fetchFn = vi.fn(fetchStub({}));

    const result = await publishChannelPublicly(deterministicDeps({ fetchFn }), {
      db: db.adapter,
      identity: owner,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      title: 'Empty',
      description: '',
      category: 'technology',
      hostUrls: ['https://h1.example'],
      directoryUrl: 'wss://dir.example',
    });

    expect(result.state).toBe('empty');
    expect(result.message).toBe(PUBLISH_COPY.empty);
    expect(fetchFn).not.toHaveBeenCalled();
    db.close();
  });

  it('publishes to all hosts -> Success, announces, and persists the signed descriptor', async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    seedChannel(db.adapter, owner);
    const announcePublication = vi.fn(async () => {});
    const announceHeldContent = vi.fn(async () => {});
    const fetchFn = fetchStub({ 'https://h1.example': 200, 'https://h2.example': 200 });

    const result = await publishChannelPublicly(
      deterministicDeps({ fetchFn, announcePublication, announceHeldContent }),
      {
        db: db.adapter,
        identity: owner,
        communityId: COMMUNITY,
        channelId: CHANNEL,
        title: 'Public Channel',
        description: 'anyone can read',
        category: 'technology',
        hostUrls: ['https://h1.example', 'https://h2.example'],
        directoryUrl: 'wss://dir.example',
      },
    );

    expect(result.state).toBe('success');
    expect(result.message).toBe(PUBLISH_COPY.success);
    expect(result.link).toBe(`meerkat://public/${result.publicationId}`);
    expect(announcePublication).toHaveBeenCalledTimes(1);
    expect(announceHeldContent).toHaveBeenCalledTimes(2);
    expect(db.adapter.query('SELECT publication_id FROM cm_publications')).toHaveLength(1);
    db.close();
  });

  it('reports the Partial state when only some hosts accept', async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    seedChannel(db.adapter, owner);
    const fetchFn = fetchStub({ 'https://h1.example': 200, 'https://h2.example': 429 });

    const result = await publishChannelPublicly(deterministicDeps({ fetchFn }), {
      db: db.adapter,
      identity: owner,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      title: 'Public Channel',
      description: 'partial',
      category: 'gaming',
      hostUrls: ['https://h1.example', 'https://h2.example'],
      directoryUrl: 'wss://dir.example',
    });

    expect(result.state).toBe('partial');
    expect(result.message).toBe('Published to 1 of 2 hosts.');
    expect(result.detail).toBe(PUBLISH_COPY.partialDetail);
    db.close();
  });

  it('returns the no-host Error when the host transport fails, persisting nothing', async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    seedChannel(db.adapter, owner);
    const fetchFn = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;

    const result = await publishChannelPublicly(deterministicDeps({ fetchFn }), {
      db: db.adapter,
      identity: owner,
      communityId: COMMUNITY,
      channelId: CHANNEL,
      title: 'Public Channel',
      description: 'down',
      category: 'other',
      hostUrls: ['https://offline.example'],
      directoryUrl: 'wss://dir.example',
    });

    expect(result.state).toBe('error');
    expect(result.message).toBe(PUBLISH_COPY.errorNoHost);
    expect(db.adapter.query('SELECT publication_id FROM cm_publications')).toHaveLength(0);
    db.close();
  });

  it('exposes the hosted price from billing-config, never hardcoded in copy', () => {
    expect(HOSTED_MONTHLY_PRICE).toBe(4.99);
    expect(formatHostedPrice()).toBe('$4.99');
    expect(hostedServingPath()).toContain('$4.99/mo');
    expect(typeof DEFAULT_PUBLISH_DEPS.buildPublicSnapshot).toBe('function');
  });
});

describe('publish-sheet (Plan 19 P7b) seams, web twin', () => {
  function healthStub(statusByHost: Record<string, number | 'throw'>): typeof fetch {
    return (async (url: string | URL | Request) => {
      const href = typeof url === 'string' ? url : url.toString();
      const host = Object.keys(statusByHost).find((h) => href.startsWith(h.replace(/\/+$/, '')));
      const status = host ? statusByHost[host]! : 404;
      if (status === 'throw') throw new Error('connection refused');
      return new Response(JSON.stringify({ ok: status === 200 }), { status });
    }) as unknown as typeof fetch;
  }

  describe('probeServingHost (REAL reachability, fail-closed)', () => {
    it('is reachable only on a real HTTP 200 from GET {host}/healthz', async () => {
      const fetchFn = vi.fn(healthStub({ 'https://up.example': 200 }));
      const r = await probeServingHost('https://up.example', fetchFn);
      expect(r.reachable).toBe(true);
      expect(fetchFn).toHaveBeenCalledWith('https://up.example/healthz', { method: 'GET' });
    });

    it('is unreachable on a non-200, never faking reachability', async () => {
      const r = await probeServingHost('https://down.example', healthStub({ 'https://down.example': 503 }));
      expect(r).toEqual({ reachable: false, reason: 'unreachable', status: 503 });
    });

    it('is unreachable (fail-closed) when the transport throws', async () => {
      const r = await probeServingHost('https://offline.example', healthStub({ 'https://offline.example': 'throw' }));
      expect(r).toEqual({ reachable: false, reason: 'unreachable', status: 0 });
    });

    it('rejects an empty or non-http URL without a network call', async () => {
      const fetchFn = vi.fn(healthStub({}));
      expect(await probeServingHost('   ', fetchFn)).toEqual({ reachable: false, reason: 'empty', status: 0 });
      expect(await probeServingHost('my-host.example', fetchFn)).toEqual({ reachable: false, reason: 'bad_url', status: 0 });
      expect(fetchFn).not.toHaveBeenCalled();
    });
  });

  describe('canConfirmPublish (title + category + probed host + public audience)', () => {
    const ok = { title: 'Public space', category: 'technology' as const, hostReachable: true, audienceIsPublic: true };
    it('enables only when all four are present', () => {
      expect(canConfirmPublish(ok)).toBe(true);
    });
    it('is disabled without a title', () => {
      expect(canConfirmPublish({ ...ok, title: '   ' })).toBe(false);
    });
    it('is disabled without a category', () => {
      expect(canConfirmPublish({ ...ok, category: null })).toBe(false);
    });
    it('is disabled until a host is probed reachable', () => {
      expect(canConfirmPublish({ ...ok, hostReachable: false })).toBe(false);
    });
    it('is disabled until the author explicitly selects Public', () => {
      expect(canConfirmPublish({ ...ok, audienceIsPublic: false })).toBe(false);
    });
  });

  describe('publishResultView (5-state verbatim copy)', () => {
    const base = { hosts: [], announced: false };
    it('Success shows the verbatim headline + the copyable link', () => {
      const result: PublishResult = {
        ...base, state: 'success', message: PUBLISH_COPY.success,
        publicationId: 'pub_1', link: 'meerkat://public/pub_1',
      };
      expect(publishResultView(result)).toEqual({
        heading: 'Published. Anyone with a reachable host can now read it.',
        body: '', detail: null, link: 'meerkat://public/pub_1', tone: 'success',
      });
    });
    it('Partial shows "Published to {m} of {n} hosts." + the detail + link', () => {
      const result: PublishResult = {
        ...base, state: 'partial', message: 'Published to 1 of 2 hosts.',
        detail: PUBLISH_COPY.partialDetail, publicationId: 'pub_2', link: 'meerkat://public/pub_2',
      };
      const view = publishResultView(result);
      expect(view.heading).toBe('Published to 1 of 2 hosts.');
      expect(view.body).toBe('Some hosts did not accept it; it is still readable from the ones that did.');
      expect(view.link).toBe('meerkat://public/pub_2');
      expect(view.tone).toBe('partial');
    });
    it('Error shows "Could not publish" above the returned reason, no link', () => {
      const result: PublishResult = {
        ...base, state: 'error', message: PUBLISH_COPY.errorNoHost, publicationId: 'pub_3', link: null,
      };
      expect(publishResultView(result)).toEqual({
        heading: 'Could not publish',
        body: 'No serving host accepted the content. Check your host URL or connect hosted serving.',
        detail: null, link: null, tone: 'error',
      });
    });
    it('Empty shows the guarded copy and no link', () => {
      const result: PublishResult = {
        ...base, state: 'empty', message: PUBLISH_COPY.empty, publicationId: null, link: null,
      };
      expect(publishResultView(result)).toEqual({
        heading: 'Add at least one post before publishing.',
        body: '', detail: null, link: null, tone: 'empty',
      });
    });
  });

  it('surfaces the public audience hosted notice verbatim (AudienceSelector wiring)', () => {
    const publicRule = createAudienceRule({ type: 'public' });
    expect(publicRule.hostedNotice).toBe('Public posts use hosted storage and moderation.');
    expect(publicRule.hostedNotice).toBe(PUBLISH_COPY.audienceHostedNotice);
  });
});

describe('FF3 public-join grant emission (Plan 19 P9, app half, web twin)', () => {
  // Publish through the REAL orchestrator, capturing the owner-signed descriptor the
  // orchestrator actually signs (via a createPublication dep that wraps the real engine fn).
  async function publishWithGrant(
    adapter: Adapter,
    owner: DeviceIdentity,
    joinPolicy: PublicationJoinPolicy,
    advertiseJoins: boolean,
  ): Promise<{ result: PublishResult; signed: SignedPublicationDescriptor | null }> {
    let signed: SignedPublicationDescriptor | null = null;
    const result = await publishChannelPublicly(
      deterministicDeps({
        fetchFn: vi.fn(fetchStub({ 'https://h1.example': 200 })),
        createPublication: (identity, opts) => {
          const s = createPublication(identity, opts);
          signed = s;
          return s;
        },
      }),
      {
        db: adapter, identity: owner, communityId: COMMUNITY, channelId: CHANNEL,
        title: 'Public', description: 'd', category: 'technology',
        hostUrls: ['https://h1.example'], directoryUrl: '', joinPolicy, advertiseJoins,
      },
    );
    return { result, signed };
  }

  it("an 'open' advertised publish emits a grant that verifies; redeem writes ONE member row, ZERO key", async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    seedChannel(db.adapter, owner);

    const { result, signed } = await publishWithGrant(db.adapter, owner, 'open', true);
    expect(result.state).toBe('success');
    expect(signed!.descriptor.joinPolicy).toBe('open');
    // The grant carries ONLY the owner's PUBLIC DH key + a nonce (never a private/epoch key).
    expect(signed!.descriptor.publicJoin?.ownerDhPublicKey).toBe(owner.dhPublicKey);
    expect(signed!.descriptor.publicJoin?.grantId).toMatch(/^[0-9a-f]{32}$/);
    expect(verifyPublicJoinGrant(signed!)).toBe(true);

    // Open-redeem records EXACTLY one owner-authorized roster row and ZERO key material.
    const r = redeemPublicJoinGrant(db.adapter, joiner, signed!);
    expect(r).toEqual({ ok: true, communityId: COMMUNITY });
    const members = db.adapter.query<{ device_id: string; role: string }>(
      'SELECT device_id, role FROM sync_workspace_members WHERE workspace_id = ?', [COMMUNITY],
    );
    expect(members).toHaveLength(1);
    expect(members[0]!.role).toBe('member');
    expect(db.adapter.query('SELECT * FROM sync_workspace_keys WHERE workspace_id = ?', [COMMUNITY])).toHaveLength(0);

    // The grant persists so a takedown of the ADVERTISED publication reconstructs byte-exact.
    const pub = db.adapter.query<{ public_join_json: string | null }>('SELECT public_join_json FROM cm_publications');
    expect(pub[0]!.public_join_json).toBeTruthy();
    db.close();
  });

  it("a 'request' advertised publish emits a grant with ownerDhPublicKey but verifyPublicJoinGrant is false", async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    seedChannel(db.adapter, owner);
    const { result, signed } = await publishWithGrant(db.adapter, owner, 'request', true);
    expect(result.state).toBe('success');
    expect(signed!.descriptor.joinPolicy).toBe('request');
    expect(signed!.descriptor.publicJoin?.ownerDhPublicKey).toBe(owner.dhPublicKey);
    // Present (owner DH key, for the request-seal path) but NOT an open-redeem grant.
    expect(verifyPublicJoinGrant(signed!)).toBe(false);
    db.close();
  });

  it('advertise-OFF emits publicJoin===undefined, stays byte-identical to a pre-FF3 descriptor', async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    const owner = generateDeviceIdentity('Owner');
    seedChannel(db.adapter, owner);
    const { signed } = await publishWithGrant(db.adapter, owner, 'open', false);
    expect(signed!.descriptor.publicJoin).toBeUndefined();
    expect(verifyPublicJoinGrant(signed!)).toBe(false);
    // The grant tag is appended to the canonical bytes ONLY when present, so the owner
    // signature verifies exactly as a pre-FF3 descriptor and public_join_json stays null.
    expect(verifyPublication(signed!)).toBe('ok');
    const pub = db.adapter.query<{ public_join_json: string | null }>('SELECT public_join_json FROM cm_publications');
    expect(pub[0]!.public_join_json).toBeNull();
    db.close();
  });

  it('a request-policy join with NO connection server stays on the device (Saved); NOTHING leaves', async () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);
    ensureMeerkatTables(db.adapter); // mk_settings for effectiveRelayUrl (no relay configured)
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    seedChannel(db.adapter, owner);

    const { signed } = await publishWithGrant(db.adapter, owner, 'request', true);
    // DEFAULT_RELAY_URL '' + no configured relay -> the park short-circuits -> 'saved', never 'sent'.
    expect(await requestPublicJoin(db.adapter, joiner, signed!, 'test-humanity-token')).toEqual({ kind: 'saved' });

    // A grant-less descriptor fail-closes to 'invalid' (nothing sealed).
    const { signed: noGrant } = await publishWithGrant(db.adapter, owner, 'request', false);
    expect(await requestPublicJoin(db.adapter, joiner, noGrant!, 'test-humanity-token')).toEqual({ kind: 'invalid' });
    db.close();
  });
});

describe('Plan 19 FF3 (app half, PART 1): public-join owner review queue, web twin', () => {
  const RQ_CHANNEL = 'general';

  /**
   * Found a REAL owned community (unlike publishWithGrant's fixed COMMUNITY const,
   * which has no sync_communities row), seed one channel message, and publish it
   * request-policy + advertised through the REAL orchestrator so the returned
   * descriptor + persisted cm_publications row are genuine. Mirrors how
   * MeerkatProvider.createCommunity + publishChannelPublicly are actually wired.
   */
  async function publishRequestPolicyCommunity(
    adapter: Adapter,
    owner: DeviceIdentity,
  ): Promise<{ communityId: string; signed: SignedPublicationDescriptor }> {
    ensureSyncSchema(adapter);
    const communitySigned = createCommunity(owner, {
      name: 'Club',
      channels: [{ id: RQ_CHANNEL, name: RQ_CHANNEL }],
      now: '2026-06-28T00:00:00.000Z',
    });
    storeOwnedCommunity(adapter, owner, communitySigned);
    const communityId = communitySigned.descriptor.communityId;

    const seed = createChannelMessage(owner, {
      communityId,
      channelId: RQ_CHANNEL,
      body: 'hello',
      hlc: { wall: '2026-06-28T00:00:01.000Z', counter: 0 },
    });
    insertMessageRow(adapter, seed);

    let signed: SignedPublicationDescriptor | null = null;
    const result = await publishChannelPublicly(
      deterministicDeps({
        fetchFn: vi.fn(fetchStub({ 'https://h1.example': 200 })),
        createPublication: (identity, opts) => {
          const s = createPublication(identity, opts);
          signed = s;
          return s;
        },
      }),
      {
        db: adapter, identity: owner, communityId, channelId: RQ_CHANNEL,
        title: 'Public', description: 'd', category: 'technology',
        hostUrls: ['https://h1.example'], directoryUrl: '', joinPolicy: 'request', advertiseJoins: true,
      },
    );
    expect(result.state).toBe('success');
    return { communityId, signed: signed! };
  }

  it('recordPublicJoinRequests drops a request naming a community this device does not own', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const { signed } = await publishRequestPolicyCommunity(db.adapter, owner);

    // A DIFFERENT device (not the community's owner) drains the request.
    const notOwner = generateDeviceIdentity('NotOwner');
    const handler = recordPublicJoinRequests({ db: db.adapter, owner: notOwner });

    const q = queuePublicJoinRequest(joiner, signed);
    expect(q.ok).toBe(true);
    if (!q.ok) return;

    const applied = await handler.publicJoinRequest!(joiner.publicKey, q.payload, '2026-06-28T00:00:05.000Z');
    expect(applied).toBe(false);
    expect(getPublicJoinRequest(db.adapter, q.payload.publicationId, joiner.publicKey)).toBeNull();
    db.close();
  });

  it('recordPublicJoinRequests records a verified request for an owned community; idempotent on re-send', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const { signed } = await publishRequestPolicyCommunity(db.adapter, owner);

    const handler = recordPublicJoinRequests({ db: db.adapter, owner, redeem: async () => ({ ok: true }) });
    const q = queuePublicJoinRequest(joiner, signed);
    expect(q.ok).toBe(true);
    if (!q.ok) return;

    const createdAt = '2026-06-28T00:00:05.000Z';
    const applied = await handler.publicJoinRequest!(joiner.publicKey, q.payload, createdAt);
    expect(applied).toBe(true);

    const row = getPublicJoinRequest(db.adapter, q.payload.publicationId, joiner.publicKey);
    expect(row).toMatchObject({
      publication_id: q.payload.publicationId,
      community_id: q.payload.communityId,
      sender_device_id: joiner.publicKey,
      grant_id: q.payload.grantId,
      created_at: createdAt,
      status: 'pending',
    });
    expect(JSON.parse(row!.bundle_json)).toEqual(q.payload.bundle);

    // Idempotent re-send: an already-decided row is never reset back to pending.
    setPublicJoinRequestStatus(db.adapter, q.payload.publicationId, joiner.publicKey, 'approved');
    const appliedAgain = await handler.publicJoinRequest!(joiner.publicKey, q.payload, createdAt);
    expect(appliedAgain).toBe(true);
    expect(getPublicJoinRequest(db.adapter, q.payload.publicationId, joiner.publicKey)!.status).toBe('approved');
    db.close();
  });

  it('drops a request when the humanity redeem fails (single-use / no service = no row)', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const { signed } = await publishRequestPolicyCommunity(db.adapter, owner);
    const q = queuePublicJoinRequest(joiner, signed);
    if (!q.ok) throw new Error('setup failed');

    const spent = recordPublicJoinRequests({ db: db.adapter, owner, redeem: async () => ({ ok: false, reason: 'already_spent' }) });
    expect(await spent.publicJoinRequest!(joiner.publicKey, q.payload, '2026-06-28T00:00:05.000Z')).toBe(false);
    expect(getPublicJoinRequest(db.adapter, q.payload.publicationId, joiner.publicKey)).toBeNull();

    const noService = recordPublicJoinRequests({ db: db.adapter, owner });
    expect(await noService.publicJoinRequest!(joiner.publicKey, q.payload, '2026-06-28T00:00:06.000Z')).toBe(false);
    expect(getPublicJoinRequest(db.adapter, q.payload.publicationId, joiner.publicKey)).toBeNull();
    db.close();
  });

  it('CRUD: listPendingPublicJoinRequests scopes by community + status; setStatus transitions', () => {
    const db = createInMemoryTestDatabase();
    ensureSyncSchema(db.adapter);

    recordPublicJoinRequest(db.adapter, {
      publicationId: 'pub-a', communityId: 'cm_a', senderDeviceId: 'device-a',
      grantId: 'grant-a', bundleJson: '{"a":1}', humanityToken: 'tok-a', createdAt: '2026-06-28T00:00:01.000Z',
    });
    recordPublicJoinRequest(db.adapter, {
      publicationId: 'pub-b', communityId: 'cm_a', senderDeviceId: 'device-b',
      grantId: 'grant-b', bundleJson: '{"b":1}', humanityToken: 'tok-b', createdAt: '2026-06-28T00:00:02.000Z',
    });
    recordPublicJoinRequest(db.adapter, {
      publicationId: 'pub-c', communityId: 'cm_other', senderDeviceId: 'device-c',
      grantId: 'grant-c', bundleJson: '{"c":1}', humanityToken: 'tok-c', createdAt: '2026-06-28T00:00:03.000Z',
    });

    expect(listPendingPublicJoinRequests(db.adapter, 'cm_a').map((r) => r.publication_id)).toEqual(['pub-a', 'pub-b']);
    expect(listPendingPublicJoinRequests(db.adapter, 'cm_other').map((r) => r.publication_id)).toEqual(['pub-c']);

    setPublicJoinRequestStatus(db.adapter, 'pub-a', 'device-a', 'declined');
    expect(listPendingPublicJoinRequests(db.adapter, 'cm_a').map((r) => r.publication_id)).toEqual(['pub-b']);
    expect(getPublicJoinRequest(db.adapter, 'pub-a', 'device-a')!.status).toBe('declined');

    setPublicJoinRequestStatus(db.adapter, 'pub-b', 'device-b', 'approved');
    expect(listPendingPublicJoinRequests(db.adapter, 'cm_a')).toEqual([]);
    expect(getPublicJoinRequest(db.adapter, 'pub-b', 'device-b')!.status).toBe('approved');

    expect(getPublicJoinRequest(db.adapter, 'pub-missing', 'device-x')).toBeNull();
    db.close();
  });

  it(
    'data-layer approve wrapper: getCurrentPublicationDescriptor + engine approvePublicJoinRequest '
    + 'parks a real grant and adds the joiner as a member',
    async () => {
      const db = createInMemoryTestDatabase();
      const owner = generateDeviceIdentity('Owner');
      const joiner = generateDeviceIdentity('Joiner');
      const { communityId, signed } = await publishRequestPolicyCommunity(db.adapter, owner);

      const handler = recordPublicJoinRequests({ db: db.adapter, owner, redeem: async () => ({ ok: true }) });
      const q = queuePublicJoinRequest(joiner, signed);
      expect(q.ok).toBe(true);
      if (!q.ok) return;
      await handler.publicJoinRequest!(joiner.publicKey, q.payload, '2026-06-28T00:00:05.000Z');

      const row = getPublicJoinRequest(db.adapter, q.payload.publicationId, joiner.publicKey)!;
      expect(row.status).toBe('pending');

      // Mirrors approvePublicJoinRequestById: reconstruct the CURRENT publication
      // descriptor, then call the real engine function with a fake-but-real park.
      const publication = getCurrentPublicationDescriptor(db.adapter, row.publication_id);
      expect(publication).not.toBeNull();

      const parked: { token: string }[] = [];
      const result = await approvePublicJoinRequest({
        db: db.adapter,
        owner,
        parkEnvelope: (token) => {
          parked.push({ token });
          return true;
        },
        senderDeviceId: row.sender_device_id,
        payload: {
          kind: PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
          version: 1,
          publicationId: row.publication_id,
          communityId: row.community_id,
          grantId: row.grant_id,
          bundle: JSON.parse(row.bundle_json),
          humanityToken: row.humanity_token,
        },
        publication: publication!,
      });

      expect(result).toEqual({ ok: true, communityId });
      expect(parked).toHaveLength(1);

      // Only on ok:true does the app flip the queue row to 'approved'.
      setPublicJoinRequestStatus(db.adapter, row.publication_id, row.sender_device_id, 'approved');
      expect(getPublicJoinRequest(db.adapter, row.publication_id, row.sender_device_id)!.status).toBe('approved');

      // The joiner really landed in the descriptor as a member (the shared
      // invite-path grant rail ran for real; no new key mechanism was invented).
      const stored = getCommunity(db.adapter, communityId);
      expect(communityRole(stored!.descriptor, joiner.publicKey)).toBe('member');
      db.close();
    },
  );

  it('a not_parked failure (no relay reachable) leaves the queue row pending for retry', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const joiner = generateDeviceIdentity('Joiner');
    const { signed } = await publishRequestPolicyCommunity(db.adapter, owner);

    const handler = recordPublicJoinRequests({ db: db.adapter, owner, redeem: async () => ({ ok: true }) });
    const q = queuePublicJoinRequest(joiner, signed);
    if (!q.ok) throw new Error('setup failed');
    await handler.publicJoinRequest!(joiner.publicKey, q.payload, '2026-06-28T00:00:05.000Z');

    const row = getPublicJoinRequest(db.adapter, q.payload.publicationId, joiner.publicKey)!;
    const publication = getCurrentPublicationDescriptor(db.adapter, row.publication_id)!;

    const result = await approvePublicJoinRequest({
      db: db.adapter,
      owner,
      parkEnvelope: () => false, // no relay reachable
      senderDeviceId: row.sender_device_id,
      payload: {
        kind: PUBLIC_JOIN_REQUEST_MAILBOX_KIND,
        version: 1,
        publicationId: row.publication_id,
        communityId: row.community_id,
        grantId: row.grant_id,
        bundle: JSON.parse(row.bundle_json),
        humanityToken: row.humanity_token,
      },
      publication,
    });

    expect(result).toEqual({ ok: false, reason: 'not_parked' });
    // The app never flips status on ok:false: the row stays pending for a retry.
    expect(getPublicJoinRequest(db.adapter, row.publication_id, row.sender_device_id)!.status).toBe('pending');
    db.close();
  });
});
