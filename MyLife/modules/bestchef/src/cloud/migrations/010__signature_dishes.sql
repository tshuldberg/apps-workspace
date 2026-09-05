-- P13-A (F-019): Signature dishes on social_profiles.
--
-- Stores up to 3 submission ids the chef has chosen to feature. Order is
-- preserved so the picker can render the user's exact selection sequence.
-- Caller-side validation enforces ownership and length; the column is a
-- plain uuid[] so the standard RLS policy on social_profiles applies.
--
-- Idempotent: column add uses IF NOT EXISTS.

alter table public.social_profiles
  add column if not exists signature_submission_ids uuid[] not null default '{}';
