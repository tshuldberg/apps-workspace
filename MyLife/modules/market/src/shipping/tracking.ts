/**
 * Shipping carrier tracking utilities.
 *
 * Validates tracking numbers per carrier format and provides
 * status normalization from carrier-specific statuses to the
 * standard ShipmentStatus enum.
 */

import type { ShippingCarrier, ShipmentStatus } from '../types';

/** Carrier-specific tracking number validation patterns. */
const TRACKING_PATTERNS: Record<ShippingCarrier, RegExp> = {
  usps: /^\d{20,22}$/,
  ups: /^1Z[A-Z0-9]{16}$/i,
  fedex: /^\d{12,22}$/,
  dhl: /^\d{10,11}$/,
  amazon: /^TBA\d{10,12}$/i,
  other: /^.{5,50}$/,
};

/** Validate a tracking number against the carrier format. */
export function isValidTrackingNumber(
  carrier: ShippingCarrier,
  trackingNumber: string,
): boolean {
  return TRACKING_PATTERNS[carrier].test(trackingNumber);
}

/** Carrier display names. */
export const CARRIER_NAMES: Record<ShippingCarrier, string> = {
  usps: 'USPS',
  ups: 'UPS',
  fedex: 'FedEx',
  dhl: 'DHL',
  amazon: 'Amazon Logistics',
  other: 'Other',
};

/** Carrier tracking URL templates. */
export const CARRIER_TRACKING_URLS: Record<ShippingCarrier, string | null> = {
  usps: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=',
  ups: 'https://www.ups.com/track?tracknum=',
  fedex: 'https://www.fedex.com/fedextrack/?trknbr=',
  dhl: 'https://www.dhl.com/en/express/tracking.html?AWB=',
  amazon: null,
  other: null,
};

/** Build a tracking URL for a carrier and tracking number. */
export function buildTrackingUrl(
  carrier: ShippingCarrier,
  trackingNumber: string,
): string | null {
  const baseUrl = CARRIER_TRACKING_URLS[carrier];
  if (!baseUrl) return null;
  return `${baseUrl}${encodeURIComponent(trackingNumber)}`;
}

/**
 * Normalize a carrier-specific status string to our standard enum.
 * Unknown statuses default to 'in_transit'.
 */
export function normalizeCarrierStatus(
  carrierStatus: string,
): ShipmentStatus {
  const lower = carrierStatus.toLowerCase();

  if (
    lower.includes('delivered') ||
    lower.includes('completed')
  ) {
    return 'delivered';
  }
  if (
    lower.includes('out for delivery') ||
    lower.includes('on vehicle')
  ) {
    return 'out_for_delivery';
  }
  if (
    lower.includes('exception') ||
    lower.includes('failed') ||
    lower.includes('undeliverable')
  ) {
    return 'exception';
  }
  if (
    lower.includes('return') ||
    lower.includes('returned')
  ) {
    return 'returned';
  }
  if (
    lower.includes('label') ||
    lower.includes('pre-shipment') ||
    lower.includes('created')
  ) {
    return 'label_created';
  }

  return 'in_transit';
}

/** Calculate processing fee in cents (Stripe rate: 2.9% + $0.30). */
export function calculateProcessingFee(amountCents: number): number {
  return Math.ceil(amountCents * 0.029 + 30);
}
