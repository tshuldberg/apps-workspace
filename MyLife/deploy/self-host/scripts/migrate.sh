#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env first."
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  token TEXT NOT NULL,
  entitlements_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friend_invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

ALTER TABLE friend_invites
  ADD COLUMN IF NOT EXISTS message TEXT;

ALTER TABLE friend_invites
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

DO $$
DECLARE
  existing_constraint_name TEXT;
BEGIN
  SELECT c.conname INTO existing_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'friend_invites'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status IN%';

  IF existing_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE friend_invites DROP CONSTRAINT %I', existing_constraint_name);
  END IF;
END $$;

ALTER TABLE friend_invites
  ADD CONSTRAINT friend_invites_status_check
  CHECK (status IN ('pending', 'accepted', 'revoked', 'declined'));

CREATE INDEX IF NOT EXISTS idx_friend_invites_to_user
  ON friend_invites (to_user_id, status);

CREATE TABLE IF NOT EXISTS friendships (
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_a
  ON friendships (user_a, status);

CREATE TABLE IF NOT EXISTS friend_messages (
  id TEXT PRIMARY KEY,
  client_message_id TEXT UNIQUE,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text/plain', 'application/e2ee+ciphertext')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CHECK (sender_user_id <> recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_messages_conversation_created
  ON friend_messages (sender_user_id, recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_messages_recipient_unread
  ON friend_messages (recipient_user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS federation_message_outbox (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  client_message_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  recipient_user_id TEXT NOT NULL,
  recipient_server TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('text/plain', 'application/e2ee+ciphertext')),
  content TEXT NOT NULL,
  message_created_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retry', 'failed', 'sent')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  last_http_status INTEGER,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_message_id, recipient_server),
  FOREIGN KEY (message_id) REFERENCES friend_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_federation_message_outbox_schedule
  ON federation_message_outbox (status, next_attempt_at ASC);

CREATE INDEX IF NOT EXISTS idx_federation_message_outbox_recipient
  ON federation_message_outbox (recipient_server, status, next_attempt_at ASC);

CREATE TABLE IF NOT EXISTS federation_inbox_receipts (
  sender_server TEXT NOT NULL,
  client_message_id TEXT NOT NULL,
  message_id TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sender_server, client_message_id)
);

CREATE INDEX IF NOT EXISTS idx_federation_inbox_receipts_received
  ON federation_inbox_receipts (received_at DESC);

CREATE TABLE IF NOT EXISTS share_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('book_rating', 'book_review', 'list_item', 'generic')),
  object_id TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'friends', 'public')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_events_visibility_created
  ON share_events (visibility, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_events_actor_created
  ON share_events (actor_user_id, created_at DESC);
SQL

echo "Migrations applied successfully."
