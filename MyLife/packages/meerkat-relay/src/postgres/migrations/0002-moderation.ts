export const MODERATION_SQL = `
CREATE TABLE moderation.operator_audit (
  seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL,
  actor_hash text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT moderation_audit_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE moderation.triage (
  report_key text PRIMARY KEY,
  status text NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT moderation_triage_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE moderation.ncmec_reports (
  report_id text PRIMARY KEY,
  status text NOT NULL,
  payload jsonb NOT NULL,
  detected_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT moderation_ncmec_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX ncmec_status_detected_idx
  ON moderation.ncmec_reports (status, detected_at, report_id);

CREATE TABLE moderation.dmca_claims (
  claim_id text PRIMARY KEY,
  status text NOT NULL,
  payload jsonb NOT NULL,
  lifecycle jsonb NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT moderation_dmca_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT moderation_dmca_lifecycle_object CHECK (jsonb_typeof(lifecycle) = 'object')
);

CREATE INDEX dmca_status_received_idx
  ON moderation.dmca_claims (status, received_at DESC, claim_id DESC);

`;
