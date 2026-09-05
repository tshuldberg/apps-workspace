# manhattan

- This is the canonical standalone. Preserve the hidden hub state until an authorized release change.
- Discovery refreshes are device-local; only explicit saves promote listings into syncable mh_events.
- Production SeatGeek calls use the proxy; do not bundle its private provider key. Direct-key use is explicit development-only behavior.
- Bootstrap required hub tables in the standalone database and keep foreign keys enabled. Preserve timezone-correct calendar export and truthful entitlement/notification readiness.
