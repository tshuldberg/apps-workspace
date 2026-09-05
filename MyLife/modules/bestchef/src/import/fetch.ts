/**
 * URL fetch layer for recipe import.
 * Fetches raw HTML from URLs with timeout, size limits, and basic cleaning.
 */

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 5;

export type ImportErrorCode = 'network' | 'timeout' | 'blocked' | 'parse' | 'unsupported';

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code: ImportErrorCode,
    public readonly originalUrl: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export interface FetchResult {
  html: string;
  finalUrl: string;
  contentType: string;
}

function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split('.');
  if (parts.length !== 4) return null;
  const values = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) return NaN;
    return Number(part);
  });
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return values;
}

function isBlockedIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === undefined || b === undefined) return true;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isBlockedIPv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === '::1'
    || normalized === '::'
    || normalized.startsWith('fe80:')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:192.168.')
    || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function validateImportUrl(rawUrl: string, originalUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ImportError('Invalid URL', 'unsupported', originalUrl);
  }

  if (parsed.protocol !== 'https:') {
    throw new ImportError('Only HTTPS recipe import URLs are supported', 'blocked', originalUrl);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
  ) {
    throw new ImportError('Local network URLs are blocked for recipe import', 'blocked', originalUrl);
  }

  const ipv4 = parseIPv4(hostname);
  if ((ipv4 && isBlockedIPv4(ipv4)) || isBlockedIPv6(hostname)) {
    throw new ImportError('Private network URLs are blocked for recipe import', 'blocked', originalUrl);
  }

  parsed.username = '';
  parsed.password = '';
  return parsed;
}

async function fetchWithValidatedRedirects(
  initialUrl: URL,
  originalUrl: string,
  signal: AbortSignal,
): Promise<Response> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(currentUrl.toString(), {
      signal,
      headers: {
        'User-Agent': 'MyLife/1.0 (Recipe Import)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'manual',
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new ImportError('Redirect response did not include a Location header', 'network', originalUrl);
    }

    currentUrl = validateImportUrl(new URL(location, currentUrl).toString(), originalUrl);
  }

  throw new ImportError('Too many redirects', 'blocked', originalUrl);
}

/**
 * Fetch HTML from a URL with timeout and size limits.
 * Strips <script> and <style> tags from the response to reduce payload size.
 */
export async function fetchHtml(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const initialUrl = validateImportUrl(url, url);
    const response = await fetchWithValidatedRedirects(initialUrl, url, controller.signal);
    const finalUrl = validateImportUrl(response.url || initialUrl.toString(), url).toString();

    if (!response.ok) {
      throw new ImportError(
        `Server returned ${response.status}`,
        response.status === 403 || response.status === 429 ? 'blocked' : 'network',
        url,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new ImportError(
        `Unexpected content type: ${contentType}`,
        'unsupported',
        url,
      );
    }

    const raw = await response.text();
    if (raw.length > MAX_BODY_BYTES) {
      throw new ImportError(
        `Response too large (${Math.round(raw.length / 1024)}KB)`,
        'unsupported',
        url,
      );
    }

    const html = stripScriptsAndStyles(raw);
    return { html, finalUrl, contentType };
  } catch (error) {
    if (error instanceof ImportError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ImportError('Request timed out', 'timeout', url);
    }

    const message = error instanceof Error ? error.message : 'Network request failed';
    throw new ImportError(message, 'network', url);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Remove <script> and <style> tags to reduce HTML size,
 * but preserve <script type="application/ld+json"> blocks
 * which contain structured recipe data (JSON-LD).
 */
function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script(?![^>]*type\s*=\s*["']application\/ld\+json["'])[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}
