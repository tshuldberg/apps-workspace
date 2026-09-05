import { describe, it, expect } from 'vitest';
import { detectEmailPlatform, parseConfirmationEmail } from '../engine/email-parser';

describe('detectEmailPlatform', () => {
  it('detects resy', () => {
    expect(detectEmailPlatform('Your reservation at Bestia via resy.com is confirmed.')).toBe('resy');
  });

  it('detects opentable', () => {
    expect(detectEmailPlatform('Your OpenTable reservation is confirmed.')).toBe('opentable');
  });

  it('detects tock', () => {
    expect(detectEmailPlatform('Your Tock reservation at Alinea has been confirmed via exploretock.com.')).toBe('tock');
  });

  it('detects yelp', () => {
    expect(detectEmailPlatform('Your Yelp reservation has been confirmed at yelp.com/reservations/bestia.')).toBe('yelp');
  });

  it('returns null for unknown', () => {
    expect(detectEmailPlatform('Please come to dinner at our restaurant.')).toBeNull();
  });
});

describe('parseConfirmationEmail', () => {
  it('parses resy format', () => {
    const text = `
      Reservation Confirmed via resy.com
      Your reservation at Bestia
      March 15, 2026 at 7:30 PM
      Party of 4
      Confirmation: RESY-XYZ789
    `;
    const result = parseConfirmationEmail(text);

    expect(result.platform).toBe('resy');
    expect(result.restaurantName).toBe('Bestia');
    expect(result.date).toBe('2026-03-15');
    expect(result.time).toBe('19:30');
    expect(result.partySize).toBe(4);
    expect(result.confirmationCode).toBe('RESY-XYZ789');
  });

  it('parses opentable format', () => {
    const text = `
      Your OpenTable reservation is confirmed!
      Restaurant: Felix Trattoria
      Date: 4/20/2026
      Time: 8:00 PM
      Guests: 2
      Confirmation #OT-456
    `;
    const result = parseConfirmationEmail(text);

    expect(result.platform).toBe('opentable');
    expect(result.restaurantName).toBe('Felix Trattoria');
    expect(result.date).toBe('2026-04-20');
    expect(result.time).toBe('20:00');
    expect(result.partySize).toBe(2);
    expect(result.confirmationCode).toBe('OT-456');
  });

  it('extracts date in various formats', () => {
    // ISO format
    const iso = parseConfirmationEmail('Dinner on 2026-05-10 at the spot');
    expect(iso.date).toBe('2026-05-10');

    // Named month
    const named = parseConfirmationEmail('Dinner on January 5, 2026');
    expect(named.date).toBe('2026-01-05');

    // US date
    const us = parseConfirmationEmail('Dinner on 12/25/2026');
    expect(us.date).toBe('2026-12-25');
  });

  it('extracts party size', () => {
    expect(parseConfirmationEmail('party of 6').partySize).toBe(6);
    expect(parseConfirmationEmail('3 guests attending').partySize).toBe(3);
    expect(parseConfirmationEmail('Covers: 8').partySize).toBe(8);
  });

  it('extracts confirmation code', () => {
    expect(parseConfirmationEmail('Confirmation: ABC123').confirmationCode).toBe('ABC123');
    expect(parseConfirmationEmail('Confirmation #DEF456').confirmationCode).toBe('DEF456');
    expect(parseConfirmationEmail('Code: GHI789').confirmationCode).toBe('GHI789');
  });

  it('handles partial data gracefully', () => {
    const result = parseConfirmationEmail('Some random text with no reservation info');

    expect(result.restaurantName).toBeNull();
    expect(result.date).toBeNull();
    expect(result.time).toBeNull();
    expect(result.partySize).toBeNull();
    expect(result.confirmationCode).toBeNull();
    expect(result.platform).toBeNull();
  });
});
