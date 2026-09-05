# Meerkat launch readiness review + multi-device testbed

**Date:** 2026-07-24
**Tree:** `main` at `a8732afb`
**Ask:** review Meerkat's launch readiness against the code (trust nothing from docs), make every action and behaviour testable across Mac, PC, iPhone, and a friend's own devices, and produce an HTML screen walkthrough plus a non-technical installation guide.

## What was done

### 1. Code-verified readiness review

Read the Meerkat surface directly rather than trusting the ledger: `apps/meerkat` (43 routes), `apps/meerkat-web`, `packages/meerkat-relay`, `packages/sync`, `packages/meerkat-native-transport`, `packages/meerkat-call-native`. Ran all four test suites locally: **6,404 passed** (sync 2,406 / relay 1,587 / app 1,408 / web 1,003), which matches the rc12 ledger's local-verification claim exactly. The 189 skipped relay tests are the PostgreSQL/S3/MinIO integration suites needing live services, honestly skipped.

Confirmed native modules are real authored sources, not shells: 464/383 lines of Nearby (Multipeer / Wi-Fi Direct), 287/241 of BLE wake, 640/502 of CallKit/Telecom. All lazy-required and null without a dev build, so Expo Go degrades honestly.

### 2. Live two-device browser session

Drove the real production web bundle in two isolated browser profiles against a real relay. Verified by observation: age gate, identity generation (distinct keypairs, safety codes `8db6dc62` / `942b584e`), fail-closed app unlock, unlock restore, community creation, channel messaging, signed invite generation, invite preview and verification, joining, device pairing, and the core proof itself: **a real message crossing between two independent identities over the relay** (`completed · wan_relay · peer ac3bc8…299a · sent 2 / received 0`).

### 3. Two defects found, neither visible to the test suite

**Defect 1 (high, web only).** Creating a community from any of the six templates fails with `cannot start a transaction within a transaction` and creates nothing. `apps/meerkat-web/src/lib/community-template-commit.ts` calls `storeOwnedCommunity` inside `db.transaction`; that path mints the first epoch key via `createGroupCommit` (`packages/sync/src/protocol/group-keys.ts:199`), which opens its own transaction. The browser adapter (`browser-database-adapter.ts:128`) issues a raw `BEGIN` with no savepoint or depth tracking.

This is parity drift. The mobile twin documents the exact hazard in its header ("BEGIN-inside-BEGIN throws") and calls `storeOwnedCommunity` *before* opening its transaction. The web twin lost that ordering.

Invisible to CI because `createInMemoryTestDatabase` delegates to better-sqlite3's `raw.transaction(fn)()` (`packages/db/src/test-utils.ts:22`), which nests via SAVEPOINTs. **The test adapter is more permissive than the adapter that ships**, so this whole class of bug cannot be caught by web tests as currently wired.

**Defect 2 (high, web and mobile).** Sync fails with `No relay URL configured.` while the panel above still reads "Free server reachable". The free default relay is health-gated on a `/healthz` probe cached for `RELAY_PROBE_TTL_MS = 60_000`, but the probe is only written on mount (provider boot effect + `ConnectionStatusCard` `useEffect`, no interval anywhere). Any sync more than 60 seconds after the last mount silently loses its relay URL. Pairing two devices always takes longer than 60 seconds, so the first sync a new pair attempts reliably lands in the window.

Workaround: set the connection server URL explicitly; a user-set `relay_url` bypasses the health gate (`default-relay.ts:100`, `resolved.source === 'user'`).

### 4. Multi-device testbed

`artifacts/meerkat-testbed/` (untracked, deliberately outside the release tree so it can never enter an evidence-bound candidate).

One Node process serves four things on one origin:
1. the real, unmodified meerkat-web production bundle,
2. WebSocket upgrades TCP-proxied to the real `@mylife/meerkat-relay` on loopback (no protocol emulation),
3. `/healthz` proxied to that same relay, so the client's health gate passes only on a genuine answer,
4. **the one stubbed thing**: `/api/entitlements/meerkat-app` grants the $4.99 unlock to every caller, because the real hosted service refuses to boot without live Stripe and RevenueCat credentials. The stub is announced in the boot banner, in every response body, and on `/testbed`.

`start.sh tunnel` opens a Cloudflare quick tunnel, bakes the resulting origin into the web build (`VITE_MEERKAT_DEFAULT_RELAY_URL`, `VITE_MEERKAT_HOSTED_API_URL`), and serves. `start.sh lan` does the same over plain HTTP on the LAN.

Verified end to end over the public HTTPS origin with a third fresh profile: onboarding, unlock, and **"Free server reachable"** against the tunnelled relay, in a secure context (so getUserMedia and PWA install are available to testers).

### 5. Documents

| Document | Purpose |
|---|---|
| `docs/reports/REPORT-meerkat-launch-readiness-2026-07-24.{md,html}` | The review, with both defects and their root causes |
| `docs/reports/REPORT-meerkat-screen-walkthrough-2026-07-24.html` | 21 web screens recreated in HTML with real design tokens and real copy, each with its test actions and verified status, plus the 43-route mobile inventory |
| `docs/guides/meerkat-tester-guide-2026-07-24.html` | Non-technical install-and-test guide: iPhone home-screen install, PC install, onboarding, unlock, join, pair, sync, checklists, known-bugs list, reporting template |

All three are served by the testbed at `/readiness`, `/walkthrough`, `/guide`.

## Findings about the pipeline itself

- The web test database nests transactions; the shipped browser adapter cannot. Any web path that nests passes CI and throws in a browser.
- `check:meerkat-parity` did not catch the web/mobile divergence in `community-template-commit.ts`.
- `apps/meerkat-web/e2e/launch-paths.spec.ts` only creates a community through onboarding (the non-template path), so it never touches the broken code.

## Product observation, not a defect

Being in the same community is not sufficient to exchange messages: two devices must also pair by swapping `MKPAIR1-` codes, then run a manual session with a shared phrase (Listen on one, Sync now on the other). For a product being positioned against Discord this is the largest UX gap, and it is independent of both defects. Worth an explicit product decision before launch.

## Recommendation

Hold the launch. Fix the web template commit ordering, close the relay-probe staleness, add a template case to the launch-path e2e spec, and make the in-memory test adapter non-nesting. Cut rc13 at the new SHA and rerun `release-verify`. Everything else that was testable today either works or honestly says it cannot.

## Not done

- No app source was modified. The change freeze is on; both fixes need a new SHA and a new release candidate.
- Web WebRTC calls remain unexercised. The testbed's HTTPS origin now makes them testable, and they are the highest-value untested surface.
- Mobile remains untestable on device without an EAS dev build.
