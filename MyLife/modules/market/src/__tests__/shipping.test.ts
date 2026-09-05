import { describe, expect, it } from 'vitest';
import {
  isValidTrackingNumber,
  buildTrackingUrl,
  normalizeCarrierStatus,
  calculateProcessingFee,
  CARRIER_NAMES,
} from '../shipping/tracking';

describe('isValidTrackingNumber', () => {
  it('validates USPS (20-22 digits)', () => {
    expect(isValidTrackingNumber('usps', '12345678901234567890')).toBe(true);
    expect(isValidTrackingNumber('usps', '1234567890123456789012')).toBe(true);
    expect(isValidTrackingNumber('usps', '12345')).toBe(false);
  });

  it('validates UPS (1Z + 16 alphanum)', () => {
    expect(isValidTrackingNumber('ups', '1Z999AA10123456784')).toBe(true);
    expect(isValidTrackingNumber('ups', 'NOTUPS')).toBe(false);
  });

  it('validates FedEx (12-22 digits)', () => {
    expect(isValidTrackingNumber('fedex', '123456789012')).toBe(true);
    expect(isValidTrackingNumber('fedex', '12345')).toBe(false);
  });

  it('validates DHL (10-11 digits)', () => {
    expect(isValidTrackingNumber('dhl', '1234567890')).toBe(true);
    expect(isValidTrackingNumber('dhl', '123')).toBe(false);
  });

  it('validates Amazon (TBA + 10-12 digits)', () => {
    expect(isValidTrackingNumber('amazon', 'TBA1234567890')).toBe(true);
    expect(isValidTrackingNumber('amazon', '12345')).toBe(false);
  });

  it('allows any 5-50 char string for other', () => {
    expect(isValidTrackingNumber('other', 'TRACK123')).toBe(true);
    expect(isValidTrackingNumber('other', '1234')).toBe(false);
  });
});

describe('buildTrackingUrl', () => {
  it('builds USPS URL', () => {
    const url = buildTrackingUrl('usps', '12345');
    expect(url).toContain('tools.usps.com');
    expect(url).toContain('12345');
  });

  it('builds UPS URL', () => {
    const url = buildTrackingUrl('ups', '1Z123');
    expect(url).toContain('ups.com');
  });

  it('returns null for Amazon', () => {
    expect(buildTrackingUrl('amazon', 'TBA123')).toBeNull();
  });

  it('returns null for other', () => {
    expect(buildTrackingUrl('other', 'TRACK123')).toBeNull();
  });
});

describe('normalizeCarrierStatus', () => {
  it('maps "Delivered" to delivered', () => {
    expect(normalizeCarrierStatus('Delivered')).toBe('delivered');
  });

  it('maps "Out for Delivery" to out_for_delivery', () => {
    expect(normalizeCarrierStatus('Out for Delivery')).toBe('out_for_delivery');
  });

  it('maps "In Transit" to in_transit', () => {
    expect(normalizeCarrierStatus('In Transit to destination')).toBe('in_transit');
  });

  it('maps "Exception" to exception', () => {
    expect(normalizeCarrierStatus('Delivery Exception')).toBe('exception');
  });

  it('maps "Returned" to returned', () => {
    expect(normalizeCarrierStatus('Returned to Sender')).toBe('returned');
  });

  it('maps "Label Created" to label_created', () => {
    expect(normalizeCarrierStatus('Label Created')).toBe('label_created');
  });

  it('defaults unknown status to in_transit', () => {
    expect(normalizeCarrierStatus('some unknown status')).toBe('in_transit');
  });
});

describe('calculateProcessingFee', () => {
  it('calculates 2.9% + $0.30 for $10.00', () => {
    // ceil(1000 * 0.029 + 30) = ceil(29 + 30) = 59
    expect(calculateProcessingFee(1000)).toBe(59);
  });

  it('calculates correctly for $100.00', () => {
    // ceil(10000 * 0.029 + 30) = ceil(290 + 30) = 320
    expect(calculateProcessingFee(10000)).toBe(320);
  });

  it('calculates correctly for $1.00', () => {
    // ceil(100 * 0.029 + 30) = ceil(2.9 + 30) = 33
    expect(calculateProcessingFee(100)).toBe(33);
  });
});

describe('CARRIER_NAMES', () => {
  it('has display names for all carriers', () => {
    expect(CARRIER_NAMES.usps).toBe('USPS');
    expect(CARRIER_NAMES.ups).toBe('UPS');
    expect(CARRIER_NAMES.fedex).toBe('FedEx');
    expect(CARRIER_NAMES.dhl).toBe('DHL');
    expect(CARRIER_NAMES.amazon).toBe('Amazon Logistics');
    expect(CARRIER_NAMES.other).toBe('Other');
  });
});
