# Meerkat Launch Scoping + Plan Reconciliation - 2026-07-01

Goal: with limited Fable availability, review Meerkat's full git history, evaluate
production readiness, and ensure EVERY remaining feature and work item is covered by a
build-ready plan so subsequent orchestration can run without the Fable model.

## What was done

1. **Eight parallel audit agents** reviewed Plans 19/20/21/22/23/25 against code at HEAD,
   extracted the production-review v1.2 blockers, and swept the four Meerkat packages for
   deferred/disabled/unfinished functionality.
2. **Founder decisions captured (Open Brain + memory):** expanded vision (internet layer
   within the internet; full capability list incl. video/screen share, audio calls,
   public posting, proximity-gated communities); posting model = owner-configurable
   (view_only/approval/open) PLUS a platform humanity-verification base requirement (no
   PII stored); proximity enforcement = hard mode + configurable ladder with signed
   policy changes; EVERYTHING gates the single launch.
3. **Existing plans reconciled** (each got a "Status Delta (2026-07-01, read first)"):
   - Plan 19: active/queue duplicate CONSOLIDATED into queue/ (cp_ prefixes fixed, 9A/P9
     merged, FF3 owner-side auto-approve spec written as 5 concrete items).
   - Plan 20: marked code-complete Ph 0-12; deploy paths corrected to
     packages/meerkat-relay/deploy/; optional web QR-scan noted.
   - Plan 21: real P0/P1 API shapes documented (SealDmDirectResult union with
     sealed[].recipientDeviceId; OpenDmMailboxResult payload nesting); new required
     tasks: DM_MESSAGES_SURFACE_AVAILABLE flip + 'dm' share destination +
     isShareIntakeSent branch + web twin flag; D.6-before-Phase-2 ordering.
   - Plan 22: Stage-0 early landings mapped (usage API, upload manifest, storage ingest,
     hosted-storage feature); re-derive-by-feature instruction; SKU bundling decision
     flagged; Plan 24 signup-gate dependency added.
   - Plan 23: noise-redteam.test.ts rename (filename collision), line drifts, Plan 19
     dependency unblocked, NEW workstream D.7 (Downloads browser), launch-gate change.
   - Plan 25: six stale claims corrected (react-native-webrtc now declared;
     effectiveRelayUrl shipped; DM symbols exist -> TC-1 strengthened; media session is a
     SIBLING adapter to RNWebRTCSession, not an extension).
4. **Four recon agents** mapped the substrate for the new plans (transport policy choke
   points incl. the device-scoped-session fact; member-removal primitives + traps;
   public-join/key-handoff + credential insertion points; auto-connect reusable pieces).
5. **Five NEW plans authored** (docs/plans/queue/):
   - 24 humanity verification (attestation + single-use signed tokens, zero PII,
     Privacy Pass upgrade path, separate verification service)
   - 26 open public participation (postPolicy on the descriptor; approval mode rides
     FF3; open mode = node-mediated dual-signed public posts with an honest trust label;
     consumer feed: follows + media cards + infinite scroll)
   - 27 community transport policies + proximity-gated communities (row-level fail-closed
     enforcement inbound/outbound + key-wrap branch + dial/background gates + local join
     handoff; signed policy ladder local_only/local_preferred/any)
   - 28 real member removal + epoch rotation (commitMemberRemoval exists unwired;
     member-removal mailbox fan-out + descriptor gossip + node republish + owner-only UI;
     epoch-boundary honest copy)
   - 29 seamless auto-connect (per-pairing rotating session token, pure dial scheduler
     with backoff, AppState/mDNS/visibility triggers, background graduation, honest
     copy retirement with parity guards)
6. **Master orchestration doc**: docs/plans/meerkat-launch-orchestration.md (build-order
   tracks, execution rules for non-Fable orchestration, plan inventory).
7. **Founder-ops runbook**: docs/guides/meerkat-founder-ops-runbook.md (build/deps,
   relay/node/directory deploys, desktop signing, money/stores/legal, device-QA matrix).
8. **Housekeeping**: plans 14/15/15-M7/16/17 moved active/ -> done/ (landed on main
   weeks ago); duplicate active/19 removed after consolidation.

## Production readiness verdict (2026-07-01)

Code-complete: connectivity spine (20), public layer engine (19 minus one wiring item),
theme (18). In flight: DMs (21, P0-P1 only). Not started: billing (22), launch readiness
(23), calls (25), and the four new plans (24/26/27/28/29). Zero of the production-review
v1.2 blockers are fully resolved; blockers 1 and 9 (transport honesty) are code-resolved
pending ops. The single biggest blocker remains founder-ops: no relay is deployed and
DEFAULT_RELAY_URL is '' by design. CI is down (GitHub billing); local green is the gate.

## Remaining work map

Codeable, in queue: 19-FF3 close-out, 21 Ph2-10, 22 (by feature), 23 A-E+D.7, 24, 25,
26, 27, 28, 29. Founder-ops: runbook sections 1-6. Previously unplanned items now owned:
member removal/epoch rotation (28), auto-dial (29), Downloads browser (23 D.7),
recovery restore (23 A, confirmed unbuilt), open posting + humanity verification (26/24),
proximity policies (27).

## Verification

Docs-only session: no source code changed. Plan edits verified by the editing agents
(grep checks: zero cp_ in consolidated 19, no em dashes in new text, insertion points
structural). Parity/gates unaffected.
