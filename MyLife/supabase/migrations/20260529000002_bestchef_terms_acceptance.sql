-- Versioned, timestamped EULA / Terms acceptance record (App Store Guideline 1.2:
-- UGC apps must require an EULA where the user agrees to a zero-tolerance policy for
-- objectionable content and abusive users). Also supports GDPR consent auditing and
-- re-prompting when the published terms version changes.

create table if not exists public.bc_terms_acceptance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.social_profiles(id) on delete cascade,
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  source text not null default 'mobile' check (source in ('mobile', 'web')),
  unique (profile_id, terms_version)
);

create index if not exists bc_terms_acceptance_profile_idx
  on public.bc_terms_acceptance (profile_id, accepted_at desc);

alter table public.bc_terms_acceptance enable row level security;

-- A profile may read and create only its own acceptance records.
drop policy if exists "bc_terms_acceptance_select" on public.bc_terms_acceptance;
create policy "bc_terms_acceptance_select" on public.bc_terms_acceptance
  for select to authenticated
  using (bc_profile_owned(profile_id));

drop policy if exists "bc_terms_acceptance_insert" on public.bc_terms_acceptance;
create policy "bc_terms_acceptance_insert" on public.bc_terms_acceptance
  for insert to authenticated
  with check (bc_profile_owned(profile_id));

grant select, insert on public.bc_terms_acceptance to authenticated;
