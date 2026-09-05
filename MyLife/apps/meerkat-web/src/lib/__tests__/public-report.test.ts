// WEB twin of apps/meerkat/app/(root)/data/__tests__/public-report.test.ts.
// Public reports are PERSONA-signed (never the device key, NC-P2), fail-closed, and "sent"
// only on a real 200 from the node intake.

import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  generateDeviceIdentity,
  generatePublicPersona,
  verifyPublicAbuseReport,
  type SignedPublicAbuseReport,
} from '@mylife/sync';
import { setStoredPersona } from '../persona-core';
import { PUBLIC_REPORT_CATEGORIES, submitPublicReport } from '../public-report';
import type { CommonsFeedConfig } from '../public-feed';

function fakeSettingsDb(): DatabaseAdapter {
  const store = new Map<string, string>();
  return {
    execute(sql: string, params: unknown[] = []): void {
      if (sql.includes('INSERT OR REPLACE INTO mk_settings')) store.set(String(params[0]), String(params[1]));
      else if (sql.includes('DELETE FROM mk_settings')) store.delete(String(params[0]));
    },
    query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
      if (sql.includes('SELECT value FROM mk_settings')) {
        let key = params.length ? String(params[0]) : '';
        if (!key) { const m = sql.match(/key = '([^']+)'/); if (m) key = m[1]; }
        return store.has(key) ? ([{ value: store.get(key) }] as unknown as T[]) : [];
      }
      return [];
    },
    transaction(fn: () => void): void { fn(); },
  } as unknown as DatabaseAdapter;
}

const FEED: CommonsFeedConfig = {
  nodeUrl: 'https://commons.example',
  topics: [{ channelId: 'gardening', publicationId: 'pub-garden', nodeKeyHex: 'ab'.repeat(32) }],
};
const UNCONFIGURED: CommonsFeedConfig = { nodeUrl: '', topics: [] };

function storePersona(db: DatabaseAdapter): string {
  const persona = generatePublicPersona('duskrunner');
  setStoredPersona(db, { ...persona, alias: 'duskrunner', displayName: '' });
  return persona.personaPubkey;
}

describe('Plan 39 P11 public report web twin (persona-signed, NC-P2)', () => {
  beforeEach(() => { configureSyncSecretStore(createInMemorySyncSecretStore()); });

  it('exposes the S12 categories mapped to the fixed taxonomy incl. the CSAM lane', () => {
    const ids = PUBLIC_REPORT_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual(['spam', 'harassment', 'violence', 'csam', 'illegal']);
    expect(PUBLIC_REPORT_CATEGORIES.find((c) => c.id === 'csam')?.hint).toContain('authorities');
  });

  it('fails closed with no commons feed configured', async () => {
    const db = fakeSettingsDb();
    storePersona(db);
    expect(await submitPublicReport({ db, feedConfig: UNCONFIGURED }, { channelId: 'gardening', targetKind: 'post', targetId: 'p1', reason: 'spam' }))
      .toEqual({ ok: false, reason: 'not_configured' });
  });

  it('needs a persona and a wired topic', async () => {
    const db = fakeSettingsDb();
    expect(await submitPublicReport({ db, feedConfig: FEED }, { channelId: 'gardening', targetKind: 'post', targetId: 'p1', reason: 'spam' }))
      .toEqual({ ok: false, reason: 'no_persona' });
    storePersona(db);
    expect(await submitPublicReport({ db, feedConfig: FEED }, { channelId: 'unknown', targetKind: 'post', targetId: 'p1', reason: 'spam' }))
      .toEqual({ ok: false, reason: 'topic_not_wired' });
  });

  it('signs the report with the PERSONA key (never the device key) and posts it to the intake', async () => {
    const db = fakeSettingsDb();
    const device = generateDeviceIdentity('My Device');
    const personaPubkey = storePersona(db);
    let captured: { url: string; body: string } | null = null;
    const fake = (async (url: string, init: { body: string }) => {
      captured = { url, body: init.body };
      return { status: 200 };
    }) as unknown as typeof fetch;

    const result = await submitPublicReport(
      { db, feedConfig: FEED, fetchImpl: fake },
      { channelId: 'gardening', targetKind: 'post', targetId: 'post-123', reason: 'spam' },
    );
    expect(result).toEqual({ ok: true });
    expect(captured!.url).toBe('https://commons.example/public/pub-garden/report');

    const signed = JSON.parse(captured!.body) as SignedPublicAbuseReport;
    expect(verifyPublicAbuseReport(signed)).toBe(true);
    expect(signed.report.reporterDeviceId).toBe(personaPubkey);
    expect(signed.report.reporterDeviceId).not.toBe(device.publicKey);
    expect(captured!.body.includes(device.publicKey)).toBe(false);
    expect(signed.report.targetId).toBe('post-123');
    expect(signed.report.publicationId).toBe('pub-garden');
    expect(signed.report.reason).toBe('spam');
  });

  it('honest failures: unreachable on a network error, rejected on a non-200', async () => {
    const db = fakeSettingsDb();
    storePersona(db);
    const boom = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await submitPublicReport({ db, feedConfig: FEED, fetchImpl: boom }, { channelId: 'gardening', targetKind: 'post', targetId: 'p1', reason: 'spam' }))
      .toEqual({ ok: false, reason: 'unreachable' });
    const four00 = (async () => ({ status: 400 })) as unknown as typeof fetch;
    expect(await submitPublicReport({ db, feedConfig: FEED, fetchImpl: four00 }, { channelId: 'gardening', targetKind: 'reply', targetId: 'p1', reason: 'harassment' }))
      .toEqual({ ok: false, reason: 'rejected' });
  });
});
