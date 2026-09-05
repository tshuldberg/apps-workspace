import type { ReservationStatus, StatusTransition } from './types';

const VALID_TRANSITIONS: StatusTransition[] = [
  { from: 'pending', to: 'confirmed', valid: true },
  { from: 'pending', to: 'cancelled', valid: true, action: 'cancel_deposit' },
  { from: 'confirmed', to: 'seated', valid: true, action: 'cancel_deposit' },
  { from: 'confirmed', to: 'no_show', valid: true, action: 'capture_deposit' },
  { from: 'confirmed', to: 'cancelled', valid: true, action: 'refund_deposit' },
  { from: 'seated', to: 'completed', valid: true },
  { from: 'seated', to: 'no_show', valid: true, action: 'capture_deposit' },
];

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return VALID_TRANSITIONS.some((t) => t.from === from && t.to === to && t.valid);
}

export function getTransition(from: ReservationStatus, to: ReservationStatus): StatusTransition | null {
  return VALID_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

export function getAvailableTransitions(from: ReservationStatus): ReservationStatus[] {
  return VALID_TRANSITIONS
    .filter((t) => t.from === from && t.valid)
    .map((t) => t.to);
}

export function isTerminal(status: ReservationStatus): boolean {
  return status === 'completed' || status === 'no_show' || status === 'cancelled';
}
