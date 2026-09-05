#!/usr/bin/env bash
###############################################################################
# MyMail - DNS Record Validation
# Checks all required DNS records for email delivery
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
SERVER_IP="${SERVER_IP:-0.0.0.0}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass()  { echo -e "  ${GREEN}[PASS]${NC}  $*"; PASS=$((PASS + 1)); }
fail()  { echo -e "  ${RED}[FAIL]${NC}  $*"; FAIL=$((FAIL + 1)); }
warn()  { echo -e "  ${YELLOW}[WARN]${NC}  $*"; WARN=$((WARN + 1)); }
header(){ echo -e "\n${BLUE}--- $* ---${NC}"; }

if ! command -v dig &>/dev/null; then
    echo -e "${RED}Error: 'dig' is required but not installed.${NC}"
    echo "Install with: apt install dnsutils (Debian/Ubuntu) or yum install bind-utils (CentOS/RHEL)"
    exit 1
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  MyMail DNS Validation                        ${NC}"
echo -e "${BLUE}  Domain:   ${DOMAIN}${NC}"
echo -e "${BLUE}  Hostname: ${HOSTNAME}${NC}"
echo -e "${BLUE}  IP:       ${SERVER_IP}${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

# ─── A Record ──────────────────────────────────────────────────────────────
header "A Record (${HOSTNAME})"

a_record=$(dig +short A "$HOSTNAME" 2>/dev/null | head -1)
if [[ "$a_record" == "$SERVER_IP" ]]; then
    pass "${HOSTNAME} -> ${a_record}"
elif [[ -n "$a_record" ]]; then
    warn "${HOSTNAME} -> ${a_record} (expected ${SERVER_IP})"
else
    fail "No A record found for ${HOSTNAME}"
fi

# Admin subdomain
admin_a=$(dig +short A "admin.${DOMAIN}" 2>/dev/null | head -1)
if [[ -n "$admin_a" ]]; then
    pass "admin.${DOMAIN} -> ${admin_a}"
else
    warn "No A record for admin.${DOMAIN} (optional)"
fi

# ─── MX Record ─────────────────────────────────────────────────────────────
header "MX Record (${DOMAIN})"

mx_record=$(dig +short MX "$DOMAIN" 2>/dev/null)
if [[ -n "$mx_record" ]]; then
    while IFS= read -r line; do
        pass "MX: ${line}"
    done <<< "$mx_record"

    # Verify MX points to our hostname
    if echo "$mx_record" | grep -qi "${HOSTNAME}"; then
        pass "MX correctly points to ${HOSTNAME}"
    else
        warn "MX does not point to ${HOSTNAME}: ${mx_record}"
    fi
else
    fail "No MX record found for ${DOMAIN}"
fi

# ─── SPF Record ────────────────────────────────────────────────────────────
header "SPF Record (${DOMAIN})"

spf_record=$(dig +short TXT "$DOMAIN" 2>/dev/null | grep "v=spf1" | tr -d '"' || echo "")
if [[ -n "$spf_record" ]]; then
    pass "SPF found: ${spf_record}"

    if echo "$spf_record" | grep -q "mx\|a:${HOSTNAME}"; then
        pass "SPF includes mail server"
    else
        warn "SPF may not include ${HOSTNAME}"
    fi

    if echo "$spf_record" | grep -q "\-all"; then
        pass "SPF uses strict fail (-all)"
    elif echo "$spf_record" | grep -q "~all"; then
        warn "SPF uses soft fail (~all) - consider -all for production"
    else
        warn "SPF policy unclear"
    fi
else
    fail "No SPF record found for ${DOMAIN}"
    echo "    Expected: v=spf1 mx a:${HOSTNAME} ~all"
fi

# ─── DKIM Record ───────────────────────────────────────────────────────────
header "DKIM Record (mail._domainkey.${DOMAIN})"

dkim_record=$(dig +short TXT "mail._domainkey.${DOMAIN}" 2>/dev/null | tr -d '"' || echo "")
if [[ -n "$dkim_record" ]]; then
    pass "DKIM (Ed25519) found: ${dkim_record:0:60}..."
else
    fail "No DKIM record for mail._domainkey.${DOMAIN}"
fi

# RSA DKIM
dkim_rsa=$(dig +short TXT "mail-rsa._domainkey.${DOMAIN}" 2>/dev/null | tr -d '"' || echo "")
if [[ -n "$dkim_rsa" ]]; then
    pass "DKIM (RSA) found: ${dkim_rsa:0:60}..."
else
    warn "No RSA DKIM record (mail-rsa._domainkey.${DOMAIN}) - optional but recommended"
fi

# ─── DMARC Record ──────────────────────────────────────────────────────────
header "DMARC Record (_dmarc.${DOMAIN})"

dmarc_record=$(dig +short TXT "_dmarc.${DOMAIN}" 2>/dev/null | tr -d '"' || echo "")
if [[ -n "$dmarc_record" ]]; then
    pass "DMARC found: ${dmarc_record}"

    if echo "$dmarc_record" | grep -q "p=reject"; then
        pass "DMARC policy: reject (strictest)"
    elif echo "$dmarc_record" | grep -q "p=quarantine"; then
        pass "DMARC policy: quarantine"
    elif echo "$dmarc_record" | grep -q "p=none"; then
        warn "DMARC policy: none (monitoring only)"
    fi

    if echo "$dmarc_record" | grep -q "rua="; then
        pass "DMARC aggregate reports configured"
    else
        warn "No DMARC aggregate report address (rua=)"
    fi
else
    fail "No DMARC record for _dmarc.${DOMAIN}"
fi

# ─── PTR Record (Reverse DNS) ──────────────────────────────────────────────
header "PTR Record (Reverse DNS for ${SERVER_IP})"

if [[ "$SERVER_IP" != "0.0.0.0" && "$SERVER_IP" != "127.0.0.1" ]]; then
    reversed=$(echo "$SERVER_IP" | awk -F. '{print $4"."$3"."$2"."$1}')
    ptr_record=$(dig +short -x "$SERVER_IP" 2>/dev/null | head -1 | sed 's/\.$//')

    if [[ "$ptr_record" == "$HOSTNAME" ]]; then
        pass "PTR: ${SERVER_IP} -> ${ptr_record}"
    elif [[ -n "$ptr_record" ]]; then
        warn "PTR: ${SERVER_IP} -> ${ptr_record} (expected ${HOSTNAME})"
    else
        fail "No PTR record for ${SERVER_IP}"
        echo "    Contact your hosting provider to set: ${SERVER_IP} -> ${HOSTNAME}"
    fi
else
    warn "Skipping PTR check (SERVER_IP not set to a public address)"
fi

# ─── Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "  Results:  ${GREEN}${PASS} passed${NC}  ${RED}${FAIL} failed${NC}  ${YELLOW}${WARN} warnings${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

if [[ $FAIL -gt 0 ]]; then
    echo -e "${RED}Some DNS records are missing or misconfigured.${NC}"
    echo "Fix the failing records and run this script again."
    exit 1
else
    echo -e "${GREEN}All critical DNS records are configured correctly.${NC}"
fi
