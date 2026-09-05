import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectPlatform,
  parseGoogleMapsUrl,
  extractMetaFromHtml,
  parseRestaurantUrl,
  isValidUrl,
  platformToUrlField,
} from '../engine/url-parser';

describe('detectPlatform', () => {
  it('detects Resy URLs', () => {
    expect(detectPlatform('https://resy.com/cities/ny/bestia')).toBe('resy');
    expect(detectPlatform('https://www.resy.com/cities/la/republique')).toBe('resy');
  });

  it('detects OpenTable URLs', () => {
    expect(detectPlatform('https://www.opentable.com/r/the-french-laundry')).toBe('opentable');
    expect(detectPlatform('https://opentable.com/r/noma-copenhagen')).toBe('opentable');
  });

  it('detects Tock URLs', () => {
    expect(detectPlatform('https://www.exploretock.com/alinea')).toBe('tock');
    expect(detectPlatform('https://exploretock.com/singletthread')).toBe('tock');
  });

  it('detects Yelp URLs', () => {
    expect(detectPlatform('https://www.yelp.com/biz/pizzeria-beddia-philadelphia')).toBe('yelp');
    expect(detectPlatform('https://yelp.com/biz/tartine-bakery-san-francisco')).toBe('yelp');
  });

  it('detects Google Maps URLs', () => {
    expect(
      detectPlatform('https://www.google.com/maps/place/Noma/@55.6833,12.6101,17z'),
    ).toBe('google_maps');
    expect(
      detectPlatform('https://maps.google.com/maps/place/Sukiyabashi+Jiro'),
    ).toBe('google_maps');
  });

  it('returns unknown for non-platform URLs', () => {
    expect(detectPlatform('https://example.com/restaurant')).toBe('unknown');
    expect(detectPlatform('https://grubhub.com/some-place')).toBe('unknown');
  });

  it('returns unknown for invalid URLs', () => {
    expect(detectPlatform('not-a-url')).toBe('unknown');
    expect(detectPlatform('')).toBe('unknown');
  });
});

describe('parseGoogleMapsUrl', () => {
  it('extracts name and coordinates from a standard Maps URL', () => {
    const result = parseGoogleMapsUrl(
      'https://www.google.com/maps/place/Noma/@55.6833,12.6101,17z',
    );
    expect(result.platform).toBe('google_maps');
    expect(result.name).toBe('Noma');
    expect(result.lat).toBeCloseTo(55.6833);
    expect(result.lng).toBeCloseTo(12.6101);
  });

  it('handles URL-encoded names with plus signs', () => {
    const result = parseGoogleMapsUrl(
      'https://www.google.com/maps/place/Sukiyabashi+Jiro/@35.6721,139.7636,17z',
    );
    expect(result.name).toBe('Sukiyabashi Jiro');
  });

  it('handles URL-encoded names with percent encoding', () => {
    const result = parseGoogleMapsUrl(
      'https://www.google.com/maps/place/El%20Celler%20de%20Can%20Roca/@41.9924,2.8126,17z',
    );
    expect(result.name).toBe('El Celler de Can Roca');
  });

  it('handles URLs without coordinates', () => {
    const result = parseGoogleMapsUrl(
      'https://www.google.com/maps/place/Noma',
    );
    expect(result.name).toBe('Noma');
    expect(result.lat).toBeUndefined();
    expect(result.lng).toBeUndefined();
  });

  it('handles negative coordinates', () => {
    const result = parseGoogleMapsUrl(
      'https://www.google.com/maps/place/Central/@-12.1521,-77.0221,17z',
    );
    expect(result.lat).toBeCloseTo(-12.1521);
    expect(result.lng).toBeCloseTo(-77.0221);
  });

  it('returns empty result for malformed URL', () => {
    const result = parseGoogleMapsUrl('not-a-url');
    expect(result.platform).toBe('google_maps');
    expect(result.name).toBeUndefined();
  });
});

describe('extractMetaFromHtml', () => {
  it('extracts og:title', () => {
    const html = '<html><head><meta property="og:title" content="Bestia" /></head></html>';
    const meta = extractMetaFromHtml(html);
    expect(meta.ogTitle).toBe('Bestia');
  });

  it('extracts og:description', () => {
    const html = '<meta property="og:description" content="Italian dining in DTLA" />';
    const meta = extractMetaFromHtml(html);
    expect(meta.ogDescription).toBe('Italian dining in DTLA');
  });

  it('extracts og:image', () => {
    const html = '<meta property="og:image" content="https://cdn.example.com/photo.jpg" />';
    const meta = extractMetaFromHtml(html);
    expect(meta.ogImage).toBe('https://cdn.example.com/photo.jpg');
  });

  it('handles reversed attribute order (content before property)', () => {
    const html = '<meta content="Republique" property="og:title" />';
    const meta = extractMetaFromHtml(html);
    expect(meta.ogTitle).toBe('Republique');
  });

  it('decodes HTML entities in OG tags', () => {
    const html = '<meta property="og:title" content="Bob&amp;Mary&#39;s Bistro" />';
    const meta = extractMetaFromHtml(html);
    expect(meta.ogTitle).toBe("Bob&Mary's Bistro");
  });

  it('extracts JSON-LD Restaurant data', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@type": "Restaurant",
        "name": "Alinea",
        "servesCuisine": "American, Progressive",
        "address": {
          "streetAddress": "1723 N Halsted St",
          "addressLocality": "Chicago"
        }
      }
      </script>
    `;
    const meta = extractMetaFromHtml(html);
    expect(meta.jsonLd).toBeDefined();
    expect(meta.jsonLd!.name).toBe('Alinea');
  });

  it('handles @graph array in JSON-LD', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@graph": [
          { "@type": "WebPage", "name": "Page" },
          { "@type": "Restaurant", "name": "Noma" }
        ]
      }
      </script>
    `;
    const meta = extractMetaFromHtml(html);
    expect(meta.jsonLd).toBeDefined();
    expect(meta.jsonLd!.name).toBe('Noma');
  });

  it('handles malformed JSON-LD gracefully', () => {
    const html = '<script type="application/ld+json">{ broken json }</script>';
    const meta = extractMetaFromHtml(html);
    expect(meta.jsonLd).toBeUndefined();
  });

  it('returns empty object for HTML with no meta tags', () => {
    const html = '<html><body>Hello</body></html>';
    const meta = extractMetaFromHtml(html);
    expect(meta.ogTitle).toBeUndefined();
    expect(meta.ogDescription).toBeUndefined();
    expect(meta.jsonLd).toBeUndefined();
  });
});

describe('isValidUrl', () => {
  it('accepts valid HTTP URLs', () => {
    expect(isValidUrl('https://resy.com/cities/ny/bestia')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('rejects non-HTTP URLs', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
    expect(isValidUrl('mailto:test@test.com')).toBe(false);
  });

  it('rejects non-URL strings', () => {
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isValidUrl('  https://resy.com  ')).toBe(true);
  });
});

describe('platformToUrlField', () => {
  it('maps platforms to the correct field', () => {
    expect(platformToUrlField('resy')).toBe('resy_url');
    expect(platformToUrlField('opentable')).toBe('opentable_url');
    expect(platformToUrlField('tock')).toBe('tock_url');
    expect(platformToUrlField('yelp')).toBe('yelp_url');
  });

  it('returns null for platforms without a dedicated field', () => {
    expect(platformToUrlField('google_maps')).toBeNull();
    expect(platformToUrlField('unknown')).toBeNull();
  });
});

describe('parseRestaurantUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns unknown platform for invalid URL', async () => {
    const result = await parseRestaurantUrl('not-a-url');
    expect(result.platform).toBe('unknown');
    expect(result.name).toBeUndefined();
  });

  it('parses Google Maps URL without network fetch', async () => {
    const result = await parseRestaurantUrl(
      'https://www.google.com/maps/place/Noma/@55.6833,12.6101,17z',
    );
    expect(result.platform).toBe('google_maps');
    expect(result.name).toBe('Noma');
    expect(result.lat).toBeCloseTo(55.6833);
  });

  it('extracts Resy restaurant from OG tags', async () => {
    const mockHtml = `
      <html><head>
        <meta property="og:title" content="Bestia - Resy" />
        <meta property="og:description" content="Italian restaurant in DTLA" />
        <meta property="og:image" content="https://cdn.resy.com/bestia.jpg" />
      </head></html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200 }),
    );

    const result = await parseRestaurantUrl('https://resy.com/cities/la/bestia');
    expect(result.platform).toBe('resy');
    expect(result.name).toBe('Bestia');
    expect(result.imageUrl).toBe('https://cdn.resy.com/bestia.jpg');
    expect(result.city).toBe('La');
  });

  it('extracts OpenTable restaurant from OG tags', async () => {
    const mockHtml = `
      <html><head>
        <meta property="og:title" content="The French Laundry - OpenTable" />
        <meta property="og:image" content="https://cdn.otstatic.com/french-laundry.jpg" />
      </head></html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200 }),
    );

    const result = await parseRestaurantUrl('https://www.opentable.com/r/the-french-laundry');
    expect(result.platform).toBe('opentable');
    expect(result.name).toBe('The French Laundry');
    expect(result.imageUrl).toBe('https://cdn.otstatic.com/french-laundry.jpg');
  });

  it('extracts Tock restaurant from OG tags', async () => {
    const mockHtml = `
      <html><head>
        <meta property="og:title" content="Alinea - Tock" />
      </head></html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200 }),
    );

    const result = await parseRestaurantUrl('https://www.exploretock.com/alinea');
    expect(result.platform).toBe('tock');
    expect(result.name).toBe('Alinea');
  });

  it('extracts Yelp restaurant from OG tags', async () => {
    const mockHtml = `
      <html><head>
        <meta property="og:title" content="Tartine Bakery - Yelp" />
        <meta property="og:image" content="https://s3-media.yelp.com/tartine.jpg" />
      </head></html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200 }),
    );

    const result = await parseRestaurantUrl('https://www.yelp.com/biz/tartine-bakery-san-francisco');
    expect(result.platform).toBe('yelp');
    expect(result.name).toBe('Tartine Bakery');
    expect(result.imageUrl).toBe('https://s3-media.yelp.com/tartine.jpg');
  });

  it('prefers JSON-LD over OG tags when both present', async () => {
    const mockHtml = `
      <html><head>
        <meta property="og:title" content="Wrong Name - Resy" />
        <meta property="og:image" content="https://og-image.jpg" />
        <script type="application/ld+json">
        {
          "@type": "Restaurant",
          "name": "Correct Name",
          "servesCuisine": "Italian, Seafood",
          "address": {
            "streetAddress": "123 Main St",
            "addressLocality": "San Francisco"
          }
        }
        </script>
      </head></html>
    `;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(mockHtml, { status: 200 }),
    );

    const result = await parseRestaurantUrl('https://resy.com/cities/sf/correct-name');
    expect(result.name).toBe('Correct Name');
    expect(result.city).toBe('San Francisco');
    expect(result.address).toBe('123 Main St');
    expect(result.cuisines).toEqual(['Italian', 'Seafood']);
    // Image still falls back to OG since JSON-LD had none
    expect(result.imageUrl).toBe('https://og-image.jpg');
  });

  it('handles network failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await parseRestaurantUrl('https://resy.com/cities/ny/bestia');
    expect(result.platform).toBe('resy');
    expect(result.platformUrl).toBe('https://resy.com/cities/ny/bestia');
    expect(result.name).toBeUndefined();
  });

  it('handles non-200 response gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Not Found', { status: 404 }),
    );

    const result = await parseRestaurantUrl('https://resy.com/cities/ny/nonexistent');
    expect(result.platform).toBe('resy');
    expect(result.name).toBeUndefined();
  });

  it('handles malformed URL gracefully', async () => {
    const result = await parseRestaurantUrl('');
    expect(result.platform).toBe('unknown');
  });
});
