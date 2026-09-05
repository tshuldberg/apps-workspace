# Ledger notes for the rc that carries plans 52 + 53

Authored 2026-07-29 on `feature/meerkat-plan52-person-identity`, for the next
release candidate (expected `meerkat-2026-07-29-rc17` or later, superseding
`meerkat-2026-07-29-rc16` at `105adcc8`). This file is an INPUT to the cut,
not a ledger: the rc directory with `evidence.json` is authored at the merge
SHA on `main`, after this branch lands through the sanctioned path.

## Cut procedure (unchanged rules)

1. Merge `feature/meerkat-plan52-person-identity` into `main` (branch
   protection is live; PR path per rc10-exc-1).
2. Create the rc directory binding `releaseSha` to the merge commit,
   `supersedes: meerkat-2026-07-29-rc16`.
3. Dispatch `gh workflow run release-verify.yml -f sha=$(git rev-parse <merge sha>)`,
   never a hand-typed SHA.
4. Carry forward rc16's still-open rows (the e2e job's hub `@mylife/web` half
   remains open; the Next-bump hypothesis was disproven).

## What the branch adds since rc13 lineage

Plan 52 (person identity) and plan 53 (in-person proximity ceremony), both
plans now in `docs/plans/active/` with dated status lines. Key commits:

- Plan 52 P0-P6: `a8181491` (P6), `59cfcf13` (round 3), `0242ed6f` +
  `38d27aa4` (round 4), `5163c238` (round 5). Closed through five adversarial
  review rounds (1 CRITICAL, 5 HIGH among the findings, all fixed and
  mutation-checked).
- Plan 53 P0 protocol: `56812dec` (pure reducer, 24 tests).
- Plan 53 P1 native adapter + AC-3 native change: `c90c9e0c`, `8c489671`.
- Plan 53 P2 UI: `678f591d`. P3 plan-52 integration: `de53b43f`.
  P4 honesty surfaces + parity locks + tester sweep: `474dbf28`.
  P5 NC-1 static gate + behavioral spy: the commit following `474dbf28`.

Battery at the P5 head: sync 2498, relay 1587, app 1492, web 1038, parity
green (including the new plan 53 block), transport NC green (including
NC-53.1 with self-test), function gate green.

## Evidence rows to import into the rc

| Row | Status at cut | Evidence |
|-----|---------------|----------|
| Plan 52 code (P0-P6, anti-equivocation ledger, removal approval, revivable proposals) | CLOSED by tests | Suites above; five review rounds logged in docs/sessions 2026-07-29 |
| Plan 53 AC-1 (two phones, no relay, no internet, both confirm, DM sends) | OPEN | Live-only. Founder + friend TestFlight sweep, tester guide section 11 |
| Plan 53 AC-2 (cancel / expiry / backgrounding persists nothing) | Code-proven; live re-check in sweep | Protocol suite (terminal-state rules), adapter suite (teardown), screen cancels on AppState leave; sweep section 11 re-checks on device |
| Plan 53 AC-3 (no long-term identifier advertised; consecutive ceremonies differ) | OPEN on device | JS side proven (payload-shape + distinct-ids tests). The NATIVE half (fresh MCPeerID per advertise, Android serviceType honor) has NEVER been compiled or run on a device in this repo. Founder accepted this schedule risk 2026-07-29; the row stays OPEN until a TestFlight build confirms it. Do not close from unit tests. |
| Plan 53 AC-4 (forged / mismatched / replayed material rejected) | CLOSED by tests | Protocol suite AC-4 block (5 tests incl. third-device substitution) |
| Plan 53 AC-5 (byte-equivalent pairing vs MKPAIR1) | CLOSED by construction + tests | Commit routes through the one `applyTrustedBundle` path (`pairWithVerifiedBundle`); AC-5 analysis in the plan amendment |
| Plan 53 AC-6 (Expo Go + web fail closed with honest copy) | CLOSED by tests + parity locks | View-core suite, capability entries (mobile derives from the real substrate), parity plan 53 block (single-source, placement, no-tap) |
| Plan 53 NC-1 (zero relay dials during a ceremony) | CLOSED by gate + test | NC-53.1 static gate (self-tested) + adapter WebSocket spy over a full ceremony; both proven against a planted `ws://` dial |
| Nearby browse takeover (sync rung paused during the 90s ceremony window) | OPEN | Amendment 2026-07-29. Stated in UI copy (parity-locked). The sweep must confirm the sync rung RECOVERS after a ceremony ends (tester guide section 11, recovery check) |
| Both native transport files (iOS Swift + Android Kotlin) | UNVERIFIED | Never compiled or device-run in this repo; TestFlight build is the first proof point |

## Additional rc-cutting work merged after this note (2026-08-01)

The account-service deploy branch closes the Step 7 open item: the plan 51
account service is wired into compose.production.yml (port 8896,
meerkat_account role, `ACCOUNT_DOMAIN` route, `assn_root_ca` mounted secret)
with the topology test pinning the shape and the deploy-side wall.
Adversarial review (Claude subagent + Codex) findings fixed pre-merge:
fake-ON entitlement rails (resolvers unwired; rails now honestly
not_configured; errors_log 2026-08-01), ACCOUNT_*/MEERKAT_* interpolation
mismatch, ASSN PEM mount mechanism, X509 parse-or-die, tracker releaseId
shape guard + multi-active-ledger refusal. Full relay suite 1589 green,
typecheck green, real-bin boot checks captured.

Follow-ups recorded, deliberately not in that branch (tracked for Steps
10/15, not blocking the cut):

- Account service is the only first-party service without a Prometheus
  metrics listener (sign-in/webhook/issuance refusals invisible to the Plan
  44 observability plane). Bin + compose change.
- The wall's secrets (session, epoch key, Stripe webhook) ride plain env like
  persona's, not mounted files like push/hosted; hardening candidate.
- No rate limiting on the new public unauthenticated crypto paths (sign-in
  JWKS verify, epoch-key, delete); consistent with fleet posture, revisit at
  Step 15 load budgets.
- Entitlement payload resolvers (Apple JWS chain, RTDN mapping, Stripe event
  mapping) remain founder-ops-adjacent product work required before runbook
  Step 10 billing proofs; rails stay honestly OFF until wired.

## Honesty constraints on the cut

- The rc must not claim plan 53 launch-ready: AC-1 and AC-3 are live-evidence
  rows and stay OPEN in the ledger until the device sweep lands.
- `account.test.ts` intermittent (errors_log, Unresolved) is security-relevant
  and must be root-caused before launch; a likely third occurrence was
  observed 2026-07-29 (unnamed, unreproduced across 3 consecutive full runs).
