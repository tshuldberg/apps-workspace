# Runbook: MyNews backup, PITR, and restore drill

## Purpose

Define how MyNews data is protected, how a restore is performed, and how a restore is **verified** rather than assumed. MyNews is Supabase-canonical: the `nw_*` Postgres schema is the record, local SQLite in the app is a cache and draft store only, so losing the database is losing the product. Several tables are legally and ethically load-bearing and cannot be reconstructed: the append-only `nw_support_ledger`, the hash-chained `nw_console_audit`, `nw_dmca_notices`, `nw_dmca_counter_notices`, and `nw_ncii_cases`.

## The honest constraint, stated first

**Supabase PITR configuration, backup scheduling, and any restore or restore drill against live infrastructure are founder-ops. They cannot be executed from this repository and nothing here simulates them.**

There is no script in `scripts/` that configures backups, triggers a restore, or fakes one. `scripts/mynews-deploy.sh` and `scripts/mynews-rollback.sh` deliberately do not touch backups, and `scripts/mynews-rollback.sh` states at runtime that migrations are not automatically reversible. PITR requires a paid Supabase plan and is enabled per project in the dashboard; whether it is enabled today is a fact about the live project, not about this repo, so verify it in the dashboard before relying on any number in this document.

What this repository can give you is the exact operator checklist and the exact verification queries. That is the useful half, and it is below.

## What must be protected

| Data | Where | Why it cannot be reconstructed |
| --- | --- | --- |
| Support money trail | `nw_support_charges`, `nw_support_receipts`, `nw_support_ledger`, `nw_transfer_ledger`, `nw_payment_events`, `nw_payout_accounts` | Append-only by trigger; tax and payout evidence. Stripe holds a parallel record, but the split math and journalist attribution live here |
| Moderation audit | `nw_console_audit` | Hash-chained (`prev_hash`, `row_hash`) and append-only. A gap is permanently detectable and permanently unexplainable |
| Safety record | `nw_ncii_cases`, `nw_reports`, `nw_report_escalations`, `nw_moderation_actions`, `nw_moderation_appeals` | Legal retention; deletion disposition deliberately retains these |
| Copyright record | `nw_dmca_notices`, `nw_dmca_events`, `nw_dmca_counter_notices` | 17 U.S.C. 512(c)(3) elements and the repeat-infringer strike history on `nw_profiles.copyright_strikes` |
| Published journalism | `nw_articles`, `nw_article_revisions`, `nw_article_meta`, `nw_content_signatures`, `nw_edit_suggestions`, `nw_credibility_ledger` | The product. Signed revisions cannot be re-signed by anyone but the author |
| Identity and keys | `nw_profiles`, `nw_journalists`, `nw_profile_keys`, `nw_key_events`, `nw_key_escrow` | A lost public key breaks verification of every past revision |
| Deletion obligations | `nw_deletion_requests`, `nw_export_jobs`, `nw_terms_acceptance` | An in-flight deletion request is a legal commitment with a 7-day grace window |
| Media | Supabase Storage | Separate from the database. A database-only restore leaves `nw_media_assets` rows pointing at objects that may not match |

## Operator checklist: configure and prove backups (founder-ops)

Do these in the Supabase dashboard for the MyNews project. Record the answers somewhere durable, because the value of this checklist is the written answer, not the click.

1. **Confirm the plan supports PITR.** PITR is a paid add-on. Write down the plan and whether PITR is on.
2. **Confirm the retention window.** Note the exact number of days of PITR retention and the daily backup retention. Do not carry a number from another project into a MyNews decision.
3. **Write down the RPO and RTO you actually have,** not the ones you want. RPO is the PITR granularity; RTO is how long a restore of this database size takes, which you only learn by drilling.
4. **Confirm Storage is covered.** Database backups do not cover Storage objects. Note explicitly whether MyNews media has a backup path, and if it does not, that is a gap to record, not to paper over.
5. **Record who can perform a restore.** A restore is destructive to the target project. Note the exact set of humans with that access.
6. **Schedule the drill.** Quarterly is the minimum for a product holding a money ledger and a safety record.
7. **Pre-write the migration inventory.** Before any restore, capture the current applied migration list so the post-restore schema can be compared against it:
   ```bash
   ls supabase/migrations | grep mynews
   ```
   and, against the live project, the contents of the Supabase migration history table. A restore to a timestamp before a migration lands returns you to the older schema, and the deployed edge functions will then be newer than the schema. That is the same hazard `scripts/mynews-rollback.sh` refuses to walk into silently.

## Operator checklist: run the drill (founder-ops)

Never drill against production. Restore into a separate project or a clone.

1. **Announce a maintenance window** if the drill touches anything shared.
2. **Capture pre-drill counts** from production for every table in the verification list below, plus the current `nw_console_audit` maximum `seq` and its `row_hash`. Without pre-drill numbers there is nothing to compare against and the drill proves nothing.
3. **Pick a target timestamp** and write down which migrations were applied at that moment.
4. **Perform the restore** into the drill project (Supabase dashboard, PITR restore).
5. **Point a throwaway environment at the restored project.** Set `SUPABASE_PROJECT_REF` for the drill project and deploy the edge functions from the git ref that matches the restored schema, not from `main`:
   ```bash
   bash scripts/mynews-rollback.sh --to <ref-matching-restored-schema>
   ```
   That script refuses to proceed when the target ref lacks migrations that HEAD has, unless you pass `--i-have-a-database-plan`. In a drill, that refusal is the point: it forces you to state which schema you restored to.
6. **Run the verification section below in full.** A drill that does not run the verification queries is a restore, not a drill.
7. **Time it.** Record wall-clock time from decision to verified. That number is your real RTO.
8. **Tear the drill project down** and record the result, including anything that did not verify.

## Recovery verification: how to prove a restore is real

Run all of these against the restored database. Each one answers a question that a row count alone cannot.

### 1. Schema matches the ref you deployed

```sql
select table_name
from information_schema.tables
where table_schema = 'public' and table_name like 'nw_%'
order by table_name;
```

Compare against the `create table` statements in `supabase/migrations/*mynews*.sql` up to the restored point. A missing table means you restored further back than you thought.

### 2. Spot-check counts on the tables that matter

```sql
select 'nw_articles' t, count(*) from public.nw_articles
union all select 'nw_article_revisions', count(*) from public.nw_article_revisions
union all select 'nw_content_signatures', count(*) from public.nw_content_signatures
union all select 'nw_profiles', count(*) from public.nw_profiles
union all select 'nw_profile_keys', count(*) from public.nw_profile_keys
union all select 'nw_reports', count(*) from public.nw_reports
union all select 'nw_ncii_cases', count(*) from public.nw_ncii_cases
union all select 'nw_dmca_notices', count(*) from public.nw_dmca_notices
union all select 'nw_dmca_counter_notices', count(*) from public.nw_dmca_counter_notices
union all select 'nw_moderation_actions', count(*) from public.nw_moderation_actions
union all select 'nw_support_charges', count(*) from public.nw_support_charges
union all select 'nw_support_receipts', count(*) from public.nw_support_receipts
union all select 'nw_support_ledger', count(*) from public.nw_support_ledger
union all select 'nw_transfer_ledger', count(*) from public.nw_transfer_ledger
union all select 'nw_console_audit', count(*) from public.nw_console_audit
union all select 'nw_credibility_ledger', count(*) from public.nw_credibility_ledger
union all select 'nw_deletion_requests', count(*) from public.nw_deletion_requests
order by 1;
```

Compare to the pre-drill capture. Counts lower than expected by the PITR granularity are normal; counts lower by more are a finding.

### 3. The hash-chained audit survived, and is still a chain

Row count is not enough for `nw_console_audit`: the chain has to verify. The schema ships a verifier:

```sql
select public.nw_console_audit_verify(0, 1000000);
```

Read the returned jsonb. It walks the chain and recomputes each `row_hash` over the octet-length-prefixed fields, checking that every row's `prev_hash` equals the previous row's `row_hash`. A break tells you which `seq` broke it. Then confirm the tip matches the pre-drill capture:

```sql
select seq, prev_hash, row_hash from public.nw_console_audit order by seq desc limit 1;
```

A verifying chain whose tip is older than the pre-drill tip means you lost audit rows to the restore window: that is a real and reportable loss, and it is honest precisely because the chain makes it visible. A chain that does not verify at all after a restore is a data-integrity incident, not a restore artifact.

Use `public.nw_console_audit_export(0, 5000)` if you need the rows themselves for a written record.

### 4. The append-only guarantees are still enforced

A restore brings back tables; confirm it also brought back the triggers that make them immutable. Check the triggers exist first, because this check is cheap and never ambiguous:

```sql
select tgname, tgrelid::regclass as table_name, tgtype
from pg_trigger
where not tgisinternal
  and tgname in (
    'nw_support_ledger_immutable',
    'nw_console_audit_seal',
    'nw_console_audit_no_update',
    'nw_console_audit_no_truncate',
    'nw_dmca_events_no_mutation'
  )
order by 1;
```

All five must be present. Then prove they fire. Run inside an explicit transaction and roll it back; the row-level triggers raise before any modification, so nothing is written even if a trigger were missing:

```sql
begin;
-- expect: ERROR  nw_support_ledger is append-only
update public.nw_support_ledger set kind = kind
  where id = (select id from public.nw_support_ledger limit 1);
rollback;

begin;
-- expect: ERROR  nw_console_audit is append-only (attempted UPDATE)
update public.nw_console_audit set reason = reason
  where seq = (select max(seq) from public.nw_console_audit);
rollback;
```

If either statement succeeds instead of raising, the trigger did not come back and the restored database's ledger and audit are no longer tamper-evident. Do not put that database into service.

These two probes are row-level, so on an **empty** table they cannot fire and the result is inconclusive rather than passing. If either table is empty after a restore, that is itself the finding: a production restore that produced an empty `nw_console_audit` lost the entire moderation audit trail.

### 5. RLS and grants came back

```sql
select relname, relrowsecurity
from pg_class
where relname like 'nw_%' and relkind = 'r'
order by relname;
```

Every `nw_*` table is expected to have RLS enabled. Service-role-only tables (`nw_ncii_cases`, `nw_dmca_notices`, `nw_console_audit`, `nw_job_config`, `nw_queue_assignments`) must not be reachable by `anon` or `authenticated`. A restored database with RLS off is a breach waiting to happen: go to [breach.md](breach.md) rather than putting it in service.

### 6. Fee configuration and SLA seeds are intact

```sql
select * from public.nw_fee_config;
select reason, deadline_hours, lane from public.nw_report_sla order by lane, deadline_hours;
```

`nw_report_sla` must still show `child-safety` 24h `urgent` and `ncii` 48h `urgent`. The fee split is data-driven from `nw_fee_config`, so a missing row silently changes the money math.

### 7. In-flight obligations are still in flight

```sql
select id, status, requested_at from public.nw_deletion_requests
where status in ('grace', 'processing') order by requested_at;

select id, case_class, status, hash_match_status, deadline_at
from public.nw_ncii_cases
where status in ('queued', 'escalated')
order by deadline_at;
```

`nw_ncii_cases.status` is one of `queued`, `removed`, `escalated`, `cleared`, and `hash_match_status` is one of `pending`, `match`, `no_match`, `error`. A case that reads `cleared` after a restore when it was `removed` before is the worst possible restore artifact: it means removed content is publicly reachable again. Check that direction specifically.

A restore can resurrect a deletion request that had already completed, or move a resolved safety case back to open. Both need a human decision, and both are reasons to re-run the workers deliberately rather than waiting for cron.

### 8. The surface actually works

```bash
MYNEWS_FUNCTIONS_URL=https://<drill-project-ref>.supabase.co/functions/v1 \
MYNEWS_SMOKE_ANON_KEY=<drill publishable anon key> \
bash scripts/mynews-smoke.sh
```

Expect `SMOKE PASSED (4 probes)`. A 200 where 401 was expected means the restored project's JWT posture does not match `supabase/config.toml`.

### 9. Media, separately

Pick several rows from `nw_media_assets` and confirm the referenced Storage objects exist and are the right objects. A database restore does not restore Storage, so this check is the one most likely to fail and the one most often skipped.

## Decision points

- **Restore or repair forward?** A restore rewinds everything, including safety decisions and money rows that were correct. For anything short of catastrophic loss, targeted repair with append-only-respecting writes is safer. A restore is the right answer for corruption or destructive deletion, not for one bad row.
- **How far back?** Every minute of rewind is a minute of lost journalism, lost support charges, and lost moderation decisions. Pick the latest timestamp that excludes the damage, and write down what falls inside the window so it can be reconciled with Stripe afterwards.
- **Deploy which code ref?** The one matching the restored schema. Deploying `main` onto an older restored schema is how a restore becomes an outage.

## Escalation

1. Suspected data loss goes to the founder immediately, because only founder-ops can see or act on backups.
2. A failed integrity check in step 3 or step 4 escalates to a data-integrity incident and is written up, not retried quietly.
3. If the cause of the loss might be unauthorized access, stop and use [breach.md](breach.md).

## Communication template

```
MyNews data event, detected <UTC timestamp>
Nature:            <corruption | destructive delete | suspected loss | scheduled drill>
Scope:             <tables / date range affected>
PITR available:    <yes, N days retention | no>   (verified in the dashboard on <date>)
Decision:          <restore to <UTC timestamp> | targeted repair | drill only>
Window at risk:    <what falls inside the rewind>
Integrity checks:  audit chain <verified | BROKEN at seq N>; append-only triggers <present | MISSING>
Media:             <verified | not covered by backups>
Owner:             <name>   Next update: <UTC timestamp>
```

If user data was lost, the external message says what was lost and over what period. Do not describe a restore as complete before the integrity checks in this runbook have passed.

## What is founder-ops here

Everything that touches live infrastructure:

- Enabling and configuring PITR, and choosing the retention window.
- Reading, listing, or downloading any backup.
- Performing any restore, into production or a drill project.
- Provisioning the drill project and its secrets.
- Storage backup strategy, which the database backup does not cover.
- Deciding the RPO and RTO the product commits to, and any external statement about data loss.

This repository provides the checklist, the verification queries, and the smoke script. It cannot and does not perform, schedule, or simulate a backup or a restore, and no output from it should ever be read as evidence that one happened.
