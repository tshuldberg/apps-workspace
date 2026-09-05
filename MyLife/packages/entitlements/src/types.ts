import type { ModuleId } from '@mylife/module-registry';

// ---------------------------------------------------------------------------
// Product IDs -- match RevenueCat / App Store / Play Store configuration
// ---------------------------------------------------------------------------

/** One-time $19.99 IAP that unlocks all MyLife modules. */
export type HubUnlockProduct = 'mylife_hub_unlock';

/** Per-module $4.99 standalone unlock. */
export type StandaloneProduct = `mylife_${ModuleId}_unlock`;

/** $9.99/yr optional update fee after Year 1. */
export type AnnualUpdateProduct = 'mylife_annual_update';

/** Cloud storage tier products. */
export type StorageTierProduct = 'mylife_storage_starter' | 'mylife_storage_power';

/** Union of every purchasable product identifier. */
export type ProductId =
  | HubUnlockProduct
  | StandaloneProduct
  | AnnualUpdateProduct
  | StorageTierProduct;

// ---------------------------------------------------------------------------
// Storage tiers
// ---------------------------------------------------------------------------

export type StorageTier = 'free' | 'starter' | 'power';

// ---------------------------------------------------------------------------
// Runtime plan modes and signed entitlement payloads
// ---------------------------------------------------------------------------

export type PlanMode = 'hosted' | 'self_host' | 'local_only';

export interface UnsignedEntitlements {
  appId: string;
  mode: PlanMode;
  hostedActive: boolean;
  selfHostLicense: boolean;
  updatePackYear?: number;
  features: string[];
  issuedAt: string;
  expiresAt?: string;
}

export interface Entitlements extends UnsignedEntitlements {
  signature: string;
}

// ---------------------------------------------------------------------------
// Purchase record (from RevenueCat / payment provider)
// ---------------------------------------------------------------------------

export interface Purchase {
  /** Product identifier matching a ProductId value. */
  productId: string;
  /** ISO-8601 timestamp of purchase. */
  purchaseDate: string;
  /** Whether the purchase is currently active (for subscriptions/renewals). */
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Entitlement state -- derived from purchases
// ---------------------------------------------------------------------------

export interface EntitlementState {
  /** true if the $19.99 hub unlock IAP has been purchased. */
  hubUnlocked: boolean;
  /** Set of modules individually unlocked via standalone $4.99 purchases. */
  unlockedModules: Set<ModuleId>;
  /** Current cloud storage tier. */
  storageTier: StorageTier;
  /** true if within Year 1 of purchase OR annual update fee is active. */
  updateEntitled: boolean;
  /** Date of the earliest qualifying purchase (hub or first standalone). */
  purchaseDate: Date | null;
}
