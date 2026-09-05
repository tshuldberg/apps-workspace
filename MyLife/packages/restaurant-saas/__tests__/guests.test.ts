import { describe, it, expect } from 'vitest';
import { evaluateAutoTags } from '@/lib/guests/auto-tags';
import { hasAllergens, formatAllergenAlert, COMMON_ALLERGENS } from '@/lib/guests/allergens';
import type { RestaurantDinerProfile } from '@/lib/guests/types';

function makeProfile(overrides: Partial<RestaurantDinerProfile> = {}): RestaurantDinerProfile {
  return {
    id: 'p1',
    restaurant_id: 'r1',
    diner_id: 'd1',
    visit_count: 0,
    last_visit_at: null,
    lifetime_spend_cents: 0,
    vip: false,
    banned: false,
    banned_reason: null,
    allergens: [],
    preferences: {},
    notes: null,
    auto_tags: [],
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('evaluateAutoTags', () => {
  it('tags VIP for 12+ visits', () => {
    const profile = makeProfile({ visit_count: 12, lifetime_spend_cents: 10000 });
    const tags = evaluateAutoTags(profile);
    const vip = tags.find((t) => t.tag === 'vip');
    expect(vip).toBeDefined();
    expect(vip!.reason).toContain('12+ visits');
    expect(vip!.scoredAt).toBeTruthy();
  });

  it('tags VIP for $200+ average check', () => {
    const profile = makeProfile({ visit_count: 3, lifetime_spend_cents: 90000 }); // $300 avg
    const tags = evaluateAutoTags(profile);
    const vip = tags.find((t) => t.tag === 'vip');
    expect(vip).toBeDefined();
    expect(vip!.reason).toContain('$200+ avg check');
  });

  it('tags VIP with both reasons when both conditions met', () => {
    const profile = makeProfile({ visit_count: 15, lifetime_spend_cents: 600000 });
    const tags = evaluateAutoTags(profile);
    const vip = tags.find((t) => t.tag === 'vip');
    expect(vip).toBeDefined();
    expect(vip!.reason).toContain('12+ visits');
    expect(vip!.reason).toContain('$200+ avg check');
  });

  it('does not tag VIP below thresholds', () => {
    const profile = makeProfile({ visit_count: 5, lifetime_spend_cents: 5000 });
    const tags = evaluateAutoTags(profile);
    expect(tags.find((t) => t.tag === 'vip')).toBeUndefined();
  });

  it('tags Regular for 5+ visits', () => {
    const profile = makeProfile({ visit_count: 5 });
    const tags = evaluateAutoTags(profile);
    const regular = tags.find((t) => t.tag === 'regular');
    expect(regular).toBeDefined();
    expect(regular!.reason).toContain('5+ visits');
  });

  it('does not tag Regular below 5 visits', () => {
    const profile = makeProfile({ visit_count: 4 });
    const tags = evaluateAutoTags(profile);
    expect(tags.find((t) => t.tag === 'regular')).toBeUndefined();
  });

  it('tags New Guest for 1 visit', () => {
    const profile = makeProfile({ visit_count: 1 });
    const tags = evaluateAutoTags(profile);
    const newGuest = tags.find((t) => t.tag === 'new_guest');
    expect(newGuest).toBeDefined();
    expect(newGuest!.reason).toContain('first visit');
  });

  it('tags New Guest for 0 visits', () => {
    const profile = makeProfile({ visit_count: 0 });
    const tags = evaluateAutoTags(profile);
    expect(tags.find((t) => t.tag === 'new_guest')).toBeDefined();
  });

  it('does not tag New Guest for 2+ visits', () => {
    const profile = makeProfile({ visit_count: 2 });
    const tags = evaluateAutoTags(profile);
    expect(tags.find((t) => t.tag === 'new_guest')).toBeUndefined();
  });

  it('tags At Risk for 60+ days since last visit', () => {
    const daysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const profile = makeProfile({ visit_count: 5, last_visit_at: daysAgo });
    const tags = evaluateAutoTags(profile);
    const atRisk = tags.find((t) => t.tag === 'at_risk');
    expect(atRisk).toBeDefined();
    expect(atRisk!.reason).toContain('no visit in');
    expect(atRisk!.reason).toContain('days');
  });

  it('does not tag At Risk for recent visits', () => {
    const recentVisit = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const profile = makeProfile({ visit_count: 5, last_visit_at: recentVisit });
    const tags = evaluateAutoTags(profile);
    expect(tags.find((t) => t.tag === 'at_risk')).toBeUndefined();
  });

  it('does not tag At Risk when last_visit_at is null', () => {
    const profile = makeProfile({ visit_count: 0, last_visit_at: null });
    const tags = evaluateAutoTags(profile);
    expect(tags.find((t) => t.tag === 'at_risk')).toBeUndefined();
  });

  it('tags Big Spender for $500+ lifetime spend', () => {
    const profile = makeProfile({ lifetime_spend_cents: 75000 });
    const tags = evaluateAutoTags(profile);
    const spender = tags.find((t) => t.tag === 'big_spender');
    expect(spender).toBeDefined();
    expect(spender!.reason).toContain('Big Spender');
  });

  it('multiple tags can apply simultaneously', () => {
    const profile = makeProfile({
      visit_count: 15,
      lifetime_spend_cents: 600000,
      last_visit_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const tags = evaluateAutoTags(profile);
    const tagNames = tags.map((t) => t.tag);
    expect(tagNames).toContain('vip');
    expect(tagNames).toContain('regular');
    expect(tagNames).toContain('big_spender');
    expect(tagNames).toContain('at_risk');
    expect(tags.length).toBeGreaterThanOrEqual(4);
  });

  it('all tags include explainability strings', () => {
    const profile = makeProfile({
      visit_count: 15,
      lifetime_spend_cents: 600000,
      last_visit_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const tags = evaluateAutoTags(profile);
    for (const tag of tags) {
      expect(tag.reason).toBeTruthy();
      expect(tag.reason.length).toBeGreaterThan(10);
      expect(tag.scoredAt).toBeTruthy();
    }
  });
});

describe('allergens', () => {
  it('COMMON_ALLERGENS contains expected allergens', () => {
    expect(COMMON_ALLERGENS).toContain('Gluten');
    expect(COMMON_ALLERGENS).toContain('Dairy');
    expect(COMMON_ALLERGENS).toContain('Nuts');
    expect(COMMON_ALLERGENS).toContain('Shellfish');
    expect(COMMON_ALLERGENS).toContain('Peanuts');
    expect(COMMON_ALLERGENS).toContain('Sesame');
    expect(COMMON_ALLERGENS.length).toBe(9);
  });

  it('hasAllergens returns true when allergens present', () => {
    const profile = makeProfile({ allergens: ['Gluten', 'Dairy'] });
    expect(hasAllergens(profile)).toBe(true);
  });

  it('hasAllergens returns false when no allergens', () => {
    const profile = makeProfile({ allergens: [] });
    expect(hasAllergens(profile)).toBe(false);
  });

  it('formatAllergenAlert formats single allergen', () => {
    expect(formatAllergenAlert(['Gluten'])).toBe('ALLERGEN ALERT: Gluten');
  });

  it('formatAllergenAlert formats multiple allergens', () => {
    expect(formatAllergenAlert(['Gluten', 'Dairy', 'Nuts'])).toBe(
      'ALLERGEN ALERT: Gluten, Dairy, Nuts',
    );
  });

  it('formatAllergenAlert returns empty string for no allergens', () => {
    expect(formatAllergenAlert([])).toBe('');
  });
});
