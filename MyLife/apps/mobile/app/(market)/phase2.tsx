import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ConditionPill,
  GlassCard,
  ListingCard,
  MK_ACCENT,
  MK_ACCENT_DARK,
  MK_ACCENT_LIGHT,
  MK_FONTS,
  MK_GLOW_STYLE,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TEXT_TERTIARY,
  MK_TYPOGRAPHY,
  MaterialSymbol,
  PriceBadge,
  VerificationBadge,
  calculateVerificationLevel,
  deleteCachedWatchlistItem,
  formatMarketPrice,
  getCachedCategories,
  getCachedConversations,
  getCachedListingById,
  getCachedListings,
  getCachedWatchlist,
  getListingPriceLabel,
  type Category,
  type Conversation,
  type DatabaseAdapter as MarketDatabaseAdapter,
  type Listing,
  type SellerStats,
  type SellerVerification,
  type WatchlistItem,
  upsertCachedConversation,
  upsertCachedWatchlistItem,
  withAlpha,
} from '@mylife/market';
import type { DatabaseAdapter } from '@mylife/db';
import { useDatabase } from '../../components/DatabaseProvider';

const LOCAL_USER = 'local-user';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ListingPhoto = {
  id: string;
  url: string;
};

type SellerProfile = {
  id: string;
  name: string;
  handle: string;
  avatarSeed: string;
  city: string;
  memberSince: string;
  responseTime: string;
  tagline: string;
};

type WatchlistSort = 'recent' | 'price_change' | 'price_low_high' | 'price_high_low';
type WatchlistFilter = 'all' | 'price_drops' | 'sold' | 'available';

type SavedSearchRecord = {
  id: string;
  name: string;
  query: string;
  categoryId: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  notifyOnMatch: boolean;
  createdAt: string;
  lastCheckedAt: string;
  matchCount: number;
  distanceLabel: string;
  conditions: Array<Listing['condition']>;
  listingType: Listing['listingType'] | null;
};

type ReviewRecord = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  sellerId: string;
  listingId: string;
  rating: number;
  body: string;
  createdAt: string;
  helpfulCount: number;
  photos: string[];
};

const FALLBACK_CATEGORIES: Category[] = [
  {
    id: 'mk-cat-electronics',
    parentId: null,
    name: 'Electronics',
    slug: 'electronics',
    icon: 'devices',
    sortOrder: 0,
  },
  {
    id: 'mk-cat-home',
    parentId: null,
    name: 'Home',
    slug: 'home',
    icon: 'home',
    sortOrder: 1,
  },
  {
    id: 'mk-cat-photo',
    parentId: null,
    name: 'Photo',
    slug: 'photo',
    icon: 'photo_camera',
    sortOrder: 2,
  },
  {
    id: 'mk-cat-service',
    parentId: null,
    name: 'Services',
    slug: 'services',
    icon: 'build',
    sortOrder: 3,
  },
];

const FALLBACK_LISTINGS: Listing[] = [
  {
    id: 'mk-listing-camera',
    sellerId: 'seller-maya',
    categoryId: 'mk-cat-photo',
    title: 'Mirrorless camera kit with two lenses',
    description:
      'Well-kept camera body, a fast 35mm prime, and a lightweight zoom that has been great for weekend travel. Includes two batteries, a wrist strap, padded sling, and the original charger. I am selling because I moved to a full-frame body and this kit is no longer getting used.',
    priceCents: 84500,
    currency: 'USD',
    pricingType: 'fixed',
    condition: 'like_new',
    listingType: 'sell',
    status: 'active',
    locationName: 'Silver Lake, Los Angeles',
    latitude: null,
    longitude: null,
    fulfillmentType: 'pickup',
    serviceRadiusMiles: null,
    availabilityNotes: 'Pickup after 5pm weekdays or Saturday morning.',
    tradeFor: null,
    viewCount: 132,
    watchCount: 19,
    messageCount: 7,
    createdAt: '2026-04-04T08:15:00.000Z',
    updatedAt: '2026-04-04T08:15:00.000Z',
    expiresAt: null,
  },
  {
    id: 'mk-listing-desk',
    sellerId: 'seller-leo',
    categoryId: 'mk-cat-home',
    title: 'Solid oak writing desk with cable tray',
    description:
      'Desk fits a laptop setup cleanly and has a shallow drawer for notebooks, chargers, and the small adapters that disappear otherwise. Surface has one tiny scuff on the back edge but presents beautifully from the front.',
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
    createdAt: '2026-04-03T19:00:00.000Z',
    updatedAt: '2026-04-03T19:00:00.000Z',
    expiresAt: null,
  },
  {
    id: 'mk-listing-lamp',
    sellerId: 'seller-iris',
    categoryId: 'mk-cat-home',
    title: 'Ceramic table lamp pair with linen shades',
    description:
      'Matching lamps from a recent staging project. They work perfectly and come with warm bulbs installed. Shipping is available and already factored into the ask.',
    priceCents: 11800,
    currency: 'USD',
    pricingType: 'fixed',
    condition: 'new',
    listingType: 'sell',
    status: 'active',
    locationName: 'Echo Park',
    latitude: null,
    longitude: null,
    fulfillmentType: 'shipping',
    serviceRadiusMiles: null,
    availabilityNotes: 'Can ship same day.',
    tradeFor: null,
    viewCount: 58,
    watchCount: 6,
    messageCount: 2,
    createdAt: '2026-04-04T12:10:00.000Z',
    updatedAt: '2026-04-04T12:10:00.000Z',
    expiresAt: null,
  },
  {
    id: 'mk-listing-record',
    sellerId: 'seller-maya',
    categoryId: 'mk-cat-home',
    title: 'Vintage walnut record player cabinet',
    description:
      'Beautiful cabinet, fully working, sold locally over the weekend. Kept here so the watchlist can still show sold-state behavior and price history.',
    priceCents: 13500,
    currency: 'USD',
    pricingType: 'fixed',
    condition: 'fair',
    listingType: 'sell',
    status: 'sold',
    locationName: 'Atwater Village',
    latitude: null,
    longitude: null,
    fulfillmentType: 'pickup',
    serviceRadiusMiles: null,
    availabilityNotes: null,
    tradeFor: null,
    viewCount: 201,
    watchCount: 33,
    messageCount: 14,
    createdAt: '2026-03-28T10:00:00.000Z',
    updatedAt: '2026-04-02T17:30:00.000Z',
    expiresAt: null,
  },
  {
    id: 'mk-listing-film-bag',
    sellerId: 'seller-cass',
    categoryId: 'mk-cat-photo',
    title: 'Film camera bag with dividers',
    description:
      'Compact shoulder bag with customizable padded dividers. Free to anyone starting out in film or digital photography.',
    priceCents: 0,
    currency: 'USD',
    pricingType: 'free',
    condition: 'good',
    listingType: 'free',
    status: 'active',
    locationName: 'Highland Park',
    latitude: null,
    longitude: null,
    fulfillmentType: 'pickup',
    serviceRadiusMiles: null,
    availabilityNotes: null,
    tradeFor: null,
    viewCount: 41,
    watchCount: 9,
    messageCount: 3,
    createdAt: '2026-04-05T11:40:00.000Z',
    updatedAt: '2026-04-05T11:40:00.000Z',
    expiresAt: null,
  },
  {
    id: 'mk-listing-web-refresh',
    sellerId: 'seller-nina',
    categoryId: 'mk-cat-service',
    title: 'Portfolio website refresh for local creators',
    description:
      'Fast-turnaround design and build cleanup for portfolio sites, with analytics, accessibility, and copy feedback included. Remote collaboration, one-week sprint, and async Loom updates throughout.',
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
    availabilityNotes: 'Two spots open this month.',
    tradeFor: null,
    viewCount: 49,
    watchCount: 7,
    messageCount: 3,
    createdAt: '2026-04-03T12:30:00.000Z',
    updatedAt: '2026-04-03T12:30:00.000Z',
    expiresAt: null,
  },
];

const FALLBACK_LISTING_PHOTOS: Record<string, ListingPhoto[]> = {
  'mk-listing-camera': [
    {
      id: 'mk-photo-camera-1',
      url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'mk-photo-camera-2',
      url: 'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'mk-photo-camera-3',
      url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80',
    },
  ],
  'mk-listing-desk': [
    {
      id: 'mk-photo-desk-1',
      url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'mk-photo-desk-2',
      url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    },
  ],
  'mk-listing-lamp': [
    {
      id: 'mk-photo-lamp-1',
      url: 'https://images.unsplash.com/photo-1517999144091-3d9dca6d1e43?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'mk-photo-lamp-2',
      url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    },
  ],
  'mk-listing-record': [
    {
      id: 'mk-photo-record-1',
      url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80',
    },
  ],
  'mk-listing-film-bag': [
    {
      id: 'mk-photo-film-bag-1',
      url: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1200&q=80',
    },
  ],
  'mk-listing-web-refresh': [
    {
      id: 'mk-photo-service-1',
      url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
    },
  ],
};

const SELLER_PROFILES: Record<string, SellerProfile> = {
  'seller-maya': {
    id: 'seller-maya',
    name: 'Maya Chen',
    handle: '@mayacollects',
    avatarSeed: 'MC',
    city: 'Silver Lake',
    memberSince: '2022-08-18T09:00:00.000Z',
    responseTime: 'Responds in about 22 minutes',
    tagline: 'Photo gear, audio pieces, and well-kept home finds.',
  },
  'seller-leo': {
    id: 'seller-leo',
    name: 'Leo Park',
    handle: '@leopark',
    avatarSeed: 'LP',
    city: 'Pasadena',
    memberSince: '2023-01-09T12:00:00.000Z',
    responseTime: 'Responds in about 1 hour',
    tagline: 'Furniture and work-from-home setups with clean photos and easy pickup.',
  },
  'seller-iris': {
    id: 'seller-iris',
    name: 'Iris Walker',
    handle: '@irisstage',
    avatarSeed: 'IW',
    city: 'Echo Park',
    memberSince: '2021-04-02T12:00:00.000Z',
    responseTime: 'Usually replies in 15 minutes',
    tagline: 'Staging decor, lights, and accent pieces with shipping options.',
  },
  'seller-cass': {
    id: 'seller-cass',
    name: 'Cass Rivera',
    handle: '@cassmakes',
    avatarSeed: 'CR',
    city: 'Highland Park',
    memberSince: '2024-03-12T12:00:00.000Z',
    responseTime: 'Responds in a couple hours',
    tagline: 'Giving away starter gear and community extras.',
  },
  'seller-nina': {
    id: 'seller-nina',
    name: 'Nina Alvarez',
    handle: '@ninaalvarez',
    avatarSeed: 'NA',
    city: 'Remote',
    memberSince: '2020-10-21T12:00:00.000Z',
    responseTime: 'Replies the same day',
    tagline: 'Design systems, landing pages, and quick portfolio cleanups.',
  },
};

const SELLER_STATS: Record<string, SellerStats> = {
  'seller-maya': {
    sellerId: 'seller-maya',
    totalListings: 26,
    activeListings: 4,
    totalSold: 41,
    averageRating: 4.9,
    reviewCount: 26,
    responseRate: 0.97,
    memberSince: '2022-08-18T09:00:00.000Z',
  },
  'seller-leo': {
    sellerId: 'seller-leo',
    totalListings: 14,
    activeListings: 3,
    totalSold: 18,
    averageRating: 4.7,
    reviewCount: 12,
    responseRate: 0.92,
    memberSince: '2023-01-09T12:00:00.000Z',
  },
  'seller-iris': {
    sellerId: 'seller-iris',
    totalListings: 19,
    activeListings: 6,
    totalSold: 33,
    averageRating: 4.8,
    reviewCount: 18,
    responseRate: 0.95,
    memberSince: '2021-04-02T12:00:00.000Z',
  },
  'seller-cass': {
    sellerId: 'seller-cass',
    totalListings: 8,
    activeListings: 2,
    totalSold: 7,
    averageRating: 4.6,
    reviewCount: 8,
    responseRate: 0.89,
    memberSince: '2024-03-12T12:00:00.000Z',
  },
  'seller-nina': {
    sellerId: 'seller-nina',
    totalListings: 31,
    activeListings: 5,
    totalSold: 54,
    averageRating: 4.9,
    reviewCount: 41,
    responseRate: 0.99,
    memberSince: '2020-10-21T12:00:00.000Z',
  },
};

const SELLER_VERIFICATION: Record<string, SellerVerification> = Object.fromEntries(
  Object.entries(SELLER_STATS).map(([sellerId, stats]) => {
    const createdAt = stats.memberSince;
    const verificationLevel = calculateVerificationLevel({
      emailVerified: true,
      phoneVerified: true,
      photoVerified: true,
      idVerified: sellerId !== 'seller-cass',
      completedSales: stats.totalSold,
      totalReviews: stats.reviewCount,
      averageRating: stats.averageRating,
      responseRate: stats.responseRate,
      accountAgeDays: Math.max(90, daysSince(stats.memberSince)),
    });

    return [
      sellerId,
      {
        id: `verification-${sellerId}`,
        userId: sellerId,
        emailVerified: true,
        phoneVerified: true,
        photoVerified: true,
        idVerified: sellerId !== 'seller-cass',
        completedSales: stats.totalSold,
        totalReviews: stats.reviewCount,
        averageRating: stats.averageRating,
        accountAgeDays: Math.max(90, daysSince(stats.memberSince)),
        verificationLevel,
        levelAchievedAt: createdAt,
        createdAt,
        updatedAt: '2026-04-05T12:00:00.000Z',
      },
    ];
  }),
) as Record<string, SellerVerification>;

const INITIAL_WATCHLIST: WatchlistItem[] = [
  {
    id: 'watch-camera',
    userId: LOCAL_USER,
    listingId: 'mk-listing-camera',
    createdAt: '2026-04-04T09:00:00.000Z',
  },
  {
    id: 'watch-record',
    userId: LOCAL_USER,
    listingId: 'mk-listing-record',
    createdAt: '2026-04-02T18:15:00.000Z',
  },
  {
    id: 'watch-lamp',
    userId: LOCAL_USER,
    listingId: 'mk-listing-lamp',
    createdAt: '2026-04-05T07:40:00.000Z',
  },
];

const WATCHLIST_SAVED_PRICE_CENTS: Record<string, number> = {
  'mk-listing-camera': 89500,
  'mk-listing-record': 11900,
  'mk-listing-lamp': 13200,
};

const BASE_REVIEW_SEEDS: ReviewRecord[] = [
  {
    id: 'review-seed-1',
    reviewerId: 'buyer-anya',
    reviewerName: 'Anya Wu',
    sellerId: 'seller-maya',
    listingId: 'mk-listing-camera',
    rating: 5,
    body: 'Exactly as described, easy pickup, and the lens glass was spotless. Maya even packed the extra battery separately so nothing shifted in transit.',
    createdAt: '2026-04-05T10:20:00.000Z',
    helpfulCount: 8,
    photos: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80'],
  },
  {
    id: 'review-seed-2',
    reviewerId: 'buyer-omar',
    reviewerName: 'Omar Singh',
    sellerId: 'seller-maya',
    listingId: 'mk-listing-record',
    rating: 4,
    body: 'Friendly and clear. The cabinet had a little more patina than I expected but the seller was transparent and adjusted the price.',
    createdAt: '2026-04-04T08:30:00.000Z',
    helpfulCount: 4,
    photos: [],
  },
  {
    id: 'review-seed-3',
    reviewerId: 'buyer-jules',
    reviewerName: 'Jules Ortega',
    sellerId: 'seller-maya',
    listingId: 'mk-listing-camera',
    rating: 5,
    body: 'Best marketplace handoff I have had in a while. Fast replies and the item photos matched reality.',
    createdAt: '2026-04-01T16:10:00.000Z',
    helpfulCount: 6,
    photos: [],
  },
  {
    id: 'review-seed-4',
    reviewerId: 'buyer-ren',
    reviewerName: 'Ren Patel',
    sellerId: 'seller-maya',
    listingId: 'mk-listing-camera',
    rating: 3,
    body: 'Good communication, but meetup had to be rescheduled twice before we connected.',
    createdAt: '2026-03-30T11:50:00.000Z',
    helpfulCount: 2,
    photos: [],
  },
];

const INITIAL_SAVED_SEARCHES: SavedSearchRecord[] = [
  {
    id: 'saved-search-film',
    name: 'Vintage cameras under $900',
    query: 'mirrorless camera',
    categoryId: 'mk-cat-photo',
    minPriceCents: 25000,
    maxPriceCents: 90000,
    notifyOnMatch: true,
    createdAt: '2026-04-02T10:00:00.000Z',
    lastCheckedAt: '2026-04-06T07:15:00.000Z',
    matchCount: 12,
    distanceLabel: '15 mi',
    conditions: ['like_new', 'good'],
    listingType: 'sell',
  },
  {
    id: 'saved-search-desk',
    name: 'Standing desks nearby',
    query: 'desk',
    categoryId: 'mk-cat-home',
    minPriceCents: null,
    maxPriceCents: 40000,
    notifyOnMatch: false,
    createdAt: '2026-03-29T14:10:00.000Z',
    lastCheckedAt: '2026-04-05T17:25:00.000Z',
    matchCount: 5,
    distanceLabel: '20 mi',
    conditions: ['good', 'fair'],
    listingType: 'sell',
  },
  {
    id: 'saved-search-service',
    name: 'Portfolio design help',
    query: 'portfolio site',
    categoryId: 'mk-cat-service',
    minPriceCents: null,
    maxPriceCents: null,
    notifyOnMatch: true,
    createdAt: '2026-04-01T09:05:00.000Z',
    lastCheckedAt: '2026-04-06T08:00:00.000Z',
    matchCount: 3,
    distanceLabel: 'Remote',
    conditions: [],
    listingType: 'service_offer',
  },
];

let watchlistStore = cloneWatchlist(INITIAL_WATCHLIST);
let savedSearchStore = cloneSavedSearches(INITIAL_SAVED_SEARCHES);
let reviewStore = createReviewSeed();
let helpfulReviewIds = new Set<string>();

export function resetMarketPhase2Stores() {
  watchlistStore = cloneWatchlist(INITIAL_WATCHLIST);
  savedSearchStore = cloneSavedSearches(INITIAL_SAVED_SEARCHES);
  reviewStore = createReviewSeed();
  helpfulReviewIds = new Set<string>();
}

function cloneWatchlist(items: WatchlistItem[]) {
  return items.map((item) => ({ ...item }));
}

function cloneSavedSearches(items: SavedSearchRecord[]) {
  return items.map((item) => ({
    ...item,
    conditions: [...item.conditions],
  }));
}

function createReviewSeed() {
  const reviews = BASE_REVIEW_SEEDS.map((item) => ({
    ...item,
    photos: [...item.photos],
  }));

  for (let index = 0; index < 20; index += 1) {
    const rating = [5, 5, 4, 4, 4, 3][index % 6] ?? 4;
    reviews.push({
      id: `review-generated-${index}`,
      reviewerId: `buyer-generated-${index}`,
      reviewerName: ['Sam', 'Taylor', 'Jordan', 'Alex', 'Mina', 'Chris'][index % 6] ?? 'Buyer',
      sellerId: 'seller-maya',
      listingId: index % 3 === 0 ? 'mk-listing-camera' : 'mk-listing-record',
      rating,
      body:
        rating >= 4
          ? 'Smooth transaction, clear photos, and accurate condition notes.'
          : 'Item was fine overall, but coordination took a little longer than expected.',
      createdAt: new Date(Date.parse('2026-03-01T12:00:00.000Z') + index * 86_400_000).toISOString(),
      helpfulCount: 1 + (index % 5),
      photos:
        index % 4 === 0
          ? ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80']
          : [],
    });
  }

  return reviews;
}

function daysSince(dateString: string) {
  const diff = Date.now() - Date.parse(dateString);
  return Math.max(1, Math.floor(diff / 86_400_000));
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function formatLongDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function safeRead<T>(read: () => T, fallback: T) {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function toMarketDb(db: DatabaseAdapter): MarketDatabaseAdapter {
  return {
    run: (sql: string, params?: unknown[]) => db.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params)[0],
    all: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params),
  };
}

function formatConditionList(conditions: Array<Listing['condition']>) {
  if (conditions.length === 0) return 'Any condition';
  return conditions
    .map((value) => {
      if (value == null) return 'Any';
      if (value === 'like_new') return 'Like New';
      return value.charAt(0).toUpperCase() + value.slice(1);
    })
    .join(', ');
}

function formatPriceRange(minPriceCents: number | null, maxPriceCents: number | null) {
  if (minPriceCents == null && maxPriceCents == null) return 'Any price';
  if (minPriceCents != null && maxPriceCents != null) {
    return `${formatMarketPrice(minPriceCents / 100)} to ${formatMarketPrice(maxPriceCents / 100)}`;
  }
  if (minPriceCents != null) return `${formatMarketPrice(minPriceCents / 100)}+`;
  return `Up to ${formatMarketPrice((maxPriceCents ?? 0) / 100)}`;
}

function formatListingType(type: Listing['listingType']) {
  return type.replace(/_/g, ' ');
}

function initials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getSellerProfile(sellerId: string) {
  return SELLER_PROFILES[sellerId] ?? {
    id: sellerId,
    name: 'Marketplace Seller',
    handle: '@seller',
    avatarSeed: initials('Marketplace Seller'),
    city: 'Nearby',
    memberSince: '2024-01-01T12:00:00.000Z',
    responseTime: 'Replies same day',
    tagline: 'Selling nearby finds.',
  };
}

function getSellerStats(sellerId: string) {
  return SELLER_STATS[sellerId] ?? SELLER_STATS['seller-maya'];
}

function getSellerVerification(sellerId: string) {
  return SELLER_VERIFICATION[sellerId] ?? SELLER_VERIFICATION['seller-maya'];
}

function getListingPhotos(listingId: string) {
  return FALLBACK_LISTING_PHOTOS[listingId] ?? FALLBACK_LISTING_PHOTOS['mk-listing-camera'];
}

function useMarketPhase2Data() {
  const hubDb = useDatabase();
  const db = useMemo(() => toMarketDb(hubDb), [hubDb]);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const categories = useMemo(() => {
    const cached = safeRead(() => getCachedCategories(db), []);
    return cached.length > 0 ? cached : FALLBACK_CATEGORIES;
  }, [db, revision]);

  const listings = useMemo(() => {
    const cached = safeRead(() => getCachedListings(db, { limit: 80 }), []);
    return cached.length > 0 ? cached : FALLBACK_LISTINGS;
  }, [db, revision]);

  const watchlist = useMemo(() => {
    const cached = safeRead(() => getCachedWatchlist(db, LOCAL_USER), []);
    return cached.length > 0 ? cached : watchlistStore;
  }, [db, revision]);

  const conversations = useMemo(() => {
    return safeRead(() => getCachedConversations(db, LOCAL_USER), []);
  }, [db, revision]);

  const findListing = useCallback(
    (listingId?: string | null) =>
      safeRead(() => getCachedListingById(db, listingId ?? ''), undefined) ??
      listings.find((listing) => listing.id === listingId) ??
      FALLBACK_LISTINGS[0],
    [db, listings],
  );

  const toggleWatch = useCallback(
    (listingId: string) => {
      try {
        const current = safeRead(() => getCachedWatchlist(db, LOCAL_USER), []);
        const activeItems = current.length > 0 ? current : watchlistStore;
        const existing = activeItems.find((item) => item.listingId === listingId);

        if (existing != null) {
          deleteCachedWatchlistItem(db, existing.id);
          watchlistStore = watchlistStore.filter((item) => item.listingId !== listingId);
        } else {
          const newItem = {
            id: makeId('watch'),
            userId: LOCAL_USER,
            listingId,
            createdAt: new Date().toISOString(),
          };
          upsertCachedWatchlistItem(db, newItem);
          watchlistStore = [newItem, ...watchlistStore];
        }

        refresh();
      } catch {
        Alert.alert('Watchlist unavailable', 'Try again in a moment.');
      }
    },
    [db, refresh],
  );

  const removeWatchlistItem = useCallback(
    (watchlistId: string) => {
      try {
        deleteCachedWatchlistItem(db, watchlistId);
        watchlistStore = watchlistStore.filter((item) => item.id !== watchlistId);
        refresh();
      } catch {
        Alert.alert('Unable to remove item', 'Try again in a moment.');
      }
    },
    [db, refresh],
  );

  const ensureConversationForListing = useCallback(
    (listingId: string) => {
      const existing = conversations.find((conversation) => conversation.listingId === listingId);
      if (existing != null) {
        return existing.id;
      }

      const listing = findListing(listingId);
      const conversation: Conversation = {
        id: makeId('market-conversation'),
        listingId,
        buyerId: LOCAL_USER,
        sellerId: listing.sellerId,
        lastMessageAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      try {
        upsertCachedConversation(db, conversation);
      } catch {
        return conversation.id;
      }

      refresh();
      return conversation.id;
    },
    [conversations, db, findListing, refresh],
  );

  const watchlistIds = useMemo(() => new Set(watchlist.map((item) => item.listingId)), [watchlist]);

  return {
    categories,
    ensureConversationForListing,
    findListing,
    listings,
    refresh,
    removeWatchlistItem,
    toggleWatch,
    watchlist,
    watchlistIds,
  };
}

function useRefreshAction(onRefreshAction: () => void) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    setRefreshing(true);
    onRefreshAction();
    setTimeout(() => setRefreshing(false), 240);
  }, [onRefreshAction]);

  return { refresh, refreshing };
}

function MarketHeader({
  title,
  onBack,
  right,
  floating = false,
}: {
  title: string;
  onBack: () => void;
  right?: React.ReactNode;
  floating?: boolean;
}) {
  return (
    <View style={[styles.header, floating ? styles.headerFloating : null]}>
      <IconButton
        accessibilityLabel="Go back"
        icon="arrow_back"
        onPress={onBack}
      />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

function MarketHero({
  eyebrow,
  title,
  subtitle,
  icon,
  trailing,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <GlassCard elevated style={styles.heroCard}>
      <View style={styles.heroGlow} />
      <View style={styles.heroRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={styles.heroEyebrow}>{eyebrow}</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSubtitle}>{subtitle}</Text>
        </View>
        {trailing ?? (
          icon != null ? (
            <View style={styles.heroIconWrap}>
              <MaterialSymbol name={icon} size={24} color={MK_ACCENT_LIGHT} filled />
            </View>
          ) : null
        )}
      </View>
    </GlassCard>
  );
}

function IconButton({
  accessibilityLabel,
  icon,
  filled = false,
  onPress,
  tone = 'surface',
}: {
  accessibilityLabel: string;
  icon: string;
  filled?: boolean;
  onPress: () => void;
  tone?: 'surface' | 'accent';
}) {
  const accent = tone === 'accent';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        styles.iconButton,
        accent ? styles.iconButtonAccent : null,
      ]}
    >
      <MaterialSymbol
        name={icon}
        size={20}
        color={accent ? MK_ACCENT_DARK : MK_TEXT}
        filled={filled || accent}
      />
    </Pressable>
  );
}

function FilterChip({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.filterChip, selected ? styles.filterChipSelected : null]}
    >
      {icon != null ? (
        <MaterialSymbol
          name={icon}
          size={14}
          color={selected ? MK_ACCENT_DARK : MK_ACCENT_LIGHT}
          filled={selected}
        />
      ) : null}
      <Text style={[styles.filterChipLabel, selected ? styles.filterChipLabelSelected : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  icon,
  tone = 'primary',
  onPress,
}: {
  label: string;
  icon?: string;
  tone?: 'primary' | 'secondary';
  onPress: () => void;
}) {
  const primary = tone === 'primary';

  if (primary) {
    return (
      <Pressable accessibilityLabel={label} onPress={onPress} style={styles.actionButtonFrame}>
        <LinearGradient
          colors={[MK_ACCENT_LIGHT, MK_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionButtonPrimary}
        >
          {icon != null ? (
            <MaterialSymbol name={icon} size={18} color={MK_ACCENT_DARK} filled />
          ) : null}
          <Text style={styles.actionButtonPrimaryLabel}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={styles.actionButtonSecondary}>
      {icon != null ? (
        <MaterialSymbol name={icon} size={18} color={MK_TEXT} />
      ) : null}
      <Text style={styles.actionButtonSecondaryLabel}>{label}</Text>
    </Pressable>
  );
}

function SellerAvatar({ profile, size = 48 }: { profile: SellerProfile; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.avatarLabel, { fontSize: size * 0.34 }]}>{profile.avatarSeed}</Text>
    </View>
  );
}

function RatingStars({
  rating,
  size = 14,
  color = '#FFB877',
}: {
  rating: number;
  size?: number;
  color?: string;
}) {
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < Math.round(rating);
        return (
          <MaterialSymbol
            key={`star-${index}`}
            name={filled ? 'star' : 'star_border'}
            size={size}
            color={color}
            filled={filled}
          />
        );
      })}
    </View>
  );
}

function ExpandableText({
  text,
  collapsedLines = 4,
}: {
  text: string;
  collapsedLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldShowToggle = text.length > 180;

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={styles.bodyText}
        numberOfLines={expanded ? undefined : collapsedLines}
      >
        {text}
      </Text>
      {shouldShowToggle ? (
        <Pressable
          accessibilityLabel={expanded ? 'Collapse text' : 'Read more'}
          onPress={() => setExpanded((value) => !value)}
        >
          <Text style={styles.linkText}>{expanded ? 'Show less' : 'Read more'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function MarketBottomSheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{title}</Text>
          <ScrollView contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type SavedSearchDraftState = {
  id: string | null;
  name: string;
  query: string;
  categoryId: string | null;
  minPrice: string;
  maxPrice: string;
  notifyOnMatch: boolean;
  distanceLabel: string;
  conditions: Array<Listing['condition']>;
  listingType: Listing['listingType'] | null;
};

function makeSavedSearchDraft(record?: SavedSearchRecord): SavedSearchDraftState {
  return {
    id: record?.id ?? null,
    name: record?.name ?? '',
    query: record?.query ?? '',
    categoryId: record?.categoryId ?? null,
    minPrice: record?.minPriceCents != null ? String(record.minPriceCents / 100) : '',
    maxPrice: record?.maxPriceCents != null ? String(record.maxPriceCents / 100) : '',
    notifyOnMatch: record?.notifyOnMatch ?? true,
    distanceLabel: record?.distanceLabel ?? '15 mi',
    conditions: record?.conditions ? [...record.conditions] : [],
    listingType: record?.listingType ?? 'sell',
  };
}

function parsePriceInput(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.round(numeric * 100);
}

function createSavedSearchFromDraft(draft: SavedSearchDraftState): SavedSearchRecord {
  return {
    id: draft.id ?? makeId('saved-search'),
    name: draft.name.trim(),
    query: draft.query.trim(),
    categoryId: draft.categoryId,
    minPriceCents: parsePriceInput(draft.minPrice),
    maxPriceCents: parsePriceInput(draft.maxPrice),
    notifyOnMatch: draft.notifyOnMatch,
    createdAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    matchCount: Math.max(1, Math.round(Math.random() * 14)),
    distanceLabel: draft.distanceLabel.trim() || '15 mi',
    conditions: [...draft.conditions],
    listingType: draft.listingType,
  };
}

function createPrimaryActionLabel(listing: Listing) {
  if (listing.listingType === 'wanted') return null;
  if (listing.pricingType === 'free' || listing.listingType === 'free') return 'Claim';
  if (listing.listingType === 'sell' && listing.fulfillmentType === 'shipping') return 'Buy Now';
  return 'Make Offer';
}

function computeReviewHistogram(reviews: ReviewRecord[]) {
  const total = Math.max(1, reviews.length);
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter((review) => review.rating === rating).length;
    return {
      count,
      percentage: count / total,
      rating,
    };
  });
}

function averageRating(reviews: ReviewRecord[]) {
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

export function MarketListingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const {
    ensureConversationForListing,
    findListing,
    listings,
    refresh,
    toggleWatch,
    watchlistIds,
  } = useMarketPhase2Data();
  const { refresh: onRefresh, refreshing } = useRefreshAction(refresh);
  const listing = findListing(params.id);
  const sellerProfile = getSellerProfile(listing.sellerId);
  const sellerStats = getSellerStats(listing.sellerId);
  const sellerVerification = getSellerVerification(listing.sellerId);
  const photos = getListingPhotos(listing.id);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const similarListings = useMemo(
    () =>
      listings
        .filter(
          (candidate) =>
            candidate.id !== listing.id &&
            candidate.status === 'active' &&
            (candidate.categoryId === listing.categoryId || candidate.sellerId !== listing.sellerId),
        )
        .slice(0, 5),
    [listing.categoryId, listing.id, listing.sellerId, listings],
  );

  const primaryActionLabel = createPrimaryActionLabel(listing);
  const postedLabel = formatShortDate(listing.createdAt);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.detailContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MK_ACCENT} />}
      >
        <View style={styles.detailHeroSection}>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActivePhotoIndex(index);
            }}
            renderItem={({ item }) => (
              <Pressable
                accessibilityLabel="Open photo viewer"
                onPress={() => setViewerVisible(true)}
                style={styles.photoSlide}
              >
                <Image source={{ uri: item.url }} style={styles.photoImage} contentFit="cover" />
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
          />

          <MarketHeader
            title="Listing"
            onBack={() => router.back()}
            floating
            right={(
              <View style={styles.headerActionRow}>
                <IconButton
                  accessibilityLabel={watchlistIds.has(listing.id) ? 'Remove from watchlist' : 'Save listing'}
                  icon={watchlistIds.has(listing.id) ? 'favorite' : 'favorite_border'}
                  filled={watchlistIds.has(listing.id)}
                  onPress={() => toggleWatch(listing.id)}
                />
                <IconButton
                  accessibilityLabel="Share listing"
                  icon="share"
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `${listing.title} • ${getListingPriceLabel(listing)} • ${listing.locationName ?? 'Nearby'}`,
                      });
                    } catch {
                      Alert.alert('Unable to share', 'Try again in a moment.');
                    }
                  }}
                />
                <IconButton
                  accessibilityLabel="More actions"
                  icon="more_vert"
                  onPress={() =>
                    Alert.alert('Listing actions', 'Use Report Listing below to flag this post or seller.')
                  }
                />
              </View>
            )}
          />

          <View style={styles.overlayTopRow}>
            {listing.condition != null ? <ConditionPill condition={listing.condition} /> : <View />}
            <Pressable
              accessibilityLabel={watchlistIds.has(listing.id) ? 'Remove from watchlist' : 'Add to watchlist'}
              onPress={() => toggleWatch(listing.id)}
              style={styles.overlayFavorite}
            >
              <MaterialSymbol
                name={watchlistIds.has(listing.id) ? 'favorite' : 'favorite_border'}
                size={20}
                color={watchlistIds.has(listing.id) ? '#FF6A7C' : MK_TEXT}
                filled={watchlistIds.has(listing.id)}
              />
            </Pressable>
          </View>

          <View style={styles.pageDots}>
            {photos.map((photo, index) => (
              <View
                key={photo.id}
                style={[
                  styles.pageDot,
                  index === activePhotoIndex ? styles.pageDotActive : null,
                ]}
              />
            ))}
          </View>
        </View>

        <GlassCard elevated style={styles.priceHeroCard}>
          <View style={styles.heroMetaRow}>
            <PriceBadge
              price={listing.priceCents != null ? listing.priceCents / 100 : 0}
              currency={listing.currency}
              size="lg"
              glass
            />
            <View style={styles.locationPill}>
              <MaterialSymbol name="location_on" size={14} color={MK_ACCENT_LIGHT} />
              <Text style={styles.locationPillLabel}>{listing.locationName ?? 'Local'}</Text>
            </View>
          </View>
          <Text style={styles.listingTitle}>{listing.title}</Text>
          <View style={styles.metaPillsRow}>
            <View style={styles.metaPill}>
              <MaterialSymbol name="schedule" size={14} color={MK_ACCENT_LIGHT} />
              <Text style={styles.metaPillLabel}>Posted {postedLabel}</Text>
            </View>
            <View style={styles.metaPill}>
              <MaterialSymbol name="storefront" size={14} color={MK_ACCENT_LIGHT} />
              <Text style={styles.metaPillLabel}>{formatListingType(listing.listingType)}</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Description</Text>
          <ExpandableText text={listing.description} />
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sellerCardRow}>
            <SellerAvatar profile={sellerProfile} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={styles.sellerNameRow}>
                <Text style={styles.sellerName}>{sellerProfile.name}</Text>
                <VerificationBadge tier={sellerVerification.verificationLevel} />
              </View>
              <Text style={styles.sellerTagline}>{sellerProfile.tagline}</Text>
              <View style={styles.sellerMetaRow}>
                <RatingStars rating={sellerStats.averageRating ?? 0} />
                <Text style={styles.sellerMetaText}>
                  {(sellerStats.averageRating ?? 0).toFixed(1)} • {sellerStats.reviewCount} reviews
                </Text>
              </View>
              <Text style={styles.sellerMetaText}>
                Member since {formatLongDate(sellerStats.memberSince)} • {sellerStats.activeListings} active
              </Text>
              <Text style={styles.sellerMetaText}>{sellerProfile.responseTime}</Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel="View seller profile"
            onPress={() => router.push('/(market)/(tabs)/profile')}
            style={styles.inlineLinkRow}
          >
            <Text style={styles.linkText}>View Profile</Text>
            <MaterialSymbol name="chevron_right" size={16} color={MK_ACCENT_LIGHT} />
          </Pressable>
        </GlassCard>

        <View style={styles.detailActionsRow}>
          <ActionButton
            label="Message Seller"
            icon="message"
            tone="secondary"
            onPress={() => {
              const conversationId = ensureConversationForListing(listing.id);
              router.push(`/(market)/conversation/${encodeURIComponent(conversationId)}?listing=${encodeURIComponent(listing.id)}`);
            }}
          />
          {primaryActionLabel != null ? (
            <ActionButton
              label={primaryActionLabel}
              icon={primaryActionLabel === 'Buy Now' ? 'payments' : 'sell'}
              onPress={() => {
                if (primaryActionLabel === 'Buy Now') {
                  router.push(`/(market)/checkout?listing=${encodeURIComponent(listing.id)}`);
                  return;
                }
                router.push(`/(market)/offers?listing=${encodeURIComponent(listing.id)}`);
              }}
            />
          ) : null}
        </View>

        <GlassCard style={styles.sectionCard}>
          <Pressable
            accessibilityLabel={detailsOpen ? 'Hide details' : 'Show details'}
            onPress={() => setDetailsOpen((value) => !value)}
            style={styles.sectionHeaderRow}
          >
            <Text style={styles.sectionTitle}>Details</Text>
            <MaterialSymbol name={detailsOpen ? 'expand_less' : 'expand_more'} size={18} color={MK_TEXT_SECONDARY} />
          </Pressable>
          {detailsOpen ? (
            <View style={styles.detailsGrid}>
              {[
                ['Category', FALLBACK_CATEGORIES.find((category) => category.id === listing.categoryId)?.name ?? 'General'],
                ['Type', formatListingType(listing.listingType)],
                ['Fulfillment', listing.fulfillmentType ?? 'Flexible'],
                ['Location', listing.locationName ?? 'Nearby'],
                ['Posted', formatLongDate(listing.createdAt)],
              ].map(([label, value]) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue}>{value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>You may also like</Text>
          </View>
          <FlatList
            data={similarListings}
            horizontal
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.similarCardWrap}>
                <ListingCard
                  listing={{
                    ...item,
                    photoUrl: getListingPhotos(item.id)[0]?.url,
                    isFavorite: watchlistIds.has(item.id),
                  }}
                  onPress={() => router.push(`/(market)/${encodeURIComponent(item.id)}`)}
                />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.similarList}
          />
        </GlassCard>

        <ActionButton
          label="Report Listing"
          icon="flag"
          tone="secondary"
          onPress={() => router.push(`/(market)/report?listing=${encodeURIComponent(listing.id)}`)}
        />
      </ScrollView>

      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.viewerOverlay}>
          <View style={styles.viewerHeader}>
            <IconButton
              accessibilityLabel="Close viewer"
              icon="close"
              onPress={() => setViewerVisible(false)}
            />
            <Text style={styles.viewerCounter}>
              {activePhotoIndex + 1} / {photos.length}
            </Text>
          </View>
          <FlatList
            data={photos}
            horizontal
            pagingEnabled
            initialScrollIndex={activePhotoIndex}
            keyExtractor={(item) => item.id}
            getItemLayout={(_, index) => ({
              index,
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
            })}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setActivePhotoIndex(index);
            }}
            renderItem={({ item }) => (
              <ScrollView
                contentContainerStyle={styles.viewerPage}
                maximumZoomScale={3}
                minimumZoomScale={1}
                centerContent
              >
                <Image source={{ uri: item.url }} style={styles.viewerImage} contentFit="contain" />
              </ScrollView>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  );
}

export function MarketWatchlistScreen() {
  const router = useRouter();
  const {
    findListing,
    refresh,
    removeWatchlistItem,
    watchlist,
  } = useMarketPhase2Data();
  const { refresh: onRefresh, refreshing } = useRefreshAction(refresh);
  const [sort, setSort] = useState<WatchlistSort>('recent');
  const [filter, setFilter] = useState<WatchlistFilter>('all');

  const rows = useMemo(() => {
    const mapped = watchlist.map((item) => {
      const listing = findListing(item.listingId);
      const seller = getSellerProfile(listing.sellerId);
      const verification = getSellerVerification(listing.sellerId);
      const currentPrice = listing.priceCents ?? 0;
      const savedPrice = WATCHLIST_SAVED_PRICE_CENTS[listing.id] ?? currentPrice;
      const delta = currentPrice - savedPrice;

      return {
        currentPrice,
        delta,
        direction: delta === 0 ? 'flat' : delta < 0 ? 'down' : 'up',
        listing,
        savedPrice,
        seller,
        verification,
        watchlistItem: item,
      };
    });

    const filtered = mapped.filter((row) => {
      if (filter === 'price_drops') return row.delta < 0;
      if (filter === 'sold') return row.listing.status === 'sold';
      if (filter === 'available') return row.listing.status !== 'sold';
      return true;
    });

    return filtered.sort((left, right) => {
      if (sort === 'price_change') return Math.abs(right.delta) - Math.abs(left.delta);
      if (sort === 'price_low_high') return left.currentPrice - right.currentPrice;
      if (sort === 'price_high_low') return right.currentPrice - left.currentPrice;
      return Date.parse(right.watchlistItem.createdAt) - Date.parse(left.watchlistItem.createdAt);
    });
  }, [filter, findListing, sort, watchlist]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={MK_ACCENT} />}
      >
        <MarketHeader
          title="Watchlist"
          onBack={() => router.back()}
          right={(
            <IconButton
              accessibilityLabel="Change sort"
              icon="sort"
              onPress={() =>
                setSort((current) =>
                  current === 'recent'
                    ? 'price_change'
                    : current === 'price_change'
                      ? 'price_low_high'
                      : current === 'price_low_high'
                        ? 'price_high_low'
                        : 'recent',
                )
              }
            />
          )}
        />

        <MarketHero
          eyebrow="Saved"
          title="Your Watchlist"
          subtitle={`${watchlist.length} saved items tracking price drops, sold states, and quick re-entry.`}
          icon="favorite"
        />

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sort</Text>
          <View style={styles.filterRowWrap}>
            {[
              ['recent', 'Recent'],
              ['price_change', 'Price Change'],
              ['price_low_high', 'Price Low-High'],
              ['price_high_low', 'Price High-Low'],
            ].map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                selected={sort === value}
                onPress={() => setSort(value as WatchlistSort)}
              />
            ))}
          </View>
          <Text style={styles.sectionTitle}>Filter</Text>
          <View style={styles.filterRowWrap}>
            {[
              ['all', 'All'],
              ['price_drops', 'Price Drops'],
              ['sold', 'Sold'],
              ['available', 'Available'],
            ].map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                selected={filter === value}
                onPress={() => setFilter(value as WatchlistFilter)}
              />
            ))}
          </View>
        </GlassCard>

        {rows.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <MaterialSymbol name="favorite_border" size={28} color={MK_ACCENT_LIGHT} />
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>
              Save listings you are curious about to track price changes and sold status.
            </Text>
            <ActionButton
              label="Browse Listings"
              icon="storefront"
              onPress={() => router.push('/(market)/(tabs)/browse')}
            />
          </GlassCard>
        ) : (
          rows.map((row) => {
            const photo = getListingPhotos(row.listing.id)[0]?.url;
            const deltaLabel = row.delta === 0 ? 'No change' : formatMarketPrice(Math.abs(row.delta) / 100);
            return (
              <GlassCard key={row.watchlistItem.id} style={styles.watchlistCard}>
                <Pressable
                  accessibilityLabel={row.listing.title}
                  onPress={() => router.push(`/(market)/${encodeURIComponent(row.listing.id)}`)}
                  style={styles.watchlistRow}
                >
                  <View style={styles.watchlistImageWrap}>
                    {photo != null ? <Image source={{ uri: photo }} style={styles.watchlistImage} contentFit="cover" /> : null}
                    {row.listing.status === 'sold' ? (
                      <View style={styles.soldOverlay}>
                        <Text style={styles.soldOverlayText}>Sold</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={styles.watchlistTitle}>{row.listing.title}</Text>
                    <View style={styles.sellerNameRow}>
                      <Text style={styles.watchlistSeller}>{row.seller.name}</Text>
                      <VerificationBadge tier={row.verification.verificationLevel} showLabel={false} />
                    </View>
                    <View style={styles.priceRow}>
                      <Text
                        style={[
                          styles.watchlistSavedPrice,
                          row.delta !== 0 ? styles.watchlistSavedPriceChanged : null,
                        ]}
                      >
                        {getListingPriceLabel({
                          ...row.listing,
                          priceCents: row.savedPrice,
                        })}
                      </Text>
                      <Text style={styles.watchlistCurrentPrice}>{getListingPriceLabel(row.listing)}</Text>
                    </View>
                    <View style={styles.deltaRow}>
                      <MaterialSymbol
                        name={row.direction === 'down' ? 'arrow_downward' : row.direction === 'up' ? 'arrow_upward' : 'schedule'}
                        size={15}
                        color={row.direction === 'down' ? '#30D158' : row.direction === 'up' ? '#FF7B72' : MK_TEXT_TERTIARY}
                        filled={row.direction !== 'flat'}
                      />
                      <Text
                        style={[
                          styles.deltaLabel,
                          row.direction === 'down'
                            ? styles.deltaLabelDown
                            : row.direction === 'up'
                              ? styles.deltaLabelUp
                              : null,
                        ]}
                      >
                        {row.direction === 'flat' ? 'No change since save' : `${deltaLabel} ${row.direction === 'down' ? 'drop' : 'increase'}`}
                      </Text>
                    </View>
                    <Text style={styles.savedAgoLabel}>Saved {formatRelativeTime(row.watchlistItem.createdAt)}</Text>
                  </View>
                </Pressable>

                <View style={styles.quickActionRow}>
                  <ActionButton
                    label="Open"
                    icon="chevron_right"
                    tone="secondary"
                    onPress={() => router.push(`/(market)/${encodeURIComponent(row.listing.id)}`)}
                  />
                  <ActionButton
                    label="Remove"
                    icon="delete"
                    tone="secondary"
                    onPress={() => removeWatchlistItem(row.watchlistItem.id)}
                  />
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

export function MarketSavedSearchesScreen() {
  const router = useRouter();
  const { categories } = useMarketPhase2Data();
  const [searches, setSearches] = useState(() => cloneSavedSearches(savedSearchStore));
  const [sheetVisible, setSheetVisible] = useState(false);
  const [draft, setDraft] = useState<SavedSearchDraftState>(makeSavedSearchDraft());

  const openDraft = useCallback((record?: SavedSearchRecord) => {
    setDraft(makeSavedSearchDraft(record));
    setSheetVisible(true);
  }, []);

  const closeDraft = useCallback(() => {
    setSheetVisible(false);
    setDraft(makeSavedSearchDraft());
  }, []);

  const persistSearches = useCallback((updater: (current: SavedSearchRecord[]) => SavedSearchRecord[]) => {
    setSearches((current) => {
      const next = updater(current);
      savedSearchStore = cloneSavedSearches(next);
      return next;
    });
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <MarketHeader
          title="Saved Searches"
          onBack={() => router.back()}
          right={(
            <IconButton
              accessibilityLabel="Add search"
              icon="add"
              tone="accent"
              onPress={() => openDraft()}
            />
          )}
        />

        <MarketHero
          eyebrow="Alerts"
          title="Saved Searches"
          subtitle="Get notified when new matches appear and jump back into browse with one tap."
          icon="notifications"
        />

        {searches.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <MaterialSymbol name="notifications_off" size={28} color={MK_ACCENT_LIGHT} />
            <Text style={styles.emptyTitle}>No saved searches yet</Text>
            <Text style={styles.emptyBody}>
              Save your best queries so new listings can come to you instead of the other way around.
            </Text>
            <ActionButton
              label="Browse Listings"
              icon="storefront"
              onPress={() => router.push('/(market)/(tabs)/browse')}
            />
          </GlassCard>
        ) : (
          searches.map((search) => {
            const category = categories.find((item) => item.id === search.categoryId)?.name ?? 'All categories';
            return (
              <GlassCard key={search.id} style={styles.sectionCard}>
                <View style={styles.savedSearchTopRow}>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={styles.savedSearchTitle}>{search.name}</Text>
                    <Text style={styles.savedSearchQuery}>{search.query}</Text>
                  </View>
                  <Switch
                    value={search.notifyOnMatch}
                    onValueChange={(value) =>
                      persistSearches((current) =>
                        current.map((item) =>
                          item.id === search.id ? { ...item, notifyOnMatch: value } : item,
                        ),
                      )
                    }
                  />
                </View>

                <View style={styles.filterRowWrap}>
                  <FilterChip label={category} onPress={() => undefined} selected />
                  <FilterChip label={formatPriceRange(search.minPriceCents, search.maxPriceCents)} onPress={() => undefined} />
                  <FilterChip label={search.distanceLabel} onPress={() => undefined} />
                  <FilterChip label={formatConditionList(search.conditions)} onPress={() => undefined} />
                </View>

                <View style={styles.savedSearchMetaRow}>
                  <Text style={styles.savedSearchMetaText}>{search.matchCount} active matches</Text>
                  <Text style={styles.savedSearchMetaText}>Checked {formatRelativeTime(search.lastCheckedAt)}</Text>
                </View>

                <View style={styles.quickActionRow}>
                  <ActionButton
                    label="Search Now"
                    icon="chevron_right"
                    onPress={() =>
                      router.push(
                        `/(market)/(tabs)/browse?query=${encodeURIComponent(search.query)}&savedSearch=${encodeURIComponent(search.id)}`,
                      )
                    }
                  />
                  <ActionButton
                    label="Edit"
                    icon="edit"
                    tone="secondary"
                    onPress={() => openDraft(search)}
                  />
                  <ActionButton
                    label="Delete"
                    icon="delete"
                    tone="secondary"
                    onPress={() =>
                      persistSearches((current) => current.filter((item) => item.id !== search.id))
                    }
                  />
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      <MarketBottomSheet
        visible={sheetVisible}
        title={draft.id == null ? 'Add Saved Search' : 'Edit Saved Search'}
        onClose={closeDraft}
      >
        <Field label="Name">
          <TextInput
            placeholder="Name the alert"
            placeholderTextColor={MK_TEXT_TERTIARY}
            style={styles.input}
            value={draft.name}
            onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
          />
        </Field>
        <Field label="Query">
          <TextInput
            placeholder="What are you looking for?"
            placeholderTextColor={MK_TEXT_TERTIARY}
            style={styles.input}
            value={draft.query}
            onChangeText={(value) => setDraft((current) => ({ ...current, query: value }))}
          />
        </Field>
        <Field label="Category">
          <View style={styles.filterRowWrap}>
            {categories.map((category) => (
              <FilterChip
                key={category.id}
                label={category.name}
                selected={draft.categoryId === category.id}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    categoryId: current.categoryId === category.id ? null : category.id,
                  }))
                }
              />
            ))}
          </View>
        </Field>
        <View style={styles.sheetGrid}>
          <Field label="Min Price">
            <TextInput
              placeholder="0"
              placeholderTextColor={MK_TEXT_TERTIARY}
              style={styles.input}
              keyboardType="numeric"
              value={draft.minPrice}
              onChangeText={(value) => setDraft((current) => ({ ...current, minPrice: value }))}
            />
          </Field>
          <Field label="Max Price">
            <TextInput
              placeholder="Any"
              placeholderTextColor={MK_TEXT_TERTIARY}
              style={styles.input}
              keyboardType="numeric"
              value={draft.maxPrice}
              onChangeText={(value) => setDraft((current) => ({ ...current, maxPrice: value }))}
            />
          </Field>
        </View>
        <Field label="Distance">
          <TextInput
            placeholder="15 mi"
            placeholderTextColor={MK_TEXT_TERTIARY}
            style={styles.input}
            value={draft.distanceLabel}
            onChangeText={(value) => setDraft((current) => ({ ...current, distanceLabel: value }))}
          />
        </Field>
        <Field label="Condition">
          <View style={styles.filterRowWrap}>
            {(['like_new', 'good', 'fair'] as const).map((condition) => (
              <FilterChip
                key={condition}
                label={condition === 'like_new' ? 'Like New' : condition.charAt(0).toUpperCase() + condition.slice(1)}
                selected={draft.conditions.includes(condition)}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    conditions: current.conditions.includes(condition)
                      ? current.conditions.filter((item) => item !== condition)
                      : [...current.conditions, condition],
                  }))
                }
              />
            ))}
          </View>
        </Field>
        <Field label="Listing Type">
          <View style={styles.filterRowWrap}>
            {(['sell', 'free', 'trade', 'service_offer'] as const).map((type) => (
              <FilterChip
                key={type}
                label={formatListingType(type)}
                selected={draft.listingType === type}
                onPress={() => setDraft((current) => ({ ...current, listingType: type }))}
              />
            ))}
          </View>
        </Field>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.sectionTitle}>Notifications</Text>
            <Text style={styles.savedSearchMetaText}>Stubbed to local state until settings wiring lands.</Text>
          </View>
          <Switch
            value={draft.notifyOnMatch}
            onValueChange={(value) => setDraft((current) => ({ ...current, notifyOnMatch: value }))}
          />
        </View>
        <View style={styles.quickActionRow}>
          <ActionButton label="Cancel" tone="secondary" icon="close" onPress={closeDraft} />
          <ActionButton
            label={draft.id == null ? 'Save Search' : 'Update Search'}
            icon="check"
            onPress={() => {
              if (draft.name.trim().length === 0 || draft.query.trim().length === 0) {
                Alert.alert('Missing details', 'Add a name and query before saving.');
                return;
              }

              const record = createSavedSearchFromDraft(draft);
              persistSearches((current) => {
                if (draft.id == null) {
                  return [record, ...current];
                }
                return current.map((item) => (item.id === draft.id ? { ...record, createdAt: item.createdAt } : item));
              });
              closeDraft();
            }}
          />
        </View>
      </MarketBottomSheet>
    </View>
  );
}

export function MarketReviewsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sellerId?: string }>();
  const sellerId = params.sellerId ?? 'seller-maya';
  const sellerProfile = getSellerProfile(sellerId);
  const [reviews, setReviews] = useState(() => reviewStore.filter((review) => review.sellerId === sellerId));
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [chipFilter, setChipFilter] = useState<'all' | '5' | '4' | 'recent' | 'helpful' | 'photos'>('all');
  const [pageSize, setPageSize] = useState(20);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [draftRating, setDraftRating] = useState(5);
  const [draftBody, setDraftBody] = useState('');
  const [draftIncludePhoto, setDraftIncludePhoto] = useState(false);
  const histogram = useMemo(() => computeReviewHistogram(reviews), [reviews]);
  const score = useMemo(() => averageRating(reviews), [reviews]);
  const canWriteReview = !reviews.some((review) => review.reviewerId === LOCAL_USER);

  const filteredReviews = useMemo(() => {
    let current = [...reviews];

    if (ratingFilter != null) {
      current = current.filter((review) => review.rating === ratingFilter);
    }

    if (chipFilter === '5') current = current.filter((review) => review.rating === 5);
    if (chipFilter === '4') current = current.filter((review) => review.rating === 4);
    if (chipFilter === 'photos') current = current.filter((review) => review.photos.length > 0);
    if (chipFilter === 'helpful') {
      current = current.sort((left, right) => right.helpfulCount - left.helpfulCount);
    } else {
      current = current.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
    }

    return current;
  }, [chipFilter, ratingFilter, reviews]);

  const visibleReviews = filteredReviews.slice(0, pageSize);

  const updateReviews = useCallback((updater: (current: ReviewRecord[]) => ReviewRecord[]) => {
    setReviews((current) => {
      const nextForSeller = updater(current);
      reviewStore = [
        ...reviewStore.filter((review) => review.sellerId !== sellerId),
        ...nextForSeller,
      ];
      return nextForSeller;
    });
  }, [sellerId]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <MarketHeader title={sellerProfile.name} onBack={() => router.back()} />

        <MarketHero
          eyebrow="Reputation"
          title={score.toFixed(1)}
          subtitle={`Based on ${reviews.length} reviews`}
          trailing={(
            <View style={styles.ratingHeroRight}>
              <RatingStars rating={score} size={18} />
              <Text style={styles.savedSearchMetaText}>{sellerProfile.handle}</Text>
            </View>
          )}
        />

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Rating Breakdown</Text>
          <View style={styles.histogramList}>
            {histogram.map((row) => (
              <Pressable
                key={`rating-${row.rating}`}
                accessibilityLabel={`${row.rating} star reviews`}
                onPress={() => setRatingFilter((current) => (current === row.rating ? null : row.rating))}
                style={styles.histogramRow}
              >
                <Text style={styles.histogramLabel}>{row.rating} stars</Text>
                <View style={styles.histogramTrack}>
                  <View
                    style={[
                      styles.histogramFill,
                      {
                        width: `${Math.max(10, row.percentage * 100)}%`,
                        backgroundColor: ratingFilter === row.rating ? MK_ACCENT_LIGHT : withAlpha(MK_ACCENT, 0.65),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.histogramCount}>{row.count}</Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.filterRowWrap}>
            {[
              ['all', 'All'],
              ['5', '5 stars'],
              ['4', '4 stars'],
              ['recent', 'Recent'],
              ['helpful', 'Helpful'],
              ['photos', 'With Photos'],
            ].map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                selected={chipFilter === value}
                onPress={() => setChipFilter(value as 'all' | '5' | '4' | 'recent' | 'helpful' | 'photos')}
              />
            ))}
          </View>
        </GlassCard>

        {visibleReviews.map((review) => {
          const listing = FALLBACK_LISTINGS.find((item) => item.id === review.listingId) ?? FALLBACK_LISTINGS[0];
          const reviewerProfile = getSellerProfile(review.reviewerId);
          const alreadyHelpful = helpfulReviewIds.has(review.id);
          return (
            <GlassCard key={review.id} style={styles.sectionCard}>
              <View style={styles.reviewHeader}>
                <SellerAvatar profile={{ ...reviewerProfile, avatarSeed: initials(review.reviewerName) }} size={40} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.reviewAuthor}>{review.reviewerName}</Text>
                  <View style={styles.reviewMetaRow}>
                    <RatingStars rating={review.rating} size={12} />
                    <Text style={styles.reviewMetaText}>{formatLongDate(review.createdAt)}</Text>
                  </View>
                </View>
              </View>
              <ExpandableText text={review.body} />

              {review.photos.length > 0 ? (
                <FlatList
                  data={review.photos}
                  horizontal
                  keyExtractor={(item, index) => `${review.id}-${index}`}
                  renderItem={({ item }) => (
                    <Image source={{ uri: item }} style={styles.reviewPhoto} contentFit="cover" />
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.reviewPhotoRail}
                />
              ) : null}

              <Pressable
                accessibilityLabel={`Open ${listing.title}`}
                onPress={() => router.push(`/(market)/${encodeURIComponent(listing.id)}`)}
                style={styles.reviewListingChip}
              >
                <Image source={{ uri: getListingPhotos(listing.id)[0]?.url }} style={styles.reviewListingThumb} contentFit="cover" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.reviewListingLabel}>Related listing</Text>
                  <Text style={styles.reviewListingTitle} numberOfLines={1}>
                    {listing.title}
                  </Text>
                </View>
                <MaterialSymbol name="chevron_right" size={16} color={MK_TEXT_TERTIARY} />
              </Pressable>

              <View style={styles.quickActionRow}>
                <ActionButton
                  label={alreadyHelpful ? `${review.helpfulCount} helpful` : 'Helpful'}
                  icon="thumb_up"
                  tone="secondary"
                  onPress={() => {
                    if (alreadyHelpful) return;
                    helpfulReviewIds.add(review.id);
                    updateReviews((current) =>
                      current.map((item) =>
                        item.id === review.id ? { ...item, helpfulCount: item.helpfulCount + 1 } : item,
                      ),
                    );
                  }}
                />
                <ActionButton
                  label="Report"
                  icon="flag"
                  tone="secondary"
                  onPress={() => Alert.alert('Review reported', 'Thanks. We will take a look.')}
                />
              </View>
            </GlassCard>
          );
        })}

        {pageSize < filteredReviews.length ? (
          <ActionButton
            label="Load more"
            icon="expand_more"
            tone="secondary"
            onPress={() => setPageSize((value) => value + 20)}
          />
        ) : null}
      </ScrollView>

      {canWriteReview ? (
        <View style={styles.stickyFooter}>
          <ActionButton
            label="Write Review"
            icon="star"
            onPress={() => setSheetVisible(true)}
          />
        </View>
      ) : null}

      <MarketBottomSheet
        visible={sheetVisible}
        title="Write Review"
        onClose={() => setSheetVisible(false)}
      >
        <Field label="Rating">
          <View style={styles.filterRowWrap}>
            {Array.from({ length: 5 }, (_, index) => {
              const rating = index + 1;
              return (
                <FilterChip
                  key={`draft-rating-${rating}`}
                  label={`${rating} star${rating === 1 ? '' : 's'}`}
                  icon="star"
                  selected={draftRating === rating}
                  onPress={() => setDraftRating(rating)}
                />
              );
            })}
          </View>
        </Field>
        <Field label="Review">
          <TextInput
            placeholder="How did the transaction go?"
            placeholderTextColor={MK_TEXT_TERTIARY}
            style={[styles.input, styles.inputMultiline]}
            multiline
            value={draftBody}
            onChangeText={setDraftBody}
          />
        </Field>
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.sectionTitle}>Add sample photo</Text>
            <Text style={styles.savedSearchMetaText}>Temporary mobile stub until media upload wiring lands.</Text>
          </View>
          <Switch value={draftIncludePhoto} onValueChange={setDraftIncludePhoto} />
        </View>
        <View style={styles.quickActionRow}>
          <ActionButton label="Cancel" tone="secondary" icon="close" onPress={() => setSheetVisible(false)} />
          <ActionButton
            label="Submit Review"
            icon="check"
            onPress={() => {
              if (draftBody.trim().length < 8) {
                Alert.alert('Review too short', 'Add a little more detail before submitting.');
                return;
              }
              const nextReview: ReviewRecord = {
                id: makeId('review'),
                reviewerId: LOCAL_USER,
                reviewerName: 'You',
                sellerId,
                listingId: 'mk-listing-camera',
                rating: draftRating,
                body: draftBody.trim(),
                createdAt: new Date().toISOString(),
                helpfulCount: 0,
                photos: draftIncludePhoto ? ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80'] : [],
              };
              updateReviews((current) => [nextReview, ...current]);
              setDraftBody('');
              setDraftIncludePhoto(false);
              setDraftRating(5);
              setSheetVisible(false);
            }}
          />
        </View>
      </MarketBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MK_SURFACES.lowest,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 132,
  },
  detailContent: {
    gap: 16,
    paddingBottom: 132,
  },
  detailHeroSection: {
    position: 'relative',
    width: SCREEN_WIDTH,
    aspectRatio: 1,
    backgroundColor: MK_SURFACES.mid,
  },
  photoSlide: {
    width: SCREEN_WIDTH,
    aspectRatio: 1,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerFloating: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
    zIndex: 5,
  },
  headerTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    flex: 1,
    fontFamily: MK_FONTS.bold,
  },
  headerRight: {
    minWidth: 32,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14, 14, 19, 0.7)',
  },
  iconButtonAccent: {
    backgroundColor: MK_ACCENT_LIGHT,
  },
  overlayTopRow: {
    position: 'absolute',
    top: 74,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 4,
  },
  overlayFavorite: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(14, 14, 19, 0.68)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageDots: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.32)',
  },
  pageDotActive: {
    width: 24,
    backgroundColor: MK_ACCENT_LIGHT,
  },
  priceHeroCard: {
    marginHorizontal: 16,
    marginTop: -28,
    gap: 14,
    zIndex: 2,
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 999,
    right: -48,
    top: -70,
    backgroundColor: withAlpha(MK_ACCENT_LIGHT, 0.18),
  },
  heroRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  heroTitle: {
    ...MK_TYPOGRAPHY.displayLg,
    color: MK_TEXT,
    fontSize: 36,
    lineHeight: 40,
  },
  heroSubtitle: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: withAlpha(MK_ACCENT, 0.18),
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_SURFACES.highest, 0.9),
  },
  locationPillLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  listingTitle: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  metaPillsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_SURFACES.high, 0.78),
  },
  metaPillLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 14,
  },
  sectionTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
  },
  bodyText: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  sellerCardRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  avatar: {
    backgroundColor: withAlpha(MK_ACCENT, 0.22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
  },
  sellerNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  sellerName: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
  },
  sellerTagline: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  sellerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sellerMetaText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inlineLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  linkText: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_ACCENT_LIGHT,
    fontFamily: MK_FONTS.semiBold,
  },
  detailActionsRow: {
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
  },
  actionButtonFrame: {
    flex: 1,
  },
  actionButtonPrimary: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    ...MK_GLOW_STYLE,
  },
  actionButtonPrimaryLabel: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_ACCENT_DARK,
    fontFamily: MK_FONTS.bold,
  },
  actionButtonSecondary: {
    minHeight: 52,
    flex: 1,
    borderRadius: 18,
    backgroundColor: withAlpha(MK_SURFACES.high, 0.92),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  actionButtonSecondaryLabel: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    gap: 4,
    paddingBottom: 2,
  },
  detailLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_TERTIARY,
  },
  detailValue: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT,
  },
  similarList: {
    gap: 14,
    paddingRight: 8,
  },
  similarCardWrap: {
    width: 288,
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 8, 0.96)',
  },
  viewerHeader: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewerCounter: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  viewerPage: {
    width: SCREEN_WIDTH,
    minHeight: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  viewerImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
  },
  filterRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: withAlpha(MK_SURFACES.high, 0.88),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipSelected: {
    backgroundColor: MK_ACCENT_LIGHT,
  },
  filterChipLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT,
  },
  filterChipLabelSelected: {
    color: MK_ACCENT_DARK,
    fontFamily: MK_FONTS.bold,
  },
  emptyCard: {
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
  },
  emptyBody: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  watchlistCard: {
    gap: 14,
  },
  watchlistRow: {
    flexDirection: 'row',
    gap: 14,
  },
  watchlistImageWrap: {
    width: 96,
    height: 96,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: MK_SURFACES.high,
    position: 'relative',
  },
  watchlistImage: {
    width: '100%',
    height: '100%',
  },
  soldOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(6, 6, 10, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOverlayText: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT,
  },
  watchlistTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
  },
  watchlistSeller: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  watchlistSavedPrice: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_TERTIARY,
  },
  watchlistSavedPriceChanged: {
    textDecorationLine: 'line-through',
  },
  watchlistCurrentPrice: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deltaLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_TERTIARY,
  },
  deltaLabelDown: {
    color: '#30D158',
  },
  deltaLabelUp: {
    color: '#FF7B72',
  },
  savedAgoLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_TERTIARY,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  savedSearchTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  savedSearchTitle: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
  },
  savedSearchQuery: {
    ...MK_TYPOGRAPHY.bodyMd,
    color: MK_TEXT_SECONDARY,
  },
  savedSearchMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  savedSearchMetaText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 5, 8, 0.58)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MK_SURFACES.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    maxHeight: '84%',
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_TEXT_TERTIARY, 0.6),
    alignSelf: 'center',
  },
  sheetTitle: {
    ...MK_TYPOGRAPHY.headlineMd,
    color: MK_TEXT,
    fontFamily: MK_FONTS.bold,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sheetContent: {
    gap: 16,
    padding: 20,
    paddingBottom: 40,
  },
  sheetGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_SECONDARY,
  },
  input: {
    minHeight: 50,
    borderRadius: 18,
    backgroundColor: withAlpha(MK_SURFACES.high, 0.95),
    color: MK_TEXT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: MK_FONTS.medium,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 132,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingHeroRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  histogramList: {
    gap: 12,
  },
  histogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  histogramLabel: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT,
    width: 54,
  },
  histogramTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(MK_SURFACES.highest, 0.7),
    overflow: 'hidden',
  },
  histogramFill: {
    height: '100%',
    borderRadius: 999,
  },
  histogramCount: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
    width: 20,
    textAlign: 'right',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reviewAuthor: {
    ...MK_TYPOGRAPHY.titleMd,
    color: MK_TEXT,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  reviewMetaText: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT_SECONDARY,
  },
  reviewPhotoRail: {
    gap: 10,
  },
  reviewPhoto: {
    width: 88,
    height: 88,
    borderRadius: 18,
  },
  reviewListingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor: withAlpha(MK_SURFACES.high, 0.92),
  },
  reviewListingThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  reviewListingLabel: {
    ...MK_TYPOGRAPHY.labelUpper,
    color: MK_TEXT_TERTIARY,
  },
  reviewListingTitle: {
    ...MK_TYPOGRAPHY.caption,
    color: MK_TEXT,
  },
  stickyFooter: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 26,
  },
});

// Safe default export to prevent crashes if Expo Router registers this
// module-local source file as a route. The visible screens re-export the
// named Phase 2 screens from their own route files.
export default MarketListingDetailScreen;
