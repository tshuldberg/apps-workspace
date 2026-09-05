begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select has_table('public', 'bc_submission_likes', 'bc_submission_likes exists');
select has_column('public', 'bc_submissions', 'like_count', 'bc_submissions has like_count');
select has_function('public', 'bc_get_submission_like_state', array['uuid'], 'like state RPC exists');
select has_function('public', 'bc_set_submission_like', array['uuid', 'boolean'], 'set like RPC exists');

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
  ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'like-author@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'like-voter@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (
  id,
  user_id,
  handle,
  display_name
) values
  ('10000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201', 'like_author', 'Like Author'),
  ('10000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202', 'like_voter', 'Like Voter')
on conflict (id) do nothing;

insert into bc_dishes (
  id,
  name,
  slug,
  category,
  cuisine,
  status
) values (
  '20000000-0000-0000-0000-000000000201',
  'Submission Like Dish',
  'submission-like-dish',
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
  '30000000-0000-0000-0000-000000000201',
  '10000000-0000-0000-0000-000000000201',
  'Submission Like Recipe',
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
  '40000000-0000-0000-0000-000000000201',
  '20000000-0000-0000-0000-000000000201',
  '30000000-0000-0000-0000-000000000201',
  '10000000-0000-0000-0000-000000000201',
  'approved'
) on conflict (id) do nothing;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}', true);

select is(
  (select liked from bc_get_submission_like_state('40000000-0000-0000-0000-000000000201')),
  false,
  'initial state is unliked'
);
select is(
  (select like_count from bc_get_submission_like_state('40000000-0000-0000-0000-000000000201')),
  0,
  'initial cloud count is zero'
);

select is(
  (select liked from bc_set_submission_like('40000000-0000-0000-0000-000000000201', true)),
  true,
  'set like marks the caller liked'
);
select is(
  (select like_count from bc_set_submission_like('40000000-0000-0000-0000-000000000201', true)),
  1,
  'duplicate set like keeps one counted row'
);
select is(
  (select count(*)::integer from bc_submission_likes where submission_id = '40000000-0000-0000-0000-000000000201'),
  1,
  'one profile counts once per submission'
);
select is(
  (select like_count from bc_submissions where id = '40000000-0000-0000-0000-000000000201'),
  1,
  'submission like_count tracks cloud rows'
);

select is(
  (select liked from bc_set_submission_like('40000000-0000-0000-0000-000000000201', false)),
  false,
  'unlike clears caller state'
);
select is(
  (select like_count from bc_get_submission_like_state('40000000-0000-0000-0000-000000000201')),
  0,
  'unlike decrements cloud count'
);
select is(
  (select error_code from bc_set_submission_like('40000000-0000-0000-0000-000000009999', true)),
  'submission_not_found'::text,
  'missing submission returns a typed error'
);

select * from finish();

rollback;
