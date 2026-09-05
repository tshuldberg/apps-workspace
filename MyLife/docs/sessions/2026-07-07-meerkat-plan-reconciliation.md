# 2026-07-07 Meerkat Plan Reconciliation

## Outcome

Reconciled the old Meerkat launch plans against the actual code on local `main`.
The active queue is now only the plans with remaining codeable scope:

- `docs/plans/queue/21-meerkat-full-direct-messages.md`
- `docs/plans/queue/23-meerkat-launch-readiness.md`
- `docs/plans/queue/25-meerkat-calls-and-rooms.md`

Moved these code-complete or superseded plans to `docs/plans/done/`:

- 19 Public Social Layer
- 20 Connectivity and Self-Hosting
- 22 Monetization and Billing
- 24 Humanity Verification
- 26 Open Public Participation, superseded by Plan 39 Track B
- 27 Community Transport Policies
- 29 Seamless Auto-Connect
- 37 Launch Completion Mission Control
- 39 Public Base Feed

## Current Queue

Plan 21 stays in queue because DMs are live, but AC-13 still needs a visible
same-account link-device UI on both surfaces. The core `dm_own_devices` mirror and
provider hooks exist; the user-facing link flow was not verified.

Plan 23 stays in queue because it is still the final launch gate. Most earlier
code gaps are now built, but the standalone cross-community Downloads browser
screen was not found. Web Playwright CI, store metadata checks, device QA, and live
deploy gates also remain here.

Plan 25 stays in queue because calls and rooms are not implemented. No call-signal,
media-session, room-membership, SFU client/server, `call_` schema, or call/room UI
exists in the codebase.

## Plan 25 Verdict

Yes, Plan 25 is complete enough to clearly build from the plan. It names the protocol
files, signaling carrier, media adapter shape, local schema, SFU ownership, UI scope,
honesty boundary, acceptance criteria, negative criteria, and test plan.

The implementation should start with Phases 0-3:

1. Pure call-signal protocol and domain-separation tests.
2. Relay `env` call signaling plus mailbox ring/offline wake.
3. Sibling media adapter and 1:1 voice/video.
4. 1:1 call UI, history, failure states, and device QA harness.

Before Phase 4, make the SFU decision: mediasoup versus LiveKit. Native OS CallKit or
ConnectionService UI is not specified as launch-hard; add it only if the founder wants
system-level call surfaces.

## Verification Against Code

Code searches verified the moved plans have implementation anchors:

- Plan 19: public join request dispatcher, owner handler, public join UI, grants, and tests.
- Plan 20: `effectiveRelayUrl`, Share Inbox, `expo-share-intent`, mobile WebRTC data adapter, host companion, public directory and community-node deployables.
- Plan 22: `meerkat_app_unlock`, hosted monthly product, entitlements, RevenueCat wrapper, hosted API, Stripe client, hosted-service bin, hosted Dockerfile.
- Plan 24: humanity credential, humanity service, verifier adapters, route guard, mobile/web VerifySheet, wallet, route integrations.
- Plan 27: signed transport policy, row gates, relay-token skip, local join handoff, policy history, mobile/web owner picker.
- Plan 29: auto-connect job, foreground triggers, composed drain/session rounds, background seam, opt-in presence beacons, real counts.
- Plan 39: public persona, persona sessions, verify-to-view, public-post protocol, Commons feed, operator console, legal/red-team rails.

Code searches also verified why 21, 23, and 25 stay active:

- Plan 21: link-device core exists, but no complete surfaced link flow was found.
- Plan 23: community files and bulk save exist, but no standalone Downloads browser screen was found.
- Plan 25: implementation files are absent.

## Files Updated

- Moved plan docs from `docs/plans/queue/` to `docs/plans/done/`.
- Added dated reconciliation notes to each moved plan.
- Added current deltas to Plans 21, 23, and 25.
- Added Plan 25 buildability review and test map.
- Updated `docs/guides/meerkat-founder-ops-runbook.md`.
- Updated living stale plan links in docs and `memory.md`.

## Verification

- Active queue listing: only Plans 21, 23, and 25 remain.
- Done listing: Plans 19, 20, 22, 24, 26, 27, 29, 37, and 39 now exist under `docs/plans/done/`.
- Stale living `queue/` links for moved Meerkat plans: none found in `docs/plans`, `docs/designs`, or `memory.md`.
- `git diff --check`: passed.
- `pnpm check:generated-artifacts`: passed.
- `pnpm check:parity --quiet`: passed.
- Source function logic changed: no. Function gate skipped for this docs-only reconciliation.
