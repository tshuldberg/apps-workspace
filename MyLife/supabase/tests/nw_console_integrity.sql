-- MyNews moderator console integrity: live behavioural suite (plan 48 WP9).
--
-- Runs the scenarios section F of plan 48 asks for, against a real Postgres with
-- the MyNews migrations applied: concurrency and stale actions, replay, partial
-- failure with rollback, dual control including self-approval, compromised
-- moderator containment, recovery, and hash-chain verification including
-- tamper detection.
--
-- Deliberately extension-free. The pgTAP files beside this one need an extension
-- that a bare Postgres and CI container do not have, and are not wired into any
-- runner; this file asserts with plain plpgsql so it runs anywhere psql does,
-- which is what let it actually be executed rather than only written. Run it with
-- scripts/mynews-console-integrity-check.sh.
--
-- Everything happens inside one transaction that ROLLS BACK, so it can be run
-- against a database with data in it without leaving a trace. The one thing a
-- single transaction cannot show is two sessions blocking on each other; the
-- runner script adds that case with two connections.

\set ON_ERROR_STOP on

begin;

-- ============================================================ harness

create temporary table _checks (
  id bigserial primary key,
  label text not null,
  ok boolean not null
) on commit drop;

create or replace function pg_temp.check_that(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  insert into _checks (label, ok) values (p_label, coalesce(p_ok, false));
  if p_ok is not true then
    raise exception 'FAILED: %', p_label;
  end if;
end;
$$;

create or replace function pg_temp.check_eq(p_actual text, p_expected text, p_label text)
returns void language plpgsql as $$
begin
  perform pg_temp.check_that(
    p_actual is not distinct from p_expected,
    format('%s (expected %L, got %L)', p_label, p_expected, p_actual)
  );
end;
$$;

/* Shorthand: the 'code' out of an enforcement envelope. */
create or replace function pg_temp.code_of(p_result jsonb)
returns text language sql immutable as $$
  select p_result->>'code';
$$;

-- ============================================================ fixtures

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'author@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'editor@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'reader@example.test')
on conflict (id) do nothing;

insert into public.nw_profiles (id, user_id, handle, display_name, kind) values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'wp9author', 'Author', 'journalist'),
  ('10000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2', 'wp9editor', 'Editor', 'editor'),
  ('10000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a3', 'wp9reader', 'Reader', 'reader')
on conflict (id) do nothing;

insert into public.nw_journalists (profile_id) values
  ('10000000-0000-0000-0000-0000000000a1')
on conflict (profile_id) do nothing;

insert into public.nw_payout_accounts
  (journalist_profile_id, onboarding_state, provider, provider_account_ref)
values
  ('10000000-0000-0000-0000-0000000000a1', 'verified', 'stripe', 'acct_wp9')
on conflict (journalist_profile_id) do update
  set onboarding_state = 'verified', provider = 'stripe', provider_account_ref = 'acct_wp9';

insert into public.nw_articles (id, author_id, status, slug, current_rev, published_at) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a1', 'published', 'wp9-story-one', 1, now()),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a1', 'published', 'wp9-story-two', 1, now()),
  ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000a1', 'published', 'wp9-story-three', 1, now()),
  ('20000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-0000000000a1', 'published', 'wp9-story-four', 1, now())
on conflict (id) do nothing;

insert into public.nw_reports (id, reporter_id, target_kind, target_id, reason, detail) values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000a2', 'article', '20000000-0000-0000-0000-0000000000a1', 'harassment', 'r1'),
  ('30000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000a2', 'article', '20000000-0000-0000-0000-0000000000a2', 'harassment', 'r2'),
  ('30000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000a2', 'profile', '10000000-0000-0000-0000-0000000000a1', 'harassment', 'r3'),
  ('30000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-0000000000a3', 'profile', '10000000-0000-0000-0000-0000000000a1', 'harassment', 'r4'),
  ('30000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000a2', 'article', '20000000-0000-0000-0000-0000000000a3', 'harassment', 'r5'),
  -- A report naming an article that does not exist: the partial-failure case.
  ('30000000-0000-0000-0000-0000000000a6', '10000000-0000-0000-0000-0000000000a2', 'article', '29999999-9999-9999-9999-999999999999', 'harassment', 'r6'),
  ('30000000-0000-0000-0000-0000000000a7', '10000000-0000-0000-0000-0000000000a2', 'article', '20000000-0000-0000-0000-0000000000a4', 'copyright', 'r7')
on conflict (id) do nothing;

-- ============================================================ 1. RBAC

do $$
declare
  v_result jsonb;
begin
  -- Nobody has a role yet, so nothing runs. This is the fail-closed default: an
  -- allowlisted moderator with no role row is powerless.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a1', 1, 'nobody@example.test', 'hide_article',
    'trying without a role', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'no-role', 'no role: enforcement refused');
  perform pg_temp.check_that(
    (select count(*) from public.nw_articles
     where id = '20000000-0000-0000-0000-0000000000a1' and status = 'published') = 1,
    'no role: the article is untouched'
  );

  -- Bootstrap the first admin. This is the documented founder-ops path.
  v_result := public.nw_moderator_bootstrap_admin('admin@example.test', 'founder-ops seed');
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'bootstrapped', 'bootstrap: first admin created');

  -- And it closes behind itself: a second bootstrap cannot mint another admin.
  v_result := public.nw_moderator_bootstrap_admin('attacker@example.test', 'second try');
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'admin-exists', 'bootstrap: closed after the first admin');
  perform pg_temp.check_that(
    public.nw_moderator_role('attacker@example.test') is null,
    'bootstrap: the second attempt granted nothing'
  );

  -- The admin grants the working roles.
  v_result := public.nw_moderator_role_grant('admin@example.test', 'senior@example.test', 'senior', '');
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'granted', 'grant: senior');
  v_result := public.nw_moderator_role_grant('admin@example.test', 'senior2@example.test', 'senior', '');
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'granted', 'grant: second senior');
  v_result := public.nw_moderator_role_grant('admin@example.test', 'reviewer@example.test', 'reviewer', '');
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'granted', 'grant: reviewer');

  perform pg_temp.check_eq(public.nw_moderator_role('senior@example.test'), 'senior', 'role read: senior');
  perform pg_temp.check_eq(public.nw_moderator_role_level('reviewer@example.test')::text, '1', 'role level: reviewer');
  perform pg_temp.check_eq(public.nw_moderator_role_level('nobody@example.test')::text, '0', 'role level: unknown is zero');
end;
$$;

-- ============================================================ 2. compromised moderator containment

do $$
declare
  v_result jsonb;
begin
  -- A compromised REVIEWER account is the containment case that matters: it can
  -- do per-item content work and nothing else.
  v_result := public.nw_moderator_role_grant('reviewer@example.test', 'reviewer@example.test', 'admin', 'self-promotion');
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'not-admin', 'containment: a reviewer cannot grant roles');
  perform pg_temp.check_eq(public.nw_moderator_role('reviewer@example.test'), 'reviewer', 'containment: still a reviewer');

  v_result := public.nw_moderator_role_revoke('reviewer@example.test', 'admin@example.test', 'locking out the admin');
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'not-admin', 'containment: a reviewer cannot revoke the admin');
  perform pg_temp.check_eq(public.nw_moderator_role('admin@example.test'), 'admin', 'containment: the admin keeps its role');

  -- Direct table writes are refused for client roles, so a leaked anon or
  -- authenticated key cannot mint a role either. (Checked via privileges: the
  -- table has RLS on and zero policies, and no grants to those roles.)
  perform pg_temp.check_that(
    not has_table_privilege('anon', 'public.nw_moderator_roles', 'INSERT')
      and not has_table_privilege('authenticated', 'public.nw_moderator_roles', 'INSERT')
      and not has_table_privilege('anon', 'public.nw_moderator_roles', 'SELECT'),
    'containment: client roles cannot read or write nw_moderator_roles'
  );
  perform pg_temp.check_that(
    not has_function_privilege('anon', 'public.nw_console_enforce_report(uuid, integer, text, text, text, text, jsonb)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.nw_console_enforce_report(uuid, integer, text, text, text, text, jsonb)', 'EXECUTE'),
    'containment: client roles cannot execute the enforcement RPC'
  );
  perform pg_temp.check_that(
    not has_table_privilege('authenticated', 'public.nw_console_audit', 'SELECT'),
    'containment: client roles cannot read the console audit log'
  );

  -- A reviewer cannot reach a senior-level action.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a3', 1, 'reviewer@example.test', 'suspend_profile',
    'reviewer trying to suspend', gen_random_uuid()::text,
    jsonb_build_object('until', (now() + interval '3 days')::text, 'permanent', false)
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'insufficient-role', 'containment: a reviewer cannot suspend');
  perform pg_temp.check_that(
    (select suspended_until from public.nw_profiles where id = '10000000-0000-0000-0000-0000000000a1') is null,
    'containment: the profile was not suspended'
  );
  -- The refusal is still recorded. An attempt that was blocked is exactly what an
  -- investigation wants to find.
  perform pg_temp.check_that(
    exists (
      select 1 from public.nw_console_audit
      where actor_ref = 'reviewer@example.test' and outcome = 'refused:insufficient-role'
    ),
    'containment: the refusal is audited'
  );
end;
$$;

-- ============================================================ 3. reason and confirmation floors

do $$
declare
  v_result jsonb;
begin
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a1', 1, 'reviewer@example.test', 'hide_article',
    '   ', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'bad-reason', 'reason: blank is refused');

  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a1', 1, 'reviewer@example.test', 'hide_article',
    repeat('x', 2001), gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'bad-reason', 'reason: over 2000 chars is refused');

  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a1', 1, 'reviewer@example.test', 'hide_article',
    'valid reason', 'short'
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'bad-token', 'token: a stub token is refused');

  perform pg_temp.check_that(
    (select status from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a1') = 'open',
    'floors: nothing was enforced by any refused call'
  );
end;
$$;

-- ============================================================ 4. transactional enforcement + stale actions

do $$
declare
  v_result jsonb;
  v_token text := gen_random_uuid()::text;
  v_version integer;
begin
  select console_version into v_version from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a1';
  perform pg_temp.check_eq(v_version::text, '1', 'version: a fresh report starts at 1');

  -- The happy path: hide + resolve in one call.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a1', v_version, 'reviewer@example.test', 'hide_article',
    'harassing content', v_token
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'article-hidden', 'enforce: article hidden');
  perform pg_temp.check_eq(
    (select status from public.nw_articles where id = '20000000-0000-0000-0000-0000000000a1'),
    'retracted', 'enforce: the article is retracted'
  );
  perform pg_temp.check_eq(
    (select status from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a1'),
    'actioned', 'enforce: the report is resolved in the same call'
  );
  perform pg_temp.check_that(
    (select console_version from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a1') > v_version,
    'version: the trigger bumped it'
  );

  -- CONCURRENCY, sequential half: a second moderator holding the version they
  -- rendered before the first one acted gets a typed stale-action conflict, not a
  -- second enforcement.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a1', v_version, 'senior@example.test', 'hide_article',
    'acting on what I had on screen', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'stale-action', 'concurrency: the stale version is refused');
  perform pg_temp.check_that(
    (v_result->>'currentVersion')::integer =
      (select console_version from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a1'),
    'concurrency: the refusal reports the current version'
  );

  -- REPLAY: the same form submitted twice. The token was already claimed, so the
  -- second submission is refused and carries the original outcome.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a1', v_version, 'reviewer@example.test', 'hide_article',
    'harassing content', v_token
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'replayed', 'replay: the second submission is refused');
  perform pg_temp.check_eq(
    v_result->'original'->>'code', 'article-hidden', 'replay: the original outcome comes back'
  );

  -- A replay is refused BEFORE the version check, so a resubmitted form does not
  -- read as someone else having changed the row.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a2', 1, 'reviewer@example.test', 'hide_article',
    'second article', v_token
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'replayed', 'replay: a reused token cannot act on a different report');
  perform pg_temp.check_eq(
    (select status from public.nw_articles where id = '20000000-0000-0000-0000-0000000000a2'),
    'published', 'replay: the other article is untouched'
  );
end;
$$;

-- ============================================================ 5. partial failure rolls back

do $$
declare
  v_result jsonb;
  v_audit_before bigint;
begin
  select count(*) into v_audit_before from public.nw_console_audit;

  -- Report a6 names an article that does not exist. The hide step fails, so the
  -- resolve step must NOT have happened: the report has to stay open.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a6', 1, 'reviewer@example.test', 'hide_article',
    'target is gone', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'not-found', 'partial failure: the failing step names itself');
  perform pg_temp.check_that(
    (v_result->>'rolledBack')::boolean, 'partial failure: the envelope says it rolled back'
  );
  perform pg_temp.check_eq(
    (select status from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a6'),
    'open', 'partial failure: the report was NOT resolved'
  );
  perform pg_temp.check_that(
    not exists (
      select 1 from public.nw_moderation_actions
      where report_id = '30000000-0000-0000-0000-0000000000a6'
    ),
    'partial failure: no statement of reasons was written'
  );
  -- The audit row survives the rollback, because it is written after it.
  perform pg_temp.check_that(
    (select count(*) from public.nw_console_audit) > v_audit_before,
    'partial failure: the failure is still audited'
  );
  perform pg_temp.check_that(
    exists (
      select 1 from public.nw_console_audit
      where target_id = '30000000-0000-0000-0000-0000000000a6' and outcome like 'failed:%'
    ),
    'partial failure: the audit row records it as failed'
  );
end;
$$;

-- ============================================================ 6. strike: three steps, one transaction

do $$
declare
  v_result jsonb;
  v_version integer;
begin
  select console_version into v_version from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a7';
  -- A copyright strike is retract + strike + resolve. A senior can run it.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a7', v_version, 'senior@example.test', 'strike_author',
    'infringes a registered work', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'author-struck', 'strike: recorded');
  perform pg_temp.check_eq(
    (select status from public.nw_articles where id = '20000000-0000-0000-0000-0000000000a4'),
    'retracted', 'strike: the article is retracted'
  );
  perform pg_temp.check_eq(
    (select copyright_strikes from public.nw_profiles where id = '10000000-0000-0000-0000-0000000000a1')::text,
    '1', 'strike: the author has one strike'
  );
  perform pg_temp.check_eq(
    (select status from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a7'),
    'actioned', 'strike: the report is resolved'
  );
end;
$$;

-- ============================================================ 7. dual control

do $$
declare
  v_result jsonb;
  v_version integer;
  v_pending uuid;
  v_failed boolean := false;
begin
  -- A 3-day suspension is a one-moderator action for a senior.
  select console_version into v_version from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a3';
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a3', v_version, 'senior@example.test', 'suspend_profile',
    'short cooling-off', gen_random_uuid()::text,
    jsonb_build_object('until', (now() + interval '3 days')::text, 'permanent', false)
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'profile-suspended', 'dual control: a 3-day suspension applies directly');
  perform pg_temp.check_that(
    (select suspended_until from public.nw_profiles where id = '10000000-0000-0000-0000-0000000000a1') is not null,
    'dual control: the short suspension landed'
  );

  -- A 30-day suspension does NOT apply. It becomes a proposal.
  select console_version into v_version from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a4';
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a4', v_version, 'senior@example.test', 'suspend_profile',
    'repeat harassment', gen_random_uuid()::text,
    jsonb_build_object('until', (now() + interval '30 days')::text, 'permanent', false)
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'pending-approval', 'dual control: over 7 days becomes a proposal');
  v_pending := (v_result->>'pendingId')::uuid;
  perform pg_temp.check_that(v_pending is not null, 'dual control: a pending id came back');
  perform pg_temp.check_eq(
    (select status from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a4'),
    'open', 'dual control: the report stays open until the proposal is approved'
  );

  -- The proposer cannot approve their own proposal.
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'senior@example.test', true, 'approving my own', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'self-approval', 'dual control: self-approval refused');

  -- And not just in the RPC: the table CHECK refuses it too, so a caller that
  -- skipped the RPC entirely still cannot do it.
  begin
    update public.nw_pending_actions
      set decided_by = 'senior@example.test', state = 'approved', decided_at = now()
      where id = v_pending;
  exception when check_violation then
    v_failed := true;
  end;
  perform pg_temp.check_that(v_failed, 'dual control: the CHECK constraint refuses a direct self-approval write');

  -- A reviewer cannot approve a suspension proposal either.
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'reviewer@example.test', true, 'reviewer approving', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'insufficient-role', 'dual control: a reviewer cannot approve');

  -- A second senior can, and the approval EXECUTES in the same transaction.
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'senior2@example.test', true, 'confirmed the pattern', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'pending-approved', 'dual control: a second senior approves');
  perform pg_temp.check_eq(v_result->>'outcome', 'suspension-applied', 'dual control: the suspension was applied');
  perform pg_temp.check_that(
    (select suspended_until from public.nw_profiles where id = '10000000-0000-0000-0000-0000000000a1')
      > now() + interval '20 days',
    'dual control: the 30-day suspension is in effect'
  );
  perform pg_temp.check_eq(
    (select status from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a4'),
    'actioned', 'dual control: the report resolved with the approval'
  );
  perform pg_temp.check_eq(
    (select state from public.nw_pending_actions where id = v_pending),
    'approved', 'dual control: the proposal is marked approved'
  );

  -- Approving twice does nothing the second time.
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'senior2@example.test', true, 'again', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'already-decided', 'dual control: a decided proposal cannot be re-approved');
end;
$$;

-- ============================================================ 8. termination needs an admin

do $$
declare
  v_result jsonb;
  v_version integer;
  v_pending uuid;
begin
  select console_version into v_version from public.nw_reports where id = '30000000-0000-0000-0000-0000000000a5';
  -- A permanent suspension is proposed as a termination, whatever the length field says.
  v_result := public.nw_console_enforce_report(
    '30000000-0000-0000-0000-0000000000a5', v_version, 'senior@example.test', 'hide_article',
    'clearing the way', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'article-hidden', 'termination setup: unrelated article hidden');

  insert into public.nw_pending_actions
    (kind, target_kind, target_id, params, reason, proposed_by, proposed_role, expires_at)
  values
    ('terminate_account', 'profile', '10000000-0000-0000-0000-0000000000a1',
     jsonb_build_object('permanent', true), 'permanent ban', 'senior@example.test', 'senior',
     now() + interval '7 days')
  returning id into v_pending;

  -- A senior cannot approve a termination.
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'senior2@example.test', true, 'senior approving a termination', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'insufficient-role', 'termination: a senior cannot approve it');

  -- The admin can, and it writes the far-future sentinel rather than null (a null
  -- `until` would LIFT the ban, which is the bug this guards).
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'admin@example.test', true, 'confirmed with counsel', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'pending-approved', 'termination: the admin approves');
  perform pg_temp.check_eq(v_result->>'outcome', 'account-terminated', 'termination: outcome recorded');
  perform pg_temp.check_eq(
    (select suspended_until from public.nw_profiles where id = '10000000-0000-0000-0000-0000000000a1')::text,
    (select public.nw_console_permanent_until())::text,
    'termination: the permanent sentinel is written, not null'
  );
end;
$$;

-- ============================================================ 9. payment-adjacent dual control

do $$
declare
  v_result jsonb;
  v_version integer;
  v_pending uuid;
begin
  select console_version into v_version from public.nw_payout_accounts
  where journalist_profile_id = '10000000-0000-0000-0000-0000000000a1';

  -- A senior cannot even propose a payout block.
  v_result := public.nw_console_propose_payout_action(
    '10000000-0000-0000-0000-0000000000a1', v_version, 'senior@example.test', true,
    'senior trying', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'insufficient-role', 'payouts: a senior cannot propose a block');

  -- An admin proposes. Nothing changes yet: there is no single-admin path.
  v_result := public.nw_console_propose_payout_action(
    '10000000-0000-0000-0000-0000000000a1', v_version, 'admin@example.test', true,
    'terminated account', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'pending-approval', 'payouts: an admin proposal is pending');
  v_pending := (v_result->>'pendingId')::uuid;
  perform pg_temp.check_eq(
    (select onboarding_state from public.nw_payout_accounts
     where journalist_profile_id = '10000000-0000-0000-0000-0000000000a1'),
    'verified', 'payouts: nothing changed on the proposal'
  );

  -- The proposing admin cannot approve it.
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'admin@example.test', true, 'approving my own', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'self-approval', 'payouts: the proposing admin cannot approve');

  -- A second admin approves and the block applies.
  perform public.nw_moderator_role_grant('admin@example.test', 'admin2@example.test', 'admin', '');
  v_result := public.nw_console_decide_pending_action(
    v_pending, 'admin2@example.test', true, 'verified the termination', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'pending-approved', 'payouts: a second admin approves');
  perform pg_temp.check_eq(
    (select onboarding_state from public.nw_payout_accounts
     where journalist_profile_id = '10000000-0000-0000-0000-0000000000a1'),
    'blocked', 'payouts: the account is blocked'
  );
  perform pg_temp.check_eq(
    (select status_reason from public.nw_payout_accounts
     where journalist_profile_id = '10000000-0000-0000-0000-0000000000a1'),
    'terminated account', 'payouts: the proposer''s reason is recorded on the account'
  );
end;
$$;

-- ============================================================ 10. failed execution marks the proposal failed

do $$
declare
  v_result jsonb;
  v_pending uuid;
begin
  -- Unblocking an account that is not blocked cannot execute. The approval has to
  -- roll back rather than leave a proposal that reads as approved.
  insert into public.nw_pending_actions
    (kind, target_kind, target_id, params, reason, proposed_by, proposed_role, expires_at)
  values
    ('payout_unblock', 'payout_account', '10000000-0000-0000-0000-0000000000a2',
     '{}'::jsonb, 'unblock someone with no account', 'admin@example.test', 'admin',
     now() + interval '7 days')
  returning id into v_pending;

  v_result := public.nw_console_decide_pending_action(
    v_pending, 'admin2@example.test', true, 'approving an impossible action', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'not-blocked', 'failed execution: the executor names the failure');
  perform pg_temp.check_that((v_result->>'rolledBack')::boolean, 'failed execution: rolled back');
  perform pg_temp.check_eq(
    (select state from public.nw_pending_actions where id = v_pending),
    'failed', 'failed execution: the proposal is marked failed, not approved'
  );
end;
$$;

-- ============================================================ 11. recovery: withdraw and expire

do $$
declare
  v_result jsonb;
  v_pending uuid;
  v_expired integer;
begin
  insert into public.nw_pending_actions
    (kind, target_kind, target_id, params, reason, proposed_by, proposed_role, expires_at)
  values
    ('restore_content', 'dmca_notice', '40000000-0000-0000-0000-0000000000a1',
     jsonb_build_object('noticeKind', 'takedown'), 'proposed in error', 'senior@example.test', 'senior',
     now() + interval '7 days')
  returning id into v_pending;

  -- Only the proposer can withdraw their own proposal.
  v_result := public.nw_console_cancel_pending_action(
    v_pending, 'senior2@example.test', 'not mine to withdraw', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'not-proposer', 'recovery: only the proposer withdraws');

  v_result := public.nw_console_cancel_pending_action(
    v_pending, 'senior@example.test', 'proposed against the wrong notice', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'cancelled', 'recovery: the proposer withdraws it');
  perform pg_temp.check_eq(
    (select state from public.nw_pending_actions where id = v_pending),
    'cancelled', 'recovery: state is cancelled'
  );

  -- An unanswered proposal expires rather than staying approvable forever.
  insert into public.nw_pending_actions
    (kind, target_kind, target_id, params, reason, proposed_by, proposed_role, expires_at)
  values
    ('suspend_long', 'profile', '10000000-0000-0000-0000-0000000000a2',
     jsonb_build_object('until', (now() + interval '30 days')::text), 'stale proposal',
     'senior@example.test', 'senior', now() - interval '1 minute')
  returning id into v_pending;

  v_result := public.nw_console_decide_pending_action(
    v_pending, 'senior2@example.test', true, 'approving a stale proposal', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'expired', 'recovery: an expired proposal cannot be approved');
  perform pg_temp.check_eq(
    (select state from public.nw_pending_actions where id = v_pending),
    'expired', 'recovery: it is marked expired'
  );

  select public.nw_console_expire_pending_actions() into v_expired;
  perform pg_temp.check_that(v_expired >= 0, 'recovery: the expiry sweep runs');
end;
$$;

-- ============================================================ 12. user appeals

do $$
declare
  v_outcome text;
  v_result jsonb;
  v_action uuid;
  v_appeal uuid;
  v_version integer;
begin
  -- The action taken in section 4 against the author's article.
  select id into v_action from public.nw_moderation_actions
  where target_id = '20000000-0000-0000-0000-0000000000a1' and action = 'hide_article'
  order by created_at limit 1;
  perform pg_temp.check_that(v_action is not null, 'appeals: found the action to appeal');

  -- Someone else's action is not appealable, and answers exactly like a missing
  -- one, so this cannot be used to probe which action ids exist.
  v_outcome := public.nw_moderation_appeal_request(
    v_action, '10000000-0000-0000-0000-0000000000a2', 'not my content'
  );
  perform pg_temp.check_eq(v_outcome, 'not-found', 'appeals: a non-owner gets not-found');
  v_outcome := public.nw_moderation_appeal_request(
    '99999999-9999-9999-9999-999999999999', '10000000-0000-0000-0000-0000000000a2', 'fishing'
  );
  perform pg_temp.check_eq(v_outcome, 'not-found', 'appeals: a missing action gets the same answer');

  v_outcome := public.nw_moderation_appeal_request(v_action, '10000000-0000-0000-0000-0000000000a1', '   ');
  perform pg_temp.check_eq(v_outcome, 'bad-reason', 'appeals: a blank reason is refused');

  -- The owner can appeal, once.
  v_outcome := public.nw_moderation_appeal_request(
    v_action, '10000000-0000-0000-0000-0000000000a1', 'this was a quote, not harassment'
  );
  perform pg_temp.check_eq(v_outcome, 'ok', 'appeals: the owner files one');
  v_outcome := public.nw_moderation_appeal_request(
    v_action, '10000000-0000-0000-0000-0000000000a1', 'again'
  );
  perform pg_temp.check_eq(v_outcome, 'already-appealed', 'appeals: only one per action');

  -- It shows up in the unified operator queue.
  perform pg_temp.check_that(
    exists (select 1 from public.nw_console_appeals where source = 'moderation' and state = 'requested'),
    'appeals: it appears in the unified queue'
  );

  select id, console_version into v_appeal, v_version from public.nw_moderation_appeals
  where action_id = v_action;

  -- A reviewer cannot decide an appeal at all: deciding one is senior work,
  -- because it is review of a colleague's decision.
  v_result := public.nw_console_dispose_moderation_appeal(
    v_appeal, v_version, 'reviewer@example.test', true, 'a reviewer deciding', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'insufficient-role', 'appeals: a reviewer cannot decide one');
  v_result := public.nw_console_dispose_moderation_appeal(
    v_appeal, v_version, 'stranger@example.test', true, 'no role at all', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'no-role', 'appeals: an unknown moderator cannot decide');

  -- A senior grants it, and the grant REVERSES the action in the same step.
  v_result := public.nw_console_dispose_moderation_appeal(
    v_appeal, v_version, 'senior@example.test', true, 'agreed, it was a quote', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'appeal-granted', 'appeals: a senior grants it');
  perform pg_temp.check_eq(v_result->>'reversal', 'article-republished', 'appeals: the reversal is reported');
  perform pg_temp.check_eq(
    (select status from public.nw_articles where id = '20000000-0000-0000-0000-0000000000a1'),
    'published', 'appeals: the article is published again'
  );
  perform pg_temp.check_that(
    exists (
      select 1 from public.nw_moderation_actions
      where target_id = '20000000-0000-0000-0000-0000000000a1' and action = 'restore'
    ),
    'appeals: the reversal is itself a statement of reasons'
  );

  -- A decided appeal cannot be decided again.
  select console_version into v_version from public.nw_moderation_appeals where id = v_appeal;
  v_result := public.nw_console_dispose_moderation_appeal(
    v_appeal, v_version, 'senior2@example.test', false, 'changing the answer', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'already-decided', 'appeals: a decided appeal is final');

  -- A non-adverse action is not appealable. The reversal just written is a
  -- 'restore', which the statement-of-reasons feed does not show and which nobody
  -- needs to contest.
  select id into v_action from public.nw_moderation_actions
  where target_id = '20000000-0000-0000-0000-0000000000a1' and action = 'restore'
  order by created_at desc limit 1;
  perform pg_temp.check_that(v_action is not null, 'appeals: found the restore action');
  v_outcome := public.nw_moderation_appeal_request(
    v_action, '10000000-0000-0000-0000-0000000000a1', 'appealing my own reinstatement'
  );
  perform pg_temp.check_eq(v_outcome, 'not-appealable', 'appeals: a non-adverse action cannot be appealed');
  perform pg_temp.check_that(
    not exists (select 1 from public.nw_moderation_appeals where action_id = v_action),
    'appeals: no appeal row was written for it'
  );

  -- SAME MODERATOR: the senior who took the copyright strike in section 6 cannot
  -- rule on the appeal against it, even though their role would otherwise allow it.
  select id into v_action from public.nw_moderation_actions
  where target_id = '20000000-0000-0000-0000-0000000000a4' and action = 'hide_article'
  order by created_at limit 1;
  perform pg_temp.check_that(v_action is not null, 'appeals: found the senior''s own action');
  v_outcome := public.nw_moderation_appeal_request(
    v_action, '10000000-0000-0000-0000-0000000000a1', 'I hold the licence'
  );
  perform pg_temp.check_eq(v_outcome, 'ok', 'appeals: the author appeals the strike');
  select id, console_version into v_appeal, v_version from public.nw_moderation_appeals
  where action_id = v_action;

  v_result := public.nw_console_dispose_moderation_appeal(
    v_appeal, v_version, 'senior@example.test', false, 'denying my own decision''s appeal',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'same-moderator', 'appeals: the deciding moderator cannot rule on it');
  perform pg_temp.check_eq(
    (select state from public.nw_moderation_appeals where id = v_appeal),
    'requested', 'appeals: it is still waiting for someone else'
  );

  -- A stale version is refused here too.
  v_result := public.nw_console_dispose_moderation_appeal(
    v_appeal, v_version + 5, 'senior2@example.test', false, 'acting on a stale view',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'stale-action', 'appeals: a stale version is refused');

  -- A different senior can deny it, and a denial reverses nothing.
  v_result := public.nw_console_dispose_moderation_appeal(
    v_appeal, v_version, 'senior2@example.test', false, 'the licence does not cover this use',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'appeal-denied', 'appeals: a second senior denies it');
  perform pg_temp.check_eq(
    (select status from public.nw_articles where id = '20000000-0000-0000-0000-0000000000a4'),
    'retracted', 'appeals: a denial leaves the article retracted'
  );

  -- The statement-of-reasons read carries the appeal state the app renders.
  perform pg_temp.check_that(
    exists (
      select 1 from public.nw_get_my_moderation_notices_v2('00000000-0000-0000-0000-0000000000a1')
      where appeal_state = 'granted' and appeal_reversal_outcome = 'article-republished'
    ),
    'appeals: the author-facing read shows the granted appeal and what it changed'
  );
  perform pg_temp.check_that(
    not exists (
      select 1 from public.nw_get_my_moderation_notices_v2('00000000-0000-0000-0000-0000000000a2')
      where target_id = '20000000-0000-0000-0000-0000000000a1'
    ),
    'appeals: the read is scoped to the caller''s own content'
  );
end;
$$;

-- ============================================================ 13. assignment and escalation

do $$
declare
  v_result jsonb;
begin
  v_result := public.nw_console_assign(
    'reviewer@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'reviewer@example.test',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'assigned', 'assignment: a reviewer claims free work');

  -- A reviewer cannot take work off a colleague.
  v_result := public.nw_console_assign(
    'reviewer3@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'reviewer3@example.test',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'no-role', 'assignment: an unknown moderator cannot claim');

  perform public.nw_moderator_role_grant('admin@example.test', 'reviewer3@example.test', 'reviewer', '');
  v_result := public.nw_console_assign(
    'reviewer3@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'reviewer3@example.test',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'assigned-elsewhere', 'assignment: a reviewer cannot reassign a held item');

  -- A senior can.
  v_result := public.nw_console_assign(
    'senior@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'reviewer3@example.test',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'assigned', 'assignment: a senior reassigns');
  perform pg_temp.check_eq(
    (select assignee_ref from public.nw_queue_assignments
     where queue = 'report' and item_id = '30000000-0000-0000-0000-0000000000a6'),
    'reviewer3@example.test', 'assignment: the new assignee is recorded'
  );

  -- Escalation needs a reason, and clearing one is a senior call.
  v_result := public.nw_console_escalate(
    'reviewer@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'senior', '  ',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'bad-reason', 'escalation: a reason is required');

  v_result := public.nw_console_escalate(
    'reviewer@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'senior',
    'target is gone and I do not know what to do', gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'escalated', 'escalation: a reviewer can escalate');

  v_result := public.nw_console_escalate(
    'reviewer@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'none', '',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'insufficient-role', 'escalation: a reviewer cannot clear one');

  v_result := public.nw_console_escalate(
    'senior@example.test', 'report', '30000000-0000-0000-0000-0000000000a6', 'none', '',
    gen_random_uuid()::text
  );
  perform pg_temp.check_eq(pg_temp.code_of(v_result), 'escalated', 'escalation: a senior clears one');
end;
$$;

-- ============================================================ 14. immutable, verifiable audit

do $$
declare
  v_verdict jsonb;
  v_export jsonb;
  v_seq bigint;
  v_failed boolean := false;
  v_count bigint;
begin
  select count(*) into v_count from public.nw_console_audit;
  perform pg_temp.check_that(v_count > 20, 'audit: every action left a row');

  v_verdict := public.nw_console_audit_verify();
  perform pg_temp.check_that((v_verdict->>'ok')::boolean, 'audit: the chain verifies');
  perform pg_temp.check_eq((v_verdict->>'checked')::text, v_count::text, 'audit: every row was checked');

  -- The export is self-verifying and carries the payload text a reader needs.
  v_export := public.nw_console_audit_export(0, 10000);
  perform pg_temp.check_that(
    (v_export->'sqlVerification'->>'ok')::boolean, 'audit: the export verifies in SQL'
  );
  perform pg_temp.check_that(
    jsonb_array_length(v_export->'rows') = v_count, 'audit: the export carries every row'
  );
  perform pg_temp.check_that(
    (v_export->'rows'->0) ? 'payloadText' and (v_export->'rows'->0) ? 'prevHash'
      and (v_export->'rows'->0) ? 'rowHash' and (v_export->'rows'->0) ? 'createdAtCanonical',
    'audit: the export carries everything an offline verifier needs'
  );
  perform pg_temp.check_eq(
    v_export->>'genesisPrevHash', repeat('0', 64), 'audit: the genesis anchor is published'
  );

  -- Append-only: update, delete, and truncate are all refused.
  select seq into v_seq from public.nw_console_audit order by seq limit 1;
  begin
    update public.nw_console_audit set reason = 'edited' where seq = v_seq;
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.check_that(v_failed, 'audit: UPDATE is refused by trigger');

  v_failed := false;
  begin
    delete from public.nw_console_audit where seq = v_seq;
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.check_that(v_failed, 'audit: DELETE is refused by trigger');

  v_failed := false;
  begin
    truncate public.nw_console_audit;
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.check_that(v_failed, 'audit: TRUNCATE is refused by trigger');

  perform pg_temp.check_that(
    (public.nw_console_audit_verify()->>'ok')::boolean,
    'audit: the chain is still intact after the refused writes'
  );
end;
$$;

-- ============================================================ 15. tampering breaks the chain

do $$
declare
  v_seq bigint;
  v_next bigint;
  v_reason text;
  v_payload jsonb;
  v_verdict jsonb;
begin
  -- Disable the immutability trigger to simulate someone with direct database
  -- access editing history. The hash chain is the defence that survives exactly
  -- that, so this is the test that proves the chain does anything at all.
  alter table public.nw_console_audit disable trigger nw_console_audit_no_update;

  select seq, reason, payload into v_seq, v_reason, v_payload
  from public.nw_console_audit order by seq offset 2 limit 1;
  select min(seq) into v_next from public.nw_console_audit where seq > v_seq;

  -- 1. An edited field.
  update public.nw_console_audit set reason = 'a reason nobody gave' where seq = v_seq;
  v_verdict := public.nw_console_audit_verify();
  perform pg_temp.check_that(not (v_verdict->>'ok')::boolean, 'tamper: an edited reason breaks the chain');
  perform pg_temp.check_eq((v_verdict->>'badSeq')::text, v_seq::text, 'tamper: the bad row is named');
  perform pg_temp.check_eq(v_verdict->>'reason', 'row-hash', 'tamper: reported as a row-hash mismatch');

  -- Restoring the exact original value verifies again, so the detection is exact
  -- rather than a one-way latch.
  update public.nw_console_audit set reason = v_reason where seq = v_seq;
  perform pg_temp.check_that(
    (public.nw_console_audit_verify()->>'ok')::boolean,
    'tamper: restoring the original value verifies again'
  );

  -- 2. An edited payload, caught by its own hash before the row hash.
  update public.nw_console_audit set payload = jsonb_build_object('injected', true) where seq = v_seq;
  v_verdict := public.nw_console_audit_verify();
  perform pg_temp.check_that(not (v_verdict->>'ok')::boolean, 'tamper: an edited payload breaks the chain');
  perform pg_temp.check_eq(v_verdict->>'reason', 'payload-hash', 'tamper: reported as a payload-hash mismatch');
  update public.nw_console_audit set payload = v_payload where seq = v_seq;
  perform pg_temp.check_that(
    (public.nw_console_audit_verify()->>'ok')::boolean, 'tamper: payload restored, chain intact'
  );

  -- 3. A resealed row: payload hash AND row hash recomputed by the tamperer. The
  -- NEXT row's prev_hash still points at the old hash, which is the entire point
  -- of chaining rather than hashing each row on its own.
  update public.nw_console_audit
    set payload = jsonb_build_object('injected', true),
        payload_hash = encode(sha256(convert_to(jsonb_build_object('injected', true)::text, 'utf8')), 'hex')
    where seq = v_seq;
  update public.nw_console_audit
    set row_hash = public.nw_console_audit_row_hash(
      prev_hash, seq, created_at_canonical, actor_ref, actor_role, action, target_kind,
      target_id, outcome, reason, payload_hash
    )
    where seq = v_seq;
  v_verdict := public.nw_console_audit_verify();
  perform pg_temp.check_that(not (v_verdict->>'ok')::boolean, 'tamper: a fully resealed row still breaks the chain');
  perform pg_temp.check_eq((v_verdict->>'badSeq')::text, v_next::text, 'tamper: the break surfaces at the NEXT row');
  perform pg_temp.check_eq(v_verdict->>'reason', 'prev-hash', 'tamper: reported as a broken link');

  -- 4. A deleted row. The chain closes over a gap it cannot hide.
  update public.nw_console_audit
    set payload = v_payload,
        payload_hash = encode(sha256(convert_to(v_payload::text, 'utf8')), 'hex')
    where seq = v_seq;
  update public.nw_console_audit
    set row_hash = public.nw_console_audit_row_hash(
      prev_hash, seq, created_at_canonical, actor_ref, actor_role, action, target_kind,
      target_id, outcome, reason, payload_hash
    )
    where seq = v_seq;
  perform pg_temp.check_that(
    (public.nw_console_audit_verify()->>'ok')::boolean, 'tamper: fully restored, chain intact'
  );

  delete from public.nw_console_audit where seq = v_seq;
  v_verdict := public.nw_console_audit_verify();
  perform pg_temp.check_that(not (v_verdict->>'ok')::boolean, 'tamper: a deleted row breaks the chain');
  perform pg_temp.check_eq((v_verdict->>'badSeq')::text, v_next::text, 'tamper: the gap surfaces at the following row');
  perform pg_temp.check_eq(v_verdict->>'reason', 'prev-hash', 'tamper: a deletion reads as a broken link');

  alter table public.nw_console_audit enable trigger nw_console_audit_no_update;
end;
$$;

-- ============================================================ report

do $$
declare
  v_total integer;
  v_failed integer;
begin
  select count(*), count(*) filter (where not ok) into v_total, v_failed from _checks;
  raise notice 'nw_console_integrity: % checks, % failed', v_total, v_failed;
  if v_failed > 0 then
    raise exception 'nw_console_integrity: % of % checks failed', v_failed, v_total;
  end if;
  if v_total < 90 then
    raise exception 'nw_console_integrity: only % checks ran; the suite did not complete', v_total;
  end if;
end;
$$;

rollback;
