/**
 * Tests for the MyTravel email / booking confirmation parser.
 * Pure engine: no DB, no network.
 */

import { describe, expect, it } from 'vitest';

import {
  detectBookingType,
  extractAmount,
  extractConfirmationCode,
  extractDatesIso,
  parseBookingEmail,
} from '../engine/email-parser';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UNITED_FLIGHT = `Subject: Your United flight confirmation
Thank you for booking with United.
Confirmation code: ABC123
Flight #UA456 departs LAX -> JFK on 2026-06-15 at 7:30 AM.
Gate B12. Total: USD 450.00`;

const DELTA_FLIGHT = `Subject: Delta e-ticket receipt
Boarding pass attached.
Flight DL789 departs Jan 5, 2026 at 9:45 PM.
Confirmation: XYZ987.`;

const MARRIOTT_HOTEL = `Subject: Your Marriott reservation is confirmed
Hotel: Marriott Marquis New York
Check-in: 2026-07-01
Check-out: 2026-07-05
4 nights, Room type: King
Confirmation number: MAR12345
Total: $1,200.00`;

const HILTON_HOTEL = `Subject: Hilton booking
Hotel name: Hilton Downtown
Check-in 2026-08-10
Check-out 2026-08-12
2 nights. Total: $450.00
Reservation code: HIL99999`;

const HERTZ_CAR = `Subject: Hertz rental car confirmation
Pickup location: LAX Terminal 3
Return location: SFO Airport
Pickup: 2026-09-01 at 10:00 AM
Return: 2026-09-05 at 10:00 AM
Confirmation #: HZ55555
Total: USD 320.50`;

const ENTERPRISE_CAR = `Subject: Enterprise rental car
Rental car pickup 2026-10-15
Confirmation code: ENT88888
$199.99 charged.`;

const AMTRAK_TRAIN = `Subject: Amtrak ticket
Train #123 departs from Penn Station.
Station: New York
Platform 7
Confirmation: AMT12345
2026-05-20 at 8:00 AM
$89.00`;

const EURAIL_TRAIN = `Subject: Eurail booking
Train 456 departs station Gare du Nord.
Confirmation number: EUR98765
2026-06-10 at 14:30
EUR 120.00`;

const FERRY_EMAIL = `Subject: Ferry confirmation
Vessel: MS Nordic Star
Port of Dover to Port of Calais
Confirmation code: FER11111
2026-04-10 at 09:00
GBP 75.50`;

const PORT_OF_FERRY = `Subject: Ferry booking
ferry departs port of Piraeus 2026-05-01 at 10:00
confirmation: FRY22222
EUR 45.00`;

const VIATOR_TOUR = `Subject: Viator tour booking
Your guided tour is confirmed.
Tour: Colosseum Skip-the-Line
Itinerary attached. Guide: Marco.
Confirmation: VIA33333
2026-06-20 at 11:00 AM
EUR 85.00`;

const GETYOURGUIDE_TOUR = `Subject: GetYourGuide confirmation
Tour itinerary for Louvre guide
Confirmation code: GYG44444
2026-07-04 at 15:30
EUR 60.00`;

const OTHER_EMAIL = `Subject: Your receipt
Confirmation number: ZZ88888
Total: $99.00`;

const UNRELATED_EMAIL = `Hi there,
Just checking in to say hello. Hope all is well.
Let me know when you want to grab coffee.`;

const PARTIAL_HOTEL = `Subject: Hilton stay
check-in is soon, see you then.`;

// ---------------------------------------------------------------------------
// detectBookingType
// ---------------------------------------------------------------------------

describe('detectBookingType', () => {
  it('detects flight from United + flight code + airport pair', () => {
    expect(detectBookingType(UNITED_FLIGHT)).toBe('flight');
  });

  it('detects flight from Delta + boarding pass', () => {
    expect(detectBookingType(DELTA_FLIGHT)).toBe('flight');
  });

  it('detects hotel from Marriott + check-in/check-out', () => {
    expect(detectBookingType(MARRIOTT_HOTEL)).toBe('hotel');
  });

  it('detects hotel from Hilton fixture', () => {
    expect(detectBookingType(HILTON_HOTEL)).toBe('hotel');
  });

  it('detects car from Hertz + pickup location', () => {
    expect(detectBookingType(HERTZ_CAR)).toBe('car');
  });

  it('detects car from Enterprise + rental car', () => {
    expect(detectBookingType(ENTERPRISE_CAR)).toBe('car');
  });

  it('detects train from Amtrak + platform + station', () => {
    expect(detectBookingType(AMTRAK_TRAIN)).toBe('train');
  });

  it('detects train from Eurail', () => {
    expect(detectBookingType(EURAIL_TRAIN)).toBe('train');
  });

  it('detects ferry from vessel + port of', () => {
    expect(detectBookingType(FERRY_EMAIL)).toBe('ferry');
  });

  it('detects ferry from port-of-only fixture', () => {
    expect(detectBookingType(PORT_OF_FERRY)).toBe('ferry');
  });

  it('detects tour from Viator + tour + guide + itinerary', () => {
    expect(detectBookingType(VIATOR_TOUR)).toBe('tour');
  });

  it('detects tour from GetYourGuide', () => {
    expect(detectBookingType(GETYOURGUIDE_TOUR)).toBe('tour');
  });

  it('returns null for unrelated text', () => {
    expect(detectBookingType(UNRELATED_EMAIL)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(detectBookingType('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractConfirmationCode
// ---------------------------------------------------------------------------

describe('extractConfirmationCode', () => {
  it('extracts standard "Confirmation code: ABC123"', () => {
    expect(extractConfirmationCode(UNITED_FLIGHT)).toBe('ABC123');
  });

  it('extracts 6-char PNR', () => {
    expect(extractConfirmationCode('PNR: XYZ123')).toBe('XYZ123');
  });

  it('extracts record locator', () => {
    expect(extractConfirmationCode('Record locator: ABCDEF')).toBe('ABCDEF');
  });

  it('returns undefined when absent', () => {
    expect(extractConfirmationCode('no code here')).toBeUndefined();
  });

  it('uppercases extracted code', () => {
    expect(extractConfirmationCode('Confirmation code: abc123')).toBe('ABC123');
  });
});

// ---------------------------------------------------------------------------
// extractDatesIso
// ---------------------------------------------------------------------------

describe('extractDatesIso', () => {
  it('parses ISO dates with nearby AM time', () => {
    const dates = extractDatesIso('2026-06-15 at 7:30 AM');
    expect(dates[0]).toBe('2026-06-15T07:30:00.000Z');
  });

  it('parses US M/D/YYYY', () => {
    const dates = extractDatesIso('Departs 6/15/2026 at 3:00 PM');
    expect(dates[0]).toBe('2026-06-15T15:00:00.000Z');
  });

  it('parses long form Jan 5, 2026', () => {
    const dates = extractDatesIso('Travel date: Jan 5, 2026 at 9:45 PM');
    expect(dates[0]).toBe('2026-01-05T21:45:00.000Z');
  });

  it('parses "5 January 2026" form', () => {
    const dates = extractDatesIso('Leaves on 5 January 2026 at 08:00');
    expect(dates[0]).toBe('2026-01-05T08:00:00.000Z');
  });

  it('returns empty array for no dates', () => {
    expect(extractDatesIso('nothing relevant')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// extractAmount
// ---------------------------------------------------------------------------

describe('extractAmount', () => {
  it('parses $1,234.56 as USD cents', () => {
    expect(extractAmount('Total: $1,234.56')).toEqual({
      valueCents: 123456,
      currency: 'USD',
    });
  });

  it('parses USD 1234.56', () => {
    expect(extractAmount('charged USD 1234.56')).toEqual({
      valueCents: 123456,
      currency: 'USD',
    });
  });

  it('parses euro symbol amount', () => {
    expect(extractAmount('Total: \u20AC500.00')).toEqual({
      valueCents: 50000,
      currency: 'EUR',
    });
  });

  it('parses pound integer amount', () => {
    expect(extractAmount('Amount: \u00A3200')).toEqual({
      valueCents: 20000,
      currency: 'GBP',
    });
  });

  it('returns undefined when no amount', () => {
    expect(extractAmount('nothing')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseBookingEmail
// ---------------------------------------------------------------------------

describe('parseBookingEmail', () => {
  it('parses a United flight confirmation end-to-end', () => {
    const result = parseBookingEmail(UNITED_FLIGHT);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.type).toBe('flight');
    expect(result.provider).toBe('United');
    expect(result.confirmationCode).toBe('ABC123');
    expect(result.startTs).toBe('2026-06-15T07:30:00.000Z');
    expect(result.location).toBe('LAX -> JFK');
    expect(result.costCents).toBe(45000);
    expect(result.currency).toBe('USD');
    expect(result.rawMatched.length).toBeGreaterThan(0);
  });

  it('parses a Marriott hotel confirmation with start + end dates', () => {
    const result = parseBookingEmail(MARRIOTT_HOTEL);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.type).toBe('hotel');
    expect(result.provider).toBe('Marriott');
    expect(result.confirmationCode).toBe('MAR12345');
    expect(result.startTs).toBe('2026-07-01T00:00:00.000Z');
    expect(result.endTs).toBe('2026-07-05T00:00:00.000Z');
    expect(result.costCents).toBe(120000);
    expect(result.currency).toBe('USD');
    expect(result.location).toBe('Marriott Marquis New York');
  });

  it('parses a Hertz car rental', () => {
    const result = parseBookingEmail(HERTZ_CAR);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.type).toBe('car');
    expect(result.provider).toBe('Hertz');
    expect(result.confirmationCode).toBe('HZ55555');
    expect(result.startTs).toBe('2026-09-01T10:00:00.000Z');
    expect(result.costCents).toBe(32050);
    expect(result.currency).toBe('USD');
    expect(result.location).toBe('LAX Terminal 3');
  });

  it('returns "other" when only confirmation code + amount are present', () => {
    const result = parseBookingEmail(OTHER_EMAIL);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.type).toBe('other');
    expect(result.confirmationCode).toBe('ZZ88888');
    expect(result.costCents).toBe(9900);
    expect(result.currency).toBe('USD');
  });

  it('returns null for completely unrelated text', () => {
    expect(parseBookingEmail(UNRELATED_EMAIL)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parseBookingEmail('')).toBeNull();
    expect(parseBookingEmail('   ')).toBeNull();
  });

  it('handles partial parses gracefully (missing fields allowed)', () => {
    const result = parseBookingEmail(PARTIAL_HOTEL);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.type).toBe('hotel');
    expect(result.confirmationCode).toBeUndefined();
    expect(result.startTs).toBeUndefined();
    expect(result.costCents).toBeUndefined();
  });

  it('is deterministic: same input yields equal output', () => {
    const a = parseBookingEmail(UNITED_FLIGHT);
    const b = parseBookingEmail(UNITED_FLIGHT);
    expect(a).toEqual(b);
  });

  it('produces output shape compatible with BookingInput fields', () => {
    const result = parseBookingEmail(MARRIOTT_HOTEL);
    expect(result).not.toBeNull();
    if (!result) return;
    // The consumer can splice trip_id in and call createBooking with these keys.
    const bookingLike = {
      trip_id: 'trip_1',
      type: result.type,
      provider: result.provider,
      confirmation_code: result.confirmationCode,
      start_ts: result.startTs ?? '2026-01-01T00:00:00.000Z',
      end_ts: result.endTs,
      location: result.location,
      cost_cents: result.costCents,
      currency: result.currency,
      notes: result.notes,
    };
    expect(typeof bookingLike.start_ts).toBe('string');
    expect(bookingLike.currency).toHaveLength(3);
  });
});
