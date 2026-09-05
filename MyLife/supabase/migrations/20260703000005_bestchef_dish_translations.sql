-- BestChef dish translation layer (plan 33 Phase 2.3).
--
-- Dishes stay canonical in bc_dishes (name/native_name); per-locale display
-- names and descriptions live in bc_dish_translations with locale fallback
-- to the canonical row. Locale-tagged bc_dish_aliases become the
-- per-language search layer. The editorial write path is the moderator
-- console (service role); community proposals are a later phase, which is
-- why the status column exists from day one.
--
-- bc_search_dishes replaces the client-side PostgREST `.or(ilike)` search:
-- it is fully parameterized (the old path interpolated user text into the
-- filter string) and matches canonical fields, approved translations for
-- the requested locale (exact tag first, then base language), and aliases
-- (untagged aliases match every locale; tagged aliases only their own).

create table if not exists public.bc_dish_translations (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references public.bc_dishes(id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'editorial'
    check (source in ('editorial', 'community')),
  -- Console editorial attribution (moderator email); RPCs run as service
  -- role so actor identity must ride the row itself.
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bc_dish_translations_unique unique (dish_id, locale),
  -- Lowercase-only storage so exact-match lookups never miss on case
  -- ('pt-br', never 'pt-BR'); writers normalize before insert.
  constraint bc_dish_translations_locale_shape
    check (locale ~ '^[a-z]{2}(-[a-z0-9]{2,8})?$'),
  constraint bc_dish_translations_name_length
    check (char_length(name) between 1 and 200),
  constraint bc_dish_translations_description_length
    check (description is null or char_length(description) <= 2000)
);

create index if not exists bc_dish_translations_dish_idx
  on public.bc_dish_translations (dish_id);
create index if not exists bc_dish_translations_locale_idx
  on public.bc_dish_translations (locale) where status = 'approved';
-- Search matching is leading-wildcard ilike through the lateral join, so a
-- btree on lower(name) is unusable; pg_trgm gin indexes are the scale plan
-- once the catalog grows (plan 33 Phase 4 note).

alter table public.bc_dish_translations enable row level security;

drop policy if exists "bc_dish_translations_read" on public.bc_dish_translations;
create policy "bc_dish_translations_read" on public.bc_dish_translations for select
  using (status = 'approved' or bc_is_admin());

drop policy if exists "bc_dish_translations_write" on public.bc_dish_translations;
create policy "bc_dish_translations_write" on public.bc_dish_translations for all
  using (bc_is_admin()) with check (bc_is_admin());

-- ── Locale-aware dish search ──────────────────────────────────────────

create or replace function public.bc_search_dishes(
  p_query text default '',
  p_locale text default null,
  p_category text default null,
  p_cuisine text default null,
  p_status text default 'active',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  dish public.bc_dishes,
  localized_name text,
  localized_description text
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_query text := trim(coalesce(p_query, ''));
  v_pattern text;
  v_locale text := nullif(lower(trim(coalesce(p_locale, ''))), '');
  v_base_locale text;
  -- 500 cap: the catalog surfaces load up to 200 dishes in one call; the
  -- cap exists only as an abuse ceiling, never to silently truncate them.
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 500);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  -- LIKE-escape the user query: %, _ and \ must match literally.
  v_pattern := '%' || replace(replace(replace(v_query,
    '\', '\\'),
    '%', '\%'),
    '_', '\_') || '%';
  v_base_locale := case when v_locale is null then null else split_part(v_locale, '-', 1) end;

  return query
  select
    d,
    t.name,
    t.description
  from public.bc_dishes d
  left join lateral (
    -- Exact tag or the BARE base language only ('pt-br' falls back to 'pt',
    -- never to sibling 'pt-pt'; 'zh-hans' must never be served 'zh-hant').
    -- At most two rows can match (unique dish_id+locale), so exact-first
    -- ordering is fully deterministic.
    select tr.name, tr.description
    from public.bc_dish_translations tr
    where tr.dish_id = d.id
      and tr.status = 'approved'
      and v_locale is not null
      and lower(tr.locale) in (v_locale, v_base_locale)
    order by (lower(tr.locale) = v_locale) desc
    limit 1
  ) t on true
  where (p_status is null or d.status = p_status)
    and (p_category is null or d.category = p_category)
    and (p_cuisine is null or d.cuisine = p_cuisine)
    and (
      v_query = ''
      or d.name ilike v_pattern
      or d.native_name ilike v_pattern
      or d.description ilike v_pattern
      or (t.name is not null and t.name ilike v_pattern)
      or (t.description is not null and t.description ilike v_pattern)
      or exists (
        -- Untagged aliases match every locale; tagged aliases match ONLY
        -- their exact locale or their bare base language. With no caller
        -- locale (canonical/English surface) tagged aliases never match.
        select 1
        from public.bc_dish_aliases a
        where a.dish_id = d.id
          and (
            a.locale is null
            or (v_locale is not null and lower(a.locale) in (v_locale, v_base_locale))
          )
          and a.alias ilike v_pattern
      )
    )
  order by d.submission_count desc, d.name asc
  limit v_limit
  offset v_offset;
end;
$$;

comment on function public.bc_search_dishes(text, text, text, text, text, integer, integer) is
  'Locale-aware, injection-safe dish search: canonical fields + approved '
  'translations (exact locale tag first, then base language) + aliases '
  '(untagged aliases match every locale; tagged ones only their own). '
  'localized_name/localized_description are null when no approved '
  'translation exists for the requested locale (clients fall back to the '
  'canonical name).';

grant execute on function public.bc_search_dishes(text, text, text, text, text, integer, integer)
  to anon, authenticated, service_role;
