import { describe, expect, it } from 'vitest';
import {
  feedStatus,
  loaded,
  MISSING,
  OUTAGE,
  pageDisposition,
  RETRY_AFTER_SECONDS,
  UNCONFIGURED,
} from '../lib/load-result';
import { createBoundedFetch, CLOUD_READ_TIMEOUT_MS } from '../lib/http';

/**
 * Plan 48 WP10. The site used to answer 404 for every failure, including an
 * outage, which is how a live article quietly leaves a search index. These assert
 * the mapping that replaced it.
 */

describe('pageDisposition', () => {
  it('renders a loaded record', () => {
    expect(pageDisposition(loaded({ id: 'a' }))).toBe('render');
  });

  it('404s when the backend answered and had no such record', () => {
    expect(pageDisposition(MISSING)).toBe('not-found');
  });

  it('404s an unconfigured deployment: there is nothing to serve and nothing to retry', () => {
    expect(pageDisposition(UNCONFIGURED)).toBe('not-found');
  });

  it('never 404s an outage, because the URL is not known to be wrong', () => {
    expect(pageDisposition(OUTAGE)).toBe('outage');
  });
});

describe('feedStatus', () => {
  it('503s an outage so aggregators retry instead of recording an empty feed', () => {
    expect(feedStatus(OUTAGE)).toBe(503);
  });

  it('200s every non-outage state, including unconfigured (empty is the truth there)', () => {
    expect(feedStatus(loaded([]))).toBe(200);
    expect(feedStatus(UNCONFIGURED)).toBe(200);
    expect(feedStatus(MISSING)).toBe(200);
  });

  it('advertises a retry window a crawler can act on', () => {
    expect(RETRY_AFTER_SECONDS).toBeGreaterThan(0);
    expect(RETRY_AFTER_SECONDS).toBeLessThanOrEqual(600);
  });
});

describe('createBoundedFetch', () => {
  it('attaches an abort signal to a call that has none', async () => {
    let seen: AbortSignal | null | undefined;
    const bounded = createBoundedFetch(1_000, (async (_input, init) => {
      seen = init?.signal;
      return new Response('ok');
    }) as typeof fetch);

    await bounded('https://example.test/');
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(seen?.aborted).toBe(false);
  });

  it('aborts a call that outlives the deadline', async () => {
    const bounded = createBoundedFetch(10, ((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch);

    await expect(bounded('https://example.test/')).rejects.toThrow('aborted');
  });

  it('honours a caller signal as well as the deadline, rather than replacing it', async () => {
    const controller = new AbortController();
    const bounded = createBoundedFetch(60_000, ((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof fetch);

    const pending = bounded('https://example.test/', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
  });

  it('passes the rest of the init through untouched', async () => {
    let seen: RequestInit | undefined;
    const bounded = createBoundedFetch(1_000, (async (_input, init) => {
      seen = init;
      return new Response('ok');
    }) as typeof fetch);

    await bounded('https://example.test/', { method: 'POST', headers: { apikey: 'k' } });
    expect(seen?.method).toBe('POST');
    expect(seen?.headers).toEqual({ apikey: 'k' });
  });

  it('keeps the SSR read deadline short enough to be worth waiting for', () => {
    expect(CLOUD_READ_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
    expect(CLOUD_READ_TIMEOUT_MS).toBeGreaterThan(500);
  });
});
