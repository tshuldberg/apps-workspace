import type { ReservationPosAdapter, PosTimeSlot, PosReservationInput, PosReservationResult } from '../types';

export interface CloverConfig {
  accessToken: string;
  merchantId: string;
  environment: 'sandbox' | 'production';
}

function getBaseUrl(env: 'sandbox' | 'production'): string {
  return env === 'sandbox' ? 'https://sandbox.dev.clover.com' : 'https://api.clover.com';
}

export function createCloverAdapter(config: CloverConfig): ReservationPosAdapter {
  const baseUrl = getBaseUrl(config.environment);
  const headers = { 'Authorization': `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' };

  return {
    provider: 'clover',

    async getAvailability(_locationId: string, date: string, _partySize: number): Promise<PosTimeSlot[]> {
      // Clover doesn't have native reservation availability
      // We derive from merchant hours
      const response = await fetch(`${baseUrl}/v3/merchants/${config.merchantId}/hours`, { headers });
      const data = await response.json() as { elements?: Array<{ start: number; end: number }> };
      const hours = data.elements ?? [];
      const slots: PosTimeSlot[] = [];
      for (const h of hours) {
        const startMs = h.start;
        const endMs = h.end;
        for (let t = startMs; t < endMs; t += 15 * 60 * 1000) {
          const dt = new Date(new Date(date).getTime() + t);
          slots.push({ startAt: dt.toISOString(), durationMinutes: 90, availableCapacity: 4 });
        }
      }
      return slots;
    },

    async createReservation(_locationId: string, reservation: PosReservationInput): Promise<PosReservationResult> {
      // Clover uses custom objects for reservations
      const response = await fetch(`${baseUrl}/v3/merchants/${config.merchantId}/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          state: 'open',
          title: `Reservation: ${reservation.guestName} (${reservation.partySize}p)`,
          note: `${reservation.scheduledAt} | Party: ${reservation.partySize} | ${reservation.notes ?? ''}`,
          customFields: { party_size: reservation.partySize, scheduled_at: reservation.scheduledAt },
        }),
      });
      const data = await response.json() as { id?: string };
      if (!data.id) return { externalId: '', status: 'failed', provider: 'clover' };
      return { externalId: data.id, status: 'confirmed', provider: 'clover', rawResponse: data as Record<string, unknown> };
    },

    async updateReservation(_locationId: string, reservationId: string, updates: Partial<PosReservationInput>): Promise<PosReservationResult> {
      const response = await fetch(`${baseUrl}/v3/merchants/${config.merchantId}/orders/${reservationId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          note: updates.scheduledAt ? `Updated: ${updates.scheduledAt} | Party: ${updates.partySize ?? ''}` : undefined,
        }),
      });
      const data = await response.json() as { id?: string };
      return { externalId: data.id ?? reservationId, status: 'confirmed', provider: 'clover', rawResponse: data as Record<string, unknown> };
    },

    async markSeated(_locationId: string, _reservationId: string): Promise<void> {
      // Clover doesn't have seated concept; staff opens the check manually
    },

    async cancel(_locationId: string, reservationId: string, _reason?: string): Promise<void> {
      await fetch(`${baseUrl}/v3/merchants/${config.merchantId}/orders/${reservationId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ state: 'locked' }),
      });
    },
  };
}

export const CLOVER_MARKETPLACE_REV_SHARE = 0.30; // 30% on marketplace-distributed installs
