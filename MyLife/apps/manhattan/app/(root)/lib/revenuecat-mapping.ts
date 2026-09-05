import type { CustomerInfo } from 'react-native-purchases';

export function mapCustomerInfoToActiveProducts(
  info: CustomerInfo,
): Array<{ productId: string; purchaseDate: string }> {
  const rows: Array<{ productId: string; purchaseDate: string }> = [];

  for (const entitlement of Object.values(info.entitlements.active)) {
    rows.push({
      productId: entitlement.productIdentifier,
      purchaseDate: entitlement.originalPurchaseDate || entitlement.latestPurchaseDate,
    });
  }

  return rows;
}
