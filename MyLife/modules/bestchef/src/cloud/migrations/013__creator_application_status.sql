-- P13-D (F-027, F-028): Creator program backend status tracking.
--
-- Replaces the legacy 3-state status enum on bc_creator_applications with a
-- richer review pipeline (submitted, under_review, approved, declined,
-- more_info_needed, withdrawn). Adds a profile-keyed lookup index used by
-- the in-app status screen.
--
-- Idempotent: column adds use IF NOT EXISTS, the constraint is dropped and
-- recreated, and the index uses IF NOT EXISTS.

-- Backfill any legacy rows so they pass the new check constraint.
update public.bc_creator_applications
   set status = 'submitted'
 where status = 'pending';

update public.bc_creator_applications
   set status = 'declined'
 where status = 'rejected';

-- Replace the old check constraint with the richer status enum.
alter table public.bc_creator_applications
  drop constraint if exists bc_creator_applications_status_check;

alter table public.bc_creator_applications
  add constraint bc_creator_applications_status_check
  check (status in (
    'submitted',
    'under_review',
    'approved',
    'declined',
    'more_info_needed',
    'withdrawn'
  ));

-- Default new rows to 'submitted' instead of 'pending'.
alter table public.bc_creator_applications
  alter column status set default 'submitted';

-- Ensure the columns from the ticket exist (already in the base schema, but
-- keep this idempotent so a fresh DB only running this migration still works).
alter table public.bc_creator_applications
  add column if not exists reviewed_at timestamptz;

alter table public.bc_creator_applications
  add column if not exists review_notes text;

-- Index used by the in-app status screen to fetch the caller's latest
-- application by profile_id (the FK to social_profiles.id, which is the
-- per-user owner key in this schema).
create index if not exists bc_creator_applications_user_idx
  on public.bc_creator_applications (profile_id);
