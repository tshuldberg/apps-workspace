import { describe, expect, it } from 'vitest';
import { mobilePathRequiresAppUnlock } from '../app-access-policy';

describe('app access policy function gate', () => {
  it('fails closed on an unclassified route', () => {
    expect(mobilePathRequiresAppUnlock('/new-private-feature')).toBe(true);
  });
});
