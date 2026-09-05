#!/usr/bin/env bash
###############################################################################
# MyMail - Health Check Script
# Verifies all services are running and ports are accessible
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

DOMAIN="${DOMAIN:-example.com}"
HOSTNAME="${HOSTNAME:-mail.example.com}"
SERVER_IP="${SERVER_IP:-127.0.0.1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}[PASS]${NC} $*"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}[FAIL]${NC} $*"; FAIL=$((FAIL + 1)); }
skip() { echo -e "  ${YELLOW}[WARN]${NC} $*"; WARN=$((WARN + 1)); }

echo ""
echo "==========================================="
echo "  MyMail Health Check"
echo "==========================================="
echo ""

# ─── Docker Containers ─────────────────────────────────────────────────────
echo "--- Docker Containers ---"

containers=("mymail-caddy" "mymail-stalwart" "mymail-rspamd" "mymail-redis" "mymail-roundcube" "mymail-admin")
for c in "${containers[@]}"; do
    status=$(docker inspect --format='{{.State.Status}}' "$c" 2>/dev/null || echo "not_found")
    health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no_healthcheck{{end}}' "$c" 2>/dev/null || echo "unknown")

    if [[ "$status" == "running" && ("$health" == "healthy" || "$health" == "no_healthcheck") ]]; then
        pass "$c: running ($health)"
    elif [[ "$status" == "running" ]]; then
        skip "$c: running but $health"
    else
        fail "$c: $status"
    fi
done

echo ""

# ─── Port Checks ───────────────────────────────────────────────────────────
echo "--- Port Checks ---"

check_port() {
    local host="$1" port="$2" desc="$3"
    if timeout 5 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
        pass "$desc ($host:$port)"
    else
        fail "$desc ($host:$port)"
    fi
}

check_port "127.0.0.1" 25   "SMTP inbound"
check_port "127.0.0.1" 465  "SMTPS"
check_port "127.0.0.1" 587  "SMTP submission"
check_port "127.0.0.1" 993  "IMAPS"
check_port "127.0.0.1" 80   "HTTP"
check_port "127.0.0.1" 443  "HTTPS"
check_port "127.0.0.1" 4190 "ManageSieve"

echo ""

# ─── HTTPS Check ───────────────────────────────────────────────────────────
echo "--- HTTPS ---"

if command -v curl &>/dev/null; then
    http_code=$(curl -sf -o /dev/null -w "%{http_code}" "https://${HOSTNAME}" --max-time 10 2>/dev/null || echo "000")
    if [[ "$http_code" -ge 200 && "$http_code" -lt 400 ]]; then
        pass "Webmail HTTPS responding (HTTP $http_code)"
    elif [[ "$http_code" == "000" ]]; then
        skip "HTTPS not reachable (may be DNS or cert issue)"
    else
        fail "Webmail HTTPS returned $http_code"
    fi

    admin_code=$(curl -sf -o /dev/null -w "%{http_code}" "https://admin.${DOMAIN}" --max-time 10 2>/dev/null || echo "000")
    if [[ "$admin_code" -ge 200 && "$admin_code" -lt 400 ]]; then
        pass "Admin panel HTTPS responding (HTTP $admin_code)"
    elif [[ "$admin_code" == "000" ]]; then
        skip "Admin HTTPS not reachable"
    else
        fail "Admin HTTPS returned $admin_code"
    fi
else
    skip "curl not available, skipping HTTPS checks"
fi

echo ""

# ─── DNS Checks ────────────────────────────────────────────────────────────
echo "--- DNS Records ---"

if command -v dig &>/dev/null; then
    # MX record
    mx=$(dig +short MX "$DOMAIN" 2>/dev/null | head -1)
    if [[ -n "$mx" ]]; then
        pass "MX record: $mx"
    else
        fail "No MX record found for $DOMAIN"
    fi

    # A record
    a_record=$(dig +short A "$HOSTNAME" 2>/dev/null | head -1)
    if [[ "$a_record" == "$SERVER_IP" ]]; then
        pass "A record: $HOSTNAME -> $a_record"
    elif [[ -n "$a_record" ]]; then
        skip "A record: $HOSTNAME -> $a_record (expected $SERVER_IP)"
    else
        fail "No A record for $HOSTNAME"
    fi

    # SPF
    spf=$(dig +short TXT "$DOMAIN" 2>/dev/null | grep "v=spf1" || echo "")
    if [[ -n "$spf" ]]; then
        pass "SPF record found"
    else
        fail "No SPF record for $DOMAIN"
    fi

    # DKIM
    dkim=$(dig +short TXT "mail._domainkey.$DOMAIN" 2>/dev/null | head -1)
    if [[ -n "$dkim" ]]; then
        pass "DKIM record found (mail._domainkey)"
    else
        fail "No DKIM record for mail._domainkey.$DOMAIN"
    fi

    # DMARC
    dmarc=$(dig +short TXT "_dmarc.$DOMAIN" 2>/dev/null | head -1)
    if [[ -n "$dmarc" ]]; then
        pass "DMARC record found"
    else
        fail "No DMARC record for _dmarc.$DOMAIN"
    fi
else
    skip "dig not available, skipping DNS checks"
fi

echo ""

# ─── Blacklist Check ───────────────────────────────────────────────────────
echo "--- IP Blacklist Check ---"

if command -v dig &>/dev/null && [[ "$SERVER_IP" != "0.0.0.0" && "$SERVER_IP" != "127.0.0.1" ]]; then
    reversed=$(echo "$SERVER_IP" | awk -F. '{print $4"."$3"."$2"."$1}')
    blacklists=("zen.spamhaus.org" "bl.spamcop.net" "b.barracudacentral.org" "dnsbl.sorbs.net")

    for bl in "${blacklists[@]}"; do
        result=$(dig +short "${reversed}.${bl}" 2>/dev/null || echo "")
        if [[ -z "$result" ]]; then
            pass "Not listed on $bl"
        else
            fail "Listed on $bl ($result)"
        fi
    done
else
    skip "Skipping blacklist check (no valid public IP)"
fi

echo ""

# ─── Summary ───────────────────────────────────────────────────────────────
echo "==========================================="
echo -e "  Results:  ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}  ${YELLOW}$WARN warnings${NC}"
echo "==========================================="
echo ""

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
exit 0
