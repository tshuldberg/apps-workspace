#!/usr/bin/env bash
###############################################################################
# MyMail - Backup Script
# Backs up mail data, configs, and databases to S3-compatible storage via restic
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

info()  { echo -e "${BLUE}[INFO]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $(date '+%Y-%m-%d %H:%M:%S') $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
error() { echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $*"; exit 1; }

BACKUP_ENABLED="${BACKUP_ENABLED:-false}"
BACKUP_S3_ENDPOINT="${BACKUP_S3_ENDPOINT:-}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_KEY="${BACKUP_S3_KEY:-}"
BACKUP_S3_SECRET="${BACKUP_S3_SECRET:-}"
BACKUP_RETENTION="${BACKUP_RETENTION:-30}"
RESTIC_PASSWORD="${RESTIC_PASSWORD:-}"

BACKUP_TEMP="/tmp/mymail-backup-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$PROJECT_DIR/logs/backup.log"

# ─── Pre-flight Checks ─────────────────────────────────────────────────────
preflight() {
    if [[ "$BACKUP_ENABLED" != "true" ]]; then
        error "Backups are disabled. Set BACKUP_ENABLED=true in .env"
    fi

    if ! command -v restic &>/dev/null; then
        error "restic is not installed. See https://restic.net"
    fi

    if [[ -z "$BACKUP_S3_ENDPOINT" || -z "$BACKUP_S3_BUCKET" ]]; then
        error "S3 endpoint and bucket must be configured in .env"
    fi

    if [[ -z "$BACKUP_S3_KEY" || -z "$BACKUP_S3_SECRET" ]]; then
        error "S3 credentials must be configured in .env"
    fi

    if [[ -z "$RESTIC_PASSWORD" ]]; then
        error "RESTIC_PASSWORD must be set in .env"
    fi

    mkdir -p "$BACKUP_TEMP" "$(dirname "$LOG_FILE")"
}

# ─── Export restic environment ──────────────────────────────────────────────
setup_restic_env() {
    export RESTIC_REPOSITORY="s3:https://${BACKUP_S3_ENDPOINT}/${BACKUP_S3_BUCKET}"
    export AWS_ACCESS_KEY_ID="$BACKUP_S3_KEY"
    export AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET"
    export RESTIC_PASSWORD

    # Initialize repo if needed (first run)
    if ! restic snapshots &>/dev/null; then
        info "Initializing restic repository..."
        restic init
        ok "Repository initialized"
    fi
}

# ─── Backup Phase ──────────────────────────────────────────────────────────
backup_data() {
    info "Starting backup..."

    # Pause mail acceptance briefly to ensure consistency
    info "Pausing SMTP acceptance for consistent snapshot..."
    docker exec mymail-stalwart sh -c "kill -STOP 1" 2>/dev/null || warn "Could not pause Stalwart (non-critical)"

    # Copy data out of Docker volumes
    info "Exporting Stalwart data..."
    docker cp mymail-stalwart:/opt/stalwart-mail/data "$BACKUP_TEMP/stalwart-data" 2>/dev/null || warn "Could not copy Stalwart data"

    info "Exporting Roundcube database..."
    docker cp mymail-roundcube:/var/roundcube/db "$BACKUP_TEMP/roundcube-db" 2>/dev/null || warn "Could not copy Roundcube DB"

    info "Exporting Redis data..."
    docker exec mymail-redis redis-cli BGSAVE 2>/dev/null || true
    sleep 2
    docker cp mymail-redis:/data/dump.rdb "$BACKUP_TEMP/redis-dump.rdb" 2>/dev/null || warn "Could not copy Redis dump"

    # Resume mail acceptance
    docker exec mymail-stalwart sh -c "kill -CONT 1" 2>/dev/null || true
    ok "SMTP acceptance resumed"

    # Copy configuration files
    info "Backing up configuration..."
    cp -r "$PROJECT_DIR/stalwart/config" "$BACKUP_TEMP/stalwart-config" 2>/dev/null || true
    cp -r "$PROJECT_DIR/rspamd/local.d" "$BACKUP_TEMP/rspamd-config" 2>/dev/null || true
    cp -r "$PROJECT_DIR/roundcube/config" "$BACKUP_TEMP/roundcube-config" 2>/dev/null || true
    cp -r "$PROJECT_DIR/caddy" "$BACKUP_TEMP/caddy-config" 2>/dev/null || true
    cp "$PROJECT_DIR/.env" "$BACKUP_TEMP/env-backup" 2>/dev/null || true
    cp "$PROJECT_DIR/docker-compose.yml" "$BACKUP_TEMP/docker-compose.yml" 2>/dev/null || true

    ok "Data export complete"
}

# ─── Push to restic ────────────────────────────────────────────────────────
push_backup() {
    info "Uploading to S3-compatible storage via restic..."

    restic backup "$BACKUP_TEMP" \
        --tag "mymail" \
        --tag "$(date +%Y-%m-%d)" \
        --verbose 2>&1 | tee -a "$LOG_FILE"

    ok "Backup uploaded successfully"
}

# ─── Verify ────────────────────────────────────────────────────────────────
verify_backup() {
    info "Verifying backup integrity..."

    if restic check --read-data-subset=5% 2>&1 | tee -a "$LOG_FILE"; then
        ok "Backup verification passed"
    else
        warn "Backup verification had issues - check logs"
    fi
}

# ─── Prune Old Backups ─────────────────────────────────────────────────────
prune_old() {
    info "Pruning backups older than ${BACKUP_RETENTION} days..."

    restic forget \
        --keep-daily 7 \
        --keep-weekly 4 \
        --keep-monthly 6 \
        --keep-within "${BACKUP_RETENTION}d" \
        --prune \
        --tag "mymail" 2>&1 | tee -a "$LOG_FILE"

    ok "Pruning complete"
}

# ─── Cleanup ───────────────────────────────────────────────────────────────
cleanup() {
    info "Cleaning up temporary files..."
    rm -rf "$BACKUP_TEMP"
    ok "Cleanup done"
}

# ─── Main ──────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  MyMail Backup - $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo ""

    trap cleanup EXIT

    preflight
    setup_restic_env
    backup_data
    push_backup
    verify_backup
    prune_old

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Backup completed successfully                ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""

    # Show recent snapshots
    restic snapshots --tag "mymail" --last 5
}

main "$@"
