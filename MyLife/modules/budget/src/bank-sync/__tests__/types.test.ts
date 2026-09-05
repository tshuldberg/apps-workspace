import { describe, expect, it } from 'vitest';

import {
  BANK_SYNC_IMPLEMENTED_PROVIDERS,
  BANK_SYNC_PROVIDERS,
  isBankSyncProvider,
  isImplementedBankSyncProvider,
} from '../types';

describe('bank sync provider contracts', () => {
  it('includes plaid in all and implemented provider lists', () => {
    expect(BANK_SYNC_PROVIDERS).toContain('plaid');
    expect(BANK_SYNC_IMPLEMENTED_PROVIDERS).toContain('plaid');
  });

  it('recognizes known provider IDs', () => {
    expect(isBankSyncProvider('plaid')).toBe(true);
    expect(isBankSyncProvider('mx')).toBe(true);
    expect(isBankSyncProvider('not-a-provider')).toBe(false);
  });

  it('marks only implemented providers as enabled', () => {
    expect(isImplementedBankSyncProvider('plaid')).toBe(true);
    expect(isImplementedBankSyncProvider('mx')).toBe(false);
  });
});
