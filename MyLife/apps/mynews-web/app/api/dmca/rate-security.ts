function cleanIp(value: string | null): string | null {
  const ip = value?.split(',')[0]?.trim() ?? '';
  if (ip.length === 0 || ip.length > 128 || /[\s\u0000-\u001f]/.test(ip)) return null;
  return ip;
}

// The rate limit is only as trustworthy as the header it reads. The previous
// version walked a fixed list (cf-connecting-ip, x-forwarded-for, ...) and took
// the first present value. Every one of those is client-controllable unless the
// deployment's own edge overwrites it, so an attacker sending
// `cf-connecting-ip: <random>` to an origin that does not overwrite it got a
// fresh rate bucket per request, and the BFF then laundered that value into an
// HMAC-signed "platform IP" the edge trusts. That is a fail-open control.
//
// The deployment now declares EXACTLY ONE header it guarantees its trusted
// proxy sets AND overwrites (Vercel: `x-vercel-forwarded-for`; Cloudflare:
// `cf-connecting-ip`; Fly: `fly-client-ip`), via MYNEWS_TRUSTED_CLIENT_IP_HEADER.
// Unset, or the header absent, returns null and the caller fails closed. There
// is no grab-bag fallback: guessing which header is trustworthy is exactly the
// bug this closes.
export function platformClientIp(
  headers: Headers,
  trustedHeaderName: string | undefined,
): string | null {
  const name = (trustedHeaderName ?? '').trim().toLowerCase();
  if (name.length === 0) return null;
  return cleanIp(headers.get(name));
}

function bytesToHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function signDmcaClientIp(
  salt: string,
  clientIp: string,
  timestamp: number,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${clientIp}`)),
  );
}
