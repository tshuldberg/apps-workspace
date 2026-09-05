-- Moderation appeals (plan 33 Phase 1.7, DSA Art. 20). Rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

select has_table('public', 'bc_appeals', 'bc_appeals exists');
select has_function('public', 'bc_submit_appeal', array['uuid', 'text'], 'submit RPC exists');
select has_function('public', 'bc_resolve_appeal', array['uuid', 'text', 'text'], 'resolve RPC exists');

-- ── Fixtures ─────────────────────────────────────────────────────────

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  ('00000000-0000-0000-0000-000000000301', 'authenticated', 'authenticated', 'ap-user@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb),
  ('00000000-0000-0000-0000-000000000302', 'authenticated', 'authenticated', 'ap-other@example.test', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into social_profiles (id, user_id, handle, display_name) values
  ('10000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000301', 'apuser301', 'Appellant'),
  ('10000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000302', 'apother302', 'Bystander')
on conflict (id) do nothing;

insert into bc_moderation_decisions (id, kind, target_id, profile_id, decision, reason) values
  ('60000000-0000-0000-0000-000000000301', 'comment', gen_random_uuid(), '10000000-0000-0000-0000-000000000301', 'rejected', 'tos_violation'),
  ('60000000-0000-0000-0000-000000000302', 'comment', gen_random_uuid(), '10000000-0000-0000-0000-000000000301', 'rejected', 'spam')
on conflict (id) do nothing;

-- ── Submit ───────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{}'::text, true);

select is(
  (select error_code from bc_submit_appeal('60000000-0000-0000-0000-000000000301', 'I did not break the rules')),
  'unauthenticated'::text,
  'unauthenticated callers are rejected'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000302', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000302","role":"authenticated"}', true);

select is(
  (select error_code from bc_submit_appeal('60000000-0000-0000-0000-000000000301', 'not my decision')),
  'decision_not_found'::text,
  'only the affected user may appeal, and other decisions stay invisible'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000301', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000301","role":"authenticated"}', true);

select is(
  (select appeal_id is not null and error_code is null
     from bc_submit_appeal('60000000-0000-0000-0000-000000000301', 'This comment quoted the recipe, not spam.')),
  true,
  'the affected user can appeal a decision on their content'
);

select is(
  (select error_code from bc_submit_appeal('60000000-0000-0000-0000-000000000301', 'appealing again')),
  'already_appealed'::text,
  'one appeal per decision'
);

update bc_action_limits set max_count = 0 where action = 'appeal';

select is(
  (select error_code from bc_submit_appeal('60000000-0000-0000-0000-000000000302', 'second decision appeal')),
  'rate_limited'::text,
  'appeals hit the durable rate limit'
);

update bc_action_limits set max_count = 10 where action = 'appeal';

-- ── Resolve ──────────────────────────────────────────────────────────

select is(
  (select error_code from bc_resolve_appeal(
    (select id from bc_appeals where decision_id = '60000000-0000-0000-0000-000000000301'),
    'overturned', 'reinstating content')),
  'not_authorized'::text,
  'regular users cannot resolve appeals'
);

select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select is(
  (select status from bc_resolve_appeal(
    (select id from bc_appeals where decision_id = '60000000-0000-0000-0000-000000000301'),
    'overturned', 'reinstating content')),
  'overturned'::text,
  'service role resolves an open appeal with a statement of reasons'
);

select is(
  (select error_code from bc_resolve_appeal(
    (select id from bc_appeals where decision_id = '60000000-0000-0000-0000-000000000301'),
    'upheld', 'double resolve')),
  'appeal_not_found'::text,
  'a resolved appeal cannot be resolved again'
);

select is(
  (select resolution_reason from bc_appeals where decision_id = '60000000-0000-0000-0000-000000000301'),
  'reinstating content'::text,
  'the resolution reason is recorded'
);

select * from finish();

rollback;
