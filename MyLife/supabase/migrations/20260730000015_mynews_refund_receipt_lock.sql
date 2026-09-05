-- MyNews plan 48 WP12 Codex finding: refund double-processing.
--
-- nw_apply_payment_event's refund/dispute branch read the receipt WITHOUT a row
-- lock, then computed the refund delta from v_receipt.refunded_cents. Two
-- concurrent signed refund events (distinct provider_event_id, so idempotency
-- does not merge them) both read refunded_cents = 0, both split their full gross
-- as an unseen delta, and both committed, over-refunding past gross_cents. The
-- fix locks the receipt row (FOR UPDATE) so the second refund transaction reads
-- the first's committed refunded_cents and its delta collapses to zero.
--
-- The function is otherwise byte-identical to its 20260730000007 definition:
-- only the FOR UPDATE on the refund-branch receipt select is added.

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
    limit 1
    for update;

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
