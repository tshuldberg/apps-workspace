/** PostgreSQL-only OAuth broker state. Token plaintext never enters a table. */
export const OAUTH_BROKER_SQL = `
CREATE TABLE hosted.oauth_pending_connects (
  state_hash text PRIMARY KEY,
  code_challenge text NOT NULL,
  subject_id text NOT NULL,
  provider text NOT NULL,
  destination_label text NOT NULL,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT hosted_oauth_pending_state_hash_valid CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT hosted_oauth_pending_challenge_valid CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  CONSTRAINT hosted_oauth_pending_subject_valid CHECK (length(subject_id) BETWEEN 1 AND 512),
  CONSTRAINT hosted_oauth_pending_provider_valid CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  CONSTRAINT hosted_oauth_pending_label_valid CHECK (length(destination_label) BETWEEN 1 AND 120),
  CONSTRAINT hosted_oauth_pending_redirect_valid CHECK (length(redirect_uri) BETWEEN 1 AND 2048),
  CONSTRAINT hosted_oauth_pending_ttl_valid CHECK (expires_at > created_at)
);

CREATE INDEX hosted_oauth_pending_expiry_idx
  ON hosted.oauth_pending_connects (expires_at, state_hash);

CREATE TABLE hosted.oauth_vaults (
  vault_id text PRIMARY KEY,
  provider text NOT NULL,
  subject_id text NOT NULL,
  encrypted_refresh_token bytea NOT NULL,
  wrapped_data_key bytea NOT NULL,
  nonce bytea NOT NULL,
  account_hint text,
  scopes text[] NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT hosted_oauth_vault_subject_binding_unique UNIQUE (vault_id, subject_id),
  CONSTRAINT hosted_oauth_vault_id_valid CHECK (length(vault_id) BETWEEN 1 AND 200),
  CONSTRAINT hosted_oauth_vault_provider_valid CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  CONSTRAINT hosted_oauth_vault_subject_valid CHECK (length(subject_id) BETWEEN 1 AND 512),
  CONSTRAINT hosted_oauth_vault_ciphertext_valid CHECK (octet_length(encrypted_refresh_token) >= 16),
  CONSTRAINT hosted_oauth_vault_wrapped_key_valid CHECK (octet_length(wrapped_data_key) >= 32),
  CONSTRAINT hosted_oauth_vault_nonce_valid CHECK (octet_length(nonce) = 12),
  CONSTRAINT hosted_oauth_vault_hint_valid CHECK (account_hint IS NULL OR length(account_hint) BETWEEN 1 AND 320),
  CONSTRAINT hosted_oauth_vault_scopes_valid CHECK (cardinality(scopes) BETWEEN 1 AND 64)
);

CREATE INDEX hosted_oauth_vault_subject_idx
  ON hosted.oauth_vaults (subject_id, created_at, vault_id);

CREATE TABLE hosted.oauth_sessions (
  session_id text PRIMARY KEY,
  vault_id text NOT NULL,
  provider text NOT NULL,
  subject_id text NOT NULL,
  destination_id text NOT NULL,
  operations text[] NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT hosted_oauth_session_vault_subject_fk
    FOREIGN KEY (vault_id, subject_id)
    REFERENCES hosted.oauth_vaults(vault_id, subject_id) ON DELETE CASCADE,
  CONSTRAINT hosted_oauth_session_id_valid CHECK (length(session_id) BETWEEN 1 AND 200),
  CONSTRAINT hosted_oauth_session_provider_valid CHECK (provider ~ '^[a-z][a-z0-9_-]{0,31}$'),
  CONSTRAINT hosted_oauth_session_subject_valid CHECK (length(subject_id) BETWEEN 1 AND 512),
  CONSTRAINT hosted_oauth_session_destination_valid CHECK (destination_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  CONSTRAINT hosted_oauth_session_operations_valid CHECK (cardinality(operations) BETWEEN 1 AND 6),
  CONSTRAINT hosted_oauth_session_operations_allowed CHECK (
    operations <@ ARRAY['health', 'quota', 'read', 'write', 'list', 'delete']::text[]
  ),
  CONSTRAINT hosted_oauth_session_ttl_valid CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes')
);

CREATE INDEX hosted_oauth_session_subject_expiry_idx
  ON hosted.oauth_sessions (subject_id, expires_at, session_id);

CREATE TABLE hosted.oauth_audit_events (
  audit_id text PRIMARY KEY,
  subject_id text NOT NULL,
  action text NOT NULL,
  outcome text NOT NULL,
  provider text,
  vault_id text,
  destination_id text,
  operation text,
  detail_code text,
  created_at timestamptz NOT NULL,
  CONSTRAINT hosted_oauth_audit_id_valid CHECK (length(audit_id) BETWEEN 1 AND 200),
  CONSTRAINT hosted_oauth_audit_subject_valid CHECK (length(subject_id) BETWEEN 1 AND 512),
  CONSTRAINT hosted_oauth_audit_action_valid CHECK (
    action IN ('connect_start', 'connect_complete', 'session_issue', 'revoke', 'account_delete')
  ),
  CONSTRAINT hosted_oauth_audit_outcome_valid CHECK (outcome IN ('success', 'failure')),
  CONSTRAINT hosted_oauth_audit_provider_valid CHECK (
    provider IS NULL OR provider ~ '^[a-z][a-z0-9_-]{0,31}$'
  ),
  CONSTRAINT hosted_oauth_audit_operation_valid CHECK (
    operation IS NULL OR operation IN ('health', 'quota', 'read', 'write', 'list', 'delete')
  ),
  CONSTRAINT hosted_oauth_audit_detail_valid CHECK (detail_code IS NULL OR length(detail_code) <= 128)
);

CREATE INDEX hosted_oauth_audit_subject_created_idx
  ON hosted.oauth_audit_events (subject_id, created_at, audit_id);
`;
