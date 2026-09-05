-- Integrity floor (migration 20260703000002): durable action quotas, per-user
-- global proof-hash ledger, delete throttle + recast cooldown, server-side
-- block enforcement. Plan 33 Phase 1.2 + 1.5 (findings N3 + N13).
--
-- Run: supabase test db  (pgTAP; the whole file rolls back)

begin;

create extension if not exists pgtap with schema extensions;

select plan(33);

-- ── Structure ────────────────────────────────────────────────────────

select has_table('public', 'bc_action_limits', 'bc_action_limits exists');
select has_table('public', 'bc_action_controls', 'bc_action_controls exists');
select has_table('public', 'bc_action_usage', 'bc_action_usage exists');
select has_table('public', 'bc_proof_hash_ledger', 'bc_proof_hash_ledger exists');
select has_function('public', 'bc_consume_action_quota', array['uuid', 'text', 'uuid'], 'quota engine exists');
select has_function('public', 'bc_blocked_between', array['uuid', 'uuid'], 'block helper exists');
select has_function('public', 'bc_prune_action_usage', 'prune fn exists');
select has_trigger('public', 'bc_comments', 'bc_comments_integrity_gate', 'comment gate wired');
select has_trigger('public', 'social_follows', 'bc_social_follows_gate', 'follow gate wired');
select has_trigger('public', 'bc_flags', 'bc_flags_action_quota', 'flag quota wired');

-- ── Fixtures ─────────────────────────────────────────────────────────

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'if-author@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'if-voter@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000203', 'authenticated', 'authenticated', 'if-voter-two@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (id, user_id, handle, display_name) values
  ('10000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201', 'ifauthor201', 'IF Author'),
  ('10000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202', 'ifvoter202', 'IF Voter'),
  ('10000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000203', 'ifvoter203', 'IF Voter Two')
on conflict (id) do nothing;

insert into bc_dishes (id, name, slug, category, cuisine, status) values
  ('20000000-0000-0000-0000-000000000201', 'Integrity Dish', 'integrity-dish', 'main', 'Test', 'active')
on conflict (id) do nothing;

insert into bc_recipe_snapshots (id, profile_id, title, ingredients_json, steps_json) values
  ('30000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000201', 'Integrity Recipe One', '[]'::jsonb, '[]'::jsonb),
  ('30000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000201', 'Integrity Recipe Two', '[]'::jsonb, '[]'::jsonb)
on conflict (id) do nothing;

insert into bc_submissions (id, dish_id, recipe_snapshot_id, profile_id, moderation_status) values
  ('40000000-0000-0000-0000-000000000201', '20000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000201', 'approved'),
  ('40000000-0000-0000-0000-000000000202', '20000000-0000-0000-0000-000000000201', '30000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000201', 'approved')
on conflict (id) do nothing;

insert into bc_media_assets (
  id, owner_profile_id, owner_kind, owner_id, media_kind,
  storage_bucket, storage_key, content_hash, byte_size,
  upload_status, moderation_status, visibility
) values
  -- A1: voter202's first proof (hash ihash-1) on S1: accepted.
  ('50000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000202', 'vote_proof', '40000000-0000-0000-0000-000000000201', 'image', 'bc-media', 'proofs/if-a1.jpg', 'ihash-1', 1000, 'uploaded', 'pending', 'private'),
  -- A2: voter202 re-uses ihash-1 through a NEW asset on a DIFFERENT submission: global dedup must reject.
  ('50000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000202', 'vote_proof', '40000000-0000-0000-0000-000000000202', 'image', 'bc-media', 'proofs/if-a2.jpg', 'ihash-1', 1000, 'uploaded', 'pending', 'private'),
  -- A3: voter203 uses the SAME photo hash (cross-user ring): allowed but flagged.
  ('50000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-000000000203', 'vote_proof', '40000000-0000-0000-0000-000000000202', 'image', 'bc-media', 'proofs/if-a3.jpg', 'ihash-1', 1000, 'uploaded', 'pending', 'private'),
  -- A4: voter202's fresh hash for the recast-cooldown attempt on S1.
  ('50000000-0000-0000-0000-000000000204', '10000000-0000-0000-0000-000000000202', 'vote_proof', '40000000-0000-0000-0000-000000000201', 'image', 'bc-media', 'proofs/if-a4.jpg', 'ihash-2', 1000, 'uploaded', 'pending', 'private'),
  -- A5: voter203's fresh hash for the rate-limit test on S1.
  ('50000000-0000-0000-0000-000000000205', '10000000-0000-0000-0000-000000000203', 'vote_proof', '40000000-0000-0000-0000-000000000201', 'image', 'bc-media', 'proofs/if-a5.jpg', 'ihash-3', 1000, 'uploaded', 'pending', 'private')
on conflict (id) do nothing;

-- ── Global per-user proof-hash dedup (N3) ────────────────────────────

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}', true);

select is(
  (select vote_id is not null and error_code is null
     from bc_cast_vote('40000000-0000-0000-0000-000000000201', 'gold', '50000000-0000-0000-0000-000000000201')),
  true,
  'first vote with a fresh hash is accepted'
);

select ok(
  exists (
    select 1 from bc_proof_hash_ledger
    where profile_id = '10000000-0000-0000-0000-000000000202' and content_hash = 'ihash-1'
  ),
  'accepted proof hash lands in the per-user global ledger'
);

select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000202', 'gold', '50000000-0000-0000-0000-000000000202')),
  'proof_duplicate'::text,
  'same user re-using the same photo hash on a DIFFERENT submission is rejected (global dedup)'
);

select is(
  (select count(*)::int from bc_votes
    where voter_profile_id = '10000000-0000-0000-0000-000000000202'
      and submission_id = '40000000-0000-0000-0000-000000000202'),
  0,
  'rejected duplicate leaves no vote row behind'
);

-- ── Cross-user hash reuse is allowed but flagged (N3) ────────────────

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000203","role":"authenticated"}', true);

select is(
  (select vote_id is not null and error_code is null
     from bc_cast_vote('40000000-0000-0000-0000-000000000202', 'silver', '50000000-0000-0000-0000-000000000203')),
  true,
  'a different user re-using the same photo hash is accepted (needs human review, not a hard block)'
);

select ok(
  exists (
    select 1
    from bc_moderation_queue q
    join bc_vote_proofs p on p.id = q.target_id and q.kind = 'vote_proof'
    where p.profile_id = '10000000-0000-0000-0000-000000000203'
      and p.content_hash = 'ihash-1'
      and (q.metadata ->> 'cross_user_hash_reuse')::boolean = true
  ),
  'cross-user hash reuse flags the moderation-queue row'
);

-- ── Vote delete: hash stays spent, cooldown stamps, throttle (N3) ────

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}', true);

select lives_ok(
  $$select bc_delete_vote('40000000-0000-0000-0000-000000000201')$$,
  'a user can delete their own vote'
);

select ok(
  not exists (
    select 1 from bc_votes
    where voter_profile_id = '10000000-0000-0000-0000-000000000202'
      and submission_id = '40000000-0000-0000-0000-000000000201'
  ),
  'the vote row is gone after deletion'
);

select ok(
  exists (
    select 1 from bc_proof_hash_ledger
    where profile_id = '10000000-0000-0000-0000-000000000202' and content_hash = 'ihash-1'
  ),
  'deleting the vote does NOT free the proof hash'
);

select ok(
  exists (
    select 1 from bc_action_usage
    where profile_id = '10000000-0000-0000-0000-000000000202'
      and action = 'vote_delete'
      and context = '40000000-0000-0000-0000-000000000201'
  ),
  'vote deletion stamps the durable action ledger with the submission context'
);

select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000201', 'gold', '50000000-0000-0000-0000-000000000204')),
  'recast_cooldown'::text,
  're-voting the same submission within 24h of deleting is rejected'
);

-- Throttle: with the daily cap lowered to the 1 delete already spent, the next
-- delete attempt raises before touching any vote.
update bc_action_limits set max_count = 1 where action = 'vote_delete';

select throws_ok(
  $$select bc_delete_vote('40000000-0000-0000-0000-000000000202')$$,
  'P0001',
  'vote_delete_rate_limited',
  'vote deletion hits the durable daily throttle'
);

update bc_action_limits set max_count = 5 where action = 'vote_delete';

-- ── Durable vote rate limit ──────────────────────────────────────────

update bc_action_limits set max_count = 0 where action = 'vote';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000203","role":"authenticated"}', true);

select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000201', 'gold', '50000000-0000-0000-0000-000000000205')),
  'rate_limited'::text,
  'votes hit the durable rate limit'
);

update bc_action_limits set max_count = 25 where action = 'vote';

-- ── Comment gate: quota, kill switch ─────────────────────────────────

select lives_ok(
  $$insert into bc_comments (submission_id, profile_id, body)
    values ('40000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000203', 'Looks delicious')$$,
  'a normal comment insert passes the integrity gate'
);

update bc_action_limits set max_count = 0 where action = 'comment';

select throws_ok(
  $$insert into bc_comments (submission_id, profile_id, body)
    values ('40000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000203', 'Spam spam')$$,
  'P0001',
  'rate_limited',
  'comments hit the durable rate limit'
);

update bc_action_limits set max_count = 20 where action = 'comment';

update bc_action_controls set kill_switch = true where id = true;

select throws_ok(
  $$insert into bc_comments (submission_id, profile_id, body)
    values ('40000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000203', 'Frozen out')$$,
  'P0001',
  'rate_limited',
  'the kill switch freezes rate-limited social writes'
);

update bc_action_controls set kill_switch = false where id = true;

-- ── Report quota trigger ─────────────────────────────────────────────

update bc_action_limits set max_count = 0 where action = 'report';

select throws_ok(
  $$insert into bc_flags (target_type, target_id, flagger_id, reason)
    values ('submission', '40000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000203', 'spam')$$,
  'P0001',
  'rate_limited',
  'reports hit the durable rate limit'
);

update bc_action_limits set max_count = 20 where action = 'report';

-- ── Server-side block enforcement (N13) ──────────────────────────────

insert into bc_blocks (blocker_id, blocked_id) values
  ('10000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000202');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}', true);

select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000201', 'gold', '50000000-0000-0000-0000-000000000204')),
  'submission_not_found'::text,
  'a blocked user cannot vote on the blocker''s submission (and cannot tell a block from a missing submission)'
);

select is(
  bc_submission_visible('40000000-0000-0000-0000-000000000201'),
  false,
  'the blocker''s submission is invisible to the blocked user server-side'
);

select throws_ok(
  $$insert into bc_comments (submission_id, profile_id, body)
    values ('40000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000202', 'Hi again')$$,
  'P0001',
  'submission_not_found',
  'a blocked user cannot comment on the blocker''s submission'
);

select throws_ok(
  $$insert into social_follows (follower_id, followee_id)
    values ('10000000-0000-0000-0000-000000000202', '10000000-0000-0000-0000-000000000201')$$,
  'P0001',
  'blocked',
  'a blocked user cannot follow across the block'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000203', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000203","role":"authenticated"}', true);

select lives_ok(
  $$insert into social_follows (follower_id, followee_id)
    values ('10000000-0000-0000-0000-000000000203', '10000000-0000-0000-0000-000000000201')$$,
  'an unblocked user can still follow'
);

-- Anonymous viewers see approved content unchanged.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}'::text, true);

select is(
  bc_submission_visible('40000000-0000-0000-0000-000000000201'),
  true,
  'anonymous viewers still see approved submissions'
);

select * from finish();

rollback;
