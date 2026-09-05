-- Yearn push-notification device registry.
-- Apply after 0004_yearn_account_deletion.sql. Idempotent.
--
-- Client calls: rpc("register_device_token", params: {p_token, p_platform}).
-- Tokens are written through the SECURITY DEFINER RPC so the row's user_id is
-- always pinned to auth.uid(); direct INSERT is not exposed to clients.

-- =========================================
-- DEVICE TOKENS
-- One row per (user, token). updated_at refreshed on re-registration.
-- =========================================
create table if not exists yearn.device_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null default 'ios',
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index if not exists device_tokens_user_idx on yearn.device_tokens (user_id);

alter table yearn.device_tokens enable row level security;

-- Users may read and remove their own tokens. Inserts go through the RPC, so
-- no INSERT policy is granted to authenticated.
drop policy if exists "device_tokens select own" on yearn.device_tokens;
create policy "device_tokens select own"
on yearn.device_tokens for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "device_tokens delete own" on yearn.device_tokens;
create policy "device_tokens delete own"
on yearn.device_tokens for delete
to authenticated
using (user_id = auth.uid());

grant select, delete on yearn.device_tokens to authenticated;

-- =========================================
-- register_device_token(p_token, p_platform)
-- Upsert the caller's token. SECURITY DEFINER so it can write the row with
-- user_id pinned to auth.uid() regardless of the (deliberately absent) INSERT
-- policy.
-- =========================================
create or replace function yearn.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = yearn, public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'register_device_token: no authenticated user';
  end if;

  insert into yearn.device_tokens (user_id, token, platform, updated_at)
  values (v_uid, p_token, coalesce(p_platform, 'ios'), now())
  on conflict (user_id, token)
  do update set platform = excluded.platform,
                updated_at = now();
end;
$$;

revoke execute on function yearn.register_device_token(text, text) from public, anon;
grant execute on function yearn.register_device_token(text, text) to authenticated;
