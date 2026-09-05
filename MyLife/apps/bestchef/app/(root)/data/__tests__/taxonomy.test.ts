import { describe, expect, it } from 'vitest';
import {
  detectAllergens,
  inferDietaryTags,
  inferTimeTag,
  matchesFilter,
  getTagDomain,
  getTagValue,
  getTagLabel,
} from '../taxonomy';

describe('taxonomy', () => {
  it('detects allergens from ingredients', () => {
    const allergens = detectAllergens(['milk', 'flour', 'eggs', 'peanut butter']);
    expect(allergens).toContain('allergen:milk');
    expect(allergens).toContain('allergen:wheat');
    expect(allergens).toContain('allergen:eggs');
    expect(allergens).toContain('allergen:peanuts');
  });

  it('infers vegan from plant-only ingredients', () => {
    const tags = inferDietaryTags(['rice', 'tofu', 'soy sauce', 'vegetables']);
    expect(tags).toContain('diet:vegan');
    expect(tags).toContain('diet:dairy-free');
    expect(tags).toContain('diet:egg-free');
  });

  it('infers vegetarian when dairy present but no meat', () => {
    const tags = inferDietaryTags(['cheese', 'pasta', 'tomato sauce']);
    expect(tags).toContain('diet:vegetarian');
    expect(tags).not.toContain('diet:vegan');
  });

  it('infers time buckets', () => {
    expect(inferTimeTag(10)).toBe('time:under-15');
    expect(inferTimeTag(25)).toBe('time:under-30');
    expect(inferTimeTag(90)).toBe('time:1-2-hours');
    expect(inferTimeTag(180)).toBe('time:over-2-hours');
    expect(inferTimeTag(null)).toBe(null);
  });

  it('matches compound filters with OR within domain, AND across', () => {
    const item = { id: '1', tags: ['cuisine:thai' as const, 'diet:vegan' as const, 'time:under-30' as const] };
    expect(matchesFilter(item, ['cuisine:thai'])).toBe(true);
    expect(matchesFilter(item, ['cuisine:thai', 'diet:vegan'])).toBe(true);
    expect(matchesFilter(item, ['cuisine:italian'])).toBe(false);
    expect(matchesFilter(item, ['cuisine:thai', 'diet:keto'])).toBe(false);
    expect(matchesFilter(item, [])).toBe(true);
  });

  it('extracts tag domain and value', () => {
    expect(getTagDomain('diet:vegan')).toBe('diet');
    expect(getTagValue('cuisine:thai')).toBe('thai');
  });

  it('returns label for known tags', () => {
    expect(getTagLabel('diet:vegan')).toBe('Vegan');
    expect(getTagLabel('method:grill')).toBe('Grill');
    expect(getTagLabel('media:has-video')).toBe('Has Video');
  });
});
