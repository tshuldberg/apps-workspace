import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHubTestDatabase, type InMemoryTestDatabase } from '../../../test-utils';
import {
  bindTag,
  createTag,
  getEntitiesForTag,
  getOrCreateTag,
  getTagById,
  getTagsFor,
  searchTags,
  unbindTag,
} from '../operations';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createHubTestDatabase();
});

afterEach(() => {
  testDb.close();
});

describe('Tag CRUD', () => {
  it('creates a tag and round-trips via getTagById', () => {
    const created = createTag(testDb.adapter, { label: 'reading', color: '#C9894D' });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(created.label).toBe('reading');
    expect(created.color).toBe('#C9894D');
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}/);

    const fetched = getTagById(testDb.adapter, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.label).toBe('reading');
    expect(fetched?.color).toBe('#C9894D');
  });

  it('stores a null color when none provided', () => {
    const created = createTag(testDb.adapter, { label: 'plain' });
    expect(created.color).toBeNull();
  });

  it('returns null for an unknown tag id', () => {
    expect(getTagById(testDb.adapter, 'nope')).toBeNull();
  });

  it('throws when creating a duplicate label (UNIQUE violation)', () => {
    createTag(testDb.adapter, { label: 'fiction' });
    expect(() => createTag(testDb.adapter, { label: 'fiction' })).toThrow();
  });
});

describe('getOrCreateTag', () => {
  it('returns the same tag id when called twice with the same label', () => {
    const first = getOrCreateTag(testDb.adapter, 'favorite');
    const second = getOrCreateTag(testDb.adapter, 'favorite');

    expect(second.id).toBe(first.id);
    expect(second.label).toBe('favorite');
  });

  it('keeps the original color when the tag already exists', () => {
    const first = getOrCreateTag(testDb.adapter, 'green', '#00FF00');
    const second = getOrCreateTag(testDb.adapter, 'green', '#123456');

    expect(second.id).toBe(first.id);
    expect(second.color).toBe('#00FF00');
  });
});

describe('searchTags', () => {
  it('returns prefix matches ordered alphabetically by label', () => {
    createTag(testDb.adapter, { label: 'reading' });
    createTag(testDb.adapter, { label: 'read-later' });
    createTag(testDb.adapter, { label: 'writing' });

    const results = searchTags(testDb.adapter, 'read');

    expect(results).toHaveLength(2);
    expect(results.map((t) => t.label)).toEqual(['read-later', 'reading']);
  });

  it('honors the limit argument', () => {
    createTag(testDb.adapter, { label: 'a1' });
    createTag(testDb.adapter, { label: 'a2' });
    createTag(testDb.adapter, { label: 'a3' });

    const results = searchTags(testDb.adapter, 'a', 2);
    expect(results).toHaveLength(2);
    expect(results.map((t) => t.label)).toEqual(['a1', 'a2']);
  });

  it('escapes LIKE wildcards so % does not broaden the match', () => {
    createTag(testDb.adapter, { label: 'plain' });
    createTag(testDb.adapter, { label: '100%-sure' });

    // A literal '%' prefix should only match tags whose label actually starts with '%'
    const results = searchTags(testDb.adapter, '100%');
    expect(results.map((t) => t.label)).toEqual(['100%-sure']);
  });
});

describe('Tag bindings', () => {
  it('binds a tag to an entity and getTagsFor returns it', () => {
    const tag = createTag(testDb.adapter, { label: 'sci-fi' });

    const binding = bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });

    expect(binding.tagId).toBe(tag.id);
    expect(binding.moduleId).toBe('books');
    expect(binding.boundAt).toMatch(/^\d{4}-\d{2}-\d{2}/);

    const tagsFor = getTagsFor(testDb.adapter, {
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    expect(tagsFor).toHaveLength(1);
    expect(tagsFor[0]?.id).toBe(tag.id);
  });

  it('bindTag is idempotent on composite PK', () => {
    const tag = createTag(testDb.adapter, { label: 'dup' });
    const input = {
      tagId: tag.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    };

    const first = bindTag(testDb.adapter, input);
    const second = bindTag(testDb.adapter, input);

    expect(second.tagId).toBe(first.tagId);
    expect(second.boundAt).toBe(first.boundAt);

    const allBindings = testDb.adapter.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM hub_tag_bindings WHERE tag_id = ?`,
      [tag.id],
    );
    expect(allBindings[0]?.count).toBe(1);
  });

  it('getTagsFor returns tags alphabetically by label', () => {
    const tagB = createTag(testDb.adapter, { label: 'beta' });
    const tagA = createTag(testDb.adapter, { label: 'alpha' });
    const tagC = createTag(testDb.adapter, { label: 'gamma' });

    for (const t of [tagB, tagA, tagC]) {
      bindTag(testDb.adapter, {
        tagId: t.id,
        moduleId: 'books',
        entityType: 'BookEntry',
        entityId: 'book-x',
      });
    }

    const tags = getTagsFor(testDb.adapter, {
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-x',
    });
    expect(tags.map((t) => t.label)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('unbindTag removes only the specified binding', () => {
    const tag = createTag(testDb.adapter, { label: 'shared' });

    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-2',
    });
    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'recipes',
      entityType: 'Recipe',
      entityId: 'recipe-1',
    });

    unbindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });

    const remaining = getEntitiesForTag(testDb.adapter, tag.id);
    expect(remaining).toHaveLength(2);

    const remainingKeys = remaining.map(
      (b) => `${b.moduleId}/${b.entityType}/${b.entityId}`,
    );
    expect(remainingKeys).toContain('books/BookEntry/book-2');
    expect(remainingKeys).toContain('recipes/Recipe/recipe-1');
    expect(remainingKeys).not.toContain('books/BookEntry/book-1');
  });

  it('deleting a tag CASCADEs to its bindings (FK pragma enabled)', () => {
    const tag = createTag(testDb.adapter, { label: 'temp' });

    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'recipes',
      entityType: 'Recipe',
      entityId: 'recipe-1',
    });

    testDb.adapter.execute(`DELETE FROM hub_tags WHERE id = ?`, [tag.id]);

    expect(getTagById(testDb.adapter, tag.id)).toBeNull();

    const remaining = getEntitiesForTag(testDb.adapter, tag.id);
    expect(remaining).toHaveLength(0);
  });

  it('getEntitiesForTag returns all bindings across modules for a given tag', () => {
    const tag = createTag(testDb.adapter, { label: 'cross-module' });

    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'books',
      entityType: 'BookEntry',
      entityId: 'book-1',
    });
    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'recipes',
      entityType: 'Recipe',
      entityId: 'recipe-1',
    });
    bindTag(testDb.adapter, {
      tagId: tag.id,
      moduleId: 'journal',
      entityType: 'Entry',
      entityId: 'entry-1',
    });

    const bindings = getEntitiesForTag(testDb.adapter, tag.id);
    expect(bindings).toHaveLength(3);
    expect(new Set(bindings.map((b) => b.moduleId))).toEqual(
      new Set(['books', 'recipes', 'journal']),
    );
    for (const b of bindings) {
      expect(b.tagId).toBe(tag.id);
      expect(b.boundAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });
});
