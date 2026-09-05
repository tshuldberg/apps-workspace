import type { RestaurantDinerProfile } from '@/lib/guests/types';
import type { AudienceRule } from './types';

export function evaluateRule(profile: RestaurantDinerProfile, rule: AudienceRule): boolean {
  const raw = getFieldValue(profile, rule.field);
  const { operator, value } = rule;

  if (raw === undefined || raw === null) return false;

  switch (operator) {
    case 'eq':
      return String(raw) === String(value);
    case 'gte':
      return Number(raw) >= Number(value);
    case 'lte':
      return Number(raw) <= Number(value);
    case 'gt':
      return Number(raw) > Number(value);
    case 'lt':
      return Number(raw) < Number(value);
    case 'contains':
      if (Array.isArray(raw)) return raw.includes(value);
      return String(raw).toLowerCase().includes(String(value).toLowerCase());
    default:
      return false;
  }
}

export function evaluateAudience(
  profiles: RestaurantDinerProfile[],
  rules: AudienceRule[]
): RestaurantDinerProfile[] {
  if (rules.length === 0) return profiles;
  return profiles.filter((profile) => rules.every((rule) => evaluateRule(profile, rule)));
}

function getFieldValue(profile: RestaurantDinerProfile, field: string): unknown {
  switch (field) {
    case 'visit_count':
      return profile.visit_count;
    case 'lifetime_spend_cents':
      return profile.lifetime_spend_cents;
    case 'vip':
      return profile.vip;
    case 'banned':
      return profile.banned;
    case 'allergens':
      return profile.allergens;
    case 'last_visit_at':
      return profile.last_visit_at;
    case 'auto_tags':
      return profile.auto_tags.map((t) => t.tag);
    default:
      return (profile.preferences as Record<string, unknown>)[field];
  }
}

export const STARTER_SEGMENTS: { name: string; rules: AudienceRule[] }[] = [
  {
    name: 'VIP Guests',
    rules: [{ field: 'vip', operator: 'eq', value: 'true' }],
  },
  {
    name: 'High Spenders',
    rules: [{ field: 'lifetime_spend_cents', operator: 'gte', value: 50000 }],
  },
  {
    name: 'Frequent Visitors (10+)',
    rules: [{ field: 'visit_count', operator: 'gte', value: 10 }],
  },
  {
    name: 'New Guests (1 visit)',
    rules: [{ field: 'visit_count', operator: 'eq', value: '1' }],
  },
  {
    name: 'At-Risk (no visit 60+ days)',
    rules: [{ field: 'auto_tags', operator: 'contains', value: 'at_risk' }],
  },
  {
    name: 'Wine Lovers',
    rules: [{ field: 'auto_tags', operator: 'contains', value: 'wine_lover' }],
  },
];
