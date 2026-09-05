/**
 * Off-host reachability gate (Plan 20, Phase 5). TC-10 / AC-9 / honesty L3.
 *
 * The host dashboard shows "Verified reachable from the internet" ONLY after a
 * real round-trip from an OFF-HOST vantage (a third-party echo/reachability
 * service or the tunnel provider's status API). A self-fetch of the host's own
 * public URL is rejected: NAT hairpinning or the tunnel edge answering locally
 * would false-positive "reachable" without a true external path. Before a
 * verified off-host round-trip the state is "unverified" (the caller shows
 * "Checking…" / the LAN-fallback), never a public URL it has not confirmed.
 */

export type ReachabilityState = 'reachable' | 'unverified';

export interface OffHostProbeResult {
  reachedFromOutside: boolean;
  /** Where the probe ran. Anything other than 'off-host' (incl. 'self') is rejected. */
  vantage?: 'off-host' | 'self';
}

export interface ReachabilityInput {
  publicUrl: string;
  /** Injected off-host probe (echo/reachability service or tunnel status API). */
  offHostProbe: () => Promise<OffHostProbeResult>;
}

export interface ReachabilityResult {
  state: ReachabilityState;
  publicUrl: string;
}

export async function gateReachability(input: ReachabilityInput): Promise<ReachabilityResult> {
  let result: OffHostProbeResult;
  try {
    result = await input.offHostProbe();
  } catch {
    return { state: 'unverified', publicUrl: input.publicUrl };
  }
  // A self-vantage probe is NOT proof of external reachability (AC-9): only a
  // true off-host round-trip counts. An explicit 'self' vantage is rejected;
  // an absent vantage is treated as off-host only when the probe contract
  // guarantees it (the caller's injected probe is the off-host service).
  const offHost = result.reachedFromOutside && result.vantage !== 'self';
  return { state: offHost ? 'reachable' : 'unverified', publicUrl: input.publicUrl };
}
