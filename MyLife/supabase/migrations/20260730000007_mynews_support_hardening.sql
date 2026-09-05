-- MyNews Plan 48 Wave 3: journalist-support hardening (WP7 G1/G2/G3).
--
-- 1. Durable support velocity limits. Two token buckets per checkout attempt:
--    the SUPPORTER (10 per hour) and the JOURNALIST RECIPIENT (60 per hour).
--    Counters live in the database, so they survive edge cold starts and are
--    shared across every function instance. Same token-bucket shape as
--    nw_consume_dmca_rate_limit (20260730000002) including opportunistic GC.
-- 2. Real checkout idempotency. nw_support_checkout_attempts records one row
--    per CONFIRMED checkout attempt, keyed by the client's stable idempotency
--    key. nw_begin_support_checkout is the single atomic entry point: it
--    replays the original checkout URL for a repeated key, rejects a key reused
--    with a different target or amount, consumes both velocity buckets only for
--    a genuinely new attempt, and never inserts an attempt row that the buckets
--    would have refused.
-- 3. Payout attribution that works against real Stripe Connect. Automatic
--    payouts on Express accounts carry EMPTY metadata, so the old
--    metadata-only payout branch rejected every real payout as
--    'invalid-payout-metadata' and paidOutCents could never leave 0. The webhook
--    now reads the event envelope's top-level `account` field and resolves the
--    journalist from nw_payout_accounts.provider_account_ref; the RPC accepts
--    that server-resolved attribution, cross-checks it against the stored
--    account ref, and records an unresolvable payout as a typed
--    'unattributed-payout' failure for operator review instead of dropping it.
-- 4. nw_support_reconciliation_runs: the durable output of the
--    mynews-support-worker reconciliation pass (ok/mismatch counts + bounded
--    findings), surfaced read-only in the moderator console.

-- ======================================================== velocity buckets

create table if not exists public.nw_support_rate_counters (
  scope text not null check (scope in ('supporter', 'recipient')),
  subject_id uuid not null,
  tokens double precision not null,
  last_refill_at timestamptz not null default now(),
  request_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, subject_id)
);

create index if not exists idx_nw_support_rate_updated
  on public.nw_support_rate_counters (updated_at);

alter table public.nw_support_rate_counters enable row level security;
revoke all on table public.nw_support_rate_counters from public, anon, authenticated;
grant select, insert, update, delete on public.nw_support_rate_counters to service_role;

-- Token bucket per (scope, subject). 'supporter': capacity 10, one token per
-- 360s => 10/hour sustained. 'recipient': capacity 60, one token per 60s =>
-- 60/hour sustained. Returns 'allowed', 'rate-limited', or 'bad-scope'; the
-- caller fails CLOSED (503) when the call itself errors.
create or replace function public.nw_consume_support_rate_limit(
  p_scope text,
  p_subject_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_tokens double precision;
  v_last_refill timestamptz;
  v_capacity double precision;
  v_refill_seconds double precision;
begin
  if p_subject_id is null then
    return 'bad-scope';
  end if;
  if p_scope = 'supporter' then
    v_capacity := 10;
    v_refill_seconds := 360;
  elsif p_scope = 'recipient' then
    v_capacity := 60;
    v_refill_seconds := 60;
  else
    return 'bad-scope';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('nw-support-rate:' || p_scope || ':' || p_subject_id::text, 0)
  );

  -- Opportunistic GC: a counter idle this long would be full again, so it
  -- carries no rate signal worth keeping. Bounded so checkout stays fast.
  delete from public.nw_support_rate_counters
  where ctid in (
    select ctid from public.nw_support_rate_counters
    where updated_at < v_now - interval '30 days'
    limit 50
  );

  select tokens, last_refill_at
    into v_tokens, v_last_refill
  from public.nw_support_rate_counters
  where scope = p_scope and subject_id = p_subject_id
  for update;

  if v_tokens is null then
    insert into public.nw_support_rate_counters
      (scope, subject_id, tokens, last_refill_at, request_count, updated_at)
    values
      (p_scope, p_subject_id, v_capacity - 1, v_now, 1, v_now);
    return 'allowed';
  end if;

  v_tokens := least(
    v_capacity,
    v_tokens + greatest(0, extract(epoch from (v_now - v_last_refill))) / v_refill_seconds
  );

  if v_tokens < 1 then
    update public.nw_support_rate_counters
      set tokens = v_tokens, last_refill_at = v_now, updated_at = v_now
      where scope = p_scope and subject_id = p_subject_id;
    return 'rate-limited';
  end if;

  update public.nw_support_rate_counters
    set tokens = v_tokens - 1,
        last_refill_at = v_now,
        request_count = request_count + 1,
        updated_at = v_now
    where scope = p_scope and subject_id = p_subject_id;
  return 'allowed';
end;
$$;

revoke all on function public.nw_consume_support_rate_limit(text, uuid)
  from public, anon, authenticated;
grant execute on function public.nw_consume_support_rate_limit(text, uuid) to service_role;

-- ==================================================== checkout idempotency

create table if not exists public.nw_support_checkout_attempts (
  idempotency_key text primary key
    check (idempotency_key ~ '^[A-Za-z0-9:_-]{16,128}$'),
  supporter_profile_id uuid not null
    references public.nw_profiles (id) on delete restrict,
  journalist_profile_id uuid not null
    references public.nw_journalists (profile_id) on delete restrict,
  amount_cents bigint not null check (amount_cents >= 100 and amount_cents <= 100000),
  checkout_url text check (checkout_url is null or checkout_url ~ '^https://'),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists nw_support_checkout_attempts_supporter_idx
  on public.nw_support_checkout_attempts (supporter_profile_id, created_at desc);

alter table public.nw_support_checkout_attempts enable row level security;
revoke all on table public.nw_support_checkout_attempts from public, anon, authenticated;
grant select, insert, update on public.nw_support_checkout_attempts to service_role;

/*
 * Atomic entry point for one confirmed checkout attempt.
 *
 * status:
 *   'replayed'            an attempt with this key already exists for the same
 *                         (supporter, journalist, amount). checkout_url is the
 *                         ORIGINAL provider URL when it was recorded, or null
 *                         when the first attempt never got that far (the caller
 *                         may retry the provider with the same key).
 *   'conflict'            the key exists for a different target or amount.
 *   'rate-limited'        one of the two velocity buckets refused a NEW attempt;
 *                         rate_scope names which one. No attempt row is written.
 *   'new'                 the attempt was recorded; the caller may call the
 *                         provider.
 *
 * Velocity is charged only for a genuinely new attempt, which is what makes a
 * STABLE client idempotency key meaningful: a retry of the same confirmed
 * attempt is not new velocity.
 */
create or replace function public.nw_begin_support_checkout(
  p_idempotency_key text,
  p_supporter_profile_id uuid,
  p_journalist_profile_id uuid,
  p_amount_cents bigint
)
returns table (status text, checkout_url text, rate_scope text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_existing public.nw_support_checkout_attempts%rowtype;
  v_outcome text;
begin
  status := 'bad-request';
  checkout_url := null;
  rate_scope := null;

  if v_key !~ '^[A-Za-z0-9:_-]{16,128}$'
     or p_supporter_profile_id is null
     or p_journalist_profile_id is null
     or p_supporter_profile_id = p_journalist_profile_id
     or p_amount_cents is null
     or p_amount_cents < 100
     or p_amount_cents > 100000
  then
    return next;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nw-support-checkout:' || v_key, 0));

  select * into v_existing
  from public.nw_support_checkout_attempts
  where idempotency_key = v_key
  for update;

  if v_existing.idempotency_key is not null then
    if v_existing.supporter_profile_id = p_supporter_profile_id
       and v_existing.journalist_profile_id = p_journalist_profile_id
       and v_existing.amount_cents = p_amount_cents
    then
      status := 'replayed';
      checkout_url := v_existing.checkout_url;
    else
      status := 'conflict';
    end if;
    return next;
    return;
  end if;

  v_outcome := public.nw_consume_support_rate_limit('supporter', p_supporter_profile_id);
  if v_outcome <> 'allowed' then
    status := case when v_outcome = 'rate-limited' then 'rate-limited' else 'bad-request' end;
    rate_scope := 'supporter';
    return next;
    return;
  end if;

  v_outcome := public.nw_consume_support_rate_limit('recipient', p_journalist_profile_id);
  if v_outcome <> 'allowed' then
    status := case when v_outcome = 'rate-limited' then 'rate-limited' else 'bad-request' end;
    rate_scope := 'recipient';
    return next;
    return;
  end if;

  insert into public.nw_support_checkout_attempts
    (idempotency_key, supporter_profile_id, journalist_profile_id, amount_cents)
  values
    (v_key, p_supporter_profile_id, p_journalist_profile_id, p_amount_cents);

  status := 'new';
  return next;
end;
$$;

revoke all on function public.nw_begin_support_checkout(text, uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.nw_begin_support_checkout(text, uuid, uuid, bigint)
  to service_role;

-- Records the provider URL for an attempt so a later retry of the SAME key
-- returns the original checkout instead of opening a second session. The first
-- recorded URL wins; a second call is an idempotent no-op.
create or replace function public.nw_record_support_checkout_url(
  p_idempotency_key text,
  p_checkout_url text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := trim(coalesce(p_idempotency_key, ''));
  v_url text := trim(coalesce(p_checkout_url, ''));
  v_found boolean;
begin
  if v_key !~ '^[A-Za-z0-9:_-]{16,128}$' or v_url !~ '^https://' then
    return 'bad-request';
  end if;

  update public.nw_support_checkout_attempts
    set checkout_url = v_url, completed_at = now()
    where idempotency_key = v_key and checkout_url is null
    returning true into v_found;

  if coalesce(v_found, false) then
    return 'recorded';
  end if;

  if exists (
    select 1 from public.nw_support_checkout_attempts where idempotency_key = v_key
  ) then
    return 'already-recorded';
  end if;
  return 'not-found';
end;
$$;

revoke all on function public.nw_record_support_checkout_url(text, text)
  from public, anon, authenticated;
grant execute on function public.nw_record_support_checkout_url(text, text) to service_role;

-- =============================================== reconciliation run ledger

create table if not exists public.nw_support_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  worker_ref text not null check (worker_ref <> ''),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  ledger_rows integer not null check (ledger_rows >= 0),
  pair_count integer not null check (pair_count >= 0),
  ok boolean not null,
  mismatch_count integer not null check (mismatch_count >= 0),
  -- Bounded so one bad pass cannot write an unbounded blob. The worker
  -- truncates and records the true total in mismatch_count.
  findings jsonb not null default '[]'::jsonb
    check (jsonb_typeof(findings) = 'array' and jsonb_array_length(findings) <= 100),
  created_at timestamptz not null default now()
);

create index if not exists nw_support_reconciliation_runs_recent_idx
  on public.nw_support_reconciliation_runs (finished_at desc);

alter table public.nw_support_reconciliation_runs enable row level security;
revoke all on table public.nw_support_reconciliation_runs from public, anon, authenticated;
grant select, insert on public.nw_support_reconciliation_runs to service_role;

-- ==================================================== payout attribution v2

-- The 5-argument signature is replaced by one that accepts server-resolved
-- payout attribution. Both new arguments default to null, so a deployment
-- window where the old function code still sends five arguments keeps working.
drop function if exists public.nw_apply_payment_event(text, text, text, jsonb, timestamptz);

create or replace function public.nw_apply_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_occurred_at timestamptz,
  p_provider_account_ref text default null,
  p_resolved_journalist_profile_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_object jsonb := coalesce(p_payload #> '{data,object}', '{}'::jsonb);
  v_metadata jsonb;
  v_receipt public.nw_support_receipts%rowtype;
  v_supporter_id uuid;
  v_journalist_id uuid;
  v_metadata_journalist_id uuid;
  v_account_journalist_id uuid;
  v_account_ref text;
  v_amount bigint;
  v_platform_fee bigint;
  v_currency text;
  v_provider_ref text;
  v_charge_ref text;
  v_gross_delta bigint;
  v_net_delta bigint;
  v_fee_reversal bigint;
  v_existing_fee_reversals bigint;
  v_existing_refunds bigint;
  v_outstanding_hold bigint;
  v_outcome text;
  v_account_state text;
  v_status_reason text;
begin
  if nullif(trim(p_provider), '') is null
    or nullif(trim(p_provider_event_id), '') is null
    or nullif(trim(p_event_type), '') is null
    or p_payload is null
  then
    raise exception 'nw_apply_payment_event: invalid envelope';
  end if;

  insert into public.nw_payment_events (
    provider,
    provider_event_id,
    event_type,
    payload,
    state,
    created_at
  ) values (
    lower(trim(p_provider)),
    trim(p_provider_event_id),
    trim(p_event_type),
    p_payload,
    'received',
    coalesce(p_occurred_at, now())
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return 'duplicate';
  end if;

  v_metadata := coalesce(v_object -> 'metadata', '{}'::jsonb);
  v_provider_ref := nullif(trim(v_object ->> 'id'), '');
  v_charge_ref := coalesce(
    nullif(trim(v_object ->> 'latest_charge'), ''),
    nullif(trim(v_object ->> 'charge'), ''),
    case when v_provider_ref like 'ch_%' then v_provider_ref else null end
  );
  v_currency := upper(coalesce(nullif(trim(v_object ->> 'currency'), ''), 'USD'));
  v_account_ref := nullif(trim(coalesce(p_provider_account_ref, '')), '');

  if p_event_type = 'payment_succeeded' then
    v_supporter_id := nullif(trim(v_metadata ->> 'supporter_profile_id'), '')::uuid;
    v_journalist_id := nullif(trim(v_metadata ->> 'journalist_profile_id'), '')::uuid;
    v_amount := coalesce(
      nullif(v_object ->> 'amount_received', '')::bigint,
      nullif(v_object ->> 'amount_total', '')::bigint,
      nullif(v_object ->> 'amount', '')::bigint
    );

    if v_supporter_id is null
      or v_journalist_id is null
      or v_provider_ref is null
      or v_amount is null
      or v_amount < 100
      or v_amount > 100000
      or v_currency !~ '^[A-Z]{3}$'
      or not exists (
        select 1 from public.nw_journalists j where j.profile_id = v_journalist_id
      )
    then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'invalid-payment-metadata', processed_at = now()
      where id = v_event_id;
      return 'rejected';
    end if;

    v_platform_fee := round((v_amount::numeric * 200) / 10000)::bigint;

    insert into public.nw_support_ledger (
      supporter_profile_id,
      journalist_profile_id,
      kind,
      amount_cents,
      currency,
      provider,
      provider_ref,
      idempotency_key,
      state,
      created_at
    ) values
      (
        v_supporter_id,
        v_journalist_id,
        'charge',
        v_amount,
        v_currency,
        lower(trim(p_provider)),
        v_provider_ref,
        lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':charge',
        'posted',
        coalesce(p_occurred_at, now())
      ),
      (
        v_supporter_id,
        v_journalist_id,
        'platform_fee',
        v_platform_fee,
        v_currency,
        lower(trim(p_provider)),
        v_provider_ref,
        lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':platform-fee',
        'posted',
        coalesce(p_occurred_at, now())
      );

    insert into public.nw_support_receipts (
      supporter_profile_id,
      journalist_profile_id,
      gross_cents,
      platform_fee_cents,
      journalist_net_cents,
      currency,
      provider,
      provider_ref,
      charge_provider_ref,
      state,
      created_at,
      updated_at
    ) values (
      v_supporter_id,
      v_journalist_id,
      v_amount,
      v_platform_fee,
      v_amount - v_platform_fee,
      v_currency,
      lower(trim(p_provider)),
      v_provider_ref,
      v_charge_ref,
      'paid',
      coalesce(p_occurred_at, now()),
      now()
    );
    v_outcome := 'applied';

  elsif p_event_type in ('payment_refunded', 'dispute_created', 'dispute_resolved') then
    select r.* into v_receipt
    from public.nw_support_receipts r
    where r.provider = lower(trim(p_provider))
      and (
        r.provider_ref = coalesce(nullif(trim(v_object ->> 'payment_intent'), ''), v_provider_ref)
        or r.charge_provider_ref = coalesce(v_charge_ref, v_provider_ref)
      )
    order by r.created_at desc
    limit 1;

    if v_receipt.id is null then
      update public.nw_payment_events
      set state = 'ignored', failure_reason = 'receipt-not-found', processed_at = now()
      where id = v_event_id;
      return 'ignored';
    end if;

    v_supporter_id := v_receipt.supporter_profile_id;
    v_journalist_id := v_receipt.journalist_profile_id;
    v_currency := v_receipt.currency;
    v_amount := coalesce(
      nullif(v_object ->> 'amount_refunded', '')::bigint,
      nullif(v_object ->> 'amount', '')::bigint,
      v_receipt.gross_cents
    );

    if v_amount <= 0 then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'invalid-transition-amount', processed_at = now()
      where id = v_event_id;
      return 'rejected';
    end if;

    if p_event_type = 'payment_refunded' then
      -- Stripe reports cumulative gross amount_refunded. Split only the unseen
      -- gross delta into the journalist-net refund and the platform-fee reversal.
      v_gross_delta := v_amount - v_receipt.refunded_cents;
      if v_gross_delta <= 0 then
        update public.nw_payment_events
        set state = 'ignored', processed_at = now()
        where id = v_event_id;
        return 'ignored';
      end if;
      if v_receipt.refunded_cents + v_gross_delta > v_receipt.gross_cents then
        update public.nw_payment_events
        set state = 'failed', failure_reason = 'refund-exceeds-charge', processed_at = now()
        where id = v_event_id;
        return 'rejected';
      end if;

      select coalesce(sum(l.amount_cents), 0) into v_existing_fee_reversals
      from public.nw_support_ledger l
      where l.supporter_profile_id = v_supporter_id
        and l.journalist_profile_id = v_journalist_id
        and l.kind = 'platform_fee'
        and l.state = 'reversed'
        and l.provider = lower(trim(p_provider))
        and l.provider_ref = v_receipt.provider_ref;

      v_fee_reversal :=
        round(
          (v_receipt.platform_fee_cents::numeric *
            (v_receipt.refunded_cents + v_gross_delta)) /
          v_receipt.gross_cents
        )::bigint - v_existing_fee_reversals;
      v_net_delta := v_gross_delta - v_fee_reversal;

      if v_net_delta > 0 then
        insert into public.nw_support_ledger (
          supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
          provider, provider_ref, idempotency_key, state, created_at
        ) values (
          v_supporter_id, v_journalist_id, 'refund', v_net_delta, v_currency,
          lower(trim(p_provider)), v_receipt.provider_ref,
          lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':refund',
          'refunded', coalesce(p_occurred_at, now())
        );
      end if;
      if v_fee_reversal > 0 then
        insert into public.nw_support_ledger (
          supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
          provider, provider_ref, idempotency_key, state, created_at
        ) values (
          v_supporter_id, v_journalist_id, 'platform_fee', v_fee_reversal, v_currency,
          lower(trim(p_provider)), v_receipt.provider_ref,
          lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':platform-fee-reversal',
          'reversed', coalesce(p_occurred_at, now())
        );
      end if;

      update public.nw_support_receipts
      set refunded_cents = refunded_cents + v_gross_delta,
          state = case
            when refunded_cents + v_gross_delta = gross_cents then 'refunded'
            else 'partially_refunded'
          end,
          updated_at = now()
      where id = v_receipt.id;

    elsif p_event_type = 'dispute_created' then
      select coalesce(sum(l.amount_cents), 0) into v_existing_refunds
      from public.nw_support_ledger l
      where l.supporter_profile_id = v_supporter_id
        and l.journalist_profile_id = v_journalist_id
        and l.kind = 'refund'
        and l.provider = lower(trim(p_provider))
        and l.provider_ref = v_receipt.provider_ref;
      select
        coalesce(sum(case when l.kind = 'dispute_hold' then l.amount_cents else 0 end), 0) -
        coalesce(sum(case when l.kind = 'dispute_release' then l.amount_cents else 0 end), 0)
      into v_outstanding_hold
      from public.nw_support_ledger l
      where l.supporter_profile_id = v_supporter_id
        and l.journalist_profile_id = v_journalist_id
        and l.kind in ('dispute_hold', 'dispute_release')
        and l.provider = lower(trim(p_provider))
        and l.provider_ref = v_receipt.provider_ref;
      v_amount := least(
        v_amount,
        greatest(0, v_receipt.journalist_net_cents - v_existing_refunds - v_outstanding_hold)
      );
      if v_amount <= 0 then
        update public.nw_payment_events
        set state = 'ignored', failure_reason = 'no-earnings-available-to-hold', processed_at = now()
        where id = v_event_id;
        return 'ignored';
      end if;
      insert into public.nw_support_ledger (
        supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
        provider, provider_ref, idempotency_key, state, created_at
      ) values (
        v_supporter_id, v_journalist_id, 'dispute_hold', v_amount, v_currency,
        lower(trim(p_provider)), v_receipt.provider_ref,
        lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':dispute-hold',
        'held', coalesce(p_occurred_at, now())
      );
      update public.nw_support_receipts
      set state = 'disputed', updated_at = now()
      where id = v_receipt.id;

    else
      select
        coalesce(sum(case when l.kind = 'dispute_hold' then l.amount_cents else 0 end), 0) -
        coalesce(sum(case when l.kind = 'dispute_release' then l.amount_cents else 0 end), 0)
      into v_outstanding_hold
      from public.nw_support_ledger l
      where l.supporter_profile_id = v_supporter_id
        and l.journalist_profile_id = v_journalist_id
        and l.kind in ('dispute_hold', 'dispute_release')
        and l.provider = lower(trim(p_provider))
        and l.provider_ref = v_receipt.provider_ref;
      v_amount := least(v_amount, v_outstanding_hold);
      if v_amount <= 0 then
        update public.nw_payment_events
        set state = 'ignored', failure_reason = 'no-dispute-hold-to-release', processed_at = now()
        where id = v_event_id;
        return 'ignored';
      end if;

      insert into public.nw_support_ledger (
        supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
        provider, provider_ref, idempotency_key, state, created_at
      ) values (
        v_supporter_id, v_journalist_id, 'dispute_release', v_amount, v_currency,
        lower(trim(p_provider)), v_receipt.provider_ref,
        lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':dispute-release',
        'released', coalesce(p_occurred_at, now())
      );

      if lower(coalesce(v_object ->> 'status', v_object ->> 'outcome', '')) in ('lost', 'charge_refunded') then
        v_gross_delta := least(
          coalesce(nullif(v_object ->> 'amount', '')::bigint, v_receipt.gross_cents),
          v_receipt.gross_cents - v_receipt.refunded_cents
        );
        if v_gross_delta <= 0 then
          update public.nw_payment_events
          set state = 'applied', processed_at = now()
          where id = v_event_id;
          return 'applied';
        end if;
        select coalesce(sum(l.amount_cents), 0) into v_existing_fee_reversals
        from public.nw_support_ledger l
        where l.supporter_profile_id = v_supporter_id
          and l.journalist_profile_id = v_journalist_id
          and l.kind = 'platform_fee'
          and l.state = 'reversed'
          and l.provider = lower(trim(p_provider))
          and l.provider_ref = v_receipt.provider_ref;
        v_fee_reversal :=
          round(
            (v_receipt.platform_fee_cents::numeric *
              (v_receipt.refunded_cents + v_gross_delta)) /
            v_receipt.gross_cents
          )::bigint - v_existing_fee_reversals;
        v_net_delta := v_gross_delta - v_fee_reversal;
        if v_net_delta > 0 then
          insert into public.nw_support_ledger (
            supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
            provider, provider_ref, idempotency_key, state, created_at
          ) values (
            v_supporter_id, v_journalist_id, 'refund', v_net_delta, v_currency,
            lower(trim(p_provider)), v_receipt.provider_ref,
            lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':dispute-refund',
            'refunded', coalesce(p_occurred_at, now())
          );
        end if;
        if v_fee_reversal > 0 then
          insert into public.nw_support_ledger (
            supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
            provider, provider_ref, idempotency_key, state, created_at
          ) values (
            v_supporter_id, v_journalist_id, 'platform_fee', v_fee_reversal, v_currency,
            lower(trim(p_provider)), v_receipt.provider_ref,
            lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':dispute-fee-reversal',
            'reversed', coalesce(p_occurred_at, now())
          );
        end if;
        update public.nw_support_receipts
        set refunded_cents = refunded_cents + v_gross_delta,
            state = case
              when refunded_cents + v_gross_delta = gross_cents then 'refunded'
              else 'partially_refunded'
            end,
            updated_at = now()
        where id = v_receipt.id;
      else
        update public.nw_support_receipts
        set state = 'dispute_released', updated_at = now()
        where id = v_receipt.id;
      end if;
    end if;
    v_outcome := 'applied';

  elsif p_event_type in ('payout_paid', 'payout_failed') then
    -- Real Stripe Connect automatic payouts carry EMPTY metadata; the only
    -- attribution signal is the event envelope's top-level `account`. The
    -- webhook resolves that to a journalist through nw_payout_accounts and
    -- passes it here. Metadata is still honoured when a payout carries it (a
    -- manually created payout can), and the two must agree.
    v_metadata_journalist_id := nullif(trim(v_metadata ->> 'journalist_profile_id'), '')::uuid;

    if v_account_ref is not null then
      select a.journalist_profile_id into v_account_journalist_id
      from public.nw_payout_accounts a
      where a.provider = lower(trim(p_provider))
        and a.provider_account_ref = v_account_ref
      limit 1;
    end if;

    -- A resolved id the caller supplies is only trusted when it matches the
    -- account ref we hold for it. Anything else is a contradiction, not a hint.
    if p_resolved_journalist_profile_id is not null
      and v_account_journalist_id is not null
      and p_resolved_journalist_profile_id <> v_account_journalist_id
    then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'payout-attribution-conflict', processed_at = now()
      where id = v_event_id;
      return 'rejected';
    end if;

    v_journalist_id := coalesce(v_account_journalist_id, p_resolved_journalist_profile_id);

    if v_journalist_id is not null
      and v_metadata_journalist_id is not null
      and v_journalist_id <> v_metadata_journalist_id
    then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'payout-attribution-conflict', processed_at = now()
      where id = v_event_id;
      return 'rejected';
    end if;

    v_journalist_id := coalesce(v_journalist_id, v_metadata_journalist_id);
    v_amount := nullif(v_object ->> 'amount', '')::bigint;

    if v_amount is null or v_amount <= 0 or v_provider_ref is null then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'invalid-payout-metadata', processed_at = now()
      where id = v_event_id;
      return 'rejected';
    end if;

    -- Unresolvable attribution is recorded for operator review, never dropped
    -- and never guessed at: no ledger row is written for a payout we cannot
    -- attribute to a journalist.
    if v_journalist_id is null
      or not exists (
        select 1 from public.nw_journalists j where j.profile_id = v_journalist_id
      )
    then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'unattributed-payout', processed_at = now()
      where id = v_event_id;
      return 'unattributed';
    end if;

    insert into public.nw_support_ledger (
      supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
      provider, provider_ref, idempotency_key, state, created_at
    ) values (
      null, v_journalist_id, 'payout', v_amount, v_currency,
      lower(trim(p_provider)), v_provider_ref,
      lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':payout',
      'paid', coalesce(p_occurred_at, now())
    );
    if p_event_type = 'payout_failed' then
      insert into public.nw_support_ledger (
        supporter_profile_id, journalist_profile_id, kind, amount_cents, currency,
        provider, provider_ref, idempotency_key, state, created_at
      ) values (
        null, v_journalist_id, 'payout_reversal', v_amount, v_currency,
        lower(trim(p_provider)), v_provider_ref,
        lower(trim(p_provider)) || ':' || trim(p_provider_event_id) || ':payout-reversal',
        'reversed', coalesce(p_occurred_at, now())
      );
    end if;
    v_outcome := 'applied';

  elsif p_event_type = 'payout_account_updated' then
    -- account.updated carries the account object itself, so provider_ref IS the
    -- account ref. Accounts we created carry our journalist metadata; an account
    -- already on file is resolvable without it.
    v_metadata_journalist_id := nullif(trim(v_metadata ->> 'journalist_profile_id'), '')::uuid;
    if v_provider_ref is not null then
      select a.journalist_profile_id into v_account_journalist_id
      from public.nw_payout_accounts a
      where a.provider = lower(trim(p_provider))
        and a.provider_account_ref = v_provider_ref
      limit 1;
    end if;
    v_journalist_id := coalesce(v_metadata_journalist_id, v_account_journalist_id);

    v_status_reason := nullif(trim(v_object #>> '{requirements,disabled_reason}'), '');
    v_account_state := case
      when v_status_reason is not null then 'blocked'
      when coalesce((v_object ->> 'details_submitted')::boolean, false)
        and coalesce((v_object ->> 'payouts_enabled')::boolean, false)
      then 'verified'
      else 'pending'
    end;
    if v_journalist_id is null or v_provider_ref is null then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'invalid-account-metadata', processed_at = now()
      where id = v_event_id;
      return 'rejected';
    end if;
    insert into public.nw_payout_accounts (
      journalist_profile_id,
      onboarding_state,
      provider,
      provider_account_ref,
      status_reason,
      updated_at
    ) values (
      v_journalist_id,
      v_account_state,
      lower(trim(p_provider)),
      v_provider_ref,
      v_status_reason,
      now()
    )
    on conflict (journalist_profile_id) do update
    set onboarding_state = excluded.onboarding_state,
        provider = excluded.provider,
        provider_account_ref = excluded.provider_account_ref,
        status_reason = excluded.status_reason,
        updated_at = excluded.updated_at;
    v_outcome := 'applied';

  else
    v_outcome := 'ignored';
  end if;

  update public.nw_payment_events
  set state = v_outcome, processed_at = now()
  where id = v_event_id;
  return v_outcome;
end;
$$;

revoke all on function public.nw_apply_payment_event(text, text, text, jsonb, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function public.nw_apply_payment_event(text, text, text, jsonb, timestamptz, text, uuid)
  to service_role;
