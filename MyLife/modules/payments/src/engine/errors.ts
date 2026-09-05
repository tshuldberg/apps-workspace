export const PAYMENTS_DOMAIN_ERROR_CODES = [
  'invalid_command',
  'invalid_transition',
  'idempotency_conflict',
  'wallet_unavailable',
  'insufficient_funds',
  'limit_blocked',
  'compliance_hold',
  'stale_quote',
  'provider_timeout',
  'posting_unbalanced',
  'fee_wallet_required',
] as const;

export type PaymentsDomainErrorCode =
  (typeof PAYMENTS_DOMAIN_ERROR_CODES)[number];

export class PaymentsDomainError extends Error {
  readonly code: PaymentsDomainErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: PaymentsDomainErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PaymentsDomainError';
    this.code = code;
    this.details = details;
  }
}

export function createPaymentsDomainError(
  code: PaymentsDomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): PaymentsDomainError {
  return new PaymentsDomainError(code, message, details);
}

export function assertPaymentsInvariant(
  condition: unknown,
  code: PaymentsDomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    throw createPaymentsDomainError(code, message, details);
  }
}

export function isPaymentsDomainError(
  value: unknown,
): value is PaymentsDomainError {
  return value instanceof PaymentsDomainError;
}

