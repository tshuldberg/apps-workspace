-- Dish translation layer + locale-aware search (plan 33 Phase 2.3). Rolls back.

begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public', 'bc_dish_translations', 'bc_dish_translations exists');
select has_function(
  'public', 'bc_search_dishes',
  array['text', 'text', 'text', 'text', 'text', 'integer', 'integer'],
  'locale-aware search RPC exists'
);

-- ── Fixtures ─────────────────────────────────────────────────────────

insert into bc_dishes (id, name, slug, category, cuisine, status, submission_count) values
  ('70000000-0000-0000-0000-000000000401', 'Carbonara', 'carbonara-t401', 'main', 'italian', 'active', 10),
  ('70000000-0000-0000-0000-000000000402', 'Sushi', 'sushi-t402', 'main', 'japanese', 'active', 5)
on conflict (id) do nothing;

insert into bc_dish_translations (dish_id, locale, name, description, status, updated_by) values
  ('70000000-0000-0000-0000-000000000401', 'de', 'Nudeln Carbonara', 'Roemisches Nudelgericht', 'approved', 'mod@test'),
  ('70000000-0000-0000-0000-000000000401', 'pt', 'Carbonara Portugues Base', null, 'approved', 'mod@test'),
  ('70000000-0000-0000-0000-000000000401', 'pt-br', 'Carbonara Brasileira', null, 'approved', 'mod@test'),
  ('70000000-0000-0000-0000-000000000402', 'de', 'Geheim Pending', null, 'pending', 'mod@test');

insert into bc_dish_aliases (dish_id, alias, locale) values
  ('70000000-0000-0000-0000-000000000402', 'sushi rolls', null),
  ('70000000-0000-0000-0000-000000000402', 'susi-de-alias', 'de');

-- ── Search: translation matching + localized fields ──────────────────

select is(
  (select (r.dish).id from bc_search_dishes('nudeln', 'de') r limit 1),
  '70000000-0000-0000-0000-000000000401'::uuid,
  'German query matches the de translation'
);

select is(
  (select r.localized_name from bc_search_dishes('carbonara', 'de') r
   where (r.dish).id = '70000000-0000-0000-0000-000000000401' limit 1),
  'Nudeln Carbonara',
  'localized_name resolves the approved de translation'
);

select is(
  (select count(*) from bc_search_dishes('nudeln', 'fr') r),
  0::bigint,
  'de translation does not match under an fr locale'
);

select is(
  (select r.localized_name from bc_search_dishes('carbonara', 'fr') r
   where (r.dish).id = '70000000-0000-0000-0000-000000000401' limit 1),
  null,
  'no fr translation -> localized_name null (client falls back to canonical)'
);

select is(
  (select r.localized_name from bc_search_dishes('carbonara', 'pt-br') r
   where (r.dish).id = '70000000-0000-0000-0000-000000000401' limit 1),
  'Carbonara Brasileira',
  'exact locale tag beats the base-language translation'
);

select is(
  (select r.localized_name from bc_search_dishes('carbonara', 'pt-pt') r
   where (r.dish).id = '70000000-0000-0000-0000-000000000401' limit 1),
  'Carbonara Portugues Base',
  'base-language translation is the fallback for sibling regions'
);

select is(
  (select count(*) from bc_search_dishes('geheim', 'de') r),
  0::bigint,
  'pending translations are not searchable'
);

-- ── Search: alias locale tagging ─────────────────────────────────────

select is(
  (select (r.dish).id from bc_search_dishes('susi-de-alias', 'de') r limit 1),
  '70000000-0000-0000-0000-000000000402'::uuid,
  'locale-tagged alias matches its own locale'
);

select is(
  (select count(*) from bc_search_dishes('susi-de-alias', 'ja') r),
  0::bigint,
  'locale-tagged alias does not match other locales'
);

select is(
  (select (r.dish).id from bc_search_dishes('sushi rolls', 'ja') r limit 1),
  '70000000-0000-0000-0000-000000000402'::uuid,
  'untagged alias matches every locale'
);

select is(
  (select count(*) from bc_search_dishes('susi-de-alias', null) r),
  0::bigint,
  'tagged aliases never match the canonical (no-locale) surface'
);

-- ── Search: limit clamp must not truncate the catalog ────────────────

insert into bc_dishes (name, slug, category, cuisine, status, submission_count)
select 'Bulk Dish ' || i, 'bulk-dish-t' || i, 'main', 'test', 'active', 0
from generate_series(1, 120) as i;

select is(
  (select count(*) from bc_search_dishes('', null, null, null, 'active', 500, 0)),
  (select count(*) from bc_dishes where status = 'active'),
  'a 200+-dish catalog is not silently truncated (cap is 500, an abuse ceiling)'
);

-- ── Search: injection safety ─────────────────────────────────────────

select lives_ok(
  $q$select * from bc_search_dishes('a,b%\_)(''', 'de')$q$,
  'metacharacter query cannot break the search'
);

select is(
  (select count(*) from bc_search_dishes('%', 'de') r),
  0::bigint,
  'bare % is escaped and matches literally, not everything'
);

-- ── RLS ──────────────────────────────────────────────────────────────

select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}'::text, true);
set local role anon;

select is(
  (select count(*) from bc_dish_translations
   where dish_id = '70000000-0000-0000-0000-000000000402'),
  0::bigint,
  'anon cannot read pending translations'
);

select throws_ok(
  $q$insert into bc_dish_translations (dish_id, locale, name)
     values ('70000000-0000-0000-0000-000000000401', 'fr', 'Hack')$q$,
  '42501',
  'new row violates row-level security policy for table "bc_dish_translations"',
  'anon cannot write translations (console/service-role only)'
);

reset role;

select * from finish();

rollback;
