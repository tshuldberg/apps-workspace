import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { FRIENDS_MODULE } from '../definition';
import { createPerson } from '../db/crud/people';
import {
  createGift,
  getGift,
  deleteGift,
  listGiftsForPerson,
  listGiftsByOccasion,
  getGiftSpendingForPerson,
} from '../db/crud/gifts';
import {
  createIdea,
  getIdea,
  updateIdea,
  deleteIdea,
  listIdeasForPerson,
  markPurchased,
} from '../db/crud/gift-ideas';

let db: DatabaseAdapter;
let closeDb: () => void;
let p1Id: string;
let p2Id: string;

beforeEach(() => {
  const testDb = createModuleTestDatabase('friends', FRIENDS_MODULE.migrations!);
  db = testDb.adapter;
  closeDb = testDb.close;

  // Create real people to satisfy foreign key constraints
  const person1 = createPerson(db, { display_name: 'Alice', relationship_type: 'friend' });
  const person2 = createPerson(db, { display_name: 'Bob', relationship_type: 'friend' });
  p1Id = person1.id;
  p2Id = person2.id;
});

afterEach(() => {
  closeDb();
});

// ── Gift CRUD round-trip ────────────────────────────────────────────

describe('Gift CRUD round-trip', () => {
  it('creates, reads, and deletes a gift', () => {
    const gift = createGift(db, {
      person_id: p1Id,
      direction: 'given',
      description: 'Leather journal',
      occasion: 'birthday',
      amount_cents: 3500,
      date: '2026-04-15',
      reaction_notes: 'They loved it',
    });

    expect(gift.id).toBeTruthy();
    expect(gift.person_id).toBe(p1Id);
    expect(gift.direction).toBe('given');
    expect(gift.description).toBe('Leather journal');
    expect(gift.occasion).toBe('birthday');
    expect(gift.amount_cents).toBe(3500);
    expect(gift.date).toBe('2026-04-15');
    expect(gift.reaction_notes).toBe('They loved it');
    expect(gift.created_at).toBeTruthy();

    // Read
    const fetched = getGift(db, gift.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.description).toBe('Leather journal');

    // Delete
    deleteGift(db, gift.id);
    expect(getGift(db, gift.id)).toBeNull();
  });

  it('creates a minimal gift with only required fields', () => {
    const gift = createGift(db, {
      person_id: p1Id,
      direction: 'received',
      description: 'Mystery book',
    });

    expect(gift.occasion).toBeNull();
    expect(gift.amount_cents).toBeNull();
    expect(gift.date).toBeNull();
    expect(gift.reaction_notes).toBeNull();
    expect(gift.photo_id).toBeNull();
    expect(gift.link_url).toBeNull();
  });
});

// ── List gifts for person filtered by direction ─────────────────────

describe('listGiftsForPerson', () => {
  it('returns all gifts for a person', () => {
    createGift(db, { person_id: p1Id, direction: 'given', description: 'Gift A' });
    createGift(db, { person_id: p1Id, direction: 'received', description: 'Gift B' });
    createGift(db, { person_id: p2Id, direction: 'given', description: 'Gift C' });

    const p1Gifts = listGiftsForPerson(db, p1Id);
    expect(p1Gifts).toHaveLength(2);
  });

  it('filters by direction', () => {
    createGift(db, { person_id: p1Id, direction: 'given', description: 'Gift A' });
    createGift(db, { person_id: p1Id, direction: 'given', description: 'Gift B' });
    createGift(db, { person_id: p1Id, direction: 'received', description: 'Gift C' });

    const given = listGiftsForPerson(db, p1Id, 'given');
    expect(given).toHaveLength(2);
    expect(given.every((g) => g.direction === 'given')).toBe(true);

    const received = listGiftsForPerson(db, p1Id, 'received');
    expect(received).toHaveLength(1);
    expect(received[0].direction).toBe('received');
  });
});

// ── List by occasion ────────────────────────────────────────────────

describe('listGiftsByOccasion', () => {
  it('filters gifts by occasion', () => {
    createGift(db, { person_id: p1Id, direction: 'given', description: 'Birthday book', occasion: 'birthday' });
    createGift(db, { person_id: p1Id, direction: 'given', description: 'Holiday scarf', occasion: 'holiday' });
    createGift(db, { person_id: p1Id, direction: 'given', description: 'Birthday mug', occasion: 'birthday' });

    const birthdays = listGiftsByOccasion(db, p1Id, 'birthday');
    expect(birthdays).toHaveLength(2);
    expect(birthdays.every((g) => g.occasion === 'birthday')).toBe(true);

    const holidays = listGiftsByOccasion(db, p1Id, 'holiday');
    expect(holidays).toHaveLength(1);
  });
});

// ── Spending calculation ────────────────────────────────────────────

describe('getGiftSpendingForPerson', () => {
  it('returns total amount_cents for gifts given to a person', () => {
    createGift(db, { person_id: p1Id, direction: 'given', description: 'A', amount_cents: 2500 });
    createGift(db, { person_id: p1Id, direction: 'given', description: 'B', amount_cents: 1500 });
    // Received gifts should not count
    createGift(db, { person_id: p1Id, direction: 'received', description: 'C', amount_cents: 9999 });
    // Gifts without amount should not affect total
    createGift(db, { person_id: p1Id, direction: 'given', description: 'D' });

    const total = getGiftSpendingForPerson(db, p1Id);
    expect(total).toBe(4000);
  });

  it('returns 0 when no gifts exist', () => {
    expect(getGiftSpendingForPerson(db, 'nobody')).toBe(0);
  });
});

// ── Gift Idea CRUD round-trip ───────────────────────────────────────

describe('Gift Idea CRUD round-trip', () => {
  it('creates, reads, updates, and deletes an idea', () => {
    const idea = createIdea(db, {
      person_id: p1Id,
      description: 'Wireless earbuds',
      estimated_price_cents: 7900,
      priority: 3,
      source_note: 'Saw on Amazon',
      link_url: 'https://example.com/earbuds',
    });

    expect(idea.id).toBeTruthy();
    expect(idea.person_id).toBe(p1Id);
    expect(idea.description).toBe('Wireless earbuds');
    expect(idea.estimated_price_cents).toBe(7900);
    expect(idea.priority).toBe(3);
    expect(idea.source_note).toBe('Saw on Amazon');
    expect(idea.link_url).toBe('https://example.com/earbuds');
    expect(idea.is_purchased).toBe(false);
    expect(idea.created_at).toBeTruthy();
    expect(idea.updated_at).toBeTruthy();

    // Read
    const fetched = getIdea(db, idea.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.description).toBe('Wireless earbuds');
    expect(fetched!.is_purchased).toBe(false);

    // Update
    updateIdea(db, idea.id, { priority: 5, description: 'Sony wireless earbuds' });
    const updated = getIdea(db, idea.id)!;
    expect(updated.priority).toBe(5);
    expect(updated.description).toBe('Sony wireless earbuds');

    // Delete
    deleteIdea(db, idea.id);
    expect(getIdea(db, idea.id)).toBeNull();
  });
});

// ── Mark idea as purchased ──────────────────────────────────────────

describe('markPurchased', () => {
  it('sets is_purchased to true', () => {
    const idea = createIdea(db, {
      person_id: p1Id,
      description: 'Book about plants',
    });

    expect(idea.is_purchased).toBe(false);

    markPurchased(db, idea.id);
    const updated = getIdea(db, idea.id)!;
    expect(updated.is_purchased).toBe(true);
  });
});

// ── Priority sorting ────────────────────────────────────────────────

describe('listIdeasForPerson', () => {
  it('returns ideas sorted by priority desc, then created_at desc', () => {
    createIdea(db, { person_id: p1Id, description: 'Low priority', priority: 1 });
    createIdea(db, { person_id: p1Id, description: 'High priority', priority: 5 });
    createIdea(db, { person_id: p1Id, description: 'Medium priority', priority: 3 });

    const ideas = listIdeasForPerson(db, p1Id);
    expect(ideas).toHaveLength(3);
    expect(ideas[0].description).toBe('High priority');
    expect(ideas[1].description).toBe('Medium priority');
    expect(ideas[2].description).toBe('Low priority');
  });

  it('excludes ideas for other people', () => {
    createIdea(db, { person_id: p1Id, description: 'For p1' });
    createIdea(db, { person_id: p2Id, description: 'For p2' });

    const ideas = listIdeasForPerson(db, p1Id);
    expect(ideas).toHaveLength(1);
    expect(ideas[0].description).toBe('For p1');
  });
});

// ── Validation ──────────────────────────────────────────────────────

describe('validation', () => {
  it('rejects gift with missing description', () => {
    expect(() =>
      createGift(db, {
        person_id: p1Id,
        direction: 'given',
        description: '',
      }),
    ).toThrow();
  });

  it('rejects gift with negative amount_cents', () => {
    expect(() =>
      createGift(db, {
        person_id: p1Id,
        direction: 'given',
        description: 'Test',
        amount_cents: -100,
      }),
    ).toThrow();
  });

  it('rejects idea with missing description', () => {
    expect(() =>
      createIdea(db, {
        person_id: p1Id,
        description: '',
      }),
    ).toThrow();
  });

  it('rejects idea with negative estimated_price_cents', () => {
    expect(() =>
      createIdea(db, {
        person_id: p1Id,
        description: 'Test',
        estimated_price_cents: -50,
      }),
    ).toThrow();
  });

  it('rejects idea with priority > 5', () => {
    expect(() =>
      createIdea(db, {
        person_id: p1Id,
        description: 'Test',
        priority: 6,
      }),
    ).toThrow();
  });
});
