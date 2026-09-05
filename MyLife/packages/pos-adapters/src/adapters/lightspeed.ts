import type { ReservationPosAdapter, PosTimeSlot, PosReservationInput, PosReservationResult } from '../types';

export interface LightspeedKConfig {
  accessToken: string;
  accountId: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

function getBaseUrl(env: 'sandbox' | 'production'): string {
  return env === 'sandbox' ? 'https://api.trial.lsk.lightspeed.app' : 'https://api.lsk.lightspeed.app';
}

export function createLightspeedKAdapter(config: LightspeedKConfig): ReservationPosAdapter {
  const baseUrl = getBaseUrl(config.environment);
  const headers = {
    'Authorization': `Bearer ${config.accessToken}`,
    'Content-Type': 'application/json',
  };

  return {
    provider: 'lightspeed_k',

    async getAvailability(locationId: string, date: string, partySize: number): Promise<PosTimeSlot[]> {
      const response = await fetch(
        `${baseUrl}/api/2.0/accounts/${config.accountId}/locations/${locationId}/reservations/availability?date=${date}&party_size=${partySize}`,
        { headers },
      );
      const data = await response.json() as { slots?: Array<{ start_time: string; duration: number; capacity: number }> };
      return (data.slots ?? []).map((s) => ({
        startAt: s.start_time,
        durationMinutes: s.duration,
        availableCapacity: s.capacity,
      }));
    },

    async createReservation(locationId: string, reservation: PosReservationInput): Promise<PosReservationResult> {
      const response = await fetch(
        `${baseUrl}/api/2.0/accounts/${config.accountId}/locations/${locationId}/reservations`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            party_size: reservation.partySize,
            start_time: reservation.scheduledAt,
            duration: reservation.durationMinutes,
            guest: { name: reservation.guestName, email: reservation.guestEmail, phone: reservation.guestPhone },
            notes: reservation.notes,
          }),
        },
      );
      const data = await response.json() as { id?: string; status?: string };
      if (!data.id) return { externalId: '', status: 'failed', provider: 'lightspeed_k' };
      return { externalId: data.id, status: 'confirmed', provider: 'lightspeed_k', rawResponse: data as Record<string, unknown> };
    },

    async updateReservation(locationId: string, reservationId: string, updates: Partial<PosReservationInput>): Promise<PosReservationResult> {
      const response = await fetch(
        `${baseUrl}/api/2.0/accounts/${config.accountId}/locations/${locationId}/reservations/${reservationId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            party_size: updates.partySize,
            start_time: updates.scheduledAt,
            duration: updates.durationMinutes,
            notes: updates.notes,
          }),
        },
      );
      const data = await response.json() as { id?: string };
      return { externalId: data.id ?? reservationId, status: 'confirmed', provider: 'lightspeed_k', rawResponse: data as Record<string, unknown> };
    },

    async markSeated(locationId: string, reservationId: string): Promise<void> {
      await fetch(
        `${baseUrl}/api/2.0/accounts/${config.accountId}/locations/${locationId}/reservations/${reservationId}/seat`,
        { method: 'POST', headers },
      );
    },

    async cancel(locationId: string, reservationId: string, reason?: string): Promise<void> {
      await fetch(
        `${baseUrl}/api/2.0/accounts/${config.accountId}/locations/${locationId}/reservations/${reservationId}/cancel`,
        { method: 'POST', headers, body: JSON.stringify({ reason }) },
      );
    },
  };
}
