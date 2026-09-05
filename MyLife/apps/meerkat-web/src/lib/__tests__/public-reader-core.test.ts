import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  createChannelMessage,
  createPublication,
  generateDeviceIdentity,
  type ChannelMessageEvent,
  type FetchPublicSnapshotResult,
  type SignedPublicationDescriptor,
} from '@mylife/sync';
import { createChannelPostEvent, createChannelPostReplyEvent } from '../meerkat-data';
import { ensureSyncSchema } from '../schema';
import {
  READER_COPY,
  PUBLIC_REPORT_REASONS,
  groupChannelEvents,
  groupPublicSnapshot,
  loadingOlderLabel,
  persistPublicReport,
  selectReaderState,
  skippedItemsLabel,
} from '../public-reader-core';

function signedDescriptor(): SignedPublicationDescriptor {
  const owner = generateDeviceIdentity('Publisher');
  return createPublication(owner, {
    kind: 'community',
    communityId: 'comm-1',
    title: 'Backcountry Cooks',
    description: 'Open fire recipes',
    category: 'hobbies',
    contentId: 'content-hash-1',
    publicKeyHex: 'cd'.repeat(16),
    hostUrls: ['https://seed.example'],
    now: '2026-06-24T09:00:00.000Z',
  });
}

function okResult(events: ChannelMessageEvent[]): FetchPublicSnapshotResult {
  return {
    ok: true,
    descriptor: signedDescriptor(),
    channels: [{ channelId: 'general', events }],
    events,
  };
}

let db: InMemoryTestDatabase;
beforeEach(() => {
  db = createInMemoryTestDatabase();
  ensureSyncSchema(db.adapter);
});
afterEach(() => db.close());

describe('public-reader-core verbatim copy', () => {
  it('carries the section 7.2 + section 9 copy', () => {
    expect(READER_COPY.banner).toBe(
      'You are reading public content. Anyone can read this. It is signed by its authors so it cannot be forged, but it is not private.',
    );
    expect(READER_COPY.join).toBe('Reading is free. Create an identity and join to post or reply.');
    expect(READER_COPY.loading).toBe('Fetching public content from a serving host…');
    expect(READER_COPY.empty).toBe('This public space has no posts yet');
    expect(READER_COPY.errorTitle).toBe('Could not load this public content');
    expect(READER_COPY.errorBody).toBe(
      'No serving host returned verified content. The publisher may have unpublished it, or no host is online.',
    );
    expect(READER_COPY.reportSavedLocal).toBe(
      'Saved on this device. It will be sent when a connection server is available.',
    );
    expect(READER_COPY.audienceLabel).toBe('Public');
    expect(loadingOlderLabel(3)).toBe('Loading older history… 3 more pieces');
    expect(loadingOlderLabel(1)).toBe('Loading older history… 1 more piece');
    expect(skippedItemsLabel(2)).toBe('2 items skipped (failed verification)');
    expect(skippedItemsLabel(1)).toBe('1 item skipped (failed verification)');
  });

  it('exposes the fixed section 9 reason taxonomy', () => {
    expect(PUBLIC_REPORT_REASONS.map((r) => r.code)).toEqual([
      'spam', 'harassment', 'illegal', 'csam', 'violence', 'other',
    ]);
  });
});

describe('public-reader-core 5-state selection', () => {
  const events = [
    createChannelPostEvent(generateDeviceIdentity('A'), {
      communityId: 'comm-1', channelId: 'general', body: 'Hello',
      hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 },
    }),
  ];

  it('Loading: fetch in flight with nothing shown', () => {
    expect(selectReaderState({ inFlight: true, shownItems: 0, result: null })).toEqual({ kind: 'loading' });
    expect(selectReaderState({ inFlight: false, shownItems: 0, result: null })).toEqual({ kind: 'loading' });
  });

  it('Partial: refresh in flight while items are already shown', () => {
    const state = selectReaderState({ inFlight: true, shownItems: 4, result: okResult(events), skipped: 1 });
    expect(state).toEqual({ kind: 'partial', morePieces: 4, skipped: 1 });
  });

  it('Error: fetch failed / killed / unreachable', () => {
    const state = selectReaderState({ inFlight: false, shownItems: 0, result: { ok: false, reason: 'not_found' } });
    expect(state).toEqual({ kind: 'error', detail: READER_COPY.errorBody });
  });

  it('Empty: verified snapshot with zero events', () => {
    expect(selectReaderState({ inFlight: false, shownItems: 0, result: okResult([]) })).toEqual({ kind: 'empty' });
  });

  it('Success: verified events present', () => {
    expect(selectReaderState({ inFlight: false, shownItems: 1, result: okResult(events) })).toEqual({ kind: 'success' });
  });
});

describe('public-reader-core verified grouping', () => {
  it('groups posts, replies, and plain messages from verified events', () => {
    const author = generateDeviceIdentity('Author');
    const root = createChannelPostEvent(author, {
      communityId: 'comm-1', channelId: 'general', body: 'Trip plan',
      hlc: { wall: '2026-06-24T10:00:00.000Z', counter: 0 },
    });
    const reply = createChannelPostReplyEvent(author, {
      parent: root, body: 'Added the tent',
      hlc: { wall: '2026-06-24T10:01:00.000Z', counter: 0 },
    });
    const message = createChannelMessage(author, {
      communityId: 'comm-1', channelId: 'general', body: 'Plain chat',
      hlc: { wall: '2026-06-24T10:02:00.000Z', counter: 0 },
    });

    const group = groupChannelEvents('general', [root, reply, message]);
    expect(group.channelId).toBe('general');
    expect(group.posts).toHaveLength(1);
    expect(group.posts[0]?.replies).toHaveLength(1);
    expect(group.posts[0]?.root.id).toBe(root.id);
    expect(group.messages).toHaveLength(1);
    expect(group.messages[0]?.body).toBe('Plain chat');

    const grouped = groupPublicSnapshot([{ channelId: 'general', events: [root, reply, message] }]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.posts).toHaveLength(1);
  });
});

describe('public-reader-core report persistence + delivery', () => {
  it('writes a signed local cm_public_reports row and stays saved-local with no hosts', async () => {
    const reporter = generateDeviceIdentity('Reporter');
    const result = await persistPublicReport(db.adapter, {
      publicationId: 'pub-1',
      targetKind: 'post',
      targetId: 'post-xyz',
      reason: 'spam',
      reporter,
      now: () => '2026-06-24T12:00:00.000Z',
    });
    expect(result.status).toBe('open');
    expect(result.notice).toBe(READER_COPY.reportSavedLocal);
    expect(result.delivered).toBe(0);
    expect(result.attempted).toBe(0);

    const rows = db.adapter.query<{
      report_id: string;
      reason: string;
      signature_hex: string;
      reporter_device_id: string;
      status: string;
    }>(`SELECT report_id, reason, signature_hex, reporter_device_id, status FROM cm_public_reports`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe('spam');
    expect(rows[0]?.status).toBe('open');
    expect(rows[0]?.reporter_device_id).toBe(reporter.publicKey);
    expect(rows[0]?.signature_hex.length).toBeGreaterThan(0);
    expect(rows[0]?.report_id).toBe(result.reportId);
  });

  it('delivers to >=1 reachable host -> "Sent to the host." (POSTs the signed report)', async () => {
    const reporter = generateDeviceIdentity('Reporter');
    const posted: Array<{ url: string; body: string }> = [];
    const fetchFn = (async (url: string | URL, init?: { body?: string }) => {
      posted.push({ url: String(url), body: String(init?.body ?? '') });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await persistPublicReport(
      db.adapter,
      {
        publicationId: 'pub-2',
        targetKind: 'community',
        targetId: 'cm_x',
        reason: 'csam',
        reporter,
        hostUrls: ['https://host-a.example/', 'https://host-b.example'],
        now: () => '2026-06-24T12:00:00.000Z',
      },
      { fetchFn },
    );
    expect(result.notice).toBe(READER_COPY.reportSentToHost);
    expect(result.delivered).toBe(2);
    expect(result.attempted).toBe(2);
    expect(posted).toHaveLength(2);
    expect(posted[0]?.url).toBe('https://host-a.example/public/pub-2/report');
    const sent = JSON.parse(posted[0]!.body) as { report: { reason: string; reporterDeviceId: string }; signature: string };
    expect(sent.report.reason).toBe('csam');
    expect(sent.report.reporterDeviceId).toBe(reporter.publicKey);
    expect(sent.signature.length).toBeGreaterThan(0);
  });

  it('all hosts failing -> stays saved-local (no faked delivery)', async () => {
    const reporter = generateDeviceIdentity('Reporter');
    const fetchFn = (async () => new Response(JSON.stringify({ ok: false }), { status: 503 })) as unknown as typeof fetch;
    const result = await persistPublicReport(
      db.adapter,
      { publicationId: 'pub-3', targetKind: 'post', targetId: 'p', reason: 'spam', reporter, hostUrls: ['https://down.example'] },
      { fetchFn },
    );
    expect(result.notice).toBe(READER_COPY.reportSavedLocal);
    expect(result.delivered).toBe(0);
    expect(result.attempted).toBe(1);
  });
});
