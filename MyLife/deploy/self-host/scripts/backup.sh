#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
ENV_FILE="$ROOT_DIR/.env"
BACKUP_ROOT="$ROOT_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$STAMP"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example to .env first."
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"

echo "Creating Postgres dump..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_DIR/postgres.sql"

echo "Archiving MinIO data..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T minio \
  sh -lc "tar -C /data -czf - ." > "$BACKUP_DIR/minio-data.tgz"

cat > "$BACKUP_DIR/metadata.txt" <<META
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
postgres_db=$POSTGRES_DB
minio_bucket=${MINIO_BUCKET:-mylife-objects}
META

echo "Backup complete: $BACKUP_DIR"
