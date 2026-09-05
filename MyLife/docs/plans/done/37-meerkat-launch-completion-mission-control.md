# Plan 37: Meerkat Launch Completion Mission Control

- **Status:** done for mission-control scope
- **Created:** 2026-07-04
- **Owner:** orchestrator session (Fable orchestrates workers + adversarial reviewers, per the 2026-07-03 UX-parity protocol)
- **Supersedes:** the build-order section of `docs/plans/meerkat-launch-orchestration.md` (2026-07-01, now stale on plan statuses)
- **Sequences:** historical Plans 23/24/26/27/29 plus Plan 25 and the Plan 22 decision gate
- **Current verdict:** `docs/reports/REPORT-meerkat-blackglass-production-adversarial-audit-2026-07-09.html`; the original July 4 grounding audit is retained in git history.

## Reconciliation Status (2026-07-07)

Status: Done as an orchestration plan. The mission-control map has been reconciled
against local `main` after the Plan 39 merge and the later Plan 40 consolidation.
Code-complete and superseded plans were moved to `docs/plans/done/`; active Meerkat
queue work is now limited to Plan 25 and Plan 40. Use Plan 40 for the final launch
gate and `docs/guides/meerkat-founder-ops-runbook.md` for founder-ops.

## Mission

Close every remaining CODEABLE gap between current main and the founder-locked launch definition ($4.99 one-time app, free anonymous public viewing, freemium server space, everything ships together at full function). This plan does not restate the per-plan specs. It sequences them, pins the cross-plan coordination rules that changed since 2026-07-01, and defines the exit gate. Workers execute the source plans; this plan is the map.

## Current state (verified 2026-07-05, do not re-litigate)

| Plan | State | Remaining codeable |
|------|-------|--------------------|
| 18, 28, 30, 31, 32 | DONE, in done/ | none |
| 19 Public social | Code-complete P0-P9 + FF1-FF6 (FF3 owner dispatch wired: `mailbox-dispatch.ts:308`) | none (founder-ops deploys) |
| 20 Connectivity | Code-complete Phases 0-12 | optional web QR-scan only |
| 21 DMs | Code-complete P0-P10 both surfaces, flags true | AC-13 link-device UI; minor web e2e gaps |
| 22 Monetization | Stage 0 only; billing client interface-only; no IAP path; $4.99 monthly vs one-time SKU conflict | decision-gated (Wave 3) |
| 23 Launch readiness | D.6 done, EAS projectId done | Phases 0-3 (minus D.6), Phase 4 last |
| 24 Humanity verification | P0-P2 built + P3 pure gate foundation | P3 route enforcement, P4-P6 |
| 25 Calls + rooms | Spec only, zero code | P0-P9 |
| 26 Open public participation | Spec only, zero code; hard deps 19-FF3 (done) + 24 + 28 (done) | P0-P7 |
| 27 Transport policies | P0-P3 + P4 policy-history/copy foundation + gossip restriction built | P4 production gossip/UI/picker, P5 |
| 29 Seamless auto-connect | P0-P1 built; 27 policy seam consulted | P2-P6 incl. presence Phase 6 |

Also in scope from the 2026-07-04 audit: the four P3 notes (sync.tsx advanced dial, ConnectionStatusCard inline candidate logic + uncaught probeRelays promise, AttachmentCard raw-setting boolean) fold into Plan 23 Phase 2 work; the Files-index bulk Request stale copy IS Plan 23 D.1/T2.4.

Also in scope from errors_log.md open rows (2026-07-05 curation):
- BLOCKER for EAS builds, Track D: Meerkat Expo production export fails because Metro rejects dynamic native-module loading (`Invalid call at line 99: require(name)` in `apps/meerkat/app/(root)/data/ble-backend.ts:99`). Replace the dynamic candidate-loop requires with Metro-static literal optional requires, audit `nearby-backend.ts` (and the other lazy transport backends) for the same pattern, then rerun the Expo export preflight. Must land before Plan 23 Phase 4 device QA.
- The P3 moderation un-hide row (`community-safety.ts` overloaded status, reviewed content un-hides) IS Plan 23 D.2/T2.1-T2.2; close the errors_log row when D.2 lands.

## Out of scope (founder-ops, tracked in the runbook)

Relay/community-node/directory/humanity-service deploys, DEFAULT_RELAY_URL env flips, app icon/splash asset creation, privacy policy/ToS/support pages and store records, content-scanning vendor, TURN provisioning, App Group + prebuild + EAS builds, physical device QA execution, store submission. Workers finish codeable scope, leave plans in queue/ with dated deltas, and list the ops handoff explicitly.

## Build order

```
Wave 0 (setup, half day, serial):
  Move the checkout to main. Branch feature/meerkat-launch-completion off main.
  Baseline gates green (sync/app/web/relay tests, 4 typechecks, meerkat parity).

Wave 1 (four parallel tracks, file-disjoint):
  Track A: Plan 27 P3-P5 (local join handoff, policy-change UX, red team)
  Track B: Plan 29 Phases 0-1 (session token + schema, pure auto-connect job)
  Track C: Plan 24 P0-P3 (credential protocol, service core, verifier adapters, enforcement gates)
  Track D: Plan 23 Phases 0-2 (CI trust, recovery restore + D.5 sealed rendezvous, D.1-D.4 correctness + audit P3 notes
           + the ble-backend Metro-static require fix so Expo export/EAS preflight passes)

Wave 2 (after Wave 1 tracks land):
  Track A: Plan 29 Phases 2-6 (mobile wiring, web parity, background graduation, presence)
           [needs 27 P3/P4 for the policy seam swap and gossip callers]
  Track B: Plan 24 P4-P6 (mobile wallet + VerifySheet, web parity, blind-RSA scoping)
  Track C: Plan 26 P0-P7 (posting policies, public-post protocol, node submit route,
           reader/composer, web parity, consumer feed, abuse hardening)
           [needs 24 P3 gates; 19-FF3 and 28 already done]
  Track D: Plan 21 AC-13 link-device UI + web e2e gap close

Wave 3 (serial decision, then build):
  Plan 22 DECISION GATE: founder confirms paid ($4.99 one-time) vs free launch.
    Paid: build Plan 22 (IAP SDK + product + paywall + restore + Stripe billing client;
          resolve the $4.99 monthly SKU conflict in billing-config).
    Free: record the decision, strip the $4.99 copy, Plan 22 stays queued post-launch.
  Plan 25 P0-P1 (call-signal protocol + signaling carrier) can start in parallel here.

Wave 4 (after Waves 2-3):
  Plan 25 P2-P9 (1:1 calls, SFU infra + rooms, moderation, recording, honesty sweep)
    /office-hours + /plan-eng-review FIRST to lock the SFU engine choice (P4 rule).
  Plan 23 Phase 3 codeables (delete-my-data flow, asset wiring once assets exist).

Wave 5 (LAST, the exit gate):
  Plan 23 Phase 4: device QA matrix, live-relay gating, web Playwright CI, 48h soak.
  Runs only after founder-ops deploys exist. Nothing ships until this signs off.
```

## Coordination rules (binding, updated for post-2026-07-03 reality)

1. Read each source plan's latest Status Delta (2026-07-04) before starting; re-grep cited line numbers, they drift.
2. `descriptor-gossip.ts` exists (built by Plan 28). Plan 27 P4 CONSUMES it; do not rebuild. `gossipDescriptors`/`gossipRevocations` get their first production caller in 27 P4 or 29's auto-connect loop, whichever lands first; the other adopts the same seam.
3. Plan 30's focused drain loop landed first: Plan 29's `autoConnectRound()` must wrap the SAME `runForegroundDrain` seam the channel live loop uses. No second drain path.
4. Plan 23 D.2 retargets `community/[communityId]/settings.tsx` (admin JSX moved there in Plan 31 Phase 2). Plan 23 D.4 was superseded by Plan 32 Phase 1; verify and record, do not rebuild.
5. Plan 26 open-mode posts are node-countersigned public signed events, NOT epoch-key writes; the trust label is non-negotiable (never imply E2E membership verification for open mode).
6. Plan 25 media session is a SIBLING adapter to the shipped data-channel-only `RNWebRTCSession`, not an extension. TC-1 asserts CallSignal / DmMessage / channel-message / humanity domain separation directly.
7. Plan 29 NC-4 stands: never auto-flip `background_sync_enabled`; default-on graduation happens only in Plan 23 Phase 4 after device QA.
8. Honesty invariants are unchanged and test-enforced: `DEFAULT_RELAY_URL` stays `''` until founder-ops flips it; staged is not sent; no simulated backend presented live; no fabricated status, peer count, or receipt; `cm_publications` sole `published_blob`; omitted cm_ tables fail closed to `device_local`.
9. Gates per change: `pnpm gate:function:changed`, typecheck for every touched surface, `node scripts/check-meerkat-parity.mjs`, `/review`, adversarial review on every protocol change (the audit showed this loop catches real defects).
10. Twin discipline: byte-parity files and parity-locked copy strings update on BOTH surfaces plus the guard in the SAME commit.
11. Conventional Commits on the feature branch; never commit to main directly; push only when the founder asks. No em dashes anywhere.
12. Update memory.md + errors_log.md per repo rules; capture milestones to Open Brain with context "personal, mylife".

## Acceptance criteria (plan-level)

- AC-1: Every source-plan phase listed in the build order is code-complete with its own ACs green, or explicitly recorded as founder-ops in its delta.
- AC-2: All suites green at close (sync, app, web, relay), 4 typechecks, meerkat parity, function gate.
- AC-3: The Plan 22 decision is recorded in writing (this plan's delta + memory.md) whichever way it goes.
- AC-4: No honesty invariant regressed; the capability status page reflects every newly live capability truthfully on both surfaces.
- AC-5: Plans move queue -> done only when codeable scope is exhausted; founder-ops remainders are itemized in the runbook.

## Definition of done

Waves 0-4 code-complete and gate-green; Wave 5 checklist authored and handed to founder-ops with the runbook updated; queue contains only founder-ops-gated plans with current deltas; a closing session log + Open Brain capture exist.

## Historical session kickoff prompt

Do not execute this prompt as current work after the 2026-07-07 reconciliation. Use
the remaining active queue plans directly: 25 and 40.

Paste this to start the build session:

```
Execute Plan 37 (docs/plans/done/37-meerkat-launch-completion-mission-control.md), the
Meerkat launch-completion mission control. You are the orchestrator: Fable coordinates,
Opus workers build, every protocol change gets a spec review plus an adversarial review
(the 2026-07-03 protocol; it catches real defects, keep it).

Start with Wave 0: move the checkout to main (the current checkout may sit on the stale
feature/meerkat-launch-finish branch; memory.md and errors_log.md may be dirty from other
sessions, reconcile without losing rows), branch feature/meerkat-launch-completion off
main, and verify baseline gates green (sync/app/web/relay tests, 4 typechecks,
node scripts/check-meerkat-parity.mjs).

Then run Wave 1 as four parallel file-disjoint tracks:
  A: Plan 27 P3-P5 (docs/plans/done/27-meerkat-community-transport-policies.md)
  B: Plan 29 Phases 0-1 (docs/plans/done/29-meerkat-seamless-auto-connect.md)
  C: Plan 24 P0-P3 (docs/plans/done/24-meerkat-humanity-verification.md)
  D: Plan 23 Phases 0-2 (docs/plans/done/23-meerkat-launch-readiness.md), folding in the
     four P3 notes already incorporated from the original July 4 audit

Before writing any code: read each target plan's Status Delta (2026-07-04) section and
Plan 37's coordination rules 1-12. They encode what changed since the specs were written
(descriptor-gossip exists, the drain seam is shared with Plan 30, D.2 retargeted, D.4
superseded). Re-grep any cited line numbers.

Binding rules: TDD, honesty invariants test-enforced (DEFAULT_RELAY_URL stays '', staged
is not sent, no fabricated status), byte-twin parity plus guards in the same commit,
Conventional Commits on the feature branch, no pushes unless asked, no em dashes, gates
green before every commit (pnpm gate:function:changed, typechecks, meerkat parity,
/review). Update memory.md, errors_log.md, and Open Brain ("personal, mylife") as you go.

At Wave 3 stop and ask the founder ONE question: paid $4.99 one-time launch (build Plan
22) or free launch (record decision, strip the $4.99 copy, queue Plan 22 post-launch)?
Do not proceed past the gate without the answer.

Finish by updating every touched plan's Status Delta, moving fully code-complete plans'
codeable scope to done where the convention allows, authoring the Wave 5 founder-ops
handoff in docs/guides/meerkat-founder-ops-runbook.md, and writing the session log.
```

## Status Delta

- 2026-07-04: Plan authored from the production audit. No code built under this plan yet.
- 2026-07-05: Fable safeguard review completed outside the repo at `/private/tmp/claude-501/-Users-trey-Desktop-Apps-MyLife-apps-meerkat/4db8ca97-3323-45cb-88f0-e5f6fbc6999c/scratchpad/fable-safeguard-feedback-report.html`. The flag was a false positive from dense security-remediation wording around web attachment rendering and community-node resource caps.
- 2026-07-05: Wave 1 verified progress landed in the working tree: Plan 29 P0-P1 engine foundation; Plan 27 P3 local join handoff plus P4 policy-history/copy foundation; Plan 24 P0-P2 humanity credential/service/verifier foundation plus the pure P3 gate seam; and the 2026-07-04 audit S1/S2/S3 security fixes. Plan 23 Wave 1 work is not started in this commit. Plan 24 P3 route enforcement and Plan 27 P4 production gossip/UI/picker remain codeable.
