import { describe, expect, it } from 'vitest';
import { buildAppleMapsUrl, buildGoogleMapsUrl, buildMapsSearchUrl, isVirtualLocation, buildDirectionsUrl } from '../engines/location';

describe('location engine', () => {
  describe('buildAppleMapsUrl', () => {
    it('generates correct URL with lat/lng', () => {
      expect(buildAppleMapsUrl(37.7749, -122.4194)).toBe('maps://maps.apple.com/?daddr=37.7749,-122.4194');
    });
  });

  describe('buildGoogleMapsUrl', () => {
    it('generates correct URL with lat/lng', () => {
      expect(buildGoogleMapsUrl(37.7749, -122.4194)).toBe('https://www.google.com/maps/dir/?api=1&destination=37.7749,-122.4194');
    });
  });

  describe('buildMapsSearchUrl', () => {
    it('URL-encodes address correctly', () => {
      const url = buildMapsSearchUrl('123 Main St, San Francisco, CA');
      expect(url).toContain('query=123%20Main%20St%2C%20San%20Francisco%2C%20CA');
    });

    it('handles special characters in address', () => {
      const url = buildMapsSearchUrl("Bob's Place & Grill");
      expect(url).toContain('query=Bob');
      expect(url).toContain('%26'); // &
    });
  });

  describe('isVirtualLocation', () => {
    it('detects "zoom" as virtual', () => {
      expect(isVirtualLocation('Zoom Meeting')).toBe(true);
    });

    it('detects "virtual" as virtual', () => {
      expect(isVirtualLocation('Virtual Event')).toBe(true);
    });

    it('detects "online" as virtual', () => {
      expect(isVirtualLocation('Online Gathering')).toBe(true);
    });

    it('detects "video call" as virtual', () => {
      expect(isVirtualLocation('Video Call')).toBe(true);
    });

    it('detects "google meet" as virtual', () => {
      expect(isVirtualLocation('Google Meet link')).toBe(true);
    });

    it('returns false for normal addresses', () => {
      expect(isVirtualLocation('123 Main St')).toBe(false);
      expect(isVirtualLocation('The Restaurant')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isVirtualLocation(null)).toBe(false);
    });
  });

  describe('buildDirectionsUrl', () => {
    it('returns Apple Maps URL on iOS', () => {
      const url = buildDirectionsUrl('ios', 37.7749, -122.4194, null);
      expect(url).toContain('maps://');
    });

    it('returns Google Maps URL on Android', () => {
      const url = buildDirectionsUrl('android', 37.7749, -122.4194, null);
      expect(url).toContain('google.com/maps');
    });

    it('returns Google Maps URL on web', () => {
      const url = buildDirectionsUrl('web', 37.7749, -122.4194, null);
      expect(url).toContain('google.com/maps');
    });

    it('falls back to search URL when no coordinates', () => {
      const url = buildDirectionsUrl('web', null, null, '123 Main St');
      expect(url).toContain('query=');
    });

    it('returns null when no data', () => {
      expect(buildDirectionsUrl('web', null, null, null)).toBeNull();
    });
  });
});
