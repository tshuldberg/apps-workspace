-- MyNews Plan 39 T11: DSA Art 17 statement-of-reasons read.
--
-- nw_moderation_actions (migration 20260705000007) is service-role-only: no
-- client (anon or authenticated) can read the audit trail. But the EU Digital
-- Services Act Art 17 requires that a user whose content was moderated can see
-- WHY. This function is the only sanctioned read path: it is SECURITY DEFINER
-- (runs as owner, bypassing the table's zero-policy RLS) but scopes every row
-- to content the passed-in user OWNS, so it can never leak another user's
-- statements of reasons. It is called by the mynews-my-notices edge function
-- under the service role, keyed on the caller's verified JWT subject.
--
-- Scope resolution, by target kind:
--   article / revision -> nw_articles.author_id -> nw_profiles.user_id
--   suggestion         -> nw_edit_suggestions.editor_id -> nw_profiles.user_id
--   profile            -> nw_profiles.id -> nw_profiles.user_id
-- 'dismiss' and 'restore' are not adverse actions against the user and are
-- excluded (a statement of reasons is for content that was removed/affected).
--
-- Append-only migration: no existing object is altered.

create or replace function public.nw_get_my_moderation_notices(p_user uuid)
returns table (
  target_kind text,
  target_id text,
  machine_reason text,
  note text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    ma.target_kind,
    ma.target_id,
    ma.action as machine_reason,
    ma.note,
    ma.created_at
  from public.nw_moderation_actions ma
  where ma.action not in ('dismiss', 'restore')
    and (
      -- Article / revision targets: the caller authors the article.
      (
        ma.target_kind in ('article', 'revision')
        and exists (
          select 1
          from public.nw_articles a
          join public.nw_profiles p on p.id = a.author_id
          where a.id::text = ma.target_id
            and p.user_id = p_user
        )
      )
      -- Suggestion targets: the caller is the editor who filed it.
      or (
        ma.target_kind = 'suggestion'
        and exists (
          select 1
          from public.nw_edit_suggestions s
          join public.nw_profiles p on p.id = s.editor_id
          where s.id::text = ma.target_id
            and p.user_id = p_user
        )
      )
      -- Profile targets (e.g. suspension): the caller is that profile.
      or (
        ma.target_kind = 'profile'
        and exists (
          select 1
          from public.nw_profiles p
          where p.id::text = ma.target_id
            and p.user_id = p_user
        )
      )
    )
  order by ma.created_at desc;
$$;

revoke all on function public.nw_get_my_moderation_notices(uuid) from public;
revoke all on function public.nw_get_my_moderation_notices(uuid) from anon, authenticated;
grant execute on function public.nw_get_my_moderation_notices(uuid) to service_role;
