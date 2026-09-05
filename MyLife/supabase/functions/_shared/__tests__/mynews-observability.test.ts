import { describe, expect, it, vi } from 'vitest';

import {
  ALLOWED_LOG_FIELDS,
  annotateRequestLog,
  buildLogLine,
  findForbiddenLogFields,
  hashForLog,
  normalizeRequestId,
  readLogOutcome,
  recordWorkerRun,
  sanitizeAction,
  scrubExtra,
  serializeLogLine,
  tagLogOutcome,
  unverifiedSubject,
  withRequestLog,
} from '../mynews-observability.ts';
import { jsonError, jsonOk, serveEnvelope } from '../mynews-http.ts';

/** Build a bearer token whose payload carries the given subject. */
function bearer(sub: string): string {
  const payload = btoa(JSON.stringify({ sub, iat: 1_700_000_000 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `Bearer header.${payload}.signature`;
}

/** Header pairs via forEach: Headers.entries() is not in the edge tsconfig lib. */
function headerPairs(response: Response): [string, string][] {
  const pairs: [string, string][] = [];
  response.headers.forEach((value, key) => pairs.push([key, value]));
  return pairs.sort();
}

function collector(): { lines: string[]; log: (line: string) => void } {
  const lines: string[] = [];
  return { lines, log: (line) => lines.push(line) };
}

/**
 * The line is emitted synchronously inside the wrapper's `finally`, so it is
 * already written by the time the caller's await resolves. This kept as a
 * no-op-ish yield so the tests still read as "let the request settle" and so a
 * future change back to deferred emission is caught by the same assertions.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('outcome tagging', () => {
  it('records the typed envelope code without changing the response bytes', async () => {
    const tagged = jsonError('rate-limited', 429, 'slow down');
    const plain = new Response(
      JSON.stringify({ ok: false, error: 'rate-limited', detail: 'slow down' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } },
    );

    expect(readLogOutcome(tagged)).toBe('rate-limited');
    expect(await tagged.clone().text()).toBe(await plain.text());
    expect(tagged.status).toBe(429);
    expect(headerPairs(tagged)).toEqual(headerPairs(plain));
    // The tag must not serialize: a symbol key is invisible to JSON and to
    // Object.keys, which is what keeps the wire format identical.
    expect(Object.keys(tagged)).toHaveLength(0);
    expect(JSON.stringify(tagged)).toBe('{}');
  });

  it('tags a success envelope as ok', () => {
    expect(readLogOutcome(jsonOk({ a: 1 }))).toBe('ok');
  });

  it('falls back to a status label for an untagged response', () => {
    expect(readLogOutcome(new Response('', { status: 404 }))).toBe('http-404');
    expect(readLogOutcome(new Response('', { status: 200 }))).toBe('ok');
  });

  it('does not throw on a frozen response', () => {
    const frozen = Object.freeze(new Response('', { status: 200 }));
    expect(() => tagLogOutcome(frozen, 'ok')).not.toThrow();
  });
});

describe('no-PII canary', () => {
  // This is the test that makes "no PII in logs" checkable rather than a comment.
  // It walks a realistic request carrying an email in the body, a bearer token,
  // a forwarded IP, and a user agent, then asserts none of it reaches the line.
  it('emits no field outside the allowlist and no request-borne value', async () => {
    const { lines, log } = collector();
    const email = 'reporter@example.test';
    const token = bearer('11111111-2222-3333-4444-555555555555');
    const wrapped = withRequestLog(
      { fn: 'mynews-report', action: 'submit_report' },
      async () => jsonError('rate-limited', 429),
      { log, clock: (() => { let t = 0; return () => (t += 12); })() },
    );

    const res = await wrapped(
      new Request('https://edge.test/mynews-report?handle=jane&slug=secret-story', {
        method: 'POST',
        headers: {
          Authorization: token,
          'x-forwarded-for': '203.0.113.7',
          'user-agent': 'Mozilla/5.0 (probe)',
          cookie: 'sb-access-token=abcdef',
        },
        body: JSON.stringify({ email, detail: 'he lives at 4 Privet Drive' }),
      }),
    );
    expect(res.status).toBe(429);
    await settle();

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;

    expect(findForbiddenLogFields(parsed)).toEqual([]);
    for (const key of Object.keys(parsed)) {
      expect(ALLOWED_LOG_FIELDS).toContain(key);
    }

    const serialized = lines[0]!;
    for (const secret of [
      email,
      'example.test',
      '203.0.113.7',
      'Mozilla',
      'abcdef',
      'Privet Drive',
      'jane',
      'secret-story',
      '11111111-2222-3333-4444-555555555555',
      token,
    ]) {
      expect(serialized).not.toContain(secret);
    }

    expect(parsed.service).toBe('mynews-edge');
    expect(parsed.fn).toBe('mynews-report');
    expect(parsed.action).toBe('submit_report');
    expect(parsed.outcome).toBe('rate-limited');
    expect(parsed.status).toBe(429);
    expect(parsed.level).toBe('warn');
    expect(typeof parsed.durationMs).toBe('number');
    // The subject is present only as a truncated hash.
    expect(parsed.subjectHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('drops a string extra, keeping only numeric and boolean counters', () => {
    expect(scrubExtra({ count: 3, held: true, headline: 'Mayor resigns', ratio: 0.5 })).toEqual({
      count: 3,
      held: true,
      ratio: 0.5,
    });
  });

  it('drops an extra key that is not identifier-shaped', () => {
    expect(scrubExtra({ 'user email': 1, 'a-b_c': 2 })).toEqual({ 'a-b_c': 2 });
  });

  it('drops a non-finite number so NaN cannot reach the line', () => {
    expect(scrubExtra({ a: Number.NaN, b: Number.POSITIVE_INFINITY, c: 1 })).toEqual({ c: 1 });
  });

  it('reports a forbidden field name inside extra', () => {
    expect(findForbiddenLogFields({ fn: 'x', extra: { email: 1 } })).toEqual(['extra.email']);
  });

  it('reports a top-level field outside the allowlist', () => {
    expect(findForbiddenLogFields({ fn: 'x', ip: '1.2.3.4' })).toContain('ip');
  });
});

describe('action and request-id sanitation', () => {
  it('accepts identifier-shaped actions and rejects anything else', () => {
    expect(sanitizeAction('initiate_deletion')).toBe('initiate_deletion');
    expect(sanitizeAction('escrow-get')).toBe('escrow-get');
    expect(sanitizeAction('Rotate')).toBe('rotate');
    expect(sanitizeAction('drop table nw_reports')).toBeNull();
    expect(sanitizeAction('a'.repeat(64))).toBeNull();
    expect(sanitizeAction('')).toBeNull();
    expect(sanitizeAction('user@example.test')).toBeNull();
  });

  it('refuses an annotated action that is not identifier-shaped', async () => {
    const { lines, log } = collector();
    const wrapped = withRequestLog(
      { fn: 'mynews-account', action: 'account' },
      async (req) => {
        annotateRequestLog(req, { action: 'delete everything for bob@example.test' });
        return jsonOk({});
      },
      { log },
    );
    await wrapped(new Request('https://edge.test/x', { method: 'POST' }));
    await settle();
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    // Falls back to the static action rather than logging the caller's string.
    expect(parsed.action).toBe('account');
    expect(lines[0]).not.toContain('bob@example.test');
  });

  it('accepts a well-formed inbound request id and rejects a smuggled one', () => {
    expect(normalizeRequestId('abc-123-def-456')).toBe('abc-123-def-456');
    expect(normalizeRequestId('short')).toBeNull();
    expect(normalizeRequestId('id with spaces and more')).toBeNull();
    expect(normalizeRequestId('a\n"email":"x@y.z"aaaaaaaa')).toBeNull();
    expect(normalizeRequestId(null)).toBeNull();
  });

  it('reuses a valid inbound request id so a trace spans functions', async () => {
    const { lines, log } = collector();
    const wrapped = withRequestLog({ fn: 'mynews-publish', action: 'publish' }, async () => jsonOk({}), {
      log,
    });
    await wrapped(
      new Request('https://edge.test/x', {
        method: 'POST',
        headers: { 'x-request-id': 'trace-0123456789' },
      }),
    );
    await settle();
    expect((JSON.parse(lines[0]!) as { requestId: string }).requestId).toBe('trace-0123456789');
  });

  it('generates a request id when none is supplied', async () => {
    const { lines, log } = collector();
    const wrapped = withRequestLog({ fn: 'mynews-publish', action: 'publish' }, async () => jsonOk({}), {
      log,
    });
    await wrapped(new Request('https://edge.test/x', { method: 'POST' }));
    await settle();
    expect((JSON.parse(lines[0]!) as { requestId: string }).requestId.length).toBeGreaterThan(7);
  });
});

describe('withRequestLog', () => {
  it('emits exactly one line per request and returns the response unchanged', async () => {
    const { lines, log } = collector();
    const body = jsonOk({ articleId: 'a1' });
    const wrapped = withRequestLog({ fn: 'mynews-publish', action: 'publish' }, async () => body, {
      log,
    });
    const res = await wrapped(new Request('https://edge.test/x', { method: 'POST' }));
    await settle();
    expect(res).toBe(body);
    expect(lines).toHaveLength(1);
  });

  it('records a measured duration', async () => {
    const { lines, log } = collector();
    let t = 100;
    const wrapped = withRequestLog(
      { fn: 'mynews-publish', action: 'publish' },
      async () => jsonOk({}),
      { log, clock: () => (t += 37) },
    );
    await wrapped(new Request('https://edge.test/x', { method: 'POST' }));
    await settle();
    expect((JSON.parse(lines[0]!) as { durationMs: number }).durationMs).toBe(37);
  });

  it('logs a thrown handler as outcome threw and re-throws', async () => {
    const { lines, log } = collector();
    const wrapped = withRequestLog(
      { fn: 'mynews-publish', action: 'publish' },
      async () => {
        throw new Error('postgres://user:password@db/secret');
      },
      { log },
    );
    await expect(wrapped(new Request('https://edge.test/x', { method: 'POST' }))).rejects.toThrow();
    await settle();
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed.outcome).toBe('threw');
    expect(parsed.status).toBe(500);
    expect(parsed.level).toBe('error');
    // The thrown message never reaches the structured line.
    expect(lines[0]).not.toContain('password');
  });

  it('omits the subject hash when hashSubject is false', async () => {
    const { lines, log } = collector();
    const wrapped = withRequestLog(
      { fn: 'mynews-payments-webhook', action: 'provider_webhook' },
      async () => jsonOk({}),
      { log, hashSubject: false },
    );
    await wrapped(
      new Request('https://edge.test/x', {
        method: 'POST',
        headers: { Authorization: bearer('sub-1234') },
      }),
    );
    await settle();
    expect(JSON.parse(lines[0]!)).not.toHaveProperty('subjectHash');
  });

  it('keeps annotations request-scoped so concurrent requests do not cross', async () => {
    const { lines, log } = collector();
    const gate: Record<string, (v: unknown) => void> = {};
    const wrapped = withRequestLog(
      { fn: 'mynews-register-key', action: 'register_key' },
      async (req) => {
        const which = new URL(req.url).searchParams.get('w')!;
        annotateRequestLog(req, { action: which === '1' ? 'rotate' : 'revoke' });
        await new Promise((resolve) => {
          gate[which] = resolve;
        });
        return jsonOk({});
      },
      { log },
    );

    const first = wrapped(new Request('https://edge.test/x?w=1', { method: 'POST' }));
    const second = wrapped(new Request('https://edge.test/x?w=2', { method: 'POST' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // Finish the SECOND request first: if annotations were module-global, the
    // first request's action would have been overwritten by the second.
    gate['2']!(undefined);
    await second;
    gate['1']!(undefined);
    await first;
    await settle();

    const actions = lines.map((line) => (JSON.parse(line) as { action: string }).action).sort();
    expect(actions).toEqual(['revoke', 'rotate']);
  });

  it('never lets a logging failure break the response', async () => {
    const wrapped = withRequestLog(
      { fn: 'mynews-publish', action: 'publish' },
      async () => jsonOk({ ok: 1 }),
      {
        log: () => {
          throw new Error('log sink exploded');
        },
      },
    );
    const res = await wrapped(new Request('https://edge.test/x', { method: 'POST' }));
    await settle();
    expect(res.status).toBe(200);
  });
});

describe('serveEnvelope integration', () => {
  it('logs the 500 the client actually received, not the thrown error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { lines, log } = collector();
    const wrapped = serveEnvelope(
      async () => {
        throw new Error('connection string leaked here');
      },
      { fn: 'mynews-review', action: 'review' },
      { log },
    );
    const res = await wrapped(new Request('https://edge.test/x', { method: 'POST' }));
    await settle();
    expect(res.status).toBe(500);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed.outcome).toBe('internal');
    expect(parsed.status).toBe(500);
    expect(lines[0]).not.toContain('connection string');
    consoleError.mockRestore();
  });
});

describe('buildLogLine', () => {
  it('picks the level from the status class', () => {
    const base = {
      fn: 'f',
      action: 'a',
      outcome: 'ok',
      durationMs: 1,
      requestId: 'r',
      method: 'POST',
    };
    expect(buildLogLine({ ...base, status: 200 }).level).toBe('info');
    expect(buildLogLine({ ...base, status: 401 }).level).toBe('warn');
    expect(buildLogLine({ ...base, status: 503 }).level).toBe('error');
  });

  it('clamps an over-long outcome and normalizes an odd method', () => {
    const line = buildLogLine({
      fn: 'f',
      action: 'a',
      outcome: 'x'.repeat(200),
      status: 400,
      durationMs: 1,
      requestId: 'r',
      method: 'PROPFIND-WEIRD',
    });
    expect(line.outcome).toHaveLength(64);
    expect(line.method).toBe('OTHER');
  });

  it('omits an empty extra rather than emitting an empty object', () => {
    const line = buildLogLine({
      fn: 'f',
      action: 'a',
      outcome: 'ok',
      status: 200,
      durationMs: 1,
      requestId: 'r',
      method: 'POST',
      extra: { headline: 'dropped' } as unknown as Record<string, number>,
    });
    expect(line).not.toHaveProperty('extra');
  });

  it('serializes a circular extra without throwing', () => {
    const line = buildLogLine({
      fn: 'f',
      action: 'a',
      outcome: 'ok',
      status: 200,
      durationMs: 1,
      requestId: 'r',
      method: 'POST',
    });
    const circular = { ...line } as Record<string, unknown>;
    circular.extra = circular;
    expect(() => serializeLogLine(circular as never)).not.toThrow();
  });
});

describe('subject hashing', () => {
  it('is stable, truncated, and not the input', async () => {
    const a = await hashForLog('11111111-2222-3333-4444-555555555555');
    const b = await hashForLog('11111111-2222-3333-4444-555555555555');
    const c = await hashForLog('99999999-2222-3333-4444-555555555555');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain('1111');
  });

  it('returns null for an empty subject', async () => {
    expect(await hashForLog('')).toBeNull();
  });

  it('extracts a subject only from a well-formed bearer token', () => {
    expect(
      unverifiedSubject(
        new Request('https://x/', { headers: { Authorization: bearer('sub-9') } }),
      ),
    ).toBe('sub-9');
    expect(unverifiedSubject(new Request('https://x/'))).toBeNull();
    expect(
      unverifiedSubject(new Request('https://x/', { headers: { Authorization: 'Bearer junk' } })),
    ).toBeNull();
  });
});

describe('recordWorkerRun', () => {
  const record = {
    worker: 'mynews-ncii-worker',
    ok: true,
    startedAt: '2026-07-30T00:00:00.000Z',
    processed: 4,
    failures: 0,
    detail: 'scanned 4',
  };

  it('skips without credentials rather than pretending it wrote', async () => {
    const fetchImpl = vi.fn();
    expect(await recordWorkerRun(record, () => undefined, fetchImpl as never)).toBe(
      'skipped-unconfigured',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts a bounded row to nw_worker_runs', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('', { status: 201 });
    }) as unknown as typeof fetch;
    const env = (key: string) =>
      key === 'SUPABASE_URL' ? 'https://p.supabase.co/' : 'service-role-key';

    expect(
      await recordWorkerRun({ ...record, detail: 'x'.repeat(900) }, env, fetchImpl),
    ).toBe('recorded');
    expect(calls[0]!.url).toBe('https://p.supabase.co/rest/v1/nw_worker_runs');
    const body = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>;
    expect(body.worker).toBe('mynews-ncii-worker');
    expect(String(body.detail)).toHaveLength(500);
    expect(body.processed).toBe(4);
  });

  it('reports failure rather than throwing when the write is rejected', async () => {
    const fetchImpl = (async () => new Response('', { status: 403 })) as unknown as typeof fetch;
    expect(await recordWorkerRun(record, () => 'v', fetchImpl)).toBe('failed');
  });

  it('reports failure rather than throwing when the network is down', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await recordWorkerRun(record, () => 'v', fetchImpl)).toBe('failed');
  });

  it('clamps a negative count instead of writing a value the CHECK refuses', async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response('', { status: 201 });
    }) as unknown as typeof fetch;
    await recordWorkerRun({ ...record, processed: -5, failures: -1 }, () => 'v', fetchImpl);
    expect(body.processed).toBe(0);
    expect(body.failures).toBe(0);
  });
});
