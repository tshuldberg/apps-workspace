/**
 * Latency-based relay selection (plan 14, MK-036).
 *
 * The relay-first ladder (MK-014) decides to PREFER a relay; this decides WHICH
 * relay. Given a candidate list (a region pool), probe each relay's /healthz,
 * drop the unhealthy, and pick the lowest-latency survivor -- the client always
 * lands on the nearest healthy relay. Probing is injectable so the selector is
 * deterministically testable; the default probe is a plain HTTP GET to
 * `${relay}/healthz` (ws->http, wss->https) over the global fetch, so it runs on
 * RN, browsers, and Node without a new dependency.
 *
 * The relay fleet deploy (3 regions) + its runbook are ops; this is the
 * client-side selection the deploy is in service of.
 */

export interface RelayHealth {
  url: string;
  healthy: boolean;
  latencyMs: number;
  /** Present on a reachable relay: its current connection count, for tie-breaks. */
  connections?: number;
}

/** Probe one relay. Resolves health + latency; never throws. */
export type RelayProbe = (url: string, timeoutMs: number) => Promise<RelayHealth>;

export interface SelectRelayOptions {
  candidates: readonly string[];
  /** Injectable probe (defaults to an HTTP /healthz GET). */
  probe?: RelayProbe;
  /** Per-probe timeout. Default 3s. */
  timeoutMs?: number;
}

/** ws://host:port -> http://host:port/healthz (wss -> https). */
export function relayHealthUrl(relayUrl: string): string {
  const trimmed = relayUrl.replace(/\/+$/, '');
  const http = trimmed.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
  return `${http}/healthz`;
}

/** Default probe: GET /healthz, measure round-trip, parse `{ ok, connections }`. */
export const defaultRelayProbe: RelayProbe = async (url, timeoutMs) => {
  const g = globalThis as unknown as { fetch?: typeof fetch };
  if (!g.fetch) return { url, healthy: false, latencyMs: Number.POSITIVE_INFINITY };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  (timer as { unref?: () => void }).unref?.();
  const start = performanceNow();
  try {
    const res = await g.fetch(relayHealthUrl(url), { signal: controller.signal });
    const latencyMs = performanceNow() - start;
    if (!res.ok) return { url, healthy: false, latencyMs };
    let connections: number | undefined;
    try {
      const body = (await res.json()) as { ok?: boolean; connections?: number };
      if (body?.ok === false) return { url, healthy: false, latencyMs };
      connections = typeof body?.connections === 'number' ? body.connections : undefined;
    } catch {
      // A 200 with an unparseable body still counts as reachable.
    }
    return { url, healthy: true, latencyMs, connections };
  } catch {
    return { url, healthy: false, latencyMs: Number.POSITIVE_INFINITY };
  } finally {
    clearTimeout(timer);
  }
};

function performanceNow(): number {
  const p = (globalThis as unknown as { performance?: { now(): number } }).performance;
  return p ? p.now() : 0;
}

/** Probe every candidate concurrently. Order matches `candidates`. */
export async function probeRelays(options: SelectRelayOptions): Promise<RelayHealth[]> {
  const probe = options.probe ?? defaultRelayProbe;
  const timeoutMs = options.timeoutMs ?? 3_000;
  return Promise.all(options.candidates.map((url) => probe(url, timeoutMs)));
}

/**
 * Pick the nearest healthy relay: lowest latency wins; ties break toward the
 * less-loaded relay, then candidate order. Returns null if none are healthy.
 */
export async function selectRelay(options: SelectRelayOptions): Promise<RelayHealth | null> {
  const results = await probeRelays(options);
  const order = new Map(options.candidates.map((url, i) => [url, i]));
  const healthy = results.filter((r) => r.healthy);
  if (healthy.length === 0) return null;
  healthy.sort((a, b) =>
    a.latencyMs - b.latencyMs
    || (a.connections ?? 0) - (b.connections ?? 0)
    || (order.get(a.url) ?? 0) - (order.get(b.url) ?? 0));
  return healthy[0]!;
}

/**
 * The full dial order: healthy relays nearest-first, then any unprobed/unhealthy
 * candidates as last-ditch fallbacks (a probe can fail while the relay works).
 */
export async function rankRelays(options: SelectRelayOptions): Promise<string[]> {
  const results = await probeRelays(options);
  const order = new Map(options.candidates.map((url, i) => [url, i]));
  const healthy = results.filter((r) => r.healthy).sort((a, b) =>
    a.latencyMs - b.latencyMs || (order.get(a.url) ?? 0) - (order.get(b.url) ?? 0));
  const unhealthy = results.filter((r) => !r.healthy).sort((a, b) =>
    (order.get(a.url) ?? 0) - (order.get(b.url) ?? 0));
  return [...healthy.map((r) => r.url), ...unhealthy.map((r) => r.url)];
}
