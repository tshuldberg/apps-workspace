begin;

create extension if not exists pgtap with schema extensions;

select plan(44);

select has_table('public', 'bc_vote_proofs', 'bc_vote_proofs exists');
select has_table('public', 'bc_moderation_queue', 'bc_moderation_queue exists');
select has_table('public', 'bc_moderation_decisions', 'bc_moderation_decisions exists');
select has_function('public', 'bc_cast_vote', array['uuid', 'text', 'uuid'], 'bc_cast_vote v2 exists');
select has_function('public', 'bc_delete_vote', array['uuid'], 'bc_delete_vote exists');
select has_function('public', 'bc_apply_vote_proof_decision', array['uuid', 'text', 'text'], 'vote proof moderation decision RPC exists');
select has_column('public', 'bc_votes', 'status', 'bc_votes has status');

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'author@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'voter@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'voter-two@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (
  id,
  user_id,
  handle,
  display_name
) values
  ('10000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000101', 'author101', 'Author'),
  ('10000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000102', 'voter102', 'Voter'),
  ('10000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000103', 'voter103', 'Voter Two')
on conflict (id) do nothing;

insert into bc_dishes (
  id,
  name,
  slug,
  category,
  cuisine,
  status
) values (
  '20000000-0000-0000-0000-000000000001',
  'Vote Proof Dish',
  'vote-proof-dish',
  'main',
  'Test',
  'active'
) on conflict (id) do nothing;

insert into bc_recipe_snapshots (
  id,
  profile_id,
  title,
  ingredients_json,
  steps_json
) values (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000101',
  'Vote Proof Recipe',
  '[]'::jsonb,
  '[]'::jsonb
) on conflict (id) do nothing;

insert into bc_submissions (
  id,
  dish_id,
  recipe_snapshot_id,
  profile_id,
  moderation_status
) values (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000101',
  'approved'
) on conflict (id) do nothing;

insert into bc_media_assets (
  id,
  owner_profile_id,
  owner_kind,
  owner_id,
  media_kind,
  storage_bucket,
  storage_key,
  content_hash,
  byte_size,
  upload_status,
  moderation_status,
  visibility
) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000102', 'vote_proof', '40000000-0000-0000-0000-000000000001', 'image', 'bc-media', 'proofs/voter-one.jpg', 'hash-one', 1000, 'uploaded', 'pending', 'private'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000101', 'vote_proof', '40000000-0000-0000-0000-000000000001', 'image', 'bc-media', 'proofs/author.jpg', 'hash-author', 1000, 'uploaded', 'pending', 'private'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000102', 'vote_proof', '40000000-0000-0000-0000-000000000001', 'video', 'bc-media', 'proofs/video.mp4', 'hash-video', 1000, 'uploaded', 'pending', 'private'),
  ('50000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000102', 'submission', '40000000-0000-0000-0000-000000000001', 'image', 'bc-media', 'proofs/submission-kind.jpg', 'hash-wrong-kind', 1000, 'uploaded', 'pending', 'private'),
  ('50000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000102', 'vote_proof', '40000000-0000-0000-0000-000000000001', 'image', 'bc-media', 'proofs/pending.jpg', 'hash-pending', 1000, 'pending', 'pending', 'private'),
  ('50000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000102', 'vote_proof', '40000000-0000-0000-0000-000000000001', 'image', 'bc-media', 'proofs/voter-one-again.jpg', 'hash-new', 1000, 'uploaded', 'pending', 'private'),
  ('50000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000103', 'vote_proof', '40000000-0000-0000-0000-000000000001', 'image', 'bc-media', 'proofs/duplicate.jpg', 'hash-one', 1000, 'uploaded', 'pending', 'private'),
  ('50000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000103', 'vote_proof', '40000000-0000-0000-0000-000000000001', 'image', 'bc-media', 'proofs/voter-two.jpg', 'hash-two', 1000, 'uploaded', 'pending', 'private')
on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}'::text, true);

select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'gold', '50000000-0000-0000-0000-000000000001')),
  'unauthenticated'::text,
  'bc_cast_vote rejects unauthenticated callers'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);

select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000009999', 'gold', '50000000-0000-0000-0000-000000000001')),
  'submission_not_found'::text,
  'bc_cast_vote rejects missing submissions'
);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'platinum', '50000000-0000-0000-0000-000000000001')),
  'invalid_tier'::text,
  'bc_cast_vote rejects invalid tiers'
);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'gold', '50000000-0000-0000-0000-000000009999')),
  'invalid_proof_asset'::text,
  'bc_cast_vote rejects missing proof assets'
);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'gold', '50000000-0000-0000-0000-000000000002')),
  'invalid_proof_asset'::text,
  'bc_cast_vote rejects proof assets owned by another profile'
);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'gold', '50000000-0000-0000-0000-000000000003')),
  'invalid_proof_asset'::text,
  'bc_cast_vote rejects non-image proof assets'
);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'gold', '50000000-0000-0000-0000-000000000004')),
  'invalid_proof_asset'::text,
  'bc_cast_vote rejects wrong owner_kind proof assets'
);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'gold', '50000000-0000-0000-0000-000000000005')),
  'invalid_proof_asset'::text,
  'bc_cast_vote rejects assets that are not uploaded'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000101', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}', true);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'gold', '50000000-0000-0000-0000-000000000002')),
  'cannot_vote_on_own'::text,
  'bc_cast_vote rejects self-votes'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);
create temp table vote_one as
select * from bc_cast_vote(
  '40000000-0000-0000-0000-000000000001',
  'gold',
  '50000000-0000-0000-0000-000000000001'
);

select ok((select error_code is null from vote_one), 'bc_cast_vote succeeds with a valid uploaded proof');
select is(
  (select status from bc_votes where id = (select vote_id from vote_one)),
  'proof_pending'::text,
  'successful vote starts proof_pending'
);
select is(
  (select status from bc_vote_proofs where id = (select proof_id from vote_one)),
  'pending'::text,
  'successful proof starts pending'
);
select is(
  (select status from bc_moderation_queue where target_id = (select proof_id from vote_one)),
  'queued'::text,
  'successful proof is queued for moderation'
);
select is(
  bc_weighted_wilson_score('40000000-0000-0000-0000-000000000001'),
  0::double precision,
  'pending proofs do not count toward score'
);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'silver', '50000000-0000-0000-0000-000000000006')),
  'vote_already_exists'::text,
  'bc_cast_vote rejects duplicate votes by the same profile'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated"}', true);
select is(
  (select error_code from bc_cast_vote('40000000-0000-0000-0000-000000000001', 'silver', '50000000-0000-0000-0000-000000000007')),
  'proof_duplicate'::text,
  'bc_cast_vote rejects duplicate proof hashes for the same submission'
);
select is(
  (select error_code from bc_apply_vote_proof_decision((select proof_id from vote_one), 'approved', null)),
  'not_authorized'::text,
  'moderation decision rejects non-admin callers'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  (select error_code from bc_apply_vote_proof_decision((select proof_id from vote_one), 'maybe', null)),
  'invalid_decision'::text,
  'moderation decision rejects invalid decisions'
);
create temp table approve_one as
select * from bc_apply_vote_proof_decision((select proof_id from vote_one), 'approved', null);

select ok((select error_code is null from approve_one), 'approval decision succeeds');
select is(
  (select status from bc_vote_proofs where id = (select proof_id from vote_one)),
  'approved'::text,
  'approval marks proof approved'
);
select is(
  (select status from bc_votes where id = (select vote_id from vote_one)),
  'active'::text,
  'approval activates vote'
);
select ok(
  bc_weighted_wilson_score('40000000-0000-0000-0000-000000000001') > 0,
  'approved proofs count toward score'
);
select results_eq(
  $$select upload_status, moderation_status, visibility from bc_media_assets where id = '50000000-0000-0000-0000-000000000001'$$,
  $$values ('ready'::text, 'approved'::text, 'public'::text)$$,
  'approval promotes proof media for public delivery'
);
select ok(
  (select previous_state ? 'proof_status' and new_state ? 'media_visibility'
   from bc_moderation_decisions
   where kind = 'vote_proof'
     and target_id = (select proof_id from vote_one)
   order by created_at desc
   limit 1),
  'approval audit records previous and new proof/media state'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000103', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated"}', true);
create temp table vote_two as
select * from bc_cast_vote(
  '40000000-0000-0000-0000-000000000001',
  'silver',
  '50000000-0000-0000-0000-000000000008'
);
select ok((select error_code is null from vote_two), 'second unique proof can be cast');

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
create temp table reject_two as
select * from bc_apply_vote_proof_decision((select proof_id from vote_two), 'rejected', 'not food');

select ok((select error_code is null from reject_two), 'rejection decision succeeds');
select is(
  (select status from bc_vote_proofs where id = (select proof_id from vote_two)),
  'rejected'::text,
  'rejection marks proof rejected'
);
select is(
  (select status from bc_votes where id = (select vote_id from vote_two)),
  'proof_rejected'::text,
  'rejection soft-disables vote'
);
select is(
  (select count(*)::integer from bc_votes where submission_id = '40000000-0000-0000-0000-000000000001' and status = 'active'),
  1,
  'only approved proofs count as active votes'
);
select is(
  (select new_state->>'vote_status'
   from bc_moderation_decisions
   where kind = 'vote_proof'
     and target_id = (select proof_id from vote_two)
   order by created_at desc
   limit 1),
  'proof_rejected'::text,
  'rejection audit records the disabled vote state'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000102', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}', true);
select bc_delete_vote('40000000-0000-0000-0000-000000000001');

select is(
  (select count(*)::integer from bc_vote_proofs where id = (select proof_id from vote_one)),
  0,
  'bc_delete_vote cascades the linked proof'
);
select results_eq(
  $$select upload_status, moderation_status, visibility, storage_bucket, storage_key, metadata->>'storage_purge'
    from bc_media_assets
    where id = '50000000-0000-0000-0000-000000000001'$$,
  $$values ('deleted'::text, 'rejected'::text, 'private'::text, 'bc-media'::text, 'proofs/voter-one.jpg'::text, 'pending_server_worker'::text)$$,
  'bc_delete_vote marks proof media private/deleted and preserves storage refs for server purge'
);
select is(
  bc_weighted_wilson_score('40000000-0000-0000-0000-000000000001'),
  0::double precision,
  'deleted and rejected votes do not count toward score'
);

select is(
  (select count(*)::integer
   from bc_media_assets
   where owner_profile_id = '10000000-0000-0000-0000-000000000103'
     and owner_kind = 'vote_proof'
     and storage_bucket is not null
     and storage_key is not null),
  2,
  'account deletion worker inventory includes owned vote proof media before auth deletion'
);

delete from auth.users where id = '00000000-0000-0000-0000-000000000103';

select is(
  (select count(*)::integer from bc_votes where voter_profile_id = '10000000-0000-0000-0000-000000000103'),
  0,
  'auth account deletion cascades linked vote rows'
);
select is(
  (select count(*)::integer from bc_vote_proofs where profile_id = '10000000-0000-0000-0000-000000000103'),
  0,
  'auth account deletion cascades linked vote proof rows'
);
select results_eq(
  $$select owner_profile_id, storage_bucket, storage_key
    from bc_media_assets
    where id = '50000000-0000-0000-0000-000000000008'$$,
  $$values (null::uuid, 'bc-media'::text, 'proofs/voter-two.jpg'::text)$$,
  'vote proof media row retains purge refs after profile cascade'
);

select * from finish();

rollback;
