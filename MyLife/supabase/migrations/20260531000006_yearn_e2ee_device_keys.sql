-- Yearn LOOP-03 client E2EE device key registry.
-- Stores only public device keys so clients can encrypt intro notes before a
-- like is sent. Private key material stays in device secure storage.

do $$
begin
  if to_regclass('yearn.profiles') is null
    or to_regprocedure('yearn.is_blocked(uuid,uuid)') is null
  then
    raise notice 'Yearn profiles/functions are incomplete; skipping E2EE device key migration.';
  else
    create table if not exists yearn.e2ee_devices (
      user_id uuid not null references auth.users(id) on delete cascade,
      device_id text not null,
      public_key text not null,
      key_algorithm text not null default 'curve25519-xsalsa20poly1305'
        check (key_algorithm = 'curve25519-xsalsa20poly1305'),
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now(),
      primary key (user_id, device_id),
      check (length(btrim(device_id)) > 0),
      check (length(btrim(public_key)) > 0)
    );

    create index if not exists e2ee_devices_lookup_idx
      on yearn.e2ee_devices (user_id, is_active, last_seen_at desc);

    alter table yearn.e2ee_devices enable row level security;

    drop policy if exists "e2ee_devices select own or visible profiles" on yearn.e2ee_devices;
    create policy "e2ee_devices select own or visible profiles"
    on yearn.e2ee_devices for select
    to authenticated
    using (
      user_id = auth.uid()
      or (
        is_active = true
        and exists (
          select 1
          from yearn.profiles p
          where p.id = user_id
            and p.is_paused = false
            and not yearn.is_blocked(auth.uid(), p.id)
        )
      )
    );

    drop policy if exists "e2ee_devices insert own" on yearn.e2ee_devices;
    create policy "e2ee_devices insert own"
    on yearn.e2ee_devices for insert
    to authenticated
    with check (user_id = auth.uid());

    drop policy if exists "e2ee_devices update own" on yearn.e2ee_devices;
    create policy "e2ee_devices update own"
    on yearn.e2ee_devices for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

    revoke all on yearn.e2ee_devices from public, anon;
    grant select, insert, update on yearn.e2ee_devices to authenticated;

    execute $fn$
      create or replace function yearn.intro_recipient_device_key(p_profile_id uuid)
      returns table (
        user_id uuid,
        device_id text,
        public_key text,
        key_algorithm text,
        created_at timestamptz,
        last_seen_at timestamptz
      )
      language sql
      stable
      security definer
      set search_path = yearn, public
      as $body$
        select
          d.user_id,
          d.device_id,
          d.public_key,
          d.key_algorithm,
          d.created_at,
          d.last_seen_at
        from yearn.e2ee_devices d
        join yearn.profiles p on p.id = d.user_id
        where auth.uid() is not null
          and d.user_id = p_profile_id
          and d.user_id <> auth.uid()
          and d.is_active = true
          and p.is_paused = false
          and not yearn.is_blocked(auth.uid(), d.user_id)
        order by d.last_seen_at desc, d.created_at desc, d.device_id asc
        limit 1;
      $body$;
    $fn$;

    revoke execute on function yearn.intro_recipient_device_key(uuid) from public, anon;
    grant execute on function yearn.intro_recipient_device_key(uuid) to authenticated;
  end if;
end $$;
