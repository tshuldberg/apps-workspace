import { describe, it, expect } from 'vitest';
import { deriveAccountStatus } from '../src/connect';

describe('deriveAccountStatus', () => {
  it('returns active when charges and payouts are enabled', () => {
    expect(deriveAccountStatus(true, true, true)).toBe('active');
  });

  it('returns restricted when details submitted but not fully enabled', () => {
    expect(deriveAccountStatus(false, false, true)).toBe('restricted');
  });

  it('returns onboarding when nothing submitted', () => {
    expect(deriveAccountStatus(false, false, false)).toBe('onboarding');
  });

  it('returns active even if detailsSubmitted is false but charges/payouts enabled', () => {
    expect(deriveAccountStatus(true, true, false)).toBe('active');
  });

  it('returns restricted when only charges enabled but details submitted', () => {
    expect(deriveAccountStatus(true, false, true)).toBe('restricted');
  });
});
