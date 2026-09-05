export interface SmsConfig {
  accountSid: string;
  authToken: string;
  defaultFromNumber?: string;
  tcpaEnforcement?: boolean;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  queued?: boolean;
  queuedUntil?: Date;
}

export interface ConsentRecord {
  phone: string;
  restaurantId: string;
  status: ConsentStatus;
  optedInAt?: Date;
  optedOutAt?: Date;
  method: ConsentMethod;
}

export type ConsentStatus = 'opted_in' | 'opted_out' | 'pending' | 'never_asked';
export type ConsentMethod = 'sms_keyword' | 'web_form' | 'walk_in' | 'booking';

export interface TcpaWindow {
  timezone: string;
  state?: string;
  windowStart: number; // hour (0-23)
  windowEnd: number;   // hour (0-23)
  isOpen: boolean;
  nextOpenAt?: Date;
}

export interface InboundMessage {
  from: string;
  to: string;
  body: string;
  messageSid: string;
  timestamp: Date;
}

export interface ConversationThread {
  phone: string;
  restaurantId: string;
  lastMessageAt: Date;
  context: 'waitlist' | 'reservation' | 'marketing' | 'general';
}
