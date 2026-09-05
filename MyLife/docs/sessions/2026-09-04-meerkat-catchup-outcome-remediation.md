# Meerkat catch-up outcome remediation, 2026-09-04

## Scope

Continued the September 4 F5 delivery/recovery work after the storage and invitation remediation. HEAD remains `7a40639d`; prior and concurrent working-tree changes were preserved. No commit, push, deployment, purchase, account-access change, workflow dispatch, or external message was performed.

## Confirmed defects and fixes

1. The native sync engine discarded its responder session result. The shared session job returned only `ran: true`, and auto-connect counted that as a completed session. A real ten-second handshake timeout wrote a failed SQLite session while the catch-up result claimed one completion. The engine now returns the recorded responder session; both roles count completion only from `session.status === 'completed'`. Missing outcomes fail closed. Failed responder sessions also set the engine error state instead of recording a successful sync status.
2. A listener connection error was classified as `no_peer`, producing no failure count or backoff. Both roles now record failed attempts and advance backoff. An absent transport callback still skips without inventing an attempt.
3. The returned retry time came from the plan calculated before the failed dial. It omitted newly advanced backoff. Retry eligibility is now read after the attempts, and the delay starts when each attempt finishes.
4. Overlapping foreground/manual triggers could plan against the same pre-attempt state and dial twice. `packages/sync` now shares one in-flight auto-connect job per engine and clears it on resolution or rejection. This coalesces session dialing; it does not claim to serialize every independent mailbox drain or manual transport operation.
5. Mobile and web retain whether mailbox catch-up actually ran. Recovery guidance distinguishes a skipped mailbox, unavailable contacts, failed sessions, and retry eligibility. A retry time is explicitly not a delivery estimate. Existing summaries remain readable; opt-in and transport/safety policies are unchanged.
6. Automatic-trigger promise rejections previously escaped without visible recovery state. Both providers now retain the round error for the catch-up card; lifecycle callbacks consume the rejection after that state is set. A later successful round clears the error. Browser durability errors still remain visible through the separate database persistence state.

## Verification

- Negative control before the shared fix: three assertions failed in `auto-connect-job.test.ts`. The original code reported one completed session for a real recorded failed handshake, counted an unreachable listener as skipped, and omitted the new retry time. `/tmp/meerkat-catchup-negative.log`.
- Full suites: **2,633 shared-sync tests passed, 3 skipped; 1,842 mobile tests passed; 1,246 web tests passed**. `/tmp/meerkat-catchup-tests.log`.
- Shared tests exercise actual engines, signed loopback synchronization, the real responder handshake timeout, connection failure, overlapping triggers and a later retry. The existing real TCP LAN regression now adapts the returned responder result and passes. The session-job test checks both initiator and responder completed results and actual transferred content.
- Both app test suites verify persisted mailbox state, failure/retry guidance, and no warning on a completed round.
- One new Chromium app test passed: explicit opt-in remains off initially; manual catch-up with no server shows recovery; an injected rejected database flush during a foreground trigger becomes visible without an uncaught browser error; a subsequent manual round recovers. This injects a flush rejection, not real disk exhaustion or a remote delivery. `/tmp/meerkat-catchup-browser.log`.
- Screenshot inspected: `output/playwright/meerkat-remediation-2026-09-04/catchup-recovery.png`. The notice and recovery action are visible in onboarding. The entitlement response is a fixture, not payment proof.
- `pnpm gate:function:changed` passed: affected mobile/web/shared-sync lint, type checks and focused tests, plus hub mobile/web consumer type checks. `/tmp/meerkat-catchup-gate.log`.
- Full `pnpm check:parity` passed, including transport negative controls. `/tmp/meerkat-catchup-parity.log`.
- Web production build passed; large-chunk warning remains (index 770.92 kB, sync 647.48 kB, LiveKit 531.04 kB). `/tmp/meerkat-catchup-build.log`.
- `git diff --check` and `pnpm check:generated-artifacts` passed. `/tmp/meerkat-catchup-artifacts.log`.

An initial shared type check found the real TCP test passed its `Promise<void>` resolver directly to the responder's new result. The test now explicitly resolves after the handler finishes. No runtime compatibility shim or fabricated result was added.

## Remaining priorities

F1/F2 acceptance from the previous session remains separate. No new provider, payment, signed-device, background, sleeping-owner, or physical-radio proof was collected. GitHub Actions was not rechecked or changed in this continuation; the last recorded observation remains disabled.

Further source inspection found a mobile/web paid-hosted-relay parity gap: web catch-up supplies `entitlementTokenForRelay`; mobile `SyncProvider` creates bare `WebSocketRelayBackend` instances and passes no hosted entitlement to its session or mailbox paths. Mobile has a managed-publication entitlement fetch, but no corresponding hosted access provider in this private connection flow. This is an observed wiring gap, not a measured production rejection. Next: implement and test mobile hosted access acquisition and exact-origin token scoping through the existing shared client primitives, while preserving the account/private-identity boundary and free/self-hosted paths. Never send a hosted bearer to an arbitrary pasted relay URL.

Then continue scoped friend invitations with explicit expiry/revocation and install/paste fallback, followed by temporary TURN allocation credentials. Release authority and signed-device/provider acceptance remain blockers; general availability stays NO-GO.
