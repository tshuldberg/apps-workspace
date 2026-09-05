import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { SHOP_MODULE } from '../definition';
import {
  createGift,
  createGiftPerson,
  deleteGift,
  getGiftById,
  getGiftHistory,
  getTotalSpentOnPerson,
  getUpcomingOccasions,
  listGifts,
  listGiftsByOccasion,
  listGiftsByPerson,
  updateGift,
} from '../index';

let testDb: InMemoryTestDatabase;

const DAY = 86_400_000;
const NOW = new Date('2026-04-21T00:00:00Z').getTime();

beforeEach(() => {
  testDb = createModuleTestDatabase('shop', SHOP_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

function newPerson(name = 'Mom') {
  return createGiftPerson(testDb.adapter, { name });
}

describe('gifts CRUD', () => {
  it('creates a gift with defaults', () => {
    const p = newPerson();
    const g = createGift(testDb.adapter, {
      personId: p.id,
      personName: p.name,
      itemDescription: 'Cashmere scarf',
      occasion: 'birthday',
      amountCents: 8900,
      giftDate: NOW,
    });
    expect(g.itemDescription).toBe('Cashmere scarf');
    expect(g.isGroupGift).toBe(false);
    expect(g.purchaseId).toBeNull();
    expect(g.amountCents).toBe(8900);
  });

  it('rejects group gift without my_share', () => {
    const p = newPerson();
    expect(() =>
      createGift(testDb.adapter, {
        personId: p.id,
        personName: p.name,
        itemDescription: 'Group fund',
        occasion: 'birthday',
        amountCents: 30000,
        giftDate: NOW,
        isGroupGift: true,
      }),
    ).toThrow();
  });

  it('reads missing as null', () => {
    expect(getGiftById(testDb.adapter, 'missing')).toBeNull();
  });

  it('updates a gift', () => {
    const p = newPerson();
    const g = createGift(testDb.adapter, {
      personId: p.id,
      personName: p.name,
      itemDescription: 'Mug',
      occasion: 'birthday',
      amountCents: 1500,
      giftDate: NOW,
    });
    const updated = updateGift(testDb.adapter, g.id, {
      reactionNotes: 'loved it',
      amountCents: 2000,
    });
    expect(updated?.reactionNotes).toBe('loved it');
    expect(updated?.amountCents).toBe(2000);
  });

  it('deletes a gift', () => {
    const p = newPerson();
    const g = createGift(testDb.adapter, {
      personId: p.id,
      personName: p.name,
      itemDescription: 'Card',
      occasion: 'thank_you',
      amountCents: 500,
      giftDate: NOW,
    });
    expect(deleteGift(testDb.adapter, g.id)).toBe(true);
    expect(getGiftById(testDb.adapter, g.id)).toBeNull();
  });
});

describe('gifts list queries', () => {
  function seed() {
    const mom = newPerson('Mom');
    const dad = newPerson('Dad');
    createGift(testDb.adapter, {
      personId: mom.id,
      personName: 'Mom',
      itemDescription: 'Scarf',
      occasion: 'birthday',
      amountCents: 8000,
      giftDate: NOW - 100 * DAY,
    });
    createGift(testDb.adapter, {
      personId: mom.id,
      personName: 'Mom',
      itemDescription: 'Wine',
      occasion: 'holiday',
      amountCents: 4500,
      giftDate: NOW - 30 * DAY,
    });
    createGift(testDb.adapter, {
      personId: dad.id,
      personName: 'Dad',
      itemDescription: 'Watch',
      occasion: 'birthday',
      amountCents: 25000,
      giftDate: NOW - 60 * DAY,
    });
    return { mom, dad };
  }

  it('listGifts returns all sorted by gift_date DESC', () => {
    seed();
    const all = listGifts(testDb.adapter);
    expect(all.map((g) => g.itemDescription)).toEqual(['Wine', 'Watch', 'Scarf']);
  });

  it('listGiftsByPerson returns just one persons gifts in date desc order', () => {
    const { mom } = seed();
    const list = listGiftsByPerson(testDb.adapter, mom.id);
    expect(list.map((g) => g.itemDescription)).toEqual(['Wine', 'Scarf']);
  });

  it('listGiftsByOccasion filters by occasion', () => {
    seed();
    const birthdays = listGiftsByOccasion(testDb.adapter, 'birthday');
    expect(birthdays.map((g) => g.itemDescription).sort()).toEqual([
      'Scarf',
      'Watch',
    ]);
  });

  it('getGiftHistory mirrors listGiftsByPerson', () => {
    const { mom } = seed();
    const a = getGiftHistory(testDb.adapter, mom.id);
    const b = listGiftsByPerson(testDb.adapter, mom.id);
    expect(a.map((g) => g.id)).toEqual(b.map((g) => g.id));
  });

  it('getTotalSpentOnPerson sums individual gifts at face value', () => {
    const { mom } = seed();
    expect(getTotalSpentOnPerson(testDb.adapter, mom.id)).toBe(8000 + 4500);
  });

  it('getTotalSpentOnPerson uses my_share for group gifts', () => {
    const dad = newPerson('Dad');
    createGift(testDb.adapter, {
      personId: dad.id,
      personName: 'Dad',
      itemDescription: 'Pooled gift',
      occasion: 'birthday',
      amountCents: 30000,
      giftDate: NOW,
      isGroupGift: true,
      groupTotalCents: 30000,
      myShareCents: 5000,
    });
    createGift(testDb.adapter, {
      personId: dad.id,
      personName: 'Dad',
      itemDescription: 'Solo book',
      occasion: 'holiday',
      amountCents: 2000,
      giftDate: NOW,
    });
    expect(getTotalSpentOnPerson(testDb.adapter, dad.id)).toBe(5000 + 2000);
  });
});

describe('getUpcomingOccasions', () => {
  it('returns people whose next_occasion_date is within window', () => {
    createGiftPerson(testDb.adapter, {
      name: 'Anna',
      nextOccasion: 'birthday',
      nextOccasionDate: NOW + 5 * DAY,
    });
    createGiftPerson(testDb.adapter, {
      name: 'Ben',
      nextOccasion: 'holiday',
      nextOccasionDate: NOW + 60 * DAY,
    });
    createGiftPerson(testDb.adapter, { name: 'NoDate' });
    const within30 = getUpcomingOccasions(testDb.adapter, NOW, 30);
    expect(within30.map((u) => u.personName)).toEqual(['Anna']);
    expect(within30[0]!.daysUntil).toBe(5);
  });

  it('returns empty for negative window', () => {
    createGiftPerson(testDb.adapter, {
      name: 'X',
      nextOccasionDate: NOW + 1 * DAY,
    });
    expect(getUpcomingOccasions(testDb.adapter, NOW, -1)).toEqual([]);
  });
});
