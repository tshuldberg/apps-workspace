export const NCMEC_FILING_SQL = `
-- Plan 43 WP-43C. The NCMEC filing worker drives a queued CSAM report to a provider-confirmed
-- 'filed' state, or to a durable 'escalated' dead-letter on a permanent validation defect. This
-- migration adds the filing-lifecycle columns and the 'escalated' status. It only EXPANDS the
-- version 3 moderation.ncmec_reports table so the preceding release stays online during rollout.
--
-- Provider confirmation is REQUIRED for 'filed': provider_ref and filed_at are set together and
-- only for a filed record, enforced by moderation_ncmec_filed_coherent. A record is never marked
-- filed from a queued request or a manual export.

ALTER TABLE moderation.ncmec_reports
  ADD COLUMN provider_ref text,
  ADD COLUMN filed_at timestamptz,
  ADD COLUMN filing_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_filing_error_code text,
  ADD COLUMN next_filing_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp();

-- Replace the status enum to admit 'escalated'. Drop the old constraint first so the rewrite is a
-- single explicit statement (the constraint name is stable from migration 3).
ALTER TABLE moderation.ncmec_reports
  DROP CONSTRAINT moderation_ncmec_status_known;

ALTER TABLE moderation.ncmec_reports
  ADD CONSTRAINT moderation_ncmec_status_known
    CHECK (status IN ('queued', 'exported', 'filed', 'escalated')),
  ADD CONSTRAINT moderation_ncmec_filed_coherent CHECK (
    (status = 'filed'
      AND provider_ref IS NOT NULL
      AND length(provider_ref) BETWEEN 1 AND 256
      AND filed_at IS NOT NULL)
    OR
    (status <> 'filed' AND provider_ref IS NULL AND filed_at IS NULL)
  ),
  ADD CONSTRAINT moderation_ncmec_filing_attempt_nonnegative
    CHECK (filing_attempt_count >= 0),
  ADD CONSTRAINT moderation_ncmec_filing_error_bounded
    CHECK (last_filing_error_code IS NULL OR length(last_filing_error_code) BETWEEN 1 AND 128);

-- The filing worker claims due queued records ordered by next_filing_attempt_at; index that path.
CREATE INDEX ncmec_filing_cursor_idx
  ON moderation.ncmec_reports (
    status, next_filing_attempt_at, claim_expires_at, detected_at, report_id
  );
`;
