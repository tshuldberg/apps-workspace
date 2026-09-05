export type ConnectAccountStatus = 'onboarding' | 'active' | 'restricted' | 'deauthorized';

export interface ConnectAccount {
  stripeAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  status: ConnectAccountStatus;
  country: string;
  detailsSubmitted: boolean;
}

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export interface DepositConfig {
  amountCents: number;
  perPerson: boolean;
  partySize: number;
  restaurantStripeAccountId: string;
  applicationFeeCents: number;
  captureMethod: 'manual';
}

export interface CaptureResult {
  success: boolean;
  capturedAmountCents: number;
  error?: string;
}

export type WebhookEventType =
  | 'account.updated'
  | 'account.application.deauthorized'
  | 'payment_intent.succeeded'
  | 'payment_intent.amount_capturable_updated'
  | 'payment_intent.canceled'
  | 'charge.captured'
  | 'charge.refunded'
  | 'charge.dispute.created'
  | 'transfer.created'
  | 'payout.paid';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: Record<string, unknown>;
  created: number;
  livemode: boolean;
}

export interface WebhookProcessResult {
  processed: boolean;
  skipped: boolean;
  error?: string;
}
