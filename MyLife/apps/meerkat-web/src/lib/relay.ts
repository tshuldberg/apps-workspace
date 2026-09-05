// Default connection-server URL for the web client (Plan 20).
//
// Read at BUILD from import.meta.env.VITE_MEERKAT_DEFAULT_RELAY_URL (declared in
// src/vite-env.d.ts, kept DISTINCT from VITE_MEERKAT_HOSTED_RELAY_URL so the
// paid-relay gate never mistakes the free default for the paid tier). NEVER
// dialed directly: it is consulted only by effectiveRelayUrl(db)
// (src/lib/effective-relay.ts), which HEALTH-GATES it (dialed only after a real
// /healthz probe passes) and honors the per-device default_relay_optout.
// Defaults to '' when unset, so an unconfigured build keeps today's honest
// behavior (every networked guard short-circuits) and never implies
// connectivity it lacks. The web node is relay-only (no LAN rung in the
// browser). Mirror of DEFAULT_RELAY_URL in apps/meerkat sync-core.ts.
export const DEFAULT_RELAY_URL: string = (
  import.meta.env.VITE_MEERKAT_DEFAULT_RELAY_URL ?? ''
).trim();
