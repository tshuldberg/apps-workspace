import { describe, expect, it } from 'vitest';
import { createBrowserDatabaseAdapter } from '../storage/browser-database-adapter';
import { nodeLocateFile } from '../storage/__tests__/helpers';
import { clearInvitationIntent, getInvitationIntent, saveInvitationIntent } from '../invitation-intent-core';
import { saveInvitationIntent as mobileSave, getInvitationIntent as mobileGet } from '../../../../meerkat/app/(root)/data/invitation-intent-core';

it('retains invitation intent through a durable close and purchase/setup restart without joining', async () => {
  let bytes: Uint8Array | null = null;
  const bytesStore = { async read() { return bytes; }, async write(next: Uint8Array) { bytes = new Uint8Array(next); } };
  const options = { locateFile: nodeLocateFile(), bytesStore };
  const db = await createBrowserDatabaseAdapter(options);
  db.execute('CREATE TABLE mk_settings(key TEXT PRIMARY KEY, value TEXT)');
  const link = 'meerkat://community/join#unverified-local-intent';
  expect(saveInvitationIntent(db, link)).toBe(true);
  expect(mobileGet(db)).toBe(link);
  await db.close();
  const reopened = await createBrowserDatabaseAdapter(options);
  expect(getInvitationIntent(reopened)).toBe(link);
  expect(reopened.query("SELECT name FROM sqlite_master WHERE name LIKE 'sync_%'")).toEqual([]);
  expect(mobileSave(reopened, 'meerkat://community/join#newer')).toBe(true);
  clearInvitationIntent(reopened, link);
  expect(getInvitationIntent(reopened)).toBe('meerkat://community/join#newer');
  clearInvitationIntent(reopened, 'meerkat://community/join#newer');
  expect(getInvitationIntent(reopened)).toBeNull();
  await reopened.close();
});

describe('untrusted intent input', () => {
  it.each(['https://example.com', 'meerkat://community/join#' + 'a'.repeat(256 * 1024)])('rejects wrong-scope or oversized input', async (link) => {
    const db = await createBrowserDatabaseAdapter({ locateFile: nodeLocateFile(), bytesStore: { async read() { return null; }, async write() {} } });
    db.execute('CREATE TABLE mk_settings(key TEXT PRIMARY KEY, value TEXT)');
    expect(saveInvitationIntent(db, link)).toBe(false);
    expect(getInvitationIntent(db)).toBeNull();
    await db.close();
  });
});
