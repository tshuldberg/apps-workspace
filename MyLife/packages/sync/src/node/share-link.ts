/**
 * Meerkat share links.
 *
 * A share link is the public invitation to a sealed share. It carries the
 * content id (where to find the ciphertext), the link key (how to decrypt it),
 * the author public key (whose signature to verify), and a display name. This
 * is the `published_blob` scope made concrete: anyone with the link can fetch
 * and open the content, no one else can.
 *
 * Primary form:   meerkat://share/<contentId>?k=<base64url key>&a=<authorPub>&n=<name>
 * Magnet form:    magnet:?xt=urn:meerkat:<contentId>&kt=<key>&as=<authorPub>&dn=<name>
 */

import naclUtil from 'tweetnacl-util';
const { encodeBase64, decodeBase64 } = naclUtil;

export interface ShareLinkParts {
  contentId: string;
  linkKey: Uint8Array;
  authorPublicKey: string;
  name: string;
}

function toBase64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  let b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  return decodeBase64(b64);
}

/**
 * Build the primary `meerkat://` share link.
 */
export function buildShareLink(parts: ShareLinkParts): string {
  const params = new URLSearchParams();
  params.set('k', toBase64Url(parts.linkKey));
  params.set('a', parts.authorPublicKey);
  params.set('n', parts.name);
  return `meerkat://share/${parts.contentId}?${params.toString()}`;
}

/**
 * Build the magnet-style share link (interop-friendly form).
 */
export function buildMagnetLink(parts: ShareLinkParts): string {
  const params = new URLSearchParams();
  params.set('xt', `urn:meerkat:${parts.contentId}`);
  params.set('kt', toBase64Url(parts.linkKey));
  params.set('as', parts.authorPublicKey);
  params.set('dn', parts.name);
  return `magnet:?${params.toString()}`;
}

/**
 * Parse either link form. Returns null if the link is malformed or missing a
 * required field. The key is decoded but NOT trusted until the caller verifies
 * the manifest signature against `authorPublicKey`.
 */
export function parseShareLink(link: string): ShareLinkParts | null {
  try {
    if (link.startsWith('meerkat://share/')) {
      const rest = link.slice('meerkat://share/'.length);
      const qIndex = rest.indexOf('?');
      if (qIndex === -1) return null;
      const contentId = rest.slice(0, qIndex);
      const params = new URLSearchParams(rest.slice(qIndex + 1));
      const k = params.get('k');
      const a = params.get('a');
      if (!contentId || !k || !a) return null;
      return {
        contentId,
        linkKey: fromBase64Url(k),
        authorPublicKey: a,
        name: params.get('n') ?? '',
      };
    }

    if (link.startsWith('magnet:?')) {
      const params = new URLSearchParams(link.slice('magnet:?'.length));
      const xt = params.get('xt') ?? '';
      const kt = params.get('kt');
      const as = params.get('as');
      const prefix = 'urn:meerkat:';
      if (!xt.startsWith(prefix) || !kt || !as) return null;
      return {
        contentId: xt.slice(prefix.length),
        linkKey: fromBase64Url(kt),
        authorPublicKey: as,
        name: params.get('dn') ?? '',
      };
    }

    return null;
  } catch {
    return null;
  }
}
