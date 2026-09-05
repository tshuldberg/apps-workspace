export const HUMANITY_PERSONA_SQL = `
CREATE TABLE humanity.challenges (
  challenge_id text PRIMARY KEY,
  kind text NOT NULL,
  nonce text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT humanity_challenge_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX humanity_challenges_expiry_idx
  ON humanity.challenges (expires_at, challenge_id);

CREATE TABLE humanity.spent_tokens (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  spent_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT humanity_token_hash_present CHECK (length(token_hash) BETWEEN 32 AND 256)
);

CREATE INDEX humanity_spent_expiry_idx
  ON humanity.spent_tokens (expires_at, token_hash);

CREATE TABLE humanity.issuance_counts (
  key_hash text NOT NULL,
  day_bucket bigint NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (key_hash, day_bucket),
  CONSTRAINT humanity_issuance_count_nonnegative CHECK (count >= 0)
);

CREATE INDEX humanity_issuance_day_idx
  ON humanity.issuance_counts (day_bucket, key_hash);

CREATE TABLE persona.records (
  alias text PRIMARY KEY,
  persona_pubkey text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT persona_alias_canonical CHECK (alias = lower(alias)),
  CONSTRAINT persona_record_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE persona.alias_tombstones (
  alias text PRIMARY KEY,
  released_at timestamptz NOT NULL,
  cooldown_until timestamptz NOT NULL,
  payload jsonb NOT NULL,
  CONSTRAINT persona_tombstone_alias_canonical CHECK (alias = lower(alias)),
  CONSTRAINT persona_tombstone_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX persona_alias_tombstones_cooldown_idx
  ON persona.alias_tombstones (cooldown_until, alias);

CREATE TABLE persona.revocations (
  persona_pubkey text PRIMARY KEY,
  reason text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE persona.sessions (
  session_id_hash text PRIMARY KEY,
  persona_pubkey text NOT NULL,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT persona_session_expiry_order CHECK (expires_at > issued_at)
);

CREATE INDEX persona_sessions_pubkey_expiry_idx
  ON persona.sessions (persona_pubkey, expires_at);

CREATE INDEX persona_sessions_expiry_idx
  ON persona.sessions (expires_at, session_id_hash);

`;
