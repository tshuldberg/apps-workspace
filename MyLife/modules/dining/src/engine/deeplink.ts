/**
 * Deep-link URL builder for restaurant booking platforms.
 * Generates both app-scheme and web fallback URLs.
 */

export type DeeplinkPlatform = 'resy' | 'opentable' | 'tock' | 'yelp';

export interface DeeplinkOptions {
  restaurantId?: string;
  restaurantName?: string;
  date?: string;       // YYYY-MM-DD
  time?: string;       // HH:mm
  partySize?: number;
  lat?: number;
  lng?: number;
}

export interface DeeplinkResult {
  appUrl: string;
  webUrl: string;
}

/**
 * Build platform-specific deep-link URLs for a restaurant booking.
 */
export function buildDeeplink(
  platform: DeeplinkPlatform,
  opts: DeeplinkOptions,
): DeeplinkResult {
  switch (platform) {
    case 'resy':
      return buildResyLink(opts);
    case 'opentable':
      return buildOpenTableLink(opts);
    case 'tock':
      return buildTockLink(opts);
    case 'yelp':
      return buildYelpLink(opts);
  }
}

function buildResyLink(opts: DeeplinkOptions): DeeplinkResult {
  // Resy has no stable public app deep-link schema, so app URL falls back to web
  const params = new URLSearchParams();
  if (opts.date) params.set('date', opts.date);
  if (opts.partySize) params.set('seats', String(opts.partySize));

  const query = params.toString();
  const base = opts.restaurantId
    ? `https://resy.com/cities/ny/${opts.restaurantId}`
    : 'https://resy.com';
  const webUrl = query ? `${base}?${query}` : base;

  return { appUrl: webUrl, webUrl };
}

function buildOpenTableLink(opts: DeeplinkOptions): DeeplinkResult {
  const rid = opts.restaurantId ?? '';
  const appUrl = rid ? `opentable://restaurant/${rid}` : 'opentable://';

  const params = new URLSearchParams();
  if (rid) params.set('rid', rid);
  if (opts.date && opts.time) {
    params.set('datetime', `${opts.date}T${opts.time}`);
  }
  if (opts.partySize) params.set('covers', String(opts.partySize));

  const query = params.toString();
  const webUrl = query
    ? `https://www.opentable.com/restref/client/?${query}`
    : 'https://www.opentable.com';

  return { appUrl, webUrl };
}

function buildTockLink(opts: DeeplinkOptions): DeeplinkResult {
  // Tock has no app scheme
  const slug = opts.restaurantId ?? opts.restaurantName?.toLowerCase().replace(/\s+/g, '-') ?? '';
  const webUrl = slug
    ? `https://www.exploretock.com/${slug}`
    : 'https://www.exploretock.com';

  return { appUrl: webUrl, webUrl };
}

function buildYelpLink(opts: DeeplinkOptions): DeeplinkResult {
  const bizId = opts.restaurantId ?? '';
  const appUrl = bizId ? `yelp:///biz/${bizId}` : 'yelp://';
  const webUrl = bizId
    ? `https://www.yelp.com/biz/${bizId}`
    : 'https://www.yelp.com';

  return { appUrl, webUrl };
}

/**
 * Determine the best booking platform from a restaurant's stored URLs.
 * Priority: resy > opentable > tock > yelp.
 */
export function getBestBookingPlatform(restaurant: {
  resy_url: string | null;
  opentable_url: string | null;
  tock_url: string | null;
  yelp_url: string | null;
}): DeeplinkPlatform | null {
  if (restaurant.resy_url) return 'resy';
  if (restaurant.opentable_url) return 'opentable';
  if (restaurant.tock_url) return 'tock';
  if (restaurant.yelp_url) return 'yelp';
  return null;
}

/**
 * Build the best booking web URL for a restaurant using its stored platform URLs.
 * Returns null if no booking platform is available.
 */
export function buildBookingUrl(
  restaurant: {
    resy_url: string | null;
    opentable_url: string | null;
    tock_url: string | null;
    yelp_url: string | null;
  },
  opts?: DeeplinkOptions,
): string | null {
  const platform = getBestBookingPlatform(restaurant);
  if (!platform) return null;

  const { webUrl } = buildDeeplink(platform, opts ?? {});
  return webUrl;
}
