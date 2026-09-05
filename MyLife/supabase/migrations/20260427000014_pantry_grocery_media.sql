-- P14-B (F-015, F-016): Reserve media_uris column on bc_pantry_batches and
-- bc_grocery_lists for cloud sync of pantry batch viewer media and grocery
-- list reference photos. Ticket spec: migrations/016__pantry_grocery_media.sql.
--
-- These tables may not yet exist on Supabase; the cloud surfaces for pantry
-- batches and grocery lists ship as personal_replica data per the recipes
-- module sync policy. This migration is forward-compatible: it only adds the
-- column when the table exists, so it never blocks the migration runner if
-- the cloud schema lands later.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'bc_pantry_batches'
  ) then
    alter table public.bc_pantry_batches
      add column if not exists media_uris text[] not null default '{}';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'bc_grocery_lists'
  ) then
    alter table public.bc_grocery_lists
      add column if not exists media_uris text[] not null default '{}';
  end if;
end$$;
