export const ACCOUNT_CREDENTIAL_SQL = `
-- Plan 51. Verification-account layer (outer identity) + anonymous credential bridge.
-- Invariant enforced by the schema guard test: the account schema never contains a
-- credential serial, persona key, or device identifier; the credential schema never
-- contains an account identifier, persona key, or device identifier. No table may
-- join an account to a persona.

CREATE SCHEMA account;
CREATE SCHEMA credential;

CREATE TABLE account.accounts (
  account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_subject text NOT NULL,
  relay_email text,
  human_verified_at timestamptz,
  age_status text NOT NULL DEFAULT 'unknown',
  age_source text,
  parental_consent_state text NOT NULL DEFAULT 'not_required',
  renewal_flagged_at timestamptz,
  flag_reason_code text,
  created_day date NOT NULL DEFAULT current_date,
  CONSTRAINT account_provider_valid CHECK (provider IN ('apple', 'google')),
  CONSTRAINT account_provider_subject_bounded CHECK (length(provider_subject) BETWEEN 1 AND 512),
  CONSTRAINT account_relay_email_bounded CHECK (relay_email IS NULL OR length(relay_email) BETWEEN 3 AND 512),
  CONSTRAINT account_age_status_valid CHECK (age_status IN ('unknown', 'store_adult', 'store_minor', 'gate_outcome')),
  CONSTRAINT account_age_source_valid CHECK (age_source IS NULL OR age_source IN ('apple_store', 'google_store', 'in_app_gate')),
  CONSTRAINT account_parental_consent_valid
    CHECK (parental_consent_state IN ('not_required', 'required_pending', 'granted', 'refused')),
  CONSTRAINT account_flag_reason_bounded CHECK (flag_reason_code IS NULL OR length(flag_reason_code) BETWEEN 1 AND 128),
  UNIQUE (provider, provider_subject)
);

CREATE TABLE account.entitlements (
  account_id uuid NOT NULL REFERENCES account.accounts (account_id) ON DELETE CASCADE,
  product text NOT NULL,
  rail text NOT NULL,
  status text NOT NULL,
  valid_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (account_id, product),
  CONSTRAINT entitlement_product_valid CHECK (product IN ('app_unlock', 'hosted_subscription')),
  CONSTRAINT entitlement_rail_valid CHECK (rail IN ('apple', 'google', 'stripe')),
  CONSTRAINT entitlement_status_valid CHECK (status IN ('active', 'lapsed', 'refunded', 'revoked'))
);

-- Quota bookkeeping only: (account, epoch). Day granularity on purpose (timing
-- correlation mitigation). NO serial column may ever be added here.
CREATE TABLE account.credential_issuance (
  account_id uuid NOT NULL REFERENCES account.accounts (account_id) ON DELETE CASCADE,
  epoch integer NOT NULL,
  issued_day date NOT NULL DEFAULT current_date,
  PRIMARY KEY (account_id, epoch),
  CONSTRAINT issuance_epoch_valid CHECK (epoch BETWEEN 0 AND 100000)
);

-- Epoch signing keys, private half AES-256-GCM sealed under an env secret held only
-- by the account service. Compromise enables forgery (rotated away next epoch), never
-- deanonymization: nothing here references an account, persona, or device.
CREATE TABLE account.epoch_signing_keys (
  epoch integer PRIMARY KEY,
  sealed_private_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT signing_epoch_valid CHECK (epoch BETWEEN 0 AND 100000),
  CONSTRAINT sealed_private_key_bounded CHECK (length(sealed_private_key) BETWEEN 1 AND 16384)
);

-- The anonymous bridge. Verifier surfaces read these two tables and nothing else of
-- the account layer. NO account identifier may ever be added to this schema.
CREATE TABLE credential.epoch_keys (
  epoch integer PRIMARY KEY,
  public_key_spki_der_base64 text NOT NULL,
  not_before timestamptz NOT NULL,
  not_after timestamptz NOT NULL,
  CONSTRAINT epoch_key_epoch_valid CHECK (epoch BETWEEN 0 AND 100000),
  CONSTRAINT epoch_key_bounded CHECK (length(public_key_spki_der_base64) BETWEEN 1 AND 4096),
  CONSTRAINT epoch_key_window_valid CHECK (not_after > not_before)
);

CREATE TABLE credential.revocations (
  serial text PRIMARY KEY,
  epoch integer NOT NULL,
  reason_code text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT revocation_serial_shape CHECK (serial ~ '^[0-9a-f]{64}$'),
  CONSTRAINT revocation_epoch_valid CHECK (epoch BETWEEN 0 AND 100000),
  CONSTRAINT revocation_reason_bounded CHECK (length(reason_code) BETWEEN 1 AND 128)
);
`;
