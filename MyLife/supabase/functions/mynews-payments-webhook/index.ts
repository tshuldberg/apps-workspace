import { jsonError, jsonOk, serveEnvelope } from '../_shared/mynews-http.ts';
import {
  createPostgrestMyNewsPaymentsStore,
  type MyNewsPaymentsStore,
} from '../_shared/mynews-payments-store.ts';

export type NormalizedPaymentEventType =
  | 'payment_succeeded'
  | 'payment_refunded'
  | 'dispute_created'
  | 'dispute_resolved'
  | 'payout_paid'
  | 'payout_failed'
  | 'payout_account_updated';

export interface PaymentSignatureProvider {
  verify(input: {
    payload: string;
    signatureHeader: string;
    secret: string;
    nowMs: number;
    toleranceSeconds: number;
  }): Promise<boolean>;
}

export interface PaymentsWebhookDeps {
  store: MyNewsPaymentsStore | null;
  signatureProvider: PaymentSignatureProvider;
  webhookSecret: string | null;
  now?: () => number;
  toleranceSeconds?: number;
}

const EVENT_TYPES: Record<string, NormalizedPaymentEventType> = {
  'payment.succeeded': 'payment_succeeded',
  'payment_intent.succeeded': 'payment_succeeded',
  'payment.refunded': 'payment_refunded',
  'charge.refunded': 'payment_refunded',
  'dispute.created': 'dispute_created',
  'charge.dispute.created': 'dispute_created',
  'dispute.resolved': 'dispute_resolved',
  'charge.dispute.closed': 'dispute_resolved',
  'payout.paid': 'payout_paid',
  'payout.failed': 'payout_failed',
  'account.updated': 'payout_account_updated',
};

const DEFAULT_TOLERANCE_SECONDS = 300;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } | null {
  const parts = header.split(',').map((part) => part.trim().split('=', 2));
  const timestampRaw = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts
    .filter(([key, value]) => key === 'v1' && typeof value === 'string')
    .map(([, value]) => value as string);
  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || signatures.length === 0) return null;
  if (signatures.some((signature) => !/^[a-f0-9]{64}$/i.test(signature))) return null;
  return { timestamp, signatures };
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export const stripeHmacSignatureProvider: PaymentSignatureProvider = {
  async verify({ payload, signatureHeader, secret, nowMs, toleranceSeconds }) {
    const parsed = parseStripeSignature(signatureHeader);
    if (!parsed || !secret) return false;
    const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - parsed.timestamp);
    if (ageSeconds > toleranceSeconds) return false;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(`${parsed.timestamp}.${payload}`),
    );
    const expected = bytesToHex(new Uint8Array(signature));
    return parsed.signatures.some((candidate) => constantTimeHexEqual(candidate, expected));
  },
};

export function normalizePaymentEventType(type: string): string {
  return EVENT_TYPES[type] ?? type;
}

const CONNECT_ACCOUNT_REF = /^acct_[A-Za-z0-9]{4,}$/;

/**
 * The Connect account an event belongs to, read from the event ENVELOPE. Stripe
 * puts it at the top level (`account`), not in the object, and automatic payouts
 * on Express accounts carry empty object metadata, so this is the only
 * attribution signal a `payout.*` event has.
 */
export function connectAccountRef(event: Record<string, unknown>): string | null {
  const account = typeof event.account === 'string' ? event.account.trim() : '';
  return CONNECT_ACCOUNT_REF.test(account) ? account : null;
}

/** Event types whose journalist must be resolved from the Connect account. */
export function needsAccountAttribution(normalizedType: string): boolean {
  return normalizedType === 'payout_paid' || normalizedType === 'payout_failed';
}

export async function handleMyNewsPaymentsWebhook(
  req: Request,
  deps: PaymentsWebhookDeps,
): Promise<Response> {
  if (req.method !== 'POST') return jsonError('method-not-allowed', 405, 'POST only');

  if (!deps.webhookSecret) {
    return jsonError('payments-unconfigured', 503, 'payment webhooks are not configured');
  }
  if (!deps.store) {
    return jsonError('payments-unavailable', 503, 'payment storage is unavailable');
  }

  const signatureHeader = req.headers.get('Stripe-Signature');
  if (!signatureHeader) return jsonError('invalid-signature', 401);

  const payload = await req.text();
  const verified = await deps.signatureProvider.verify({
    payload,
    signatureHeader,
    secret: deps.webhookSecret,
    nowMs: (deps.now ?? Date.now)(),
    toleranceSeconds: deps.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS,
  });
  if (!verified) return jsonError('invalid-signature', 401);

  let event: Record<string, unknown> | null = null;
  try {
    event = asRecord(JSON.parse(payload));
  } catch {
    event = null;
  }
  const providerEventId = typeof event?.id === 'string' ? event.id.trim() : '';
  const providerEventType = typeof event?.type === 'string' ? event.type.trim() : '';
  if (!event || !providerEventId || !providerEventType) {
    return jsonError('bad-payload', 400, 'provider event id and type are required');
  }

  const createdSeconds =
    typeof event.created === 'number' && Number.isSafeInteger(event.created)
      ? event.created
      : Math.floor((deps.now ?? Date.now)() / 1000);
  const occurredAt = new Date(createdSeconds * 1000);
  if (Number.isNaN(occurredAt.getTime())) return jsonError('bad-payload', 400);

  const eventType = normalizePaymentEventType(providerEventType);
  const accountRef = connectAccountRef(event);

  try {
    // Payout attribution is resolved server-side from our own stored Connect
    // account ref. An account we do not know stays unresolved: the RPC records
    // the event as an 'unattributed-payout' failure for operator review rather
    // than dropping it or inventing a journalist.
    let resolvedJournalistProfileId: string | null = null;
    if (accountRef && needsAccountAttribution(eventType)) {
      resolvedJournalistProfileId = await deps.store.getJournalistProfileIdByAccountRef(
        'stripe',
        accountRef,
      );
    }

    const outcome = await deps.store.applyPaymentEvent({
      provider: 'stripe',
      providerEventId,
      eventType,
      payload: event,
      occurredAt: occurredAt.toISOString(),
      providerAccountRef: accountRef,
      resolvedJournalistProfileId,
    });
    return jsonOk({ status: outcome });
  } catch (error) {
    console.error('mynews payment event application failed', error);
    return jsonError('payments-unavailable', 503, 'payment event could not be recorded');
  }
}

declare const Deno:
  | {
      serve: (handler: (req: Request) => Promise<Response>) => void;
      env: { get(key: string): string | undefined };
    }
  | undefined;

if (typeof Deno !== 'undefined' && Deno?.serve) {
  const env = (key: string) => Deno!.env.get(key);
  const secret = env('MYNEWS_PAYMENTS_WEBHOOK_SECRET')?.trim() || null;
  let store: MyNewsPaymentsStore | null = null;
  if (secret) {
    try {
      store = createPostgrestMyNewsPaymentsStore(env, fetch);
    } catch (error) {
      console.error('mynews payments store configuration failed', error);
    }
  }
  Deno.serve(
    serveEnvelope(
      (req) =>
        handleMyNewsPaymentsWebhook(req, {
          store,
          signatureProvider: stripeHmacSignatureProvider,
          webhookSecret: secret,
        }),
      // No subject hash: the caller is Stripe, not a signed-in user.
      { fn: 'mynews-payments-webhook', action: 'provider_webhook' },
      { hashSubject: false },
    ),
  );
}

