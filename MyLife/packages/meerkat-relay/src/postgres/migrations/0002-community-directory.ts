export const COMMUNITY_DIRECTORY_SQL = `
CREATE TABLE community.descriptor_revisions (
  community_id text PRIMARY KEY,
  revision bigint NOT NULL,
  descriptor_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT descriptor_revision_nonnegative CHECK (revision >= 0),
  CONSTRAINT descriptor_hash_present CHECK (length(descriptor_hash) BETWEEN 1 AND 256)
);

CREATE TABLE community.publications (
  publication_id text PRIMARY KEY,
  descriptor_revision bigint NOT NULL,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT publication_revision_nonnegative CHECK (descriptor_revision >= 0),
  CONSTRAINT publication_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE community.kills (
  community_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT kill_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE community.reports (
  publication_id text NOT NULL,
  report_key text NOT NULL,
  reason text,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (publication_id, report_key),
  CONSTRAINT report_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX reports_publication_received_idx
  ON community.reports (publication_id, received_at DESC, report_key DESC);

CREATE TABLE community.public_posts (
  publication_id text NOT NULL,
  post_id text NOT NULL,
  persona_pubkey text NOT NULL,
  accepted_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (publication_id, post_id),
  CONSTRAINT public_post_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX public_posts_page_idx
  ON community.public_posts (publication_id, accepted_at, post_id);

CREATE TABLE community.public_post_tombstones (
  publication_id text NOT NULL,
  post_id text NOT NULL,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (publication_id, post_id),
  CONSTRAINT public_post_tombstone_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE community.publication_freezes (
  publication_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT publication_freeze_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE community.public_submit_windows (
  publication_id text NOT NULL,
  persona_key text NOT NULL,
  timestamps_ms bigint[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (publication_id, persona_key)
);

CREATE TABLE community.blocked_personas (
  persona_pubkey text PRIMARY KEY,
  blocked_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE directory.publications (
  publication_id text PRIMARY KEY,
  signed_record text NOT NULL,
  rids text[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX directory_publications_expiry_idx
  ON directory.publications (expires_at, publication_id);

CREATE INDEX directory_publications_rids_idx
  ON directory.publications USING gin (rids);

CREATE TABLE directory.kills (
  community_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT directory_kill_payload_object CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE directory.host_announcements (
  rid text NOT NULL,
  announcer_hash text NOT NULL,
  opaque_record text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (rid, announcer_hash)
);

CREATE INDEX directory_host_announcements_expiry_idx
  ON directory.host_announcements (expires_at, rid, announcer_hash);

`;
