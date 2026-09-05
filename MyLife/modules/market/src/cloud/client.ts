/**
 * Supabase cloud client for MyMarket.
 * All functions accept a SupabaseClient as the first parameter for dependency injection.
 * Returns Result<T> for consistent error handling.
 */

import { emitMarketListingCreated, emitMarketListingSold } from '@mylife/social';
import type {
  Listing,
  CreateListingInput,
  CreateMessageInput,
  CreateConversationRequestInput,
  PublishDeviceBundleInput,
  CreateSecureEnvelopeInput,
  Category,
  Conversation,
  Message,
  ConversationRequest,
  SecureDevice,
  SignedPreKey,
  OneTimePreKey,
  RecipientPreKeyBundle,
  SecureEnvelope,
  WatchlistItem,
  Review,
  SellerStats,
  SavedSearch,
  Offer,
  PriceHistory,
  Shipment,
  ServicePortfolioItem,
  ServiceAvailability,
  SellerVerification,
  Report,
  Block,
} from '../types';

type SupabaseQueryResult = {
  data: unknown;
  error: unknown;
};

/** Minimal Supabase client interface for dependency injection. */
interface SupabaseClient {
  from(table: string): SupabaseQueryBuilder;
  rpc(fn: string, params?: Record<string, unknown>): PromiseLike<SupabaseQueryResult>;
  auth: {
    getUser(): PromiseLike<{
      data: { user: { id: string } | null };
      error?: unknown;
    }>;
  };
}

interface SupabaseQueryBuilder extends PromiseLike<SupabaseQueryResult> {
  select(columns?: string): SupabaseQueryBuilder;
  insert(data: Record<string, unknown> | Record<string, unknown>[]): SupabaseQueryBuilder;
  update(data: Record<string, unknown>): SupabaseQueryBuilder;
  delete(): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  in(column: string, values: unknown[]): SupabaseQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder;
  limit(count: number): SupabaseQueryBuilder;
  range(from: number, to: number): SupabaseQueryBuilder;
  textSearch(column: string, query: string): SupabaseQueryBuilder;
  single(): PromiseLike<SupabaseQueryResult>;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
type ConversationRequestAction = Extract<
  ConversationRequest['status'],
  'accepted' | 'rejected' | 'blocked'
>;

interface MarketCategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}

interface MarketListingRow {
  id: string;
  seller_id: string;
  category_id: string;
  title: string;
  description: string;
  price_cents: number | null;
  currency: string;
  pricing_type: Listing['pricingType'];
  condition: Listing['condition'] | null;
  listing_type: Listing['listingType'];
  status: Listing['status'];
  location_name: string | null;
  location?: unknown;
  latitude?: number | null;
  longitude?: number | null;
  fulfillment_type: Listing['fulfillmentType'] | null;
  service_radius_miles: number | null;
  availability_notes: string | null;
  trade_for: string | null;
  view_count: number;
  watch_count: number;
  message_count: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

interface MarketConversationRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string | null;
  created_at: string;
}

interface MarketMessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  content_type: Message['contentType'];
  ciphertext: string | null;
  encryption_algorithm: Message['encryptionAlgorithm'];
  encryption_salt: string | null;
  encryption_iv: string | null;
  created_at: string;
}

interface MarketWatchlistRow {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
}

interface MarketReviewRow {
  id: string;
  reviewer_id: string;
  seller_id: string;
  listing_id: string;
  rating: number;
  body: string | null;
  created_at: string;
}

interface MarketSellerStatsRow {
  seller_id: string;
  total_listings: number;
  active_listings: number;
  total_sold: number;
  average_rating: number | null;
  review_count: number;
  response_rate: number | null;
  member_since: string;
}

interface MarketSavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  query: string;
  category_id: string | null;
  min_price_cents: number | null;
  max_price_cents: number | null;
  notify_on_match: boolean;
  created_at: string;
}

interface MarketConversationRequestRow {
  id: string;
  conversation_id: string;
  listing_id: string;
  requester_id: string;
  responder_id: string;
  friend_link_id: string | null;
  status: ConversationRequest['status'];
  created_at: string;
  responded_at: string | null;
}

interface MarketSecureDeviceRow {
  id: string;
  user_id: string;
  platform: SecureDevice['platform'];
  label: string | null;
  identity_key: string;
  registration_id: number;
  supports_sealed_sender: boolean;
  supports_post_quantum: boolean;
  created_at: string;
  last_seen_at: string;
}

interface MarketSignedPreKeyRow {
  id: string;
  device_id: string;
  key_id: number;
  algorithm: SignedPreKey['algorithm'];
  public_key: string;
  signature: string;
  created_at: string;
  expires_at: string | null;
}

interface MarketOneTimePreKeyRow {
  id: string;
  device_id: string;
  key_id: number;
  kind: OneTimePreKey['kind'];
  public_key: string;
  is_consumed: boolean;
  created_at: string;
  consumed_at: string | null;
}

interface MarketSecureEnvelopeRow {
  id: string;
  conversation_id: string;
  request_id: string | null;
  sender_id: string;
  sender_device_id: string;
  recipient_id: string;
  recipient_device_id: string;
  envelope_type: SecureEnvelope['envelopeType'];
  protocol_version: string;
  ciphertext: string;
  registration_id: number | null;
  message_index: number | null;
  previous_chain_length: number | null;
  sent_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

interface MarketRecipientPreKeyBundleRow {
  device: MarketSecureDeviceRow;
  signed_prekey: MarketSignedPreKeyRow;
  curve_one_time_prekey: MarketOneTimePreKeyRow | null;
  pq_one_time_prekey: MarketOneTimePreKeyRow | null;
  pq_last_resort_prekey: MarketOneTimePreKeyRow | null;
}

function parseLocationCoordinates(
  location: unknown,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): { latitude: number | null; longitude: number | null } {
  if (typeof latitude === 'number' || typeof longitude === 'number') {
    return {
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    };
  }

  if (location && typeof location === 'object' && 'coordinates' in location) {
    const coordinates = (location as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const [lng, lat] = coordinates;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  if (typeof location === 'string') {
    const pointMatch = location.match(/POINT\(([-\d.]+)\s+([-\d.]+)\)/i);
    if (pointMatch) {
      return {
        latitude: Number(pointMatch[2]),
        longitude: Number(pointMatch[1]),
      };
    }

    try {
      const parsed = JSON.parse(location) as { coordinates?: unknown };
      return parseLocationCoordinates(parsed, null, null);
    } catch {
      return { latitude: null, longitude: null };
    }
  }

  return { latitude: null, longitude: null };
}

function isServiceListingType(listingType: Listing['listingType']): boolean {
  return listingType === 'service_offer' || listingType === 'service_request';
}

function normalizeMessageInsert(
  input: string | CreateMessageInput,
): Record<string, unknown> {
  if (typeof input === 'string') {
    return {
      body: input,
      content_type: 'text/plain',
      ciphertext: null,
      encryption_algorithm: null,
      encryption_salt: null,
      encryption_iv: null,
    };
  }

  if ('body' in input) {
    return {
      body: input.body,
      content_type: 'text/plain',
      ciphertext: null,
      encryption_algorithm: null,
      encryption_salt: null,
      encryption_iv: null,
    };
  }

  return {
    body: null,
    content_type: input.contentType,
    ciphertext: input.ciphertext,
    encryption_algorithm: input.encryptionAlgorithm,
    encryption_salt: input.encryptionSalt,
    encryption_iv: input.encryptionIv,
  };
}

function mapCategoryRow(row: MarketCategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    sortOrder: row.sort_order,
  };
}

function mapListingRow(row: MarketListingRow): Listing {
  const coordinates = parseLocationCoordinates(row.location, row.latitude, row.longitude);
  const serviceListing = isServiceListingType(row.listing_type);

  return {
    id: row.id,
    sellerId: row.seller_id,
    categoryId: row.category_id,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    pricingType: row.pricing_type,
    condition: serviceListing ? null : row.condition,
    listingType: row.listing_type,
    status: row.status,
    locationName: row.location_name,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    fulfillmentType: row.fulfillment_type,
    serviceRadiusMiles: row.service_radius_miles,
    availabilityNotes: row.availability_notes,
    tradeFor: row.trade_for,
    viewCount: row.view_count,
    watchCount: row.watch_count,
    messageCount: row.message_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}

function mapConversationRow(row: MarketConversationRow): Conversation {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    lastMessageAt: row.last_message_at,
    createdAt: row.created_at,
  };
}

function mapMessageRow(row: MarketMessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    contentType: row.content_type,
    ciphertext: row.ciphertext,
    encryptionAlgorithm: row.encryption_algorithm,
    encryptionSalt: row.encryption_salt,
    encryptionIv: row.encryption_iv,
    createdAt: row.created_at,
  };
}

function mapWatchlistRow(row: MarketWatchlistRow): WatchlistItem {
  return {
    id: row.id,
    userId: row.user_id,
    listingId: row.listing_id,
    createdAt: row.created_at,
  };
}

function mapReviewRow(row: MarketReviewRow): Review {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    sellerId: row.seller_id,
    listingId: row.listing_id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
  };
}

function mapSellerStatsRow(row: MarketSellerStatsRow): SellerStats {
  return {
    sellerId: row.seller_id,
    totalListings: row.total_listings,
    activeListings: row.active_listings,
    totalSold: row.total_sold,
    averageRating: row.average_rating,
    reviewCount: row.review_count,
    responseRate: row.response_rate,
    memberSince: row.member_since,
  };
}

function mapSavedSearchRow(row: MarketSavedSearchRow): SavedSearch {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    query: row.query,
    categoryId: row.category_id,
    minPriceCents: row.min_price_cents,
    maxPriceCents: row.max_price_cents,
    notifyOnMatch: row.notify_on_match,
    createdAt: row.created_at,
  };
}

function mapConversationRequestRow(row: MarketConversationRequestRow): ConversationRequest {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    listingId: row.listing_id,
    requesterId: row.requester_id,
    responderId: row.responder_id,
    friendLinkId: row.friend_link_id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
  };
}

function mapSecureDeviceRow(row: MarketSecureDeviceRow): SecureDevice {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform,
    label: row.label,
    identityKey: row.identity_key,
    registrationId: row.registration_id,
    supportsSealedSender: row.supports_sealed_sender,
    supportsPostQuantum: row.supports_post_quantum,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapSignedPreKeyRow(row: MarketSignedPreKeyRow): SignedPreKey {
  return {
    id: row.id,
    deviceId: row.device_id,
    keyId: row.key_id,
    algorithm: row.algorithm,
    publicKey: row.public_key,
    signature: row.signature,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function mapOneTimePreKeyRow(row: MarketOneTimePreKeyRow): OneTimePreKey {
  return {
    id: row.id,
    deviceId: row.device_id,
    keyId: row.key_id,
    kind: row.kind,
    publicKey: row.public_key,
    isConsumed: row.is_consumed,
    createdAt: row.created_at,
    consumedAt: row.consumed_at,
  };
}

function mapSecureEnvelopeRow(row: MarketSecureEnvelopeRow): SecureEnvelope {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    requestId: row.request_id,
    senderId: row.sender_id,
    senderDeviceId: row.sender_device_id,
    recipientId: row.recipient_id,
    recipientDeviceId: row.recipient_device_id,
    envelopeType: row.envelope_type,
    protocolVersion: row.protocol_version,
    ciphertext: row.ciphertext,
    registrationId: row.registration_id,
    messageIndex: row.message_index,
    previousChainLength: row.previous_chain_length,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
  };
}

function toListingInsert(input: CreateListingInput, sellerId: string): Record<string, unknown> {
  const hasCoordinates =
    typeof input.latitude === 'number' && typeof input.longitude === 'number';
  const serviceListing = isServiceListingType(input.listingType);

  return {
    seller_id: sellerId,
    category_id: input.categoryId,
    title: input.title,
    description: input.description,
    price_cents: input.priceCents ?? null,
    currency: input.currency ?? 'USD',
    pricing_type: input.pricingType,
    condition: serviceListing ? null : input.condition ?? 'good',
    listing_type: input.listingType,
    location_name: input.locationName ?? null,
    location: hasCoordinates ? `POINT(${input.longitude} ${input.latitude})` : null,
    fulfillment_type: input.fulfillmentType ?? null,
    service_radius_miles: input.serviceRadiusMiles ?? null,
    availability_notes: input.availabilityNotes ?? null,
    trade_for: input.tradeFor ?? null,
  };
}

function toSecureDeviceInsert(
  input: PublishDeviceBundleInput,
  userId: string,
): Record<string, unknown> {
  return {
    user_id: userId,
    platform: input.platform,
    label: input.label ?? null,
    identity_key: input.identityKey,
    registration_id: input.registrationId,
    supports_sealed_sender: input.supportsSealedSender ?? true,
    supports_post_quantum: input.supportsPostQuantum ?? true,
  };
}

function toOneTimePreKeyInsertRows(
  deviceId: string,
  input: PublishDeviceBundleInput,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  for (const preKey of input.curveOneTimePreKeys ?? []) {
    rows.push({
      device_id: deviceId,
      key_id: preKey.keyId,
      kind: 'curve25519',
      public_key: preKey.publicKey,
    });
  }

  for (const preKey of input.pqOneTimePreKeys ?? []) {
    rows.push({
      device_id: deviceId,
      key_id: preKey.keyId,
      kind: 'kyber1024',
      public_key: preKey.publicKey,
    });
  }

  if (input.pqLastResortPreKey) {
    rows.push({
      device_id: deviceId,
      key_id: input.pqLastResortPreKey.keyId,
      kind: 'kyber1024_last_resort',
      public_key: input.pqLastResortPreKey.publicKey,
    });
  }

  return rows;
}

function toSecureEnvelopeInsert(
  input: CreateSecureEnvelopeInput,
  senderId: string,
): Record<string, unknown> {
  return {
    conversation_id: input.conversationId,
    request_id: input.requestId ?? null,
    sender_id: senderId,
    sender_device_id: input.senderDeviceId,
    recipient_id: input.recipientId,
    recipient_device_id: input.recipientDeviceId,
    envelope_type: input.envelopeType,
    protocol_version: input.protocolVersion,
    ciphertext: input.ciphertext,
    registration_id: input.registrationId ?? null,
    message_index: input.messageIndex ?? null,
    previous_chain_length: input.previousChainLength ?? null,
  };
}

function mapRecipientPreKeyBundleRow(
  row: MarketRecipientPreKeyBundleRow,
): RecipientPreKeyBundle {
  return {
    device: mapSecureDeviceRow(row.device),
    signedPreKey: mapSignedPreKeyRow(row.signed_prekey),
    curveOneTimePreKey: row.curve_one_time_prekey
      ? mapOneTimePreKeyRow(row.curve_one_time_prekey)
      : null,
    pqOneTimePreKey: row.pq_one_time_prekey
      ? mapOneTimePreKeyRow(row.pq_one_time_prekey)
      : null,
    pqLastResortPreKey: row.pq_last_resort_prekey
      ? mapOneTimePreKeyRow(row.pq_last_resort_prekey)
      : null,
  };
}

// ── Categories ───────────────────────────────────────────────────────

export async function cloudGetCategories(supabase: SupabaseClient): Promise<Result<Category[]>> {
  const { data, error } = await supabase
    .from('mk_categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketCategoryRow[] | null ?? []).map(mapCategoryRow) };
}

// ── Listings ─────────────────────────────────────────────────────────

export async function cloudGetListings(
  supabase: SupabaseClient,
  options?: { categoryId?: string; limit?: number; offset?: number },
): Promise<Result<Listing[]>> {
  let query = supabase
    .from('mk_listings')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (options?.categoryId) query = query.eq('category_id', options.categoryId);
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketListingRow[] | null ?? []).map(mapListingRow) };
}

export async function cloudGetListingById(
  supabase: SupabaseClient,
  id: string,
): Promise<Result<Listing>> {
  const { data, error } = await supabase
    .from('mk_listings')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapListingRow(data as MarketListingRow) };
}

export async function cloudCreateListing(
  supabase: SupabaseClient,
  input: CreateListingInput,
): Promise<Result<Listing>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_listings')
    .insert(toListingInsert(input, user.id))
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };

  const listing = mapListingRow(data as MarketListingRow);
  void emitMarketListingCreated(`Listed ${listing.title}`, {
    listingTitle: listing.title,
    category: listing.categoryId,
    priceCents: listing.priceCents ?? undefined,
  });

  return { ok: true, data: listing };
}

export async function cloudUpdateListingStatus(
  supabase: SupabaseClient,
  listingId: string,
  status: string,
): Promise<Result<Listing>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_listings')
    .update({ status })
    .eq('id', listingId)
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };

  const listing = mapListingRow(data as MarketListingRow);
  if (status === 'sold') {
    void emitMarketListingSold(`Sold ${listing.title}`, {
      listingTitle: listing.title,
      priceCents: listing.priceCents ?? undefined,
    });
  }

  return { ok: true, data: listing };
}

export async function cloudSearchListings(
  supabase: SupabaseClient,
  query: string,
): Promise<Result<Listing[]>> {
  const { data, error } = await supabase
    .from('mk_listings')
    .select('*')
    .textSearch('search_vector', query)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketListingRow[] | null ?? []).map(mapListingRow) };
}

export async function cloudGetListingsWithinRadius(
  supabase: SupabaseClient,
  lat: number,
  lng: number,
  radiusMiles: number = 25,
  limit: number = 50,
): Promise<Result<Listing[]>> {
  const { data, error } = await supabase.rpc('mk_listings_within_radius', {
    lat,
    lng,
    radius_miles: radiusMiles,
    result_limit: limit,
  });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketListingRow[] | null ?? []).map(mapListingRow) };
}

// ── Conversations & Messages ─────────────────────────────────────────

export async function cloudGetConversations(
  supabase: SupabaseClient,
): Promise<Result<Conversation[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_conversations')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketConversationRow[] | null ?? []).map(mapConversationRow) };
}

export async function cloudStartConversation(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Result<Conversation>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data: listing, error: listingError } = await supabase
    .from('mk_listings')
    .select('seller_id')
    .eq('id', listingId)
    .single();

  if (listingError) return { ok: false, error: String(listingError) };

  const sellerId = (listing as { seller_id?: string } | null)?.seller_id;
  if (!sellerId) return { ok: false, error: 'Listing seller was not found' };
  if (sellerId === user.id) {
    return { ok: false, error: 'You cannot message your own listing' };
  }

  const { data, error } = await supabase
    .from('mk_conversations')
    .insert({
      listing_id: listingId,
      buyer_id: user.id,
      seller_id: sellerId,
    })
    .select('*')
    .single();

  if (error) {
    const errorCode = (error as { code?: string } | null)?.code;
    if (errorCode === '23505') {
      const { data: existing, error: existingError } = await supabase
        .from('mk_conversations')
        .select('*')
        .eq('listing_id', listingId)
        .eq('buyer_id', user.id)
        .single();

      if (existingError) return { ok: false, error: String(existingError) };
      return { ok: true, data: mapConversationRow(existing as MarketConversationRow) };
    }

    return { ok: false, error: String(error) };
  }

  return { ok: true, data: mapConversationRow(data as MarketConversationRow) };
}

export async function cloudCreateConversationRequest(
  supabase: SupabaseClient,
  input: CreateConversationRequestInput,
): Promise<Result<ConversationRequest>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const conversationResult = await cloudStartConversation(supabase, input.listingId);
  if (!conversationResult.ok) return conversationResult;

  const conversation = conversationResult.data;
  const { data, error } = await supabase
    .from('mk_message_requests')
    .insert({
      conversation_id: conversation.id,
      listing_id: input.listingId,
      requester_id: user.id,
      responder_id: conversation.sellerId,
      friend_link_id: input.friendLinkId ?? null,
    })
    .select('*')
    .single();

  if (error) {
    const errorCode = (error as { code?: string } | null)?.code;
    if (errorCode === '23505') {
      const { data: existing, error: existingError } = await supabase
        .from('mk_message_requests')
        .select('*')
        .eq('conversation_id', conversation.id)
        .single();

      if (existingError) return { ok: false, error: String(existingError) };
      return {
        ok: true,
        data: mapConversationRequestRow(existing as MarketConversationRequestRow),
      };
    }

    return { ok: false, error: String(error) };
  }

  return { ok: true, data: mapConversationRequestRow(data as MarketConversationRequestRow) };
}

export async function cloudRespondToConversationRequest(
  supabase: SupabaseClient,
  requestId: string,
  action: ConversationRequestAction,
): Promise<Result<ConversationRequest>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const respondedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('mk_message_requests')
    .update({
      status: action,
      responded_at: respondedAt,
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };

  const request = mapConversationRequestRow(data as MarketConversationRequestRow);

  if (action === 'blocked' && request.responderId === user.id) {
    // Best-effort block insert: request status is already committed as 'blocked',
    // so we return the request even if the block record fails (can be retried).
    const { error: blockError } = await supabase.from('mk_blocks').insert({
      blocker_id: request.responderId,
      blocked_id: request.requesterId,
    });

    const blockErrorCode = (blockError as { code?: string } | null)?.code;
    if (blockError && blockErrorCode !== '23505') {
      // Block insert failed but request is already updated; return success
      // so the caller knows the request state changed.
    }
  }

  return { ok: true, data: request };
}

export async function cloudRegisterSecureDevice(
  supabase: SupabaseClient,
  input: PublishDeviceBundleInput,
): Promise<Result<SecureDevice>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_secure_devices')
    .insert(toSecureDeviceInsert(input, user.id))
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };

  const device = mapSecureDeviceRow(data as MarketSecureDeviceRow);

  const { error: signedPreKeyError } = await supabase.from('mk_signed_prekeys').insert({
    device_id: device.id,
    key_id: input.signedPreKey.keyId,
    algorithm: 'curve25519',
    public_key: input.signedPreKey.publicKey,
    signature: input.signedPreKey.signature,
  });
  if (signedPreKeyError) return { ok: false, error: String(signedPreKeyError) };

  const oneTimePreKeyRows = toOneTimePreKeyInsertRows(device.id, input);
  if (oneTimePreKeyRows.length > 0) {
    const { error: oneTimePreKeyError } = await supabase
      .from('mk_one_time_prekeys')
      .insert(oneTimePreKeyRows);
    if (oneTimePreKeyError) return { ok: false, error: String(oneTimePreKeyError) };
  }

  return { ok: true, data: device };
}

export async function cloudGetRecipientPreKeyBundles(
  supabase: SupabaseClient,
  recipientUserId: string,
): Promise<Result<RecipientPreKeyBundle[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase.rpc('mk_claim_recipient_prekey_bundles', {
    recipient_user_id: recipientUserId,
  });

  if (error) return { ok: false, error: String(error) };

  const bundles = ((data as MarketRecipientPreKeyBundleRow[] | null) ?? [])
    .map(mapRecipientPreKeyBundleRow);

  return { ok: true, data: bundles };
}

export async function cloudGetMessages(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Result<Message[]>> {
  const { data, error } = await supabase
    .from('mk_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketMessageRow[] | null ?? []).map(mapMessageRow) };
}

export async function cloudSendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  input: string | CreateMessageInput,
): Promise<Result<Message>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      ...normalizeMessageInsert(input),
    })
    .select('*')
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapMessageRow(data as MarketMessageRow) };
}

export async function cloudGetSecureEnvelopes(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<Result<SecureEnvelope[]>> {
  const { data, error } = await supabase
    .from('mk_secure_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
    .limit(200);

  if (error) return { ok: false, error: String(error) };
  return {
    ok: true,
    data: (data as MarketSecureEnvelopeRow[] | null ?? []).map(mapSecureEnvelopeRow),
  };
}

export async function cloudSendSecureEnvelope(
  supabase: SupabaseClient,
  input: CreateSecureEnvelopeInput,
): Promise<Result<SecureEnvelope>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_secure_messages')
    .insert(toSecureEnvelopeInsert(input, user.id))
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapSecureEnvelopeRow(data as MarketSecureEnvelopeRow) };
}

// ── Watchlist ────────────────────────────────────────────────────────

export async function cloudGetWatchlist(
  supabase: SupabaseClient,
): Promise<Result<WatchlistItem[]>> {
  const { data, error } = await supabase
    .from('mk_watchlist')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketWatchlistRow[] | null ?? []).map(mapWatchlistRow) };
}

export async function cloudToggleWatch(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Result<{ watched: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  // Check if already watching
  const { data: existing } = await supabase
    .from('mk_watchlist')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('mk_watchlist')
      .delete()
      .eq('id', (existing as { id: string }).id);
    if (error) return { ok: false, error: String(error) };
    return { ok: true, data: { watched: false } };
  } else {
    const { error } = await supabase
      .from('mk_watchlist')
      .insert({ user_id: user.id, listing_id: listingId });
    if (error) return { ok: false, error: String(error) };
    return { ok: true, data: { watched: true } };
  }
}

// ── Reviews ──────────────────────────────────────────────────────────

export async function cloudGetSellerReviews(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<Result<Review[]>> {
  const { data, error } = await supabase
    .from('mk_reviews')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketReviewRow[] | null ?? []).map(mapReviewRow) };
}

export async function cloudGetSellerStats(
  supabase: SupabaseClient,
  sellerId: string,
): Promise<Result<SellerStats>> {
  const { data, error } = await supabase
    .from('mk_seller_stats')
    .select('*')
    .eq('seller_id', sellerId)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapSellerStatsRow(data as MarketSellerStatsRow) };
}

// ── Saved Searches ───────────────────────────────────────────────────

export async function cloudGetSavedSearches(
  supabase: SupabaseClient,
): Promise<Result<SavedSearch[]>> {
  const { data, error } = await supabase
    .from('mk_saved_searches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketSavedSearchRow[] | null ?? []).map(mapSavedSearchRow) };
}

// ── Offers ──────────────────────────────────────────────────────────

interface MarketOfferRow {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount_cents: number;
  currency: string;
  status: Offer['status'];
  counter_amount_cents: number | null;
  message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

function mapOfferRow(row: MarketOfferRow): Offer {
  return {
    id: row.id,
    listingId: row.listing_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    counterAmountCents: row.counter_amount_cents,
    message: row.message,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function cloudMakeOffer(
  supabase: SupabaseClient,
  listingId: string,
  amountCents: number,
  message?: string,
): Promise<Result<Offer>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data: listing, error: listingError } = await supabase
    .from('mk_listings')
    .select('seller_id, status')
    .eq('id', listingId)
    .single();

  if (listingError) return { ok: false, error: String(listingError) };
  const row = listing as { seller_id: string; status: string } | null;
  if (!row) return { ok: false, error: 'Listing not found' };
  if (row.seller_id === user.id) return { ok: false, error: 'Cannot make an offer on your own listing' };
  if (row.status !== 'active') return { ok: false, error: 'Listing is not active' };

  const { data, error } = await supabase
    .from('mk_offers')
    .insert({
      listing_id: listingId,
      buyer_id: user.id,
      seller_id: row.seller_id,
      amount_cents: amountCents,
      message: message ?? null,
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapOfferRow(data as MarketOfferRow) };
}

export async function cloudRespondToOffer(
  supabase: SupabaseClient,
  offerId: string,
  action: 'accepted' | 'rejected' | 'countered',
  counterAmountCents?: number,
): Promise<Result<Offer>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const updateData: Record<string, unknown> = {
    status: action,
    updated_at: new Date().toISOString(),
  };
  if (action === 'countered' && counterAmountCents != null) {
    updateData.counter_amount_cents = counterAmountCents;
  }

  const { data, error } = await supabase
    .from('mk_offers')
    .update(updateData)
    .eq('id', offerId)
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  const offer = mapOfferRow(data as MarketOfferRow);

  if (action === 'accepted') {
    await supabase
      .from('mk_listings')
      .update({ status: 'pending' })
      .eq('id', offer.listingId);
  }

  return { ok: true, data: offer };
}

export async function cloudGetOffersForListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Result<Offer[]>> {
  const { data, error } = await supabase
    .from('mk_offers')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketOfferRow[] | null ?? []).map(mapOfferRow) };
}

export async function cloudGetMyOffers(
  supabase: SupabaseClient,
): Promise<Result<Offer[]>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_offers')
    .select('*')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketOfferRow[] | null ?? []).map(mapOfferRow) };
}

// ── Price History ───────────────────────────────────────────────────

interface MarketPriceHistoryRow {
  id: string;
  listing_id: string;
  old_price_cents: number | null;
  new_price_cents: number | null;
  changed_at: string;
}

function mapPriceHistoryRow(row: MarketPriceHistoryRow): PriceHistory {
  return {
    id: row.id,
    listingId: row.listing_id,
    oldPriceCents: row.old_price_cents,
    newPriceCents: row.new_price_cents,
    changedAt: row.changed_at,
  };
}

export async function cloudUpdateListingPrice(
  supabase: SupabaseClient,
  listingId: string,
  newPriceCents: number,
): Promise<Result<Listing>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data: current, error: fetchError } = await supabase
    .from('mk_listings')
    .select('price_cents, seller_id')
    .eq('id', listingId)
    .single();

  if (fetchError) return { ok: false, error: String(fetchError) };
  const row = current as { price_cents: number | null; seller_id: string } | null;
  if (!row) return { ok: false, error: 'Listing not found' };
  if (row.seller_id !== user.id) return { ok: false, error: 'Not authorized to update this listing' };

  const oldPriceCents = row.price_cents ?? null;

  if (oldPriceCents === newPriceCents) {
    return cloudGetListingById(supabase, listingId);
  }

  const { error: historyError } = await supabase.from('mk_price_history').insert({
    listing_id: listingId,
    old_price_cents: oldPriceCents,
    new_price_cents: newPriceCents,
  });
  if (historyError) return { ok: false, error: String(historyError) };

  const { data, error } = await supabase
    .from('mk_listings')
    .update({ price_cents: newPriceCents, updated_at: new Date().toISOString() })
    .eq('id', listingId)
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapListingRow(data as MarketListingRow) };
}

export async function cloudGetPriceHistory(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Result<PriceHistory[]>> {
  const { data, error } = await supabase
    .from('mk_price_history')
    .select('*')
    .eq('listing_id', listingId)
    .order('changed_at', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketPriceHistoryRow[] | null ?? []).map(mapPriceHistoryRow) };
}

// ── Reports & Blocks ────────────────────────────────────────────────

interface MarketReportRow {
  id: string;
  reporter_id: string;
  listing_id: string | null;
  user_id: string | null;
  reason: Report['reason'];
  details: string | null;
  created_at: string;
}

interface MarketBlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export async function cloudReportListing(
  supabase: SupabaseClient,
  listingId: string,
  reason: string,
  details?: string,
): Promise<Result<Report>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_reports')
    .insert({
      reporter_id: user.id,
      listing_id: listingId,
      reason,
      details: details ?? null,
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  const row = data as MarketReportRow;
  return {
    ok: true,
    data: {
      id: row.id,
      reporterId: row.reporter_id,
      listingId: row.listing_id,
      userId: row.user_id,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
    },
  };
}

export async function cloudReportUser(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  details?: string,
): Promise<Result<Report>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('mk_reports')
    .insert({
      reporter_id: user.id,
      user_id: userId,
      reason,
      details: details ?? null,
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  const row = data as MarketReportRow;
  return {
    ok: true,
    data: {
      id: row.id,
      reporterId: row.reporter_id,
      listingId: row.listing_id,
      userId: row.user_id,
      reason: row.reason,
      details: row.details,
      createdAt: row.created_at,
    },
  };
}

export async function cloudBlockUser(
  supabase: SupabaseClient,
  blockedUserId: string,
): Promise<Result<Block>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };
  if (blockedUserId === user.id) return { ok: false, error: 'Cannot block yourself' };

  const { data, error } = await supabase
    .from('mk_blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedUserId })
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  const row = data as MarketBlockRow;
  return {
    ok: true,
    data: {
      id: row.id,
      blockerId: row.blocker_id,
      blockedId: row.blocked_id,
      createdAt: row.created_at,
    },
  };
}

export async function cloudUnblockUser(
  supabase: SupabaseClient,
  blockedUserId: string,
): Promise<Result<{ unblocked: boolean }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('mk_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId);

  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: { unblocked: true } };
}

// ── Seller Verification ─────────────────────────────────────────────

interface MarketSellerVerificationRow {
  id: string;
  user_id: string;
  email_verified: boolean;
  phone_verified: boolean;
  photo_verified: boolean;
  id_verified: boolean;
  completed_sales: number;
  total_reviews: number;
  average_rating: number | null;
  account_age_days: number;
  verification_level: SellerVerification['verificationLevel'];
  level_achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapSellerVerificationRow(row: MarketSellerVerificationRow): SellerVerification {
  return {
    id: row.id,
    userId: row.user_id,
    emailVerified: row.email_verified,
    phoneVerified: row.phone_verified,
    photoVerified: row.photo_verified,
    idVerified: row.id_verified,
    completedSales: row.completed_sales,
    totalReviews: row.total_reviews,
    averageRating: row.average_rating,
    accountAgeDays: row.account_age_days,
    verificationLevel: row.verification_level,
    levelAchievedAt: row.level_achieved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function cloudGetSellerVerification(
  supabase: SupabaseClient,
  userId: string,
): Promise<Result<SellerVerification>> {
  const { data, error } = await supabase
    .from('mk_seller_verification')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapSellerVerificationRow(data as MarketSellerVerificationRow) };
}

// ── Shipping & Tracking ─────────────────────────────────────────────

interface MarketShipmentRow {
  id: string;
  payment_id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  carrier: Shipment['carrier'];
  tracking_number: string;
  status: Shipment['status'];
  estimated_delivery_date: string | null;
  actual_delivery_date: string | null;
  last_carrier_update: string | null;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapShipmentRow(row: MarketShipmentRow): Shipment {
  return {
    id: row.id,
    paymentId: row.payment_id,
    listingId: row.listing_id,
    sellerId: row.seller_id,
    buyerId: row.buyer_id,
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
    status: row.status,
    estimatedDeliveryDate: row.estimated_delivery_date,
    actualDeliveryDate: row.actual_delivery_date,
    lastCarrierUpdate: row.last_carrier_update,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function cloudAddTracking(
  supabase: SupabaseClient,
  paymentId: string,
  carrier: string,
  trackingNumber: string,
): Promise<Result<Shipment>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not authenticated' };

  const { data: payment, error: paymentError } = await supabase
    .from('mk_payments')
    .select('listing_id, buyer_id, seller_id')
    .eq('id', paymentId)
    .single();

  if (paymentError) return { ok: false, error: String(paymentError) };
  const paymentRow = payment as { listing_id: string; buyer_id: string; seller_id: string } | null;
  if (!paymentRow) return { ok: false, error: 'Payment not found' };

  const { data, error } = await supabase
    .from('mk_shipments')
    .insert({
      payment_id: paymentId,
      listing_id: paymentRow.listing_id,
      seller_id: paymentRow.seller_id,
      buyer_id: paymentRow.buyer_id,
      carrier,
      tracking_number: trackingNumber,
    })
    .select('*')
    .single();

  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapShipmentRow(data as MarketShipmentRow) };
}

export async function cloudGetShipment(
  supabase: SupabaseClient,
  paymentId: string,
): Promise<Result<Shipment>> {
  const { data, error } = await supabase
    .from('mk_shipments')
    .select('*')
    .eq('payment_id', paymentId)
    .single();
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: mapShipmentRow(data as MarketShipmentRow) };
}

// ── Service Discovery ───────────────────────────────────────────────

interface MarketServicePortfolioRow {
  id: string;
  listing_id: string;
  media_type: ServicePortfolioItem['mediaType'];
  url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

interface MarketServiceAvailabilityRow {
  id: string;
  listing_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

function mapServicePortfolioRow(row: MarketServicePortfolioRow): ServicePortfolioItem {
  return {
    id: row.id,
    listingId: row.listing_id,
    mediaType: row.media_type,
    url: row.url,
    caption: row.caption,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapServiceAvailabilityRow(row: MarketServiceAvailabilityRow): ServiceAvailability {
  return {
    id: row.id,
    listingId: row.listing_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
  };
}

export async function cloudGetServicePortfolio(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Result<ServicePortfolioItem[]>> {
  const { data, error } = await supabase
    .from('mk_service_portfolio')
    .select('*')
    .eq('listing_id', listingId)
    .order('sort_order', { ascending: true });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketServicePortfolioRow[] | null ?? []).map(mapServicePortfolioRow) };
}

export async function cloudGetServiceAvailability(
  supabase: SupabaseClient,
  listingId: string,
): Promise<Result<ServiceAvailability[]>> {
  const { data, error } = await supabase
    .from('mk_service_availability')
    .select('*')
    .eq('listing_id', listingId)
    .order('day_of_week', { ascending: true });
  if (error) return { ok: false, error: String(error) };
  return { ok: true, data: (data as MarketServiceAvailabilityRow[] | null ?? []).map(mapServiceAvailabilityRow) };
}
