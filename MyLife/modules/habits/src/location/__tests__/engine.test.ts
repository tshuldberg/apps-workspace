import { describe, it, expect } from 'vitest';
import {
  shouldShowNotification,
  validateRadius,
  validateCoordinates,
  formatNotificationBody,
  isPlatformSupported,
} from '../engine';

describe('location engine', () => {
  describe('shouldShowNotification', () => {
    it('returns true when habit not completed today', () => {
      expect(shouldShowNotification(false)).toBe(true);
    });

    it('returns false when habit completed today', () => {
      expect(shouldShowNotification(true)).toBe(false);
    });
  });

  describe('validateRadius', () => {
    it('accepts 100m', () => {
      expect(validateRadius(100)).toBe(true);
    });

    it('rejects 49m (below min)', () => {
      expect(validateRadius(49)).toBe(false);
    });

    it('rejects 501m (above max)', () => {
      expect(validateRadius(501)).toBe(false);
    });

    it('accepts 50m boundary', () => {
      expect(validateRadius(50)).toBe(true);
    });

    it('accepts 500m boundary', () => {
      expect(validateRadius(500)).toBe(true);
    });

    it('rejects non-integer', () => {
      expect(validateRadius(100.5)).toBe(false);
    });
  });

  describe('validateCoordinates', () => {
    it('accepts valid coordinates', () => {
      expect(validateCoordinates(37.7749, -122.4194)).toBe(true);
    });

    it('rejects latitude > 90', () => {
      expect(validateCoordinates(91, 0)).toBe(false);
    });

    it('rejects longitude > 180', () => {
      expect(validateCoordinates(0, 181)).toBe(false);
    });

    it('rejects latitude < -90', () => {
      expect(validateCoordinates(-91, 0)).toBe(false);
    });
  });

  describe('formatNotificationBody', () => {
    it('formats notification correctly', () => {
      expect(formatNotificationBody('Workout')).toBe('Time for Workout!');
    });
  });

  describe('isPlatformSupported', () => {
    it('returns true for iOS', () => {
      expect(isPlatformSupported('ios')).toBe(true);
    });

    it('returns true for Android', () => {
      expect(isPlatformSupported('android')).toBe(true);
    });

    it('returns false for web', () => {
      expect(isPlatformSupported('web')).toBe(false);
    });
  });
});
