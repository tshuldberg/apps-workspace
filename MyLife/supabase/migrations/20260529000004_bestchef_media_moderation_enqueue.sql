-- Hybrid media moderation (item 3 / TS-03): "media pending, text instant".
--
-- Post/comment TEXT keeps publishing immediately (bc_submissions/bc_comments default
-- moderation_status='approved'), but their MEDIA (photos/videos) is pending by default
-- (bc_media_assets default 'pending') and is now auto-enqueued for screening so the
-- primary UGC media types are no longer left entirely unmoderated until a user reports.
--
-- A media-screening worker (extends moderate_vote_proof; needs provider creds + deploy)
-- drains bc_moderation_queue rows of kind='media_asset', runs the NSFW/food/CSAM
-- classifiers, and calls bc_apply_moderation_decision. Approved media is then served;
-- until approval the object stays private (vote proofs) or unpromoted.

create or replace function bc_enqueue_media_for_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only screen image/video media on the public UGC surfaces. Vote proofs are enqueued
  -- separately by bc_cast_vote; product_* media has its own contribution-moderation path;
  -- dish/recipe_snapshot media is editorial.
  if new.media_kind in ('image', 'video')
     and new.owner_kind in ('submission', 'comment', 'post')
     and new.moderation_status = 'pending' then
    insert into public.bc_moderation_queue (kind, target_id, profile_id, status, metadata)
    values (
      'media_asset',
      new.id,
      new.owner_profile_id,
      'queued',
      jsonb_build_object(
        'owner_kind', new.owner_kind,
        'owner_id', new.owner_id,
        'media_kind', new.media_kind
      )
    )
    on conflict (kind, target_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists bc_media_assets_enqueue_moderation on public.bc_media_assets;
create trigger bc_media_assets_enqueue_moderation
  after insert on public.bc_media_assets
  for each row
  execute function bc_enqueue_media_for_moderation();
