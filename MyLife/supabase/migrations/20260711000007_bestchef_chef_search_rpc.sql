-- BestChef chef search hardening (audit H1).
--
-- searchChefs previously interpolated raw user input into a PostgREST
-- `.or(ilike)` filter string, e.g. `.or('handle.ilike.%foo%,display_name.ilike.%foo%')`.
-- Input containing `,`, `)`, or `(` can alter the filter structure (filter
-- injection), the same class of bug already fixed for dish search via
-- bc_search_dishes (see 20260703000005_bestchef_dish_translations.sql).
--
-- bc_search_chefs applies the identical pattern: fully parameterized,
-- LIKE-escaped matching, no security definer (runs as invoker so the
-- existing social_profiles RLS -- owned or discoverable -- still applies,
-- matching the visibility the old client-side query relied on).

create or replace function public.bc_search_chefs(
  p_query text default '',
  p_cuisine text default null,
  p_limit integer default 20
)
returns table (
  id uuid
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_pattern text;
  -- 200 cap: chef search surfaces a handful of results in one call; the
  -- cap exists only as an abuse ceiling, never to silently truncate them.
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 200);
begin
  -- LIKE-escape the user query: %, _ and \ must match literally.
  v_pattern := '%' || replace(replace(replace(v_query,
    '\', '\\'),
    '%', '\%'),
    '_', '\_') || '%';

  return query
  select p.id
  from public.social_profiles p
  where (
      v_query = ''
      or p.handle ilike v_pattern
      or p.display_name ilike v_pattern
    )
    and (
      p_cuisine is null
      or exists (
        select 1
        from public.bc_submissions s
        join public.bc_dishes d on d.id = s.dish_id
        where s.profile_id = p.id
          and d.cuisine = p_cuisine
      )
    )
  limit v_limit;
end;
$$;

comment on function public.bc_search_chefs(text, text, integer) is
  'Injection-safe chef search by handle/display_name with optional cuisine '
  'filter. Runs as invoker so the caller''s social_profiles RLS (owned or '
  'discoverable) still gates visibility.';

grant execute on function public.bc_search_chefs(text, text, integer)
  to anon, authenticated, service_role;
