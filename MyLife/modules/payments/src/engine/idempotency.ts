export interface PaymentsIdempotencyRecord<TResult> {
  idempotencyKey: string;
  fingerprint: string;
  result: TResult;
}

export interface PaymentsIdempotencyStore<TResult> {
  get(idempotencyKey: string): PaymentsIdempotencyRecord<TResult> | null;
  set(record: PaymentsIdempotencyRecord<TResult>): void;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableNormalize(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableNormalize(nested)]),
    );
  }

  return value;
}

export function createStableFingerprint(value: unknown): string {
  return JSON.stringify(stableNormalize(value));
}

export function createMemoryPaymentsIdempotencyStore<TResult>(): PaymentsIdempotencyStore<TResult> {
  const values = new Map<string, PaymentsIdempotencyRecord<TResult>>();

  return {
    get(idempotencyKey) {
      return values.get(idempotencyKey) ?? null;
    },
    set(record) {
      values.set(record.idempotencyKey, record);
    },
  };
}

