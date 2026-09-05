/** Additive durable authority for private CommunityNode state. */
export const COMMUNITY_PRIVATE_STATE_SQL = `
CREATE TABLE community.private_states (
  community_id text PRIMARY KEY,
  descriptor_revision bigint NOT NULL,
  descriptor_hash text NOT NULL,
  publish_digest text NOT NULL,
  descriptor_payload jsonb NOT NULL,
  lifecycle_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT private_state_community_id_bounded
    CHECK (length(community_id) BETWEEN 1 AND 128),
  CONSTRAINT private_state_revision_nonnegative CHECK (descriptor_revision >= 0),
  CONSTRAINT private_state_descriptor_hash_valid
    CHECK (descriptor_hash ~ '^[0-9a-f]{128}$'),
  CONSTRAINT private_state_publish_digest_valid
    CHECK (publish_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT private_state_descriptor_object
    CHECK (jsonb_typeof(descriptor_payload) = 'object'),
  CONSTRAINT private_state_descriptor_bounded
    CHECK (octet_length(descriptor_payload::text) <= 1048576),
  CONSTRAINT private_state_lifecycle_positive CHECK (lifecycle_version > 0)
);

CREATE TABLE community.private_snapshots (
  community_id text NOT NULL
    REFERENCES community.private_states(community_id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  epoch bigint NOT NULL,
  info_hash text NOT NULL,
  manifest_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (community_id, channel_id),
  CONSTRAINT private_snapshot_channel_bounded
    CHECK (length(channel_id) BETWEEN 1 AND 256),
  CONSTRAINT private_snapshot_epoch_nonnegative CHECK (epoch >= 0),
  CONSTRAINT private_snapshot_info_hash_bounded
    CHECK (length(info_hash) BETWEEN 1 AND 256),
  CONSTRAINT private_snapshot_manifest_object
    CHECK (jsonb_typeof(manifest_payload) = 'object'),
  CONSTRAINT private_snapshot_manifest_bounded
    CHECK (octet_length(manifest_payload::text) <= 1048576)
);

CREATE TABLE community.private_descriptor_history (
  community_id text NOT NULL,
  descriptor_hash text NOT NULL,
  descriptor_revision bigint NOT NULL,
  descriptor_payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (community_id, descriptor_hash),
  CONSTRAINT private_descriptor_history_community_bounded
    CHECK (length(community_id) BETWEEN 1 AND 128),
  CONSTRAINT private_descriptor_history_hash_valid
    CHECK (descriptor_hash ~ '^[0-9a-f]{128}$'),
  CONSTRAINT private_descriptor_history_revision_nonnegative
    CHECK (descriptor_revision >= 0),
  CONSTRAINT private_descriptor_history_payload_object
    CHECK (jsonb_typeof(descriptor_payload) = 'object'),
  CONSTRAINT private_descriptor_history_payload_bounded
    CHECK (octet_length(descriptor_payload::text) <= 1048576)
);

CREATE TABLE community.private_tail (
  tail_id bigserial PRIMARY KEY,
  community_id text NOT NULL
    REFERENCES community.private_states(community_id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  descriptor_hash text NOT NULL,
  replay_key text NOT NULL,
  entry_payload jsonb NOT NULL,
  appended_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT private_tail_channel_bounded
    CHECK (length(channel_id) BETWEEN 1 AND 256),
  CONSTRAINT private_tail_descriptor_hash_valid
    CHECK (descriptor_hash ~ '^[0-9a-f]{128}$'),
  CONSTRAINT private_tail_replay_key_valid
    CHECK (replay_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT private_tail_entry_object
    CHECK (jsonb_typeof(entry_payload) = 'object'),
  CONSTRAINT private_tail_entry_bounded
    CHECK (octet_length(entry_payload::text) <= 1048576),
  UNIQUE (community_id, replay_key),
  FOREIGN KEY (community_id, descriptor_hash)
    REFERENCES community.private_descriptor_history(community_id, descriptor_hash)
    ON DELETE RESTRICT
);

CREATE INDEX private_tail_channel_cursor_idx
  ON community.private_tail (community_id, channel_id, tail_id);

CREATE TABLE community.private_challenges (
  community_id text NOT NULL,
  nonce text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (community_id, nonce),
  CONSTRAINT private_challenge_community_bounded
    CHECK (length(community_id) BETWEEN 1 AND 128),
  CONSTRAINT private_challenge_nonce_valid
    CHECK (nonce ~ '^[0-9a-f]{48}$'),
  CONSTRAINT private_challenge_expiry_order CHECK (expires_at > issued_at)
);

CREATE INDEX private_challenges_expiry_idx
  ON community.private_challenges (expires_at, community_id, nonce);

CREATE INDEX private_challenges_community_issued_idx
  ON community.private_challenges (community_id, issued_at, nonce);

CREATE TABLE community.private_rate_hits (
  hit_id bigserial PRIMARY KEY,
  community_id text NOT NULL,
  principal_hash text NOT NULL,
  action text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT private_rate_community_bounded
    CHECK (length(community_id) BETWEEN 1 AND 128),
  CONSTRAINT private_rate_principal_hash_valid
    CHECK (principal_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT private_rate_action_known
    CHECK (action IN ('publish', 'append', 'pull')),
  CONSTRAINT private_rate_expiry_order CHECK (expires_at > occurred_at)
);

CREATE INDEX private_rate_window_idx
  ON community.private_rate_hits (
    community_id, principal_hash, action, expires_at, hit_id
  );

CREATE INDEX private_rate_retention_idx
  ON community.private_rate_hits (expires_at, hit_id);

CREATE TABLE community.private_publish_stages (
  community_id text PRIMARY KEY,
  stage_id text NOT NULL UNIQUE,
  expected_descriptor_hash text,
  descriptor_revision bigint NOT NULL,
  descriptor_hash text NOT NULL,
  publish_digest text NOT NULL,
  descriptor_payload jsonb NOT NULL,
  snapshots_payload jsonb NOT NULL,
  tail_high_water_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  CONSTRAINT private_stage_community_bounded
    CHECK (length(community_id) BETWEEN 1 AND 128),
  CONSTRAINT private_stage_id_valid CHECK (stage_id ~ '^[0-9a-f]{64}$'),
  CONSTRAINT private_stage_expected_hash_valid CHECK (
    expected_descriptor_hash IS NULL
    OR expected_descriptor_hash ~ '^[0-9a-f]{128}$'
  ),
  CONSTRAINT private_stage_revision_nonnegative CHECK (descriptor_revision >= 0),
  CONSTRAINT private_stage_descriptor_hash_valid
    CHECK (descriptor_hash ~ '^[0-9a-f]{128}$'),
  CONSTRAINT private_stage_publish_digest_valid
    CHECK (publish_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT private_stage_descriptor_object
    CHECK (jsonb_typeof(descriptor_payload) = 'object'),
  CONSTRAINT private_stage_snapshots_array
    CHECK (jsonb_typeof(snapshots_payload) = 'array'),
  CONSTRAINT private_stage_tail_high_water_object
    CHECK (jsonb_typeof(tail_high_water_payload) = 'object'),
  CONSTRAINT private_stage_payloads_bounded CHECK (
    octet_length(descriptor_payload::text) <= 1048576
    AND octet_length(snapshots_payload::text) <= 16777216
    AND octet_length(tail_high_water_payload::text) <= 1048576
  ),
  CONSTRAINT private_stage_expiry_order CHECK (expires_at > created_at)
);

CREATE INDEX private_publish_stages_expiry_idx
  ON community.private_publish_stages (expires_at, community_id);
`;
