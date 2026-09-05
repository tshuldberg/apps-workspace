import type { StarterTemplateName } from './types';

export function renderTemplate(bodyMd: string, variables: Record<string, string>): string {
  return bodyMd.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return variables[key] ?? match;
  });
}

interface StarterTemplate {
  name: StarterTemplateName;
  channel: 'email' | 'sms';
  subject: string | null;
  body_md: string;
  variables: string[];
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    name: 'birthday',
    channel: 'email',
    subject: 'Happy Birthday, {{first_name}}!',
    body_md:
      '# Happy Birthday, {{first_name}}! 🎂\n\nWe hope your special day is filled with great food and good company. Enjoy a complimentary dessert on your next visit.\n\n[Book a table]({{booking_link}})\n\n[Unsubscribe]({{unsubscribe_link}})',
    variables: ['first_name', 'booking_link', 'unsubscribe_link'],
  },
  {
    name: 'anniversary',
    channel: 'email',
    subject: 'Celebrate your anniversary with us, {{first_name}}',
    body_md:
      '# Cheers to Another Year! 🥂\n\nCongratulations, {{first_name}}! Let us help make your anniversary special with a reserved table and complimentary champagne toast.\n\n[Reserve now]({{booking_link}})\n\n[Unsubscribe]({{unsubscribe_link}})',
    variables: ['first_name', 'booking_link', 'unsubscribe_link'],
  },
  {
    name: 'win-back',
    channel: 'email',
    subject: "We miss you, {{first_name}}!",
    body_md:
      "# It's been a while, {{first_name}}\n\nWe noticed you haven't visited in a while. We'd love to welcome you back with {{offer}}.\n\n[Come back]({{booking_link}})\n\n[Unsubscribe]({{unsubscribe_link}})",
    variables: ['first_name', 'offer', 'booking_link', 'unsubscribe_link'],
  },
  {
    name: 'post-visit',
    channel: 'sms',
    subject: null,
    body_md:
      'Thanks for dining with us, {{first_name}}! We hope you enjoyed your meal. Leave a review: {{review_link}} Reply STOP to unsubscribe.',
    variables: ['first_name', 'review_link'],
  },
  {
    name: 'event-invite',
    channel: 'email',
    subject: "You're invited: {{event_name}}",
    body_md:
      "# You're Invited!\n\n{{first_name}}, join us for **{{event_name}}** on {{event_date}}.\n\n{{event_description}}\n\n[RSVP Now]({{booking_link}})\n\n[Unsubscribe]({{unsubscribe_link}})",
    variables: ['first_name', 'event_name', 'event_date', 'event_description', 'booking_link', 'unsubscribe_link'],
  },
  {
    name: 'slow-night',
    channel: 'sms',
    subject: null,
    body_md:
      '{{first_name}}, tables open tonight! Come in for {{offer}}. Book: {{booking_link}} Reply STOP to unsubscribe.',
    variables: ['first_name', 'offer', 'booking_link'],
  },
  {
    name: 'seasonal-menu',
    channel: 'email',
    subject: 'New seasonal menu is here!',
    body_md:
      "# Our {{season}} Menu Has Arrived 🍽️\n\n{{first_name}}, we're excited to share our new seasonal dishes crafted with fresh, local ingredients.\n\n[View Menu]({{menu_link}})\n[Book a Table]({{booking_link}})\n\n[Unsubscribe]({{unsubscribe_link}})",
    variables: ['first_name', 'season', 'menu_link', 'booking_link', 'unsubscribe_link'],
  },
];
