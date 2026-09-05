-- MyNews plan 48 WP12 hardening: account-deletion + key-custody adversarial
-- review findings (opus crypto/custody reviewer, 2026-07-30).
--
-- HIGH: nw_profiles.deleted_at and pubkey_revoked_at, added by WP5 migration
-- 20260730000006, had NO client-write guard. The guard trigger
-- nw_profiles_guard_suspension_write (20260705000008) is a denylist that only
-- covered suspended_until and copyright_strikes, and nw_profiles_self_update is
-- otherwise unrestricted. So a stolen session could PATCH those two columns
-- directly, with two payoffs:
--   A. Setting deleted_at permanently disabled every WP6 recovery path
--      (nw_key_resolve_active and all custody RPCs treat deleted_at as a hard
--      revocation), locking the real owner out of their own key with no undo.
--   B. Setting deleted_at before the grace window skipped nw_account_deletion_
--      dispose's anonymization block (gated on `deleted_at is null`), so the
--      identity stayed fully intact and publicly readable while the deletion
--      still reported success and the auth user was removed.
-- Fix: extend the guard to those two columns, and stop trusting deleted_at as
-- the dispose idempotency flag (use the anonymization marker the function itself
-- writes: display_name = 'Deleted account').
--
-- MED #4: the five WP6 custody tables (escrow ciphertext of the user's private
-- key, escrow access log, recovery requests, nonces, notify channels) are purely
-- personal but survived "HARD DELETE every purely personal row". Add them.
--
-- MED #3: an OPEN-reported suggestion was hard-deleted 7 days after its author
-- filed for deletion, destroying moderation evidence (delete-to-evade). Retain a
-- reported suggestion under the anonymized profile instead.

-- ============================================================ client-write guard

-- Extend the existing guard (still fired by the nw_profiles_suspension_guard
-- trigger from 20260705000007) to the two lifecycle columns. Service-role
-- writers (dispose, security definer) are exempt: current_user is the table
-- owner, not 'authenticated'/'anon', under the service-role JWT.
create or replace function public.nw_profiles_guard_suspension_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.suspended_until is distinct from old.suspended_until then
      raise exception 'nw_profiles: suspension is set only by the moderation console';
    end if;
    if new.copyright_strikes is distinct from old.copyright_strikes then
      raise exception 'nw_profiles: copyright strikes are set only by the moderation console';
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'nw_profiles: deleted_at is set only by account deletion';
    end if;
    if new.pubkey_revoked_at is distinct from old.pubkey_revoked_at then
      raise exception 'nw_profiles: pubkey_revoked_at is set only by key custody';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================ dispose v2

create or replace function public.nw_account_deletion_dispose(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  v_status text;
  v_display_name text;
  v_deleted_at timestamptz;
  v_handle text;
  v_attempt integer := 0;
begin
  select user_id, profile_id, status
  into v_user_id, v_profile_id, v_status
  from public.nw_deletion_requests
  where id = p_request_id
  for update;

  if not found then
    return 'not-found';
  end if;
  if v_status <> 'processing' then
    return 'bad-status';
  end if;

  if v_profile_id is not null then
    -- ---------------------------------------------------------------- HARD DELETE
    delete from public.nw_follows where follower_id = v_profile_id;
    delete from public.nw_blocks where blocker_id = v_profile_id;
    delete from public.nw_newsroom_members where profile_id = v_profile_id;
    delete from public.nw_journalist_verifications where journalist_id = v_profile_id;
    delete from public.nw_suggestion_events
    where actor_id = v_profile_id and action = 'comment';

    -- WP6 custody personal data (finding #4): the escrow row is the user's own
    -- encrypted private key, the access log and recovery requests are their
    -- custody history, and notify channels hold a contact address. All purely
    -- personal and none is public record, so all are hard-deleted here. Nonces
    -- are ephemeral but cleared for completeness.
    delete from public.nw_key_escrow where profile_id = v_profile_id;
    delete from public.nw_key_escrow_access where profile_id = v_profile_id;
    delete from public.nw_key_recovery_requests where profile_id = v_profile_id;
    delete from public.nw_key_nonces where profile_id = v_profile_id;
    delete from public.nw_key_notify_channels where profile_id = v_profile_id;
    -- nw_profile_keys is the authorship chain that verifies retained public
    -- revisions, so it is NOT deleted; the key-chain-sync trigger revokes the
    -- active rows when pubkey_ed25519 is cleared below.

    -- nw_edit_suggestions: suggestions that never became public record. An OPEN
    -- suggestion that is the target of an open report is RETAINED (finding #3):
    -- deleting it would destroy moderation evidence and let deletion be used to
    -- evade a pending report. It stays under the anonymized profile.
    delete from public.nw_edit_suggestions
    where editor_id = v_profile_id
      and status in ('open', 'rejected', 'stale')
      and not exists (
        select 1 from public.nw_reports r
        where r.target_kind = 'suggestion'
          and r.target_id = nw_edit_suggestions.id::text
          and r.status = 'open'
      );

    -- nw_articles (drafts only, and only non-quarantined): never public.
    -- Guarded so a collaborative draft that already awarded credibility to
    -- ANOTHER editor is not deleted. A quarantined article carries status
    -- 'quarantined', not 'draft', so this never reaches held content.
    delete from public.nw_articles a
    where a.author_id = v_profile_id
      and a.status = 'draft'
      and not exists (
        select 1
        from public.nw_credibility_ledger l
        join public.nw_edit_suggestions s on s.id = l.suggestion_id
        where s.article_id = a.id
          and l.editor_id <> v_profile_id
      );

    update public.nw_article_revisions r
    set headline = '[removed at author request]',
        dek = null,
        body_md = '',
        signature = '',
        signer_pubkey = ''
    where exists (
      select 1 from public.nw_articles a
      where a.id = r.article_id
        and a.author_id = v_profile_id
        and a.status = 'draft'
    );

    delete from public.nw_article_meta m
    where exists (
      select 1 from public.nw_articles a
      where a.id = m.article_id
        and a.author_id = v_profile_id
        and a.status = 'draft'
    );

    -- ------------------------------------------------------- MONEY: stop, retain
    update public.nw_supports
    set status = 'canceled'
    where supporter_id = v_profile_id and status <> 'canceled';

    update public.nw_payout_accounts
    set onboarding_state = 'none',
        provider = null,
        provider_account_ref = null,
        status_reason = 'account deleted',
        updated_at = now()
    where journalist_profile_id = v_profile_id;

    -- ------------------------------------------------- RETAIN + ANONYMIZE
    -- Idempotency (finding #1b): key the one-shot on the anonymization marker
    -- this function itself writes, NOT on deleted_at. deleted_at is now guarded
    -- against client writes, but display_name = 'Deleted account' is the honest
    -- proof that anonymization already ran, so a stray deleted_at can never skip
    -- the scrub.
    select display_name, deleted_at into v_display_name, v_deleted_at
    from public.nw_profiles where id = v_profile_id;

    if v_display_name is distinct from 'Deleted account' or v_deleted_at is null then
      loop
        v_attempt := v_attempt + 1;
        v_handle := 'deleted_' || left(md5(random()::text), 10);
        exit when not exists (select 1 from public.nw_profiles where handle = v_handle);
        if v_attempt >= 20 then
          raise exception 'nw_account_deletion_dispose: could not allocate an anonymized handle';
        end if;
      end loop;

      update public.nw_profiles
      set handle = v_handle,
          display_name = 'Deleted account',
          pubkey_ed25519 = '',
          pubkey_revoked_at = now(),
          deleted_at = now(),
          user_id = null
      where id = v_profile_id;

      update public.nw_journalists
      set bio = '',
          beats = '{}',
          region = '',
          stripe_account_id = null
      where profile_id = v_profile_id;
    end if;
  end if;

  delete from public.nw_terms_acceptance where user_id = v_user_id;

  update public.nw_deletion_requests
  set content_disposed_at = now(),
      auth_user_deletion_state =
        case when auth_user_deletion_state = 'done' then 'done' else 'pending' end,
      processor_cleanup_state =
        case when processor_cleanup_state = 'done' then 'done' else 'pending' end
  where id = p_request_id;

  return 'ok';
end;
$$;

revoke all on function public.nw_account_deletion_dispose(uuid) from public, anon, authenticated;
grant execute on function public.nw_account_deletion_dispose(uuid) to service_role;
