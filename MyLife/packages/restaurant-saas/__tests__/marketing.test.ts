import { describe, it, expect } from 'vitest';
import { evaluateRule, evaluateAudience } from '@/lib/marketing/audience';
import { renderTemplate, STARTER_TEMPLATES } from '@/lib/marketing/templates';
import { preFlightCheckWithBody } from '@/lib/marketing/compliance';
import type { Campaign } from '@/lib/marketing/types';
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

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 'c1',
    restaurant_id: 'r1',
    name: 'Test Campaign',
    channel: 'email',
    template_id: null,
    audience_id: null,
    scheduled_at: null,
    sent_at: null,
    send_count: 0,
    open_count: 0,
    click_count: 0,
    unsubscribe_count: 0,
    status: 'draft',
    consent_check_passed: true,
    created_at: '2026-04-20T00:00:00Z',
    ...overrides,
  };
}

describe('Audience rule evaluation', () => {
  it('evaluates gte operator correctly', () => {
    const profile = makeProfile({ visit_count: 10 });
    expect(evaluateRule(profile, { field: 'visit_count', operator: 'gte', value: 5 })).toBe(true);
    expect(evaluateRule(profile, { field: 'visit_count', operator: 'gte', value: 10 })).toBe(true);
    expect(evaluateRule(profile, { field: 'visit_count', operator: 'gte', value: 15 })).toBe(false);
  });

  it('evaluates lte operator correctly', () => {
    const profile = makeProfile({ visit_count: 3 });
    expect(evaluateRule(profile, { field: 'visit_count', operator: 'lte', value: 5 })).toBe(true);
    expect(evaluateRule(profile, { field: 'visit_count', operator: 'lte', value: 3 })).toBe(true);
    expect(evaluateRule(profile, { field: 'visit_count', operator: 'lte', value: 1 })).toBe(false);
  });

  it('evaluates eq operator correctly', () => {
    const profile = makeProfile({ vip: true });
    expect(evaluateRule(profile, { field: 'vip', operator: 'eq', value: 'true' })).toBe(true);
    expect(evaluateRule(profile, { field: 'vip', operator: 'eq', value: 'false' })).toBe(false);
  });
});

describe('Audience filtering (AND logic)', () => {
  it('filters profiles matching all rules', () => {
    const profiles = [
      makeProfile({ id: 'a', visit_count: 10, lifetime_spend_cents: 60000 }),
      makeProfile({ id: 'b', visit_count: 2, lifetime_spend_cents: 80000 }),
      makeProfile({ id: 'c', visit_count: 15, lifetime_spend_cents: 30000 }),
      makeProfile({ id: 'd', visit_count: 12, lifetime_spend_cents: 50000 }),
    ];

    const rules = [
      { field: 'visit_count', operator: 'gte' as const, value: 10 },
      { field: 'lifetime_spend_cents', operator: 'gte' as const, value: 50000 },
    ];

    const result = evaluateAudience(profiles, rules);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(['a', 'd']);
  });

  it('returns all profiles when no rules given', () => {
    const profiles = [makeProfile({ id: 'a' }), makeProfile({ id: 'b' })];
    expect(evaluateAudience(profiles, [])).toHaveLength(2);
  });
});

describe('Template rendering', () => {
  it('interpolates variables correctly', () => {
    const body = 'Hello {{first_name}}, welcome to {{restaurant}}!';
    const result = renderTemplate(body, { first_name: 'Jane', restaurant: 'Chez Claude' });
    expect(result).toBe('Hello Jane, welcome to Chez Claude!');
  });

  it('leaves placeholder for missing variables', () => {
    const body = 'Hi {{first_name}}, your code is {{code}}';
    const result = renderTemplate(body, { first_name: 'Bob' });
    expect(result).toBe('Hi Bob, your code is {{code}}');
  });
});

describe('Pre-flight compliance check', () => {
  it('fails without consent flag', () => {
    const campaign = makeCampaign({ consent_check_passed: false });
    const result = preFlightCheckWithBody(campaign, 10, 'body with [Unsubscribe](link)');
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('Consent'))).toBe(true);
  });

  it('fails if email body missing unsubscribe link', () => {
    const campaign = makeCampaign({ channel: 'email' });
    const result = preFlightCheckWithBody(campaign, 10, 'Hello world, no opt-out here!');
    expect(result.pass).toBe(false);
    expect(result.errors.some((e) => e.includes('unsubscribe'))).toBe(true);
  });

  it('passes when all requirements met', () => {
    const campaign = makeCampaign({ channel: 'email', consent_check_passed: true });
    const body = 'Hello! Click here to [Unsubscribe]({{unsubscribe_link}})';
    const result = preFlightCheckWithBody(campaign, 5, body);
    expect(result.pass).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('Starter templates validation', () => {
  it('all starter templates have required fields', () => {
    expect(STARTER_TEMPLATES.length).toBe(7);
    for (const t of STARTER_TEMPLATES) {
      expect(t.name).toBeTruthy();
      expect(['email', 'sms']).toContain(t.channel);
      expect(t.body_md).toBeTruthy();
      expect(Array.isArray(t.variables)).toBe(true);
      if (t.channel === 'email') {
        expect(t.subject).toBeTruthy();
      }
    }
  });
});
