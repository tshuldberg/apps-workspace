export interface AudienceRule {
  field: string;
  operator: 'gte' | 'lte' | 'eq' | 'contains' | 'gt' | 'lt';
  value: string | number;
}

export interface Audience {
  id: string;
  restaurant_id: string;
  name: string;
  rules: AudienceRule[];
  size_cached: number;
  refreshed_at: string;
  created_at: string;
}

export interface Template {
  id: string;
  restaurant_id: string;
  name: string;
  channel: 'email' | 'sms';
  subject: string | null;
  body_md: string;
  variables: string[];
  created_at: string;
}

export interface Campaign {
  id: string;
  restaurant_id: string;
  name: string;
  channel: 'email' | 'sms';
  template_id: string | null;
  audience_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  send_count: number;
  open_count: number;
  click_count: number;
  unsubscribe_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  consent_check_passed: boolean;
  created_at: string;
}

export type StarterTemplateName =
  | 'birthday'
  | 'anniversary'
  | 'win-back'
  | 'post-visit'
  | 'event-invite'
  | 'slow-night'
  | 'seasonal-menu';
