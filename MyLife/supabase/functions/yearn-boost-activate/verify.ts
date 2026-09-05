export type YearnBoostVerificationReason =
  | 'malformed_jws'
  | 'bad_chain'
  | 'bad_signature'
  | 'wrong_bundle'
  | 'wrong_product'
  | 'revoked'
  | 'expired_cert'
  | 'not_consumable';

export type YearnBoostVerificationResult =
  | {
      valid: true;
      originalTransactionId: string;
      transactionId: string;
      appAccountToken?: string;
      environment: 'production' | 'sandbox';
      /** Epoch millis; present for auto-renewable subscription transactions. */
      expiresDate?: number;
    }
  | { valid: false; reason: YearnBoostVerificationReason };

export interface VerifyYearnBoostTransactionOptions {
  expectedBundleId: string;
  expectedProductId: string;
  /**
   * StoreKit transaction type this caller accepts. Defaults to 'Consumable'
   * (the boost). The membership surfaces pass 'Auto-Renewable Subscription'.
   * A mismatch returns the 'not_consumable' reason code (kept for wire
   * compatibility; read it as "wrong transaction type").
   */
  expectedType?: 'Consumable' | 'Auto-Renewable Subscription';
  trustedRootDer?: Uint8Array;
  now?: Date;
}

/** Chain-verified but otherwise uninterpreted Apple JWS payload. */
export type AppleSignedJwsResult =
  | { valid: true; payload: Record<string, unknown> }
  | { valid: false; reason: YearnBoostVerificationReason };

export interface VerifyAppleSignedJwsOptions {
  trustedRootDer?: Uint8Array;
  now?: Date;
}

// Source: https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
const APPLE_ROOT_CA_G3_DER_BASE64 =
  'MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS' +
  'QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u' +
  'IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN' +
  'MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS' +
  'b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y' +
  'aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49' +
  'AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf' +
  'TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517' +
  'IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr' +
  'MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA' +
  'MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4' +
  'at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM' +
  '6BgD56KyKA==';

const OID_EC_PUBLIC_KEY = '1.2.840.10045.2.1';
const OID_P256 = '1.2.840.10045.3.1.7';
const OID_P384 = '1.3.132.0.34';
const OID_RSA_PUBLIC_KEY = '1.2.840.113549.1.1.1';
const OID_BASIC_CONSTRAINTS = '2.5.29.19';
const OID_APPLE_STOREKIT_LEAF = '1.2.840.113635.100.6.11.1';
const OID_APPLE_STOREKIT_INTERMEDIATE = '1.2.840.113635.100.6.2.1';

const CERT_SIGNATURE_ALGORITHMS: Readonly<
  Record<string, { keyType: 'ec' | 'rsa'; hash: 'SHA-256' | 'SHA-384' | 'SHA-512' }>
> = {
  '1.2.840.10045.4.3.2': { keyType: 'ec', hash: 'SHA-256' },
  '1.2.840.10045.4.3.3': { keyType: 'ec', hash: 'SHA-384' },
  '1.2.840.10045.4.3.4': { keyType: 'ec', hash: 'SHA-512' },
  '1.2.840.113549.1.1.11': { keyType: 'rsa', hash: 'SHA-256' },
  '1.2.840.113549.1.1.12': { keyType: 'rsa', hash: 'SHA-384' },
  '1.2.840.113549.1.1.13': { keyType: 'rsa', hash: 'SHA-512' },
};

// This is intentionally a narrow DER reader. It walks only the certificate
// fields needed for trust, validity, public-key import, and signature checks.
interface DerNode {
  tag: number;
  start: number;
  valueStart: number;
  valueEnd: number;
  end: number;
}

interface ParsedCertificate {
  der: Uint8Array;
  tbs: Uint8Array;
  signature: Uint8Array;
  signatureAlgorithm: string;
  spki: Uint8Array;
  publicKeyType: 'ec' | 'rsa';
  namedCurve: 'P-256' | 'P-384' | null;
  notBefore: number;
  notAfter: number;
  extensions: Map<string, { critical: boolean; value: Uint8Array }>;
  isCa: boolean;
}

function invalid(
  reason: YearnBoostVerificationReason,
): { valid: false; reason: YearnBoostVerificationReason } {
  return { valid: false, reason };
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let different = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    different |= left[index]! ^ right[index]!;
  }
  return different === 0;
}

function decodeBase64(value: string, urlSafe: boolean): Uint8Array {
  const pattern = urlSafe ? /^[A-Za-z0-9_-]+$/ : /^[A-Za-z0-9+/]+={0,2}$/;
  if (!pattern.test(value) || value.length > 32_768) {
    throw new Error('Invalid base64 input.');
  }

  const normalized = urlSafe ? value.replace(/-/g, '+').replace(/_/g, '/') : value;
  const unpadded = normalized.replace(/=+$/, '');
  if (unpadded.length % 4 === 1) {
    throw new Error('Invalid base64 length.');
  }
  const padded = unpadded + '='.repeat((4 - (unpadded.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeJsonObject(encoded: string): Record<string, unknown> {
  const bytes = decodeBase64(encoded, true);
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const value: unknown = JSON.parse(decoded);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected a JSON object.');
  }
  return value as Record<string, unknown>;
}

function readDerNode(bytes: Uint8Array, offset: number, limit = bytes.length): DerNode {
  if (offset < 0 || offset + 2 > limit) throw new Error('Truncated DER node.');

  const start = offset;
  const tag = bytes[offset++]!;
  if ((tag & 0x1f) === 0x1f) throw new Error('High-tag-number DER is unsupported.');

  const firstLength = bytes[offset++]!;
  let length = 0;
  if ((firstLength & 0x80) === 0) {
    length = firstLength;
  } else {
    const lengthBytes = firstLength & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4 || offset + lengthBytes > limit) {
      throw new Error('Invalid DER length.');
    }
    if (bytes[offset] === 0) throw new Error('Non-minimal DER length.');
    for (let index = 0; index < lengthBytes; index += 1) {
      length = length * 256 + bytes[offset++]!;
    }
    if (length < 128) throw new Error('Non-minimal DER length.');
  }

  const valueStart = offset;
  const valueEnd = valueStart + length;
  if (!Number.isSafeInteger(valueEnd) || valueEnd > limit) {
    throw new Error('DER value exceeds its container.');
  }
  return { tag, start, valueStart, valueEnd, end: valueEnd };
}

function readDerChildren(bytes: Uint8Array, parent: DerNode): DerNode[] {
  const children: DerNode[] = [];
  let offset = parent.valueStart;
  while (offset < parent.valueEnd) {
    const child = readDerNode(bytes, offset, parent.valueEnd);
    children.push(child);
    offset = child.end;
  }
  if (offset !== parent.valueEnd) throw new Error('Invalid DER child boundary.');
  return children;
}

function requireTag(node: DerNode, tag: number): void {
  if (node.tag !== tag) throw new Error(`Unexpected DER tag ${node.tag}.`);
}

function nodeBytes(bytes: Uint8Array, node: DerNode): Uint8Array {
  return bytes.slice(node.start, node.end);
}

function nodeValue(bytes: Uint8Array, node: DerNode): Uint8Array {
  return bytes.slice(node.valueStart, node.valueEnd);
}

function readOid(bytes: Uint8Array, node: DerNode): string {
  requireTag(node, 0x06);
  const encoded = nodeValue(bytes, node);
  if (encoded.length === 0) throw new Error('Empty OID.');

  const values: number[] = [];
  let value = 0;
  let hasPendingValue = false;
  for (const byte of encoded) {
    if (value > Math.floor(Number.MAX_SAFE_INTEGER / 128)) throw new Error('OID overflow.');
    value = value * 128 + (byte & 0x7f);
    hasPendingValue = true;
    if ((byte & 0x80) === 0) {
      values.push(value);
      value = 0;
      hasPendingValue = false;
    }
  }
  if (hasPendingValue || values.length === 0) throw new Error('Truncated OID.');

  const firstCombined = values.shift()!;
  const first = firstCombined < 40 ? 0 : firstCombined < 80 ? 1 : 2;
  const second = firstCombined - first * 40;
  return [first, second, ...values].join('.');
}

function readDerBoolean(bytes: Uint8Array, node: DerNode): boolean {
  requireTag(node, 0x01);
  const value = nodeValue(bytes, node);
  if (value.length !== 1 || (value[0] !== 0x00 && value[0] !== 0xff)) {
    throw new Error('Invalid DER boolean.');
  }
  return value[0] === 0xff;
}

function parseCertificateExtensions(
  bytes: Uint8Array,
  extensionsNode: DerNode,
): Map<string, { critical: boolean; value: Uint8Array }> {
  requireTag(extensionsNode, 0xa3);
  const explicitFields = readDerChildren(bytes, extensionsNode);
  if (explicitFields.length !== 1) throw new Error('Invalid extensions wrapper.');

  const extensionsSequence = explicitFields[0]!;
  requireTag(extensionsSequence, 0x30);
  const extensions = new Map<string, { critical: boolean; value: Uint8Array }>();
  for (const extensionNode of readDerChildren(bytes, extensionsSequence)) {
    requireTag(extensionNode, 0x30);
    const fields = readDerChildren(bytes, extensionNode);
    if (fields.length !== 2 && fields.length !== 3) {
      throw new Error('Invalid certificate extension.');
    }

    const oid = readOid(bytes, fields[0]!);
    if (extensions.has(oid)) throw new Error('Duplicate certificate extension.');

    const hasCritical = fields.length === 3;
    const critical = hasCritical ? readDerBoolean(bytes, fields[1]!) : false;
    const valueNode = fields[hasCritical ? 2 : 1]!;
    requireTag(valueNode, 0x04);
    extensions.set(oid, { critical, value: nodeValue(bytes, valueNode) });
  }
  return extensions;
}

function readBasicConstraintsIsCa(
  extensions: Map<string, { critical: boolean; value: Uint8Array }>,
): boolean {
  const basicConstraints = extensions.get(OID_BASIC_CONSTRAINTS);
  if (!basicConstraints) return false;

  const sequence = readDerNode(basicConstraints.value, 0);
  requireTag(sequence, 0x30);
  if (sequence.end !== basicConstraints.value.length) {
    throw new Error('Trailing basicConstraints data.');
  }

  const fields = readDerChildren(basicConstraints.value, sequence);
  if (fields.length > 2) throw new Error('Invalid basicConstraints extension.');

  let offset = 0;
  let isCa = false;
  if (fields[offset]?.tag === 0x01) {
    isCa = readDerBoolean(basicConstraints.value, fields[offset++]!);
  }
  if (fields[offset]) {
    requireTag(fields[offset++]!, 0x02);
  }
  if (offset !== fields.length) throw new Error('Invalid basicConstraints fields.');
  return isCa;
}

function readAlgorithmOid(bytes: Uint8Array, node: DerNode): string {
  requireTag(node, 0x30);
  const children = readDerChildren(bytes, node);
  if (children.length === 0) throw new Error('Missing algorithm OID.');
  return readOid(bytes, children[0]!);
}

function readAsn1Time(bytes: Uint8Array, node: DerNode): number {
  if (node.tag !== 0x17 && node.tag !== 0x18) throw new Error('Unsupported X.509 time.');
  const text = String.fromCharCode(...nodeValue(bytes, node));
  const match = node.tag === 0x17
    ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text)
    : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(text);
  if (!match) throw new Error('Invalid X.509 time.');

  const shortYear = Number(match[1]);
  const year = node.tag === 0x17 ? (shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear) : shortYear;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(timestamp);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    throw new Error('Out-of-range X.509 time.');
  }
  return timestamp;
}

function parseCertificate(der: Uint8Array): ParsedCertificate {
  if (der.length === 0 || der.length > 16_384) throw new Error('Invalid certificate size.');
  const certificate = readDerNode(der, 0);
  requireTag(certificate, 0x30);
  if (certificate.end !== der.length) throw new Error('Trailing certificate data.');

  const certificateFields = readDerChildren(der, certificate);
  if (certificateFields.length !== 3) throw new Error('Invalid certificate structure.');
  const [tbsNode, signatureAlgorithmNode, signatureNode] = certificateFields;
  requireTag(tbsNode!, 0x30);
  requireTag(signatureNode!, 0x03);

  // TBSCertificate has a fixed prefix after its optional explicit version:
  // serial, signature algorithm, issuer, validity, subject, then SPKI.
  const tbsFields = readDerChildren(der, tbsNode!);
  let offset = tbsFields[0]?.tag === 0xa0 ? 1 : 0;
  if (tbsFields.length < offset + 6) throw new Error('Truncated TBSCertificate.');
  offset += 1; // serialNumber
  const tbsSignatureAlgorithmNode = tbsFields[offset++]!;
  offset += 1; // issuer
  const validityNode = tbsFields[offset++]!;
  offset += 1; // subject
  const spkiIndex = offset;
  const spkiNode = tbsFields[spkiIndex]!;

  let extensionsNode: DerNode | null = null;
  for (const field of tbsFields.slice(spkiIndex + 1)) {
    if (field.tag !== 0xa3) continue;
    if (extensionsNode) throw new Error('Duplicate extensions block.');
    extensionsNode = field;
  }
  const extensions = extensionsNode
    ? parseCertificateExtensions(der, extensionsNode)
    : new Map<string, { critical: boolean; value: Uint8Array }>();

  const signatureAlgorithm = readAlgorithmOid(der, signatureAlgorithmNode!);
  if (signatureAlgorithm !== readAlgorithmOid(der, tbsSignatureAlgorithmNode)) {
    throw new Error('Mismatched certificate signature algorithms.');
  }

  requireTag(validityNode, 0x30);
  const validity = readDerChildren(der, validityNode);
  if (validity.length !== 2) throw new Error('Invalid certificate validity.');

  requireTag(spkiNode, 0x30);
  const spkiFields = readDerChildren(der, spkiNode);
  if (spkiFields.length !== 2) throw new Error('Invalid SubjectPublicKeyInfo.');
  requireTag(spkiFields[0]!, 0x30);
  requireTag(spkiFields[1]!, 0x03);
  const publicKeyAlgorithmFields = readDerChildren(der, spkiFields[0]!);
  if (publicKeyAlgorithmFields.length === 0) throw new Error('Missing public key algorithm.');
  const publicKeyAlgorithm = readOid(der, publicKeyAlgorithmFields[0]!);

  let publicKeyType: ParsedCertificate['publicKeyType'];
  let namedCurve: ParsedCertificate['namedCurve'] = null;
  if (publicKeyAlgorithm === OID_EC_PUBLIC_KEY) {
    if (publicKeyAlgorithmFields.length !== 2) throw new Error('Missing EC curve.');
    const curveOid = readOid(der, publicKeyAlgorithmFields[1]!);
    if (curveOid === OID_P256) namedCurve = 'P-256';
    else if (curveOid === OID_P384) namedCurve = 'P-384';
    else throw new Error('Unsupported EC curve.');
    publicKeyType = 'ec';
  } else if (publicKeyAlgorithm === OID_RSA_PUBLIC_KEY) {
    publicKeyType = 'rsa';
  } else {
    throw new Error('Unsupported certificate public key.');
  }

  const signatureValue = nodeValue(der, signatureNode!);
  if (signatureValue.length < 2 || signatureValue[0] !== 0) {
    throw new Error('Invalid certificate signature bit string.');
  }

  return {
    der: der.slice(),
    tbs: nodeBytes(der, tbsNode!),
    signature: signatureValue.slice(1),
    signatureAlgorithm,
    spki: nodeBytes(der, spkiNode),
    publicKeyType,
    namedCurve,
    notBefore: readAsn1Time(der, validity[0]!),
    notAfter: readAsn1Time(der, validity[1]!),
    extensions,
    isCa: readBasicConstraintsIsCa(extensions),
  };
}

function normalizeDerInteger(bytes: Uint8Array, size: number): Uint8Array {
  if (bytes.length === 0 || (bytes[0]! & 0x80) !== 0) throw new Error('Invalid ECDSA integer.');
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) offset += 1;
  const normalized = bytes.slice(offset);
  if (normalized.length > size) throw new Error('Oversized ECDSA integer.');
  const output = new Uint8Array(size);
  output.set(normalized, size - normalized.length);
  return output;
}

function derEcdsaSignatureToRaw(signature: Uint8Array, size: number): Uint8Array {
  const sequence = readDerNode(signature, 0);
  requireTag(sequence, 0x30);
  if (sequence.end !== signature.length) throw new Error('Trailing ECDSA signature data.');
  const integers = readDerChildren(signature, sequence);
  if (integers.length !== 2) throw new Error('Invalid ECDSA signature.');
  requireTag(integers[0]!, 0x02);
  requireTag(integers[1]!, 0x02);
  const raw = new Uint8Array(size * 2);
  raw.set(normalizeDerInteger(nodeValue(signature, integers[0]!), size), 0);
  raw.set(normalizeDerInteger(nodeValue(signature, integers[1]!), size), size);
  return raw;
}

async function verifyCertificateSignature(
  certificate: ParsedCertificate,
  issuer: ParsedCertificate,
): Promise<boolean> {
  const signatureSpec = CERT_SIGNATURE_ALGORITHMS[certificate.signatureAlgorithm];
  if (!signatureSpec || signatureSpec.keyType !== issuer.publicKeyType) return false;

  if (issuer.publicKeyType === 'ec') {
    if (!issuer.namedCurve) return false;
    const publicKey = await crypto.subtle.importKey(
      'spki',
      copyToArrayBuffer(issuer.spki),
      { name: 'ECDSA', namedCurve: issuer.namedCurve },
      false,
      ['verify'],
    );
    const componentSize = issuer.namedCurve === 'P-256' ? 32 : 48;
    const signature = derEcdsaSignatureToRaw(certificate.signature, componentSize);
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: signatureSpec.hash },
      publicKey,
      copyToArrayBuffer(signature),
      copyToArrayBuffer(certificate.tbs),
    );
  }

  const publicKey = await crypto.subtle.importKey(
    'spki',
    copyToArrayBuffer(issuer.spki),
    { name: 'RSASSA-PKCS1-v1_5', hash: signatureSpec.hash },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    copyToArrayBuffer(certificate.signature),
    copyToArrayBuffer(certificate.tbs),
  );
}

async function verifyCertificateChain(
  chain: ParsedCertificate[],
  trustedRoot: ParsedCertificate,
): Promise<boolean> {
  if (chain.length !== 3) return false;
  const [leaf, intermediate, presentedRoot] = chain as [
    ParsedCertificate,
    ParsedCertificate,
    ParsedCertificate,
  ];

  if (!bytesEqual(presentedRoot.der, trustedRoot.der)) return false;
  if (!intermediate.isCa) return false;
  if (!certificateHasExtension(leaf, OID_APPLE_STOREKIT_LEAF)) return false;
  if (!certificateHasExtension(intermediate, OID_APPLE_STOREKIT_INTERMEDIATE)) return false;
  if (!(await verifyCertificateSignature(leaf, intermediate))) return false;
  return verifyCertificateSignature(intermediate, trustedRoot);
}

function certificateHasExtension(certificate: ParsedCertificate, oid: string): boolean {
  return certificate.extensions.has(oid);
}

function certificatesAreCurrent(
  certificates: ParsedCertificate[],
  now: number,
): boolean {
  return certificates.every((certificate) =>
    certificate.notBefore <= now && now <= certificate.notAfter
  );
}

async function verifyJwsSignature(
  signingInput: string,
  signature: Uint8Array,
  leaf: ParsedCertificate,
): Promise<boolean> {
  if (leaf.publicKeyType !== 'ec' || leaf.namedCurve !== 'P-256' || signature.length !== 64) {
    return false;
  }
  const publicKey = await crypto.subtle.importKey(
    'spki',
    copyToArrayBuffer(leaf.spki),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    publicKey,
    copyToArrayBuffer(signature),
    new TextEncoder().encode(signingInput),
  );
}

/**
 * Verifies an Apple StoreKit signed JWS (x5c chain to the pinned Apple Root
 * CA G3, certificate currency, ES256 signature) and returns the decoded
 * payload WITHOUT interpreting it. Callers must validate bundle, product,
 * type, and revocation themselves. Used for transactions AND App Store
 * Server Notification envelopes.
 */
export async function verifyAppleSignedJws(
  signedJws: string,
  options: VerifyAppleSignedJwsOptions = {},
): Promise<AppleSignedJwsResult> {
  let encodedHeader: string;
  let encodedPayload: string;
  let signature: Uint8Array;
  let certificateDerChain: Uint8Array[];

  try {
    if (typeof signedJws !== 'string' || signedJws.length > 131_072) {
      return invalid('malformed_jws');
    }
    const segments = signedJws.split('.');
    if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) {
      return invalid('malformed_jws');
    }
    [encodedHeader, encodedPayload] = segments as [string, string, string];
    signature = decodeBase64(segments[2]!, true);

    const header = decodeJsonObject(encodedHeader);
    if (header.alg !== 'ES256' || !Array.isArray(header.x5c)) {
      return invalid('malformed_jws');
    }
    if (header.x5c.length !== 3) {
      return invalid('malformed_jws');
    }
    certificateDerChain = header.x5c.map((certificate) => {
      if (typeof certificate !== 'string') throw new Error('Invalid x5c certificate.');
      return decodeBase64(certificate, false);
    });
  } catch {
    return invalid('malformed_jws');
  }

  let chain: ParsedCertificate[];
  let trustedRoot: ParsedCertificate;
  try {
    chain = certificateDerChain.map(parseCertificate);
    trustedRoot = parseCertificate(
      options.trustedRootDer?.slice() ?? decodeBase64(APPLE_ROOT_CA_G3_DER_BASE64, false),
    );
  } catch {
    return invalid('bad_chain');
  }

  const now = (options.now ?? new Date()).getTime();
  if (!Number.isFinite(now) || !certificatesAreCurrent([...chain, trustedRoot], now)) {
    return invalid('expired_cert');
  }

  try {
    if (!(await verifyCertificateChain(chain, trustedRoot))) return invalid('bad_chain');
  } catch {
    return invalid('bad_chain');
  }

  try {
    if (!(await verifyJwsSignature(`${encodedHeader}.${encodedPayload}`, signature, chain[0]!))) {
      return invalid('bad_signature');
    }
  } catch {
    return invalid('bad_signature');
  }

  let payload: Record<string, unknown>;
  try {
    payload = decodeJsonObject(encodedPayload);
  } catch {
    return invalid('malformed_jws');
  }

  return { valid: true, payload };
}

export async function verifyYearnBoostTransaction(
  signedTransaction: string,
  options: VerifyYearnBoostTransactionOptions,
): Promise<YearnBoostVerificationResult> {
  const verified = await verifyAppleSignedJws(signedTransaction, {
    trustedRootDer: options.trustedRootDer,
    now: options.now,
  });
  if (!verified.valid) return verified;
  const payload = verified.payload;

  if (payload.bundleId !== options.expectedBundleId) return invalid('wrong_bundle');
  if (payload.productId !== options.expectedProductId) return invalid('wrong_product');
  if (
    Object.prototype.hasOwnProperty.call(payload, 'revocationDate') ||
    Object.prototype.hasOwnProperty.call(payload, 'revocationReason')
  ) {
    return invalid('revoked');
  }
  const expectedType = options.expectedType ?? 'Consumable';
  if (payload.type !== expectedType) return invalid('not_consumable');

  const expiresDate = typeof payload.expiresDate === 'number' && Number.isFinite(payload.expiresDate)
    ? payload.expiresDate
    : null;
  if (expectedType === 'Auto-Renewable Subscription' && expiresDate === null) {
    return invalid('malformed_jws');
  }

  const originalTransactionId = typeof payload.originalTransactionId === 'string'
    ? payload.originalTransactionId.trim()
    : '';
  if (!originalTransactionId) return invalid('malformed_jws');

  const transactionId = typeof payload.transactionId === 'string'
    ? payload.transactionId.trim()
    : '';
  if (!transactionId) return invalid('malformed_jws');

  const hasAppAccountToken = Object.prototype.hasOwnProperty.call(payload, 'appAccountToken');
  const appAccountToken = typeof payload.appAccountToken === 'string'
    ? payload.appAccountToken.trim()
    : '';
  if (hasAppAccountToken && !appAccountToken) return invalid('malformed_jws');

  const environment = payload.environment === 'Production'
    ? 'production'
    : payload.environment === 'Sandbox'
    ? 'sandbox'
    : null;
  if (!environment) return invalid('malformed_jws');

  return {
    valid: true,
    originalTransactionId,
    transactionId,
    ...(appAccountToken ? { appAccountToken } : {}),
    environment,
    ...(expiresDate !== null ? { expiresDate } : {}),
  };
}
