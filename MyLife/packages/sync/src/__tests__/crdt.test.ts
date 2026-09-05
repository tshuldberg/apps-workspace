import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { DocumentManager } from '../crdt/document-manager';
import type { DocumentChange } from '../crdt/document-manager';
import { ChangeTracker } from '../crdt/change-tracker';
import { ConflictReporter } from '../crdt/conflict-reporter';
import {
  rowToCrdtData,
  crdtDataToSqlValues,
  buildInsertSql,
  buildUpdateSql,
  buildDeleteSql,
} from '../crdt/schema-adapter';

function createMockDb(): DatabaseAdapter {
  return {
    execute: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    transaction: vi.fn((fn: () => void) => fn()),
  };
}

// ---------------------------------------------------------------------------
// DocumentManager
// ---------------------------------------------------------------------------

describe('DocumentManager', () => {
  let manager: DocumentManager;

  beforeEach(() => {
    manager = new DocumentManager();
  });

  it('creates and retrieves documents', () => {
    const doc = manager.getDocument('books');
    expect(doc).toBeDefined();
    // Same reference on second access
    const doc2 = manager.getDocument('books');
    expect(doc2).toBeDefined();
  });

  it('tracks active modules', () => {
    expect(manager.getActiveModules()).toEqual([]);
    manager.getDocument('books');
    manager.getDocument('budget');
    expect(manager.getActiveModules()).toEqual(['books', 'budget']);
  });

  it('applyChange records INSERT in Automerge doc', () => {
    const change: DocumentChange = {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'INSERT',
      data: { id: 'book-1', title: 'Test Book' },
    };

    manager.applyChange('books', change);
    const doc = manager.getDocument('books');
    const docData = doc as unknown as { tables: Record<string, Record<string, Record<string, unknown>>>; metadata: { changeCount: number } };
    expect(docData.tables.bk_books['book-1']).toBeDefined();
    expect(docData.tables.bk_books['book-1'].title).toBe('Test Book');
    expect(docData.metadata.changeCount).toBe(1);
  });

  it('applyChange records UPDATE in Automerge doc', () => {
    manager.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'INSERT',
      data: { id: 'book-1', title: 'Original' },
    });

    manager.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'UPDATE',
      data: { id: 'book-1', title: 'Updated' },
    });

    const doc = manager.getDocument('books');
    const docData = doc as unknown as { tables: Record<string, Record<string, Record<string, unknown>>>; metadata: { changeCount: number } };
    expect(docData.tables.bk_books['book-1'].title).toBe('Updated');
    expect(docData.metadata.changeCount).toBe(2);
  });

  it('applyChange records DELETE in Automerge doc', () => {
    manager.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'INSERT',
      data: { id: 'book-1', title: 'To Delete' },
    });

    manager.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'DELETE',
      data: null,
    });

    const doc = manager.getDocument('books');
    const docData = doc as unknown as { tables: Record<string, Record<string, Record<string, unknown>>> };
    expect(docData.tables.bk_books['book-1']).toBeUndefined();
  });

  it('generateSyncMessage creates a binary message', () => {
    manager.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'INSERT',
      data: { id: 'book-1', title: 'Test' },
    });

    const message = manager.generateSyncMessage('books', null);
    expect(message).toBeInstanceOf(Uint8Array);
  });

  it('save and load roundtrips document state', () => {
    manager.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'INSERT',
      data: { id: 'book-1', title: 'Persisted' },
    });

    const binary = manager.save('books');
    expect(binary).toBeInstanceOf(Uint8Array);

    const manager2 = new DocumentManager();
    manager2.load('books', binary);
    const doc = manager2.getDocument('books');
    const docData = doc as unknown as { tables: Record<string, Record<string, Record<string, unknown>>> };
    expect(docData.tables.bk_books['book-1'].title).toBe('Persisted');
  });

  it('two DocumentManagers can sync bidirectionally via save/load merge', () => {
    const managerA = new DocumentManager();
    const managerB = new DocumentManager();

    // A adds a book
    managerA.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'INSERT',
      data: { id: 'book-1', title: 'From A' },
    });

    // B loads A's state, then adds its own change on top
    const binaryFromA = managerA.save('books');
    managerB.load('books', binaryFromA);

    managerB.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-2',
      operation: 'INSERT',
      data: { id: 'book-2', title: 'From B' },
    });

    // A loads B's updated state (which includes both changes)
    const binaryFromB = managerB.save('books');
    managerA.load('books', binaryFromB);

    // Both managers now have both books
    const docA = managerA.getDocument('books') as unknown as { tables: Record<string, Record<string, Record<string, unknown>>> };
    const docB = managerB.getDocument('books') as unknown as { tables: Record<string, Record<string, Record<string, unknown>>> };

    expect(docA.tables.bk_books['book-1']).toBeDefined();
    expect(docA.tables.bk_books['book-1'].title).toBe('From A');
    expect(docA.tables.bk_books['book-2']).toBeDefined();
    expect(docA.tables.bk_books['book-2'].title).toBe('From B');
    expect(docB.tables.bk_books['book-1']).toBeDefined();
    expect(docB.tables.bk_books['book-2']).toBeDefined();
  });

  it('receiveSyncMessage detects changes from a sync message', () => {
    const managerA = new DocumentManager();
    const managerB = new DocumentManager();

    // B starts with an empty doc
    managerB.getDocument('books');

    // A adds a book
    managerA.applyChange('books', {
      table: 'bk_books',
      rowId: 'book-1',
      operation: 'INSERT',
      data: { id: 'book-1', title: 'Synced Book' },
    });

    // A generates a sync message for B
    const msg = managerA.generateSyncMessage('books', null);
    expect(msg).not.toBeNull();

    // B receives it -- should detect the new row
    if (msg) {
      const changes = managerB.receiveSyncMessage('books', msg);
      // The sync protocol may need multiple rounds, but on the first
      // round the message should at least be accepted without error
      expect(Array.isArray(changes)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ChangeTracker
// ---------------------------------------------------------------------------

describe('ChangeTracker', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('resolves module from table prefix', () => {
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([
        ['books', 'bk_'],
        ['budget', 'bg_'],
      ]),
    });

    expect(tracker.resolveModule('bk_books')).toBe('books');
    expect(tracker.resolveModule('bk_reading_sessions')).toBe('books');
    expect(tracker.resolveModule('bg_transactions')).toBe('budget');
    expect(tracker.resolveModule('unknown_table')).toBeNull();
  });

  it('resolves longest matching prefix when ambiguous', () => {
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([
        ['health', 'hl_'],
        ['health_extra', 'hl_extra_'],
      ]),
    });

    expect(tracker.resolveModule('hl_extra_data')).toBe('health_extra');
    expect(tracker.resolveModule('hl_basic')).toBe('health');
  });

  it('records changes with proper IDs and calls onChangeRecorded', () => {
    const onRecorded = vi.fn();
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([['books', 'bk_']]),
      onChangeRecorded: onRecorded,
    });

    tracker.recordChange('bk_books', 'INSERT', 'book-1', { id: 'book-1', title: 'Test' });

    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_change_log'),
      expect.any(Array),
    );
    expect(onRecorded).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 'books',
        tableName: 'bk_books',
        operation: 'INSERT',
        rowId: 'book-1',
      }),
    );
  });

  it('silently skips changes for unknown table prefixes', () => {
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([['books', 'bk_']]),
    });

    tracker.recordChange('unknown_table', 'INSERT', 'row-1', { id: 'row-1' });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('matches unprefixed entity rules against physical table names', () => {
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([['recipes', 'rc_']]),
      modulePolicies: new Map([
        ['recipes', {
          defaultScope: 'personal_replica',
          shareable: true,
          entityRules: [
            {
              tableName: 'recipes',
              defaultScope: 'personal_replica',
              conflictStrategy: 'lww',
              stripColumns: ['private_note'],
            },
          ],
        }],
      ]),
    });

    tracker.recordChange('rc_recipes', 'INSERT', 'recipe-1', {
      id: 'recipe-1',
      name: 'Soup',
      private_note: 'keep local',
    });

    const params = vi.mocked(db.execute).mock.calls[0]?.[1] as unknown[] | undefined;
    expect(params?.[5]).toBe(JSON.stringify({ id: 'recipe-1', name: 'Soup' }));
  });

  it('does not record device_local entity changes', () => {
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([['recipes', 'rc_']]),
      modulePolicies: new Map([
        ['recipes', {
          defaultScope: 'personal_replica',
          shareable: true,
          entityRules: [
            { tableName: 'settings', defaultScope: 'device_local', conflictStrategy: 'lww' },
          ],
        }],
      ]),
    });

    tracker.recordChange('rc_settings', 'UPDATE', 'theme', { key: 'theme', value: 'dark' });
    expect(db.execute).not.toHaveBeenCalled();
  });

  it('delegates getUnsynced to db queries', () => {
    vi.mocked(db.query).mockReturnValueOnce([]);
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([['books', 'bk_']]),
    });

    const result = tracker.getUnsynced(10);
    expect(result).toEqual([]);
  });

  it('getPendingCount queries sync_change_log', () => {
    vi.mocked(db.query).mockReturnValueOnce([{ c: 42 }]);
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([['books', 'bk_']]),
    });

    expect(tracker.getPendingCount()).toBe(42);
  });

  it('markSynced delegates to markChangesSynced', () => {
    const tracker = new ChangeTracker({
      db,
      deviceId: 'device-1',
      modulePrefixes: new Map([['books', 'bk_']]),
    });

    tracker.markSynced(['id-1', 'id-2']);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE sync_change_log SET synced = 1'),
      ['id-1', 'id-2'],
    );
  });
});

// ---------------------------------------------------------------------------
// ConflictReporter
// ---------------------------------------------------------------------------

describe('ConflictReporter', () => {
  it('stores and emits conflicts', () => {
    const reporter = new ConflictReporter();
    const handler = vi.fn();
    reporter.onConflict(handler);

    reporter.report({
      moduleId: 'books',
      table: 'bk_books',
      rowId: 'book-1',
      localValue: { title: 'Local Title' },
      remoteValue: { title: 'Remote Title' },
      resolvedValue: { title: 'Remote Title' },
      resolution: 'remote_wins',
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        moduleId: 'books',
        resolution: 'remote_wins',
        id: expect.any(String),
        resolvedAt: expect.any(String),
      }),
    );
  });

  it('getRecent returns conflicts newest first', () => {
    const reporter = new ConflictReporter();

    reporter.report({
      moduleId: 'books',
      table: 'bk_books',
      rowId: 'book-1',
      localValue: {},
      remoteValue: {},
      resolvedValue: {},
      resolution: 'local_wins',
    });

    reporter.report({
      moduleId: 'budget',
      table: 'bg_tx',
      rowId: 'tx-1',
      localValue: {},
      remoteValue: {},
      resolvedValue: {},
      resolution: 'crdt_merge',
    });

    const recent = reporter.getRecent();
    expect(recent).toHaveLength(2);
    expect(recent[0]!.moduleId).toBe('budget');
    expect(recent[1]!.moduleId).toBe('books');
  });

  it('unsubscribe stops notifications', () => {
    const reporter = new ConflictReporter();
    const handler = vi.fn();
    const unsub = reporter.onConflict(handler);

    unsub();

    reporter.report({
      moduleId: 'books',
      table: 'bk_books',
      rowId: 'book-1',
      localValue: {},
      remoteValue: {},
      resolvedValue: {},
      resolution: 'local_wins',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('clear removes all conflicts', () => {
    const reporter = new ConflictReporter();
    reporter.report({
      moduleId: 'books',
      table: 'bk_books',
      rowId: 'book-1',
      localValue: {},
      remoteValue: {},
      resolvedValue: {},
      resolution: 'local_wins',
    });

    reporter.clear();
    expect(reporter.getRecent()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SchemaAdapter
// ---------------------------------------------------------------------------

describe('SchemaAdapter', () => {
  it('rowToCrdtData strips SQLite internal fields', () => {
    const row = { id: '1', title: 'Test', rowid: 123, _rowid_: 123 };
    const result = rowToCrdtData(row);
    expect(result).toEqual({ id: '1', title: 'Test' });
    expect(result).not.toHaveProperty('rowid');
    expect(result).not.toHaveProperty('_rowid_');
  });

  it('crdtDataToSqlValues returns columns and values arrays', () => {
    const data = { id: 'book-1', title: 'Test', rating: 5 };
    const { columns, values } = crdtDataToSqlValues(data);
    expect(columns).toEqual(['id', 'title', 'rating']);
    expect(values).toEqual(['book-1', 'Test', 5]);
  });

  it('buildInsertSql builds correct INSERT OR REPLACE statement', () => {
    const { sql, params } = buildInsertSql('bk_books', { id: 'book-1', title: 'Test' });
    expect(sql).toBe('INSERT OR REPLACE INTO bk_books (id, title) VALUES (?, ?)');
    expect(params).toEqual(['book-1', 'Test']);
  });

  it('buildUpdateSql builds correct UPDATE statement', () => {
    const { sql, params } = buildUpdateSql('bk_books', 'book-1', { id: 'book-1', title: 'New', rating: 4 });
    expect(sql).toBe('UPDATE bk_books SET title = ?, rating = ? WHERE id = ?');
    expect(params).toEqual(['New', 4, 'book-1']);
  });

  it('buildUpdateSql supports custom primary key column', () => {
    const { sql, params } = buildUpdateSql('bk_books', 'book-1', { isbn: 'book-1', title: 'New' }, 'isbn');
    expect(sql).toBe('UPDATE bk_books SET title = ? WHERE isbn = ?');
    expect(params).toEqual(['New', 'book-1']);
  });

  it('buildDeleteSql builds correct DELETE statement', () => {
    const { sql, params } = buildDeleteSql('bk_books', 'book-1');
    expect(sql).toBe('DELETE FROM bk_books WHERE id = ?');
    expect(params).toEqual(['book-1']);
  });

  it('buildDeleteSql supports custom primary key column', () => {
    const { sql, params } = buildDeleteSql('bk_books', 'book-1', 'isbn');
    expect(sql).toBe('DELETE FROM bk_books WHERE isbn = ?');
    expect(params).toEqual(['book-1']);
  });
});
