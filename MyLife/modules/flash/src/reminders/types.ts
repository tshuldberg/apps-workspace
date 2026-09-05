export interface ReminderConfig {
  enabled: boolean;
  time: string; // HH:MM format
  includeStreak: boolean;
  deckFilter: string; // 'all' or comma-separated deck IDs
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}
