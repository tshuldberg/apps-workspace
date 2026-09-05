import { describe, it, expect } from 'vitest';
import { detectPlatform } from '../import/social-media';
import { detectClipboardRecipeUrl } from '../import/clipboard';
import { fetchHtml, ImportError } from '../import/fetch';

describe('import utilities', () => {
  describe('detectPlatform', () => {
    it('detects Instagram reel URLs', () => {
      expect(detectPlatform('https://www.instagram.com/reel/ABC123/')).toBe('instagram');
    });

    it('detects Instagram post URLs', () => {
      expect(detectPlatform('https://instagram.com/p/XYZ789/')).toBe('instagram');
    });

    it('detects Instagram TV URLs', () => {
      expect(detectPlatform('https://www.instagram.com/tv/DEF456/')).toBe('instagram');
    });

    it('detects TikTok video URLs', () => {
      expect(detectPlatform('https://www.tiktok.com/@user/video/1234567890')).toBe('tiktok');
    });

    it('detects TikTok short URLs', () => {
      expect(detectPlatform('https://www.tiktok.com/v/1234567890')).toBe('tiktok');
    });

    it('detects YouTube watch URLs', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
    });

    it('detects YouTube short URLs', () => {
      expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube');
    });

    it('detects YouTube Shorts URLs', () => {
      expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube');
    });

    it('returns null for regular URLs', () => {
      expect(detectPlatform('https://www.example.com/recipe/pasta')).toBeNull();
    });

    it('returns null for non-URL strings', () => {
      expect(detectPlatform('just some text')).toBeNull();
    });
  });

  describe('detectClipboardRecipeUrl', () => {
    it('detects a regular URL', () => {
      const result = detectClipboardRecipeUrl('https://www.allrecipes.com/recipe/12345');
      expect(result).not.toBeNull();
      expect(result!.url).toBe('https://www.allrecipes.com/recipe/12345');
      expect(result!.platform).toBeNull();
    });

    it('detects an Instagram URL with platform', () => {
      const result = detectClipboardRecipeUrl('https://www.instagram.com/reel/ABC123/');
      expect(result).not.toBeNull();
      expect(result!.platform).toBe('instagram');
    });

    it('detects a TikTok URL with platform', () => {
      const result = detectClipboardRecipeUrl('https://www.tiktok.com/@chef/video/123');
      expect(result).not.toBeNull();
      expect(result!.platform).toBe('tiktok');
    });

    it('returns null for null input', () => {
      expect(detectClipboardRecipeUrl(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectClipboardRecipeUrl('')).toBeNull();
    });

    it('returns null for non-URL text', () => {
      expect(detectClipboardRecipeUrl('just some recipe text')).toBeNull();
    });

    it('returns null for multi-line text with URL buried', () => {
      expect(detectClipboardRecipeUrl('Hello\nhttps://example.com\nMore text')).toBeNull();
    });
  });

  describe('ImportError', () => {
    it('creates error with message, code, and URL', () => {
      const err = new ImportError('Failed to connect', 'network', 'https://example.com');
      expect(err.code).toBe('network');
      expect(err.message).toBe('Failed to connect');
      expect(err.originalUrl).toBe('https://example.com');
      expect(err.name).toBe('ImportError');
      expect(err instanceof Error).toBe(true);
    });

    it('supports all error codes', () => {
      const codes = ['network', 'timeout', 'blocked', 'parse', 'unsupported'] as const;
      for (const code of codes) {
        const err = new ImportError(`test ${code}`, code, 'https://example.com');
        expect(err.code).toBe(code);
      }
    });
  });

  describe('fetchHtml URL guard', () => {
    it('blocks non-HTTPS URLs before fetching', async () => {
      await expect(fetchHtml('http://example.com/recipe')).rejects.toMatchObject({
        code: 'blocked',
      });
    });

    it('blocks localhost and private-network URLs before fetching', async () => {
      await expect(fetchHtml('https://localhost/recipe')).rejects.toMatchObject({
        code: 'blocked',
      });
      await expect(fetchHtml('https://192.168.1.10/recipe')).rejects.toMatchObject({
        code: 'blocked',
      });
    });
  });
});
