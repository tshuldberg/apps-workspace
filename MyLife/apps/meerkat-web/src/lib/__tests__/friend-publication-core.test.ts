import { describe, expect, it } from 'vitest';
import { friendPublicationStatus as web } from '../friend-publication-core';
import { friendPublicationStatus as mobile } from '../../../../meerkat/app/(root)/data/friend-publication-core';

describe.each([web, mobile])('friend publication deadline', (status) => {
  it('keeps legacy expiry unknown and never claims the code is unused', () => {
    expect(status(null, 100)).toMatchObject({ expired: false });
    expect(status(null, 100).text).toContain('did not provide an expiry time');
  });
  it('expires at the server deadline and explains one-use uncertainty before it', () => {
    expect(status(101, 100).text).toContain('may already have been used');
    expect(status(101, 101)).toMatchObject({ expired: true });
    expect(status(101, 101).text).toContain('Publish again');
  });
});
