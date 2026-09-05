// Stripe Connect adapter
export type { StripeClient, StripeWebhookEvent, StripeConnectConfig, OnboardingResult, AccountStatus, PaymentIntentResult, RefundResult } from './stripe-connect';
export {
  DEFAULT_CONFIG,
  createConnectedAccount,
  getAccountStatus,
  createDashboardLink,
  createPaymentIntent,
  capturePaymentIntent,
  cancelPaymentIntent,
  createRefund,
  getPaymentIntentStatus,
  calculateFeeSplit,
} from './stripe-connect';

// Payment orchestrator
export type { InitiatePaymentParams, InitiatePaymentResult, EscrowState, ProcessRefundParams, DisputeRefundParams, FeeEstimate } from './orchestrator';
export {
  initiatePayment,
  captureAndHold,
  evaluateEscrowState,
  calculateAutoReleaseDate,
  processRefund,
  handleDisputeRefund,
  estimateFees,
  mapStripeStatusToPaymentStatus,
} from './orchestrator';

// Webhook handler
export type { WebhookAction } from './webhooks';
export {
  verifyWebhookEvent,
  processWebhookEvent,
  handleWebhook,
  HANDLED_EVENTS,
} from './webhooks';
