import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CARRIER_NAMES,
  ConditionPill as MarketConditionPill,
  GlassCard as MarketGlassCard,
  LISTING_LIMITS,
  MK_ACCENT,
  MK_ACCENT_DARK,
  MK_ACCENT_LIGHT,
  MK_FONTS,
  MK_OFFER_STATUS,
  MK_PAYMENT_STATUS,
  MK_SURFACES,
  MK_TEXT,
  MK_TEXT_SECONDARY,
  MK_TEXT_TERTIARY,
  MaterialSymbol,
  MessageBubble as MarketMessageBubble,
  PriceBadge as MarketPriceBadge,
  StatusTimeline as MarketStatusTimeline,
  buildTrackingUrl,
  calculateVerificationLevel,
  formatMarketPrice,
  getCachedCategories,
  getCachedConversations,
  getCachedListingById,
  getCachedListings,
  getCachedMessages,
  getCachedWatchlist,
  type Category,
  type Conversation,
  type DatabaseAdapter as MarketDatabaseAdapter,
  type Listing,
  type Message,
  type VerificationLevel,
  type WatchlistItem,
  upsertCachedListing,
  upsertCachedWatchlistItem,
  withAlpha,
  deleteCachedWatchlistItem,
} from '@mylife/market';
import type { DatabaseAdapter } from '@mylife/db';
import {
  Card,
  Text,
  borderRadius,
  colors,
  glass,
  spacing,
} from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = MK_ACCENT;
const LOCAL_USER = 'local-user';

type ListingTypeOption = Listing['listingType'];
type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
type OfferTab = 'received' | 'sent' | 'active' | 'history';
type ConversationRequestStatus = 'pending' | 'accepted' | 'declined';
type TrackingStatus =
  | 'ordered'
  | 'confirmed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'released'
  | 'disputed';
type DisputeStatus = 'open' | 'in_review' | 'resolved' | 'escalated';
type ResolutionType = 'refund' | 'partial_refund' | 'replace' | 'other';

type ReviewItem = {
  id: string;
  reviewer: string;
  rating: number;
  date: string;
  detail: string;
  listingTitle: string;
};

type OfferItem = {
  id: string;
  listingId: string;
  listingTitle: string;
  listingSubtitle: string;
  senderName: string;
  receiverName: string;
  amountCents: number;
  originalCents: number;
  status: OfferStatus;
  direction: 'received' | 'sent';
  expiresAt: string;
  updatedAt: string;
  message?: string;
  conversationId: string;
  chainId: string;
  parentOfferId?: string;
};

type TrackingItem = {
  id: string;
  orderNumber: string;
  listingId: string;
  title: string;
  sellerName: string;
  carrier: keyof typeof CARRIER_NAMES;
  trackingNumber: string;
  status: TrackingStatus;
  estimatedDelivery: string;
  lastUpdate: string;
  totalCents: number;
  escrowStatus: keyof typeof MK_PAYMENT_STATUS;
  paymentMethodLabel: string;
  shippingAddress: string;
  billingAddress: string;
  steps: Array<{
    key: TrackingStatus;
    label: string;
    completedAt?: string;
  }>;
  disputeId?: string | null;
  conversationId: string;
};

type DisputeItem = {
  id: string;
  orderId: string;
  listingId: string;
  title: string;
  status: DisputeStatus;
  filedAt: string;
  lastUpdate: string;
  summary: string;
  reason: string;
  buyerName: string;
  sellerName: string;
  amountCents: number;
  deadlineAt?: string;
  openedBy: 'buyer' | 'seller';
  proposal?: {
    type: ResolutionType;
    amountCents: number;
    description: string;
  };
  evidence: Array<{
    id: string;
    label: string;
    addedAt: string;
  }>;
  messages: Array<{
    id: string;
    senderName: string;
    body: string;
    createdAt: string;
  }>;
};

type SavedSearchItem = {
  id: string;
  title: string;
  detail: string;
  matches: number;
  updatedAt: string;
};

type ServiceItem = {
  id: string;
  provider: string;
  category: string;
  description: string;
  radius: string;
  priceLabel: string;
  rating: number;
};

type ConversationMeta = {
  otherUserName: string;
  requestStatus: ConversationRequestStatus;
  fingerprint: string;
  verified: boolean;
};

type ConversationMessage = Message & {
  bubbleType?: 'text' | 'image' | 'location' | 'offer_card';
  imageUrl?: string;
  locationLabel?: string;
  offerTitle?: string;
  offerPrice?: number;
  offerCurrency?: string;
  readAt?: string | null;
};

type PaymentMethodOption = {
  id: string;
  label: string;
  detail: string;
};

type AddressOption = {
  id: string;
  label: string;
  line1: string;
  detail: string;
};

function toMarketDb(db: DatabaseAdapter): MarketDatabaseAdapter {
  return {
    run: (sql: string, params?: unknown[]) => db.execute(sql, params),
    get: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params)[0],
    all: <T,>(sql: string, params?: unknown[]) => db.query<T>(sql, params),
  };
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function formatPrice(priceCents: number | null, pricingType: Listing['pricingType']): string {
  if (pricingType === 'free') return 'Free';
  if (priceCents == null) return 'Contact';
  return `$${(priceCents / 100).toFixed(priceCents % 100 === 0 ? 0 : 2)}`;
}

function initials(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const SAMPLE_CATEGORIES: Category[] = [
  { id: 'mk-cat-electronics', parentId: null, name: 'Electronics', slug: 'electronics', icon: 'EA', sortOrder: 0 },
  { id: 'mk-cat-clothing', parentId: null, name: 'Clothing', slug: 'clothing', icon: 'CL', sortOrder: 1 },
  { id: 'mk-cat-home', parentId: null, name: 'Home', slug: 'home', icon: 'HM', sortOrder: 2 },
  { id: 'mk-cat-sports', parentId: null, name: 'Sports', slug: 'sports', icon: 'SP', sortOrder: 3 },
  { id: 'mk-cat-books', parentId: null, name: 'Books', slug: 'books', icon: 'BK', sortOrder: 4 },
  { id: 'mk-cat-auto', parentId: null, name: 'Auto', slug: 'auto', icon: 'AT', sortOrder: 5 },
  { id: 'mk-cat-services', parentId: null, name: 'Services', slug: 'services', icon: 'SV', sortOrder: 6 },
];

const SAMPLE_LISTINGS: Listing[] = [
  {
    id: 'mk-listing-1',
    sellerId: 'seller-maya',
    categoryId: 'mk-cat-electronics',
    title: 'Mirrorless camera kit with two lenses',
    description: 'Well-kept camera body, prime lens, and a lightweight zoom. Includes battery grip and padded sling.',
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
    createdAt: '2026-04-04T08:15:00.000Z',
    updatedAt: '2026-04-04T08:15:00.000Z',
    expiresAt: null,
  },
  {
    id: 'mk-listing-2',
    sellerId: 'seller-leo',
    categoryId: 'mk-cat-home',
    title: 'Solid oak writing desk with cable tray',
    description: 'Desk fits a laptop setup cleanly and has a shallow drawer for notebooks and adapters.',
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
    id: 'mk-listing-3',
    sellerId: 'seller-nina',
    categoryId: 'mk-cat-services',
    title: 'Portfolio website refresh for local creators',
    description: 'Fast-turnaround design and build cleanup for portfolio sites, with analytics and accessibility review included.',
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
    createdAt: '2026-04-03T12:30:00.000Z',
    updatedAt: '2026-04-03T12:30:00.000Z',
    expiresAt: null,
  },
];

const SAMPLE_WATCHLIST: WatchlistItem[] = [
  { id: 'watch-1', userId: LOCAL_USER, listingId: 'mk-listing-1', createdAt: '2026-04-04T09:00:00.000Z' },
  { id: 'watch-2', userId: LOCAL_USER, listingId: 'mk-listing-2', createdAt: '2026-04-04T10:00:00.000Z' },
];

const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: 'mk-convo-1',
    listingId: 'mk-listing-1',
    buyerId: LOCAL_USER,
    sellerId: 'seller-maya',
    lastMessageAt: '2026-04-04T10:10:00.000Z',
    createdAt: '2026-04-04T09:10:00.000Z',
  },
  {
    id: 'mk-convo-2',
    listingId: 'mk-listing-2',
    buyerId: LOCAL_USER,
    sellerId: 'seller-leo',
    lastMessageAt: '2026-04-03T20:20:00.000Z',
    createdAt: '2026-04-03T19:35:00.000Z',
  },
];

const SAMPLE_MESSAGES: ConversationMessage[] = [
  {
    id: 'mk-message-1',
    conversationId: 'mk-convo-1',
    senderId: 'seller-maya',
    body: 'Happy to include the wrist strap if you can meet before sunset.',
    contentType: 'application/e2ee+ciphertext',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-04T09:45:00.000Z',
    readAt: '2026-04-04T09:46:00.000Z',
  },
  {
    id: 'mk-message-2',
    conversationId: 'mk-convo-1',
    senderId: LOCAL_USER,
    body: 'That works. Could you do $790 if I swing by tomorrow afternoon?',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-04T10:10:00.000Z',
    readAt: '2026-04-04T10:12:00.000Z',
  },
  {
    id: 'mk-message-3',
    conversationId: 'mk-convo-1',
    senderId: 'seller-maya',
    body: 'Offer attached',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-04T10:16:00.000Z',
    bubbleType: 'offer_card',
    offerTitle: 'Mirrorless camera kit with two lenses',
    offerPrice: 825,
    offerCurrency: 'USD',
  },
  {
    id: 'mk-message-4',
    conversationId: 'mk-convo-1',
    senderId: 'seller-maya',
    body: 'Pickup location shared',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-04T10:19:00.000Z',
    bubbleType: 'location',
    locationLabel: 'Silver Lake studio pickup',
  },
  {
    id: 'mk-message-5',
    conversationId: 'mk-convo-2',
    senderId: 'seller-leo',
    body: 'Desk dimensions are 48 by 24 inches.',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-03T20:20:00.000Z',
  },
];

const SAMPLE_REVIEWS: ReviewItem[] = [
  {
    id: 'review-1',
    reviewer: 'Maya Chen',
    rating: 5,
    date: '2026-04-02T09:00:00.000Z',
    detail: 'Responsive, clear pickup directions, and the item condition matched the photos.',
    listingTitle: 'Solid oak writing desk with cable tray',
  },
  {
    id: 'review-2',
    reviewer: 'Leo Park',
    rating: 4,
    date: '2026-03-29T09:00:00.000Z',
    detail: 'Fast handoff and good communication. Would buy again.',
    listingTitle: 'Mirrorless camera kit with two lenses',
  },
];

const SAMPLE_OFFERS: OfferItem[] = [
  {
    id: 'offer-1',
    listingId: 'mk-listing-1',
    listingTitle: 'Mirrorless camera kit with two lenses',
    listingSubtitle: 'Camera · Silver Lake',
    senderName: 'Maya Chen',
    receiverName: 'You',
    amountCents: 79000,
    originalCents: 84500,
    status: 'pending',
    direction: 'received',
    expiresAt: '2026-04-05T14:00:00.000Z',
    updatedAt: '2026-04-04T10:18:00.000Z',
    message: 'Can include the wrist strap and extra battery.',
    conversationId: 'mk-convo-1',
    chainId: 'chain-camera',
  },
  {
    id: 'offer-2',
    listingId: 'mk-listing-2',
    listingTitle: 'Solid oak writing desk with cable tray',
    listingSubtitle: 'Home · Pasadena',
    senderName: 'You',
    receiverName: 'Leo Park',
    amountCents: 19500,
    originalCents: 22000,
    status: 'pending',
    direction: 'sent',
    expiresAt: '2026-04-05T18:00:00.000Z',
    updatedAt: '2026-04-04T08:52:00.000Z',
    message: 'Can pick up tonight after 6.',
    conversationId: 'mk-convo-2',
    chainId: 'chain-desk',
  },
  {
    id: 'offer-3',
    listingId: 'mk-listing-3',
    listingTitle: 'Portfolio website refresh for local creators',
    listingSubtitle: 'Services · Remote',
    senderName: 'Nina Alvarez',
    receiverName: 'You',
    amountCents: 31500,
    originalCents: 35000,
    status: 'countered',
    direction: 'received',
    expiresAt: '2026-04-06T18:00:00.000Z',
    updatedAt: '2026-04-04T07:32:00.000Z',
    message: 'Can include a booking page if we land at this rate.',
    conversationId: 'mk-convo-1',
    chainId: 'chain-portfolio',
    parentOfferId: 'offer-4',
  },
  {
    id: 'offer-4',
    listingId: 'mk-listing-3',
    listingTitle: 'Portfolio website refresh for local creators',
    listingSubtitle: 'Services · Remote',
    senderName: 'You',
    receiverName: 'Nina Alvarez',
    amountCents: 29000,
    originalCents: 35000,
    status: 'accepted',
    direction: 'sent',
    expiresAt: '2026-04-02T18:00:00.000Z',
    updatedAt: '2026-04-02T11:20:00.000Z',
    message: 'Can move this week if the scope stays lean.',
    conversationId: 'mk-convo-1',
    chainId: 'chain-portfolio',
  },
  {
    id: 'offer-5',
    listingId: 'mk-listing-2',
    listingTitle: 'Solid oak writing desk with cable tray',
    listingSubtitle: 'Home · Pasadena',
    senderName: 'Leo Park',
    receiverName: 'You',
    amountCents: 20500,
    originalCents: 22000,
    status: 'expired',
    direction: 'received',
    expiresAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
    message: 'Hold until Friday if you can.',
    conversationId: 'mk-convo-2',
    chainId: 'chain-desk',
  },
];

const SAMPLE_TRACKING: TrackingItem[] = [
  {
    id: 'tracking-1',
    orderNumber: '4821',
    listingId: 'mk-listing-1',
    title: 'Mirrorless camera kit with two lenses',
    sellerName: 'Maya Chen',
    carrier: 'usps',
    trackingNumber: '9400111899223456789012',
    status: 'shipped',
    estimatedDelivery: '2026-04-07T18:00:00.000Z',
    lastUpdate: '2026-04-04T08:00:00.000Z',
    totalCents: 86300,
    escrowStatus: 'escrowed',
    paymentMethodLabel: 'Visa •••• 4421',
    shippingAddress: '2120 Sunset Blvd, Los Angeles, CA 90026',
    billingAddress: '2120 Sunset Blvd, Los Angeles, CA 90026',
    steps: [
      { key: 'ordered', label: 'Ordered', completedAt: 'Apr 4 · 9:22 AM' },
      { key: 'confirmed', label: 'Confirmed', completedAt: 'Apr 4 · 10:03 AM' },
      { key: 'shipped', label: 'Shipped', completedAt: 'Apr 4 · 2:11 PM' },
      { key: 'out_for_delivery', label: 'Out for Delivery' },
      { key: 'delivered', label: 'Delivered' },
      { key: 'released', label: 'Released' },
    ],
    conversationId: 'mk-convo-1',
  },
  {
    id: 'tracking-2',
    orderNumber: '4708',
    listingId: 'mk-listing-2',
    title: 'Solid oak writing desk with cable tray',
    sellerName: 'Leo Park',
    carrier: 'ups',
    trackingNumber: '1Z999AA10123456784',
    status: 'delivered',
    estimatedDelivery: '2026-04-04T18:00:00.000Z',
    lastUpdate: '2026-04-04T11:15:00.000Z',
    totalCents: 23800,
    escrowStatus: 'escrowed',
    paymentMethodLabel: 'Apple Pay',
    shippingAddress: '14 Grand Ave, Pasadena, CA 91105',
    billingAddress: '14 Grand Ave, Pasadena, CA 91105',
    steps: [
      { key: 'ordered', label: 'Ordered', completedAt: 'Apr 2 · 7:04 PM' },
      { key: 'confirmed', label: 'Confirmed', completedAt: 'Apr 2 · 7:21 PM' },
      { key: 'shipped', label: 'Shipped', completedAt: 'Apr 3 · 8:05 AM' },
      { key: 'out_for_delivery', label: 'Out for Delivery', completedAt: 'Apr 4 · 8:42 AM' },
      { key: 'delivered', label: 'Delivered', completedAt: 'Apr 4 · 1:14 PM' },
      { key: 'released', label: 'Released' },
    ],
    disputeId: 'dispute-1',
    conversationId: 'mk-convo-2',
  },
  {
    id: 'tracking-3',
    orderNumber: '4635',
    listingId: 'mk-listing-3',
    title: 'Portfolio website refresh for local creators',
    sellerName: 'Nina Alvarez',
    carrier: 'fedex',
    trackingNumber: '274593847561',
    status: 'disputed',
    estimatedDelivery: '2026-04-06T18:00:00.000Z',
    lastUpdate: '2026-04-04T07:05:00.000Z',
    totalCents: 35000,
    escrowStatus: 'failed',
    paymentMethodLabel: 'Mastercard •••• 9012',
    shippingAddress: 'Remote delivery',
    billingAddress: 'Remote delivery',
    steps: [
      { key: 'ordered', label: 'Ordered', completedAt: 'Apr 1 · 8:12 AM' },
      { key: 'confirmed', label: 'Confirmed', completedAt: 'Apr 1 · 8:46 AM' },
      { key: 'shipped', label: 'Shipped', completedAt: 'Apr 2 · 9:10 AM' },
      { key: 'out_for_delivery', label: 'Out for Delivery', completedAt: 'Apr 3 · 10:11 AM' },
      { key: 'delivered', label: 'Delivered', completedAt: 'Apr 3 · 4:55 PM' },
      { key: 'released', label: 'Released' },
    ],
    disputeId: 'dispute-2',
    conversationId: 'mk-convo-1',
  },
];

const SAMPLE_DISPUTES: DisputeItem[] = [
  {
    id: 'dispute-1',
    orderId: '4708',
    listingId: 'mk-listing-2',
    title: 'Solid oak writing desk with cable tray',
    status: 'open',
    filedAt: '2026-04-03T08:00:00.000Z',
    lastUpdate: '2026-04-04T07:00:00.000Z',
    summary: 'Buyer reported hidden leg wobble after delivery.',
    reason: 'Item not as described',
    buyerName: 'You',
    sellerName: 'Leo Park',
    amountCents: 23800,
    deadlineAt: '2026-04-08T17:00:00.000Z',
    openedBy: 'buyer',
    proposal: {
      type: 'partial_refund',
      amountCents: 5000,
      description: 'Seller offered a partial refund for repair costs.',
    },
    evidence: [
      { id: 'evidence-1', label: 'Desk wobble video', addedAt: '2026-04-03T09:10:00.000Z' },
      { id: 'evidence-2', label: 'Packaging condition', addedAt: '2026-04-03T09:18:00.000Z' },
    ],
    messages: [
      {
        id: 'dispute-message-1',
        senderName: 'You',
        body: 'The rear left leg shifts when any weight is applied.',
        createdAt: '2026-04-03T09:24:00.000Z',
      },
      {
        id: 'dispute-message-2',
        senderName: 'Leo Park',
        body: 'I can cover a repair or pick it back up if needed.',
        createdAt: '2026-04-03T10:02:00.000Z',
      },
    ],
  },
  {
    id: 'dispute-2',
    orderId: '4635',
    listingId: 'mk-listing-3',
    title: 'Portfolio website refresh for local creators',
    status: 'resolved',
    filedAt: '2026-03-28T08:00:00.000Z',
    lastUpdate: '2026-03-29T07:00:00.000Z',
    summary: 'Refund issued after the first revision missed the agreed brief.',
    reason: 'Service not delivered as expected',
    buyerName: 'You',
    sellerName: 'Nina Alvarez',
    amountCents: 35000,
    openedBy: 'buyer',
    evidence: [{ id: 'evidence-3', label: 'Scope notes', addedAt: '2026-03-28T08:45:00.000Z' }],
    messages: [
      {
        id: 'dispute-message-3',
        senderName: 'Nina Alvarez',
        body: 'Refund has been processed through escrow.',
        createdAt: '2026-03-29T07:00:00.000Z',
      },
    ],
  },
];

const SAMPLE_SAVED_SEARCHES: SavedSearchItem[] = [
  {
    id: 'saved-search-1',
    title: 'Film camera under $400',
    detail: 'Electronics · 10 mi · Good or better',
    matches: 4,
    updatedAt: '2026-04-04T11:00:00.000Z',
  },
  {
    id: 'saved-search-2',
    title: 'Standing desk',
    detail: 'Home · 20 mi · Pickup',
    matches: 2,
    updatedAt: '2026-04-03T18:00:00.000Z',
  },
];

const SAMPLE_SERVICES: ServiceItem[] = [
  {
    id: 'service-1',
    provider: 'Nina Alvarez',
    category: 'Design',
    description: 'Portfolio cleanup, launch pages, and accessible component polish.',
    radius: 'Remote / 30 mi',
    priceLabel: '$350 flat',
    rating: 4.9,
  },
  {
    id: 'service-2',
    provider: 'Jordan Kim',
    category: 'Repair',
    description: 'Bike tune-ups, brake adjustments, and commuter setup advice.',
    radius: '12 mi',
    priceLabel: '$45 hourly',
    rating: 4.8,
  },
];

const SAMPLE_CONVERSATION_META: Record<string, ConversationMeta> = {
  'mk-convo-1': {
    otherUserName: 'Maya Chen',
    requestStatus: 'pending',
    fingerprint: '8F3E 9A20 1145 2C6B 44D1 907C 5E2A 91BC',
    verified: false,
  },
  'mk-convo-2': {
    otherUserName: 'Leo Park',
    requestStatus: 'accepted',
    fingerprint: 'C1A7 4419 8BD0 0F3E 8833 17B2 AC91 7D0E',
    verified: true,
  },
};

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'pm-1', label: 'Visa •••• 4421', detail: 'Expires 09/28' },
  { id: 'pm-2', label: 'Apple Pay', detail: 'Face ID ready' },
  { id: 'pm-3', label: 'Mastercard •••• 9012', detail: 'Business card' },
];

const ADDRESS_OPTIONS: AddressOption[] = [
  {
    id: 'addr-1',
    label: 'Home',
    line1: '2120 Sunset Blvd',
    detail: 'Los Angeles, CA 90026',
  },
  {
    id: 'addr-2',
    label: 'Studio',
    line1: '817 Hyperion Ave',
    detail: 'Los Angeles, CA 90029',
  },
];

let MARKET_CONVERSATION_STORE: Conversation[] = SAMPLE_CONVERSATIONS.map((conversation) => ({ ...conversation }));
let MARKET_MESSAGE_STORE: ConversationMessage[] = SAMPLE_MESSAGES.map((message) => ({ ...message }));
let MARKET_CONVERSATION_META_STORE: Record<string, ConversationMeta> = Object.fromEntries(
  Object.entries(SAMPLE_CONVERSATION_META).map(([key, value]) => [key, { ...value }]),
) as Record<string, ConversationMeta>;
let MARKET_OFFER_STORE: OfferItem[] = SAMPLE_OFFERS.map((offer) => ({ ...offer }));
let MARKET_TRACKING_STORE: TrackingItem[] = SAMPLE_TRACKING.map((tracking) => ({
  ...tracking,
  steps: tracking.steps.map((step) => ({ ...step })),
}));
let MARKET_DISPUTE_STORE: DisputeItem[] = SAMPLE_DISPUTES.map((dispute) => ({
  ...dispute,
  proposal: dispute.proposal ? { ...dispute.proposal } : undefined,
  evidence: dispute.evidence.map((item) => ({ ...item })),
  messages: dispute.messages.map((message) => ({ ...message })),
}));

function useMarketData() {
  const hubDb = useDatabase();
  const db = useMemo(() => toMarketDb(hubDb), [hubDb]);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const categories = useMemo(() => {
    const cached = getCachedCategories(db);
    return cached.length > 0 ? cached : SAMPLE_CATEGORIES;
  }, [db, revision]);

  const listings = useMemo(() => {
    const cached = getCachedListings(db, { status: 'active', limit: 40 });
    return cached.length > 0 ? cached : SAMPLE_LISTINGS;
  }, [db, revision]);

  const watchlist = useMemo(() => {
    const cached = getCachedWatchlist(db, LOCAL_USER);
    return cached.length > 0 ? cached : SAMPLE_WATCHLIST;
  }, [db, revision]);

  const conversations = useMemo(() => {
    const cached = getCachedConversations(db, LOCAL_USER);
    return cached.length > 0 ? cached : MARKET_CONVERSATION_STORE;
  }, [db, revision]);

  const messagesForConversation = useCallback((conversationId: string) => {
    const cached = getCachedMessages(db, conversationId);
    return cached.length > 0
      ? (cached as ConversationMessage[])
      : MARKET_MESSAGE_STORE.filter((message) => message.conversationId === conversationId);
  }, [db]);

  const findListing = useCallback((listingId?: string | null) => {
    return getCachedListingById(db, listingId ?? '') ?? listings.find((listing) => listing.id === listingId) ?? listings[0] ?? SAMPLE_LISTINGS[0];
  }, [db, listings]);

  const verificationStats = useMemo(() => ({
    emailVerified: true,
    phoneVerified: true,
    photoVerified: true,
    idVerified: false,
    completedSales: 8,
    totalReviews: SAMPLE_REVIEWS.length,
    averageRating: 4.8,
    responseRate: 0.93,
    accountAgeDays: 210,
  }), []);

  const verificationLevel = useMemo(() => calculateVerificationLevel(verificationStats), [verificationStats]);

  return {
    db,
    refresh,
    categories,
    listings,
    watchlist,
    conversations,
    verificationLevel,
    verificationStats,
    messagesForConversation,
    findListing,
  };
}

function formatCurrencyCents(value: number) {
  return formatMarketPrice(value / 100, 'USD');
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Soon';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getOfferStatusColor(status: OfferStatus) {
  switch (status) {
    case 'accepted':
      return MK_OFFER_STATUS.accepted;
    case 'rejected':
      return MK_OFFER_STATUS.declined;
    case 'countered':
      return MK_OFFER_STATUS.counter;
    case 'expired':
      return MK_OFFER_STATUS.expired;
    default:
      return MK_OFFER_STATUS.pending;
  }
}

function getTrackingTone(status: TrackingStatus) {
  switch (status) {
    case 'released':
      return MK_PAYMENT_STATUS.released;
    case 'delivered':
      return MK_ACCENT_LIGHT;
    case 'disputed':
      return MK_OFFER_STATUS.declined;
    case 'out_for_delivery':
      return MK_OFFER_STATUS.pending;
    default:
      return MK_ACCENT;
  }
}

function readConversationMeta(conversationId: string) {
  return MARKET_CONVERSATION_META_STORE[conversationId] ?? {
    otherUserName: 'Marketplace contact',
    requestStatus: 'accepted',
    fingerprint: '0000 0000 0000 0000 0000 0000 0000 0000',
    verified: false,
  };
}

function writeConversationMeta(
  conversationId: string,
  updater: (current: ConversationMeta) => ConversationMeta,
) {
  const current = readConversationMeta(conversationId);
  MARKET_CONVERSATION_META_STORE = {
    ...MARKET_CONVERSATION_META_STORE,
    [conversationId]: updater(current),
  };
}

function bumpConversation(conversationId: string, at: string) {
  MARKET_CONVERSATION_STORE = MARKET_CONVERSATION_STORE.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, lastMessageAt: at }
      : conversation,
  );
}

function appendConversationMessage(
  conversationId: string,
  message: Omit<ConversationMessage, 'id' | 'conversationId' | 'createdAt'> & {
    createdAt?: string;
  },
) {
  const createdAt = message.createdAt ?? new Date().toISOString();
  MARKET_MESSAGE_STORE = [
    ...MARKET_MESSAGE_STORE,
    {
      ...message,
      id: makeId('mk-message'),
      conversationId,
      createdAt,
    },
  ];
  bumpConversation(conversationId, createdAt);
}

function getOffersForTab(tab: OfferTab) {
  switch (tab) {
    case 'received':
      return MARKET_OFFER_STORE.filter((offer) => offer.direction === 'received');
    case 'sent':
      return MARKET_OFFER_STORE.filter((offer) => offer.direction === 'sent');
    case 'active':
      return MARKET_OFFER_STORE.filter((offer) =>
        ['pending', 'countered', 'accepted'].includes(offer.status),
      );
    case 'history':
      return MARKET_OFFER_STORE.filter((offer) =>
        ['rejected', 'expired'].includes(offer.status),
      );
    default:
      return MARKET_OFFER_STORE;
  }
}

function updateOffer(
  offerId: string,
  updater: (current: OfferItem) => OfferItem,
) {
  MARKET_OFFER_STORE = MARKET_OFFER_STORE.map((offer) =>
    offer.id === offerId ? updater(offer) : offer,
  );
}

function respondToOffer(offerId: string, status: Extract<OfferStatus, 'accepted' | 'rejected'>) {
  updateOffer(offerId, (offer) => ({
    ...offer,
    status,
    updatedAt: new Date().toISOString(),
  }));
}

function createCounterOffer(offerId: string, amountCents: number, message: string) {
  const source = MARKET_OFFER_STORE.find((offer) => offer.id === offerId);
  if (!source) {
    return null;
  }

  updateOffer(offerId, (offer) => ({
    ...offer,
    status: 'countered',
    updatedAt: new Date().toISOString(),
  }));

  const isIncoming = source.direction === 'received';
  const nextOffer: OfferItem = {
    ...source,
    id: makeId('offer'),
    amountCents,
    status: 'pending',
    direction: isIncoming ? 'sent' : 'received',
    senderName: isIncoming ? 'You' : source.receiverName,
    receiverName: isIncoming ? source.senderName : 'You',
    message: message.trim() || source.message,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 36 * 3_600_000).toISOString(),
    parentOfferId: source.id,
  };

  MARKET_OFFER_STORE = [nextOffer, ...MARKET_OFFER_STORE];
  appendConversationMessage(source.conversationId, {
    senderId: LOCAL_USER,
    body: message.trim() || 'Counter offer attached',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    bubbleType: 'offer_card',
    offerTitle: source.listingTitle,
    offerPrice: amountCents / 100,
    offerCurrency: 'USD',
    readAt: null,
  });

  return nextOffer;
}

function updateTrackingItem(
  trackingId: string,
  updater: (current: TrackingItem) => TrackingItem,
) {
  MARKET_TRACKING_STORE = MARKET_TRACKING_STORE.map((item) =>
    item.id === trackingId ? updater(item) : item,
  );
}

function confirmTrackingReceipt(trackingId: string) {
  updateTrackingItem(trackingId, (item) => ({
    ...item,
    status: 'released',
    escrowStatus: 'released',
    lastUpdate: new Date().toISOString(),
    steps: item.steps.map((step) =>
      step.key === 'released'
        ? { ...step, completedAt: 'Receipt confirmed just now' }
        : step,
    ),
  }));
}

function createOrOpenDispute(item: TrackingItem) {
  const existing = item.disputeId
    ? MARKET_DISPUTE_STORE.find((dispute) => dispute.id === item.disputeId)
    : undefined;
  if (existing) {
    return existing.id;
  }

  const newDispute: DisputeItem = {
    id: makeId('dispute'),
    orderId: item.orderNumber,
    listingId: item.listingId,
    title: item.title,
    status: 'open',
    filedAt: new Date().toISOString(),
    lastUpdate: new Date().toISOString(),
    summary: 'Opened from tracking due to a delivery concern.',
    reason: 'Delivery issue',
    buyerName: 'You',
    sellerName: item.sellerName,
    amountCents: item.totalCents,
    deadlineAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    openedBy: 'buyer',
    evidence: [],
    messages: [],
  };

  MARKET_DISPUTE_STORE = [newDispute, ...MARKET_DISPUTE_STORE];
  updateTrackingItem(item.id, (current) => ({
    ...current,
    disputeId: newDispute.id,
    status: 'disputed',
    lastUpdate: new Date().toISOString(),
  }));

  return newDispute.id;
}

function updateDispute(
  disputeId: string,
  updater: (current: DisputeItem) => DisputeItem,
) {
  MARKET_DISPUTE_STORE = MARKET_DISPUTE_STORE.map((item) =>
    item.id === disputeId ? updater(item) : item,
  );
}

function addDisputeMessage(disputeId: string, body: string) {
  updateDispute(disputeId, (item) => ({
    ...item,
    lastUpdate: new Date().toISOString(),
    messages: [
      ...item.messages,
      {
        id: makeId('dispute-message'),
        senderName: 'You',
        body,
        createdAt: new Date().toISOString(),
      },
    ],
  }));
}

function addDisputeEvidence(disputeId: string, label: string) {
  updateDispute(disputeId, (item) => ({
    ...item,
    lastUpdate: new Date().toISOString(),
    evidence: [
      ...item.evidence,
      {
        id: makeId('evidence'),
        label,
        addedAt: new Date().toISOString(),
      },
    ],
  }));
}

function MarketRouteHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.phaseHeader}>
      <Pressable style={styles.phaseHeaderButton} onPress={onBack}>
        <MaterialSymbol name="arrow_back" size={18} color={MK_TEXT_SECONDARY} />
      </Pressable>
      <View style={styles.phaseHeaderCopy}>
        <RNText style={styles.phaseHeaderTitle}>{title}</RNText>
        {subtitle ? <RNText style={styles.phaseHeaderSubtitle}>{subtitle}</RNText> : null}
      </View>
      <View style={styles.phaseHeaderRight}>
        {right ?? <View style={styles.phaseHeaderButton} />}
      </View>
    </View>
  );
}

function MarketHero({
  eyebrow,
  title,
  subtitle,
  icon,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <MarketGlassCard elevated style={styles.phaseHeroCard}>
      <View style={styles.phaseHeroRow}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <RNText style={styles.phaseEyebrow}>{eyebrow}</RNText>
          <RNText style={styles.phaseHeroTitle}>{title}</RNText>
          {subtitle ? <RNText style={styles.phaseHeroSubtitle}>{subtitle}</RNText> : null}
        </View>
        {icon ? (
          <View style={styles.phaseHeroIconTile}>
            <MaterialSymbol name={icon} size={22} color={MK_ACCENT_LIGHT} />
          </View>
        ) : null}
      </View>
    </MarketGlassCard>
  );
}

function MarketPhaseScreen({
  headerTitle,
  headerSubtitle,
  heroEyebrow,
  heroTitle,
  heroSubtitle,
  heroIcon,
  onBack,
  children,
  stickyFooter,
  refreshing,
  onRefresh,
  headerRight,
}: {
  headerTitle: string;
  headerSubtitle?: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle?: string;
  heroIcon?: string;
  onBack: () => void;
  children: React.ReactNode;
  stickyFooter?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  headerRight?: React.ReactNode;
}) {
  return (
    <View style={styles.phaseScreen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.phaseContent,
          stickyFooter ? styles.phaseContentWithFooter : null,
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={ACCENT}
            />
          ) : undefined
        }
      >
        <MarketRouteHeader
          title={headerTitle}
          subtitle={headerSubtitle}
          onBack={onBack}
          right={headerRight}
        />
        <MarketHero
          eyebrow={heroEyebrow}
          title={heroTitle}
          subtitle={heroSubtitle}
          icon={heroIcon}
        />
        {children}
      </ScrollView>
      {stickyFooter ? <View style={styles.phaseStickyFooter}>{stickyFooter}</View> : null}
    </View>
  );
}

function PhaseSegment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.phaseSegment, selected ? styles.phaseSegmentActive : null]}
    >
      <RNText
        style={[
          styles.phaseSegmentLabel,
          selected ? styles.phaseSegmentLabelActive : null,
        ]}
      >
        {label}
      </RNText>
    </Pressable>
  );
}

function PhasePill({
  label,
  color,
  icon,
}: {
  label: string;
  color: string;
  icon?: string;
}) {
  return (
    <View style={[styles.phasePill, { backgroundColor: withAlpha(color, 0.16) }]}>
      {icon ? <MaterialSymbol name={icon} size={14} color={color} /> : null}
      <RNText style={[styles.phasePillText, { color }]}>{label}</RNText>
    </View>
  );
}

function PhaseActionButton({
  label,
  onPress,
  tone = 'surface',
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'success' | 'danger' | 'surface';
  icon?: string;
}) {
  const backgroundColor =
    tone === 'accent'
      ? ACCENT
      : tone === 'success'
        ? MK_OFFER_STATUS.accepted
        : tone === 'danger'
          ? withAlpha(MK_OFFER_STATUS.declined, 0.14)
          : MK_SURFACES.low;
  const textColor =
    tone === 'accent' || tone === 'success' ? MK_ACCENT_DARK : MK_TEXT;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.phaseActionButton,
        tone === 'danger' ? styles.phaseActionButtonDanger : null,
        { backgroundColor },
      ]}
    >
      {icon ? <MaterialSymbol name={icon} size={16} color={textColor} /> : null}
      <RNText style={[styles.phaseActionLabel, { color: textColor }]}>{label}</RNText>
    </Pressable>
  );
}

function MarketBottomSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetOverlay} onPress={onClose}>
        <Pressable style={styles.sheetBody} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sheetHandle} />
          <ScrollView contentContainerStyle={styles.sheetContent}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PhaseEmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: string;
}) {
  return (
    <MarketGlassCard style={styles.emptyStateCard}>
      <View style={styles.emptyStateIcon}>
        <MaterialSymbol name={icon} size={22} color={MK_ACCENT_LIGHT} />
      </View>
      <RNText style={styles.emptyStateTitle}>{title}</RNText>
      <RNText style={styles.emptyStateBody}>{body}</RNText>
    </MarketGlassCard>
  );
}

function ScreenScaffold({
  title,
  subtitle,
  children,
  fabLabel,
  onFabPress,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  fabLabel?: string;
  onFabPress?: () => void;
}) {
  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Text variant="caption" color={ACCENT}>HUMAN TO HUMAN</Text>
          </View>
          <Text variant="heading">{title}</Text>
          {subtitle ? (
            <Text variant="body" color={colors.textSecondary} style={styles.heroText}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </ScrollView>
      {fabLabel && onFabPress ? (
        <Pressable style={styles.fab} onPress={onFabPress}>
          <Text variant="body" color="#FFFFFF" style={{ fontWeight: '700' }}>{fabLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text variant="caption" color={active ? '#FFFFFF' : colors.textSecondary}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.statCard}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="subheading" color={ACCENT}>{value}</Text>
    </Card>
  );
}

function ListingCard({
  listing,
  onPress,
  onToggleWatch,
}: {
  listing: Listing;
  onPress?: () => void;
  onToggleWatch?: () => void;
}) {
  return (
    <Pressable style={styles.listingCard} onPress={onPress}>
      <View style={styles.listingPhoto}>
        <Pressable style={styles.watchButton} onPress={onToggleWatch}>
          <Text variant="caption" color="#FFFFFF">♥</Text>
        </Pressable>
        <View style={styles.conditionPill}>
          <Text variant="caption" color={ACCENT}>{listing.condition ?? listing.listingType}</Text>
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text variant="subheading">{listing.title}</Text>
        <Text variant="body" color={ACCENT}>{formatPrice(listing.priceCents, listing.pricingType)}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {listing.locationName ?? 'Nearby'} · {formatRelativeTime(listing.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

function ConversationRow({
  title,
  detail,
  timestamp,
  onPress,
}: {
  title: string;
  detail: string;
  timestamp: string | null;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.messageRow} onPress={onPress}>
      <View style={styles.avatar}>
        <Text variant="caption" color="#FFFFFF">{initials(title)}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.spaceBetween}>
          <Text variant="subheading">{title}</Text>
          {timestamp ? (
            <Text variant="caption" color={colors.textTertiary}>{formatRelativeTime(timestamp)}</Text>
          ) : null}
        </View>
        <Text variant="body" color={colors.textSecondary} numberOfLines={1}>{detail}</Text>
      </View>
      <View style={styles.unreadDot} />
    </Pressable>
  );
}

export function MarketHomeScreen() {
  const router = useRouter();
  const { listings, categories, watchlist, findListing } = useMarketData();
  const watchlistedItems = watchlist.map((item) => findListing(item.listingId)).slice(0, 3);

  return (
    <ScreenScaffold
      title="MyMarket Home"
      subtitle="Recent listings, category pulses, and a watchlist preview on top of the local cache while the cloud sync catches up."
      fabLabel="+ Listing"
      onFabPress={() => router.push('/(market)/sell')}
    >
      <View style={styles.statGrid}>
        <StatCard label="Recent Listings" value={String(listings.length)} />
        <StatCard label="Watchlist" value={String(watchlist.length)} />
        <StatCard label="Nearby Radius" value="12 mi" />
      </View>

      <View style={styles.sectionHeader}>
        <Text variant="subheading">Recent Listings</Text>
        <Pressable onPress={() => router.push('/(market)/browse')}>
          <Text variant="caption" color={ACCENT}>Browse All</Text>
        </Pressable>
      </View>
      {listings.slice(0, 3).map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onPress={() => router.push(`/(market)/${encodeURIComponent(listing.id)}`)}
        />
      ))}

      <Text variant="label" color={colors.textSecondary}>Categories</Text>
      <View style={styles.categoryGrid}>
        {categories.slice(0, 7).map((category) => (
          <Pressable
            key={category.id}
            style={styles.categoryCard}
            onPress={() => router.push(`/(market)/browse?categoryId=${encodeURIComponent(category.id)}`)}
          >
            <Text variant="caption" color={ACCENT}>{category.icon ?? category.name.slice(0, 2)}</Text>
            <Text variant="body">{category.name}</Text>
            <Text variant="caption" color={colors.textTertiary}>{Math.max(3, listings.filter((listing) => listing.categoryId === category.id).length)} listings</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text variant="subheading">Your Watchlist</Text>
        <Pressable onPress={() => router.push('/(market)/watchlist')}>
          <Text variant="caption" color={ACCENT}>See All</Text>
        </Pressable>
      </View>
      {watchlistedItems.map((listing) => (
        <Card key={listing.id} style={styles.inlineCard}>
          <Text variant="subheading">{listing.title}</Text>
          <Text variant="body" color={ACCENT}>{formatPrice(listing.priceCents, listing.pricingType)}</Text>
          <Text variant="caption" color={colors.success}>Price dropped $25 since last check</Text>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

export function MarketBrowseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string }>();
  const { db, refresh, listings, categories, watchlist } = useMarketData();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(params.categoryId ?? '');

  const visibleListings = useMemo(() => {
    return listings.filter((listing) => {
      const matchesQuery = query.trim().length === 0
        || `${listing.title} ${listing.description}`.toLowerCase().includes(query.trim().toLowerCase());
      const matchesCategory = selectedCategory.length === 0 || listing.categoryId === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [listings, query, selectedCategory]);

  return (
    <ScreenScaffold
      title="Browse"
      subtitle="Search, filter, and watch the cache-backed marketplace without dropping the local-first feel."
      fabLabel="+ Filters"
      onFabPress={() => router.push('/(market)/search')}
    >
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search marketplace"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
      />

      <View style={styles.chipRow}>
        <Chip label="All" active={selectedCategory.length === 0} onPress={() => setSelectedCategory('')} />
        {categories.slice(0, 5).map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            active={selectedCategory === category.id}
            onPress={() => setSelectedCategory(category.id)}
          />
        ))}
      </View>

      {visibleListings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onPress={() => router.push(`/(market)/${encodeURIComponent(listing.id)}`)}
          onToggleWatch={() => {
            const existing = watchlist.find((item) => item.listingId === listing.id);
            if (existing) {
              deleteCachedWatchlistItem(db, existing.id);
            } else {
              upsertCachedWatchlistItem(db, {
                id: makeId('watch'),
                userId: LOCAL_USER,
                listingId: listing.id,
                createdAt: new Date().toISOString(),
              });
            }
            refresh();
          }}
        />
      ))}
    </ScreenScaffold>
  );
}

export function MarketListingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { findListing, verificationLevel } = useMarketData();
  const listing = findListing(params.id);

  return (
    <ScreenScaffold
      title={listing.title}
      subtitle="Gallery, seller trust, and direct actions are stacked into a denser listing detail without touching the underlying listing model."
    >
      <Card style={styles.inlineCard}>
        <View style={styles.detailGallery}>
          <View style={styles.detailHeroPhoto} />
          <View style={styles.detailThumbRow}>
            <View style={styles.detailThumb} />
            <View style={styles.detailThumb} />
            <View style={styles.detailThumb} />
          </View>
        </View>
        <Text variant="heading">{formatPrice(listing.priceCents, listing.pricingType)}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {listing.condition ?? 'Service'} · {listing.locationName ?? 'Nearby'} · {listing.listingType.replace(/_/g, ' ')}
        </Text>
        <Text variant="body">{listing.description}</Text>
      </Card>

      <Card style={styles.inlineCard}>
        <Text variant="label" color={colors.textSecondary}>Seller</Text>
        <View style={styles.spaceBetween}>
          <View style={{ gap: spacing.xs }}>
            <Text variant="subheading">Verified Seller</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Level: {verificationLevel.replace(/_/g, ' ')} · 4.8 stars · 42 reviews
            </Text>
          </View>
          <View style={styles.levelPill}>
            <Text variant="caption" color={ACCENT}>{verificationLevel.replace(/_/g, ' ')}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.rowWrap}>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(market)/messages')}>
          <Text variant="caption" color={ACCENT}>Message Seller</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonSmall} onPress={() => router.push('/(market)/checkout')}>
          <Text variant="caption" color="#FFFFFF">Make Offer</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => router.push('/(market)/report')}>
        <Text variant="caption" color={colors.textSecondary}>Report Listing</Text>
      </Pressable>
    </ScreenScaffold>
  );
}

export function MarketSellScreen() {
  const router = useRouter();
  const { db, categories, refresh } = useMarketData();
  const [listingType, setListingType] = useState<ListingTypeOption>('sell');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? SAMPLE_CATEGORIES[0].id);

  return (
    <ScreenScaffold
      title="Create Listing"
      subtitle="Sell, trade, request, or offer a service without losing the cloud-backed listing model."
    >
      <Card style={styles.inlineCard}>
        <Text variant="label" color={colors.textSecondary}>Listing Type</Text>
        <View style={styles.chipRow}>
          {(['sell', 'trade', 'free', 'wanted', 'service_offer', 'service_request'] as ListingTypeOption[]).map((option) => (
            <Chip
              key={option}
              label={option.replace(/_/g, ' ')}
              active={listingType === option}
              onPress={() => setListingType(option)}
            />
          ))}
        </View>

        <View style={styles.photoUploadGrid}>
          <View style={styles.primaryPhotoSlot}>
            <Text variant="caption" color={colors.textTertiary}>Cover Photo</Text>
          </View>
          <View style={styles.photoSlot}><Text variant="caption" color={colors.textTertiary}>+</Text></View>
          <View style={styles.photoSlot}><Text variant="caption" color={colors.textTertiary}>+</Text></View>
        </View>

        <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.textTertiary} style={styles.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder="Describe the listing" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, styles.largeInput]} />
        <TextInput value={price} onChangeText={setPrice} placeholder="Price in dollars" placeholderTextColor={colors.textTertiary} style={styles.input} keyboardType="numeric" />

        <Text variant="label" color={colors.textSecondary}>Category</Text>
        <View style={styles.chipRow}>
          {categories.slice(0, 6).map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (!title.trim() || !description.trim()) {
              Alert.alert('Incomplete listing', 'Add a title and description before posting.');
              return;
            }
            const id = makeId('listing');
            const now = new Date().toISOString();
            upsertCachedListing(db, {
              id,
              sellerId: LOCAL_USER,
              categoryId,
              title: title.trim(),
              description: description.trim(),
              priceCents: price.trim() ? Math.round(Number(price) * 100) : null,
              currency: 'USD',
              pricingType: listingType === 'free' ? 'free' : listingType === 'trade' ? 'trade' : 'fixed',
              condition: listingType.includes('service') ? null : 'good',
              listingType,
              status: 'active',
              locationName: 'Local pickup',
              latitude: null,
              longitude: null,
              fulfillmentType: listingType.includes('service') ? 'remote' : 'pickup',
              serviceRadiusMiles: listingType.includes('service') ? 20 : null,
              availabilityNotes: null,
              tradeFor: null,
              viewCount: 0,
              watchCount: 0,
              messageCount: 0,
              createdAt: now,
              updatedAt: now,
              expiresAt: null,
            });
            refresh();
            router.replace(`/(market)/${encodeURIComponent(id)}`);
          }}
        >
          <Text variant="caption" color="#FFFFFF">Post Listing</Text>
        </Pressable>
      </Card>
    </ScreenScaffold>
  );
}

export function MarketWatchlistScreen() {
  const { db, refresh, watchlist, findListing } = useMarketData();

  return (
    <ScreenScaffold
      title="Watchlist"
      subtitle="Saved listings stay readable offline, with quick remove actions and price-change callouts."
    >
      {watchlist.map((item, index) => {
        const listing = findListing(item.listingId);
        return (
          <Card key={item.id} style={styles.inlineCard}>
            <View style={styles.spaceBetween}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text variant="subheading">{listing.title}</Text>
                <Text variant="body" color={ACCENT}>{formatPrice(listing.priceCents, listing.pricingType)}</Text>
                <Text variant="caption" color={index === 0 ? colors.success : colors.danger}>
                  {index === 0 ? 'Price dropped $25' : 'Price increased $15'}
                </Text>
              </View>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  deleteCachedWatchlistItem(db, item.id);
                  refresh();
                }}
              >
                <Text variant="caption" color={ACCENT}>Remove</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}
    </ScreenScaffold>
  );
}

export function MarketMessagesScreen() {
  const router = useRouter();
  const { conversations, findListing } = useMarketData();

  return (
    <ScreenScaffold
      title="Messages"
      subtitle="Conversation previews, encrypted status, and listing context are pulled into a calmer inbox."
      fabLabel="+ Message"
      onFabPress={() => router.push('/(market)/browse')}
    >
      <Card style={styles.inlineCard}>
        <Text variant="caption" color={ACCENT}>Encrypted</Text>
        <Text variant="body" color={colors.textSecondary}>Signal-style envelopes stay intact while the UI becomes easier to scan.</Text>
      </Card>
      {conversations.map((conversation) => {
        const listing = findListing(conversation.listingId);
        return (
          <ConversationRow
            key={conversation.id}
            title={listing.title}
            detail={`Regarding ${listing.title}`}
            timestamp={conversation.lastMessageAt}
            onPress={() => router.push(`/(market)/conversation/${encodeURIComponent(conversation.id)}`)}
          />
        );
      })}
    </ScreenScaffold>
  );
}

export function MarketConversationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { messagesForConversation, conversations, findListing } = useMarketData();
  const conversation = conversations.find((item) => item.id === params.id) ?? conversations[0] ?? SAMPLE_CONVERSATIONS[0];
  const listing = findListing(conversation.listingId);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState('');
  const [verifyVisible, setVerifyVisible] = useState(false);
  const meta = readConversationMeta(conversation.id);
  const messages = useMemo(
    () =>
      [...messagesForConversation(conversation.id)].sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      ),
    [conversation.id, messagesForConversation, revision],
  );

  const refresh = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  const sendMessage = useCallback(
    (message: Omit<ConversationMessage, 'id' | 'conversationId' | 'createdAt'>) => {
      try {
        appendConversationMessage(conversation.id, message);
        refresh();
      } catch (error) {
        Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    [conversation.id, refresh],
  );

  const handleSend = useCallback(() => {
    if (!draft.trim()) {
      return;
    }

    sendMessage({
      senderId: LOCAL_USER,
      body: draft.trim(),
      contentType: 'application/e2ee+ciphertext',
      ciphertext: null,
      encryptionAlgorithm: null,
      encryptionSalt: null,
      encryptionIv: null,
      readAt: null,
    });
    setDraft('');
  }, [draft, sendMessage]);

  const handleAttachment = useCallback(() => {
    Alert.alert('Attach', 'Choose what to send', [
      {
        text: 'Photo',
        onPress: () =>
          sendMessage({
            senderId: LOCAL_USER,
            body: 'Photo shared',
            contentType: 'text/plain',
            ciphertext: null,
            encryptionAlgorithm: null,
            encryptionSalt: null,
            encryptionIv: null,
            bubbleType: 'image',
            imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=900&q=80',
            readAt: null,
          }),
      },
      {
        text: 'Location',
        onPress: () =>
          sendMessage({
            senderId: LOCAL_USER,
            body: 'Pickup location',
            contentType: 'text/plain',
            ciphertext: null,
            encryptionAlgorithm: null,
            encryptionSalt: null,
            encryptionIv: null,
            bubbleType: 'location',
            locationLabel: 'Meet at Sunset Junction coffee stand',
            readAt: null,
          }),
      },
      {
        text: 'Make Offer',
        onPress: () =>
          sendMessage({
            senderId: LOCAL_USER,
            body: 'Counter offer attached',
            contentType: 'text/plain',
            ciphertext: null,
            encryptionAlgorithm: null,
            encryptionSalt: null,
            encryptionIv: null,
            bubbleType: 'offer_card',
            offerTitle: listing.title,
            offerPrice: 805,
            offerCurrency: 'USD',
            readAt: null,
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [listing.title, sendMessage]);

  return (
    <>
      <MarketPhaseScreen
        headerTitle={meta.otherUserName}
        headerSubtitle="Encrypted"
        heroEyebrow="END TO END"
        heroTitle="Conversation"
        heroSubtitle="Signal-style messaging keeps offers, locations, and delivery context in one secure thread."
        heroIcon="lock"
        onBack={() => router.push('/(market)/messages')}
        headerRight={(
          <Pressable
            style={styles.phaseHeaderButton}
            onPress={() =>
              Alert.alert('Conversation actions', undefined, [
                { text: 'View Profile' },
                { text: 'Verify Encryption', onPress: () => setVerifyVisible(true) },
                { text: 'Block' },
                { text: 'Report', style: 'destructive' },
                { text: 'Close', style: 'cancel' },
              ])
            }
          >
            <MaterialSymbol name="more_vert" size={18} color={MK_TEXT_SECONDARY} />
          </Pressable>
        )}
        stickyFooter={
          <View style={styles.composerBar}>
            <Pressable style={styles.composerAttachButton} onPress={handleAttachment}>
              <MaterialSymbol name="photo_camera" size={18} color={MK_ACCENT_LIGHT} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message securely"
              placeholderTextColor={MK_TEXT_TERTIARY}
              style={styles.composerInput}
            />
            {draft.trim().length > 0 ? (
              <Pressable style={styles.composerSendButton} onPress={handleSend}>
                <MaterialSymbol name="send" size={18} color={MK_ACCENT_DARK} />
              </Pressable>
            ) : null}
          </View>
        }
      >
        <MarketGlassCard style={styles.phaseCard}>
          <RNText style={styles.cardEyebrow}>LISTING CONTEXT</RNText>
          <View style={styles.spaceBetween}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <RNText style={styles.phaseCardTitle}>{listing.title}</RNText>
              <RNText style={styles.phaseCardBody}>
                {formatPrice(listing.priceCents, listing.pricingType)} · {listing.locationName ?? 'Nearby'}
              </RNText>
            </View>
            <PhaseActionButton
              label="View Listing"
              onPress={() => router.push(`/(market)/${encodeURIComponent(listing.id)}`)}
            />
          </View>
        </MarketGlassCard>

        {meta.requestStatus === 'pending' ? (
          <MarketGlassCard style={styles.phaseCard}>
            <RNText style={styles.phaseCardTitle}>Conversation request pending</RNText>
            <RNText style={styles.phaseCardBody}>
              Accept the thread to keep messages, offer cards, and attachments fully synced.
            </RNText>
            <View style={styles.phaseActionRow}>
              <PhaseActionButton
                label="Accept"
                tone="success"
                onPress={() => {
                  writeConversationMeta(conversation.id, (current) => ({
                    ...current,
                    requestStatus: 'accepted',
                  }));
                  refresh();
                }}
              />
              <PhaseActionButton
                label="Decline"
                tone="danger"
                onPress={() => {
                  writeConversationMeta(conversation.id, (current) => ({
                    ...current,
                    requestStatus: 'declined',
                  }));
                  refresh();
                }}
              />
            </View>
            <Pressable onPress={() => Alert.alert('Sender blocked')}>
              <RNText style={styles.phaseLink}>Block sender</RNText>
            </Pressable>
          </MarketGlassCard>
        ) : null}

        <View style={styles.messageListWrap}>
          <FlatList
            data={messages}
            inverted
            scrollEnabled={false}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            renderItem={({ item, index }) => {
              const mine = item.senderId === LOCAL_USER;
              const isHandshakeMarker = index === messages.length - 1;
              return (
                <View>
                  {isHandshakeMarker ? (
                    <View style={styles.handshakeRow}>
                      <MaterialSymbol name="lock" size={14} color={MK_ACCENT_LIGHT} />
                      <RNText style={styles.handshakeText}>
                        Secure session established
                      </RNText>
                    </View>
                  ) : null}
                  <View style={[styles.phaseMessageRow, mine ? styles.phaseMessageRowMine : null]}>
                    <MarketMessageBubble message={item} isMe={mine} encrypted />
                  </View>
                </View>
              );
            }}
          />
        </View>
      </MarketPhaseScreen>

      <MarketBottomSheet visible={verifyVisible} onClose={() => setVerifyVisible(false)}>
        <RNText style={styles.sheetTitle}>Verify Encryption</RNText>
        <RNText style={styles.sheetBodyText}>
          Compare this safety number in person or over another trusted channel.
        </RNText>
        <View style={styles.fingerprintCard}>
          <RNText style={styles.fingerprintValue}>{meta.fingerprint}</RNText>
        </View>
        <PhaseActionButton
          label={meta.verified ? 'Verified' : 'Mark as Verified'}
          tone="accent"
          onPress={() => {
            writeConversationMeta(conversation.id, (current) => ({
              ...current,
              verified: true,
            }));
            refresh();
            setVerifyVisible(false);
          }}
        />
      </MarketBottomSheet>
    </>
  );
}

export function MarketProfileScreen() {
  const router = useRouter();
  const { verificationLevel } = useMarketData();

  return (
    <ScreenScaffold
      title="Seller Profile"
      subtitle="Ratings, trust level, active listings, and monetization settings stay grouped without breaking the marketplace model."
    >
      <Card style={styles.inlineCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text variant="caption" color="#FFFFFF">TS</Text>
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="subheading">Trey Seller</Text>
            <Text variant="caption" color={colors.textSecondary}>4.8 stars · 26 reviews · joined 2025</Text>
          </View>
          <View style={styles.levelPill}>
            <Text variant="caption" color={ACCENT}>{verificationLevel.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <View style={styles.statGrid}>
          <StatCard label="Active" value="5" />
          <StatCard label="Sales" value="18" />
          <StatCard label="Purchases" value="9" />
        </View>
      </Card>

      {[
        ['Reviews', '/(market)/reviews'],
        ['Offers', '/(market)/offers'],
        ['Watchlist', '/(market)/watchlist'],
        ['Verification', '/(market)/verification'],
        ['Settings', '/(market)/settings'],
      ].map(([label, route]) => (
        <Pressable key={label} style={styles.settingRow} onPress={() => router.push(route as never)}>
          <Text variant="subheading">{label}</Text>
          <Text variant="caption" color={colors.textTertiary}>Open</Text>
        </Pressable>
      ))}
    </ScreenScaffold>
  );
}

export function MarketReviewsScreen() {
  const [tab, setTab] = useState<'seller' | 'buyer'>('seller');

  return (
    <ScreenScaffold
      title="Reviews"
      subtitle="Ratings stay legible as seller and buyer contexts split cleanly into tabs."
    >
      <View style={styles.chipRow}>
        <Chip label="As Seller" active={tab === 'seller'} onPress={() => setTab('seller')} />
        <Chip label="As Buyer" active={tab === 'buyer'} onPress={() => setTab('buyer')} />
      </View>
      {SAMPLE_REVIEWS.map((review) => (
        <Card key={review.id} style={styles.inlineCard}>
          <View style={styles.spaceBetween}>
            <Text variant="subheading">{review.reviewer}</Text>
            <Text variant="caption" color={ACCENT}>{'★'.repeat(review.rating)}</Text>
          </View>
          <Text variant="body">{review.detail}</Text>
          <Text variant="caption" color={colors.textSecondary}>{review.listingTitle} · {formatRelativeTime(review.date)}</Text>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

export function MarketOffersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<OfferTab>('received');
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [counterTargetId, setCounterTargetId] = useState<string | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const offers = useMemo(() => getOffersForTab(tab), [revision, tab]);
  const selectedOffer = useMemo(
    () => MARKET_OFFER_STORE.find((offer) => offer.id === selectedOfferId) ?? null,
    [revision, selectedOfferId],
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRevision((value) => value + 1);
    setTimeout(() => setRefreshing(false), 180);
  }, []);

  const runOfferAction = useCallback(
    (work: () => void, successMessage: string) => {
      try {
        work();
        refresh();
        Alert.alert('Offer updated', successMessage);
      } catch (error) {
        Alert.alert('Offer failed', error instanceof Error ? error.message : 'Try again.');
      }
    },
    [refresh],
  );

  return (
    <>
      <MarketPhaseScreen
        headerTitle="Offers"
        headerSubtitle="Trade flow"
        heroEyebrow="NEGOTIATIONS"
        heroTitle="Offers"
        heroSubtitle="Track sent, received, active, and closed negotiations without leaving the marketplace shell."
        heroIcon="gavel"
        onBack={() => router.push('/(market)/profile')}
        refreshing={refreshing}
        onRefresh={refresh}
      >
        <View style={styles.phaseSegmentRow}>
          {([
            ['received', 'Received'],
            ['sent', 'Sent'],
            ['active', 'Active'],
            ['history', 'History'],
          ] as Array<[OfferTab, string]>).map(([value, label]) => (
            <PhaseSegment
              key={value}
              label={label}
              selected={tab === value}
              onPress={() => setTab(value)}
            />
          ))}
        </View>

        {offers.length === 0 ? (
          <PhaseEmptyState
            icon="gavel"
            title="No offers yet"
            body="No offers in this category yet."
          />
        ) : (
          offers.map((offer) => {
            const statusColor = getOfferStatusColor(offer.status);
            const canRespond = tab === 'received' && offer.status === 'pending';
            return (
              <MarketGlassCard key={offer.id} style={styles.phaseCard}>
                <View style={styles.spaceBetween}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <RNText style={styles.phaseCardTitle}>{offer.listingTitle}</RNText>
                    <RNText style={styles.phaseCardBody}>{offer.listingSubtitle}</RNText>
                  </View>
                  <PhasePill label={offer.status.replace(/_/g, ' ')} color={statusColor} />
                </View>

                <View style={styles.offerPriceRow}>
                  <RNText style={styles.offerOriginalPrice}>
                    {formatCurrencyCents(offer.originalCents)}
                  </RNText>
                  <MarketPriceBadge price={offer.amountCents / 100} glass />
                </View>

                <RNText style={styles.phaseCardBody}>
                  {offer.direction === 'received' ? `From ${offer.senderName}` : `To ${offer.receiverName}`}
                </RNText>
                <RNText style={styles.phaseMutedText}>
                  Expires {formatShortDate(offer.expiresAt)} · {formatRelativeTime(offer.updatedAt)}
                </RNText>

                <View style={styles.phaseActionRow}>
                  {canRespond ? (
                    <>
                      <PhaseActionButton
                        label="Accept"
                        tone="success"
                        onPress={() =>
                          runOfferAction(
                            () => respondToOffer(offer.id, 'accepted'),
                            'Offer accepted and escrow can proceed.',
                          )
                        }
                      />
                      <PhaseActionButton
                        label="Decline"
                        tone="danger"
                        onPress={() =>
                          runOfferAction(
                            () => respondToOffer(offer.id, 'rejected'),
                            'Offer declined.',
                          )
                        }
                      />
                      <PhaseActionButton
                        label="Counter"
                        onPress={() => {
                          setCounterTargetId(offer.id);
                          setCounterPrice(String(Math.round(offer.amountCents / 100)));
                          setCounterMessage(offer.message ?? '');
                        }}
                      />
                    </>
                  ) : (
                    <PhaseActionButton
                      label="View details"
                      onPress={() => setSelectedOfferId(offer.id)}
                    />
                  )}
                </View>
              </MarketGlassCard>
            );
          })
        )}
      </MarketPhaseScreen>

      <MarketBottomSheet
        visible={selectedOffer != null}
        onClose={() => setSelectedOfferId(null)}
      >
        {selectedOffer ? (
          <>
            <RNText style={styles.sheetTitle}>{selectedOffer.listingTitle}</RNText>
            <RNText style={styles.sheetBodyText}>
              {selectedOffer.direction === 'received'
                ? `Offer from ${selectedOffer.senderName}`
                : `Offer sent to ${selectedOffer.receiverName}`}
            </RNText>
            <View style={styles.detailStatGrid}>
              <MarketGlassCard style={styles.detailStatCard}>
                <RNText style={styles.detailStatLabel}>Original</RNText>
                <RNText style={styles.detailStatValue}>
                  {formatCurrencyCents(selectedOffer.originalCents)}
                </RNText>
              </MarketGlassCard>
              <MarketGlassCard style={styles.detailStatCard}>
                <RNText style={styles.detailStatLabel}>Offer</RNText>
                <RNText style={styles.detailStatValue}>
                  {formatCurrencyCents(selectedOffer.amountCents)}
                </RNText>
              </MarketGlassCard>
            </View>
            <RNText style={styles.phaseCardBody}>{selectedOffer.message ?? 'No message attached.'}</RNText>
            <RNText style={styles.sheetBodyText}>
              Chain updates {MARKET_OFFER_STORE.filter((offer) => offer.chainId === selectedOffer.chainId).length} deep
            </RNText>
            <View style={styles.phaseActionRow}>
              <PhaseActionButton label="Open chat" onPress={() => router.push(`/(market)/conversation/${encodeURIComponent(selectedOffer.conversationId)}`)} />
              <PhaseActionButton
                label="Counter"
                onPress={() => {
                  setSelectedOfferId(null);
                  setCounterTargetId(selectedOffer.id);
                  setCounterPrice(String(Math.round(selectedOffer.amountCents / 100)));
                  setCounterMessage(selectedOffer.message ?? '');
                }}
              />
            </View>
          </>
        ) : null}
      </MarketBottomSheet>

      <MarketBottomSheet
        visible={counterTargetId != null}
        onClose={() => {
          setCounterTargetId(null);
          setCounterPrice('');
          setCounterMessage('');
        }}
      >
        <RNText style={styles.sheetTitle}>Counter Offer</RNText>
        <RNText style={styles.sheetBodyText}>
          Original and counter prices stay linked in the same offer chain.
        </RNText>
        <TextInput
          value={counterPrice}
          onChangeText={setCounterPrice}
          placeholder="New offer amount"
          placeholderTextColor={MK_TEXT_TERTIARY}
          keyboardType="numeric"
          style={styles.phaseTextInput}
        />
        <TextInput
          value={counterMessage}
          onChangeText={setCounterMessage}
          placeholder="Optional message"
          placeholderTextColor={MK_TEXT_TERTIARY}
          multiline
          style={[styles.phaseTextInput, styles.phaseTextArea]}
        />
        <PhaseActionButton
          label="Submit Counter"
          tone="accent"
          onPress={() => {
            const amount = Math.round(Number(counterPrice) * 100);
            if (!Number.isFinite(amount) || amount <= 0 || counterTargetId == null) {
              Alert.alert('Enter a valid amount');
              return;
            }
            runOfferAction(
              () => {
                createCounterOffer(counterTargetId, amount, counterMessage);
                setCounterTargetId(null);
                setCounterPrice('');
                setCounterMessage('');
              },
              'Counter offer sent.',
            );
          }}
        />
      </MarketBottomSheet>
    </>
  );
}

export function MarketTrackingScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'disputed'>('all');
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const orders = useMemo(() => {
    switch (filter) {
      case 'active':
        return MARKET_TRACKING_STORE.filter((item) =>
          ['ordered', 'confirmed', 'shipped', 'out_for_delivery'].includes(item.status),
        );
      case 'delivered':
        return MARKET_TRACKING_STORE.filter((item) =>
          ['delivered', 'released'].includes(item.status),
        );
      case 'disputed':
        return MARKET_TRACKING_STORE.filter((item) => item.status === 'disputed');
      default:
        return MARKET_TRACKING_STORE;
    }
  }, [filter, revision]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRevision((value) => value + 1);
    setTimeout(() => setRefreshing(false), 180);
  }, []);

  return (
    <MarketPhaseScreen
      headerTitle="My Orders"
      headerSubtitle="Tracking"
      heroEyebrow="ORDER FLOW"
      heroTitle="My Orders"
      heroSubtitle="Follow escrow, carrier milestones, and disputes from one delivery dashboard."
      heroIcon="local_shipping"
      onBack={() => router.push('/(market)/profile')}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      <View style={styles.phaseSegmentRow}>
        {([
          ['all', 'All'],
          ['active', 'Active'],
          ['delivered', 'Delivered'],
          ['disputed', 'Disputed'],
        ] as Array<['all' | 'active' | 'delivered' | 'disputed', string]>).map(([value, label]) => (
          <PhaseSegment
            key={value}
            label={label}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>

      {orders.map((item) => (
        <MarketGlassCard
          key={item.id}
          style={styles.phaseCard}
          onPress={() => router.push(`/(market)/tracking/${encodeURIComponent(item.id)}`)}
        >
          <View style={styles.spaceBetween}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <RNText style={styles.phaseCardTitle}>{item.title}</RNText>
              <RNText style={styles.phaseCardBody}>
                {CARRIER_NAMES[item.carrier]} · ETA {formatShortDate(item.estimatedDelivery)}
              </RNText>
            </View>
            <PhasePill
              label={item.status.replace(/_/g, ' ')}
              color={getTrackingTone(item.status)}
              icon="local_shipping"
            />
          </View>
          <RNText style={styles.phaseCardBody}>
            {formatCurrencyCents(item.totalCents)} · {formatRelativeTime(item.lastUpdate)}
          </RNText>
        </MarketGlassCard>
      ))}
    </MarketPhaseScreen>
  );
}

export function MarketTrackingDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [, setRevision] = useState(0);
  const item = MARKET_TRACKING_STORE.find((entry) => entry.id === params.id) ?? MARKET_TRACKING_STORE[0];
  const trackingUrl = buildTrackingUrl(item.carrier, item.trackingNumber);

  return (
    <MarketPhaseScreen
      headerTitle={`Order #${item.orderNumber}`}
      headerSubtitle={CARRIER_NAMES[item.carrier]}
      heroEyebrow="FULFILLMENT"
      heroTitle={item.title}
      heroSubtitle={`${formatCurrencyCents(item.totalCents)} · ${item.sellerName}`}
      heroIcon="local_shipping"
      onBack={() => router.push('/(market)/tracking')}
    >
      <MarketGlassCard style={styles.phaseCard}>
        <View style={styles.spaceBetween}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <RNText style={styles.phaseCardTitle}>{item.title}</RNText>
            <RNText style={styles.phaseCardBody}>
              Tracking #{item.trackingNumber}
            </RNText>
          </View>
          <PhasePill
            label={item.status.replace(/_/g, ' ')}
            color={getTrackingTone(item.status)}
            icon="schedule"
          />
        </View>
      </MarketGlassCard>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>STATUS TIMELINE</RNText>
        <MarketStatusTimeline
          steps={item.steps.map((step) => ({
            label: step.label,
            completedAt: step.completedAt,
            current: step.key === item.status,
          }))}
        />
      </MarketGlassCard>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>CARRIER</RNText>
        <RNText style={styles.phaseCardTitle}>{CARRIER_NAMES[item.carrier]}</RNText>
        <RNText style={styles.phaseCardBody}>
          {item.trackingNumber} · ETA {formatShortDate(item.estimatedDelivery)}
        </RNText>
        {trackingUrl ? (
          <Pressable onPress={() => Alert.alert('Carrier tracking URL', trackingUrl)}>
            <RNText style={styles.phaseLink}>Track on carrier site</RNText>
          </Pressable>
        ) : null}
      </MarketGlassCard>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>MAP VIEW</RNText>
        <View style={styles.mapPlaceholder}>
          <MaterialSymbol name="location_on" size={24} color={MK_ACCENT_LIGHT} />
          <RNText style={styles.mapPlaceholderText}>
            Route map becomes available when carrier coordinates are present.
          </RNText>
        </View>
      </MarketGlassCard>

      <View style={styles.phaseActionRow}>
        <PhaseActionButton
          label="Contact Seller"
          onPress={() => router.push(`/(market)/conversation/${encodeURIComponent(item.conversationId)}`)}
        />
        {item.status === 'delivered' ? (
          <PhaseActionButton
            label="Confirm Receipt"
            tone="success"
            onPress={() => {
              try {
                confirmTrackingReceipt(item.id);
                setRevision((value) => value + 1);
              } catch (error) {
                Alert.alert('Receipt failed', error instanceof Error ? error.message : 'Try again.');
              }
            }}
          />
        ) : null}
        <PhaseActionButton
          label="Open Dispute"
          tone="danger"
          onPress={() => {
            const disputeId = createOrOpenDispute(item);
            setRevision((value) => value + 1);
            router.push(`/(market)/dispute/${encodeURIComponent(disputeId)}`);
          }}
        />
      </View>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>ORDER DETAILS</RNText>
        <RNText style={styles.phaseCardBody}>Payment: {item.paymentMethodLabel}</RNText>
        <RNText style={styles.phaseCardBody}>Billing: {item.billingAddress}</RNText>
        <RNText style={styles.phaseCardBody}>Shipping: {item.shippingAddress}</RNText>
      </MarketGlassCard>
    </MarketPhaseScreen>
  );
}

export function MarketDisputesScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | DisputeStatus>('all');
  const disputes = useMemo(
    () =>
      filter === 'all'
        ? MARKET_DISPUTE_STORE
        : MARKET_DISPUTE_STORE.filter((item) => item.status === filter),
    [filter],
  );

  return (
    <MarketPhaseScreen
      headerTitle="Disputes"
      headerSubtitle="Resolution flow"
      heroEyebrow="BUYER PROTECTION"
      heroTitle="Disputes"
      heroSubtitle="Manage evidence, proposals, and escalation windows from one place."
      heroIcon="gavel"
      onBack={() => router.push('/(market)/profile')}
    >
      <View style={styles.phaseSegmentRow}>
        {([
          ['all', 'All'],
          ['open', 'Open'],
          ['in_review', 'In Review'],
          ['resolved', 'Resolved'],
        ] as Array<['all' | DisputeStatus, string]>).map(([value, label]) => (
          <PhaseSegment
            key={value}
            label={label}
            selected={filter === value}
            onPress={() => setFilter(value)}
          />
        ))}
      </View>

      {disputes.map((dispute) => (
        <MarketGlassCard
          key={dispute.id}
          style={styles.phaseCard}
          onPress={() => router.push(`/(market)/dispute/${encodeURIComponent(dispute.id)}`)}
        >
          <View style={styles.spaceBetween}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <RNText style={styles.phaseCardTitle}>{dispute.title}</RNText>
              <RNText style={styles.phaseCardBody}>{dispute.reason}</RNText>
            </View>
            <PhasePill
              label={dispute.status.replace(/_/g, ' ')}
              color={dispute.status === 'resolved' ? MK_PAYMENT_STATUS.released : MK_OFFER_STATUS.pending}
            />
          </View>
          <RNText style={styles.phaseMutedText}>
            Updated {formatRelativeTime(dispute.lastUpdate)}
          </RNText>
        </MarketGlassCard>
      ))}
    </MarketPhaseScreen>
  );
}

export function MarketDisputeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const [, setRevision] = useState(0);
  const [draft, setDraft] = useState('');
  const dispute = MARKET_DISPUTE_STORE.find((item) => item.id === params.id) ?? MARKET_DISPUTE_STORE[0];

  return (
    <MarketPhaseScreen
      headerTitle={`Dispute #${dispute.orderId}`}
      headerSubtitle={dispute.reason}
      heroEyebrow="RESOLUTION"
      heroTitle={dispute.title}
      heroSubtitle={dispute.summary}
      heroIcon="gavel"
      onBack={() => router.push('/(market)/disputes')}
      stickyFooter={
        <View style={styles.phaseStickyActions}>
          <PhaseActionButton
            label="Propose Resolution"
            onPress={() => {
              updateDispute(dispute.id, (item) => ({
                ...item,
                proposal: {
                  type: 'refund',
                  amountCents: item.amountCents,
                  description: 'Full refund issued through escrow.',
                },
                status: 'in_review',
                lastUpdate: new Date().toISOString(),
              }));
              setRevision((value) => value + 1);
            }}
          />
          <PhaseActionButton
            label="Escalate"
            tone="danger"
            onPress={() =>
              Alert.alert('Escalate dispute?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Escalate',
                  style: 'destructive',
                  onPress: () => {
                    updateDispute(dispute.id, (item) => ({
                      ...item,
                      status: 'escalated',
                      lastUpdate: new Date().toISOString(),
                    }));
                    setRevision((value) => value + 1);
                  },
                },
              ])
            }
          />
          <PhaseActionButton
            label="Close"
            tone="success"
            onPress={() =>
              Alert.alert('Close dispute?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Close',
                  onPress: () => {
                    updateDispute(dispute.id, (item) => ({
                      ...item,
                      status: 'resolved',
                      lastUpdate: new Date().toISOString(),
                    }));
                    setRevision((value) => value + 1);
                  },
                },
              ])
            }
          />
        </View>
      }
    >
      <MarketGlassCard style={styles.phaseCard}>
        <View style={styles.spaceBetween}>
          <PhasePill
            label={dispute.status.replace(/_/g, ' ')}
            color={dispute.status === 'resolved' ? MK_PAYMENT_STATUS.released : MK_OFFER_STATUS.pending}
          />
          <RNText style={styles.phaseMutedText}>
            {dispute.deadlineAt ? `Deadline ${formatShortDate(dispute.deadlineAt)}` : `Opened ${formatShortDate(dispute.filedAt)}`}
          </RNText>
        </View>
        <RNText style={styles.phaseCardBody}>{dispute.reason}</RNText>
      </MarketGlassCard>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>ORDER CONTEXT</RNText>
        <RNText style={styles.phaseCardTitle}>{dispute.title}</RNText>
        <RNText style={styles.phaseCardBody}>
          Buyer {dispute.buyerName} · Seller {dispute.sellerName}
        </RNText>
        <RNText style={styles.phaseCardBody}>
          Escrowed amount {formatCurrencyCents(dispute.amountCents)}
        </RNText>
      </MarketGlassCard>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>EVIDENCE</RNText>
        <View style={styles.evidenceGrid}>
          {dispute.evidence.map((item) => (
            <View key={item.id} style={styles.evidenceTile}>
              <MaterialSymbol name="photo_camera" size={18} color={MK_ACCENT_LIGHT} />
              <RNText style={styles.evidenceLabel}>{item.label}</RNText>
            </View>
          ))}
          <Pressable
            style={styles.evidenceTile}
            onPress={() => {
              addDisputeEvidence(dispute.id, `Evidence ${dispute.evidence.length + 1}`);
              setRevision((value) => value + 1);
            }}
          >
            <MaterialSymbol name="add" size={18} color={MK_ACCENT_LIGHT} />
            <RNText style={styles.evidenceLabel}>Add Evidence</RNText>
          </Pressable>
        </View>
      </MarketGlassCard>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>DESCRIPTION</RNText>
        <RNText style={styles.phaseCardBody}>{dispute.summary}</RNText>
      </MarketGlassCard>

      {dispute.proposal ? (
        <MarketGlassCard style={styles.phaseCard}>
          <RNText style={styles.cardEyebrow}>RESOLUTION PROPOSAL</RNText>
          <RNText style={styles.phaseCardTitle}>
            {dispute.proposal.type.replace(/_/g, ' ')}
          </RNText>
          <RNText style={styles.phaseCardBody}>
            {formatCurrencyCents(dispute.proposal.amountCents)} · {dispute.proposal.description}
          </RNText>
          <View style={styles.phaseActionRow}>
            <PhaseActionButton
              label="Accept"
              tone="success"
              onPress={() => {
                updateDispute(dispute.id, (item) => ({
                  ...item,
                  status: 'resolved',
                  lastUpdate: new Date().toISOString(),
                }));
                setRevision((value) => value + 1);
              }}
            />
            <PhaseActionButton
              label="Counter"
              onPress={() => {
                updateDispute(dispute.id, (item) => ({
                  ...item,
                  proposal: {
                    type: 'partial_refund',
                    amountCents: Math.round(item.amountCents * 0.6),
                    description: 'Countered with a revised partial refund.',
                  },
                  lastUpdate: new Date().toISOString(),
                }));
                setRevision((value) => value + 1);
              }}
            />
            <PhaseActionButton
              label="Decline"
              tone="danger"
              onPress={() =>
                Alert.alert('Decline proposal?', undefined, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Decline',
                    style: 'destructive',
                    onPress: () => {
                      updateDispute(dispute.id, (item) => ({
                        ...item,
                        proposal: undefined,
                        status: 'open',
                        lastUpdate: new Date().toISOString(),
                      }));
                      setRevision((value) => value + 1);
                    },
                  },
                ])
              }
            />
          </View>
        </MarketGlassCard>
      ) : null}

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>MESSAGE THREAD</RNText>
        <View style={styles.inlineMessageList}>
          {dispute.messages.map((message) => (
            <View key={message.id} style={styles.inlineMessageBubble}>
              <RNText style={styles.inlineMessageAuthor}>{message.senderName}</RNText>
              <RNText style={styles.phaseCardBody}>{message.body}</RNText>
            </View>
          ))}
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Reply in dispute thread"
          placeholderTextColor={MK_TEXT_TERTIARY}
          style={styles.phaseTextInput}
        />
        <PhaseActionButton
          label="Send Reply"
          onPress={() => {
            if (!draft.trim()) {
              return;
            }
            addDisputeMessage(dispute.id, draft.trim());
            setDraft('');
            setRevision((value) => value + 1);
          }}
        />
      </MarketGlassCard>
    </MarketPhaseScreen>
  );
}

export function MarketSavedSearchesScreen() {
  return (
    <ScreenScaffold
      title="Saved Searches"
      subtitle="Persisted search bundles, match counts, and notification toggles with a cleaner market-search loop."
    >
      {SAMPLE_SAVED_SEARCHES.map((item) => (
        <Card key={item.id} style={styles.inlineCard}>
          <Text variant="subheading">{item.title}</Text>
          <Text variant="body" color={colors.textSecondary}>{item.detail}</Text>
          <Text variant="caption" color={ACCENT}>{item.matches} new matches · {formatRelativeTime(item.updatedAt)}</Text>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

export function MarketServicesScreen() {
  const [selectedCategory, setSelectedCategory] = useState('All');

  return (
    <ScreenScaffold
      title="Services"
      subtitle="Portfolio-style provider cards separate service discovery from goods browsing while preserving the service listing types underneath."
      fabLabel="+ Service"
      onFabPress={() => Alert.alert('Service posting', 'Use the Sell screen to post a service offer or request.')}
    >
      <View style={styles.chipRow}>
        {['All', 'Design', 'Repair', 'Tutoring', 'Cleaning'].map((category) => (
          <Chip key={category} label={category} active={selectedCategory === category} onPress={() => setSelectedCategory(category)} />
        ))}
      </View>
      {SAMPLE_SERVICES.filter((service) => selectedCategory === 'All' || service.category === selectedCategory).map((service) => (
        <Card key={service.id} style={styles.inlineCard}>
          <View style={styles.spaceBetween}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text variant="subheading">{service.provider}</Text>
              <Text variant="caption" color={colors.textSecondary}>{service.category} · {service.radius}</Text>
            </View>
            <Text variant="caption" color={ACCENT}>{service.rating.toFixed(1)} stars</Text>
          </View>
          <Text variant="body">{service.description}</Text>
          <View style={styles.rowWrap}>
            <Text variant="body" color={ACCENT}>{service.priceLabel}</Text>
            <Pressable style={styles.primaryButtonSmall}>
              <Text variant="caption" color="#FFFFFF">Book Service</Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

export function MarketReportScreen() {
  const [reason, setReason] = useState('Scam / fraud');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <ScreenScaffold
      title="Report"
      subtitle="Reason picker, notes, and evidence slots without breaking the report and block primitives."
    >
      <Card style={styles.inlineCard}>
        {submitted ? (
          <>
            <Text variant="subheading" color={colors.success}>Report submitted</Text>
            <Text variant="body" color={colors.textSecondary}>The moderation queue has the listing snapshot and your notes.</Text>
          </>
        ) : (
          <>
            <Text variant="label" color={colors.textSecondary}>Reason</Text>
            <View style={styles.chipRow}>
              {['Prohibited item', 'Scam / fraud', 'Counterfeit', 'Harassment', 'Other'].map((item) => (
                <Chip key={item} label={item} active={reason === item} onPress={() => setReason(item)} />
              ))}
            </View>
            <TextInput value={details} onChangeText={setDetails} placeholder="Add context" placeholderTextColor={colors.textTertiary} multiline style={[styles.input, styles.largeInput]} />
            <View style={styles.photoUploadGrid}>
              <View style={styles.photoSlot}><Text variant="caption" color={colors.textTertiary}>Evidence</Text></View>
              <View style={styles.photoSlot}><Text variant="caption" color={colors.textTertiary}>+</Text></View>
              <View style={styles.photoSlot}><Text variant="caption" color={colors.textTertiary}>+</Text></View>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => setSubmitted(true)}>
              <Text variant="caption" color="#FFFFFF">Submit Report</Text>
            </Pressable>
          </>
        )}
      </Card>
    </ScreenScaffold>
  );
}

export function MarketSettingsScreen() {
  return (
    <ScreenScaffold
      title="Settings"
      subtitle="Privacy, payments, blocked users, and notification switches grouped into denser glass sections."
    >
      {[
        ['Profile visibility', 'Public'],
        ['Location precision', 'Approximate'],
        ['Stripe Connect', 'Connected'],
        ['New message alerts', 'Enabled'],
        ['Price drop alerts', 'Enabled'],
        ['Saved search matches', 'Enabled'],
      ].map(([label, value]) => (
        <Pressable key={label} style={styles.settingRow}>
          <Text variant="subheading">{label}</Text>
          <Text variant="caption" color={ACCENT}>{value}</Text>
        </Pressable>
      ))}
      <Card style={[styles.inlineCard, styles.dangerCard]}>
        <Text variant="subheading" color={colors.danger}>Delete Account</Text>
        <Text variant="body" color={colors.textSecondary}>Archive your payouts and exports before continuing.</Text>
      </Card>
    </ScreenScaffold>
  );
}

export function MarketCheckoutScreen() {
  const router = useRouter();
  const listing = SAMPLE_LISTINGS[0];
  const [step, setStep] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addressId, setAddressId] = useState(ADDRESS_OPTIONS[0].id);
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'expedited' | 'pickup'>('standard');
  const [paymentMethodId, setPaymentMethodId] = useState(PAYMENT_METHODS[0].id);
  const [complete, setComplete] = useState(false);

  const shippingCost = shippingMethod === 'expedited' ? 2800 : shippingMethod === 'pickup' ? 0 : 1800;
  const totalCents = (listing.priceCents ?? 0) * quantity + shippingCost;
  const timelineSteps = [
    { label: 'Item', completedAt: step > 0 || complete ? 'Done' : undefined, current: step === 0 && !complete },
    { label: 'Shipping', completedAt: step > 1 || complete ? 'Done' : undefined, current: step === 1 && !complete },
    { label: 'Payment', completedAt: complete ? 'Done' : undefined, current: step === 2 && !complete },
  ];

  const handleBack = useCallback(() => {
    if (complete) {
      router.push('/(market)/tracking');
      return;
    }

    if (step === 2) {
      Alert.alert('Leave payment step?', 'Your checkout is almost complete.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', onPress: () => router.push('/(market)/browse') },
      ]);
      return;
    }

    if (step > 0) {
      setStep((value) => value - 1);
      return;
    }

    router.push('/(market)/browse');
  }, [complete, router, step]);

  return (
    <MarketPhaseScreen
      headerTitle="Checkout"
      headerSubtitle="Secure payment"
      heroEyebrow="ESCROW"
      heroTitle="Secure Checkout"
      heroSubtitle="Review the item, confirm delivery details, and pay into escrow without leaving the flow."
      heroIcon="lock"
      onBack={handleBack}
      headerRight={(
        <View style={styles.phaseHeaderButton}>
          <MaterialSymbol name="lock" size={18} color={MK_ACCENT_LIGHT} />
        </View>
      )}
      stickyFooter={
        complete ? (
          <View style={styles.phaseStickyActions}>
            <PhaseActionButton
              label="Track Order"
              tone="accent"
              onPress={() => router.push('/(market)/tracking/tracking-1')}
            />
            <PhaseActionButton
              label="View in Messages"
              onPress={() => router.push('/(market)/conversation/mk-convo-1')}
            />
          </View>
        ) : step < 2 ? (
          <View style={styles.phaseStickyActions}>
            {step > 0 ? (
              <PhaseActionButton label="Back" onPress={() => setStep((value) => value - 1)} />
            ) : null}
            <PhaseActionButton
              label="Continue"
              tone="accent"
              onPress={() => setStep((value) => Math.min(value + 1, 2))}
            />
          </View>
        ) : (
          <View style={styles.phaseStickyActions}>
            <PhaseActionButton
              label={`Pay ${formatCurrencyCents(totalCents)}`}
              tone="accent"
              onPress={() => {
                try {
                  setComplete(true);
                } catch (error) {
                  Alert.alert('Payment failed', error instanceof Error ? error.message : 'Try again.');
                }
              }}
            />
          </View>
        )
      }
    >
      <MarketGlassCard elevated style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>ORDER SUMMARY</RNText>
        <View style={styles.spaceBetween}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <RNText style={styles.phaseCardTitle}>{listing.title}</RNText>
            {listing.condition ? <MarketConditionPill condition={listing.condition} /> : null}
            <RNText style={styles.phaseCardBody}>Seller Maya Chen</RNText>
          </View>
          <MarketPriceBadge price={(listing.priceCents ?? 0) / 100} glass />
        </View>
        <View style={styles.checkoutStepper}>
          <PhaseActionButton
            label="-"
            onPress={() => setQuantity((value) => Math.max(1, value - 1))}
          />
          <RNText style={styles.checkoutStepperValue}>{quantity}</RNText>
          <PhaseActionButton
            label="+"
            onPress={() => setQuantity((value) => value + 1)}
          />
        </View>
        <RNText style={styles.phaseCardBody}>
          Subtotal {formatCurrencyCents((listing.priceCents ?? 0) * quantity)} · Shipping {formatCurrencyCents(shippingCost)} · Total {formatCurrencyCents(totalCents)}
        </RNText>
      </MarketGlassCard>

      <MarketGlassCard style={styles.phaseCard}>
        <RNText style={styles.cardEyebrow}>PROGRESS</RNText>
        <MarketStatusTimeline steps={timelineSteps} orientation="horizontal" />
      </MarketGlassCard>

      {!complete && step === 0 ? (
        <MarketGlassCard style={styles.phaseCard}>
          <RNText style={styles.cardEyebrow}>ITEM CONFIRMATION</RNText>
          <RNText style={styles.phaseCardTitle}>{listing.title}</RNText>
          <RNText style={styles.phaseCardBody}>{listing.description}</RNText>
          <RNText style={styles.phaseCardBody}>
            Pickup or insured shipping available. Buyer protection activates at payment.
          </RNText>
        </MarketGlassCard>
      ) : null}

      {!complete && step === 1 ? (
        <MarketGlassCard style={styles.phaseCard}>
          <RNText style={styles.cardEyebrow}>SHIPPING</RNText>
          {ADDRESS_OPTIONS.map((address) => (
            <Pressable
              key={address.id}
              style={[styles.selectCard, address.id === addressId ? styles.selectCardActive : null]}
              onPress={() => setAddressId(address.id)}
            >
              <RNText style={styles.phaseCardTitle}>{address.label}</RNText>
              <RNText style={styles.phaseCardBody}>{address.line1}</RNText>
              <RNText style={styles.phaseMutedText}>{address.detail}</RNText>
            </Pressable>
          ))}
          <View style={styles.phaseSegmentRow}>
            {([
              ['standard', 'Standard'],
              ['expedited', 'Expedited'],
              ['pickup', 'Pickup'],
            ] as Array<['standard' | 'expedited' | 'pickup', string]>).map(([value, label]) => (
              <PhaseSegment
                key={value}
                label={label}
                selected={shippingMethod === value}
                onPress={() => setShippingMethod(value)}
              />
            ))}
          </View>
          <RNText style={styles.phaseCardBody}>Estimated delivery {formatShortDate('2026-04-07T18:00:00.000Z')}</RNText>
        </MarketGlassCard>
      ) : null}

      {!complete && step === 2 ? (
        <>
          <MarketGlassCard style={styles.phaseCard}>
            <RNText style={styles.cardEyebrow}>PAYMENT</RNText>
            {PAYMENT_METHODS.map((method) => (
              <Pressable
                key={method.id}
                style={[styles.selectCard, method.id === paymentMethodId ? styles.selectCardActive : null]}
                onPress={() => setPaymentMethodId(method.id)}
              >
                <RNText style={styles.phaseCardTitle}>{method.label}</RNText>
                <RNText style={styles.phaseMutedText}>{method.detail}</RNText>
              </Pressable>
            ))}
          </MarketGlassCard>

          <MarketGlassCard style={styles.phaseCard}>
            <View style={styles.inlineIconRow}>
              <MaterialSymbol name="lock" size={18} color={MK_ACCENT_LIGHT} />
              <RNText style={styles.phaseCardTitle}>Escrow protection</RNText>
            </View>
            <RNText style={styles.phaseCardBody}>
              Your payment is held in escrow until you confirm receipt. Funds release after delivery confirmation or seven days.
            </RNText>
            <View style={styles.phaseActionRow}>
              <PhasePill label="Stripe Verified" color={MK_ACCENT_LIGHT} icon="verified" />
              <PhasePill label="E2EE" color={ACCENT} icon="lock" />
              <PhasePill label="Refund Policy" color={MK_OFFER_STATUS.pending} icon="gavel" />
            </View>
          </MarketGlassCard>
        </>
      ) : null}

      {complete ? (
        <MarketGlassCard elevated style={styles.phaseCard}>
          <RNText style={styles.cardEyebrow}>PAYMENT CONFIRMED</RNText>
          <RNText style={styles.phaseHeroTitle}>Order placed</RNText>
          <RNText style={styles.phaseCardBody}>Order ID MK-4821 · Escrow secured · Seller notified.</RNText>
        </MarketGlassCard>
      ) : null}
    </MarketPhaseScreen>
  );
}

export function MarketSearchScreen() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('Newest');
  const { listings } = useMarketData();

  const visible = useMemo(() => {
    if (!query.trim()) return listings.slice(0, 4);
    return listings.filter((listing) =>
      `${listing.title} ${listing.description}`.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }, [listings, query]);

  return (
    <ScreenScaffold
      title="Search"
      subtitle="A focused search screen still exists for direct route compatibility, but now it looks like part of the redesigned marketplace."
    >
      <TextInput value={query} onChangeText={setQuery} placeholder="Search listings or services" placeholderTextColor={colors.textTertiary} style={styles.input} />
      <View style={styles.chipRow}>
        {['Newest', 'Price Low', 'Price High', 'Distance'].map((value) => (
          <Chip key={value} label={value} active={sort === value} onPress={() => setSort(value)} />
        ))}
      </View>
      {visible.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </ScreenScaffold>
  );
}

export function MarketVerificationScreen() {
  const { verificationLevel, verificationStats } = useMarketData();
  const level = verificationLevel as VerificationLevel;

  return (
    <ScreenScaffold
      title="Verification"
      subtitle="Trust level, verification steps, and listing limits stay visible because they are still real marketplace behavior."
    >
      <Card style={styles.inlineCard}>
        <Text variant="subheading">{level.replace(/_/g, ' ')}</Text>
        <Text variant="body" color={ACCENT}>Listing limit {LISTING_LIMITS[level] === Infinity ? 'Unlimited' : LISTING_LIMITS[level]}</Text>
        <Text variant="caption" color={colors.textSecondary}>Response rate {(verificationStats.responseRate * 100).toFixed(0)}% · {verificationStats.completedSales} completed sales</Text>
      </Card>
      {[
        { label: 'Email verification', complete: verificationStats.emailVerified },
        { label: 'Phone verification', complete: verificationStats.phoneVerified },
        { label: 'Photo verification', complete: verificationStats.photoVerified },
        { label: 'ID verification', complete: verificationStats.idVerified },
      ].map((item) => (
        <Card key={item.label} style={styles.inlineCard}>
          <View style={styles.spaceBetween}>
            <Text variant="body">{item.label}</Text>
            <Text variant="caption" color={item.complete ? colors.success : ACCENT}>
              {item.complete ? 'Done' : 'Start'}
            </Text>
          </View>
        </Card>
      ))}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + 72,
    gap: spacing.md,
  },
  phaseScreen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  phaseContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: spacing.xxl + 96,
    gap: spacing.md,
  },
  phaseContentWithFooter: {
    paddingBottom: spacing.xxl + 144,
  },
  phaseHeader: {
    paddingTop: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  phaseHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MK_SURFACES.low,
  },
  phaseHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  phaseHeaderTitle: {
    fontFamily: MK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    color: MK_TEXT,
  },
  phaseHeaderSubtitle: {
    fontFamily: MK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MK_TEXT_TERTIARY,
  },
  phaseHeaderRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  phaseHeroCard: {
    padding: 20,
  },
  phaseHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  phaseEyebrow: {
    fontFamily: MK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: MK_ACCENT_LIGHT,
  },
  phaseHeroTitle: {
    fontFamily: MK_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: MK_TEXT,
  },
  phaseHeroSubtitle: {
    fontFamily: MK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: MK_TEXT_SECONDARY,
  },
  phaseHeroIconTile: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_ACCENT, 0.18),
  },
  phaseSegmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phaseSegment: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MK_SURFACES.low,
  },
  phaseSegmentActive: {
    backgroundColor: ACCENT,
  },
  phaseSegmentLabel: {
    fontFamily: MK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MK_TEXT_SECONDARY,
  },
  phaseSegmentLabelActive: {
    color: MK_ACCENT_DARK,
  },
  phaseCard: {
    padding: 16,
    gap: spacing.sm,
  },
  cardEyebrow: {
    fontFamily: MK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: MK_TEXT_TERTIARY,
  },
  phaseCardTitle: {
    fontFamily: MK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 20,
    color: MK_TEXT,
  },
  phaseCardBody: {
    fontFamily: MK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: MK_TEXT_SECONDARY,
  },
  phaseMutedText: {
    fontFamily: MK_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: MK_TEXT_TERTIARY,
  },
  phasePill: {
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  phasePillText: {
    fontFamily: MK_FONTS.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  phaseActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  phaseActionButton: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  phaseActionButtonDanger: {
    borderWidth: 1,
    borderColor: withAlpha(MK_OFFER_STATUS.declined, 0.22),
  },
  phaseActionLabel: {
    fontFamily: MK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  phaseStickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(14, 14, 19, 0.88)',
  },
  phaseStickyActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  sheetBody: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: MK_SURFACES.base,
    paddingBottom: spacing.xl,
    maxHeight: '80%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: MK_SURFACES.highest,
    marginTop: 12,
  },
  sheetContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  sheetTitle: {
    fontFamily: MK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: MK_TEXT,
  },
  sheetBodyText: {
    fontFamily: MK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: MK_TEXT_SECONDARY,
  },
  emptyStateCard: {
    padding: 24,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyStateIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_ACCENT, 0.18),
  },
  emptyStateTitle: {
    fontFamily: MK_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 22,
    color: MK_TEXT,
  },
  emptyStateBody: {
    fontFamily: MK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: MK_TEXT_SECONDARY,
    textAlign: 'center',
  },
  messageListWrap: {
    gap: spacing.sm,
  },
  phaseMessageRow: {
    flexDirection: 'row',
  },
  phaseMessageRowMine: {
    justifyContent: 'flex-end',
  },
  handshakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  handshakeText: {
    fontFamily: MK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: MK_ACCENT_LIGHT,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 24,
    padding: 10,
    backgroundColor: MK_SURFACES.low,
  },
  composerAttachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(MK_ACCENT, 0.16),
  },
  composerInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: MK_SURFACES.mid,
    color: MK_TEXT,
    fontFamily: MK_FONTS.regular,
    fontSize: 14,
    lineHeight: 18,
  },
  composerSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
  },
  phaseLink: {
    fontFamily: MK_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: MK_ACCENT_LIGHT,
  },
  fingerprintCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: MK_SURFACES.low,
  },
  fingerprintValue: {
    fontFamily: MK_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 1.4,
    color: MK_TEXT,
  },
  offerPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  offerOriginalPrice: {
    fontFamily: MK_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    color: MK_TEXT_TERTIARY,
    textDecorationLine: 'line-through',
  },
  phaseTextInput: {
    minHeight: 48,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: MK_SURFACES.low,
    color: MK_TEXT,
    fontFamily: MK_FONTS.regular,
    fontSize: 14,
    lineHeight: 18,
  },
  phaseTextArea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  detailStatGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailStatCard: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  detailStatLabel: {
    fontFamily: MK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: MK_TEXT_TERTIARY,
    textTransform: 'uppercase',
  },
  detailStatValue: {
    fontFamily: MK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 20,
    color: MK_TEXT,
  },
  mapPlaceholder: {
    minHeight: 140,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: withAlpha(MK_ACCENT, 0.08),
  },
  mapPlaceholderText: {
    fontFamily: MK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: MK_TEXT_SECONDARY,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  evidenceTile: {
    width: '31%',
    minHeight: 92,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: MK_SURFACES.low,
  },
  evidenceLabel: {
    fontFamily: MK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: MK_TEXT_SECONDARY,
    textAlign: 'center',
  },
  inlineMessageList: {
    gap: spacing.sm,
  },
  inlineMessageBubble: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: MK_SURFACES.low,
    gap: spacing.xs,
  },
  inlineMessageAuthor: {
    fontFamily: MK_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: MK_ACCENT_LIGHT,
  },
  checkoutStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkoutStepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: MK_FONTS.semiBold,
    fontSize: 16,
    lineHeight: 20,
    color: MK_TEXT,
  },
  selectCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: MK_SURFACES.low,
    gap: 4,
  },
  selectCardActive: {
    backgroundColor: withAlpha(MK_ACCENT, 0.16),
  },
  inlineIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroCard: {
    ...glass.strong,
    padding: spacing.lg,
    gap: spacing.sm,
    borderColor: 'rgba(20,184,166,0.22)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.22)',
  },
  heroText: {
    marginTop: spacing.xs,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    minWidth: 104,
    flexGrow: 1,
    gap: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inlineCard: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 16,
  },
  largeInput: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  listingCard: {
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.glass,
    gap: spacing.sm,
  },
  listingPhoto: {
    height: 152,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  watchButton: {
    alignSelf: 'flex-end',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(10,10,15,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(20,184,166,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.22)',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  messageRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  detailGallery: {
    gap: spacing.sm,
  },
  detailHeroPhoto: {
    height: 240,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceElevated,
  },
  detailThumbRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailThumb: {
    flex: 1,
    height: 72,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: 'rgba(20,184,166,0.08)',
  },
  primaryButtonSmall: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: ACCENT,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    backgroundColor: ACCENT,
  },
  photoUploadGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryPhotoSlot: {
    flex: 2,
    height: 140,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSlot: {
    flex: 1,
    height: 140,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  levelPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(20,184,166,0.22)',
    backgroundColor: 'rgba(20,184,166,0.12)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.border,
  },
  timelineDotActive: {
    backgroundColor: ACCENT,
  },
  chatRow: {
    flexDirection: 'row',
  },
  chatRowMine: {
    justifyContent: 'flex-end',
  },
  chatRowOther: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '82%',
    padding: spacing.md,
    borderRadius: borderRadius.xl,
    gap: spacing.xs,
  },
  chatBubbleMine: {
    backgroundColor: ACCENT,
  },
  chatBubbleOther: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    height: 56,
    minWidth: 112,
    paddingHorizontal: spacing.lg,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 10,
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dangerCard: {
    borderColor: 'rgba(255,69,58,0.22)',
  },
});
