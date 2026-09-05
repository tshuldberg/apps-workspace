#!/usr/bin/env bash
#
# mynews-deploy.sh
#
# WHAT IT DOES
#   Deploys the MyNews server surface to a Supabase project, in this order:
#     1. Verifies the generated environment matrix is current and fully
#        annotated (node scripts/gen-mynews-env-matrix.mjs --check). A new
#        undocumented environment read aborts the deploy.
#     2. Links the Supabase CLI to SUPABASE_PROJECT_REF.
#     3. Applies database migrations with `supabase db push`.
#     4. Deploys every mynews-* edge function. The list is derived at runtime
#        from supabase/functions, so a newly added function cannot be
#        forgotten by an out-of-date hardcoded list.
#     5. Runs scripts/mynews-smoke.sh and FAILS the deploy if smoke fails.
#     6. Prints a per-function summary with each deploy result.
#
#   verify_jwt is NOT passed on the command line. The Supabase CLI reads
#   supabase/config.toml itself and honours each [functions.<name>] verify_jwt
#   declaration, so duplicating those flags here would create a second source
#   of truth that could silently disagree with the committed config. The
#   summary prints the declared value per function so an operator can see it.
#
# WHAT IT CANNOT DO
#   It cannot set secrets, configure PITR, create pg_cron schedules, write
#   nw_job_config rows, register a DMCA agent, or onboard a vendor. Those are
#   founder-ops against the live Supabase project and are deliberately not
#   automated from this repo. It also cannot roll a migration back; see
#   scripts/mynews-rollback.sh.
#
# Any per-function failure makes this script exit non-zero with a named list of
# failures. It never prints a success line it did not earn.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FUNCTIONS_DIR="$REPO_ROOT/supabase/functions"
CONFIG_TOML="$REPO_ROOT/supabase/config.toml"

DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/mynews-deploy.sh [--dry-run] [--help]

Deploys MyNews migrations and every mynews-* edge function, then smoke tests
the result. Aborts before touching the project if the environment matrix is
stale or has an unannotated variable.

  --dry-run   print the exact commands that would run, then exit 0. No
              migration is applied, no function is deployed, no probe is sent.
              Credentials are still validated first: a dry run with missing
              credentials exits 2, because a dry run that pretends the config
              is fine is a lie.
  --help      print this and exit 0.

Required environment:
  SUPABASE_PROJECT_REF    Supabase project ref to deploy into
  SUPABASE_ACCESS_TOKEN   Supabase CLI personal access token
  MYNEWS_FUNCTIONS_URL    functions origin the post-deploy smoke probes
  MYNEWS_SMOKE_ANON_KEY   publishable anon key the smoke probes send

  MYNEWS_FUNCTIONS_URL and MYNEWS_SMOKE_ANON_KEY are validated UP FRONT even
  though they are only used at the end, so a deploy cannot get halfway and
  then discover it has no way to verify itself.

Founder-ops, not done here:
  supabase secrets set ...          every MYNEWS_* server secret
  nw_job_config rows               worker secrets and functions_base_url for pg_cron
  PITR / backup configuration      see apps/mynews/docs/runbooks/backup-pitr-restore-drill.md

Exit codes:
  0  migrations applied, every function deployed, smoke passed
  1  a step failed (env matrix stale, migration push, a function deploy, smoke)
  2  a required tool or credential is missing
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

if ! command -v supabase >/dev/null 2>&1; then
  MISSING+=("tool supabase (Supabase CLI, used to deploy edge functions)")
fi
if ! command -v node >/dev/null 2>&1; then
  MISSING+=("tool node (Node.js, used to run the environment matrix verifier)")
fi
if ! command -v curl >/dev/null 2>&1; then
  MISSING+=("tool curl (HTTP client, used by the post-deploy smoke probes)")
fi

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  MISSING+=("SUPABASE_PROJECT_REF (Supabase project ref to deploy into)")
fi
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  MISSING+=("SUPABASE_ACCESS_TOKEN (Supabase CLI personal access token)")
fi
if [ -z "${MYNEWS_FUNCTIONS_URL:-}" ]; then
  MISSING+=("MYNEWS_FUNCTIONS_URL (functions origin the post-deploy smoke probes)")
fi
if [ -z "${MYNEWS_SMOKE_ANON_KEY:-}" ]; then
  MISSING+=("MYNEWS_SMOKE_ANON_KEY (publishable anon key the post-deploy smoke probes send)")
fi

if [ ! -d "$FUNCTIONS_DIR" ]; then
  MISSING+=("supabase/functions (edge function source directory, expected at $FUNCTIONS_DIR)")
fi
if [ ! -f "$CONFIG_TOML" ]; then
  MISSING+=("supabase/config.toml (declares per-function verify_jwt; the CLI reads it during deploy)")
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
  for item in "${MISSING[@]}"; do
    printf 'missing: %s\n' "$item" >&2
  done
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

# --- derive the function list at runtime ------------------------------------

FUNCTIONS=()
for dir in "$FUNCTIONS_DIR"/mynews-*; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  if [ ! -f "$dir/index.ts" ]; then
    printf 'missing: %s/index.ts (every deployable edge function needs an entrypoint)\n' "supabase/functions/$name" >&2
    printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
    exit 2
  fi
  FUNCTIONS+=("$name")
done

if [ "${#FUNCTIONS[@]}" -eq 0 ]; then
  printf 'missing: at least one mynews-* function under supabase/functions (nothing to deploy)\n' >&2
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

# Reads the declared verify_jwt for a function out of config.toml. An absent
# declaration means the CLI applies its default, which is verify_jwt = true.
declared_verify_jwt() {
  local fn="$1"
  awk -v section="[functions.$fn]" '
    $0 == section { inside = 1; next }
    /^\[/ { inside = 0 }
    inside && /verify_jwt/ {
      gsub(/[^a-z]/, "", $NF)
      print $NF
      found = 1
      exit
    }
    END { if (!found) print "default(true)" }
  ' "$CONFIG_TOML"
}

# --- dry run ----------------------------------------------------------------

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'dry-run: cd %s\n' "$REPO_ROOT"
  printf 'dry-run: node scripts/gen-mynews-env-matrix.mjs --check\n'
  printf 'dry-run: supabase link --project-ref %s\n' "$SUPABASE_PROJECT_REF"
  printf 'dry-run: supabase db push --project-ref %s\n' "$SUPABASE_PROJECT_REF"
  for fn in "${FUNCTIONS[@]}"; do
    printf 'dry-run: supabase functions deploy %s --project-ref %s   # config.toml verify_jwt = %s\n' \
      "$fn" "$SUPABASE_PROJECT_REF" "$(declared_verify_jwt "$fn")"
  done
  printf 'dry-run: bash scripts/mynews-smoke.sh\n'
  printf 'dry-run: %s functions would be deployed; nothing was applied, deployed, or probed\n' "${#FUNCTIONS[@]}"
  exit 0
fi

# --- step 1: environment matrix ---------------------------------------------

printf '=== MyNews deploy: project %s ===\n' "$SUPABASE_PROJECT_REF"
printf 'step 1/5: verifying the environment matrix\n'
if ! node "$REPO_ROOT/scripts/gen-mynews-env-matrix.mjs" --check; then
  printf 'FAILED: the environment matrix is stale or has an unannotated variable. Deploy aborted before any change.\n' >&2
  exit 1
fi

# --- step 2: link -----------------------------------------------------------

printf 'step 2/5: linking the Supabase CLI to %s\n' "$SUPABASE_PROJECT_REF"
if ! (cd "$REPO_ROOT" && supabase link --project-ref "$SUPABASE_PROJECT_REF"); then
  printf 'FAILED: supabase link did not succeed. Nothing was deployed.\n' >&2
  exit 1
fi

# --- step 3: migrations -----------------------------------------------------

printf 'step 3/5: applying database migrations (supabase db push)\n'
if ! (cd "$REPO_ROOT" && supabase db push --project-ref "$SUPABASE_PROJECT_REF"); then
  printf 'FAILED: supabase db push did not succeed. No edge function was deployed.\n' >&2
  exit 1
fi

# --- step 4: edge functions -------------------------------------------------

printf 'step 4/5: deploying %s mynews-* edge functions\n' "${#FUNCTIONS[@]}"
RESULT_NAMES=()
RESULT_STATES=()
FAILED_FUNCTIONS=()

for fn in "${FUNCTIONS[@]}"; do
  printf '  deploying %s (config.toml verify_jwt = %s)\n' "$fn" "$(declared_verify_jwt "$fn")"
  if (cd "$REPO_ROOT" && supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF"); then
    RESULT_NAMES+=("$fn")
    RESULT_STATES+=("deployed")
  else
    RESULT_NAMES+=("$fn")
    RESULT_STATES+=("FAILED")
    FAILED_FUNCTIONS+=("$fn")
  fi
done

# --- step 5: smoke ----------------------------------------------------------

SMOKE_STATE="not run"
if [ "${#FAILED_FUNCTIONS[@]}" -eq 0 ]; then
  printf 'step 5/5: smoke testing the deployed surface\n'
  if bash "$SCRIPT_DIR/mynews-smoke.sh"; then
    SMOKE_STATE="passed"
  else
    SMOKE_STATE="FAILED"
  fi
else
  printf 'step 5/5: skipped, because %s function deploy(s) failed\n' "${#FAILED_FUNCTIONS[@]}"
  SMOKE_STATE="skipped (function deploy failures)"
fi

# --- summary ----------------------------------------------------------------

printf '\n=== deploy summary (project %s) ===\n' "$SUPABASE_PROJECT_REF"
printf 'migrations: applied via supabase db push\n'
index=0
while [ "$index" -lt "${#RESULT_NAMES[@]}" ]; do
  printf '%-34s %s\n' "${RESULT_NAMES[$index]}" "${RESULT_STATES[$index]}"
  index=$((index + 1))
done
printf 'smoke: %s\n' "$SMOKE_STATE"

if [ "${#FAILED_FUNCTIONS[@]}" -gt 0 ]; then
  printf 'FAILED: %s function(s) did not deploy: %s\n' \
    "${#FAILED_FUNCTIONS[@]}" "${FAILED_FUNCTIONS[*]}" >&2
  exit 1
fi

if [ "$SMOKE_STATE" != "passed" ]; then
  printf 'FAILED: functions deployed but the smoke test did not pass. Treat this release as unverified.\n' >&2
  exit 1
fi

printf 'DEPLOY PASSED (%s functions deployed, smoke passed)\n' "${#FUNCTIONS[@]}"
