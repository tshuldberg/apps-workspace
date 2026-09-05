-- Resolve Supabase lint error in BestChef ranking rebuilds.
-- The previous function selected s.* and also aliased row_number() as rank,
-- which became ambiguous once bc_submissions also exposed rank-like columns.

create or replace function public.bc_rebuild_rankings(p_dish_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.bc_is_admin() then
    raise exception 'Not authorized to rebuild BestChef rankings';
  end if;

  delete from public.bc_rankings
  where p_dish_id is null or dish_id = p_dish_id;

  insert into public.bc_rankings (dish_id, submission_id, score, rank, region, country_code, updated_at)
  select
    ranked.dish_id,
    ranked.submission_id,
    ranked.vote_score,
    ranked.computed_rank,
    null,
    ranked.country_code,
    now()
  from (
    select
      s.id as submission_id,
      s.dish_id,
      s.vote_score,
      s.country_code,
      row_number() over (
        partition by s.dish_id
        order by (s.photo_url is not null and length(s.photo_url) > 0) desc,
                 s.vote_score desc,
                 s.created_at asc
      ) as computed_rank
    from public.bc_submissions s
    where s.moderation_status = 'approved'
      and (p_dish_id is null or s.dish_id = p_dish_id)
  ) ranked;

  insert into public.bc_leaderboard_snapshots (dish_id, scope, ranking_json, content_version)
  select
    r.dish_id,
    'global',
    jsonb_agg(
      jsonb_build_object(
        'submission_id', r.submission_id,
        'score', r.score,
        'rank', r.rank,
        'country_code', r.country_code
      )
      order by r.rank
    ),
    coalesce((select max(version) from public.bc_content_events), 0)
  from public.bc_rankings r
  where p_dish_id is null or r.dish_id = p_dish_id
  group by r.dish_id;
end;
$$;
