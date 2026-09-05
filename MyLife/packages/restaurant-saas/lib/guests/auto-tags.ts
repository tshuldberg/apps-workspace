import {
  AutoTag,
  AutoTagRule,
  RestaurantDinerProfile,
  VIP_VISIT_THRESHOLD,
  VIP_AVG_CHECK_CENTS,
  REGULAR_VISIT_THRESHOLD,
  AT_RISK_DAYS,
} from './types';

function now(): string {
  return new Date().toISOString();
}

function daysSinceLastVisit(profile: RestaurantDinerProfile): number | null {
  if (!profile.last_visit_at) return null;
  const last = new Date(profile.last_visit_at).getTime();
  const today = Date.now();
  return Math.floor((today - last) / (1000 * 60 * 60 * 24));
}

function avgCheckCents(profile: RestaurantDinerProfile): number {
  if (profile.visit_count === 0) return 0;
  return Math.round(profile.lifetime_spend_cents / profile.visit_count);
}

const vipRule: AutoTagRule = {
  tag: 'vip',
  evaluate(profile) {
    const reasons: string[] = [];
    if (profile.visit_count >= VIP_VISIT_THRESHOLD) {
      reasons.push(`${VIP_VISIT_THRESHOLD}+ visits`);
    }
    if (avgCheckCents(profile) >= VIP_AVG_CHECK_CENTS) {
      reasons.push('$200+ avg check');
    }
    if (reasons.length === 0) return null;
    return {
      tag: 'vip',
      reason: `Tagged VIP because: ${reasons.join(', ')}`,
      scoredAt: now(),
    };
  },
};

const regularRule: AutoTagRule = {
  tag: 'regular',
  evaluate(profile) {
    if (profile.visit_count >= REGULAR_VISIT_THRESHOLD) {
      return {
        tag: 'regular',
        reason: `Tagged Regular because: ${REGULAR_VISIT_THRESHOLD}+ visits`,
        scoredAt: now(),
      };
    }
    return null;
  },
};

const bigSpenderRule: AutoTagRule = {
  tag: 'big_spender',
  evaluate(profile) {
    // Placeholder: in production this would compare against top 10% of all guests.
    // For now, use a static threshold of $500+ lifetime spend as a proxy.
    const BIG_SPENDER_LIFETIME_CENTS = 50000;
    if (profile.lifetime_spend_cents >= BIG_SPENDER_LIFETIME_CENTS) {
      return {
        tag: 'big_spender',
        reason: 'Tagged Big Spender because: top lifetime spend ($500+)',
        scoredAt: now(),
      };
    }
    return null;
  },
};

const wineLoverRule: AutoTagRule = {
  tag: 'wine_lover',
  evaluate(_profile) {
    // Future: requires order history integration (2+ wine orders)
    // Placeholder - always returns null until order data is available
    return null;
  },
};

const newGuestRule: AutoTagRule = {
  tag: 'new_guest',
  evaluate(profile) {
    if (profile.visit_count <= 1) {
      return {
        tag: 'new_guest',
        reason: 'Tagged New Guest because: first visit',
        scoredAt: now(),
      };
    }
    return null;
  },
};

const atRiskRule: AutoTagRule = {
  tag: 'at_risk',
  evaluate(profile) {
    const days = daysSinceLastVisit(profile);
    if (days !== null && days >= AT_RISK_DAYS) {
      return {
        tag: 'at_risk',
        reason: `Tagged At Risk because: no visit in ${days} days`,
        scoredAt: now(),
      };
    }
    return null;
  },
};

const AUTO_TAG_RULES: AutoTagRule[] = [
  vipRule,
  regularRule,
  bigSpenderRule,
  wineLoverRule,
  newGuestRule,
  atRiskRule,
];

/**
 * Evaluate all auto-tag rules against a guest profile.
 * Returns array of tags that apply, each with an explainability reason.
 */
export function evaluateAutoTags(profile: RestaurantDinerProfile): AutoTag[] {
  const tags: AutoTag[] = [];
  for (const rule of AUTO_TAG_RULES) {
    const result = rule.evaluate(profile);
    if (result) {
      tags.push(result);
    }
  }
  return tags;
}
