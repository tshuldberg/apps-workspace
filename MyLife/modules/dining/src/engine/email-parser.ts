/**
 * Email parser for reservation confirmation emails.
 * Extracts structured reservation data from raw email text using regex heuristics.
 */

import type { DeeplinkPlatform } from './deeplink';

export interface ParsedReservation {
  restaurantName: string | null;
  date: string | null;        // YYYY-MM-DD
  time: string | null;        // HH:mm
  partySize: number | null;
  confirmationCode: string | null;
  platform: DeeplinkPlatform | null;
}

const MONTH_MAP: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09',
  oct: '10', nov: '11', dec: '12',
};

/**
 * Detect which booking platform sent the email based on text content.
 */
export function detectEmailPlatform(text: string): DeeplinkPlatform | null {
  const lower = text.toLowerCase();

  if (lower.includes('resy.com') || (lower.includes('reservation confirmed') && lower.includes('resy'))) {
    return 'resy';
  }
  if (lower.includes('opentable.com') || lower.includes('your opentable reservation')) {
    return 'opentable';
  }
  if (lower.includes('exploretock.com') || lower.includes('your tock reservation') || lower.includes('booking confirmed') && lower.includes('tock')) {
    return 'tock';
  }
  if (lower.includes('yelp.com/reservations') || lower.includes('your yelp reservation')) {
    return 'yelp';
  }

  return null;
}

/**
 * Parse a reservation confirmation email and extract structured data.
 * Best-effort extraction; fields may be null if not found.
 */
export function parseConfirmationEmail(text: string): ParsedReservation {
  return {
    restaurantName: extractRestaurantName(text),
    date: extractDate(text),
    time: extractTime(text),
    partySize: extractPartySize(text),
    confirmationCode: extractConfirmationCode(text),
    platform: detectEmailPlatform(text),
  };
}

function extractRestaurantName(text: string): string | null {
  // "Reservation at [Name]" / "at [Name]"
  const atMatch = text.match(/(?:reservation|your booking)\s+at\s+([^\n,]+)/i);
  if (atMatch) return atMatch[1].trim();

  // "Restaurant: [Name]"
  const labelMatch = text.match(/restaurant:\s*([^\n]+)/i);
  if (labelMatch) return labelMatch[1].trim();

  return null;
}

function extractDate(text: string): string | null {
  // ISO format: 2026-03-15
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  // "March 15, 2026" or "Mar 15, 2026"
  const namedMonthMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (namedMonthMatch) {
    const month = MONTH_MAP[namedMonthMatch[1].toLowerCase()];
    const day = namedMonthMatch[2].padStart(2, '0');
    return `${namedMonthMatch[3]}-${month}-${day}`;
  }

  // US date: 3/15/2026 or 03/15/2026
  const usDateMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (usDateMatch) {
    const month = usDateMatch[1].padStart(2, '0');
    const day = usDateMatch[2].padStart(2, '0');
    return `${usDateMatch[3]}-${month}-${day}`;
  }

  return null;
}

function extractTime(text: string): string | null {
  // "7:30 PM" / "7:30PM" / "7:30 pm"
  const ampmMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const period = ampmMatch[3].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  // 24h format: 19:30 (but not part of a date like 2026-03-15)
  const h24Match = text.match(/(?<!\d[/-])(\d{2}):(\d{2})(?!\d*[/-])/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    if (hours >= 0 && hours <= 23) {
      return `${h24Match[1]}:${h24Match[2]}`;
    }
  }

  return null;
}

function extractPartySize(text: string): number | null {
  // "party of 4", "4 guests", "Guests: 4", "covers: 4"
  const patterns = [
    /party\s+of\s+(\d+)/i,
    /(\d+)\s+guests?/i,
    /guests?:\s*(\d+)/i,
    /covers?:\s*(\d+)/i,
    /party\s*size:\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const size = parseInt(match[1], 10);
      if (size > 0 && size <= 100) return size;
    }
  }

  return null;
}

function extractConfirmationCode(text: string): string | null {
  // "Confirmation: ABC123", "Confirmation #ABC123", "Code: ABC123", "Confirmation Number: ABC123"
  const patterns = [
    /confirmation\s*(?:#|number|code)?:?\s*#?\s*([A-Za-z0-9-]+)/i,
    /code:\s*([A-Za-z0-9-]+)/i,
    /booking\s*(?:#|number|ref|reference)?:?\s*#?\s*([A-Za-z0-9-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1].length >= 3) {
      return match[1];
    }
  }

  return null;
}
