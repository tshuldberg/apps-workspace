export type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'no_show' | 'cancelled';
export type ReservationSource = 'web_widget' | 'mylife_app' | 'walk_in' | 'phone' | 'resy_passthrough';

export interface Reservation {
  id: string;
  restaurantId: string;
  dinerId: string | null;
  partySize: number;
  scheduledAt: string;
  durationMinutes: number;
  tableId: string | null;
  source: ReservationSource;
  status: ReservationStatus;
  occasion: string | null;
  specialRequests: string | null;
  dietaryNotes: string | null;
  policyVersionId: string | null;
  consentAt: string | null;
  consentIp: string | null;
  paymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  time: string; // ISO string
  availableTables: string[];
  totalCapacity: number;
}

export interface AvailabilityQuery {
  restaurantId: string;
  date: string; // YYYY-MM-DD
  partySize: number;
  durationMinutes?: number;
}

export interface StatusTransition {
  from: ReservationStatus;
  to: ReservationStatus;
  valid: boolean;
  action?: 'capture_deposit' | 'cancel_deposit' | 'refund_deposit';
}

export const STATUS_COLORS: Record<ReservationStatus, string> = {
  pending: '#FFB877',
  confirmed: '#8BCFF0',
  seated: '#30D158',
  completed: '#9F8E81',
  no_show: '#DC2626',
  cancelled: '#9F8E81',
};
