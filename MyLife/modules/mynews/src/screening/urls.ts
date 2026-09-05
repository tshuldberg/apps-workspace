/**
 * URL reputation heuristics for pre-publication screening (plan 48 WP8).
 *
 * No network calls and no vendor feed: these are structural heuristics over the
 * URL itself, which is the only thing that can be judged deterministically and
 * offline. Every list is exported data so ops can extend coverage without
 * touching the logic.
 *
 * A link is never quarantine-worthy on its own. The strongest single finding
 * here scores below every class threshold, so a URL heuristic can tip content
 * that already looks like fraud or spam over the line, but a single shortened
 * link in an otherwise clean article cannot.
 */

import type { ScreeningClass, ScreeningSignal } from './types';

/** Link shorteners hide the destination, which defeats reader-side judgement. */
export const URL_SHORTENER_HOSTS: readonly string[] = Object.freeze([
  'bit.ly',
  'tinyurl.com',
  'goo.gl',
  't.co',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'shorte.st',
  'cutt.ly',
  'rebrand.ly',
  'bl.ink',
  'rb.gy',
  'tiny.cc',
  'shorturl.at',
  'linktr.ee',
  's.id',
  'v.gd',
  'clck.ru',
  'trib.al',
  'lnkd.in',
  'qr.ae',
  'soo.gd',
  'gg.gg',
  'urlz.fr',
]);

/**
 * TLDs with a persistently high abuse share in public registrar reporting and
 * near-zero legitimate use in cited journalism. Heuristic, not a blocklist: the
 * weight is small and additive.
 */
export const HIGH_ABUSE_TLDS: readonly string[] = Object.freeze([
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'top',
  'work',
  'click',
  'link',
  'loan',
  'bid',
  'stream',
  'download',
  'zip',
  'mov',
  'quest',
  'cam',
  'sbs',
  'rest',
  'cyou',
]);

/**
 * Hosts a scam page most often impersonates in this product's own space. A URL
 * whose host merely CONTAINS one of these strings while not being the canonical
 * domain is a lookalike.
 */
export const IMPERSONATION_BRAND_TOKENS: readonly string[] = Object.freeze([
  'mynews',
  'mylife',
  'paypal',
  'stripe',
  'coinbase',
  'binance',
  'metamask',
  'ledger',
  'apple',
  'google',
  'microsoft',
  'supabase',
]);

/** Canonical hosts that legitimately carry the tokens above. */
export const CANONICAL_HOSTS: readonly string[] = Object.freeze([
  'mynews.app',
  'mylife.app',
  'paypal.com',
  'stripe.com',
  'coinbase.com',
  'binance.com',
  'metamask.io',
  'ledger.com',
  'apple.com',
  'google.com',
  'microsoft.com',
  'supabase.com',
  'supabase.co',
]);

const URL_IN_TEXT_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const IPV4_HOST_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const NON_ASCII_RE = /[^\x00-\x7F]/;
const CYRILLIC_OR_GREEK_RE = /[Ͱ-ϿЀ-ӿ]/;

export interface ParsedLink {
  raw: string;
  /** Lowercase host, empty when the URL could not be parsed. */
  host: string;
  /** Effective TLD label, lowercase. */
  tld: string;
  scheme: string;
  hasCredentials: boolean;
  parsed: boolean;
}

/** Every http(s) or www-prefixed link in the text, in order of appearance. */
export function extractUrls(text: string): string[] {
  const found = text.match(URL_IN_TEXT_RE);
  return found ? found.map((url) => url.replace(/[.,;:]+$/, '')) : [];
}

export function parseLink(raw: string): ParsedLink {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    const host = url.hostname.toLowerCase();
    const labels = host.split('.');
    return {
      raw,
      host,
      tld: labels.length > 1 ? labels[labels.length - 1]! : '',
      scheme: url.protocol.replace(':', '').toLowerCase(),
      hasCredentials: url.username !== '' || url.password !== '',
      parsed: true,
    };
  } catch {
    return { raw, host: '', tld: '', scheme: '', hasCredentials: false, parsed: false };
  }
}

function isCanonical(host: string): boolean {
  return CANONICAL_HOSTS.some((canonical) => host === canonical || host.endsWith(`.${canonical}`));
}

function registrableRoot(host: string): string {
  const labels = host.split('.');
  return labels.length >= 2 ? labels.slice(-2).join('.') : host;
}

export interface UrlAnalysis {
  links: readonly ParsedLink[];
  signals: readonly ScreeningSignal[];
  /** Distinct registrable roots across every link. */
  distinctRoots: number;
}

function signal(
  signalClass: ScreeningClass,
  code: string,
  weight: number,
  explain: string,
): ScreeningSignal {
  return { signalClass, code, weight, explain };
}

/**
 * Structural link reputation. `declared` are author-supplied citation URLs;
 * they are judged the same way as links found in prose, because a citation
 * field is exactly where a scam link wants to live.
 */
export function analyzeUrls(
  text: string,
  declared: readonly string[] = [],
  tokenCount = 0,
): UrlAnalysis {
  const rawLinks = [...extractUrls(text), ...declared];
  const links = rawLinks.map(parseLink);
  const signals: ScreeningSignal[] = [];
  if (links.length === 0) return { links, signals, distinctRoots: 0 };

  const roots = new Set(links.filter((link) => link.host !== '').map((link) => registrableRoot(link.host)));

  const shorteners = links.filter((link) => URL_SHORTENER_HOSTS.includes(link.host));
  if (shorteners.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.shortener',
        Math.min(0.35, 0.15 + 0.1 * (shorteners.length - 1)),
        `${shorteners.length} link${shorteners.length === 1 ? '' : 's'} use a URL shortener, which hides the destination from readers.`,
      ),
    );
  }

  const rawIps = links.filter((link) => IPV4_HOST_RE.test(link.host) || link.host.includes(':'));
  if (rawIps.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.raw-ip-host',
        0.3,
        `${rawIps.length} link${rawIps.length === 1 ? '' : 's'} point at a bare IP address instead of a domain name.`,
      ),
    );
  }

  const punycode = links.filter((link) => link.host.includes('xn--'));
  const nonAscii = links.filter(
    (link) => NON_ASCII_RE.test(link.raw) && CYRILLIC_OR_GREEK_RE.test(link.raw),
  );
  if (punycode.length > 0 || nonAscii.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.homoglyph-host',
        0.35,
        'A link host uses punycode or non-Latin lookalike characters, the standard technique for a domain that reads like a familiar one.',
      ),
    );
  }

  const abuseTlds = links.filter((link) => link.tld !== '' && HIGH_ABUSE_TLDS.includes(link.tld));
  if (abuseTlds.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.high-abuse-tld',
        Math.min(0.3, 0.12 * abuseTlds.length),
        `${abuseTlds.length} link${abuseTlds.length === 1 ? '' : 's'} sit on a top-level domain with a persistently high abuse rate.`,
      ),
    );
  }

  const credentialed = links.filter((link) => link.hasCredentials);
  if (credentialed.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.embedded-credentials',
        0.4,
        'A link embeds credentials before the host, which is used to make a hostile domain look like a trusted one.',
      ),
    );
  }

  const lookalikes = links.filter(
    (link) =>
      link.host !== '' &&
      !isCanonical(link.host) &&
      IMPERSONATION_BRAND_TOKENS.some((token) => link.host.includes(token)),
  );
  if (lookalikes.length > 0) {
    signals.push(
      signal(
        'fraud-scam',
        'url.brand-lookalike',
        0.45,
        `A link host contains a well-known brand or product name but is not that brand's domain (${lookalikes[0]!.host}).`,
      ),
    );
  }

  const insecure = links.filter((link) => link.scheme === 'http');
  if (insecure.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.insecure-scheme',
        0.1,
        `${insecure.length} link${insecure.length === 1 ? '' : 's'} use plain http.`,
      ),
    );
  }

  const unparsed = links.filter((link) => !link.parsed);
  if (unparsed.length > 0) {
    signals.push(
      signal(
        'spam',
        'url.unparseable',
        0.15,
        `${unparsed.length} link${unparsed.length === 1 ? '' : 's'} could not be parsed as a URL.`,
      ),
    );
  }

  if (links.length >= 10) {
    signals.push(
      signal(
        'spam',
        'url.link-count',
        Math.min(0.3, 0.1 + 0.02 * (links.length - 10)),
        `Contains ${links.length} links.`,
      ),
    );
  }

  // Link density: many links relative to how little prose there is. A citation
  // list on a long article is normal; ten links in twenty words is not.
  if (tokenCount > 0 && links.length >= 3 && links.length / tokenCount >= 0.2) {
    signals.push(
      signal(
        'spam',
        'url.link-density',
        0.3,
        `Links make up an unusually large share of the text (${links.length} links across ${tokenCount} words).`,
      ),
    );
  }

  return { links, signals, distinctRoots: roots.size };
}
