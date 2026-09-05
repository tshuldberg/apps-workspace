# Meerkat Plan 20 — Phase 0: health-gated default-relay resolution + centralization

Date: 2026-06-28
Branch: `feature/mylife-improvements-sprints` (the Meerkat launch-program branch; Plan 18 lives here too)
Plan: `docs/plans/queue/20-meerkat-connectivity-and-self-hosting.md`

## Goal

Phase 0 is the engine spine of Plan 20 (connectivity + self-hosting). It makes a
free default connection server **honest and opt-out-respecting** before any relay
is deployed, and it routes every networked dial through a single choke point so
the per-device opt-out + a real `/healthz` health gate actually govern the
transport (not just status copy). This is the hard prerequisite for Full DMs,
Public Social, and Launch Readiness. Founder chose "Phase 0, then check in."

## What shipped (test-first, TDD)

### Engine core (`@mylife/sync`, pure, RN-safe)
- `packages/sync/src/transport/default-relay.ts` (new):
  - `resolveDefaultRelay(input)` — async, probes the resolved URL for live status.
  - `resolveDefaultRelaySync(input)` — display-only from a cached probe row.
  - `effectiveRelayUrl(input)` — the dial decision: a user URL is **always**
    returned; the free default is returned **only** when its last real probe
    passed and the user has not opted out; `''` otherwise.
  - Built on the existing real `RelayHealth` / `probeRelays` (`relay-selector.ts`);
    no crypto touched.
- Exported from **both** barrels (`index.native.ts` + `index.ts`) — the native
  barrel export is mandatory (the multi-node harness imports only the native one).
- `packages/sync/src/__tests__/default-relay.test.ts` (16 tests): source
  precedence (TC-1), reachability gating (TC-2), opt-out, the dial choke point,
  AC-2/AC-4.

### Plan-vs-reality reconciliation (surfaced, not silently changed)
- The plan's pseudo-types named `RelayProbe` as the probe *result*; the real
  export `RelayProbe` is the probe *function* and `RelayHealth` is the result.
  The resolver was built on the real `RelayHealth`, not a conflicting type.
- The plan says `effectiveRelayUrl(db)` is "in `@mylife/sync`". App Isolation +
  the RN-safe barrel mean `@mylife/sync` cannot read an app's DB. So the **pure
  decision** lives in `@mylife/sync` (`effectiveRelayUrl(input)`); each app has a
  thin `effectiveRelayUrl(db)` wrapper that does the DB reads and delegates.

### Both apps (mobile `apps/meerkat`, web `apps/meerkat-web`)
- `mk_relay_probe` table (device-local, never replicated) + `getRelayProbe`
  (TTL-aware, `RELAY_PROBE_TTL_MS = 60_000`) + `writeRelayProbe` (probe-race
  guard: a stale probe never overwrites a newer row). Mobile `data/db.ts`, web
  `schema.ts` + `meerkat-data.ts`.
- New `mk_settings` keys: `default_relay_optout`, `adopted_server_url`.
- `effectiveRelayUrl(db)` wrapper: mobile `data/effective-relay.ts`, web
  `lib/effective-relay.ts`.
- **Centralization (the AC-4 enabler):** all **21** raw
  `getSetting(db, RELAY_URL_SETTING_KEY)?.trim() || DEFAULT_RELAY_URL` dial sites
  swapped to `effectiveRelayUrl(db)` — mobile SyncProvider (8), NodeProvider (2),
  background-sync (2); web MeerkatProvider (9). Zero raw dial sites remain.

### Build-time default wiring (honest, defaults to `''`)
- Mobile: `app.json` kept as the static base; new `app.config.ts` layers
  `extra.defaultRelayUrl` from `process.env.MEERKAT_DEFAULT_RELAY_URL`.
  `sync-core.ts` `DEFAULT_RELAY_URL` reads it via a guarded `require('expo-constants')`
  (matches the `lan-backend.ts` lazy-require precedent; node/vitest falls back to
  `''`, so `sync-core` stays node-safe for the many tests that import it).
- Web: `relay.ts` `DEFAULT_RELAY_URL` reads `import.meta.env.VITE_MEERKAT_DEFAULT_RELAY_URL`
  (declared in `vite-env.d.ts`, kept **distinct** from `VITE_MEERKAT_HOSTED_RELAY_URL`
  so the paid-relay gate never flags the free default as paid).
- Unconfigured build (`''`) = today's honest behavior: every networked guard
  short-circuits; no fabricated connectivity (AC-2, honesty landmine L1).

### Tests
- Mobile Tier-B `app/__tests__/effective-relay-url.test.ts` (10) + web Tier-B
  `src/lib/__tests__/effective-relay-url.test.ts` (9): wrapper wiring over a real
  in-memory DB, including the health-gated free-default branch and AC-4 with a
  reachable default (each mocks the app's own default-URL module so the non-empty
  default branch is exercised — `DEFAULT_RELAY_URL` is `''` under node).
- `app/__tests__/app-config.test.ts` extended (2): `app.config.ts` bakes
  `extra.defaultRelayUrl` from env and defaults to `''`; static `app.json`
  invariants unchanged.

## Verification (all green)
- `@mylife/sync`: typecheck + 1196 tests.
- `@mylife/meerkat-app`: typecheck + 195 tests.
- `@mylife/meerkat-web`: typecheck + 79 tests.
- `pnpm gate:function:changed` exit 0 (incl. hub `@mylife/mobile` + `@mylife/web`
  consumer typechecks — the shared `@mylife/sync` change is consumer-compatible).
- `node scripts/check-meerkat-parity.mjs` passed. No em dashes.

## Adversarial review (feature-dev:code-reviewer) — verdict applied
- P0: none. Transport-honesty boundary intact.
- **P1-1 (FIXED):** the Tier-B wrapper test could not exercise the non-empty
  default branch (`DEFAULT_RELAY_URL` is `''` under node), so a
  configuredUrl/defaultUrl wiring bug would have been invisible. Fixed in **both**
  apps by mocking the app's own default-URL module and adding the previously
  missing web Tier-B test.
- **P2-1 (carried to Phase 3, inert now):** web `ctx.relayUrl` React state is a
  one-shot boot snapshot; once a probe is written it can go stale vs
  `effectiveRelayUrl(db)`. **No probe writer exists in Phase 0** (verified), so it
  cannot manifest until Phase 3 wires the Connection status card + probe writer.
  Phase 3 must refresh the display state after each probe write (or expose a
  derived effective-url context field). Dials are correct today; honesty intact.
- P2-2 (declined): equal-millisecond probe-race uses `>` not `>=`; reviewer
  itself rated it negligible and semantically defensible.

## Carry-forward for Phase 3
- Wire the real probe: on app start / status-card mount, `probeRelays` the
  effective default (debounced), `writeRelayProbe` the result, render the
  Connection status card (5 states). Then **refresh the display state** after the
  write (closes P2-1).
- The stale "no free default / capacity is paid" copy rewrite (Screen 0 / Phase
  3.6) is still pending — do not ship the default URL until that copy is fixed.

## Founder-ops boundary (not codeable here)
- Phase 1 (deploy the first-party relay + publish image) and Phase 1.5 (deploy
  the always-on community node + public directory) are Tier-D ops. Set
  `MEERKAT_DEFAULT_RELAY_URL` (mobile) / `VITE_MEERKAT_DEFAULT_RELAY_URL` (web)
  only after the relay is deployed and `wss://.../healthz` answers over TLS.
