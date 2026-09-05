import { describe, it, expect } from 'vitest';
import { parseEventFromShared, type ShareEventCandidate } from '../url-parser';

const YEAR = new Date().getFullYear();

describe('parseEventFromShared empty input', () => {
  it('returns null for an empty object', () => {
    expect(parseEventFromShared({})).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(parseEventFromShared({ text: '', url: '' })).toBeNull();
  });

  it('returns null for whitespace-only text', () => {
    expect(parseEventFromShared({ text: '   \n\t  ' })).toBeNull();
  });
});

describe('parseEventFromShared url handling', () => {
  it('builds a title from the host for a pure URL', () => {
    const result = parseEventFromShared({ url: 'https://dice.fm/event/abc123' });
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Event from dice.fm');
    expect(result!.sourceUrl).toBe('https://dice.fm/event/abc123');
  });

  it('extracts the first URL from text', () => {
    const result = parseEventFromShared({
      text: 'Check it https://first.com/x and also https://second.com/y',
    });
    expect(result!.sourceUrl).toBe('https://first.com/x');
  });

  it('falls back to input.url when text has no URL', () => {
    const result = parseEventFromShared({ text: 'Jazz Night', url: 'https://venue.io/show' });
    expect(result!.sourceUrl).toBe('https://venue.io/show');
  });
});

describe('parseEventFromShared date extraction', () => {
  it('bumps a date with no time to 8pm', () => {
    const result = parseEventFromShared({ text: 'Big Show on 2026-07-04' });
    expect(result!.startAt).toBe('2026-07-04T20:00:00');
  });

  it('preserves an ISO date with explicit time', () => {
    const result = parseEventFromShared({ text: 'Set at 2026-07-04T19:30' });
    expect(result!.startAt).toBe('2026-07-04T19:30:00');
  });

  it('combines a separate date and time', () => {
    const result = parseEventFromShared({ text: 'Jazz on 2026-08-12, doors 9pm' });
    expect(result!.startAt).toBe('2026-08-12T21:00:00');
  });

  it('parses a Month DD, YYYY date', () => {
    const result = parseEventFromShared({ text: 'Live show July 4, 2026' });
    expect(result!.startAt).toBe('2026-07-04T20:00:00');
  });

  it('parses an abbreviated Mon DD date with the current year', () => {
    const result = parseEventFromShared({ text: 'Brunch Aug 12' });
    expect(result!.startAt).toBe(`${YEAR}-08-12T20:00:00`);
  });

  it('parses an M/D/YYYY date', () => {
    const result = parseEventFromShared({ text: 'Party 7/4/2026' });
    expect(result!.startAt).toBe('2026-07-04T20:00:00');
  });

  it('parses an M/D date with the current year', () => {
    const result = parseEventFromShared({ text: 'Party 7/4' });
    expect(result!.startAt).toBe(`${YEAR}-07-04T20:00:00`);
  });

  it('parses a 2-digit year as 20xx', () => {
    const result = parseEventFromShared({ text: 'Party 7/4/26' });
    expect(result!.startAt).toBe('2026-07-04T20:00:00');
  });

  it('combines a Month name date with a standalone time', () => {
    const result = parseEventFromShared({ text: 'Concert July 4 at 8:30 pm' });
    expect(result!.startAt).toBe(`${YEAR}-07-04T20:30:00`);
  });

  it('ignores a standalone time when there is no date', () => {
    const result = parseEventFromShared({ text: 'Doors open 9pm tonight' });
    expect(result!.startAt).toBeUndefined();
  });

  it('handles 12am and 12pm correctly when combined with a date', () => {
    const noon = parseEventFromShared({ text: 'Lunch 8/1 at 12pm' });
    expect(noon!.startAt).toBe(`${YEAR}-08-01T12:00:00`);
    const midnight = parseEventFromShared({ text: 'Late 8/1 at 12am' });
    expect(midnight!.startAt).toBe(`${YEAR}-08-01T00:00:00`);
  });

  it('leaves startAt undefined when no date is present', () => {
    const result = parseEventFromShared({ text: 'Some cool happening downtown' });
    expect(result!.startAt).toBeUndefined();
  });
});

describe('parseEventFromShared venue extraction', () => {
  it('extracts a venue after @', () => {
    const result = parseEventFromShared({ text: 'Jazz Night @ Blue Note' });
    expect(result!.venueName).toBe('Blue Note');
  });

  it('extracts a venue after "at"', () => {
    const result = parseEventFromShared({ text: 'Punk show at CBGB' });
    expect(result!.venueName).toBe('CBGB');
  });

  it("allows apostrophes, ampersands, and periods in a venue name", () => {
    const result = parseEventFromShared({ text: "Pints @ O'Reilly's Pub & Grill" });
    expect(result!.venueName).toBe("O'Reilly's Pub & Grill");
  });

  it('rejects a venue capture that is too short', () => {
    const result = parseEventFromShared({ text: 'Meet @ X' });
    expect(result!.venueName).toBeUndefined();
  });

  it('returns the first venue match only', () => {
    // The capture class greedily consumes trailing words (matching the Swift
    // regex), so the first "@" anchor wins and the second venue is never reached.
    const result = parseEventFromShared({ text: 'Pregame @ Blue Note\nthen @ Red Room' });
    expect(result!.venueName).toBe('Blue Note');
  });

  it('leaves venueName undefined when no pattern matches', () => {
    const result = parseEventFromShared({ text: 'Cool event happening soon' });
    expect(result!.venueName).toBeUndefined();
  });
});

describe('parseEventFromShared title extraction', () => {
  it('uses the first non-empty cleaned line', () => {
    const result = parseEventFromShared({
      text: '\n\nSunset Rooftop Party\nMore details below\nhttps://x.com/a',
    });
    expect(result!.title).toBe('Sunset Rooftop Party');
  });

  it('strips URLs and hashtags from the title line', () => {
    const result = parseEventFromShared({
      text: 'Block Party https://x.com/a #nyc #summer',
    });
    expect(result!.title).toBe('Block Party');
  });

  it('truncates a long title to 60 characters', () => {
    const long = 'A'.repeat(120);
    const result = parseEventFromShared({ text: long });
    expect(result!.title).toBe('A'.repeat(60));
    expect(result!.title.length).toBe(60);
  });

  it('skips lines shorter than 3 characters', () => {
    const result = parseEventFromShared({ text: 'hi\nThe Real Title' });
    expect(result!.title).toBe('The Real Title');
  });

  it('falls back to the host when no usable line and a URL exists', () => {
    const result = parseEventFromShared({ text: 'https://eventbrite.com/e/123' });
    expect(result!.title).toBe('Event from eventbrite.com');
  });

  it('falls back to "New event" when there is no line and no host', () => {
    // A line that becomes empty after stripping hashtags, with no URL.
    const result = parseEventFromShared({ text: '#a #b' });
    expect(result!.title).toBe('New event');
  });
});

describe('parseEventFromShared shape', () => {
  it('never sets a category and echoes rawText trimmed', () => {
    const text = '  Jazz Jam\n@ Blue Note\n2026-07-04\nhttps://x.com/a  ';
    const result = parseEventFromShared({ text });
    const expected: ShareEventCandidate = {
      title: 'Jazz Jam',
      startAt: '2026-07-04T20:00:00',
      venueName: 'Blue Note',
      sourceUrl: 'https://x.com/a',
      rawText: 'Jazz Jam\n@ Blue Note\n2026-07-04\nhttps://x.com/a',
    };
    expect(result).toEqual(expected);
    expect('category' in (result as object)).toBe(false);
  });
});
