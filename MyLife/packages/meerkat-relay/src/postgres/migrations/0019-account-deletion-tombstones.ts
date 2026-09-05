export const ACCOUNT_DELETION_TOMBSTONES_SQL = `
-- Preserve a one-way subject marker through the current anonymous-pass epoch so a
-- delete-and-recreate cannot reset the per-epoch issuance quota, plus the
-- anti-abuse state that must survive deletion (a minor determination or a renewal
-- flag) so it cannot be laundered by recreating the account. The raw Apple/Google
-- subject is never retained; the row keys on a one-way subject hash only.
CREATE TABLE account.deleted_subjects (
  subject_hash text PRIMARY KEY,
  recreate_after timestamptz NOT NULL,
  age_status text NOT NULL DEFAULT 'unknown',
  age_source text,
  parental_consent_state text NOT NULL DEFAULT 'not_required',
  renewal_flagged_at timestamptz,
  flag_reason_code text,
  CONSTRAINT deleted_subject_hash_shape CHECK (subject_hash ~ '^[0-9a-f]{64}$')
);
`;
