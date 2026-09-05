export interface ActiveRevenueCatProduct {
  productId: string;
  purchaseDate: string;
}

export interface RevenueCatCustomerInfoLike {
  entitlements: {
    active: Record<
      string,
      {
        productIdentifier: string;
        originalPurchaseDate: string;
        latestPurchaseDate: string;
      }
    >;
  };
  nonSubscriptionTransactions?: Array<{
    productIdentifier: string;
    purchaseDate: string;
  }>;
}

/** Maps both active entitlements and durable one-time transactions. */
export function mapCustomerInfoToActiveProducts(
  info: RevenueCatCustomerInfoLike,
): ActiveRevenueCatProduct[] {
  const products = new Map<string, ActiveRevenueCatProduct>();
  for (const entitlement of Object.values(info.entitlements.active)) {
    products.set(entitlement.productIdentifier, {
      productId: entitlement.productIdentifier,
      purchaseDate: entitlement.originalPurchaseDate || entitlement.latestPurchaseDate,
    });
  }
  for (const transaction of info.nonSubscriptionTransactions ?? []) {
    const existing = products.get(transaction.productIdentifier);
    if (!existing || transaction.purchaseDate < existing.purchaseDate) {
      products.set(transaction.productIdentifier, {
        productId: transaction.productIdentifier,
        purchaseDate: transaction.purchaseDate,
      });
    }
  }
  return [...products.values()].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  );
}
