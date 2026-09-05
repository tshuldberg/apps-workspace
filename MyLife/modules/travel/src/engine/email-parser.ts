/**
 * MyTravel email / booking confirmation parser.
 *
 * Pure, deterministic, regex-based. No network, no DB, no filesystem.
 * Input is raw email text (plain text or stripped HTML). Output is a
 * `ParsedBooking` shaped to be forwarded directly to `createBooking`
 * (minus `trip_id`, which the caller attaches).
 *
 * Heuristics are intentionally conservative: we prefer returning `null`
 * or a partial parse over inventing fields. All APIs use es2019-compatible
 * primitives (no `String.replaceAll`, no unannotated Set/Map iteration).
 */

import type { BookingType } from '../models/schemas';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedBooking {
  type: BookingType;
  provider: string;
  confirmationCode?: string;
  startTs?: string;
  endTs?: string;
  location?: string;
  costCents?: number;
  currency?: string;
  notes?: string;
  rawMatched: string[];
}

// ---------------------------------------------------------------------------
// Provider / keyword tables
// ---------------------------------------------------------------------------

interface ProviderEntry {
  name: string;
  pattern: RegExp;
}

const FLIGHT_PROVIDERS: ProviderEntry[] = [
  { name: 'United', pattern: /\bunited\b/i },
  { name: 'Delta', pattern: /\bdelta\b/i },
  { name: 'American', pattern: /\bamerican airlines\b/i },
  { name: 'Southwest', pattern: /\bsouthwest\b/i },
  { name: 'JetBlue', pattern: /\bjetblue\b/i },
  { name: 'Alaska', pattern: /\balaska airlines\b/i },
  { name: 'Lufthansa', pattern: /\blufthansa\b/i },
  { name: 'British Airways', pattern: /\bbritish airways\b/i },
  { name: 'Air France', pattern: /\bair france\b/i },
  { name: 'Emirates', pattern: /\bemirates\b/i },
  { name: 'Qantas', pattern: /\bqantas\b/i },
];

const HOTEL_PROVIDERS: ProviderEntry[] = [
  { name: 'Marriott', pattern: /\bmarriott\b/i },
  { name: 'Hilton', pattern: /\bhilton\b/i },
  { name: 'Hyatt', pattern: /\bhyatt\b/i },
  { name: 'IHG', pattern: /\bihg\b/i },
  { name: 'Wyndham', pattern: /\bwyndham\b/i },
  { name: 'Airbnb', pattern: /\bairbnb\b/i },
  { name: 'Booking.com', pattern: /\bbooking\.com\b/i },
  { name: 'Expedia', pattern: /\bexpedia\b/i },
  { name: 'Agoda', pattern: /\bagoda\b/i },
];

const CAR_PROVIDERS: ProviderEntry[] = [
  { name: 'Hertz', pattern: /\bhertz\b/i },
  { name: 'Enterprise', pattern: /\benterprise\b/i },
  { name: 'Avis', pattern: /\bavis\b/i },
  { name: 'Budget', pattern: /\bbudget\b/i },
  { name: 'Alamo', pattern: /\balamo\b/i },
  { name: 'National', pattern: /\bnational\b/i },
  { name: 'Sixt', pattern: /\bsixt\b/i },
];

const TRAIN_PROVIDERS: ProviderEntry[] = [
  { name: 'Amtrak', pattern: /\bamtrak\b/i },
  { name: 'Eurail', pattern: /\beurail\b/i },
  { name: 'SNCF', pattern: /\bsncf\b/i },
];

const TOUR_PROVIDERS: ProviderEntry[] = [
  { name: 'Viator', pattern: /\bviator\b/i },
  { name: 'GetYourGuide', pattern: /\bgetyourguide\b/i },
];

const FLIGHT_KEYWORDS: RegExp[] = [
  /\bboarding pass\b/i,
  /\bflight\s*#?\s*[A-Z]{1,3}\s*\d+\b/i,
  /\bdepart(?:s|ure|ing)?\b/i,
  /\barriv(?:e|al|ing|es)\b/i,
  /\bgate\s+[A-Z0-9]+\b/i,
];

const HOTEL_KEYWORDS: RegExp[] = [
  /\bcheck.?in\b/i,
  /\bcheck.?out\b/i,
  /\bhotel\b/i,
  /\broom\s+(?:type|rate|number|#)?/i,
  /\b\d+\s+nights?\b/i,
];

const CAR_KEYWORDS: RegExp[] = [
  /\brental car\b/i,
  /\bpickup location\b/i,
  /\breturn location\b/i,
  /\bcar rental\b/i,
];

const TRAIN_KEYWORDS: RegExp[] = [
  /\bstation\b/i,
  /\bplatform\s+\d+\b/i,
  /\btrain\s*#?\s*\d+\b/i,
];

const FERRY_KEYWORDS: RegExp[] = [
  /\bferry\b/i,
  /\bvessel\b/i,
  /\bport of\b/i,
];

const TOUR_KEYWORDS: RegExp[] = [
  /\btour\b/i,
  /\bitinerary\b/i,
  /\bguide\b/i,
];

// ---------------------------------------------------------------------------
// detectBookingType
// ---------------------------------------------------------------------------

interface TypeScore {
  type: BookingType;
  score: number;
  matched: string[];
}

function scoreType(
  raw: string,
  type: BookingType,
  keywords: RegExp[],
  providers: ProviderEntry[],
): TypeScore {
  const matched: string[] = [];
  let score = 0;
  for (const kw of keywords) {
    const m = raw.match(kw);
    if (m) {
      score += 1;
      matched.push(m[0]);
    }
  }
  for (const p of providers) {
    const m = raw.match(p.pattern);
    if (m) {
      score += 2;
      matched.push(m[0]);
    }
  }
  if (type === 'flight') {
    const airport = raw.match(
      /\b[A-Z]{3}\b[^A-Za-z0-9]{1,5}(?:to|->|\u2192|-)[^A-Za-z0-9]{1,5}\b[A-Z]{3}\b/,
    );
    if (airport) {
      score += 2;
      matched.push(airport[0]);
    }
  }
  return { type, score, matched };
}

export function detectBookingType(raw: string): BookingType | null {
  if (!raw || raw.length === 0) return null;
  const scores: TypeScore[] = [
    scoreType(raw, 'flight', FLIGHT_KEYWORDS, FLIGHT_PROVIDERS),
    scoreType(raw, 'hotel', HOTEL_KEYWORDS, HOTEL_PROVIDERS),
    scoreType(raw, 'car', CAR_KEYWORDS, CAR_PROVIDERS),
    scoreType(raw, 'train', TRAIN_KEYWORDS, TRAIN_PROVIDERS),
    scoreType(raw, 'ferry', FERRY_KEYWORDS, []),
    scoreType(raw, 'tour', TOUR_KEYWORDS, TOUR_PROVIDERS),
  ];
  let best: TypeScore | null = null;
  for (const s of scores) {
    if (!best || s.score > best.score) best = s;
  }
  if (!best || best.score === 0) return null;
  return best.type;
}

// ---------------------------------------------------------------------------
// extractConfirmationCode
// ---------------------------------------------------------------------------

const CONFIRMATION_PATTERNS: RegExp[] = [
  /confirmation\s*(?:number|code|#|no\.?)\s*:?\s*([A-Z0-9]{5,12})/i,
  /conf(?:irmation)?\s*#\s*([A-Z0-9]{5,12})/i,
  /\bPNR\s*:?\s*([A-Z0-9]{6})/i,
  /record locator\s*:?\s*([A-Z0-9]{6})/i,
  /booking\s*(?:reference|ref|number|#)\s*:?\s*([A-Z0-9]{5,12})/i,
  /reservation\s*(?:number|code|#)\s*:?\s*([A-Z0-9]{5,12})/i,
];

export function extractConfirmationCode(raw: string): string | undefined {
  for (const p of CONFIRMATION_PATTERNS) {
    const m = raw.match(p);
    if (m && m[1]) {
      const code = m[1].toUpperCase();
      if (code.length >= 5 && code.length <= 12) return code;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// extractDatesIso
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isValidYmd(y: number, m: number, d: number): boolean {
  if (y < 1970 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  return true;
}

interface DateHit {
  index: number;
  length: number;
  iso: string;
}

function collectDateHits(raw: string): DateHit[] {
  const hits: DateHit[] = [];

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = iso.exec(raw)) !== null) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (isValidYmd(y, mo, d)) {
      hits.push({
        index: m.index,
        length: m[0].length,
        iso: `${y}-${pad2(mo)}-${pad2(d)}`,
      });
    }
  }

  const us = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  while ((m = us.exec(raw)) !== null) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (isValidYmd(y, mo, d)) {
      hits.push({
        index: m.index,
        length: m[0].length,
        iso: `${y}-${pad2(mo)}-${pad2(d)}`,
      });
    }
  }

  const long1 =
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi;
  while ((m = long1.exec(raw)) !== null) {
    const mo = MONTH_NAMES[m[1].toLowerCase().replace(/\./g, '')];
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (mo && isValidYmd(y, mo, d)) {
      hits.push({
        index: m.index,
        length: m[0].length,
        iso: `${y}-${pad2(mo)}-${pad2(d)}`,
      });
    }
  }

  const long2 =
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{4})\b/gi;
  while ((m = long2.exec(raw)) !== null) {
    const d = Number(m[1]);
    const mo = MONTH_NAMES[m[2].toLowerCase().replace(/\./g, '')];
    const y = Number(m[3]);
    if (mo && isValidYmd(y, mo, d)) {
      hits.push({
        index: m.index,
        length: m[0].length,
        iso: `${y}-${pad2(mo)}-${pad2(d)}`,
      });
    }
  }

  const seen: Record<string, boolean> = {};
  const unique: DateHit[] = [];
  for (const h of hits) {
    const key = `${h.index}:${h.iso}`;
    if (!seen[key]) {
      seen[key] = true;
      unique.push(h);
    }
  }
  unique.sort((a, b) => a.index - b.index);
  return unique;
}

interface TimeHit {
  index: number;
  length: number;
  hh: number;
  mm: number;
}

function collectTimeHits(raw: string): TimeHit[] {
  const hits: TimeHit[] = [];
  const re = /\b(\d{1,2}):(\d{2})(?:\s*(AM|PM|am|pm))?\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    const mer = m[3] ? m[3].toUpperCase() : null;
    if (hh > 23 || mm > 59) continue;
    if (mer === 'PM' && hh < 12) hh += 12;
    if (mer === 'AM' && hh === 12) hh = 0;
    hits.push({ index: m.index, length: m[0].length, hh, mm });
  }
  return hits;
}

function combineDateTime(hit: DateHit, time: TimeHit | null): string {
  const hh = time ? pad2(time.hh) : '00';
  const mm = time ? pad2(time.mm) : '00';
  return `${hit.iso}T${hh}:${mm}:00.000Z`;
}

export function extractDatesIso(raw: string): string[] {
  const dates = collectDateHits(raw);
  const times = collectTimeHits(raw);
  const out: string[] = [];
  const seen: Record<string, boolean> = {};
  for (const d of dates) {
    let best: TimeHit | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const t of times) {
      const dist = t.index - (d.index + d.length);
      if (dist >= 0 && dist < bestDist && dist <= 60) {
        best = t;
        bestDist = dist;
      }
    }
    const iso = combineDateTime(d, best);
    if (!seen[iso]) {
      seen[iso] = true;
      out.push(iso);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// extractAmount
// ---------------------------------------------------------------------------

interface AmountResult {
  valueCents: number;
  currency: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: 'USD',
  '\u20AC': 'EUR',
  '\u00A3': 'GBP',
  '\u00A5': 'JPY',
};

const CURRENCY_CODES: Record<string, string> = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  JPY: 'JPY',
  CAD: 'CAD',
  AUD: 'AUD',
  CHF: 'CHF',
  CNY: 'CNY',
  INR: 'INR',
  MXN: 'MXN',
};

function parseAmountNumber(s: string): number | null {
  const normalized = s.split(',').join('');
  const n = Number(normalized);
  if (!isFinite(n) || n < 0) return null;
  return n;
}

export function extractAmount(raw: string): AmountResult | undefined {
  const codeFirst = raw.match(
    /\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|MXN)\s+([0-9][0-9,]*(?:\.\d{1,2})?)\b/i,
  );
  if (codeFirst) {
    const code = codeFirst[1].toUpperCase();
    const num = parseAmountNumber(codeFirst[2]);
    if (num !== null && CURRENCY_CODES[code]) {
      return { valueCents: Math.round(num * 100), currency: code };
    }
  }

  const symbolFirst = raw.match(
    /([$\u20AC\u00A3\u00A5])\s?([0-9][0-9,]*(?:\.\d{1,2})?)\b/,
  );
  if (symbolFirst) {
    const sym = symbolFirst[1];
    const num = parseAmountNumber(symbolFirst[2]);
    if (num !== null && CURRENCY_SYMBOLS[sym]) {
      return {
        valueCents: Math.round(num * 100),
        currency: CURRENCY_SYMBOLS[sym],
      };
    }
  }

  const amountFirst = raw.match(
    /\b([0-9][0-9,]*(?:\.\d{1,2})?)\s+(USD|EUR|GBP|JPY|CAD|AUD|CHF|CNY|INR|MXN)\b/i,
  );
  if (amountFirst) {
    const num = parseAmountNumber(amountFirst[1]);
    const code = amountFirst[2].toUpperCase();
    if (num !== null && CURRENCY_CODES[code]) {
      return { valueCents: Math.round(num * 100), currency: code };
    }
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// parseBookingEmail
// ---------------------------------------------------------------------------

function findProvider(raw: string, type: BookingType): string | undefined {
  let table: ProviderEntry[] = [];
  if (type === 'flight') table = FLIGHT_PROVIDERS;
  else if (type === 'hotel') table = HOTEL_PROVIDERS;
  else if (type === 'car') table = CAR_PROVIDERS;
  else if (type === 'train') table = TRAIN_PROVIDERS;
  else if (type === 'tour') table = TOUR_PROVIDERS;
  for (const p of table) {
    if (p.pattern.test(raw)) return p.name;
  }
  return undefined;
}

function extractSubject(raw: string): string | undefined {
  const m = raw.match(/^\s*subject\s*:\s*(.+)$/im);
  if (m && m[1]) return m[1].trim();
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (t.length > 0) return t.slice(0, 120);
  }
  return undefined;
}

function extractAirportPair(raw: string): string | undefined {
  const m = raw.match(
    /\b([A-Z]{3})\b\s*(?:->|\u2192|-|to|\u2014)\s*\b([A-Z]{3})\b/,
  );
  if (m) return `${m[1]} -> ${m[2]}`;
  return undefined;
}

function extractCityAfter(raw: string, label: RegExp): string | undefined {
  const m = raw.match(label);
  if (m && m[1]) {
    const v = m[1].trim().replace(/[.;,]+$/, '');
    if (v.length > 0 && v.length <= 200) return v;
  }
  return undefined;
}

export function parseBookingEmail(raw: string): ParsedBooking | null {
  if (!raw || raw.trim().length === 0) return null;

  const detectedType = detectBookingType(raw);
  const confirmationCode = extractConfirmationCode(raw);
  const amount = extractAmount(raw);
  const dates = extractDatesIso(raw);

  if (!detectedType && !(confirmationCode && amount)) {
    return null;
  }

  const type: BookingType = detectedType ?? 'other';

  const rawMatched: string[] = [];
  const pushMatch = (re: RegExp): void => {
    const m = raw.match(re);
    if (m) rawMatched.push(m[0]);
  };
  pushMatch(/confirmation\s*(?:number|code|#|no\.?)\s*:?\s*[A-Z0-9]{5,12}/i);
  pushMatch(/PNR\s*:?\s*[A-Z0-9]{6}/i);
  pushMatch(/record locator\s*:?\s*[A-Z0-9]{6}/i);
  pushMatch(/check.?in/i);
  pushMatch(/check.?out/i);
  pushMatch(/boarding pass/i);
  pushMatch(/flight\s*#?\s*[A-Z]{1,3}\s*\d+/i);
  pushMatch(/rental car/i);
  pushMatch(/pickup location/i);
  pushMatch(/\$[0-9][0-9,]*(?:\.\d{1,2})?/);

  let provider = findProvider(raw, type);
  if (!provider) {
    const subject = extractSubject(raw);
    provider = subject ? subject.slice(0, 40) : 'Unknown';
  }

  let location: string | undefined;
  if (type === 'flight') {
    location = extractAirportPair(raw);
  } else if (type === 'hotel') {
    location =
      extractCityAfter(raw, /\bhotel\s*(?:name)?\s*:\s*([^\n\r]{1,120})/i) ??
      extractCityAfter(raw, /\bproperty\s*:\s*([^\n\r]{1,120})/i) ??
      extractCityAfter(raw, /\baddress\s*:\s*([^\n\r]{1,120})/i);
  } else if (type === 'car') {
    location = extractCityAfter(
      raw,
      /\bpickup\s*(?:location)?\s*:\s*([^\n\r]{1,120})/i,
    );
  } else if (type === 'ferry') {
    location = extractCityAfter(raw, /\bport of\s+([^\n\r.,;]{1,100})/i);
  } else if (type === 'train') {
    location = extractCityAfter(raw, /\bstation\s*:\s*([^\n\r]{1,120})/i);
  }

  const startTs = dates[0];
  const endTs = dates.length > 1 ? dates[dates.length - 1] : undefined;

  const notes = extractSubject(raw);

  const result: ParsedBooking = {
    type,
    provider,
    rawMatched,
  };
  if (confirmationCode) result.confirmationCode = confirmationCode;
  if (startTs) result.startTs = startTs;
  if (endTs && endTs !== startTs) result.endTs = endTs;
  if (location) result.location = location;
  if (amount) {
    result.costCents = amount.valueCents;
    result.currency = amount.currency;
  }
  if (notes) result.notes = notes;

  return result;
}
