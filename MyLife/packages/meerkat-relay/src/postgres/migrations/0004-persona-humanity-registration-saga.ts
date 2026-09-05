/**
 * Durable cross-service registration receipts.
 *
 * Humanity stores a replayable successful redemption keyed by both the deterministic
 * registration attempt and the exact request digest. Persona stores a provisional saga row
 * separately from active records, so an alias is reserved before redemption but is not
 * resolvable until humanity has succeeded.
 */
export const PERSONA_HUMANITY_REGISTRATION_SAGA_SQL = `
CREATE TABLE humanity.registration_redemptions (
  attempt_id text PRIMARY KEY,
  request_digest text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_expires_at timestamptz NOT NULL,
  result jsonb NOT NULL,
  lifecycle_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT humanity_registration_attempt_hex CHECK (attempt_id ~ '^[0-9a-f]{64}$'),
  CONSTRAINT humanity_registration_digest_hex CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT humanity_registration_token_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT humanity_registration_result_object CHECK (jsonb_typeof(result) = 'object'),
  CONSTRAINT humanity_registration_result_success CHECK (result = '{"ok": true}'::jsonb),
  CONSTRAINT humanity_registration_lifecycle_positive CHECK (lifecycle_version > 0)
);

CREATE INDEX humanity_registration_redemptions_created_idx
  ON humanity.registration_redemptions (created_at DESC, attempt_id DESC);

CREATE TABLE persona.registration_attempts (
  attempt_id text PRIMARY KEY,
  request_digest text NOT NULL,
  alias text NOT NULL,
  persona_pubkey text NOT NULL,
  state text NOT NULL,
  record_payload jsonb NOT NULL,
  lifecycle_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  reservation_expires_at timestamptz NOT NULL
    DEFAULT (clock_timestamp() + interval '24 hours'),
  CONSTRAINT persona_registration_attempt_hex CHECK (attempt_id ~ '^[0-9a-f]{64}$'),
  CONSTRAINT persona_registration_digest_hex CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT persona_registration_attempt_alias_canonical CHECK (alias = lower(alias)),
  CONSTRAINT persona_registration_attempt_pubkey_hex CHECK (persona_pubkey ~ '^[0-9a-f]{64}$'),
  CONSTRAINT persona_registration_attempt_state CHECK (
    state IN ('reserved', 'humanity_verified', 'committed')
  ),
  CONSTRAINT persona_registration_attempt_payload_object CHECK (
    jsonb_typeof(record_payload) = 'object'
  ),
  CONSTRAINT persona_registration_attempt_lifecycle_positive CHECK (lifecycle_version > 0),
  CONSTRAINT persona_registration_attempt_update_order CHECK (updated_at >= created_at),
  CONSTRAINT persona_registration_attempt_reservation_expiry_order CHECK (
    reservation_expires_at > created_at
  )
);

CREATE UNIQUE INDEX persona_registration_attempts_pending_alias_uidx
  ON persona.registration_attempts (alias)
  WHERE state IN ('reserved', 'humanity_verified');

CREATE UNIQUE INDEX persona_registration_attempts_pending_pubkey_uidx
  ON persona.registration_attempts (persona_pubkey)
  WHERE state IN ('reserved', 'humanity_verified');

CREATE INDEX persona_registration_attempts_persona_idx
  ON persona.registration_attempts (persona_pubkey, created_at DESC, attempt_id DESC);

CREATE INDEX persona_registration_attempts_recovery_idx
  ON persona.registration_attempts (state, reservation_expires_at, attempt_id);
`;
