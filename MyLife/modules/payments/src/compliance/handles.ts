import {
  assertPaymentsInvariant,
} from '../engine/errors';
import type {
  PaymentsHandleReservationInput,
  PaymentsHandleReservationResult,
} from './types';

const RESERVED_HANDLES = new Set([
  'admin',
  'bank',
  'card',
  'cash',
  'compliance',
  'escrow',
  'help',
  'mylife',
  'mypay',
  'payments',
  'security',
  'support',
  'wallet',
]);

export function normalizePaymentHandle(value: string): string {
  const normalized = value.trim().replace(/^@+/, '').toLowerCase();

  assertPaymentsInvariant(
    normalized.length >= 3 && normalized.length <= 32,
    'invalid_command',
    'Payment handles must be between 3 and 32 characters.',
    { handle: value },
  );
  assertPaymentsInvariant(
    /^[a-z0-9_.-]+$/.test(normalized),
    'invalid_command',
    'Payment handles may only contain lowercase letters, numbers, dots, underscores, and hyphens.',
    { handle: value },
  );

  return normalized;
}

export function buildPaymentHandleSearchKey(handle: string): string {
  return `@${normalizePaymentHandle(handle)}`;
}

export function isReservedPaymentHandle(handle: string): boolean {
  return RESERVED_HANDLES.has(normalizePaymentHandle(handle));
}

export function reservePaymentHandle(
  input: PaymentsHandleReservationInput,
): PaymentsHandleReservationResult {
  const normalizedHandle = normalizePaymentHandle(input.requestedHandle);

  if (RESERVED_HANDLES.has(normalizedHandle)) {
    return {
      ok: false,
      decision: 'reserved_word',
      normalizedHandle,
      searchKey: `@${normalizedHandle}`,
      ownerUserId: null,
    };
  }

  const existing = input.existing.find((record) => {
    if (record.releasedAt) {
      return false;
    }
    return normalizePaymentHandle(record.handle) === normalizedHandle;
  });

  if (!existing) {
    return {
      ok: true,
      decision: 'granted',
      normalizedHandle,
      searchKey: `@${normalizedHandle}`,
      ownerUserId: input.ownerUserId,
    };
  }

  if (existing.ownerUserId === input.ownerUserId) {
    return {
      ok: true,
      decision: 'already_owned',
      normalizedHandle,
      searchKey: `@${normalizedHandle}`,
      ownerUserId: existing.ownerUserId,
    };
  }

  return {
    ok: false,
    decision: 'taken',
    normalizedHandle,
    searchKey: `@${normalizedHandle}`,
    ownerUserId: existing.ownerUserId,
  };
}
