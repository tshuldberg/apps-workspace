import { z } from 'zod';

export const CurrencyCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/);
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

export const PaymentAmountSchema = z.object({
  amountCents: z.number().int(),
  currency: CurrencyCodeSchema,
});
export type PaymentAmount = z.infer<typeof PaymentAmountSchema>;

export const PaymentDirectionSchema = z.enum(['incoming', 'outgoing', 'neutral']);
export type PaymentDirection = z.infer<typeof PaymentDirectionSchema>;

export const PaymentStatusSchema = z.enum([
  'pending',
  'posted',
  'held',
  'failed',
  'canceled',
  'reversed',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentRailSchema = z.enum([
  'wallet',
  'bank',
  'card',
  'internal',
  'remittance',
]);
export type PaymentRail = z.infer<typeof PaymentRailSchema>;

export const PaymentVerificationStateSchema = z.enum([
  'verified',
  'review',
  'unverified',
]);
export type PaymentVerificationState = z.infer<typeof PaymentVerificationStateSchema>;

export const PaymentCounterpartySchema = z.object({
  id: z.string().min(1),
  displayName: z.string().min(1),
  handle: z.string().optional(),
  descriptor: z.string().optional(),
  verification: PaymentVerificationStateSchema.default('unverified'),
});
export type PaymentCounterparty = z.infer<typeof PaymentCounterpartySchema>;

export const PaymentActivityItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  amountCents: z.number().int().nonnegative(),
  currency: CurrencyCodeSchema,
  direction: PaymentDirectionSchema,
  status: PaymentStatusSchema,
  rail: PaymentRailSchema,
  counterparty: PaymentCounterpartySchema.optional(),
  occurredAt: z.string().min(1),
  note: z.string().optional(),
  pendingReason: z.string().optional(),
});
export type PaymentActivityItem = z.infer<typeof PaymentActivityItemSchema>;

export const PaymentTimelineStepStateSchema = z.enum([
  'complete',
  'current',
  'upcoming',
  'blocked',
]);
export type PaymentTimelineStepState = z.infer<typeof PaymentTimelineStepStateSchema>;

export const PaymentTimelineStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().optional(),
  timestamp: z.string().optional(),
  state: PaymentTimelineStepStateSchema,
});
export type PaymentTimelineStep = z.infer<typeof PaymentTimelineStepSchema>;

export const PaymentDisclosureToneSchema = z.enum([
  'info',
  'warning',
  'danger',
  'success',
]);
export type PaymentDisclosureTone = z.infer<typeof PaymentDisclosureToneSchema>;

export const PaymentDisclosureSchema = z.object({
  id: z.string().min(1),
  tone: PaymentDisclosureToneSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  footnote: z.string().optional(),
});
export type PaymentDisclosure = z.infer<typeof PaymentDisclosureSchema>;
