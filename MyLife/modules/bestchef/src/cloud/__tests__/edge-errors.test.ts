import { describe, expect, it } from 'vitest';

import {
  classifyEdgeStatus,
  extractEdgeErrorEnvelope,
  parseEdgeFunctionError,
} from '../edge-errors';
import { describeMediaUploadError, mediaFailureFromParsedError } from '../media-errors';

function fakeHttpError(status: number, body: unknown) {
  return {
    name: 'FunctionsHttpError',
    message: 'Edge Function returned a non-2xx status code',
    context: {
      status,
      json: async () => body,
    },
  };
}

describe('extractEdgeErrorEnvelope', () => {
  it('reads kind, message, and params from the standard envelope', () => {
    expect(
      extractEdgeErrorEnvelope({
        ok: false,
        error: { kind: 'file_too_large', message: 'too big', params: { maxBytes: 100 } },
      }),
    ).toEqual({ kind: 'file_too_large', message: 'too big', params: { maxBytes: 100 } });
  });

  it('returns null for bodies without a machine kind', () => {
    expect(extractEdgeErrorEnvelope(null)).toBeNull();
    expect(extractEdgeErrorEnvelope('nope')).toBeNull();
    expect(extractEdgeErrorEnvelope({ error: 'plain string' })).toBeNull();
    expect(extractEdgeErrorEnvelope({ error: { message: 'no kind' } })).toBeNull();
    expect(extractEdgeErrorEnvelope({ error: { kind: '  ' } })).toBeNull();
  });
});

describe('classifyEdgeStatus', () => {
  it('maps status families to coarse kinds', () => {
    expect(classifyEdgeStatus(401)).toBe('auth');
    expect(classifyEdgeStatus(403)).toBe('auth');
    expect(classifyEdgeStatus(429)).toBe('rate_limited');
    expect(classifyEdgeStatus(404)).toBe('not_found');
    expect(classifyEdgeStatus(400)).toBe('invalid_input');
    expect(classifyEdgeStatus(503)).toBe('service_unavailable');
    expect(classifyEdgeStatus(null)).toBe('unknown');
  });

  it('treats bodyless gateway 413/415 as permanent, never retryable-unknown', () => {
    expect(classifyEdgeStatus(413)).toBe('invalid_input');
    expect(classifyEdgeStatus(415)).toBe('invalid_input');
  });
});

describe('parseEdgeFunctionError', () => {
  it('reads the machine envelope out of a FunctionsHttpError context', async () => {
    const parsed = await parseEdgeFunctionError(
      fakeHttpError(400, {
        ok: false,
        error: { kind: 'file_too_large', message: 'too big', params: { maxBytes: 2097152 } },
      }),
    );
    expect(parsed).toMatchObject({
      kind: 'file_too_large',
      message: 'too big',
      params: { maxBytes: 2097152 },
      status: 400,
      network: false,
    });
  });

  it('falls back to status-only when the body is unreadable', async () => {
    const parsed = await parseEdgeFunctionError({
      name: 'FunctionsHttpError',
      context: {
        status: 429,
        json: async () => {
          throw new Error('body consumed');
        },
      },
    });
    expect(parsed).toMatchObject({ kind: null, status: 429, network: false });
  });

  it('flags fetch failures as network', async () => {
    const parsed = await parseEdgeFunctionError({
      name: 'FunctionsFetchError',
      message: 'Failed to send a request',
    });
    expect(parsed).toMatchObject({ kind: null, status: null, network: true });
  });

  it('treats TypeError as network ONLY for known fetch-failure messages', async () => {
    const rnFetch = await parseEdgeFunctionError({
      name: 'TypeError',
      message: 'Network request failed',
    });
    expect(rnFetch.network).toBe(true);

    const bug = await parseEdgeFunctionError({
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'invoke')",
    });
    expect(bug.network).toBe(false);
  });

  it('prefers context.clone() (the real Response path) and survives clone() throwing', async () => {
    let cloneCalled = false;
    const viaClone = await parseEdgeFunctionError({
      name: 'FunctionsHttpError',
      context: {
        status: 400,
        clone() {
          cloneCalled = true;
          return { status: 400, json: async () => ({ ok: false, error: { kind: 'invalid_input', message: 'x' } }) };
        },
        json: async () => {
          throw new Error('original body must not be read when clone exists');
        },
      },
    });
    expect(cloneCalled).toBe(true);
    expect(viaClone.kind).toBe('invalid_input');

    const cloneThrows = await parseEdgeFunctionError({
      name: 'FunctionsHttpError',
      context: {
        status: 429,
        clone() {
          throw new Error('body already consumed');
        },
        json: async () => ({}),
      },
    });
    expect(cloneThrows).toMatchObject({ kind: null, status: 429 });
  });

  it('never throws on junk input', async () => {
    expect(await parseEdgeFunctionError(null)).toMatchObject({ kind: null, network: false });
    expect(await parseEdgeFunctionError('boom')).toMatchObject({ kind: null });
  });
});

describe('mediaFailureFromParsedError', () => {
  it('maps file_too_large with maxMb display params', async () => {
    const failure = mediaFailureFromParsedError(
      await parseEdgeFunctionError(
        fakeHttpError(400, {
          ok: false,
          error: { kind: 'file_too_large', message: 'x', params: { maxBytes: 2 * 1024 * 1024 } },
        }),
      ),
    );
    expect(failure).toMatchObject({
      ok: false,
      code: 'file_too_large',
      retryable: false,
      params: { maxMb: 2 },
    });
    expect(failure.message).toContain('{maxMb}');
  });

  it('maps auth, rate limits, and config outages', async () => {
    // 403 + kind 'auth' means "signed in but no profile yet": the copy must
    // not tell an authenticated user to sign in.
    const profileRequired = mediaFailureFromParsedError(
      await parseEdgeFunctionError(fakeHttpError(403, { ok: false, error: { kind: 'auth', message: 'x' } })),
    );
    expect(profileRequired.code).toBe('profile_required');

    const auth = mediaFailureFromParsedError(
      await parseEdgeFunctionError(fakeHttpError(401, { ok: false, error: { kind: 'auth', message: 'x' } })),
    );
    expect(auth.code).toBe('auth');

    const rate = mediaFailureFromParsedError(
      await parseEdgeFunctionError(fakeHttpError(429, { ok: false, error: { kind: 'rate_limited', message: 'x' } })),
    );
    expect(rate.code).toBe('rate_limited');

    const config = mediaFailureFromParsedError(
      await parseEdgeFunctionError(fakeHttpError(503, { ok: false, error: { kind: 'config', message: 'x' } })),
    );
    expect(config).toMatchObject({ code: 'service_unavailable', retryable: true });
  });

  it('classifies by status when the body kind is missing, and network when offline', async () => {
    const byStatus = mediaFailureFromParsedError(
      await parseEdgeFunctionError({ name: 'FunctionsHttpError', context: { status: 404, json: async () => ({}) } }),
    );
    expect(byStatus.code).toBe('not_found');

    const offline = mediaFailureFromParsedError(
      await parseEdgeFunctionError({ name: 'FunctionsFetchError' }),
    );
    expect(offline).toMatchObject({ code: 'network', retryable: true });
  });
});

describe('describeMediaUploadError', () => {
  it('marks only transient codes retryable', () => {
    const retryable = (['service_unavailable', 'network', 'unknown'] as const).map(
      (code) => describeMediaUploadError(code).retryable,
    );
    expect(retryable).toEqual([true, true, true]);
    const permanent = (
      [
        'file_too_large',
        'unsupported_media_type',
        'invalid_input',
        'auth',
        'profile_required',
        'rate_limited',
        'not_found',
      ] as const
    ).map((code) => describeMediaUploadError(code).retryable);
    expect(permanent).toEqual([false, false, false, false, false, false, false]);
  });
});

