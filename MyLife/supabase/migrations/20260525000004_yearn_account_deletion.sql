-- Yearn account self-deletion (App Store 5.1.1(v) / GDPR right-to-erasure).
-- Apply after 0003_yearn_safety.sql. Idempotent.
--
-- Client calls: rpc("delete_my_account"). This permanently deletes the caller's
-- auth user, which cascades to yearn.profiles (FK on delete cascade) and from
-- there to likes / passes / matches / messages / blocks / reports / device_tokens.
-- Storage objects under the user's folder are removed explicitly first.

-- =========================================
-- delete_my_account()
-- SECURITY DEFINER: must run as a role privileged enough to delete from
-- auth.users and storage.objects. The owning role (postgres / supabase_admin,
-- whoever runs this migration) is used. auth.uid() resolves from the JWT of the
-- calling (authenticated) user, not the definer, so each user deletes only self.
-- =========================================
create or replace function yearn.delete_my_account()
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'delete_my_account: no authenticated user';
  end if;

  -- Remove the user's uploaded photos first (path layout: <uid>/<uuid>.<ext>).
  -- auth.uid() is captured in v_uid up front so it stays valid even though we
  -- delete the auth user later in this same call.
  delete from storage.objects
  where bucket_id = 'yearn-photos'
    and (storage.foldername(name))[1] = v_uid::text;

  -- Delete the auth user. ON DELETE CASCADE from yearn.profiles.id ->
  -- auth.users(id) tears down the profile, which cascades to every other
  -- yearn table that references auth.users / profiles.
  delete from auth.users where id = v_uid;
end;
$$;

revoke execute on function yearn.delete_my_account() from public, anon;
grant execute on function yearn.delete_my_account() to authenticated;
