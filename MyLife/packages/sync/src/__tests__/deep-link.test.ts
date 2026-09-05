import { describe, it, expect } from 'vitest';
import {
  parseDeepLink,
  parseMagnetUri,
  generateShareLink,
  generateDeepLink,
  generateMagnetUri,
  isTorrentLink,
} from '../torrent/deep-link';

describe('deep-link', () => {
  const SAMPLE_HASH = 'abc123def456';

  describe('parseDeepLink()', () => {
    describe('web URLs', () => {
      it('parses a valid web share link', () => {
        const result = parseDeepLink(`https://share.mylife.app/t/${SAMPLE_HASH}`);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
        expect(result.source).toBe(`https://share.mylife.app/t/${SAMPLE_HASH}`);
      });

      it('parses a web share link with trailing slash', () => {
        const result = parseDeepLink(`https://share.mylife.app/t/${SAMPLE_HASH}/`);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
      });

      it('parses a web share link with query params', () => {
        const result = parseDeepLink(`https://share.mylife.app/t/${SAMPLE_HASH}?ref=share`);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
      });

      it('returns unknown for a different host', () => {
        const result = parseDeepLink(`https://other.example.com/t/${SAMPLE_HASH}`);
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });

      it('returns unknown for a non-torrent path on the correct host', () => {
        const result = parseDeepLink('https://share.mylife.app/about');
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });

      it('returns unknown when hash is empty after /t/', () => {
        const result = parseDeepLink('https://share.mylife.app/t/');
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });
    });

    describe('native URLs', () => {
      it('parses a valid native deep link', () => {
        const result = parseDeepLink(`mylife://t/${SAMPLE_HASH}`);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
        expect(result.source).toBe(`mylife://t/${SAMPLE_HASH}`);
      });

      it('parses a native deep link with trailing slash', () => {
        const result = parseDeepLink(`mylife://t/${SAMPLE_HASH}/`);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
      });

      it('parses a native deep link with query params', () => {
        const result = parseDeepLink(`mylife://t/${SAMPLE_HASH}?source=notification`);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
      });

      it('returns unknown for non-torrent native path', () => {
        const result = parseDeepLink('mylife://settings/sync');
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });

      it('returns unknown for empty hash in native link', () => {
        const result = parseDeepLink('mylife://t/');
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });
    });

    describe('magnet URIs', () => {
      it('parses a magnet URI with hash, title, and tracker', () => {
        const uri = `magnet:?xt=urn:mylife:${SAMPLE_HASH}&dn=My+Content&tr=wss://tracker.example.com`;
        const result = parseDeepLink(uri);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
        expect(result.title).toBe('My Content');
        expect(result.trackers).toEqual(['wss://tracker.example.com']);
        expect(result.source).toBe(uri);
      });

      it('parses a magnet URI without optional fields', () => {
        const uri = `magnet:?xt=urn:mylife:${SAMPLE_HASH}`;
        const result = parseDeepLink(uri);
        expect(result.type).toBe('torrent');
        expect(result.infoHash).toBe(SAMPLE_HASH);
        expect(result.title).toBeNull();
        expect(result.trackers).toEqual([]);
      });

      it('parses a magnet URI with multiple trackers', () => {
        const uri = `magnet:?xt=urn:mylife:${SAMPLE_HASH}&dn=Test&tr=wss://a.com&tr=wss://b.com&tr=wss://c.com`;
        const result = parseDeepLink(uri);
        expect(result.trackers).toHaveLength(3);
        expect(result.trackers).toEqual([
          'wss://a.com',
          'wss://b.com',
          'wss://c.com',
        ]);
      });
    });

    describe('invalid/unknown URLs', () => {
      it('returns unknown for empty string', () => {
        const result = parseDeepLink('');
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });

      it('returns unknown for random text', () => {
        const result = parseDeepLink('not a url at all');
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });

      it('returns unknown for a regular https URL', () => {
        const result = parseDeepLink('https://www.google.com');
        expect(result.type).toBe('unknown');
        expect(result.infoHash).toBeNull();
      });

      it('preserves the source string', () => {
        const url = 'https://unknown.example.com/path';
        const result = parseDeepLink(url);
        expect(result.source).toBe(url);
      });
    });
  });

  describe('parseMagnetUri()', () => {
    it('parses a valid magnet URI with all fields', () => {
      const uri = `magnet:?xt=urn:mylife:${SAMPLE_HASH}&dn=My+Title&tr=wss://tracker1.com`;
      const result = parseMagnetUri(uri);
      expect(result.type).toBe('torrent');
      expect(result.infoHash).toBe(SAMPLE_HASH);
      expect(result.title).toBe('My Title');
      expect(result.trackers).toEqual(['wss://tracker1.com']);
    });

    it('parses multiple trackers', () => {
      const uri = `magnet:?xt=urn:mylife:${SAMPLE_HASH}&tr=wss://a.com&tr=wss://b.com`;
      const result = parseMagnetUri(uri);
      expect(result.trackers).toEqual(['wss://a.com', 'wss://b.com']);
    });

    it('returns unknown for non-mylife urn prefix', () => {
      const uri = 'magnet:?xt=urn:btih:abc123';
      const result = parseMagnetUri(uri);
      expect(result.type).toBe('unknown');
      expect(result.infoHash).toBeNull();
    });

    it('returns unknown for non-magnet prefix', () => {
      const result = parseMagnetUri('https://example.com');
      expect(result.type).toBe('unknown');
    });

    it('handles missing xt param', () => {
      const uri = 'magnet:?dn=No+Hash&tr=wss://tracker.com';
      const result = parseMagnetUri(uri);
      expect(result.type).toBe('unknown');
      expect(result.infoHash).toBeNull();
      expect(result.title).toBe('No Hash');
      expect(result.trackers).toEqual(['wss://tracker.com']);
    });

    it('preserves source string', () => {
      const uri = `magnet:?xt=urn:mylife:${SAMPLE_HASH}`;
      const result = parseMagnetUri(uri);
      expect(result.source).toBe(uri);
    });
  });

  describe('generateShareLink()', () => {
    it('returns a correct web URL', () => {
      const link = generateShareLink(SAMPLE_HASH);
      expect(link).toBe(`https://share.mylife.app/t/${SAMPLE_HASH}`);
    });

    it('produces a link that parseDeepLink can round-trip', () => {
      const link = generateShareLink(SAMPLE_HASH);
      const parsed = parseDeepLink(link);
      expect(parsed.type).toBe('torrent');
      expect(parsed.infoHash).toBe(SAMPLE_HASH);
    });
  });

  describe('generateDeepLink()', () => {
    it('returns a correct native URL', () => {
      const link = generateDeepLink(SAMPLE_HASH);
      expect(link).toBe(`mylife://t/${SAMPLE_HASH}`);
    });

    it('produces a link that parseDeepLink can round-trip', () => {
      const link = generateDeepLink(SAMPLE_HASH);
      const parsed = parseDeepLink(link);
      expect(parsed.type).toBe('torrent');
      expect(parsed.infoHash).toBe(SAMPLE_HASH);
    });
  });

  describe('generateMagnetUri()', () => {
    it('creates a magnet URI with hash and title', () => {
      const uri = generateMagnetUri(SAMPLE_HASH, 'My Content');
      expect(uri).toContain('magnet:?');
      expect(uri).toContain(`urn%3Amylife%3A${SAMPLE_HASH}`);
      expect(uri).toContain('dn=My+Content');
    });

    it('includes trackers when provided', () => {
      const trackers = ['wss://tracker1.example.com', 'wss://tracker2.example.com'];
      const uri = generateMagnetUri(SAMPLE_HASH, 'Test', trackers);
      // URLSearchParams encodes colons and slashes
      expect(uri).toContain('tr=');
      const parsed = parseMagnetUri(uri);
      expect(parsed.trackers).toEqual(trackers);
    });

    it('produces empty trackers list when none provided', () => {
      const uri = generateMagnetUri(SAMPLE_HASH, 'Test');
      const parsed = parseMagnetUri(uri);
      expect(parsed.trackers).toEqual([]);
    });

    it('round-trips through parseMagnetUri', () => {
      const trackers = ['wss://relay.mylife.app'];
      const uri = generateMagnetUri(SAMPLE_HASH, 'Round Trip Title', trackers);
      const parsed = parseMagnetUri(uri);
      expect(parsed.type).toBe('torrent');
      expect(parsed.infoHash).toBe(SAMPLE_HASH);
      expect(parsed.title).toBe('Round Trip Title');
      expect(parsed.trackers).toEqual(trackers);
    });
  });

  describe('isTorrentLink()', () => {
    it('returns true for valid web share links', () => {
      expect(isTorrentLink(`https://share.mylife.app/t/${SAMPLE_HASH}`)).toBe(true);
    });

    it('returns true for valid native deep links', () => {
      expect(isTorrentLink(`mylife://t/${SAMPLE_HASH}`)).toBe(true);
    });

    it('returns true for valid magnet URIs', () => {
      expect(isTorrentLink(`magnet:?xt=urn:mylife:${SAMPLE_HASH}`)).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(isTorrentLink('')).toBe(false);
    });

    it('returns false for random URLs', () => {
      expect(isTorrentLink('https://www.google.com')).toBe(false);
    });

    it('returns false for non-mylife magnet URIs', () => {
      expect(isTorrentLink('magnet:?xt=urn:btih:abc123')).toBe(false);
    });

    it('returns false for non-torrent native paths', () => {
      expect(isTorrentLink('mylife://settings')).toBe(false);
    });

    it('returns false for web host without torrent path', () => {
      expect(isTorrentLink('https://share.mylife.app/about')).toBe(false);
    });
  });
});
