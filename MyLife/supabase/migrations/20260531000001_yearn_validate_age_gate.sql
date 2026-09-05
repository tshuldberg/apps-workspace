-- Validate Yearn's 18+ profile constraint once existing data is clean.
-- Safe for fresh MyLife databases where the isolated Yearn schema is absent.

do $$
begin
  if to_regclass('yearn.profiles') is null then
    raise notice 'yearn.profiles does not exist; skipping Yearn age-gate validation.';
    return;
  end if;

  if exists (
    select 1
    from yearn.profiles
    where birthday > (current_date - interval '18 years')
  ) then
    raise exception 'Cannot validate profiles_min_age_18 while under-18 Yearn profiles exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_min_age_18'
      and conrelid = 'yearn.profiles'::regclass
  ) then
    alter table yearn.profiles
      add constraint profiles_min_age_18
      check (birthday <= (current_date - interval '18 years'))
      not valid;
  end if;

  alter table yearn.profiles validate constraint profiles_min_age_18;
end;
$$;
