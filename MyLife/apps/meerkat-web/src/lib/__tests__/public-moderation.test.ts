// Plan 19 P8b (web twin): owner moderation core (the Public reports owner-fetch +
// the real Unpublish orchestration). Drives the SHIPPING web functions against
// stubbed fetch/announce seams. Byte-parity with the mobile
// apps/meerkat/app/__tests__/public-moderation.test.ts; the only difference is the
// schema/seed import path (ensureSyncSchema + meerkat-data here).

import { describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createPublicAbuseReport,
  deriveCategoryRid,
  generateDeviceIdentity,
  verifyPublicReportFetchSignature,
  type DeviceIdentity,
} from '@mylife/sync';
import { ensureSyncSchema } from '../schema';
import { insertMessageRow } from '../meerkat-data';
import {
  PUBLIC_REPORTS_COPY,
  fetchOwnerPublicReports,
  listOwnedPublications,
  listReviewedReportSigs,
  markPublicReportReviewed,
  publishChannelPublicly,
  unpublishPublicly,
} from '../public-publish';

type Adapter = ReturnType<typeof createInMemoryTestDatabase>['adapter'];

const COMMUNITY = 'cm_pub';
const CHANNEL = 'general';

const accept200 = (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;

async function publishOne(adapter: Adapter, owner: DeviceIdentity, hosts: string[], fetchFn: typeof fetch = accept200): Promise<string> {
  ensureSyncSchema(adapter);
  insertMessageRow(adapter, createChannelMessage(owner, {
    communityId: COMMUNITY, channelId: CHANNEL, body: 'hello public', hlc: { wall: '2026-06-29T00:00:01.000Z', counter: 0 },
  }));
  const res = await publishChannelPublicly(
    {
      randomBytes: (n: number) => new Uint8Array(randomBytes(n)),
      now: () => '2026-06-29T00:00:00.000Z',
      announcePublication: vi.fn(async () => {}),
      announceHeldContent: vi.fn(async () => {}),
      fetchFn,
    },
    {
      db: adapter, identity: owner, communityId: COMMUNITY, channelId: CHANNEL,
      title: 'Public Channel', description: 'Anyone can read', category: 'technology',
      hostUrls: hosts, directoryUrl: 'wss://dir.example',
    },
  );
  expect(res.state).toBe('success');
  return res.publicationId!;
}

describe('P8b owner Public-reports fetch (owner-signed GET)', () => {
  it('sends owner-signed headers, sorts priority-first, and verifies the signature', async () => {
    const owner = generateDeviceIdentity('Owner');
    const reporterA = generateDeviceIdentity('ReporterA');
    const reporterB = generateDeviceIdentity('ReporterB');
    const spam = createPublicAbuseReport(reporterA, { publicationId: 'pub_x', targetKind: 'post', targetId: 'p1', reason: 'spam', reportedAt: '2026-06-29T00:00:00.000Z' });
    const csam = createPublicAbuseReport(reporterB, { publicationId: 'pub_x', targetKind: 'community', targetId: 'cm', reason: 'csam', reportedAt: '2026-06-29T00:00:05.000Z' });

    let captured: { url: string; headers: Record<string, string> } = { url: '', headers: {} };
    const fetchFn = (async (url: string | URL, init?: { headers?: Record<string, string> }) => {
      captured = { url: String(url), headers: init?.headers ?? {} };
      return new Response(JSON.stringify({ reports: [
        { report: spam.report, signature: spam.signature, priority: false },
        { report: csam.report, signature: csam.signature, priority: true },
      ] }), { status: 200 });
    }) as unknown as typeof fetch;

    const res = await fetchOwnerPublicReports(
      { identity: owner, publicationId: 'pub_x', hostUrls: ['https://host.example/'] },
      { fetchFn, now: () => '2026-06-29T00:01:00.000Z' },
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.reports[0]!.report.reason).toBe('csam');
      expect(res.reports[0]!.priority).toBe(true);
      expect(res.reports[1]!.report.reason).toBe('spam');
      expect(res.reports[1]!.priority).toBe(false);
    }
    expect(captured.url).toBe('https://host.example/public/pub_x/reports');
    expect(captured.headers['x-mk-ts']).toBe('2026-06-29T00:01:00.000Z');
    expect(verifyPublicReportFetchSignature(owner.publicKey, 'pub_x', '2026-06-29T00:01:00.000Z', captured.headers['x-mk-owner-sig']!)).toBe(true);
  });

  it('honest failures: no hosts -> no_hosts; all non-200 -> unreachable', async () => {
    const owner = generateDeviceIdentity('Owner');
    const none = await fetchOwnerPublicReports({ identity: owner, publicationId: 'pub_x', hostUrls: [] });
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.reason).toBe('no_hosts');

    const downFetch = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    const down = await fetchOwnerPublicReports(
      { identity: owner, publicationId: 'pub_x', hostUrls: ['https://h.example'] },
      { fetchFn: downFetch },
    );
    expect(down.ok).toBe(false);
    if (!down.ok) expect(down.reason).toBe('unreachable');
  });
});

describe('P8b listOwnedPublications + local reviewed markers', () => {
  it('lists owned publications and persists reviewed markers per publication', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const pubId = await publishOne(db.adapter, owner, ['https://h.example']);

    const owned = listOwnedPublications(db.adapter, owner.publicKey, COMMUNITY);
    expect(owned).toHaveLength(1);
    expect(owned[0]!.publicationId).toBe(pubId);
    expect(owned[0]!.status).toBe('active');

    expect(listOwnedPublications(db.adapter, generateDeviceIdentity('Other').publicKey, COMMUNITY)).toHaveLength(0);

    expect(listReviewedReportSigs(db.adapter, pubId).size).toBe(0);
    markPublicReportReviewed(db.adapter, pubId, 'sig-abc', '2026-06-29T00:00:00.000Z');
    expect(listReviewedReportSigs(db.adapter, pubId).has('sig-abc')).toBe(true);
    db.close();
  });
});

describe('P8b unpublishPublicly orchestration', () => {
  it('re-registers the unpublished revision + re-announces under the category rid + flips local status', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const hosts = ['https://host-1.example'];
    const pubId = await publishOne(db.adapter, owner, hosts);

    const registered: Array<{ url: string; body: { descriptor: { descriptor: { status: string; revision: number } }; snapshots: Array<{ pieces: string[] }> } }> = [];
    const fetchFn = (async (url: string | URL, init?: { body?: string }) => {
      registered.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const announceHost = vi.fn(async (_input: { url: string; rid: string; record: string }) => {});

    const result = await unpublishPublicly(
      { fetchFn, announceHost, now: () => '2026-06-29T01:00:00.000Z' },
      { db: db.adapter, identity: owner, publicationId: pubId, directoryUrl: 'wss://dir.example' },
    );

    expect(result.ok).toBe(true);
    expect(result.directoryRemoved).toBe(true);
    expect(result.removedHosts).toBe(1);
    expect(result.message).toBe(PUBLIC_REPORTS_COPY.unpublishedFull);

    expect(registered).toHaveLength(1);
    expect(registered[0]!.url).toBe(`https://host-1.example/public/${pubId}/register`);
    expect(registered[0]!.body.descriptor.descriptor.status).toBe('unpublished');
    expect(registered[0]!.body.descriptor.descriptor.revision).toBe(2);
    expect(registered[0]!.body.snapshots[0]!.pieces.length).toBeGreaterThan(0);

    expect(announceHost).toHaveBeenCalledTimes(1);
    const annArg = announceHost.mock.calls[0]![0];
    expect(annArg.url).toBe('wss://dir.example');
    expect(annArg.rid).toBe(deriveCategoryRid('technology'));
    expect((JSON.parse(annArg.record) as { descriptor: { status: string } }).descriptor.status).toBe('unpublished');

    const row = db.adapter.query<{ status: string; revision: number }>(
      'SELECT status, revision FROM cm_publications WHERE publication_id = ?', [pubId],
    )[0];
    expect(row?.status).toBe('unpublished');
    expect(row?.revision).toBe(2);

    const again = await unpublishPublicly(
      { fetchFn, announceHost },
      { db: db.adapter, identity: owner, publicationId: pubId, directoryUrl: 'wss://dir.example' },
    );
    expect(again.ok).toBe(false);
    expect(again.reason).toBe('already_unpublished');
    db.close();
  });

  it('honest guards: unknown publication and non-owner are refused without side effects', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const stranger = generateDeviceIdentity('Stranger');
    const pubId = await publishOne(db.adapter, owner, ['https://h.example']);
    const announceHost = vi.fn(async (_input: { url: string; rid: string; record: string }) => {});

    const missing = await unpublishPublicly(
      { fetchFn: accept200, announceHost },
      { db: db.adapter, identity: owner, publicationId: 'does-not-exist', directoryUrl: 'wss://dir' },
    );
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe('not_found');

    const notOwner = await unpublishPublicly(
      { fetchFn: accept200, announceHost },
      { db: db.adapter, identity: stranger, publicationId: pubId, directoryUrl: 'wss://dir' },
    );
    expect(notOwner.ok).toBe(false);
    expect(notOwner.reason).toBe('not_owner');
    expect(announceHost).not.toHaveBeenCalled();

    const row = db.adapter.query<{ status: string }>(
      'SELECT status FROM cm_publications WHERE publication_id = ?', [pubId],
    )[0];
    expect(row?.status).toBe('active');
    db.close();
  });

  it('no local snapshot -> directory-only removal, reported honestly', async () => {
    const db = createInMemoryTestDatabase();
    const owner = generateDeviceIdentity('Owner');
    const pubId = await publishOne(db.adapter, owner, ['https://host-1.example']);
    db.adapter.execute('DELETE FROM cm_publication_snapshots WHERE publication_id = ?', [pubId]);

    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as unknown as typeof fetch;
    const announceHost = vi.fn(async (_input: { url: string; rid: string; record: string }) => {});
    const result = await unpublishPublicly(
      { fetchFn, announceHost, now: () => '2026-06-29T01:00:00.000Z' },
      { db: db.adapter, identity: owner, publicationId: pubId, directoryUrl: 'wss://dir.example' },
    );
    expect(result.ok).toBe(true);
    expect(result.directoryRemoved).toBe(true);
    expect(result.removedHosts).toBe(0);
    expect(result.message).toBe(PUBLIC_REPORTS_COPY.unpublishedDirectoryOnly);
    expect(fetchFn).not.toHaveBeenCalled();
    db.close();
  });
});
