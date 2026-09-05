-- P12-A (F-031, F-032, F-033, B-008): Comment threading, edit/delete, persisted helpful.
--
-- bc_comment_helpful and helpful_count + recount trigger already exist in the
-- baseline schema (schema.sql), so this migration only adds the threading +
-- author edit/delete columns and the bc_edit_comment RPC for the 24h window.
--
-- Idempotent: every column/trigger/policy uses IF NOT EXISTS or DROP/CREATE.

alter table public.bc_comments
  add column if not exists parent_id uuid references public.bc_comments(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists bc_comments_parent_idx
  on public.bc_comments (parent_id) where parent_id is not null;

-- 24h author edit window enforced server-side. The UI hides the action after
-- 24h but re-checks here in case clocks drift.
create or replace function bc_edit_comment(p_comment_id uuid, p_body text)
returns void language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_created timestamptz;
  v_author uuid;
begin
  select created_at, profile_id into v_created, v_author
    from public.bc_comments where id = p_comment_id;
  if v_author is null or v_author <> v_user then
    raise exception 'unauthorized';
  end if;
  if now() - v_created > interval '24 hours' then
    raise exception 'edit_window_expired';
  end if;
  update public.bc_comments
    set body = p_body, edited_at = now(), updated_at = now()
    where id = p_comment_id;
end;
$$;
