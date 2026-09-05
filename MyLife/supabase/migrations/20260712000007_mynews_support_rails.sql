-- MyNews journalist support accounting and payout rails.
--
-- Every provider event is applied through one security-definer RPC. The raw
-- verified event, all append-only ledger entries, receipt transitions, and
-- payout-account transitions therefore commit or roll back together. Clients
-- can read only their side of a support relationship and cannot write any
-- finance table. Provider account references and raw webhook payloads remain
-- service-role-only.

create table if not exists public.nw_support_ledger (
  id uuid primary key default gen_random_uuid(),
  supporter_profile_id uuid references public.nw_profiles (id) on delete restrict,
  journalist_profile_id uuid not null references public.nw_journalists (profile_id) on delete restrict,
  kind text not null check (
    kind in (
      'charge',
      'platform_fee',
      'refund',
      'dispute_hold',
      'dispute_release',
      'payout',
      'payout_reversal'
    )
  ),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null check (provider <> ''),
  provider_ref text,
  idempotency_key text not null unique,
  state text not null check (state in ('posted', 'held', 'released', 'refunded', 'paid', 'reversed')),
  created_at timestamptz not null default now()
);

create index if not exists nw_support_ledger_supporter_idx
  on public.nw_support_ledger (supporter_profile_id, created_at desc)
  where supporter_profile_id is not null;
create index if not exists nw_support_ledger_journalist_idx
  on public.nw_support_ledger (journalist_profile_id, created_at desc);
create index if not exists nw_support_ledger_provider_ref_idx
  on public.nw_support_ledger (provider, provider_ref)
  where provider_ref is not null;

alter table public.nw_support_ledger enable row level security;

create policy nw_support_ledger_supporter_select on public.nw_support_ledger
  for select using (
    supporter_profile_id is not null
    and auth.uid() = (
      select p.user_id from public.nw_profiles p where p.id = supporter_profile_id
    )
  );

create policy nw_support_ledger_journalist_select on public.nw_support_ledger
  for select using (
    auth.uid() = (
      select p.user_id from public.nw_profiles p where p.id = journalist_profile_id
    )
  );

create table if not exists public.nw_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider <> ''),
  provider_event_id text not null check (provider_event_id <> ''),
  event_type text not null check (event_type <> ''),
  payload jsonb not null,
  state text not null default 'received' check (state in ('received', 'applied', 'ignored', 'failed')),
  failure_reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

alter table public.nw_payment_events enable row level security;

create table if not exists public.nw_payout_accounts (
  journalist_profile_id uuid primary key references public.nw_journalists (profile_id) on delete restrict,
  onboarding_state text not null default 'none' check (
    onboarding_state in ('none', 'pending', 'verified', 'blocked')
  ),
  provider text,
  provider_account_ref text,
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (onboarding_state = 'none' and provider_account_ref is null)
    or (onboarding_state <> 'none' and provider is not null and provider_account_ref is not null)
  )
);

alter table public.nw_payout_accounts enable row level security;

create policy nw_payout_accounts_journalist_select on public.nw_payout_accounts
  for select using (
    auth.uid() = (
      select p.user_id
      from public.nw_profiles p
      where p.id = journalist_profile_id
    )
  );

create table if not exists public.nw_support_receipts (
  id uuid primary key default gen_random_uuid(),
  supporter_profile_id uuid not null references public.nw_profiles (id) on delete restrict,
  journalist_profile_id uuid not null references public.nw_journalists (profile_id) on delete restrict,
  gross_cents bigint not null check (gross_cents > 0),
  platform_fee_cents bigint not null check (
    platform_fee_cents >= 0 and platform_fee_cents <= gross_cents
  ),
  journalist_net_cents bigint not null check (
    journalist_net_cents >= 0
    and gross_cents = platform_fee_cents + journalist_net_cents
  ),
  refunded_cents bigint not null default 0 check (
    refunded_cents >= 0 and refunded_cents <= gross_cents
  ),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null check (provider <> ''),
  provider_ref text not null,
  charge_provider_ref text,
  state text not null default 'paid' check (
    state in ('paid', 'partially_refunded', 'refunded', 'disputed', 'dispute_released')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index if not exists nw_support_receipts_supporter_idx
  on public.nw_support_receipts (supporter_profile_id, created_at desc);
create index if not exists nw_support_receipts_journalist_idx
  on public.nw_support_receipts (journalist_profile_id, created_at desc);
create unique index if not exists nw_support_receipts_charge_ref_uidx
  on public.nw_support_receipts (provider, charge_provider_ref)
  where charge_provider_ref is not null;

alter table public.nw_support_receipts enable row level security;

create policy nw_support_receipts_supporter_select on public.nw_support_receipts
  for select using (
    auth.uid() = (
      select p.user_id from public.nw_profiles p where p.id = supporter_profile_id
    )
  );

revoke all on table public.nw_support_ledger from public, anon, authenticated;
revoke all on table public.nw_payment_events from public, anon, authenticated;
revoke all on table public.nw_payout_accounts from public, anon, authenticated;
revoke all on table public.nw_support_receipts from public, anon, authenticated;

grant select (
  id,
  journalist_profile_id,
  kind,
  amount_cents,
  currency,
  provider,
  provider_ref,
  idempotency_key,
  state,
  created_at
) on public.nw_support_ledger to authenticated;

-- provider_account_ref is deliberately omitted from the client column grant.
grant select (
  journalist_profile_id,
  onboarding_state,
  provider,
  status_reason,
  created_at,
  updated_at
) on public.nw_payout_accounts to authenticated;

grant select (
  id,
  supporter_profile_id,
  journalist_profile_id,
  gross_cents,
  platform_fee_cents,
  journalist_net_cents,
  refunded_cents,
  currency,
  provider,
  provider_ref,
  state,
  created_at,
  updated_at
) on public.nw_support_receipts to authenticated;

grant select, insert on public.nw_support_ledger to service_role;
grant select, insert, update on public.nw_payment_events to service_role;
grant select, insert, update on public.nw_payout_accounts to service_role;
grant select, insert, update on public.nw_support_receipts to service_role;

create or replace function public.nw_support_ledger_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'nw_support_ledger is append-only';
end;
$$;

drop trigger if exists nw_support_ledger_immutable on public.nw_support_ledger;
create trigger nw_support_ledger_immutable
  before update or delete on public.nw_support_ledger
  for each row execute function public.nw_support_ledger_immutable();

create or replace function public.nw_apply_payment_event(
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_occurred_at timestamptz
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
    v_journalist_id := nullif(trim(v_metadata ->> 'journalist_profile_id'), '')::uuid;
    v_amount := nullif(v_object ->> 'amount', '')::bigint;
    if v_journalist_id is null or v_amount is null or v_amount <= 0 or v_provider_ref is null then
      update public.nw_payment_events
      set state = 'failed', failure_reason = 'invalid-payout-metadata', processed_at = now()
      where id = v_event_id;
      return 'rejected';
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
    v_journalist_id := nullif(trim(v_metadata ->> 'journalist_profile_id'), '')::uuid;
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

revoke all on function public.nw_apply_payment_event(text, text, text, jsonb, timestamptz)
  from public, anon, authenticated;
grant execute on function public.nw_apply_payment_event(text, text, text, jsonb, timestamptz)
  to service_role;
