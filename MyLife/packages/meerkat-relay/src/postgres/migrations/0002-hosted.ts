export const HOSTED_SQL = `
CREATE TABLE hosted.subscriptions (
  subject_id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text,
  provider_event_at timestamptz,
  active boolean NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT hosted_subscription_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE UNIQUE INDEX hosted_subscription_provider_event_idx
  ON hosted.subscriptions (provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE TABLE hosted.app_purchases (
  subject_id text PRIMARY KEY,
  product_id text NOT NULL,
  rail text NOT NULL,
  active boolean NOT NULL,
  provider_event_id text,
  provider_event_at timestamptz,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT hosted_app_purchase_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE UNIQUE INDEX hosted_app_purchase_provider_event_idx
  ON hosted.app_purchases (rail, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE TABLE hosted.app_links (
  code_hash text PRIMARY KEY,
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CONSTRAINT hosted_app_link_expiry_order CHECK (expires_at > created_at)
);

CREATE INDEX hosted_app_links_expiry_idx
  ON hosted.app_links (expires_at, code_hash);

CREATE TABLE hosted.app_persona_bindings (
  subject_id text PRIMARY KEY,
  persona_hash text NOT NULL UNIQUE,
  bound_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE hosted.storage_tenants (
  subject_id text PRIMARY KEY,
  cap_bytes bigint NOT NULL,
  reserved_bytes bigint NOT NULL DEFAULT 0,
  committed_bytes bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT hosted_storage_cap_positive CHECK (cap_bytes > 0),
  CONSTRAINT hosted_storage_counts_nonnegative CHECK (reserved_bytes >= 0 AND committed_bytes >= 0),
  CONSTRAINT hosted_storage_within_cap CHECK (reserved_bytes + committed_bytes <= cap_bytes)
);

CREATE TABLE hosted.storage_objects (
  subject_id text NOT NULL REFERENCES hosted.storage_tenants(subject_id) ON DELETE CASCADE,
  content_id text NOT NULL,
  block_index integer NOT NULL,
  object_key text NOT NULL UNIQUE,
  checksum text NOT NULL,
  size_bytes bigint NOT NULL,
  version_id text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  PRIMARY KEY (subject_id, content_id, block_index),
  CONSTRAINT hosted_storage_block_nonnegative CHECK (block_index >= 0),
  CONSTRAINT hosted_storage_size_nonnegative CHECK (size_bytes >= 0)
);

CREATE TABLE hosted.seeder_manifests (
  subject_id text NOT NULL REFERENCES hosted.storage_tenants(subject_id) ON DELETE CASCADE,
  content_id text NOT NULL,
  manifest jsonb NOT NULL,
  is_pinned boolean NOT NULL,
  auto_delete_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (subject_id, content_id),
  CONSTRAINT hosted_seeder_manifest_object CHECK (jsonb_typeof(manifest) = 'object')
);

CREATE INDEX hosted_seeder_manifests_expiry_idx
  ON hosted.seeder_manifests (auto_delete_at, subject_id, content_id)
  WHERE auto_delete_at IS NOT NULL AND NOT is_pinned;

`;
