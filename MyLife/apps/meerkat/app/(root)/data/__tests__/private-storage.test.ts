import { afterEach, describe, expect, it } from 'vitest';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  migratePrivateStorage, PRIVATE_STORAGE_ENTRIES, privateStorageResetPaths,
  resolvePrivateStorageRoot, type PrivateStorageMigrationIO,
} from '../private-storage';
import {
  recoverInterruptedMobileRestoreBeforeOpen, type SynchronousRestoreFile,
} from '../local-restore-boot';

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function fixture(): { documents: string; root: string; io: PrivateStorageMigrationIO } {
  const container = mkdtempSync(join(tmpdir(), 'meerkat-private-storage-'));
  temporaryDirectories.push(container);
  const documents = `${pathToFileURL(join(container, 'Documents')).href}/`;
  const root = resolvePrivateStorageRoot(documents, 'ios');
  return {
    documents, root,
    io: {
      exists(uri, kind): boolean {
        if (!existsSync(new URL(uri))) return false;
        if (statSync(new URL(uri)).isDirectory() !== (kind === 'directory')) throw new Error('wrong file type');
        return true;
      },
      makeDirectory: (uri) => { mkdirSync(new URL(uri), { recursive: true }); },
      move(from, to): void {
        if (existsSync(new URL(to))) throw new Error('destination already exists');
        renameSync(new URL(from), new URL(to));
      },
      markComplete: (uri) => writeFileSync(new URL(uri), '1'),
    },
  };
}

function write(uri: string, value: string): void {
  mkdirSync(new URL('.', uri), { recursive: true });
  writeFileSync(new URL(uri), value);
}

function seed(documents: string): Map<string, string> {
  const contents = new Map<string, string>();
  for (const { path, kind } of PRIVATE_STORAGE_ENTRIES) {
    const relativePath = `${path}${kind === 'directory' ? '/nested/payload' : ''}`;
    contents.set(relativePath, `private bytes: ${path}`);
    write(`${documents}${relativePath}`, contents.get(relativePath)!);
  }
  // Put an export in the same lowercase parent too, covering case-insensitive volumes.
  write(`${documents}meerkat/my-export.txt`, 'deliberate export');
  return contents;
}

function assertMoved(documents: string, root: string, contents: Map<string, string>): void {
  for (const [path, bytes] of contents) {
    expect(existsSync(new URL(`${documents}${path}`))).toBe(false);
    expect(readFileSync(new URL(`${root}${path}`), 'utf8')).toBe(bytes);
  }
  expect(readFileSync(new URL(`${documents}meerkat/my-export.txt`), 'utf8')).toBe('deliberate export');
}

describe('private iOS storage migration', () => {
  it('derives Application Support from the current sandbox and leaves Android paths alone', () => {
    expect(resolvePrivateStorageRoot('file:///container/new-uuid/Documents/', 'ios'))
      .toBe('file:///container/new-uuid/Library/Application%20Support/MeerkatPrivate/');
    expect(resolvePrivateStorageRoot('file:///android/files', 'android')).toBe('file:///android/files/');
    for (const path of [null, 'https://example.com/Documents/', 'file:///Documents/scoped/', 'file://remote/Documents/']) {
      expect(() => resolvePrivateStorageRoot(path, 'ios')).toThrow();
    }
  });

  it('preserves only the explicitly identified Expo Go experience sandbox', () => {
    const scoped = 'file:///container/Documents/ExponentExperienceData/@owner/meerkat/';
    expect(resolvePrivateStorageRoot(scoped, 'ios', 'storeClient')).toBe(scoped);
    expect(() => resolvePrivateStorageRoot(scoped, 'ios', 'standalone')).toThrow();
    expect(() => resolvePrivateStorageRoot(scoped, 'ios', 'bare')).toThrow();
    expect(() => resolvePrivateStorageRoot('file:///container/arbitrary/', 'ios', 'storeClient')).toThrow();
    expect(resolvePrivateStorageRoot('file:///container/Documents/', 'ios', 'storeClient'))
      .toContain('/Library/Application%20Support/');
  });

  it('moves every internal entry, preserves explicit exports, and is idempotent', () => {
    const { documents, root, io } = fixture();
    const contents = seed(documents);
    migratePrivateStorage(io, documents, root, () => {});
    migratePrivateStorage(io, documents, root, () => { throw new Error('must not recover public journals again'); });
    assertMoved(documents, root, contents);
  });

  it.each(PRIVATE_STORAGE_ENTRIES.map((entry, index) => [entry.path, index + 1] as const))(
    'resumes after a process interruption following the move of %s', (_path, stopAfter) => {
      const { documents, root, io } = fixture();
      const contents = seed(documents);
      let moves = 0;
      expect(() => migratePrivateStorage({
        ...io,
        move(from, to, kind): void {
          io.move(from, to, kind);
          if (++moves === stopAfter) throw new Error('process stopped');
        },
      }, documents, root, () => {})).toThrow('process stopped');
      migratePrivateStorage(io, documents, root, () => {});
      assertMoved(documents, root, contents);
    },
  );

  it('resumes after marker creation fails without copying any data back into Documents', () => {
    const { documents, root, io } = fixture();
    const contents = seed(documents);
    expect(() => migratePrivateStorage({ ...io, markComplete: () => { throw new Error('disk full'); } },
      documents, root, () => {})).toThrow('disk full');
    migratePrivateStorage(io, documents, root, () => {});
    assertMoved(documents, root, contents);
  });

  it('checks all conflicts before moving anything and never overwrites either copy', () => {
    const { documents, root, io } = fixture();
    seed(documents);
    write(`${root}meerkat/tilepacks/original`, 'existing private copy');
    expect(() => migratePrivateStorage(io, documents, root, () => {})).toThrow('conflicting copies');
    expect(existsSync(new URL(`${documents}SQLite/meerkat.db`))).toBe(true);
    expect(readFileSync(new URL(`${root}meerkat/tilepacks/original`), 'utf8')).toBe('existing private copy');
  });

  it('refuses success when a platform move leaves its source behind', () => {
    const { documents, root, io } = fixture();
    seed(documents);
    expect(() => migratePrivateStorage({ ...io, move: () => {} }, documents, root, () => {}))
      .toThrow('did not remove');
    expect(existsSync(new URL(`${root}documents-migration-v1`))).toBe(false);
  });

  it('refuses private files or journals reintroduced through Files after migration', () => {
    const { documents, root, io } = fixture();
    migratePrivateStorage(io, documents, root, () => {});
    write(`${documents}meerkat/restore-activation.json`, '{}');
    expect(() => migratePrivateStorage(io, documents, root, () => { throw new Error('untrusted journal applied'); }))
      .toThrow('Unexpected private data');
  });

  it('stops before moving data if a legacy restore cannot be recovered', () => {
    const { documents, root, io } = fixture();
    seed(documents);
    expect(() => migratePrivateStorage(io, documents, root, () => { throw new Error('invalid restore'); }))
      .toThrow('invalid restore');
    expect(existsSync(new URL(`${documents}SQLite/meerkat.db`))).toBe(true);
    expect(existsSync(new URL(root))).toBe(false);
  });

  it('recovers a real legacy rollback and WAL before relocating, then supports private restore recovery', () => {
    const { documents, root, io } = fixture();
    class File implements SynchronousRestoreFile {
      constructor(readonly uri: string) {}
      get exists(): boolean { return existsSync(new URL(this.uri)); }
      textSync(): string { return readFileSync(new URL(this.uri), 'utf8'); }
      delete(): void { rmSync(new URL(this.uri)); }
      move(destination: SynchronousRestoreFile): void { renameSync(new URL(this.uri), new URL(destination.uri)); }
    }
    class Directory {
      constructor(readonly uri: string) {}
      get exists(): boolean { return existsSync(new URL(this.uri)); }
      delete(): void { rmSync(new URL(this.uri), { recursive: true }); }
    }
    const fs = { File, Directory, Paths: { document: new Directory(documents) } };
    const stageRollback = (storageRoot: string, bytes: string): void => {
      write(`${storageRoot}SQLite/meerkat.db`, 'interrupted replacement');
      write(`${storageRoot}meerkat/restore-rollback/backup-1/meerkat.db`, bytes);
      write(`${storageRoot}meerkat/restore-rollback/backup-1/meerkat.db-wal`, 'uncheckpointed rows');
      write(`${storageRoot}meerkat/restore-activation.json`, JSON.stringify({
        version: 1, backupId: 'backup-1', phase: 'active_moved', hadPriorData: true,
        stagingDatabase: `${storageRoot}meerkat/restore-staging/backup-1/restored.db`,
        activeDatabase: `${storageRoot}SQLite/meerkat.db`,
        rollbackDirectory: `${storageRoot}meerkat/restore-rollback/backup-1/`,
      }));
    };
    stageRollback(documents, 'prior database');
    migratePrivateStorage(io, documents, root, () => {
      expect(recoverInterruptedMobileRestoreBeforeOpen(fs, documents)).toBe(true);
    });
    expect(readFileSync(new URL(`${root}SQLite/meerkat.db`), 'utf8')).toBe('prior database');
    expect(readFileSync(new URL(`${root}SQLite/meerkat.db-wal`), 'utf8')).toBe('uncheckpointed rows');
    expect(existsSync(new URL(`${documents}meerkat/restore-activation.json`))).toBe(false);
    stageRollback(root, 'private prior database');
    expect(recoverInterruptedMobileRestoreBeforeOpen(fs, root)).toBe(true);
    expect(readFileSync(new URL(`${root}SQLite/meerkat.db`), 'utf8')).toBe('private prior database');
  });

  it('reset removes old and new private data, sidecars, and journals while preserving exports', () => {
    const { documents, root } = fixture();
    seed(documents);
    seed(root);
    write(`${documents}meerkat/restore-activation.json.1`, 'old journal');
    for (const path of privateStorageResetPaths(documents, root)) {
      rmSync(fileURLToPath(path), { recursive: true, force: true });
    }
    expect(existsSync(new URL(root))).toBe(false);
    for (const { path } of PRIVATE_STORAGE_ENTRIES) expect(existsSync(new URL(`${documents}${path}`))).toBe(false);
    expect(existsSync(new URL(`${documents}meerkat/restore-activation.json.1`))).toBe(false);
    expect(readFileSync(new URL(`${documents}meerkat/my-export.txt`), 'utf8')).toBe('deliberate export');
  });
});
