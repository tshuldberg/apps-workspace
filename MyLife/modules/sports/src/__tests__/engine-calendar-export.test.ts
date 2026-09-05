import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GAME_DURATION_MS,
  buildSportsCalendar,
  gameToIcsEvent,
  leagueEventToIcsEvent,
  renderIcs,
} from '../engine/calendar-export';
import type { IcsEventInput } from '../engine/calendar-export';
import type { LeagueEvent } from '../engine/calendar';
import type { Game } from '../types';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function makeGame(partial: Partial<Game> = {}): Game {
  return {
    id: 'espn:nfl:401547417',
    league: 'nfl',
    sport: 'football',
    home: { id: 'espn:nfl:1', name: 'Jets', abbreviation: 'NYJ', score: null },
    away: { id: 'espn:nfl:2', name: 'Patriots', abbreviation: 'NE', score: null },
    status: 'scheduled',
    period: null,
    clock: null,
    startAt: Date.UTC(2026, 8, 14, 20, 15, 0),
    venue: 'MetLife Stadium',
    broadcast: 'NBC',
    updatedAt: 0,
    ...partial,
  };
}

function makeLeagueEvent(partial: Partial<LeagueEvent> = {}): LeagueEvent {
  return {
    leagueId: 'nfl',
    eventType: 'draft',
    label: 'NFL Draft',
    startMs: Date.UTC(2026, 3, 24, 20, 30, 0),
    ...partial,
  };
}

describe('renderIcs', () => {
  it('produces VCALENDAR with VERSION and PRODID', () => {
    const ics = renderIcs([]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('PRODID:-//MyLife//MySports//EN\r\n');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('uses CRLF line endings', () => {
    const ics = renderIcs([]);
    // No bare LF that is not preceded by CR.
    expect(/(?<!\r)\n/.test(ics)).toBe(false);
  });

  it('emits UID, DTSTAMP, DTSTART, DTEND, SUMMARY per VEVENT', () => {
    const ics = renderIcs([
      {
        uid: 'sports-game-abc@mylife',
        summary: 'Away @ Home',
        startMs: Date.UTC(2026, 0, 1, 12, 0, 0),
        endMs: Date.UTC(2026, 0, 1, 15, 0, 0),
      },
    ]);
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('END:VEVENT\r\n');
    expect(ics).toContain('UID:sports-game-abc@mylife\r\n');
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z\r\n/);
    expect(ics).toContain('DTSTART:20260101T120000Z\r\n');
    expect(ics).toContain('DTEND:20260101T150000Z\r\n');
    expect(ics).toContain('SUMMARY:Away @ Home\r\n');
  });

  it('escapes commas, semicolons, backslashes, and newlines in SUMMARY', () => {
    const ics = renderIcs([
      {
        uid: 'uid-1@mylife',
        summary: 'a, b; c\\ d\nnew',
        startMs: 0,
        endMs: MS_PER_HOUR,
      },
    ]);
    expect(ics).toContain('SUMMARY:a\\, b\\; c\\\\ d\\nnew\r\n');
  });

  it('escapes special characters in DESCRIPTION and LOCATION', () => {
    const ics = renderIcs([
      {
        uid: 'uid-2@mylife',
        summary: 'ok',
        description: 'hello; world, path\\file\nline2',
        location: 'A, B; C',
        startMs: 0,
        endMs: MS_PER_HOUR,
      },
    ]);
    expect(ics).toContain('DESCRIPTION:hello\\; world\\, path\\\\file\\nline2\r\n');
    expect(ics).toContain('LOCATION:A\\, B\\; C\r\n');
  });

  it('folds long SUMMARY lines at 75 octets with CRLF + space continuation', () => {
    const longSummary = 'x'.repeat(200);
    const ics = renderIcs([
      {
        uid: 'uid-fold@mylife',
        summary: longSummary,
        startMs: 0,
        endMs: MS_PER_HOUR,
      },
    ]);
    // Every physical line must be <= 75 octets.
    const physical = ics.split('\r\n');
    for (const line of physical) {
      const bytes = new TextEncoder().encode(line).length;
      expect(bytes).toBeLessThanOrEqual(75);
    }
    // Continuation lines after the first must start with a single space.
    const summaryIdx = physical.findIndex((l) => l.startsWith('SUMMARY:'));
    expect(summaryIdx).toBeGreaterThanOrEqual(0);
    const nextLine = physical[summaryIdx + 1];
    expect(nextLine).toBeDefined();
    expect(nextLine?.startsWith(' ')).toBe(true);
  });

  it('produces a DTSTAMP that is stable across re-renders (no Date.now)', () => {
    const event: IcsEventInput = {
      uid: 'stable-uid@mylife',
      summary: 'x',
      startMs: 0,
      endMs: MS_PER_HOUR,
    };
    const a = renderIcs([event]);
    const b = renderIcs([event]);
    expect(a).toBe(b);
  });

  it('yields distinct DTSTAMP values for distinct uids', () => {
    const base: Omit<IcsEventInput, 'uid'> = {
      summary: 'x',
      startMs: 0,
      endMs: MS_PER_HOUR,
    };
    const a = renderIcs([{ uid: 'uid-a@mylife', ...base }]);
    const b = renderIcs([{ uid: 'uid-b@mylife', ...base }]);
    const stampA = a.match(/DTSTAMP:(\d{8}T\d{6}Z)/)?.[1];
    const stampB = b.match(/DTSTAMP:(\d{8}T\d{6}Z)/)?.[1];
    expect(stampA).toBeDefined();
    expect(stampB).toBeDefined();
    expect(stampA).not.toBe(stampB);
  });
});

describe('gameToIcsEvent', () => {
  it('applies defaultDurationMs when game has no explicit end', () => {
    const game = makeGame();
    const evt = gameToIcsEvent(game);
    expect(evt.endMs - evt.startMs).toBe(DEFAULT_GAME_DURATION_MS);
  });

  it('honors caller-supplied duration override', () => {
    const game = makeGame();
    const evt = gameToIcsEvent(game, 90 * 60 * 1000);
    expect(evt.endMs - evt.startMs).toBe(90 * 60 * 1000);
  });

  it('renders summary as "Away @ Home"', () => {
    const game = makeGame();
    const evt = gameToIcsEvent(game);
    expect(evt.summary).toBe('Patriots @ Jets');
  });

  it('carries the venue as location when present', () => {
    const evt = gameToIcsEvent(makeGame({ venue: 'Gillette Stadium' }));
    expect(evt.location).toBe('Gillette Stadium');
  });

  it('omits location when venue is null', () => {
    const evt = gameToIcsEvent(makeGame({ venue: null }));
    expect(evt.location).toBeUndefined();
  });

  it('produces a stable uid from game.id', () => {
    const evt = gameToIcsEvent(makeGame({ id: 'espn:nfl:xyz' }));
    expect(evt.uid).toBe('sports-game-espn:nfl:xyz@mylife');
  });
});

describe('leagueEventToIcsEvent', () => {
  it('normalizes start to 00:00 UTC of the day', () => {
    const evt = leagueEventToIcsEvent(
      makeLeagueEvent({ startMs: Date.UTC(2026, 3, 24, 20, 30, 0) }),
    );
    expect(evt.startMs).toBe(Date.UTC(2026, 3, 24, 0, 0, 0));
  });

  it('produces an exactly 24h UTC window', () => {
    const evt = leagueEventToIcsEvent(makeLeagueEvent());
    expect(evt.endMs - evt.startMs).toBe(MS_PER_DAY);
  });

  it('derives uid from league, event type, and normalized day', () => {
    const evt = leagueEventToIcsEvent(makeLeagueEvent({ startMs: Date.UTC(2026, 3, 24, 20, 30, 0) }));
    const expectedDay = Date.UTC(2026, 3, 24, 0, 0, 0);
    expect(evt.uid).toBe(`sports-event-nfl-draft-${expectedDay}@mylife`);
  });

  it('passes notes through as description when present', () => {
    const evt = leagueEventToIcsEvent(makeLeagueEvent({ notes: 'round 1 only' }));
    expect(evt.description).toBe('round 1 only');
  });
});

describe('buildSportsCalendar', () => {
  it('composes games and league events into one VCALENDAR', () => {
    const ics = buildSportsCalendar({
      games: [makeGame()],
      leagueEvents: [makeLeagueEvent()],
    });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    const vevents = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(vevents.length).toBe(2);
    expect(ics).toContain('UID:sports-game-espn:nfl:401547417@mylife\r\n');
    expect(ics).toContain('UID:sports-event-nfl-draft-');
  });

  it('produces a byte-stable output for identical input (no Date.now)', () => {
    const input = {
      games: [makeGame()],
      leagueEvents: [makeLeagueEvent()],
    } as const;
    expect(buildSportsCalendar(input)).toBe(buildSportsCalendar(input));
  });

  it('uses the caller-supplied defaultGameDurationMs', () => {
    const ics = buildSportsCalendar({
      games: [makeGame({ startAt: Date.UTC(2026, 0, 1, 12, 0, 0) })],
      leagueEvents: [],
      defaultGameDurationMs: 2 * MS_PER_HOUR,
    });
    expect(ics).toContain('DTSTART:20260101T120000Z\r\n');
    expect(ics).toContain('DTEND:20260101T140000Z\r\n');
  });
});
