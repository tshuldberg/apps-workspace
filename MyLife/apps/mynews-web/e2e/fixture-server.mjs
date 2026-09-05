#!/usr/bin/env node
/**
 * PostgREST/Supabase fixture server for the mynews-web e2e harness.
 *
 * ## Why a server and not page.route()
 *
 * mynews-web is a Next.js App Router app: every read happens in a Server
 * Component or a route handler, inside the Node process, so a browser-side
 * `page.route()` interceptor never sees it. The only honest seam is the network
 * boundary the app already talks to, which is the Supabase origin it reads from
 * `MYNEWS_SUPABASE_URL`. This process IS that origin for the duration of a test
 * run. No application code is stubbed, patched, or bypassed.
 *
 * ## Why TLS
 *
 * `lib/env.ts` `parseCloudEnv` requires an https URL and treats anything else as
 * unconfigured. Rather than change how the app reads its environment, the
 * fixture speaks TLS with the self-signed certificate in this directory, and the
 * Next process trusts it through `NODE_EXTRA_CA_CERTS`. Certificate
 * verification stays ON: nothing is disabled globally.
 *
 * ## Contract
 *
 * - Only the exact PostgREST paths + `select` strings the app builds are
 *   answered. Anything else gets a 501 naming the method, path and select, and
 *   is recorded in `GET /__fixture/unhandled`. A drifted select string therefore
 *   surfaces as a hard test failure instead of a silently empty page.
 * - `POST /__fixture/mode` switches between `ok` and `outage` so the outage
 *   surface can be exercised against real production code paths (the app's own
 *   `readOne`/`readList` classify a 503 as an outage).
 * - Deterministic fixture rows only. Nothing here is a credential: the anon key
 *   the app sends is not checked and never logged, and no request body is logged.
 */

import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.MYNEWS_FIXTURE_PORT ?? 4310);
const HOST = '127.0.0.1';

/* ------------------------------ fixture rows ------------------------------ */

const ADA = {
  id: 'p-ada',
  handle: 'ada',
  display_name: 'Ada Fixture',
  pubkey_ed25519: 'ed25519-fixture-ada',
  kind: 'journalist',
  created_at: '2026-01-02T00:00:00.000Z',
};

const EDITOR = {
  id: 'p-ed',
  handle: 'edwin',
  display_name: 'Edwin Fixture',
  pubkey_ed25519: 'ed25519-fixture-edwin',
  kind: 'editor',
  created_at: '2026-01-03T00:00:00.000Z',
};

const PROFILES = [ADA, EDITOR];

const ADA_JOURNALIST = {
  profile_id: 'p-ada',
  tier: 'verified',
  bio: 'Fixture reporter covering the harness beat.',
  beats: ['fixtures', 'harness'],
  region: 'US',
  created_at: '2026-01-02T00:00:00.000Z',
  verification_state: 'approved',
  verification_expires_at: null,
};

const JOURNALISTS = [ADA_JOURNALIST];

const HEADLINE_TOP = 'Fixture city budget passes after two corrections';
const HEADLINE_SECOND = 'Fixture transit board publishes its raw ridership data';

const ARTICLES = [
  {
    id: 'a-budget',
    author_id: 'p-ada',
    slug: 'fixture-city-budget',
    kind: 'news',
    status: 'published',
    current_rev: 2,
    published_at: '2026-07-02T12:00:00.000Z',
    created_at: '2026-07-01T09:00:00.000Z',
    revisions: [
      {
        rev: 2,
        headline: HEADLINE_TOP,
        dek: 'The council adopted the amended figures on a 5 to 2 vote.',
        body_md:
          'The council adopted the amended budget after two reader corrections were accepted.\n\nThe second paragraph exists so the body renders more than one block.',
        signature: 'fixture-signature-rev2',
        signer_pubkey: 'ed25519-fixture-ada',
        verified_key_id: 'key-ada-1',
        changelog_json: [
          { suggestionId: 's-correction', editorKey: 'ed25519-fixture-edwin', type: 'correction' },
        ],
        created_at: '2026-07-02T12:00:00.000Z',
      },
      {
        rev: 1,
        headline: 'Fixture city budget passes',
        dek: 'First published draft of the fixture story.',
        body_md: 'The council adopted the budget.',
        signature: 'fixture-signature-rev1',
        signer_pubkey: 'ed25519-fixture-ada',
        verified_key_id: 'key-ada-1',
        changelog_json: [],
        created_at: '2026-07-01T09:00:00.000Z',
      },
    ],
  },
  {
    id: 'a-transit',
    author_id: 'p-ada',
    slug: 'fixture-transit-data',
    kind: 'news',
    status: 'published',
    current_rev: 1,
    published_at: '2026-06-28T08:00:00.000Z',
    created_at: '2026-06-28T08:00:00.000Z',
    revisions: [
      {
        rev: 1,
        headline: HEADLINE_SECOND,
        dek: 'A second fixture row so ordering is observable.',
        body_md: 'Ridership recovered to 82 percent of the pre-closure baseline.',
        signature: 'fixture-signature-transit',
        signer_pubkey: 'ed25519-fixture-ada',
        verified_key_id: 'key-ada-1',
        changelog_json: [],
        created_at: '2026-06-28T08:00:00.000Z',
      },
    ],
  },
];

const SUGGESTIONS = [
  {
    id: 's-correction',
    article_id: 'a-budget',
    base_rev: 2,
    editor_id: 'p-ed',
    type: 'correction',
    diff_json: {
      baseHash: 'fixture-base-hash',
      ops: [{ baseIndex: 0, baseBlocks: ['The council adopted the budget.'], newBlocks: ['The council adopted the amended budget.'] }],
    },
    citations: ['https://example.org/fixture-source'],
    rationale: 'The adopted figure was the amended one.',
    status: 'open',
    created_at: '2026-07-03T10:00:00.000Z',
  },
];

const SUGGESTION_EVENTS = [
  {
    id: 'ev-1',
    suggestion_id: 's-correction',
    actor_id: 'p-ed',
    action: 'comment',
    payload: { body: 'Source is the adopted ordinance.' },
    created_at: '2026-07-03T10:05:00.000Z',
  },
];

/* --------------------------- exact select strings -------------------------- */

// Kept as literals rather than imported: the point of the check is to notice
// when the app's query drifts, which an import would hide.
const PUBLIC_PROFILE_SELECT = 'id,handle,display_name,pubkey_ed25519,kind,created_at';
const PUBLIC_JOURNALIST_SELECT =
  'profile_id,tier,bio,beats,region,created_at,verification_state,verification_expires_at';
// apps/mynews-web/lib/queries.ts builds its own site-wide latest read and does
// not ask for the verification columns.
const WEB_LATEST_JOURNALIST_SELECT = 'profile_id,tier,bio,beats,region,created_at';
const ARTICLE_SELECT =
  'id,author_id,slug,kind,status,current_rev,published_at,created_at,' +
  'nw_article_revisions(rev,headline,dek,body_md,signature,signer_pubkey,verified_key_id,changelog_json,created_at)';
const FEED_SELECT = 'id,author_id,slug,kind,current_rev,published_at,nw_article_revisions(rev,headline,dek)';
const SUGGESTION_SELECT =
  'id,article_id,base_rev,editor_id,type,diff_json,citations,rationale,status,created_at,' +
  'article:nw_articles!inner(slug,author_id,nw_article_revisions(rev,headline)),' +
  'endorsements:nw_suggestion_dupes(count)';
const SUGGESTION_EVENT_SELECT = 'id,suggestion_id,actor_id,action,payload,created_at';
const HANDLE_ONLY_SELECT = 'id';
const EDITOR_PROFILE_SELECT = 'id,handle,display_name,kind';

/* -------------------------------- run state ------------------------------- */

/** 'ok' | 'outage'. Flipped through POST /__fixture/mode by the specs. */
let mode = process.env.MYNEWS_FIXTURE_MODE === 'outage' ? 'outage' : 'ok';

/** Every request the fixture could not answer, for the drift-guard spec. */
const unhandled = [];

/* -------------------------------- helpers --------------------------------- */

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders,
  });
  res.end(payload);
}

function unhandledRequest(res, method, path, detail) {
  const entry = { method, path, detail };
  unhandled.push(entry);
  // Stderr only, and only routing metadata: no bodies, no headers, no keys.
  process.stderr.write(`mynews fixture: unhandled ${method} ${path}${detail ? ` (${detail})` : ''}\n`);
  json(res, 501, { message: `mynews fixture: unhandled ${method} ${path}`, detail: detail ?? null });
}

function eqValue(params, key) {
  const raw = params.get(key);
  if (!raw) return null;
  return raw.startsWith('eq.') ? raw.slice(3) : null;
}

function neqValue(params, key) {
  const raw = params.get(key);
  if (!raw) return null;
  return raw.startsWith('neq.') ? raw.slice(4) : null;
}

/** Parses PostgREST `in.("a","b")` into ['a','b']. */
function inValues(params, key) {
  const raw = params.get(key);
  if (!raw || !raw.startsWith('in.(')) return null;
  const inner = raw.slice(4, raw.endsWith(')') ? -1 : undefined);
  if (inner.trim() === '') return [];
  return inner.split(',').map((part) => part.trim().replace(/^"|"$/g, ''));
}

function pick(row, keys) {
  const out = {};
  for (const key of keys) out[key] = row[key];
  return out;
}

function headRevisionFeedShape(article) {
  const head = [...article.revisions].sort((a, b) => b.rev - a.rev)[0];
  return head ? [pick(head, ['rev', 'headline', 'dek'])] : [];
}

function feedShape(article) {
  return {
    ...pick(article, ['id', 'author_id', 'slug', 'kind', 'current_rev', 'published_at']),
    nw_article_revisions: headRevisionFeedShape(article),
  };
}

function articleShape(article) {
  return {
    ...pick(article, [
      'id',
      'author_id',
      'slug',
      'kind',
      'status',
      'current_rev',
      'published_at',
      'created_at',
    ]),
    nw_article_revisions: [...article.revisions]
      .sort((a, b) => b.rev - a.rev)
      .map((revision) =>
        pick(revision, [
          'rev',
          'headline',
          'dek',
          'body_md',
          'signature',
          'signer_pubkey',
          'verified_key_id',
          'changelog_json',
          'created_at',
        ]),
      ),
  };
}

function suggestionShape(suggestion) {
  const article = ARTICLES.find((candidate) => candidate.id === suggestion.article_id);
  const head = article ? [...article.revisions].sort((a, b) => b.rev - a.rev)[0] : null;
  return {
    ...pick(suggestion, [
      'id',
      'article_id',
      'base_rev',
      'editor_id',
      'type',
      'diff_json',
      'citations',
      'rationale',
      'status',
      'created_at',
    ]),
    article: article
      ? {
          slug: article.slug,
          author_id: article.author_id,
          nw_article_revisions: head ? [{ rev: head.rev, headline: head.headline }] : [],
        }
      : null,
    endorsements: [{ count: 0 }],
  };
}

/* ------------------------------ REST handlers ----------------------------- */

function handleArticles(res, path, params) {
  const select = params.get('select');
  const slug = eqValue(params, 'slug');

  if (select === ARTICLE_SELECT) {
    // getArticleBySlug: slug=eq.<slug>&status=neq.draft&limit=1
    if (!slug) return unhandledRequest(res, 'GET', path, 'ARTICLE_SELECT without slug=eq.');
    const excluded = neqValue(params, 'status');
    const match = ARTICLES.find(
      (article) => article.slug === slug && (excluded === null || article.status !== excluded),
    );
    return json(res, 200, match ? [articleShape(match)] : []);
  }

  if (select === FEED_SELECT) {
    const authorId = eqValue(params, 'author_id');
    const requiredStatus = eqValue(params, 'status');
    const limit = Number(params.get('limit') ?? '50');
    let rows = ARTICLES.filter(
      (article) => requiredStatus === null || article.status === requiredStatus,
    );
    if (authorId !== null) rows = rows.filter((article) => article.author_id === authorId);
    rows.sort((a, b) => (a.published_at < b.published_at ? 1 : -1));
    return json(res, 200, rows.slice(0, Number.isFinite(limit) ? limit : 50).map(feedShape));
  }

  return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
}

function handlePublicProfiles(res, path, params) {
  const select = params.get('select');
  const handle = eqValue(params, 'handle');
  const ids = inValues(params, 'id');

  if (select === PUBLIC_PROFILE_SELECT || select === EDITOR_PROFILE_SELECT || select === HANDLE_ONLY_SELECT) {
    const keys =
      select === PUBLIC_PROFILE_SELECT
        ? ['id', 'handle', 'display_name', 'pubkey_ed25519', 'kind', 'created_at']
        : select === EDITOR_PROFILE_SELECT
          ? ['id', 'handle', 'display_name', 'kind']
          : ['id'];
    let rows = PROFILES;
    if (handle !== null) rows = rows.filter((profile) => profile.handle === handle);
    if (ids !== null) rows = rows.filter((profile) => ids.includes(profile.id));
    return json(res, 200, rows.map((profile) => pick(profile, keys)));
  }

  return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
}

function handlePublicJournalists(res, path, params) {
  const select = params.get('select');
  const ids = inValues(params, 'profile_id');
  if (select !== PUBLIC_JOURNALIST_SELECT && select !== WEB_LATEST_JOURNALIST_SELECT) {
    return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
  }
  const keys = select.split(',');
  let rows = JOURNALISTS;
  if (ids !== null) rows = rows.filter((journalist) => ids.includes(journalist.profile_id));
  return json(res, 200, rows.map((journalist) => pick(journalist, keys)));
}

function handleEditSuggestions(res, path, params) {
  const select = params.get('select');
  if (select !== SUGGESTION_SELECT) {
    return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
  }
  const articleId = eqValue(params, 'article_id');
  const status = eqValue(params, 'status');
  let rows = SUGGESTIONS;
  if (articleId !== null) rows = rows.filter((row) => row.article_id === articleId);
  if (status !== null) rows = rows.filter((row) => row.status === status);
  return json(res, 200, rows.map(suggestionShape));
}

function handleSuggestionEvents(res, path, params) {
  const select = params.get('select');
  if (select !== SUGGESTION_EVENT_SELECT) {
    return unhandledRequest(res, 'GET', path, `unknown select: ${select}`);
  }
  const suggestionId = eqValue(params, 'suggestion_id');
  const rows =
    suggestionId === null
      ? SUGGESTION_EVENTS
      : SUGGESTION_EVENTS.filter((event) => event.suggestion_id === suggestionId);
  return json(res, 200, rows);
}

const REST_HANDLERS = {
  '/rest/v1/nw_articles': handleArticles,
  '/rest/v1/nw_public_profiles': handlePublicProfiles,
  '/rest/v1/nw_public_journalists': handlePublicJournalists,
  '/rest/v1/nw_edit_suggestions': handleEditSuggestions,
  '/rest/v1/nw_suggestion_events': handleSuggestionEvents,
};

/* ---------------------------- function handlers --------------------------- */

let dmcaSubmissionCount = 0;

/**
 * Stands in for the `mynews-dmca` edge function. The web BFF
 * (`app/api/dmca/route.ts`) signs the platform IP and forwards the notice here;
 * the honest shape of a success is the queued receipt, which is exactly what the
 * real function returns after inserting the notice.
 */
function handleDmcaFunction(res) {
  dmcaSubmissionCount += 1;
  return json(res, 200, {
    ok: true,
    data: {
      status: 'queued',
      referenceId: `fixture-dmca-${dmcaSubmissionCount}`,
      resolutionStatus: 'resolved',
    },
  });
}

/**
 * Stands in for `mynews-report`, which runs with verify_jwt ON. The fixture
 * receives the anon key (no reader cookie session in these specs), so the
 * honest answer is the same one production gives an anonymous caller.
 */
function handleReportFunction(res) {
  return json(res, 401, { ok: false, error: 'not-signed-in' });
}

const FUNCTION_HANDLERS = {
  '/functions/v1/mynews-dmca': handleDmcaFunction,
  '/functions/v1/mynews-report': handleReportFunction,
};

/* ------------------------------- auth stubs ------------------------------- */

/**
 * The public site has no signed-in reader in these specs, so the only auth call
 * that can happen is an OTP send from the report card's sign-in affordance.
 * Supabase Auth answers a send for an unknown address with 200 and no body,
 * which is what keeps the endpoint from being an account-existence oracle, so
 * that is what the fixture returns.
 */
const AUTH_HANDLERS = {
  'POST /auth/v1/otp': (res) => json(res, 200, {}),
  // Every code is rejected. A wrong or expired code is the state the web specs
  // need, and minting a real reader session here would put the fixture in the
  // business of asserting identity for a surface whose specs do not require it.
  // (The console fixture DOES switch identities, because its specs are about
  // authorization.)
  'POST /auth/v1/verify': (res) =>
    json(res, 403, {
      error: 'invalid_grant',
      error_description: 'Token has expired or is invalid',
      code: 'otp_expired',
      msg: 'Token has expired or is invalid',
    }),
  'GET /auth/v1/user': (res) => json(res, 401, { message: 'no session' }),
};

/* --------------------------------- server --------------------------------- */

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size <= 1_000_000) chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

const server = createServer(
  {
    cert: readFileSync(new URL('fixture-tls-cert.pem', import.meta.url)),
    key: readFileSync(new URL('fixture-tls-key.pem', import.meta.url)),
  },
  async (req, res) => {
    const url = new URL(req.url ?? '/', `https://${HOST}:${PORT}`);
    const path = url.pathname;
    const method = req.method ?? 'GET';

    /* ------------------------------ control ------------------------------ */

    if (path === '/__fixture/health') {
      return json(res, 200, { ok: true, mode });
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

    /* ------------------------------- outage ------------------------------ */

    // A real backend outage is a failing response on every data path, which is
    // what the app's loaders classify as `outage`. The control plane above stays
    // reachable so a spec can switch back.
    if (mode === 'outage') {
      return json(res, 503, { message: 'fixture outage mode' }, { 'retry-after': '60' });
    }

    /* -------------------------------- data ------------------------------- */

    if (method === 'GET' && REST_HANDLERS[path]) {
      return REST_HANDLERS[path](res, path, url.searchParams);
    }
    if (method === 'POST' && FUNCTION_HANDLERS[path]) {
      await readBody(req);
      return FUNCTION_HANDLERS[path](res);
    }
    const authKey = `${method} ${path}`;
    if (AUTH_HANDLERS[authKey]) {
      if (method === 'POST') await readBody(req);
      return AUTH_HANDLERS[authKey](res);
    }

    return unhandledRequest(res, method, path);
  },
);

server.listen(PORT, HOST, () => {
  process.stdout.write(`mynews-web fixture listening on https://${HOST}:${PORT} (mode=${mode})\n`);
  process.stdout.write(`mynews-web fixture cert: ${HERE}fixture-tls-cert.pem\n`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
