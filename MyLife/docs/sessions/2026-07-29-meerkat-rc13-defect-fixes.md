# Meerkat rc13 defect fixes (Stage 1 of the rc13/rc14 launch train)

**Date:** 2026-07-29
**Branch:** fix/meerkat-rc13-defects, squash-merged to main as `39b11c08`
**Ledger:** docs/releases/meerkat/meerkat-2026-07-29-rc13/ (supersedes rc12)
**Scope:** exactly the four items from the 2026-07-24 launch-readiness review. No feature work.

## What was done

### 1A. Web template-commit transaction nesting (defect 1)

`apps/meerkat-web/src/lib/community-template-commit.ts` wrapped the whole staged
creation in one `db.transaction` and called `storeOwnedCommunity` inside it.
That path mints the first workspace epoch via `createGroupCommit`, which opens
its own transaction; the sql.js browser adapter issues a raw `BEGIN` with no
savepoint tracking, so every template failed with "cannot start a transaction
within a transaction". The file now mirrors the mobile twin exactly: the genesis
descriptor is signed first (pure), `storeOwnedCommunity` runs outside any outer
transaction, libraries + identity commit in ONE transaction after it, and a
ported `purgeLocalCommunity` removes every written row on any failure so nothing
half-built persists. The provider comment was corrected to match. Commit
`c3336a7a` (branch), in squash `39b11c08`.

### 1B. Relay probe staleness (defect 2, both platforms)

The free-default relay is health-gated on a cached `/healthz` probe
(`mk_relay_probe`, `RELAY_PROBE_TTL_MS = 60_000`) that was only ever written by
mount effects. Fix (report option 1):

- `ensureEffectiveRelayUrl(db)` added beside the sync choke point in BOTH
  `effective-relay.ts` twins: returns a user URL immediately (bypass semantics
  unchanged), never probes when opted out or unconfigured, honors a FRESH failed
  probe (no retry spam), and only for a stale/missing default probe runs one
  real probe (in-flight deduped per db via WeakMap), writes the shared
  `mk_relay_probe` row, and re-resolves.
- Every networked dial path now awaits it: web MeerkatProvider (file grants,
  DM rail via async `dmRelay`, foreground drain, auto-connect round, file
  re-request, friend-code publish/pair, join park, public-join approval, member
  removal, `runRelaySession`), web `public-join-client`, web `CallProvider`
  `startCall`; mobile SyncProvider (channel mailbox, file request/grant,
  history request, `parkEnvelopeOnRelay`, join park + requeue, foreground
  drain, all six DM `relayAvailable` gates, auto-connect round hoisted),
  mobile `background-sync` (both entry points), mobile channel history import,
  mobile `public-join-client`, and mobile add-friend via a new
  `ensureAddFriendRelay` in both `add-friend-core` twins.
- The channel live loop's battery gate (`shouldSchedule`) now keys off a new
  `relayDialCandidateConfigured(db)` (candidate configured, probe-independent)
  so a stale cache cannot silence the loop; the tick itself gates through the
  ensured choke point and stays a zero-dial no-op when nothing is configured.
- Both ConnectionStatusCards re-probe on the cache TTL while mounted, so the
  "Free server reachable" pill and the dial read the same row and can never
  disagree.
- Twin unit suites (`effective-relay-url.test.ts` on both platforms) pin the
  re-probe, TTL-recovery repro, user-URL bypass, fresh-failure honoring,
  opt-out, failure recording, and in-flight dedup. Commit `2119075e` (branch).

### 1C. CI blind spot closed

`packages/db/src/test-utils.ts` `createInMemoryTestDatabase` delegated to
better-sqlite3's `raw.transaction(fn)()`, which auto-nests via SAVEPOINTs, so
nesting defects passed CI and failed in production adapters. It now issues raw
`BEGIN`/`COMMIT`/`ROLLBACK` exactly like the browser adapter. Proof the blind
spot is closed: with the pre-fix web commit file restored, 5 of 9 template
tests fail under the new adapter. Hub consumers were checked: no hub or module
code needed a nesting variant, so no split adapter was required. The stricter
adapter exposed one REAL latent production bug: `modules/cycle`
`upsertTemperature` nested `updateTemperature`'s transaction (would throw on
expo-sqlite at runtime); the update body is now a transaction-free core
(`applyTemperatureUpdate`) shared by both entry points. Cycle suite 203/203.
Commit `f09bf5bc` (branch).

### 1D. e2e + unit coverage

- `apps/meerkat-web/e2e/launch-paths.spec.ts` gained a template-creation case
  (chat-first Club + library-first Media Library) against the real browser
  adapter, reusing the existing `passAgeGate` + unlock-seeding helpers. Note
  for future edits: the Add-a-community dialog renders TWO "Community name"
  fields and TWO "Create community" buttons (template detail + scratch
  section); the template pair is `.first()`.
- Stale-probe re-probe behavior pinned by the twin unit suites (1B above).

## Live testbed evidence (real relay, real production bundle)

Method: `artifacts/meerkat-testbed/start.sh lan`, driven by an untracked
Playwright harness (`apps/meerkat-web/e2e-testbed/rc13-evidence.spec.ts`) using
two isolated browser contexts (separate identities, keys, and IndexedDB), page
origin `http://127.0.0.1:8899` (localhost secure context; the LAN IP origin has
no SubtleCrypto without a Chromium trust flag).

- PRE-fix bundle (fix files temporarily restored from main): template creation
  failed with the exact reported error, and a manual session run ~70s after
  pairing failed with "No relay URL configured". Screenshots
  `artifacts/meerkat-testbed/shots/rc13-prefix-*.png`.
- FIXED bundle: all six templates (Family Space, Media Library, Club, Course
  Hub, Newsroom, Blank) created successfully, and the same >60s-stale manual
  session completed on the free default: "Session completed - sent 2 /
  received 0". Screenshots `rc13-postfix-*.png`.

A leftover testbed from the 2026-07-24 session was still holding ports 8899 and
8787 and was stopped before the runs.

## Verification at 39b11c08

- `@mylife/sync` 2,406 passed (3 skipped); `@mylife/meerkat-relay` 1,587 passed
  (189 honestly skipped integration suites); `@mylife/meerkat-app` 1,416
  passed; `@mylife/meerkat-web` 1,012 passed. Total 6,421 vs the 6,404 rc12
  baseline.
- Full `pnpm check:parity` suite, `check:meerkat-transport-nc`, meerkat parity
  script, 133-task `pnpm typecheck`, full repo `pnpm test` (the single failure
  it surfaced was the latent cycle bug, fixed in 1C).
- Playwright launch-path template case green.

## Release process

- Squash merge to main: `39b11c08`, pushed under branch protection
  (`448ff393..39b11c08`, includes the seven held docs commits from
  2026-07-21..29).
- rc13 ledger cut at `docs/releases/meerkat/meerkat-2026-07-29-rc13/`
  superseding rc12 (rc12 marked `supersededBy`); dashboard re-rendered, active
  candidate now rc13.
- `release-verify` dispatched pinned to the SHA:
  run https://github.com/tshuldberg/MyLife/actions/runs/30478592527; push CI
  run https://github.com/tshuldberg/MyLife/actions/runs/30478588129. Step 1
  flips to confirmed-PASS when the pinned run completes green.
- errors_log.md: both 2026-07-24 defect rows upgraded to Resolved with commit
  links; auto-logged red-phase stubs consolidated; the cycle latent bug got its
  own Resolved row.

## Remaining in the train

Stage 2: plan 52 (person identity) on feature/meerkat-plan52-person-identity.
Stage 3: plan 53 (tap-to-add) on feature/meerkat-plan53-tap-to-add.
Stage 4: rc14 + tester guide + founder handoff.
