import type { ModuleDefinition } from '@mylife/module-registry';
import { CACHE_TABLES, CACHE_INDEXES, V3_CACHE_TABLES, V3_CACHE_INDEXES } from './db/schema';

export const MARKET_MODULE: ModuleDefinition = {
  id: 'market',
  name: 'MyMarket',
  tagline: 'Buy, sell, and trade with your community',
  icon: '\u{1F3EA}',
  accentColor: '#14B8A6',
  tier: 'free',
  storageType: 'supabase',
  schemaVersion: 3,
  tablePrefix: 'mk_',
  syncPolicy: {
    defaultScope: 'device_local',
    shareable: false,
    entityRules: [
      {
        tableName: 'listings_cache',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'categories_cache',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
      {
        tableName: 'conversations_cache',
        defaultScope: 'device_local',
        conflictStrategy: 'lww',
      },
    ],
  },
  migrations: [
    {
      version: 1,
      description: 'Create local cache tables for offline browsing of listings, categories, and conversations',
      up: [...CACHE_TABLES, ...CACHE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS mk_messages_cache',
        'DROP TABLE IF EXISTS mk_conversations_cache',
        'DROP TABLE IF EXISTS mk_watchlist_cache',
        'DROP TABLE IF EXISTS mk_listing_photos_cache',
        'DROP TABLE IF EXISTS mk_listings_cache',
        'DROP TABLE IF EXISTS mk_categories_cache',
      ],
    },
    {
      version: 2,
      description: 'No-op: V1 schema already includes service listing and encryption columns',
      up: [
        "SELECT 1", // V1 CACHE_TABLES were updated in-place; columns already exist
      ],
      down: [],
    },
    {
      version: 3,
      description: 'Add cache tables for offers, payments, disputes, shipping, services, verification, and crypto sessions',
      up: [...V3_CACHE_TABLES, ...V3_CACHE_INDEXES],
      down: [
        'DROP TABLE IF EXISTS mk_prekeys_cache',
        'DROP TABLE IF EXISTS mk_sessions_cache',
        'DROP TABLE IF EXISTS mk_identity_keys',
        'DROP TABLE IF EXISTS mk_seller_verification_cache',
        'DROP TABLE IF EXISTS mk_service_availability_cache',
        'DROP TABLE IF EXISTS mk_service_portfolio_cache',
        'DROP TABLE IF EXISTS mk_shipments_cache',
        'DROP TABLE IF EXISTS mk_disputes_cache',
        'DROP TABLE IF EXISTS mk_payments_cache',
        'DROP TABLE IF EXISTS mk_offers_cache',
      ],
    },
  ],
  navigation: {
    tabs: [
      { key: 'home', label: 'Home', icon: 'home' },
      { key: 'browse', label: 'Browse', icon: 'search' },
      { key: 'sell', label: 'Sell', icon: 'plus-circle' },
      { key: 'messages', label: 'Messages', icon: 'message-circle' },
      { key: 'profile', label: 'Profile', icon: 'user' },
    ],
    screens: [
      { name: 'listing-detail', title: 'Listing' },
      { name: 'create-listing', title: 'New Listing' },
      { name: 'edit-listing', title: 'Edit Listing' },
      { name: 'chat-thread', title: 'Chat' },
      { name: 'category-browser', title: 'Categories' },
      { name: 'search-results', title: 'Search' },
      { name: 'seller-profile', title: 'Seller' },
      { name: 'checkout', title: 'Checkout' },
      { name: 'payment-settings', title: 'Payment Settings' },
      { name: 'verification', title: 'Verification' },
      { name: 'dispute', title: 'Dispute' },
      { name: 'dispute-detail', title: 'Dispute Detail' },
      { name: 'shipping-detail', title: 'Tracking' },
      { name: 'services', title: 'Services' },
      { name: 'service-detail', title: 'Service Provider' },
      { name: 'create-service-listing', title: 'Offer a Service' },
    ],
  },
  requiresAuth: false,
  requiresNetwork: true,
  version: '0.1.0',
};
