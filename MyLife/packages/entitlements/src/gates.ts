import { FREE_MODULES as FREE_MODULE_IDS, type ModuleId } from '@mylife/module-registry';
import type { EntitlementState, Purchase, StorageTier } from './types';
import { isTestMode } from './test-mode';

/** Modules that are always free regardless of purchase state. */
const FREE_MODULES: ReadonlySet<ModuleId> = new Set(FREE_MODULE_IDS);

/** One year in milliseconds. */
const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Matches standalone module unlock product IDs (e.g. 'mylife_books_unlock'). */
const STANDALONE_UNLOCK_RE = /^mylife_(.+)_unlock$/;

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Returns true if a module is unlocked for the user.
 *
 * A module is unlocked if:
 * - It is a free module (MyFast), OR
 * - The hub unlock ($19.99) has been purchased, OR
 * - The individual standalone unlock for that module was purchased
 */
export function isModuleUnlocked(moduleId: ModuleId, state: EntitlementState): boolean {
  if (isTestMode()) return true;
  if (FREE_MODULES.has(moduleId)) return true;
  if (state.hubUnlocked) return true;
  return state.unlockedModules.has(moduleId);
}

/** Returns all module IDs the user currently has access to. */
export function getUnlockedModules(
  allModuleIds: readonly ModuleId[],
  state: EntitlementState,
): ModuleId[] {
  // Fast path: hub unlock means every module is accessible
  if (state.hubUnlocked) return [...allModuleIds];
  return allModuleIds.filter((id) => isModuleUnlocked(id, state));
}

/** Returns true if the full hub unlock ($19.99) has been purchased. */
export function isHubUnlocked(state: EntitlementState): boolean {
  return state.hubUnlocked;
}

/** Returns the user's current storage tier. */
export function getStorageTier(state: EntitlementState): StorageTier {
  return state.storageTier;
}

/**
 * Returns true if the user is entitled to app updates.
 *
 * Update entitlement is active when:
 * - The user is within Year 1 of their purchase, OR
 * - The $9.99/yr annual update fee is currently active
 */
export function isUpdateEntitled(state: EntitlementState): boolean {
  return state.updateEntitled;
}

/**
 * Minimal shape needed by isEntitlementExpired.
 * Accepted by both EntitlementState (IAP model) and ServerEntitlement (hosted model).
 */
export interface EntitlementExpirableShape {
  /** Optional ISO-8601 expiry timestamp (from server/hosted entitlements). */
  expiresAt?: string;
  /** Optional purchase date for the IAP model. */
  purchaseDate?: Date | null;
  /** Whether update entitlement is active (IAP model). */
  updateEntitled?: boolean;
}

/**
 * Returns true if the entitlement has expired.
 *
 * Works with both the IAP EntitlementState and the server/hosted ServerEntitlement:
 * - If the token has an `expiresAt` timestamp, returns true if that time is past.
 * - Otherwise, falls back to the IAP model: expired if purchaseDate is set,
 *   more than one year has elapsed, and updateEntitled is not active.
 *
 * Returns false if the entitlement appears to be perpetual or not yet set.
 */
export function isEntitlementExpired(state: EntitlementExpirableShape): boolean {
  // Hosted model: server-issued token with an explicit expiry time
  if (state.expiresAt) {
    return Date.now() > Date.parse(state.expiresAt);
  }

  // IAP model: check Year 1 grace period
  const purchaseDate = state.purchaseDate;
  if (!purchaseDate) return false;
  if (state.updateEntitled) return false;
  return Date.now() - purchaseDate.getTime() >= ONE_YEAR_MS;
}

// ---------------------------------------------------------------------------
// Resolution -- compute EntitlementState from raw purchases
// ---------------------------------------------------------------------------

/**
 * Computes a full EntitlementState from a list of purchases.
 *
 * Bridge logic: if the purchase list includes a standalone module unlock
 * (e.g. `mylife_workouts_unlock`), that module is also unlocked in the hub.
 */
export function resolveEntitlements(
  purchases: Purchase[],
  nowMs: number = Date.now(),
): EntitlementState {
  let hubUnlocked = false;
  const unlockedModules = new Set<ModuleId>();
  let storageTier: StorageTier = 'free';
  let updateEntitled = false;
  // Store as numeric ms to avoid Date object allocation inside the loop.
  let earliestPurchaseDateMs: number | null = null;

  for (const purchase of purchases) {
    if (!purchase.isActive) continue;

    // Track earliest purchase date (for hub unlock or standalone unlocks).
    // Use Date.parse to get a number — avoids heap-allocating a Date per purchase.
    if (
      purchase.productId === 'mylife_hub_unlock' ||
      STANDALONE_UNLOCK_RE.test(purchase.productId)
    ) {
      const purchaseDateMs = Date.parse(purchase.purchaseDate);
      if (!earliestPurchaseDateMs || purchaseDateMs < earliestPurchaseDateMs) {
        earliestPurchaseDateMs = purchaseDateMs;
      }
    }

    // Hub unlock
    if (purchase.productId === 'mylife_hub_unlock') {
      hubUnlocked = true;
    }

    // Standalone module unlocks (bridge)
    const standaloneMatch = STANDALONE_UNLOCK_RE.exec(purchase.productId);
    if (standaloneMatch && standaloneMatch[1] !== 'hub') {
      unlockedModules.add(standaloneMatch[1] as ModuleId);
    }

    // Storage tiers (highest active tier wins)
    if (purchase.productId === 'mylife_storage_power') {
      storageTier = 'power';
    } else if (purchase.productId === 'mylife_storage_starter' && storageTier !== 'power') {
      storageTier = 'starter';
    }

    // Annual update fee
    if (purchase.productId === 'mylife_annual_update') {
      updateEntitled = true;
    }
  }

  // Year 1 update entitlement: if user purchased within last year, they get updates
  if (earliestPurchaseDateMs !== null && !updateEntitled) {
    if (nowMs - earliestPurchaseDateMs < ONE_YEAR_MS) {
      updateEntitled = true;
    }
  }

  return {
    hubUnlocked,
    unlockedModules,
    storageTier,
    updateEntitled,
    // Convert back to Date only once, at the end, for the return value.
    purchaseDate: earliestPurchaseDateMs !== null ? new Date(earliestPurchaseDateMs) : null,
  };
}
