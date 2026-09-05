# Runbook: MyNews security breach

## Purpose

Contain, assess, and honestly disclose a security breach affecting MyNews. A breach here is different from an incident: an incident means the product stopped working, a breach means a boundary that was supposed to hold did not. MyNews holds journalist identity keys, moderation decisions about real people, NCII and child-safety case records, DMCA submitter contact details, and a money ledger. Several of those categories mean a breach is a legal event, not only a technical one.

Use [incident.md](incident.md) for outages. Come here the moment unauthorized access, credential exposure, or an unexplained privilege escalation is plausible. **If you are unsure which runbook applies, use this one.** Treating an incident as a breach costs an hour; treating a breach as an incident costs the disclosure clock.

## Breach classes, with the concrete signal for each

| Class | What it means | Concrete signal |
| --- | --- | --- |
| B1 Service-role key exposure | `SUPABASE_SERVICE_ROLE_KEY` or `MYNEWS_CONSOLE_SUPABASE_SERVICE_ROLE_KEY` leaked | Key in a commit, a log, a client bundle, a screenshot, or a third-party tool. This key bypasses RLS entirely |
| B2 Worker secret exposure | `MYNEWS_ACCOUNT_WORKER_SECRET`, `MYNEWS_NCII_WORKER_SECRET`, or `MYNEWS_SUPPORT_WORKER_SECRET` leaked | Anyone holding one can drive account deletion disposition, NCII enforcement, or reconciliation directly, because those three functions run with `verify_jwt = false` |
| B3 Moderator account compromise | A console session or allowlisted mailbox taken over | Console actions from an unexpected actor, time, or IP; `nw_console_audit` rows with an `actor_ref` that should not be acting |
| B4 Authorization bypass | A user reached data they should not | A user-facing function returning 200 where 401 was expected; a query returning another user's rows; `anon` or `authenticated` reading a service-role-only table |
| B5 Signing key compromise | A journalist's Ed25519 private key stolen | Revisions verifying under a key the author says they did not use; `nw_key_events` showing activity the author denies |
| B6 Data exfiltration | Bulk read of `nw_*` data | Anomalous egress, unexplained large `durationMs` on read paths, unexpected PostgREST query volume |
| B7 Payment credential exposure | `MYNEWS_STRIPE_SECRET_KEY` or `MYNEWS_PAYMENTS_WEBHOOK_SECRET` leaked | Key in a commit or log; unexpected Stripe API activity; webhook events we did not expect |
| B8 Rate-salt exposure | `MYNEWS_DMCA_RATE_SALT` leaked | The salt is what keeps DMCA submitter email and platform IP out of the rate-limit keys; with it, stored bucket keys become reversible to a guessable identifier set |

## Detection signals

1. **The smoke script's negative probes are the fastest bypass detector we have.**
   ```bash
   MYNEWS_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1 \
   MYNEWS_SMOKE_ANON_KEY=<publishable anon key> \
   bash scripts/mynews-smoke.sh
   ```
   `probe: mynews-publish-jwt-gate ... FAIL (got HTTP 200, expected 401)` is a B4 breach signal, not a smoke failure to be retried. Same for the report probe, and for `mynews-account-worker` answering anything other than 401 or 503 without a worker secret.
2. **The hash-chained audit.** `nw_console_audit` is append-only (`nw_console_audit_no_update`, `nw_console_audit_no_truncate`) and chained (`prev_hash`, `row_hash`). Verify it:
   ```sql
   select public.nw_console_audit_verify(0, 1000000);
   ```
   A break tells you the `seq` where the chain stopped agreeing with itself. This is the single strongest piece of evidence in a B3 investigation, in either direction: a verifying chain means the console actions on record are the console actions that happened. `apps/mynews-console/lib/audit-chain.ts` implements the same encoding on the TypeScript side, pinned by a drift test, so the chain can be verified independently of the database.
3. **Structured logs.** Filter `service=mynews-edge`. For a bypass, look for a `fn` on a `verify_jwt = true` function with `outcome=ok` where you expect a rejection. `requestId` correlates the request across log lines. Because `outcome` is always a code from our own source, it can be trusted as a label; the request body cannot.
4. **RLS posture.** A breach can be a policy regression rather than a stolen key:
   ```sql
   select relname, relrowsecurity from pg_class
   where relname like 'nw_%' and relkind = 'r' and not relrowsecurity;
   ```
   Any row returned is a finding. Service-role-only tables (`nw_ncii_cases`, `nw_dmca_notices`, `nw_console_audit`, `nw_job_config`, `nw_queue_assignments`, `nw_key_escrow`) must be unreachable by `anon` and `authenticated`.
5. **Console pages as the human view.** `/queue`, `/ncii`, `/dmca`, `/screening`, `/verification`, and `/support` show what was decided and by whom. An action nobody claims is a B3 signal.
6. **Secret scanning and git history.** For any suspected key exposure, search the full history, not the working tree, and remember that a rotated key in history is still an exposed key until it is revoked at the provider.
7. **Key custody records.** `nw_profile_keys`, `nw_key_events`, `nw_key_nonces`, `nw_key_escrow`, `nw_key_escrow_access`, and `nw_key_recovery_requests` are the B5 evidence set. `nw_key_escrow_access` in particular records who reached escrowed material.

## Triage, in order

Containment before investigation. Evidence before cleanup.

1. **Declare it.** Name the class from the table above, or say "unknown class" and proceed. Start a timeline in UTC. Every later step gets a timestamp.
2. **Preserve evidence before changing anything.**
   - Export the audit chain: `select public.nw_console_audit_export(0, 5000);` in pages, and record the tip `seq` and `row_hash`.
   - Save the relevant edge log window (`service=mynews-edge`, plus `fn` and `requestId` filters) outside the affected project.
   - Snapshot the current applied migration list and the deployed git ref.
   Rotating a key destroys the ability to prove what it was used for. Capture first.
3. **Contain, by class.**
   - **B1** Rotate the service-role key at Supabase immediately. Every edge function picks up the platform-injected value on redeploy, so follow with `bash scripts/mynews-deploy.sh`. Rotate the console's key separately: it is a distinct variable (`MYNEWS_CONSOLE_SUPABASE_SERVICE_ROLE_KEY`) and a distinct blast radius.
   - **B2** Rotate the affected worker secret AND the matching `nw_job_config` row (`ncii_worker_secret`, `account_worker_secret`) in the same change. Rotating only one silently stops the worker, which turns a breach into a missed 24h or 48h safety deadline. Then verify with the smoke script's account-worker probe.
   - **B3** Remove the compromised address from `MYNEWS_CONSOLE_MODERATOR_EMAILS` first: middleware and `requireModerator()` both fail closed, so removal is immediate and complete. Then invalidate Supabase Auth sessions. Then read every `nw_console_audit` row for that `actor_ref` and reverse nothing until a second human has reviewed it, because reversing a safety removal is exactly what an attacker would want.
   - **B4** Take the bypass path out of service rather than leaving it open. If the bypass is in a deployed function, `bash scripts/mynews-rollback.sh --to <last-known-good-ref>` is the fastest honest containment. If it is an RLS policy, fix the policy forward in a migration; do not disable RLS to "test".
   - **B5** The author revokes: disposition and key custody already model this, `pubkey_revoked_at` on the profile means no NEW revision can verify under that key. Past revisions stay verifiable, which is correct for an append-only record and must be said plainly to the journalist: revocation is forward-looking.
   - **B7** Roll the Stripe key and webhook secret in the Stripe dashboard, redeploy, then reconcile: run `mynews-support-worker` and read the new `nw_support_reconciliation_runs` row. Do not write ledger rows by hand; `nw_support_ledger` is append-only by trigger and a hand-written row is indistinguishable from an attacker's.
   - **B8** Reduce exposure (rotate keys, tighten policies), then quantify. Quantifying comes after containment, never instead of it.
4. **Assess scope honestly.** For each data category, answer with evidence or say "cannot determine from available logs". The categories that matter most: NCII and child-safety case content (`nw_ncii_cases`), reporter identities (`nw_reports`), DMCA submitter contact details (`nw_dmca_notices`, `nw_dmca_counter_notices`), moderation decisions about named people (`nw_moderation_actions`, `nw_console_audit`), journalist identity and keys (`nw_profiles`, `nw_journalists`, `nw_profile_keys`, `nw_key_escrow`), payment records (`nw_support_charges`, `nw_support_receipts`, `nw_support_ledger`, `nw_payout_accounts`), and account export bundles (`nw_export_jobs` records the request, never the data, which limits this one by design).
5. **Confirm the boundary now holds.** Re-run the smoke script and the RLS query. Then re-verify the audit chain and confirm the tip advanced normally.
6. **Only then clean up.** Close the loop in `errors_log.md` with an absolute date, and write the full timeline into a session log under `docs/sessions/`.

## Decision points

- **Rotate now or preserve evidence first?** Preserve first, but only for as long as capture takes. For an actively exploited credential, rotate immediately and accept the evidence loss; write down that you made that trade and why.
- **Take the service down?** Justified for B4 with an active bypass on a write path, or B1 with evidence of use. Not justified for a credential exposure with no evidence of use, where rotation is faster and less damaging. The urgent safety lane keeps running either way: taking the service down does not pause the 24h and 48h deadlines.
- **Reverse actions taken by a compromised moderator?** Never unilaterally, and never toward re-publishing. The default for an NCII or child-safety case is keep-removed. If an attacker used a compromised account to CLEAR a case, restoring the removal is urgent. If they used it to remove something, restoring it needs a normal human review, at normal speed.
- **Notify?** Assume notification is required for any confirmed unauthorized access to reporter identities, safety case content, DMCA submitter details, or payment records, and let counsel narrow it from there. Do not let an engineering judgement that "the risk is low" substitute for that decision.
- **Is the audit chain break the breach, or a symptom?** A chain break with no other signal still means the audit table was written to outside the sealed path. Treat it as a confirmed integrity breach.

## Escalation

1. Whoever notices declares immediately. There is no threshold to clear first.
2. Founder-ops is required for every containment action, because every one of them touches live infrastructure: key rotation, session invalidation, dashboard changes, `nw_job_config` writes.
3. Counsel is engaged for any confirmed unauthorized access to personal data, and always for NCII, child-safety, or reporter-identity data.
4. The affected journalist is contacted directly for B5, because only they can revoke and re-key.
5. Vendor security contacts (Supabase, Stripe) are engaged by founder-ops when the breach involves their surface.

## Communication template

Internal, at declaration. Keep it factual; a breach channel is a discovery record:

```
MyNews SECURITY BREACH, declared <UTC timestamp>
Class:            <B1-B8 or unknown>
How detected:     <smoke probe / audit chain verify / log filter / report from X>
Evidence saved:   <audit export to <location>; log window <range> to <location>>
Contained:        <yes at <UTC timestamp>, by <action> | NO, in progress>
Data categories:  <confirmed accessed / possibly accessed / cannot determine>
Records affected: <count or "cannot determine from available logs">
Boundary now:     smoke=<PASSED|FAILED>; RLS gaps=<none|list>; audit chain=<verified|BROKEN at seq N>
Counsel engaged:  <yes/no>    Notification decision: <pending counsel | required | not required, per counsel>
Owner:            <name>   Next update: <UTC timestamp, 30 min until contained>
```

External. Do not send anything until containment is confirmed and counsel has approved the wording. Never guess a record count downward, and never say "no data was accessed" unless you can prove it:

```
We are writing about a security issue affecting MyNews.

What happened: <plain description, no jargon>
When: <discovered date; affected period>
What information was involved: <specific categories, or "we are still determining this">
What we have done: <containment actions, in plain terms>
What you should do: <specific, actionable, or nothing if there is nothing>
Questions: <contact address that a human reads>
```

For a breach touching reporter identities or safety cases, the affected individuals are contacted directly, not left to read a public notice.

## Recovery verification

1. ```bash
   MYNEWS_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1 \
   MYNEWS_SMOKE_ANON_KEY=<publishable anon key> \
   bash scripts/mynews-smoke.sh
   ```
   Expect `SMOKE PASSED (4 probes)`, with the two 401 probes and the worker-secret probe as the load-bearing ones.
2. `select public.nw_console_audit_verify(0, 1000000);` verifies, and the tip `seq` and `row_hash` match what has happened since containment.
3. No `nw_%` table has RLS disabled, and no service-role-only table is reachable by `anon` or `authenticated`.
4. Every rotated credential is confirmed rotated at the provider AND redeployed, with the paired `nw_job_config` row updated for the worker secrets. Verify the workers still run: a fresh `fn=mynews-ncii-worker` log line within its 10-minute cadence, and a `fn=mynews-account-worker` line within the hour.
5. The compromised moderator address is gone from `MYNEWS_CONSOLE_MODERATOR_EMAILS`, and a sign-in attempt from it lands on `/login` and stays there.
6. If payments were involved, `nw_support_reconciliation_runs` has a fresh ok row and the charge, receipt, and ledger counts reconcile across the exposure window.
7. `errors_log.md` has the row, and `docs/sessions/` has the timeline. A breach with no written timeline will be re-litigated from memory, badly.

## What is founder-ops here

Every containment lever is founder-ops. This repository can detect a breach and can redeploy or roll back code, and it can do nothing else:

- Rotating any secret at Supabase, Stripe, or RevenueCat.
- Invalidating Supabase Auth sessions and managing the moderator allowlist value.
- Writing `nw_job_config` rows so a rotated worker secret keeps the safety workers alive.
- Reading Supabase platform audit logs, egress metrics, and access logs.
- Engaging counsel, deciding on notification, and drafting or approving any external statement.
- Contacting affected individuals, regulators, or law enforcement.
- Engaging a vendor's security team.
- Commissioning the independent penetration test, which is on the founder-ops register and has not been done.

One thing this repository will never do: report a boundary as holding when it is not. `scripts/mynews-smoke.sh` has no flag that makes a failing probe pass, and `nw_console_audit_verify` reports a broken chain as broken. If a tool here says the gate is live, it means the gate answered 401.
