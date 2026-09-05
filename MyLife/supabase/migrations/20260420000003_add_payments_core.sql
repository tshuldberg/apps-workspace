-- Mirror of modules/payments/src/cloud/schema.sql.
-- Keep this migration aligned with the module-local schema source.
-- MyPay authoritative payments schema
-- Owner reads are allowed through RLS. Money-moving writes stay on privileged server paths.

do $$
begin
  create type pay_wallet_type as enum ('consumer', 'merchant', 'treasury', 'escrow');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_wallet_status as enum ('pending', 'active', 'restricted', 'frozen', 'closed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_balance_bucket as enum ('available', 'pending', 'reserved', 'escrow');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_transfer_kind as enum (
    'p2p',
    'request_payment',
    'fund_wallet',
    'withdraw_wallet',
    'merchant_charge',
    'merchant_refund',
    'card_authorization',
    'card_capture',
    'card_refund',
    'escrow_hold',
    'escrow_release',
    'remittance_send',
    'remittance_refund',
    'adjustment',
    'reversal'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_transfer_status as enum (
    'pending_review',
    'pending_provider',
    'processing',
    'completed',
    'failed',
    'reversed',
    'canceled',
    'disputed'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_transfer_event_type as enum (
    'posted',
    'provider_update',
    'failed',
    'canceled',
    'reversed',
    'dispute_opened',
    'dispute_closed',
    'hold_applied',
    'hold_released'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_payment_request_status as enum ('open', 'approved', 'declined', 'expired', 'canceled', 'paid');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_identity_subject_type as enum ('individual', 'business');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_identity_status as enum ('unsubmitted', 'pending', 'verified', 'rejected', 'restricted');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_verification_state as enum ('unverified', 'review', 'verified');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_linked_account_status as enum ('pending', 'active', 'restricted', 'deauthorized', 'closed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_linked_account_type as enum ('checking', 'savings', 'debit_card', 'credit_card', 'wallet');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_rail as enum ('wallet', 'bank', 'card', 'internal', 'remittance', 'ach', 'wire', 'merchant');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_intent_status as enum ('draft', 'pending_review', 'pending_provider', 'processing', 'posted', 'failed', 'canceled');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_card_status as enum ('pending', 'active', 'frozen', 'canceled');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_card_transaction_status as enum ('authorized', 'captured', 'cleared', 'declined', 'reversed', 'refunded', 'disputed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_dispute_status as enum ('open', 'under_review', 'won', 'lost', 'closed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_remittance_status as enum ('quoted', 'pending_review', 'pending_provider', 'processing', 'completed', 'failed', 'canceled', 'reversed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_provider_event_status as enum ('received', 'processing', 'applied', 'ignored', 'failed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_compliance_case_type as enum (
    'kyc_review',
    'aml_review',
    'ofac_screening',
    'fraud_review',
    'reg_e_error',
    'chargeback',
    'manual_hold',
    'travel_rule_review'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_compliance_case_status as enum ('open', 'under_review', 'awaiting_user', 'cleared', 'reported', 'closed');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_compliance_severity as enum ('low', 'medium', 'high', 'critical');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_ledger_direction as enum ('debit', 'credit');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type pay_ledger_kind as enum ('principal', 'fee', 'reserve', 'hold', 'release', 'reversal', 'adjustment', 'fx', 'chargeback');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists pay_wallets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  wallet_type pay_wallet_type not null default 'consumer',
  status pay_wallet_status not null default 'pending',
  handle text,
  display_name text,
  default_currency text not null default 'USD',
  country_code text not null default 'US',
  is_default boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_wallets_currency_format check (default_currency ~ '^[A-Z]{3}$'),
  constraint pay_wallets_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint pay_wallets_handle_format check (
    handle is null or handle ~ '^[a-z0-9_.-]{3,32}$'
  ),
  constraint pay_wallets_owner_currency_unique unique (owner_user_id, wallet_type, default_currency)
);

create unique index if not exists pay_wallets_handle_unique on pay_wallets (handle) where handle is not null;
create index if not exists pay_wallets_owner_idx on pay_wallets (owner_user_id, wallet_type, created_at desc);

create table if not exists pay_wallet_balances (
  wallet_id uuid not null references pay_wallets(id) on delete cascade,
  currency text not null,
  balance_bucket pay_balance_bucket not null,
  amount_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (wallet_id, currency, balance_bucket),
  constraint pay_wallet_balances_currency_format check (currency ~ '^[A-Z]{3}$')
);

create index if not exists pay_wallet_balances_wallet_idx on pay_wallet_balances (wallet_id, updated_at desc);

create table if not exists pay_identities (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  primary_wallet_id uuid references pay_wallets(id) on delete set null,
  subject_type pay_identity_subject_type not null default 'individual',
  status pay_identity_status not null default 'unsubmitted',
  verification_state pay_verification_state not null default 'unverified',
  provider_name text,
  provider_identity_id text,
  country_code text not null default 'US',
  legal_name text,
  display_name text,
  email text,
  phone_e164 text,
  business_name text,
  business_type text,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_identities_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint pay_identities_phone_format check (
    phone_e164 is null or phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'
  )
);

create unique index if not exists pay_identities_provider_unique
  on pay_identities (provider_name, provider_identity_id)
  where provider_name is not null and provider_identity_id is not null;
create index if not exists pay_identities_owner_idx on pay_identities (owner_user_id, created_at desc);

create table if not exists pay_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  contact_user_id uuid references auth.users(id) on delete set null,
  contact_wallet_id uuid references pay_wallets(id) on delete set null,
  kind text not null default 'user',
  display_name text not null,
  handle text,
  country_code text,
  verification_state pay_verification_state not null default 'unverified',
  risk_level text not null default 'normal',
  is_favorite boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_contacts_kind_valid check (kind in ('user', 'external', 'merchant', 'bank')),
  constraint pay_contacts_risk_level_valid check (risk_level in ('normal', 'review', 'blocked')),
  constraint pay_contacts_country_code_format check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  )
);

create unique index if not exists pay_contacts_owner_user_unique
  on pay_contacts (owner_user_id, contact_user_id)
  where contact_user_id is not null;
create index if not exists pay_contacts_owner_idx on pay_contacts (owner_user_id, created_at desc);

create table if not exists pay_linked_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid references pay_wallets(id) on delete set null,
  status pay_linked_account_status not null default 'pending',
  account_type pay_linked_account_type not null,
  rail pay_rail not null,
  provider_name text not null,
  provider_account_id text not null,
  institution_name text,
  account_name text,
  last4 text,
  country_code text not null default 'US',
  fingerprint text,
  verification_state pay_verification_state not null default 'unverified',
  is_default boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_linked_accounts_country_code_format check (country_code ~ '^[A-Z]{2}$'),
  constraint pay_linked_accounts_last4_format check (last4 is null or last4 ~ '^[0-9]{4}$')
);

create unique index if not exists pay_linked_accounts_provider_unique
  on pay_linked_accounts (provider_name, provider_account_id);
create index if not exists pay_linked_accounts_owner_idx
  on pay_linked_accounts (owner_user_id, created_at desc);

create table if not exists pay_payment_requests (
  id uuid primary key default gen_random_uuid(),
  requester_wallet_id uuid not null references pay_wallets(id) on delete cascade,
  payer_wallet_id uuid references pay_wallets(id) on delete set null,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  payer_user_id uuid references auth.users(id) on delete set null,
  status pay_payment_request_status not null default 'open',
  amount_cents bigint not null,
  currency text not null default 'USD',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  responded_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_payment_requests_amount_positive check (amount_cents > 0),
  constraint pay_payment_requests_currency_format check (currency ~ '^[A-Z]{3}$')
);

create index if not exists pay_payment_requests_requester_idx
  on pay_payment_requests (requester_user_id, created_at desc);
create index if not exists pay_payment_requests_payer_idx
  on pay_payment_requests (payer_user_id, created_at desc);
create index if not exists pay_payment_requests_status_idx
  on pay_payment_requests (status, created_at desc);

create table if not exists pay_remittance_quotes (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  source_wallet_id uuid references pay_wallets(id) on delete set null,
  provider_name text not null,
  corridor text not null,
  recipient_country_code text not null,
  source_currency text not null,
  source_amount_cents bigint not null,
  destination_currency text not null,
  destination_amount_cents bigint not null,
  exchange_rate numeric(20, 8) not null,
  fee_cents bigint not null default 0,
  disclosures jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint pay_remittance_quotes_source_amount_positive check (source_amount_cents > 0),
  constraint pay_remittance_quotes_destination_amount_positive check (destination_amount_cents > 0),
  constraint pay_remittance_quotes_fee_nonnegative check (fee_cents >= 0),
  constraint pay_remittance_quotes_exchange_rate_positive check (exchange_rate > 0),
  constraint pay_remittance_quotes_recipient_country_format check (recipient_country_code ~ '^[A-Z]{2}$'),
  constraint pay_remittance_quotes_source_currency_format check (source_currency ~ '^[A-Z]{3}$'),
  constraint pay_remittance_quotes_destination_currency_format check (destination_currency ~ '^[A-Z]{3}$')
);

create index if not exists pay_remittance_quotes_requester_idx
  on pay_remittance_quotes (requester_user_id, created_at desc);
create index if not exists pay_remittance_quotes_expiry_idx
  on pay_remittance_quotes (expires_at);

create table if not exists pay_transfers (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  kind pay_transfer_kind not null,
  status pay_transfer_status not null default 'pending_review',
  source_wallet_id uuid references pay_wallets(id) on delete set null,
  destination_wallet_id uuid references pay_wallets(id) on delete set null,
  payment_request_id uuid references pay_payment_requests(id) on delete set null,
  quote_id uuid references pay_remittance_quotes(id) on delete set null,
  reversal_of_transfer_id uuid references pay_transfers(id) on delete set null,
  source_rail pay_rail not null default 'wallet',
  destination_rail pay_rail not null default 'wallet',
  source_amount_cents bigint not null,
  source_currency text not null default 'USD',
  destination_amount_cents bigint,
  destination_currency text,
  fee_amount_cents bigint not null default 0,
  initiator_user_id uuid references auth.users(id) on delete set null,
  counterparty_user_id uuid references auth.users(id) on delete set null,
  provider_name text,
  provider_transfer_id text,
  external_reference text,
  description text,
  hold_expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  failed_at timestamptz,
  reversed_at timestamptz,
  canceled_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_transfers_source_amount_positive check (source_amount_cents > 0),
  constraint pay_transfers_destination_amount_positive check (
    destination_amount_cents is null or destination_amount_cents > 0
  ),
  constraint pay_transfers_fee_nonnegative check (fee_amount_cents >= 0),
  constraint pay_transfers_source_currency_format check (source_currency ~ '^[A-Z]{3}$'),
  constraint pay_transfers_destination_currency_format check (
    destination_currency is null or destination_currency ~ '^[A-Z]{3}$'
  ),
  constraint pay_transfers_destination_pair_shape check (
    (destination_amount_cents is null and destination_currency is null)
    or (destination_amount_cents is not null and destination_currency is not null)
  ),
  constraint pay_transfers_wallet_presence check (
    source_wallet_id is not null or destination_wallet_id is not null
  )
);

create unique index if not exists pay_transfers_idempotency_unique
  on pay_transfers (idempotency_key);
create unique index if not exists pay_transfers_reversal_unique
  on pay_transfers (reversal_of_transfer_id)
  where reversal_of_transfer_id is not null;
create unique index if not exists pay_transfers_provider_unique
  on pay_transfers (provider_name, provider_transfer_id)
  where provider_name is not null and provider_transfer_id is not null;
create index if not exists pay_transfers_source_wallet_idx
  on pay_transfers (source_wallet_id, created_at desc);
create index if not exists pay_transfers_destination_wallet_idx
  on pay_transfers (destination_wallet_id, created_at desc);
create index if not exists pay_transfers_status_idx
  on pay_transfers (status, created_at desc);

create table if not exists pay_transfer_events (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references pay_transfers(id) on delete cascade,
  event_type pay_transfer_event_type not null,
  from_status pay_transfer_status,
  to_status pay_transfer_status,
  actor_type text not null default 'system',
  actor_user_id uuid references auth.users(id) on delete set null,
  provider_event_ref text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint pay_transfer_events_actor_type_valid check (
    actor_type in ('system', 'provider', 'user', 'operator')
  )
);

create index if not exists pay_transfer_events_transfer_idx
  on pay_transfer_events (transfer_id, occurred_at desc);

create table if not exists pay_funding_intents (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references pay_wallets(id) on delete cascade,
  linked_account_id uuid not null references pay_linked_accounts(id) on delete restrict,
  transfer_id uuid references pay_transfers(id) on delete set null,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status pay_intent_status not null default 'draft',
  idempotency_key text not null,
  amount_cents bigint not null,
  currency text not null default 'USD',
  provider_name text,
  provider_intent_id text,
  expected_post_at timestamptz,
  posted_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_funding_intents_amount_positive check (amount_cents > 0),
  constraint pay_funding_intents_currency_format check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists pay_funding_intents_idempotency_unique
  on pay_funding_intents (idempotency_key);
create unique index if not exists pay_funding_intents_provider_unique
  on pay_funding_intents (provider_name, provider_intent_id)
  where provider_name is not null and provider_intent_id is not null;
create index if not exists pay_funding_intents_wallet_idx
  on pay_funding_intents (wallet_id, created_at desc);

create table if not exists pay_payout_intents (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references pay_wallets(id) on delete cascade,
  linked_account_id uuid not null references pay_linked_accounts(id) on delete restrict,
  transfer_id uuid references pay_transfers(id) on delete set null,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  status pay_intent_status not null default 'draft',
  idempotency_key text not null,
  amount_cents bigint not null,
  currency text not null default 'USD',
  provider_name text,
  provider_intent_id text,
  expected_settlement_at timestamptz,
  settled_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_payout_intents_amount_positive check (amount_cents > 0),
  constraint pay_payout_intents_currency_format check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists pay_payout_intents_idempotency_unique
  on pay_payout_intents (idempotency_key);
create unique index if not exists pay_payout_intents_provider_unique
  on pay_payout_intents (provider_name, provider_intent_id)
  where provider_name is not null and provider_intent_id is not null;
create index if not exists pay_payout_intents_wallet_idx
  on pay_payout_intents (wallet_id, created_at desc);

create table if not exists pay_cards (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references pay_wallets(id) on delete cascade,
  status pay_card_status not null default 'pending',
  provider_name text not null,
  provider_card_id text not null,
  network text,
  brand text,
  last4 text,
  exp_month smallint,
  exp_year integer,
  cardholder_name text,
  billing_country_code text not null default 'US',
  spend_limit_cents bigint,
  frozen_reason text,
  metadata jsonb not null default '{}'::jsonb,
  issued_at timestamptz,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_cards_last4_format check (last4 is null or last4 ~ '^[0-9]{4}$'),
  constraint pay_cards_exp_month_range check (
    exp_month is null or exp_month between 1 and 12
  ),
  constraint pay_cards_billing_country_format check (billing_country_code ~ '^[A-Z]{2}$'),
  constraint pay_cards_spend_limit_nonnegative check (
    spend_limit_cents is null or spend_limit_cents >= 0
  )
);

create unique index if not exists pay_cards_provider_unique
  on pay_cards (provider_name, provider_card_id);
create index if not exists pay_cards_owner_idx on pay_cards (owner_user_id, created_at desc);

create table if not exists pay_card_transactions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references pay_cards(id) on delete cascade,
  wallet_id uuid not null references pay_wallets(id) on delete cascade,
  transfer_id uuid references pay_transfers(id) on delete set null,
  status pay_card_transaction_status not null default 'authorized',
  entry_type text not null default 'authorization',
  provider_name text not null,
  provider_transaction_id text not null,
  merchant_name text,
  merchant_descriptor text,
  merchant_category_code text,
  amount_cents bigint not null,
  currency text not null default 'USD',
  declined_reason text,
  metadata jsonb not null default '{}'::jsonb,
  authorized_at timestamptz not null default now(),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint pay_card_transactions_entry_type_valid check (
    entry_type in ('authorization', 'capture', 'refund', 'reversal', 'cash_withdrawal')
  ),
  constraint pay_card_transactions_amount_positive check (amount_cents > 0),
  constraint pay_card_transactions_currency_format check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists pay_card_transactions_provider_unique
  on pay_card_transactions (provider_name, provider_transaction_id);
create index if not exists pay_card_transactions_card_idx
  on pay_card_transactions (card_id, authorized_at desc);

create table if not exists pay_disputes (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null references pay_wallets(id) on delete cascade,
  transfer_id uuid references pay_transfers(id) on delete set null,
  card_transaction_id uuid references pay_card_transactions(id) on delete set null,
  status pay_dispute_status not null default 'open',
  provider_name text,
  provider_dispute_id text,
  reason text not null,
  outcome_code text,
  amount_cents bigint not null,
  currency text not null default 'USD',
  evidence_due_at timestamptz,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_disputes_subject_presence check (
    transfer_id is not null or card_transaction_id is not null
  ),
  constraint pay_disputes_amount_positive check (amount_cents > 0),
  constraint pay_disputes_currency_format check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists pay_disputes_provider_unique
  on pay_disputes (provider_name, provider_dispute_id)
  where provider_name is not null and provider_dispute_id is not null;
create index if not exists pay_disputes_owner_idx
  on pay_disputes (owner_user_id, opened_at desc);

create table if not exists pay_remittances (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  source_wallet_id uuid references pay_wallets(id) on delete set null,
  transfer_id uuid references pay_transfers(id) on delete set null,
  quote_id uuid references pay_remittance_quotes(id) on delete set null,
  status pay_remittance_status not null default 'quoted',
  provider_name text not null,
  provider_remittance_id text,
  recipient_name text not null,
  recipient_country_code text not null,
  destination_currency text not null,
  destination_amount_cents bigint not null,
  source_amount_cents bigint not null,
  fee_cents bigint not null default 0,
  payout_method text not null default 'bank',
  travel_rule_reference text,
  receipt_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_remittances_recipient_country_format check (recipient_country_code ~ '^[A-Z]{2}$'),
  constraint pay_remittances_destination_currency_format check (destination_currency ~ '^[A-Z]{3}$'),
  constraint pay_remittances_destination_amount_positive check (destination_amount_cents > 0),
  constraint pay_remittances_source_amount_positive check (source_amount_cents > 0),
  constraint pay_remittances_fee_nonnegative check (fee_cents >= 0)
);

create unique index if not exists pay_remittances_provider_unique
  on pay_remittances (provider_name, provider_remittance_id)
  where provider_remittance_id is not null;
create index if not exists pay_remittances_owner_idx
  on pay_remittances (owner_user_id, created_at desc);

create table if not exists pay_provider_events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  wallet_id uuid references pay_wallets(id) on delete set null,
  transfer_id uuid references pay_transfers(id) on delete set null,
  remittance_id uuid references pay_remittances(id) on delete set null,
  provider_name text not null,
  provider_event_id text not null,
  event_type text not null,
  object_type text,
  object_reference text,
  status pay_provider_event_status not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  error_message text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists pay_provider_events_provider_unique
  on pay_provider_events (provider_name, provider_event_id);
create index if not exists pay_provider_events_transfer_idx
  on pay_provider_events (transfer_id, received_at desc);
create index if not exists pay_provider_events_status_idx
  on pay_provider_events (status, received_at desc);

create table if not exists pay_compliance_cases (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  wallet_id uuid references pay_wallets(id) on delete set null,
  identity_id uuid references pay_identities(id) on delete set null,
  transfer_id uuid references pay_transfers(id) on delete set null,
  remittance_id uuid references pay_remittances(id) on delete set null,
  case_type pay_compliance_case_type not null,
  status pay_compliance_case_status not null default 'open',
  severity pay_compliance_severity not null default 'medium',
  hold_effect text not null default 'none',
  provider_name text,
  provider_case_id text,
  opened_reason text not null,
  assigned_queue text,
  metadata jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pay_compliance_cases_hold_effect_valid check (
    hold_effect in ('none', 'send_only', 'receive_only', 'freeze')
  )
);

create unique index if not exists pay_compliance_cases_provider_unique
  on pay_compliance_cases (provider_name, provider_case_id)
  where provider_name is not null and provider_case_id is not null;
create index if not exists pay_compliance_cases_owner_idx
  on pay_compliance_cases (owner_user_id, opened_at desc);

create table if not exists pay_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  posting_group_id uuid not null,
  transfer_id uuid not null references pay_transfers(id) on delete restrict,
  wallet_id uuid not null references pay_wallets(id) on delete restrict,
  balance_bucket pay_balance_bucket not null default 'available',
  direction pay_ledger_direction not null,
  entry_kind pay_ledger_kind not null default 'principal',
  amount_cents bigint not null,
  signed_amount_cents bigint generated always as (
    case
      when direction = 'credit' then amount_cents
      else amount_cents * -1
    end
  ) stored,
  currency text not null,
  memo text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pay_ledger_entries_amount_positive check (amount_cents > 0),
  constraint pay_ledger_entries_currency_format check (currency ~ '^[A-Z]{3}$')
);

create index if not exists pay_ledger_entries_wallet_idx
  on pay_ledger_entries (wallet_id, created_at desc);
create index if not exists pay_ledger_entries_transfer_idx
  on pay_ledger_entries (transfer_id, created_at desc);
create index if not exists pay_ledger_entries_posting_group_idx
  on pay_ledger_entries (posting_group_id);

create or replace function pay_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function pay_forbid_row_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;

create or replace function pay_apply_ledger_entry_to_balance()
returns trigger
language plpgsql
as $$
begin
  insert into pay_wallet_balances (
    wallet_id,
    currency,
    balance_bucket,
    amount_cents,
    updated_at
  )
  values (
    new.wallet_id,
    new.currency,
    new.balance_bucket,
    new.signed_amount_cents,
    now()
  )
  on conflict (wallet_id, currency, balance_bucket) do update
    set amount_cents = pay_wallet_balances.amount_cents + excluded.amount_cents,
        updated_at = now();

  return new;
end;
$$;

create trigger pay_wallets_set_updated_at
  before update on pay_wallets
  for each row execute function pay_set_updated_at();

create trigger pay_identities_set_updated_at
  before update on pay_identities
  for each row execute function pay_set_updated_at();

create trigger pay_contacts_set_updated_at
  before update on pay_contacts
  for each row execute function pay_set_updated_at();

create trigger pay_linked_accounts_set_updated_at
  before update on pay_linked_accounts
  for each row execute function pay_set_updated_at();

create trigger pay_payment_requests_set_updated_at
  before update on pay_payment_requests
  for each row execute function pay_set_updated_at();

create trigger pay_transfers_set_updated_at
  before update on pay_transfers
  for each row execute function pay_set_updated_at();

create trigger pay_funding_intents_set_updated_at
  before update on pay_funding_intents
  for each row execute function pay_set_updated_at();

create trigger pay_payout_intents_set_updated_at
  before update on pay_payout_intents
  for each row execute function pay_set_updated_at();

create trigger pay_cards_set_updated_at
  before update on pay_cards
  for each row execute function pay_set_updated_at();

create trigger pay_disputes_set_updated_at
  before update on pay_disputes
  for each row execute function pay_set_updated_at();

create trigger pay_remittances_set_updated_at
  before update on pay_remittances
  for each row execute function pay_set_updated_at();

create trigger pay_compliance_cases_set_updated_at
  before update on pay_compliance_cases
  for each row execute function pay_set_updated_at();

create trigger pay_ledger_entries_immutable
  before update or delete on pay_ledger_entries
  for each row execute function pay_forbid_row_mutation();

create trigger pay_transfer_events_immutable
  before update or delete on pay_transfer_events
  for each row execute function pay_forbid_row_mutation();

create trigger pay_apply_ledger_entry_to_balance_trigger
  after insert on pay_ledger_entries
  for each row execute function pay_apply_ledger_entry_to_balance();

create or replace function pay_is_privileged_actor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.role() = 'service_role', false)
    or current_user in ('postgres', 'supabase_admin');
$$;

create or replace function pay_wallet_owned_by_auth(target_wallet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pay_wallets
    where id = target_wallet_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function pay_transfer_visible_to_auth(target_transfer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pay_transfers transfer_row
    left join pay_wallets source_wallet on source_wallet.id = transfer_row.source_wallet_id
    left join pay_wallets destination_wallet on destination_wallet.id = transfer_row.destination_wallet_id
    where transfer_row.id = target_transfer_id
      and (
        source_wallet.owner_user_id = auth.uid()
        or destination_wallet.owner_user_id = auth.uid()
        or transfer_row.initiator_user_id = auth.uid()
        or transfer_row.counterparty_user_id = auth.uid()
      )
  );
$$;

create or replace function pay_card_owned_by_auth(target_card_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pay_cards
    where id = target_card_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function pay_remittance_visible_to_auth(target_remittance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pay_remittances
    where id = target_remittance_id
      and owner_user_id = auth.uid()
  );
$$;

create or replace function pay_create_wallet(
  p_owner_user_id uuid,
  p_wallet_type pay_wallet_type default 'consumer',
  p_default_currency text default 'USD',
  p_country_code text default 'US',
  p_display_name text default null,
  p_handle text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet_row pay_wallets%rowtype;
begin
  if not pay_is_privileged_actor() then
    raise exception 'Not authorized to create wallets';
  end if;

  if p_owner_user_id is null then
    raise exception 'owner_user_id is required';
  end if;

  if p_default_currency is null or p_default_currency !~ '^[A-Z]{3}$' then
    raise exception 'default_currency must be a 3-letter ISO code';
  end if;

  if p_country_code is null or p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'country_code must be a 2-letter ISO code';
  end if;

  insert into pay_wallets (
    owner_user_id,
    wallet_type,
    status,
    handle,
    display_name,
    default_currency,
    country_code,
    metadata
  )
  values (
    p_owner_user_id,
    p_wallet_type,
    'active',
    p_handle,
    p_display_name,
    p_default_currency,
    p_country_code,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (owner_user_id, wallet_type, default_currency) do update
    set handle = coalesce(excluded.handle, pay_wallets.handle),
        display_name = coalesce(excluded.display_name, pay_wallets.display_name),
        country_code = excluded.country_code,
        metadata = pay_wallets.metadata || excluded.metadata,
        updated_at = now()
  returning * into wallet_row;

  insert into pay_wallet_balances (wallet_id, currency, balance_bucket, amount_cents, updated_at)
  values
    (wallet_row.id, wallet_row.default_currency, 'available', 0, now()),
    (wallet_row.id, wallet_row.default_currency, 'pending', 0, now()),
    (wallet_row.id, wallet_row.default_currency, 'reserved', 0, now()),
    (wallet_row.id, wallet_row.default_currency, 'escrow', 0, now())
  on conflict (wallet_id, currency, balance_bucket) do nothing;

  return jsonb_build_object(
    'walletId', wallet_row.id,
    'ownerUserId', wallet_row.owner_user_id,
    'walletType', wallet_row.wallet_type,
    'status', wallet_row.status,
    'currency', wallet_row.default_currency
  );
end;
$$;

create or replace function pay_post_transfer(
  p_idempotency_key text,
  p_kind pay_transfer_kind,
  p_status pay_transfer_status default 'completed',
  p_source_wallet_id uuid default null,
  p_destination_wallet_id uuid default null,
  p_source_amount_cents bigint default null,
  p_source_currency text default 'USD',
  p_destination_amount_cents bigint default null,
  p_destination_currency text default null,
  p_source_balance_bucket pay_balance_bucket default 'available',
  p_destination_balance_bucket pay_balance_bucket default 'available',
  p_fee_amount_cents bigint default 0,
  p_fee_wallet_id uuid default null,
  p_initiator_user_id uuid default null,
  p_counterparty_user_id uuid default null,
  p_source_rail pay_rail default 'wallet',
  p_destination_rail pay_rail default 'wallet',
  p_payment_request_id uuid default null,
  p_quote_id uuid default null,
  p_provider_name text default null,
  p_provider_transfer_id text default null,
  p_external_reference text default null,
  p_description text default null,
  p_hold_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer_row pay_transfers%rowtype;
  source_wallet_row pay_wallets%rowtype;
  destination_wallet_row pay_wallets%rowtype;
  fee_wallet_row pay_wallets%rowtype;
  source_balance bigint := 0;
  resolved_destination_amount bigint;
  resolved_destination_currency text;
  posting_group uuid := gen_random_uuid();
begin
  if not pay_is_privileged_actor() then
    raise exception 'Not authorized to post transfers';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key is required';
  end if;

  if p_source_wallet_id is null and p_destination_wallet_id is null then
    raise exception 'A source or destination wallet is required';
  end if;

  if p_source_amount_cents is null or p_source_amount_cents <= 0 then
    raise exception 'source_amount_cents must be positive';
  end if;

  if p_source_currency is null or p_source_currency !~ '^[A-Z]{3}$' then
    raise exception 'source_currency must be a 3-letter ISO code';
  end if;

  if p_fee_amount_cents < 0 then
    raise exception 'fee_amount_cents cannot be negative';
  end if;

  if p_status not in ('pending_review', 'pending_provider', 'processing', 'completed') then
    raise exception 'pay_post_transfer only accepts postable statuses';
  end if;

  resolved_destination_amount := coalesce(p_destination_amount_cents, p_source_amount_cents);
  resolved_destination_currency := coalesce(p_destination_currency, p_source_currency);

  if resolved_destination_amount <= 0 then
    raise exception 'destination_amount_cents must be positive';
  end if;

  if resolved_destination_currency !~ '^[A-Z]{3}$' then
    raise exception 'destination_currency must be a 3-letter ISO code';
  end if;

  if p_source_wallet_id is not null then
    select *
    into source_wallet_row
    from pay_wallets
    where id = p_source_wallet_id
    for update;

    if not found then
      raise exception 'Source wallet not found';
    end if;

    if source_wallet_row.status not in ('active', 'restricted') then
      raise exception 'Source wallet is unavailable';
    end if;

    select amount_cents
    into source_balance
    from pay_wallet_balances
    where wallet_id = p_source_wallet_id
      and currency = p_source_currency
      and balance_bucket = p_source_balance_bucket
    for update;

    source_balance := coalesce(source_balance, 0);

    if source_balance < p_source_amount_cents + p_fee_amount_cents then
      raise exception 'Insufficient funds';
    end if;
  end if;

  if p_destination_wallet_id is not null then
    select *
    into destination_wallet_row
    from pay_wallets
    where id = p_destination_wallet_id
    for update;

    if not found then
      raise exception 'Destination wallet not found';
    end if;

    if destination_wallet_row.status in ('frozen', 'closed') then
      raise exception 'Destination wallet is unavailable';
    end if;
  end if;

  if p_fee_amount_cents > 0 and p_fee_wallet_id is null then
    raise exception 'fee_wallet_id is required when fee_amount_cents is positive';
  end if;

  if p_fee_wallet_id is not null then
    select *
    into fee_wallet_row
    from pay_wallets
    where id = p_fee_wallet_id
    for update;

    if not found then
      raise exception 'Fee wallet not found';
    end if;
  end if;

  insert into pay_transfers (
    idempotency_key,
    kind,
    status,
    source_wallet_id,
    destination_wallet_id,
    payment_request_id,
    quote_id,
    source_rail,
    destination_rail,
    source_amount_cents,
    source_currency,
    destination_amount_cents,
    destination_currency,
    fee_amount_cents,
    initiator_user_id,
    counterparty_user_id,
    provider_name,
    provider_transfer_id,
    external_reference,
    description,
    hold_expires_at,
    metadata,
    completed_at
  )
  values (
    p_idempotency_key,
    p_kind,
    p_status,
    p_source_wallet_id,
    p_destination_wallet_id,
    p_payment_request_id,
    p_quote_id,
    p_source_rail,
    p_destination_rail,
    p_source_amount_cents,
    p_source_currency,
    resolved_destination_amount,
    resolved_destination_currency,
    p_fee_amount_cents,
    p_initiator_user_id,
    p_counterparty_user_id,
    p_provider_name,
    p_provider_transfer_id,
    p_external_reference,
    p_description,
    p_hold_expires_at,
    coalesce(p_metadata, '{}'::jsonb),
    case when p_status = 'completed' then now() else null end
  )
  on conflict (idempotency_key) do nothing
  returning * into transfer_row;

  if transfer_row.id is null then
    select *
    into transfer_row
    from pay_transfers
    where idempotency_key = p_idempotency_key;

    return jsonb_build_object(
      'transferId', transfer_row.id,
      'status', transfer_row.status,
      'idempotentReplay', true
    );
  end if;

  if p_source_wallet_id is not null then
    insert into pay_ledger_entries (
      posting_group_id,
      transfer_id,
      wallet_id,
      balance_bucket,
      direction,
      entry_kind,
      amount_cents,
      currency,
      memo,
      external_reference,
      metadata
    )
    values (
      posting_group,
      transfer_row.id,
      p_source_wallet_id,
      p_source_balance_bucket,
      'debit',
      'principal',
      p_source_amount_cents,
      p_source_currency,
      p_description,
      p_external_reference,
      jsonb_build_object('idempotencyKey', p_idempotency_key)
    );
  end if;

  if p_destination_wallet_id is not null then
    insert into pay_ledger_entries (
      posting_group_id,
      transfer_id,
      wallet_id,
      balance_bucket,
      direction,
      entry_kind,
      amount_cents,
      currency,
      memo,
      external_reference,
      metadata
    )
    values (
      posting_group,
      transfer_row.id,
      p_destination_wallet_id,
      p_destination_balance_bucket,
      'credit',
      'principal',
      resolved_destination_amount,
      resolved_destination_currency,
      p_description,
      p_external_reference,
      jsonb_build_object('idempotencyKey', p_idempotency_key)
    );
  end if;

  if p_fee_amount_cents > 0 then
    insert into pay_ledger_entries (
      posting_group_id,
      transfer_id,
      wallet_id,
      balance_bucket,
      direction,
      entry_kind,
      amount_cents,
      currency,
      memo,
      external_reference,
      metadata
    )
    values (
      posting_group,
      transfer_row.id,
      p_source_wallet_id,
      p_source_balance_bucket,
      'debit',
      'fee',
      p_fee_amount_cents,
      p_source_currency,
      coalesce(p_description, 'Fee'),
      p_external_reference,
      jsonb_build_object('idempotencyKey', p_idempotency_key)
    );

    insert into pay_ledger_entries (
      posting_group_id,
      transfer_id,
      wallet_id,
      balance_bucket,
      direction,
      entry_kind,
      amount_cents,
      currency,
      memo,
      external_reference,
      metadata
    )
    values (
      posting_group,
      transfer_row.id,
      p_fee_wallet_id,
      'available',
      'credit',
      'fee',
      p_fee_amount_cents,
      p_source_currency,
      coalesce(p_description, 'Fee revenue'),
      p_external_reference,
      jsonb_build_object('idempotencyKey', p_idempotency_key)
    );
  end if;

  insert into pay_transfer_events (
    transfer_id,
    event_type,
    to_status,
    actor_type,
    actor_user_id,
    note,
    metadata
  )
  values (
    transfer_row.id,
    'posted',
    p_status,
    'system',
    p_initiator_user_id,
    p_description,
    jsonb_build_object('postingGroupId', posting_group)
  );

  return jsonb_build_object(
    'transferId', transfer_row.id,
    'status', transfer_row.status,
    'postingGroupId', posting_group,
    'idempotentReplay', false
  );
end;
$$;

create or replace function pay_reverse_transfer(
  p_transfer_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_operator_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  original_transfer pay_transfers%rowtype;
  reversal_transfer pay_transfers%rowtype;
  posting_group uuid := gen_random_uuid();
begin
  if not pay_is_privileged_actor() then
    raise exception 'Not authorized to reverse transfers';
  end if;

  if p_transfer_id is null then
    raise exception 'transfer_id is required';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency_key is required';
  end if;

  select *
  into original_transfer
  from pay_transfers
  where id = p_transfer_id
  for update;

  if not found then
    raise exception 'Transfer not found';
  end if;

  if original_transfer.kind = 'reversal' then
    raise exception 'A reversal cannot be reversed with pay_reverse_transfer';
  end if;

  select *
  into reversal_transfer
  from pay_transfers
  where reversal_of_transfer_id = p_transfer_id
     or idempotency_key = p_idempotency_key
  limit 1;

  if reversal_transfer.id is not null then
    return jsonb_build_object(
      'transferId', reversal_transfer.id,
      'status', reversal_transfer.status,
      'idempotentReplay', true
    );
  end if;

  if original_transfer.status in ('failed', 'canceled', 'reversed') then
    raise exception 'Transfer cannot be reversed from status %', original_transfer.status;
  end if;

  insert into pay_transfers (
    idempotency_key,
    kind,
    status,
    source_wallet_id,
    destination_wallet_id,
    reversal_of_transfer_id,
    source_rail,
    destination_rail,
    source_amount_cents,
    source_currency,
    destination_amount_cents,
    destination_currency,
    fee_amount_cents,
    initiator_user_id,
    counterparty_user_id,
    provider_name,
    external_reference,
    description,
    metadata,
    completed_at
  )
  values (
    p_idempotency_key,
    'reversal',
    'completed',
    original_transfer.destination_wallet_id,
    original_transfer.source_wallet_id,
    original_transfer.id,
    original_transfer.destination_rail,
    original_transfer.source_rail,
    coalesce(original_transfer.destination_amount_cents, original_transfer.source_amount_cents),
    coalesce(original_transfer.destination_currency, original_transfer.source_currency),
    original_transfer.source_amount_cents,
    original_transfer.source_currency,
    0,
    p_operator_user_id,
    original_transfer.initiator_user_id,
    original_transfer.provider_name,
    coalesce(original_transfer.external_reference, original_transfer.id::text),
    coalesce(p_reason, 'Transfer reversal'),
    coalesce(original_transfer.metadata, '{}'::jsonb)
      || coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object('reversalOfTransferId', original_transfer.id),
    now()
  )
  returning * into reversal_transfer;

  insert into pay_ledger_entries (
    posting_group_id,
    transfer_id,
    wallet_id,
    balance_bucket,
    direction,
    entry_kind,
    amount_cents,
    currency,
    memo,
    external_reference,
    metadata
  )
  select
    posting_group,
    reversal_transfer.id,
    ledger_entry.wallet_id,
    ledger_entry.balance_bucket,
    case
      when ledger_entry.direction = 'credit' then 'debit'::pay_ledger_direction
      else 'credit'::pay_ledger_direction
    end,
    'reversal'::pay_ledger_kind,
    ledger_entry.amount_cents,
    ledger_entry.currency,
    coalesce(p_reason, 'Transfer reversal'),
    original_transfer.id::text,
    ledger_entry.metadata || jsonb_build_object('reversedEntryId', ledger_entry.id)
  from pay_ledger_entries ledger_entry
  where ledger_entry.transfer_id = original_transfer.id;

  update pay_transfers
  set status = 'reversed',
      reversed_at = now(),
      updated_at = now()
  where id = original_transfer.id;

  insert into pay_transfer_events (
    transfer_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_user_id,
    note,
    metadata
  )
  values
    (
      original_transfer.id,
      'reversed',
      original_transfer.status,
      'reversed',
      'operator',
      p_operator_user_id,
      p_reason,
      jsonb_build_object('reversalTransferId', reversal_transfer.id)
    ),
    (
      reversal_transfer.id,
      'posted',
      null,
      'completed',
      'operator',
      p_operator_user_id,
      p_reason,
      jsonb_build_object('postingGroupId', posting_group)
    );

  return jsonb_build_object(
    'transferId', reversal_transfer.id,
    'reversalOfTransferId', original_transfer.id,
    'status', reversal_transfer.status,
    'postingGroupId', posting_group,
    'idempotentReplay', false
  );
end;
$$;

create or replace function pay_record_provider_event(
  p_provider_name text,
  p_provider_event_id text,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb,
  p_object_type text default null,
  p_object_reference text default null,
  p_owner_user_id uuid default null,
  p_wallet_id uuid default null,
  p_transfer_id uuid default null,
  p_remittance_id uuid default null,
  p_occurred_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_event_row pay_provider_events%rowtype;
  deduped boolean := false;
begin
  if not pay_is_privileged_actor() then
    raise exception 'Not authorized to record provider events';
  end if;

  if p_provider_name is null or btrim(p_provider_name) = '' then
    raise exception 'provider_name is required';
  end if;

  if p_provider_event_id is null or btrim(p_provider_event_id) = '' then
    raise exception 'provider_event_id is required';
  end if;

  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'event_type is required';
  end if;

  insert into pay_provider_events (
    owner_user_id,
    wallet_id,
    transfer_id,
    remittance_id,
    provider_name,
    provider_event_id,
    event_type,
    object_type,
    object_reference,
    payload,
    metadata,
    occurred_at
  )
  values (
    p_owner_user_id,
    p_wallet_id,
    p_transfer_id,
    p_remittance_id,
    p_provider_name,
    p_provider_event_id,
    p_event_type,
    p_object_type,
    p_object_reference,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    p_occurred_at
  )
  on conflict (provider_name, provider_event_id) do nothing
  returning * into provider_event_row;

  if provider_event_row.id is null then
    deduped := true;

    select *
    into provider_event_row
    from pay_provider_events
    where provider_name = p_provider_name
      and provider_event_id = p_provider_event_id;
  end if;

  return jsonb_build_object(
    'providerEventRowId', provider_event_row.id,
    'status', provider_event_row.status,
    'deduped', deduped
  );
end;
$$;

alter table pay_wallets enable row level security;
alter table pay_wallet_balances enable row level security;
alter table pay_identities enable row level security;
alter table pay_contacts enable row level security;
alter table pay_linked_accounts enable row level security;
alter table pay_payment_requests enable row level security;
alter table pay_remittance_quotes enable row level security;
alter table pay_transfers enable row level security;
alter table pay_transfer_events enable row level security;
alter table pay_funding_intents enable row level security;
alter table pay_payout_intents enable row level security;
alter table pay_cards enable row level security;
alter table pay_card_transactions enable row level security;
alter table pay_disputes enable row level security;
alter table pay_remittances enable row level security;
alter table pay_provider_events enable row level security;
alter table pay_compliance_cases enable row level security;
alter table pay_ledger_entries enable row level security;

create policy "pay_wallets_owner_read" on pay_wallets
  for select using (owner_user_id = auth.uid());

create policy "pay_wallet_balances_owner_read" on pay_wallet_balances
  for select using (pay_wallet_owned_by_auth(wallet_id));

create policy "pay_identities_owner_read" on pay_identities
  for select using (owner_user_id = auth.uid());

create policy "pay_contacts_owner_read" on pay_contacts
  for select using (owner_user_id = auth.uid());

create policy "pay_linked_accounts_owner_read" on pay_linked_accounts
  for select using (owner_user_id = auth.uid());

create policy "pay_payment_requests_participant_read" on pay_payment_requests
  for select using (
    requester_user_id = auth.uid()
    or payer_user_id = auth.uid()
    or pay_wallet_owned_by_auth(requester_wallet_id)
    or (payer_wallet_id is not null and pay_wallet_owned_by_auth(payer_wallet_id))
  );

create policy "pay_remittance_quotes_owner_read" on pay_remittance_quotes
  for select using (
    requester_user_id = auth.uid()
    or (source_wallet_id is not null and pay_wallet_owned_by_auth(source_wallet_id))
  );

create policy "pay_transfers_participant_read" on pay_transfers
  for select using (pay_transfer_visible_to_auth(id));

create policy "pay_transfer_events_participant_read" on pay_transfer_events
  for select using (pay_transfer_visible_to_auth(transfer_id));

create policy "pay_funding_intents_owner_read" on pay_funding_intents
  for select using (pay_wallet_owned_by_auth(wallet_id));

create policy "pay_payout_intents_owner_read" on pay_payout_intents
  for select using (pay_wallet_owned_by_auth(wallet_id));

create policy "pay_cards_owner_read" on pay_cards
  for select using (owner_user_id = auth.uid() or pay_wallet_owned_by_auth(wallet_id));

create policy "pay_card_transactions_owner_read" on pay_card_transactions
  for select using (pay_card_owned_by_auth(card_id) or pay_wallet_owned_by_auth(wallet_id));

create policy "pay_disputes_owner_read" on pay_disputes
  for select using (owner_user_id = auth.uid() or pay_wallet_owned_by_auth(wallet_id));

create policy "pay_remittances_owner_read" on pay_remittances
  for select using (pay_remittance_visible_to_auth(id));

create policy "pay_provider_events_owner_read" on pay_provider_events
  for select using (
    owner_user_id = auth.uid()
    or (wallet_id is not null and pay_wallet_owned_by_auth(wallet_id))
    or (transfer_id is not null and pay_transfer_visible_to_auth(transfer_id))
    or (remittance_id is not null and pay_remittance_visible_to_auth(remittance_id))
  );

create policy "pay_compliance_cases_owner_read" on pay_compliance_cases
  for select using (
    owner_user_id = auth.uid()
    or (wallet_id is not null and pay_wallet_owned_by_auth(wallet_id))
    or (transfer_id is not null and pay_transfer_visible_to_auth(transfer_id))
    or (remittance_id is not null and pay_remittance_visible_to_auth(remittance_id))
  );

create policy "pay_ledger_entries_owner_read" on pay_ledger_entries
  for select using (pay_wallet_owned_by_auth(wallet_id));
