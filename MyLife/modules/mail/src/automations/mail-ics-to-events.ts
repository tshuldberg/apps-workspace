/**
 * mail-ics-to-events — Phase 5-core rule.
 *
 * When the mail module receives a message with an .ics attachment, this
 * rule parses the first VEVENT and offers to create a hub_events row so
 * the event shows up on the hub-wide Today surface and future calendar
 * views. Provenance is tracked via entity_ref = sourceMessageId.
 *
 * Parser is hand-rolled (no new npm deps). It handles RFC 5545 line
 * unfolding, KEY[;PARAMS]:VALUE property lines, text-value escape sequences,
 * and the three DATE/DATE-TIME shapes we see in practice
 * (20260420T170000Z, 20260420T170000, 20260420). Anything malformed causes
 * check() to return null. Loud failures are reserved for apply() SQL errors.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type { AutomationRule } from '@mylife/automations';
import { logAutomationEvent } from '@mylife/automations';

/** UUID v4-shaped id generator (matches shared/_generate-id pattern). */
function generateId(): string {
  const hex = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        hex[Math.floor(Math.random() * 16)],
      ).join(''),
    )
    .join('-');
}

export interface MailIcsInput {
  icsText: string;
  sourceMessageId: string;
}

export interface MailIcsPreviewState {
  title: string;
  startsAt: string; // ISO 8601
  endsAt: string; // ISO 8601
  location: string | null;
  description: string | null;
  sourceMessageId: string;
}

export interface MailIcsResult {
  eventId: string;
  auditEntryId: string;
}

// Parser helpers --------------------------------------------------------

interface VEventProps {
  summary?: string;
  dtstart?: { value: string; params: Record<string, string> };
  dtend?: { value: string; params: Record<string, string> };
  location?: string;
  description?: string;
}

function unescapeIcsText(v: string): string {
  return v.replace(/\\(.)/g, (_, ch) => {
    if (ch === 'n' || ch === 'N') return '\n';
    return ch; // handles \\, \,, \;
  });
}

function unfoldLines(icsText: string): string[] {
  const raw = icsText.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseProperty(
  line: string,
): { name: string; params: Record<string, string>; value: string } | null {
  const colonIdx = line.indexOf(':');
  if (colonIdx < 0) return null;
  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const parts = head.split(';');
  const name = parts[0]!.toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i]!.indexOf('=');
    if (eq > 0) {
      params[parts[i]!.slice(0, eq).toUpperCase()] = parts[i]!.slice(eq + 1);
    }
  }
  return { name, params, value };
}

/**
 * Parse the first VEVENT block out of an ICS string.
 * Returns null if no well-formed VEVENT block is found.
 *
 * Exported for direct parser unit tests.
 */
export function parseFirstVEvent(icsText: string): VEventProps | null {
  if (!icsText || typeof icsText !== 'string') return null;
  const lines = unfoldLines(icsText);

  let inEvent = false;
  const props: VEventProps = {};
  for (const line of lines) {
    if (!inEvent) {
      if (line.toUpperCase().trim() === 'BEGIN:VEVENT') inEvent = true;
      continue;
    }
    if (line.toUpperCase().trim() === 'END:VEVENT') {
      return props;
    }
    const parsed = parseProperty(line);
    if (!parsed) continue;
    switch (parsed.name) {
      case 'SUMMARY':
        props.summary = unescapeIcsText(parsed.value);
        break;
      case 'DTSTART':
        props.dtstart = { value: parsed.value.trim(), params: parsed.params };
        break;
      case 'DTEND':
        props.dtend = { value: parsed.value.trim(), params: parsed.params };
        break;
      case 'LOCATION':
        props.location = unescapeIcsText(parsed.value);
        break;
      case 'DESCRIPTION':
        props.description = unescapeIcsText(parsed.value);
        break;
    }
  }
  return null;
}

/**
 * Convert a VEVENT DTSTART/DTEND value (with optional params) to ISO 8601.
 * Returns null on malformed input.
 */
function icsDateToIso(
  value: string,
  params: Record<string, string>,
): string | null {
  const v = value.trim();
  const isDate = params['VALUE'] === 'DATE' || /^\d{8}$/.test(v);
  if (isDate) {
    if (!/^\d{8}$/.test(v)) return null;
    const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}T00:00:00.000Z`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }
  const m = /^(\d{8})T(\d{6})(Z?)$/.exec(v);
  if (!m) return null;
  const [, d, t] = m;
  const iso = `${d!.slice(0, 4)}-${d!.slice(4, 6)}-${d!.slice(6, 8)}T${t!.slice(0, 2)}:${t!.slice(2, 4)}:${t!.slice(4, 6)}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function addOneHourIso(iso: string): string {
  const ms = Date.parse(iso);
  return new Date(ms + 60 * 60 * 1000).toISOString();
}

function truncateTitle(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function formatStart(iso: string): string {
  try {
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${mi} UTC`;
  } catch {
    return iso;
  }
}

// Rule ------------------------------------------------------------------

export const mailIcsToEventsRule: AutomationRule<
  MailIcsInput,
  MailIcsPreviewState,
  MailIcsResult
> = {
  id: 'mail-ics-to-events',
  label: 'Add ICS calendar invites to your hub events',
  description:
    'When an email contains a .ics calendar attachment, offer to create a hub event so it shows up on Today and future calendar surfaces.',
  clusters: ['mail', 'calendar'],

  check(_db, input) {
    if (!input || typeof input !== 'object') return null;
    if (!input.icsText || typeof input.icsText !== 'string') return null;
    if (!input.sourceMessageId || typeof input.sourceMessageId !== 'string') {
      return null;
    }

    const ev = parseFirstVEvent(input.icsText);
    if (!ev) return null;
    if (!ev.summary || ev.summary.trim().length === 0) return null;
    if (!ev.dtstart) return null;

    const startsAt = icsDateToIso(ev.dtstart.value, ev.dtstart.params);
    if (!startsAt) return null;

    let endsAt: string;
    if (ev.dtend) {
      const parsed = icsDateToIso(ev.dtend.value, ev.dtend.params);
      if (!parsed) return null;
      endsAt = parsed;
    } else {
      endsAt = addOneHourIso(startsAt);
    }

    return {
      title: ev.summary,
      startsAt,
      endsAt,
      location: ev.location ?? null,
      description: ev.description ?? null,
      sourceMessageId: input.sourceMessageId,
    };
  },

  previewCard(state) {
    const truncatedTitle = truncateTitle(state.title, 60);
    return {
      title: `Add event: ${truncatedTitle}?`,
      subtitle: `${formatStart(state.startsAt)} · ${state.location ?? 'No location'}`,
      cta: { apply: 'Add event', dismiss: 'Skip' },
    };
  },

  apply(db, state) {
    const adapter = db as DatabaseAdapter;
    let result: MailIcsResult | null = null;

    adapter.transaction(() => {
      const eventId = generateId();
      adapter.execute(
        `INSERT INTO hub_events (id, title, starts_at, ends_at, kind, module_id, entity_ref, place_id, rrule)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          state.title,
          state.startsAt,
          state.endsAt,
          'appointment',
          'mail',
          state.sourceMessageId,
          null,
          null,
        ],
      );

      const audit = logAutomationEvent(adapter, {
        ruleId: 'mail-ics-to-events',
        outcome: 'applied',
      });

      result = { eventId, auditEntryId: audit.id };
    });

    if (!result) {
      throw new Error(
        'mail-ics-to-events apply failed: transaction rolled back',
      );
    }
    return result;
  },
};
