import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { TRAILS_MODULE } from '../definition';
import {
  createPackingTemplate,
  getPackingTemplates,
  getPackingTemplate,
  createPackingItem,
  getPackingItems,
  updatePackingItem,
  checkItem,
  uncheckItem,
  uncheckAll,
  deletePackingTemplate,
  deletePackingItem,
  getPackingProgress,
} from '../db/crud';
import { DEFAULT_TEMPLATES } from '../packing/default-templates';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('trails', TRAILS_MODULE.migrations!);
});
afterEach(() => { testDb.close(); });

describe('Default Templates', () => {
  it('contains 5+ built-in templates', () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('each template has items in at least 3 categories', () => {
    for (const tmpl of DEFAULT_TEMPLATES) {
      const cats = new Set(tmpl.items.map(i => i.category));
      expect(cats.size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('Packing Template CRUD', () => {
  it('creates a custom template', () => {
    const t = createPackingTemplate(testDb.adapter, 'pt1', 'My List', 'custom', false);
    expect(t.id).toBe('pt1');
    expect(t.name).toBe('My List');
    expect(t.type).toBe('custom');
    expect(t.isBuiltIn).toBe(false);
  });

  it('creates a built-in template', () => {
    const t = createPackingTemplate(testDb.adapter, 'pt1', 'Day Hike', 'day_hike', true);
    expect(t.isBuiltIn).toBe(true);
  });

  it('lists all templates', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingTemplate(testDb.adapter, 'pt2', 'B', 'custom', false);
    expect(getPackingTemplates(testDb.adapter)).toHaveLength(2);
  });

  it('gets a single template', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    const t = getPackingTemplate(testDb.adapter, 'pt1');
    expect(t).not.toBeNull();
    expect(t!.name).toBe('A');
  });

  it('deletes a template and cascades to items', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingItem(testDb.adapter, 'pi1', { templateId: 'pt1', name: 'Water', category: 'essentials' });
    deletePackingTemplate(testDb.adapter, 'pt1');
    expect(getPackingTemplate(testDb.adapter, 'pt1')).toBeNull();
    expect(getPackingItems(testDb.adapter, 'pt1')).toHaveLength(0);
  });
});

describe('Packing Item CRUD', () => {
  it('creates and retrieves items', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingItem(testDb.adapter, 'pi1', { templateId: 'pt1', name: 'Water', category: 'essentials' });
    createPackingItem(testDb.adapter, 'pi2', { templateId: 'pt1', name: 'Sunscreen', category: 'essentials' });
    const items = getPackingItems(testDb.adapter, 'pt1');
    expect(items).toHaveLength(2);
  });

  it('checks and unchecks items', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingItem(testDb.adapter, 'pi1', { templateId: 'pt1', name: 'Water', category: 'essentials' });
    checkItem(testDb.adapter, 'pi1');
    let items = getPackingItems(testDb.adapter, 'pt1');
    expect(items[0].isChecked).toBe(true);

    uncheckItem(testDb.adapter, 'pi1');
    items = getPackingItems(testDb.adapter, 'pt1');
    expect(items[0].isChecked).toBe(false);
  });

  it('updates a packing item', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingItem(testDb.adapter, 'pi1', { templateId: 'pt1', name: 'Water', category: 'essentials' });

    const updated = updatePackingItem(testDb.adapter, 'pi1', {
      name: 'Water Filter',
      category: 'navigation',
      isChecked: true,
      sortOrder: 4,
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe('Water Filter');
    expect(updated?.category).toBe('navigation');
    expect(updated?.isChecked).toBe(true);
    expect(updated?.sortOrder).toBe(4);
  });

  it('unchecks all items in a template', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingItem(testDb.adapter, 'pi1', { templateId: 'pt1', name: 'Water', category: 'essentials' });
    createPackingItem(testDb.adapter, 'pi2', { templateId: 'pt1', name: 'Food', category: 'food_water' });
    checkItem(testDb.adapter, 'pi1');
    checkItem(testDb.adapter, 'pi2');
    uncheckAll(testDb.adapter, 'pt1');
    const items = getPackingItems(testDb.adapter, 'pt1');
    expect(items.every(i => !i.isChecked)).toBe(true);
  });

  it('deletes a single item', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingItem(testDb.adapter, 'pi1', { templateId: 'pt1', name: 'Water', category: 'essentials' });
    deletePackingItem(testDb.adapter, 'pi1');
    expect(getPackingItems(testDb.adapter, 'pt1')).toHaveLength(0);
  });

  it('tracks packing progress', () => {
    createPackingTemplate(testDb.adapter, 'pt1', 'A', 'custom', false);
    createPackingItem(testDb.adapter, 'pi1', { templateId: 'pt1', name: 'Water', category: 'essentials' });
    createPackingItem(testDb.adapter, 'pi2', { templateId: 'pt1', name: 'Food', category: 'food_water' });
    createPackingItem(testDb.adapter, 'pi3', { templateId: 'pt1', name: 'Map', category: 'navigation' });
    checkItem(testDb.adapter, 'pi1');
    const progress = getPackingProgress(testDb.adapter, 'pt1');
    expect(progress.checked).toBe(1);
    expect(progress.total).toBe(3);
  });
});
