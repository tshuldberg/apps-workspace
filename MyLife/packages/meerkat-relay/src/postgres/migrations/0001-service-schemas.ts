export const SERVICE_SCHEMAS_SQL = `
CREATE SCHEMA community;
CREATE SCHEMA directory;
CREATE SCHEMA humanity;
CREATE SCHEMA persona;
CREATE SCHEMA hosted;
CREATE SCHEMA moderation;
CREATE SCHEMA push;
CREATE SCHEMA archive;

CREATE TABLE ops.idempotency_results (
  scope text NOT NULL,
  idempotency_key text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz,
  PRIMARY KEY (scope, idempotency_key),
  CONSTRAINT idempotency_scope_present CHECK (length(scope) BETWEEN 1 AND 128),
  CONSTRAINT idempotency_key_present CHECK (length(idempotency_key) BETWEEN 1 AND 512)
);

CREATE TABLE ops.job_leases (
  queue text NOT NULL,
  job_id text NOT NULL,
  owner text NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  leased_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (queue, job_id),
  CONSTRAINT job_lease_attempt_positive CHECK (attempt > 0),
  CONSTRAINT job_lease_owner_present CHECK (length(owner) BETWEEN 1 AND 256)
);

CREATE INDEX job_leases_expiry_idx
  ON ops.job_leases (queue, leased_until);

CREATE INDEX idempotency_results_expiry_idx
  ON ops.idempotency_results (expires_at, scope, idempotency_key)
  WHERE expires_at IS NOT NULL;
`;
