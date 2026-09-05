import nacl from 'tweetnacl';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { signMessage, verifySignature } from '../identity/device-identity';
import { isPrivateOrLocalHost } from './adapters/http';

export const STORAGE_AUTH_DOMAIN = 'meerkat-storage-auth-v1' as const;
export const STORAGE_API_V1_PATH = '/api/storage/v1' as const;
export const STORAGE_DESCRIPTOR_PATH = `${STORAGE_API_V1_PATH}/descriptor` as const;
export const STORAGE_CHALLENGE_PATH = `${STORAGE_API_V1_PATH}/challenge` as const;

export const MAX_STORAGE_DESCRIPTOR_TTL_MS = 24 * 60 * 60 * 1_000;
export const MAX_STORAGE_CHALLENGE_TTL_MS = 5 * 60 * 1_000;

export const STORAGE_V1_SUPPORTED_OPERATIONS = [
  'create_upload',
  'complete_upload',
  'head',
  'get',
  'ranged_get',
  'list',
  'delete',
  'quota',
  'health',
  'backup_manifest_list',
  'backup_manifest_put',
  'account_delete',
  'sha512_checksum',
] as const;

export type StorageV1Operation = typeof STORAGE_V1_SUPPORTED_OPERATIONS[number];

/** The signed storage:v1 contract from Plan 41. */
export interface StorageCapabilityDescriptor {
  version: 1;
  endpoint: string;
  operatorKey: string;
  supportedOperations: string[];
  maximumObjectBytes: number;
  quotaBytes: number | null;
  retention: string;
  authDomain: 'meerkat-storage-auth-v1';
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export type UnsignedStorageCapabilityDescriptor = Omit<StorageCapabilityDescriptor, 'signature'>;

export interface StorageChallengeRequest {
  nonce: string;
}

export interface StorageChallengeResponse {
  version: 1;
  authDomain: 'meerkat-storage-auth-v1';
  endpoint: string;
  operatorKey: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export type UnsignedStorageChallengeResponse = Omit<StorageChallengeResponse, 'signature'>;

export type StorageClockValue = number | string | Date;

export interface StorageDescriptorVerificationOptions {
  now?: () => StorageClockValue;
  expectedOperatorKey?: string;
  allowInsecureLocalNetwork?: boolean;
  requiredOperations?: readonly StorageV1Operation[];
}

export interface StorageChallengeVerificationOptions {
  now?: () => StorageClockValue;
}

export interface StorageDescriptorSigningOptions {
  allowInsecureLocalNetwork?: boolean;
}

const encoder = new TextEncoder();
const OPERATOR_PUBLIC_KEY = /^[a-f0-9]{64}$/u;
const OPERATOR_PRIVATE_KEY = /^(?:[a-f0-9]{64}|[a-f0-9]{128})$/u;
const SIGNATURE = /^[a-f0-9]{128}$/u;
const CHALLENGE_NONCE = /^[A-Za-z0-9_-]{32,128}$/u;
const RETENTION_MAX_CHARS = 128;
const supportedOperationSet = new Set<string>(STORAGE_V1_SUPPORTED_OPERATIONS);

const descriptorKeys = [
  'authDomain',
  'endpoint',
  'expiresAt',
  'issuedAt',
  'maximumObjectBytes',
  'operatorKey',
  'quotaBytes',
  'retention',
  'signature',
  'supportedOperations',
  'version',
] as const;

const unsignedDescriptorKeys = descriptorKeys.filter((key) => key !== 'signature');

const challengeKeys = [
  'authDomain',
  'endpoint',
  'expiresAt',
  'issuedAt',
  'nonce',
  'operatorKey',
  'signature',
  'version',
] as const;

const unsignedChallengeKeys = challengeKeys.filter((key) => key !== 'signature');

/** Canonical descriptor bytes with an explicit, fixed field order. */
export function canonicalStorageCapabilityDescriptorBytes(
  descriptor: UnsignedStorageCapabilityDescriptor,
): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-storage-capability-descriptor-v1',
    descriptor.version,
    descriptor.endpoint,
    descriptor.operatorKey,
    [...descriptor.supportedOperations],
    descriptor.maximumObjectBytes,
    descriptor.quotaBytes,
    descriptor.retention,
    descriptor.authDomain,
    descriptor.issuedAt,
    descriptor.expiresAt,
  ]));
}

/** Canonical challenge bytes, bound to the advertised endpoint and operator. */
export function canonicalStorageChallengeResponseBytes(
  response: UnsignedStorageChallengeResponse,
): Uint8Array {
  return encoder.encode(JSON.stringify([
    'meerkat-storage-operator-challenge-response-v1',
    response.version,
    response.authDomain,
    response.endpoint,
    response.operatorKey,
    response.nonce,
    response.issuedAt,
    response.expiresAt,
  ]));
}

export function storageOperatorPublicKeyFromPrivateKey(privateKeyHex: string): string {
  return normalizeOperatorKeyPair(privateKeyHex).publicKeyHex;
}

export function signStorageCapabilityDescriptor(
  descriptor: UnsignedStorageCapabilityDescriptor,
  operatorPrivateKeyHex: string,
  options: StorageDescriptorSigningOptions = {},
): StorageCapabilityDescriptor {
  if (!isUnsignedDescriptor(descriptor, options.allowInsecureLocalNetwork === true)) {
    throw new Error('Storage capability descriptor fields are invalid.');
  }
  const keyPair = normalizeOperatorKeyPair(operatorPrivateKeyHex);
  if (descriptor.operatorKey !== keyPair.publicKeyHex) {
    throw new Error('Storage capability descriptor operator key does not match the signing key.');
  }
  const signature = bytesToHex(signMessage(
    keyPair.secretKeyHex,
    canonicalStorageCapabilityDescriptorBytes(descriptor),
  ));
  return { ...descriptor, supportedOperations: [...descriptor.supportedOperations], signature };
}

/** Verify every signed field and all selection-time security invariants. */
export function verifyStorageCapabilityDescriptor(
  value: unknown,
  options: StorageDescriptorVerificationOptions = {},
): value is StorageCapabilityDescriptor {
  if (!isRecord(value) || !hasExactKeys(value, descriptorKeys)) return false;
  if (!isDescriptorFields(value, options.allowInsecureLocalNetwork === true)) return false;
  if (typeof value.signature !== 'string' || !SIGNATURE.test(value.signature)) return false;
  if (options.expectedOperatorKey !== undefined && value.operatorKey !== options.expectedOperatorKey) {
    return false;
  }
  if (options.requiredOperations?.some((operation) => !value.supportedOperations.includes(operation))) {
    return false;
  }
  const nowMs = clockMs(options.now?.() ?? Date.now());
  const issuedAtMs = canonicalIsoMs(value.issuedAt);
  const expiresAtMs = canonicalIsoMs(value.expiresAt);
  if (nowMs === null || issuedAtMs === null || expiresAtMs === null) return false;
  if (issuedAtMs > nowMs || nowMs >= expiresAtMs) return false;
  if (expiresAtMs - issuedAtMs > MAX_STORAGE_DESCRIPTOR_TTL_MS) return false;

  const { signature, ...unsigned } = value;
  try {
    return verifySignature(
      value.operatorKey,
      canonicalStorageCapabilityDescriptorBytes(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

export function signStorageChallengeResponse(
  response: UnsignedStorageChallengeResponse,
  operatorPrivateKeyHex: string,
  options: StorageDescriptorSigningOptions = {},
): StorageChallengeResponse {
  if (!isUnsignedChallenge(response, options.allowInsecureLocalNetwork === true)) {
    throw new Error('Storage challenge response fields are invalid.');
  }
  const keyPair = normalizeOperatorKeyPair(operatorPrivateKeyHex);
  if (response.operatorKey !== keyPair.publicKeyHex) {
    throw new Error('Storage challenge operator key does not match the signing key.');
  }
  const signature = bytesToHex(signMessage(
    keyPair.secretKeyHex,
    canonicalStorageChallengeResponseBytes(response),
  ));
  return { ...response, signature };
}

export function verifyStorageChallengeResponse(
  value: unknown,
  descriptor: StorageCapabilityDescriptor,
  expectedNonce: string,
  options: StorageChallengeVerificationOptions = {},
): value is StorageChallengeResponse {
  if (!isRecord(value) || !hasExactKeys(value, challengeKeys)) return false;
  if (!isChallengeFields(value, isInsecureLocalEndpoint(descriptor.endpoint))) return false;
  if (typeof value.signature !== 'string' || !SIGNATURE.test(value.signature)) return false;
  if (value.nonce !== expectedNonce
    || value.operatorKey !== descriptor.operatorKey
    || value.endpoint !== descriptor.endpoint) return false;

  const nowMs = clockMs(options.now?.() ?? Date.now());
  const issuedAtMs = canonicalIsoMs(value.issuedAt);
  const expiresAtMs = canonicalIsoMs(value.expiresAt);
  const descriptorIssuedAtMs = canonicalIsoMs(descriptor.issuedAt);
  const descriptorExpiresAtMs = canonicalIsoMs(descriptor.expiresAt);
  if (nowMs === null
    || issuedAtMs === null
    || expiresAtMs === null
    || descriptorIssuedAtMs === null
    || descriptorExpiresAtMs === null) return false;
  if (!verifyStorageCapabilityDescriptor(descriptor, {
    now: () => nowMs,
    expectedOperatorKey: descriptor.operatorKey,
    allowInsecureLocalNetwork: isInsecureLocalEndpoint(descriptor.endpoint),
  })) return false;
  if (issuedAtMs > nowMs || nowMs >= expiresAtMs) return false;
  if (issuedAtMs < descriptorIssuedAtMs || expiresAtMs > descriptorExpiresAtMs) return false;
  if (expiresAtMs - issuedAtMs > MAX_STORAGE_CHALLENGE_TTL_MS) return false;

  const { signature, ...unsigned } = value;
  try {
    return verifySignature(
      descriptor.operatorKey,
      canonicalStorageChallengeResponseBytes(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}

export function createStorageChallengeNonce(
  randomBytes: (length: number) => Uint8Array = (length) => nacl.randomBytes(length),
): string {
  const bytes = randomBytes(32);
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) {
    throw new Error('Storage challenge random source returned an invalid length.');
  }
  try {
    return bytesToHex(bytes);
  } finally {
    bytes.fill(0);
  }
}

export function isValidStorageChallengeNonce(value: unknown): value is string {
  return typeof value === 'string' && CHALLENGE_NONCE.test(value);
}

export function isStorageCapabilityEndpoint(
  value: unknown,
  allowInsecureLocalNetwork = false,
): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username !== '' || url.password !== '' || url.search !== '' || url.hash !== '') return false;
  if (url.protocol === 'https:') return true;
  return url.protocol === 'http:'
    && allowInsecureLocalNetwork
    && isPrivateOrLocalHost(url.hostname);
}

function normalizeOperatorKeyPair(privateKeyHex: string): {
  publicKeyHex: string;
  secretKeyHex: string;
} {
  if (!OPERATOR_PRIVATE_KEY.test(privateKeyHex)) {
    throw new Error('Storage operator key must be a lowercase Ed25519 seed or secret key.');
  }
  const keyBytes = hexToBytes(privateKeyHex);
  try {
    const keyPair = keyBytes.length === nacl.sign.seedLength
      ? nacl.sign.keyPair.fromSeed(keyBytes)
      : nacl.sign.keyPair.fromSecretKey(keyBytes);
    try {
      return {
        publicKeyHex: bytesToHex(keyPair.publicKey),
        secretKeyHex: bytesToHex(keyPair.secretKey),
      };
    } finally {
      keyPair.secretKey.fill(0);
    }
  } finally {
    keyBytes.fill(0);
  }
}

function isUnsignedDescriptor(
  value: UnsignedStorageCapabilityDescriptor,
  allowInsecureLocalNetwork: boolean,
): boolean {
  const record = value as unknown;
  return isRecord(record)
    && hasExactKeys(record, unsignedDescriptorKeys)
    && isDescriptorFields(record, allowInsecureLocalNetwork);
}

function isDescriptorFields(
  value: Record<string, unknown>,
  allowInsecureLocalNetwork: boolean,
): value is Record<string, unknown> & UnsignedStorageCapabilityDescriptor {
  if (value.version !== 1
    || value.authDomain !== STORAGE_AUTH_DOMAIN
    || !isStorageCapabilityEndpoint(value.endpoint, allowInsecureLocalNetwork)
    || typeof value.operatorKey !== 'string'
    || !OPERATOR_PUBLIC_KEY.test(value.operatorKey)
    || !validOperations(value.supportedOperations)
    || !positiveSafeInteger(value.maximumObjectBytes)
    || !(value.quotaBytes === null || nonNegativeSafeInteger(value.quotaBytes))
    || typeof value.retention !== 'string'
    || value.retention.length < 1
    || value.retention.length > RETENTION_MAX_CHARS
    || containsControlCharacter(value.retention)
    || typeof value.issuedAt !== 'string'
    || typeof value.expiresAt !== 'string') return false;
  const issuedAtMs = canonicalIsoMs(value.issuedAt);
  const expiresAtMs = canonicalIsoMs(value.expiresAt);
  return issuedAtMs !== null
    && expiresAtMs !== null
    && issuedAtMs < expiresAtMs
    && expiresAtMs - issuedAtMs <= MAX_STORAGE_DESCRIPTOR_TTL_MS;
}

function isUnsignedChallenge(
  value: UnsignedStorageChallengeResponse,
  allowInsecureLocalNetwork: boolean,
): boolean {
  const record = value as unknown;
  return isRecord(record)
    && hasExactKeys(record, unsignedChallengeKeys)
    && isChallengeFields(record, allowInsecureLocalNetwork);
}

function isChallengeFields(
  value: Record<string, unknown>,
  allowInsecureLocalNetwork: boolean,
): value is Record<string, unknown> & UnsignedStorageChallengeResponse {
  if (value.version !== 1
    || value.authDomain !== STORAGE_AUTH_DOMAIN
    || !isStorageCapabilityEndpoint(value.endpoint, allowInsecureLocalNetwork)
    || typeof value.operatorKey !== 'string'
    || !OPERATOR_PUBLIC_KEY.test(value.operatorKey)
    || !isValidStorageChallengeNonce(value.nonce)
    || typeof value.issuedAt !== 'string'
    || typeof value.expiresAt !== 'string') return false;
  const issuedAtMs = canonicalIsoMs(value.issuedAt);
  const expiresAtMs = canonicalIsoMs(value.expiresAt);
  return issuedAtMs !== null
    && expiresAtMs !== null
    && issuedAtMs < expiresAtMs
    && expiresAtMs - issuedAtMs <= MAX_STORAGE_CHALLENGE_TTL_MS;
}

function validOperations(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > STORAGE_V1_SUPPORTED_OPERATIONS.length) return false;
  const seen = new Set<string>();
  for (const operation of value) {
    if (typeof operation !== 'string' || !supportedOperationSet.has(operation) || seen.has(operation)) {
      return false;
    }
    seen.add(operation);
  }
  return true;
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

function canonicalIsoMs(value: string): number | null {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString() === value ? timestamp : null;
}

function clockMs(value: StorageClockValue): number | null {
  const timestamp = value instanceof Date
    ? value.getTime()
    : typeof value === 'number'
      ? value
      : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function positiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function nonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isInsecureLocalEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'http:' && isPrivateOrLocalHost(url.hostname);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
