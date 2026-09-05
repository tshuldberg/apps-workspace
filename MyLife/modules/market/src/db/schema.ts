/**
 * SQLite cache tables for offline browsing.
 * These mirror a subset of the Supabase cloud schema for local reads.
 * Prefixed with mk_ to namespace within the shared SQLite file.
 */

export const CACHE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS mk_categories_cache (
    id TEXT PRIMARY KEY,
    parent_id TEXT REFERENCES mk_categories_cache(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_listings_cache (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL,
    category_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price_cents INTEGER,
    currency TEXT NOT NULL DEFAULT 'USD',
    pricing_type TEXT NOT NULL DEFAULT 'fixed',
    condition TEXT,
    listing_type TEXT NOT NULL DEFAULT 'sell',
    status TEXT NOT NULL DEFAULT 'active',
    location_name TEXT,
    latitude REAL,
    longitude REAL,
    fulfillment_type TEXT,
    service_radius_miles INTEGER,
    availability_notes TEXT,
    trade_for TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    watch_count INTEGER NOT NULL DEFAULT 0,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_listing_photos_cache (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES mk_listings_cache(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_watchlist_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_conversations_cache (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    last_message_at TEXT,
    created_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_messages_cache (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES mk_conversations_cache(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    body TEXT,
    content_type TEXT NOT NULL DEFAULT 'text/plain',
    ciphertext TEXT,
    encryption_algorithm TEXT,
    encryption_salt TEXT,
    encryption_iv TEXT,
    created_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

// ── V3 cache tables: offers, payments, disputes, shipping, services, verification, crypto ──

export const V3_CACHE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS mk_offers_cache (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    counter_amount_cents INTEGER,
    message TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_payments_cache (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    stripe_payment_intent_id TEXT,
    amount_cents INTEGER NOT NULL,
    processing_fee_cents INTEGER NOT NULL DEFAULT 0,
    fee_payer TEXT NOT NULL DEFAULT 'buyer',
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    refund_amount_cents INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_disputes_cache (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolution_type TEXT,
    refund_amount_cents INTEGER,
    filed_at TEXT NOT NULL,
    seller_response_deadline TEXT NOT NULL,
    resolved_at TEXT,
    created_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_shipments_cache (
    id TEXT PRIMARY KEY,
    payment_id TEXT NOT NULL,
    listing_id TEXT NOT NULL,
    seller_id TEXT NOT NULL,
    buyer_id TEXT NOT NULL,
    carrier TEXT NOT NULL,
    tracking_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'label_created',
    estimated_delivery_date TEXT,
    actual_delivery_date TEXT,
    last_carrier_update TEXT,
    last_checked_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_service_portfolio_cache (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    url TEXT NOT NULL,
    caption TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_service_availability_cache (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    created_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_seller_verification_cache (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    photo_verified INTEGER NOT NULL DEFAULT 0,
    id_verified INTEGER NOT NULL DEFAULT 0,
    completed_sales INTEGER NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    average_rating REAL,
    account_age_days INTEGER NOT NULL DEFAULT 0,
    verification_level TEXT NOT NULL DEFAULT 'unverified',
    level_achieved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_identity_keys (
    id TEXT PRIMARY KEY DEFAULT 'local',
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    registration_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_sessions_cache (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    remote_device_id TEXT NOT NULL,
    session_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS mk_prekeys_cache (
    id INTEGER PRIMARY KEY,
    key_type TEXT NOT NULL,
    public_key TEXT NOT NULL,
    private_key TEXT NOT NULL,
    is_uploaded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

export const V3_CACHE_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS mk_offers_cache_listing_idx ON mk_offers_cache (listing_id)',
  'CREATE INDEX IF NOT EXISTS mk_offers_cache_buyer_idx ON mk_offers_cache (buyer_id)',
  'CREATE INDEX IF NOT EXISTS mk_payments_cache_listing_idx ON mk_payments_cache (listing_id)',
  'CREATE INDEX IF NOT EXISTS mk_disputes_cache_payment_idx ON mk_disputes_cache (payment_id)',
  'CREATE INDEX IF NOT EXISTS mk_shipments_cache_payment_idx ON mk_shipments_cache (payment_id)',
  'CREATE INDEX IF NOT EXISTS mk_service_portfolio_cache_listing_idx ON mk_service_portfolio_cache (listing_id)',
  'CREATE INDEX IF NOT EXISTS mk_service_availability_cache_listing_idx ON mk_service_availability_cache (listing_id)',
  'CREATE INDEX IF NOT EXISTS mk_sessions_cache_conv_idx ON mk_sessions_cache (conversation_id)',
];

export const CACHE_INDEXES: string[] = [
  'CREATE INDEX IF NOT EXISTS mk_categories_cache_parent_idx ON mk_categories_cache (parent_id)',
  'CREATE INDEX IF NOT EXISTS mk_categories_cache_slug_idx ON mk_categories_cache (slug)',
  'CREATE INDEX IF NOT EXISTS mk_listings_cache_seller_idx ON mk_listings_cache (seller_id)',
  'CREATE INDEX IF NOT EXISTS mk_listings_cache_category_idx ON mk_listings_cache (category_id)',
  'CREATE INDEX IF NOT EXISTS mk_listings_cache_status_idx ON mk_listings_cache (status)',
  'CREATE INDEX IF NOT EXISTS mk_listings_cache_created_idx ON mk_listings_cache (created_at DESC)',
  'CREATE INDEX IF NOT EXISTS mk_listing_photos_cache_listing_idx ON mk_listing_photos_cache (listing_id)',
  'CREATE INDEX IF NOT EXISTS mk_watchlist_cache_user_idx ON mk_watchlist_cache (user_id)',
  'CREATE INDEX IF NOT EXISTS mk_watchlist_cache_listing_idx ON mk_watchlist_cache (listing_id)',
  'CREATE INDEX IF NOT EXISTS mk_conversations_cache_listing_idx ON mk_conversations_cache (listing_id)',
  'CREATE INDEX IF NOT EXISTS mk_messages_cache_conv_idx ON mk_messages_cache (conversation_id)',
];
