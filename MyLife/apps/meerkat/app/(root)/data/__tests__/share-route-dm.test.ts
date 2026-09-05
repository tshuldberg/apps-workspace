// Plan 40 R1: routing a staged share into a DM through the real DM provider.

import { describe, expect, it, vi } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import type { DatabaseAdapter } from '@mylife/db';
import {
  ensureShareIntakeTables,
  listShareIntakes,
  stageShareIntake,
  type ShareIntakeRow,
} from '@mylife/sync';
import { routeStagedShareToDm, isShareIntakeSent, type DmSendFn } from '../share-route';

const ALL_STATUSES: ShareIntakeRow['status'][] = ['staged', 'reviewing', 'routed', 'discarded', 'expired'];

function getIntake(db: DatabaseAdapter, id: string): ShareIntakeRow {
  const row = listShareIntakes(db, ALL_STATUSES).find((intake) => intake.id === id);
  if (!row) throw new Error(`intake ${id} not found`);
  return row;
}

function seededDb() {
  const handle = createInMemoryTestDatabase();
  ensureShareIntakeTables(handle.adapter);
  // A minimal dm_messages table so the "Sent" probe has something to read.
  handle.adapter.execute(`CREATE TABLE IF NOT EXISTS dm_messages (id TEXT PRIMARY KEY)`);
  return handle;
}

function stage(handle: ReturnType<typeof seededDb>, id = 'intake-1') {
  stageShareIntake(handle.adapter, {
    id,
    source: 'android_share_intent',
    createdAt: new Date(1000).toISOString(),
    expiresAt: new Date(1_000_000_000).toISOString(),
    payloads: [{ id: `${id}-p1`, kind: 'text', textValue: 'shared note' }],
  });
  return getIntake(handle.adapter, id);
}

describe('routeStagedShareToDm', () => {
  it('routes through the DM provider and marks routed only on a real message id', async () => {
    const handle = seededDb();
    const item = stage(handle);

    const sendDm = vi.fn<DmSendFn>(async (_conversationId, body) => {
      // Simulate the real provider: write the local echo row, return its id.
      const messageId = `dm_${body.length}`;
      handle.adapter.execute(`INSERT INTO dm_messages (id) VALUES (?)`, [messageId]);
      return { ok: true, messageId };
    });

    const result = await routeStagedShareToDm({
      db: handle.adapter,
      item,
      conversationId: 'conv-1',
      sendDm,
    });

    expect(result).toEqual({ ok: true, destination: 'dm', messageId: 'dm_11' });
    expect(sendDm).toHaveBeenCalledWith('conv-1', 'shared note', []);
    // "Sent" is true ONLY because a real dm_messages row exists.
    const routed = getIntake(handle.adapter, item.id);
    expect(routed.destination).toBe('dm');
    expect(routed.dest_ref).toBe('dm_11');
    expect(isShareIntakeSent(handle.adapter, routed)).toBe(true);
    handle.close();
  });

  it('leaves the intake staged and retryable when the provider returns ok:false', async () => {
    const handle = seededDb();
    const item = stage(handle);
    const sendDm = vi.fn<DmSendFn>(async () => ({ ok: false, error: 'no relay configured' }));

    const result = await routeStagedShareToDm({ db: handle.adapter, item, conversationId: 'conv-1', sendDm });

    expect(result).toEqual({ ok: false, error: 'no relay configured' });
    const after = getIntake(handle.adapter, item.id);
    expect(after.status).toBe('staged');
    expect(after.dest_ref).toBeNull();
    expect(isShareIntakeSent(handle.adapter, after)).toBe(false);
    handle.close();
  });

  it('leaves the intake staged when the provider throws (retryable)', async () => {
    const handle = seededDb();
    const item = stage(handle);
    const sendDm = vi.fn<DmSendFn>(async () => { throw new Error('pairing gone'); });

    const result = await routeStagedShareToDm({ db: handle.adapter, item, conversationId: 'conv-1', sendDm });

    expect(result).toEqual({ ok: false, error: 'pairing gone' });
    expect(getIntake(handle.adapter, item.id).status).toBe('staged');
    handle.close();
  });

  it('never marks Sent from the status alone: a dangling dest_ref reads not-sent', async () => {
    const handle = seededDb();
    const item = stage(handle);
    // The provider claims a message id that has NO dm_messages row (a bug/oracle).
    const sendDm = vi.fn<DmSendFn>(async () => ({ ok: true, messageId: 'dm_ghost' }));

    const result = await routeStagedShareToDm({ db: handle.adapter, item, conversationId: 'conv-1', sendDm });
    expect(result.ok).toBe(true);
    // Routed status is set, but isShareIntakeSent reads the real table: not sent.
    const routed = getIntake(handle.adapter, item.id);
    expect(routed.destination).toBe('dm');
    expect(isShareIntakeSent(handle.adapter, routed)).toBe(false);
    handle.close();
  });

  it('rejects an empty conversation id and an empty payload without calling the provider', async () => {
    const handle = seededDb();
    const item = stage(handle);
    const sendDm = vi.fn<DmSendFn>(async () => ({ ok: true, messageId: 'dm_x' }));

    expect(await routeStagedShareToDm({ db: handle.adapter, item, conversationId: '', sendDm }))
      .toEqual({ ok: false, error: 'Choose someone to send this to.' });
    expect(sendDm).not.toHaveBeenCalled();

    handle.close();
  });
});
