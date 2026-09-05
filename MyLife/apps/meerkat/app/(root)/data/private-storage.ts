import { recoverInterruptedMobileRestoreBeforeOpen } from './local-restore-boot';

/** Only these app-owned entries move. Documents/Meerkat exports stay in Files. */
export const PRIVATE_STORAGE_ENTRIES = [
  { path: 'SQLite/meerkat.db', kind: 'file' },
  { path: 'SQLite/meerkat.db-wal', kind: 'file' },
  { path: 'SQLite/meerkat.db-shm', kind: 'file' },
  ...['blocks', 'blobs', 'storage', 'storage-jobs', 'snapshots', 'restore-staging',
    'restore-rollback', 'tilepacks'].map((name) => ({ path: `meerkat/${name}`, kind: 'directory' as const })),
] as const;

const JOURNALS = ['restore-activation.json', 'restore-activation.json.0', 'restore-activation.json.1'];
const MIGRATED = 'documents-migration-v1';

export function resolvePrivateStorageRoot(
  documents: string | null,
  platform: string,
  executionEnvironment?: string,
): string {
  if (!documents) throw new Error('The private storage directory is unavailable.');
  const root = documents.endsWith('/') ? documents : `${documents}/`;
  if (platform !== 'ios') return root;
  // Derive from the OS-provided container, never persist its changing UUID.
  const url = new URL(root);
  // Expo Go is a separate developer host without Meerkat's Files-sharing keys.
  // Its experience-scoped root cannot be relocated by the modern Expo filesystem.
  if (executionEnvironment === 'storeClient' && url.protocol === 'file:' && !url.host
    && url.pathname.includes('/Documents/ExponentExperienceData/')) return root;
  if (url.protocol !== 'file:' || url.host || !url.pathname.endsWith('/Documents/')) {
    throw new Error('Private iOS storage requires a Meerkat development or release build.');
  }
  return new URL('../Library/Application%20Support/MeerkatPrivate/', url).href;
}

export function getPrivateStorageRoot(): string {
  // Lazy native imports keep the migration and its failure tests runnable in Node.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as typeof import('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: Constants } = require('expo-constants') as typeof import('expo-constants');
  return resolvePrivateStorageRoot(fileSystem.documentDirectory, Platform.OS, Constants.executionEnvironment);
}

export interface PrivateStorageMigrationIO {
  exists(uri: string, kind: 'file' | 'directory'): boolean;
  makeDirectory(uri: string): void;
  move(from: string, to: string, kind: 'file' | 'directory'): void;
  markComplete(uri: string): void;
}

/** Run with all database handles closed. Same-container renames resume after each move. */
export function migratePrivateStorage(
  io: PrivateStorageMigrationIO,
  documents: string,
  privateRoot: string,
  recoverLegacyRestore: () => void,
): void {
  if (documents === privateRoot) return;
  const marker = `${privateRoot}${MIGRATED}`;
  const legacyEntries = [
    ...PRIVATE_STORAGE_ENTRIES,
    ...JOURNALS.map((name) => ({ path: `meerkat/${name}`, kind: 'file' as const })),
  ];
  if (io.exists(marker, 'file')) {
    if (legacyEntries.some(({ path, kind }) => io.exists(`${documents}${path}`, kind))) {
      throw new Error('Unexpected private data remains in Documents. Storage was not opened.');
    }
    return;
  }
  // Recover journals at their original paths before relocating any rollback files.
  recoverLegacyRestore();
  for (const { path, kind } of PRIVATE_STORAGE_ENTRIES) {
    if (io.exists(`${documents}${path}`, kind) && io.exists(`${privateRoot}${path}`, kind)) {
      throw new Error('Private storage migration found conflicting copies. Neither copy was overwritten.');
    }
  }
  io.makeDirectory(privateRoot);
  io.makeDirectory(`${privateRoot}SQLite/`);
  io.makeDirectory(`${privateRoot}meerkat/`);
  for (const { path, kind } of PRIVATE_STORAGE_ENTRIES) {
    if (io.exists(`${documents}${path}`, kind)) {
      io.move(`${documents}${path}`, `${privateRoot}${path}`, kind);
    }
  }
  if (legacyEntries.some(({ path, kind }) => io.exists(`${documents}${path}`, kind))) {
    throw new Error('Private storage migration did not remove the original private files.');
  }
  io.markComplete(marker);
}

/** Shared foreground/headless boot boundary. A migration error prevents SQLite open. */
export function preparePrivateStorageBeforeOpen(): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native') as typeof import('react-native');
  if (Platform.OS !== 'ios') return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('expo-file-system') as typeof import('expo-file-system');
  const documents = `${fs.Paths.document.uri.replace(/\/$/u, '')}/`;
  const privateRoot = getPrivateStorageRoot();
  if (privateRoot === documents) return undefined;
  migratePrivateStorage({
    exists: (uri, kind) => kind === 'file' ? new fs.File(uri).exists : new fs.Directory(uri).exists,
    makeDirectory: (uri) => new fs.Directory(uri).create({ intermediates: true, idempotent: true }),
    move(from, to, kind): void {
      if (kind === 'file') new fs.File(from).move(new fs.File(to));
      else new fs.Directory(from).move(new fs.Directory(to));
    },
    markComplete: (uri) => new fs.File(uri).write('1'),
  }, documents, privateRoot, () => { recoverInterruptedMobileRestoreBeforeOpen(undefined, documents); });
  return `${privateRoot}SQLite/`;
}

/** Reset removes internal entries from both locations without deleting explicit exports. */
export function privateStorageResetPaths(documents: string, privateRoot: string): string[] {
  const paths = PRIVATE_STORAGE_ENTRIES.map(({ path }) => `${documents}${path}`);
  paths.push(...JOURNALS.map((name) => `${documents}meerkat/${name}`));
  if (privateRoot !== documents) paths.push(privateRoot);
  return paths;
}
