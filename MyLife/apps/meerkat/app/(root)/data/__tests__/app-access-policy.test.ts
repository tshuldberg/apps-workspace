import { describe, expect, it } from 'vitest';
import { mobilePathRequiresAppUnlock } from '../app-access-policy';

describe('mobilePathRequiresAppUnlock', () => {
  it.each([
    '/upgrade',
    '/discover',
    '/public',
    '/public/topic/friends',
    '/public/post/abc',
    '/about-status',
    '/appearance',
    '/identity',
    '/persona/create',
    '/persona/settings',
  ])('keeps the deliberate free surface reachable: %s', (pathname) => {
    expect(mobilePathRequiresAppUnlock(pathname)).toBe(false);
  });

  it.each([
    '/',
    '/communities',
    '/community/secret',
    '/community/join',
    '/channel/c1/general',
    '/dm/d1',
    '/messages',
    '/files/c1',
    '/downloads',
    '/library',
    '/sync',
    '/share-inbox',
    '/settings',
    '/unknown-future-private-route',
  ])('fails closed for private or unclassified deep links: %s', (pathname) => {
    expect(mobilePathRequiresAppUnlock(pathname)).toBe(true);
  });
});
