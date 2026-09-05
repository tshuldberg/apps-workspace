-- Cloud bookmarks (plan 33 Phase 5.6, F-010). Rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public', 'bc_saved_submissions', 'saved submissions table exists');
select col_is_unique('public', 'bc_saved_submissions', array['profile_id', 'submission_id'], 'one save per profile per submission');

-- ── Fixtures: two users, one approved submission ─────────────────────

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000601', 'authenticated', 'authenticated', 'saver@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000602', 'authenticated', 'authenticated', 'other-saver@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (id, user_id, handle, display_name) values
  ('10000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000601', 'saver601', 'Saver'),
  ('10000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000602', 'saver602', 'Other Saver')
on conflict (id) do nothing;

insert into bc_dishes (id, name, slug, category, cuisine, status) values
  ('70000000-0000-0000-0000-000000000601', 'Saved Dish', 'saved-dish-t601', 'main', 'test', 'active')
on conflict (id) do nothing;

insert into bc_recipe_snapshots (id, profile_id, title, ingredients_json, steps_json) values
  ('80000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000602', 'Saved Recipe', '[]', '[]');

insert into bc_submissions (id, dish_id, recipe_snapshot_id, profile_id, moderation_status) values
  ('90000000-0000-0000-0000-000000000601', '70000000-0000-0000-0000-000000000601', '80000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000602', 'approved');

-- ── Owner can save and read back ─────────────────────────────────────

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into bc_saved_submissions (submission_id, profile_id)
    values ('90000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601')$$,
  'owner saves a visible submission'
);

select is(
  (select count(*)::int from bc_saved_submissions where profile_id = '10000000-0000-0000-0000-000000000601'),
  1,
  'owner reads own save'
);

select throws_ok(
  $$insert into bc_saved_submissions (submission_id, profile_id)
    values ('90000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000601')$$,
  '23505',
  null,
  'duplicate save rejected by unique constraint'
);

-- Cannot save on behalf of another profile.
select throws_ok(
  $$insert into bc_saved_submissions (submission_id, profile_id)
    values ('90000000-0000-0000-0000-000000000601', '10000000-0000-0000-0000-000000000602')$$,
  '42501',
  null,
  'cannot save as someone else'
);

-- ── Privacy: another user cannot see the save ───────────────────────

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000602', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000602","role":"authenticated"}', true);

select is(
  (select count(*)::int from bc_saved_submissions where submission_id = '90000000-0000-0000-0000-000000000601'),
  0,
  'saves are private: other users see nothing'
);

-- Other user cannot delete the owner's save (RLS filters the row).
select lives_ok(
  $$delete from bc_saved_submissions
    where profile_id = '10000000-0000-0000-0000-000000000601'$$,
  'foreign delete is silently filtered'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000601', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000601","role":"authenticated"}', true);

select is(
  (select count(*)::int from bc_saved_submissions where profile_id = '10000000-0000-0000-0000-000000000601'),
  1,
  'save survives foreign delete attempt'
);

-- ── Owner unsave ─────────────────────────────────────────────────────

select lives_ok(
  $$delete from bc_saved_submissions
    where profile_id = '10000000-0000-0000-0000-000000000601'
      and submission_id = '90000000-0000-0000-0000-000000000601'$$,
  'owner unsaves'
);

select is(
  (select count(*)::int from bc_saved_submissions where profile_id = '10000000-0000-0000-0000-000000000601'),
  0,
  'save removed'
);

-- ── Quota wiring ─────────────────────────────────────────────────────

reset role;

select is(
  (select max_count from bc_action_limits where action = 'save'),
  200,
  'save action limit seeded'
);

select is(
  (select count(*)::int from information_schema.triggers
   where event_object_table = 'bc_saved_submissions'
     and trigger_name = 'bc_saved_submissions_action_quota'),
  1,
  'quota trigger installed'
);

-- DSAR manifest includes the saves table (GDPR inventory completeness).
select ok(
  (select prosrc like '%bc_saved_submissions.profile_id%'
   from pg_proc where proname = 'bc_profile_owned_row_counts'),
  'row-count manifest covers bc_saved_submissions'
);

select * from finish();

rollback;
