-- MyNews key custody and authorship continuity (plan 48 WP6, closes finding
-- C09). Design: docs/designs/mynews-key-custody.md revision 2.
--
-- Before this migration a profile had exactly ONE Ed25519 binding for life:
-- nw_profiles.pubkey_ed25519, set once through nw_set_profile_pubkey (migration
-- 20260705000003) and never rotatable. A lost or replaced device meant the
-- journalist could still sign in by email but could never publish another
-- revision of their own work. Email sign-in was presented as recovery; it was
-- not.
--
-- This migration adds the custody chain that makes loss recoverable and
-- compromise survivable, without ever letting the server hold usable key
-- material:
--
--   nw_profile_keys            the server-ordered chain (seq bigserial). One
--                              active 'primary' head plus co-active 'device'
--                              keys. Active pubkeys are globally unique, so a
--                              key can never be squatted across profiles.
--   nw_key_nonces              single-use, 5-minute, purpose+identity-bound
--                              proof nonces, CONSUMED inside the mutation.
--   nw_key_escrow              append-versioned recovery-kit CIPHERTEXT only.
--   nw_key_escrow_access       owner-visible escrow access events (also the
--                              rate-limit ledger and the backup-restore
--                              transparency window).
--   nw_key_recovery_requests   the no-kit recovery state machine.
--   nw_key_notify_channels     the fail-closed dependency the no-kit path needs.
--   nw_key_events              the PUBLIC custody event feed.
--
-- Compatibility invariant (design section "Schema"): nw_profiles.pubkey_ed25519
-- stays the denormalized PRIMARY head. nw_set_profile_pubkey, its 'already-set'
-- guard, and the nw_profiles client-write guard trigger from 20260705000003 are
-- BYTE-UNCHANGED and remain the only initial-bind path. Everything else lands
-- through the new SECURITY DEFINER RPCs below.
--
-- Two design decisions worth reading before editing this file:
--
-- 1. The chain row for an INITIAL bind is written by a trigger
--    (nw_profiles_sync_key_chain), not by nw_set_profile_pubkey. The design
--    freezes that function, and the resolver refuses any key with no chain row,
--    so without the trigger every profile registered after this migration would
--    be unable to publish. The same trigger REVOKES every active chain row when
--    a head is cleared, which is exactly what nw_account_deletion_dispose
--    (migration 20260730000006) does when it anonymizes a deleted account. That
--    is why this migration does not create-or-replace the ~200-line dispose
--    function: a transition trigger covers the anonymization path and any other
--    clearing path, present or future, without duplicating it.
--
-- 2. verified_key_id is stamped by AFTER INSERT triggers on
--    nw_article_revisions and nw_edit_suggestions rather than threaded as a new
--    parameter through nw_publish_article / nw_accept_suggestion*. The stamp is
--    then in the SAME transaction as the write, is impossible for a caller to
--    omit or forge, and needs no change to the publish/review RPC signatures.
--    Resolution prefers the active row for that pubkey and falls back to the
--    highest-seq row, so a revision stays correctly attributed even if the key
--    is revoked immediately afterwards.
--
-- Wall-clock honesty (design threat "Backdated createdAt"): valid_from and
-- revoked_at are DISPLAY ONLY. Signature validity never depends on them, and
-- never on the client's createdAt. Historical verification is chain membership
-- plus the recorded verified_key_id.

-- ========================================================= the custody chain

create table if not exists public.nw_profile_keys (
  id uuid primary key default gen_random_uuid(),
  -- Authoritative order. bigserial, not a timestamp: no wall-clock semantics.
  seq bigserial not null unique,
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  pubkey text not null check (pubkey ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  kind text not null check (kind in ('primary', 'device')),
  added_via text not null check (
    added_via in ('initial', 'rotation', 'device_approval', 'recovery', 'backup_restore')
  ),
  -- Canonical proof inputs and signatures for this transition. Public.
  proof_json jsonb not null default '{}'::jsonb,
  prev_key_id uuid references public.nw_profile_keys (id) on delete set null,
  valid_from timestamptz not null default now(),
  revoked_at timestamptz,
  -- A revoked row always carries its revocation stamp, and an active row never
  -- does. Keeps the display timeline honest and makes the status the only thing
  -- the resolver has to trust.
  constraint nw_profile_keys_revoked_stamp check (
    (status = 'revoked' and revoked_at is not null)
    or (status = 'active' and revoked_at is null)
  )
);

alter table public.nw_profile_keys enable row level security;

-- The chain is public: it is the record readers use to verify which key signed
-- which revision. Every column here is already public information (public keys,
-- signatures over public bytes, server-ordered transition metadata).
create policy nw_profile_keys_public_select on public.nw_profile_keys
  for select using (true);

-- Cross-profile squat prevention, global across the whole table: one ACTIVE row
-- per pubkey, ever. A revoked row may coexist with an active row elsewhere,
-- which is what makes historical verification work after a rotation.
create unique index if not exists idx_nw_profile_keys_active_pubkey
  on public.nw_profile_keys (pubkey)
  where status = 'active';

create index if not exists idx_nw_profile_keys_profile
  on public.nw_profile_keys (profile_id, seq desc);

create index if not exists idx_nw_profile_keys_pubkey_lookup
  on public.nw_profile_keys (pubkey, status);

-- At most one active PRIMARY per profile. Device keys are co-active by design.
create unique index if not exists idx_nw_profile_keys_one_active_primary
  on public.nw_profile_keys (profile_id)
  where status = 'active' and kind = 'primary';

comment on table public.nw_profile_keys is
  'Server-ordered public key chain per profile. One active primary head plus co-active device keys; active pubkeys are globally unique. valid_from/revoked_at are display only and never gate signature validity.';

-- ==================================================== verified_key_id records

-- The authoritative server record of WHICH chain row verified a stored write.
-- on delete set null rather than restrict: nw_profiles rows are retained (never
-- hard deleted) by the WP5 deletion pipeline, so the cascade that would reach
-- these rows does not happen in practice; a null reads as 'not chain-recorded',
-- which the reader verifier reports honestly rather than as verified.
alter table public.nw_article_revisions
  add column if not exists verified_key_id uuid
  references public.nw_profile_keys (id) on delete set null;

alter table public.nw_edit_suggestions
  add column if not exists verified_key_id uuid
  references public.nw_profile_keys (id) on delete set null;

comment on column public.nw_article_revisions.verified_key_id is
  'Chain row whose pubkey verified this revision, stamped server-side at insert. Null means the write predates the chain (or its author was anonymized): signed, but not chain-recorded.';
comment on column public.nw_edit_suggestions.verified_key_id is
  'Chain row whose pubkey verified this suggestion, stamped server-side at insert. Null means the write predates the chain.';

-- nw_edit_suggestions stored a signature but never the key that made it: the
-- reader had to look up the editor's CURRENT profile pubkey. That was already
-- fragile and rotation makes it wrong, because every suggestion an editor filed
-- before a rotation would become unverifiable the moment they rotated. Recording
-- the signer alongside the signature is what keeps the suggestion record
-- offline re-verifiable across custody transitions, and it is what lets the
-- verified_key_id stamp resolve the EXACT key rather than guess the editor's
-- primary. nw_article_revisions has always carried signer_pubkey.
alter table public.nw_edit_suggestions
  add column if not exists signer_pubkey text not null default '';

comment on column public.nw_edit_suggestions.signer_pubkey is
  'The Ed25519 key that signed this suggestion. Empty on rows written before this migration; those fall back to the editor profile lookup and are reported as not chain-recorded.';

create index if not exists idx_nw_article_revisions_verified_key
  on public.nw_article_revisions (verified_key_id);
create index if not exists idx_nw_edit_suggestions_verified_key
  on public.nw_edit_suggestions (verified_key_id);

-- ============================================================ proof nonces

create table if not exists public.nw_key_nonces (
  nonce text primary key check (nonce ~ '^[0-9a-f]{64}$'),
  -- Bound to the auth uid, the profile, the OLD head pubkey, and the purpose.
  -- A nonce issued for a device approval can never be spent on a rotation, and
  -- a nonce issued to one user can never be spent by another.
  user_id uuid not null,
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  old_pubkey text not null,
  purpose text not null check (
    purpose in ('rotation', 'device_approval', 'revocation', 'recovery_complete', 'escrow_put')
  ),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.nw_key_nonces enable row level security;
-- No client policy at all: nonces are service-role territory end to end. A
-- client that could READ another session's nonce would defeat the binding.

create index if not exists idx_nw_key_nonces_user_created
  on public.nw_key_nonces (user_id, created_at desc);
create index if not exists idx_nw_key_nonces_expiry
  on public.nw_key_nonces (expires_at);

comment on table public.nw_key_nonces is
  'Single-use custody proof nonces, 5 minute TTL, bound to (uid, profile, old head pubkey, purpose). Deleted inside the mutation transaction that spends them.';

-- ============================================================ escrow

create table if not exists public.nw_key_escrow (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  -- Append-versioned. A put NEVER overwrites: it adds max(version)+1 and prunes
  -- anything older than the newest 3, so a hostile or buggy put cannot silently
  -- destroy the kit the user actually holds a code for.
  version integer not null check (version >= 1),
  envelope_json jsonb not null,
  -- The pubkey the envelope claims to carry, for display and for the
  -- backup-restore transparency check. The ciphertext is authenticated by
  -- secretbox client-side; this column is metadata, never trusted as proof.
  pubkey text not null check (pubkey ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);

alter table public.nw_key_escrow enable row level security;

-- Owner-session read only. Even so, the app is expected to go through
-- nw_key_escrow_get so the access event and the rate limit are recorded; this
-- policy exists so a user is never locked out of their own ciphertext by an
-- edge outage.
create policy nw_key_escrow_owner_select on public.nw_key_escrow
  for select using (
    exists (
      select 1 from public.nw_profiles p
      where p.id = profile_id and p.user_id = auth.uid() and p.deleted_at is null
    )
  );

create index if not exists idx_nw_key_escrow_profile
  on public.nw_key_escrow (profile_id, version desc);

comment on table public.nw_key_escrow is
  'Append-versioned recovery-kit ciphertext (nacl.secretbox). The server never holds the recovery code, so these rows are undecryptable without the user-held code. Newest 3 versions retained.';

-- Owner-visible escrow access log. Three jobs: (1) the user can see every read
-- of their own escrow, (2) it is the 3-per-day rate-limit ledger for get, and
-- (3) a get inside the 24h window before a key bind promotes that bind to a
-- public 'backup_restore' event.
create table if not exists public.nw_key_escrow_access (
  id uuid primary key default gen_random_uuid(),
  -- Monotonic order. created_at alone is not enough: two events inside one
  -- millisecond (a put immediately followed by a read, or a burst of denied
  -- reads) would tie, and a security log whose newest row can render below an
  -- older one is misleading exactly when the owner needs it most.
  seq bigserial not null unique,
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  user_id uuid not null,
  action text not null check (action in ('put', 'get', 'get-denied')),
  version integer,
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table public.nw_key_escrow_access enable row level security;

create policy nw_key_escrow_access_owner_select on public.nw_key_escrow_access
  for select using (
    exists (
      select 1 from public.nw_profiles p
      where p.id = profile_id and p.user_id = auth.uid() and p.deleted_at is null
    )
  );

create index if not exists idx_nw_key_escrow_access_profile
  on public.nw_key_escrow_access (profile_id, seq desc);

comment on table public.nw_key_escrow_access is
  'Owner-visible escrow access events. Also the get rate-limit ledger and the 24h backup-restore transparency window.';

-- ==================================================== notification channels

-- The FAIL-CLOSED dependency for no-kit recovery. The design hard-disables the
-- no-kit path unless the profile has a CONFIRMED notification channel, because
-- that notice (carrying the keyless cancel token) is the only thing standing
-- between a stolen email session and a silent key takeover.
--
-- HONESTY BOUNDARY, read this before wiring anything to it: MyNews ships no
-- notification provider today. Nothing in this migration, in any RPC below, or
-- in any edge function can set confirmed_at. There is no insert policy for
-- clients and no service-role RPC that writes here. The table exists so the
-- gate is a real read against real data rather than a hardcoded false, and so
-- the provider that eventually lands has one obvious place to confirm into.
-- Until then nw_key_recovery_request always refuses with
-- 'notification-channel-required' and the app renders that unavailable state.
-- Do NOT add a confirmation path without also shipping the delivery provider:
-- a confirmed_at with no delivery behind it turns the fail-closed gate into a
-- fabricated capability and re-opens finding C-1.
create table if not exists public.nw_key_notify_channels (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  channel_kind text not null check (channel_kind in ('email', 'push')),
  channel_ref text not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, channel_kind, channel_ref)
);

alter table public.nw_key_notify_channels enable row level security;

create policy nw_key_notify_channels_owner_select on public.nw_key_notify_channels
  for select using (
    exists (
      select 1 from public.nw_profiles p
      where p.id = profile_id and p.user_id = auth.uid() and p.deleted_at is null
    )
  );

create index if not exists idx_nw_key_notify_channels_confirmed
  on public.nw_key_notify_channels (profile_id)
  where confirmed_at is not null;

comment on table public.nw_key_notify_channels is
  'Confirmed notification channels. No confirmation path ships yet, so the no-kit recovery gate that reads this table always fails closed. See the header comment before adding one.';

-- ==================================================== no-kit recovery requests

create table if not exists public.nw_key_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  user_id uuid not null,
  -- PRE-COMMITTED at request time (design M-4). Completion must prove
  -- possession of exactly this key, so an attacker who wins the race cannot
  -- swap in a different key after the lock elapses.
  new_pubkey text not null check (new_pubkey ~ '^[0-9a-f]{64}$'),
  -- The keyless cancel token is delivered to the notification channel and
  -- NEVER stored. Only its sha-256 hex lives here, so a database read does not
  -- hand an attacker the ability to cancel the legitimate owner's recovery.
  cancel_token_hash text not null check (cancel_token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (
    status in ('pending', 'cancelled', 'completed', 'frozen')
  ),
  requested_at timestamptz not null default now(),
  -- Standing-scaled lock: 72h baseline, 7 days for verified journalists.
  unlocks_at timestamptz not null,
  standing text not null check (standing in ('open', 'verified')),
  cancelled_at timestamptz,
  completed_at timestamptz,
  frozen_at timestamptz
);

alter table public.nw_key_recovery_requests enable row level security;

-- The owner may read their own requests so the in-app banner survives an edge
-- outage. cancel_token_hash is a hash, so exposing the row leaks nothing usable.
create policy nw_key_recovery_requests_owner_select on public.nw_key_recovery_requests
  for select using (
    exists (
      select 1 from public.nw_profiles p
      where p.id = profile_id and p.user_id = auth.uid() and p.deleted_at is null
    )
  );

create unique index if not exists idx_nw_key_recovery_one_pending
  on public.nw_key_recovery_requests (profile_id)
  where status = 'pending';

create index if not exists idx_nw_key_recovery_profile
  on public.nw_key_recovery_requests (profile_id, requested_at desc);

comment on table public.nw_key_recovery_requests is
  'No-kit recovery state machine. pending -> completed (step-up re-auth + possession of the pre-committed key), pending -> cancelled (keyless token or active key), pending/cancelled -> frozen (2 cancels in 90 days, fail-closed contested custody).';

-- ==================================================== public custody events

create table if not exists public.nw_key_events (
  id uuid primary key default gen_random_uuid(),
  seq bigserial not null unique,
  profile_id uuid not null references public.nw_profiles (id) on delete cascade,
  kind text not null check (
    kind in (
      'rotation',
      'device_approval',
      'revocation',
      'recovery_requested',
      'recovery_cancelled',
      'recovery_completed',
      'recovery_frozen',
      'backup_restore'
    )
  ),
  key_id uuid references public.nw_profile_keys (id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.nw_key_events enable row level security;

-- Public by design (design H-1): a contested profile must be VISIBLY contested,
-- and only completed recoveries brand subsequent revisions. detail carries
-- public metadata only; never write a token, a nonce, or a hash of one here.
create policy nw_key_events_public_select on public.nw_key_events
  for select using (true);

create index if not exists idx_nw_key_events_profile
  on public.nw_key_events (profile_id, seq desc);

comment on table public.nw_key_events is
  'Public custody event feed rendered on the profile. detail carries public metadata only: never tokens, nonces, or their hashes.';

-- ======================================= head <-> chain synchronization trigger

-- Keeps nw_profiles.pubkey_ed25519 (the denormalized head) and the chain in
-- agreement across the two transitions the frozen legacy paths perform:
--
--   '' -> key    an INITIAL bind through nw_set_profile_pubkey. Writes the
--                'initial' chain row the resolver requires. Guarded on the
--                profile having no chain rows at all, so it can never
--                double-insert behind a rotation RPC.
--   key -> ''    a head CLEAR. Today that is nw_account_deletion_dispose
--                anonymizing a deleted account. Every active chain row is
--                revoked, so an anonymized profile's cleared head can never be
--                resolved as an active key and its keys cannot authorize a new
--                signed write.
--
-- key -> other key is a ROTATION or a RECOVERY. Those come from the RPCs below,
-- which write their own chain rows in the same transaction, so this trigger
-- deliberately does nothing for that transition.
create or replace function public.nw_profiles_sync_key_chain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.pubkey_ed25519, '') = '' and coalesce(new.pubkey_ed25519, '') <> '' then
    if not exists (select 1 from public.nw_profile_keys where profile_id = new.id) then
      insert into public.nw_profile_keys (
        profile_id, pubkey, status, kind, added_via, proof_json, prev_key_id
      )
      values (
        new.id,
        new.pubkey_ed25519,
        'active',
        'primary',
        'initial',
        jsonb_build_object('source', 'nw_set_profile_pubkey'),
        null
      );
    end if;
  elsif coalesce(old.pubkey_ed25519, '') <> '' and coalesce(new.pubkey_ed25519, '') = '' then
    update public.nw_profile_keys
    set status = 'revoked',
        revoked_at = now()
    where profile_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists nw_profiles_key_chain_sync on public.nw_profiles;
create trigger nw_profiles_key_chain_sync
  after update of pubkey_ed25519 on public.nw_profiles
  for each row execute function public.nw_profiles_sync_key_chain();

-- ================================================ verified_key_id stamping

-- Resolve the chain row that a pubkey belongs to. Prefers the ACTIVE row (there
-- is at most one, globally); falls back to the newest revoked row so a write
-- accepted moments before a revocation still records the key that verified it.
create or replace function public.nw_key_row_for_pubkey(p_pubkey text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select k.id
  from public.nw_profile_keys k
  where k.pubkey = p_pubkey
  order by (k.status = 'active') desc, k.seq desc
  limit 1;
$$;

create or replace function public.nw_article_revisions_stamp_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never overwrite an explicit stamp; only fill an unstamped insert.
  if new.verified_key_id is null then
    new.verified_key_id := public.nw_key_row_for_pubkey(new.signer_pubkey);
  end if;
  return new;
end;
$$;

drop trigger if exists nw_article_revisions_stamp_key on public.nw_article_revisions;
create trigger nw_article_revisions_stamp_key
  before insert on public.nw_article_revisions
  for each row execute function public.nw_article_revisions_stamp_key();

-- Suggestions resolve exactly the same way as revisions once signer_pubkey is
-- populated. The editor-profile fallback exists only for a caller that has not
-- yet been updated to send the signer, and is deliberately a best-effort guess:
-- it prefers the primary, which is what a single-device editor always used.
create or replace function public.nw_edit_suggestions_stamp_key()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verified_key_id is null then
    if coalesce(new.signer_pubkey, '') <> '' then
      new.verified_key_id := public.nw_key_row_for_pubkey(new.signer_pubkey);
    else
      select k.id into new.verified_key_id
      from public.nw_profile_keys k
      where k.profile_id = new.editor_id and k.status = 'active'
      order by (k.kind = 'primary') desc, k.seq desc
      limit 1;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists nw_edit_suggestions_stamp_key on public.nw_edit_suggestions;
create trigger nw_edit_suggestions_stamp_key
  before insert on public.nw_edit_suggestions
  for each row execute function public.nw_edit_suggestions_stamp_key();

-- ============================================================ backfill

-- One 'initial' chain row per profile that already holds a non-empty key.
-- Profiles anonymized by an account deletion have pubkey_ed25519 = '' and are
-- therefore skipped: their cleared head must never resolve as an active key.
insert into public.nw_profile_keys (
  profile_id, pubkey, status, kind, added_via, proof_json, valid_from
)
select
  p.id,
  p.pubkey_ed25519,
  'active',
  'primary',
  'initial',
  jsonb_build_object('source', 'backfill-20260730000008'),
  p.created_at
from public.nw_profiles p
where coalesce(p.pubkey_ed25519, '') <> ''
  and p.pubkey_revoked_at is null
  and p.deleted_at is null
  and not exists (select 1 from public.nw_profile_keys k where k.profile_id = p.id)
on conflict do nothing;

-- Point existing revisions at the initial row for their signer key. Revisions
-- whose author was anonymized keep a null stamp: honest 'not chain-recorded'
-- rather than a fabricated verification.
update public.nw_article_revisions r
set verified_key_id = k.id
from public.nw_profile_keys k
where r.verified_key_id is null
  and k.pubkey = r.signer_pubkey
  and k.added_via = 'initial';

-- Legacy suggestions predate signer_pubkey. Every one of them was signed under
-- the profile's single lifetime key, which is exactly the key the backfilled
-- 'initial' chain row holds, so recording it here is a statement of fact rather
-- than a guess. Rows whose editor was anonymized keep '' and a null stamp.
update public.nw_edit_suggestions s
set signer_pubkey = k.pubkey,
    verified_key_id = k.id
from public.nw_profile_keys k
where coalesce(s.signer_pubkey, '') = ''
  and k.profile_id = s.editor_id
  and k.added_via = 'initial';

-- ============================================ suggestion insert (extended)

-- Additive create-or-replace of nw_insert_suggestion (migration 20260703000002).
-- Only change: signer_pubkey is carried from the payload so the stamp trigger
-- can resolve the exact chain row. Every existing return code, check order, and
-- column value is byte-identical; a caller that omits signerPubkey still works
-- and falls back to the editor-profile lookup.
create or replace function public.nw_insert_suggestion(p_suggestion jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.nw_articles where id = (p_suggestion->>'articleId')::uuid
  ) then
    return 'unknown-article';
  end if;

  insert into public.nw_edit_suggestions
    (id, article_id, base_rev, editor_id, type, diff_json, citations, rationale,
     signature, signer_pubkey, status, created_at)
  values (
    (p_suggestion->>'id')::uuid,
    (p_suggestion->>'articleId')::uuid,
    (p_suggestion->>'baseRev')::integer,
    (p_suggestion->>'editorProfileId')::uuid,
    p_suggestion->>'type',
    (p_suggestion->>'diffJson')::jsonb,
    coalesce(p_suggestion->'citations', '[]'::jsonb),
    p_suggestion->>'rationale',
    p_suggestion->>'signature',
    coalesce(p_suggestion->>'signerPubkey', ''),
    'open',
    (p_suggestion->>'createdAt')::timestamptz
  );

  return 'ok';
end;
$$;

revoke execute on function public.nw_insert_suggestion(jsonb) from public, anon, authenticated;
grant execute on function public.nw_insert_suggestion(jsonb) to service_role;

-- ==================================================== active-key resolver

-- The single read every signature-verifying edge function routes through.
-- Returns a typed verdict rather than a bare profile id so a signature by a
-- revoked key can be reported as 'key-revoked' instead of collapsing into
-- 'no-profile':
--
--   {"verdict":"active","profileId":...,"keyId":...,"kind":...}
--   {"verdict":"revoked","profileId":...,"keyId":...,"kind":...}
--   {"verdict":"unknown"}
--
-- Fail-closed joins: a key on a deleted/anonymized profile, or on a profile
-- whose head was revoked, resolves as 'revoked', never 'active'.
create or replace function public.nw_key_resolve_active(p_pubkey text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if coalesce(p_pubkey, '') = '' then
    return jsonb_build_object('verdict', 'unknown');
  end if;

  select
    k.id,
    k.profile_id,
    k.kind,
    k.status,
    p.deleted_at,
    p.pubkey_revoked_at
  into v_row
  from public.nw_profile_keys k
  join public.nw_profiles p on p.id = k.profile_id
  where k.pubkey = p_pubkey
  order by (k.status = 'active') desc, k.seq desc
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('verdict', 'unknown');
  end if;

  if v_row.status = 'active'
     and v_row.deleted_at is null
     and v_row.pubkey_revoked_at is null then
    return jsonb_build_object(
      'verdict', 'active',
      'profileId', v_row.profile_id,
      'keyId', v_row.id,
      'kind', v_row.kind
    );
  end if;

  return jsonb_build_object(
    'verdict', 'revoked',
    'profileId', v_row.profile_id,
    'keyId', v_row.id,
    'kind', v_row.kind
  );
end;
$$;

revoke all on function public.nw_key_resolve_active(text) from public, anon, authenticated;
grant execute on function public.nw_key_resolve_active(text) to service_role;

-- ============================================================ nonce issuance

-- Issuance rate limit. The nonce itself is generated by the edge from the
-- platform CSPRNG and passed in: the edge IS the server, and keeping generation
-- there avoids a pgcrypto dependency for gen_random_bytes.
create or replace function public.nw_key_issue_nonce(
  p_user_id uuid,
  p_nonce text,
  p_purpose text,
  p_ttl_seconds integer default 300,
  p_max_per_window integer default 10,
  p_window_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_head text;
  v_recent integer;
  v_expires timestamptz;
begin
  if p_purpose not in ('rotation', 'device_approval', 'revocation', 'recovery_complete', 'escrow_put') then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;
  if coalesce(p_nonce, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  select id, pubkey_ed25519 into v_profile_id, v_head
  from public.nw_profiles
  where user_id = p_user_id and deleted_at is null;

  if v_profile_id is null then
    return jsonb_build_object('outcome', 'no-profile');
  end if;
  -- Every custody proof binds the OLD head, so a profile with no head has
  -- nothing to bind and nothing to rotate. Initial binding is the other path.
  if coalesce(v_head, '') = '' then
    return jsonb_build_object('outcome', 'no-active-key');
  end if;

  select count(*) into v_recent
  from public.nw_key_nonces
  where user_id = p_user_id
    and created_at >= now() - make_interval(secs => p_window_seconds);
  if v_recent >= p_max_per_window then
    return jsonb_build_object('outcome', 'rate-limited');
  end if;

  -- Opportunistic sweep of expired nonces; keeps the table small without a job.
  delete from public.nw_key_nonces where expires_at < now();

  v_expires := now() + make_interval(secs => p_ttl_seconds);

  insert into public.nw_key_nonces (
    nonce, user_id, profile_id, old_pubkey, purpose, expires_at
  )
  values (p_nonce, p_user_id, v_profile_id, v_head, p_purpose, v_expires);

  -- The timestamptz goes into jsonb directly: to_jsonb renders ISO 8601, which
  -- is what the client parses. A to_char template would have to hand-roll the
  -- offset and 'Z' is not a valid timestamp pattern.
  return jsonb_build_object(
    'outcome', 'ok',
    'nonce', p_nonce,
    'profileId', v_profile_id,
    'oldPubkey', v_head,
    'purpose', p_purpose,
    'expiresAt', v_expires
  );
exception
  when unique_violation then
    -- A replayed nonce value never gets a second life.
    return jsonb_build_object('outcome', 'bad-nonce');
end;
$$;

revoke all on function public.nw_key_issue_nonce(uuid, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.nw_key_issue_nonce(uuid, text, text, integer, integer, integer)
  to service_role;

-- ============================================================ rotation

-- Normal rotation: the OLD key signs the rotation, the NEW key signs a
-- possession proof, and both signatures were verified by the edge before this
-- call. Here the transaction must still prove nothing moved underneath it:
--
--   1. CONSUME the nonce (delete ... returning). Zero rows means it was already
--      spent, expired, or bound to a different uid/profile/head/purpose.
--   2. Re-assert the head INSIDE the transaction with a guarded update matching
--      pubkey_ed25519 = the nonce's old_pubkey. Zero rows means a concurrent
--      rotation won, and this one fails with 'head-conflict' rather than
--      silently forking the chain.
--
-- The guarded update is the same row-lock pattern nw_set_profile_pubkey uses.
create or replace function public.nw_key_rotate(
  p_user_id uuid,
  p_nonce text,
  p_new_pubkey text,
  p_added_via text default 'rotation',
  p_proof jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce record;
  v_old_key_id uuid;
  v_new_key_id uuid;
  v_updated integer;
  v_restore boolean := false;
begin
  if coalesce(p_new_pubkey, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;
  if p_added_via not in ('rotation', 'recovery', 'backup_restore') then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  delete from public.nw_key_nonces
  where nonce = p_nonce
    and user_id = p_user_id
    and purpose = 'rotation'
    and expires_at >= now()
  returning * into v_nonce;

  if v_nonce.nonce is null then
    return jsonb_build_object('outcome', 'bad-nonce');
  end if;
  if v_nonce.old_pubkey = p_new_pubkey then
    return jsonb_build_object('outcome', 'same-key');
  end if;

  -- Head re-assertion. The WHERE clause is the concurrency guard.
  update public.nw_profiles
  set pubkey_ed25519 = p_new_pubkey
  where id = v_nonce.profile_id
    and pubkey_ed25519 = v_nonce.old_pubkey
    and deleted_at is null
    and pubkey_revoked_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('outcome', 'head-conflict');
  end if;

  select id into v_old_key_id
  from public.nw_profile_keys
  where profile_id = v_nonce.profile_id
    and pubkey = v_nonce.old_pubkey
    and status = 'active';

  update public.nw_profile_keys
  set status = 'revoked', revoked_at = now()
  where profile_id = v_nonce.profile_id
    and kind = 'primary'
    and status = 'active';

  insert into public.nw_profile_keys (
    profile_id, pubkey, status, kind, added_via, proof_json, prev_key_id
  )
  values (
    v_nonce.profile_id, p_new_pubkey, 'active', 'primary', p_added_via,
    coalesce(p_proof, '{}'::jsonb), v_old_key_id
  )
  returning id into v_new_key_id;

  -- Backup-restore transparency (design H-3): a bind within 24h of an escrow
  -- read is published as 'key restored from encrypted backup', so a silent side
  -- door through escrow is impossible to hide from the owner or the public.
  select exists (
    select 1 from public.nw_key_escrow_access a
    where a.profile_id = v_nonce.profile_id
      and a.action = 'get'
      and a.created_at >= now() - interval '24 hours'
  ) into v_restore;

  insert into public.nw_key_events (profile_id, kind, key_id, detail)
  values (
    v_nonce.profile_id,
    case when v_restore then 'backup_restore' else 'rotation' end,
    v_new_key_id,
    jsonb_build_object(
      'addedVia', p_added_via,
      'previousPubkey', v_nonce.old_pubkey,
      'newPubkey', p_new_pubkey,
      'followedEscrowRead', v_restore
    )
  );

  return jsonb_build_object(
    'outcome', 'ok',
    'profileId', v_nonce.profile_id,
    'keyId', v_new_key_id,
    'previousKeyId', v_old_key_id,
    'backupRestore', v_restore
  );
exception
  when unique_violation then
    -- The global active-pubkey index is the last line of defense: the new key
    -- is already active on some profile.
    return jsonb_build_object('outcome', 'pubkey-conflict');
end;
$$;

revoke all on function public.nw_key_rotate(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_key_rotate(uuid, text, text, text, jsonb) to service_role;

-- ============================================================ device approval

-- Same proof shape as rotation, but the old key APPROVES a co-active device
-- key instead of replacing itself: the head column and the primary row are
-- untouched, and a new kind='device' active row joins the chain.
create or replace function public.nw_key_approve_device(
  p_user_id uuid,
  p_nonce text,
  p_device_pubkey text,
  p_proof jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce record;
  v_parent_key_id uuid;
  v_new_key_id uuid;
  v_head text;
begin
  if coalesce(p_device_pubkey, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  delete from public.nw_key_nonces
  where nonce = p_nonce
    and user_id = p_user_id
    and purpose = 'device_approval'
    and expires_at >= now()
  returning * into v_nonce;

  if v_nonce.nonce is null then
    return jsonb_build_object('outcome', 'bad-nonce');
  end if;

  -- Head re-assertion without mutating it: SELECT ... FOR UPDATE takes the same
  -- row lock the rotation path's guarded UPDATE takes, so a concurrent rotation
  -- cannot slip a device approval in against a stale head.
  select pubkey_ed25519 into v_head
  from public.nw_profiles
  where id = v_nonce.profile_id and deleted_at is null and pubkey_revoked_at is null
  for update;

  if v_head is null or v_head <> v_nonce.old_pubkey then
    return jsonb_build_object('outcome', 'head-conflict');
  end if;

  -- Only the PRIMARY may approve a device (revocation precedence, design H-1).
  select id into v_parent_key_id
  from public.nw_profile_keys
  where profile_id = v_nonce.profile_id
    and pubkey = v_nonce.old_pubkey
    and status = 'active'
    and kind = 'primary';
  if v_parent_key_id is null then
    return jsonb_build_object('outcome', 'not-primary');
  end if;

  insert into public.nw_profile_keys (
    profile_id, pubkey, status, kind, added_via, proof_json, prev_key_id
  )
  values (
    v_nonce.profile_id, p_device_pubkey, 'active', 'device', 'device_approval',
    coalesce(p_proof, '{}'::jsonb), v_parent_key_id
  )
  returning id into v_new_key_id;

  insert into public.nw_key_events (profile_id, kind, key_id, detail)
  values (
    v_nonce.profile_id,
    'device_approval',
    v_new_key_id,
    jsonb_build_object('devicePubkey', p_device_pubkey, 'approvedBy', v_nonce.old_pubkey)
  );

  return jsonb_build_object(
    'outcome', 'ok',
    'profileId', v_nonce.profile_id,
    'keyId', v_new_key_id
  );
exception
  when unique_violation then
    return jsonb_build_object('outcome', 'pubkey-conflict');
end;
$$;

revoke all on function public.nw_key_approve_device(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_key_approve_device(uuid, text, text, jsonb) to service_role;

-- ============================================================ revocation

-- Per-key revocation with the design's precedence rules (H-1):
--   * primary revokes any device key,
--   * a device key can NEVER revoke the primary,
--   * device-vs-device is won by the OLDER active key (lower seq),
--   * the active PRIMARY is never revocable here. Replacing a compromised
--     primary is a rotation (revoke-and-replace in one transaction); a bare
--     revoke would leave the profile with no head and no way back.
create or replace function public.nw_key_revoke(
  p_user_id uuid,
  p_nonce text,
  p_target_key_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce record;
  v_actor record;
  v_target record;
begin
  delete from public.nw_key_nonces
  where nonce = p_nonce
    and user_id = p_user_id
    and purpose = 'revocation'
    and expires_at >= now()
  returning * into v_nonce;

  if v_nonce.nonce is null then
    return jsonb_build_object('outcome', 'bad-nonce');
  end if;

  select id, kind, seq, status into v_actor
  from public.nw_profile_keys
  where profile_id = v_nonce.profile_id
    and pubkey = v_nonce.old_pubkey
    and status = 'active';
  if v_actor.id is null then
    return jsonb_build_object('outcome', 'no-active-key');
  end if;

  select id, kind, seq, status, profile_id, pubkey into v_target
  from public.nw_profile_keys
  where id = p_target_key_id
  for update;
  if v_target.id is null then
    return jsonb_build_object('outcome', 'unknown-key');
  end if;
  if v_target.profile_id <> v_nonce.profile_id then
    return jsonb_build_object('outcome', 'not-your-key');
  end if;
  if v_target.status <> 'active' then
    return jsonb_build_object('outcome', 'already-revoked');
  end if;
  if v_target.kind = 'primary' then
    return jsonb_build_object('outcome', 'use-rotation-for-primary');
  end if;
  -- device revoking device: only the older key wins. Equal seq is impossible
  -- (seq is unique), and the actor revoking itself is allowed (sign-out-a-lost-
  -- device is the common case) because seq is compared only across DISTINCT keys.
  if v_actor.kind = 'device' and v_actor.id <> v_target.id and v_actor.seq > v_target.seq then
    return jsonb_build_object('outcome', 'revoke-precedence');
  end if;

  update public.nw_profile_keys
  set status = 'revoked', revoked_at = now()
  where id = v_target.id and status = 'active';

  insert into public.nw_key_events (profile_id, kind, key_id, detail)
  values (
    v_nonce.profile_id,
    'revocation',
    v_target.id,
    jsonb_build_object(
      'revokedPubkey', v_target.pubkey,
      'revokedKind', v_target.kind,
      'revokedBy', v_nonce.old_pubkey
    )
  );

  return jsonb_build_object('outcome', 'ok', 'keyId', v_target.id);
end;
$$;

revoke all on function public.nw_key_revoke(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.nw_key_revoke(uuid, text, uuid) to service_role;

-- ============================================================ escrow put/get

-- Append-versioned put. Never a blind overwrite; the newest 3 versions are kept
-- so a user who still remembers an older recovery code is not stranded.
-- Step-up re-auth and the possession nonce are enforced by the edge before this
-- call; the nonce is consumed here so the proof cannot be replayed.
create or replace function public.nw_key_escrow_put(
  p_user_id uuid,
  p_nonce text,
  p_envelope jsonb,
  p_pubkey text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce record;
  v_version integer;
begin
  if coalesce(p_pubkey, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;
  if p_envelope is null or jsonb_typeof(p_envelope) <> 'object' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  delete from public.nw_key_nonces
  where nonce = p_nonce
    and user_id = p_user_id
    and purpose = 'escrow_put'
    and expires_at >= now()
  returning * into v_nonce;

  if v_nonce.nonce is null then
    return jsonb_build_object('outcome', 'bad-nonce');
  end if;

  select coalesce(max(version), 0) + 1 into v_version
  from public.nw_key_escrow
  where profile_id = v_nonce.profile_id;

  insert into public.nw_key_escrow (profile_id, version, envelope_json, pubkey)
  values (v_nonce.profile_id, v_version, p_envelope, p_pubkey);

  -- Keep the newest 3 versions.
  delete from public.nw_key_escrow e
  where e.profile_id = v_nonce.profile_id
    and e.version <= v_version - 3;

  -- Owner-visible record of the put. This is also the honest stand-in for the
  -- design's "and notifies": with no notification provider shipped, an access
  -- event the owner can read is a real signal, and claiming a notification was
  -- sent would not be.
  insert into public.nw_key_escrow_access (profile_id, user_id, action, version, detail)
  values (v_nonce.profile_id, p_user_id, 'put', v_version, 'recovery kit escrowed');

  return jsonb_build_object('outcome', 'ok', 'version', v_version);
end;
$$;

revoke all on function public.nw_key_escrow_put(uuid, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.nw_key_escrow_put(uuid, text, jsonb, text) to service_role;

-- Rate-limited get (3 per rolling 24h) with an owner-visible access event on
-- BOTH the allowed and the denied path, so an attacker probing the escrow
-- cannot do so invisibly.
create or replace function public.nw_key_escrow_get(
  p_user_id uuid,
  p_max_per_day integer default 3
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_recent integer;
  v_row record;
begin
  select id into v_profile_id
  from public.nw_profiles
  where user_id = p_user_id and deleted_at is null;
  if v_profile_id is null then
    return jsonb_build_object('outcome', 'no-profile');
  end if;

  select count(*) into v_recent
  from public.nw_key_escrow_access
  where profile_id = v_profile_id
    and action = 'get'
    and created_at >= now() - interval '24 hours';

  if v_recent >= p_max_per_day then
    insert into public.nw_key_escrow_access (profile_id, user_id, action, detail)
    values (v_profile_id, p_user_id, 'get-denied', 'daily escrow read limit reached');
    return jsonb_build_object('outcome', 'rate-limited');
  end if;

  select version, envelope_json, pubkey, created_at into v_row
  from public.nw_key_escrow
  where profile_id = v_profile_id
  order by version desc
  limit 1;

  if v_row.version is null then
    insert into public.nw_key_escrow_access (profile_id, user_id, action, detail)
    values (v_profile_id, p_user_id, 'get-denied', 'no escrowed kit');
    return jsonb_build_object('outcome', 'no-kit');
  end if;

  insert into public.nw_key_escrow_access (profile_id, user_id, action, version, detail)
  values (v_profile_id, p_user_id, 'get', v_row.version, 'recovery kit read');

  return jsonb_build_object(
    'outcome', 'ok',
    'version', v_row.version,
    'envelope', v_row.envelope_json,
    'pubkey', v_row.pubkey
  );
end;
$$;

revoke all on function public.nw_key_escrow_get(uuid, integer) from public, anon, authenticated;
grant execute on function public.nw_key_escrow_get(uuid, integer) to service_role;

-- ==================================================== no-kit recovery flows

-- Request. Three hard gates, in this order:
--   1. CONFIRMED NOTIFICATION CHANNEL. Without it the notice carrying the
--      keyless cancel token cannot be delivered, so the whole visible-contest
--      property collapses and the path is disabled. No confirmation path ships
--      today (see nw_key_notify_channels), so this gate always refuses.
--   2. FREEZE. Two cancelled/frozen requests inside 90 days means custody is
--      contested; the no-kit path shuts permanently for that window and only
--      the kit path can restore signing.
--   3. Standing-scaled lock: 72h baseline, 7 days for a verified journalist.
create or replace function public.nw_key_recovery_request(
  p_user_id uuid,
  p_new_pubkey text,
  p_cancel_token_hash text,
  p_baseline_hours integer default 72,
  p_verified_hours integer default 168,
  p_freeze_window_days integer default 90,
  p_freeze_cancel_count integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_head text;
  v_standing text;
  v_cancels integer;
  v_hours integer;
  v_id uuid;
  v_unlocks timestamptz;
begin
  if coalesce(p_new_pubkey, '') !~ '^[0-9a-f]{64}$'
     or coalesce(p_cancel_token_hash, '') !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  select id, pubkey_ed25519 into v_profile_id, v_head
  from public.nw_profiles
  where user_id = p_user_id and deleted_at is null;
  if v_profile_id is null then
    return jsonb_build_object('outcome', 'no-profile');
  end if;
  if coalesce(v_head, '') = '' then
    return jsonb_build_object('outcome', 'no-active-key');
  end if;
  -- The new key cannot already be live anywhere: pre-committing a key that is
  -- active elsewhere would guarantee a pubkey-conflict at completion time,
  -- after the whole lock had elapsed.
  if exists (select 1 from public.nw_profile_keys where pubkey = p_new_pubkey and status = 'active') then
    return jsonb_build_object('outcome', 'pubkey-conflict');
  end if;

  -- Gate 1: notification channel.
  if not exists (
    select 1 from public.nw_key_notify_channels
    where profile_id = v_profile_id and confirmed_at is not null
  ) then
    return jsonb_build_object('outcome', 'notification-channel-required');
  end if;

  -- Gate 2: contested-custody freeze.
  select count(*) into v_cancels
  from public.nw_key_recovery_requests
  where profile_id = v_profile_id
    and status in ('cancelled', 'frozen')
    and requested_at >= now() - make_interval(days => p_freeze_window_days);
  if v_cancels >= p_freeze_cancel_count then
    return jsonb_build_object('outcome', 'recovery-frozen');
  end if;

  if exists (
    select 1 from public.nw_key_recovery_requests
    where profile_id = v_profile_id and status = 'pending'
  ) then
    return jsonb_build_object('outcome', 'already-pending');
  end if;

  select coalesce(tier, 'open') into v_standing
  from public.nw_journalists where profile_id = v_profile_id;
  v_standing := coalesce(v_standing, 'open');
  v_hours := case when v_standing = 'verified' then p_verified_hours else p_baseline_hours end;
  v_unlocks := now() + make_interval(hours => v_hours);

  insert into public.nw_key_recovery_requests (
    profile_id, user_id, new_pubkey, cancel_token_hash, unlocks_at, standing
  )
  values (v_profile_id, p_user_id, p_new_pubkey, p_cancel_token_hash, v_unlocks, v_standing)
  returning id into v_id;

  insert into public.nw_key_events (profile_id, kind, detail)
  values (
    v_profile_id,
    'recovery_requested',
    jsonb_build_object('newPubkey', p_new_pubkey, 'standing', v_standing, 'unlocksAt', v_unlocks)
  );

  return jsonb_build_object(
    'outcome', 'ok',
    'requestId', v_id,
    'unlocksAt', v_unlocks,
    'standing', v_standing
  );
exception
  when unique_violation then
    return jsonb_build_object('outcome', 'already-pending');
end;
$$;

revoke all on function public.nw_key_recovery_request(uuid, text, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.nw_key_recovery_request(uuid, text, text, integer, integer, integer, integer)
  to service_role;

-- Cancel. Two authorized callers, both keyless-token-or-key, never a bare
-- session: the token from the notice (which the attacker with a stolen session
-- never receives) or a signature from an active key (proved at the edge and
-- bound through the nonce). The SECOND cancel inside the window lands as
-- 'frozen' rather than 'cancelled', which is what shuts the no-kit path and
-- moves the profile to the fail-closed contested state.
create or replace function public.nw_key_recovery_cancel(
  p_request_id uuid,
  p_cancel_token_hash text default null,
  p_user_id uuid default null,
  p_nonce text default null,
  p_freeze_window_days integer default 90,
  p_freeze_cancel_count integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req record;
  v_nonce record;
  v_prior integer;
  v_status text;
  v_actor text;
begin
  select * into v_req
  from public.nw_key_recovery_requests
  where id = p_request_id
  for update;
  if v_req.id is null then
    return jsonb_build_object('outcome', 'unknown-request');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('outcome', 'not-pending');
  end if;

  if p_cancel_token_hash is not null then
    -- Keyless path. Compared against the stored HASH; the token itself is never
    -- persisted, so a database read cannot produce a valid cancel.
    if p_cancel_token_hash <> v_req.cancel_token_hash then
      return jsonb_build_object('outcome', 'bad-cancel-token');
    end if;
    v_actor := 'cancel-token';
  elsif p_user_id is not null and p_nonce is not null then
    delete from public.nw_key_nonces
    where nonce = p_nonce
      and user_id = p_user_id
      and profile_id = v_req.profile_id
      and purpose = 'revocation'
      and expires_at >= now()
    returning * into v_nonce;
    if v_nonce.nonce is null then
      return jsonb_build_object('outcome', 'bad-nonce');
    end if;
    if not exists (
      select 1 from public.nw_profile_keys
      where profile_id = v_req.profile_id and pubkey = v_nonce.old_pubkey and status = 'active'
    ) then
      return jsonb_build_object('outcome', 'no-active-key');
    end if;
    v_actor := 'active-key';
  else
    return jsonb_build_object('outcome', 'bad-payload');
  end if;

  select count(*) into v_prior
  from public.nw_key_recovery_requests
  where profile_id = v_req.profile_id
    and status in ('cancelled', 'frozen')
    and requested_at >= now() - make_interval(days => p_freeze_window_days);

  v_status := case when v_prior + 1 >= p_freeze_cancel_count then 'frozen' else 'cancelled' end;

  update public.nw_key_recovery_requests
  set status = v_status,
      cancelled_at = now(),
      frozen_at = case when v_status = 'frozen' then now() else null end
  where id = v_req.id;

  insert into public.nw_key_events (profile_id, kind, detail)
  values (
    v_req.profile_id,
    'recovery_cancelled',
    jsonb_build_object('requestId', v_req.id, 'cancelledBy', v_actor)
  );

  if v_status = 'frozen' then
    insert into public.nw_key_events (profile_id, kind, detail)
    values (
      v_req.profile_id,
      'recovery_frozen',
      jsonb_build_object(
        'requestId', v_req.id,
        'windowDays', p_freeze_window_days,
        'reason', 'contested custody: recovery without a kit is frozen; the kit path still works'
      )
    );
  end if;

  return jsonb_build_object('outcome', 'ok', 'status', v_status);
end;
$$;

revoke all on function public.nw_key_recovery_cancel(uuid, text, uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.nw_key_recovery_cancel(uuid, text, uuid, text, integer, integer)
  to service_role;

-- Complete. Only after the lock elapses, only for the PRE-COMMITTED pubkey, and
-- only behind the edge's step-up re-auth (fresh access token at COMPLETION
-- time, not merely at request time: a captured idle session must not be able to
-- ripen into a key). Revokes every prior key and binds the new one.
create or replace function public.nw_key_recovery_complete(
  p_user_id uuid,
  p_nonce text,
  p_request_id uuid,
  p_new_pubkey text,
  p_proof jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nonce record;
  v_req record;
  v_old_key_id uuid;
  v_new_key_id uuid;
  v_updated integer;
begin
  delete from public.nw_key_nonces
  where nonce = p_nonce
    and user_id = p_user_id
    and purpose = 'recovery_complete'
    and expires_at >= now()
  returning * into v_nonce;
  if v_nonce.nonce is null then
    return jsonb_build_object('outcome', 'bad-nonce');
  end if;

  select * into v_req
  from public.nw_key_recovery_requests
  where id = p_request_id and profile_id = v_nonce.profile_id
  for update;
  if v_req.id is null then
    return jsonb_build_object('outcome', 'unknown-request');
  end if;
  if v_req.status <> 'pending' then
    return jsonb_build_object('outcome', 'not-pending');
  end if;
  if v_req.unlocks_at > now() then
    return jsonb_build_object('outcome', 'still-locked', 'unlocksAt', v_req.unlocks_at);
  end if;
  -- Pre-committed pubkey enforcement (design M-4).
  if v_req.new_pubkey <> p_new_pubkey then
    return jsonb_build_object('outcome', 'pubkey-not-precommitted');
  end if;

  update public.nw_profiles
  set pubkey_ed25519 = p_new_pubkey
  where id = v_nonce.profile_id
    and pubkey_ed25519 = v_nonce.old_pubkey
    and deleted_at is null
    and pubkey_revoked_at is null;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('outcome', 'head-conflict');
  end if;

  select id into v_old_key_id
  from public.nw_profile_keys
  where profile_id = v_nonce.profile_id and pubkey = v_nonce.old_pubkey and status = 'active';

  -- ALL prior keys, primary and device: recovery is the "I lost everything"
  -- path, so no previously approved device keeps authoring authority.
  update public.nw_profile_keys
  set status = 'revoked', revoked_at = now()
  where profile_id = v_nonce.profile_id and status = 'active';

  insert into public.nw_profile_keys (
    profile_id, pubkey, status, kind, added_via, proof_json, prev_key_id
  )
  values (
    v_nonce.profile_id, p_new_pubkey, 'active', 'primary', 'recovery',
    coalesce(p_proof, '{}'::jsonb), v_old_key_id
  )
  returning id into v_new_key_id;

  update public.nw_key_recovery_requests
  set status = 'completed', completed_at = now()
  where id = v_req.id;

  -- PERMANENT public event: only completed recoveries brand subsequent
  -- revisions ("signing key replaced via account recovery on DATE").
  insert into public.nw_key_events (profile_id, kind, key_id, detail)
  values (
    v_nonce.profile_id,
    'recovery_completed',
    v_new_key_id,
    jsonb_build_object(
      'requestId', v_req.id,
      'newPubkey', p_new_pubkey,
      'previousPubkey', v_nonce.old_pubkey,
      'standing', v_req.standing
    )
  );

  return jsonb_build_object('outcome', 'ok', 'keyId', v_new_key_id);
exception
  when unique_violation then
    return jsonb_build_object('outcome', 'pubkey-conflict');
end;
$$;

revoke all on function public.nw_key_recovery_complete(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.nw_key_recovery_complete(uuid, text, uuid, text, jsonb) to service_role;

-- ============================================================ status read

-- Everything the Me screen's Keys and Recovery section needs in one read:
-- the chain, escrow presence, the escrow access log, the notification-channel
-- gate state, and the live recovery request. Read-only.
create or replace function public.nw_key_custody_status(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_head text;
begin
  select id, pubkey_ed25519 into v_profile_id, v_head
  from public.nw_profiles
  where user_id = p_user_id and deleted_at is null;
  if v_profile_id is null then
    return jsonb_build_object('outcome', 'no-profile');
  end if;

  return jsonb_build_object(
    'outcome', 'ok',
    'profileId', v_profile_id,
    'headPubkey', coalesce(v_head, ''),
    'keys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id,
        'seq', k.seq,
        'pubkey', k.pubkey,
        'status', k.status,
        'kind', k.kind,
        'addedVia', k.added_via,
        'validFrom', k.valid_from,
        'revokedAt', k.revoked_at
      ) order by k.seq desc)
      from public.nw_profile_keys k where k.profile_id = v_profile_id
    ), '[]'::jsonb),
    'escrow', coalesce((
      select jsonb_agg(jsonb_build_object(
        'version', e.version, 'pubkey', e.pubkey, 'createdAt', e.created_at
      ) order by e.version desc)
      from public.nw_key_escrow e where e.profile_id = v_profile_id
    ), '[]'::jsonb),
    'escrowAccess', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', a.action, 'version', a.version, 'detail', a.detail, 'createdAt', a.created_at
      ) order by a.seq desc)
      from (
        select * from public.nw_key_escrow_access
        where profile_id = v_profile_id order by seq desc limit 20
      ) a
    ), '[]'::jsonb),
    -- Honest capability report, not a promise: false means no-kit recovery is
    -- unavailable on this deployment.
    'notificationChannelConfirmed', exists (
      select 1 from public.nw_key_notify_channels
      where profile_id = v_profile_id and confirmed_at is not null
    ),
    'recovery', (
      select jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'newPubkey', r.new_pubkey,
        'requestedAt', r.requested_at,
        'unlocksAt', r.unlocks_at,
        'standing', r.standing
      )
      from public.nw_key_recovery_requests r
      where r.profile_id = v_profile_id
      order by r.requested_at desc
      limit 1
    ),
    'recoveryFrozen', exists (
      select 1 from public.nw_key_recovery_requests r
      where r.profile_id = v_profile_id
        and r.status = 'frozen'
        and r.requested_at >= now() - interval '90 days'
    )
  );
end;
$$;

revoke all on function public.nw_key_custody_status(uuid) from public, anon, authenticated;
grant execute on function public.nw_key_custody_status(uuid) to service_role;
