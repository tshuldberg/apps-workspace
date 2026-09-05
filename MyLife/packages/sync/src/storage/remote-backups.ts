import { sha256Hex } from '../encryption/sha256';
import { sha512Hex } from '../node/hkdf';
import {
  parseBackupLocator,
  serializeBackupLocator,
  type BackupLocator,
} from './backup-format';
import type {
  EncryptedStorageObject,
  StorageDestinationAdapter,
  StorageObjectMetadata,
} from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const HASH_PATTERN = /^[a-f0-9]{128}$/u;
const REMOTE_PREFIX_PATTERN = /^mkb1\.([a-f0-9]{64})\.locator\.json$/u;
const DEFAULT_MAXIMUM_PAGES = 1_000;
const DEFAULT_MAXIMUM_OBJECTS = 100_000;
const MAXIMUM_DISCOVERY_BYTES = 64 * 1024;

export const REMOTE_BACKUP_PREFIX_VERSION = 'mkb1' as const;
export const REMOTE_BACKUP_LOCATOR_SUFFIX = 'locator.json' as const;
export const REMOTE_BACKUP_MANIFEST_REF_SUFFIX = 'manifest-ref.json' as const;

export interface RemoteBackupManifestReference {
  formatVersion: 1;
  backupId: string;
  manifestObjectId: string;
  manifestCiphertextHash: string;
  createdAt: string;
}

export interface RemoteBackupDiscoveryObjectInput {
  backupId: string;
  locatorJson: string;
  manifestCiphertextHash: string;
}

export interface RemoteBackupCandidate {
  backupId: string;
  createdAt: string;
  locator: BackupLocator;
  locatorJson: string;
  locatorObjectId: string;
  manifestReferenceObjectId: string;
  manifestObjectId: string;
  manifestRemoteRef: string;
  manifestCiphertextHash: string;
  manifestEncryptedBytes: number;
}

export type RemoteBackupDiscoveryIssueCode =
  | 'locator_unreadable'
  | 'locator_invalid'
  | 'locator_path_mismatch'
  | 'manifest_ref_missing'
  | 'manifest_ref_invalid'
  | 'manifest_missing'
  | 'manifest_mismatch'
  | 'listing_limit';

export interface RemoteBackupDiscoveryIssue {
  backupId: string | null;
  objectId: string | null;
  code: RemoteBackupDiscoveryIssueCode;
}

export interface RemoteBackupDiscoveryResult {
  backups: RemoteBackupCandidate[];
  issues: RemoteBackupDiscoveryIssue[];
  pagesScanned: number;
  objectsScanned: number;
  complete: boolean;
}

export interface ListRemoteBackupsOptions {
  maximumPages?: number;
  maximumObjects?: number;
}

export function remoteBackupPrefix(backupId: string): string {
  const locator = parseBackupLocator(serializeBackupLocator({
    formatVersion: 1,
    backupId,
    encryptedManifestHash: '0'.repeat(128),
    createdAt: '2000-01-01T00:00:00.000Z',
  }));
  return `${REMOTE_BACKUP_PREFIX_VERSION}.${sha256Hex(encoder.encode(locator.backupId))}.`;
}

export function remoteBackupLocatorObjectId(backupId: string): string {
  return `${remoteBackupPrefix(backupId)}${REMOTE_BACKUP_LOCATOR_SUFFIX}`;
}

export function remoteBackupManifestReferenceObjectId(backupId: string): string {
  return `${remoteBackupPrefix(backupId)}${REMOTE_BACKUP_MANIFEST_REF_SUFFIX}`;
}

export function remoteBackupManifestObjectId(backupId: string): string {
  return `${remoteBackupPrefix(backupId)}manifest.mkmanifest`;
}

/** Maps a Backup Format v1 logical path to one flat provider-safe object id. */
export function remoteBackupObjectId(backupId: string, logicalPath: string): string {
  if (logicalPath.length === 0 || logicalPath.length > 4_096 || /[\0\r\n]/u.test(logicalPath)) {
    throw new Error('backup object path is invalid');
  }
  return `${remoteBackupPrefix(backupId)}object.${sha256Hex(encoder.encode(logicalPath))}`;
}

export function createRemoteBackupDiscoveryObjects(
  input: RemoteBackupDiscoveryObjectInput,
): readonly [EncryptedStorageObject, EncryptedStorageObject] {
  const locator = parseBackupLocator(input.locatorJson);
  if (locator.backupId !== input.backupId || locator.encryptedManifestHash !== input.manifestCiphertextHash) {
    throw new Error('backup locator does not match the manifest');
  }
  const manifestReference: RemoteBackupManifestReference = {
    formatVersion: 1,
    backupId: input.backupId,
    manifestObjectId: remoteBackupManifestObjectId(input.backupId),
    manifestCiphertextHash: input.manifestCiphertextHash,
    createdAt: locator.createdAt,
  };
  const locatorBytes = encoder.encode(serializeBackupLocator(locator));
  const referenceBytes = encoder.encode(serializeManifestReference(manifestReference));
  return [
    metadataObject(remoteBackupLocatorObjectId(input.backupId), locatorBytes),
    metadataObject(remoteBackupManifestReferenceObjectId(input.backupId), referenceBytes),
  ];
}

export async function listRemoteBackups(
  adapter: StorageDestinationAdapter,
  options: ListRemoteBackupsOptions = {},
): Promise<RemoteBackupDiscoveryResult> {
  const maximumPages = positiveBound(options.maximumPages ?? DEFAULT_MAXIMUM_PAGES, 'maximumPages');
  const maximumObjects = positiveBound(options.maximumObjects ?? DEFAULT_MAXIMUM_OBJECTS, 'maximumObjects');
  const locatorRows: StorageObjectMetadata[] = [];
  const issues: RemoteBackupDiscoveryIssue[] = [];
  let pagesScanned = 0;
  let objectsScanned = 0;
  let cursor: string | undefined;
  do {
    if (pagesScanned >= maximumPages || objectsScanned >= maximumObjects) {
      issues.push({ backupId: null, objectId: null, code: 'listing_limit' });
      break;
    }
    const page = await adapter.listObjects(cursor);
    pagesScanned += 1;
    const remaining = maximumObjects - objectsScanned;
    const accepted = page.items.slice(0, remaining);
    objectsScanned += accepted.length;
    for (const item of accepted) {
      if (REMOTE_PREFIX_PATTERN.test(item.objectId)) locatorRows.push(item);
    }
    if (accepted.length < page.items.length) {
      issues.push({ backupId: null, objectId: null, code: 'listing_limit' });
      cursor = undefined;
    } else {
      cursor = page.nextCursor ?? undefined;
    }
  } while (cursor !== undefined);

  const backups: RemoteBackupCandidate[] = [];
  for (const locatorRow of locatorRows) {
    try {
      const candidate = await readRemoteCandidate(adapter, locatorRow, issues);
      if (candidate !== null) backups.push(candidate);
    } catch {
      issues.push({ backupId: null, objectId: locatorRow.objectId, code: 'locator_unreadable' });
    }
  }
  backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt)
    || left.backupId.localeCompare(right.backupId));
  return {
    backups,
    issues,
    pagesScanned,
    objectsScanned,
    complete: issues.length === 0,
  };
}

async function readRemoteCandidate(
  adapter: StorageDestinationAdapter,
  locatorRow: StorageObjectMetadata,
  issues: RemoteBackupDiscoveryIssue[],
): Promise<RemoteBackupCandidate | null> {
  const locatorText = await readBoundedText(adapter, locatorRow);
  if (locatorText === null) {
    issues.push({ backupId: null, objectId: locatorRow.objectId, code: 'locator_unreadable' });
    return null;
  }
  let locator: BackupLocator;
  try {
    locator = parseBackupLocator(locatorText);
  } catch {
    issues.push({ backupId: null, objectId: locatorRow.objectId, code: 'locator_invalid' });
    return null;
  }
  if (remoteBackupLocatorObjectId(locator.backupId) !== locatorRow.objectId) {
    issues.push({ backupId: locator.backupId, objectId: locatorRow.objectId, code: 'locator_path_mismatch' });
    return null;
  }
  const referenceObjectId = remoteBackupManifestReferenceObjectId(locator.backupId);
  const referenceRow = await adapter.headObject({ objectId: referenceObjectId });
  if (referenceRow === null) {
    issues.push({ backupId: locator.backupId, objectId: referenceObjectId, code: 'manifest_ref_missing' });
    return null;
  }
  const referenceText = await readBoundedText(adapter, referenceRow);
  let reference: RemoteBackupManifestReference;
  try {
    reference = parseManifestReference(referenceText ?? '');
  } catch {
    issues.push({ backupId: locator.backupId, objectId: referenceObjectId, code: 'manifest_ref_invalid' });
    return null;
  }
  if (
    reference.backupId !== locator.backupId
    || reference.createdAt !== locator.createdAt
    || reference.manifestCiphertextHash !== locator.encryptedManifestHash
    || reference.manifestObjectId !== remoteBackupManifestObjectId(locator.backupId)
  ) {
    issues.push({ backupId: locator.backupId, objectId: referenceObjectId, code: 'manifest_ref_invalid' });
    return null;
  }
  const manifest = await adapter.headObject({ objectId: reference.manifestObjectId });
  if (manifest === null) {
    issues.push({ backupId: locator.backupId, objectId: reference.manifestObjectId, code: 'manifest_missing' });
    return null;
  }
  if (!await metadataProvesHash(adapter, manifest, reference.manifestCiphertextHash)) {
    issues.push({ backupId: locator.backupId, objectId: reference.manifestObjectId, code: 'manifest_mismatch' });
    return null;
  }
  return {
    backupId: locator.backupId,
    createdAt: locator.createdAt,
    locator,
    locatorJson: serializeBackupLocator(locator),
    locatorObjectId: locatorRow.objectId,
    manifestReferenceObjectId: referenceObjectId,
    manifestObjectId: reference.manifestObjectId,
    manifestRemoteRef: manifest.remoteRef,
    manifestCiphertextHash: reference.manifestCiphertextHash,
    manifestEncryptedBytes: manifest.encryptedBytes,
  };
}

async function readBoundedText(
  adapter: StorageDestinationAdapter,
  metadata: StorageObjectMetadata,
): Promise<string | null> {
  if (metadata.encryptedBytes > MAXIMUM_DISCOVERY_BYTES) return null;
  const bytes = await adapter.getObject({ objectId: metadata.objectId, remoteRef: metadata.remoteRef });
  if (bytes === null || bytes.length > MAXIMUM_DISCOVERY_BYTES) return null;
  try {
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

async function metadataProvesHash(
  adapter: StorageDestinationAdapter,
  metadata: StorageObjectMetadata,
  expectedHash: string,
): Promise<boolean> {
  if (metadata.ciphertextHash !== null) return metadata.ciphertextHash === expectedHash;
  const bytes = await adapter.getObject({ objectId: metadata.objectId, remoteRef: metadata.remoteRef });
  return bytes !== null && sha512Hex(bytes) === expectedHash;
}

function metadataObject(objectId: string, bytes: Uint8Array): EncryptedStorageObject {
  return {
    objectId,
    dataClass: 'backup_metadata',
    ciphertext: bytes,
    ciphertextHash: sha512Hex(bytes),
    encryptedBytes: bytes.length,
  };
}

function serializeManifestReference(value: RemoteBackupManifestReference): string {
  return `{"formatVersion":1,"backupId":${JSON.stringify(value.backupId)},`
    + `"manifestObjectId":${JSON.stringify(value.manifestObjectId)},`
    + `"manifestCiphertextHash":${JSON.stringify(value.manifestCiphertextHash)},`
    + `"createdAt":${JSON.stringify(value.createdAt)}}`;
}

function parseManifestReference(value: string): RemoteBackupManifestReference {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    throw new Error('manifest reference is invalid');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('manifest reference is invalid');
  }
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expected = ['backupId', 'createdAt', 'formatVersion', 'manifestCiphertextHash', 'manifestObjectId'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error('manifest reference is invalid');
  }
  if (
    record.formatVersion !== 1
    || typeof record.backupId !== 'string'
    || typeof record.createdAt !== 'string'
    || typeof record.manifestObjectId !== 'string'
    || typeof record.manifestCiphertextHash !== 'string'
    || !HASH_PATTERN.test(record.manifestCiphertextHash)
  ) throw new Error('manifest reference is invalid');
  parseBackupLocator(serializeBackupLocator({
    formatVersion: 1,
    backupId: record.backupId,
    encryptedManifestHash: record.manifestCiphertextHash,
    createdAt: record.createdAt,
  }));
  return {
    formatVersion: 1,
    backupId: record.backupId,
    manifestObjectId: record.manifestObjectId,
    manifestCiphertextHash: record.manifestCiphertextHash,
    createdAt: record.createdAt,
  };
}

function positiveBound(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`);
  return value;
}
