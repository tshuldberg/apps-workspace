/** Additive Plan 42 push generations, privacy, idempotency, and retention fields. */
export const PUSH_LIFECYCLE_SQL = `
CREATE TABLE push.registration_tokens (
  registration_id_hash bytea NOT NULL
    REFERENCES push.registrations(registration_id_hash) ON DELETE CASCADE,
  token_generation bigint NOT NULL,
  token_ciphertext bytea NOT NULL,
  token_key_version integer NOT NULL,
  state text NOT NULL,
  expires_at timestamptz NOT NULL,
  retire_after timestamptz,
  invalidated_at timestamptz,
  invalidation_reason text,
  lifecycle_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (registration_id_hash, token_generation),
  CONSTRAINT push_token_generation_positive CHECK (token_generation > 0),
  CONSTRAINT push_token_ciphertext_present CHECK (octet_length(token_ciphertext) BETWEEN 1 AND 16384),
  CONSTRAINT push_token_key_version_positive CHECK (token_key_version > 0),
  CONSTRAINT push_token_state_known CHECK (state IN ('active', 'retiring', 'invalidated')),
  CONSTRAINT push_token_invalidation_reason_known CHECK (
    invalidation_reason IS NULL OR invalidation_reason IN (
      'invalid_token', 'unregistered', 'token_expired', 'provider_rejected'
    )
  ),
  CONSTRAINT push_token_lifecycle_positive CHECK (lifecycle_version > 0),
  CONSTRAINT push_token_expiry_order CHECK (expires_at > created_at),
  CONSTRAINT push_token_retirement_order CHECK (
    retire_after IS NULL OR (retire_after >= created_at AND retire_after <= expires_at)
  ),
  CONSTRAINT push_token_invalidation_order CHECK (
    invalidated_at IS NULL OR invalidated_at >= created_at
  ),
  CONSTRAINT push_token_state_coherent CHECK (
    (state = 'active' AND retire_after IS NULL AND invalidated_at IS NULL AND invalidation_reason IS NULL)
    OR (state = 'retiring' AND retire_after IS NOT NULL AND invalidated_at IS NULL AND invalidation_reason IS NULL)
    OR (state = 'invalidated' AND invalidated_at IS NOT NULL AND invalidation_reason IS NOT NULL)
  )
);

INSERT INTO push.registration_tokens (
  registration_id_hash, token_generation, token_ciphertext, token_key_version,
  state, expires_at, invalidated_at, invalidation_reason, created_at, updated_at
)
SELECT registration_id_hash, token_generation, token_ciphertext, token_key_version,
  CASE WHEN invalidated_at IS NULL THEN 'active' ELSE 'invalidated' END,
  expires_at, invalidated_at,
  CASE WHEN invalidated_at IS NULL THEN NULL ELSE 'unregistered' END,
  created_at, updated_at
FROM push.registrations
ON CONFLICT (registration_id_hash, token_generation) DO NOTHING;

ALTER TABLE push.attempts
  ADD COLUMN registration_id_hash bytea,
  ADD COLUMN request_digest bytea,
  ADD COLUMN token_generation bigint,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN idempotency_key_hash bytea,
  ADD COLUMN address_binding_state text NOT NULL DEFAULT 'legacy_unbound';

-- Existing v2 rows remain explicitly unbound. Inferring a registration and token
-- generation from today's mutable graph would fabricate authority they never
-- carried. Their original key remains queryable by old binaries while new
-- projections use only the canonical hash.
UPDATE push.attempts
SET idempotency_key_hash = CASE
  WHEN idempotency_key ~ '^[0-9a-f]{64}$' THEN decode(idempotency_key, 'hex')
  ELSE sha256(convert_to(idempotency_key, 'UTF8'))
END,
    registration_id_hash = NULL,
    request_digest = NULL,
    token_generation = NULL,
    address_binding_state = 'legacy_unbound';

UPDATE push.attempts
SET completed_at = GREATEST(updated_at, created_at)
WHERE state IN ('succeeded', 'failed', 'cancelled') AND completed_at IS NULL;

UPDATE push.attempts
SET provider_status = CASE
  WHEN state IN ('queued', 'leased') THEN 'pending'
  WHEN state IN ('retryable', 'cancelled') THEN 'unknown'
  WHEN state = 'succeeded' THEN 'provider_accepted'
  WHEN state = 'failed' AND provider_status = 'provider_rejected' THEN 'provider_rejected'
  ELSE 'unknown'
END;

ALTER TABLE push.attempts
  ALTER COLUMN idempotency_key_hash SET NOT NULL,
  ADD CONSTRAINT push_attempt_registration_hash_length
    CHECK (registration_id_hash IS NULL OR octet_length(registration_id_hash) = 32),
  ADD CONSTRAINT push_attempt_request_digest_length
    CHECK (request_digest IS NULL OR octet_length(request_digest) = 32),
  ADD CONSTRAINT push_attempt_idempotency_key_present
    CHECK (length(idempotency_key) BETWEEN 1 AND 512),
  ADD CONSTRAINT push_attempt_idempotency_hash_length
    CHECK (octet_length(idempotency_key_hash) = 32),
  ADD CONSTRAINT push_attempt_token_generation_positive
    CHECK (token_generation IS NULL OR token_generation > 0),
  ADD CONSTRAINT push_attempt_address_binding_known
    CHECK (address_binding_state IN ('bound', 'legacy_unbound')),
  ADD CONSTRAINT push_attempt_address_binding_coherent CHECK (
    (address_binding_state = 'bound'
      AND registration_id_hash IS NOT NULL
      AND request_digest IS NOT NULL
      AND token_generation IS NOT NULL
      AND idempotency_key ~ '^[0-9a-f]{64}$'
      AND idempotency_key_hash = decode(idempotency_key, 'hex'))
    OR
    (address_binding_state = 'legacy_unbound'
      AND registration_id_hash IS NULL
      AND request_digest IS NULL
      AND token_generation IS NULL)
  ),
  ADD CONSTRAINT push_attempt_completion_order CHECK (
    completed_at IS NULL OR completed_at >= created_at
  ),
  ADD CONSTRAINT push_attempt_terminal_coherent CHECK (
    (state IN ('succeeded', 'failed', 'cancelled') AND completed_at IS NOT NULL)
    OR (state IN ('queued', 'leased', 'retryable') AND completed_at IS NULL)
  ),
  ADD CONSTRAINT push_attempt_outcome_coherent CHECK (
    (state IN ('queued', 'leased') AND provider_status = 'pending')
    OR (state = 'retryable' AND provider_status = 'unknown')
    OR (state = 'succeeded' AND provider_status = 'provider_accepted')
    OR (state = 'failed' AND provider_status IN ('provider_rejected', 'unknown'))
    OR (state = 'cancelled' AND provider_status = 'unknown')
  );

ALTER TABLE push.attempts
  DROP CONSTRAINT attempts_idempotency_key_key,
  DROP CONSTRAINT attempts_capability_hash_fkey,
  ADD CONSTRAINT attempts_capability_hash_fkey
    FOREIGN KEY (capability_hash) REFERENCES push.capabilities(capability_hash) ON DELETE RESTRICT,
  ADD CONSTRAINT attempts_registration_token_fkey
    FOREIGN KEY (registration_id_hash, token_generation)
    REFERENCES push.registration_tokens(registration_id_hash, token_generation) ON DELETE RESTRICT;

-- Old registration writers still dual-write the v2 columns. This trigger mirrors
-- only authority they explicitly supplied into the generation table. It never
-- binds a legacy attempt to that generation.
CREATE FUNCTION push.sync_legacy_registration_token() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, push
AS $push_sync_legacy_registration_token$
DECLARE
  generation_exists boolean;
BEGIN
  SELECT true INTO generation_exists
  FROM push.registration_tokens
  WHERE registration_id_hash = NEW.registration_id_hash
    AND token_generation = NEW.token_generation;

  IF COALESCE(generation_exists, false) = false THEN
    UPDATE push.registration_tokens
    SET state = 'retiring',
        retire_after = LEAST(expires_at, clock_timestamp() + interval '24 hours'),
        updated_at = clock_timestamp(),
        lifecycle_version = lifecycle_version + 1
    WHERE registration_id_hash = NEW.registration_id_hash
      AND state = 'active';

    INSERT INTO push.registration_tokens (
      registration_id_hash, token_generation, token_ciphertext, token_key_version,
      state, expires_at, invalidated_at, invalidation_reason, created_at, updated_at
    ) VALUES (
      NEW.registration_id_hash, NEW.token_generation, NEW.token_ciphertext,
      NEW.token_key_version,
      CASE WHEN NEW.invalidated_at IS NULL THEN 'active' ELSE 'invalidated' END,
      NEW.expires_at, NEW.invalidated_at,
      CASE WHEN NEW.invalidated_at IS NULL THEN NULL ELSE 'unregistered' END,
      NEW.created_at, NEW.updated_at
    )
    ON CONFLICT (registration_id_hash, token_generation) DO NOTHING;
  END IF;

  IF NEW.invalidated_at IS NOT NULL THEN
    UPDATE push.registration_tokens
    SET state = 'invalidated',
        invalidated_at = COALESCE(invalidated_at, NEW.invalidated_at),
        invalidation_reason = COALESCE(invalidation_reason, 'unregistered'),
        updated_at = clock_timestamp(),
        lifecycle_version = lifecycle_version + 1
    WHERE registration_id_hash = NEW.registration_id_hash
      AND state <> 'invalidated';

    UPDATE push.attempts AS a
    SET state = 'cancelled', provider_status = 'unknown',
        last_error_code = 'registration_revoked',
        lease_owner = NULL, leased_until = NULL,
        completed_at = clock_timestamp(), updated_at = clock_timestamp(),
        fencing_token = a.fencing_token + 1,
        lifecycle_version = a.lifecycle_version + 1
    FROM push.capabilities AS c
    WHERE c.registration_id_hash = NEW.registration_id_hash
      AND a.capability_hash = c.capability_hash
      AND a.state IN ('queued', 'leased', 'retryable');
  END IF;

  RETURN NEW;
END
$push_sync_legacy_registration_token$;

REVOKE ALL ON FUNCTION push.sync_legacy_registration_token() FROM PUBLIC;

CREATE TRIGGER push_registrations_legacy_generation_sync
AFTER INSERT OR UPDATE OF token_ciphertext, token_key_version, token_generation, expires_at, invalidated_at
ON push.registrations
FOR EACH ROW EXECUTE FUNCTION push.sync_legacy_registration_token();

-- Omitted v5 binding fields identify an old writer. Preserve its lookup key and
-- normalize only lifecycle bookkeeping; leave all authority fields NULL so the
-- row is provably nonclaimable.
CREATE FUNCTION push.classify_legacy_attempt() RETURNS trigger
LANGUAGE plpgsql
AS $push_classify_legacy_attempt$
BEGIN
  IF NEW.address_binding_state <> 'bound' THEN
    NEW.address_binding_state := 'legacy_unbound';
    NEW.registration_id_hash := NULL;
    NEW.request_digest := NULL;
    NEW.token_generation := NULL;
    NEW.provider_status := CASE
      WHEN NEW.state IN ('queued', 'leased') THEN 'pending'
      WHEN NEW.state IN ('retryable', 'cancelled') THEN 'unknown'
      WHEN NEW.state = 'succeeded' THEN 'provider_accepted'
      WHEN NEW.state = 'failed' AND NEW.provider_status = 'provider_rejected'
        THEN 'provider_rejected'
      ELSE 'unknown'
    END;
    NEW.completed_at := CASE
      WHEN NEW.state IN ('succeeded', 'failed', 'cancelled')
        THEN COALESCE(NEW.completed_at, clock_timestamp())
      ELSE NULL
    END;
  END IF;

  IF NEW.idempotency_key_hash IS NULL THEN
    NEW.idempotency_key_hash := CASE
      WHEN NEW.idempotency_key ~ '^[0-9a-f]{64}$' THEN decode(NEW.idempotency_key, 'hex')
      ELSE sha256(convert_to(NEW.idempotency_key, 'UTF8'))
    END;
  END IF;
  RETURN NEW;
END
$push_classify_legacy_attempt$;

CREATE TRIGGER push_attempts_legacy_classifier
BEFORE INSERT ON push.attempts
FOR EACH ROW EXECUTE FUNCTION push.classify_legacy_attempt();

CREATE FUNCTION push.cancel_attempts_after_capability_revoke() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, push
AS $push_cancel_attempts_after_capability_revoke$
BEGIN
  IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
    UPDATE push.attempts
    SET state = 'cancelled', provider_status = 'unknown',
        last_error_code = 'capability_revoked',
        lease_owner = NULL, leased_until = NULL,
        completed_at = clock_timestamp(), updated_at = clock_timestamp(),
        fencing_token = fencing_token + 1,
        lifecycle_version = lifecycle_version + 1
    WHERE capability_hash = NEW.capability_hash
      AND state IN ('queued', 'leased', 'retryable');
  END IF;
  RETURN NEW;
END
$push_cancel_attempts_after_capability_revoke$;

REVOKE ALL ON FUNCTION push.cancel_attempts_after_capability_revoke() FROM PUBLIC;

CREATE TRIGGER push_capabilities_attempt_cancellation
AFTER UPDATE OF revoked_at ON push.capabilities
FOR EACH ROW EXECUTE FUNCTION push.cancel_attempts_after_capability_revoke();

CREATE INDEX push_registration_tokens_delivery_idx
  ON push.registration_tokens (registration_id_hash, state, expires_at, retire_after, token_generation DESC);

CREATE INDEX push_registration_tokens_retention_idx
  ON push.registration_tokens (state, invalidated_at, expires_at, registration_id_hash, token_generation);

CREATE UNIQUE INDEX push_registration_tokens_one_active_idx
  ON push.registration_tokens (registration_id_hash)
  WHERE state = 'active';

CREATE INDEX push_registrations_created_cursor_idx
  ON push.registrations (created_at DESC, registration_id_hash DESC);

CREATE INDEX push_attempts_created_cursor_idx
  ON push.attempts (created_at DESC, attempt_id DESC);

CREATE INDEX push_attempts_terminal_retention_idx
  ON push.attempts (completed_at, attempt_id)
  WHERE state IN ('succeeded', 'failed', 'cancelled');

CREATE INDEX push_attempts_registration_created_idx
  ON push.attempts (registration_id_hash, created_at DESC, attempt_id DESC);

CREATE INDEX push_attempts_idempotency_idx
  ON push.attempts (idempotency_key, created_at DESC, attempt_id DESC);

CREATE INDEX push_attempts_idempotency_hash_idx
  ON push.attempts (idempotency_key_hash, created_at DESC, attempt_id DESC)
  WHERE address_binding_state = 'bound';

CREATE UNIQUE INDEX push_attempts_legacy_idempotency_key_idx
  ON push.attempts (idempotency_key)
  WHERE address_binding_state = 'legacy_unbound';

CREATE INDEX push_capabilities_retention_idx
  ON push.capabilities (revoked_at, expires_at, capability_hash);
`;
