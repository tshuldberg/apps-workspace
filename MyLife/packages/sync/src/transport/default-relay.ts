/**
 * Health-gated default-relay resolution (Plan 20, Phase 0).
 *
 * Pure decision core. No IO, no platform deps -- the probe and the cached probe
 * row are injected, so this is RN-safe and deterministically unit-testable. It
 * is the engine half of the "free default connection server" feature: it decides
 * WHICH relay the client uses and whether that choice may be DIALED, without
 * ever faking connectivity.
 *
 * The three rules, all load-bearing for transport honesty:
 *   1. A user-set `relay_url` always wins (`source:'user'`). The free default is
 *      consulted only when no user URL is set and the user has not opted out.
 *   2. Reachability is reported `true` only from a real /healthz probe
 *      (`relay-selector.ts`). Before a probe it is `'unknown'`; on failure
 *      `false`. There is no optimistic/timer path.
 *   3. `effectiveRelayUrl()` is the single choke point every networked dial
 *      flows through. A user URL is always dialed (the user chose it); the free
 *      default is dialed ONLY when its last real probe passed AND the user has
 *      not opted out. Returns `''` when nothing is dialable -- so the per-device
 *      `default_relay_optout` and the health gate actually govern the transport,
 *      not just the status copy (AC-4, honesty landmine L1).
 *
 * App-side note: each app wraps this with a thin `effectiveRelayUrl(db)` that
 * reads `relay_url`, `default_relay_optout`, and the cached `mk_relay_probe`
 * row, then delegates here. The pure logic lives here (shared + tested once);
 * the DB reads live in the app because @mylife/sync cannot import app code
 * (App Isolation) and the native barrel must stay RN-safe.
 */

import type { RelayHealth } from './relay-selector';

export interface DefaultRelayInput {
  /** The user-set relay_url. Wins whenever non-empty (after trim). */
  configuredUrl: string;
  /** The build-time default ('' when the build is unconfigured). */
  defaultUrl: string;
  /** mk_settings `default_relay_optout`: the user turned the free default off. */
  optedOut: boolean;
}

export interface ResolvedRelay {
  /** The effective URL ('' when nothing is usable). */
  url: string;
  source: 'user' | 'default' | 'none';
  /** `true` only after a real probe pass; `'unknown'` before any probe. */
  reachable: boolean | 'unknown';
}

/** Decide which URL applies and where it came from -- no reachability yet. */
function pickSource(input: DefaultRelayInput): { url: string; source: ResolvedRelay['source'] } {
  const user = input.configuredUrl.trim();
  if (user) return { url: user, source: 'user' };
  const def = input.defaultUrl.trim();
  if (def && !input.optedOut) return { url: def, source: 'default' };
  return { url: '', source: 'none' };
}

/**
 * Resolve + probe the effective relay for live status. The probe is injected
 * (reuse `probeRelays`/`defaultRelayProbe` from relay-selector at the call
 * site). `source:'none'` short-circuits and never probes.
 */
export async function resolveDefaultRelay(
  input: DefaultRelayInput & { probe: (url: string) => Promise<RelayHealth> },
): Promise<ResolvedRelay> {
  const { url, source } = pickSource(input);
  if (source === 'none') return { url: '', source, reachable: 'unknown' };
  const health = await input.probe(url);
  return { url, source, reachable: health.healthy };
}

/**
 * Display-only resolution from a cached probe row (`mk_relay_probe`). A cached
 * probe counts only when it is for the resolved URL; a mismatched or absent row
 * yields `'unknown'` (forcing the UI to show "checking", never a stale success).
 * The app drops rows older than its PROBE_TTL before passing `lastProbe`.
 */
export function resolveDefaultRelaySync(
  input: DefaultRelayInput & { lastProbe?: RelayHealth | null },
): ResolvedRelay {
  const { url, source } = pickSource(input);
  if (source === 'none') return { url: '', source, reachable: 'unknown' };
  const probe = input.lastProbe;
  const reachable: boolean | 'unknown' = probe && probe.url === url ? probe.healthy : 'unknown';
  return { url, source, reachable };
}

/**
 * The effective dial string -- the single choke point for every networked dial.
 * A user URL is always returned (the user chose it; if it is down the session
 * just fails honestly). The free default is returned ONLY when its last real
 * probe passed. Returns `''` when nothing is dialable (opted out, no reachable
 * default, or an unconfigured build).
 */
export function effectiveRelayUrl(
  input: DefaultRelayInput & { lastProbe?: RelayHealth | null },
): string {
  const resolved = resolveDefaultRelaySync(input);
  if (resolved.source === 'user') return resolved.url;
  if (resolved.source === 'default') return resolved.reachable === true ? resolved.url : '';
  return '';
}
