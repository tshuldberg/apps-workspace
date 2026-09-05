import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { CLOSET_MODULE } from '../definition';
import {
  createClothingItem,
  createPackingList,
  exportClosetData,
  getAverageWearsBetweenWashes,
  getClothingItemById,
  groupDirtyItemsByCare,
  inferPackingSeason,
  listClothingItems,
  listClosetSettings,
  listDirtyClothingItems,
  listLaundryEventsForItem,
  listPackingLists,
  logWearEvent,
  markLaundryItemsClean,
  serializeClosetExport,
  setClosetSetting,
  togglePackingListItemPacked,
} from '..';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('closet', CLOSET_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('closet laundry workflows', () => {
  it('creates items with laundry defaults and filters by search and laundry status', () => {
    const tee = createClothingItem(testDb.adapter, 'item-1', {
      name: 'Travel Tee',
      category: 'tops',
      brand: 'Everlane',
    });
    createClothingItem(testDb.adapter, 'item-2', {
      name: 'Studio Pants',
      category: 'bottoms',
      laundryStatus: 'dirty',
      careInstructions: 'hand_wash',
    });

    expect(tee.careInstructions).toBe('machine_wash');
    expect(tee.autoDirtyOnWear).toBe(true);
    expect(tee.wearsSinceWash).toBe(0);

    expect(listClothingItems(testDb.adapter, { search: 'travel' })).toHaveLength(1);
    expect(listClothingItems(testDb.adapter, { laundryStatus: 'dirty' })).toHaveLength(1);
  });

  it('marks items dirty on wear and respects per-item auto dirty overrides', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Daily Tee',
      category: 'tops',
    });
    createClothingItem(testDb.adapter, 'item-2', {
      name: 'Wool Coat',
      category: 'outerwear',
      autoDirtyOnWear: false,
    });

    logWearEvent(testDb.adapter, 'wear-1', {
      date: '2026-03-08',
      itemIds: ['item-1', 'item-2'],
    });

    expect(getClothingItemById(testDb.adapter, 'item-1')?.laundryStatus).toBe('dirty');
    expect(getClothingItemById(testDb.adapter, 'item-1')?.wearsSinceWash).toBe(1);
    expect(getClothingItemById(testDb.adapter, 'item-2')?.laundryStatus).toBe('clean');
    expect(getClothingItemById(testDb.adapter, 'item-2')?.wearsSinceWash).toBe(1);
  });

  it('can disable global auto-dirty while still tracking wears since wash', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Knit Polo',
      category: 'tops',
    });
    setClosetSetting(testDb.adapter, 'laundryAutoDirty', '0');

    logWearEvent(testDb.adapter, 'wear-1', {
      date: '2026-03-08',
      itemIds: ['item-1'],
    });

    expect(getClothingItemById(testDb.adapter, 'item-1')?.laundryStatus).toBe('clean');
    expect(getClothingItemById(testDb.adapter, 'item-1')?.wearsSinceWash).toBe(1);
  });

  it('records laundry events, resets counters, and computes average wears between washes', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Black Tee',
      category: 'tops',
    });

    logWearEvent(testDb.adapter, 'wear-1', { date: '2026-03-01', itemIds: ['item-1'] });
    logWearEvent(testDb.adapter, 'wear-2', { date: '2026-03-02', itemIds: ['item-1'] });
    markLaundryItemsClean(testDb.adapter, { itemIds: ['item-1'], eventDate: '2026-03-03' });
    logWearEvent(testDb.adapter, 'wear-3', { date: '2026-03-05', itemIds: ['item-1'] });
    markLaundryItemsClean(testDb.adapter, { itemIds: ['item-1'], eventDate: '2026-03-06' });

    const item = getClothingItemById(testDb.adapter, 'item-1');
    const events = listLaundryEventsForItem(testDb.adapter, 'item-1');

    expect(item?.laundryStatus).toBe('clean');
    expect(item?.wearsSinceWash).toBe(0);
    expect(events).toHaveLength(2);
    expect(events[0]?.eventDate).toBe('2026-03-06');
    expect(getAverageWearsBetweenWashes(testDb.adapter, 'item-1')).toBe(1.5);
  });

  it('groups dirty items by care instruction with dirtiest items first', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Dress Shirt',
      category: 'tops',
      careInstructions: 'dry_clean',
      laundryStatus: 'dirty',
    });
    createClothingItem(testDb.adapter, 'item-2', {
      name: 'Training Tee',
      category: 'activewear',
      careInstructions: 'machine_wash',
      laundryStatus: 'dirty',
    });
    createClothingItem(testDb.adapter, 'item-3', {
      name: 'Gym Shorts',
      category: 'activewear',
      careInstructions: 'machine_wash',
      laundryStatus: 'dirty',
    });

    logWearEvent(testDb.adapter, 'wear-1', { date: '2026-03-01', itemIds: ['item-2', 'item-3'] });
    logWearEvent(testDb.adapter, 'wear-2', { date: '2026-03-02', itemIds: ['item-2'] });

    const groups = groupDirtyItemsByCare(listDirtyClothingItems(testDb.adapter));
    expect(groups.machine_wash.map((item) => item.id)).toEqual(['item-2', 'item-3']);
    expect(groups.dry_clean.map((item) => item.id)).toEqual(['item-1']);
  });
});

describe('closet packing and export workflows', () => {
  it('creates sortable packing lists with wardrobe picks and essentials', () => {
    createClothingItem(testDb.adapter, 'top-1', {
      name: 'White Tee',
      category: 'tops',
      seasons: ['spring'],
    });
    createClothingItem(testDb.adapter, 'bottom-1', {
      name: 'Khaki Chinos',
      category: 'bottoms',
      seasons: ['spring'],
    });
    createClothingItem(testDb.adapter, 'shoe-1', {
      name: 'Loafers',
      category: 'shoes',
      seasons: ['spring'],
    });

    const packingList = createPackingList(testDb.adapter, 'trip-1', {
      name: 'NYC Trip',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      occasions: ['work', 'casual'],
      mode: 'quick_list',
    });

    expect(inferPackingSeason('2026-04-10')).toBe('spring');
    expect(packingList.season).toBe('spring');
    expect(packingList.items.some((item) => item.customName === 'Toiletries')).toBe(true);
    expect(packingList.items.some((item) => item.clothingItemId === 'top-1')).toBe(true);
  });

  it('toggles packed state and keeps active trips ordered first', () => {
    createClothingItem(testDb.adapter, 'top-1', {
      name: 'Travel Tee',
      category: 'tops',
    });

    createPackingList(testDb.adapter, 'trip-old', {
      name: 'Last Month',
      startDate: '2026-02-01',
      endDate: '2026-02-03',
      occasions: [],
      mode: 'quick_list',
    });
    const upcoming = createPackingList(testDb.adapter, 'trip-next', {
      name: 'Next Week',
      startDate: '2099-02-01',
      endDate: '2099-02-03',
      occasions: [],
      mode: 'quick_list',
    });

    const firstItem = upcoming.items[0];
    expect(firstItem).toBeDefined();
    const toggled = togglePackingListItemPacked(testDb.adapter, firstItem!.id);
    const lists = listPackingLists(testDb.adapter);

    expect(toggled?.isPacked).toBe(true);
    expect(lists[0]?.id).toBe('trip-next');
  });

  it('exports closet bundles and serializes json and csv previews', () => {
    createClothingItem(testDb.adapter, 'item-1', {
      name: 'Archive Tee',
      category: 'tops',
      purchasePriceCents: 2500,
    });
    createPackingList(testDb.adapter, 'trip-1', {
      name: 'Weekend',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      occasions: ['casual'],
      mode: 'quick_list',
    });

    const bundle = exportClosetData(testDb.adapter);
    const json = serializeClosetExport(bundle, 'json');
    const csv = serializeClosetExport(bundle, 'csv');
    const settings = listClosetSettings(testDb.adapter);

    expect(bundle.items).toHaveLength(1);
    expect(bundle.packingLists).toHaveLength(1);
    expect(settings.some((setting) => setting.key === 'laundryAutoDirty')).toBe(true);
    expect(json).toContain('"module": "closet"');
    expect(csv).toContain('# closet-items.csv');
    expect(csv).toContain('Archive Tee');
  });
});
