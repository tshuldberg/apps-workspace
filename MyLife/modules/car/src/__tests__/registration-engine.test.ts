import { describe, it, expect } from 'vitest';
import {
  getRegExpirationStatus,
  getInspectionExpirationStatus,
  getDaysUntilExpiration,
} from '../engines/registration-engine';

// ---------------------------------------------------------------------------
// getRegExpirationStatus
// ---------------------------------------------------------------------------

describe('getRegExpirationStatus', () => {
  it('returns "valid" when expiration is more than 30 days away', () => {
    expect(getRegExpirationStatus('2026-12-31', '2026-01-01')).toBe('valid');
  });

  it('returns "expiring_soon" when expiration is within 30 days', () => {
    expect(getRegExpirationStatus('2026-01-20', '2026-01-01')).toBe('expiring_soon');
  });

  it('returns "expired" when expiration date has passed', () => {
    expect(getRegExpirationStatus('2025-12-31', '2026-01-01')).toBe('expired');
  });

  it('returns "unknown" when expiration date is null', () => {
    expect(getRegExpirationStatus(null, '2026-01-01')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// getInspectionExpirationStatus
// ---------------------------------------------------------------------------

describe('getInspectionExpirationStatus', () => {
  it('returns "valid" when inspection is far from expiring', () => {
    expect(getInspectionExpirationStatus('2026-12-31', '2026-01-01')).toBe('valid');
  });

  it('returns "expiring_soon" when inspection is within 30 days', () => {
    expect(getInspectionExpirationStatus('2026-01-25', '2026-01-01')).toBe('expiring_soon');
  });

  it('returns "expired" when inspection has expired', () => {
    expect(getInspectionExpirationStatus('2025-06-01', '2026-01-01')).toBe('expired');
  });

  it('returns "unknown" when inspection date is null', () => {
    expect(getInspectionExpirationStatus(null, '2026-01-01')).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// getDaysUntilExpiration
// ---------------------------------------------------------------------------

describe('getDaysUntilExpiration', () => {
  it('returns positive number for future expiration', () => {
    expect(getDaysUntilExpiration('2026-01-31', '2026-01-01')).toBe(30);
  });

  it('returns negative number for past expiration', () => {
    expect(getDaysUntilExpiration('2025-12-25', '2026-01-01')).toBe(-7);
  });

  it('returns 0 when expiration is today', () => {
    expect(getDaysUntilExpiration('2026-01-01', '2026-01-01')).toBe(0);
  });
});
