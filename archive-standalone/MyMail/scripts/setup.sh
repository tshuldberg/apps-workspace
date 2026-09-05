#!/usr/bin/env bash
###############################################################################
# MyMail - Initial Setup Script
# Configures environment, generates keys, starts services
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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

# ─── Prerequisites ──────────────────────────────────────────────────────────
check_prerequisites() {
    info "Checking prerequisites..."

    if ! command -v docker &>/dev/null; then
        error "Docker is not installed. See https://docs.docker.com/get-docker/"
    fi
    ok "Docker found: $(docker --version)"

    if ! docker compose version &>/dev/null; then
        error "Docker Compose v2 is required. See https://docs.docker.com/compose/install/"
    fi
    ok "Docker Compose found: $(docker compose version --short)"

    if ! command -v openssl &>/dev/null; then
        error "OpenSSL is not installed."
    fi
    ok "OpenSSL found"
}

# ─── Environment Setup ─────────────────────────────────────────────────────
setup_env() {
    local env_file="$PROJECT_DIR/.env"

    if [[ -f "$env_file" ]]; then
        warn ".env already exists. Skipping creation."
        warn "Edit $env_file manually to make changes."
        return
    fi

    cp "$PROJECT_DIR/.env.example" "$env_file"
    info "Created .env from template."

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}       MyMail - Initial Configuration          ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo ""

    # Domain
    read -rp "Enter your domain (e.g., example.com): " domain
    [[ -z "$domain" ]] && error "Domain is required."
    sed -i "s|^DOMAIN=.*|DOMAIN=${domain}|" "$env_file"

    # Hostname
    local default_hostname="mail.${domain}"
    read -rp "Mail hostname [${default_hostname}]: " hostname
    hostname="${hostname:-$default_hostname}"
    sed -i "s|^HOSTNAME=.*|HOSTNAME=${hostname}|" "$env_file"

    # Server IP
    local detected_ip
    detected_ip=$(curl -4 -sf https://ifconfig.me 2>/dev/null || echo "")
    if [[ -n "$detected_ip" ]]; then
        info "Detected public IP: $detected_ip"
    fi
    read -rp "Server public IP [${detected_ip}]: " server_ip
    server_ip="${server_ip:-$detected_ip}"
    [[ -z "$server_ip" ]] && error "Server IP is required."
    sed -i "s|^SERVER_IP=.*|SERVER_IP=${server_ip}|" "$env_file"

    # Admin email
    local default_admin="admin@${domain}"
    read -rp "Admin email [${default_admin}]: " admin_email
    admin_email="${admin_email:-$default_admin}"
    sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${admin_email}|" "$env_file"

    # Generate admin password
    local admin_pass
    admin_pass=$(openssl rand -base64 18 | tr -d '=/+' | head -c 20)
    sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${admin_pass}|" "$env_file"
    ok "Generated admin password (saved to .env)"
    echo -e "  ${YELLOW}Admin password: ${admin_pass}${NC}"
    echo -e "  ${YELLOW}Save this securely - it won't be shown again.${NC}"

    # Generate Roundcube des_key
    local des_key
    des_key=$(openssl rand -hex 12)
    local rc_config="$PROJECT_DIR/roundcube/config/config.inc.php"
    if [[ -f "$rc_config" ]]; then
        sed -i "s|CHANGE-THIS-24CHAR-KEY!|${des_key}|" "$rc_config"
    fi

    # Generate restic backup password
    local restic_pass
    restic_pass=$(openssl rand -base64 32)
    sed -i "s|^RESTIC_PASSWORD=.*|RESTIC_PASSWORD=${restic_pass}|" "$env_file"

    ok "Environment configured."
}

# ─── DKIM Key Generation ───────────────────────────────────────────────────
generate_dkim_keys() {
    local dkim_dir="$PROJECT_DIR/stalwart/config/dkim"
    mkdir -p "$dkim_dir"

    if [[ -f "$dkim_dir/private.key" ]]; then
        warn "DKIM keys already exist. Skipping generation."
        return
    fi

    info "Generating DKIM keys..."

    # Ed25519 key (modern, compact)
    openssl genpkey -algorithm ED25519 -out "$dkim_dir/private.key" 2>/dev/null
    openssl pkey -in "$dkim_dir/private.key" -pubout -out "$dkim_dir/public.key" 2>/dev/null
    ok "Ed25519 DKIM key generated"

    # RSA key (legacy compatibility)
    openssl genrsa -out "$dkim_dir/rsa-private.key" 2048 2>/dev/null
    openssl rsa -in "$dkim_dir/rsa-private.key" -pubout -out "$dkim_dir/rsa-public.key" 2>/dev/null
    ok "RSA-2048 DKIM key generated"

    # Set permissions
    chmod 600 "$dkim_dir/private.key" "$dkim_dir/rsa-private.key"
    chmod 644 "$dkim_dir/public.key" "$dkim_dir/rsa-public.key"
}

# ─── Display DNS Records ───────────────────────────────────────────────────
display_dns_records() {
    # Source .env for variable values
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/.env"
    set +a

    local dkim_dir="$PROJECT_DIR/stalwart/config/dkim"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}        Required DNS Records                   ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo ""

    # A record
    echo -e "${GREEN}1. A Record${NC}"
    echo "   ${HOSTNAME}.  IN  A  ${SERVER_IP}"
    echo ""

    # MX record
    echo -e "${GREEN}2. MX Record${NC}"
    echo "   ${DOMAIN}.  IN  MX  10  ${HOSTNAME}."
    echo ""

    # SPF record
    echo -e "${GREEN}3. SPF Record${NC}"
    echo "   ${DOMAIN}.  IN  TXT  \"v=spf1 mx a:${HOSTNAME} ~all\""
    echo ""

    # DKIM record (Ed25519)
    if [[ -f "$dkim_dir/public.key" ]]; then
        local ed_pubkey
        ed_pubkey=$(grep -v '^-' "$dkim_dir/public.key" | tr -d '\n')
        echo -e "${GREEN}4. DKIM Record (Ed25519)${NC}"
        echo "   mail._domainkey.${DOMAIN}.  IN  TXT  \"v=DKIM1; k=ed25519; p=${ed_pubkey}\""
        echo ""
    fi

    # DKIM record (RSA)
    if [[ -f "$dkim_dir/rsa-public.key" ]]; then
        local rsa_pubkey
        rsa_pubkey=$(grep -v '^-' "$dkim_dir/rsa-public.key" | tr -d '\n')
        echo -e "${GREEN}5. DKIM Record (RSA)${NC}"
        echo "   mail-rsa._domainkey.${DOMAIN}.  IN  TXT  \"v=DKIM1; k=rsa; p=${rsa_pubkey}\""
        echo ""
    fi

    # DMARC record
    echo -e "${GREEN}6. DMARC Record${NC}"
    echo "   _dmarc.${DOMAIN}.  IN  TXT  \"v=DMARC1; p=quarantine; rua=mailto:dmarc@${DOMAIN}; ruf=mailto:dmarc@${DOMAIN}; fo=1\""
    echo ""

    # PTR record
    echo -e "${GREEN}7. PTR (Reverse DNS)${NC}"
    echo "   Set PTR record for ${SERVER_IP} -> ${HOSTNAME}"
    echo "   (Configure through your hosting provider's control panel)"
    echo ""

    # Admin subdomain
    echo -e "${GREEN}8. Admin Panel A Record${NC}"
    echo "   admin.${DOMAIN}.  IN  A  ${SERVER_IP}"
    echo ""

    # JMAP subdomain
    echo -e "${GREEN}9. JMAP/API A Record${NC}"
    echo "   jmap.${DOMAIN}.  IN  A  ${SERVER_IP}"
    echo ""

    echo -e "${YELLOW}Add ALL records above to your DNS provider before continuing.${NC}"
    echo -e "${YELLOW}DNS propagation may take up to 48 hours.${NC}"
    echo ""
}

# ─── Start Services ────────────────────────────────────────────────────────
start_services() {
    info "Starting MyMail services..."
    cd "$PROJECT_DIR"

    docker compose pull
    docker compose up -d

    info "Waiting for services to become healthy..."
    local max_wait=120
    local elapsed=0
    while [[ $elapsed -lt $max_wait ]]; do
        local unhealthy
        unhealthy=$(docker compose ps --format json 2>/dev/null | \
            python3 -c "import sys,json; [print(l) for l in sys.stdin if json.loads(l).get('Health','') not in ('healthy','')]" 2>/dev/null | wc -l || echo "0")

        if [[ "$unhealthy" -eq 0 ]]; then
            ok "All services are healthy!"
            return
        fi

        sleep 5
        elapsed=$((elapsed + 5))
        echo -ne "\r  Waiting... ${elapsed}s / ${max_wait}s"
    done
    echo ""
    warn "Some services may not be healthy yet. Check with: docker compose ps"
}

# ─── Run Health Check ──────────────────────────────────────────────────────
run_health_check() {
    if [[ -x "$SCRIPT_DIR/health-check.sh" ]]; then
        info "Running health check..."
        "$SCRIPT_DIR/health-check.sh" || true
    fi
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         MyMail - Setup Wizard                 ║${NC}"
    echo -e "${BLUE}║     Personal Email Server Deployment          ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
    echo ""

    check_prerequisites
    setup_env
    generate_dkim_keys
    display_dns_records

    read -rp "Proceed with starting services? [Y/n]: " proceed
    proceed="${proceed:-Y}"
    if [[ "${proceed,,}" != "y" ]]; then
        info "Setup paused. Run 'docker compose up -d' when ready."
        exit 0
    fi

    start_services
    run_health_check

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  MyMail setup complete!                       ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    echo "  Webmail:  https://${HOSTNAME:-mail.example.com}"
    echo "  Admin:    https://admin.${DOMAIN:-example.com}"
    echo ""
}

main "$@"
