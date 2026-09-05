/**
 * Integration tests for mail-ics-to-events automation rule.
 *
 * Covers:
 *   - ICS parser edge cases (missing fields, malformed DTSTART, multi-VEVENT)
 *   - apply() atomicity: hub_events + hub_automation_log insert in one txn,
 *     rollback if either write fails.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { MAIL_MODULE } from '../../definition';
import {
  mailIcsToEventsRule,
  parseFirstVEvent,
  type MailIcsInput,
} from '../mail-ics-to-events';

function ics(
  parts: Partial<{
    summary: string;
    dtstart: string;
    dtend: string;
    location: string;
    description: string;
  }>,
  extra: string = '',
): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT'];
  if (parts.summary !== undefined) lines.push(`SUMMARY:${parts.summary}`);
  if (parts.dtstart !== undefined) lines.push(`DTSTART:${parts.dtstart}`);
  if (parts.dtend !== undefined) lines.push(`DTEND:${parts.dtend}`);
  if (parts.location !== undefined) lines.push(`LOCATION:${parts.location}`);
  if (parts.description !== undefined) {
    lines.push(`DESCRIPTION:${parts.description}`);
  }
  if (extra) lines.push(extra);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

function makeInput(overrides: Partial<MailIcsInput> = {}): MailIcsInput {
  return {
    icsText: ics({
      summary: 'Team sync',
      dtstart: '20260420T170000Z',
      dtend: '20260420T180000Z',
      location: 'Zoom',
    }),
    sourceMessageId: 'msg-123',
    ...overrides,
  };
}

describe('mailIcsToEventsRule', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('mail', MAIL_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  // ---------------------------------------------------------------------
  // check()
  // ---------------------------------------------------------------------

  describe('check()', () => {
    it('returns preview state for a valid single-event ICS', () => {
      const state = mailIcsToEventsRule.check(adapter, makeInput());
      expect(state).not.toBeNull();
      expect(state?.title).toBe('Team sync');
      expect(state?.startsAt).toBe('2026-04-20T17:00:00.000Z');
      expect(state?.endsAt).toBe('2026-04-20T18:00:00.000Z');
      expect(state?.location).toBe('Zoom');
      expect(state?.sourceMessageId).toBe('msg-123');
    });

    it('returns null when SUMMARY is missing', () => {
      const bad = makeInput({
        icsText: ics({ dtstart: '20260420T170000Z' }),
      });
      expect(mailIcsToEventsRule.check(adapter, bad)).toBeNull();
    });

    it('returns null when DTSTART is malformed', () => {
      const bad = makeInput({
        icsText: ics({ summary: 'Hi', dtstart: 'not-a-date' }),
      });
      expect(mailIcsToEventsRule.check(adapter, bad)).toBeNull();
    });

    it('parses only the first VEVENT when multiple are present', () => {
      const multi = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:First',
        'DTSTART:20260420T170000Z',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:Second',
        'DTSTART:20260421T170000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const state = mailIcsToEventsRule.check(adapter, {
        icsText: multi,
        sourceMessageId: 'msg-multi',
      });
      expect(state?.title).toBe('First');
      expect(state?.startsAt).toBe('2026-04-20T17:00:00.000Z');
    });

    it('defaults endsAt to startsAt + 1h when DTEND is absent', () => {
      const noEnd = makeInput({
        icsText: ics({
          summary: 'Quick call',
          dtstart: '20260420T170000Z',
        }),
      });
      const state = mailIcsToEventsRule.check(adapter, noEnd);
      expect(state?.startsAt).toBe('2026-04-20T17:00:00.000Z');
      expect(state?.endsAt).toBe('2026-04-20T18:00:00.000Z');
    });

    it('handles all-day DTSTART;VALUE=DATE', () => {
      const allDay = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:Birthday',
        'DTSTART;VALUE=DATE:20260420',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const state = mailIcsToEventsRule.check(adapter, {
        icsText: allDay,
        sourceMessageId: 'msg-allday',
      });
      expect(state?.startsAt).toBe('2026-04-20T00:00:00.000Z');
      // DTEND absent → startsAt + 1h
      expect(state?.endsAt).toBe('2026-04-20T01:00:00.000Z');
    });
  });

  // ---------------------------------------------------------------------
  // previewCard()
  // ---------------------------------------------------------------------

  describe('previewCard()', () => {
    it('formats title and subtitle, uses "No location" fallback', () => {
      const card = mailIcsToEventsRule.previewCard({
        title: 'Team sync',
        startsAt: '2026-04-20T17:00:00.000Z',
        endsAt: '2026-04-20T18:00:00.000Z',
        location: null,
        description: null,
        sourceMessageId: 'msg-1',
      });
      expect(card.title).toBe('Add event: Team sync?');
      expect(card.subtitle).toContain('No location');
    });

    it('truncates title at 60 chars', () => {
      const longTitle = 'A'.repeat(80);
      const card = mailIcsToEventsRule.previewCard({
        title: longTitle,
        startsAt: '2026-04-20T17:00:00.000Z',
        endsAt: '2026-04-20T18:00:00.000Z',
        location: 'Zoom',
        description: null,
        sourceMessageId: 'msg-1',
      });
      // 60 chars including ellipsis
      const titlePart = card.title.replace('Add event: ', '').replace('?', '');
      expect(titlePart.length).toBe(60);
      expect(titlePart.endsWith('…')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------
  // apply()
  // ---------------------------------------------------------------------

  describe('apply()', () => {
    it('creates hub_events row + hub_automation_log entry atomically', () => {
      const state = mailIcsToEventsRule.check(adapter, makeInput())!;
      const result = mailIcsToEventsRule.apply(adapter, state);

      const events = adapter.query<{
        id: string;
        title: string;
        starts_at: string;
        ends_at: string;
        kind: string;
        module_id: string;
        entity_ref: string;
        place_id: string | null;
        rrule: string | null;
      }>(`SELECT * FROM hub_events WHERE id = ?`, [result.eventId]);
      expect(events).toHaveLength(1);
      expect(events[0]!.title).toBe('Team sync');
      expect(events[0]!.starts_at).toBe('2026-04-20T17:00:00.000Z');
      expect(events[0]!.ends_at).toBe('2026-04-20T18:00:00.000Z');
      expect(events[0]!.kind).toBe('appointment');
      expect(events[0]!.module_id).toBe('mail');
      expect(events[0]!.entity_ref).toBe('msg-123');
      expect(events[0]!.place_id).toBeNull();
      expect(events[0]!.rrule).toBeNull();

      const logs = adapter.query<{
        id: string;
        rule_id: string;
        outcome: string;
      }>(`SELECT id, rule_id, outcome FROM hub_automation_log WHERE id = ?`, [
        result.auditEntryId,
      ]);
      expect(logs).toHaveLength(1);
      expect(logs[0]!.rule_id).toBe('mail-ics-to-events');
      expect(logs[0]!.outcome).toBe('applied');
    });

    it('rolls back the event insert when the audit write fails', () => {
      const state = mailIcsToEventsRule.check(adapter, makeInput())!;

      // Drop the audit table mid-flight; the INSERT into hub_events
      // should be rolled back when logAutomationEvent throws.
      adapter.execute('DROP TABLE hub_automation_log');

      expect(() => mailIcsToEventsRule.apply(adapter, state)).toThrow();

      const eventCount = adapter.query<{ c: number }>(
        `SELECT COUNT(*) as c FROM hub_events WHERE entity_ref = ?`,
        ['msg-123'],
      )[0]!.c;
      expect(eventCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------
  // parseFirstVEvent() — unit-level parser tests
  // ---------------------------------------------------------------------

  describe('parseFirstVEvent()', () => {
    it('returns null when no VEVENT block exists', () => {
      const noEvent = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'END:VCALENDAR'].join(
        '\r\n',
      );
      expect(parseFirstVEvent(noEvent)).toBeNull();
    });

    it('unfolds continuation lines (RFC 5545 line folding)', () => {
      // Per RFC 5545 §3.1, the leading SPACE/TAB after a CRLF is literal
      // padding and is stripped; the join is direct concatenation.
      const folded = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:First part ',
        ' and second part',
        'DTSTART:20260420T170000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const ev = parseFirstVEvent(folded);
      expect(ev?.summary).toBe('First part and second part');
    });

    it('unescapes text values (\\n, \\,, \\;, \\\\)', () => {
      const escaped = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'SUMMARY:Hello\\, world',
        'DESCRIPTION:Line1\\nLine2\\;still line2',
        'DTSTART:20260420T170000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const ev = parseFirstVEvent(escaped);
      expect(ev?.summary).toBe('Hello, world');
      expect(ev?.description).toBe('Line1\nLine2;still line2');
    });
  });
});
