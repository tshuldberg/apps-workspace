/**
 * Off-host reachability probe (Plan 20, Phase 5.3). TC-10 / AC-9 / honesty L3.
 *
 * The ONE thing that may flip a host from "unverified" to "reachable": a REAL
 * round-trip to the candidate public URL performed from OFF the host (a
 * third-party echo/reachability service on the open internet, or the tunnel
 * provider's status API). cloudflared printing a wss:// URL is NOT proof -- the
 * L3 false-positive trap -- and neither is a self-fetch, because NAT hairpinning
 * / loopback would answer locally and never leave the network.
 *
 * This factory binds a candidate public URL + an external reachability service +
 * an INJECTED fetch, and returns the `offHostProbe` that `gateReachability`
 * (host/reachability.ts) consumes. It NEVER returns 'reachable' itself; it hands
 * `{ reachedFromOutside, vantage }` to the pure gate, which alone decides state
 * and which already rejects `vantage:'self'`. Two independent defenses keep a
 * hairpin self-answer from passing:
 *   1. Same-host guard: if the "service" URL resolves to the candidate's own
 *      host, that is a self-fetch -> reported `vantage:'self'` (gate rejects).
 *   2. Vantage passthrough: the service reports the vantage it observed; if the
 *      round-trip was answered by the same origin it reports 'self' and we
 *      surface it verbatim so the gate rejects it.
 * The probe owns no cryptography and reads no envelopes/tokens.
 */

import { z } from 'zod';
import type { OffHostProbeResult } from './reachability';

/** Minimal Response shape the probe needs -- keeps the injected fetch tiny/testable. */
export interface ProbeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** Injected fetch (global `fetch` in production) so the probe is unit-testable. */
export type ProbeFetch = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<ProbeResponse>;

export interface OffHostProbeConfig {
  /** The candidate public URL to verify (ws:// / wss:// or http(s)). */
  publicUrl: string;
  /**
   * The external echo/reachability service that performs the round-trip FROM
   * off-host. Must not live on the candidate's own host (see the same-host guard).
   * The probe appends the candidate as a `target` query param.
   */
  serviceUrl: string;
  /** Injected fetch; defaults to the global `fetch` when omitted. */
  fetchImpl?: ProbeFetch;
  /** Round-trip timeout in ms (default 8000). A timeout is a FAILURE, never proof. */
  timeoutMs?: number;
}

/**
 * The reachability service's response contract:
 *   { reached: boolean, vantage?: 'off-host' | 'self' }
 * `reached` is whether the service's off-host request actually completed. A
 * trustworthy third-party service reports `vantage:'off-host'`; if it detected
 * the round-trip was answered by the same origin (NAT hairpin / loopback) it
 * reports 'self', which we surface verbatim so the gate rejects it.
 */
const ProbeServiceResponseSchema = z.object({
  reached: z.boolean(),
  vantage: z.enum(['off-host', 'self']).optional(),
});

/** A failed/inconclusive probe: ran off-host, just did not confirm reachability. */
const FAILED: OffHostProbeResult = { reachedFromOutside: false, vantage: 'off-host' };
/** A self-answer / hairpin: reported 'self' so `gateReachability` rejects it. */
const SELF_ANSWER: OffHostProbeResult = { reachedFromOutside: false, vantage: 'self' };

/** Compare two URLs by host, tolerating ws(s):// and http(s):// schemes. */
function sameHost(a: string, b: string): boolean {
  try {
    return new URL(a).host.toLowerCase() === new URL(b).host.toLowerCase();
  } catch {
    return false;
  }
}

/** Append the candidate URL as a `target` query param on the service endpoint. */
function buildServiceUrl(serviceUrl: string, target: string): string {
  const u = new URL(serviceUrl);
  u.searchParams.set('target', target);
  return u.toString();
}

/**
 * Build the `offHostProbe` that `gateReachability` consumes. Calls the external
 * reachability service (never the host's own URL) and maps its answer to
 * `OffHostProbeResult`. Fail-closed: any throw / timeout / non-2xx / malformed
 * body yields `reachedFromOutside:false`. Only a genuine off-host success yields
 * `{ reachedFromOutside:true, vantage:'off-host' }`.
 */
export function createOffHostProbe(
  config: OffHostProbeConfig,
): () => Promise<OffHostProbeResult> {
  const fetchImpl = config.fetchImpl ?? (globalThis.fetch as unknown as ProbeFetch);
  const timeoutMs = config.timeoutMs ?? 8_000;

  return async (): Promise<OffHostProbeResult> => {
    // Defense 1: a "reachability service" that lives on the candidate's own host
    // is a self-fetch (hairpin risk) -- never dial it as proof of external reach.
    if (sameHost(config.serviceUrl, config.publicUrl)) return SELF_ANSWER;

    let url: string;
    try {
      url = buildServiceUrl(config.serviceUrl, config.publicUrl);
    } catch {
      return FAILED;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    (timer as { unref?: () => void }).unref?.();

    let res: ProbeResponse;
    try {
      res = await fetchImpl(url, { signal: controller.signal });
    } catch {
      return FAILED;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return FAILED;

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return FAILED;
    }

    const parsed = ProbeServiceResponseSchema.safeParse(body);
    if (!parsed.success) return FAILED;

    const { reached, vantage } = parsed.data;
    if (!reached) return FAILED;

    // Defense 2: an explicit 'self' vantage means the round-trip was answered by
    // the same origin (NAT hairpin / loopback) -- NOT a genuine external reach.
    // Fail closed on both fields (reachedFromOutside:false AND vantage:'self') so
    // even a consumer that forgot to check the vantage stays honest. An absent
    // vantage from a genuine third-party service is off-host (we dialed a service,
    // not our own loopback), so a real success is the only 'reachable' path.
    if (vantage === 'self') return SELF_ANSWER;
    return { reachedFromOutside: true, vantage: 'off-host' };
  };
}
