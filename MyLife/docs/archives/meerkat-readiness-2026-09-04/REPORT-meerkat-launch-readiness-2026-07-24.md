# Meerkat launch readiness, code-verified

**Date:** 2026-07-24
**Tree reviewed:** `main` at `a8732afb` (working tree clean apart from `memory.md`)
**Active release ledger:** `meerkat-2026-07-21-rc12` bound to `985a7dc7`, launch state NO-GO
**Method:** source reading, git history, full local test runs, and a live two-device browser session against a real relay. No claim in this report rests on a document; every row cites code or an observed run.

---

## 1. Verdict

Meerkat's core proposition is real and it works. Two independent identities, in two isolated browser profiles, created a signed community, exchanged a signed invite, paired, and moved a real message over a real relay. That is the whole product thesis and it holds up under test.

Two defects found by testing block a clean launch. Neither is visible to the test suite, and neither appears in the rc12 ledger.

| | |
|---|---|
| Core private messaging over a relay | **Works, verified end to end** |
| Community creation from a template | **Broken on web** (defect 1) |
| Free default connection server | **Breaks after 60 seconds** (defect 2) |
| Voice / video / rooms | Built, correctly reported unavailable |
| Public tier, Discover, publishing | Built, correctly reported unavailable |
| Push, hosted backup, hosted history | Built, correctly reported unavailable |
| Recommendation | **Hold launch. Fix defects 1 and 2, cut a new rc.** |

The honesty engineering in this codebase is unusually strong. Every unavailable capability says so in plain language instead of pretending. The two defects below are the exceptions: both fail in ways a user cannot diagnose.

---

## 2. Defects found by testing

### Defect 1: Creating a community from any template fails on web

**Severity: high. Launch-blocking. Web only.**

Observed: in the "Add a community" dialog, picking any of the six templates (Family Space, Media Library, Club, Course Hub, Newsroom, Blank) and pressing "Create community" surfaces the error

> cannot start a transaction within a transaction

and creates nothing. Screenshot: `artifacts/meerkat-testbed/shots/07-BUG-template-transaction.png`.

Root cause: `apps/meerkat-web/src/lib/community-template-commit.ts` wraps the whole commit in one `db.transaction(...)` and calls `storeOwnedCommunity` inside it. `storeOwnedCommunity` (`apps/meerkat-web/src/lib/meerkat-data.ts:1818`) mints the first epoch key through `createGroupCommit`, which opens its **own** `db.transaction` (`packages/sync/src/protocol/group-keys.ts:199`). The browser adapter issues a raw `BEGIN` with no savepoint or depth tracking (`apps/meerkat-web/src/lib/storage/browser-database-adapter.ts:128`), so the inner `BEGIN` throws.

This is parity drift, not a novel bug. The mobile twin already knows about the hazard and is written correctly. `apps/meerkat/app/(root)/data/community-template-commit.ts` says so in its header:

> storeOwnedCommunity mints the workspace epoch inside its OWN transaction, so it cannot be nested inside another transaction on expo-sqlite (BEGIN-inside-BEGIN throws)

and calls `storeOwnedCommunity` **before** opening the transaction for libraries and identity. The web twin lost that ordering.

Fix: mirror the mobile ordering. Call `storeOwnedCommunity` outside the transaction, then open one transaction for `createLibrary` and `publishCommunityIdentity`, and purge on failure the way mobile does with `purgeLocalCommunity`.

Why the suite missed it: `commitCommunityTemplate` is covered by `apps/meerkat-web/src/lib/__tests__/community-template-commit.test.ts`, but that test runs on `createInMemoryTestDatabase`, whose `transaction` delegates to better-sqlite3's `raw.transaction(fn)()` (`packages/db/src/test-utils.ts:22`). better-sqlite3 nests transactions with SAVEPOINTs automatically. The shipped browser adapter does not. **The test adapter is more permissive than the adapter that ships**, so this whole class of bug is invisible to web tests.

Mitigation already present: the failure is atomic and honest. Nothing half-built persists and the error surfaces rather than being swallowed.

### Defect 2: The free default connection server goes stale after 60 seconds

**Severity: high. Launch-blocking. Affects web and mobile.**

Observed: after pairing two devices (which takes longer than a minute of copying codes), pressing "Sync now" failed with

> No relay URL configured.

while the same dialog still displayed **"Free server reachable"**. Setting the connection server URL explicitly in Settings made the identical session succeed immediately: `completed · wan_relay · peer ac3bc8…299a · sent 2 / received 0`.

Root cause: the free default relay is health-gated. `effectiveRelayUrl` returns the default only when a cached `/healthz` probe says reachable (`packages/sync/src/transport/default-relay.ts:100`). That cache expires after `RELAY_PROBE_TTL_MS = 60_000` (`apps/meerkat-web/src/lib/meerkat-data.ts:160`, mirrored at `apps/meerkat/app/(root)/data/db.ts:183`). But the probe is only ever **written on mount**: once in the provider boot effect (`apps/meerkat-web/src/lib/MeerkatProvider.tsx:1204`) and once when `ConnectionStatusCard` mounts (`apps/meerkat-web/src/ui/sync/ConnectionStatusCard.tsx:118`, a `useEffect` with no interval). There is no refresh timer anywhere.

So any sync attempted more than 60 seconds after the last mount silently loses its relay URL, and the user sees a message that contradicts the status label two inches above it. The first sync a new pair of users ever attempts is almost guaranteed to land in this window, because exchanging pairing codes takes longer than a minute.

A user-set relay URL bypasses the gate entirely (`resolved.source === 'user'` returns unconditionally), which is why the explicit URL fixed it.

Fix options, in order of preference:
1. Re-probe on demand inside the sync path when the cached probe is stale, before concluding there is no relay.
2. Refresh the probe on an interval while the Sync dialog or Settings is open.
3. Raise the TTL and add the "Check again" affordance that mobile has and web lacks (`apps/meerkat/app/(root)/components/ConnectionStatusCard.tsx` line ~181). Weakest option: it narrows the window without closing it.

Whatever is chosen, the "Free server reachable" label must derive from the same read as the dial, so the two can never disagree.

---

## 3. What was verified working, by observation

Every row below was exercised in a live browser session against the real relay on 2026-07-24. Two isolated browser profiles were used so the identities, keys, and SQLite databases were genuinely separate.

| Capability | Evidence |
|---|---|
| First-launch age gate | Neutral date entry, checked in-browser, refuses under-13; blocks onboarding until answered |
| Identity generation | Distinct Ed25519 keypairs per profile: safety codes `8db6dc62` and `942b584e`, friend codes `MEER-E4QK-…` and `MEER-K0VA-…` |
| App unlock fail-closed | Locked profile bounced from "Create a community" straight to Settings → Unlock, and created nothing |
| App unlock restore | "Restore purchase" against the entitlement endpoint unlocked the full private surface |
| Community creation from scratch | "Test Crew" created with a `general` channel, owner role, member list |
| Channel messaging | Message composed, sent, rendered with author and timestamp |
| Invite generation | Signed `meerkat://community/join#…` link plus QR, 48-hour expiry stated |
| Invite preview before joining | Second profile previewed "Test Crew · 1 member · 1 channel · Invited by an owner · Expires in 2 days" before committing |
| Joining a community | Second profile joined and rendered the community, channel list, and its own member row |
| Device pairing | `MKPAIR1-…` code exchange both directions; both sides showed "Paired devices: 1" |
| **Relay sync between two devices** | **`completed · wan_relay · peer ac3bc8…299a · sent 2 / received 0`; the message appeared verbatim on the second device** |
| Relay health gate | "Free server reachable" only after a real `/healthz` round trip to the running relay |
| Community administration | Channels, categories, topics, archive, reorder, member list, sync policy, join requests, owner review, invites, make-public |
| Themes | Six built-in themes with contrast ratings, custom theme editor, share-as-code, import |
| Capability honesty page | "What works today" renders live/partial/pending derived from real flags, not hand-maintained copy |
| Storage and backup surface | Destinations, budget caps, local counts, honest "Nothing is backed up yet" empty state |
| Messages / DM surface | Own-devices linking, honest "No conversations yet. Meerkat never creates fake chats." |
| Discover | Category browse with honest "Could not reach a public directory" when no host is configured |
| Public | Honest "Public accounts are off in this build" |
| Library | Personal library hub with honest empty state |
| Reactions | ❤️ 👍 😂 😮 😢 🎉 controls present on messages |

### Test suites at `a8732afb`

Run locally today, all green:

| Package | Result |
|---|---|
| `@mylife/sync` | 194 files, 2,406 passed, 3 skipped |
| `@mylife/meerkat-relay` | 204 files passed / 35 skipped, 1,587 passed, 189 skipped |
| `@mylife/meerkat-app` | 140 files, 1,408 passed |
| `@mylife/meerkat-web` | 134 files, 1,003 passed |
| **Total** | **6,404 passed** |

This matches the rc12 ledger's local-verification claim exactly, so that claim is accurate. Note the 189 skipped relay tests are the PostgreSQL, S3, and MinIO integration suites, which need live services; they are honestly skipped, not silently passing.

---

## 4. Native code is real, but needs a build the project has not produced

The native modules are not stubs. Authored, non-trivial sources exist:

| Module | Lines |
|---|---|
| `MeerkatNearbyModule.swift` (iOS Multipeer) | 464 |
| `MeerkatNearbyModule.kt` (Android Wi-Fi Direct) | 383 |
| `MeerkatBleWakeModule.swift` | 287 |
| `MeerkatBleWakeModule.kt` | 241 |
| `MeerkatCallKitModule.swift` | 640 |
| `MeerkatTelecomModule.kt` | 502 |

All of them are lazy-required and return null when the native side is absent, so Expo Go degrades honestly instead of pretending. That also means **none of this runs without an EAS dev build**, which is founder-ops work that has not happened. Direct-call media on mobile needs `@livekit/react-native-webrtc` from a dev build (`apps/meerkat/app/(root)/data/call-media-backend.ts:79`); the file itself is marked `UNVERIFIED - pending dev build`.

On web, `apps/meerkat-web/src/lib/call-media-backend.ts` uses native browser WebRTC and is marked `UNVERIFIED - pending live browser QA`. This one **is** testable today over an HTTPS origin, and the testbed's tunnel mode provides one. It has not been exercised yet.

---

## 5. What is deliberately unavailable and says so

None of these are defects. Each one is a real implementation that fails closed because its operator-side dependency is not provisioned. The app states the reason in plain language everywhere it appears.

| Capability | What the app says | What it needs |
|---|---|---|
| Voice, video, rooms | "built but not available yet: placing or joining one needs the full app build and a connection server" | Dev build + LiveKit deployment |
| Public accounts and feed | "needs a connection to a Meerkat account server, and this build has none configured" | Account service deploy (Plan 51) |
| Discover | "No directory host responded" | Public directory node |
| Public posting | "Policy links are not configured in this build. Public posting stays unavailable." | Hosted legal pages |
| Push notifications | "Not available in this build" | Push gateway + APNs/FCM credentials |
| Hosted backup, history, file storage | "not connected in this build" | Hosted service + Stripe/RevenueCat |
| Background sync | "The manual drain works today; scheduled background runs need a dev build" | Dev build |
| Photo map | mobile-only, needs a dev build and a map pack | Dev build + tile packs |

---

## 6. Findings about the testing pipeline itself

**The web test database is more permissive than the shipped one.** This is how defect 1 survived 1,003 web tests. `createInMemoryTestDatabase` nests transactions via better-sqlite3 savepoints; `browser-database-adapter` cannot nest at all. Any web code path that nests transactions passes in CI and throws in a browser. Worth a targeted fix: give the in-memory test adapter the same non-nesting semantics as the browser adapter, or add a test adapter variant that does, and run the web suite against it.

**`check:meerkat-parity` did not catch the web/mobile divergence** in `community-template-commit.ts`, even though the mobile file documents the exact hazard the web file walks into. The parity gate compares some surfaces but evidently not transaction structure in twinned modules.

**The launch-path e2e suite does not cover template creation.** `apps/meerkat-web/e2e/launch-paths.spec.ts` creates a community through onboarding, which uses the non-template path. Adding one template creation to that spec would have caught defect 1 the day it landed.

---

## 7. Recommendation

Hold the launch. Neither defect is large, and both have a clear fix with a known-good reference:

1. Fix web `community-template-commit.ts` to mirror the mobile ordering.
2. Close the relay-probe staleness so the dial and the status label read the same source.
3. Add a template-creation case to the launch-path e2e spec.
4. Make the in-memory test adapter non-nesting so this class of defect cannot hide again.
5. Cut rc13 at the new SHA and rerun `release-verify`.

The change freeze is on, so each of these is a new SHA and a new release candidate. That is the correct process and it should be followed.

Everything else that was testable today either works or honestly says it cannot. That is a strong position to be in one fix cycle before launch.

---

## 8. How to reproduce all of this

A test harness lives at `artifacts/meerkat-testbed/` (untracked, outside the release tree). It runs the real relay and the real production web bundle on one origin, and stubs only the one thing that cannot exist yet: the entitlement endpoint that grants the $4.99 unlock. That stub is announced in the boot banner, in every response body, and on its own status page.

```bash
artifacts/meerkat-testbed/start.sh tunnel   # HTTPS for phones, PWA install, and calls
artifacts/meerkat-testbed/start.sh lan      # plain HTTP on the local network
```

Companion documents:

- Screen walkthrough: `docs/reports/REPORT-meerkat-screen-walkthrough-2026-07-24.html`
- Tester guide for a non-technical user: `docs/guides/meerkat-tester-guide-2026-07-24.html`
