#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"
MIGRATE_SCRIPT="$ROOT_DIR/scripts/migrate.sh"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env first."
  exit 1
fi

"$MIGRATE_SCRIPT"

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

CURRENT_YEAR="$(date +%Y)"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<SQL
INSERT INTO entitlements (id, token, entitlements_json, updated_at)
VALUES (
  'current',
  jsonb_build_object(
    'appId', 'mylife',
    'mode', 'self_host',
    'hostedActive', false,
    'selfHostLicense', true,
    'updatePackYear', ${CURRENT_YEAR},
    'features', jsonb_build_array('friends', 'sharing', 'self_host_core'),
    'issuedAt', to_char(NOW() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'signature', 'seed-signature'
  )::text,
  jsonb_build_object(
    'appId', 'mylife',
    'mode', 'self_host',
    'hostedActive', false,
    'selfHostLicense', true,
    'updatePackYear', ${CURRENT_YEAR},
    'features', jsonb_build_array('friends', 'sharing', 'self_host_core'),
    'issuedAt', to_char(NOW() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'signature', 'seed-signature'
  ),
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET token = EXCLUDED.token,
    entitlements_json = EXCLUDED.entitlements_json,
    updated_at = NOW();

INSERT INTO friend_invites (id, from_user_id, to_user_id, status, created_at, updated_at)
VALUES ('seed-invite-1', 'demo-alice', 'demo-bob', 'accepted', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO friendships (user_a, user_b, status, created_at)
VALUES
  ('demo-alice', 'demo-bob', 'accepted', NOW()),
  ('demo-bob', 'demo-alice', 'accepted', NOW())
ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'accepted';

INSERT INTO friend_messages (
  id,
  client_message_id,
  sender_user_id,
  recipient_user_id,
  content_type,
  content,
  created_at,
  read_at
)
VALUES
  (
    'seed-message-1',
    'seed-client-message-1',
    'demo-alice',
    'demo-bob',
    'text/plain',
    'Hey Bob, my local MyLife server is up.',
    NOW() - INTERVAL '10 minutes',
    NOW() - INTERVAL '8 minutes'
  ),
  (
    'seed-message-2',
    'seed-client-message-2',
    'demo-bob',
    'demo-alice',
    'text/plain',
    'Nice, I can see your message from my setup too.',
    NOW() - INTERVAL '5 minutes',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO share_events (
  id,
  actor_user_id,
  object_type,
  object_id,
  visibility,
  payload,
  created_at
)
VALUES (
  'seed-share-1',
  'demo-alice',
  'book_rating',
  'book-123',
  'friends',
  jsonb_build_object('rating', 5, 'note', 'Privacy-first bookshelf setup complete'),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
SQL

echo "Seed data applied successfully."
