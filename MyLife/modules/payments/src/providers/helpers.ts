import type {
  PaymentsProviderContext,
  PaymentsProviderFailure,
  PaymentsProviderFailureCode,
  PaymentsProviderResult,
  PaymentsProviderSuccess,
  PaymentsWebhookSource,
} from './types';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createProviderId(prefix: string): string {
  return createId(prefix);
}

export function providerSuccess<TData>(
  providerName: string,
  data: TData,
): PaymentsProviderSuccess<TData> {
  return {
    ok: true,
    providerName,
    data,
  };
}

export function providerFailure(
  providerName: string,
  code: PaymentsProviderFailureCode,
  message: string,
  options?: {
    retryable?: boolean;
    details?: Record<string, unknown>;
  },
): PaymentsProviderFailure {
  return {
    ok: false,
    providerName,
    code,
    message,
    retryable: options?.retryable ?? false,
    details: options?.details,
  };
}

export function readJsonPayload(rawBody: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw: rawBody };
  }
}

export function createNormalizedEventId(
  payload: Record<string, unknown>,
  prefix: string,
): string {
  const id = payload.id;
  if (typeof id === 'string' && id.trim().length > 0) {
    return id;
  }
  return createProviderId(prefix);
}

export function normalizeWebhookSuccess(
  providerName: PaymentsWebhookSource,
  rawBody: string,
  context: PaymentsProviderContext,
  options?: {
    eventType?: string;
    objectType?: string | null;
    objectReference?: string | null;
  },
) {
  const payload = readJsonPayload(rawBody);
  const eventType =
    options?.eventType ??
    (typeof payload.type === 'string' ? payload.type : 'provider.event');
  const objectType =
    options?.objectType ??
    (typeof payload.object_type === 'string' ? payload.object_type : null);
  const objectReference =
    options?.objectReference ??
    (typeof payload.object_reference === 'string'
      ? payload.object_reference
      : null);

  return providerSuccess(providerName, {
    normalizedEvent: {
      providerName,
      providerEventId: createNormalizedEventId(
        payload,
        `${providerName}_event`,
      ),
      eventType,
      objectType,
      objectReference,
      occurredAt:
        typeof payload.occurred_at === 'string'
          ? payload.occurred_at
          : context.now().toISOString(),
      payload,
      metadata: {
        normalizedBy: 'payments-provider-adapter',
      },
    },
    acceptedAt: context.now().toISOString(),
  });
}

export function isProviderSuccess<TData>(
  result: PaymentsProviderResult<TData>,
): result is PaymentsProviderSuccess<TData> {
  return result.ok;
}

