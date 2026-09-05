'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';
import {
  CreateListingInputSchema,
  cloudGetCategories,
  cloudGetListingById,
  cloudGetListings,
  cloudGetSellerReviews,
  cloudGetServiceAvailability,
  cloudGetServicePortfolio,
  cloudSearchListings,
  decryptMarketMessageBody,
  encryptMarketMessageBody,
  getCachedCategories,
  getCachedConversations,
  getCachedListingById,
  getCachedListings,
  getCachedMessages,
  getCachedWatchlist,
  type Category,
  type Conversation,
  type DatabaseAdapter as MarketDatabaseAdapter,
  type Dispute,
  type Listing,
  type Message,
  type Offer,
  type Payment,
  type SellerVerification,
  type Shipment,
  type ShipmentEvent,
  type WatchlistItem,
} from '@mylife/market';
import {
  LOCAL_USER_ID,
  MARKET_BLOCKS,
  MARKET_CATEGORIES,
  MARKET_CONVERSATIONS,
  MARKET_DISPUTE_EVIDENCE,
  MARKET_DISPUTE_MESSAGES,
  MARKET_DISPUTES,
  MARKET_DISTANCE_MILES,
  MARKET_LISTINGS,
  MARKET_MESSAGES,
  MARKET_OFFERS,
  MARKET_PAYMENTS,
  MARKET_PREVIOUS_PRICES,
  MARKET_REVIEWS,
  MARKET_SAVED_SEARCHES,
  MARKET_SELLERS,
  MARKET_SERVICE_AVAILABILITY,
  MARKET_SERVICE_PORTFOLIO,
  MARKET_SETTINGS,
  MARKET_SHIPMENT_EVENTS,
  MARKET_SHIPMENTS,
  MARKET_VERIFICATIONS,
  MARKET_WATCHLIST,
  type BlockRecord,
  type DisputeEvidenceRecord,
  type DisputeMessageRecord,
  type ReportRecord,
  type ReviewRecord,
  type SavedSearchRecord,
  type SellerProfileRecord,
  type SettingRecord,
  getCategoryRecord,
  getSellerProfileRecord,
} from './data';

type SqlAdapter = ReturnType<typeof getAdapter>;

type BrowseFilters = {
  q?: string;
  category?: string;
  condition?: string;
  listingType?: string;
  minPrice?: number;
  maxPrice?: number;
  maxDistance?: number;
  sort?: string;
};

type SavedSearchRow = {
  id: string;
  userId: string;
  name: string;
  query: string;
  categoryId: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  notifyOnMatch: number;
  createdAt: string;
  label: string;
  matchCount: number;
};

type ReviewRow = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  sellerId: string;
  listingId: string;
  rating: number;
  body: string | null;
  createdAt: string;
};

type SettingRow = {
  key: string;
  value: string;
  updatedAt: string;
};

type BlockRow = {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedName: string;
  createdAt: string;
};

type ReportRow = {
  id: string;
  reporterId: string;
  listingId: string | null;
  userId: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
};

type OfferRow = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amountCents: number;
  currency: string;
  status: Offer['status'];
  counterAmountCents: number | null;
  message: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

type PaymentRow = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  stripePaymentIntentId: string | null;
  amountCents: number;
  processingFeeCents: number;
  feePayer: Payment['feePayer'];
  currency: string;
  status: Payment['status'];
  refundAmountCents: number | null;
  createdAt: string;
  updatedAt: string;
};

type ShipmentRow = {
  id: string;
  paymentId: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  carrier: Shipment['carrier'];
  trackingNumber: string;
  status: Shipment['status'];
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  lastCarrierUpdate: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DisputeRow = {
  id: string;
  paymentId: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  reason: Dispute['reason'];
  description: string;
  status: Dispute['status'];
  resolutionType: Dispute['resolutionType'];
  refundAmountCents: number | null;
  filedAt: string;
  sellerResponseDeadline: string;
  resolvedAt: string | null;
  createdAt: string;
};

type VerificationRow = {
  id: string;
  userId: string;
  emailVerified: number;
  phoneVerified: number;
  photoVerified: number;
  idVerified: number;
  completedSales: number;
  totalReviews: number;
  averageRating: number | null;
  accountAgeDays: number;
  verificationLevel: SellerVerification['verificationLevel'];
  levelAchievedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ServicePortfolioRow = {
  id: string;
  listingId: string;
  mediaType: string;
  url: string;
  caption: string | null;
  sortOrder: number;
  createdAt: string;
};

type ServiceAvailabilityRow = {
  id: string;
  listingId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: string;
};

function dbAdapter() {
  const adapter = getAdapter();
  ensureModuleMigrations('market');
  return adapter;
}

function marketDb(adapter: SqlAdapter): MarketDatabaseAdapter {
  return {
    run: (sql: string, params?: unknown[]) => adapter.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => adapter.query<T>(sql, params)[0],
    all: <T,>(sql: string, params?: unknown[]) => adapter.query<T>(sql, params),
  };
}

function queryScalar(adapter: SqlAdapter, sql: string, params: unknown[] = []) {
  return adapter.query<{ count: number }>(sql, params)[0]?.count ?? 0;
}

function insertRows(
  adapter: SqlAdapter,
  table: string,
  columns: string[],
  rows: unknown[][],
  mode: 'ignore' | 'replace' = 'ignore',
) {
  if (rows.length === 0) return;
  const placeholders = columns.map(() => '?').join(', ');
  const verb = mode === 'replace' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
  for (const row of rows) {
    adapter.execute(
      `${verb} INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      row,
    );
  }
}

function ensureLocalTables(adapter: SqlAdapter) {
  adapter.execute(`
    CREATE TABLE IF NOT EXISTS mk_saved_searches_local (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      category_id TEXT,
      min_price_cents INTEGER,
      max_price_cents INTEGER,
      notify_on_match INTEGER NOT NULL DEFAULT 1,
      label TEXT NOT NULL,
      match_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE IF NOT EXISTS mk_reviews_local (
      id TEXT PRIMARY KEY,
      reviewer_id TEXT NOT NULL,
      reviewer_name TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      listing_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      body TEXT,
      created_at TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE IF NOT EXISTS mk_reports_local (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      listing_id TEXT,
      user_id TEXT,
      reason TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE IF NOT EXISTS mk_settings_local (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE IF NOT EXISTS mk_blocks_local (
      id TEXT PRIMARY KEY,
      blocker_id TEXT NOT NULL,
      blocked_id TEXT NOT NULL,
      blocked_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE IF NOT EXISTS mk_dispute_messages_local (
      id TEXT PRIMARY KEY,
      dispute_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  adapter.execute(`
    CREATE TABLE IF NOT EXISTS mk_dispute_evidence_local (
      id TEXT PRIMARY KEY,
      dispute_id TEXT NOT NULL,
      label TEXT NOT NULL,
      caption TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

async function tryHydrateCategories(adapter: SqlAdapter) {
  const client = cloudClient();
  if (!client) return;
  try {
    const result = await cloudGetCategories(client as never);
    if (!result.ok || result.data.length === 0) return;
    insertRows(
      adapter,
      'mk_categories_cache',
      ['id', 'parent_id', 'name', 'slug', 'icon', 'sort_order', 'cached_at'],
      result.data.map((category) => [
        category.id,
        category.parentId,
        category.name,
        category.slug,
        category.icon,
        category.sortOrder,
        new Date().toISOString(),
      ]),
      'replace',
    );
  } catch {
    // Fall through to local cache.
  }
}

async function tryHydrateListings(adapter: SqlAdapter, query?: string) {
  const client = cloudClient();
  if (!client) return;
  try {
    const result = query
      ? await cloudSearchListings(client as never, query)
      : await cloudGetListings(client as never, { limit: 64 });
    if (!result.ok || result.data.length === 0) return;
    insertRows(
      adapter,
      'mk_listings_cache',
      [
        'id',
        'seller_id',
        'category_id',
        'title',
        'description',
        'price_cents',
        'currency',
        'pricing_type',
        'condition',
        'listing_type',
        'status',
        'location_name',
        'latitude',
        'longitude',
        'fulfillment_type',
        'service_radius_miles',
        'availability_notes',
        'trade_for',
        'view_count',
        'watch_count',
        'message_count',
        'created_at',
        'updated_at',
        'expires_at',
        'cached_at',
      ],
      result.data.map((listing) => [
        listing.id,
        listing.sellerId,
        listing.categoryId,
        listing.title,
        listing.description,
        listing.priceCents,
        listing.currency,
        listing.pricingType,
        listing.condition,
        listing.listingType,
        listing.status,
        listing.locationName,
        listing.latitude,
        listing.longitude,
        listing.fulfillmentType,
        listing.serviceRadiusMiles,
        listing.availabilityNotes,
        listing.tradeFor,
        listing.viewCount,
        listing.watchCount,
        listing.messageCount,
        listing.createdAt,
        listing.updatedAt,
        listing.expiresAt,
        new Date().toISOString(),
      ]),
      'replace',
    );
  } catch {
    // Fall through to local cache.
  }
}

async function tryHydrateListingDetail(adapter: SqlAdapter, listingId: string) {
  const client = cloudClient();
  if (!client) return;
  try {
    const result = await cloudGetListingById(client as never, listingId);
    if (!result.ok) return;
    const listing = result.data;
    insertRows(
      adapter,
      'mk_listings_cache',
      [
        'id',
        'seller_id',
        'category_id',
        'title',
        'description',
        'price_cents',
        'currency',
        'pricing_type',
        'condition',
        'listing_type',
        'status',
        'location_name',
        'latitude',
        'longitude',
        'fulfillment_type',
        'service_radius_miles',
        'availability_notes',
        'trade_for',
        'view_count',
        'watch_count',
        'message_count',
        'created_at',
        'updated_at',
        'expires_at',
        'cached_at',
      ],
      [[
        listing.id,
        listing.sellerId,
        listing.categoryId,
        listing.title,
        listing.description,
        listing.priceCents,
        listing.currency,
        listing.pricingType,
        listing.condition,
        listing.listingType,
        listing.status,
        listing.locationName,
        listing.latitude,
        listing.longitude,
        listing.fulfillmentType,
        listing.serviceRadiusMiles,
        listing.availabilityNotes,
        listing.tradeFor,
        listing.viewCount,
        listing.watchCount,
        listing.messageCount,
        listing.createdAt,
        listing.updatedAt,
        listing.expiresAt,
        new Date().toISOString(),
      ]],
      'replace',
    );
  } catch {
    // Fall through to local cache.
  }
}

async function tryHydrateReadOnlyExtras(listingId: string, sellerId: string) {
  const client = cloudClient();
  if (!client) return {
    reviews: [] as ReviewRecord[],
    servicePortfolio: [] as ServicePortfolioRow[],
    serviceAvailability: [] as ServiceAvailabilityRow[],
  };

  try {
    const [reviewsResult, servicePortfolioResult, serviceAvailabilityResult] = await Promise.all([
      cloudGetSellerReviews(client as never, sellerId),
      cloudGetServicePortfolio(client as never, listingId),
      cloudGetServiceAvailability(client as never, listingId),
    ]);

    return {
      reviews: reviewsResult.ok
        ? reviewsResult.data.map((review) => ({
            ...review,
            reviewerName: personName(review.reviewerId),
          }))
        : [],
      servicePortfolio: servicePortfolioResult.ok ? servicePortfolioResult.data : [],
      serviceAvailability: serviceAvailabilityResult.ok ? serviceAvailabilityResult.data : [],
    };
  } catch {
    return {
      reviews: [] as ReviewRecord[],
      servicePortfolio: [] as ServicePortfolioRow[],
      serviceAvailability: [] as ServiceAvailabilityRow[],
    };
  }
}

function seed(adapter: SqlAdapter) {
  ensureLocalTables(adapter);

  insertRows(
    adapter,
    'mk_categories_cache',
    ['id', 'parent_id', 'name', 'slug', 'icon', 'sort_order', 'cached_at'],
    MARKET_CATEGORIES.map((category) => [
      category.id,
      category.parentId,
      category.name,
      category.slug,
      category.icon,
      category.sortOrder,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_listings_cache',
    [
      'id',
      'seller_id',
      'category_id',
      'title',
      'description',
      'price_cents',
      'currency',
      'pricing_type',
      'condition',
      'listing_type',
      'status',
      'location_name',
      'latitude',
      'longitude',
      'fulfillment_type',
      'service_radius_miles',
      'availability_notes',
      'trade_for',
      'view_count',
      'watch_count',
      'message_count',
      'created_at',
      'updated_at',
      'expires_at',
      'cached_at',
    ],
    MARKET_LISTINGS.map((listing) => [
      listing.id,
      listing.sellerId,
      listing.categoryId,
      listing.title,
      listing.description,
      listing.priceCents,
      listing.currency,
      listing.pricingType,
      listing.condition,
      listing.listingType,
      listing.status,
      listing.locationName,
      listing.latitude,
      listing.longitude,
      listing.fulfillmentType,
      listing.serviceRadiusMiles,
      listing.availabilityNotes,
      listing.tradeFor,
      listing.viewCount,
      listing.watchCount,
      listing.messageCount,
      listing.createdAt,
      listing.updatedAt,
      listing.expiresAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_watchlist_cache',
    ['id', 'user_id', 'listing_id', 'created_at', 'cached_at'],
    MARKET_WATCHLIST.map((item) => [
      item.id,
      item.userId,
      item.listingId,
      item.createdAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_conversations_cache',
    ['id', 'listing_id', 'buyer_id', 'seller_id', 'last_message_at', 'created_at', 'cached_at'],
    MARKET_CONVERSATIONS.map((item) => [
      item.id,
      item.listingId,
      item.buyerId,
      item.sellerId,
      item.lastMessageAt,
      item.createdAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_messages_cache',
    [
      'id',
      'conversation_id',
      'sender_id',
      'body',
      'content_type',
      'ciphertext',
      'encryption_algorithm',
      'encryption_salt',
      'encryption_iv',
      'created_at',
      'cached_at',
    ],
    MARKET_MESSAGES.map((message) => [
      message.id,
      message.conversationId,
      message.senderId,
      message.body,
      message.contentType,
      message.ciphertext,
      message.encryptionAlgorithm,
      message.encryptionSalt,
      message.encryptionIv,
      message.createdAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_offers_cache',
    [
      'id',
      'listing_id',
      'buyer_id',
      'seller_id',
      'amount_cents',
      'currency',
      'status',
      'counter_amount_cents',
      'message',
      'expires_at',
      'created_at',
      'updated_at',
      'cached_at',
    ],
    MARKET_OFFERS.map((offer) => [
      offer.id,
      offer.listingId,
      offer.buyerId,
      offer.sellerId,
      offer.amountCents,
      offer.currency,
      offer.status,
      offer.counterAmountCents,
      offer.message,
      offer.expiresAt,
      offer.createdAt,
      offer.updatedAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_payments_cache',
    [
      'id',
      'listing_id',
      'buyer_id',
      'seller_id',
      'stripe_payment_intent_id',
      'amount_cents',
      'processing_fee_cents',
      'fee_payer',
      'currency',
      'status',
      'refund_amount_cents',
      'created_at',
      'updated_at',
      'cached_at',
    ],
    MARKET_PAYMENTS.map((payment) => [
      payment.id,
      payment.listingId,
      payment.buyerId,
      payment.sellerId,
      payment.stripePaymentIntentId,
      payment.amountCents,
      payment.processingFeeCents,
      payment.feePayer,
      payment.currency,
      payment.status,
      payment.refundAmountCents,
      payment.createdAt,
      payment.updatedAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_disputes_cache',
    [
      'id',
      'payment_id',
      'listing_id',
      'buyer_id',
      'seller_id',
      'reason',
      'description',
      'status',
      'resolution_type',
      'refund_amount_cents',
      'filed_at',
      'seller_response_deadline',
      'resolved_at',
      'created_at',
      'cached_at',
    ],
    MARKET_DISPUTES.map((dispute) => [
      dispute.id,
      dispute.paymentId,
      dispute.listingId,
      dispute.buyerId,
      dispute.sellerId,
      dispute.reason,
      dispute.description,
      dispute.status,
      dispute.resolutionType,
      dispute.refundAmountCents,
      dispute.filedAt,
      dispute.sellerResponseDeadline,
      dispute.resolvedAt,
      dispute.createdAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_shipments_cache',
    [
      'id',
      'payment_id',
      'listing_id',
      'seller_id',
      'buyer_id',
      'carrier',
      'tracking_number',
      'status',
      'estimated_delivery_date',
      'actual_delivery_date',
      'last_carrier_update',
      'last_checked_at',
      'created_at',
      'updated_at',
      'cached_at',
    ],
    MARKET_SHIPMENTS.map((shipment) => [
      shipment.id,
      shipment.paymentId,
      shipment.listingId,
      shipment.sellerId,
      shipment.buyerId,
      shipment.carrier,
      shipment.trackingNumber,
      shipment.status,
      shipment.estimatedDeliveryDate,
      shipment.actualDeliveryDate,
      shipment.lastCarrierUpdate,
      shipment.lastCheckedAt,
      shipment.createdAt,
      shipment.updatedAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_service_portfolio_cache',
    ['id', 'listing_id', 'media_type', 'url', 'caption', 'sort_order', 'created_at', 'cached_at'],
    MARKET_SERVICE_PORTFOLIO.map((item) => [
      item.id,
      item.listingId,
      item.mediaType,
      item.url,
      item.caption,
      item.sortOrder,
      item.createdAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_service_availability_cache',
    ['id', 'listing_id', 'day_of_week', 'start_time', 'end_time', 'created_at', 'cached_at'],
    MARKET_SERVICE_AVAILABILITY.map((item) => [
      item.id,
      item.listingId,
      item.dayOfWeek,
      item.startTime,
      item.endTime,
      item.createdAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_seller_verification_cache',
    [
      'id',
      'user_id',
      'email_verified',
      'phone_verified',
      'photo_verified',
      'id_verified',
      'completed_sales',
      'total_reviews',
      'average_rating',
      'account_age_days',
      'verification_level',
      'level_achieved_at',
      'created_at',
      'updated_at',
      'cached_at',
    ],
    MARKET_VERIFICATIONS.map((item) => [
      item.id,
      item.userId,
      item.emailVerified ? 1 : 0,
      item.phoneVerified ? 1 : 0,
      item.photoVerified ? 1 : 0,
      item.idVerified ? 1 : 0,
      item.completedSales,
      item.totalReviews,
      item.averageRating,
      item.accountAgeDays,
      item.verificationLevel,
      item.levelAchievedAt,
      item.createdAt,
      item.updatedAt,
      new Date().toISOString(),
    ]),
  );

  insertRows(
    adapter,
    'mk_saved_searches_local',
    [
      'id',
      'user_id',
      'name',
      'query',
      'category_id',
      'min_price_cents',
      'max_price_cents',
      'notify_on_match',
      'label',
      'match_count',
      'created_at',
    ],
    MARKET_SAVED_SEARCHES.map((item) => [
      item.id,
      item.userId,
      item.name,
      item.query,
      item.categoryId,
      item.minPriceCents,
      item.maxPriceCents,
      item.notifyOnMatch ? 1 : 0,
      item.label,
      item.matchCount,
      item.createdAt,
    ]),
  );

  insertRows(
    adapter,
    'mk_reviews_local',
    [
      'id',
      'reviewer_id',
      'reviewer_name',
      'seller_id',
      'listing_id',
      'rating',
      'body',
      'created_at',
    ],
    MARKET_REVIEWS.map((item) => [
      item.id,
      item.reviewerId,
      item.reviewerName,
      item.sellerId,
      item.listingId,
      item.rating,
      item.body,
      item.createdAt,
    ]),
  );

  insertRows(
    adapter,
    'mk_settings_local',
    ['key', 'value', 'updated_at'],
    MARKET_SETTINGS.map((item) => [item.key, item.value, item.updatedAt]),
  );

  insertRows(
    adapter,
    'mk_blocks_local',
    ['id', 'blocker_id', 'blocked_id', 'blocked_name', 'created_at'],
    MARKET_BLOCKS.map((item) => [item.id, item.blockerId, item.blockedId, item.blockedName, item.createdAt]),
  );

  insertRows(
    adapter,
    'mk_dispute_messages_local',
    ['id', 'dispute_id', 'sender_name', 'body', 'created_at'],
    MARKET_DISPUTE_MESSAGES.map((item) => [item.id, item.disputeId, item.senderName, item.body, item.createdAt]),
  );

  insertRows(
    adapter,
    'mk_dispute_evidence_local',
    ['id', 'dispute_id', 'label', 'caption', 'created_at'],
    MARKET_DISPUTE_EVIDENCE.map((item) => [item.id, item.disputeId, item.label, item.caption, item.createdAt]),
  );
}

function personName(userId: string) {
  return MARKET_SELLERS.find((seller) => seller.id === userId)?.name ?? `User ${userId.slice(-4)}`;
}

function personProfile(userId: string): SellerProfileRecord {
  const existing = MARKET_SELLERS.find((seller) => seller.id === userId);
  if (existing) return existing;

  return {
    id: userId,
    name: personName(userId),
    handle: `user-${userId.slice(-4)}`,
    headline: 'Marketplace member',
    bio: 'Local buyer or seller in the MyMarket network.',
    location: 'Local only',
    memberSince: new Date().toISOString(),
    tier: 'basic',
    responseRate: 0.9,
    averageRating: 4.6,
    reviewCount: 0,
    completedSales: 0,
    activeListings: 0,
    avatarSeed: userId.slice(-2).toUpperCase(),
    specialties: ['Community trading'],
  };
}

function verificationFor(userId: string): SellerVerification | null {
  const adapter = dbAdapter();
  seed(adapter);
  const row = adapter.query<VerificationRow>(
    `SELECT
      id,
      user_id as userId,
      email_verified as emailVerified,
      phone_verified as phoneVerified,
      photo_verified as photoVerified,
      id_verified as idVerified,
      completed_sales as completedSales,
      total_reviews as totalReviews,
      average_rating as averageRating,
      account_age_days as accountAgeDays,
      verification_level as verificationLevel,
      level_achieved_at as levelAchievedAt,
      created_at as createdAt,
      updated_at as updatedAt
     FROM mk_seller_verification_cache
     WHERE user_id = ?`,
    [userId],
  )[0];

  if (!row) return null;
  return {
    ...row,
    emailVerified: Boolean(row.emailVerified),
    phoneVerified: Boolean(row.phoneVerified),
    photoVerified: Boolean(row.photoVerified),
    idVerified: Boolean(row.idVerified),
  };
}

function getSavedSearches(adapter: SqlAdapter): SavedSearchRecord[] {
  return adapter.query<SavedSearchRow>(
    `SELECT
      id,
      user_id as userId,
      name,
      query,
      category_id as categoryId,
      min_price_cents as minPriceCents,
      max_price_cents as maxPriceCents,
      notify_on_match as notifyOnMatch,
      created_at as createdAt,
      label,
      match_count as matchCount
     FROM mk_saved_searches_local
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [LOCAL_USER_ID],
  ).map((item) => ({
    ...item,
    notifyOnMatch: Boolean(item.notifyOnMatch),
  }));
}

function getReviews(adapter: SqlAdapter, sellerId?: string): ReviewRecord[] {
  const rows = adapter.query<ReviewRow>(
    `SELECT
      id,
      reviewer_id as reviewerId,
      reviewer_name as reviewerName,
      seller_id as sellerId,
      listing_id as listingId,
      rating,
      body,
      created_at as createdAt
     FROM mk_reviews_local
     ${sellerId ? 'WHERE seller_id = ?' : ''}
     ORDER BY created_at DESC`,
    sellerId ? [sellerId] : [],
  );

  return rows.map((row) => ({
    ...row,
    body: row.body,
  }));
}

function getBlocks(adapter: SqlAdapter): BlockRecord[] {
  return adapter.query<BlockRow>(
    `SELECT
      id,
      blocker_id as blockerId,
      blocked_id as blockedId,
      blocked_name as blockedName,
      created_at as createdAt
     FROM mk_blocks_local
     WHERE blocker_id = ?
     ORDER BY created_at DESC`,
    [LOCAL_USER_ID],
  );
}

function getReports(adapter: SqlAdapter): ReportRecord[] {
  return adapter.query<ReportRow>(
    `SELECT
      id,
      reporter_id as reporterId,
      listing_id as listingId,
      user_id as userId,
      reason,
      details,
      created_at as createdAt
     FROM mk_reports_local
     WHERE reporter_id = ?
     ORDER BY created_at DESC`,
    [LOCAL_USER_ID],
  );
}

function getSettings(adapter: SqlAdapter): SettingRecord[] {
  return adapter.query<SettingRow>(
    `SELECT key, value, updated_at as updatedAt
     FROM mk_settings_local
     ORDER BY key ASC`,
  );
}

function getOffers(adapter: SqlAdapter): Offer[] {
  return adapter.query<OfferRow>(
    `SELECT
      id,
      listing_id as listingId,
      buyer_id as buyerId,
      seller_id as sellerId,
      amount_cents as amountCents,
      currency,
      status,
      counter_amount_cents as counterAmountCents,
      message,
      expires_at as expiresAt,
      created_at as createdAt,
      updated_at as updatedAt
     FROM mk_offers_cache
     ORDER BY updated_at DESC`,
  );
}

function getPayments(adapter: SqlAdapter): Payment[] {
  return adapter.query<PaymentRow>(
    `SELECT
      id,
      listing_id as listingId,
      buyer_id as buyerId,
      seller_id as sellerId,
      stripe_payment_intent_id as stripePaymentIntentId,
      amount_cents as amountCents,
      processing_fee_cents as processingFeeCents,
      fee_payer as feePayer,
      currency,
      status,
      refund_amount_cents as refundAmountCents,
      created_at as createdAt,
      updated_at as updatedAt
     FROM mk_payments_cache
     ORDER BY created_at DESC`,
  ).map((row) => ({
    ...row,
    stripePaymentIntentId: row.stripePaymentIntentId ?? '',
  }));
}

function getShipments(adapter: SqlAdapter): Shipment[] {
  return adapter.query<ShipmentRow>(
    `SELECT
      id,
      payment_id as paymentId,
      listing_id as listingId,
      seller_id as sellerId,
      buyer_id as buyerId,
      carrier,
      tracking_number as trackingNumber,
      status,
      estimated_delivery_date as estimatedDeliveryDate,
      actual_delivery_date as actualDeliveryDate,
      last_carrier_update as lastCarrierUpdate,
      last_checked_at as lastCheckedAt,
      created_at as createdAt,
      updated_at as updatedAt
     FROM mk_shipments_cache
     ORDER BY updated_at DESC`,
  );
}

function getDisputes(adapter: SqlAdapter): Dispute[] {
  return adapter.query<DisputeRow>(
    `SELECT
      id,
      payment_id as paymentId,
      listing_id as listingId,
      buyer_id as buyerId,
      seller_id as sellerId,
      reason,
      description,
      status,
      resolution_type as resolutionType,
      refund_amount_cents as refundAmountCents,
      filed_at as filedAt,
      seller_response_deadline as sellerResponseDeadline,
      resolved_at as resolvedAt,
      created_at as createdAt
     FROM mk_disputes_cache
     ORDER BY filed_at DESC`,
  );
}

function getDisputeMessages(adapter: SqlAdapter, disputeId: string): DisputeMessageRecord[] {
  return adapter.query<DisputeMessageRecord>(
    `SELECT
      id,
      dispute_id as disputeId,
      sender_name as senderName,
      body,
      created_at as createdAt
     FROM mk_dispute_messages_local
     WHERE dispute_id = ?
     ORDER BY created_at ASC`,
    [disputeId],
  );
}

function getDisputeEvidence(adapter: SqlAdapter, disputeId: string): DisputeEvidenceRecord[] {
  return adapter.query<DisputeEvidenceRecord>(
    `SELECT
      id,
      dispute_id as disputeId,
      label,
      caption,
      created_at as createdAt
     FROM mk_dispute_evidence_local
     WHERE dispute_id = ?
     ORDER BY created_at ASC`,
    [disputeId],
  );
}

function getServicePortfolio(adapter: SqlAdapter, listingId: string) {
  return adapter.query<ServicePortfolioRow>(
    `SELECT
      id,
      listing_id as listingId,
      media_type as mediaType,
      url,
      caption,
      sort_order as sortOrder,
      created_at as createdAt
     FROM mk_service_portfolio_cache
     WHERE listing_id = ?
     ORDER BY sort_order ASC`,
    [listingId],
  );
}

function getServiceAvailability(adapter: SqlAdapter, listingId: string) {
  return adapter.query<ServiceAvailabilityRow>(
    `SELECT
      id,
      listing_id as listingId,
      day_of_week as dayOfWeek,
      start_time as startTime,
      end_time as endTime,
      created_at as createdAt
     FROM mk_service_availability_cache
     WHERE listing_id = ?
     ORDER BY day_of_week ASC`,
    [listingId],
  );
}

function matchingConversation(adapter: SqlAdapter, listingId: string, sellerId: string) {
  return adapter.query<Conversation>(
    `SELECT
      id,
      listing_id as listingId,
      buyer_id as buyerId,
      seller_id as sellerId,
      last_message_at as lastMessageAt,
      created_at as createdAt
     FROM mk_conversations_cache
     WHERE listing_id = ? AND buyer_id = ? AND seller_id = ?
     LIMIT 1`,
    [listingId, LOCAL_USER_ID, sellerId],
  )[0];
}

function filterListings(listings: Listing[], filters: BrowseFilters) {
  const q = filters.q?.trim().toLowerCase();
  const conditions = filters.condition
    ? filters.condition.split(',').map((item) => item.trim()).filter(Boolean)
    : [];

  let filtered = listings.filter((listing) => listing.status === 'active');

  if (q) {
    filtered = filtered.filter((listing) => {
      const haystack = [listing.title, listing.description, listing.locationName ?? '', personName(listing.sellerId)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  if (filters.category) {
    const category = MARKET_CATEGORIES.find(
      (item) => item.slug === filters.category || item.id === filters.category,
    );
    if (category) {
      filtered = filtered.filter((listing) => listing.categoryId === category.id);
    }
  }

  if (filters.listingType) {
    filtered = filtered.filter((listing) => listing.listingType === filters.listingType);
  }

  if (conditions.length > 0) {
    filtered = filtered.filter((listing) => listing.condition != null && conditions.includes(listing.condition));
  }

  if (typeof filters.minPrice === 'number' && Number.isFinite(filters.minPrice)) {
    filtered = filtered.filter((listing) => (listing.priceCents ?? 0) >= filters.minPrice! * 100);
  }

  if (typeof filters.maxPrice === 'number' && Number.isFinite(filters.maxPrice)) {
    filtered = filtered.filter((listing) => (listing.priceCents ?? 0) <= filters.maxPrice! * 100);
  }

  if (typeof filters.maxDistance === 'number' && Number.isFinite(filters.maxDistance)) {
    filtered = filtered.filter((listing) => {
      const miles = MARKET_DISTANCE_MILES[listing.id] ?? 0;
      return miles <= filters.maxDistance!;
    });
  }

  switch (filters.sort) {
    case 'price-low':
      filtered.sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0));
      break;
    case 'price-high':
      filtered.sort((a, b) => (b.priceCents ?? 0) - (a.priceCents ?? 0));
      break;
    case 'popular':
      filtered.sort((a, b) => b.watchCount + b.viewCount - (a.watchCount + a.viewCount));
      break;
    default:
      filtered.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
      break;
  }

  return filtered;
}

function cloudClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

function marketListingView(listing: Listing, watchlist: WatchlistItem[]) {
  const seller = personProfile(listing.sellerId);
  const category = getCategoryRecord(listing.categoryId);
  const previousPrice = MARKET_PREVIOUS_PRICES[listing.id] ?? null;
  return {
    ...listing,
    seller,
    category,
    distanceMiles: MARKET_DISTANCE_MILES[listing.id] ?? 0,
    isWatched: watchlist.some((item) => item.listingId === listing.id),
    previousPriceCents: previousPrice,
  };
}

function revalidateMarketPaths() {
  const paths = [
    '/market',
    '/market/browse',
    '/market/watchlist',
    '/market/messages',
    '/market/offers',
    '/market/orders',
    '/market/disputes',
    '/market/profile',
    '/market/services',
    '/market/settings',
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
  revalidatePath('/market', 'layout');
}

function normalizeBool(value: FormDataEntryValue | null) {
  return value === 'true' || value === '1' || value === 'on';
}

function safeString(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeNumber(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getHomeData() {
  const adapter = dbAdapter();
  seed(adapter);
  await Promise.all([tryHydrateCategories(adapter), tryHydrateListings(adapter)]);

  const db = marketDb(adapter);
  const categories = getCachedCategories(db);
  const listings = getCachedListings(db, { status: 'active', limit: 64 });
  const watchlist = getCachedWatchlist(db, LOCAL_USER_ID);
  const recentListings = listings.slice(0, 6).map((listing) => marketListingView(listing, watchlist));
  const watchlistListings = watchlist
    .map((item) => listings.find((listing) => listing.id === item.listingId))
    .filter((listing): listing is Listing => Boolean(listing))
    .slice(0, 4)
    .map((listing) => marketListingView(listing, watchlist));

  const categoryCounts = categories.map((category) => ({
    ...category,
    count: listings.filter((listing) => listing.categoryId === category.id).length,
  }));

  const featuredSellers = [...MARKET_SELLERS]
    .sort((a, b) => b.completedSales - a.completedSales)
    .slice(0, 4);

  return {
    categories: categoryCounts,
    recentListings,
    watchlistListings,
    featuredSellers,
    stats: {
      activeListings: listings.length,
      savedItems: watchlist.length,
      services: listings.filter((listing) => listing.listingType.includes('service')).length,
    },
  };
}

export async function getBrowseData(filters: BrowseFilters) {
  const adapter = dbAdapter();
  seed(adapter);
  await Promise.all([tryHydrateCategories(adapter), tryHydrateListings(adapter, filters.q)]);

  const db = marketDb(adapter);
  const listings = getCachedListings(db, { status: 'active', limit: 200 });
  const watchlist = getCachedWatchlist(db, LOCAL_USER_ID);
  const categories = getCachedCategories(db);
  const filtered = filterListings(listings, filters).map((listing) => marketListingView(listing, watchlist));
  const hasActiveFilters = Boolean(
    filters.q ||
    filters.category ||
    filters.condition ||
    filters.listingType ||
    filters.minPrice ||
    filters.maxPrice ||
    filters.maxDistance,
  );

  return {
    categories,
    listings: filtered,
    watchlistIds: new Set(watchlist.map((item) => item.listingId)),
    filters,
    hasActiveFilters,
    savedSearches: getSavedSearches(adapter),
  };
}

export async function getListingData(listingId: string) {
  const adapter = dbAdapter();
  seed(adapter);
  await Promise.all([tryHydrateCategories(adapter), tryHydrateListingDetail(adapter, listingId)]);

  const db = marketDb(adapter);
  const listing = getCachedListingById(db, listingId);
  if (!listing) return null;

  const watchlist = getCachedWatchlist(db, LOCAL_USER_ID);
  const listingView = marketListingView(listing, watchlist);
  const relatedListings = getCachedListings(db, { status: 'active', limit: 200 })
    .filter((item) => item.categoryId === listing.categoryId && item.id !== listing.id)
    .slice(0, 4)
    .map((item) => marketListingView(item, watchlist));

  const adapterOffers = getOffers(adapter).filter((offer) => offer.listingId === listing.id);
  const verification = verificationFor(listing.sellerId);
  const localReviews = getReviews(adapter, listing.sellerId);
  const cloudExtras = await tryHydrateReadOnlyExtras(listing.id, listing.sellerId);
  const reviews = cloudExtras.reviews.length > 0 ? cloudExtras.reviews : localReviews;
  const servicePortfolio = cloudExtras.servicePortfolio.length > 0
    ? cloudExtras.servicePortfolio
    : getServicePortfolio(adapter, listing.id);
  const serviceAvailability = cloudExtras.serviceAvailability.length > 0
    ? cloudExtras.serviceAvailability
    : getServiceAvailability(adapter, listing.id);
  const conversation = matchingConversation(adapter, listing.id, listing.sellerId);

  return {
    listing: listingView,
    seller: personProfile(listing.sellerId),
    relatedListings,
    offers: adapterOffers,
    reviews,
    verification,
    servicePortfolio,
    serviceAvailability,
    conversationId: conversation?.id ?? null,
  };
}

export async function getMessagesData(activeConversationId?: string) {
  const adapter = dbAdapter();
  seed(adapter);
  const db = marketDb(adapter);

  const conversations = getCachedConversations(db, LOCAL_USER_ID)
    .map((conversation) => {
      const listing = getCachedListingById(db, conversation.listingId);
      const messages = getCachedMessages(db, conversation.id);
      const otherUserId = conversation.buyerId === LOCAL_USER_ID ? conversation.sellerId : conversation.buyerId;
      return {
        ...conversation,
        listing,
        messages,
        otherUser: personProfile(otherUserId),
        preview: messages[messages.length - 1]?.body ?? 'Encrypted update pending',
      };
    })
    .filter((conversation) => Boolean(conversation.listing));

  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? conversations[0] ?? null;

  const decryptedPreview = activeConversation
    ? await Promise.all(activeConversation.messages.map(async (message) => {
        if (message.contentType !== 'application/e2ee+ciphertext') {
          return { ...message, decryptedBody: message.body };
        }
        try {
          const decryptedBody = await decryptMarketMessageBody(
            {
              contentType: message.contentType,
              ciphertext: message.ciphertext ?? undefined,
              encryptionSalt: message.encryptionSalt ?? undefined,
              encryptionIv: message.encryptionIv ?? undefined,
            },
            'market-demo-key',
          );
          return { ...message, decryptedBody };
        } catch {
          return { ...message, decryptedBody: 'Encrypted message' };
        }
      }))
    : [];

  return {
    conversations,
    activeConversation,
    messages: decryptedPreview,
  };
}

export async function getProfileData(userId: string = LOCAL_USER_ID) {
  const adapter = dbAdapter();
  seed(adapter);
  const db = marketDb(adapter);
  const listings = getCachedListings(db, { status: 'active', limit: 200 })
    .filter((listing) => listing.sellerId === userId);
  const watchlist = getCachedWatchlist(db, LOCAL_USER_ID);
  const reviews = getReviews(adapter, userId);
  const verification = verificationFor(userId);
  const seller = personProfile(userId);

  return {
    seller,
    listings: listings.map((listing) => marketListingView(listing, watchlist)),
    reviews,
    verification,
  };
}

export async function getWatchlistData() {
  const adapter = dbAdapter();
  seed(adapter);
  const db = marketDb(adapter);
  const watchlist = getCachedWatchlist(db, LOCAL_USER_ID);
  const listings = getCachedListings(db, { status: 'active', limit: 200 });
  return watchlist
    .map((item) => listings.find((listing) => listing.id === item.listingId))
    .filter((listing): listing is Listing => Boolean(listing))
    .map((listing) => marketListingView(listing, watchlist));
}

export async function getSavedSearchesData() {
  const adapter = dbAdapter();
  seed(adapter);
  return getSavedSearches(adapter);
}

export async function getReviewsData(sellerId: string) {
  const adapter = dbAdapter();
  seed(adapter);
  const reviews = getReviews(adapter, sellerId);
  return {
    seller: personProfile(sellerId),
    reviews,
  };
}

export async function getOffersData(tab?: string) {
  const adapter = dbAdapter();
  seed(adapter);
  const db = marketDb(adapter);
  const watchlist = getCachedWatchlist(db, LOCAL_USER_ID);
  const listings = getCachedListings(db, { status: 'active', limit: 200 });
  const offers = getOffers(adapter);

  const filtered = offers.filter((offer) => {
    switch (tab) {
      case 'received':
        return offer.sellerId === LOCAL_USER_ID;
      case 'active':
        return ['pending', 'countered', 'accepted'].includes(offer.status);
      case 'history':
        return ['rejected', 'expired', 'withdrawn'].includes(offer.status);
      case 'sent':
      default:
        return offer.buyerId === LOCAL_USER_ID;
    }
  });

  return filtered.map((offer) => ({
    ...offer,
    listing: listings.find((listing) => listing.id === offer.listingId)
      ? marketListingView(
          listings.find((listing) => listing.id === offer.listingId)!,
          watchlist,
        )
      : null,
    buyer: personProfile(offer.buyerId),
    seller: personProfile(offer.sellerId),
  }));
}

export async function getCheckoutData(listingId?: string) {
  const adapter = dbAdapter();
  seed(adapter);
  const db = marketDb(adapter);
  const listings = getCachedListings(db, { status: 'active', limit: 200 });
  const listing = (listingId ? listings.find((item) => item.id === listingId) : undefined) ?? listings[0];
  if (!listing) return null;
  return {
    listing,
    seller: personProfile(listing.sellerId),
    subtotalCents: listing.priceCents ?? 0,
    feeCents: Math.round((listing.priceCents ?? 0) * 0.03),
    shippingCents: listing.fulfillmentType === 'shipping' ? 1800 : 0,
    paymentMethods: [
      { id: 'visa-4421', label: 'Visa ending in 4421', detail: 'Expires 09/26' },
      { id: 'mastercard-9012', label: 'Mastercard ending in 9012', detail: 'Expires 01/28' },
      { id: 'apple-pay', label: 'Apple Pay', detail: 'Default express checkout' },
    ],
  };
}

export async function getOrdersData() {
  const adapter = dbAdapter();
  seed(adapter);
  const payments = getPayments(adapter);
  const shipments = getShipments(adapter);
  const marketDbAdapter = marketDb(adapter);
  const watchlist = getCachedWatchlist(marketDbAdapter, LOCAL_USER_ID);

  return payments.map((payment) => {
    const shipment = shipments.find((item) => item.paymentId === payment.id) ?? null;
    const listing = getCachedListingById(marketDbAdapter, payment.listingId);
    return {
      payment,
      shipment,
      listing: listing ? marketListingView(listing, watchlist) : null,
      buyer: personProfile(payment.buyerId),
      seller: personProfile(payment.sellerId),
    };
  });
}

export async function getOrderDetailData(paymentId: string) {
  const orders = await getOrdersData();
  const order = orders.find((item) => item.payment.id === paymentId);
  if (!order) return null;
  return {
    ...order,
    events: MARKET_SHIPMENT_EVENTS[paymentId] ?? [],
  };
}

export async function getDisputesData() {
  const adapter = dbAdapter();
  seed(adapter);
  const disputes = getDisputes(adapter);
  const payments = getPayments(adapter);
  const marketDbAdapter = marketDb(adapter);

  return disputes.map((dispute) => ({
    dispute,
    payment: payments.find((payment) => payment.id === dispute.paymentId) ?? null,
    listing: getCachedListingById(marketDbAdapter, dispute.listingId),
    buyer: personProfile(dispute.buyerId),
    seller: personProfile(dispute.sellerId),
  }));
}

export async function getDisputeDetailData(disputeId: string) {
  const adapter = dbAdapter();
  seed(adapter);
  const dispute = getDisputes(adapter).find((item) => item.id === disputeId);
  if (!dispute) return null;

  const payment = getPayments(adapter).find((item) => item.id === dispute.paymentId) ?? null;
  const marketDbAdapter = marketDb(adapter);
  const listing = getCachedListingById(marketDbAdapter, dispute.listingId);

  return {
    dispute,
    payment,
    listing,
    buyer: personProfile(dispute.buyerId),
    seller: personProfile(dispute.sellerId),
    messages: getDisputeMessages(adapter, disputeId),
    evidence: getDisputeEvidence(adapter, disputeId),
  };
}

export async function getServicesData(tab?: string) {
  const adapter = dbAdapter();
  seed(adapter);
  const marketDbAdapter = marketDb(adapter);
  const watchlist = getCachedWatchlist(marketDbAdapter, LOCAL_USER_ID);
  const listings = getCachedListings(marketDbAdapter, { status: 'active', limit: 200 })
    .filter((listing) => listing.listingType === 'service_offer' || listing.listingType === 'service_request');

  const filtered = listings.filter((listing) => {
    if (tab === 'mine') return listing.sellerId === LOCAL_USER_ID;
    if (tab === 'requests') return listing.listingType === 'service_request';
    return listing.listingType === 'service_offer';
  });

  return filtered.map((listing) => ({
    listing: marketListingView(listing, watchlist),
    seller: personProfile(listing.sellerId),
    availability: getServiceAvailability(adapter, listing.id),
    portfolio: getServicePortfolio(adapter, listing.id),
  }));
}

export async function getSettingsData() {
  const adapter = dbAdapter();
  seed(adapter);
  return {
    settings: getSettings(adapter),
    blocks: getBlocks(adapter),
    reports: getReports(adapter),
  };
}

export async function startConversationAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const listingId = safeString(formData.get('listingId'));
  if (!listingId) return;
  const listing = getCachedListingById(marketDb(adapter), listingId);
  if (!listing) return;

  const existing = matchingConversation(adapter, listingId, listing.sellerId);
  const conversationId = existing?.id ?? crypto.randomUUID();
  const createdAt = new Date().toISOString();

  if (!existing) {
    adapter.execute(
      `INSERT INTO mk_conversations_cache
       (id, listing_id, buyer_id, seller_id, last_message_at, created_at, cached_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [conversationId, listingId, LOCAL_USER_ID, listing.sellerId, createdAt, createdAt],
    );
  }

  revalidateMarketPaths();
  redirect(`/market/messages/${conversationId}`);
}

export async function toggleWatchlistAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const listingId = safeString(formData.get('listingId'));
  const returnTo = safeString(formData.get('returnTo')) || '/market/watchlist';
  if (!listingId) return;

  const existing = adapter.query<{ id: string }>(
    `SELECT id FROM mk_watchlist_cache WHERE user_id = ? AND listing_id = ? LIMIT 1`,
    [LOCAL_USER_ID, listingId],
  )[0];

  if (existing) {
    adapter.execute(`DELETE FROM mk_watchlist_cache WHERE id = ?`, [existing.id]);
  } else {
    adapter.execute(
      `INSERT INTO mk_watchlist_cache (id, user_id, listing_id, created_at, cached_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [crypto.randomUUID(), LOCAL_USER_ID, listingId, new Date().toISOString()],
    );
  }

  revalidateMarketPaths();
  redirect(returnTo);
}

export async function createListingAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);

  const parsed = CreateListingInputSchema.safeParse({
    categoryId: safeString(formData.get('categoryId')),
    title: safeString(formData.get('title')),
    description: safeString(formData.get('description')),
    priceCents: (() => {
      const price = safeNumber(formData.get('price'));
      return price == null ? undefined : Math.round(price * 100);
    })(),
    currency: 'USD',
    pricingType: safeString(formData.get('pricingType')) || 'fixed',
    condition: safeString(formData.get('condition')) || undefined,
    listingType: safeString(formData.get('listingType')) || 'sell',
    locationName: safeString(formData.get('locationName')) || undefined,
    fulfillmentType: safeString(formData.get('fulfillmentType')) || undefined,
    serviceRadiusMiles: safeNumber(formData.get('serviceRadiusMiles')) ?? undefined,
    availabilityNotes: safeString(formData.get('availabilityNotes')) || undefined,
    tradeFor: safeString(formData.get('tradeFor')) || undefined,
  });

  if (!parsed.success) {
    redirect('/market/sell?error=validation');
  }

  const listingId = crypto.randomUUID();
  const now = new Date().toISOString();
  const input = parsed.data;

  adapter.execute(
    `INSERT INTO mk_listings_cache
     (id, seller_id, category_id, title, description, price_cents, currency, pricing_type,
      condition, listing_type, status, location_name, latitude, longitude, fulfillment_type,
      service_radius_miles, availability_notes, trade_for, view_count, watch_count, message_count,
      created_at, updated_at, expires_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL, NULL, ?, ?, ?, ?, 0, 0, 0, ?, ?, NULL, datetime('now'))`,
    [
      listingId,
      LOCAL_USER_ID,
      input.categoryId,
      input.title,
      input.description,
      input.priceCents ?? null,
      input.currency ?? 'USD',
      input.pricingType,
      input.condition ?? null,
      input.listingType,
      input.locationName ?? null,
      input.fulfillmentType ?? null,
      input.serviceRadiusMiles ?? null,
      input.availabilityNotes ?? null,
      input.tradeFor ?? null,
      now,
      now,
    ],
  );

  revalidateMarketPaths();
  redirect(`/market/${listingId}?created=1`);
}

export async function saveSearchAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);

  const query = safeString(formData.get('query'));
  const name = safeString(formData.get('name')) || 'Saved search';
  const categoryId = safeString(formData.get('categoryId')) || null;
  const minPrice = safeNumber(formData.get('minPrice'));
  const maxPrice = safeNumber(formData.get('maxPrice'));
  const notifyOnMatch = normalizeBool(formData.get('notifyOnMatch'));
  const returnTo = safeString(formData.get('returnTo')) || '/market/saved-searches';

  if (!query) {
    redirect(`${returnTo}?error=missing-query`);
  }

  adapter.execute(
    `INSERT INTO mk_saved_searches_local
     (id, user_id, name, query, category_id, min_price_cents, max_price_cents, notify_on_match, label, match_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      LOCAL_USER_ID,
      name,
      query,
      categoryId,
      minPrice == null ? null : Math.round(minPrice * 100),
      maxPrice == null ? null : Math.round(maxPrice * 100),
      notifyOnMatch ? 1 : 0,
      safeString(formData.get('label')) || 'Saved from browse',
      0,
      new Date().toISOString(),
    ],
  );

  revalidateMarketPaths();
  redirect('/market/saved-searches?saved=1');
}

export async function toggleSavedSearchAlertsAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const searchId = safeString(formData.get('searchId'));
  if (!searchId) return;

  const current = adapter.query<{ notifyOnMatch: number }>(
    `SELECT notify_on_match as notifyOnMatch FROM mk_saved_searches_local WHERE id = ?`,
    [searchId],
  )[0];

  adapter.execute(
    `UPDATE mk_saved_searches_local SET notify_on_match = ? WHERE id = ?`,
    [current?.notifyOnMatch ? 0 : 1, searchId],
  );

  revalidateMarketPaths();
  redirect('/market/saved-searches');
}

export async function sendMessageAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const conversationId = safeString(formData.get('conversationId'));
  const rawBody = safeString(formData.get('body'));
  const encrypted = normalizeBool(formData.get('encrypted'));
  const passphrase = safeString(formData.get('passphrase')) || 'market-demo-key';
  if (!conversationId || !rawBody) return;

  let contentType: Message['contentType'] = 'text/plain';
  let body: string | null = rawBody;
  let ciphertext: string | null = null;
  let encryptionAlgorithm: Message['encryptionAlgorithm'] = null;
  let encryptionSalt: string | null = null;
  let encryptionIv: string | null = null;

  if (encrypted) {
    const envelope = await encryptMarketMessageBody(rawBody, passphrase);
    contentType = envelope.contentType;
    body = null;
    ciphertext = envelope.ciphertext;
    encryptionAlgorithm = envelope.encryptionAlgorithm;
    encryptionSalt = envelope.encryptionSalt;
    encryptionIv = envelope.encryptionIv;
  }

  const createdAt = new Date().toISOString();
  adapter.execute(
    `INSERT INTO mk_messages_cache
     (id, conversation_id, sender_id, body, content_type, ciphertext, encryption_algorithm, encryption_salt, encryption_iv, created_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      conversationId,
      LOCAL_USER_ID,
      body,
      contentType,
      ciphertext,
      encryptionAlgorithm,
      encryptionSalt,
      encryptionIv,
      createdAt,
    ],
  );
  adapter.execute(
    `UPDATE mk_conversations_cache SET last_message_at = ? WHERE id = ?`,
    [createdAt, conversationId],
  );

  revalidateMarketPaths();
  redirect(`/market/messages/${conversationId}?sent=1`);
}

export async function createOfferAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const listingId = safeString(formData.get('listingId'));
  const amount = safeNumber(formData.get('amount'));
  const message = safeString(formData.get('message')) || null;
  if (!listingId || amount == null) return;

  const listing = getCachedListingById(marketDb(adapter), listingId);
  if (!listing) return;

  const now = new Date().toISOString();
  adapter.execute(
    `INSERT INTO mk_offers_cache
     (id, listing_id, buyer_id, seller_id, amount_cents, currency, status, counter_amount_cents, message, expires_at, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, 'USD', 'pending', NULL, ?, ?, ?, ?, datetime('now'))`,
    [
      crypto.randomUUID(),
      listingId,
      LOCAL_USER_ID,
      listing.sellerId,
      Math.round(amount * 100),
      message,
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      now,
      now,
    ],
  );

  revalidateMarketPaths();
  redirect('/market/offers?tab=sent&created=1');
}

export async function respondToOfferAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const offerId = safeString(formData.get('offerId'));
  const action = safeString(formData.get('action'));
  const counterAmount = safeNumber(formData.get('counterAmount'));
  if (!offerId || !action) return;

  const nextStatus =
    action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'countered';

  adapter.execute(
    `UPDATE mk_offers_cache
     SET status = ?, counter_amount_cents = ?, updated_at = ?
     WHERE id = ?`,
    [
      nextStatus,
      nextStatus === 'countered' && counterAmount != null ? Math.round(counterAmount * 100) : null,
      new Date().toISOString(),
      offerId,
    ],
  );

  revalidateMarketPaths();
  redirect('/market/offers?tab=received&updated=1');
}

export async function processCheckoutAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const listingId = safeString(formData.get('listingId'));
  const listing = listingId ? getCachedListingById(marketDb(adapter), listingId) : undefined;
  if (!listing) return;

  const now = new Date().toISOString();
  const paymentId = crypto.randomUUID();
  const shipmentId = crypto.randomUUID();
  const amountCents = listing.priceCents ?? 0;
  const feeCents = Math.round(amountCents * 0.03);

  adapter.execute(
    `INSERT INTO mk_payments_cache
     (id, listing_id, buyer_id, seller_id, stripe_payment_intent_id, amount_cents, processing_fee_cents, fee_payer, currency, status, refund_amount_cents, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'buyer', 'USD', 'processing', NULL, ?, ?, datetime('now'))`,
    [
      paymentId,
      listing.id,
      LOCAL_USER_ID,
      listing.sellerId,
      `pi_local_${paymentId.slice(0, 8)}`,
      amountCents,
      feeCents,
      now,
      now,
    ],
  );

  adapter.execute(
    `INSERT INTO mk_shipments_cache
     (id, payment_id, listing_id, seller_id, buyer_id, carrier, tracking_number, status, estimated_delivery_date, actual_delivery_date, last_carrier_update, last_checked_at, created_at, updated_at, cached_at)
     VALUES (?, ?, ?, ?, ?, 'ups', ?, 'label_created', ?, NULL, ?, ?, ?, ?, datetime('now'))`,
    [
      shipmentId,
      paymentId,
      listing.id,
      listing.sellerId,
      LOCAL_USER_ID,
      `UPS${paymentId.slice(0, 8).toUpperCase()}`,
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      'Label created and awaiting carrier scan.',
      now,
      now,
      now,
    ],
  );

  adapter.execute(`UPDATE mk_listings_cache SET status = 'pending', updated_at = ? WHERE id = ?`, [now, listing.id]);

  revalidateMarketPaths();
  redirect(`/market/orders/${paymentId}?paid=1`);
}

export async function submitDisputeAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const paymentId = safeString(formData.get('paymentId'));
  const reason = safeString(formData.get('reason')) || 'other';
  const description = safeString(formData.get('description'));
  if (!paymentId || !description) return;

  const payment = getPayments(adapter).find((item) => item.id === paymentId);
  if (!payment) return;

  const disputeId = crypto.randomUUID();
  const now = new Date().toISOString();
  adapter.execute(
    `INSERT INTO mk_disputes_cache
     (id, payment_id, listing_id, buyer_id, seller_id, reason, description, status, resolution_type, refund_amount_cents, filed_at, seller_response_deadline, resolved_at, created_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, ?, ?, NULL, ?, datetime('now'))`,
    [
      disputeId,
      payment.id,
      payment.listingId,
      payment.buyerId,
      payment.sellerId,
      reason,
      description,
      now,
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      now,
    ],
  );

  adapter.execute(
    `INSERT INTO mk_dispute_messages_local (id, dispute_id, sender_name, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), disputeId, personName(LOCAL_USER_ID), description, now],
  );

  revalidateMarketPaths();
  redirect(`/market/disputes/${disputeId}?opened=1`);
}

export async function addDisputeMessageAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const disputeId = safeString(formData.get('disputeId'));
  const body = safeString(formData.get('body'));
  if (!disputeId || !body) return;

  adapter.execute(
    `INSERT INTO mk_dispute_messages_local (id, dispute_id, sender_name, body, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), disputeId, personName(LOCAL_USER_ID), body, new Date().toISOString()],
  );

  revalidateMarketPaths();
  redirect(`/market/disputes/${disputeId}`);
}

export async function submitReportAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const listingId = safeString(formData.get('listingId')) || null;
  const userId = safeString(formData.get('userId')) || null;
  const reason = safeString(formData.get('reason')) || 'other';
  const details = safeString(formData.get('details')) || null;
  const blockUser = normalizeBool(formData.get('blockUser'));

  adapter.execute(
    `INSERT INTO mk_reports_local (id, reporter_id, listing_id, user_id, reason, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), LOCAL_USER_ID, listingId, userId, reason, details, new Date().toISOString()],
  );

  if (blockUser && userId) {
    adapter.execute(
      `INSERT INTO mk_blocks_local (id, blocker_id, blocked_id, blocked_name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), LOCAL_USER_ID, userId, personName(userId), new Date().toISOString()],
    );
  }

  revalidateMarketPaths();
  redirect('/market/report?submitted=1');
}

export async function updateSettingAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const key = safeString(formData.get('key'));
  const value = safeString(formData.get('value'));
  const section = safeString(formData.get('section')) || 'account';
  if (!key) return;

  adapter.execute(
    `INSERT INTO mk_settings_local (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, new Date().toISOString()],
  );

  revalidateMarketPaths();
  redirect(`/market/settings?section=${section}&saved=1`);
}

export async function toggleBlockUserAction(formData: FormData) {
  const adapter = dbAdapter();
  seed(adapter);
  const blockedId = safeString(formData.get('blockedId'));
  const blockedName = safeString(formData.get('blockedName')) || personName(blockedId);
  if (!blockedId) return;

  const existing = adapter.query<{ id: string }>(
    `SELECT id FROM mk_blocks_local WHERE blocker_id = ? AND blocked_id = ? LIMIT 1`,
    [LOCAL_USER_ID, blockedId],
  )[0];

  if (existing) {
    adapter.execute(`DELETE FROM mk_blocks_local WHERE id = ?`, [existing.id]);
  } else {
    adapter.execute(
      `INSERT INTO mk_blocks_local (id, blocker_id, blocked_id, blocked_name, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), LOCAL_USER_ID, blockedId, blockedName, new Date().toISOString()],
    );
  }

  revalidateMarketPaths();
  redirect('/market/settings?section=blocked-users');
}
