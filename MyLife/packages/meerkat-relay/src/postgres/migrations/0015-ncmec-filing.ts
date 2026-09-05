export const NCMEC_FILING_SQL = `
-- Plan 43 WP-43C. The NCMEC filing worker drives a queued CSAM report to a provider-confirmed
-- 'filed' state, or to a durable 'escalated' dead-letter on a permanent validation defect. This
-- migration adds the filing-lifecycle columns and the 'escalated' status. Legacy releases used
-- 'filed' for a completed manual export and had no provider-confirmation fields. Those rows are
-- truthfully normalized to 'exported'; no provider reference is fabricated.
--
-- Provider confirmation is REQUIRED for 'filed': provider_ref and filed_at are set together and
-- only for a filed record, enforced by moderation_ncmec_filed_coherent. A record is never marked
-- filed from a queued request or a manual export.

ALTER TABLE moderation.ncmec_reports
  ADD COLUMN provider_ref text,
  ADD COLUMN filed_at timestamptz,
  ADD COLUMN filing_attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_filing_error_code text,
  ADD COLUMN next_filing_attempt_at timestamptz;

-- Preserve the existing retry schedule. Adding the volatile clock_timestamp() default directly as
-- NOT NULL would assign a migration-time value instead of the durable schedule already on each row.
UPDATE moderation.ncmec_reports
SET next_filing_attempt_at = next_attempt_at
WHERE next_filing_attempt_at IS NULL;

ALTER TABLE moderation.ncmec_reports
  ALTER COLUMN next_filing_attempt_at SET DEFAULT clock_timestamp(),
  ALTER COLUMN next_filing_attempt_at SET NOT NULL;

-- Replace the status enum to admit 'escalated'. Drop the old constraint first so the rewrite is a
-- single explicit statement (the constraint name is stable from migration 3).
ALTER TABLE moderation.ncmec_reports
  DROP CONSTRAINT moderation_ncmec_status_known;

ALTER TABLE moderation.ncmec_reports
  ADD CONSTRAINT moderation_ncmec_status_known
    CHECK (status IN ('queued', 'exported', 'filed', 'escalated'));

-- A pre-v15 'filed' row proves only that an operator export completed. Keep that honest meaning and
-- make the missing provider evidence explicit for the new filing worker and operator surfaces.
UPDATE moderation.ncmec_reports
SET status = 'exported',
    provider_ref = NULL,
    filed_at = NULL,
    last_filing_error_code = 'legacy_filed_without_provider_evidence',
    updated_at = clock_timestamp(),
    lifecycle_version = lifecycle_version + 1
WHERE status = 'filed';

-- During a rolling deploy a pre-v15 writer can still request status='filed' without provider
-- evidence. Normalize that write before constraints run, allowing the old release to finish its
-- transaction while preventing it from creating a false provider-filed record.
CREATE FUNCTION moderation.normalize_legacy_ncmec_filed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, moderation
AS $normalize_legacy_ncmec_filed$
BEGIN
  IF NEW.status = 'filed' AND (NEW.provider_ref IS NULL OR NEW.filed_at IS NULL) THEN
    NEW.status := 'exported';
    NEW.provider_ref := NULL;
    NEW.filed_at := NULL;
    NEW.last_filing_error_code := 'legacy_filed_without_provider_evidence';
  END IF;
  RETURN NEW;
END;
$normalize_legacy_ncmec_filed$;

CREATE TRIGGER moderation_normalize_legacy_ncmec_filed
  BEFORE INSERT OR UPDATE ON moderation.ncmec_reports
  FOR EACH ROW EXECUTE FUNCTION moderation.normalize_legacy_ncmec_filed();

ALTER TABLE moderation.ncmec_reports
  ADD CONSTRAINT moderation_ncmec_filed_coherent CHECK (
    (status = 'filed'
      AND provider_ref IS NOT NULL
      AND length(provider_ref) BETWEEN 1 AND 256
      AND filed_at IS NOT NULL)
    OR
    (status <> 'filed' AND provider_ref IS NULL AND filed_at IS NULL)
  ) NOT VALID,
  ADD CONSTRAINT moderation_ncmec_filing_attempt_nonnegative
    CHECK (filing_attempt_count >= 0),
  ADD CONSTRAINT moderation_ncmec_filing_error_bounded
    CHECK (last_filing_error_code IS NULL OR length(last_filing_error_code) BETWEEN 1 AND 128);

ALTER TABLE moderation.ncmec_reports
  VALIDATE CONSTRAINT moderation_ncmec_filed_coherent;

-- The filing worker claims due queued records ordered by next_filing_attempt_at; index that path.
CREATE INDEX ncmec_filing_cursor_idx
  ON moderation.ncmec_reports (
    status, next_filing_attempt_at, claim_expires_at, detected_at, report_id
  );
`;
