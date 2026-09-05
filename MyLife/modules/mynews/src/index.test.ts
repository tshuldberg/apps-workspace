import { describe, expect, it } from 'vitest';
import { MYNEWS_PACKAGE } from './index';

describe('package', () => {
  it('exports', () => {
    expect(MYNEWS_PACKAGE).toBe('@mylife/mynews');
  });
});
