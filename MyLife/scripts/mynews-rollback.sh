#!/usr/bin/env bash
#
# mynews-rollback.sh
#
# WHAT IT DOES
#   Re-deploys the MyNews edge functions from an earlier git ref, so a bad
#   function release can be reverted without waiting for a new merge. It:
#     1. Verifies the target ref exists and the working tree is clean.
#     2. Lists the migration files that exist at HEAD but not at the target.
#     3. Refuses to proceed when that list is non-empty unless the operator
#        passes --i-have-a-database-plan.
#     4. Checks the target ref out into a throwaway git worktree and deploys
#        each mynews-* function that exists AT THAT REF.
#     5. Smoke tests the result with scripts/mynews-smoke.sh.
#
# WHAT IT CANNOT DO
#   DATABASE MIGRATIONS ARE NOT AUTOMATICALLY REVERSIBLE. This script never
#   runs a destructive SQL statement, never drops a table or column, and never
#   attempts a down-migration. If the release you are rolling back added
#   migrations, the schema stays forward while the code goes backward, and only
#   a human can decide whether the older code tolerates the newer schema. The
#   MyNews migrations are additive and append-only by design, and several
#   tables (nw_support_ledger, the hash-chained audit rows) must never be
#   rewritten, so "restore an older schema" means a PITR restore, which is
#   founder-ops. See apps/mynews/docs/runbooks/backup-pitr-restore-drill.md.
#
#   It also cannot revert secrets, cron rows, or storage objects. Live Supabase
#   project operations are founder-ops.
#
# A function that exists at HEAD but not at the target ref is NOT removed. It
# stays deployed at its newer version, and the summary says so.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_REF=""
DRY_RUN=0
DB_PLAN_ACKED=0

usage() {
  cat <<'EOF'
Usage: scripts/mynews-rollback.sh --to <git-ref> [--i-have-a-database-plan] [--dry-run] [--help]

Re-deploys the MyNews edge functions from an earlier git ref.

WARNING: DATABASE MIGRATIONS ARE NOT AUTOMATICALLY REVERSIBLE. This script
rolls back CODE only. It never runs a destructive SQL statement and never
attempts a down-migration. If the release being rolled back added migration
files, the schema stays forward while the functions go backward. That is only
safe if the older code tolerates the newer schema, which is a human judgement.
Reverting a schema means a Supabase point-in-time restore, which is founder-ops
and cannot be performed from this repo.

  --to <git-ref>              REQUIRED. Commit, tag, or branch to deploy from.
  --i-have-a-database-plan    Acknowledge the migration drift listed by this
                              script and proceed anyway. Required only when
                              HEAD has migration files the target ref does not.
  --dry-run                   Print the exact commands that would run, then
                              exit 0. No worktree is created, no function is
                              deployed, no probe is sent. Credentials are still
                              validated first: a dry run with missing
                              credentials exits 2, because a dry run that
                              pretends the config is fine is a lie.
  --help                      Print this and exit 0.

Required environment:
  SUPABASE_PROJECT_REF    Supabase project ref to deploy into
  SUPABASE_ACCESS_TOKEN   Supabase CLI personal access token
  MYNEWS_FUNCTIONS_URL    functions origin the post-rollback smoke probes
  MYNEWS_SMOKE_ANON_KEY   publishable anon key the smoke probes send

Exit codes:
  0  every function at the target ref redeployed and smoke passed
  1  a step failed (a function deploy, smoke)
  2  a required tool, credential, or argument is missing, the ref does not
     exist, the working tree is dirty, or migration drift is unacknowledged
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
    --i-have-a-database-plan)
      DB_PLAN_ACKED=1
      shift
      ;;
    --to)
      if [ "$#" -lt 2 ] || [ -z "${2:-}" ]; then
        printf 'missing: --to <git-ref> (commit, tag, or branch to deploy the edge functions from)\n' >&2
        printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
        exit 2
      fi
      TARGET_REF="$2"
      shift 2
      ;;
    --to=*)
      TARGET_REF="${1#--to=}"
      shift
      ;;
    *)
      printf 'missing: valid arguments (unknown argument %s; see --help)\n' "$1" >&2
      printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
      exit 2
      ;;
  esac
done

# --- credential, tool, and argument validation, before anything else --------

MISSING=()

if ! command -v supabase >/dev/null 2>&1; then
  MISSING+=("tool supabase (Supabase CLI, used to deploy edge functions)")
fi
if ! command -v git >/dev/null 2>&1; then
  MISSING+=("tool git (used to resolve the target ref and create the throwaway worktree)")
fi
if ! command -v curl >/dev/null 2>&1; then
  MISSING+=("tool curl (HTTP client, used by the post-rollback smoke probes)")
fi

if [ -z "$TARGET_REF" ]; then
  MISSING+=("--to <git-ref> (commit, tag, or branch to deploy the edge functions from)")
fi
if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  MISSING+=("SUPABASE_PROJECT_REF (Supabase project ref to deploy into)")
fi
if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  MISSING+=("SUPABASE_ACCESS_TOKEN (Supabase CLI personal access token)")
fi
if [ -z "${MYNEWS_FUNCTIONS_URL:-}" ]; then
  MISSING+=("MYNEWS_FUNCTIONS_URL (functions origin the post-rollback smoke probes)")
fi
if [ -z "${MYNEWS_SMOKE_ANON_KEY:-}" ]; then
  MISSING+=("MYNEWS_SMOKE_ANON_KEY (publishable anon key the post-rollback smoke probes send)")
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
  for item in "${MISSING[@]}"; do
    printf 'missing: %s\n' "$item" >&2
  done
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

printf 'WARNING: DATABASE MIGRATIONS ARE NOT AUTOMATICALLY REVERSIBLE.\n'
printf 'WARNING: this rolls back edge function CODE only. No SQL is reverted.\n\n'

# --- ref and working tree verification --------------------------------------

RESOLVED_SHA=""
if ! RESOLVED_SHA="$(git -C "$REPO_ROOT" rev-parse --verify --quiet "${TARGET_REF}^{commit}")"; then
  printf 'missing: an existing git ref for --to %s (git rev-parse could not resolve it to a commit)\n' "$TARGET_REF" >&2
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi
if [ -z "$RESOLVED_SHA" ]; then
  printf 'missing: an existing git ref for --to %s (git rev-parse returned nothing)\n' "$TARGET_REF" >&2
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

DIRTY="$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no)"
if [ -n "$DIRTY" ]; then
  printf 'missing: a clean working tree (uncommitted tracked changes would make the rollback unreproducible)\n' >&2
  printf 'the following tracked paths are modified:\n' >&2
  printf '%s\n' "$DIRTY" >&2
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

printf 'target ref: %s (%s)\n' "$TARGET_REF" "$RESOLVED_SHA"

# --- migration drift --------------------------------------------------------

HEAD_MIGRATIONS="$(git -C "$REPO_ROOT" ls-tree -r --name-only HEAD -- supabase/migrations || true)"
TARGET_MIGRATIONS="$(git -C "$REPO_ROOT" ls-tree -r --name-only "$RESOLVED_SHA" -- supabase/migrations || true)"
DRIFT="$(comm -23 <(printf '%s\n' "$HEAD_MIGRATIONS" | sort) <(printf '%s\n' "$TARGET_MIGRATIONS" | sort) | sed '/^$/d')"

DRIFT_COUNT=0
if [ -n "$DRIFT" ]; then
  DRIFT_COUNT="$(printf '%s\n' "$DRIFT" | wc -l | tr -d ' ')"
  printf 'migration files present at HEAD but NOT at %s (%s):\n' "$TARGET_REF" "$DRIFT_COUNT"
  printf '%s\n' "$DRIFT" | sed 's/^/  /'
  printf '\n'
  if [ "$DB_PLAN_ACKED" -ne 1 ]; then
    printf 'FAILED: %s migration(s) were applied after %s and this script cannot revert them.\n' \
      "$DRIFT_COUNT" "$TARGET_REF" >&2
    printf 'The schema will stay forward while the functions go backward. That is only safe if the\n' >&2
    printf 'code at %s tolerates the newer schema. Decide that first, then re-run with\n' "$TARGET_REF" >&2
    printf '--i-have-a-database-plan. To revert the schema itself you need a Supabase point-in-time\n' >&2
    printf 'restore, which is founder-ops: apps/mynews/docs/runbooks/backup-pitr-restore-drill.md\n' >&2
    exit 2
  fi
  printf 'operator acknowledged the migration drift with --i-have-a-database-plan.\n\n'
else
  printf 'no migration drift: %s has the same migration files as HEAD.\n\n' "$TARGET_REF"
fi

# --- function lists ---------------------------------------------------------

TARGET_FUNCTIONS=()
while IFS= read -r line; do
  [ -n "$line" ] || continue
  TARGET_FUNCTIONS+=("$line")
done < <(
  git -C "$REPO_ROOT" ls-tree -r --name-only "$RESOLVED_SHA" -- supabase/functions \
    | sed -n 's#^supabase/functions/\(mynews-[^/]*\)/index\.ts$#\1#p' \
    | sort -u
)

if [ "${#TARGET_FUNCTIONS[@]}" -eq 0 ]; then
  printf 'missing: at least one supabase/functions/mynews-*/index.ts at ref %s (nothing to redeploy)\n' "$TARGET_REF" >&2
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

HEAD_FUNCTIONS="$(
  git -C "$REPO_ROOT" ls-tree -r --name-only HEAD -- supabase/functions \
    | sed -n 's#^supabase/functions/\(mynews-[^/]*\)/index\.ts$#\1#p' \
    | sort -u
)"
ORPHANS="$(comm -23 <(printf '%s\n' "$HEAD_FUNCTIONS") <(printf '%s\n' "${TARGET_FUNCTIONS[@]}" | sort -u) | sed '/^$/d')"
if [ -n "$ORPHANS" ]; then
  printf 'functions that exist at HEAD but not at %s (they stay deployed at their NEWER version):\n' "$TARGET_REF"
  printf '%s\n' "$ORPHANS" | sed 's/^/  /'
  printf 'this script never deletes a deployed function. Removing one is a separate, deliberate act.\n\n'
fi

WORKTREE_DIR="$REPO_ROOT/../Apps-wt-mynews-rollback-$RESOLVED_SHA"

# --- dry run ----------------------------------------------------------------

if [ "$DRY_RUN" -eq 1 ]; then
  printf 'dry-run: git worktree add --detach %s %s\n' "$WORKTREE_DIR" "$RESOLVED_SHA"
  printf 'dry-run: supabase link --project-ref %s\n' "$SUPABASE_PROJECT_REF"
  for fn in "${TARGET_FUNCTIONS[@]}"; do
    printf 'dry-run: supabase functions deploy %s --project-ref %s   # from %s, verify_jwt read from that ref config.toml\n' \
      "$fn" "$SUPABASE_PROJECT_REF" "$RESOLVED_SHA"
  done
  printf 'dry-run: git worktree remove --force %s\n' "$WORKTREE_DIR"
  printf 'dry-run: bash scripts/mynews-smoke.sh\n'
  printf 'dry-run: no SQL would run, no migration would be reverted, no function would be deleted\n'
  printf 'dry-run: %s function(s) would be redeployed from %s; nothing was changed\n' \
    "${#TARGET_FUNCTIONS[@]}" "$TARGET_REF"
  exit 0
fi

# --- worktree ---------------------------------------------------------------

printf '=== MyNews rollback: project %s to %s ===\n' "$SUPABASE_PROJECT_REF" "$TARGET_REF"

if [ -e "$WORKTREE_DIR" ]; then
  printf 'missing: an unused worktree path (%s already exists; remove it first)\n' "$WORKTREE_DIR" >&2
  printf 'FAILED: cannot proceed without the credentials listed above\n' >&2
  exit 2
fi

cleanup_worktree() {
  if [ -d "$WORKTREE_DIR" ]; then
    git -C "$REPO_ROOT" worktree remove --force "$WORKTREE_DIR" >/dev/null 2>&1 || true
  fi
}
trap cleanup_worktree EXIT

printf 'step 1/3: checking %s out into a throwaway worktree\n' "$RESOLVED_SHA"
if ! git -C "$REPO_ROOT" worktree add --detach "$WORKTREE_DIR" "$RESOLVED_SHA"; then
  printf 'FAILED: could not create the rollback worktree. Nothing was deployed.\n' >&2
  exit 1
fi

printf 'step 2/3: linking the Supabase CLI to %s\n' "$SUPABASE_PROJECT_REF"
if ! (cd "$WORKTREE_DIR" && supabase link --project-ref "$SUPABASE_PROJECT_REF"); then
  printf 'FAILED: supabase link did not succeed. Nothing was deployed.\n' >&2
  exit 1
fi

printf 'step 3/3: redeploying %s function(s) from %s\n' "${#TARGET_FUNCTIONS[@]}" "$TARGET_REF"
RESULT_NAMES=()
RESULT_STATES=()
FAILED_FUNCTIONS=()
for fn in "${TARGET_FUNCTIONS[@]}"; do
  printf '  deploying %s\n' "$fn"
  if (cd "$WORKTREE_DIR" && supabase functions deploy "$fn" --project-ref "$SUPABASE_PROJECT_REF"); then
    RESULT_NAMES+=("$fn")
    RESULT_STATES+=("redeployed")
  else
    RESULT_NAMES+=("$fn")
    RESULT_STATES+=("FAILED")
    FAILED_FUNCTIONS+=("$fn")
  fi
done

SMOKE_STATE="skipped (function deploy failures)"
if [ "${#FAILED_FUNCTIONS[@]}" -eq 0 ]; then
  printf 'smoke testing the rolled-back surface\n'
  if bash "$SCRIPT_DIR/mynews-smoke.sh"; then
    SMOKE_STATE="passed"
  else
    SMOKE_STATE="FAILED"
  fi
fi

printf '\n=== rollback summary (project %s, ref %s) ===\n' "$SUPABASE_PROJECT_REF" "$RESOLVED_SHA"
printf 'migrations: NOT reverted (%s migration file(s) newer than the target remain applied)\n' "$DRIFT_COUNT"
index=0
while [ "$index" -lt "${#RESULT_NAMES[@]}" ]; do
  printf '%-34s %s\n' "${RESULT_NAMES[$index]}" "${RESULT_STATES[$index]}"
  index=$((index + 1))
done
printf 'smoke: %s\n' "$SMOKE_STATE"

if [ "${#FAILED_FUNCTIONS[@]}" -gt 0 ]; then
  printf 'FAILED: %s function(s) did not redeploy: %s\n' \
    "${#FAILED_FUNCTIONS[@]}" "${FAILED_FUNCTIONS[*]}" >&2
  exit 1
fi

if [ "$SMOKE_STATE" != "passed" ]; then
  printf 'FAILED: functions redeployed but the smoke test did not pass. The surface is unverified.\n' >&2
  exit 1
fi

printf 'ROLLBACK PASSED (%s functions redeployed from %s, smoke passed)\n' \
  "${#TARGET_FUNCTIONS[@]}" "$TARGET_REF"
