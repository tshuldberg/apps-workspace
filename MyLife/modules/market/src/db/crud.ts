/**
 * Local SQLite CRUD operations for the market cache.
 * These read/write from the local cache tables for offline support.
 * Write-through to Supabase happens via the cloud client.
 */

import type { Listing, Category, Conversation, Message, WatchlistItem } from '../types';

/** Database adapter interface matching the hub's SQLite wrapper. */
export interface DatabaseAdapter {
  run(sql: string, params?: unknown[]): void;
  get<T>(sql: string, params?: unknown[]): T | undefined;
  all<T>(sql: string, params?: unknown[]): T[];
}

const CATEGORY_COLUMNS = [
  'id',
  'parent_id as parentId',
  'name',
  'slug',
  'icon',
  'sort_order as sortOrder',
].join(', ');

const LISTING_COLUMNS = [
  'id',
  'seller_id as sellerId',
  'category_id as categoryId',
  'title',
  'description',
  'price_cents as priceCents',
  'currency',
  'pricing_type as pricingType',
  'condition',
  'listing_type as listingType',
  'status',
  'location_name as locationName',
  'latitude',
  'longitude',
  'fulfillment_type as fulfillmentType',
  'service_radius_miles as serviceRadiusMiles',
  'availability_notes as availabilityNotes',
  'trade_for as tradeFor',
  'view_count as viewCount',
  'watch_count as watchCount',
  'message_count as messageCount',
  'created_at as createdAt',
  'updated_at as updatedAt',
  'expires_at as expiresAt',
].join(', ');

const WATCHLIST_COLUMNS = [
  'id',
  'user_id as userId',
  'listing_id as listingId',
  'created_at as createdAt',
].join(', ');

const CONVERSATION_COLUMNS = [
  'id',
  'listing_id as listingId',
  'buyer_id as buyerId',
  'seller_id as sellerId',
  'last_message_at as lastMessageAt',
  'created_at as createdAt',
].join(', ');

const MESSAGE_COLUMNS = [
  'id',
  'conversation_id as conversationId',
  'sender_id as senderId',
  'body',
  'content_type as contentType',
  'ciphertext',
  'encryption_algorithm as encryptionAlgorithm',
  'encryption_salt as encryptionSalt',
  'encryption_iv as encryptionIv',
  'created_at as createdAt',
].join(', ');

// ── Categories ───────────────────────────────────────────────────────

export function getCachedCategories(db: DatabaseAdapter): Category[] {
  return db.all<Category>(
    `SELECT ${CATEGORY_COLUMNS} FROM mk_categories_cache ORDER BY sort_order`,
  );
}

export function upsertCachedCategory(db: DatabaseAdapter, category: Category): void {
  db.run(
    `INSERT OR REPLACE INTO mk_categories_cache (id, parent_id, name, slug, icon, sort_order, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [category.id, category.parentId, category.name, category.slug, category.icon, category.sortOrder],
  );
}

// ── Listings ─────────────────────────────────────────────────────────

export function getCachedListings(
  db: DatabaseAdapter,
  options?: { categoryId?: string; status?: string; limit?: number; offset?: number },
): Listing[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.categoryId) {
    conditions.push('category_id = ?');
    params.push(options.categoryId);
  }
  if (options?.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rawLimit = Math.max(1, Math.min(200, Math.trunc(options?.limit ?? 50)));
  const rawOffset = Math.max(0, Math.trunc(options?.offset ?? 0));
  const limit = `LIMIT ${rawLimit}`;
  const offset = rawOffset > 0 ? `OFFSET ${rawOffset}` : '';

  return db.all<Listing>(
    `SELECT ${LISTING_COLUMNS} FROM mk_listings_cache ${where} ORDER BY created_at DESC ${limit} ${offset}`,
    params,
  );
}

export function getCachedListingById(db: DatabaseAdapter, id: string): Listing | undefined {
  return db.get<Listing>(`SELECT ${LISTING_COLUMNS} FROM mk_listings_cache WHERE id = ?`, [id]);
}

export function upsertCachedListing(db: DatabaseAdapter, listing: Listing): void {
  db.run(
    `INSERT OR REPLACE INTO mk_listings_cache
     (id, seller_id, category_id, title, description, price_cents, currency, pricing_type,
      condition, listing_type, status, location_name, latitude, longitude, fulfillment_type,
      service_radius_miles, availability_notes, trade_for,
      view_count, watch_count, message_count, created_at, updated_at, expires_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      listing.id, listing.sellerId, listing.categoryId, listing.title, listing.description,
      listing.priceCents, listing.currency, listing.pricingType, listing.condition,
      listing.listingType, listing.status, listing.locationName, listing.latitude,
      listing.longitude, listing.fulfillmentType, listing.serviceRadiusMiles,
      listing.availabilityNotes, listing.tradeFor, listing.viewCount, listing.watchCount,
      listing.messageCount, listing.createdAt, listing.updatedAt, listing.expiresAt,
    ],
  );
}

export function deleteCachedListing(db: DatabaseAdapter, id: string): void {
  db.run('DELETE FROM mk_listings_cache WHERE id = ?', [id]);
}

// ── Watchlist ────────────────────────────────────────────────────────

export function getCachedWatchlist(db: DatabaseAdapter, userId: string): WatchlistItem[] {
  return db.all<WatchlistItem>(
    `SELECT ${WATCHLIST_COLUMNS} FROM mk_watchlist_cache WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
    [userId],
  );
}

export function upsertCachedWatchlistItem(db: DatabaseAdapter, item: WatchlistItem): void {
  db.run(
    `INSERT OR REPLACE INTO mk_watchlist_cache (id, user_id, listing_id, created_at, cached_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [item.id, item.userId, item.listingId, item.createdAt],
  );
}

export function deleteCachedWatchlistItem(db: DatabaseAdapter, id: string): void {
  db.run('DELETE FROM mk_watchlist_cache WHERE id = ?', [id]);
}

// ── Conversations ────────────────────────────────────────────────────

export function getCachedConversations(db: DatabaseAdapter, userId: string): Conversation[] {
  return db.all<Conversation>(
    `SELECT ${CONVERSATION_COLUMNS} FROM mk_conversations_cache
     WHERE buyer_id = ? OR seller_id = ?
     ORDER BY last_message_at DESC LIMIT 100`,
    [userId, userId],
  );
}

export function getCachedMessages(db: DatabaseAdapter, conversationId: string): Message[] {
  return db.all<Message>(
    `SELECT ${MESSAGE_COLUMNS} FROM mk_messages_cache WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 200`,
    [conversationId],
  );
}

export function upsertCachedConversation(db: DatabaseAdapter, conv: Conversation): void {
  db.run(
    `INSERT OR REPLACE INTO mk_conversations_cache
     (id, listing_id, buyer_id, seller_id, last_message_at, created_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [conv.id, conv.listingId, conv.buyerId, conv.sellerId, conv.lastMessageAt, conv.createdAt],
  );
}

export function upsertCachedMessage(db: DatabaseAdapter, msg: Message): void {
  db.run(
    `INSERT OR REPLACE INTO mk_messages_cache
     (id, conversation_id, sender_id, body, content_type, ciphertext, encryption_algorithm,
      encryption_salt, encryption_iv, created_at, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      msg.id,
      msg.conversationId,
      msg.senderId,
      msg.body,
      msg.contentType,
      msg.ciphertext,
      msg.encryptionAlgorithm,
      msg.encryptionSalt,
      msg.encryptionIv,
      msg.createdAt,
    ],
  );
}
