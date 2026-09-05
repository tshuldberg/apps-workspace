-- BestChef vote-proof deletion media lifecycle.
-- User-owned vote deletion stays RPC-only for clients. The RPC removes the
-- vote/proof rows and marks linked proof media non-public for server cleanup.

create or replace function bc_delete_vote(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_media_asset_id uuid;
  v_deleted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select id
  into v_profile_id
  from social_profiles
  where user_id = v_user_id
  limit 1;

  if v_profile_id is null then
    raise exception 'profile_not_found';
  end if;

  select p.media_asset_id
  into v_media_asset_id
  from bc_votes v
  join bc_vote_proofs p on p.vote_id = v.id
  where v.submission_id = p_submission_id
    and v.voter_profile_id = v_profile_id
  limit 1;

  delete from bc_votes
  where submission_id = p_submission_id
    and voter_profile_id = v_profile_id;

  if v_media_asset_id is not null then
    update bc_media_assets
    set upload_status = 'deleted',
        moderation_status = 'rejected',
        visibility = 'private',
        metadata = metadata || jsonb_build_object(
          'deleted_by', 'bc_delete_vote',
          'deleted_at', v_deleted_at,
          'deletion_reason', 'user_deleted_vote',
          'storage_purge', 'pending_server_worker'
        ),
        updated_at = v_deleted_at
    where id = v_media_asset_id
      and owner_profile_id = v_profile_id
      and owner_kind = 'vote_proof';
  end if;
end;
$$;

grant execute on function bc_delete_vote(uuid) to authenticated;
