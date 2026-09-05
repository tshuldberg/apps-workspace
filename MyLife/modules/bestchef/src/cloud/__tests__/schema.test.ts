import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const EXPECTED_BESTCHEF_TABLES = [
  'bc_affiliate_orders',
  'bc_account_deletion_requests',
  'bc_account_lifecycle_events',
  'bc_badge_definitions',
  'bc_brand_mappings',
  'bc_chef_badges',
  'bc_comment_helpful',
  'bc_comments',
  'bc_content_events',
  'bc_creator_applications',
  'bc_dish_aliases',
  'bc_dishes',
  'bc_flags',
  'bc_hubs',
  'bc_leaderboard_snapshots',
  'bc_media_assets',
  'bc_media_variants',
  'bc_moderation_decisions',
  'bc_moderation_queue',
  'bc_note_ratings',
  'bc_notes',
  'bc_photo_reports',
  'bc_posts',
  'bc_product_aliases',
  'bc_product_contributions',
  'bc_product_evidence',
  'bc_product_nutrition',
  'bc_product_records',
  'bc_rankings',
  'bc_recipe_forks',
  'bc_recipe_snapshots',
  'bc_submission_aliases',
  'bc_submission_likes',
  'bc_submissions',
  'bc_subscription_tiers',
  'bc_subscriptions',
  'bc_tips',
  'bc_vote_proofs',
  'bc_votes',
];

describe('BestChef authoritative server schema', () => {
  it('defines every BestChef cloud table with row-level security', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

    for (const table of EXPECTED_BESTCHEF_TABLES) {
      expect(schema).toContain(`create table if not exists ${table}`);
      expect(schema).toContain(`alter table ${table} enable row level security`);
    }
  });

  it('defines the official hub, media, and leaderboard RPCs', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

    expect(schema).toContain('create or replace function bc_submit_vote');
    expect(schema).toContain('Vote proof is required. Use bc_cast_vote with a proof media asset.');
    expect(schema).toContain('create or replace function bc_cast_vote');
    expect(schema).toContain('create or replace function bc_delete_vote');
    expect(schema).toContain('create or replace function bc_apply_vote_proof_decision');
    expect(schema).toContain('create or replace function bc_report_content');
    expect(schema).toContain('create or replace function bc_apply_moderation_decision');
    expect(schema).toContain('create or replace function bc_set_submission_like');
    expect(schema).toContain('create or replace function bc_get_submission_like_state');
    expect(schema).toContain('create or replace function bc_rebuild_rankings');
    expect(schema).toContain('create or replace function bc_core_delta');
    expect(schema).toContain('create or replace function bc_submission_bundle');
    expect(schema).toContain('create or replace function bc_register_hub_manifest');
    expect(schema).toContain('create or replace function bc_record_media_asset');
    expect(schema).toContain('create or replace function bc_current_identity_status');
    expect(schema).toContain('create or replace function bc_request_account_deletion');
    expect(schema).toContain('create or replace function bc_profile_owned_row_counts');
    expect(schema).toContain('create or replace function bc_profile_merge_conflicts');
    expect(schema).toContain('create table if not exists bc_submission_aliases');
    expect(schema).toContain('create table if not exists bc_account_deletion_requests');
    expect(schema).toContain('user_id uuid references auth.users(id) on delete set null');
    expect(schema).toContain('create policy "bc_submission_aliases_insert"');
    expect(schema).toContain('create policy "bc_account_deletion_requests_read"');
    expect(schema).toContain('unique nulls not distinct (dish_id, submission_id, region)');
    expect(schema).toContain('create table if not exists bc_vote_proofs');
    expect(schema).toContain('constraint bc_vote_proofs_unique_per_submission');
    expect(schema).toContain("owner_kind <> 'vote_proof'");
    expect(schema).toContain("return query select null::uuid, null::uuid, null::text, 'proof_duplicate'::text");
    expect(schema).toContain("status = 'active'");
    expect(schema).toContain("'storage_purge', 'pending_server_worker'");
    expect(schema).toContain('previous_state jsonb not null default');
    expect(schema).toContain('new_state jsonb not null default');
    expect(schema).toContain("'hidden',");
    expect(schema).toContain("'removed',");
    expect(schema).toContain('grant execute on function bc_report_content');
    expect(schema).toContain('grant execute on function bc_apply_moderation_decision');
  });

  it('defines the integrity floor: durable quotas, global proof dedup, block enforcement', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

    // Durable action-quota engine (plan 33 Phase 1.2, CHF-1 pattern).
    for (const table of ['bc_action_limits', 'bc_action_controls', 'bc_action_usage', 'bc_proof_hash_ledger']) {
      expect(schema).toContain(`create table if not exists public.${table}`);
      expect(schema).toContain(`alter table public.${table} enable row level security`);
    }
    expect(schema).toContain('create or replace function public.bc_consume_action_quota');
    expect(schema).toContain(
      'revoke all on function public.bc_consume_action_quota(uuid, text, uuid) from public, anon, authenticated',
    );
    expect(schema).toContain('create or replace function public.bc_prune_action_usage');

    // Vote integrity (N3): global per-user hash dedup, recast cooldown, delete throttle.
    expect(schema).toContain('primary key (profile_id, content_hash)');
    expect(schema).toContain("'recast_cooldown'::text");
    expect(schema).toContain("'rate_limited'::text");
    expect(schema).toContain("raise exception 'vote_delete_rate_limited'");
    expect(schema).toContain("'cross_user_hash_reuse', true");

    // Server-side block enforcement (N13): helper is hidden from clients and
    // wired into visibility + read policies + write triggers.
    expect(schema).toContain('create or replace function public.bc_blocked_between');
    expect(schema).toContain(
      'revoke all on function public.bc_blocked_between(uuid, uuid) from public, anon, authenticated',
    );
    expect(schema).toContain('or not public.bc_blocked_between(public.bc_current_profile_id(), s.profile_id)');
    expect(schema).toContain('or not public.bc_blocked_between(public.bc_current_profile_id(), profile_id)');

    // Every remaining direct-write path is trigger-gated.
    expect(schema).toContain('create trigger bc_comments_integrity_gate');
    expect(schema).toContain('create trigger bc_flags_action_quota');
    expect(schema).toContain('create trigger bc_submission_likes_action_quota');
    expect(schema).toContain('create trigger bc_photo_reports_action_quota');
    expect(schema).toContain('create trigger bc_comment_helpful_action_quota');
    expect(schema).toContain('create trigger bc_social_follows_gate');
  });

  it('defines the moderation appeal flow (DSA Art. 20)', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

    expect(schema).toContain('create table if not exists public.bc_appeals');
    expect(schema).toContain('alter table public.bc_appeals enable row level security');
    expect(schema).toContain('constraint bc_appeals_one_per_decision unique (decision_id)');
    expect(schema).toContain('create or replace function public.bc_submit_appeal');
    expect(schema).toContain('create or replace function public.bc_resolve_appeal');
    // Only the affected user may appeal; other decisions stay invisible.
    expect(schema).toContain("v_decision.profile_id is distinct from v_profile_id");
    // Appeals ride the durable quota engine.
    expect(schema).toContain("bc_consume_action_quota(v_profile_id, 'appeal', p_decision_id)");
    // Resolution is console/service-side only.
    expect(schema).toContain(
      'revoke all on function public.bc_resolve_appeal(uuid, text, text) from public, anon, authenticated',
    );
  });

  it('stores typed notifications, not English prose (plan 33 Phase 2.1)', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

    expect(schema).toContain('add column if not exists params jsonb');
    // Fanout functions carry structured params...
    expect(schema).toContain("'actor_name', v_actor_name");
    expect(schema).toContain("'new_rank', new_rank");
    expect(schema).toContain("'badge_name', v_name");
    // ...and the old baked-English fanout strings are gone from the tail
    // (the superseding definitions after the 20260703000004 marker).
    const typedLayer = schema.slice(schema.indexOf('20260703000004'));
    expect(typedLayer).not.toContain("' upvoted your recipe'");
    expect(typedLayer).not.toContain("' started following you'");
    expect(typedLayer).not.toContain("'You moved up to #'");
    expect(typedLayer).toContain('as params');
  });

  it('guards public sync payloads and server-controlled writes', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

    expect(schema).toContain('create or replace function bc_public_content_event_payload');
    expect(schema).toContain("p_row->>'moderation_status' <> 'approved'");
    expect(schema).toContain("p_row->>'upload_status' <> 'ready'");
    expect(schema).toContain("raise exception 'Not authorized to rebuild BestChef rankings'");
    expect(schema).toContain("raise exception 'Not authorized to update this hub manifest'");
    expect(schema).toContain('create policy "bc_media_assets_update" on bc_media_assets for update using (bc_is_admin())');
    expect(schema).toContain('create policy "bc_subscriptions_insert" on bc_subscriptions for insert with check (bc_is_admin())');
    expect(schema).toContain("raise exception 'Chefs cannot vote on their own submissions'");
    expect(schema).toContain("raise exception 'Vote ownership fields cannot be changed directly'");
    expect(schema).toContain("raise exception 'Server-controlled comment fields cannot be changed directly'");
    expect(schema).toContain('create or replace function bc_recompute_note_consensus');
    expect(schema).toContain("and n.status in ('pending', 'shown')");
  });

  it('qualifies public recipe snapshot visibility against the outer snapshot row', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    const publicRecipeSnapshotMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260506000001_bestchef_public_recipe_snapshots.sql', import.meta.url),
      'utf8',
    );

    expect(schema).toContain('where s.recipe_snapshot_id = public.bc_recipe_snapshots.id');
    expect(publicRecipeSnapshotMigration).toContain('where s.recipe_snapshot_id = public.bc_recipe_snapshots.id');
    expect(schema).not.toContain('where s.recipe_snapshot_id = id and s.moderation_status');
  });

  it('defines product cache records, contributions, evidence consent, and privacy filters', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

    expect(schema).toContain('create table if not exists bc_product_records');
    expect(schema).toContain('create table if not exists bc_product_aliases');
    expect(schema).toContain('create table if not exists bc_product_nutrition');
    expect(schema).toContain('create table if not exists bc_product_contributions');
    expect(schema).toContain('create table if not exists bc_product_evidence');
    expect(schema).toContain('source text not null check');
    expect(schema).toContain('source_id text');
    expect(schema).toContain('confidence double precision');
    expect(schema).toContain('license text not null');
    expect(schema).toContain('attribution text');
    expect(schema).toContain('fetched_at timestamptz not null default now()');
    expect(schema).toContain('confirmed_at timestamptz');
    expect(schema).toContain("status text not null default 'private_draft' check (status in ('private_draft', 'submitted', 'verified', 'rejected', 'superseded'))");
    expect(schema).toContain('create or replace function bc_jsonb_contains_private_product_payload_key');
    expect(schema).toContain('jsonb_each(p_value)');
    expect(schema).toContain('jsonb_array_elements(p_value)');
    expect(schema).toContain('bc_product_contributions_submit_requires_opt_in');
    expect(schema).toContain('not bc_jsonb_contains_private_product_payload_key(proposed_product_json)');
    expect(schema).toContain("'candidate_json'");
    expect(schema).toContain("'image_base64'");
    expect(schema).toContain('image_consent_status text not null default');
    expect(schema).toContain('bc_product_evidence_publish_requires_consent');
    expect(schema).toContain("evidence_kind <> 'receipt_crop'");
    expect(schema).toContain('create or replace function bc_product_evidence_visible');
    expect(schema).toContain("p_row->>'share_opt_in' <> 'true'");
    expect(schema).toContain("p_row->>'image_consent_status' not in");
    expect(schema).not.toContain('create table if not exists bc_pantry');
  });

  it('keeps the module schema mirrored in active Supabase migrations', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    const coreMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260424000005_add_bestchef_core_hub.sql', import.meta.url),
      'utf8',
    );
    const betaMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260425000006_enable_bestchef_beta_cloud_submissions.sql', import.meta.url),
      'utf8',
    );
    const accountLifecycleMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260426000007_bestchef_account_lifecycle.sql', import.meta.url),
      'utf8',
    );
    const accountDeletionWorkerMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260426000008_bestchef_account_deletion_worker.sql', import.meta.url),
      'utf8',
    );
    const voteProofMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260427000008_bc_vote_proofs.sql', import.meta.url),
      'utf8',
    );
    const voteProofDeletionMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260427000009_bc_vote_proof_deletion_media.sql', import.meta.url),
      'utf8',
    );
    const publicDataPolicyMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260427000010_bestchef_public_data_policy.sql', import.meta.url),
      'utf8',
    );
    const moderationOpsMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260427000011_bestchef_moderation_ops.sql', import.meta.url),
      'utf8',
    );
    const submissionLikesMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260427000012_bestchef_submission_likes.sql', import.meta.url),
      'utf8',
    );
    const publicRecipeSnapshotMigration = readFileSync(
      new URL('../../../../../supabase/migrations/20260506000001_bestchef_public_recipe_snapshots.sql', import.meta.url),
      'utf8',
    );

    expect(coreMigration).toContain('create table if not exists bc_submissions');
    expect(coreMigration).toContain('create or replace function bc_submission_bundle');
    expect(coreMigration).toContain('create table if not exists bc_product_records');
    expect(coreMigration).toContain('create table if not exists bc_product_contributions');
    expect(coreMigration).toContain('create policy "bc_product_evidence_read"');
    expect(coreMigration).toContain('create or replace function bc_jsonb_contains_private_product_payload_key');
    expect(coreMigration).toContain('not bc_jsonb_contains_private_product_payload_key(proposed_product_json)');
    expect(coreMigration).toContain("p_row->>'share_opt_in' <> 'true'");
    expect(betaMigration).toContain('create table if not exists bc_submission_aliases');
    expect(betaMigration).toContain("('Pad Thai', 'pad-thai', 'main', 'Thai', 'active')");
    expect(accountLifecycleMigration).toContain('create table if not exists bc_account_deletion_requests');
    expect(accountLifecycleMigration).toContain('create or replace function bc_request_account_deletion');
    expect(accountDeletionWorkerMigration).toContain('on delete set null');
    expect(accountDeletionWorkerMigration).toContain('bc_account_deletion_requests_user_id_fkey');
    expect(voteProofMigration).toContain('create table if not exists bc_vote_proofs');
    expect(voteProofMigration).toContain('create or replace function bc_cast_vote');
    expect(voteProofMigration).toContain('insert into bc_moderation_queue');
    expect(voteProofMigration).toContain('grant execute on function bc_apply_vote_proof_decision');
    expect(voteProofDeletionMigration).toContain('create or replace function bc_delete_vote');
    expect(voteProofDeletionMigration).toContain('pending_server_worker');
    expect(publicDataPolicyMigration).toContain('bc_dishes_photo_url_https');
    expect(publicDataPolicyMigration).toContain('bc_submissions_photo_url_https');
    expect(publicDataPolicyMigration).toContain('bc_comments_photo_url_https');
    expect(publicDataPolicyMigration).toContain("photo_url ~ '^https://'");
    expect(moderationOpsMigration).toContain('create or replace function bc_report_content');
    expect(moderationOpsMigration).toContain('create or replace function bc_apply_moderation_decision');
    expect(moderationOpsMigration).toContain('previous_state jsonb not null default');
    expect(moderationOpsMigration).toContain('new_state jsonb not null default');
    expect(moderationOpsMigration).toContain("return query select p_target_id, null::uuid, '{}'::jsonb, '{}'::jsonb, 'not_authorized'::text");
    expect(moderationOpsMigration).toContain("set moderation_status = v_content_status");
    expect(moderationOpsMigration).toContain('grant execute on function bc_apply_moderation_decision');
    expect(submissionLikesMigration).toContain('create table if not exists bc_submission_likes');
    expect(submissionLikesMigration).toContain('create or replace function bc_set_submission_like');
    expect(submissionLikesMigration).toContain('constraint bc_submission_likes_unique');
    expect(publicRecipeSnapshotMigration).toContain('create policy "bc_recipe_snapshots_read"');
    expect(publicRecipeSnapshotMigration).toContain('public.bc_recipe_snapshots.id');
    expect(schema).toContain('create table if not exists bc_submissions');
    expect(schema).toContain('create table if not exists bc_submission_aliases');
    expect(schema).toContain('create table if not exists bc_submission_likes');
    expect(schema).toContain('create table if not exists bc_account_deletion_requests');
    expect(schema).toContain('create table if not exists bc_vote_proofs');
    expect(schema).toContain("('Pad Thai', 'pad-thai', 'main', 'Thai', 'active'");
    expect(schema).toContain('constraint bc_dishes_photo_url_https');
    expect(schema).toContain('constraint bc_submissions_photo_url_https');
    expect(schema).toContain('constraint bc_comments_photo_url_https');
  });

  it('mirrors the dish translation layer (migration 20260703000005, plan 33 Phase 2.3)', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    const migration = readFileSync(
      new URL(
        '../../../../../supabase/migrations/20260703000005_bestchef_dish_translations.sql',
        import.meta.url,
      ),
      'utf8',
    );

    for (const source of [schema, migration]) {
      expect(source).toContain('create table if not exists public.bc_dish_translations');
      expect(source).toContain('constraint bc_dish_translations_unique unique (dish_id, locale)');
      expect(source).toContain("check (status in ('pending', 'approved', 'rejected'))");
      // Reads are approved-or-admin; writes are console/service-role only.
      expect(source).toContain("using (status = 'approved' or bc_is_admin())");
      expect(source).toContain('using (bc_is_admin()) with check (bc_is_admin())');
      expect(source).toContain('create or replace function public.bc_search_dishes');
      // The search is injection-safe: the user query is LIKE-escaped, never
      // interpolated into a PostgREST filter string.
      expect(source).toContain("'%', '\\%'");
      // Exact locale tag wins over the base-language fallback.
      expect(source).toContain('order by (lower(tr.locale) = v_locale) desc');
      expect(source).toContain('grant execute on function public.bc_search_dishes');
    }
  });

  it('mirrors UGC language tagging (migration 20260703000006, plan 33 Phase 2.5)', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    const migration = readFileSync(
      new URL(
        '../../../../../supabase/migrations/20260703000006_bestchef_ugc_language.sql',
        import.meta.url,
      ),
      'utf8',
    );

    for (const source of [schema, migration]) {
      expect(source).toContain('constraint bc_submissions_language_shape');
      expect(source).toContain('constraint bc_recipe_snapshots_language_shape');
      expect(source).toContain('constraint bc_comments_language_shape');
      expect(source).toContain('create index if not exists bc_submissions_language_idx');
      // Vote-proof queue rows inherit the submission language so the console
      // filter activates without touching the bc_cast_vote RPC.
      expect(source).toContain('create or replace function public.bc_stamp_queue_language');
      expect(source).toContain('create trigger bc_moderation_queue_language');
    }
  });

  it('mirrors cloud bookmarks (migration 20260704000001, plan 33 Phase 5.6 F-010)', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    const migration = readFileSync(
      new URL(
        '../../../../../supabase/migrations/20260704000001_bestchef_saved_submissions.sql',
        import.meta.url,
      ),
      'utf8',
    );

    for (const source of [schema, migration]) {
      expect(source).toContain('create table if not exists bc_saved_submissions');
      expect(source).toContain('constraint bc_saved_submissions_unique unique (profile_id, submission_id)');
      // Saves are PRIVATE library data: owner-only read, unlike likes.
      expect(source).toContain('create policy "bc_saved_submissions_read" on bc_saved_submissions for select using (\n  bc_profile_owned(profile_id) or bc_is_admin()\n)');
      expect(source).toContain('bc_submission_visible(submission_id)');
      expect(source).toContain("values ('save', 200, 3600)");
      expect(source).toContain("bc_enforce_action_quota('save', 'profile_id')");
    }
  });

  it('mirrors the media purge job wiring (migration 20260704000002, TS-04)', () => {
    const schema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
    const migration = readFileSync(
      new URL(
        '../../../../../supabase/migrations/20260704000002_bestchef_media_purge_job.sql',
        import.meta.url,
      ),
      'utf8',
    );

    for (const source of [schema, migration]) {
      expect(source).toContain('create or replace function bc_run_media_purge_worker()');
      // Rejections are appealable evidence: purged only after the DSA window.
      expect(source).toContain("interval '183 days'");
      expect(source).toContain("'bestchef-media-purge-worker'");
      expect(source).toContain("'media_purge_job_scheduled', v_purge_job");
    }
  });
});
