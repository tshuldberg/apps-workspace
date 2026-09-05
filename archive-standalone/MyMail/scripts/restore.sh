#!/usr/bin/env bash
###############################################################################
# MyMail - Restore Script
# Restores mail data from a restic backup snapshot
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/.env"
    set +a
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_KEY="${BACKUP_S3_KEY:-}"
BACKUP_S3_SECRET="${BACKUP_S3_SECRET:-}"
RESTIC_PASSWORD="${RESTIC_PASSWORD:-}"

RESTORE_TEMP="/tmp/mymail-restore-$(date +%Y%m%d-%H%M%S)"

# ─── Pre-flight ────────────────────────────────────────────────────────────
preflight() {
    if ! command -v restic &>/dev/null; then
        error "restic is not installed. See https://restic.net"
    fi

    if [[ -z "$BACKUP_S3_ENDPOINT" || -z "$BACKUP_S3_BUCKET" || -z "$RESTIC_PASSWORD" ]]; then
        error "Backup configuration incomplete. Check .env"
    fi

    export RESTIC_REPOSITORY="s3:https://${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}"
    export AWS_ACCESS_KEY_ID="$BACKUP_S3_KEY"
    export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET"
    export RESTIC_PASSWORD

    mkdir -p "$RESTORE_TEMP"
}

# ─── List Available Backups ────────────────────────────────────────────────
list_backups() {
    info "Available backups:"
    echo ""
    restic snapshots --tag "mymail" --compact
    echo ""
}

# ─── Select Snapshot ───────────────────────────────────────────────────────
select_snapshot() {
    local snapshot_id="${1:-}"

    if [[ -z "$snapshot_id" ]]; then
        list_backups
        read -rp "Enter snapshot ID to restore (or 'latest'): " snapshot_id
    fi

    if [[ -z "$snapshot_id" ]]; then
        error "No snapshot ID provided."
    fi

    SNAPSHOT="$snapshot_id"
    info "Selected snapshot: $SNAPSHOT"
}

# ─── Stop Services ─────────────────────────────────────────────────────────
stop_services() {
    echo ""
    echo -e "${YELLOW}WARNING: This will stop all MyMail services and replace data.${NC}"
    echo -e "${YELLOW}Current data will be overwritten by the backup.${NC}"
    echo ""
    read -rp "Are you sure you want to continue? (type YES to confirm): " confirm

    if [[ "$confirm" != "YES" ]]; then
        info "Restore cancelled."
        exit 0
    fi

    info "Stopping MyMail services..."
    cd "$PROJECT_DIR"
    docker compose down
    ok "Services stopped"
}

# ─── Restore Data ──────────────────────────────────────────────────────────
restore_data() {
    info "Downloading backup snapshot ${SNAPSHOT}..."
    restic restore "$SNAPSHOT" --target "$RESTORE_TEMP"
    ok "Snapshot downloaded"

    # Find the backup directory (restic creates nested dirs based on backup path)
    local backup_dir
    backup_dir=$(find "$RESTORE_TEMP" -name "stalwart-data" -type d -exec dirname {} \; | head -1)

    if [[ -z "$backup_dir" ]]; then
        error "Could not find backup data in snapshot. Corrupt backup?"
    fi

    info "Restoring Stalwart mail data..."
    if [[ -d "$backup_dir/stalwart-data" ]]; then
        # Remove existing data and replace with backup
        docker volume rm mymail_stalwart_data 2>/dev/null || true
        docker volume create mymail_stalwart_data
        # Use a temp container to copy data into the volume
        docker run --rm -v mymail_stalwart_data:/data -v "$backup_dir/stalwart-data":/backup alpine \
            sh -c "cp -a /backup/* /data/"
        ok "Stalwart data restored"
    else
        warn "No Stalwart data in backup"
    fi

    info "Restoring Roundcube database..."
    if [[ -d "$backup_dir/roundcube-db" ]]; then
        docker volume rm mymail_roundcube_data 2>/dev/null || true
        docker volume create mymail_roundcube_data
        docker run --rm -v mymail_roundcube_data:/data -v "$backup_dir/roundcube-db":/backup alpine \
            sh -c "cp -a /backup/* /data/"
        ok "Roundcube database restored"
    else
        warn "No Roundcube database in backup"
    fi

    info "Restoring Redis data..."
    if [[ -f "$backup_dir/redis-dump.rdb" ]]; then
        docker volume rm mymail_redis_data 2>/dev/null || true
        docker volume create mymail_redis_data
        docker run --rm -v mymail_redis_data:/data -v "$backup_dir":/backup alpine \
            sh -c "cp /backup/redis-dump.rdb /data/dump.rdb"
        ok "Redis data restored"
    else
        warn "No Redis dump in backup"
    fi

    info "Restoring configuration files..."
    if [[ -d "$backup_dir/stalwart-config" ]]; then
        cp -r "$backup_dir/stalwart-config/"* "$PROJECT_DIR/stalwart/config/" 2>/dev/null || true
        ok "Stalwart config restored"
    fi
    if [[ -d "$backup_dir/rspamd-config" ]]; then
        cp -r "$backup_dir/rspamd-config/"* "$PROJECT_DIR/rspamd/local.d/" 2>/dev/null || true
        ok "Rspamd config restored"
    fi
    if [[ -d "$backup_dir/roundcube-config" ]]; then
        cp -r "$backup_dir/roundcube-config/"* "$PROJECT_DIR/roundcube/config/" 2>/dev/null || true
        ok "Roundcube config restored"
    fi
    if [[ -f "$backup_dir/env-backup" ]]; then
        cp "$backup_dir/env-backup" "$PROJECT_DIR/.env"
        ok "Environment file restored"
    fi
}

# ─── Restart Services ──────────────────────────────────────────────────────
restart_services() {
    info "Starting MyMail services..."
    cd "$PROJECT_DIR"
    docker compose up -d
    ok "Services started"

    info "Waiting for services to become healthy..."
    sleep 15

    local unhealthy
    unhealthy=$(docker compose ps | grep -c "unhealthy\|Exit" || echo "0")
    if [[ "$unhealthy" -eq 0 ]]; then
        ok "All services are healthy"
    else
        warn "Some services may need attention. Check: docker compose ps"
    fi
}

# ─── Cleanup ───────────────────────────────────────────────────────────────
cleanup() {
    rm -rf "$RESTORE_TEMP"
}

# ─── Main ──────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  MyMail - Backup Restore                      ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo ""

    trap cleanup EXIT

    preflight
    select_snapshot "${1:-}"
    stop_services
    restore_data
    restart_services

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Restore completed successfully               ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    echo "  Verify by logging into webmail and checking your email."
    echo "  Run ./scripts/health-check.sh for a full system check."
    echo ""
}

main "$@"
