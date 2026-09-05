import { FREE_MODULES, type ModuleId } from '@mylife/module-registry';
import type { Purchase, ProductId } from '@mylife/entitlements';
import { PRODUCTS } from '@mylife/billing-config';
import type { PurchaseResult, RevenueCatSDK, Unsubscribe } from './types';

// ---------------------------------------------------------------------------
// RevenueCat mobile IAP -- one-time (non-consumable) purchases
// ---------------------------------------------------------------------------

let sdk: RevenueCatSDK | null = null;
const FREE_MODULE_ID_SET = new Set<ModuleId>(FREE_MODULES);

/** Configure the RevenueCat SDK. Must be called once at app startup. */
export function initRevenueCat(revenueCatSdk: RevenueCatSDK, apiKey: string): void {
  sdk = revenueCatSdk;
  sdk.configure(apiKey);
}

function getSDK(): RevenueCatSDK {
  if (!sdk) throw new Error('RevenueCat not initialized. Call initRevenueCat() first.');
  return sdk;
}

function toPurchase(raw: { productId: string; transactionDate?: string; purchaseDate?: string }): Purchase {
  return {
    productId: raw.productId,
    purchaseDate: raw.transactionDate ?? raw.purchaseDate ?? new Date().toISOString(),
    isActive: true,
  };
}

// ---------------------------------------------------------------------------
// Purchase functions
// ---------------------------------------------------------------------------

/** Purchase the $19.99 hub unlock via App Store / Play Store. */
export async function purchaseHubUnlock(): Promise<PurchaseResult> {
  try {
    const result = await getSDK().purchaseProduct(PRODUCTS.hubUnlock.id);
    return { success: true, purchase: toPurchase(result) };
  } catch (err) {
    return { success: false, purchase: null, error: String(err) };
  }
}

/** Purchase a $4.99 standalone module unlock. */
export async function purchaseStandaloneModule(moduleId: ModuleId): Promise<PurchaseResult> {
  if (FREE_MODULE_ID_SET.has(moduleId)) {
    return {
      success: false,
      purchase: null,
      error: `${moduleId} is free and does not require purchase.`,
    };
  }
  const config = PRODUCTS.standaloneModules[moduleId as keyof typeof PRODUCTS.standaloneModules];
  if (!config) {
    return { success: false, purchase: null, error: `Unknown module: ${moduleId}` };
  }
  try {
    const result = await getSDK().purchaseProduct(config.id);
    return { success: true, purchase: toPurchase(result) };
  } catch (err) {
    return { success: false, purchase: null, error: String(err) };
  }
}

/** Purchase the $9.99/yr annual update entitlement. */
export async function purchaseAnnualUpdate(): Promise<PurchaseResult> {
  try {
    const result = await getSDK().purchaseProduct(PRODUCTS.annualUpdate.id);
    return { success: true, purchase: toPurchase(result) };
  } catch (err) {
    return { success: false, purchase: null, error: String(err) };
  }
}

/** Restore previous App Store / Play Store purchases. */
export async function restorePurchases(): Promise<Purchase[]> {
  const results = await getSDK().restorePurchases();
  return results.map(toPurchase);
}

/** Get all currently active purchases from RevenueCat. */
export async function getActivePurchases(): Promise<Purchase[]> {
  if (!sdk) return [];
  const info = await sdk.getCustomerInfo();
  return info.activeProducts.map((p) => ({
    productId: p.productId,
    purchaseDate: p.purchaseDate,
    isActive: true,
  }));
}

/** Check if a specific product has been purchased. */
export async function hasPurchased(productId: ProductId): Promise<boolean> {
  const purchases = await getActivePurchases();
  return purchases.some((p) => p.productId === productId);
}

// ---------------------------------------------------------------------------
// Customer info and entitlement queries
// ---------------------------------------------------------------------------

/** Customer info with active products and entitlement details. */
export interface CustomerInfo {
  activeProducts: Array<{ productId: string; purchaseDate: string }>;
  hubUnlocked: boolean;
  unlockedModuleIds: ModuleId[];
}

/** Get full customer info from RevenueCat including active products. */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  const info = await getSDK().getCustomerInfo();
  let hubUnlocked = false;
  const unlockedModuleIds: ModuleId[] = [];

  for (const p of info.activeProducts) {
    if (p.productId === 'mylife_hub_unlock') {
      hubUnlocked = true;
    }
    const match = p.productId.match(/^mylife_(.+)_unlock$/);
    if (match && match[1] !== 'hub') {
      unlockedModuleIds.push(match[1] as ModuleId);
    }
  }

  return {
    activeProducts: info.activeProducts,
    hubUnlocked,
    unlockedModuleIds,
  };
}

/**
 * Check if a specific module is entitled via RevenueCat.
 * Returns true if the module is free, the hub is unlocked, or
 * the standalone module has been purchased.
 */
export async function checkEntitlement(moduleId: ModuleId): Promise<boolean> {
  if (FREE_MODULE_ID_SET.has(moduleId)) return true;
  const info = await getCustomerInfo();
  if (info.hubUnlocked) return true;
  return info.unlockedModuleIds.includes(moduleId);
}

/** Listen for purchase state changes from RevenueCat. */
export function onPurchaseUpdated(callback: (purchases: Purchase[]) => void): Unsubscribe {
  if (!sdk) return () => {};
  return sdk.addPurchaseListener((info) => {
    const purchases: Purchase[] = info.activeProducts.map((p) => ({
      productId: p.productId,
      purchaseDate: p.purchaseDate,
      isActive: true,
    }));
    callback(purchases);
  });
}
