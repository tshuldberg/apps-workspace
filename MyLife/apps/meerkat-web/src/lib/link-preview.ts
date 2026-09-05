// Plan 32 T3.1: sender-generated, receiver-passive link previews (Signal model).
//
// This module is PURE and network-agnostic. The only fetch that ever happens is
// on the SENDER's device, inside buildLinkPreview, and only through the fetchImpl
// injected by the caller (gated by the mk_settings link_previews_enabled toggle).
// The receiver NEVER calls anything in here that touches the network: it only
// runs parseLinkPreviewAttachment on bytes that already arrived through the
// verified attachment/blob pipeline, and renders from the preview's own bytes.
//
// The preview is encoded as a typed attachment (mimeType
// application/x-meerkat-link-preview+json, name 'link-preview') that rides the
// existing attachment + blob pipeline: size caps, hash verify, and replication
// are all inherited. A malformed or oversized preview parses to null and the UI
// degrades to a plain file chip; nothing here throws, fetches on receive, or
// trusts a remote URL on the receiver.
//
// This file is a BYTE-IDENTICAL twin with apps/meerkat/app/(root)/data/link-preview.ts
// (locked by scripts/check-meerkat-parity.mjs). Keep both edits in lockstep.

import { encodeBase64 } from 'tweetnacl-util';

/** Typed attachment mimeType that flags a blob as a link-preview JSON payload. */
export const LINK_PREVIEW_MIME_TYPE = 'application/x-meerkat-link-preview+json';
/** Stable attachment name for a link-preview payload. */
export const LINK_PREVIEW_NAME = 'link-preview';
/** Hard cap on the encoded preview JSON (decision 7). */
export const LINK_PREVIEW_JSON_CAP_BYTES = 64 * 1024;
/** Max edge of the downscaled og:image, in px (decision 7). */
export const LINK_PREVIEW_IMAGE_MAX_DIMENSION = 320;
/** Max bytes read from the page body before parsing stops (decision 7). */
export const LINK_PREVIEW_READ_CAP_BYTES = 512 * 1024;
/** Fetch timeout for the sender-side page load, in ms (decision 7). */
export const LINK_PREVIEW_FETCH_TIMEOUT_MS = 8000;

/** A sender-built preview. imageBase64, when present, is a downscaled JPEG. */
export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  imageBase64?: string;
}

/** Parsed Open Graph fields before any image is fetched/downscaled. */
export interface OgPreview {
  title: string;
  description?: string;
  imageUrl?: string;
}

/** Longest URL we will treat as previewable (defensive; keeps regex bounded). */
const MAX_URL_LENGTH = 2048;
/** Max redirect hops the sender follows manually before giving up. */
const MAX_REDIRECT_HOPS = 5;
const URL_PATTERN = /https?:\/\/[^\s<>"'`)}\]]+/i;
/** Trailing characters commonly glued to a URL by surrounding prose. */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}>'"]+$/;

// --- SSRF / LAN-leak guard ---
//
// The sender fetch is a request-forgery surface: a paste of http://127.0.0.1:.../
// or http://169.254.169.254/ (the cloud metadata endpoint) would make THIS device
// fetch an internal page whose og-data then encodes into an attachment and
// REPLICATES to the community. So before any fetch we refuse loopback, private,
// link-local, and ULA hosts. http AND https stay allowed for PUBLIC hosts (the
// LAN/metadata block is the fix, not https-only, which would drop legit http
// sites). A hostname that is not an IP literal (a real domain) is allowed here;
// we cannot resolve DNS in this pure layer, so DNS-rebinding to an internal IP is
// out of scope for the client and belongs to a network-egress policy.

function ipv4Blocked(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const parts = m.slice(1).map((n) => Number(n));
  if (parts.some((n) => n > 255)) return true; // malformed octet: refuse
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240/4 reserved
  return false;
}

function ipv6Blocked(raw: string): boolean {
  // Strip a bracketed [..] literal; lower-case for prefix checks.
  const host = raw.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!host.includes(':')) return false; // not an IPv6 literal
  if (host === '::1' || host === '::') return true; // loopback / unspecified
  // IPv4-mapped / -embedded forms in dotted-quad tail (e.g. ::ffff:127.0.0.1).
  const embedded = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(host);
  if (embedded && ipv4Blocked(embedded[1])) return true;
  // IPv4-mapped forms the URL parser compresses to hex (::ffff:7f00:1): rebuild
  // the dotted quad from the last two hextets and re-check via the v4 gate.
  const mapped = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mapped) {
    const hi = Number.parseInt(mapped[1], 16);
    const lo = Number.parseInt(mapped[2], 16);
    if (Number.isFinite(hi) && Number.isFinite(lo)) {
      const quad = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (ipv4Blocked(quad)) return true;
    }
  }
  const firstHextet = host.split(':').find((h) => h.length > 0) ?? '';
  const val = firstHextet ? Number.parseInt(firstHextet, 16) : 0;
  if (Number.isFinite(val)) {
    if ((val & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local (ULA)
    if ((val & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  }
  return false;
}

/**
 * Is this a URL we will fetch on the sender? http(s) only, and NEVER a loopback,
 * private, link-local, ULA, or otherwise-internal host literal. `localhost` (and
 * any *.localhost) is refused by name. Returns the normalized URL string or null.
 */
export function isFetchableUrl(candidate: string): string | null {
  if (!candidate || candidate.length > MAX_URL_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (host.length === 0) return null;
  if (host === 'localhost' || host.endsWith('.localhost')) return null;
  if (ipv4Blocked(host)) return null;
  if (ipv6Blocked(host)) return null;
  const normalized = parsed.toString();
  return normalized.length > MAX_URL_LENGTH ? null : normalized;
}

/**
 * The first FETCHABLE http(s) URL in a body, trimmed of trailing prose
 * punctuation, or null. A URL pointing at a blocked internal host returns null
 * (the SSRF guard runs here so a preview is never even attempted for it).
 */
export function extractFirstUrl(body: string): string | null {
  if (!body) return null;
  const match = URL_PATTERN.exec(body);
  if (!match) return null;
  const candidate = match[0].replace(TRAILING_PUNCTUATION, '');
  return isFetchableUrl(candidate);
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _;
    })
    .replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (m) => HTML_ENTITIES[m] ?? m);
}

/** Read the content attribute of the first <meta> whose property/name matches key. */
function metaContent(html: string, key: string): string | undefined {
  // Match either attribute order: property/name then content, or content first.
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${escaped}["']`,
      'i',
    ),
  ];
  for (const re of patterns) {
    const match = re.exec(html);
    if (match && match[1].trim().length > 0) return decodeEntities(match[1].trim());
  }
  return undefined;
}

function titleTag(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match) return undefined;
  const text = decodeEntities(match[1].replace(/\s+/g, ' ').trim());
  return text.length > 0 ? text : undefined;
}

/** Resolve a possibly-relative og:image to an absolute http(s) URL, else undefined. */
function resolveImageUrl(raw: string | undefined, pageUrl: string): string | undefined {
  if (!raw) return undefined;
  try {
    const resolved = new URL(raw, pageUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}

/**
 * Extract an OgPreview from page HTML. Prefers og:title, falls back to <title>;
 * takes the FIRST og:image only. Returns null when there is no usable title or
 * the input is not HTML at all. Never throws.
 */
export function parseOgPreview(html: string, pageUrl: string): OgPreview | null {
  if (typeof html !== 'string' || html.length === 0) return null;
  if (!/<\s*(?:meta|title|html|head|body)[\s>]/i.test(html)) return null;
  const title = metaContent(html, 'og:title') ?? titleTag(html);
  if (!title) return null;
  const description = metaContent(html, 'og:description');
  const imageUrl = resolveImageUrl(metaContent(html, 'og:image'), pageUrl);
  return { title, ...(description ? { description } : {}), ...(imageUrl ? { imageUrl } : {}) };
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) return true; // absent content-type: try, parseOgPreview still gates
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

/**
 * Read a fetch Response body up to a byte cap, decoding as UTF-8 text. Stops as
 * soon as the cap is reached (never buffers an unbounded page). Falls back to
 * response.text() when the body is not a readable stream (older runtimes).
 */
async function readCapped(response: Response, capBytes: number): Promise<string | null> {
  const body = (response as unknown as { body?: unknown }).body as
    | { getReader?: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }>; releaseLock?: () => void; cancel?: () => void } }
    | undefined;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let total = 0;
    let text = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.length;
          text += decoder.decode(value, { stream: true });
          if (total >= capBytes) break;
        }
      }
      text += decoder.decode();
    } finally {
      try {
        reader.cancel?.();
      } catch {
        // ignore: cancelling a finished reader is a no-op we don't care about
      }
      reader.releaseLock?.();
    }
    return text;
  }
  if (typeof response.text === 'function') {
    const full = await response.text();
    return full.length > capBytes ? full.slice(0, capBytes) : full;
  }
  return null;
}

/** Image decoders receive bounded local bytes, never a remote URL or redirect. */
async function fetchPreviewImage(
  url: string, fetchImpl: typeof fetch, signal?: AbortSignal,
): Promise<string | null> {
  const target = isFetchableUrl(url);
  if (!target) return null;
  const response = await fetchImpl(target, { redirect: 'error', credentials: 'omit', signal });
  if (!response.ok || response.redirected) return null;
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!mime || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)) return null;
  const reader = response.body?.getReader();
  if (!reader) return null; // Unbounded legacy body readers cannot enforce this limit.
  const cap = 2 * 1024 * 1024;
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted || !value || length + value.length > cap) return null;
      chunks.push(value); length += value.length;
    }
  } finally {
    try { await reader.cancel(); } catch { /* already closed */ }
    reader.releaseLock();
  }
  if (length === 0) return null;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return `data:${mime};base64,${encodeBase64(bytes)}`;
}

/** Options for buildLinkPreview: injected fetch + optional image downscaler. */
export interface BuildLinkPreviewOptions {
  /** The fetch used on the SENDER's device only. Injected so the parse/cap logic is testable offline. */
  fetchImpl?: typeof fetch;
  /**
   * Downscale the og:image to a <=320px JPEG and return its base64, or null when
   * the native module is absent / the image is unusable. Injected so the pure
   * path never needs a native module. When omitted, no image is embedded.
   */
  downscaleImage?: (localImageDataUri: string) => Promise<string | null>;
  timeoutMs?: number;
  readCapBytes?: number;
  jsonCapBytes?: number;
}

/**
 * Sender-side: fetch a URL, extract Open Graph fields, optionally downscale the
 * first og:image, and return a typed LinkPreview or null. NEVER throws. A fetch
 * failure, non-ok status, non-HTML body, missing title, timeout, or an image
 * that would push the preview past the JSON cap all resolve to a text preview or
 * null; there is no retry loop. This is the ONLY function that touches the
 * network, and it runs on the sender only.
 */
export async function buildLinkPreview(
  url: string,
  options: BuildLinkPreviewOptions = {},
): Promise<LinkPreview | null> {
  const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchImpl) return null;
  const timeoutMs = options.timeoutMs ?? LINK_PREVIEW_FETCH_TIMEOUT_MS;
  const readCap = options.readCapBytes ?? LINK_PREVIEW_READ_CAP_BYTES;
  const jsonCap = options.jsonCapBytes ?? LINK_PREVIEW_JSON_CAP_BYTES;

  const normalized = extractFirstUrl(url);
  if (!normalized) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore: aborting an already-settled request is harmless
        }
      }, timeoutMs)
    : null;

  try {
    // Follow redirects MANUALLY so a public -> internal 3xx (a Location that
    // resolves to a blocked host) is refused instead of silently followed. Each
    // hop's target is re-run through isFetchableUrl. redirect:'manual' turns a
    // 3xx into an opaque/short response carrying the Location header.
    let target = normalized;
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
      response = await fetchImpl(target, {
        redirect: 'manual',
        ...(controller ? { signal: controller.signal } : {}),
      });
      const status = response.status;
      const isRedirect = status >= 300 && status < 400;
      if (!isRedirect) break;
      if (hop === MAX_REDIRECT_HOPS) return null; // too many hops
      const location = response.headers?.get?.('location') ?? null;
      if (!location) return null;
      let resolved: string;
      try {
        resolved = new URL(location, target).toString();
      } catch {
        return null;
      }
      const nextTarget = isFetchableUrl(resolved);
      if (!nextTarget) return null; // redirect to a blocked/internal host: refuse
      target = nextTarget;
    }
    if (!response || !response.ok) return null;
    const contentType = response.headers?.get?.('content-type') ?? null;
    if (!isHtmlContentType(contentType)) return null;
    const html = await readCapped(response, readCap);
    if (html === null) return null;
    const og = parseOgPreview(html, target);
    if (!og) return null;

    const preview: LinkPreview = {
      url: normalized,
      title: og.title,
      ...(og.description ? { description: og.description } : {}),
    };

    if (og.imageUrl && options.downscaleImage) {
      try {
        const localImage = await fetchPreviewImage(og.imageUrl, fetchImpl, controller?.signal);
        const imageBase64 = localImage ? await options.downscaleImage(localImage) : null;
        // Embed ONLY a real base64 JPEG that keeps the preview under the JSON cap.
        if (
          isValidPreviewImageBase64(imageBase64)
          && fitsJsonCap({ ...preview, imageBase64 }, jsonCap)
        ) {
          preview.imageBase64 = imageBase64;
        }
      } catch {
        // Image downscale failure: keep the text preview, drop the image.
      }
    }

    return fitsJsonCap(preview, jsonCap) ? preview : { url: preview.url, title: preview.title };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function fitsJsonCap(preview: LinkPreview, capBytes: number): boolean {
  const bytes = new TextEncoder().encode(JSON.stringify(preview));
  return bytes.length <= capBytes;
}

/**
 * Encode a LinkPreview to attachment bytes (UTF-8 JSON), or null when it exceeds
 * the 64 KB JSON cap. The cap is enforced HERE (encode) and again at parse.
 */
export function encodeLinkPreviewAttachment(preview: LinkPreview): Uint8Array | null {
  const bytes = new TextEncoder().encode(JSON.stringify(preview));
  if (bytes.length > LINK_PREVIEW_JSON_CAP_BYTES) return null;
  return bytes;
}

function isNonEmptyHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A well-formed base64 JPEG, matching the Plan 32 Phase 2 avatar gate: base64
 * charset + length multiple of 4 + the `/9j/` prefix (base64 of the JPEG SOI
 * magic FF D8 FF). A garbage string that is not a JPEG is rejected so it drops to
 * a text-only preview instead of round-tripping into a broken data: URI. This is
 * a data-shape gate only (no decode); the render layer renders BLANK, not a
 * crash, if a signed-but-corrupt in-cap image slips a decoder later.
 */
function isValidPreviewImageBase64(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  return value.startsWith('/9j/');
}

/**
 * Parse attachment bytes back into a LinkPreview, fail-closed to null. Returns
 * null for oversized bytes (64 KB cap), non-JSON, wrong-typed core fields, or a
 * non-http url. Unknown/wrong-typed optional fields are dropped, not fatal. This
 * runs on the RECEIVER and NEVER fetches anything.
 */
export function parseLinkPreviewAttachment(bytes: Uint8Array): LinkPreview | null {
  if (!bytes || bytes.length === 0 || bytes.length > LINK_PREVIEW_JSON_CAP_BYTES) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyHttpUrl(obj.url)) return null;
  if (typeof obj.title !== 'string' || obj.title.length === 0) return null;
  const preview: LinkPreview = { url: obj.url, title: obj.title };
  if (typeof obj.description === 'string' && obj.description.length > 0) {
    preview.description = obj.description;
  }
  // Only keep a real base64 JPEG; a garbage image string drops to text-only.
  if (isValidPreviewImageBase64(obj.imageBase64)) {
    preview.imageBase64 = obj.imageBase64;
  }
  return preview;
}
