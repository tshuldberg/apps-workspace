import type { ReservationPosAdapter, PosTimeSlot, PosReservationInput, PosReservationResult } from '../types';

export interface ToastConfig {
  clientId: string;
  clientSecret: string;
  restaurantGuid: string;
  environment: 'sandbox' | 'production';
}

function getBaseUrl(env: 'sandbox' | 'production'): string {
  return env === 'sandbox' ? 'https://ws-sandbox-api.eng.toasttab.com' : 'https://ws-api.toasttab.com';
}

export function createToastAdapter(config: ToastConfig): ReservationPosAdapter {
  const baseUrl = getBaseUrl(config.environment);
  let accessToken: string | null = null;
  let tokenExpiresAt = 0;

  async function getToken(): Promise<string> {
    if (accessToken && Date.now() < tokenExpiresAt) return accessToken;
    const response = await fetch(`${baseUrl}/authentication/v1/authentication/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: config.clientId, clientSecret: config.clientSecret, userAccessType: 'TOAST_MACHINE_CLIENT' }),
    });
    const data = await response.json() as { token?: { accessToken: string; expiresIn: number } };
    if (!data.token) throw new Error('Toast authentication failed');
    accessToken = data.token.accessToken;
    tokenExpiresAt = Date.now() + (data.token.expiresIn * 1000) - 60000;
    return accessToken;
  }

  return {
    provider: 'toast',

    async getAvailability(_locationId: string, date: string, _partySize: number): Promise<PosTimeSlot[]> {
      const token = await getToken();
      const response = await fetch(`${baseUrl}/restaurants/v1/restaurants/${config.restaurantGuid}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Toast-Restaurant-External-ID': config.restaurantGuid },
      });
      const data = await response.json() as { schedules?: Array<{ openTime: string; closeTime: string }> };
      const schedule = data.schedules?.[0];
      if (!schedule) return [];
      // Generate slots based on service hours
      const slots: PosTimeSlot[] = [];
      const open = new Date(`${date}T${schedule.openTime}`);
      const close = new Date(`${date}T${schedule.closeTime}`);
      for (let t = open.getTime(); t < close.getTime(); t += 15 * 60000) {
        slots.push({ startAt: new Date(t).toISOString(), durationMinutes: 90, availableCapacity: 4 });
      }
      return slots;
    },

    async createReservation(_locationId: string, reservation: PosReservationInput): Promise<PosReservationResult> {
      const token = await getToken();
      // Model reservation as order with metadata
      const response = await fetch(`${baseUrl}/orders/v2/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': config.restaurantGuid,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: 'Order',
          externalId: crypto.randomUUID(),
          openedDate: reservation.scheduledAt,
          diningOption: { entityType: 'DiningOption', externalId: 'reservation' },
          checks: [],
          table: { entityType: 'RestaurantTable', externalId: 'unassigned' },
          serviceArea: null,
          guest: { firstName: reservation.guestName, email: reservation.guestEmail, phone: reservation.guestPhone },
          customFields: [
            { name: 'party_size', value: String(reservation.partySize) },
            { name: 'duration_minutes', value: String(reservation.durationMinutes) },
            { name: 'reservation_notes', value: reservation.notes ?? '' },
          ],
        }),
      });
      const data = await response.json() as { guid?: string; externalId?: string };
      if (!data.guid) return { externalId: '', status: 'failed', provider: 'toast' };
      return { externalId: data.guid, status: 'confirmed', provider: 'toast', rawResponse: data as Record<string, unknown> };
    },

    async updateReservation(_locationId: string, reservationId: string, updates: Partial<PosReservationInput>): Promise<PosReservationResult> {
      const token = await getToken();
      const response = await fetch(`${baseUrl}/orders/v2/orders/${reservationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': config.restaurantGuid,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openedDate: updates.scheduledAt,
          customFields: updates.partySize ? [{ name: 'party_size', value: String(updates.partySize) }] : undefined,
        }),
      });
      const data = await response.json() as { guid?: string };
      return { externalId: data.guid ?? reservationId, status: 'confirmed', provider: 'toast', rawResponse: data as Record<string, unknown> };
    },

    async markSeated(_locationId: string, _reservationId: string): Promise<void> {
      // Toast order state transition handled automatically when server opens the check
    },

    async cancel(_locationId: string, reservationId: string, _reason?: string): Promise<void> {
      const token = await getToken();
      await fetch(`${baseUrl}/orders/v2/orders/${reservationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Toast-Restaurant-External-ID': config.restaurantGuid,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ voidDate: new Date().toISOString(), voidBusinessDate: new Date().toISOString().split('T')[0] }),
      });
    },
  };
}

export const TOAST_RATE_LIMIT = 1000; // requests per minute per location

export function createRateLimiter(requestsPerMinute: number = TOAST_RATE_LIMIT) {
  const window: number[] = [];
  return {
    canMakeRequest(): boolean {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      while (window.length > 0 && window[0] < oneMinuteAgo) window.shift();
      return window.length < requestsPerMinute;
    },
    recordRequest(): void {
      window.push(Date.now());
    },
    getRemaining(): number {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      while (window.length > 0 && window[0] < oneMinuteAgo) window.shift();
      return requestsPerMinute - window.length;
    },
  };
}
