import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getSupabaseClient, useAuth } from '@mylife/auth';
import type { DatabaseAdapter } from '@mylife/db';
import {
  CategoryTile,
  CreateListingInputSchema,
  GlassCard,
  ListingCard,
  ListingTypePill,
  MK_ACCENT,
  MK_ACCENT_DARK,
  MK_ACCENT_LIGHT,
  MK_GLASS_NAV,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_MUTED,
  MK_TEXT_SECONDARY,
  MK_TEXT_TERTIARY,
  MK_TYPOGRAPHY,
  MaterialSymbol,
  SectionHeader,
  VerificationBadge,
  cloudCreateListing,
  cloudGetCategories,
  cloudGetConversations,
  cloudGetListings,
  cloudGetMessages,
  cloudGetSellerReviews,
  cloudGetSellerStats,
  cloudGetSellerVerification,
  cloudGetWatchlist,
  cloudToggleWatch,
  deleteCachedWatchlistItem,
  formatMarketPrice,
  getCachedCategories,
  getCachedConversations,
  getCachedListings,
  getCachedMessages,
  getCachedWatchlist,
  type Category,
  type Condition,
  type Conversation,
  type CreateListingInput,
  type DatabaseAdapter as MarketDatabaseAdapter,
  type Listing,
  type ListingType,
  type Message,
  type Review,
  type SellerStats,
  type SellerVerification,
  type VerificationLevel,
  type WatchlistItem,
  upsertCachedCategory,
  upsertCachedConversation,
  upsertCachedListing,
  upsertCachedMessage,
  upsertCachedWatchlistItem,
  withAlpha,
} from '@mylife/market';
import { useDatabase } from '../../components/DatabaseProvider';

const FALLBACK_USER_ID = 'local-user';
const MARKET_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const MARKET_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
type MarketCloudClient = Parameters<typeof cloudGetCategories>[0];
const MARKET_SEARCH_DRAFTS_KEY = 'market.phase1.saved-searches';

type BrowseSortKey =
  | 'newest'
  | 'priceLow'
  | 'priceHigh'
  | 'distance'
  | 'mostWatched';

type BrowseFilters = {
  query: string;
  categoryId?: string;
  priceMin?: number;
  priceMax?: number;
  distanceMiles?: number;
  conditions: Condition[];
  listingType?: ListingType;
  sort: BrowseSortKey;
};

type SellerProfileRecord = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  coverUrl: string;
  tagline: string;
  bio: string;
  city: string;
  languages: string[];
  verificationLevel: VerificationLevel;
  responseHours: number;
  totalTransactions: number;
  memberSince: string;
  socialLinks: string[];
};

type ListingRecord = Listing & {
  photoUrl: string;
};

type ConversationMeta = {
  preview: string;
  unreadCount: number;
  encrypted: boolean;
  requestPending?: boolean;
  online?: boolean;
};

type SavedSearchDraft = {
  id: string;
  name: string;
  notifyOnMatch: boolean;
  createdAt: string;
  filters: BrowseFilters;
};

type ModalOption<T extends string | number> = {
  label: string;
  value: T;
  hint?: string;
};

const CATEGORY_META = [
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000001',
    name: 'Electronics',
    slug: 'electronics',
    icon: 'devices',
    sortOrder: 0,
    color: '#2DD4BF',
  },
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000002',
    name: 'Clothing',
    slug: 'clothing',
    icon: 'checkroom',
    sortOrder: 1,
    color: '#FFB877',
  },
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000003',
    name: 'Home',
    slug: 'home',
    icon: 'home_repair_service',
    sortOrder: 2,
    color: '#8BCFF0',
  },
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000004',
    name: 'Sports',
    slug: 'sports',
    icon: 'sports_basketball',
    sortOrder: 3,
    color: '#30D158',
  },
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000005',
    name: 'Books',
    slug: 'books',
    icon: 'menu_book',
    sortOrder: 4,
    color: '#A78BFA',
  },
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000006',
    name: 'Auto',
    slug: 'auto',
    icon: 'directions_car',
    sortOrder: 5,
    color: '#FF453A',
  },
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000007',
    name: 'Services',
    slug: 'services',
    icon: 'support_agent',
    sortOrder: 6,
    color: '#14B8A6',
  },
  {
    id: 'd8c1bb2b-c124-4d50-8b36-000000000008',
    name: 'Other',
    slug: 'other',
    icon: 'store',
    sortOrder: 7,
    color: '#9F8E81',
  },
] as const;

const PRICE_OPTIONS: Array<ModalOption<'any' | 'under50' | '50to250' | '250to750' | '750plus'>> = [
  { label: 'Any Price', value: 'any' },
  { label: 'Under $50', value: 'under50' },
  { label: '$50 to $250', value: '50to250' },
  { label: '$250 to $750', value: '250to750' },
  { label: '$750+', value: '750plus' },
] as const;

const DISTANCE_OPTIONS: Array<ModalOption<'any' | 5 | 10 | 25 | 50>> = [
  { label: 'Anywhere', value: 'any' },
  { label: 'Within 5 mi', value: 5 },
  { label: 'Within 10 mi', value: 10 },
  { label: 'Within 25 mi', value: 25 },
  { label: 'Within 50 mi', value: 50 },
] as const;

const SORT_OPTIONS: Array<ModalOption<BrowseSortKey>> = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price Low to High', value: 'priceLow' },
  { label: 'Price High to Low', value: 'priceHigh' },
  { label: 'Closest First', value: 'distance' },
  { label: 'Most Watched', value: 'mostWatched' },
] as const;

const LISTING_TYPE_OPTIONS: ListingType[] = [
  'sell',
  'trade',
  'free',
  'wanted',
  'service_offer',
  'service_request',
];

const CONDITION_OPTIONS: Condition[] = [
  'new',
  'like_new',
  'good',
  'fair',
  'poor',
];

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatRelativeDate(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Just now';
  }

  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

function formatMemberSince(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function toMarketDb(db: DatabaseAdapter): MarketDatabaseAdapter {
  return {
    run: (sql: string, params?: unknown[]) => db.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params)[0],
    all: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params),
  };
}

function getMarketSupabaseClient() {
  if (!MARKET_SUPABASE_URL || !MARKET_SUPABASE_ANON_KEY) {
    return null;
  }

  return getSupabaseClient({
    url: MARKET_SUPABASE_URL,
    anonKey: MARKET_SUPABASE_ANON_KEY,
  }) as unknown as MarketCloudClient;
}

function readSavedSearchDrafts(db: DatabaseAdapter): SavedSearchDraft[] {
  try {
    const row = db.query<{ value: string }>(
      'SELECT value FROM hub_preferences WHERE key = ?',
      [MARKET_SEARCH_DRAFTS_KEY],
    )[0];

    if (!row?.value) {
      return [];
    }

    const parsed = JSON.parse(row.value) as SavedSearchDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSavedSearchDrafts(
  db: DatabaseAdapter,
  drafts: SavedSearchDraft[],
): void {
  db.execute(
    'INSERT OR REPLACE INTO hub_preferences (key, value) VALUES (?, ?)',
    [MARKET_SEARCH_DRAFTS_KEY, JSON.stringify(drafts)],
  );
}

function getPriceRangeLabel(filters: BrowseFilters): string {
  if (filters.priceMin == null && filters.priceMax == null) {
    return 'Price';
  }

  if (filters.priceMax != null && filters.priceMin == null) {
    return `Under ${formatMarketPrice(filters.priceMax)}`;
  }

  if (filters.priceMin != null && filters.priceMax == null) {
    return `${formatMarketPrice(filters.priceMin)}+`;
  }

  return `${formatMarketPrice(filters.priceMin ?? 0)}-${formatMarketPrice(filters.priceMax ?? 0)}`;
}

function isFilterActive(filters: BrowseFilters): boolean {
  return Boolean(
    filters.query.trim() ||
      filters.categoryId ||
      filters.priceMin != null ||
      filters.priceMax != null ||
      filters.distanceMiles != null ||
      filters.conditions.length > 0 ||
      filters.listingType,
  );
}

function getPriceBounds(
  key: 'any' | 'under50' | '50to250' | '250to750' | '750plus',
): Pick<BrowseFilters, 'priceMin' | 'priceMax'> {
  switch (key) {
    case 'under50':
      return { priceMin: undefined, priceMax: 50 };
    case '50to250':
      return { priceMin: 50, priceMax: 250 };
    case '250to750':
      return { priceMin: 250, priceMax: 750 };
    case '750plus':
      return { priceMin: 750, priceMax: undefined };
    default:
      return { priceMin: undefined, priceMax: undefined };
  }
}

function buildFallbackProfiles(currentUserId: string): Record<string, SellerProfileRecord> {
  return {
    [currentUserId]: {
      id: currentUserId,
      displayName: 'Trey Seller',
      handle: '@treycollects',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      coverUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      tagline: 'Selling studio gear, books, and the occasional design find.',
      bio: 'I list the gear and objects I actually use, keep descriptions honest, and ship fast when pickup is not practical.',
      city: 'Los Angeles, CA',
      languages: ['English', 'Spanish'],
      verificationLevel: 'trusted',
      responseHours: 2,
      totalTransactions: 34,
      memberSince: '2024-03-12T12:00:00.000Z',
      socialLinks: ['Instagram', 'Website'],
    },
    'seller-maya': {
      id: 'seller-maya',
      displayName: 'Maya Chen',
      handle: '@maya.photo',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      coverUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
      tagline: 'Camera kits, film gear, and carefully kept accessories.',
      bio: 'Commercial photographer downsizing duplicate gear. I keep everything tested, cleaned, and packed well.',
      city: 'Silver Lake, CA',
      languages: ['English', 'Mandarin'],
      verificationLevel: 'top_seller',
      responseHours: 1,
      totalTransactions: 128,
      memberSince: '2022-08-19T12:00:00.000Z',
      socialLinks: ['Instagram', 'Portfolio'],
    },
    'seller-leo': {
      id: 'seller-leo',
      displayName: 'Leo Park',
      handle: '@leo.makes',
      avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
      coverUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
      tagline: 'Furniture, office upgrades, and well-built home pieces.',
      bio: 'Designer with a soft spot for practical furniture and tidy workspaces. Pickup is easy and communication is quick.',
      city: 'Pasadena, CA',
      languages: ['English', 'Korean'],
      verificationLevel: 'verified',
      responseHours: 3,
      totalTransactions: 61,
      memberSince: '2023-02-02T12:00:00.000Z',
      socialLinks: ['Threads'],
    },
    'seller-nina': {
      id: 'seller-nina',
      displayName: 'Nina Alvarez',
      handle: '@ninabuilds',
      avatarUrl: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=400&q=80',
      coverUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
      tagline: 'Remote service listings for creators and local founders.',
      bio: 'I help founders tighten their sites, launch pages, and conversion flows with a clean product mindset.',
      city: 'Remote',
      languages: ['English'],
      verificationLevel: 'trusted',
      responseHours: 4,
      totalTransactions: 42,
      memberSince: '2023-11-18T12:00:00.000Z',
      socialLinks: ['Website', 'LinkedIn'],
    },
    'seller-riley': {
      id: 'seller-riley',
      displayName: 'Riley Morgan',
      handle: '@riley.adventure',
      avatarUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
      coverUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      tagline: 'Outdoor gear, car accessories, and trail-ready extras.',
      bio: 'Weekend trailhead regular. Mostly listing lightly used adventure gear and clean install auto add-ons.',
      city: 'Burbank, CA',
      languages: ['English'],
      verificationLevel: 'basic',
      responseHours: 6,
      totalTransactions: 19,
      memberSince: '2024-01-09T12:00:00.000Z',
      socialLinks: ['Instagram'],
    },
  };
}

function buildFallbackData(currentUserId: string) {
  const profiles = buildFallbackProfiles(currentUserId);
  const categories: Category[] = CATEGORY_META.map((category) => ({
    id: category.id,
    parentId: null,
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    sortOrder: category.sortOrder,
  }));

  const listings: ListingRecord[] = [
    {
      id: 'listing-camera-kit',
      sellerId: 'seller-maya',
      categoryId: CATEGORY_META[0].id,
      title: 'Mirrorless camera kit with two lenses',
      description: 'Clean body, prime lens, zoom lens, two batteries, and a slim camera sling. Everything is tested and ready for pickup.',
      priceCents: 84500,
      currency: 'USD',
      pricingType: 'fixed',
      condition: 'like_new',
      listingType: 'sell',
      status: 'active',
      locationName: 'Silver Lake',
      latitude: null,
      longitude: null,
      fulfillmentType: 'pickup',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 132,
      watchCount: 19,
      messageCount: 7,
      createdAt: '2026-04-06T15:00:00.000Z',
      updatedAt: '2026-04-06T15:00:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'listing-oak-desk',
      sellerId: 'seller-leo',
      categoryId: CATEGORY_META[2].id,
      title: 'Solid oak writing desk with cable tray',
      description: 'Minimal oak desk with a shallow drawer and hidden cable tray. Great for a laptop and notebook setup.',
      priceCents: 22000,
      currency: 'USD',
      pricingType: 'negotiable',
      condition: 'good',
      listingType: 'sell',
      status: 'active',
      locationName: 'Pasadena',
      latitude: null,
      longitude: null,
      fulfillmentType: 'pickup',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 84,
      watchCount: 11,
      messageCount: 5,
      createdAt: '2026-04-06T12:00:00.000Z',
      updatedAt: '2026-04-06T12:00:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'listing-trail-shoes',
      sellerId: currentUserId,
      categoryId: CATEGORY_META[3].id,
      title: 'Trail runner bundle, size 11',
      description: 'Two pairs of trail shoes with low miles. One is nearly new, the other is perfect as a backup pair.',
      priceCents: 14000,
      currency: 'USD',
      pricingType: 'fixed',
      condition: 'like_new',
      listingType: 'sell',
      status: 'active',
      locationName: 'Echo Park',
      latitude: null,
      longitude: null,
      fulfillmentType: 'pickup',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 63,
      watchCount: 8,
      messageCount: 3,
      createdAt: '2026-04-05T23:00:00.000Z',
      updatedAt: '2026-04-05T23:00:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'listing-photo-book',
      sellerId: 'seller-maya',
      categoryId: CATEGORY_META[4].id,
      title: 'Monograph set: portrait lighting + composition',
      description: 'Hardcover photography set in excellent condition with clean jackets and no annotations.',
      priceCents: 6800,
      currency: 'USD',
      pricingType: 'fixed',
      condition: 'like_new',
      listingType: 'sell',
      status: 'active',
      locationName: 'Atwater Village',
      latitude: null,
      longitude: null,
      fulfillmentType: 'shipping',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 37,
      watchCount: 15,
      messageCount: 1,
      createdAt: '2026-04-05T18:15:00.000Z',
      updatedAt: '2026-04-05T18:15:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'listing-garden-chair',
      sellerId: currentUserId,
      categoryId: CATEGORY_META[2].id,
      title: 'Woven lounge chair for patio corner',
      description: 'Low-slung woven chair that still feels great. A few tiny scuffs on the frame, otherwise solid.',
      priceCents: 9500,
      currency: 'USD',
      pricingType: 'fixed',
      condition: 'good',
      listingType: 'sell',
      status: 'sold',
      locationName: 'Los Feliz',
      latitude: null,
      longitude: null,
      fulfillmentType: 'pickup',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 51,
      watchCount: 6,
      messageCount: 4,
      createdAt: '2026-04-04T19:00:00.000Z',
      updatedAt: '2026-04-04T19:00:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'listing-site-refresh',
      sellerId: 'seller-nina',
      categoryId: CATEGORY_META[6].id,
      title: 'Portfolio website refresh for local creators',
      description: 'Tight turnaround design and front-end cleanup for personal sites, with analytics and accessibility review included.',
      priceCents: 35000,
      currency: 'USD',
      pricingType: 'fixed',
      condition: null,
      listingType: 'service_offer',
      status: 'active',
      locationName: 'Remote',
      latitude: null,
      longitude: null,
      fulfillmentType: 'remote',
      serviceRadiusMiles: 30,
      availabilityNotes: 'Two spots open this month',
      tradeFor: null,
      viewCount: 49,
      watchCount: 7,
      messageCount: 3,
      createdAt: '2026-04-04T17:30:00.000Z',
      updatedAt: '2026-04-04T17:30:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'listing-vintage-jacket',
      sellerId: 'seller-maya',
      categoryId: CATEGORY_META[1].id,
      title: 'Vintage denim jacket, cropped fit',
      description: 'Soft vintage wash, clean seams, and the best slightly oversized shoulder shape.',
      priceCents: 7600,
      currency: 'USD',
      pricingType: 'fixed',
      condition: 'good',
      listingType: 'sell',
      status: 'active',
      locationName: 'Highland Park',
      latitude: null,
      longitude: null,
      fulfillmentType: 'pickup',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 29,
      watchCount: 5,
      messageCount: 0,
      createdAt: '2026-04-04T13:20:00.000Z',
      updatedAt: '2026-04-04T13:20:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
    },
    {
      id: 'listing-roof-rack',
      sellerId: 'seller-riley',
      categoryId: CATEGORY_META[5].id,
      title: 'Universal roof rack crossbars',
      description: 'Fits most compact SUVs. Includes locks, keys, and the original mounting hardware.',
      priceCents: 18500,
      currency: 'USD',
      pricingType: 'negotiable',
      condition: 'good',
      listingType: 'sell',
      status: 'active',
      locationName: 'Burbank',
      latitude: null,
      longitude: null,
      fulfillmentType: 'pickup',
      serviceRadiusMiles: null,
      availabilityNotes: null,
      tradeFor: null,
      viewCount: 18,
      watchCount: 3,
      messageCount: 1,
      createdAt: '2026-04-03T20:45:00.000Z',
      updatedAt: '2026-04-03T20:45:00.000Z',
      expiresAt: null,
      photoUrl: 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=900&q=80',
    },
  ];

  const watchlist: WatchlistItem[] = [
    {
      id: 'watch-camera-kit',
      userId: currentUserId,
      listingId: 'listing-camera-kit',
      createdAt: '2026-04-05T14:00:00.000Z',
    },
    {
      id: 'watch-oak-desk',
      userId: currentUserId,
      listingId: 'listing-oak-desk',
      createdAt: '2026-04-04T10:00:00.000Z',
    },
    {
      id: 'watch-vintage-jacket',
      userId: currentUserId,
      listingId: 'listing-vintage-jacket',
      createdAt: '2026-04-04T08:00:00.000Z',
    },
  ];

  const conversations: Conversation[] = [
    {
      id: 'conversation-camera-kit',
      listingId: 'listing-camera-kit',
      buyerId: currentUserId,
      sellerId: 'seller-maya',
      lastMessageAt: '2026-04-06T16:05:00.000Z',
      createdAt: '2026-04-05T19:30:00.000Z',
    },
    {
      id: 'conversation-site-refresh',
      listingId: 'listing-site-refresh',
      buyerId: currentUserId,
      sellerId: 'seller-nina',
      lastMessageAt: '2026-04-06T11:15:00.000Z',
      createdAt: '2026-04-05T17:10:00.000Z',
    },
    {
      id: 'conversation-trail-shoes',
      listingId: 'listing-trail-shoes',
      buyerId: 'buyer-jordan',
      sellerId: currentUserId,
      lastMessageAt: '2026-04-05T23:30:00.000Z',
      createdAt: '2026-04-05T22:45:00.000Z',
    },
  ];

  const conversationMeta: Record<string, ConversationMeta> = {
    'conversation-camera-kit': {
      preview: 'Would you take $790 if I come by tomorrow afternoon?',
      unreadCount: 2,
      encrypted: true,
      online: true,
    },
    'conversation-site-refresh': {
      preview: 'Happy to share a scoped outline and availability after I review your current site.',
      unreadCount: 0,
      encrypted: true,
      requestPending: true,
    },
    'conversation-trail-shoes': {
      preview: 'Can you hold them through tonight? I can pick up after work.',
      unreadCount: 1,
      encrypted: false,
      online: false,
    },
  };

  const messages: Message[] = [
    {
      id: 'message-camera-1',
      conversationId: 'conversation-camera-kit',
      senderId: 'seller-maya',
      body: 'Happy to include the wrist strap if you pick it up this week.',
      contentType: 'text/plain',
      ciphertext: null,
      encryptionAlgorithm: null,
      encryptionSalt: null,
      encryptionIv: null,
      createdAt: '2026-04-06T15:50:00.000Z',
    },
    {
      id: 'message-camera-2',
      conversationId: 'conversation-camera-kit',
      senderId: currentUserId,
      body: 'Would you take $790 if I come by tomorrow afternoon?',
      contentType: 'application/e2ee+ciphertext',
      ciphertext: 'ciphertext',
      encryptionAlgorithm: 'aes-256-gcm',
      encryptionSalt: 'salt',
      encryptionIv: 'iv',
      createdAt: '2026-04-06T16:05:00.000Z',
    },
    {
      id: 'message-service-1',
      conversationId: 'conversation-site-refresh',
      senderId: 'seller-nina',
      body: 'Happy to share a scoped outline and availability after I review your current site.',
      contentType: 'text/plain',
      ciphertext: null,
      encryptionAlgorithm: null,
      encryptionSalt: null,
      encryptionIv: null,
      createdAt: '2026-04-06T11:15:00.000Z',
    },
    {
      id: 'message-shoes-1',
      conversationId: 'conversation-trail-shoes',
      senderId: 'buyer-jordan',
      body: 'Can you hold them through tonight? I can pick up after work.',
      contentType: 'text/plain',
      ciphertext: null,
      encryptionAlgorithm: null,
      encryptionSalt: null,
      encryptionIv: null,
      createdAt: '2026-04-05T23:30:00.000Z',
    },
  ];

  const reviews: Review[] = [
    {
      id: 'review-1',
      reviewerId: 'buyer-jordan',
      sellerId: currentUserId,
      listingId: 'listing-garden-chair',
      rating: 5,
      body: 'Exactly as described, friendly pickup, and super fast replies.',
      createdAt: '2026-04-02T09:00:00.000Z',
    },
    {
      id: 'review-2',
      reviewerId: 'buyer-ash',
      sellerId: currentUserId,
      listingId: 'listing-trail-shoes',
      rating: 4,
      body: 'Easy handoff and the item photos were accurate. Would buy again.',
      createdAt: '2026-03-28T17:00:00.000Z',
    },
    {
      id: 'review-3',
      reviewerId: 'buyer-carmen',
      sellerId: 'seller-maya',
      listingId: 'listing-camera-kit',
      rating: 5,
      body: 'Best packed camera purchase I have ever received. Smooth from start to finish.',
      createdAt: '2026-04-01T13:00:00.000Z',
    },
    {
      id: 'review-4',
      reviewerId: 'buyer-omar',
      sellerId: 'seller-maya',
      listingId: 'listing-photo-book',
      rating: 5,
      body: 'Condition was even better than expected and communication was immediate.',
      createdAt: '2026-03-26T11:00:00.000Z',
    },
    {
      id: 'review-5',
      reviewerId: 'buyer-rin',
      sellerId: 'seller-nina',
      listingId: 'listing-site-refresh',
      rating: 5,
      body: 'Thoughtful feedback, fast delivery, and clear process. Worth every dollar.',
      createdAt: '2026-03-20T08:30:00.000Z',
    },
  ];

  const priceChanges: Record<string, number> = {
    'listing-camera-kit': -55,
    'listing-oak-desk': 20,
    'listing-vintage-jacket': -12,
  };

  const distances: Record<string, number> = {
    'listing-camera-kit': 2.4,
    'listing-oak-desk': 6.2,
    'listing-trail-shoes': 1.7,
    'listing-photo-book': 3.1,
    'listing-garden-chair': 4.9,
    'listing-site-refresh': 0,
    'listing-vintage-jacket': 7.6,
    'listing-roof-rack': 10.4,
  };

  const sellerStats: Record<string, SellerStats> = Object.fromEntries(
    Object.values(profiles).map((profile) => {
      const sellerListings = listings.filter((listing) => listing.sellerId === profile.id);
      const sellerReviews = reviews.filter((review) => review.sellerId === profile.id);
      const averageRating = sellerReviews.length
        ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length
        : null;

      return [
        profile.id,
        {
          sellerId: profile.id,
          totalListings: sellerListings.length,
          activeListings: sellerListings.filter((listing) => listing.status === 'active').length,
          totalSold: Math.max(
            0,
            profile.totalTransactions - sellerListings.filter((listing) => listing.status === 'active').length,
          ),
          averageRating,
          reviewCount: sellerReviews.length,
          responseRate: 0.94,
          memberSince: profile.memberSince,
        },
      ];
    }),
  );

  const sellerVerification: Record<string, SellerVerification> = Object.fromEntries(
    Object.values(profiles).map((profile) => [
      profile.id,
      {
        id: `verification-${profile.id}`,
        userId: profile.id,
        emailVerified: true,
        phoneVerified: true,
        photoVerified: true,
        idVerified: profile.verificationLevel === 'trusted' || profile.verificationLevel === 'top_seller',
        completedSales: sellerStats[profile.id]?.totalSold ?? 0,
        totalReviews: sellerStats[profile.id]?.reviewCount ?? 0,
        averageRating: sellerStats[profile.id]?.averageRating ?? null,
        accountAgeDays: 540,
        verificationLevel: profile.verificationLevel,
        levelAchievedAt: '2026-01-12T12:00:00.000Z',
        createdAt: profile.memberSince,
        updatedAt: '2026-04-06T12:00:00.000Z',
      },
    ]),
  );

  return {
    categories,
    listings,
    watchlist,
    conversations,
    conversationMeta,
    messages,
    reviews,
    profiles,
    sellerStats,
    sellerVerification,
    priceChanges,
    distances,
  };
}

function useMarketPhase1Model() {
  const db = useDatabase();
  const auth = useAuth();
  const router = useRouter();
  const marketDb = useMemo(() => toMarketDb(db), [db]);
  const currentUserId = auth.user?.id ?? FALLBACK_USER_ID;
  const fallback = useMemo(() => buildFallbackData(currentUserId), [currentUserId]);
  const client = useMemo(() => getMarketSupabaseClient(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<ListingRecord[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchDraft[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readFromCache = useMemo(() => {
    return () => {
      try {
        const cachedCategories = getCachedCategories(marketDb);
        const cachedListings = getCachedListings(marketDb, { limit: 80 });
        const cachedWatchlist = getCachedWatchlist(marketDb, currentUserId);
        const cachedConversations = getCachedConversations(marketDb, currentUserId);

        setCategories(cachedCategories.length > 0 ? cachedCategories : fallback.categories);
        setListings(
          (cachedListings.length > 0
            ? cachedListings
            : fallback.listings).map((listing) => ({
            ...listing,
            photoUrl:
              fallback.listings.find((candidate) => candidate.id === listing.id)?.photoUrl ??
              fallback.listings[0]?.photoUrl ??
              '',
          })),
        );
        setWatchlist(cachedWatchlist.length > 0 ? cachedWatchlist : fallback.watchlist);
        setConversations(
          cachedConversations.length > 0 ? cachedConversations : fallback.conversations,
        );
        setSavedSearches(readSavedSearchDrafts(db));
      } catch (readError) {
        setError(readError instanceof Error ? readError.message : 'Unable to load market data.');
        setCategories(fallback.categories);
        setListings(fallback.listings);
        setWatchlist(fallback.watchlist);
        setConversations(fallback.conversations);
        setSavedSearches(readSavedSearchDrafts(db));
      }
    };
  }, [currentUserId, db, fallback, marketDb]);

  const seedFallbackCache = useMemo(() => {
    return () => {
      const cachedListings = getCachedListings(marketDb, { limit: 5 });
      if (cachedListings.length > 0) {
        return;
      }

      for (const category of fallback.categories) {
        upsertCachedCategory(marketDb, category);
      }

      for (const listing of fallback.listings) {
        upsertCachedListing(marketDb, listing);
      }

      for (const item of fallback.watchlist) {
        upsertCachedWatchlistItem(marketDb, item);
      }

      for (const conversation of fallback.conversations) {
        upsertCachedConversation(marketDb, conversation);
      }

      for (const message of fallback.messages) {
        upsertCachedMessage(marketDb, message);
      }
    };
  }, [fallback, marketDb]);

  useEffect(() => {
    seedFallbackCache();
    readFromCache();
  }, [readFromCache, seedFallbackCache]);

  const refreshFromCloud = useMemo(() => {
    return async () => {
      if (!client) {
        return;
      }

      setRefreshing(true);
      setError(null);

      try {
        const categoryResult = await cloudGetCategories(client);
        if (categoryResult.ok) {
          for (const category of categoryResult.data) {
            upsertCachedCategory(marketDb, category);
          }
        }

        const listingsResult = await cloudGetListings(client, { limit: 80 });
        if (listingsResult.ok) {
          for (const listing of listingsResult.data) {
            upsertCachedListing(marketDb, listing);
          }
        }

        if (auth.isAuthenticated) {
          const watchlistResult = await cloudGetWatchlist(client);
          if (watchlistResult.ok) {
            for (const item of watchlistResult.data) {
              upsertCachedWatchlistItem(marketDb, item);
            }
          }

          const conversationsResult = await cloudGetConversations(client);
          if (conversationsResult.ok) {
            for (const conversation of conversationsResult.data) {
              upsertCachedConversation(marketDb, conversation);
            }

            for (const conversation of conversationsResult.data.slice(0, 20)) {
              const messagesResult = await cloudGetMessages(client, conversation.id);
              if (messagesResult.ok) {
                for (const message of messagesResult.data) {
                  upsertCachedMessage(marketDb, message);
                }
              }
            }
          }
        }
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? refreshError.message
            : 'Unable to refresh market data.',
        );
      } finally {
        readFromCache();
        setRefreshing(false);
      }
    };
  }, [auth.isAuthenticated, client, marketDb, readFromCache]);

  useEffect(() => {
    void refreshFromCloud();
  }, [refreshFromCloud]);

  const listingById = useMemo(
    () => Object.fromEntries(listings.map((listing) => [listing.id, listing])),
    [listings],
  );

  const watchlistIds = useMemo(
    () => new Set(watchlist.map((item) => item.listingId)),
    [watchlist],
  );

  const messagesByConversation = useMemo(() => {
    const mapping: Record<string, Message[]> = {};
    for (const conversation of conversations) {
      const cached = getCachedMessages(marketDb, conversation.id);
      mapping[conversation.id] =
        cached.length > 0
          ? cached
          : fallback.messages.filter(
              (message) => message.conversationId === conversation.id,
            );
    }
    return mapping;
  }, [conversations, fallback.messages, marketDb]);

  const toggleWatch = useMemo(() => {
    return async (listingId: string) => {
      const existing = watchlist.find((item) => item.listingId === listingId);

      if (client && auth.isAuthenticated) {
        const result = await cloudToggleWatch(client, listingId);
        if (!result.ok) {
          Alert.alert('Watchlist unavailable', result.error);
          return;
        }

        await refreshFromCloud();
        return;
      }

      if (existing) {
        deleteCachedWatchlistItem(marketDb, existing.id);
      } else {
        upsertCachedWatchlistItem(marketDb, {
          id: makeId('watch'),
          userId: currentUserId,
          listingId,
          createdAt: new Date().toISOString(),
        });
      }
      readFromCache();
    };
  }, [
    auth.isAuthenticated,
    client,
    currentUserId,
    marketDb,
    readFromCache,
    refreshFromCloud,
    watchlist,
  ]);

  const saveSearch = useMemo(() => {
    return (draft: SavedSearchDraft) => {
      const next = [draft, ...savedSearches].slice(0, 20);
      writeSavedSearchDrafts(db, next);
      setSavedSearches(next);
    };
  }, [db, savedSearches]);

  const getSellerProfile = useMemo(() => {
    return (sellerId: string) => {
      return (
        fallback.profiles[sellerId] ??
        fallback.profiles[currentUserId]
      );
    };
  }, [currentUserId, fallback.profiles]);

  const getSellerStats = useMemo(() => {
    return async (sellerId: string) => {
      if (client) {
        try {
          const result = await cloudGetSellerStats(client, sellerId);
          if (result.ok) {
            return result.data;
          }
        } catch {
          // fall back to seeded profile stats
        }
      }

      return fallback.sellerStats[sellerId] ?? fallback.sellerStats[currentUserId];
    };
  }, [client, currentUserId, fallback.sellerStats]);

  const getSellerReviews = useMemo(() => {
    return async (sellerId: string) => {
      if (client) {
        try {
          const result = await cloudGetSellerReviews(client, sellerId);
          if (result.ok && result.data.length > 0) {
            return result.data;
          }
        } catch {
          // fall back to seeded reviews
        }
      }

      return fallback.reviews.filter((review) => review.sellerId === sellerId);
    };
  }, [client, fallback.reviews]);

  const getSellerVerification = useMemo(() => {
    return async (sellerId: string) => {
      if (client) {
        try {
          const result = await cloudGetSellerVerification(client, sellerId);
          if (result.ok) {
            return result.data;
          }
        } catch {
          // fall back to seeded verification
        }
      }

      return (
        fallback.sellerVerification[sellerId] ??
        fallback.sellerVerification[currentUserId]
      );
    };
  }, [client, currentUserId, fallback.sellerVerification]);

  const createListing = useMemo(() => {
    return async (
      input: CreateListingInput,
      options: { photoUris: string[]; saveAsDraft?: boolean },
    ) => {
      const now = new Date().toISOString();
      const nextId = makeId('listing');

      if (client && auth.isAuthenticated && !options.saveAsDraft) {
        const result = await cloudCreateListing(client, input);
        if (!result.ok) {
          Alert.alert('Unable to publish listing', result.error);
          return null;
        }

        upsertCachedListing(marketDb, result.data);
        readFromCache();
        return result.data.id;
      }

      upsertCachedListing(marketDb, {
        id: nextId,
        sellerId: currentUserId,
        categoryId: input.categoryId,
        title: input.title,
        description: input.description,
        priceCents: input.priceCents ?? null,
        currency: input.currency ?? 'USD',
        pricingType: input.pricingType,
        condition: input.condition ?? null,
        listingType: input.listingType,
        status: options.saveAsDraft ? 'draft' : 'active',
        locationName: input.locationName ?? 'Local pickup',
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        fulfillmentType: input.fulfillmentType ?? 'pickup',
        serviceRadiusMiles: input.serviceRadiusMiles ?? null,
        availabilityNotes: input.availabilityNotes ?? null,
        tradeFor: input.tradeFor ?? null,
        viewCount: 0,
        watchCount: 0,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
        expiresAt: null,
      });
      readFromCache();
      return nextId;
    };
  }, [auth.isAuthenticated, client, currentUserId, marketDb, readFromCache]);

  return {
    auth,
    currentUserId,
    categories,
    listings,
    listingById,
    watchlist,
    watchlistIds,
    conversations,
    messagesByConversation,
    savedSearches,
    refreshing,
    error,
    priceChanges: fallback.priceChanges,
    distances: fallback.distances,
    profiles: fallback.profiles,
    conversationMeta: fallback.conversationMeta,
    refresh: refreshFromCloud,
    router,
    toggleWatch,
    saveSearch,
    getSellerProfile,
    getSellerStats,
    getSellerReviews,
    getSellerVerification,
    createListing,
  };
}

function SurfaceHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.headerShell}>
      <View style={styles.headerBar}>
        <View style={styles.headerSlot}>{left}</View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.headerSlot, styles.headerSlotRight]}>{right}</View>
      </View>
    </View>
  );
}

function MarketBrandHeader({
  primaryAction,
  secondaryAction,
}: {
  primaryAction?: () => void;
  secondaryAction?: () => void;
}) {
  return (
    <View style={styles.headerShell}>
      <View style={styles.headerBar}>
        <View style={styles.brandWrap}>
          <MaterialSymbol name="menu" size={20} color={MK_ACCENT} />
          <Text style={styles.brandText}>MYMARKET</Text>
        </View>
        <View style={styles.headerActions}>
          {secondaryAction ? (
            <Pressable style={styles.iconButton} onPress={secondaryAction}>
              <MaterialSymbol name="more_vert" size={18} color={MK_TEXT_SECONDARY} />
            </Pressable>
          ) : null}
          {primaryAction ? (
            <Pressable style={styles.iconButton} onPress={primaryAction}>
              <MaterialSymbol name="search" size={18} color={MK_TEXT} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: string;
}) {
  return (
    <Pressable
      style={[
        styles.filterChip,
        active ? styles.filterChipActive : null,
      ]}
      onPress={onPress}
    >
      {icon ? (
        <MaterialSymbol
          name={icon}
          size={14}
          color={active ? MK_ACCENT_DARK : MK_TEXT_SECONDARY}
        />
      ) : null}
      <Text
        style={[
          styles.filterChipLabel,
          active ? styles.filterChipLabelActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionEmpty({
  title,
  body,
  actionLabel,
  onPress,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onPress?: () => void;
}) {
  return (
    <GlassCard style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onPress ? (
        <Pressable style={styles.secondaryActionButton} onPress={onPress}>
          <Text style={styles.secondaryActionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

function PickerSheet<T extends string | number>({
  visible,
  title,
  options,
  selected,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: ModalOption<T>[];
  selected: T;
  onClose: () => void;
  onSelect: (value: T) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.modalOptionList}>
            {options.map((option) => {
              const isActive = option.value === selected;
              return (
                <Pressable
                  key={String(option.value)}
                  style={[
                    styles.modalOption,
                    isActive ? styles.modalOptionActive : null,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <View style={styles.modalOptionCopy}>
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        isActive ? styles.modalOptionLabelActive : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.hint ? (
                      <Text style={styles.modalOptionHint}>{option.hint}</Text>
                    ) : null}
                  </View>
                  {isActive ? (
                    <MaterialSymbol name="verified" size={16} color={MK_ACCENT} filled />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.modalCloseButton} onPress={onClose}>
            <Text style={styles.modalCloseLabel}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function BrowseGridCard({
  listing,
  distanceMiles,
  isFavorite,
  onPress,
  onToggleFavorite,
}: {
  listing: ListingRecord;
  distanceMiles: number;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <View style={styles.gridCardWrap}>
      <ListingCard
        listing={{ ...listing, isFavorite }}
        variant="grid"
        onPress={onPress}
      />
      <Pressable style={styles.favoriteOverlay} onPress={onToggleFavorite}>
        <MaterialSymbol
          name={isFavorite ? 'favorite' : 'favorite_border'}
          size={16}
          color={isFavorite ? '#FFB4AB' : MK_TEXT}
          filled={isFavorite}
        />
      </Pressable>
      <View style={styles.distanceOverlay}>
        <MaterialSymbol name="location_on" size={12} color={MK_TEXT} />
        <Text style={styles.distanceOverlayLabel}>
          {distanceMiles === 0 ? 'Remote' : `${distanceMiles.toFixed(1)} mi`}
        </Text>
      </View>
    </View>
  );
}

function SellerStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.sellerStat}>
      <Text style={styles.sellerStatValue}>{value}</Text>
      <Text style={styles.sellerStatLabel}>{label}</Text>
    </View>
  );
}

function ReviewHistogram({
  reviews,
}: {
  reviews: Review[];
}) {
  const total = reviews.length || 1;
  const counts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => review.rating === rating).length,
  }));

  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

  return (
    <GlassCard style={styles.reviewHero}>
      <Text style={styles.reviewAverage}>{average.toFixed(1)}</Text>
      <Text style={styles.reviewAverageSub}>Average Rating</Text>
      <View style={styles.reviewHistogram}>
        {counts.map((entry) => (
          <View key={entry.rating} style={styles.reviewHistogramRow}>
            <Text style={styles.reviewHistogramLabel}>{entry.rating}</Text>
            <View style={styles.reviewHistogramTrack}>
              <View
                style={[
                  styles.reviewHistogramFill,
                  { width: `${(entry.count / total) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.reviewHistogramCount}>{entry.count}</Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function SellerProfileView({
  sellerId,
  isOwnProfile,
}: {
  sellerId: string;
  isOwnProfile: boolean;
}) {
  const market = useMarketPhase1Model();
  const router = useRouter();
  const [segment, setSegment] = useState<'listings' | 'reviews' | 'about'>('listings');
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'sold' | 'draft'>('all');
  const [sellerStats, setSellerStats] = useState<SellerStats | null>(null);
  const [sellerReviews, setSellerReviews] = useState<Review[]>([]);
  const [sellerVerification, setSellerVerification] = useState<SellerVerification | null>(null);
  const seller = market.getSellerProfile(sellerId);

  useEffect(() => {
    let cancelled = false;

    const loadSeller = async () => {
      const [stats, reviews, verification] = await Promise.all([
        market.getSellerStats(sellerId),
        market.getSellerReviews(sellerId),
        market.getSellerVerification(sellerId),
      ]);

      if (cancelled) {
        return;
      }

      setSellerStats(stats);
      setSellerReviews(reviews);
      setSellerVerification(verification);
    };

    void loadSeller();

    return () => {
      cancelled = true;
    };
  }, [market, sellerId]);

  const sellerListings = useMemo(() => {
    return market.listings.filter((listing) => listing.sellerId === sellerId);
  }, [market.listings, sellerId]);

  const filteredListings = useMemo(() => {
    if (listingFilter === 'all') {
      return sellerListings;
    }

    return sellerListings.filter((listing) => listing.status === listingFilter);
  }, [listingFilter, sellerListings]);

  return (
    <View style={styles.screen}>
      <SurfaceHeader
        title={isOwnProfile ? 'Profile' : seller.displayName}
        subtitle={isOwnProfile ? seller.handle : 'Seller profile'}
        left={
          isOwnProfile ? undefined : (
            <Pressable style={styles.iconButton} onPress={() => router.back()}>
              <MaterialSymbol name="arrow_back" size={18} color={MK_TEXT} />
            </Pressable>
          )
        }
        right={
          <Pressable
            style={styles.iconButton}
            onPress={() => {
              if (isOwnProfile) {
                router.push('/(market)/settings');
              } else {
                router.push('/(market)/messages');
              }
            }}
          >
            <MaterialSymbol name="more_vert" size={18} color={MK_TEXT_SECONDARY} />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.profileContent}
        refreshControl={
          <RefreshControl
            tintColor={MK_ACCENT}
            refreshing={market.refreshing}
            onRefresh={() => {
              void market.refresh();
            }}
          />
        }
      >
        <View style={styles.coverWrap}>
          <Image source={{ uri: seller.coverUrl }} style={styles.coverImage} contentFit="cover" />
          <View style={styles.coverOverlay} />
        </View>

        <GlassCard style={styles.profileHeroCard} elevated>
          <View style={styles.profileIdentity}>
            <Image source={{ uri: seller.avatarUrl }} style={styles.profileAvatar} contentFit="cover" />
            <View style={styles.profileIdentityCopy}>
              <Text style={styles.profileName}>{seller.displayName}</Text>
              <VerificationBadge
                tier={sellerVerification?.verificationLevel ?? seller.verificationLevel}
              />
              <Text style={styles.profileTagline}>{seller.tagline}</Text>
            </View>
          </View>

          <View style={styles.profileActionRow}>
            {isOwnProfile ? (
              <>
                <Pressable style={styles.primaryCapsule}>
                  <Text style={styles.primaryCapsuleLabel}>Edit Profile</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryCapsule}
                  onPress={() => router.push('/(market)/settings')}
                >
                  <Text style={styles.secondaryCapsuleLabel}>Settings</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.primaryCapsule}>
                  <Text style={styles.primaryCapsuleLabel}>Follow</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryCapsule}
                  onPress={() => router.push('/(market)/messages')}
                >
                  <Text style={styles.secondaryCapsuleLabel}>Message</Text>
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.statsRow}>
            <SellerStat
              label="Listings"
              value={String(sellerStats?.activeListings ?? sellerListings.filter((item) => item.status === 'active').length)}
            />
            <SellerStat
              label="Sold"
              value={String(sellerStats?.totalSold ?? Math.max(0, seller.totalTransactions - sellerListings.length))}
            />
            <SellerStat
              label="Rating"
              value={
                sellerStats?.averageRating != null
                  ? sellerStats.averageRating.toFixed(1)
                  : '4.9'
              }
            />
            <SellerStat label="Response" value={`${seller.responseHours}h`} />
          </View>
        </GlassCard>

        <View style={styles.segmentRow}>
          {(['listings', 'reviews', 'about'] as const).map((value) => (
            <FilterChip
              key={value}
              label={value}
              active={segment === value}
              onPress={() => setSegment(value)}
            />
          ))}
        </View>

        {segment === 'listings' ? (
          <>
            {isOwnProfile ? (
              <View style={styles.filterRail}>
                {(['all', 'active', 'sold', 'draft'] as const).map((value) => (
                  <FilterChip
                    key={value}
                    label={value}
                    active={listingFilter === value}
                    onPress={() => setListingFilter(value)}
                  />
                ))}
              </View>
            ) : null}

            {filteredListings.length === 0 ? (
              <SectionEmpty
                title="No listings yet"
                body="This seller has not published any items in the current filter."
              />
            ) : (
              <View style={styles.listingsGrid}>
                {filteredListings.map((listing) => (
                  <View key={listing.id} style={styles.listingGridItem}>
                    <ListingCard
                      listing={{
                        ...listing,
                        isFavorite: market.watchlistIds.has(listing.id),
                      }}
                      variant="grid"
                      onPress={() => router.push(`/(market)/${listing.id}`)}
                    />
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}

        {segment === 'reviews' ? (
          <>
            <ReviewHistogram reviews={sellerReviews} />
            <View style={styles.reviewList}>
              {sellerReviews.map((review) => {
                const listing = market.listingById[review.listingId];
                return (
                  <GlassCard key={review.id}>
                    <View style={styles.reviewCardTop}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarLabel}>
                          {review.reviewerId.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.reviewCopy}>
                        <Text style={styles.reviewName}>{review.reviewerId.replace('buyer-', 'Buyer ')}</Text>
                        <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}</Text>
                      </View>
                      <Text style={styles.reviewDate}>{formatRelativeDate(review.createdAt)}</Text>
                    </View>
                    {listing ? (
                      <View style={styles.reviewListingChip}>
                        <Text style={styles.reviewListingChipText}>{listing.title}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.reviewBody}>{review.body ?? 'No review copy.'}</Text>
                  </GlassCard>
                );
              })}
            </View>
          </>
        ) : null}

        {segment === 'about' ? (
          <View style={styles.aboutStack}>
            <GlassCard>
              <Text style={styles.aboutLabel}>Member Since</Text>
              <Text style={styles.aboutValue}>{formatMemberSince(seller.memberSince)}</Text>
            </GlassCard>
            <GlassCard>
              <Text style={styles.aboutLabel}>Location</Text>
              <Text style={styles.aboutValue}>{seller.city}</Text>
            </GlassCard>
            <GlassCard>
              <Text style={styles.aboutLabel}>Languages</Text>
              <Text style={styles.aboutValue}>{seller.languages.join(' · ')}</Text>
            </GlassCard>
            <GlassCard>
              <Text style={styles.aboutLabel}>About</Text>
              <Text style={styles.aboutBody}>{seller.bio}</Text>
            </GlassCard>
            <GlassCard>
              <Text style={styles.aboutLabel}>Verified Information</Text>
              <Text style={styles.aboutBody}>
                Email, phone, profile photo, and transaction history verified.
              </Text>
            </GlassCard>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function MarketHomePhase1Screen() {
  const market = useMarketPhase1Model();
  const recentListings = market.listings
    .filter((listing) => listing.status === 'active')
    .slice(0, 8);
  const watchlistListings = market.watchlist
    .slice(0, 5)
    .map((item) => market.listingById[item.listingId])
    .filter(Boolean) as ListingRecord[];
  const featuredSellerIds = Array.from(
    new Set(recentListings.map((listing) => listing.sellerId).filter((sellerId) => sellerId !== market.currentUserId)),
  ).slice(0, 4);

  const categoryCounts = useMemo(() => {
    return Object.fromEntries(
      market.categories.map((category) => [
        category.id,
        market.listings.filter(
          (listing) => listing.categoryId === category.id && listing.status === 'active',
        ).length,
      ]),
    );
  }, [market.categories, market.listings]);

  return (
    <View style={styles.screen}>
      <MarketBrandHeader
        primaryAction={() => market.router.push('/(market)/browse')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pageContent}
        refreshControl={
          <RefreshControl
            tintColor={MK_ACCENT}
            refreshing={market.refreshing}
            onRefresh={() => {
              void market.refresh();
            }}
          />
        }
      >
        {market.error ? (
          <SectionEmpty
            title="Market sync paused"
            body={market.error}
            actionLabel="Try again"
            onPress={() => {
              void market.refresh();
            }}
          />
        ) : null}

        <SectionHeader
          title="Recent Listings"
          action={{
            label: 'See All',
            onPress: () => market.router.push('/(market)/browse'),
          }}
        />
        {recentListings.length === 0 ? (
          <SectionEmpty
            title="No listings yet"
            body="Once listings land in cache or cloud, the carousel will populate here."
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselRail}
          >
            {recentListings.map((listing) => (
              <View key={listing.id} style={styles.carouselItem}>
                <ListingCard
                  listing={{
                    ...listing,
                    isFavorite: market.watchlistIds.has(listing.id),
                  }}
                  variant="carousel"
                  onPress={() => market.router.push(`/(market)/${listing.id}`)}
                />
              </View>
            ))}
          </ScrollView>
        )}

        <SectionHeader
          title="Browse Categories"
          action={{
            label: 'Full Directory',
            onPress: () => market.router.push('/(market)/browse'),
          }}
        />
        <View style={styles.categoryGrid}>
          {CATEGORY_META.map((category) => (
            <View
              key={category.id}
              style={category.slug === 'services' ? styles.categoryWide : styles.categoryHalf}
            >
              <CategoryTile
                name={category.name}
                icon={category.icon}
                listingCount={categoryCounts[category.id] ?? 0}
                color={category.color}
                onPress={() =>
                  market.router.push({
                    pathname: '/(market)/browse',
                    params: { category: category.id },
                  })
                }
              />
            </View>
          ))}
        </View>

        <SectionHeader
          title="Your Watchlist"
          action={{
            label: 'View All',
            onPress: () => market.router.push('/(market)/watchlist'),
          }}
        />
        {watchlistListings.length === 0 ? (
          <SectionEmpty
            title="Save listings to watch them"
            body="Any listing you favorite in Browse will show up here with price movement callouts."
            actionLabel="Browse listings"
            onPress={() => market.router.push('/(market)/browse')}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselRail}
          >
            {watchlistListings.map((listing) => {
              const delta = market.priceChanges[listing.id] ?? 0;
              const lowered = delta < 0;
              return (
                <View key={listing.id} style={styles.carouselItem}>
                  <ListingCard
                    listing={{
                      ...listing,
                      isFavorite: true,
                    }}
                    variant="carousel"
                    onPress={() => market.router.push(`/(market)/${listing.id}`)}
                  />
                  <View
                    style={[
                      styles.priceChangeChip,
                      lowered ? styles.priceDropChip : styles.priceRiseChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.priceChangeLabel,
                        lowered ? styles.priceDropLabel : styles.priceRiseLabel,
                      ]}
                    >
                      {delta === 0
                        ? 'No change'
                        : lowered
                          ? `↓ ${formatMarketPrice(Math.abs(delta))}`
                          : `↑ ${formatMarketPrice(delta)}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        {featuredSellerIds.length > 0 ? (
          <>
            <SectionHeader title="Featured Sellers" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sellerRail}
            >
              {featuredSellerIds.map((sellerId) => {
                const seller = market.profiles[sellerId];
                if (!seller) {
                  return null;
                }

                return (
                  <GlassCard
                    key={sellerId}
                    style={styles.sellerCard}
                    onPress={() =>
                      market.router.push({
                        pathname: '/(market)/seller-profile',
                        params: { id: sellerId },
                      })
                    }
                  >
                    <Image
                      source={{ uri: seller.avatarUrl }}
                      style={styles.sellerAvatar}
                      contentFit="cover"
                    />
                    <Text style={styles.sellerName}>{seller.displayName}</Text>
                    <VerificationBadge tier={seller.verificationLevel} showLabel={false} />
                  </GlassCard>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function MarketBrowsePhase1Screen() {
  const market = useMarketPhase1Model();
  const params = useLocalSearchParams<{ category?: string }>();
  const initialCategoryId = getSingleParam(params.category);
  const [filters, setFilters] = useState<BrowseFilters>({
    query: '',
    categoryId: initialCategoryId,
    conditions: [],
    sort: 'newest',
  });
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [priceSheetVisible, setPriceSheetVisible] = useState(false);
  const [distanceSheetVisible, setDistanceSheetVisible] = useState(false);
  const [categorySheetVisible, setCategorySheetVisible] = useState(false);
  const [typeSheetVisible, setTypeSheetVisible] = useState(false);
  const [sortSheetVisible, setSortSheetVisible] = useState(false);
  const [saveSearchVisible, setSaveSearchVisible] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState('');
  const [notifyOnMatch, setNotifyOnMatch] = useState(true);
  const deferredQuery = debouncedQuery.trim().toLowerCase();

  useEffect(() => {
    const nextCategory = getSingleParam(params.category);
    setFilters((current) => ({
      ...current,
      categoryId: nextCategory ?? current.categoryId,
    }));
  }, [params.category]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(filters.query);
    }, 200);

    return () => clearTimeout(timer);
  }, [filters.query]);

  const visibleListings = useMemo(() => {
    const filtered = market.listings
      .filter((listing) => listing.status === 'active')
      .filter((listing) => {
        const queryText = `${listing.title} ${listing.description}`.toLowerCase();
        const matchesQuery = !deferredQuery || queryText.includes(deferredQuery);
        const matchesCategory =
          !filters.categoryId || listing.categoryId === filters.categoryId;
        const priceValue = listing.priceCents == null ? null : listing.priceCents / 100;
        const matchesMin = filters.priceMin == null || (priceValue ?? 0) >= filters.priceMin;
        const matchesMax = filters.priceMax == null || (priceValue ?? 0) <= filters.priceMax;
        const distance = market.distances[listing.id] ?? 0;
        const matchesDistance =
          filters.distanceMiles == null || distance <= filters.distanceMiles;
        const matchesConditions =
          filters.conditions.length === 0 ||
          (listing.condition != null && filters.conditions.includes(listing.condition));
        const matchesType =
          !filters.listingType || listing.listingType === filters.listingType;

        return (
          matchesQuery &&
          matchesCategory &&
          matchesMin &&
          matchesMax &&
          matchesDistance &&
          matchesConditions &&
          matchesType
        );
      })
      .sort((left, right) => {
        switch (filters.sort) {
          case 'priceLow':
            return (left.priceCents ?? 0) - (right.priceCents ?? 0);
          case 'priceHigh':
            return (right.priceCents ?? 0) - (left.priceCents ?? 0);
          case 'distance':
            return (market.distances[left.id] ?? 999) - (market.distances[right.id] ?? 999);
          case 'mostWatched':
            return right.watchCount - left.watchCount;
          default:
            return (
              new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
            );
        }
      });

    return filtered.slice(0, visibleCount);
  }, [deferredQuery, filters, market.distances, market.listings, visibleCount]);

  return (
    <View style={styles.screen}>
      <MarketBrandHeader
        primaryAction={() => {
          setFilters((current) => ({ ...current, query: '' }));
        }}
        secondaryAction={() => setSortSheetVisible(true)}
      />

      <View style={styles.browseShell}>
        <GlassCard style={styles.searchCard} padding={0}>
          <View style={styles.searchRow}>
            <MaterialSymbol name="search" size={18} color={MK_TEXT_MUTED} />
            <TextInput
              value={filters.query}
              onChangeText={(value) =>
                setFilters((current) => ({
                  ...current,
                  query: value,
                }))
              }
              placeholder="Search marketplace..."
              placeholderTextColor={MK_TEXT_MUTED}
              style={styles.searchInput}
            />
            {filters.query ? (
              <Pressable
                onPress={() =>
                  setFilters((current) => ({
                    ...current,
                    query: '',
                  }))
                }
              >
                <MaterialSymbol name="close" size={18} color={MK_TEXT_SECONDARY} />
              </Pressable>
            ) : (
              <Pressable onPress={() => setSortSheetVisible(true)}>
                <MaterialSymbol name="more_vert" size={18} color={MK_ACCENT} />
              </Pressable>
            )}
          </View>
        </GlassCard>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          <FilterChip
            label={
              filters.categoryId
                ? market.categories.find((category) => category.id === filters.categoryId)?.name ??
                  'Category'
                : 'Category'
            }
            active={Boolean(filters.categoryId)}
            icon="store"
            onPress={() => setCategorySheetVisible(true)}
          />
          <FilterChip
            label={getPriceRangeLabel(filters)}
            active={filters.priceMin != null || filters.priceMax != null}
            icon="payments"
            onPress={() => setPriceSheetVisible(true)}
          />
          <FilterChip
            label={filters.distanceMiles != null ? `${filters.distanceMiles} mi` : 'Distance'}
            active={filters.distanceMiles != null}
            icon="location_on"
            onPress={() => setDistanceSheetVisible(true)}
          />
          <FilterChip
            label={filters.listingType ? filters.listingType.replace(/_/g, ' ') : 'Type'}
            active={Boolean(filters.listingType)}
            icon="sell"
            onPress={() => setTypeSheetVisible(true)}
          />
          <FilterChip
            label={SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? 'Newest'}
            active={filters.sort !== 'newest'}
            icon="more_vert"
            onPress={() => setSortSheetVisible(true)}
          />
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          <FilterChip
            label="All"
            active={filters.conditions.length === 0}
            onPress={() =>
              setFilters((current) => ({
                ...current,
                conditions: [],
              }))
            }
          />
          {CONDITION_OPTIONS.map((condition) => (
            <FilterChip
              key={condition}
              label={condition.replace('_', ' ')}
              active={filters.conditions.includes(condition)}
              onPress={() =>
                setFilters((current) => ({
                  ...current,
                  conditions: current.conditions.includes(condition)
                    ? current.conditions.filter((value) => value !== condition)
                    : [...current.conditions, condition],
                }))
              }
            />
          ))}
        </ScrollView>

        <FlatList
          data={visibleListings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.browseGridContent}
          columnWrapperStyle={styles.browseGridRow}
          refreshControl={
            <RefreshControl
              tintColor={MK_ACCENT}
              refreshing={market.refreshing}
              onRefresh={() => {
                void market.refresh();
              }}
            />
          }
          ListEmptyComponent={
            <SectionEmpty
              title="No listings match your filters"
              body="Reset the filter stack and explore the broader market."
              actionLabel="Reset filters"
              onPress={() =>
                setFilters({
                  query: '',
                  conditions: [],
                  sort: 'newest',
                })
              }
            />
          }
          ListHeaderComponent={
            <View style={styles.gridMetaRow}>
              <Text style={styles.gridMetaText}>{visibleListings.length} items found</Text>
              <Pressable onPress={() => setSortSheetVisible(true)}>
                <Text style={styles.gridMetaLink}>
                  {SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? 'Newest'}
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <BrowseGridCard
              listing={item}
              distanceMiles={market.distances[item.id] ?? 0}
              isFavorite={market.watchlistIds.has(item.id)}
              onPress={() => market.router.push(`/(market)/${item.id}`)}
              onToggleFavorite={() => {
                void market.toggleWatch(item.id);
              }}
            />
          )}
          onEndReached={() => {
            if (visibleCount < market.listings.length) {
              setVisibleCount((current) => current + 12);
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            visibleCount < market.listings.length ? (
              <View style={styles.paginationFooter}>
                <Text style={styles.paginationFooterText}>Loading more listings…</Text>
              </View>
            ) : null
          }
        />

        {isFilterActive(filters) ? (
          <Pressable
            style={styles.floatingAction}
            onPress={() => {
              setSavedSearchName(
                savedSearchName ||
                  `${filters.query.trim() || 'Market'} search`,
              );
              setSaveSearchVisible(true);
            }}
          >
            <Text style={styles.floatingActionLabel}>Save Search</Text>
          </Pressable>
        ) : null}
      </View>

      <PickerSheet
        visible={categorySheetVisible}
        title="Category"
        options={[
          { label: 'All Categories', value: '' },
          ...market.categories.map((category) => ({
            label: category.name,
            value: category.id,
          })),
        ]}
        selected={filters.categoryId ?? ''}
        onClose={() => setCategorySheetVisible(false)}
        onSelect={(value) =>
          setFilters((current) => ({
            ...current,
            categoryId: value || undefined,
          }))
        }
      />

      <PickerSheet
        visible={priceSheetVisible}
        title="Price Range"
        options={PRICE_OPTIONS}
        selected={
          filters.priceMin == null && filters.priceMax == null
            ? 'any'
            : filters.priceMin === 50 && filters.priceMax === 250
              ? '50to250'
              : filters.priceMin === 250 && filters.priceMax === 750
                ? '250to750'
                : filters.priceMax === 50
                  ? 'under50'
                  : '750plus'
        }
        onClose={() => setPriceSheetVisible(false)}
        onSelect={(value) =>
          setFilters((current) => ({
            ...current,
            ...getPriceBounds(value),
          }))
        }
      />

      <PickerSheet
        visible={distanceSheetVisible}
        title="Distance"
        options={DISTANCE_OPTIONS}
        selected={filters.distanceMiles ?? 'any'}
        onClose={() => setDistanceSheetVisible(false)}
        onSelect={(value) =>
          setFilters((current) => ({
            ...current,
            distanceMiles: value === 'any' ? undefined : value,
          }))
        }
      />

      <PickerSheet
        visible={typeSheetVisible}
        title="Listing Type"
        options={[
          { label: 'Any Type', value: '' },
          ...LISTING_TYPE_OPTIONS.map((value) => ({
            label: value.replace(/_/g, ' '),
            value,
          })),
        ]}
        selected={filters.listingType ?? ''}
        onClose={() => setTypeSheetVisible(false)}
        onSelect={(value) =>
          setFilters((current) => ({
            ...current,
            listingType: value ? (value as ListingType) : undefined,
          }))
        }
      />

      <PickerSheet
        visible={sortSheetVisible}
        title="Sort Results"
        options={SORT_OPTIONS}
        selected={filters.sort}
        onClose={() => setSortSheetVisible(false)}
        onSelect={(value) =>
          setFilters((current) => ({
            ...current,
            sort: value,
          }))
        }
      />

      <Modal
        visible={saveSearchVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveSearchVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Save this search</Text>
            <TextInput
              value={savedSearchName}
              onChangeText={setSavedSearchName}
              placeholder="Name this search"
              placeholderTextColor={MK_TEXT_MUTED}
              style={styles.modalTextInput}
            />
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Notify me about new matches</Text>
                <Text style={styles.toggleBody}>Store this search locally for Phase 2 follow-up screens.</Text>
              </View>
              <Switch
                value={notifyOnMatch}
                onValueChange={setNotifyOnMatch}
                trackColor={{ false: withAlpha(MK_TEXT, 0.1), true: withAlpha(MK_ACCENT, 0.4) }}
                thumbColor={notifyOnMatch ? MK_ACCENT : MK_TEXT_SECONDARY}
              />
            </View>
            <View style={styles.modalFooter}>
              <Pressable
                style={styles.secondaryCapsule}
                onPress={() => setSaveSearchVisible(false)}
              >
                <Text style={styles.secondaryCapsuleLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.primaryCapsule}
                onPress={() => {
                  market.saveSearch({
                    id: makeId('saved-search'),
                    name: savedSearchName.trim() || 'Saved search',
                    notifyOnMatch,
                    createdAt: new Date().toISOString(),
                    filters,
                  });
                  setSaveSearchVisible(false);
                  Alert.alert('Search saved', 'Your filter stack is stored locally for follow-up flows.');
                }}
              >
                <Text style={styles.primaryCapsuleLabel}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

type ListingPhotoDraft = {
  id: string;
  uri: string;
};

export function MarketSellPhase1Screen() {
  const market = useMarketPhase1Model();
  const [listingType, setListingType] = useState<ListingType>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    market.categories[0]?.id ?? CATEGORY_META[0].id,
  );
  const [locationName, setLocationName] = useState('Los Angeles, CA');
  const [condition, setCondition] = useState<Condition>('good');
  const [localPickupOnly, setLocalPickupOnly] = useState(true);
  const [allowShipping, setAllowShipping] = useState(false);
  const [serviceRateMode, setServiceRateMode] = useState<'fixed' | 'hourly'>('fixed');
  const [photos, setPhotos] = useState<ListingPhotoDraft[]>([]);

  const isServiceListing =
    listingType === 'service_offer' || listingType === 'service_request';
  const requiresPrice = listingType === 'sell' || listingType === 'trade' || listingType === 'wanted';

  const pickPhoto = async (source: 'camera' | 'library') => {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: false,
            quality: 0.8,
          });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset?.uri) {
      return;
    }

    setPhotos((current) => {
      if (current.length >= 10) {
        return current;
      }

      return [...current, { id: makeId('photo'), uri: asset.uri }];
    });
  };

  const promptPhotoPicker = () => {
    Alert.alert('Add photo', 'Choose how you want to add a photo.', [
      {
        text: 'Camera',
        onPress: () => {
          void pickPhoto('camera');
        },
      },
      {
        text: 'Library',
        onPress: () => {
          void pickPhoto('library');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const movePhotoToCover = (photoId: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === photoId);
      if (!target) {
        return current;
      }

      return [target, ...current.filter((photo) => photo.id !== photoId)];
    });
  };

  const submitListing = async (saveAsDraft: boolean) => {
    if (!title.trim() || !description.trim() || !selectedCategoryId || (!saveAsDraft && photos.length === 0)) {
      Alert.alert('Incomplete listing', 'Add the title, description, category, and at least one photo before posting.');
      return;
    }

    if (requiresPrice && !price.trim() && !saveAsDraft) {
      Alert.alert('Price required', 'Enter a price before publishing this listing.');
      return;
    }

    const priceCents = price.trim() ? Math.round(Number(price) * 100) : undefined;
    if (price.trim() && Number.isNaN(priceCents ?? Number.NaN)) {
      Alert.alert('Invalid price', 'Enter a numeric dollar amount.');
      return;
    }

    const candidate: CreateListingInput = {
      categoryId: selectedCategoryId,
      title: title.trim(),
      description: description.trim(),
      priceCents: priceCents,
      currency: 'USD',
      pricingType:
        listingType === 'free'
          ? 'free'
          : listingType === 'trade'
            ? 'trade'
            : serviceRateMode === 'hourly'
              ? 'negotiable'
              : 'fixed',
      condition: isServiceListing ? undefined : condition,
      listingType,
      locationName: locationName.trim(),
      fulfillmentType: isServiceListing
        ? 'remote'
        : allowShipping && !localPickupOnly
          ? 'shipping'
          : 'pickup',
      serviceRadiusMiles: isServiceListing ? 30 : undefined,
      availabilityNotes: isServiceListing ? 'Availability confirmed after kickoff' : undefined,
    };

    const parsed = CreateListingInputSchema.safeParse(candidate);
    if (!parsed.success) {
      Alert.alert('Listing needs more detail', parsed.error.issues[0]?.message ?? 'Check the listing fields and try again.');
      return;
    }

    const nextId = await market.createListing(parsed.data, {
      photoUris: photos.map((photo) => photo.uri),
      saveAsDraft,
    });

    if (!nextId) {
      return;
    }

    if (saveAsDraft) {
      Alert.alert('Draft saved', 'Your draft is stored locally and will appear in your profile.');
      return;
    }

    market.router.replace(`/(market)/${nextId}`);
  };

  return (
    <View style={styles.screen}>
      <SurfaceHeader
        title="New Listing"
        subtitle="Draft-friendly seller flow"
        left={
          <Pressable style={styles.iconButton} onPress={() => market.router.back()}>
            <MaterialSymbol name="close" size={18} color={MK_TEXT} />
          </Pressable>
        }
        right={
          <Pressable style={styles.iconButton} onPress={() => void submitListing(true)}>
            <Text style={styles.headerActionText}>Draft</Text>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.sellContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.typeRail}>
          {LISTING_TYPE_OPTIONS.map((type) => (
            <ListingTypePill
              key={type}
              type={type}
              selected={listingType === type}
              onPress={() => setListingType(type)}
            />
          ))}
        </View>

        <GlassCard>
          <SectionHeader title="Photos" />
          <Text style={styles.helperText}>
            Add up to 10 photos. Tap a thumbnail to promote it to the cover slot.
          </Text>
          <View style={styles.photoComposer}>
            <Pressable style={styles.coverSlot} onPress={photos[0] ? () => movePhotoToCover(photos[0].id) : promptPhotoPicker}>
              {photos[0] ? (
                <Image source={{ uri: photos[0].uri }} style={styles.coverSlotImage} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <MaterialSymbol name="photo_camera" size={22} color={MK_ACCENT_LIGHT} />
                  <Text style={styles.photoPlaceholderLabel}>Cover</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.photoGrid}>
              {Array.from({ length: 9 }).map((_, index) => {
                const photo = photos[index + 1];
                if (photo) {
                  return (
                    <Pressable
                      key={photo.id}
                      style={styles.photoThumb}
                      onPress={() => movePhotoToCover(photo.id)}
                    >
                      <Image source={{ uri: photo.uri }} style={styles.photoThumbImage} contentFit="cover" />
                      <Pressable
                        style={styles.photoDelete}
                        onPress={() =>
                          setPhotos((current) =>
                            current.filter((item) => item.id !== photo.id),
                          )
                        }
                      >
                        <MaterialSymbol name="close" size={14} color={MK_TEXT} />
                      </Pressable>
                    </Pressable>
                  );
                }

                return (
                  <Pressable key={`empty-${index}`} style={styles.photoThumbEmpty} onPress={promptPhotoPicker}>
                    <MaterialSymbol name="add" size={18} color={MK_ACCENT_LIGHT} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.groupLabel}>Basic Info</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What are you selling?"
            placeholderTextColor={MK_TEXT_MUTED}
            style={styles.fieldInput}
          />
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your item, condition, why you are selling"
            placeholderTextColor={MK_TEXT_MUTED}
            style={[styles.fieldInput, styles.fieldInputLarge]}
            multiline
          />
        </GlassCard>

        <GlassCard>
          <Text style={styles.groupLabel}>Price + Condition</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder={requiresPrice ? 'Price in dollars' : 'Optional price'}
            placeholderTextColor={MK_TEXT_MUTED}
            keyboardType="decimal-pad"
            editable={listingType !== 'free'}
            style={[styles.fieldInput, listingType === 'free' ? styles.fieldInputDisabled : null]}
          />
          {!isServiceListing ? (
            <View style={styles.filterRail}>
              {CONDITION_OPTIONS.map((value) => (
                <FilterChip
                  key={value}
                  label={value.replace('_', ' ')}
                  active={condition === value}
                  onPress={() => setCondition(value)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.filterRail}>
              <FilterChip
                label="Fixed Rate"
                active={serviceRateMode === 'fixed'}
                onPress={() => setServiceRateMode('fixed')}
              />
              <FilterChip
                label="Hourly"
                active={serviceRateMode === 'hourly'}
                onPress={() => setServiceRateMode('hourly')}
              />
            </View>
          )}
        </GlassCard>

        <GlassCard>
          <Text style={styles.groupLabel}>Category</Text>
          <View style={styles.typeRail}>
            {market.categories.map((category) => (
              <FilterChip
                key={category.id}
                label={category.name}
                active={selectedCategoryId === category.id}
                onPress={() => setSelectedCategoryId(category.id)}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard>
          <Text style={styles.groupLabel}>Location + Fulfillment</Text>
          <View style={styles.iconInputRow}>
            <MaterialSymbol name="location_on" size={16} color={MK_ACCENT_LIGHT} />
            <TextInput
              value={locationName}
              onChangeText={setLocationName}
              placeholder="City, state"
              placeholderTextColor={MK_TEXT_MUTED}
              style={styles.inlineInput}
            />
          </View>
          {!isServiceListing ? (
            <>
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>Local pickup only</Text>
                  <Text style={styles.toggleBody}>Disable shipping and keep this listing local.</Text>
                </View>
                <Switch
                  value={localPickupOnly}
                  onValueChange={setLocalPickupOnly}
                  trackColor={{ false: withAlpha(MK_TEXT, 0.1), true: withAlpha(MK_ACCENT, 0.4) }}
                  thumbColor={localPickupOnly ? MK_ACCENT : MK_TEXT_SECONDARY}
                />
              </View>
              <View style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleTitle}>Offer shipping</Text>
                  <Text style={styles.toggleBody}>Show shipping at checkout for buyers outside your pickup zone.</Text>
                </View>
                <Switch
                  value={allowShipping}
                  onValueChange={setAllowShipping}
                  trackColor={{ false: withAlpha(MK_TEXT, 0.1), true: withAlpha(MK_ACCENT, 0.4) }}
                  thumbColor={allowShipping ? MK_ACCENT : MK_TEXT_SECONDARY}
                />
              </View>
            </>
          ) : (
            <Text style={styles.helperText}>
              Service listings default to remote delivery in this first phase.
            </Text>
          )}
        </GlassCard>
      </ScrollView>

      <View style={styles.sellFooter}>
        <Pressable style={styles.secondaryCapsule} onPress={() => void submitListing(true)}>
          <Text style={styles.secondaryCapsuleLabel}>Save Draft</Text>
        </Pressable>
        <Pressable style={styles.primaryCapsule} onPress={() => void submitListing(false)}>
          <Text style={styles.primaryCapsuleLabel}>Post Listing</Text>
        </Pressable>
      </View>
    </View>
  );
}

type MessageFilter = 'all' | 'unread' | 'buying' | 'selling' | 'requests';

export function MarketMessagesPhase1Screen() {
  const market = useMarketPhase1Model();
  const [filter, setFilter] = useState<MessageFilter>('all');
  const [query, setQuery] = useState('');

  const conversationRows = useMemo(() => {
    return market.conversations
      .map((conversation) => {
        const listing = market.listingById[conversation.listingId];
        const meta = market.conversationMeta[conversation.id];
        const otherUserId =
          conversation.buyerId === market.currentUserId
            ? conversation.sellerId
            : conversation.buyerId;
        const otherUser = market.profiles[otherUserId] ?? market.profiles['seller-maya'];
        const messages = market.messagesByConversation[conversation.id] ?? [];
        const lastMessage = messages[messages.length - 1];
        return {
          conversation,
          listing,
          otherUser,
          preview: meta?.preview ?? lastMessage?.body ?? 'Open conversation',
          unreadCount: meta?.unreadCount ?? 0,
          encrypted:
            meta?.encrypted ??
            lastMessage?.contentType === 'application/e2ee+ciphertext',
          role:
            conversation.buyerId === market.currentUserId ? 'buying' : 'selling',
          requestPending: meta?.requestPending ?? false,
          online: meta?.online ?? false,
        };
      })
      .filter((row) => {
        const queryText = `${row.otherUser.displayName} ${row.preview} ${row.listing?.title ?? ''}`.toLowerCase();
        const matchesQuery = !query.trim() || queryText.includes(query.trim().toLowerCase());
        const matchesFilter =
          filter === 'all'
            ? true
            : filter === 'unread'
              ? row.unreadCount > 0
              : filter === 'requests'
                ? row.requestPending
                : row.role === filter;

        return matchesQuery && matchesFilter;
      });
  }, [
    filter,
    market.conversationMeta,
    market.conversations,
    market.currentUserId,
    market.listingById,
    market.messagesByConversation,
    market.profiles,
    query,
  ]);

  const pendingRequests = conversationRows.filter((row) => row.requestPending);

  return (
    <View style={styles.screen}>
      <MarketBrandHeader
        primaryAction={() => market.router.push('/(market)/browse')}
        secondaryAction={() => setFilter('requests')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pageContent}
        refreshControl={
          <RefreshControl
            tintColor={MK_ACCENT}
            refreshing={market.refreshing}
            onRefresh={() => {
              void market.refresh();
            }}
          />
        }
      >
        <View style={styles.messagesHero}>
          <Text style={styles.heroEyebrow}>INBOX</Text>
          <Text style={styles.heroTitle}>Messages</Text>
          <Text style={styles.heroBody}>End-to-end encrypted by default</Text>
        </View>

        <GlassCard style={styles.searchCard} padding={0}>
          <View style={styles.searchRow}>
            <MaterialSymbol name="search" size={18} color={MK_TEXT_MUTED} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search conversations..."
              placeholderTextColor={MK_TEXT_MUTED}
              style={styles.searchInput}
            />
          </View>
        </GlassCard>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          {(['all', 'unread', 'buying', 'selling', 'requests'] as const).map((value) => (
            <FilterChip
              key={value}
              label={value}
              active={filter === value}
              onPress={() => setFilter(value)}
            />
          ))}
        </ScrollView>

        {pendingRequests.length > 0 && filter !== 'requests' ? (
          <GlassCard style={styles.requestsBanner} elevated>
            <View style={styles.requestsBannerCopy}>
              <Text style={styles.requestsBannerTitle}>{pendingRequests.length} requests</Text>
              <Text style={styles.requestsBannerBody}>
                Review pending buyer threads before they age out.
              </Text>
            </View>
            <Pressable
              style={styles.primaryCapsule}
              onPress={() => setFilter('requests')}
            >
              <Text style={styles.primaryCapsuleLabel}>Review</Text>
            </Pressable>
          </GlassCard>
        ) : null}

        {conversationRows.length === 0 ? (
          <SectionEmpty
            title="No conversations yet"
            body="Start by messaging a seller from any listing in Browse."
            actionLabel="Browse listings"
            onPress={() => market.router.push('/(market)/browse')}
          />
        ) : (
          <View style={styles.conversationList}>
            {conversationRows.map((row) => (
              <GlassCard
                key={row.conversation.id}
                onPress={() =>
                  market.router.push(`/(market)/conversation/${row.conversation.id}`)
                }
                style={styles.conversationCard}
              >
                <View style={styles.conversationRow}>
                  <View style={styles.conversationAvatarWrap}>
                    <Image
                      source={{ uri: row.otherUser.avatarUrl }}
                      style={styles.conversationAvatar}
                      contentFit="cover"
                    />
                    {row.online ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <View style={styles.conversationCopy}>
                    <View style={styles.conversationTopLine}>
                      <Text style={styles.conversationName}>{row.otherUser.displayName}</Text>
                      <Text style={styles.conversationTime}>
                        {row.conversation.lastMessageAt
                          ? formatRelativeDate(row.conversation.lastMessageAt)
                          : 'Now'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.conversationPreview,
                        row.encrypted ? styles.conversationPreviewEncrypted : null,
                      ]}
                      numberOfLines={1}
                    >
                      {row.preview}
                    </Text>
                    {row.listing ? (
                      <View style={styles.listingMiniChip}>
                        <Text style={styles.listingMiniChipText}>{row.listing.title}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.conversationMeta}>
                    {row.encrypted ? (
                      <MaterialSymbol name="lock" size={14} color={MK_ACCENT_LIGHT} />
                    ) : null}
                    {row.unreadCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeLabel}>{row.unreadCount}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        <View style={styles.encryptedNote}>
          <MaterialSymbol name="lock" size={14} color={MK_ACCENT_LIGHT} />
          <Text style={styles.encryptedNoteLabel}>Encrypted</Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function MarketProfilePhase1Screen() {
  const market = useMarketPhase1Model();
  return (
    <SellerProfileView sellerId={market.currentUserId} isOwnProfile />
  );
}

export function MarketSellerProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const market = useMarketPhase1Model();
  const sellerId = getSingleParam(params.id) ?? 'seller-maya';

  return (
    <SellerProfileView
      sellerId={sellerId}
      isOwnProfile={sellerId === market.currentUserId}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MK_SURFACES.lowest,
  },
  scroll: {
    flex: 1,
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 22,
  },
  headerShell: {
    backgroundColor: MK_GLASS_NAV.backgroundColor,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  headerBar: {
    minHeight: 64,
    borderRadius: 24,
    backgroundColor: withAlpha(MK_SURFACES.base, 0.92),
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSlot: {
    minWidth: 44,
    minHeight: 40,
    justifyContent: 'center',
  },
  headerSlotRight: {
    alignItems: 'flex-end',
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  headerSubtitle: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 17,
  },
  headerActionText: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT,
  },
  brandWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    fontFamily: MK_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: 2.8,
    color: MK_ACCENT,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_TEXT, 0.04),
  },
  carouselRail: {
    gap: 16,
    paddingRight: 20,
  },
  carouselItem: {
    width: 288,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  categoryHalf: {
    width: '47.5%',
  },
  categoryWide: {
    width: '100%',
  },
  priceChangeChip: {
    position: 'absolute',
    top: 14,
    right: 14,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  priceDropChip: {
    backgroundColor: withAlpha('#30D158', 0.18),
  },
  priceRiseChip: {
    backgroundColor: withAlpha('#FF453A', 0.18),
  },
  priceChangeLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
  },
  priceDropLabel: {
    color: '#30D158',
  },
  priceRiseLabel: {
    color: '#FFB4AB',
  },
  sellerRail: {
    gap: 12,
    paddingRight: 20,
  },
  sellerCard: {
    width: 140,
    alignItems: 'center',
    gap: 10,
  },
  sellerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  sellerName: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    textAlign: 'center',
  },
  browseShell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  searchCard: {
    marginBottom: 14,
  },
  searchRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: MK_TEXT,
    fontFamily: MK_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  filterRail: {
    gap: 10,
    paddingBottom: 8,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: MK_SURFACES.high,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: MK_ACCENT,
  },
  filterChipLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  filterChipLabelActive: {
    color: MK_ACCENT_DARK,
  },
  browseGridContent: {
    paddingBottom: 160,
    gap: 14,
  },
  browseGridRow: {
    gap: 12,
  },
  gridMetaRow: {
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridMetaText: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  gridMetaLink: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT,
  },
  gridCardWrap: {
    flex: 1,
    position: 'relative',
  },
  favoriteOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_SURFACES.lowest, 0.3),
  },
  distanceOverlay: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_SURFACES.lowest, 0.42),
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceOverlayLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT,
  },
  paginationFooter: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  paginationFooterText: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  floatingAction: {
    position: 'absolute',
    right: 20,
    bottom: 110,
    minHeight: 50,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MK_ACCENT,
    shadowColor: MK_ACCENT,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  floatingActionLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_DARK,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 28,
    backgroundColor: MK_SURFACES.base,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  modalOptionList: {
    gap: 10,
  },
  modalOption: {
    borderRadius: 18,
    backgroundColor: MK_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalOptionActive: {
    backgroundColor: withAlpha(MK_ACCENT, 0.14),
  },
  modalOptionCopy: {
    flex: 1,
    gap: 4,
  },
  modalOptionLabel: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  modalOptionLabelActive: {
    color: MK_ACCENT_LIGHT,
  },
  modalOptionHint: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  modalCloseButton: {
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MK_SURFACES.high,
  },
  modalCloseLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT,
  },
  modalTextInput: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: MK_SURFACES.low,
    paddingHorizontal: 14,
    color: MK_TEXT,
    fontFamily: MK_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  toggleBody: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  sellContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 180,
    gap: 18,
  },
  typeRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  helperText: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  photoComposer: {
    marginTop: 14,
    gap: 12,
  },
  coverSlot: {
    height: 214,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: MK_SURFACES.high,
  },
  coverSlotImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_LIGHT,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoThumb: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: MK_SURFACES.high,
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoDelete: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_SURFACES.lowest, 0.38),
  },
  photoThumbEmpty: {
    width: '31.5%',
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MK_SURFACES.low,
  },
  groupLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
    marginBottom: 10,
  },
  fieldInput: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: MK_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: MK_TEXT,
    fontFamily: MK_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  fieldInputLarge: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  fieldInputDisabled: {
    opacity: 0.5,
  },
  iconInputRow: {
    minHeight: 48,
    borderRadius: 18,
    backgroundColor: MK_SURFACES.low,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  inlineInput: {
    flex: 1,
    color: MK_TEXT,
    fontFamily: MK_TYPOGRAPHY.bodyMd.fontFamily,
    fontSize: 14,
    lineHeight: 20,
  },
  sellFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 88,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 12,
  },
  primaryCapsule: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: MK_ACCENT,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryCapsuleLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_DARK,
  },
  secondaryCapsule: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_TEXT, 0.06),
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryCapsuleLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT,
  },
  messagesHero: {
    gap: 6,
  },
  heroEyebrow: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_LIGHT,
  },
  heroTitle: {
    fontFamily: MK_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -0.8,
    color: MK_TEXT,
  },
  heroBody: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    justifyContent: 'space-between',
  },
  requestsBannerCopy: {
    flex: 1,
    gap: 4,
  },
  requestsBannerTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  requestsBannerBody: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
  conversationList: {
    gap: 12,
  },
  conversationCard: {
    padding: 0,
  },
  conversationRow: {
    minHeight: 92,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  conversationAvatarWrap: {
    position: 'relative',
  },
  conversationAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  onlineDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#30D158',
  },
  conversationCopy: {
    flex: 1,
    gap: 5,
  },
  conversationTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  conversationName: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    flex: 1,
  },
  conversationTime: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_TERTIARY,
  },
  conversationPreview: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  conversationPreviewEncrypted: {
    fontStyle: 'italic',
  },
  listingMiniChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: withAlpha(MK_ACCENT, 0.12),
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  listingMiniChipText: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_LIGHT,
  },
  conversationMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: MK_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_DARK,
  },
  encryptedNote: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: withAlpha(MK_TEXT, 0.05),
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  encryptedNoteLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  profileContent: {
    paddingBottom: 160,
    gap: 18,
  },
  coverWrap: {
    height: 220,
    backgroundColor: MK_SURFACES.high,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.26)',
  },
  profileHeroCard: {
    marginHorizontal: 20,
    marginTop: -48,
    gap: 18,
  },
  profileIdentity: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  profileAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  profileIdentityCopy: {
    flex: 1,
    gap: 8,
  },
  profileName: {
    fontFamily: MK_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: MK_TEXT,
  },
  profileTagline: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  profileActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  sellerStat: {
    flex: 1,
    minWidth: '22%',
    borderRadius: 18,
    backgroundColor: MK_SURFACES.low,
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 4,
  },
  sellerStatValue: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  sellerStatLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  listingsGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  listingGridItem: {
    width: '48%',
  },
  reviewHero: {
    marginHorizontal: 20,
  },
  reviewAverage: {
    fontFamily: MK_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: 48,
    lineHeight: 50,
    color: MK_TEXT,
  },
  reviewAverageSub: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
    marginBottom: 14,
  },
  reviewHistogram: {
    gap: 10,
  },
  reviewHistogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewHistogramLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
    width: 18,
  },
  reviewHistogramTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: MK_SURFACES.high,
    overflow: 'hidden',
  },
  reviewHistogramFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: MK_ACCENT,
  },
  reviewHistogramCount: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
    width: 24,
    textAlign: 'right',
  },
  reviewList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  reviewCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: withAlpha(MK_ACCENT, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_LIGHT,
  },
  reviewCopy: {
    flex: 1,
    gap: 2,
  },
  reviewName: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  reviewStars: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_LIGHT,
  },
  reviewDate: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_TERTIARY,
  },
  reviewListingChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: withAlpha(MK_TEXT, 0.05),
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  reviewListingChipText: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  reviewBody: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
  },
  aboutStack: {
    paddingHorizontal: 20,
    gap: 12,
  },
  aboutLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
    marginBottom: 6,
  },
  aboutValue: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  aboutBody: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  emptyBody: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  secondaryActionButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_ACCENT, 0.12),
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  secondaryActionLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_ACCENT_LIGHT,
  },
});

// Safe default export to prevent crashes if Expo Router registers this
// module-local source file as a route. The visible tabs re-export the
// named Phase 1 screens from their own route files.
export default MarketHomePhase1Screen;
