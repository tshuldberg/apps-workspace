export interface ReservationPosAdapter {
  provider: PosProvider;
  getAvailability(locationId: string, date: string, partySize: number): Promise<PosTimeSlot[]>;
  createReservation(locationId: string, reservation: PosReservationInput): Promise<PosReservationResult>;
  updateReservation(locationId: string, reservationId: string, updates: Partial<PosReservationInput>): Promise<PosReservationResult>;
  markSeated(locationId: string, reservationId: string): Promise<void>;
  cancel(locationId: string, reservationId: string, reason?: string): Promise<void>;
}

export type PosProvider = 'square' | 'toast' | 'lightspeed_k' | 'lightspeed_u' | 'clover' | 'omnivore';

export interface PosTimeSlot {
  startAt: string;
  durationMinutes: number;
  availableCapacity: number;
}

export interface PosReservationInput {
  partySize: number;
  scheduledAt: string;
  durationMinutes: number;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  notes?: string;
}

export interface PosReservationResult {
  externalId: string;
  status: 'confirmed' | 'pending' | 'failed';
  provider: PosProvider;
  rawResponse?: Record<string, unknown>;
}

export interface PosConnection {
  id: string;
  restaurantId: string;
  provider: PosProvider;
  accountId: string;
  locationId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string;
  scopes: string[];
  status: 'active' | 'expired' | 'revoked';
  lastSyncAt: string | null;
  syncError: string | null;
}

export interface WebhookEvent {
  id: string;
  provider: PosProvider;
  eventType: string;
  payload: Record<string, unknown>;
  signature: string;
  receivedAt: string;
}

export interface NormalizedEvent {
  type: 'reservation.created' | 'reservation.updated' | 'reservation.cancelled' | 'reservation.seated' | 'reservation.completed';
  externalId: string;
  provider: PosProvider;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface WriteQueueItem {
  id: string;
  connectionId: string;
  operation: 'create' | 'update' | 'cancel' | 'mark_seated';
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  error?: string;
  createdAt: string;
}

export interface ReconciliationResult {
  connectionId: string;
  checkedAt: string;
  localCount: number;
  remoteCount: number;
  mismatches: ReconciliationMismatch[];
  repaired: number;
}

export interface ReconciliationMismatch {
  externalId: string;
  localStatus: string | null;
  remoteStatus: string;
  action: 'create_local' | 'update_local' | 'update_remote' | 'skip';
}
