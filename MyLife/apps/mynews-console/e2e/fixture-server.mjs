#!/usr/bin/env node
/**
 * Supabase fixture server for the mynews-console e2e harness.
 *
 * ## Why a server and not page.route()
 *
 * The console is server-only by design: the session is read with `getUser()`
 * inside middleware, the layout and every page, and all data goes through the
 * service-role client. None of that traffic is visible to the browser, so the
 * only honest seam is the Supabase origin the app already talks to. This process
 * IS that origin for a test run. No application code is stubbed.
 *
 * Plain http, not TLS: `lib/env.ts` does not constrain the scheme and
 * `@supabase/supabase-js` accepts an http URL, so no certificate is needed here.
 *
 * ## Identities
 *
 * Authorization is the whole subject of these specs, so the fixture answers
 * `GET /auth/v1/user` from the BEARER TOKEN the app presents. That means the
 * cookie the browser holds decides who the request is, exactly as in production,
 * and middleware, the layout, and `requireModerator()` all resolve the same
 * identity independently.
 *
 * Four identities: no session, a session that is not on the moderator allowlist,
 * an allowlisted moderator at aal1 (a TOTP factor exists but this session has not
 * satisfied it), and an allowlisted moderator at aal2.
 *
 * Nothing here is a credential. The access tokens are unsigned fixture JWTs; the
 * real project's keys never appear, and no request body or header is logged.
 */

import { createServer } from 'node:http';

const PORT = Number(process.env.MYNEWS_CONSOLE_FIXTURE_PORT ?? 4311);
const HOST = '127.0.0.1';
/** Matches `sb-${new URL(url).hostname.split('.')[0]}-auth-token` for 127.0.0.1. */
const COOKIE_NAME = 'sb-127-auth-token';

/* ------------------------------- identities ------------------------------- */

const MODERATOR_EMAIL = 'moderator@example.org';
const NO_ROLE_EMAIL = 'norole@example.org';
const OUTSIDER_EMAIL = 'outsider@example.org';

/**
 * `nw_moderator_role` answers. The console's three gates are independent, so the
 * role table has to be able to disagree with the email allowlist: `norole@` is
 * allowlisted and at aal2 but holds no active role.
 */
const ROLE_BY_EMAIL = {
  [MODERATOR_EMAIL]: 'admin',
  [NO_ROLE_EMAIL]: null,
};

function base64url(input) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/**
 * An unsigned JWT with the claims the app can actually read. The signature is a
 * placeholder: nothing verifies it locally (auth-js asks this server who the
 * bearer is), and `mfa.getAuthenticatorAssuranceLevel()` only decodes the `aal`
 * claim. A fixture that signed tokens would be pretending to be a key holder.
 */
function fixtureJwt({ sub, email, aal, sessionId }) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = base64url(
    JSON.stringify({
      iss: `http://${HOST}:${PORT}/auth/v1`,
      sub,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      aal,
      amr: aal === 'aal2' ? [{ method: 'otp' }, { method: 'totp' }] : [{ method: 'otp' }],
      session_id: sessionId,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  return `${header}.${payload}.fixture-unsigned`;
}

function totpFactor(status) {
  return {
    id: 'factor-totp-fixture',
    friendly_name: 'Fixture authenticator',
    factor_type: 'totp',
    status,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  };
}

function user({ id, email, factors }) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: '2026-05-01T00:00:00.000Z',
    phone: '',
    confirmed_at: '2026-05-01T00:00:00.000Z',
    last_sign_in_at: '2026-07-01T00:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    factors,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    is_anonymous: false,
  };
}

/**
 * `factors` mirrors the identity: the aal1 moderator HAS a verified TOTP factor,
 * which is what makes "MFA available but not satisfied on this session" a real
 * state rather than "this account cannot do MFA".
 */
const IDENTITIES = {
  outsider: {
    aal: 'aal1',
    user: user({ id: 'user-outsider', email: OUTSIDER_EMAIL, factors: [] }),
  },
  'moderator-aal1': {
    aal: 'aal1',
    user: user({
      id: 'user-moderator',
      email: MODERATOR_EMAIL,
      factors: [totpFactor('verified')],
    }),
  },
  'moderator-aal2': {
    aal: 'aal2',
    user: user({
      id: 'user-moderator',
      email: MODERATOR_EMAIL,
      factors: [totpFactor('verified')],
    }),
  },
  'moderator-norole': {
    aal: 'aal2',
    user: user({
      id: 'user-norole',
      email: NO_ROLE_EMAIL,
      factors: [totpFactor('verified')],
    }),
  },
};

/** Builds the cookie a browser would hold for an identity. */
function sessionFor(identity) {
  const entry = IDENTITIES[identity];
  if (!entry) return null;
  const accessToken = fixtureJwt({
    sub: entry.user.id,
    email: entry.user.email,
    aal: entry.aal,
    sessionId: `session-${identity}`,
  });
  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${identity}`,
    user: entry.user,
  };
  return {
    identity,
    session,
    cookie: {
      name: COOKIE_NAME,
      // The `base64-` prefix + base64url body is exactly what @supabase/ssr
      // writes and reads, so the app parses this the way it parses a real one.
      value: `base64-${Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')}`,
    },
  };
}

/** Resolves the bearer token in an Authorization header back to an identity. */
function identityForBearer(header) {
  const token = (header ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  for (const identity of Object.keys(IDENTITIES)) {
    if (token === sessionFor(identity).session.access_token) return identity;
  }
  // Tokens carry a per-identity session_id, so a token minted a moment earlier
  // (different iat) still resolves. Fall back to the claim rather than rejecting
  // a session the browser legitimately holds.
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const match = String(claims.session_id ?? '').replace(/^session-/, '');
    return IDENTITIES[match] ? match : null;
  } catch {
    return null;
  }
}

/* ------------------------------ queue fixtures ---------------------------- */

const ARTICLE_ID = 'a-fixture-copyright';
const PROFILE_ID = 'p-fixture-target';
const REPORT_COPYRIGHT = 'r-copyright';
const REPORT_HARASSMENT = 'r-harassment';
const DMCA_ID = 'd-fixture-takedown';

/** Mirrored in e2e/fixture-control.ts, which the specs assert against. */
const FIXTURE_HEADLINE = 'Fixture article named in a takedown notice';

/**
 * Reports are created relative to NOW so the routed SLA badge is never overdue.
 * The badge text itself is clock-derived and is deliberately not asserted; the
 * counts are.
 */
function reportRows() {
  const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  return [
    {
      id: REPORT_COPYRIGHT,
      reporter_id: 'p-fixture-reporter',
      target_kind: 'article',
      target_id: ARTICLE_ID,
      reason: 'copyright',
      detail: 'The photograph in this article is mine.',
      created_at: createdAt,
      console_version: 1,
    },
    {
      id: REPORT_HARASSMENT,
      reporter_id: 'p-fixture-reporter',
      target_kind: 'profile',
      target_id: PROFILE_ID,
      reason: 'harassment',
      detail: 'This account keeps targeting me.',
      created_at: new Date(Date.now() - 29 * 60 * 1000).toISOString(),
      console_version: 1,
    },
  ];
}

const ARTICLE_ROWS = [
  {
    id: ARTICLE_ID,
    slug: 'fixture-takedown-target',
    status: 'published',
    author_id: 'p-fixture-author',
    nw_article_revisions: [{ headline: FIXTURE_HEADLINE, rev: 1 }],
  },
];

const PROFILE_ROWS = [{ id: PROFILE_ID, handle: 'fixturetarget', suspended_until: null }];

const DMCA_ROWS = [
  {
    id: DMCA_ID,
    kind: 'takedown',
    report_id: REPORT_COPYRIGHT,
    complainant_name: 'Fixture Rights Holder',
    complainant_email: 'rights@example.org',
    complainant_address: '1 Fixture Way, Testville',
    copyrighted_work: 'The original photograph published on example.org in June 2026.',
    infringing_url: 'https://mynews.app/a/fixture-takedown-target',
    target_kind: 'article',
    target_id: ARTICLE_ID,
    signature: 'Fixture Rights Holder',
    created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
];

/* --------------------------- exact select strings ------------------------- */

const REPORT_SELECT =
  'id,reporter_id,target_kind,target_id,reason,detail,created_at,console_version';
const ARTICLE_SELECT = 'id,slug,status,author_id,nw_article_revisions(headline,rev)';
const SUGGESTION_SELECT = 'id,article_id,status,editor_id,rationale';
const PROFILE_SELECT = 'id,handle,suspended_until';
const ASSIGNMENT_SELECT =
  'queue,item_id,assignee_ref,assigned_by,assigned_at,escalation_level,escalation_reason,' +
  'escalated_by,escalated_at';
const DMCA_SELECT =
  'id,kind,report_id,complainant_name,complainant_email,complainant_address,copyrighted_work,' +
  'infringing_url,target_kind,target_id,signature,created_at';

/* -------------------------------- run state ------------------------------- */

let mode = 'ok';
/** Independent of `mode`: the health page is reachable during a REST outage. */
let healthMode = 'ok';
const unhandled = [];

/**
 * Snapshot in the exact shape nw_health_snapshot() returns (migration
 * 20260730000012). 'degraded' pushes the DMCA queue past its alarm threshold and
 * drops the support worker's heartbeat, which are the two component kinds the
 * page renders differently.
 */
function healthSnapshot() {
  const threshold = (warn, alarm) => ({
    warnSeconds: warn,
    alarmSeconds: alarm,
    enabled: true,
    description: '',
  });
  const worker = (ageSeconds) => ({
    ok: true,
    finishedAt: '2026-07-30T11:59:00Z',
    ageSeconds,
    processed: 2,
    failures: 0,
    detail: null,
  });
  const degraded = healthMode === 'degraded';
  return {
    checkedAt: '2026-07-30T12:00:00Z',
    queues: {
      queue_report: { depth: 2, oldestAgeSeconds: 120 },
      queue_ncii: { depth: 0, oldestAgeSeconds: null, pastDeadline: 0 },
      queue_dmca: degraded
        ? { depth: 7, oldestAgeSeconds: 200_000 }
        : { depth: 1, oldestAgeSeconds: 300 },
      queue_screening: { depth: 0, oldestAgeSeconds: null },
      queue_deletion: { depth: 0, oldestAgeSeconds: null },
      queue_support_reconciliation: { depth: 1, oldestAgeSeconds: 3_600 },
    },
    workers: {
      'mynews-ncii-worker': worker(60),
      'mynews-account-worker': worker(600),
      ...(degraded ? {} : { 'mynews-support-worker': worker(3_600) }),
    },
    thresholds: {
      queue_report: threshold(21_600, 86_400),
      queue_ncii: threshold(14_400, 43_200),
      queue_dmca: threshold(43_200, 172_800),
      queue_screening: threshold(14_400, 86_400),
      queue_deletion: threshold(3_600, 21_600),
      queue_support_reconciliation: threshold(93_600, 259_200),
      worker_mynews_ncii_worker: threshold(3_600, 21_600),
      worker_mynews_account_worker: threshold(10_800, 43_200),
      worker_mynews_support_worker: threshold(93_600, 259_200),
    },
  };
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function unhandledRequest(res, method, path, detail) {
  unhandled.push({ method, path, detail: detail ?? null });
  process.stderr.write(
    `mynews-console fixture: unhandled ${method} ${path}${detail ? ` (${detail})` : ''}\n`,
  );
  json(res, 501, { message: `mynews-console fixture: unhandled ${method} ${path}`, detail: detail ?? null });
}

function eqValue(params, key) {
  const raw = params.get(key);
  return raw?.startsWith('eq.') ? raw.slice(3) : null;
}

function inValues(params, key) {
  const raw = params.get(key);
  if (!raw || !raw.startsWith('in.(')) return null;
  const inner = raw.slice(4, raw.endsWith(')') ? -1 : undefined);
  if (inner.trim() === '') return [];
  return inner.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= 1_000_000) chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

/* ------------------------------ REST handlers ----------------------------- */

const REST_HANDLERS = {
  '/rest/v1/nw_reports': (res, path, params) => {
    const select = params.get('select');
    if (select !== REPORT_SELECT && select !== 'target_kind,target_id,status') {
      return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
    }
    const status = eqValue(params, 'status');
    let rows = reportRows();
    // Only open reports exist in the fixture, so an `eq.open` filter keeps them
    // all and any other status filter empties the list.
    if (status !== null && status !== 'open') rows = [];
    if (select === 'target_kind,target_id,status') {
      const id = eqValue(params, 'id');
      rows = rows.filter((row) => id === null || row.id === id);
      return json(
        res,
        200,
        rows.map((row) => ({ target_kind: row.target_kind, target_id: row.target_id, status: 'open' })),
      );
    }
    return json(res, 200, rows);
  },
  '/rest/v1/nw_articles': (res, path, params) => {
    const select = params.get('select');
    if (select !== ARTICLE_SELECT) {
      return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
    }
    const ids = inValues(params, 'id');
    const rows = ids === null ? ARTICLE_ROWS : ARTICLE_ROWS.filter((row) => ids.includes(row.id));
    return json(res, 200, rows);
  },
  '/rest/v1/nw_edit_suggestions': (res, path, params) => {
    const select = params.get('select');
    if (select !== SUGGESTION_SELECT) {
      return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
    }
    // No suggestion is reported in the fixture queue.
    return json(res, 200, []);
  },
  '/rest/v1/nw_queue_assignments': (res, path, params) => {
    const select = params.get('select');
    if (select !== ASSIGNMENT_SELECT) {
      return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
    }
    // Nothing is claimed in the fixture, so the queue renders its unassigned
    // controls, which is the state a fresh queue is actually in.
    return json(res, 200, []);
  },
  '/rest/v1/nw_profiles': (res, path, params) => {
    const select = params.get('select');
    if (select !== PROFILE_SELECT) {
      return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
    }
    const ids = inValues(params, 'id');
    const rows = ids === null ? PROFILE_ROWS : PROFILE_ROWS.filter((row) => ids.includes(row.id));
    return json(res, 200, rows);
  },
  '/rest/v1/nw_dmca_notices': (res, path, params) => {
    const select = params.get('select');
    if (select !== DMCA_SELECT) {
      return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
    }
    const reportId = eqValue(params, 'report_id');
    const rows =
      reportId === null ? DMCA_ROWS : DMCA_ROWS.filter((row) => row.report_id === reportId);
    return json(res, 200, rows);
  },
};

/* -------------------------------- auth API -------------------------------- */

async function handleAuth(req, res, path, method, url) {
  if (method === 'GET' && path === '/auth/v1/user') {
    const identity = identityForBearer(req.headers.authorization);
    if (!identity) {
      return json(res, 401, { code: 401, msg: 'invalid claim: missing sub claim' });
    }
    return json(res, 200, IDENTITIES[identity].user);
  }

  if (method === 'POST' && path === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type');
    const body = await readBody(req);
    if (grant !== 'refresh_token') {
      return json(res, 400, { error: 'unsupported_grant_type' });
    }
    let refresh = '';
    try {
      refresh = String(JSON.parse(body || '{}').refresh_token ?? '');
    } catch {
      refresh = '';
    }
    const identity = refresh.replace(/^refresh-/, '');
    const fresh = sessionFor(identity);
    if (!fresh) return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
    return json(res, 200, { ...fresh.session });
  }

  // Magic-link send from /login. Supabase answers 200 whether or not the address
  // exists, which is what keeps the endpoint from being an account oracle.
  if (method === 'POST' && path === '/auth/v1/otp') {
    await readBody(req);
    return json(res, 200, {});
  }

  // Every 6-digit code is rejected: these specs authenticate by holding a cookie
  // (which is what a real moderator does after clicking the emailed link), so a
  // fixture that minted a session from an arbitrary typed code would only be
  // weakening the gate the specs exist to prove.
  if (method === 'POST' && path === '/auth/v1/verify') {
    await readBody(req);
    return json(res, 403, {
      error: 'invalid_grant',
      error_description: 'Token has expired or is invalid',
      code: 'otp_expired',
      msg: 'Token has expired or is invalid',
    });
  }

  if (method === 'POST' && path === '/auth/v1/logout') {
    await readBody(req);
    res.writeHead(204);
    return res.end();
  }

  return null;
}

/* --------------------------------- server --------------------------------- */

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';

  if (path === '/__fixture/health') return json(res, 200, { ok: true, mode });
  if (path === '/__fixture/cookie-name') return json(res, 200, { name: COOKIE_NAME });
  if (path.startsWith('/__fixture/session/')) {
    const identity = path.slice('/__fixture/session/'.length);
    const built = sessionFor(identity);
    if (!built) {
      return json(res, 404, {
        message: `unknown identity: ${identity}`,
        known: Object.keys(IDENTITIES),
      });
    }
    return json(res, 200, { identity: built.identity, cookie: built.cookie, email: IDENTITIES[identity].user.email, aal: IDENTITIES[identity].aal });
  }
  if (path === '/__fixture/mode') {
    if (method === 'GET') return json(res, 200, { mode });
    if (method === 'POST') {
      const body = await readBody(req);
      let next = '';
      try {
        next = String(JSON.parse(body || '{}').mode ?? '');
      } catch {
        next = '';
      }
      if (next !== 'ok' && next !== 'outage') {
        return json(res, 400, { message: 'mode must be "ok" or "outage"' });
      }
      mode = next;
      return json(res, 200, { mode });
    }
  }
  if (path === '/__fixture/unhandled') {
    if (method === 'DELETE') {
      unhandled.length = 0;
      return json(res, 200, { unhandled: [] });
    }
    return json(res, 200, { unhandled });
  }

  if (path === '/__fixture/health-mode' && method === 'POST') {
    const body = await readBody(req);
    try {
      const next = JSON.parse(body || '{}').mode;
      if (next !== 'ok' && next !== 'degraded' && next !== 'unavailable') {
        return json(res, 400, { message: `unknown health mode: ${String(next)}` });
      }
      healthMode = next;
    } catch {
      return json(res, 400, { message: 'health mode body must be JSON' });
    }
    return json(res, 200, { healthMode });
  }

  if (mode === 'outage') {
    return json(res, 503, { message: 'fixture outage mode' }, { 'retry-after': '60' });
  }

  const authHandled = await handleAuth(req, res, path, method, url);
  if (authHandled !== null) return authHandled;

  // Service-role RPCs. Only the role lookup is modelled: every enforcement RPC is
  // deliberately absent, so a spec that tried to enforce would get a loud 501
  // rather than a fabricated success.
  if (method === 'POST' && path === '/rest/v1/rpc/nw_moderator_role') {
    const body = await readBody(req);
    let ref = '';
    try {
      ref = String(JSON.parse(body || '{}').p_ref ?? '').trim().toLowerCase();
    } catch {
      ref = '';
    }
    if (!(ref in ROLE_BY_EMAIL)) {
      return unhandledRequest(res, method, path, `no fixture role mapping for ${ref}`);
    }
    return json(res, 200, ROLE_BY_EMAIL[ref]);
  }

  // Service health (plan 48 WP11). Modelled because /health is a real console
  // page; `healthMode=unavailable` makes the RPC fail so the page's honest
  // "could not be read" branch is exercised rather than assumed.
  if (method === 'POST' && path === '/rest/v1/rpc/nw_health_snapshot') {
    if (healthMode === 'unavailable') {
      return json(res, 500, { message: 'fixture: nw_health_snapshot is unavailable' });
    }
    return json(res, 200, healthSnapshot());
  }

  if (method === 'GET' && REST_HANDLERS[path]) {
    return REST_HANDLERS[path](res, path, url.searchParams);
  }

  return unhandledRequest(res, method, path);
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`mynews-console fixture listening on http://${HOST}:${PORT} (mode=${mode})\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
