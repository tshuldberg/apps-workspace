import type { ReservationPosAdapter, PosTimeSlot, PosReservationInput, PosReservationResult } from '../types';

export interface OmnivoreConfig {
  apiKey: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

function getBaseUrl(env: 'sandbox' | 'production'): string {
  return env === 'sandbox' ? 'https://api.sandbox.omnivore.io' : 'https://api.omnivore.io';
}

export function createOmnivoreAdapter(config: OmnivoreConfig): ReservationPosAdapter {
  const baseUrl = getBaseUrl(config.environment);
  const headers = { 'Api-Key': config.apiKey, 'Content-Type': 'application/json' };

  return {
    provider: 'omnivore',

    async getAvailability(locationId: string, _date: string, _partySize: number): Promise<PosTimeSlot[]> {
      // Omnivore provides table availability via their unified API
      const response = await fetch(`${baseUrl}/1.0/locations/${locationId}/tables`, { headers });
      const data = await response.json() as { _embedded?: { tables?: Array<{ available: boolean; seats: number }> } };
      const available = (data._embedded?.tables ?? []).filter((t) => t.available);
      return available.map((t) => ({
        startAt: new Date().toISOString(),
        durationMinutes: 90,
        availableCapacity: t.seats,
      }));
    },

    async createReservation(locationId: string, reservation: PosReservationInput): Promise<PosReservationResult> {
      const response = await fetch(`${baseUrl}/1.0/locations/${locationId}/tickets`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          guest_count: reservation.partySize,
          name: reservation.guestName,
          open_time: reservation.scheduledAt,
          employee: null,
          revenue_center: null,
          table: null,
        }),
      });
      const data = await response.json() as { id?: string };
      if (!data.id) return { externalId: '', status: 'failed', provider: 'omnivore' };
      return { externalId: data.id, status: 'confirmed', provider: 'omnivore', rawResponse: data as Record<string, unknown> };
    },

    async updateReservation(locationId: string, reservationId: string, updates: Partial<PosReservationInput>): Promise<PosReservationResult> {
      const response = await fetch(`${baseUrl}/1.0/locations/${locationId}/tickets/${reservationId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ guest_count: updates.partySize, name: updates.guestName }),
      });
      const data = await response.json() as { id?: string };
      return { externalId: data.id ?? reservationId, status: 'confirmed', provider: 'omnivore', rawResponse: data as Record<string, unknown> };
    },

    async markSeated(locationId: string, reservationId: string): Promise<void> {
      await fetch(`${baseUrl}/1.0/locations/${locationId}/tickets/${reservationId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ open: true }),
      });
    },

    async cancel(locationId: string, reservationId: string, _reason?: string): Promise<void> {
      await fetch(`${baseUrl}/1.0/locations/${locationId}/tickets/${reservationId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ void: true }),
      });
    },
  };
}
