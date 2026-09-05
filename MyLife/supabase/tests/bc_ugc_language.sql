-- UGC language tagging (plan 33 Phase 2.5). Rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(8);

select has_column('public', 'bc_submissions', 'language', 'submissions carry language');
select has_column('public', 'bc_recipe_snapshots', 'language', 'snapshots carry language');
select has_column('public', 'bc_comments', 'language', 'comments carry language');

-- ── Fixtures ─────────────────────────────────────────────────────────

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000501', 'authenticated', 'authenticated', 'lang-user@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (id, user_id, handle, display_name) values
  ('10000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000501', 'languser501', 'Lang User')
on conflict (id) do nothing;

insert into bc_dishes (id, name, slug, category, cuisine, status) values
  ('70000000-0000-0000-0000-000000000501', 'Lang Dish', 'lang-dish-t501', 'main', 'test', 'active')
on conflict (id) do nothing;

insert into bc_recipe_snapshots (id, profile_id, title, ingredients_json, steps_json, language) values
  ('80000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000501', 'Lang Recipe', '[]', '[]', 'pt-br');

insert into bc_submissions (id, dish_id, recipe_snapshot_id, profile_id, language) values
  ('90000000-0000-0000-0000-000000000501', '70000000-0000-0000-0000-000000000501', '80000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000501', 'pt-br');

select is(
  (select language from bc_submissions where id = '90000000-0000-0000-0000-000000000501'),
  'pt-br',
  'submission language persists'
);

select throws_ok(
  $q$update bc_submissions set language = 'PT-BR'
     where id = '90000000-0000-0000-0000-000000000501'$q$,
  '23514',
  null,
  'uppercase language tags are rejected (lowercase-only storage)'
);

select throws_ok(
  $q$insert into bc_comments (submission_id, profile_id, body, language)
     values ('90000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000501', 'hi', 'not a locale')$q$,
  '23514',
  null,
  'junk comment language tags are rejected'
);

-- ── Queue language stamp trigger ─────────────────────────────────────

insert into bc_moderation_queue (kind, target_id, profile_id, status, metadata)
values (
  'vote_proof',
  '95000000-0000-0000-0000-000000000501',
  '10000000-0000-0000-0000-000000000501',
  'queued',
  jsonb_build_object('submission_id', '90000000-0000-0000-0000-000000000501')
);

select is(
  (select metadata ->> 'language' from bc_moderation_queue
   where kind = 'vote_proof' and target_id = '95000000-0000-0000-0000-000000000501'),
  'pt-br',
  'vote-proof queue rows inherit the submission language (console filter activates)'
);

insert into bc_moderation_queue (kind, target_id, profile_id, status, metadata)
values (
  'comment',
  '95000000-0000-0000-0000-000000000502',
  '10000000-0000-0000-0000-000000000501',
  'queued',
  jsonb_build_object('submission_id', '90000000-0000-0000-0000-000000000501')
);

select is(
  (select metadata ->> 'language' from bc_moderation_queue
   where kind = 'comment' and target_id = '95000000-0000-0000-0000-000000000502'),
  null,
  'non-vote-proof queue rows are left untouched by the stamp trigger'
);

select * from finish();

rollback;
