/**
 * On-device URL parser for restaurant booking platform links.
 * Extracts restaurant metadata from OG tags, JSON-LD, and URL structure.
 *
 * Supported platforms (V1):
 * - Resy (resy.com/cities/{city}/{slug})
 * - OpenTable (opentable.com/r/{slug})
 * - Tock (exploretock.com/{slug})
 * - Yelp (yelp.com/biz/{slug})
 * - Google Maps (google.com/maps/place/{name}/@{lat},{lng})
 */

export type Platform =
  | 'resy'
  | 'opentable'
  | 'tock'
  | 'yelp'
  | 'google_maps'
  | 'unknown';

export interface ParsedRestaurant {
  name?: string;
  address?: string;
  city?: string;
  cuisines?: string[];
  website?: string;
  imageUrl?: string;
  lat?: number;
  lng?: number;
  platform: Platform;
  platformUrl?: string;
}

/**
 * Detect which booking platform a URL belongs to from its hostname.
 */
export function detectPlatform(url: string): Platform {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'unknown';
  }

  if (hostname.includes('resy.com')) return 'resy';
  if (hostname.includes('opentable.com')) return 'opentable';
  if (hostname.includes('exploretock.com')) return 'tock';
  if (hostname.includes('yelp.com')) return 'yelp';
  if (hostname.includes('google.com') || hostname.includes('goo.gl') || hostname.includes('maps.google.com')) {
    try {
      const path = new URL(url).pathname;
      if (path.includes('/maps/') || path.includes('/place/')) return 'google_maps';
    } catch {
      // fall through
    }
  }

  return 'unknown';
}

/**
 * Extract OG meta tags and JSON-LD structured data from raw HTML.
 */
export function extractMetaFromHtml(html: string): {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  jsonLd?: Record<string, unknown>;
} {
  const result: ReturnType<typeof extractMetaFromHtml> = {};

  // OG tags
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogTitleMatch) result.ogTitle = decodeHtmlEntities(ogTitleMatch[1]);

  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogDescMatch) result.ogDescription = decodeHtmlEntities(ogDescMatch[1]);

  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImageMatch) result.ogImage = ogImageMatch[1];

  const ogUrlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
  if (ogUrlMatch) result.ogUrl = ogUrlMatch[1];

  // JSON-LD
  const jsonLdMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]);
      // Handle @graph arrays
      if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        const restaurant = parsed['@graph'].find(
          (item: Record<string, unknown>) =>
            item['@type'] === 'Restaurant' || item['@type'] === 'FoodEstablishment' || item['@type'] === 'LocalBusiness',
        );
        if (restaurant) result.jsonLd = restaurant as Record<string, unknown>;
      } else if (Array.isArray(parsed)) {
        const restaurant = parsed.find(
          (item: Record<string, unknown>) =>
            item['@type'] === 'Restaurant' || item['@type'] === 'FoodEstablishment' || item['@type'] === 'LocalBusiness',
        );
        if (restaurant) result.jsonLd = restaurant as Record<string, unknown>;
      } else {
        result.jsonLd = parsed as Record<string, unknown>;
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  return result;
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');
}

/**
 * Parse Google Maps URL to extract name and coordinates directly from the URL path.
 * Format: google.com/maps/place/{encoded_name}/@{lat},{lng},{zoom}
 */
export function parseGoogleMapsUrl(url: string): ParsedRestaurant {
  const result: ParsedRestaurant = { platform: 'google_maps', platformUrl: url };

  try {
    const parsed = new URL(url);
    const path = decodeURIComponent(parsed.pathname);

    // Extract name from /maps/place/{name}/
    const placeMatch = path.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch) {
      result.name = placeMatch[1].replace(/\+/g, ' ');
    }

    // Extract coordinates from /@{lat},{lng}
    const coordMatch = path.match(/@(-?[\d.]+),(-?[\d.]+)/);
    if (coordMatch) {
      result.lat = parseFloat(coordMatch[1]);
      result.lng = parseFloat(coordMatch[2]);
    }
  } catch {
    // URL parsing failed, return empty result
  }

  return result;
}

/**
 * Build ParsedRestaurant from OG/JSON-LD metadata for web-based platforms.
 */
function buildFromMeta(
  platform: Platform,
  url: string,
  meta: ReturnType<typeof extractMetaFromHtml>,
): ParsedRestaurant {
  const result: ParsedRestaurant = { platform, platformUrl: url };

  // Prefer JSON-LD structured data
  if (meta.jsonLd) {
    const ld = meta.jsonLd;
    if (typeof ld.name === 'string') result.name = ld.name;
    if (typeof ld.url === 'string') result.website = ld.url;
    if (typeof ld.image === 'string') result.imageUrl = ld.image;
    if (ld.address && typeof ld.address === 'object') {
      const addr = ld.address as Record<string, unknown>;
      if (typeof addr.streetAddress === 'string') result.address = addr.streetAddress;
      if (typeof addr.addressLocality === 'string') result.city = addr.addressLocality;
    }
    if (typeof ld.servesCuisine === 'string') {
      result.cuisines = ld.servesCuisine.split(',').map((c: string) => c.trim()).filter(Boolean);
    } else if (Array.isArray(ld.servesCuisine)) {
      result.cuisines = ld.servesCuisine.filter((c: unknown): c is string => typeof c === 'string');
    }
    if (ld.geo && typeof ld.geo === 'object') {
      const geo = ld.geo as Record<string, unknown>;
      if (typeof geo.latitude === 'number') result.lat = geo.latitude;
      if (typeof geo.longitude === 'number') result.lng = geo.longitude;
      if (typeof geo.latitude === 'string') result.lat = parseFloat(geo.latitude);
      if (typeof geo.longitude === 'string') result.lng = parseFloat(geo.longitude);
    }
  }

  // Fall back to OG tags for missing fields
  if (!result.name && meta.ogTitle) {
    result.name = cleanPlatformTitle(meta.ogTitle, platform);
  }
  if (!result.imageUrl && meta.ogImage) {
    result.imageUrl = meta.ogImage;
  }
  if (!result.website && meta.ogUrl) {
    result.website = meta.ogUrl;
  }

  // Platform-specific city extraction from URL
  if (!result.city) {
    result.city = extractCityFromUrl(url, platform);
  }

  return result;
}

/**
 * Clean platform-specific suffixes from OG title strings.
 * e.g., "Bestia - Resy" -> "Bestia"
 */
function cleanPlatformTitle(title: string, platform: Platform): string {
  const suffixes: Record<string, RegExp> = {
    resy: /\s*[-|]\s*Resy$/i,
    opentable: /\s*[-|]\s*OpenTable$/i,
    tock: /\s*[-|]\s*(?:Explore\s*)?Tock$/i,
    yelp: /\s*[-|]\s*Yelp$/i,
  };
  const pattern = suffixes[platform];
  return pattern ? title.replace(pattern, '').trim() : title.trim();
}

/**
 * Extract city from platform URL path when possible.
 */
function extractCityFromUrl(url: string, platform: Platform): string | undefined {
  try {
    const path = new URL(url).pathname;
    if (platform === 'resy') {
      // resy.com/cities/{city}/{slug}
      const match = path.match(/\/cities\/([^/]+)/);
      if (match) {
        return match[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
  } catch {
    // URL parsing failed
  }
  return undefined;
}

/**
 * Determine if a string looks like a valid HTTP(S) URL.
 */
export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse a restaurant URL and extract metadata.
 *
 * For Google Maps: parses the URL path directly (no network request needed).
 * For web platforms: fetches the page and extracts OG tags + JSON-LD.
 *
 * Never throws. Returns partial results on failure.
 */
export async function parseRestaurantUrl(url: string): Promise<ParsedRestaurant> {
  const trimmed = url.trim();
  const platform = detectPlatform(trimmed);

  if (platform === 'unknown') {
    return { platform: 'unknown' };
  }

  // Google Maps: parse URL path directly, no fetch needed
  if (platform === 'google_maps') {
    return parseGoogleMapsUrl(trimmed);
  }

  // Web platforms: fetch page and extract metadata
  try {
    const response = await fetch(trimmed, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MyLife/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { platform, platformUrl: trimmed };
    }

    const html = await response.text();
    const meta = extractMetaFromHtml(html);
    return buildFromMeta(platform, trimmed, meta);
  } catch {
    // Network failure: return platform identification with no metadata
    return { platform, platformUrl: trimmed };
  }
}

/**
 * Map a platform to its corresponding restaurant URL field name.
 */
export function platformToUrlField(platform: Platform): string | null {
  const map: Record<Platform, string | null> = {
    resy: 'resy_url',
    opentable: 'opentable_url',
    tock: 'tock_url',
    yelp: 'yelp_url',
    google_maps: null,
    unknown: null,
  };
  return map[platform];
}
