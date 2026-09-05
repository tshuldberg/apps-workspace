import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { decrypt, encrypt } from '../encryption/encrypt';
import { bytesToHex, hexToBytes } from '../encryption/keys';
import { hkdf, sha512Hex } from '../node/hkdf';
import { parseRecoveryKey } from '../node/recovery-key';

const { encodeUTF8 } = naclUtil;
const encoder = new TextEncoder();

export const BACKUP_FORMAT_VERSION = 1 as const;
export const BACKUP_MANIFEST_PATH = 'manifest.mkmanifest';
export const BACKUP_IDENTITY_PATH = 'identity/recovery.mkchunk';

const BACKUP_ROOT_INFO = 'meerkat-storage-backup-v1:';
const BACKUP_CHUNK_INFO = 'meerkat-storage-backup-v1/chunk:';
const MANIFEST_DOMAIN = 'meerkat-storage-backup-manifest-v1';
const MANIFEST_ENVELOPE_DOMAIN = 'meerkat-storage-backup-manifest-envelope-v1';
const HASH_PATTERN = /^[a-f0-9]{128}$/;
const PUBLIC_KEY_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SECRETBOX_OVERHEAD = nacl.secretbox.nonceLength + nacl.secretbox.overheadLength;
const MAX_MANIFEST_ENTRIES = 1_000_000;

export type BackupChunkPurpose = 'manifest' | 'database' | 'object';

export interface BackupLocator {
  formatVersion: 1;
  backupId: string;
  encryptedManifestHash: string;
  createdAt: string;
}

export interface BackupChunkDescriptor {
  index: number;
  plaintextBytes: number;
  encryptedBytes: number;
  plaintextHash: string;
  ciphertextHash: string;
}

export interface BackupObjectDescriptor {
  objectId: string;
  dataClass: string;
  chunks: readonly BackupChunkDescriptor[];
}

export interface BackupIdentityDescriptor {
  encryptedBytes: number;
  ciphertextHash: string;
}

export interface BackupManifest {
  formatVersion: 1;
  backupId: string;
  createdAt: string;
  schemaVersion: number;
  migrationVersion: number;
  appVersion: string;
  dataClassVersions: Readonly<Record<string, number>>;
  databaseChunks: readonly BackupChunkDescriptor[];
  objects: readonly BackupObjectDescriptor[];
  identity: BackupIdentityDescriptor | null;
  deviceId: string;
  devicePublicKey: string;
}

export interface BackupSigningIdentity {
  deviceId: string;
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface BackupObjectInput {
  objectId: string;
  dataClass: string;
  chunks: readonly Uint8Array[];
}

export interface EncodeBackupInput {
  recoveryKey: string;
  backupId: string;
  createdAt: string;
  schemaVersion: number;
  migrationVersion: number;
  appVersion: string;
  dataClassVersions: Readonly<Record<string, number>>;
  databaseChunks: readonly Uint8Array[];
  objects: readonly BackupObjectInput[];
  sealedRecoveryBundle?: string;
  signingIdentity: BackupSigningIdentity;
  /** Deterministic test seam. Each call receives a backup-global envelope index. */
  nonceSource?: (index: number) => Uint8Array;
}

export type BackupEncoderInput = Omit<EncodeBackupInput, 'databaseChunks' | 'objects'>;

export interface EncryptedBackupChunk {
  path: string;
  purpose: 'database' | 'object';
  objectId: string;
  index: number;
  envelope: Uint8Array;
  encryptedBytes: number;
  ciphertextHash: string;
}

export interface EncryptedBackupManifest {
  path: typeof BACKUP_MANIFEST_PATH;
  envelope: Uint8Array;
  encryptedBytes: number;
  ciphertextHash: string;
}

export interface BackupIdentityChunk {
  path: typeof BACKUP_IDENTITY_PATH;
  envelope: Uint8Array;
  encryptedBytes: number;
  ciphertextHash: string;
}

export interface EncodedBackup {
  locatorJson: string;
  manifest: EncryptedBackupManifest;
  databaseChunks: readonly EncryptedBackupChunk[];
  objectChunks: readonly EncryptedBackupChunk[];
  identityChunk: BackupIdentityChunk | null;
}

export interface BackupEncoderFinalizeResult {
  locatorJson: string;
  manifest: EncryptedBackupManifest;
  /** Descriptor for the optional, already sealed identity recovery chunk. */
  manifestDescriptor: BackupIdentityDescriptor | null;
  /** Optional sealed recovery identity bytes described and signed by the manifest. */
  identityChunk: BackupIdentityChunk | null;
}

export interface BackupEncoder {
  addDatabaseChunk(plaintext: Uint8Array): EncryptedBackupChunk;
  addObjectChunk(
    objectId: string,
    dataClass: string,
    plaintext: Uint8Array,
  ): EncryptedBackupChunk;
  finalize(): BackupEncoderFinalizeResult;
}

export interface DecodedBackupObject {
  objectId: string;
  dataClass: string;
  chunks: readonly Uint8Array[];
}

export interface DecodedBackup {
  locator: BackupLocator;
  manifest: BackupManifest;
  manifestSignature: string;
  databaseChunks: readonly Uint8Array[];
  objects: readonly DecodedBackupObject[];
  sealedRecoveryBundle: string | null;
}

export type BackupDecodeErrorCode =
  | 'wrong_key'
  | 'tampered_chunk'
  | 'truncated'
  | 'chunk_order'
  | 'bad_signature'
  | 'locator_mismatch'
  | 'unsupported_version'
  | 'missing_chunk';

export class BackupDecodeError extends Error {
  readonly code: BackupDecodeErrorCode;
  readonly path?: string;

  constructor(code: BackupDecodeErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'BackupDecodeError';
    this.code = code;
    this.path = path;
  }
}

export type DecodeBackupResult =
  | ({ ok: true } & DecodedBackup)
  | { ok: false; error: BackupDecodeError };

export interface DecodeBackupOptions {
  expectedDevicePublicKey?: string;
}

export type BackupChunkTarget =
  | { kind: 'database'; index: number }
  | { kind: 'object'; objectId: string; index: number };

export type OpenBackupManifestResult =
  | {
    ok: true;
    locator: BackupLocator;
    manifest: BackupManifest;
    manifestSignature: string;
    /** Secret restore material. Callers must drop this key after restore completes. */
    backupRootKey: Uint8Array;
  }
  | { ok: false; error: BackupDecodeError };

export type VerifyBackupChunkResult =
  | { ok: true; plaintext: Uint8Array }
  | { ok: false; error: BackupDecodeError };

export type VerifyBackupIdentityResult =
  | { ok: true; sealedRecoveryBundle: string }
  | { ok: false; error: BackupDecodeError };

class BinaryTruncatedError extends Error {}

class BinaryWriter {
  private readonly parts: Uint8Array[] = [];
  private length = 0;

  u8(value: number): void {
    this.add(new Uint8Array([value]));
  }

  u32(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
      throw new Error('value is outside uint32');
    }
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value, false);
    this.add(bytes);
  }

  u64(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('value is outside safe uint64');
    const bytes = new Uint8Array(8);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, Math.floor(value / 0x1_0000_0000), false);
    view.setUint32(4, value >>> 0, false);
    this.add(bytes);
  }

  string(value: string): void {
    this.bytes(encoder.encode(value));
  }

  bytes(value: Uint8Array): void {
    this.u32(value.length);
    this.add(value);
  }

  finish(): Uint8Array {
    const output = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  private add(value: Uint8Array): void {
    this.parts.push(value);
    this.length += value.length;
  }
}

class BinaryReader {
  private offset = 0;

  constructor(private readonly value: Uint8Array) {}

  u8(): number {
    return this.take(1)[0] ?? 0;
  }

  u32(): number {
    const bytes = this.take(4);
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, false);
  }

  u64(): number {
    const bytes = this.take(8);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const value = view.getUint32(0, false) * 0x1_0000_0000 + view.getUint32(4, false);
    if (!Number.isSafeInteger(value)) throw new Error('uint64 exceeds JavaScript safe integer range');
    return value;
  }

  string(): string {
    return encodeUTF8(this.bytes());
  }

  bytes(): Uint8Array {
    return this.take(this.u32());
  }

  done(): boolean {
    return this.offset === this.value.length;
  }

  private take(length: number): Uint8Array {
    if (length < 0 || this.offset + length > this.value.length) throw new BinaryTruncatedError();
    const bytes = this.value.slice(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertSafeCount(count: number): void {
  if (count > MAX_MANIFEST_ENTRIES) throw new Error('manifest entry count exceeds safety cap');
}

function writeChunkDescriptor(writer: BinaryWriter, chunk: BackupChunkDescriptor): void {
  writer.u32(chunk.index);
  writer.u64(chunk.plaintextBytes);
  writer.u64(chunk.encryptedBytes);
  writer.string(chunk.plaintextHash);
  writer.string(chunk.ciphertextHash);
}

function readChunkDescriptor(reader: BinaryReader): BackupChunkDescriptor {
  return {
    index: reader.u32(),
    plaintextBytes: reader.u64(),
    encryptedBytes: reader.u64(),
    plaintextHash: reader.string(),
    ciphertextHash: reader.string(),
  };
}

function orderedChunks(chunks: readonly BackupChunkDescriptor[]): BackupChunkDescriptor[] {
  return [...chunks].sort((left, right) => left.index - right.index);
}

function orderedObjects(objects: readonly BackupObjectDescriptor[]): BackupObjectDescriptor[] {
  return [...objects].sort((left, right) => compareStrings(left.objectId, right.objectId));
}

/** Explicit field-by-field canonical encoding used for both signing and verification. */
export function canonicalBackupManifest(manifest: BackupManifest): Uint8Array {
  const writer = new BinaryWriter();
  writer.string(MANIFEST_DOMAIN);
  writer.u32(manifest.formatVersion);
  writer.string(manifest.backupId);
  writer.string(manifest.createdAt);
  writer.u64(manifest.schemaVersion);
  writer.u64(manifest.migrationVersion);
  writer.string(manifest.appVersion);

  const dataClassVersions = Object.entries(manifest.dataClassVersions)
    .sort(([left], [right]) => compareStrings(left, right));
  writer.u32(dataClassVersions.length);
  for (const [dataClass, version] of dataClassVersions) {
    writer.string(dataClass);
    writer.u64(version);
  }

  const databaseChunks = orderedChunks(manifest.databaseChunks);
  writer.u32(databaseChunks.length);
  for (const chunk of databaseChunks) writeChunkDescriptor(writer, chunk);

  const objects = orderedObjects(manifest.objects);
  writer.u32(objects.length);
  for (const object of objects) {
    writer.string(object.objectId);
    writer.string(object.dataClass);
    const chunks = orderedChunks(object.chunks);
    writer.u32(chunks.length);
    for (const chunk of chunks) writeChunkDescriptor(writer, chunk);
  }

  if (manifest.identity === null) {
    writer.u8(0);
  } else {
    writer.u8(1);
    writer.u64(manifest.identity.encryptedBytes);
    writer.string(manifest.identity.ciphertextHash);
  }
  writer.string(manifest.deviceId);
  writer.string(manifest.devicePublicKey);
  return writer.finish();
}

function parseCanonicalBackupManifest(bytes: Uint8Array): BackupManifest {
  const reader = new BinaryReader(bytes);
  if (reader.string() !== MANIFEST_DOMAIN) throw new Error('manifest domain mismatch');
  const formatVersion = reader.u32();
  if (formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupDecodeError('unsupported_version', `unsupported manifest version ${formatVersion}`);
  }
  const backupId = reader.string();
  const createdAt = reader.string();
  const schemaVersion = reader.u64();
  const migrationVersion = reader.u64();
  const appVersion = reader.string();

  const dataClassCount = reader.u32();
  assertSafeCount(dataClassCount);
  const dataClassVersions = Object.create(null) as Record<string, number>;
  for (let index = 0; index < dataClassCount; index += 1) {
    const dataClass = reader.string();
    if (Object.prototype.hasOwnProperty.call(dataClassVersions, dataClass)) {
      throw new Error('duplicate data class');
    }
    dataClassVersions[dataClass] = reader.u64();
  }

  const databaseCount = reader.u32();
  assertSafeCount(databaseCount);
  const databaseChunks: BackupChunkDescriptor[] = [];
  for (let index = 0; index < databaseCount; index += 1) {
    databaseChunks.push(readChunkDescriptor(reader));
  }

  const objectCount = reader.u32();
  assertSafeCount(objectCount);
  const objects: BackupObjectDescriptor[] = [];
  for (let objectIndex = 0; objectIndex < objectCount; objectIndex += 1) {
    const objectId = reader.string();
    const dataClass = reader.string();
    const chunkCount = reader.u32();
    assertSafeCount(chunkCount);
    const chunks: BackupChunkDescriptor[] = [];
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      chunks.push(readChunkDescriptor(reader));
    }
    objects.push({ objectId, dataClass, chunks });
  }

  const identityMarker = reader.u8();
  let identity: BackupIdentityDescriptor | null = null;
  if (identityMarker === 1) {
    identity = { encryptedBytes: reader.u64(), ciphertextHash: reader.string() };
  } else if (identityMarker !== 0) {
    throw new Error('invalid identity marker');
  }
  const deviceId = reader.string();
  const devicePublicKey = reader.string();
  if (!reader.done()) throw new Error('trailing manifest bytes');

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    backupId,
    createdAt,
    schemaVersion,
    migrationVersion,
    appVersion,
    dataClassVersions,
    databaseChunks,
    objects,
    identity,
    deviceId,
    devicePublicKey,
  };
}

function encodeSignedManifest(canonical: Uint8Array, signature: Uint8Array): Uint8Array {
  const writer = new BinaryWriter();
  writer.string(MANIFEST_ENVELOPE_DOMAIN);
  writer.bytes(canonical);
  writer.bytes(signature);
  return writer.finish();
}

function parseSignedManifest(bytes: Uint8Array): { canonical: Uint8Array; signature: Uint8Array } {
  const reader = new BinaryReader(bytes);
  if (reader.string() !== MANIFEST_ENVELOPE_DOMAIN) throw new Error('manifest envelope domain mismatch');
  const canonical = reader.bytes();
  const signature = reader.bytes();
  if (!reader.done()) throw new Error('trailing manifest envelope bytes');
  return { canonical, signature };
}

export function deriveBackupRootKey(recoveryKeyBytes: Uint8Array, backupId: string): Uint8Array {
  return hkdf(recoveryKeyBytes, `${BACKUP_ROOT_INFO}${backupId}`);
}

export function deriveBackupChunkKey(
  backupRootKey: Uint8Array,
  purpose: BackupChunkPurpose,
  objectId: string,
  chunkIndex: number,
): Uint8Array {
  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) throw new Error('invalid chunk index');
  return hkdf(backupRootKey, `${BACKUP_CHUNK_INFO}${purpose}:${objectId}:${chunkIndex}`);
}

function databasePath(index: number): string {
  return `database/${index.toString().padStart(6, '0')}.mkchunk`;
}

function objectPath(objectId: string, index: number): string {
  return `objects/${objectId}/${index.toString().padStart(6, '0')}.mkchunk`;
}

function parseRecoveryKeyOrThrow(recoveryKey: string): Uint8Array {
  const bytes = parseRecoveryKey(recoveryKey);
  if (bytes === null) throw new Error('recovery key is malformed or has a bad checksum');
  return bytes;
}

function validateSafeId(value: string, label: string): void {
  if (!SAFE_ID_PATTERN.test(value)) throw new Error(`${label} must be a path-safe opaque id`);
}

function validateVersion(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
}

function validateBackupEncoderInput(input: BackupEncoderInput): void {
  validateSafeId(input.backupId, 'backupId');
  if (!ISO_DATE_PATTERN.test(input.createdAt)) throw new Error('createdAt must be UTC ISO-8601');
  validateVersion(input.schemaVersion, 'schemaVersion');
  validateVersion(input.migrationVersion, 'migrationVersion');
  if (input.appVersion.length === 0) throw new Error('appVersion is required');
  if (input.signingIdentity.deviceId.length === 0) throw new Error('deviceId is required');
  if (input.signingIdentity.publicKey.length !== nacl.sign.publicKeyLength) {
    throw new Error('device signing public key has the wrong length');
  }
  if (input.signingIdentity.secretKey.length !== nacl.sign.secretKeyLength) {
    throw new Error('device signing secret key has the wrong length');
  }
  const derivedPublicKey = nacl.sign.keyPair.fromSecretKey(input.signingIdentity.secretKey).publicKey;
  if (!bytesEqual(derivedPublicKey, input.signingIdentity.publicKey)) {
    throw new Error('device signing keypair is inconsistent');
  }
  for (const [dataClass, version] of Object.entries(input.dataClassVersions)) {
    if (dataClass.length === 0) throw new Error('data class names cannot be empty');
    validateVersion(version, `dataClassVersions.${dataClass}`);
  }
  if (input.sealedRecoveryBundle !== undefined && !input.sealedRecoveryBundle.includes('.')) {
    throw new Error('sealedRecoveryBundle must use the existing sealed recovery format');
  }
}

function validateEncodeInput(input: EncodeBackupInput): void {
  validateBackupEncoderInput(input);
  if (input.databaseChunks.length === 0) throw new Error('at least one database chunk is required');
  const objectIds = new Set<string>();
  for (const object of input.objects) {
    validateSafeId(object.objectId, 'objectId');
    if (objectIds.has(object.objectId)) throw new Error('object ids must be unique');
    if (object.dataClass.length === 0) throw new Error('object dataClass is required');
    if (object.chunks.length === 0) throw new Error('backup objects require at least one chunk');
    objectIds.add(object.objectId);
  }
}

function createEnvelopeSealer(nonceSource?: (index: number) => Uint8Array) {
  const seenNonces = new Set<string>();
  let sequence = 0;
  return (plaintext: Uint8Array, key: Uint8Array): Uint8Array => {
    if (nonceSource !== undefined) {
      const nonce = nonceSource(sequence);
      sequence += 1;
      if (nonce.length !== nacl.secretbox.nonceLength) throw new Error('nonceSource returned the wrong length');
      const nonceHex = bytesToHex(nonce);
      if (seenNonces.has(nonceHex)) throw new Error('nonceSource reused a nonce');
      seenNonces.add(nonceHex);
      const box = nacl.secretbox(plaintext, nonce, key);
      const envelope = new Uint8Array(nonce.length + box.length);
      envelope.set(nonce, 0);
      envelope.set(box, nonce.length);
      return envelope;
    }

    for (;;) {
      const sealed = encrypt(plaintext, key);
      const nonceHex = bytesToHex(sealed.nonce);
      if (seenNonces.has(nonceHex)) continue;
      seenNonces.add(nonceHex);
      const envelope = new Uint8Array(sealed.nonce.length + sealed.ciphertext.length);
      envelope.set(sealed.nonce, 0);
      envelope.set(sealed.ciphertext, sealed.nonce.length);
      return envelope;
    }
  };
}

function chunkDescriptor(index: number, plaintext: Uint8Array, envelope: Uint8Array): BackupChunkDescriptor {
  return {
    index,
    plaintextBytes: plaintext.length,
    encryptedBytes: envelope.length,
    plaintextHash: sha512Hex(plaintext),
    ciphertextHash: sha512Hex(envelope),
  };
}

export function serializeBackupLocator(locator: BackupLocator): string {
  return `{"formatVersion":1,"backupId":${JSON.stringify(locator.backupId)},` +
    `"encryptedManifestHash":${JSON.stringify(locator.encryptedManifestHash)},` +
    `"createdAt":${JSON.stringify(locator.createdAt)}}`;
}

export function parseBackupLocator(locatorJson: string): BackupLocator {
  let parsed: unknown;
  try {
    parsed = JSON.parse(locatorJson) as unknown;
  } catch {
    throw new BackupDecodeError('locator_mismatch', 'locator.json is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BackupDecodeError('locator_mismatch', 'locator.json must be an object');
  }
  const value = parsed as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const expectedKeys = ['backupId', 'createdAt', 'encryptedManifestHash', 'formatVersion'];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new BackupDecodeError('locator_mismatch', 'locator.json has unexpected fields');
  }
  if (value.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new BackupDecodeError('unsupported_version', `unsupported locator version ${String(value.formatVersion)}`);
  }
  if (
    typeof value.backupId !== 'string'
    || !SAFE_ID_PATTERN.test(value.backupId)
    || typeof value.createdAt !== 'string'
    || !ISO_DATE_PATTERN.test(value.createdAt)
    || typeof value.encryptedManifestHash !== 'string'
    || !HASH_PATTERN.test(value.encryptedManifestHash)
  ) {
    throw new BackupDecodeError('locator_mismatch', 'locator.json contains malformed fields');
  }
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    backupId: value.backupId,
    encryptedManifestHash: value.encryptedManifestHash,
    createdAt: value.createdAt,
  };
}

function createIdentityChunk(sealedRecoveryBundle?: string): BackupIdentityChunk | null {
  if (sealedRecoveryBundle === undefined) return null;
  const envelope = encoder.encode(sealedRecoveryBundle);
  return {
    path: BACKUP_IDENTITY_PATH,
    envelope,
    encryptedBytes: envelope.length,
    ciphertextHash: sha512Hex(envelope),
  };
}

/**
 * Creates a bounded Backup Format v1 encoder. Chunk plaintext and envelopes are
 * never retained after an add call returns. Only signed-manifest descriptors remain.
 */
export function createBackupEncoder(input: BackupEncoderInput): BackupEncoder {
  validateBackupEncoderInput(input);
  const backupId = input.backupId;
  const createdAt = input.createdAt;
  const schemaVersion = input.schemaVersion;
  const migrationVersion = input.migrationVersion;
  const appVersion = input.appVersion;
  const deviceId = input.signingIdentity.deviceId;
  const recoveryKeyBytes = parseRecoveryKeyOrThrow(input.recoveryKey);
  const backupRootKey = deriveBackupRootKey(recoveryKeyBytes, backupId);
  recoveryKeyBytes.fill(0);
  const signingSecretKey = input.signingIdentity.secretKey.slice();
  const devicePublicKey = bytesToHex(input.signingIdentity.publicKey);
  const dataClassVersions = { ...input.dataClassVersions };
  const identityChunk = createIdentityChunk(input.sealedRecoveryBundle);
  const identityDescriptor = identityChunk === null ? null : {
    encryptedBytes: identityChunk.encryptedBytes,
    ciphertextHash: identityChunk.ciphertextHash,
  };
  const sealEnvelope = createEnvelopeSealer(input.nonceSource);
  const databaseDescriptors: BackupChunkDescriptor[] = [];
  const objectDescriptors = new Map<
    string,
    { dataClass: string; chunks: BackupChunkDescriptor[] }
  >();
  let finalized = false;

  const assertOpen = (): void => {
    if (finalized) throw new Error('backup encoder is already finalized');
  };

  const addDatabaseChunk = (plaintext: Uint8Array): EncryptedBackupChunk => {
    assertOpen();
    if (databaseDescriptors.length >= MAX_MANIFEST_ENTRIES) {
      throw new Error('database chunk count exceeds safety cap');
    }
    const index = databaseDescriptors.length;
    const key = deriveBackupChunkKey(backupRootKey, 'database', 'database', index);
    let envelope: Uint8Array;
    try {
      envelope = sealEnvelope(plaintext, key);
    } finally {
      key.fill(0);
    }
    const descriptor = chunkDescriptor(index, plaintext, envelope);
    databaseDescriptors.push(descriptor);
    return {
      path: databasePath(index),
      purpose: 'database',
      objectId: 'database',
      index,
      envelope,
      encryptedBytes: envelope.length,
      ciphertextHash: descriptor.ciphertextHash,
    };
  };

  const addObjectChunk = (
    objectId: string,
    dataClass: string,
    plaintext: Uint8Array,
  ): EncryptedBackupChunk => {
    assertOpen();
    validateSafeId(objectId, 'objectId');
    if (dataClass.length === 0) throw new Error('object dataClass is required');
    const existing = objectDescriptors.get(objectId);
    if (existing !== undefined && existing.dataClass !== dataClass) {
      throw new Error('object dataClass cannot change between chunks');
    }
    if (existing === undefined && objectDescriptors.size >= MAX_MANIFEST_ENTRIES) {
      throw new Error('object count exceeds safety cap');
    }
    const index = existing?.chunks.length ?? 0;
    if (index >= MAX_MANIFEST_ENTRIES) throw new Error('object chunk count exceeds safety cap');
    const key = deriveBackupChunkKey(backupRootKey, 'object', objectId, index);
    let envelope: Uint8Array;
    try {
      envelope = sealEnvelope(plaintext, key);
    } finally {
      key.fill(0);
    }
    const descriptor = chunkDescriptor(index, plaintext, envelope);
    if (existing === undefined) {
      objectDescriptors.set(objectId, { dataClass, chunks: [descriptor] });
    } else {
      existing.chunks.push(descriptor);
    }
    return {
      path: objectPath(objectId, index),
      purpose: 'object',
      objectId,
      index,
      envelope,
      encryptedBytes: envelope.length,
      ciphertextHash: descriptor.ciphertextHash,
    };
  };

  const finalize = (): BackupEncoderFinalizeResult => {
    assertOpen();
    finalized = true;
    try {
      if (databaseDescriptors.length === 0) throw new Error('at least one database chunk is required');
      const objects: BackupObjectDescriptor[] = [...objectDescriptors.entries()]
        .sort(([left], [right]) => compareStrings(left, right))
        .map(([objectId, value]) => ({
          objectId,
          dataClass: value.dataClass,
          chunks: value.chunks,
      }));
      const backupManifest: BackupManifest = {
        formatVersion: BACKUP_FORMAT_VERSION,
        backupId,
        createdAt,
        schemaVersion,
        migrationVersion,
        appVersion,
        dataClassVersions,
        databaseChunks: databaseDescriptors,
        objects,
        identity: identityDescriptor,
        deviceId,
        devicePublicKey,
      };
      const canonical = canonicalBackupManifest(backupManifest);
      const signature = nacl.sign.detached(canonical, signingSecretKey);
      const signedManifest = encodeSignedManifest(canonical, signature);
      const manifestKey = deriveBackupChunkKey(backupRootKey, 'manifest', 'manifest', 0);
      let manifestEnvelope: Uint8Array;
      try {
        manifestEnvelope = sealEnvelope(signedManifest, manifestKey);
      } finally {
        manifestKey.fill(0);
      }
      const manifestCiphertextHash = sha512Hex(manifestEnvelope);
      const locator: BackupLocator = {
        formatVersion: BACKUP_FORMAT_VERSION,
        backupId,
        encryptedManifestHash: manifestCiphertextHash,
        createdAt,
      };

      return {
        locatorJson: serializeBackupLocator(locator),
        manifest: {
          path: BACKUP_MANIFEST_PATH,
          envelope: manifestEnvelope,
          encryptedBytes: manifestEnvelope.length,
          ciphertextHash: manifestCiphertextHash,
        },
        manifestDescriptor: identityDescriptor,
        identityChunk,
      };
    } finally {
      backupRootKey.fill(0);
      signingSecretKey.fill(0);
      databaseDescriptors.length = 0;
      objectDescriptors.clear();
    }
  };

  return { addDatabaseChunk, addObjectChunk, finalize };
}

export function encodeBackup(input: EncodeBackupInput): EncodedBackup {
  validateEncodeInput(input);
  const backupEncoder = createBackupEncoder(input);
  const databaseChunks = input.databaseChunks.map((plaintext) => (
    backupEncoder.addDatabaseChunk(plaintext)
  ));
  const objectChunks: EncryptedBackupChunk[] = [];
  const sortedObjects = [...input.objects]
    .sort((left, right) => compareStrings(left.objectId, right.objectId));
  for (const object of sortedObjects) {
    for (const plaintext of object.chunks) {
      objectChunks.push(backupEncoder.addObjectChunk(object.objectId, object.dataClass, plaintext));
    }
  }
  const finalizedBackup = backupEncoder.finalize();

  return {
    locatorJson: finalizedBackup.locatorJson,
    manifest: finalizedBackup.manifest,
    databaseChunks,
    objectChunks,
    identityChunk: finalizedBackup.identityChunk,
  };
}

function openEnvelope(envelope: Uint8Array, key: Uint8Array): Uint8Array | null {
  if (envelope.length < SECRETBOX_OVERHEAD) return null;
  const nonce = envelope.slice(0, nacl.secretbox.nonceLength);
  const ciphertext = envelope.slice(nacl.secretbox.nonceLength);
  return decrypt(ciphertext, nonce, key);
}

function fail(code: BackupDecodeErrorCode, message: string, path?: string): never {
  throw new BackupDecodeError(code, message, path);
}

function verifyHashShape(hash: string, path: string): void {
  if (!HASH_PATTERN.test(hash)) fail('tampered_chunk', 'ciphertext hash is malformed', path);
}

function validateManifestStructure(manifest: BackupManifest): void {
  validateSafeId(manifest.backupId, 'backupId');
  if (!ISO_DATE_PATTERN.test(manifest.createdAt)) throw new Error('manifest createdAt is malformed');
  validateVersion(manifest.schemaVersion, 'schemaVersion');
  validateVersion(manifest.migrationVersion, 'migrationVersion');
  if (manifest.appVersion.length === 0 || manifest.deviceId.length === 0) {
    throw new Error('manifest required fields are empty');
  }
  if (!PUBLIC_KEY_PATTERN.test(manifest.devicePublicKey)) throw new Error('device public key is malformed');
  const dataClassNames = Object.keys(manifest.dataClassVersions);
  if (new Set(dataClassNames).size !== dataClassNames.length || dataClassNames.some((name) => name.length === 0)) {
    throw new Error('data class versions are malformed');
  }
  for (const version of Object.values(manifest.dataClassVersions)) validateVersion(version, 'data class version');

  const validateChunks = (chunks: readonly BackupChunkDescriptor[]): void => {
    chunks.forEach((chunk, index) => {
      if (chunk.index !== index) throw new Error('manifest chunk order is malformed');
      validateVersion(chunk.plaintextBytes, 'plaintextBytes');
      validateVersion(chunk.encryptedBytes, 'encryptedBytes');
      if (chunk.encryptedBytes < SECRETBOX_OVERHEAD) throw new Error('encrypted chunk is too short');
      if (!HASH_PATTERN.test(chunk.plaintextHash) || !HASH_PATTERN.test(chunk.ciphertextHash)) {
        throw new Error('manifest chunk hash is malformed');
      }
    });
  };
  if (manifest.databaseChunks.length === 0) throw new Error('manifest has no database chunks');
  validateChunks(manifest.databaseChunks);
  const objectIds = new Set<string>();
  for (const object of manifest.objects) {
    validateSafeId(object.objectId, 'objectId');
    if (objectIds.has(object.objectId) || object.dataClass.length === 0 || object.chunks.length === 0) {
      throw new Error('manifest object is malformed');
    }
    objectIds.add(object.objectId);
    validateChunks(object.chunks);
  }
  if (manifest.identity !== null) {
    validateVersion(manifest.identity.encryptedBytes, 'identity encryptedBytes');
    if (manifest.identity.encryptedBytes === 0 || !HASH_PATTERN.test(manifest.identity.ciphertextHash)) {
      throw new Error('identity marker is malformed');
    }
  }
}

function asBackupDecodeError(error: unknown, fallbackMessage: string): BackupDecodeError {
  if (error instanceof BackupDecodeError) return error;
  return new BackupDecodeError('tampered_chunk', fallbackMessage);
}

function openBackupManifestOrThrow(
  locatorJson: string,
  manifestEnvelope: Uint8Array,
  recoveryKey: string,
  options?: DecodeBackupOptions,
): Omit<Extract<OpenBackupManifestResult, { ok: true }>, 'ok'> {
  const locator = parseBackupLocator(locatorJson);
  if (manifestEnvelope.length < SECRETBOX_OVERHEAD) {
    fail('truncated', 'manifest ciphertext is truncated', BACKUP_MANIFEST_PATH);
  }
  if (sha512Hex(manifestEnvelope) !== locator.encryptedManifestHash) {
    fail('tampered_chunk', 'encrypted manifest hash mismatch', BACKUP_MANIFEST_PATH);
  }

  const recoveryKeyBytes = parseRecoveryKey(recoveryKey);
  if (recoveryKeyBytes === null) fail('wrong_key', 'recovery key is invalid');
  const backupRootKey = deriveBackupRootKey(recoveryKeyBytes, locator.backupId);
  recoveryKeyBytes.fill(0);
  try {
    const manifestKey = deriveBackupChunkKey(backupRootKey, 'manifest', 'manifest', 0);
    let openedManifest: Uint8Array | null;
    try {
      openedManifest = openEnvelope(manifestEnvelope, manifestKey);
    } finally {
      manifestKey.fill(0);
    }
    if (openedManifest === null) fail('wrong_key', 'recovery key cannot open the manifest');

    let signedManifest: { canonical: Uint8Array; signature: Uint8Array };
    let manifest: BackupManifest;
    try {
      signedManifest = parseSignedManifest(openedManifest);
      manifest = parseCanonicalBackupManifest(signedManifest.canonical);
    } catch (error) {
      if (error instanceof BackupDecodeError) throw error;
      if (error instanceof BinaryTruncatedError) {
        fail('truncated', 'decrypted manifest is truncated', BACKUP_MANIFEST_PATH);
      }
      fail('bad_signature', 'decrypted manifest is malformed', BACKUP_MANIFEST_PATH);
    }

    if (!bytesEqual(canonicalBackupManifest(manifest), signedManifest.canonical)) {
      fail('bad_signature', 'manifest is not canonically encoded', BACKUP_MANIFEST_PATH);
    }
    try {
      validateManifestStructure(manifest);
    } catch {
      fail('bad_signature', 'signed manifest structure is invalid', BACKUP_MANIFEST_PATH);
    }
    if (signedManifest.signature.length !== nacl.sign.signatureLength) {
      fail('bad_signature', 'manifest signature has the wrong length', BACKUP_MANIFEST_PATH);
    }
    const devicePublicKey = hexToBytes(manifest.devicePublicKey);
    if (!nacl.sign.detached.verify(signedManifest.canonical, signedManifest.signature, devicePublicKey)) {
      fail('bad_signature', 'manifest signature verification failed', BACKUP_MANIFEST_PATH);
    }
    if (
      options?.expectedDevicePublicKey !== undefined
      && options.expectedDevicePublicKey !== manifest.devicePublicKey
    ) {
      fail('bad_signature', 'manifest signer does not match the expected device', BACKUP_MANIFEST_PATH);
    }
    if (manifest.backupId !== locator.backupId || manifest.createdAt !== locator.createdAt) {
      fail('locator_mismatch', 'locator and encrypted manifest identify different backups');
    }

    return {
      locator,
      manifest,
      manifestSignature: bytesToHex(signedManifest.signature),
      backupRootKey,
    };
  } catch (error) {
    backupRootKey.fill(0);
    throw error;
  }
}

/**
 * Opens and authenticates the encrypted manifest before bounded restore begins.
 * The returned backupRootKey is secret and must be dropped after the restore.
 */
export function openBackupManifest(
  locatorJson: string,
  manifestEnvelope: Uint8Array,
  recoveryKey: string,
  options?: DecodeBackupOptions,
): OpenBackupManifestResult {
  try {
    return {
      ok: true,
      ...openBackupManifestOrThrow(locatorJson, manifestEnvelope, recoveryKey, options),
    };
  } catch (error) {
    return { ok: false, error: asBackupDecodeError(error, 'backup manifest is malformed') };
  }
}

function verifyChunkEnvelope(
  envelope: Uint8Array,
  descriptor: BackupChunkDescriptor,
  path: string,
): void {
  if (envelope.length < descriptor.encryptedBytes) {
    fail('truncated', 'chunk is shorter than the signed manifest length', path);
  }
  if (envelope.length > descriptor.encryptedBytes) {
    fail('tampered_chunk', 'chunk length differs from the signed manifest', path);
  }
  verifyHashShape(descriptor.ciphertextHash, path);
  if (sha512Hex(envelope) !== descriptor.ciphertextHash) {
    fail('tampered_chunk', 'chunk ciphertext hash mismatch', path);
  }
}

function decryptContentChunk(
  envelope: Uint8Array,
  descriptor: BackupChunkDescriptor,
  key: Uint8Array,
  path: string,
): Uint8Array {
  const plaintext = openEnvelope(envelope, key);
  if (plaintext === null) fail('tampered_chunk', 'chunk authentication failed', path);
  if (plaintext.length !== descriptor.plaintextBytes || sha512Hex(plaintext) !== descriptor.plaintextHash) {
    fail('tampered_chunk', 'chunk plaintext integrity mismatch', path);
  }
  return plaintext;
}

function findObjectDescriptor(
  manifest: BackupManifest,
  objectId: string,
): BackupObjectDescriptor | undefined {
  let low = 0;
  let high = manifest.objects.length - 1;
  while (low <= high) {
    const middle = low + Math.floor((high - low) / 2);
    const candidate = manifest.objects[middle];
    if (candidate === undefined) return undefined;
    const comparison = compareStrings(candidate.objectId, objectId);
    if (comparison === 0) return candidate;
    if (comparison < 0) low = middle + 1;
    else high = middle - 1;
  }
  return undefined;
}

function resolveChunkTarget(
  manifest: BackupManifest,
  target: BackupChunkTarget,
): {
  descriptor: BackupChunkDescriptor;
  path: string;
  purpose: 'database' | 'object';
  objectId: string;
} {
  if (!Number.isSafeInteger(target.index) || target.index < 0) {
    fail('missing_chunk', 'chunk descriptor is missing');
  }
  if (target.kind === 'database') {
    const descriptor = manifest.databaseChunks[target.index];
    if (descriptor === undefined) {
      fail('missing_chunk', 'database chunk descriptor is missing', databasePath(target.index));
    }
    return {
      descriptor,
      path: databasePath(target.index),
      purpose: 'database',
      objectId: 'database',
    };
  }

  const object = findObjectDescriptor(manifest, target.objectId);
  if (object === undefined) fail('missing_chunk', 'object descriptor is missing');
  const descriptor = object.chunks[target.index];
  if (descriptor === undefined) {
    fail('missing_chunk', 'object chunk descriptor is missing', objectPath(object.objectId, target.index));
  }
  return {
    descriptor,
    path: objectPath(object.objectId, target.index),
    purpose: 'object',
    objectId: object.objectId,
  };
}

function verifyAndDecryptBackupChunkOrThrow(
  backupRootKey: Uint8Array,
  manifest: BackupManifest,
  target: BackupChunkTarget,
  envelope: Uint8Array,
): Uint8Array {
  const resolved = resolveChunkTarget(manifest, target);
  verifyChunkEnvelope(envelope, resolved.descriptor, resolved.path);
  const key = deriveBackupChunkKey(
    backupRootKey,
    resolved.purpose,
    resolved.objectId,
    target.index,
  );
  try {
    return decryptContentChunk(envelope, resolved.descriptor, key, resolved.path);
  } finally {
    key.fill(0);
  }
}

export function verifyAndDecryptBackupChunk(
  backupRootKey: Uint8Array,
  manifest: BackupManifest,
  target: BackupChunkTarget,
  envelope: Uint8Array,
): VerifyBackupChunkResult {
  try {
    return {
      ok: true,
      plaintext: verifyAndDecryptBackupChunkOrThrow(backupRootKey, manifest, target, envelope),
    };
  } catch (error) {
    return { ok: false, error: asBackupDecodeError(error, 'backup chunk is malformed') };
  }
}

function verifyBackupIdentityChunkOrThrow(
  manifest: BackupManifest,
  envelope: Uint8Array,
): string {
  const descriptor = manifest.identity;
  if (descriptor === null) {
    fail('missing_chunk', 'identity recovery chunk descriptor is missing', BACKUP_IDENTITY_PATH);
  }
  if (envelope.length < descriptor.encryptedBytes) {
    fail('truncated', 'identity recovery chunk is truncated', BACKUP_IDENTITY_PATH);
  }
  if (envelope.length > descriptor.encryptedBytes) {
    fail('tampered_chunk', 'identity recovery chunk length mismatch', BACKUP_IDENTITY_PATH);
  }
  verifyHashShape(descriptor.ciphertextHash, BACKUP_IDENTITY_PATH);
  if (sha512Hex(envelope) !== descriptor.ciphertextHash) {
    fail('tampered_chunk', 'identity recovery chunk hash mismatch', BACKUP_IDENTITY_PATH);
  }
  return encodeUTF8(envelope);
}

export function verifyBackupIdentityChunk(
  manifest: BackupManifest,
  envelope: Uint8Array,
): VerifyBackupIdentityResult {
  try {
    return {
      ok: true,
      sealedRecoveryBundle: verifyBackupIdentityChunkOrThrow(manifest, envelope),
    };
  } catch (error) {
    return { ok: false, error: asBackupDecodeError(error, 'identity recovery chunk is malformed') };
  }
}

function verifyBatchManifestMetadata(
  locatorJson: string,
  manifest: EncryptedBackupManifest,
): void {
  if (manifest.path !== BACKUP_MANIFEST_PATH) {
    fail('missing_chunk', 'manifest.mkmanifest is missing', BACKUP_MANIFEST_PATH);
  }
  const locator = parseBackupLocator(locatorJson);
  if (manifest.envelope.length < SECRETBOX_OVERHEAD) return;
  verifyHashShape(manifest.ciphertextHash, BACKUP_MANIFEST_PATH);
  if (
    manifest.encryptedBytes !== manifest.envelope.length
    || manifest.ciphertextHash !== locator.encryptedManifestHash
  ) {
    fail('tampered_chunk', 'encrypted manifest hash mismatch', BACKUP_MANIFEST_PATH);
  }
}

function verifyBatchChunkRoute(
  chunk: EncryptedBackupChunk,
  expected: { path: string; purpose: 'database' | 'object'; objectId: string; index: number },
): void {
  if (
    chunk.path !== expected.path
    || chunk.purpose !== expected.purpose
    || chunk.objectId !== expected.objectId
    || chunk.index !== expected.index
  ) {
    fail('chunk_order', 'chunk metadata or order is inconsistent', chunk.path);
  }
}

function verifyBatchChunkDescriptor(
  chunk: EncryptedBackupChunk,
  descriptor: BackupChunkDescriptor,
): void {
  verifyHashShape(chunk.ciphertextHash, chunk.path);
  if (
    chunk.encryptedBytes !== descriptor.encryptedBytes
    || chunk.ciphertextHash !== descriptor.ciphertextHash
  ) {
    fail('tampered_chunk', 'chunk metadata differs from the signed manifest', chunk.path);
  }
}

function decodeBackupOrThrow(
  backup: EncodedBackup,
  recoveryKey: string,
  options?: DecodeBackupOptions,
): DecodedBackup {
  verifyBatchManifestMetadata(backup.locatorJson, backup.manifest);
  const opened = openBackupManifest(
    backup.locatorJson,
    backup.manifest.envelope,
    recoveryKey,
    options,
  );
  if (!opened.ok) throw opened.error;
  const { locator, manifest, manifestSignature, backupRootKey } = opened;

  try {
    if (backup.databaseChunks.length < manifest.databaseChunks.length) {
      fail('missing_chunk', 'one or more database chunks are missing');
    }
    if (backup.databaseChunks.length > manifest.databaseChunks.length) {
      fail('chunk_order', 'unexpected database chunks are present');
    }
    const databaseChunks: Uint8Array[] = [];
    manifest.databaseChunks.forEach((descriptor, index) => {
      const chunk = backup.databaseChunks[index];
      if (chunk === undefined) fail('missing_chunk', 'database chunk is missing', databasePath(index));
      verifyBatchChunkRoute(chunk, {
        path: databasePath(index),
        purpose: 'database',
        objectId: 'database',
        index,
      });
      const verified = verifyAndDecryptBackupChunk(
        backupRootKey,
        manifest,
        { kind: 'database', index },
        chunk.envelope,
      );
      if (!verified.ok) throw verified.error;
      verifyBatchChunkDescriptor(chunk, descriptor);
      databaseChunks.push(verified.plaintext);
    });

    const expectedObjectChunkCount = manifest.objects
      .reduce((sum, object) => sum + object.chunks.length, 0);
    if (backup.objectChunks.length < expectedObjectChunkCount) {
      fail('missing_chunk', 'one or more object chunks are missing');
    }
    if (backup.objectChunks.length > expectedObjectChunkCount) {
      fail('chunk_order', 'unexpected object chunks are present');
    }
    const objects: DecodedBackupObject[] = [];
    let flatIndex = 0;
    for (const object of manifest.objects) {
      const chunks: Uint8Array[] = [];
      object.chunks.forEach((descriptor, index) => {
        const chunk = backup.objectChunks[flatIndex];
        if (chunk === undefined) {
          fail('missing_chunk', 'object chunk is missing', objectPath(object.objectId, index));
        }
        verifyBatchChunkRoute(chunk, {
          path: objectPath(object.objectId, index),
          purpose: 'object',
          objectId: object.objectId,
          index,
        });
        const verified = verifyAndDecryptBackupChunk(
          backupRootKey,
          manifest,
          { kind: 'object', objectId: object.objectId, index },
          chunk.envelope,
        );
        if (!verified.ok) throw verified.error;
        verifyBatchChunkDescriptor(chunk, descriptor);
        chunks.push(verified.plaintext);
        flatIndex += 1;
      });
      objects.push({ objectId: object.objectId, dataClass: object.dataClass, chunks });
    }

    let sealedRecoveryBundle: string | null = null;
    if (manifest.identity === null) {
      if (backup.identityChunk !== null) fail('chunk_order', 'unexpected identity chunk is present');
    } else {
      const identityChunk = backup.identityChunk;
      if (identityChunk === null) {
        fail('missing_chunk', 'identity recovery chunk is missing', BACKUP_IDENTITY_PATH);
      }
      if (identityChunk.path !== BACKUP_IDENTITY_PATH) {
        fail('chunk_order', 'identity recovery chunk path is invalid', identityChunk.path);
      }
      const verifiedIdentity = verifyBackupIdentityChunk(manifest, identityChunk.envelope);
      if (!verifiedIdentity.ok) throw verifiedIdentity.error;
      if (
        identityChunk.encryptedBytes !== manifest.identity.encryptedBytes
        || identityChunk.ciphertextHash !== manifest.identity.ciphertextHash
      ) {
        fail('tampered_chunk', 'identity recovery chunk metadata mismatch', BACKUP_IDENTITY_PATH);
      }
      sealedRecoveryBundle = verifiedIdentity.sealedRecoveryBundle;
    }

    return {
      locator,
      manifest,
      manifestSignature,
      databaseChunks,
      objects,
      sealedRecoveryBundle,
    };
  } finally {
    backupRootKey.fill(0);
  }
}

export function decodeBackup(
  backup: EncodedBackup,
  recoveryKey: string,
  options?: DecodeBackupOptions,
): DecodeBackupResult {
  try {
    return { ok: true, ...decodeBackupOrThrow(backup, recoveryKey, options) };
  } catch (error) {
    return { ok: false, error: asBackupDecodeError(error, 'backup structure is malformed') };
  }
}
