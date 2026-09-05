import Purchases, {
  LOG_LEVEL,
  PRODUCT_CATEGORY,
  type CustomerInfo,
  type CustomerInfoUpdateListener,
  type PurchasesStoreProduct,
} from 'react-native-purchases';
import type { RevenueCatSDK, Unsubscribe } from '@mylife/subscription';
import { mapCustomerInfoToActiveProducts } from './revenuecat-mapping';

export interface NativeRevenueCatAdapterOptions {
  logLevel?: LOG_LEVEL;
}

export function createNativeRevenueCatAdapter(
  options: NativeRevenueCatAdapterOptions = {},
): RevenueCatSDK {
  const logLevel = options.logLevel ?? LOG_LEVEL.WARN;

  return {
    configure(apiKey: string): void {
      Purchases.configure({ apiKey });
      void Purchases.setLogLevel(logLevel);
    },

    async purchaseProduct(productId: string): Promise<{
      productId: string;
      transactionDate: string;
    }> {
      const product = await getRevenueCatProduct(productId);
      const result = await Purchases.purchaseStoreProduct(product);
      return {
        productId: result.productIdentifier,
        transactionDate: result.transaction.purchaseDate,
      };
    },

    async restorePurchases(): Promise<Array<{
      productId: string;
      transactionDate: string;
    }>> {
      const info = await Purchases.restorePurchases();
      return mapCustomerInfoToActiveProducts(info).map((row) => ({
        productId: row.productId,
        transactionDate: row.purchaseDate,
      }));
    },

    async getCustomerInfo(): Promise<{
      activeProducts: Array<{ productId: string; purchaseDate: string }>;
    }> {
      const info = await Purchases.getCustomerInfo();
      return { activeProducts: mapCustomerInfoToActiveProducts(info) };
    },

    addPurchaseListener(callback): Unsubscribe {
      const listener: CustomerInfoUpdateListener = (info) => {
        callback({ activeProducts: mapCustomerInfoToActiveProducts(info) });
      };
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(listener);
      };
    },
  };
}

async function getRevenueCatProduct(productId: string): Promise<PurchasesStoreProduct> {
  const products = await Purchases.getProducts(
    [productId],
    PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
  const product = products.find((item) => item.identifier === productId);
  if (!product) {
    throw new Error(`RevenueCat product is not configured: ${productId}`);
  }
  return product;
}
