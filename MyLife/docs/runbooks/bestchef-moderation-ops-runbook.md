# BestChef Moderation Ops Runbook

Date: 2026-04-27

## Launch Scope

BestChef public launch moderation is server-backed. Reports, queue state, decisions, and audit records must use Supabase Postgres/RLS/RPCs or server workers. Local SQLite report rows are offline/internal cache only and are not the public moderation source of truth.

## Server Surfaces

Minimum P0 launch ops path:

- Users report public content through `bc_report_content(p_target_kind, p_target_id, p_reason, p_reporter_profile_id)`.
- Supported report targets: `submission`, `comment`, `profile`, `media_asset`, `product_contribution`, `product_evidence`, `vote_proof`, and legacy `photo` mapped to `media_asset`.
- Reports create `bc_flags` rows and upsert `bc_moderation_queue` rows.
- Moderator/admin decisions use `bc_apply_moderation_decision(p_kind, p_target_id, p_decision, p_reason, p_metadata)`.
- Vote-proof moderation continues through `bc_apply_vote_proof_decision`, now writing the same `bc_moderation_decisions.previous_state` and `new_state` audit fields.

Decision values:

- `approved`
- `rejected`
- `hidden`
- `removed`
- `restored`
- `dismissed`

Public content effects:

- Submission/comment `hidden` or `removed` sets `moderation_status = 'hidden'`.
- Submission/comment `approved` or `restored` sets `moderation_status = 'approved'`.
- Submission/comment `rejected` sets `moderation_status = 'rejected'`.
- `dismissed` records an audit decision and does not mutate public content state.
- Media/product evidence hide/remove/reject paths set non-public visibility.

## Access Boundaries

- User report RPC: granted to `authenticated` and `service_role`, with reporter ownership enforced by `bc_profile_owned`.
- Decision RPC: granted to `authenticated` and `service_role`, with `bc_is_admin()` enforced inside the RPC.
- `bc_moderation_queue` remains admin-only by RLS.
- `bc_moderation_decisions` is readable by admins and the target profile owner; writes remain admin-only.

## Operator Procedure

Until a full admin UI is built, the launch ops path is SQL/RPC based:

1. Inspect queued work:
   ```sql
   select *
   from bc_moderation_queue
   where status = 'queued'
   order by created_at asc;
   ```

2. Inspect flags for a target:
   ```sql
   select *
   from bc_flags
   where target_type = 'submission'
     and target_id = '<target-uuid>'
   order by created_at desc;
   ```

3. Hide a reported submission:
   ```sql
   select *
   from bc_apply_moderation_decision(
     'submission',
     '<target-uuid>',
     'hidden',
     'policy violation',
     '{"source":"moderation_ops"}'::jsonb
   );
   ```

4. Restore content after review:
   ```sql
   select *
   from bc_apply_moderation_decision(
     'submission',
     '<target-uuid>',
     'restored',
     'appeal accepted',
     '{"source":"moderation_ops"}'::jsonb
   );
   ```

5. Audit decisions:
   ```sql
   select kind, target_id, actor_profile_id, decision, reason, previous_state, new_state, created_at
   from bc_moderation_decisions
   where target_id = '<target-uuid>'
   order by created_at desc;
   ```

## Remaining Admin UI Work

P0 now has the minimum launch SQL/function path. A complete operator UI remains post-P0/P1 unless Product explicitly requires it before launch. The missing UI should include:

- Queue list with filters and target previews.
- One-click hide, reject, restore, dismiss, and approve actions.
- Repeat reporter/offender history.
- Appeal notes and support-safe evidence export.
- Role-gated moderator/admin navigation.

## Abuse Thresholds

Current launch constants are documented in `BESTCHEF_MODERATION_RATE_LIMITS`:

- Provider calls: 20 per profile per minute.
- Media uploads: 30 per profile per hour.
- Submissions: 12 per profile per hour.
- Comments: 6 per profile per minute.
- Votes: 30 per profile per minute.
- Reports: 10 per profile per hour.
- Profile edits: 12 per profile per hour.

Infrastructure TODO: enforce these thresholds at the Edge Function/API gateway or Postgres RPC layer before production launch if public traffic is enabled at scale. Until then, launch staff must monitor report volume and queue age manually.

## Verification

Local checks added for P0-07:

- `modules/bestchef/src/cloud/__tests__/moderation.test.ts` covers public content moderation status transitions and rate-limit constants.
- `modules/bestchef/src/cloud/__tests__/schema.test.ts` checks the schema and migration include report/decision RPCs, previous/new state, and grants.
- `supabase/tests/bc_moderation_ops.sql` covers authenticated report creation, non-admin decision rejection, admin hide, flag actioning, queue closure, and previous/new state.
- `supabase/tests/bc_vote_proofs.sql` now verifies vote-proof decisions write previous/new state.

## Automated Content Screening Seam (audit C3, C5)

Added 2026-07-11 (plan 45 item 0.3). BestChef has a fail-closed integration seam
for content classifiers (NSFW, food-likeness) and child-safety hash matching. The
seam is real; the vendor detection is not wired yet and is a founder task (F3).

### Fail-closed contract

The seam NEVER fails open. It fails closed, always:

- With no configured classifier provider (the default today), `moderate_vote_proof`
  routes each vote proof to human review (`bc_moderation_queue` row marked
  `failed` + `needs_human_review`). The proof stays `pending`, the vote stays
  inactive, and the media stays unpublished until a moderator decides. It does
  NOT approve.
- With no configured provider, `bestchef-media-screening` routes each queued
  media asset to human review (unchanged from its original fail-closed behavior).
  It does NOT approve.
- The always-safe test stubs are the ONLY code that emits a "clear"/"food"
  verdict. They are gated behind `BESTCHEF_MODERATION_TEST_STUBS=1` AND a
  non-production environment marker (`BESTCHEF_ENV` / `NODE_ENV` in
  `development|test|staging|preview|ci|local`). A production deploy that sets the
  stub flag is a configuration error: the worker refuses to run (loud, structured
  `console.error` + HTTP 503) rather than auto-approving.
- An unknown provider name in `BESTCHEF_NSFW_PROVIDER`,
  `BESTCHEF_FOOD_PROVIDER`, or `BESTCHEF_CHILD_SAFETY_PROVIDER` is also a fatal
  config error (typos must not silently degrade to "no screening ran, approved").
  Use `noop` (or leave unset) to mean "intentionally no provider".

Seam source: `supabase/functions/_shared/bestchef-moderation-providers.ts`.

### Child-safety reporting workflow (C5)

On a confirmed hash hit, the `ChildSafetyHashMatchProvider` path in
`bestchef-media-screening` calls `bc_record_child_safety_hit(...)` (SECURITY
DEFINER, service-role only), which:

1. Blocks the asset (`bc_media_assets.moderation_status = 'quarantined'`,
   `visibility = 'private'`) so it is never served.
2. Files a `bc_child_safety_reports` row (definer-only RLS, zero client policies,
   immutability trigger) with `status = 'pending_registration'`, preserving
   evidence pointers.

NO transmission happens. Transmission to NCMEC requires the org to be a
registered electronic service provider (18 U.S.C. 2258A); reports stay
`pending_registration` until that is done (F3). Migration:
`supabase/migrations/20260711000004_bestchef_child_safety_reporting.sql`.

### Worker scheduling

`moderate_vote_proof` and `bestchef-media-screening` are scheduled every 5 minutes
via pg_cron/pg_net following the deletion/purge pattern. Secrets live in
`bc_job_config` (RLS, no policies); jobs are quiet no-ops until seeded.
`bc_job_health()` now reports both jobs and their pending queue depth. Migration:
`supabase/migrations/20260711000005_bestchef_moderation_worker_jobs.sql`.

Per-environment ops setup (staging + production), service-role SQL:

```sql
insert into public.bc_job_config (key, value) values
  ('functions_base_url', 'https://<project-ref>.supabase.co/functions/v1'),
  ('vote_proof_moderation_worker_secret', '<BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET>'),
  ('media_screening_worker_secret', '<BESTCHEF_MEDIA_SCREENING_WORKER_SECRET>')
on conflict (key) do update set value = excluded.value, updated_at = now();
```

Verify: `select public.bc_job_health();` — `healthy` is true only when config,
extensions, and all five jobs are present.

### Job-config seeding automation (audit M9)

Manually running the `insert ... on conflict` blocks above per environment is
exactly the kind of step that gets skipped, which is how `bc_job_config` rows
go missing and the workers silently no-op. Use
`apps/bestchef/scripts/seed-bc-job-config.mjs` instead:

```bash
# Seed every bc_job_config row this environment needs, from env vars.
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
BESTCHEF_FUNCTIONS_BASE_URL=https://<project-ref>.supabase.co/functions/v1 \
BESTCHEF_ACCOUNT_DELETION_WORKER_SECRET=... \
BESTCHEF_MEDIA_PURGE_WORKER_SECRET=... \
BESTCHEF_VOTE_PROOF_MODERATION_WORKER_SECRET=... \
BESTCHEF_MEDIA_SCREENING_WORKER_SECRET=... \
node apps/bestchef/scripts/seed-bc-job-config.mjs

# Preview planned created/updated/unchanged rows without writing anything.
node apps/bestchef/scripts/seed-bc-job-config.mjs --dry-run

# Gate a deploy: seed, then fail the pipeline unless bc_job_health().healthy is true.
node apps/bestchef/scripts/seed-bc-job-config.mjs --verify
```

The script upserts by `key` (idempotent, safe to rerun), prints a per-row
created/updated/unchanged summary, and exits nonzero on any failure including
missing env vars (it never partial-writes on bad input). `--verify` calls
`bc_job_health()` after seeding and fails the run unless `healthy=true`.

Run it:

- On every environment bring-up (staging and production), before traffic
  relies on any scheduled worker.
- Immediately after adding a new worker/job to the schema, once its
  `bc_job_config` key and cron schedule exist, so the new row is seeded
  everywhere in the same pass rather than discovered missing later.
- As a `--verify` gate in the deploy pipeline before promoting to production,
  so a config regression fails the deploy instead of shipping a quiet no-op.

### F3 founder steps to activate real screening

The seam activates fail-open NEVER, fail-closed ALWAYS. To turn on real detection,
the founder must complete ALL of these; no code flip approves content on its own:

1. Contract an NSFW + food-likeness image/video classifier vendor.
2. Contract a hash-match child-safety vendor (PhotoDNA-class or equivalent) and
   arrange lawful access to the hash lists.
3. Register the org with NCMEC as an electronic service provider (18 U.S.C.
   2258A) so child-safety reports can be transmitted.
4. Implement the vendor adapters behind the existing interfaces
   (`NsfwImageClassifierProvider`, `FoodImageClassifierProvider`,
   `ChildSafetyHashMatchProvider`) in
   `supabase/functions/_shared/bestchef-moderation-providers.ts`, and register
   their names in the `KNOWN_*_PROVIDERS` sets + construction switch.
5. Set the provider env vars/secrets per environment:
   `BESTCHEF_NSFW_PROVIDER`, `BESTCHEF_FOOD_PROVIDER`,
   `BESTCHEF_CHILD_SAFETY_PROVIDER` (plus each vendor's own credentials).
6. Author the F3-gated transmission step that advances
   `bc_child_safety_reports.status` from `pending_registration` to
   `ready_for_transmission` -> `transmitted` after NCMEC registration.

Until step 5 sets a real provider name, both workers stay fully fail-closed and
route everything to human review. There is nothing else to flip.
