import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyChangeset } from '../changeset';
import type { Changeset } from '../changeset';
import type { DatabaseAdapter } from '@mylife/db';

function createMockDb(): DatabaseAdapter {
  return {
    execute: vi.fn(),
    query: vi.fn().mockReturnValue([]),
    transaction: vi.fn((fn: () => void) => fn()),
  };
}

describe('applyChangeset()', () => {
  let db: DatabaseAdapter;

  beforeEach(() => {
    db = createMockDb();
  });

  it('inserts a new row when it does not exist locally', () => {
    const changeset: Changeset = {
      id: 'cs-1',
      sourceDeviceId: 'device-a',
      createdAt: '2025-01-01T00:00:00Z',
      changes: [
        {
          operation: 'insert',
          table: 'bk_books',
          primaryKey: { id: 'book-1' },
          data: { id: 'book-1', title: 'Test', updated_at: '2025-01-01T00:00:00Z' },
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const result = applyChangeset(db, changeset);
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO bk_books'),
      expect.any(Array),
    );
  });

  it('updates an existing row when incoming is newer', () => {
    vi.mocked(db.query).mockReturnValueOnce([
      { updated_at: '2025-01-01T00:00:00Z' },
    ]);

    const changeset: Changeset = {
      id: 'cs-2',
      sourceDeviceId: 'device-a',
      createdAt: '2025-01-02T00:00:00Z',
      changes: [
        {
          operation: 'update',
          table: 'bk_books',
          primaryKey: { id: 'book-1' },
          data: { id: 'book-1', title: 'Updated', updated_at: '2025-01-02T00:00:00Z' },
          updatedAt: '2025-01-02T00:00:00Z',
        },
      ],
    };

    const result = applyChangeset(db, changeset);
    expect(result.applied).toBe(1);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE bk_books SET'),
      expect.any(Array),
    );
  });

  it('skips update when local row is newer', () => {
    vi.mocked(db.query).mockReturnValueOnce([
      { updated_at: '2025-01-03T00:00:00Z' },
    ]);

    const changeset: Changeset = {
      id: 'cs-3',
      sourceDeviceId: 'device-a',
      createdAt: '2025-01-02T00:00:00Z',
      changes: [
        {
          operation: 'update',
          table: 'bk_books',
          primaryKey: { id: 'book-1' },
          data: { id: 'book-1', title: 'Old', updated_at: '2025-01-02T00:00:00Z' },
          updatedAt: '2025-01-02T00:00:00Z',
        },
      ],
    };

    const result = applyChangeset(db, changeset);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('deletes a row when incoming delete is newer', () => {
    vi.mocked(db.query).mockReturnValueOnce([
      { updated_at: '2025-01-01T00:00:00Z' },
    ]);

    const changeset: Changeset = {
      id: 'cs-4',
      sourceDeviceId: 'device-a',
      createdAt: '2025-01-02T00:00:00Z',
      changes: [
        {
          operation: 'delete',
          table: 'bk_books',
          primaryKey: { id: 'book-1' },
          data: null,
          updatedAt: '2025-01-02T00:00:00Z',
        },
      ],
    };

    const result = applyChangeset(db, changeset);
    expect(result.applied).toBe(1);
    expect(db.execute).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM bk_books'),
      expect.any(Array),
    );
  });

  it('skips delete when row does not exist', () => {
    const changeset: Changeset = {
      id: 'cs-5',
      sourceDeviceId: 'device-a',
      createdAt: '2025-01-02T00:00:00Z',
      changes: [
        {
          operation: 'delete',
          table: 'bk_books',
          primaryKey: { id: 'nonexistent' },
          data: null,
          updatedAt: '2025-01-02T00:00:00Z',
        },
      ],
    };

    const result = applyChangeset(db, changeset);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('wraps all changes in a transaction', () => {
    const changeset: Changeset = {
      id: 'cs-6',
      sourceDeviceId: 'device-a',
      createdAt: '2025-01-01T00:00:00Z',
      changes: [
        {
          operation: 'insert',
          table: 'bk_books',
          primaryKey: { id: 'a' },
          data: { id: 'a', title: 'A', updated_at: '2025-01-01T00:00:00Z' },
          updatedAt: '2025-01-01T00:00:00Z',
        },
        {
          operation: 'insert',
          table: 'bk_books',
          primaryKey: { id: 'b' },
          data: { id: 'b', title: 'B', updated_at: '2025-01-01T00:00:00Z' },
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ],
    };

    applyChangeset(db, changeset);
    expect(db.transaction).toHaveBeenCalledOnce();
  });
});
