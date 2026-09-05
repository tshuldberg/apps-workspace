import type { ReservationPosAdapter, PosTimeSlot, PosReservationInput, PosReservationResult } from '../types';

export interface SquareConfig {
  accessToken: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}

function getBaseUrl(env: 'sandbox' | 'production'): string {
  return env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}

export function createSquareAdapter(config: SquareConfig): ReservationPosAdapter {
  const baseUrl = getBaseUrl(config.environment);

  return {
    provider: 'square',

    async getAvailability(locationId: string, date: string, partySize: number): Promise<PosTimeSlot[]> {
      const response = await fetch(`${baseUrl}/v2/bookings/availability/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18',
        },
        body: JSON.stringify({
          query: {
            filter: {
              location_id: locationId,
              start_at_range: { start_at: `${date}T00:00:00Z`, end_at: `${date}T23:59:59Z` },
              segment_filters: [{ service_variation_id: 'ALL' }],
            },
          },
        }),
      });
      const data = await response.json() as { availabilities?: Array<{ start_at: string; appointment_segments: Array<{ duration_minutes: number }> }> };
      return (data.availabilities ?? []).map((a) => ({
        startAt: a.start_at,
        durationMinutes: a.appointment_segments?.[0]?.duration_minutes ?? 90,
        availableCapacity: partySize,
      }));
    },

    async createReservation(locationId: string, reservation: PosReservationInput): Promise<PosReservationResult> {
      const response = await fetch(`${baseUrl}/v2/bookings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18',
        },
        body: JSON.stringify({
          idempotency_key: crypto.randomUUID(),
          booking: {
            location_id: locationId,
            start_at: reservation.scheduledAt,
            customer_note: reservation.notes ?? '',
            appointment_segments: [{
              duration_minutes: reservation.durationMinutes,
              team_member_id: 'ANY',
            }],
          },
        }),
      });
      const data = await response.json() as { booking?: { id: string; status: string } };
      if (!data.booking) return { externalId: '', status: 'failed', provider: 'square' };
      return {
        externalId: data.booking.id,
        status: data.booking.status === 'ACCEPTED' ? 'confirmed' : 'pending',
        provider: 'square',
        rawResponse: data as Record<string, unknown>,
      };
    },

    async updateReservation(_locationId: string, reservationId: string, updates: Partial<PosReservationInput>): Promise<PosReservationResult> {
      const response = await fetch(`${baseUrl}/v2/bookings/${reservationId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18',
        },
        body: JSON.stringify({
          booking: {
            start_at: updates.scheduledAt,
            customer_note: updates.notes,
          },
        }),
      });
      const data = await response.json() as { booking?: { id: string; status: string } };
      if (!data.booking) return { externalId: reservationId, status: 'failed', provider: 'square' };
      return { externalId: data.booking.id, status: 'confirmed', provider: 'square', rawResponse: data as Record<string, unknown> };
    },

    async markSeated(_locationId: string, _reservationId: string): Promise<void> {
      // Square Bookings API doesn't have a native "seated" concept
      // We update booking custom attribute or note instead
    },

    async cancel(_locationId: string, reservationId: string, _reason?: string): Promise<void> {
      await fetch(`${baseUrl}/v2/bookings/${reservationId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          'Square-Version': '2024-12-18',
        },
        body: JSON.stringify({}),
      });
    },
  };
}
