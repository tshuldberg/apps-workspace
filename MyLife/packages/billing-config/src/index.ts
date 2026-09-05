import { z } from 'zod';
import type { ModuleId } from '@mylife/module-registry';

// ---------------------------------------------------------------------------
// Product types
// ---------------------------------------------------------------------------

export type ProductType = 'one_time' | 'annual' | 'monthly';

export interface ProductConfig {
  id: string;
  price: number;
  type: ProductType;
}

export interface StorageTierConfig {
  id: string;
  price: number;
  storageGB: number;
}

export interface StandaloneModuleConfig {
  id: string;
  price: number;
}

// ---------------------------------------------------------------------------
// Product catalog
// ---------------------------------------------------------------------------

export const PRODUCTS = {
  hubUnlock: {
    id: 'mylife_hub_unlock',
    price: 19.99,
    type: 'one_time' as const,
  },
  annualUpdate: {
    id: 'mylife_annual_update',
    price: 9.99,
    type: 'annual' as const,
  },
  storageTiers: {
    free: { id: 'free', price: 0, storageGB: 1 },
    starter: { id: 'mylife_storage_starter', price: 2.99, storageGB: 5 },
    power: { id: 'mylife_storage_power', price: 5.99, storageGB: 25 },
  },
  standaloneModules: {
    books: { id: 'mylife_books_unlock', price: 4.99 },
    budget: { id: 'mylife_budget_unlock', price: 4.99 },
    car: { id: 'mylife_car_unlock', price: 4.99 },
    classes: { id: 'mylife_classes_unlock', price: 4.99 },
    closet: { id: 'mylife_closet_unlock', price: 4.99 },
    cycle: { id: 'mylife_cycle_unlock', price: 4.99 },
    create: { id: 'mylife_create_unlock', price: 4.99 },
    dining: { id: 'mylife_dining_unlock', price: 4.99 },
    flash: { id: 'mylife_flash_unlock', price: 4.99 },
    garden: { id: 'mylife_garden_unlock', price: 4.99 },
    habits: { id: 'mylife_habits_unlock', price: 4.99 },
    health: { id: 'mylife_health_unlock', price: 4.99 },
    homes: { id: 'mylife_homes_unlock', price: 4.99 },
    mail: { id: 'mylife_mail_unlock', price: 4.99 },
    manhattan: { id: 'mylife_manhattan_unlock', price: 4.99 },
    meds: { id: 'mylife_meds_unlock', price: 4.99 },
    mynews: { id: 'mylife_mynews_unlock', price: 4.99 },
    nutrition: { id: 'mylife_nutrition_unlock', price: 4.99 },
    pets: { id: 'mylife_pets_unlock', price: 4.99 },
    presence: { id: 'mylife_presence_unlock', price: 4.99 },
    recipes: { id: 'mylife_recipes_unlock', price: 4.99 },
    rsvp: { id: 'mylife_rsvp_unlock', price: 4.99 },
    shop: { id: 'mylife_shop_unlock', price: 4.99 },
    sports: { id: 'mylife_sports_unlock', price: 4.99 },
    stars: { id: 'mylife_stars_unlock', price: 4.99 },
    subs: { id: 'mylife_subs_unlock', price: 4.99 },
    surf: { id: 'mylife_surf_unlock', price: 4.99 },
    trails: { id: 'mylife_trails_unlock', price: 4.99 },
    travel: { id: 'mylife_travel_unlock', price: 4.99 },
    words: { id: 'mylife_words_unlock', price: 4.99 },
    workouts: { id: 'mylife_workouts_unlock', price: 4.99 },
  } satisfies Record<Exclude<ModuleId, 'fast' | 'forums' | 'friends' | 'journal' | 'market' | 'mood' | 'notes' | 'payments' | 'sleep' | 'voice'>, StandaloneModuleConfig>,
} as const;

// ---------------------------------------------------------------------------
// All purchasable product IDs (flat list for validation)
// ---------------------------------------------------------------------------

export const ALL_PRODUCT_IDS = [
  PRODUCTS.hubUnlock.id,
  PRODUCTS.annualUpdate.id,
  PRODUCTS.storageTiers.starter.id,
  PRODUCTS.storageTiers.power.id,
  ...Object.values(PRODUCTS.standaloneModules).map((m) => m.id),
] as const;

export const ProductIdSchema = z.enum(ALL_PRODUCT_IDS as unknown as [string, ...string[]]);

// ---------------------------------------------------------------------------
// Billing event types (webhooks from RevenueCat / Stripe)
// ---------------------------------------------------------------------------

export const BILLING_EVENT_TYPES = {
  purchaseCreated: 'purchase.created',
  purchaseRenewed: 'purchase.renewed',
  purchaseCanceled: 'purchase.canceled',
  purchaseRefunded: 'purchase.refunded',
  purchaseExpired: 'purchase.expired',
  purchaseDisputed: 'purchase.disputed',
} as const;

export const BillingEventTypeSchema = z.enum([
  BILLING_EVENT_TYPES.purchaseCreated,
  BILLING_EVENT_TYPES.purchaseRenewed,
  BILLING_EVENT_TYPES.purchaseCanceled,
  BILLING_EVENT_TYPES.purchaseRefunded,
  BILLING_EVENT_TYPES.purchaseExpired,
  BILLING_EVENT_TYPES.purchaseDisputed,
]);

export type BillingEventType = z.infer<typeof BillingEventTypeSchema>;

// ---------------------------------------------------------------------------
// Web billing SKUs (hosted subscription + self-host + update packs)
// ---------------------------------------------------------------------------

/**
 * Billing SKUs for the web/server-side hosted and self-host billing system.
 * These are distinct from the mobile IAP product IDs in PRODUCTS above.
 */
export const BILLING_SKUS = {
  hostedMonthly: 'mylife_hosted_monthly',
  hostedYearly: 'mylife_hosted_yearly',
  selfHostLifetime: 'mylife_self_host_lifetime',
  updatePack2026: 'mylife_update_pack_2026',
  meerkatHostedMonthly: 'meerkat_hosted_monthly',
} as const;

/**
 * FOUNDER-LOCKED PRICING (2026-07-05). Meerkat has exactly two prices:
 *   1. The app: $4.99 ONE-TIME.
 *   2. This hosted subscription: $4.99/month, WITH hosted storage included
 *      (hosted-relay + community-node + hosted-storage entitlements below).
 * Do not invent, derive, or "reconcile" other Meerkat price points. A
 * billing-config test locks this figure.
 */
export const MEERKAT_HOSTED_MONTHLY_PRODUCT: ProductConfig = {
  id: BILLING_SKUS.meerkatHostedMonthly,
  price: 4.99,
  type: 'monthly',
};

/**
 * FOUNDER-LOCKED PRICING (2026-07-05), price #1 of Meerkat's exactly two prices:
 * the Meerkat APP itself is a $4.99 ONE-TIME unlock (mobile IAP + web one-time).
 * This is NOT a subscription, NOT metered, and there is no yearly or tiered app
 * SKU. Price #2 is the hosted subscription (MEERKAT_HOSTED_MONTHLY_PRODUCT above).
 * Do not invent, derive, or "reconcile" any other Meerkat app price point. A
 * billing-config test locks this figure and the entitlements derivation.
 */
export const MEERKAT_APP_UNLOCK_PRODUCT: ProductConfig = {
  id: 'meerkat_app_unlock',
  price: 4.99,
  type: 'one_time',
};

export type BillingSku = (typeof BILLING_SKUS)[keyof typeof BILLING_SKUS];

export const BillingSkuSchema = z.enum([
  BILLING_SKUS.hostedMonthly,
  BILLING_SKUS.hostedYearly,
  BILLING_SKUS.selfHostLifetime,
  BILLING_SKUS.updatePack2026,
  BILLING_SKUS.meerkatHostedMonthly,
]);

// ---------------------------------------------------------------------------
// SKU entitlement defaults (what each SKU grants when purchased)
// ---------------------------------------------------------------------------

export interface SkuEntitlementDefaults {
  modeDefault: 'hosted' | 'self_host' | 'local_only' | 'unchanged';
  updatePackYear?: number;
  featuresDefault?: readonly string[];
}

export const SKU_ENTITLEMENT_DEFAULTS: Record<BillingSku, SkuEntitlementDefaults> = {
  [BILLING_SKUS.hostedMonthly]: { modeDefault: 'hosted' },
  [BILLING_SKUS.hostedYearly]: { modeDefault: 'hosted' },
  [BILLING_SKUS.selfHostLifetime]: { modeDefault: 'self_host' },
  [BILLING_SKUS.updatePack2026]: { modeDefault: 'unchanged', updatePackYear: 2026 },
  [BILLING_SKUS.meerkatHostedMonthly]: {
    modeDefault: 'hosted',
    featuresDefault: ['meerkat:hosted-relay', 'meerkat:community-node', 'meerkat:hosted-storage'],
  },
};
