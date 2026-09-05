import type { RevenueCatSDK, Unsubscribe } from '@mylife/subscription';
import {
  mapCustomerInfoToActiveProducts,
  type RevenueCatCustomerInfoLike,
} from './revenuecat-mapping';

interface StoreProductLike {
  identifier: string;
}

interface PurchasesLike {
  configure(input: { apiKey: string }): void;
  setLogLevel(level: unknown): Promise<void> | void;
  getProducts(productIds: string[], category: unknown): Promise<StoreProductLike[]>;
  purchaseStoreProduct(product: StoreProductLike): Promise<{
    productIdentifier: string;
    transaction: { purchaseDate: string };
  }>;
  restorePurchases(): Promise<RevenueCatCustomerInfoLike>;
  getCustomerInfo(): Promise<RevenueCatCustomerInfoLike>;
  addCustomerInfoUpdateListener(listener: (info: RevenueCatCustomerInfoLike) => void): void;
  removeCustomerInfoUpdateListener(listener: (info: RevenueCatCustomerInfoLike) => void): void;
}

interface RevenueCatModuleLike {
  default: PurchasesLike;
  LOG_LEVEL: { WARN: unknown };
  PRODUCT_CATEGORY: { NON_SUBSCRIPTION: unknown };
}

// The package is declared in apps/mynews/package.json. Structural typing keeps
// pre-install EAS checks and the node-only Vitest graph independent of native
// package declarations while Metro still resolves the real SDK at runtime.
const revenueCatModule = require('react-native-purchases') as RevenueCatModuleLike;
const Purchases = revenueCatModule.default;

export function createMyNewsRevenueCatAdapter(): RevenueCatSDK {
  return {
    configure(apiKey: string) {
      Purchases.configure({ apiKey });
      void Purchases.setLogLevel(revenueCatModule.LOG_LEVEL.WARN);
    },
    async purchaseProduct(productId) {
      const products = await Purchases.getProducts(
        [productId],
        revenueCatModule.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
      );
      const product = products.find((candidate) => candidate.identifier === productId);
      if (!product) throw new Error(`RevenueCat product is not configured: ${productId}`);
      const result = await Purchases.purchaseStoreProduct(product);
      return {
        productId: result.productIdentifier,
        transactionDate: result.transaction.purchaseDate,
      };
    },
    async restorePurchases() {
      const info = await Purchases.restorePurchases();
      return mapCustomerInfoToActiveProducts(info).map((product) => ({
        productId: product.productId,
        transactionDate: product.purchaseDate,
      }));
    },
    async getCustomerInfo() {
      const info = await Purchases.getCustomerInfo();
      return { activeProducts: mapCustomerInfoToActiveProducts(info) };
    },
    addPurchaseListener(callback): Unsubscribe {
      const listener = (info: RevenueCatCustomerInfoLike) => {
        callback({ activeProducts: mapCustomerInfoToActiveProducts(info) });
      };
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => Purchases.removeCustomerInfoUpdateListener(listener);
    },
  };
}
