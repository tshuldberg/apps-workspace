# Runbook: MyNews vendor and dependency outage

## Purpose

Handle a failure in something MyNews depends on but does not run. MyNews is Supabase-canonical, so a Supabase outage is a full outage; every other dependency is a seam that is designed to fail closed into an explicit unconfigured or pending state rather than a fabricated result. This runbook says, per vendor, what breaks, what the code already does about it, what an operator should do, and what must never be done to make a dashboard look green.

The one rule that overrides convenience: **an absent or failing vendor is never a verdict.** A screening vendor that times out does not clear content. A hash vendor that is down does not produce "no match". A missing NCMEC endpoint does not produce a report reference.

## Dependency map

| Dependency | What depends on it | Failure mode built into the code |
| --- | --- | --- |
| Supabase Postgres + PostgREST | everything | Total. Every `nw_*` read and write, all RPCs, the console, the site, the app |
| Supabase edge runtime | all 18 `mynews-*` functions | Total for writes; the site and app render honest not-connected states |
| Supabase Auth | console sign-in, app sessions, `mynews-account` freshness check | Moderators cannot sign in; user-facing functions 401 |
| Stripe | `mynews-support`, `mynews-payments-webhook` | Checkout 503 or provider error; webhook events queue at Stripe and replay |
| RevenueCat | app subscription entitlement | `getMyNewsSubscriptionConfig` returns not-ok and the app shows "Subscriptions are not available in this build." |
| Screening vendor | `_shared/mynews-screening-gate.ts` | Optional and escalate-only. Absent is an explicit `unconfigured` state |
| NCII hash vendor | `mynews-ncii-worker/seams.ts` | Unconfigured routes the case to human review, never a fabricated match |
| NCMEC CyberTipline | `mynews-ncii-worker/seams.ts` | Not onboarded. Records pending human review; submission is founder-ops |
| Account processor cleanup | `mynews-account-worker/seams.ts` | Records the visible status `skipped-unconfigured`, never rewritten as done |

## Detection signals

- **`mynews-health`.** A vendor problem normally shows as `degraded`, not `down`, because the reader surface keeps serving. If health says `down`, suspect Supabase itself rather than a vendor.
- **Structured logs.** Filter `service=mynews-edge`, then:
  - `fn=mynews-support` with `outcome=config` or a 503 means Stripe configuration or the rate-limit RPC, not Stripe latency.
  - `fn=mynews-screening` or any write edge returning 503 from the screening gate means a screening read or write failed. The gate is fail-closed: it writes nothing and asks the client to retry.
  - `fn=mynews-ncii-worker` with escalations rising and no vendor decisions means the hash-vendor seam is unconfigured or failing.
- **Console.** `/screening` filling with holds that nothing is clearing points at the vendor seam or at moderator capacity. `/support` reconciliation runs reporting not-ok point at Stripe or the ledger read. `/ncii` overdue cases are always an S1 regardless of which vendor is at fault.
- **Vendor status pages.** Confirm the vendor's own status before changing anything on our side. Half of "vendor outages" are our expired credential.
- **Rate-limit refusals.** A 429 from `mynews-support` is `nw_consume_support_rate_limit` doing its job (supporter bucket 10/hour, journalist recipient bucket 60/hour). That is not a vendor outage.

## Triage, in order

1. **Classify: is it Supabase or is it a seam?** Run `bash scripts/mynews-smoke.sh`. If health fails and the 401 gates also fail to answer, the platform is down and this is an [incident.md](incident.md) S2 with a vendor cause. If the gates answer 401 correctly and only one capability is broken, it is a seam.
2. **Confirm with the vendor's status page and our credential state.** Check the relevant variable names in `apps/mynews/docs/ENV_MATRIX.md`. Never print a credential value while debugging.
3. **Verify the fail-closed path is actually engaging.** This is the part that matters most, because a seam that silently degrades into a false negative is worse than an outage:
   - Screening: expect 503 on the affected write path and no `nw_screening_decisions` row that claims a clear verdict from a vendor that did not answer. `child-safety` (threshold 0.25) and `self-harm` (0.4) are `humanOnly`, so no vendor and no automated path can clear them.
   - NCII hash vendor: expect the case to sit in human review, not `no-match`.
   - NCMEC: expect a pending human-review state and no report reference.
   - Processor cleanup: expect `skipped-unconfigured` in the deletion request status, still visible, never `done`.
   - Stripe: expect no `nw_support_ledger` row for a charge that did not settle, and an `unattributed-payout` typed failure on `nw_payment_events` if a payout cannot be attributed. The ledger is append-only by trigger, so there is nothing to clean up by hand.
4. **Decide on mitigation.** See below.
5. **Record the window.** Note the start and end in UTC. Stripe webhook replay and any manual reconciliation both need the exact window.

## Decision points

- **Turn a capability off, or leave it failing?** For payments, turning it off is clean and honest: the capability detector is affirmative, so clearing `MYNEWS_PAYMENTS_ENABLED` on the site (and the app flag in the next build, pinned against `release-manifest.json` by `check-build-env.mjs`) stops offering support and simultaneously stops publishing the platform-fee claim. Prefer that over leaving readers to hit a 503 at checkout for hours. For screening, NCII, and NCMEC, there is nothing to turn off: the fail-closed state is the mitigation, and content stays held.
- **Raise moderator capacity?** When a vendor seam goes down, human review volume goes up by design. That is a staffing decision, and it is the correct response to a screening or hash vendor outage. Do not lower a threshold in `CLASS_POLICY` to reduce the queue: those thresholds are the product's safety floor, and `child-safety` and `self-harm` are `humanOnly` precisely so this trade cannot be made under pressure.
- **Replay Stripe events?** Yes, from the Stripe dashboard, after our webhook is confirmed healthy. `nw_apply_payment_event` resolves the journalist authoritatively from `nw_payout_accounts.provider_account_ref` and rejects a caller-supplied id that contradicts it, so replaying is safe and idempotent by design. Do not insert ledger rows by hand under any circumstances.
- **Extend a safety deadline because a vendor is down?** No. The 24h child-safety and 48h NCII deadlines in `nw_report_sla` are commitments to the person who reported, not to the vendor. If a vendor outage means the automated path cannot help, the case goes to a human within the deadline.

## Escalation

1. On-call classifies platform versus seam and confirms fail-closed behaviour.
2. Founder-ops owns every vendor account, dashboard, and credential, so any credential rotation, plan change, or support ticket with the vendor starts there.
3. A screening or NCII seam outage that lasts long enough to threaten an urgent-lane deadline escalates to moderation coverage, not to engineering.
4. If a vendor failure exposed data, or if a leaked credential is the cause, stop and use [breach.md](breach.md).

## Communication template

Internal:

```
MyNews vendor outage, started <UTC timestamp>
Vendor:            <Supabase | Stripe | RevenueCat | screening vendor | NCII hash vendor | NCMEC | processor>
Vendor status:     <their status page says X>
Our credential:    <valid | expired | unset>  (name only, never the value)
Capability down:   <support checkout | subscription entitlement | automated screening | hash matching | ...>
Fail-closed check: <confirmed: held content stayed held, no fabricated verdict / NOT confirmed>
Safety impact:     <none | human review volume up | urgent-lane deadline at risk by <time>>
Mitigation:        <capability disabled | none, fail-closed state is correct>
Owner:             <name>   Next update: <UTC timestamp>
```

External, only for a user-visible capability:

```
<Capability> is temporarily unavailable because of an outage at one of our providers.
<What still works.> Nothing you submitted has been lost. We will update this notice by <time>.
```

Do not name the vendor externally unless the vendor has already published the outage, and do not promise a restoration time you do not control.

## Recovery verification

1. Vendor's own status page shows resolved, and our credential is confirmed valid.
2. ```bash
   MYNEWS_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1 \
   MYNEWS_SMOKE_ANON_KEY=<publishable anon key> \
   bash scripts/mynews-smoke.sh
   ```
   Expect `SMOKE PASSED (4 probes)`.
3. Exercise the specific capability once, end to end, and confirm the log line shows `outcome=ok` for the right `fn`.
4. Screening: confirm a new decision row carries a real vendor label (`MYNEWS_SCREENING_VENDOR_NAME`, default `vendor`) and that nothing which was held during the outage was auto-cleared on the way back. A vendor may only escalate.
5. Payments: run `mynews-support-worker` once with its worker secret and confirm the new `nw_support_reconciliation_runs` row is ok. Compare `nw_support_charges`, `nw_support_receipts`, and `nw_support_ledger` counts across the outage window.
6. NCII: confirm every case opened during the outage has a human decision or is inside its `nw_report_sla` deadline, and that no case was closed by the automated path while the vendor was down.

Log the outage in `errors_log.md` with the vendor, the window, and whether the fail-closed path held. That last field is the one worth keeping: a seam that failed open is a design bug, not an outage.

## What is founder-ops here

- Every vendor account, contract, plan, and dashboard: Supabase, Stripe, RevenueCat, the screening vendor, the NCII hash vendor (StopNCII or PhotoDNA class).
- Setting or rotating any vendor credential (`supabase secrets set`).
- **NCMEC CyberTipline is not onboarded.** There is no vendor relationship, so `MYNEWS_NCMEC_CYBERTIPLINE_URL` and `MYNEWS_NCMEC_CYBERTIPLINE_CREDENTIALS` are unset by design and the worker records pending human review instead of a report reference. Any actual CyberTipline submission today is a manual founder action performed outside this system, and the 24h child-safety deadline still applies to it.
- Opening a support ticket or negotiating an SLA with any vendor.
- Deciding to switch or add a vendor, which is a product and legal decision, not an operational one.
