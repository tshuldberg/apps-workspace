// Pure, on-device parser that turns pasted social captions or shared links into a
// draft event candidate. Ported from the SwiftUI EventLinkParser. No scraping, no
// network, no NSDataDetector. Category classification is intentionally NOT done
// here: taxonomy.ts owns category/purpose/price/time facet inference.

export interface ShareEventCandidate {
  title: string;
  startAt?: string;
  venueName?: string;
  sourceUrl?: string;
  rawText: string;
}

const URL_RE = /https?:\/\/[^\s]+/;
const VENUE_RE = /(?:@|\bat )\s*([A-Z][\w'&. ]{2,40})/;
const LINE_URL_RE = /https?:\/\/\S+/g;
const HASHTAG_RE = /#\w+/g;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const ISO_RE = /\b(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?\b/;
const MONTH_NAME_RE =
  /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i;
const NUMERIC_DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/i;

const DEFAULT_HOUR = 20; // 8pm event default when a date is found with no time.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

interface FoundDate {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}

function defaultYear(): number {
  return new Date().getFullYear();
}

function clampHour(h: number): number {
  return h >= 0 && h <= 23 ? h : DEFAULT_HOUR;
}

function findTime(text: string): { hour: number; minute: number } | null {
  const m = TIME_RE.exec(text);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]!.toLowerCase();
  if (hour < 1 || hour > 12 || minute > 59) return null;
  if (meridiem === 'p' && hour !== 12) hour += 12;
  if (meridiem === 'a' && hour === 12) hour = 0;
  return { hour, minute };
}

function findDate(text: string): FoundDate | null {
  const iso = ISO_RE.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const hour = iso[4] != null ? Number(iso[4]) : undefined;
      const minute = iso[5] != null ? Number(iso[5]) : undefined;
      return { year, month, day, hour, minute };
    }
  }

  const named = MONTH_NAME_RE.exec(text);
  if (named) {
    const key = named[1]!.toLowerCase().replace(/\.$/, '');
    const month = MONTHS[key];
    const day = Number(named[2]);
    if (month && day >= 1 && day <= 31) {
      const year = named[3] ? Number(named[3]) : defaultYear();
      return { year, month, day };
    }
  }

  const numeric = NUMERIC_DATE_RE.exec(text);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = defaultYear();
      if (numeric[3]) {
        const raw = Number(numeric[3]);
        year = raw < 100 ? 2000 + raw : raw;
      }
      return { year, month, day };
    }
  }

  return null;
}

function toIsoLocal(d: FoundDate, time: { hour: number; minute: number } | null): string {
  let hour: number;
  let minute: number;
  if (d.hour != null) {
    hour = clampHour(d.hour);
    minute = d.minute ?? 0;
  } else if (time) {
    hour = time.hour;
    minute = time.minute;
  } else {
    hour = DEFAULT_HOUR;
    minute = 0;
  }
  return `${d.year}-${pad2(d.month)}-${pad2(d.day)}T${pad2(hour)}:${pad2(minute)}:00`;
}

function findVenue(text: string): string | undefined {
  const m = VENUE_RE.exec(text);
  if (!m) return undefined;
  const chunk = m[1]!.trim();
  return chunk.length > 0 ? chunk : undefined;
}

function hostOf(url: string): string | undefined {
  const m = /^https?:\/\/([^/\s?#]+)/i.exec(url);
  return m ? m[1] : undefined;
}

function inferTitle(rawText: string, sourceUrl?: string): string {
  const lines = rawText.split(/\r?\n/);
  for (const line of lines) {
    const clean = line.replace(LINE_URL_RE, '').replace(HASHTAG_RE, '').trim();
    if (clean.length >= 3) return clean.slice(0, 60);
  }
  if (sourceUrl) {
    const host = hostOf(sourceUrl);
    if (host) return `Event from ${host}`;
  }
  return 'New event';
}

/**
 * Parse a shared URL and/or pasted text into a best-effort event candidate.
 * Returns null only when there is no usable input. Never sets a category.
 */
export function parseEventFromShared(input: { url?: string; text?: string }): ShareEventCandidate | null {
  const rawText = (input.text ?? input.url ?? '').trim();
  if (rawText.length === 0) return null;

  const urlMatch = URL_RE.exec(rawText);
  const sourceUrl = urlMatch ? urlMatch[0] : input.url;

  const foundDate = findDate(rawText);
  const foundTime = findTime(rawText);
  const startAt = foundDate ? toIsoLocal(foundDate, foundTime) : undefined;

  const venueName = findVenue(rawText);
  const title = inferTitle(rawText, sourceUrl);

  return { title, startAt, venueName, sourceUrl, rawText };
}
