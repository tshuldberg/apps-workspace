export type WaitlistStatus = 'waiting' | 'ready' | 'seated' | 'walked_away';

export interface WaitlistEntry {
  id: string;
  restaurantId: string;
  dinerName: string;
  phone: string | null;
  partySize: number;
  dietaryNotes: string | null;
  joinedAt: string;
  estimatedWaitMin: number | null;
  position: number | null;
  status: WaitlistStatus;
  readyPingedAt: string | null;
  walkedAwayReason: string | null;
  smsConsent: boolean;
  createdAt: string;
}

export interface QuoteRange {
  min: number;
  max: number;
}

export interface AddWalkInInput {
  restaurantId: string;
  dinerName: string;
  phone?: string;
  partySize: number;
  dietaryNotes?: string;
  smsConsent?: boolean;
}
