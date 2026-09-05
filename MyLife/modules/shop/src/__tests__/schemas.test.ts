import { describe, expect, it } from 'vitest';
import {
  WishlistInputSchema,
  WishlistItemInputSchema,
  PhotoInputSchema,
  PrioritySchema,
  CategorySchema,
  OccasionSchema,
  PhotoKindSchema,
} from '../models/schemas';

describe('enum schemas', () => {
  it('PrioritySchema accepts valid values and rejects invalid', () => {
    expect(PrioritySchema.safeParse('need').success).toBe(true);
    expect(PrioritySchema.safeParse('want').success).toBe(true);
    expect(PrioritySchema.safeParse('someday').success).toBe(true);
    expect(PrioritySchema.safeParse('dream').success).toBe(true);
    expect(PrioritySchema.safeParse('URGENT').success).toBe(false);
    expect(PrioritySchema.safeParse('').success).toBe(false);
  });

  it('CategorySchema rejects unknown categories', () => {
    expect(CategorySchema.safeParse('tech').success).toBe(true);
    expect(CategorySchema.safeParse('gaming').success).toBe(true);
    expect(CategorySchema.safeParse('beauty').success).toBe(false);
    expect(CategorySchema.safeParse('').success).toBe(false);
  });

  it('OccasionSchema rejects unknown occasions', () => {
    expect(OccasionSchema.safeParse('birthday').success).toBe(true);
    expect(OccasionSchema.safeParse('anniversary').success).toBe(false);
  });

  it('PhotoKindSchema rejects unknown kinds', () => {
    expect(PhotoKindSchema.safeParse('product').success).toBe(true);
    expect(PhotoKindSchema.safeParse('selfie').success).toBe(false);
  });
});

describe('WishlistInputSchema', () => {
  it('accepts name only, applying defaults', () => {
    const parsed = WishlistInputSchema.parse({ name: 'Birthday' });
    expect(parsed.description).toBeNull();
    expect(parsed.occasion).toBeNull();
    expect(parsed.personId).toBeNull();
    expect(parsed.isShareable).toBe(false);
  });

  it('rejects empty name', () => {
    expect(WishlistInputSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects bad occasion', () => {
    expect(
      WishlistInputSchema.safeParse({ name: 'x', occasion: 'anniversary' }).success,
    ).toBe(false);
  });

  it('rejects overly long name', () => {
    const long = 'x'.repeat(201);
    expect(WishlistInputSchema.safeParse({ name: long }).success).toBe(false);
  });
});

describe('WishlistItemInputSchema', () => {
  const base = { listId: 'list-1', name: 'Thing', category: 'tech' as const };

  it('accepts minimal with category and listId', () => {
    const parsed = WishlistItemInputSchema.parse(base);
    expect(parsed.priority).toBe('want');
    expect(parsed.priceCents).toBeNull();
  });

  it('rejects invalid priority', () => {
    expect(
      WishlistItemInputSchema.safeParse({ ...base, priority: 'URGENT' }).success,
    ).toBe(false);
  });

  it('rejects invalid category', () => {
    expect(
      WishlistItemInputSchema.safeParse({ ...base, category: 'beauty' }).success,
    ).toBe(false);
  });

  it('rejects negative price', () => {
    expect(
      WishlistItemInputSchema.safeParse({ ...base, priceCents: -5 }).success,
    ).toBe(false);
  });

  it('rejects empty name', () => {
    expect(
      WishlistItemInputSchema.safeParse({ ...base, name: '' }).success,
    ).toBe(false);
  });

  it('accepts null optional fields', () => {
    const parsed = WishlistItemInputSchema.parse({
      ...base,
      priceCents: null,
      url: null,
      notesMd: null,
    });
    expect(parsed.priceCents).toBeNull();
  });
});

describe('PhotoInputSchema', () => {
  it('requires kind and localUri', () => {
    const parsed = PhotoInputSchema.parse({
      kind: 'product',
      localUri: 'file:///tmp/a.jpg',
    });
    expect(parsed.kind).toBe('product');
    expect(parsed.wishlistItemId).toBeNull();
  });

  it('rejects invalid kind', () => {
    expect(
      PhotoInputSchema.safeParse({ kind: 'selfie', localUri: 'file:///tmp/a.jpg' })
        .success,
    ).toBe(false);
  });

  it('rejects empty localUri', () => {
    expect(
      PhotoInputSchema.safeParse({ kind: 'product', localUri: '' }).success,
    ).toBe(false);
  });
});
