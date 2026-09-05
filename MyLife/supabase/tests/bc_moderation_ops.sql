begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_function('public', 'bc_report_content', array['text', 'uuid', 'text', 'uuid'], 'content report RPC exists');
select has_function('public', 'bc_apply_moderation_decision', array['text', 'uuid', 'text', 'text', 'jsonb'], 'moderation decision RPC exists');
select has_column('public', 'bc_moderation_decisions', 'previous_state', 'moderation decisions capture previous state');
select has_column('public', 'bc_moderation_decisions', 'new_state', 'moderation decisions capture new state');

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
  ('00000000-0000-0000-0000-000000000201', 'authenticated', 'authenticated', 'moderation-author@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000202', 'authenticated', 'authenticated', 'moderation-reporter@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (
  id,
  user_id,
  handle,
  display_name
) values
  ('10000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000201', 'modauthor201', 'Moderation Author'),
  ('10000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000202', 'modreporter202', 'Moderation Reporter')
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
  'Moderation Dish',
  'moderation-dish',
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
  'Moderation Recipe',
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
) on conflict (id) do update set moderation_status = 'approved';

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000202', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000202","role":"authenticated"}', true);

create temp table report_one as
select * from bc_report_content(
  'submission',
  '40000000-0000-0000-0000-000000000201',
  'unsafe public content'
);

select ok((select error_code is null from report_one), 'authenticated reporter can submit a server report');
select is(
  (select target_type from bc_flags where id = (select flag_id from report_one)),
  'submission'::text,
  'server report creates a submission flag'
);
select results_eq(
  $$select kind, status, metadata->>'latest_reason'
    from bc_moderation_queue
    where id = (select queue_id from report_one)$$,
  $$values ('submission'::text, 'queued'::text, 'unsafe public content'::text)$$,
  'server report queues the target for moderator review'
);

select is(
  (select error_code from bc_apply_moderation_decision(
    'submission',
    '40000000-0000-0000-0000-000000000201',
    'hidden',
    'policy violation',
    '{}'::jsonb
  )),
  'not_authorized'::text,
  'non-admin callers cannot apply moderation decisions'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

create temp table hide_one as
select * from bc_apply_moderation_decision(
  'submission',
  '40000000-0000-0000-0000-000000000201',
  'hidden',
  'policy violation',
  '{"source":"pgtap"}'::jsonb
);

select ok((select error_code is null from hide_one), 'admin/service moderation decision succeeds');
select is(
  (select moderation_status from bc_submissions where id = '40000000-0000-0000-0000-000000000201'),
  'hidden'::text,
  'hide decision removes submission from public-approved state'
);
select is(
  (select previous_state->>'moderation_status' from hide_one),
  'approved'::text,
  'decision result includes previous public moderation state'
);
select is(
  (select new_state->>'moderation_status' from hide_one),
  'hidden'::text,
  'decision result includes new hidden moderation state'
);
select is(
  (select status from bc_flags where id = (select flag_id from report_one)),
  'actioned'::text,
  'hide decision actioned the source flag'
);
select is(
  (select status from bc_moderation_queue where id = (select queue_id from report_one)),
  'decided'::text,
  'hide decision closes the moderation queue item'
);

select * from finish();

rollback;
