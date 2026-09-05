import naclUtil from 'tweetnacl-util';

const { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } = naclUtil;

export const MEERKAT_PAIRING_CODE_PREFIX = 'MKPAIR1-';

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function fromBase64Url(base64Url: string): string {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  return base64 + padding;
}

export function encodeMeerkatPairingCode(pairingPayloadJson: string): string {
  const trimmed = pairingPayloadJson.trim();
  if (!trimmed) return '';
  return `${MEERKAT_PAIRING_CODE_PREFIX}${toBase64Url(encodeBase64(decodeUTF8(trimmed)))}`;
}

export function isMeerkatPairingCode(input: string): boolean {
  return input.trim().replace(/\s+/gu, '').toUpperCase().startsWith(MEERKAT_PAIRING_CODE_PREFIX);
}

export function decodeMeerkatPairingCode(input: string): string {
  const trimmed = input.trim();
  const compact = trimmed.replace(/\s+/gu, '');
  if (!compact.toUpperCase().startsWith(MEERKAT_PAIRING_CODE_PREFIX)) return trimmed;

  const body = compact.slice(MEERKAT_PAIRING_CODE_PREFIX.length);
  try {
    return encodeUTF8(decodeBase64(fromBase64Url(body)));
  } catch {
    return trimmed;
  }
}

export function normalizeMeerkatPairingInput(input: string): string {
  return isMeerkatPairingCode(input) ? decodeMeerkatPairingCode(input) : input.trim();
}

export function formatMeerkatPairingCode(code: string): string {
  const compact = code.trim().replace(/\s+/gu, '');
  if (!compact.toUpperCase().startsWith(MEERKAT_PAIRING_CODE_PREFIX)) return code.trim();
  const body = compact.slice(MEERKAT_PAIRING_CODE_PREFIX.length);
  const groups = body.match(/.{1,24}/gu) ?? [];
  return `${MEERKAT_PAIRING_CODE_PREFIX}${groups.join(' ')}`;
}
