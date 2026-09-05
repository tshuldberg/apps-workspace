-- Yearn: persist custom pronouns alongside the resolved display pronoun.
-- Apply after 0012_yearn_boost.sql. Idempotent and safely re-runnable.
--
-- profiles.pronouns stores the resolved DISPLAY value (the actual pronoun text,
-- which discover_profiles() returns for the swipe deck). custom_pronouns stores
-- the user's free-text value when they picked "Custom", so the owner's profile
-- editor can recover the "Custom" selection on reload. Previously the client's
-- ProfileRow.toSnapshot() hardcoded customPronouns = "", silently dropping it on
-- every server round-trip.

alter table yearn.profiles
  add column if not exists custom_pronouns text not null default '';
