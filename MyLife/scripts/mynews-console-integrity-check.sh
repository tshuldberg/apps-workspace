#!/usr/bin/env bash
# MyNews moderator console integrity: live database check (plan 48 WP9).
#
# Runs supabase/tests/nw_console_integrity.sql against a real Postgres with the
# MyNews migrations applied. That suite is one transaction that ROLLS BACK, so it
# is safe to run against a database that has data in it.
#
# Fails CLOSED. With no DATABASE_URL this exits non-zero with an explicit
# "not configured" message rather than passing quietly: a check that reports
# success without having run is worse than no check.
#
# Usage:
#   DATABASE_URL=postgres://... scripts/mynews-console-integrity-check.sh
#   DATABASE_URL=postgres://... scripts/mynews-console-integrity-check.sh --with-concurrency
#
# --with-concurrency adds a two-session test that cannot be done inside a single
# transaction: two moderators enforcing the same report at the same instant. It
# COMMITS fixtures and therefore leaves append-only audit rows behind (the audit
# table refuses DELETE by design), so it is for ephemeral or development
# databases only. The script says so and refuses to guess.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUITE="${REPO_ROOT}/supabase/tests/nw_console_integrity.sql"
WITH_CONCURRENCY=0

for arg in "$@"; do
  case "$arg" in
    --with-concurrency) WITH_CONCURRENCY=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  cat >&2 <<'MSG'
mynews-console-integrity-check: DATABASE_URL is not set.

This check needs a Postgres with the MyNews migrations applied. It is NOT skipped
and NOT reported as passing: there is nothing to verify without a database.

  DATABASE_URL=postgres://user:pass@host:5432/db scripts/mynews-console-integrity-check.sh
MSG
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "mynews-console-integrity-check: psql is not on PATH." >&2
  exit 1
fi

if [[ ! -f "$SUITE" ]]; then
  echo "mynews-console-integrity-check: missing $SUITE" >&2
  exit 1
fi

echo "==> rollback suite: $SUITE"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$SUITE"
echo "==> rollback suite passed"

if [[ "$WITH_CONCURRENCY" -eq 0 ]]; then
  echo "==> concurrency test skipped (pass --with-concurrency on an ephemeral database)"
  exit 0
fi

# ---------------------------------------------------------------- concurrency
#
# Two moderators press the same enforcement button on the same report at the same
# moment. Session A takes the row lock and holds it; session B blocks inside the
# RPC, and when A commits, B sees a version that moved and reports a typed
# stale-action conflict instead of enforcing a second time.

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

REPORT_ID='3c000000-0000-0000-0000-00000000c001'
ARTICLE_ID='2c000000-0000-0000-0000-00000000c001'
AUTHOR_ID='1c000000-0000-0000-0000-00000000c001'
REPORTER_ID='1c000000-0000-0000-0000-00000000c002'
AUTHOR_USER='0c000000-0000-0000-0000-00000000c001'
REPORTER_USER='0c000000-0000-0000-0000-00000000c002'

cat > "$WORKDIR/setup.sql" <<SQL
\set ON_ERROR_STOP on
insert into auth.users (id, email) values
  ('${AUTHOR_USER}', 'wp9c-author@example.test'),
  ('${REPORTER_USER}', 'wp9c-reporter@example.test')
on conflict (id) do nothing;
insert into public.nw_profiles (id, user_id, handle, display_name, kind) values
  ('${AUTHOR_ID}', '${AUTHOR_USER}', 'wp9cauthor', 'C Author', 'journalist'),
  ('${REPORTER_ID}', '${REPORTER_USER}', 'wp9creporter', 'C Reporter', 'reader')
on conflict (id) do nothing;
insert into public.nw_articles (id, author_id, status, slug, current_rev, published_at)
values ('${ARTICLE_ID}', '${AUTHOR_ID}', 'published', 'wp9-concurrency-story', 1, now())
on conflict (id) do update set status = 'published';
delete from public.nw_reports where id = '${REPORT_ID}';
insert into public.nw_reports (id, reporter_id, target_kind, target_id, reason, detail)
values ('${REPORT_ID}', '${REPORTER_ID}', 'article', '${ARTICLE_ID}', 'harassment', 'concurrency fixture');

select public.nw_moderator_bootstrap_admin('wp9c-admin@example.test', 'concurrency fixture');
select public.nw_moderator_role_grant('wp9c-admin@example.test', 'wp9c-a@example.test', 'senior', '');
select public.nw_moderator_role_grant('wp9c-admin@example.test', 'wp9c-b@example.test', 'senior', '');
SQL

echo "==> concurrency fixtures"
psql "$DATABASE_URL" -q -f "$WORKDIR/setup.sql" >/dev/null

VERSION="$(psql "$DATABASE_URL" -t -A -c \
  "select console_version from public.nw_reports where id = '${REPORT_ID}'")"
echo "==> both sessions rendered version ${VERSION}"

cat > "$WORKDIR/session-a.sql" <<SQL
\set ON_ERROR_STOP on
begin;
select public.nw_console_enforce_report(
  '${REPORT_ID}', ${VERSION}, 'wp9c-a@example.test', 'hide_article',
  'session A acting first', gen_random_uuid()::text
) as session_a;
select pg_sleep(2);
commit;
SQL

cat > "$WORKDIR/session-b.sql" <<SQL
\set ON_ERROR_STOP on
select public.nw_console_enforce_report(
  '${REPORT_ID}', ${VERSION}, 'wp9c-b@example.test', 'hide_article',
  'session B acting on the same screen', gen_random_uuid()::text
) as session_b;
SQL

psql "$DATABASE_URL" -t -A -q -f "$WORKDIR/session-a.sql" > "$WORKDIR/a.out" 2>&1 &
A_PID=$!
sleep 0.5
psql "$DATABASE_URL" -t -A -q -f "$WORKDIR/session-b.sql" > "$WORKDIR/b.out" 2>&1 &
B_PID=$!
wait "$A_PID"
wait "$B_PID"

A_OUT="$(cat "$WORKDIR/a.out")"
B_OUT="$(cat "$WORKDIR/b.out")"
echo "    session A: ${A_OUT}"
echo "    session B: ${B_OUT}"

FAILED=0
if ! grep -q '"code" *: *"article-hidden"' <<<"$A_OUT"; then
  echo "FAIL: session A should have enforced once" >&2
  FAILED=1
fi
if ! grep -q '"code" *: *"stale-action"' <<<"$B_OUT"; then
  echo "FAIL: session B should have been refused as a stale action" >&2
  FAILED=1
fi

ACTIONS="$(psql "$DATABASE_URL" -t -A -c \
  "select count(*) from public.nw_moderation_actions where report_id = '${REPORT_ID}' and action = 'hide_article'")"
if [[ "$ACTIONS" != "1" ]]; then
  echo "FAIL: expected exactly one enforcement, found ${ACTIONS}" >&2
  FAILED=1
else
  echo "    exactly one enforcement was recorded"
fi

CHAIN="$(psql "$DATABASE_URL" -t -A -c "select public.nw_console_audit_verify()->>'ok'")"
if [[ "$CHAIN" != "true" ]]; then
  echo "FAIL: the audit chain did not verify after concurrent appends" >&2
  FAILED=1
else
  echo "    the audit chain still verifies after concurrent appends"
fi

echo "==> cleanup (audit rows are append-only and stay by design)"
psql "$DATABASE_URL" -q >/dev/null <<SQL
delete from public.nw_queue_assignments where item_id = '${REPORT_ID}';
delete from public.nw_moderation_actions where report_id = '${REPORT_ID}';
delete from public.nw_reports where id = '${REPORT_ID}';
delete from public.nw_articles where id = '${ARTICLE_ID}';
delete from public.nw_profiles where id in ('${AUTHOR_ID}', '${REPORTER_ID}');
delete from auth.users where id in ('${AUTHOR_USER}', '${REPORTER_USER}');
delete from public.nw_moderator_roles where moderator_ref like 'wp9c-%';
delete from public.nw_console_action_tokens where actor_ref like 'wp9c-%';
SQL

if [[ "$FAILED" -ne 0 ]]; then
  echo "==> concurrency test FAILED" >&2
  exit 1
fi
echo "==> concurrency test passed"
