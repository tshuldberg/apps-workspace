import { describe, it, expect } from 'vitest';
import {
  buildDeeplink,
  getBestBookingPlatform,
  buildBookingUrl,
} from '../engine/deeplink';

describe('buildDeeplink', () => {
  it('resy -- returns web URL with params', () => {
    const result = buildDeeplink('resy', {
      restaurantId: 'bestia-la',
      date: '2026-04-20',
      partySize: 4,
    });

    expect(result.webUrl).toContain('resy.com');
    expect(result.webUrl).toContain('date=2026-04-20');
    expect(result.webUrl).toContain('seats=4');
    // Resy has no app scheme, so appUrl equals webUrl
    expect(result.appUrl).toBe(result.webUrl);
  });

  it('opentable -- returns app and web URLs', () => {
    const result = buildDeeplink('opentable', {
      restaurantId: '12345',
      date: '2026-04-20',
      time: '19:30',
      partySize: 2,
    });

    expect(result.appUrl).toBe('opentable://restaurant/12345');
    expect(result.webUrl).toContain('opentable.com');
    expect(result.webUrl).toContain('rid=12345');
    expect(result.webUrl).toContain('datetime=2026-04-20T19%3A30');
    expect(result.webUrl).toContain('covers=2');
  });

  it('tock -- returns web URL', () => {
    const result = buildDeeplink('tock', {
      restaurantId: 'alinea',
    });

    expect(result.webUrl).toBe('https://www.exploretock.com/alinea');
    // Tock has no app scheme
    expect(result.appUrl).toBe(result.webUrl);
  });

  it('yelp -- returns app and web URLs', () => {
    const result = buildDeeplink('yelp', {
      restaurantId: 'bestia-los-angeles',
    });

    expect(result.appUrl).toBe('yelp:///biz/bestia-los-angeles');
    expect(result.webUrl).toBe('https://www.yelp.com/biz/bestia-los-angeles');
  });
});

describe('getBestBookingPlatform', () => {
  it('returns resy when available', () => {
    const platform = getBestBookingPlatform({
      resy_url: 'https://resy.com/cities/ny/bestia',
      opentable_url: 'https://opentable.com/r/bestia',
      tock_url: null,
      yelp_url: null,
    });
    expect(platform).toBe('resy');
  });

  it('falls through to opentable when resy unavailable', () => {
    const platform = getBestBookingPlatform({
      resy_url: null,
      opentable_url: 'https://opentable.com/r/bestia',
      tock_url: 'https://exploretock.com/bestia',
      yelp_url: null,
    });
    expect(platform).toBe('opentable');
  });

  it('returns null when no URLs', () => {
    const platform = getBestBookingPlatform({
      resy_url: null,
      opentable_url: null,
      tock_url: null,
      yelp_url: null,
    });
    expect(platform).toBeNull();
  });
});

describe('buildBookingUrl', () => {
  it('returns best URL for restaurant', () => {
    const url = buildBookingUrl({
      resy_url: null,
      opentable_url: 'https://opentable.com/r/test',
      tock_url: null,
      yelp_url: 'https://yelp.com/biz/test',
    });

    expect(url).not.toBeNull();
    expect(url).toContain('opentable.com');
  });

  it('returns null when no platforms available', () => {
    const url = buildBookingUrl({
      resy_url: null,
      opentable_url: null,
      tock_url: null,
      yelp_url: null,
    });
    expect(url).toBeNull();
  });
});
