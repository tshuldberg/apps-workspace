import { describe, expect, it } from 'vitest';

import { sanitizeErrorCode } from '../errors';

describe('sanitizeErrorCode', () => {
  it('passes machine codes through, including composite codes', () => {
    expect(sanitizeErrorCode('reason_required')).toBe('reason_required');
    expect(sanitizeErrorCode('reversal_failed_appeal_still_open:rpc_failed')).toBe(
      'reversal_failed_appeal_still_open:rpc_failed',
    );
  });

  it('collapses free text, spaces, and markup to a generic code', () => {
    expect(sanitizeErrorCode('Your account was hacked! Call 555-0100 now')).toBe(
      'unexpected_error',
    );
    expect(sanitizeErrorCode('<b>alert</b>')).toBe('unexpected_error');
    expect(sanitizeErrorCode('a'.repeat(200))).toBe('unexpected_error');
  });

  it('returns null when absent', () => {
    expect(sanitizeErrorCode(null)).toBeNull();
    expect(sanitizeErrorCode(undefined)).toBeNull();
    expect(sanitizeErrorCode('')).toBeNull();
  });
});
