import { describe, expect, it } from 'vitest';
import { webActionRequiresAppUnlock } from '../app-access-policy';

describe('web access policy function gate', () => {
  it('blocks private navigation before a private view can mount', () => {
    expect(webActionRequiresAppUnlock({ type: 'OPEN_FEED' })).toBe(true);
  });
});
