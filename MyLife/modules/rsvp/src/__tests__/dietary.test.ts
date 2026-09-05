import { describe, expect, it } from 'vitest';
import {
  DIETARY_OPTIONS,
  aggregateDietaryResponses,
  parseDietaryAnswer,
  formatDietaryAnswer,
} from '../engines/dietary';

describe('dietary engine', () => {
  describe('DIETARY_OPTIONS', () => {
    it('has exactly 9 entries', () => {
      expect(DIETARY_OPTIONS).toHaveLength(9);
    });

    it('each option has valid id, label, and category', () => {
      const validCategories = new Set(['diet', 'allergy', 'religious', 'custom']);
      for (const opt of DIETARY_OPTIONS) {
        expect(opt.id).toBeTruthy();
        expect(opt.label).toBeTruthy();
        expect(validCategories.has(opt.category)).toBe(true);
      }
    });

    it('has unique IDs', () => {
      const ids = DIETARY_OPTIONS.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('parseDietaryAnswer', () => {
    it('parses valid JSON correctly', () => {
      const result = parseDietaryAnswer('{"selections":["vegetarian","nut_allergy"],"other":"No cilantro"}');
      expect(result.selections).toEqual(['vegetarian', 'nut_allergy']);
      expect(result.other).toBe('No cilantro');
    });

    it('returns empty for null input', () => {
      const result = parseDietaryAnswer(null);
      expect(result.selections).toEqual([]);
      expect(result.other).toBeNull();
    });

    it('returns empty for undefined input', () => {
      const result = parseDietaryAnswer(undefined);
      expect(result.selections).toEqual([]);
      expect(result.other).toBeNull();
    });

    it('returns empty for invalid JSON', () => {
      const result = parseDietaryAnswer('not json');
      expect(result.selections).toEqual([]);
      expect(result.other).toBeNull();
    });

    it('handles missing selections field', () => {
      const result = parseDietaryAnswer('{"other":"just a note"}');
      expect(result.selections).toEqual([]);
      expect(result.other).toBe('just a note');
    });

    it('handles empty other string', () => {
      const result = parseDietaryAnswer('{"selections":["vegan"],"other":""}');
      expect(result.other).toBeNull();
    });
  });

  describe('formatDietaryAnswer', () => {
    it('formats answer to JSON', () => {
      const json = formatDietaryAnswer({ selections: ['vegan'], other: 'Note' });
      const parsed = JSON.parse(json);
      expect(parsed.selections).toEqual(['vegan']);
      expect(parsed.other).toBe('Note');
    });
  });

  describe('aggregateDietaryResponses', () => {
    it('3 guests select vegetarian -> { vegetarian: 3 }', () => {
      const responses = [
        { guestName: 'Alice', answerJson: '{"selections":["vegetarian"],"other":null}', rsvpResponse: 'going' },
        { guestName: 'Bob', answerJson: '{"selections":["vegetarian"],"other":null}', rsvpResponse: 'going' },
        { guestName: 'Carol', answerJson: '{"selections":["vegetarian"],"other":null}', rsvpResponse: 'maybe' },
      ];
      const summary = aggregateDietaryResponses(responses, 5);
      expect(summary.counts.vegetarian).toBe(3);
      expect(summary.totalRespondents).toBe(3);
      expect(summary.totalGuests).toBe(5);
    });

    it('1 guest selects vegetarian + nut_allergy -> both counted', () => {
      const responses = [
        { guestName: 'Alice', answerJson: '{"selections":["vegetarian","nut_allergy"],"other":null}', rsvpResponse: 'going' },
      ];
      const summary = aggregateDietaryResponses(responses, 1);
      expect(summary.counts.vegetarian).toBe(1);
      expect(summary.counts.nut_allergy).toBe(1);
    });

    it('guest enters "Other" text -> other_entries includes entry with name', () => {
      const responses = [
        { guestName: 'Dave', answerJson: '{"selections":[],"other":"No cilantro please"}', rsvpResponse: 'going' },
      ];
      const summary = aggregateDietaryResponses(responses, 1);
      expect(summary.otherEntries).toHaveLength(1);
      expect(summary.otherEntries[0].guestName).toBe('Dave');
      expect(summary.otherEntries[0].text).toBe('No cilantro please');
    });

    it('guest skips dietary -> not counted in any option', () => {
      const responses = [
        { guestName: 'Eve', answerJson: '{"selections":[],"other":null}', rsvpResponse: 'going' },
      ];
      const summary = aggregateDietaryResponses(responses, 1);
      expect(summary.totalRespondents).toBe(0);
      expect(Object.values(summary.counts).every((c) => c === 0)).toBe(true);
    });

    it('excludes Declined RSVP responses', () => {
      const responses = [
        { guestName: 'Alice', answerJson: '{"selections":["kosher"],"other":null}', rsvpResponse: 'going' },
        { guestName: 'Bob', answerJson: '{"selections":["halal"],"other":null}', rsvpResponse: 'declined' },
      ];
      const summary = aggregateDietaryResponses(responses, 2);
      expect(summary.counts.kosher).toBe(1);
      expect(summary.counts.halal).toBe(0);
      expect(summary.totalRespondents).toBe(1);
    });

    it('empty selections + "Other" text -> only other counted', () => {
      const responses = [
        { guestName: 'Frank', answerJson: '{"selections":[],"other":"Soy allergy"}', rsvpResponse: 'going' },
      ];
      const summary = aggregateDietaryResponses(responses, 1);
      expect(summary.totalRespondents).toBe(1);
      expect(summary.otherEntries).toHaveLength(1);
      expect(Object.values(summary.counts).every((c) => c === 0)).toBe(true);
    });

    it('no responses -> empty counts, respondents: 0', () => {
      const summary = aggregateDietaryResponses([], 5);
      expect(summary.totalRespondents).toBe(0);
      expect(summary.totalGuests).toBe(5);
      expect(summary.otherEntries).toHaveLength(0);
    });

    it('guest updates from vegan to gluten_free -> only latest counts', () => {
      // This tests that only the latest response is in the array (CRUD handles dedup)
      const responses = [
        { guestName: 'Alice', answerJson: '{"selections":["gluten_free"],"other":null}', rsvpResponse: 'going' },
      ];
      const summary = aggregateDietaryResponses(responses, 1);
      expect(summary.counts.vegan).toBe(0);
      expect(summary.counts.gluten_free).toBe(1);
    });
  });
});
