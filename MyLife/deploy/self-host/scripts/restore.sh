#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <backup-directory>"
  exit 1
fi

BACKUP_DIR="$1"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env first."
  exit 1
fi

if [ ! -f "$BACKUP_DIR/postgres.sql" ]; then
  echo "Missing $BACKUP_DIR/postgres.sql"
  exit 1
fi

if [ ! -f "$BACKUP_DIR/minio-data.tgz" ]; then
  echo "Missing $BACKUP_DIR/minio-data.tgz"
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

echo "Restoring Postgres data..."
cat "$BACKUP_DIR/postgres.sql" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restoring MinIO data..."
cat "$BACKUP_DIR/minio-data.tgz" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T minio \
  sh -lc "rm -rf /data/* && mkdir -p /data && tar -C /data -xzf -"

echo "Restore complete from $BACKUP_DIR"
