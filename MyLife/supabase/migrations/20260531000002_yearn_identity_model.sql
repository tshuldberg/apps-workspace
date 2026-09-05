do $$
begin
  if to_regclass('yearn.profiles') is null then
    raise notice 'yearn.profiles does not exist; skipping Yearn identity model migration.';
  else
    alter table yearn.profiles
      add column if not exists gender_identities jsonb not null default '[]'::jsonb,
      add column if not exists orientation_identities jsonb not null default '[]'::jsonb,
      add column if not exists identity_visibility jsonb not null default '{}'::jsonb,
      add column if not exists orientation_consent_granted_at timestamptz,
      add column if not exists orientation_consent_withdrawn_at timestamptz;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_gender_identities_array'
        and conrelid = 'yearn.profiles'::regclass
    ) then
      alter table yearn.profiles
        add constraint profiles_gender_identities_array
        check (jsonb_typeof(gender_identities) = 'array');
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_orientation_identities_array'
        and conrelid = 'yearn.profiles'::regclass
    ) then
      alter table yearn.profiles
        add constraint profiles_orientation_identities_array
        check (jsonb_typeof(orientation_identities) = 'array');
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_identity_visibility_object'
        and conrelid = 'yearn.profiles'::regclass
    ) then
      alter table yearn.profiles
        add constraint profiles_identity_visibility_object
        check (jsonb_typeof(identity_visibility) = 'object');
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'profiles_orientation_requires_consent'
        and conrelid = 'yearn.profiles'::regclass
    ) then
      alter table yearn.profiles
        add constraint profiles_orientation_requires_consent
        check (
          jsonb_array_length(orientation_identities) = 0
          or orientation_consent_granted_at is not null
        );
    end if;
  end if;
end $$;
