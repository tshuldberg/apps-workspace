-- Qualify the outer snapshot row so public approved submissions can expose recipe detail.
drop policy if exists "bc_recipe_snapshots_read" on public.bc_recipe_snapshots;
create policy "bc_recipe_snapshots_read" on public.bc_recipe_snapshots for select using (
  bc_profile_owned(profile_id)
  or exists (
    select 1
    from public.bc_submissions s
    where s.recipe_snapshot_id = public.bc_recipe_snapshots.id
      and s.moderation_status = 'approved'
  )
);
