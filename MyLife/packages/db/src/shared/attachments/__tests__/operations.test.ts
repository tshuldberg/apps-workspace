import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHubTestDatabase, type InMemoryTestDatabase } from '../../../test-utils';
import {
  createAttachment,
  deleteAttachment,
  getAttachment,
  getAttachmentsFor,
  getLinksForAttachment,
  linkAttachment,
  unlinkAttachment,
} from '../operations';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

describe('createAttachment', () => {
  it('returns a row with a generated UUID-shaped id and timestamps', () => {
    const result = createAttachment(testDb.adapter, {
      uri: 'file:///photos/test.jpg',
      mime: 'image/jpeg',
    });

    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(result.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect(result.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2} /);
    expect(result.uri).toBe('file:///photos/test.jpg');
    expect(result.mime).toBe('image/jpeg');
    expect(result.sha256).toBeNull();
    expect(result.caption).toBeNull();
  });

  it('persists optional fields end-to-end', () => {
    const created = createAttachment(testDb.adapter, {
      uri: 'file:///photos/test.jpg',
      mime: 'image/jpeg',
      sha256: 'abc123',
      bytes: 42,
      thumbUri: 'file:///thumbs/test.jpg',
      caption: 'Test photo',
      takenAt: '2026-04-01T12:00:00Z',
      lat: 37.7749,
      lng: -122.4194,
    });

    expect(created.sha256).toBe('abc123');
    expect(created.bytes).toBe(42);
    expect(created.thumbUri).toBe('file:///thumbs/test.jpg');
    expect(created.caption).toBe('Test photo');
    expect(created.takenAt).toBe('2026-04-01T12:00:00Z');
    expect(created.lat).toBeCloseTo(37.7749);
    expect(created.lng).toBeCloseTo(-122.4194);
  });

  it('rejects empty uri via Zod validation', () => {
    expect(() =>
      createAttachment(testDb.adapter, {
        uri: '',
        mime: 'image/jpeg',
      }),
    ).toThrow();
  });

  it('rejects missing mime via Zod validation', () => {
    expect(() =>
      // @ts-expect-error -- exercising runtime validation path
      createAttachment(testDb.adapter, { uri: 'file:///x.jpg' }),
    ).toThrow();
  });
});

describe('getAttachment', () => {
  it('returns null for a non-existent id', () => {
    expect(getAttachment(testDb.adapter, 'does-not-exist')).toBeNull();
  });

  it('round-trips a newly created attachment', () => {
    const created = createAttachment(testDb.adapter, {
      uri: 'file:///photos/test.jpg',
      mime: 'image/jpeg',
      caption: 'Hello',
    });

    const fetched = getAttachment(testDb.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.caption).toBe('Hello');
  });
});

describe('linkAttachment + getAttachmentsFor', () => {
  it('round-trips a single link', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///a.jpg',
      mime: 'image/jpeg',
    });

    const link = linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-123',
      role: 'cover',
    });

    expect(link.attachmentId).toBe(att.id);
    expect(link.moduleId).toBe('books');
    expect(link.entityType).toBe('BookEntry');
    expect(link.entityId).toBe('book-123');
    expect(link.role).toBe('cover');
    expect(link.linkedAt).toMatch(/^\d{4}-\d{2}-\d{2} /);

    const attachments = getAttachmentsFor(testDb.adapter, {
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-123',
    });
    expect(attachments).toHaveLength(1);
    expect(attachments[0]!.id).toBe(att.id);
  });

  it('returns an empty array for an unbound entity', () => {
    const result = getAttachmentsFor(testDb.adapter, {
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'never-linked',
    });
    expect(result).toEqual([]);
  });

  it('scopes by module + entityType + entityId', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///a.jpg',
      mime: 'image/jpeg',
    });

    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'recipes',
      entityType: 'RecipeEntry',
      entityId: 'recipe-1',
    });

    const forBooks = getAttachmentsFor(testDb.adapter, {
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    const forRecipes = getAttachmentsFor(testDb.adapter, {
      moduleId: 'recipes',
      entityType: 'RecipeEntry',
      entityId: 'recipe-1',
    });

    expect(forBooks).toHaveLength(1);
    expect(forRecipes).toHaveLength(1);

    const forOther = getAttachmentsFor(testDb.adapter, {
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-2',
    });
    expect(forOther).toEqual([]);
  });
});

describe('getLinksForAttachment', () => {
  it('returns every binding for a single attachment across modules', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///shared.jpg',
      mime: 'image/jpeg',
    });

    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'recipes',
      entityType: 'RecipeEntry',
      entityId: 'recipe-1',
      role: 'hero',
    });
    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'journal',
      entityType: 'JournalEntry',
      entityId: 'entry-1',
    });

    const links = getLinksForAttachment(testDb.adapter, att.id);
    expect(links).toHaveLength(3);
    const moduleIds = links.map((l) => l.moduleId).sort();
    expect(moduleIds).toEqual(['books', 'journal', 'recipes']);

    const recipesLink = links.find((l) => l.moduleId === 'recipes');
    expect(recipesLink?.role).toBe('hero');
  });

  it('returns an empty array for an attachment with no links', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///orphan.jpg',
      mime: 'image/jpeg',
    });
    expect(getLinksForAttachment(testDb.adapter, att.id)).toEqual([]);
  });
});

describe('unlinkAttachment', () => {
  it('removes only the specified binding', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///multi.jpg',
      mime: 'image/jpeg',
    });

    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-2',
    });

    unlinkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });

    const remaining = getLinksForAttachment(testDb.adapter, att.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.entityId).toBe('book-2');

    // Attachment itself still exists
    expect(getAttachment(testDb.adapter, att.id)).not.toBeNull();
  });

  it('is a no-op for a non-existent binding', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///x.jpg',
      mime: 'image/jpeg',
    });
    expect(() =>
      unlinkAttachment(testDb.adapter, {
        attachmentId: att.id,
        moduleId: 'books',
        entityType: 'BookEntry',
        entityId: 'nope',
      }),
    ).not.toThrow();
  });
});

describe('deleteAttachment', () => {
  it('CASCADEs to hub_attachment_links (FK pragma on)', () => {
    const att = createAttachment(testDb.adapter, {
      uri: 'file:///cascade.jpg',
      mime: 'image/jpeg',
    });

    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    linkAttachment(testDb.adapter, {
      attachmentId: att.id,
      moduleId: 'recipes',
      entityType: 'RecipeEntry',
      entityId: 'recipe-1',
    });

    deleteAttachment(testDb.adapter, att.id);

    expect(getAttachment(testDb.adapter, att.id)).toBeNull();

    const links = testDb.adapter.query<{ attachment_id: string }>(
      `SELECT attachment_id FROM hub_attachment_links WHERE attachment_id = ?`,
      [att.id],
    );
    expect(links).toHaveLength(0);
  });

  it('is a no-op for a non-existent id', () => {
    expect(() => deleteAttachment(testDb.adapter, 'nope')).not.toThrow();
  });
});

describe('linkAttachment — FK safety', () => {
  it('rejects a link to a non-existent attachment id (FK constraint)', () => {
    expect(() =>
      linkAttachment(testDb.adapter, {
        attachmentId: 'missing-att-id',
        moduleId: 'books',
        entityType: 'BookEntry',
        entityId: 'book-1',
      }),
    ).toThrow();
  });
});
