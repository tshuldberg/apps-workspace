import { describe, it, expect } from 'vitest';
import { handleSiriCompletion, generateSiriResponse, isPlatformSupported } from '../engine';

describe('siri engine', () => {
  describe('handleSiriCompletion', () => {
    it('returns completed for valid habit not yet done', () => {
      expect(handleSiriCompletion(true, false)).toBe('completed');
    });

    it('returns already_done when completed today', () => {
      expect(handleSiriCompletion(true, true)).toBe('already_done');
    });

    it('returns not_found for deleted habit', () => {
      expect(handleSiriCompletion(false, false)).toBe('not_found');
    });
  });

  describe('generateSiriResponse', () => {
    it('generates completed message', () => {
      expect(generateSiriResponse('completed', 'Meditation')).toBe('Done. Meditation logged.');
    });

    it('generates already done message', () => {
      expect(generateSiriResponse('already_done', 'Meditation')).toBe('Already done for today.');
    });

    it('generates not found message', () => {
      expect(generateSiriResponse('not_found', 'Meditation')).toBe('This habit no longer exists.');
    });
  });

  describe('isPlatformSupported', () => {
    it('returns true for iOS 16+', () => {
      expect(isPlatformSupported('ios', 16)).toBe(true);
    });

    it('returns false for iOS < 16', () => {
      expect(isPlatformSupported('ios', 15)).toBe(false);
    });

    it('returns false for Android', () => {
      expect(isPlatformSupported('android')).toBe(false);
    });

    it('returns false for web', () => {
      expect(isPlatformSupported('web')).toBe(false);
    });
  });
});
