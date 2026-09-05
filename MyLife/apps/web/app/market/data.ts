import type {
  Category,
  Conversation,
  Dispute,
  Message,
  Offer,
  Payment,
  Review,
  SavedSearch,
  SellerVerification,
  ServiceAvailability,
  ServicePortfolioItem,
  Shipment,
  ShipmentEvent,
  VerificationLevel,
  WatchlistItem,
  Listing,
} from '@mylife/market';

export const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';

export interface SellerProfileRecord {
  id: string;
  name: string;
  handle: string;
  headline: string;
  bio: string;
  location: string;
  memberSince: string;
  tier: VerificationLevel;
  responseRate: number;
  averageRating: number;
  reviewCount: number;
  completedSales: number;
  activeListings: number;
  avatarSeed: string;
  specialties: string[];
}

export interface ReviewRecord extends Review {
  reviewerName: string;
}

export interface SavedSearchRecord extends SavedSearch {
  label: string;
  matchCount: number;
}

export interface BlockRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedName: string;
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  listingId: string | null;
  userId: string | null;
  reason: string;
  details: string | null;
  createdAt: string;
}

export interface SettingRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export interface DisputeMessageRecord {
  id: string;
  disputeId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface DisputeEvidenceRecord {
  id: string;
  disputeId: string;
  label: string;
  caption: string;
  createdAt: string;
}

export const MARKET_CATEGORY_ICONS: Record<string, string> = {
  electronics: 'devices',
  clothing: 'apparel',
  home: 'chair',
  sports: 'sports_soccer',
  books: 'menu_book',
  auto: 'directions_car',
  services: 'build',
};

export const MARKET_CATEGORIES: Category[] = [
  {
    id: '01000000-0000-4000-8000-000000000001',
    parentId: null,
    name: 'Electronics',
    slug: 'electronics',
    icon: 'devices',
    sortOrder: 0,
  },
  {
    id: '01000000-0000-4000-8000-000000000002',
    parentId: null,
    name: 'Clothing',
    slug: 'clothing',
    icon: 'apparel',
    sortOrder: 1,
  },
  {
    id: '01000000-0000-4000-8000-000000000003',
    parentId: null,
    name: 'Home',
    slug: 'home',
    icon: 'chair',
    sortOrder: 2,
  },
  {
    id: '01000000-0000-4000-8000-000000000004',
    parentId: null,
    name: 'Sports',
    slug: 'sports',
    icon: 'sports_soccer',
    sortOrder: 3,
  },
  {
    id: '01000000-0000-4000-8000-000000000005',
    parentId: null,
    name: 'Books',
    slug: 'books',
    icon: 'menu_book',
    sortOrder: 4,
  },
  {
    id: '01000000-0000-4000-8000-000000000006',
    parentId: null,
    name: 'Auto',
    slug: 'auto',
    icon: 'directions_car',
    sortOrder: 5,
  },
  {
    id: '01000000-0000-4000-8000-000000000007',
    parentId: null,
    name: 'Services',
    slug: 'services',
    icon: 'build',
    sortOrder: 6,
  },
];

export const MARKET_SELLERS: SellerProfileRecord[] = [
  {
    id: LOCAL_USER_ID,
    name: 'Avery Lane',
    handle: 'avery',
    headline: 'Curating better local trade',
    bio: 'Runs the MyMarket desk for design gear, books, and careful secondhand finds.',
    location: 'Los Angeles, CA',
    memberSince: '2024-01-12T08:00:00.000Z',
    tier: 'trusted',
    responseRate: 0.97,
    averageRating: 4.9,
    reviewCount: 18,
    completedSales: 34,
    activeListings: 5,
    avatarSeed: 'AL',
    specialties: ['Design gear', 'Photo kits', 'Books'],
  },
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Maya Chen',
    handle: 'maya-chen',
    headline: 'Camera kits and creator tools',
    bio: 'Photographer selling gear that has been used but kept in excellent condition.',
    location: 'Silver Lake, CA',
    memberSince: '2023-09-18T08:00:00.000Z',
    tier: 'top_seller',
    responseRate: 0.99,
    averageRating: 4.95,
    reviewCount: 42,
    completedSales: 128,
    activeListings: 6,
    avatarSeed: 'MC',
    specialties: ['Photography', 'Creator kits', 'Studio accessories'],
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Leo Park',
    handle: 'leo-park',
    headline: 'Furniture and workspace resets',
    bio: 'Buys and restores furniture, then lists the pieces that still deserve another decade.',
    location: 'Pasadena, CA',
    memberSince: '2023-04-03T08:00:00.000Z',
    tier: 'trusted',
    responseRate: 0.94,
    averageRating: 4.8,
    reviewCount: 31,
    completedSales: 74,
    activeListings: 4,
    avatarSeed: 'LP',
    specialties: ['Desks', 'Studio furniture', 'Storage'],
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    name: 'Nina Hart',
    handle: 'nina-hart',
    headline: 'Freelance design and digital cleanup',
    bio: 'Offers portfolio, analytics, and accessibility refreshes for local studios and creators.',
    location: 'Remote',
    memberSince: '2022-11-21T08:00:00.000Z',
    tier: 'verified',
    responseRate: 0.91,
    averageRating: 4.7,
    reviewCount: 26,
    completedSales: 39,
    activeListings: 3,
    avatarSeed: 'NH',
    specialties: ['Design systems', 'Accessibility', 'Portfolio fixes'],
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    name: 'Sonia Ruiz',
    handle: 'sonia-ruiz',
    headline: 'Vintage clothing and repaired essentials',
    bio: 'Small-batch closet edits, repairs, and cleaned archival pieces.',
    location: 'Highland Park, CA',
    memberSince: '2024-02-06T08:00:00.000Z',
    tier: 'verified',
    responseRate: 0.96,
    averageRating: 4.85,
    reviewCount: 17,
    completedSales: 22,
    activeListings: 5,
    avatarSeed: 'SR',
    specialties: ['Vintage denim', 'Repairs', 'Capsule wardrobe'],
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    name: 'Omar Bell',
    handle: 'omar-bell',
    headline: 'Cycling, trail, and garage gear',
    bio: 'Lists tuned-up equipment, clean take-offs, and field-tested accessories.',
    location: 'Long Beach, CA',
    memberSince: '2023-07-12T08:00:00.000Z',
    tier: 'basic',
    responseRate: 0.9,
    averageRating: 4.6,
    reviewCount: 12,
    completedSales: 18,
    activeListings: 4,
    avatarSeed: 'OB',
    specialties: ['Cycling', 'Trail gear', 'Garage finds'],
  },
];

export const MARKET_LISTINGS: Listing[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    sellerId: '00000000-0000-4000-8000-000000000101',
    categoryId: MARKET_CATEGORIES[0].id,
    title: 'Mirrorless camera kit with two lenses',
    description: 'Body, prime lens, zoom lens, battery grip, sling, and two freshly rotated batteries.',
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
    availabilityNotes: 'Pickup most evenings after 6pm.',
    tradeFor: null,
    viewCount: 132,
    watchCount: 19,
    messageCount: 7,
    createdAt: '2026-04-04T08:15:00.000Z',
    updatedAt: '2026-04-04T08:15:00.000Z',
    expiresAt: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    sellerId: '00000000-0000-4000-8000-000000000102',
    categoryId: MARKET_CATEGORIES[2].id,
    title: 'Solid oak writing desk with cable tray',
    description: 'Restored oak desk with shallow drawer, hidden tray, and a cable route cut into the rear edge.',
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
    availabilityNotes: 'Can help load into a hatchback or SUV.',
    tradeFor: null,
    viewCount: 84,
    watchCount: 11,
    messageCount: 5,
    createdAt: '2026-04-03T19:00:00.000Z',
    updatedAt: '2026-04-05T19:00:00.000Z',
    expiresAt: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    sellerId: '00000000-0000-4000-8000-000000000103',
    categoryId: MARKET_CATEGORIES[6].id,
    title: 'Portfolio website refresh for local creators',
    description: 'Design cleanup, accessibility fixes, analytics QA, and a tighter conversion flow for one small site.',
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
  {
    id: '10000000-0000-4000-8000-000000000004',
    sellerId: '00000000-0000-4000-8000-000000000104',
    categoryId: MARKET_CATEGORIES[1].id,
    title: 'Vintage denim jacket, repaired and cleaned',
    description: 'Broken-in oversized fit, reinforced seams, fresh lining repair, and recent dry clean.',
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
    viewCount: 65,
    watchCount: 8,
    messageCount: 4,
    createdAt: '2026-04-03T10:05:00.000Z',
    updatedAt: '2026-04-03T10:05:00.000Z',
    expiresAt: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    sellerId: '00000000-0000-4000-8000-000000000105',
    categoryId: MARKET_CATEGORIES[3].id,
    title: 'Carbon wheelset with fresh tubeless tape',
    description: 'Fast climbing wheelset, taped and ready, with spare valve cores and lightly used rotors.',
    priceCents: 64000,
    currency: 'USD',
    pricingType: 'negotiable',
    condition: 'like_new',
    listingType: 'sell',
    status: 'active',
    locationName: 'Long Beach',
    latitude: null,
    longitude: null,
    fulfillmentType: 'pickup',
    serviceRadiusMiles: null,
    availabilityNotes: 'Will ship if buyer covers insured label.',
    tradeFor: null,
    viewCount: 58,
    watchCount: 9,
    messageCount: 2,
    createdAt: '2026-04-02T16:45:00.000Z',
    updatedAt: '2026-04-05T16:45:00.000Z',
    expiresAt: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    sellerId: LOCAL_USER_ID,
    categoryId: MARKET_CATEGORIES[4].id,
    title: 'Margin notes set: design strategy bundle',
    description: 'Three lightly marked books on design systems, strategy, and typography, sold together.',
    priceCents: 4200,
    currency: 'USD',
    pricingType: 'fixed',
    condition: 'good',
    listingType: 'sell',
    status: 'active',
    locationName: 'Los Angeles',
    latitude: null,
    longitude: null,
    fulfillmentType: 'shipping',
    serviceRadiusMiles: null,
    availabilityNotes: 'Can drop at USPS same day.',
    tradeFor: null,
    viewCount: 41,
    watchCount: 5,
    messageCount: 1,
    createdAt: '2026-04-05T09:00:00.000Z',
    updatedAt: '2026-04-05T09:00:00.000Z',
    expiresAt: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000007',
    sellerId: LOCAL_USER_ID,
    categoryId: MARKET_CATEGORIES[6].id,
    title: 'Local listing photography mini-session',
    description: 'A 45 minute photo session for marketplace listings with same-day edit turnaround and aspect-ratio exports.',
    priceCents: 18000,
    currency: 'USD',
    pricingType: 'fixed',
    condition: null,
    listingType: 'service_offer',
    status: 'active',
    locationName: 'Los Angeles',
    latitude: null,
    longitude: null,
    fulfillmentType: 'onsite',
    serviceRadiusMiles: 25,
    availabilityNotes: 'Weekend mornings preferred.',
    tradeFor: null,
    viewCount: 27,
    watchCount: 3,
    messageCount: 0,
    createdAt: '2026-04-05T11:15:00.000Z',
    updatedAt: '2026-04-05T11:15:00.000Z',
    expiresAt: null,
  },
  {
    id: '10000000-0000-4000-8000-000000000008',
    sellerId: '00000000-0000-4000-8000-000000000102',
    categoryId: MARKET_CATEGORIES[2].id,
    title: 'Compact steel shelving set',
    description: 'Powder-coated storage shelves sized for entryways or small studios, no missing hardware.',
    priceCents: 9000,
    currency: 'USD',
    pricingType: 'fixed',
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
    viewCount: 33,
    watchCount: 4,
    messageCount: 1,
    createdAt: '2026-04-01T14:30:00.000Z',
    updatedAt: '2026-04-04T18:30:00.000Z',
    expiresAt: null,
  },
];

export const MARKET_WATCHLIST: WatchlistItem[] = [
  {
    id: '11000000-0000-4000-8000-000000000001',
    userId: LOCAL_USER_ID,
    listingId: MARKET_LISTINGS[0].id,
    createdAt: '2026-04-04T09:00:00.000Z',
  },
  {
    id: '11000000-0000-4000-8000-000000000002',
    userId: LOCAL_USER_ID,
    listingId: MARKET_LISTINGS[1].id,
    createdAt: '2026-04-04T10:00:00.000Z',
  },
  {
    id: '11000000-0000-4000-8000-000000000003',
    userId: LOCAL_USER_ID,
    listingId: MARKET_LISTINGS[4].id,
    createdAt: '2026-04-05T08:30:00.000Z',
  },
];

export const MARKET_CONVERSATIONS: Conversation[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    listingId: MARKET_LISTINGS[0].id,
    buyerId: LOCAL_USER_ID,
    sellerId: MARKET_LISTINGS[0].sellerId,
    lastMessageAt: '2026-04-06T10:10:00.000Z',
    createdAt: '2026-04-05T09:10:00.000Z',
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    listingId: MARKET_LISTINGS[1].id,
    buyerId: LOCAL_USER_ID,
    sellerId: MARKET_LISTINGS[1].sellerId,
    lastMessageAt: '2026-04-05T20:20:00.000Z',
    createdAt: '2026-04-04T19:35:00.000Z',
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    listingId: MARKET_LISTINGS[6].id,
    buyerId: '00000000-0000-4000-8000-000000000106',
    sellerId: LOCAL_USER_ID,
    lastMessageAt: '2026-04-06T07:45:00.000Z',
    createdAt: '2026-04-05T17:12:00.000Z',
  },
];

export const MARKET_MESSAGES: Message[] = [
  {
    id: '21000000-0000-4000-8000-000000000001',
    conversationId: MARKET_CONVERSATIONS[0].id,
    senderId: MARKET_LISTINGS[0].sellerId,
    body: 'Happy to include the wrist strap if you can pick it up this week.',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-05T09:50:00.000Z',
  },
  {
    id: '21000000-0000-4000-8000-000000000002',
    conversationId: MARKET_CONVERSATIONS[0].id,
    senderId: LOCAL_USER_ID,
    body: 'That works. Could we do Thursday evening?',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-05T10:02:00.000Z',
  },
  {
    id: '21000000-0000-4000-8000-000000000003',
    conversationId: MARKET_CONVERSATIONS[1].id,
    senderId: MARKET_LISTINGS[1].sellerId,
    body: null,
    contentType: 'application/e2ee+ciphertext',
    ciphertext: 'Q29vcmRpbmF0ZXMtaGlkZGVuLWJ1dC1lbmNyeXB0ZWQ=',
    encryptionAlgorithm: 'aes-256-gcm',
    encryptionSalt: 'U29tZVNhbHRTYW1wbGU=',
    encryptionIv: 'SW5pdFZlY3RvcjEy',
    createdAt: '2026-04-05T20:20:00.000Z',
  },
  {
    id: '21000000-0000-4000-8000-000000000004',
    conversationId: MARKET_CONVERSATIONS[2].id,
    senderId: MARKET_CONVERSATIONS[2].buyerId,
    body: 'Do you have any Saturday slots for a small apartment shoot?',
    contentType: 'text/plain',
    ciphertext: null,
    encryptionAlgorithm: null,
    encryptionSalt: null,
    encryptionIv: null,
    createdAt: '2026-04-06T07:45:00.000Z',
  },
];

export const MARKET_OFFERS: Offer[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    listingId: MARKET_LISTINGS[0].id,
    buyerId: LOCAL_USER_ID,
    sellerId: MARKET_LISTINGS[0].sellerId,
    amountCents: 80500,
    currency: 'USD',
    status: 'pending',
    counterAmountCents: null,
    message: 'Can meet in Silver Lake and pay same day.',
    expiresAt: '2026-04-08T23:59:00.000Z',
    createdAt: '2026-04-06T08:00:00.000Z',
    updatedAt: '2026-04-06T08:00:00.000Z',
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    listingId: MARKET_LISTINGS[1].id,
    buyerId: LOCAL_USER_ID,
    sellerId: MARKET_LISTINGS[1].sellerId,
    amountCents: 20500,
    currency: 'USD',
    status: 'countered',
    counterAmountCents: 21500,
    message: 'Counter includes help loading the desk.',
    expiresAt: '2026-04-09T23:59:00.000Z',
    createdAt: '2026-04-05T17:20:00.000Z',
    updatedAt: '2026-04-06T07:30:00.000Z',
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    listingId: MARKET_LISTINGS[6].id,
    buyerId: '00000000-0000-4000-8000-000000000106',
    sellerId: LOCAL_USER_ID,
    amountCents: 18000,
    currency: 'USD',
    status: 'accepted',
    counterAmountCents: null,
    message: 'Need photos for a pair of listings this weekend.',
    expiresAt: '2026-04-07T12:00:00.000Z',
    createdAt: '2026-04-05T18:00:00.000Z',
    updatedAt: '2026-04-05T18:15:00.000Z',
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    listingId: MARKET_LISTINGS[5].id,
    buyerId: '00000000-0000-4000-8000-000000000107',
    sellerId: LOCAL_USER_ID,
    amountCents: 4200,
    currency: 'USD',
    status: 'expired',
    counterAmountCents: null,
    message: 'Shipping to Oakland if still available.',
    expiresAt: '2026-04-05T14:00:00.000Z',
    createdAt: '2026-04-04T10:30:00.000Z',
    updatedAt: '2026-04-05T14:00:00.000Z',
  },
];

export const MARKET_PAYMENTS: Payment[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    listingId: MARKET_LISTINGS[6].id,
    buyerId: '00000000-0000-4000-8000-000000000106',
    sellerId: LOCAL_USER_ID,
    stripePaymentIntentId: 'pi_mock_market_001',
    amountCents: 18000,
    processingFeeCents: 540,
    feePayer: 'buyer',
    currency: 'USD',
    status: 'processing',
    refundAmountCents: null,
    createdAt: '2026-04-05T18:18:00.000Z',
    updatedAt: '2026-04-05T18:18:00.000Z',
  },
  {
    id: '40000000-0000-4000-8000-000000000002',
    listingId: MARKET_LISTINGS[0].id,
    buyerId: LOCAL_USER_ID,
    sellerId: MARKET_LISTINGS[0].sellerId,
    stripePaymentIntentId: 'pi_mock_market_002',
    amountCents: 84500,
    processingFeeCents: 2535,
    feePayer: 'buyer',
    currency: 'USD',
    status: 'disputed',
    refundAmountCents: null,
    createdAt: '2026-04-02T18:45:00.000Z',
    updatedAt: '2026-04-05T10:10:00.000Z',
  },
];

export const MARKET_SHIPMENTS: Shipment[] = [
  {
    id: '50000000-0000-4000-8000-000000000001',
    paymentId: MARKET_PAYMENTS[0].id,
    listingId: MARKET_PAYMENTS[0].listingId,
    sellerId: MARKET_PAYMENTS[0].sellerId,
    buyerId: MARKET_PAYMENTS[0].buyerId,
    carrier: 'ups',
    trackingNumber: '1Z999AA10123456784',
    status: 'in_transit',
    estimatedDeliveryDate: '2026-04-08T18:00:00.000Z',
    actualDeliveryDate: null,
    lastCarrierUpdate: 'Departed regional facility in Glendale',
    lastCheckedAt: '2026-04-06T09:10:00.000Z',
    createdAt: '2026-04-05T18:25:00.000Z',
    updatedAt: '2026-04-06T09:10:00.000Z',
  },
  {
    id: '50000000-0000-4000-8000-000000000002',
    paymentId: MARKET_PAYMENTS[1].id,
    listingId: MARKET_PAYMENTS[1].listingId,
    sellerId: MARKET_PAYMENTS[1].sellerId,
    buyerId: MARKET_PAYMENTS[1].buyerId,
    carrier: 'fedex',
    trackingNumber: '61299912345678912345',
    status: 'delivered',
    estimatedDeliveryDate: '2026-04-04T19:00:00.000Z',
    actualDeliveryDate: '2026-04-04T16:20:00.000Z',
    lastCarrierUpdate: 'Delivered to front desk',
    lastCheckedAt: '2026-04-04T17:00:00.000Z',
    createdAt: '2026-04-02T19:10:00.000Z',
    updatedAt: '2026-04-04T17:00:00.000Z',
  },
];

export const MARKET_SHIPMENT_EVENTS: Record<string, ShipmentEvent[]> = {
  [MARKET_PAYMENTS[0].id]: [
    {
      id: '51000000-0000-4000-8000-000000000001',
      shipmentId: MARKET_SHIPMENTS[0].id,
      status: 'label_created',
      description: 'Seller created an insured UPS label.',
      location: 'Los Angeles, CA',
      occurredAt: '2026-04-05T18:20:00.000Z',
      createdAt: '2026-04-05T18:20:00.000Z',
    },
    {
      id: '51000000-0000-4000-8000-000000000002',
      shipmentId: MARKET_SHIPMENTS[0].id,
      status: 'in_transit',
      description: 'Package scanned at Glendale sorting center.',
      location: 'Glendale, CA',
      occurredAt: '2026-04-06T09:05:00.000Z',
      createdAt: '2026-04-06T09:05:00.000Z',
    },
  ],
  [MARKET_PAYMENTS[1].id]: [
    {
      id: '51000000-0000-4000-8000-000000000003',
      shipmentId: MARKET_SHIPMENTS[1].id,
      status: 'in_transit',
      description: 'FedEx picked up the package.',
      location: 'Burbank, CA',
      occurredAt: '2026-04-03T08:30:00.000Z',
      createdAt: '2026-04-03T08:30:00.000Z',
    },
    {
      id: '51000000-0000-4000-8000-000000000004',
      shipmentId: MARKET_SHIPMENTS[1].id,
      status: 'delivered',
      description: 'Delivered to front desk and photographed.',
      location: 'Downtown LA, CA',
      occurredAt: '2026-04-04T16:20:00.000Z',
      createdAt: '2026-04-04T16:20:00.000Z',
    },
  ],
};

export const MARKET_DISPUTES: Dispute[] = [
  {
    id: '60000000-0000-4000-8000-000000000001',
    paymentId: MARKET_PAYMENTS[1].id,
    listingId: MARKET_PAYMENTS[1].listingId,
    buyerId: MARKET_PAYMENTS[1].buyerId,
    sellerId: MARKET_PAYMENTS[1].sellerId,
    reason: 'item_not_as_described',
    description: 'The body has noticeable shutter wear that was not shown in the listing photos and one lens cap was missing.',
    status: 'seller_response',
    resolutionType: null,
    refundAmountCents: null,
    filedAt: '2026-04-05T10:10:00.000Z',
    sellerResponseDeadline: '2026-04-08T10:10:00.000Z',
    resolvedAt: null,
    createdAt: '2026-04-05T10:10:00.000Z',
  },
];

export const MARKET_DISPUTE_MESSAGES: DisputeMessageRecord[] = [
  {
    id: '61000000-0000-4000-8000-000000000001',
    disputeId: MARKET_DISPUTES[0].id,
    senderName: 'Avery Lane',
    body: 'Uploaded comparison photos from the original listing and the delivered package.',
    createdAt: '2026-04-05T10:18:00.000Z',
  },
  {
    id: '61000000-0000-4000-8000-000000000002',
    disputeId: MARKET_DISPUTES[0].id,
    senderName: 'Maya Chen',
    body: 'Seller offered a partial refund for repair costs while confirming the cap will be mailed separately.',
    createdAt: '2026-04-05T11:05:00.000Z',
  },
];

export const MARKET_DISPUTE_EVIDENCE: DisputeEvidenceRecord[] = [
  {
    id: '62000000-0000-4000-8000-000000000001',
    disputeId: MARKET_DISPUTES[0].id,
    label: 'Camera body close-up',
    caption: 'Marked shutter wear around the grip edge.',
    createdAt: '2026-04-05T10:17:00.000Z',
  },
  {
    id: '62000000-0000-4000-8000-000000000002',
    disputeId: MARKET_DISPUTES[0].id,
    label: 'Missing accessory note',
    caption: 'Lens cap absent in delivered package.',
    createdAt: '2026-04-05T10:20:00.000Z',
  },
];

export const MARKET_SERVICE_PORTFOLIO: ServicePortfolioItem[] = [
  {
    id: '70000000-0000-4000-8000-000000000001',
    listingId: MARKET_LISTINGS[2].id,
    mediaType: 'photo',
    url: 'https://example.com/portfolio/accessibility-audit.jpg',
    caption: 'Accessibility and layout cleanups for a local studio.',
    sortOrder: 0,
    createdAt: '2026-03-29T12:00:00.000Z',
  },
  {
    id: '70000000-0000-4000-8000-000000000002',
    listingId: MARKET_LISTINGS[6].id,
    mediaType: 'before_after',
    url: 'https://example.com/portfolio/listing-photo-before-after.jpg',
    caption: 'Dim interior listing upgraded with neutral framing and cleaned backgrounds.',
    sortOrder: 0,
    createdAt: '2026-04-01T12:00:00.000Z',
  },
];

export const MARKET_SERVICE_AVAILABILITY: ServiceAvailability[] = [
  {
    id: '71000000-0000-4000-8000-000000000001',
    listingId: MARKET_LISTINGS[2].id,
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '14:00',
    createdAt: '2026-03-29T12:00:00.000Z',
  },
  {
    id: '71000000-0000-4000-8000-000000000002',
    listingId: MARKET_LISTINGS[6].id,
    dayOfWeek: 6,
    startTime: '08:30',
    endTime: '12:30',
    createdAt: '2026-04-01T12:00:00.000Z',
  },
];

export const MARKET_VERIFICATIONS: SellerVerification[] = [
  {
    id: '72000000-0000-4000-8000-000000000001',
    userId: LOCAL_USER_ID,
    emailVerified: true,
    phoneVerified: true,
    photoVerified: true,
    idVerified: false,
    completedSales: 34,
    totalReviews: 18,
    averageRating: 4.9,
    accountAgeDays: 480,
    verificationLevel: 'trusted',
    levelAchievedAt: '2025-05-02T12:00:00.000Z',
    createdAt: '2024-01-12T08:00:00.000Z',
    updatedAt: '2026-04-05T09:00:00.000Z',
  },
  {
    id: '72000000-0000-4000-8000-000000000002',
    userId: MARKET_SELLERS[1].id,
    emailVerified: true,
    phoneVerified: true,
    photoVerified: true,
    idVerified: true,
    completedSales: 128,
    totalReviews: 42,
    averageRating: 4.95,
    accountAgeDays: 820,
    verificationLevel: 'top_seller',
    levelAchievedAt: '2025-11-15T12:00:00.000Z',
    createdAt: '2023-09-18T08:00:00.000Z',
    updatedAt: '2026-04-04T08:00:00.000Z',
  },
];

export const MARKET_SAVED_SEARCHES: SavedSearchRecord[] = [
  {
    id: '80000000-0000-4000-8000-000000000001',
    userId: LOCAL_USER_ID,
    name: 'Camera kits nearby',
    query: 'camera lens grip',
    categoryId: MARKET_CATEGORIES[0].id,
    minPriceCents: 40000,
    maxPriceCents: 90000,
    notifyOnMatch: true,
    createdAt: '2026-04-03T09:00:00.000Z',
    label: 'Electronics · 5 mi · Like New',
    matchCount: 3,
  },
  {
    id: '80000000-0000-4000-8000-000000000002',
    userId: LOCAL_USER_ID,
    name: 'Studio desks',
    query: 'desk oak tray',
    categoryId: MARKET_CATEGORIES[2].id,
    minPriceCents: 10000,
    maxPriceCents: 30000,
    notifyOnMatch: false,
    createdAt: '2026-04-02T12:30:00.000Z',
    label: 'Home · Pickup only',
    matchCount: 2,
  },
];

export const MARKET_REVIEWS: ReviewRecord[] = [
  {
    id: '90000000-0000-4000-8000-000000000001',
    reviewerId: LOCAL_USER_ID,
    reviewerName: 'Avery Lane',
    sellerId: MARKET_SELLERS[1].id,
    listingId: MARKET_LISTINGS[0].id,
    rating: 5,
    body: 'Fast replies, packed carefully, and gave a clean explanation of shutter count before pickup.',
    createdAt: '2026-03-18T10:00:00.000Z',
  },
  {
    id: '90000000-0000-4000-8000-000000000002',
    reviewerId: LOCAL_USER_ID,
    reviewerName: 'Avery Lane',
    sellerId: MARKET_SELLERS[2].id,
    listingId: MARKET_LISTINGS[1].id,
    rating: 5,
    body: 'Desk matched the photos, seller helped load it, and the condition notes were accurate.',
    createdAt: '2026-03-28T14:00:00.000Z',
  },
  {
    id: '90000000-0000-4000-8000-000000000003',
    reviewerId: '00000000-0000-4000-8000-000000000106',
    reviewerName: 'Jordan Vale',
    sellerId: LOCAL_USER_ID,
    listingId: MARKET_LISTINGS[6].id,
    rating: 5,
    body: 'Photo session was quick, calm, and immediately made the listing feel premium.',
    createdAt: '2026-04-04T18:45:00.000Z',
  },
];

export const MARKET_BLOCKS: BlockRecord[] = [
  {
    id: '91000000-0000-4000-8000-000000000001',
    blockerId: LOCAL_USER_ID,
    blockedId: '00000000-0000-4000-8000-000000000120',
    blockedName: 'Spam account 120',
    createdAt: '2026-03-09T12:00:00.000Z',
  },
];

export const MARKET_SETTINGS: SettingRecord[] = [
  {
    key: 'push_watchlist',
    value: 'true',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    key: 'push_messages',
    value: 'true',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    key: 'push_offers',
    value: 'true',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    key: 'privacy_profile_visibility',
    value: 'verified-only',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    key: 'privacy_share_location',
    value: 'pickup-only',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
  {
    key: 'payment_default_method',
    value: 'visa-4421',
    updatedAt: '2026-04-04T09:00:00.000Z',
  },
];

export const MARKET_LISTING_VISUALS: Record<
  string,
  { icon: string; gradient: [string, string] }
> = {
  [MARKET_LISTINGS[0].id]: { icon: 'photo_camera', gradient: ['#0F172A', '#155E75'] },
  [MARKET_LISTINGS[1].id]: { icon: 'desk', gradient: ['#3F2C1D', '#7C5C3C'] },
  [MARKET_LISTINGS[2].id]: { icon: 'web', gradient: ['#083344', '#115E59'] },
  [MARKET_LISTINGS[3].id]: { icon: 'apparel', gradient: ['#4C1D95', '#7C3AED'] },
  [MARKET_LISTINGS[4].id]: { icon: 'bike_scooter', gradient: ['#172554', '#1D4ED8'] },
  [MARKET_LISTINGS[5].id]: { icon: 'menu_book', gradient: ['#422006', '#B45309'] },
  [MARKET_LISTINGS[6].id]: { icon: 'imagesmode', gradient: ['#0F172A', '#0F766E'] },
  [MARKET_LISTINGS[7].id]: { icon: 'shelves', gradient: ['#111827', '#374151'] },
};

export const MARKET_DISTANCE_MILES: Record<string, number> = {
  [MARKET_LISTINGS[0].id]: 4,
  [MARKET_LISTINGS[1].id]: 11,
  [MARKET_LISTINGS[2].id]: 0,
  [MARKET_LISTINGS[3].id]: 7,
  [MARKET_LISTINGS[4].id]: 18,
  [MARKET_LISTINGS[5].id]: 3,
  [MARKET_LISTINGS[6].id]: 6,
  [MARKET_LISTINGS[7].id]: 12,
};

export const MARKET_PREVIOUS_PRICES: Record<string, number | null> = {
  [MARKET_LISTINGS[0].id]: 89500,
  [MARKET_LISTINGS[1].id]: 24000,
  [MARKET_LISTINGS[4].id]: 68000,
  [MARKET_LISTINGS[7].id]: 12000,
};

export function getSellerProfileRecord(sellerId: string) {
  return MARKET_SELLERS.find((seller) => seller.id === sellerId) ?? MARKET_SELLERS[0];
}

export function getCategoryRecord(categoryId: string) {
  return MARKET_CATEGORIES.find((category) => category.id === categoryId) ?? MARKET_CATEGORIES[0];
}

export function getListingVisual(listingId: string) {
  return MARKET_LISTING_VISUALS[listingId] ?? {
    icon: 'inventory_2',
    gradient: ['#0F172A', '#334155'],
  };
}
