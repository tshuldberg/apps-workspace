export interface TestCertificate {
  certificateDer: Uint8Array;
  privateKey: CryptoKey;
}

export interface TestCertificateChain {
  root: TestCertificate;
  intermediate: TestCertificate;
  leaf: TestCertificate;
}

export interface TestCertificateChainOptions {
  notBefore?: string;
  notAfter?: string;
  rootCommonName?: string;
  intermediateCommonName?: string;
  leafCommonName?: string;
  intermediateIsCa?: boolean;
  intermediateHasStoreKitExtension?: boolean;
  leafHasStoreKitExtension?: boolean;
}

export interface TestTransactionPayload extends Record<string, unknown> {
  bundleId: string;
  productId: string;
  type: string;
  originalTransactionId: string;
  transactionId: string;
  appAccountToken?: string;
  environment: string;
}

const OID_COMMON_NAME = '2.5.4.3';
const OID_ECDSA_SHA256 = '1.2.840.10045.4.3.2';
const OID_BASIC_CONSTRAINTS = '2.5.29.19';
const OID_APPLE_STOREKIT_LEAF = '1.2.840.113635.100.6.11.1';
const OID_APPLE_STOREKIT_INTERMEDIATE = '1.2.840.113635.100.6.2.1';

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function copyToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function encodeLength(length: number): Uint8Array {
  if (length < 0x80) return Uint8Array.of(length);
  const octets: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    octets.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return Uint8Array.of(0x80 | octets.length, ...octets);
}

function der(tag: number, ...contents: Uint8Array[]): Uint8Array {
  const content = concatBytes(...contents);
  return concatBytes(Uint8Array.of(tag), encodeLength(content.length), content);
}

function base128(value: number): Uint8Array {
  const octets = [value & 0x7f];
  let remaining = Math.floor(value / 128);
  while (remaining > 0) {
    octets.unshift((remaining & 0x7f) | 0x80);
    remaining = Math.floor(remaining / 128);
  }
  return Uint8Array.from(octets);
}

function derOid(value: string): Uint8Array {
  const arcs = value.split('.').map(Number);
  if (arcs.length < 2) throw new Error('OID requires at least two arcs.');
  const [first, second, ...remaining] = arcs;
  const encoded = [base128(first! * 40 + second!), ...remaining.map(base128)];
  return der(0x06, concatBytes(...encoded));
}

function derInteger(bytes: Uint8Array): Uint8Array {
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) offset += 1;
  const sliced = bytes.slice(offset);
  const normalized = sliced.length === 0 ? Uint8Array.of(0) : sliced;
  return der(
    0x02,
    (normalized[0]! & 0x80) !== 0
      ? concatBytes(Uint8Array.of(0), normalized)
      : normalized,
  );
}

function algorithmIdentifier(algorithmOid: string): Uint8Array {
  return der(0x30, derOid(algorithmOid));
}

function distinguishedName(commonName: string): Uint8Array {
  return der(
    0x30,
    der(
      0x31,
      der(0x30, derOid(OID_COMMON_NAME), der(0x0c, new TextEncoder().encode(commonName))),
    ),
  );
}

function rawEcdsaSignatureToDer(signature: Uint8Array): Uint8Array {
  if (signature.length !== 64) throw new Error('Expected a P-256 signature.');
  return der(0x30, derInteger(signature.slice(0, 32)), derInteger(signature.slice(32)));
}

function certificateExtension(
  oid: string,
  value: Uint8Array,
  critical = false,
): Uint8Array {
  return der(
    0x30,
    derOid(oid),
    ...(critical ? [der(0x01, Uint8Array.of(0xff))] : []),
    der(0x04, value),
  );
}

function basicConstraintsExtension(isCa: boolean): Uint8Array {
  const constraints = isCa
    ? der(0x30, der(0x01, Uint8Array.of(0xff)))
    : der(0x30);
  return certificateExtension(OID_BASIC_CONSTRAINTS, constraints, true);
}

function storeKitPolicyExtension(oid: string): Uint8Array {
  return certificateExtension(oid, der(0x05));
}

function extensionsBlock(extensions: Uint8Array[]): Uint8Array {
  return der(0xa3, der(0x30, ...extensions));
}

async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
}

async function createCertificate(options: {
  keyPair: CryptoKeyPair;
  issuerPrivateKey: CryptoKey;
  issuerCommonName: string;
  subjectCommonName: string;
  serialNumber: number;
  notBefore: string;
  notAfter: string;
  extensions: Uint8Array[];
}): Promise<TestCertificate> {
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', options.keyPair.publicKey));
  const signatureAlgorithm = algorithmIdentifier(OID_ECDSA_SHA256);
  const validity = der(
    0x30,
    der(0x18, new TextEncoder().encode(options.notBefore)),
    der(0x18, new TextEncoder().encode(options.notAfter)),
  );
  const tbsCertificate = der(
    0x30,
    der(0xa0, derInteger(Uint8Array.of(2))),
    derInteger(Uint8Array.of(options.serialNumber)),
    signatureAlgorithm,
    distinguishedName(options.issuerCommonName),
    validity,
    distinguishedName(options.subjectCommonName),
    spki,
    extensionsBlock(options.extensions),
  );
  const rawSignature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    options.issuerPrivateKey,
    copyToArrayBuffer(tbsCertificate),
  ));
  const certificateDer = der(
    0x30,
    tbsCertificate,
    signatureAlgorithm,
    der(0x03, Uint8Array.of(0), rawEcdsaSignatureToDer(rawSignature)),
  );
  return { certificateDer, privateKey: options.keyPair.privateKey };
}

export async function createTestCertificateChain(
  options: TestCertificateChainOptions = {},
): Promise<TestCertificateChain> {
  const [rootKeyPair, intermediateKeyPair, leafKeyPair] = await Promise.all([
    generateKeyPair(),
    generateKeyPair(),
    generateKeyPair(),
  ]);
  const notBefore = options.notBefore ?? '20260101000000Z';
  const notAfter = options.notAfter ?? '20270101000000Z';
  const rootCommonName = options.rootCommonName ?? 'Apple Root CA G3 Test';
  const intermediateCommonName = options.intermediateCommonName ?? 'Apple StoreKit Test CA';
  const leafCommonName = options.leafCommonName ?? 'Apple StoreKit Test Leaf';

  const root = await createCertificate({
    keyPair: rootKeyPair,
    issuerPrivateKey: rootKeyPair.privateKey,
    issuerCommonName: rootCommonName,
    subjectCommonName: rootCommonName,
    serialNumber: 1,
    notBefore,
    notAfter,
    extensions: [basicConstraintsExtension(true)],
  });
  const intermediateExtensions = [
    basicConstraintsExtension(options.intermediateIsCa ?? true),
  ];
  if (options.intermediateHasStoreKitExtension ?? true) {
    intermediateExtensions.push(storeKitPolicyExtension(OID_APPLE_STOREKIT_INTERMEDIATE));
  }
  const intermediate = await createCertificate({
    keyPair: intermediateKeyPair,
    issuerPrivateKey: rootKeyPair.privateKey,
    issuerCommonName: rootCommonName,
    subjectCommonName: intermediateCommonName,
    serialNumber: 2,
    notBefore,
    notAfter,
    extensions: intermediateExtensions,
  });
  const leafExtensions: Uint8Array[] = [];
  if (options.leafHasStoreKitExtension ?? true) {
    leafExtensions.push(storeKitPolicyExtension(OID_APPLE_STOREKIT_LEAF));
  }
  const leaf = await createCertificate({
    keyPair: leafKeyPair,
    issuerPrivateKey: intermediateKeyPair.privateKey,
    issuerCommonName: intermediateCommonName,
    subjectCommonName: leafCommonName,
    serialNumber: 3,
    notBefore,
    notAfter,
    extensions: leafExtensions,
  });

  return { root, intermediate, leaf };
}

export function validTransactionPayload(
  overrides: Partial<TestTransactionPayload> = {},
): TestTransactionPayload {
  return {
    bundleId: 'com.mylife.yearn',
    productId: 'com.mylife.yearn.boost',
    type: 'Consumable',
    originalTransactionId: 'original-transaction-123',
    transactionId: 'transaction-456',
    environment: 'Production',
    ...overrides,
  };
}

function base64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export function certificateBase64(certificate: TestCertificate): string {
  return base64(certificate.certificateDer);
}

export function certificateChainBase64(
  chain: TestCertificateChain,
): [string, string, string] {
  return [
    certificateBase64(chain.leaf),
    certificateBase64(chain.intermediate),
    certificateBase64(chain.root),
  ];
}

export async function signTestTransaction(
  chain: TestCertificateChain,
  payload: Record<string, unknown>,
  options: {
    header?: Record<string, unknown>;
    privateKey?: CryptoKey;
  } = {},
): Promise<string> {
  const header = options.header ?? {
    alg: 'ES256',
    x5c: certificateChainBase64(chain),
  };
  const encodedHeader = encodeJson(header);
  const encodedPayload = encodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    options.privateKey ?? chain.leaf.privateKey,
    new TextEncoder().encode(signingInput),
  ));
  return `${signingInput}.${base64Url(signature)}`;
}
