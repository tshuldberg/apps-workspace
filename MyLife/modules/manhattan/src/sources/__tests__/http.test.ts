import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FetchImpl, FetchResponse } from '../types';
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  SourceTimeoutError,
  fetchWithTimeout,
} from '../http';
import { nycOpenDataAdapter } from '../nyc-open-data';

function jsonResponse(body: unknown): FetchResponse {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when the fetch settles before the deadline', async () => {
    const fetchImpl: FetchImpl = async () => jsonResponse([]);
    await expect(fetchWithTimeout(fetchImpl, 'https://x.test', undefined, 50))
      .resolves.toMatchObject({ ok: true });
  });

  it('rejects with SourceTimeoutError when the fetch hangs', async () => {
    const fetchImpl: FetchImpl = () => new Promise(() => {});
    const pending = fetchWithTimeout(fetchImpl, 'https://x.test', undefined, 1000);
    const assertion = expect(pending).rejects.toBeInstanceOf(SourceTimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });

  it('passes an abort signal through and aborts it on timeout', async () => {
    let seenSignal: AbortSignal | undefined;
    const fetchImpl: FetchImpl = (_url, init) => {
      seenSignal = (init as { signal?: AbortSignal } | undefined)?.signal;
      return new Promise(() => {});
    };
    const pending = fetchWithTimeout(fetchImpl, 'https://x.test', undefined, 1000);
    const assertion = expect(pending).rejects.toBeInstanceOf(SourceTimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(seenSignal).toBeDefined();
    expect(seenSignal?.aborted).toBe(true);
  });

  it('defaults to a 10s deadline', () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(10_000);
  });
});

describe('adapter response caps', () => {
  it('caps NYC Open Data rows at the requested limit even when the server over-returns', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      event_id: `e${i}`,
      title: `Event ${i}`,
    }));
    const fetchImpl: FetchImpl = async () => jsonResponse(rows);
    const events = await nycOpenDataAdapter.fetchEvents({ limit: 50 }, fetchImpl);
    expect(events).toHaveLength(50);
  });
});
