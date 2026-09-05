#!/usr/bin/env bash
#
# mynews-smoke.sh
#
# WHAT IT DOES
#   Probes a deployed MyNews edge surface over HTTPS and proves four things
#   that a broken deploy would get wrong:
#     1. mynews-health answers 200 with a top-level status of ok or degraded.
#     2. An unauthenticated POST to mynews-publish is refused with 401, so the
#        gateway JWT gate is live.
#     3. An unauthenticated POST to mynews-report is refused with 401.
#     4. A POST to mynews-account-worker with no worker secret is refused with
#        401 (wrong secret) or 503 (secret not configured), never 200.
#
# WHAT IT CANNOT DO
#   It cannot configure, repair, or provision anything. It cannot prove data
#   correctness, RLS policy behaviour, or that a cron job is scheduled. It only
#   observes HTTP responses from whatever origin you point it at. Live Supabase
#   project operations (secrets, PITR, cron rows, DNS) are founder-ops and
#   happen outside this repo.
#
# A failing probe is reported as a failure. This script never prints a passing
# line it did not earn, and never invents a URL or a credential.

set -euo pipefail

readonly REQUIRED_ENV=(
  "MYNEWS_FUNCTIONS_URL"
  "MYNEWS_SMOKE_ANON_KEY"
)

DRY_RUN=0
MAX_TIME="${MYNEWS_SMOKE_MAX_TIME:-20}"

usage() {
  cat <<'EOF'
Usage: scripts/mynews-smoke.sh [--dry-run] [--help]

Probes a deployed MyNews edge surface. Read-only: it sends requests that are
expected to be REFUSED, so it never creates, mutates, or deletes anything.

  --dry-run   print the exact curl commands that would run, then exit 0.
              Credentials are still validated first: a dry run with missing
              credentials exits 2, because a dry run that pretends the config
              is fine is a lie.
  --help      print this and exit 0.

Required environment:
  MYNEWS_FUNCTIONS_URL    functions origin to probe, for example
                          https://<project-ref>.supabase.co/functions/v1
  MYNEWS_SMOKE_ANON_KEY   publishable anon key sent as the apikey header, so
                          the gateway routes the request to the function and
                          returns the function's real 401 rather than a
                          gateway-level rejection

Optional environment:
  MYNEWS_SMOKE_MAX_TIME   per-probe curl timeout in seconds (default 20)

Exit codes:
  0  every probe passed
  1  at least one probe failed
  2  a required tool, credential, or argument is missing
EOF
}

# --- argument parsing -------------------------------------------------------

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      printf 'missing: valid arguments (unknown argument %s; see --help)\n' "$1" >&2
      printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
      exit 2
      ;;
  esac
done

# --- credential and tool validation, before anything else -------------------

MISSING=()

if ! command -v curl >/dev/null 2>&1; then
  MISSING+=("tool curl (HTTP client, used to send every probe)")
fi

for name in "${REQUIRED_ENV[@]}"; do
  value="${!name-}"
  if [ -z "${value:-}" ]; then
    case "$name" in
      MYNEWS_FUNCTIONS_URL)
        MISSING+=("MYNEWS_FUNCTIONS_URL (functions origin to probe, for example https://<project-ref>.supabase.co/functions/v1)")
        ;;
      MYNEWS_SMOKE_ANON_KEY)
        MISSING+=("MYNEWS_SMOKE_ANON_KEY (publishable anon key sent as the apikey header so the gateway reaches the function)")
        ;;
    esac
  fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  for item in "${MISSING[@]}"; do
    printf 'missing: %s\n' "$item" >&2
  done
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

BASE="${MYNEWS_FUNCTIONS_URL%/}"

# --- probe definitions ------------------------------------------------------
#
# Each probe is "name|method|path|expected-codes". Expected codes are a
# space-separated list; the health probe additionally inspects the body.

PROBES=(
  "mynews-health|GET|mynews-health|200"
  "mynews-publish-jwt-gate|POST|mynews-publish|401"
  "mynews-report-jwt-gate|POST|mynews-report|401"
  "mynews-account-worker-secret-gate|POST|mynews-account-worker|401 503"
)

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'dry-run: %s probes against %s\n' "${#PROBES[@]}" "$BASE"
  for probe in "${PROBES[@]}"; do
    IFS='|' read -r name method probe_path expected <<<"$probe"
    printf 'dry-run: curl --silent --show-error --max-time %s --request %s --header "apikey: <MYNEWS_SMOKE_ANON_KEY>" --write-out "%%{http_code}" --output <body-file> %s/%s   # probe %s expects HTTP %s\n' \
      "$MAX_TIME" "$method" "$BASE" "$probe_path" "$name" "$expected"
  done
  printf 'dry-run: no request was sent and no file was written\n'
  exit 0
fi

# --- run the probes ---------------------------------------------------------

BODY_FILE="$(mktemp -t mynews-smoke-body)"
cleanup() { rm -f "$BODY_FILE"; }
trap cleanup EXIT

TOTAL=0
FAILED=0
FAILED_NAMES=()

code_matches() {
  local code="$1"
  shift
  local candidate
  for candidate in $1; do
    if [ "$code" = "$candidate" ]; then
      return 0
    fi
  done
  return 1
}

for probe in "${PROBES[@]}"; do
  IFS='|' read -r name method probe_path expected <<<"$probe"
  TOTAL=$((TOTAL + 1))

  set +e
  http_code="$(
    curl --silent --show-error \
      --max-time "$MAX_TIME" \
      --request "$method" \
      --header "apikey: ${MYNEWS_SMOKE_ANON_KEY}" \
      --header 'Content-Type: application/json' \
      --write-out '%{http_code}' \
      --output "$BODY_FILE" \
      "$BASE/$probe_path" 2>/dev/null
  )"
  curl_status=$?
  set -e

  if [ "$curl_status" -ne 0 ] || [ -z "$http_code" ]; then
    printf 'probe: %s ... FAIL (got HTTP none, expected %s; curl exit %s)\n' \
      "$name" "$expected" "$curl_status"
    FAILED=$((FAILED + 1))
    FAILED_NAMES+=("$name")
    continue
  fi

  if ! code_matches "$http_code" "$expected"; then
    printf 'probe: %s ... FAIL (got HTTP %s, expected %s)\n' "$name" "$http_code" "$expected"
    FAILED=$((FAILED + 1))
    FAILED_NAMES+=("$name")
    continue
  fi

  # The health probe has to look at the body, not just the status code. The
  # shallow (uncredentialed) envelope is
  #   {"ok":true,"data":{"status":"ok"|"degraded","checkedAt":...,"detailAvailable":bool}}
  # on 200, and it deliberately carries no component names. A snapshot the
  # function cannot read is 'health-unavailable' on 503, so the truly-down case
  # is already caught by the status-code check above and never reaches here.
  #
  # The "down" check below is therefore defensive rather than expected: today no
  # 200 can carry it. It stays because the alternative failure mode, a probe
  # that reports a service healthy because it only read the status line, is the
  # exact lie this script exists to prevent. An unparseable or empty body also
  # fails, for the same reason.
  if [ "$name" = "mynews-health" ]; then
    if grep -q '"status"[[:space:]]*:[[:space:]]*"down"' "$BODY_FILE"; then
      printf 'probe: %s ... FAIL (got HTTP %s with status "down", expected status ok or degraded)\n' \
        "$name" "$http_code"
      FAILED=$((FAILED + 1))
      FAILED_NAMES+=("$name")
      continue
    fi
    if ! grep -qE '"status"[[:space:]]*:[[:space:]]*"(ok|degraded)"' "$BODY_FILE"; then
      printf 'probe: %s ... FAIL (got HTTP %s with no readable top-level status, expected status ok or degraded)\n' \
        "$name" "$http_code"
      FAILED=$((FAILED + 1))
      FAILED_NAMES+=("$name")
      continue
    fi
  fi

  printf 'probe: %s ... PASS (got HTTP %s, expected %s)\n' "$name" "$http_code" "$expected"
done

if [ "$FAILED" -gt 0 ]; then
  printf 'SMOKE FAILED (%s of %s probes failed: %s)\n' "$FAILED" "$TOTAL" "${FAILED_NAMES[*]}" >&2
  exit 1
fi

printf 'SMOKE PASSED (%s probes)\n' "$TOTAL"
