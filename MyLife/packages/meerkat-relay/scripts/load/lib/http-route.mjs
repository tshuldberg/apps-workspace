/**
 * Pure HTTP route evaluators for the HTTP load harness (Plan 44 WP-7B). Std-lib
 * only; exported for unit tests.
 *
 * A route spec is `<kind>=<url>` or a bare `<url>` (kind defaults to `get`). The
 * kind selects the per-response evaluator so a load run over the private surfaces
 * asserts the RIGHT invariant per route, never a blanket "2xx is fine":
 *
 *   healthz  the relay /healthz zero-knowledge shape: HTTP 200 AND a body that is
 *            EXACTLY { ok:true, connections:<number> } with NO extra field. A
 *            regression that adds a field is a leak, so a shape violation is an
 *            ERROR outcome for that request even at HTTP 200.
 *   readyz   the service /readyz walk: 200 -> ok, 503 -> a healthy "not ready"
 *            (still a valid answer, counted completed but flagged notReady), any
 *            other status or a body without a boolean `ready` -> error.
 *   get      an arbitrary GET route template: any 2xx is a completed success; a
 *            non-2xx is an error. Used for generic route coverage.
 */

/** Parse a `<kind>=<url>` / `<url>` route spec. Returns null when malformed. */
export function parseRouteSpec(spec) {
  const raw = String(spec ?? '').trim();
  if (!raw) return null;
  const eq = raw.indexOf('=');
  let kind = 'get';
  let url = raw;
  if (eq !== -1) {
    kind = raw.slice(0, eq).trim().toLowerCase();
    url = raw.slice(eq + 1).trim();
  }
  if (!url) return null;
  if (!(url.startsWith('http://') || url.startsWith('https://'))) return null;
  if (!['healthz', 'readyz', 'get'].includes(kind)) return null;
  return { kind, url };
}

/**
 * Evaluate one HTTP response for a route kind. PURE. Returns
 * { outcome: 'success'|'error', class, notReady? }. `outcome:'error'` is what the
 * verdict layer counts against the error-rate ceiling.
 */
export function evaluateHttpResponse(kind, status, body) {
  if (kind === 'healthz') return evaluateHealthz(status, body);
  if (kind === 'readyz') return evaluateReadyz(status, body);
  return evaluateGet(status);
}

function evaluateHealthz(status, body) {
  if (status !== 200) return { outcome: 'error', class: `status_${status}` };
  let parsed;
  try {
    parsed = JSON.parse(String(body));
  } catch {
    return { outcome: 'error', class: 'malformed_json' };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { outcome: 'error', class: 'not_object' };
  }
  const keys = Object.keys(parsed).sort();
  // EXACTLY {ok, connections}: any extra field is a zero-knowledge regression.
  if (keys.length !== 2 || keys[0] !== 'connections' || keys[1] !== 'ok') {
    return { outcome: 'error', class: 'shape_violation' };
  }
  if (parsed.ok !== true) return { outcome: 'error', class: 'ok_not_true' };
  if (typeof parsed.connections !== 'number' || !Number.isFinite(parsed.connections)) {
    return { outcome: 'error', class: 'connections_not_number' };
  }
  return { outcome: 'success', class: 'shape_ok' };
}

function evaluateReadyz(status, body) {
  // 200 ready or 503 not-ready are both valid ANSWERS from a live service.
  if (status === 200 || status === 503) {
    let parsed;
    try {
      parsed = JSON.parse(String(body));
    } catch {
      return { outcome: 'error', class: 'malformed_json' };
    }
    if (parsed === null || typeof parsed !== 'object' || typeof parsed.ready !== 'boolean') {
      return { outcome: 'error', class: 'no_ready_flag' };
    }
    return { outcome: 'success', class: parsed.ready ? 'ready' : 'not_ready', notReady: !parsed.ready };
  }
  return { outcome: 'error', class: `status_${status}` };
}

function evaluateGet(status) {
  if (status >= 200 && status < 300) return { outcome: 'success', class: `status_${status}` };
  return { outcome: 'error', class: `status_${status}` };
}
