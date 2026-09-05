import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildStructuredLine,
  captureError,
  parseSentryDsn,
} from '../observability.ts';

const FIXED = () => new Date('2026-07-11T00:00:00.000Z');

describe('buildStructuredLine', () => {
  it('shapes an Error into a structured line', () => {
    const line = buildStructuredLine({ fn: 'bestchef-media-purge', op: 'runMediaPurge' }, new Error('boom'), FIXED);
    expect(line).toMatchObject({
      level: 'error',
      service: 'bestchef-edge',
      fn: 'bestchef-media-purge',
      op: 'runMediaPurge',
      message: 'boom',
      timestamp: '2026-07-11T00:00:00.000Z',
    });
    expect(line.stack).toContain('boom');
  });

  it('handles non-Error throwables', () => {
    const line = buildStructuredLine({ fn: 'x' }, 'string failure', FIXED);
    expect(line.message).toBe('string failure');
    expect(line.stack).toBeUndefined();
    expect(line.op).toBeUndefined();
  });

  it('carries extra structured fields', () => {
    const line = buildStructuredLine({ fn: 'x', extra: { queueId: 'q1' } }, new Error('e'), FIXED);
    expect(line.extra).toEqual({ queueId: 'q1' });
  });
});

describe('parseSentryDsn', () => {
  it('returns null for absent DSN', () => {
    expect(parseSentryDsn(undefined)).toBeNull();
  });

  it('returns null for malformed DSN', () => {
    expect(parseSentryDsn('not a url')).toBeNull();
  });

  it('parses a well-formed DSN into a store endpoint', () => {
    const parsed = parseSentryDsn('https://pubkey@o123.ingest.sentry.io/456');
    expect(parsed).toEqual({
      url: 'https://o123.ingest.sentry.io/api/456/store/',
      publicKey: 'pubkey',
    });
  });
});

describe('captureError', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('always writes a structured console.error line', async () => {
    await captureError({ fn: 'bestchef-url-resign', op: 'runUrlResign' }, new Error('nope'), {
      env: () => undefined,
      now: FIXED,
    });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(payload.fn).toBe('bestchef-url-resign');
    expect(payload.message).toBe('nope');
    expect(payload.service).toBe('bestchef-edge');
  });

  it('never throws when extra is a circular reference', async () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(
      captureError({ fn: 'x', op: 'op', extra: circular }, new Error('e'), {
        env: () => undefined,
        now: FIXED,
      }),
    ).resolves.toBeUndefined();
    // The line was still written, with the offending extra replaced.
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(payload.fn).toBe('x');
    expect(payload.extra).toBe('[unserializable]');
  });

  it('does not forward to Sentry when SENTRY_DSN is unset', async () => {
    const fetchImpl = vi.fn();
    await captureError({ fn: 'x' }, new Error('e'), { env: () => undefined, fetch: fetchImpl, now: FIXED });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('forwards to Sentry when SENTRY_DSN is set (fire and forget)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await captureError({ fn: 'x', op: 'op' }, new Error('e'), {
      env: (k) => (k === 'SENTRY_DSN' ? 'https://pub@o1.ingest.sentry.io/2' : undefined),
      fetch: fetchImpl,
      now: FIXED,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://o1.ingest.sentry.io/api/2/store/');
    expect(init.method).toBe('POST');
    expect(init.headers['x-sentry-auth']).toContain('sentry_key=pub');
    const body = JSON.parse(init.body as string);
    // No user scope is ever attached from the edge tier.
    expect(body.user).toBeUndefined();
    expect(body.tags.fn).toBe('x');
  });

  it('never throws when the forward fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(
      captureError({ fn: 'x' }, new Error('e'), {
        env: (k) => (k === 'SENTRY_DSN' ? 'https://pub@o1.ingest.sentry.io/2' : undefined),
        fetch: fetchImpl,
        now: FIXED,
      }),
    ).resolves.toBeUndefined();
    // The structured line was still written.
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
