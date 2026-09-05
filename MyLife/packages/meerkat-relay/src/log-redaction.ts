/**
 * Log redaction for the NDJSON out() paths (Plan 44 WP-4B).
 *
 * WHAT THIS IS. Every stateful Meerkat service bin logs structured NDJSON events
 * through a one-line `out()` helper. Those events are counts, paths, urls, and
 * error details -- never envelope payloads (the relay's zero-knowledge tests
 * already prove content never reaches a log). This helper is the second line of
 * defense for the ONE class of secret that CAN legitimately ride into a log
 * today: an operator credential riding on an error, a connection string with a
 * password, a presigned object-store url, or a bearer blob that a future edit
 * accidentally threads into a detail field. `redactForLog` deep-walks an event
 * and replaces high-confidence secret material with '[redacted]' before it hits
 * stdout, and `redactErrorDetail` does the same to the free-form string that
 * `String(error?.message ?? error)` produces on every fatal path.
 *
 * WHAT THIS IS NOT (the false-positive rule that outranks every scrub rule). This
 * codebase names things honestly by their content hash: publication ids, content
 * ids, rendezvous rids, blob hashes, device pubkeys, and receipt keys are all
 * 32/48/64+ hex or base64url strings, and they appear in log events on PURPOSE
 * (an operator needs the publicationId to trace a takedown). A blanket "redact
 * anything that looks like a 64-hex string" rule would destroy the entire
 * operational value of the logs while protecting nothing -- a content hash is
 * public by construction. So this helper NEVER scrubs a value merely for being
 * long, hex, or base64. It scrubs only:
 *   1. values whose KEY is on a documented credential denylist, and
 *   2. string values that match a HIGH-CONFIDENCE credential SHAPE that a content
 *      address cannot accidentally have: userinfo embedded in a URL, known
 *      credential query parameters (presigned-url signatures), and a bearer-like
 *      blob explicitly introduced by the token `Bearer `.
 * Everything else -- including every hash, id, and public key -- passes through
 * verbatim. If you are tempted to add a width-based or entropy-based rule, don't:
 * it will silently start redacting the ids operators depend on.
 *
 * The helper is pure, allocation-only (it never mutates its input), and bounded
 * (it caps recursion depth and total node count so a pathological event object
 * can never turn a log write into an unbounded walk).
 */

/** The literal that replaces a redacted value. Stable so tests + greps can key off it. */
export const REDACTION_PLACEHOLDER = '[redacted]';

/**
 * KEY DENYLIST. A value is redacted wholesale when its object key, lowercased and
 * stripped of separators, CONTAINS one of these fragments. Fragment (substring)
 * matching -- not exact -- so `sessionSecret`, `MEERKAT_PERSONA_SESSION_SECRET`,
 * and `webhook_secret` all match `secret`; `connectionString` and `databaseUrl`
 * match via `connectionstring` / the url handling below.
 *
 * Rationale per fragment:
 *  - secret / password / passwd / passphrase: operator credentials, never an id.
 *  - token: bearer/session/humanity tokens. NOTE: content-registry rids are
 *    logged under `rid`, publication ids under `publicationId`, so `token` here
 *    does NOT sweep those up. A key literally named `*token*` is a credential.
 *  - authorization / cookie / bearer: HTTP credential headers.
 *  - apikey / secretkey / privatekey / signingkey / seed / hmac / entitlement:
 *    key material and the seeds that derive it. `publicKey` is deliberately NOT
 *    on the list (public keys are logged on purpose); `privatekey`/`signingkey`
 *    are, and they are checked BEFORE the generic `key` fragment so `publicKey`
 *    is never caught (there is no bare `key` fragment for exactly this reason).
 *  - credential: catch-all for explicitly-named credential fields.
 *  - connectionstring / dsn: a database connection string carries a password.
 */
const KEY_DENYLIST_FRAGMENTS = [
  'secret',
  'password',
  'passwd',
  'passphrase',
  'token',
  'authorization',
  'cookie',
  'bearer',
  'apikey',
  'secretkey',
  'privatekey',
  'signingkey',
  'seed',
  'hmac',
  'entitlement',
  'credential',
  'connectionstring',
  'dsn',
  // Plan 51 verification-account layer: the SSO provider subject + relay email are
  // account-layer identifiers that must never appear in a log (the account-service
  // canary asserts this); a sealed epoch private key and a credential serial are
  // key material / linkage material. `providersubject`/`relayemail` normalize with
  // separators stripped, so provider_subject / relay_email match too. `serial` is a
  // deliberate fragment: the account service never logs one, and a stray serial in a
  // log would be the one value that could co-locate with an account id (AC-2).
  'providersubject',
  'relayemail',
  'sealedprivatekey',
  'serial',
] as const;

/**
 * KEY ALLOWLIST. Keys that CONTAIN a denylist fragment but are known-safe and must
 * pass through. `publicKey` contains no denylist fragment (there is no bare `key`),
 * but we list it defensively; `postReceiptKey`/`postNodeKey` are public receipt
 * keys logged on purpose. This list is checked first and wins.
 */
const KEY_ALLOWLIST = new Set(['publickey', 'postreceiptkey', 'postnodekey', 'authority']);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_\-.\s]/gu, '');
}

function keyIsSensitive(key: string): boolean {
  const normalized = normalizeKey(key);
  if (KEY_ALLOWLIST.has(normalized)) return false;
  return KEY_DENYLIST_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

/**
 * URL USERINFO. A postgres/https/ws url of the form `scheme://user:pass@host/...`
 * carries a password in the authority. We rewrite ONLY the userinfo to
 * `[redacted]@`, preserving scheme + host + path so the log still says WHICH
 * host failed (the operationally useful part) without the credential. Matches any
 * scheme so `postgres://`, `postgresql://`, `https://`, `wss://`, `redis://` are
 * all covered. The user portion is preserved only up to the colon is NOT kept --
 * a username can itself be sensitive (role names leak least-privilege topology),
 * so the whole `user:pass@` (or `user@`) authority-credential span is replaced.
 */
const URL_USERINFO = /\b([a-z][a-z0-9+.-]*:\/\/)[^/@\s:]+(?::[^/@\s]*)?@/giu;

function scrubUrlUserinfo(value: string): string {
  return value.replace(URL_USERINFO, `$1${REDACTION_PLACEHOLDER}@`);
}

/**
 * PRESIGNED-URL / QUERY CREDENTIALS. Object-store presigned urls carry the
 * signature and short-lived credential in query parameters. Redact the VALUE of
 * any query parameter whose name is a known credential parameter, keeping the
 * parameter name so the shape is still legible. Covers AWS SigV4
 * (X-Amz-Signature, X-Amz-Credential, X-Amz-Security-Token), generic
 * `signature`/`sig`/`token`/`key`/`secret` query params, and GCS/Azure
 * (`Signature`, `sig`, `X-Goog-Signature`). Case-insensitive parameter names.
 */
const CREDENTIAL_QUERY_PARAM =
  /([?&](?:x-amz-signature|x-amz-credential|x-amz-security-token|x-goog-signature|signature|sig|token|secret|awsaccesskeyid|access[_-]?key[_-]?id)=)[^&#\s]+/giu;

function scrubCredentialQueryParams(value: string): string {
  return value.replace(CREDENTIAL_QUERY_PARAM, `$1${REDACTION_PLACEHOLDER}`);
}

/**
 * BEARER BLOBS. A credential explicitly introduced by `Bearer ` (an Authorization
 * header value that leaked into a message). We redact the blob that FOLLOWS
 * `Bearer ` only -- the `Bearer ` marker is the high-confidence signal, so this
 * cannot fire on a content hash sitting in free text (a hash is never prefixed
 * with the literal word Bearer). Requires 20+ following credential chars so a
 * bare "Bearer token required" sentence is untouched.
 */
const BEARER_BLOB = /\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/gu;

function scrubBearerBlobs(value: string): string {
  return value.replace(BEARER_BLOB, `Bearer ${REDACTION_PLACEHOLDER}`);
}

/**
 * Apply every string-shape scrub. Order is irrelevant (the patterns target
 * disjoint spans) but userinfo runs first so a `postgres://u:p@h?token=x` line
 * has both its authority credential AND its query credential removed.
 */
function scrubString(value: string): string {
  return scrubBearerBlobs(scrubCredentialQueryParams(scrubUrlUserinfo(value)));
}

const MAX_DEPTH = 12;
const MAX_NODES = 5_000;

/**
 * Deep-walk `value`, returning a redacted COPY. Objects and arrays are rebuilt;
 * primitive strings are shape-scrubbed; a value under a denylisted key is
 * replaced wholesale regardless of its type. Non-plain objects (Error, Date,
 * Buffer, class instances) are stringified through their own `String()` and then
 * shape-scrubbed, because an Error nested in an event still carries its message.
 * Depth and node budgets bound the walk; on overflow the offending subtree is
 * replaced with a truncation marker rather than throwing.
 */
export function redactForLog<T>(value: T): T {
  const state = { nodes: 0 };
  return walk(value, false, 0, state) as T;
}

function walk(value: unknown, keyIsDenied: boolean, depth: number, state: { nodes: number }): unknown {
  if (keyIsDenied) {
    // A denylisted key redacts its ENTIRE value: a nested object under `credentials`
    // is a credential regardless of its inner shape.
    return value === undefined ? undefined : REDACTION_PLACEHOLDER;
  }
  if (state.nodes++ > MAX_NODES || depth > MAX_DEPTH) return '[truncated]';

  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => walk(item, false, depth + 1, state));
  }

  // Non-plain objects (Error/Date/Buffer/class instances): stringify and scrub.
  // Plain objects and null-prototype objects are rebuilt key by key.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    return scrubString(String(value));
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = walk(child, keyIsSensitive(key), depth + 1, state);
  }
  return out;
}

/**
 * Redact the free-form error string produced by `String(error?.message ?? error)`
 * on the fatal paths. A pg driver error, for instance, can embed the connection
 * string ("connection to server at ... failed: password authentication failed for
 * user 'x'") or a presigned url. This applies ONLY the string-shape scrubs
 * (userinfo, credential query params, bearer blobs) plus one extra rule for
 * env-var-shaped credential assignments, and never touches content hashes.
 *
 * ENV-VAR-SHAPED CREDENTIALS. An error that echoes a raw assignment like
 * `MEERKAT_PERSONA_SESSION_SECRET=deadbeef...` (a misconfiguration message that
 * splices the value in) has the credential in the value half. We redact the value
 * ONLY when the NAME half is a credential-shaped env var (matches the same key
 * denylist), so `PORT=8894` or `MEERKAT_STORE_BACKEND=file` are untouched.
 */
const ENV_ASSIGNMENT = /\b([A-Z][A-Z0-9_]*)=([^\s"']+)/gu;

export function redactErrorDetail(detail: string): string {
  const shapeScrubbed = scrubString(detail);
  return shapeScrubbed.replace(ENV_ASSIGNMENT, (match, name: string) =>
    keyIsSensitive(name) ? `${name}=${REDACTION_PLACEHOLDER}` : match,
  );
}
