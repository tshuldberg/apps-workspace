/**
 * Deep link and share link handling for MyLife content.
 *
 * Supports two URL schemes:
 * - Web: https://share.mylife.app/t/{infoHash}
 * - Native: mylife://t/{infoHash}
 *
 * Also supports magnet-style URIs:
 * - magnet:?xt=urn:mylife:{infoHash}&dn={title}&tr={tracker}
 */

export interface ParsedDeepLink {
  type: 'torrent' | 'unknown';
  infoHash: string | null;
  title: string | null;
  trackers: string[];
  /** The original URL or URI that was parsed. */
  source: string;
}

const WEB_HOST = 'share.mylife.app';
const NATIVE_SCHEME = 'mylife';
const TORRENT_PATH_PREFIX = '/t/';
const MAGNET_PREFIX = 'magnet:?';
const MYLIFE_URN_PREFIX = 'urn:mylife:';

/**
 * Parse a deep link URL into its components.
 *
 * Handles:
 * - https://share.mylife.app/t/{infoHash}
 * - mylife://t/{infoHash}
 * - magnet:?xt=urn:mylife:{infoHash}&dn={title}&tr={tracker}
 */
export function parseDeepLink(url: string): ParsedDeepLink {
  const result: ParsedDeepLink = {
    type: 'unknown',
    infoHash: null,
    title: null,
    trackers: [],
    source: url,
  };

  if (!url || typeof url !== 'string') return result;

  // Magnet URI
  if (url.startsWith(MAGNET_PREFIX)) {
    return parseMagnetUri(url);
  }

  // Web link: https://share.mylife.app/t/{infoHash}
  try {
    const parsed = new URL(url);
    if (parsed.hostname === WEB_HOST && parsed.pathname.startsWith(TORRENT_PATH_PREFIX)) {
      const infoHash = parsed.pathname.slice(TORRENT_PATH_PREFIX.length).split('/')[0];
      if (infoHash && infoHash.length > 0) {
        result.type = 'torrent';
        result.infoHash = infoHash;
        return result;
      }
    }
  } catch {
    // Not a valid URL; try native scheme
  }

  // Native deep link: mylife://t/{infoHash}
  if (url.startsWith(`${NATIVE_SCHEME}://`)) {
    const path = url.slice(`${NATIVE_SCHEME}://`.length);
    if (path.startsWith('t/')) {
      const infoHash = path.slice(2).split('/')[0].split('?')[0];
      if (infoHash && infoHash.length > 0) {
        result.type = 'torrent';
        result.infoHash = infoHash;
        return result;
      }
    }
  }

  return result;
}

/**
 * Parse a magnet URI into its components.
 */
export function parseMagnetUri(uri: string): ParsedDeepLink {
  const result: ParsedDeepLink = {
    type: 'unknown',
    infoHash: null,
    title: null,
    trackers: [],
    source: uri,
  };

  if (!uri.startsWith(MAGNET_PREFIX)) return result;

  const queryString = uri.slice(MAGNET_PREFIX.length);
  const params = new URLSearchParams(queryString);

  // Extract info hash from xt parameter
  const xt = params.get('xt');
  if (xt && xt.startsWith(MYLIFE_URN_PREFIX)) {
    result.type = 'torrent';
    result.infoHash = xt.slice(MYLIFE_URN_PREFIX.length);
  }

  // Extract display name
  const dn = params.get('dn');
  if (dn) result.title = dn;

  // Extract trackers (can have multiple)
  const trackers = params.getAll('tr');
  result.trackers = trackers;

  return result;
}

/**
 * Generate a web share link for a torrent.
 */
export function generateShareLink(infoHash: string): string {
  return `https://${WEB_HOST}${TORRENT_PATH_PREFIX}${infoHash}`;
}

/**
 * Generate a native deep link for a torrent.
 */
export function generateDeepLink(infoHash: string): string {
  return `${NATIVE_SCHEME}://${TORRENT_PATH_PREFIX.slice(1)}${infoHash}`;
}

/**
 * Generate a magnet URI from torrent metadata.
 */
export function generateMagnetUri(
  infoHash: string,
  title: string,
  trackers: string[] = [],
): string {
  const params = new URLSearchParams();
  params.set('xt', `${MYLIFE_URN_PREFIX}${infoHash}`);
  params.set('dn', title);
  for (const tracker of trackers) {
    params.append('tr', tracker);
  }
  return `${MAGNET_PREFIX}${params.toString()}`;
}

/**
 * Check if a URL is a MyLife torrent link (any supported format).
 */
export function isTorrentLink(url: string): boolean {
  const parsed = parseDeepLink(url);
  return parsed.type === 'torrent' && parsed.infoHash !== null;
}
