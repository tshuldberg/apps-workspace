export interface DinerProfile {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string;
  stripe_customer_id: string | null;
  default_payment_method_id: string | null;
  e2e_public_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantDinerProfile {
  id: string;
  restaurant_id: string;
  diner_id: string;
  visit_count: number;
  last_visit_at: string | null;
  lifetime_spend_cents: number;
  vip: boolean;
  banned: boolean;
  banned_reason: string | null;
  allergens: string[];
  preferences: Record<string, unknown>;
  notes: string | null;
  auto_tags: AutoTag[];
  created_at: string;
}

export interface AutoTag {
  tag: AutoTagName;
  reason: string;
  scoredAt: string;
}

export type AutoTagName =
  | 'vip'
  | 'regular'
  | 'big_spender'
  | 'wine_lover'
  | 'new_guest'
  | 'at_risk';

export interface AutoTagRule {
  tag: AutoTagName;
  evaluate: (profile: RestaurantDinerProfile) => AutoTag | null;
}

/** VIP threshold: 12+ visits OR $200+ average check */
export const VIP_VISIT_THRESHOLD = 12;
export const VIP_AVG_CHECK_CENTS = 20000; // $200 in cents

/** Regular: 5+ visits */
export const REGULAR_VISIT_THRESHOLD = 5;

/** At risk: no visit in 60+ days */
export const AT_RISK_DAYS = 60;
