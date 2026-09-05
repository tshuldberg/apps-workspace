import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHubTestDatabase,
  type DatabaseAdapter,
} from '@mylife/db';
import { saveModeConfig } from '../entitlements';
import { callSyncEndpoint } from '../sync-adapter';

describe('mobile sync adapter', () => {
  let db: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createHubTestDatabase();
    db = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('falls back to local execution when endpoint cannot be resolved', async () => {
    const fallback = vi.fn().mockResolvedValue({ source: 'fallback' });

    const result = await callSyncEndpoint(db, {
      path: 'messages',
      fallback,
    });

    expect(result).toEqual({ source: 'fallback' });
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('builds normalized API URLs with query params for GET requests', async () => {
    saveModeConfig(db, 'self_host', 'https://home.example.com/');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, items: [1, 2] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callSyncEndpoint(db, {
      path: 'messages',
      query: { limit: 10, cursor: 'abc', omitted: undefined },
      fallback: () => ({ ok: false }),
    });

    expect(result).toEqual({ ok: true, items: [1, 2] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://home.example.com/api/messages?limit=10&cursor=abc',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'GET' });
  });

  it('sends JSON request bodies and merged headers for non-GET calls', async () => {
    saveModeConfig(db, 'self_host', 'https://home.example.com');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await callSyncEndpoint(db, {
      path: '/ops/sync',
      method: 'POST',
      headers: {
        'x-test-key': 'value',
      },
      body: { event: 'created' },
      fallback: () => ({ accepted: false }),
    });

    expect(result).toEqual({ accepted: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://home.example.com/api/ops/sync');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-key': 'value',
      },
      body: JSON.stringify({ event: 'created' }),
    });
  });

  it('throws descriptive errors for failing sync responses', async () => {
    saveModeConfig(db, 'self_host', 'https://home.example.com');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Boom', { status: 500 })),
    );

    await expect(
      callSyncEndpoint(db, {
        path: 'messages',
        fallback: () => [],
      }),
    ).rejects.toThrow('Sync request failed (500): Boom');
  });

  it('returns undefined for 204 responses', async () => {
    saveModeConfig(db, 'self_host', 'https://home.example.com');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const result = await callSyncEndpoint<void>(db, {
      path: 'messages',
      method: 'DELETE',
      fallback: () => undefined,
    });

    expect(result).toBeUndefined();
  });
});
