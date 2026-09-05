import { describe, it, expect } from 'vitest';
import type { ReservationPosAdapter, PosProvider, PosTimeSlot, PosReservationInput, PosReservationResult, PosConnection, WebhookEvent, NormalizedEvent, WriteQueueItem, ReconciliationResult, ReconciliationMismatch } from '../src/types';

describe('types', () => {
  it('PosProvider includes expected providers', () => {
    const providers: PosProvider[] = ['square', 'toast', 'lightspeed_k', 'lightspeed_u', 'clover', 'omnivore'];
    expect(providers).toHaveLength(6);
  });

  it('PosTimeSlot shape is correct', () => {
    const slot: PosTimeSlot = { startAt: '2024-01-01T18:00:00Z', durationMinutes: 90, availableCapacity: 4 };
    expect(slot.startAt).toBe('2024-01-01T18:00:00Z');
    expect(slot.durationMinutes).toBe(90);
    expect(slot.availableCapacity).toBe(4);
  });

  it('PosReservationInput shape is correct', () => {
    const input: PosReservationInput = {
      partySize: 4,
      scheduledAt: '2024-01-01T19:00:00Z',
      durationMinutes: 90,
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
    };
    expect(input.partySize).toBe(4);
    expect(input.guestPhone).toBeUndefined();
  });

  it('PosReservationResult status union is valid', () => {
    const result: PosReservationResult = { externalId: 'abc', status: 'confirmed', provider: 'square' };
    expect(['confirmed', 'pending', 'failed']).toContain(result.status);
  });

  it('PosConnection status union is valid', () => {
    const conn: PosConnection = {
      id: '1',
      restaurantId: 'r1',
      provider: 'square',
      accountId: 'a1',
      locationId: 'l1',
      accessToken: 'tok',
      refreshToken: 'ref',
      tokenExpiresAt: '2024-12-01T00:00:00Z',
      scopes: ['APPOINTMENTS_READ'],
      status: 'active',
      lastSyncAt: null,
      syncError: null,
    };
    expect(['active', 'expired', 'revoked']).toContain(conn.status);
  });

  it('WriteQueueItem status union is valid', () => {
    const item: WriteQueueItem = {
      id: '1',
      connectionId: 'c1',
      operation: 'create',
      payload: {},
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date().toISOString(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    expect(['pending', 'processing', 'completed', 'failed', 'dead_letter']).toContain(item.status);
  });

  it('NormalizedEvent type union covers all reservation events', () => {
    const types: NormalizedEvent['type'][] = [
      'reservation.created',
      'reservation.updated',
      'reservation.cancelled',
      'reservation.seated',
      'reservation.completed',
    ];
    expect(types).toHaveLength(5);
  });

  it('ReconciliationMismatch action union is valid', () => {
    const mismatch: ReconciliationMismatch = {
      externalId: 'e1',
      localStatus: 'confirmed',
      remoteStatus: 'cancelled',
      action: 'update_local',
    };
    expect(['create_local', 'update_local', 'update_remote', 'skip']).toContain(mismatch.action);
  });

  it('ReservationPosAdapter interface contract has required methods', () => {
    // Type-level check: ensure a mock adapter satisfies the interface
    const mockAdapter: ReservationPosAdapter = {
      provider: 'square',
      getAvailability: async () => [],
      createReservation: async () => ({ externalId: 'x', status: 'confirmed', provider: 'square' }),
      updateReservation: async () => ({ externalId: 'x', status: 'confirmed', provider: 'square' }),
      markSeated: async () => {},
      cancel: async () => {},
    };
    expect(mockAdapter.provider).toBe('square');
    expect(typeof mockAdapter.getAvailability).toBe('function');
    expect(typeof mockAdapter.createReservation).toBe('function');
    expect(typeof mockAdapter.updateReservation).toBe('function');
    expect(typeof mockAdapter.markSeated).toBe('function');
    expect(typeof mockAdapter.cancel).toBe('function');
  });
});
