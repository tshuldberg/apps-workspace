-- MyMarket Supabase Schema
-- All tables prefixed mk_ with Row-Level Security enabled.
-- Browse without auth (anon reads), write requires auth.

-- ── Enums ────────────────────────────────────────────────────────────

create type mk_listing_status as enum ('draft', 'active', 'pending', 'sold', 'expired', 'removed');
create type mk_pricing_type as enum ('fixed', 'negotiable', 'free', 'trade');
create type mk_condition as enum ('new', 'like_new', 'good', 'fair', 'poor');
create type mk_listing_type as enum ('sell', 'trade', 'free', 'wanted', 'service_offer', 'service_request');
create type mk_report_reason as enum ('spam', 'prohibited_item', 'fraud', 'offensive', 'duplicate', 'other');

do $$
begin
  alter type mk_listing_type add value if not exists 'service_offer';
  alter type mk_listing_type add value if not exists 'service_request';
exception
  when duplicate_object then null;
end;
$$;

-- ── Categories ───────────────────────────────────────────────────────

create table if not exists mk_categories (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references mk_categories(id) on delete cascade,
  name        text not null,
  slug        text not null,
  icon        text,
  sort_order  integer not null default 0,
  constraint mk_categories_name_length check (char_length(name) between 1 and 60),
  constraint mk_categories_slug_unique unique (slug),
  constraint mk_categories_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create index mk_categories_parent_idx on mk_categories (parent_id);
create index mk_categories_slug_idx on mk_categories (slug);

alter table mk_categories enable row level security;

-- Anyone can browse categories
create policy "mk_categories_anon_read" on mk_categories for select using (true);

-- Only service role can manage categories
create policy "mk_categories_admin_write" on mk_categories for all
  using (auth.role() = 'service_role');

-- ── Listings ─────────────────────────────────────────────────────────

create table if not exists mk_listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references auth.users(id) on delete cascade,
  category_id   uuid not null references mk_categories(id),
  title         text not null,
  description   text not null,
  price_cents   integer,
  currency      text not null default 'USD',
  pricing_type  mk_pricing_type not null default 'fixed',
  condition     mk_condition,
  listing_type  mk_listing_type not null default 'sell',
  status        mk_listing_status not null default 'draft',
  location_name text,
  location      geography(point, 4326),
  fulfillment_type text,
  service_radius_miles integer,
  availability_notes text,
  trade_for     text,
  view_count    integer not null default 0,
  watch_count   integer not null default 0,
  message_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz,
  constraint mk_listings_title_length check (char_length(title) between 3 and 120),
  constraint mk_listings_description_length check (char_length(description) between 10 and 5000),
  constraint mk_listings_price_nonneg check (price_cents is null or price_cents >= 0),
  constraint mk_listings_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint mk_listings_goods_condition_required check (
    listing_type in ('service_offer', 'service_request') or condition is not null
  ),
  constraint mk_listings_service_radius_nonneg check (
    service_radius_miles is null or service_radius_miles > 0
  ),
  constraint mk_listings_availability_notes_length check (
    availability_notes is null or char_length(availability_notes) <= 500
  ),
  constraint mk_listings_trade_for_length check (trade_for is null or char_length(trade_for) <= 500)
);

alter table if exists mk_listings alter column condition drop not null;
alter table if exists mk_listings add column if not exists fulfillment_type text;
alter table if exists mk_listings add column if not exists service_radius_miles integer;
alter table if exists mk_listings add column if not exists availability_notes text;

-- Full-text search
alter table mk_listings add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) stored;

create index mk_listings_search_idx on mk_listings using gin (search_vector);
create index mk_listings_seller_idx on mk_listings (seller_id);
create index mk_listings_category_idx on mk_listings (category_id);
create index mk_listings_status_idx on mk_listings (status);
create index mk_listings_created_idx on mk_listings (created_at desc);
create index mk_listings_price_idx on mk_listings (price_cents);
create index mk_listings_location_idx on mk_listings using gist (location);

alter table mk_listings enable row level security;

-- Anyone can browse active listings
create policy "mk_listings_anon_read" on mk_listings for select
  using (status = 'active');

-- Sellers can see all their own listings (any status)
create policy "mk_listings_owner_read" on mk_listings for select
  using (auth.uid() = seller_id);

-- Authenticated users can create listings
create policy "mk_listings_auth_insert" on mk_listings for insert
  with check (auth.uid() = seller_id);

-- Sellers can update/delete their own listings
create policy "mk_listings_owner_update" on mk_listings for update
  using (auth.uid() = seller_id);

create policy "mk_listings_owner_delete" on mk_listings for delete
  using (auth.uid() = seller_id);

-- ── Listing Photos ───────────────────────────────────────────────────

create table if not exists mk_listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references mk_listings(id) on delete cascade,
  url         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index mk_listing_photos_listing_idx on mk_listing_photos (listing_id);

alter table mk_listing_photos enable row level security;

create policy "mk_listing_photos_anon_read" on mk_listing_photos for select using (true);

create policy "mk_listing_photos_owner_write" on mk_listing_photos for all
  using (
    exists (select 1 from mk_listings where id = listing_id and seller_id = auth.uid())
  );

-- ── Conversations ────────────────────────────────────────────────────

create table if not exists mk_conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references mk_listings(id) on delete cascade,
  buyer_id        uuid not null references auth.users(id),
  seller_id       uuid not null references auth.users(id),
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  constraint mk_conversations_no_self check (buyer_id != seller_id),
  constraint mk_conversations_unique unique (listing_id, buyer_id)
);

create index mk_conversations_buyer_idx on mk_conversations (buyer_id);
create index mk_conversations_seller_idx on mk_conversations (seller_id);
create index mk_conversations_listing_idx on mk_conversations (listing_id);

alter table mk_conversations enable row level security;

create policy "mk_conversations_participant_read" on mk_conversations for select
  using (auth.uid() in (buyer_id, seller_id));

create policy "mk_conversations_buyer_insert" on mk_conversations for insert
  with check (auth.uid() = buyer_id);

-- ── Messages ─────────────────────────────────────────────────────────

create table if not exists mk_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references mk_conversations(id) on delete cascade,
  sender_id       uuid not null references auth.users(id),
  body            text,
  content_type    text not null default 'text/plain',
  ciphertext      text,
  encryption_algorithm text,
  encryption_salt text,
  encryption_iv   text,
  created_at      timestamptz not null default now(),
  constraint mk_messages_content_type check (
    content_type in ('text/plain', 'application/e2ee+ciphertext')
  ),
  constraint mk_messages_body_length check (
    body is null or char_length(body) between 1 and 2000
  ),
  constraint mk_messages_plaintext_shape check (
    content_type != 'text/plain'
    or (
      body is not null
      and ciphertext is null
      and encryption_algorithm is null
      and encryption_salt is null
      and encryption_iv is null
    )
  ),
  constraint mk_messages_encrypted_shape check (
    content_type != 'application/e2ee+ciphertext'
    or (
      body is null
      and ciphertext is not null
      and encryption_algorithm = 'aes-256-gcm'
      and encryption_salt is not null
      and encryption_iv is not null
    )
  )
);

alter table if exists mk_messages alter column body drop not null;
alter table if exists mk_messages add column if not exists content_type text not null default 'text/plain';
alter table if exists mk_messages add column if not exists ciphertext text;
alter table if exists mk_messages add column if not exists encryption_algorithm text;
alter table if exists mk_messages add column if not exists encryption_salt text;
alter table if exists mk_messages add column if not exists encryption_iv text;

create index mk_messages_conversation_idx on mk_messages (conversation_id, created_at);

alter table mk_messages enable row level security;

create policy "mk_messages_participant_read" on mk_messages for select
  using (
    exists (
      select 1 from mk_conversations
      where id = conversation_id and auth.uid() in (buyer_id, seller_id)
    )
  );

create policy "mk_messages_sender_insert" on mk_messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from mk_conversations
      where id = conversation_id and auth.uid() in (buyer_id, seller_id)
    )
  );

-- ── Signal-Style Message Requests ───────────────────────────────────

create table if not exists mk_message_requests (
  id             uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references mk_conversations(id) on delete cascade,
  listing_id     uuid not null references mk_listings(id) on delete cascade,
  requester_id   uuid not null references auth.users(id) on delete cascade,
  responder_id   uuid not null references auth.users(id) on delete cascade,
  friend_link_id uuid,
  status         text not null default 'pending',
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  constraint mk_message_requests_unique unique (conversation_id),
  constraint mk_message_requests_no_self check (requester_id != responder_id),
  constraint mk_message_requests_status_valid check (
    status in ('pending', 'accepted', 'rejected', 'blocked', 'expired')
  )
);

create index mk_message_requests_requester_idx on mk_message_requests (requester_id, created_at desc);
create index mk_message_requests_responder_idx on mk_message_requests (responder_id, created_at desc);
create index mk_message_requests_listing_idx on mk_message_requests (listing_id);

alter table mk_message_requests enable row level security;

create policy "mk_message_requests_participant_read" on mk_message_requests for select
  using (auth.uid() in (requester_id, responder_id));

create policy "mk_message_requests_requester_insert" on mk_message_requests for insert
  with check (
    auth.uid() = requester_id
    and exists (
      select 1
      from mk_conversations
      where id = conversation_id
        and listing_id = mk_message_requests.listing_id
        and buyer_id = requester_id
        and seller_id = responder_id
    )
  );

create policy "mk_message_requests_responder_update" on mk_message_requests for update
  using (auth.uid() = responder_id);

create or replace function mk_set_message_request_response_timestamp()
returns trigger as $$
begin
  if new.status = 'pending' then
    new.responded_at = null;
  elsif tg_op = 'INSERT' then
    new.responded_at = coalesce(new.responded_at, now());
  elsif new.status is distinct from old.status then
    new.responded_at = coalesce(new.responded_at, now());
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists mk_message_requests_response_timestamp on mk_message_requests;
create trigger mk_message_requests_response_timestamp
  before insert or update on mk_message_requests
  for each row execute function mk_set_message_request_response_timestamp();

-- ── Signal-Style Device Bundles ─────────────────────────────────────

create table if not exists mk_secure_devices (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  platform               text not null,
  label                  text,
  identity_key           text not null,
  registration_id        integer not null,
  supports_sealed_sender boolean not null default true,
  supports_post_quantum  boolean not null default true,
  created_at             timestamptz not null default now(),
  last_seen_at           timestamptz not null default now(),
  constraint mk_secure_devices_platform_valid check (
    platform in ('ios', 'android', 'web', 'desktop')
  ),
  constraint mk_secure_devices_label_length check (
    label is null or char_length(label) <= 80
  ),
  constraint mk_secure_devices_registration_positive check (registration_id > 0),
  constraint mk_secure_devices_user_registration_unique unique (user_id, registration_id)
);

create index mk_secure_devices_user_idx on mk_secure_devices (user_id, created_at desc);

alter table mk_secure_devices enable row level security;

create policy "mk_secure_devices_owner_all" on mk_secure_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists mk_signed_prekeys (
  id         uuid primary key default gen_random_uuid(),
  device_id   uuid not null references mk_secure_devices(id) on delete cascade,
  key_id      integer not null,
  algorithm   text not null default 'curve25519',
  public_key  text not null,
  signature   text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  constraint mk_signed_prekeys_key_id_nonnegative check (key_id >= 0),
  constraint mk_signed_prekeys_algorithm_valid check (algorithm in ('curve25519')),
  constraint mk_signed_prekeys_device_key_unique unique (device_id, key_id)
);

create index mk_signed_prekeys_device_idx on mk_signed_prekeys (device_id, created_at desc);

alter table mk_signed_prekeys enable row level security;

create policy "mk_signed_prekeys_owner_all" on mk_signed_prekeys for all
  using (
    exists (
      select 1 from mk_secure_devices
      where id = device_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mk_secure_devices
      where id = device_id and user_id = auth.uid()
    )
  );

create table if not exists mk_one_time_prekeys (
  id          uuid primary key default gen_random_uuid(),
  device_id    uuid not null references mk_secure_devices(id) on delete cascade,
  key_id       integer not null,
  kind         text not null,
  public_key   text not null,
  is_consumed  boolean not null default false,
  created_at   timestamptz not null default now(),
  consumed_at  timestamptz,
  constraint mk_one_time_prekeys_key_id_nonnegative check (key_id >= 0),
  constraint mk_one_time_prekeys_kind_valid check (
    kind in ('curve25519', 'kyber1024', 'kyber1024_last_resort')
  ),
  constraint mk_one_time_prekeys_device_key_unique unique (device_id, key_id, kind)
);

create index mk_one_time_prekeys_device_idx on mk_one_time_prekeys (device_id, created_at);
create index mk_one_time_prekeys_available_idx on mk_one_time_prekeys (device_id, kind, is_consumed);

alter table mk_one_time_prekeys enable row level security;

create policy "mk_one_time_prekeys_owner_all" on mk_one_time_prekeys for all
  using (
    exists (
      select 1 from mk_secure_devices
      where id = device_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from mk_secure_devices
      where id = device_id and user_id = auth.uid()
    )
  );

create or replace function mk_claim_recipient_prekey_bundles(recipient_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  device_row mk_secure_devices%rowtype;
  signed_prekey_row mk_signed_prekeys%rowtype;
  curve_prekey_row mk_one_time_prekeys%rowtype;
  pq_prekey_row mk_one_time_prekeys%rowtype;
  pq_last_resort_row mk_one_time_prekeys%rowtype;
  claimed_at timestamptz;
  bundles jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1
    from mk_blocks
    where (blocker_id = recipient_user_id and blocked_id = auth.uid())
       or (blocker_id = auth.uid() and blocked_id = recipient_user_id)
  ) then
    return bundles;
  end if;

  for device_row in
    select *
    from mk_secure_devices
    where user_id = recipient_user_id
    order by created_at asc
  loop
    select *
    into signed_prekey_row
    from mk_signed_prekeys
    where device_id = device_row.id
    order by created_at desc
    limit 1;

    if signed_prekey_row.id is null then
      continue;
    end if;

    claimed_at := now();

    select *
    into curve_prekey_row
    from mk_one_time_prekeys
    where device_id = device_row.id
      and kind = 'curve25519'
      and is_consumed = false
    order by created_at asc
    limit 1
    for update skip locked;

    if curve_prekey_row.id is not null then
      update mk_one_time_prekeys
      set is_consumed = true,
          consumed_at = claimed_at
      where id = curve_prekey_row.id;

      curve_prekey_row.is_consumed := true;
      curve_prekey_row.consumed_at := claimed_at;
    end if;

    select *
    into pq_prekey_row
    from mk_one_time_prekeys
    where device_id = device_row.id
      and kind = 'kyber1024'
      and is_consumed = false
    order by created_at asc
    limit 1
    for update skip locked;

    if pq_prekey_row.id is not null then
      update mk_one_time_prekeys
      set is_consumed = true,
          consumed_at = claimed_at
      where id = pq_prekey_row.id;

      pq_prekey_row.is_consumed := true;
      pq_prekey_row.consumed_at := claimed_at;
    end if;

    select *
    into pq_last_resort_row
    from mk_one_time_prekeys
    where device_id = device_row.id
      and kind = 'kyber1024_last_resort'
    order by created_at desc
    limit 1;

    bundles := bundles || jsonb_build_array(
      jsonb_build_object(
        'device', to_jsonb(device_row),
        'signed_prekey', to_jsonb(signed_prekey_row),
        'curve_one_time_prekey', case
          when curve_prekey_row.id is null then null
          else to_jsonb(curve_prekey_row)
        end,
        'pq_one_time_prekey', case
          when pq_prekey_row.id is null then null
          else to_jsonb(pq_prekey_row)
        end,
        'pq_last_resort_prekey', case
          when pq_last_resort_row.id is null then null
          else to_jsonb(pq_last_resort_row)
        end
      )
    );
  end loop;

  return bundles;
end;
$$;

create table if not exists mk_secure_messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references mk_conversations(id) on delete cascade,
  request_id            uuid references mk_message_requests(id) on delete set null,
  sender_id             uuid not null references auth.users(id) on delete cascade,
  sender_device_id      uuid not null references mk_secure_devices(id) on delete cascade,
  recipient_id          uuid not null references auth.users(id) on delete cascade,
  recipient_device_id   uuid not null references mk_secure_devices(id) on delete cascade,
  envelope_type         text not null,
  protocol_version      text not null default 'signal-pqxdh-v1',
  ciphertext            text not null,
  registration_id       integer,
  message_index         integer,
  previous_chain_length integer,
  sent_at               timestamptz not null default now(),
  delivered_at          timestamptz,
  read_at               timestamptz,
  constraint mk_secure_messages_envelope_type_valid check (
    envelope_type in ('prekey_signal_message', 'signal_message', 'sealed_sender_message')
  ),
  constraint mk_secure_messages_protocol_version_length check (
    char_length(protocol_version) between 1 and 20
  ),
  constraint mk_secure_messages_ciphertext_length check (char_length(ciphertext) > 0),
  constraint mk_secure_messages_registration_positive check (
    registration_id is null or registration_id > 0
  ),
  constraint mk_secure_messages_message_index_nonnegative check (
    message_index is null or message_index >= 0
  ),
  constraint mk_secure_messages_previous_chain_nonnegative check (
    previous_chain_length is null or previous_chain_length >= 0
  ),
  constraint mk_secure_messages_no_self check (sender_id != recipient_id)
);

create index mk_secure_messages_conversation_idx on mk_secure_messages (conversation_id, sent_at);
create index mk_secure_messages_recipient_device_idx on mk_secure_messages (recipient_device_id, sent_at);

alter table mk_secure_messages enable row level security;

create policy "mk_secure_messages_participant_read" on mk_secure_messages for select
  using (
    exists (
      select 1
      from mk_conversations
      where id = conversation_id
        and auth.uid() in (buyer_id, seller_id)
    )
  );

create policy "mk_secure_messages_sender_insert" on mk_secure_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from mk_conversations
      where id = conversation_id
        and auth.uid() in (buyer_id, seller_id)
        and recipient_id in (buyer_id, seller_id)
    )
    and exists (
      select 1 from mk_secure_devices
      where id = sender_device_id and user_id = auth.uid()
    )
    and exists (
      select 1 from mk_secure_devices
      where id = recipient_device_id and user_id = recipient_id
    )
    and (
      request_id is null
      or exists (
        select 1
        from mk_message_requests
        where id = request_id and conversation_id = mk_secure_messages.conversation_id
      )
    )
  );

-- ── Watchlist ────────────────────────────────────────────────────────

create table if not exists mk_watchlist (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  listing_id  uuid not null references mk_listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint mk_watchlist_unique unique (user_id, listing_id)
);

create index mk_watchlist_user_idx on mk_watchlist (user_id);

alter table mk_watchlist enable row level security;

create policy "mk_watchlist_owner_all" on mk_watchlist for all
  using (auth.uid() = user_id);

-- ── Reviews ──────────────────────────────────────────────────────────

create table if not exists mk_reviews (
  id          uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references auth.users(id),
  seller_id   uuid not null references auth.users(id),
  listing_id  uuid not null references mk_listings(id),
  rating      smallint not null check (rating between 1 and 5),
  body        text,
  created_at  timestamptz not null default now(),
  constraint mk_reviews_no_self check (reviewer_id != seller_id),
  constraint mk_reviews_unique unique (reviewer_id, listing_id),
  constraint mk_reviews_body_length check (body is null or char_length(body) <= 1000)
);

create index mk_reviews_seller_idx on mk_reviews (seller_id);

alter table mk_reviews enable row level security;

create policy "mk_reviews_anon_read" on mk_reviews for select using (true);

create policy "mk_reviews_auth_insert" on mk_reviews for insert
  with check (auth.uid() = reviewer_id);

create policy "mk_reviews_owner_delete" on mk_reviews for delete
  using (auth.uid() = reviewer_id);

-- ── Seller Stats (materialized view) ─────────────────────────────────

create table if not exists mk_seller_stats (
  seller_id       uuid primary key references auth.users(id),
  total_listings  integer not null default 0,
  active_listings integer not null default 0,
  total_sold      integer not null default 0,
  average_rating  numeric(3,2),
  review_count    integer not null default 0,
  response_rate   numeric(5,2),
  member_since    timestamptz not null default now()
);

alter table mk_seller_stats enable row level security;

create policy "mk_seller_stats_anon_read" on mk_seller_stats for select using (true);

-- ── Saved Searches ───────────────────────────────────────────────────

create table if not exists mk_saved_searches (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  query           text not null,
  category_id     uuid references mk_categories(id),
  min_price_cents integer,
  max_price_cents integer,
  notify_on_match boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint mk_saved_searches_name_length check (char_length(name) <= 100),
  constraint mk_saved_searches_query_length check (char_length(query) <= 200)
);

alter table mk_saved_searches enable row level security;

create policy "mk_saved_searches_owner_all" on mk_saved_searches for all
  using (auth.uid() = user_id);

-- ── Reports ──────────────────────────────────────────────────────────

create table if not exists mk_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  listing_id  uuid references mk_listings(id),
  user_id     uuid references auth.users(id),
  reason      mk_report_reason not null,
  details     text,
  created_at  timestamptz not null default now(),
  constraint mk_reports_details_length check (details is null or char_length(details) <= 1000)
);

alter table mk_reports enable row level security;

create policy "mk_reports_auth_insert" on mk_reports for insert
  with check (auth.uid() = reporter_id);

-- ── Blocks ───────────────────────────────────────────────────────────

create table if not exists mk_blocks (
  id          uuid primary key default gen_random_uuid(),
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint mk_blocks_no_self check (blocker_id != blocked_id),
  constraint mk_blocks_unique unique (blocker_id, blocked_id)
);

alter table mk_blocks enable row level security;

create policy "mk_blocks_owner_all" on mk_blocks for all
  using (auth.uid() = blocker_id);

-- ── Triggers ─────────────────────────────────────────────────────────

-- Auto-update updated_at on listings
create or replace function mk_update_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger mk_listings_updated_at
  before update on mk_listings
  for each row execute function mk_update_timestamp();

-- Update watch_count on listings when watchlist changes
create or replace function mk_update_watch_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update mk_listings set watch_count = watch_count + 1 where id = new.listing_id;
  elsif tg_op = 'DELETE' then
    update mk_listings
    set watch_count = greatest(0, watch_count - 1)
    where id = old.listing_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger mk_watchlist_count
  after insert or delete on mk_watchlist
  for each row execute function mk_update_watch_count();

-- Update conversation activity and listing message counts across plaintext
-- and secure message transports.
create or replace function mk_refresh_conversation_activity()
returns trigger as $$
declare
  target_conversation_id uuid;
begin
  target_conversation_id := coalesce(new.conversation_id, old.conversation_id);

  update mk_conversations
  set last_message_at = (
    select max(activity_at)
    from (
      select created_at as activity_at
      from mk_messages
      where conversation_id = target_conversation_id
      union all
      select sent_at as activity_at
      from mk_secure_messages
      where conversation_id = target_conversation_id
    ) conversation_activity
  )
  where id = target_conversation_id;

  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists mk_messages_last_message on mk_messages;
create trigger mk_messages_last_message
  after insert or delete on mk_messages
  for each row execute function mk_refresh_conversation_activity();

drop trigger if exists mk_secure_messages_last_message on mk_secure_messages;
create trigger mk_secure_messages_last_message
  after insert or delete on mk_secure_messages
  for each row execute function mk_refresh_conversation_activity();

-- Update message_count on listings when conversations get messages
create or replace function mk_update_message_count()
returns trigger as $$
declare
  target_conversation_id uuid;
  target_listing_id uuid;
begin
  target_conversation_id := coalesce(new.conversation_id, old.conversation_id);
  select listing_id
  into target_listing_id
  from mk_conversations
  where id = target_conversation_id;

  if target_listing_id is null then
    return coalesce(new, old);
  end if;

  update mk_listings
  set message_count = (
    select
      (select count(*)
       from mk_messages m
       join mk_conversations c on c.id = m.conversation_id
       where c.listing_id = target_listing_id)
      +
      (select count(*)
       from mk_secure_messages sm
       join mk_conversations c on c.id = sm.conversation_id
       where c.listing_id = target_listing_id)
  )
  where id = target_listing_id;

  return coalesce(new, old);
end;
$$ language plpgsql;

drop trigger if exists mk_messages_listing_count on mk_messages;
create trigger mk_messages_listing_count
  after insert or delete on mk_messages
  for each row execute function mk_update_message_count();

drop trigger if exists mk_secure_messages_listing_count on mk_secure_messages;
create trigger mk_secure_messages_listing_count
  after insert or delete on mk_secure_messages
  for each row execute function mk_update_message_count();

-- Maintain seller listing stats when listing lifecycle changes
create or replace function mk_sync_seller_listing_stats()
returns trigger as $$
declare
  target_seller uuid;
begin
  target_seller := coalesce(new.seller_id, old.seller_id);

  insert into mk_seller_stats (seller_id)
  values (target_seller)
  on conflict (seller_id) do nothing;

  update mk_seller_stats set
    total_listings = (
      select count(*) from mk_listings where seller_id = target_seller
    ),
    active_listings = (
      select count(*) from mk_listings where seller_id = target_seller and status = 'active'
    ),
    total_sold = (
      select count(*) from mk_listings where seller_id = target_seller and status = 'sold'
    )
  where seller_id = target_seller;

  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger mk_seller_listing_stats
  after insert or update or delete on mk_listings
  for each row execute function mk_sync_seller_listing_stats();

-- Update seller stats when reviews change
create or replace function mk_update_seller_review_stats()
returns trigger as $$
declare
  target_seller uuid;
begin
  target_seller := coalesce(new.seller_id, old.seller_id);
  insert into mk_seller_stats (seller_id, review_count, average_rating)
  values (target_seller, 0, null)
  on conflict (seller_id) do nothing;

  update mk_seller_stats set
    review_count = (select count(*) from mk_reviews where seller_id = target_seller),
    average_rating = (select avg(rating) from mk_reviews where seller_id = target_seller)
  where seller_id = target_seller;
  return coalesce(new, old);
end;
$$ language plpgsql;

create trigger mk_reviews_stats
  after insert or delete on mk_reviews
  for each row execute function mk_update_seller_review_stats();

-- ── RPC: Radius Search ───────────────────────────────────────────────

create or replace function mk_listings_within_radius(
  lat double precision,
  lng double precision,
  radius_miles double precision default 25
)
returns setof mk_listings as $$
  select * from mk_listings
  where status = 'active'
    and location is not null
    and st_dwithin(
      location,
      st_makepoint(lng, lat)::geography,
      radius_miles * 1609.34
    )
  order by st_distance(location, st_makepoint(lng, lat)::geography);
$$ language sql stable;
