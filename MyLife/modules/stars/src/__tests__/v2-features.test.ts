import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { STARS_MODULE } from '../definition';
import {
  createBirthProfile,
  cacheMoonCalendarDay,
  getMoonCalendarMonth,
  saveCompatibilityResult,
  getCompatibilityResult,
  getRecentCompatibilityResults,
  cacheZodiacEvent,
  getZodiacEvents,
  saveTransitEvent,
  getTransitEventsByProfile,
  createJournalEntry,
  getJournalEntries,
  getJournalEntry,
  searchJournalEntries,
  deleteJournalEntry,
  getJournalEntryCount,
  saveSolarReturn,
  getSolarReturn,
  saveProgressedChart,
  getProgressedChart,
  deleteBirthProfile,
} from '../db/crud';

// Engine imports
import {
  computeMoonCalendarMonth,
  computeIllumination,
  getKeyPhasesForMonth,
  getNextFullMoon,
  getNextNewMoon,
} from '../engine/lunar';
import { computeQuickMatch, canonicalPair } from '../engine/compatibility';
import {
  computeSunIngresses,
  getEventsForRange,
  computeZodiacEvents,
  filterEventsByCategory,
  getEventPersonalImpact,
} from '../engine/zodiac-events';
import { detectTransitsForDate, classifySignificance, filterBySignificance } from '../engine/transits';
import {
  computeRetrogradeStatuses,
  computeRetrogradeBanner,
  getActiveRetrogrades,
  getUpcomingRetrogrades,
  getRetrogradeTips,
  getYearRetrogrades,
  getRetrogradePersonalImpact,
} from '../engine/retrograde';
import { captureAstrologicalContext, isValidMood, validateJournalContent, detectPatterns } from '../engine/journal';
import { getJournalPrompts } from '../engine/interpretations';
import { computeSolarReturn, computeSolarReturnRange } from '../engine/solar-return';
import { computeProgressedChart, computeProgressedDate, computeAgeInYears, forecastMoonSignChange } from '../engine/progressions';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('stars', STARS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── Lunar Cycle Guide ────────────────────────────────────────────────

describe('Lunar Cycle Guide', () => {
  describe('computeMoonCalendarMonth', () => {
    it('produces correct number of entries for any month', () => {
      const march = computeMoonCalendarMonth(2026, 3);
      expect(march).toHaveLength(31);

      const feb = computeMoonCalendarMonth(2026, 2);
      expect(feb).toHaveLength(28);

      const april = computeMoonCalendarMonth(2026, 4);
      expect(april).toHaveLength(30);
    });

    it('each entry has all required fields', () => {
      const days = computeMoonCalendarMonth(2026, 3);
      for (const day of days) {
        expect(day.date).toBeTruthy();
        expect(day.moonPhase).toBeTruthy();
        expect(day.moonSign).toBeTruthy();
        expect(typeof day.illuminationPct).toBe('number');
        expect(typeof day.isKeyPhase).toBe('boolean');
        expect(day.phaseInterpretation).toBeTruthy();
        expect(day.signInterpretation).toBeTruthy();
      }
    });

    it('marks key phases correctly', () => {
      const days = computeMoonCalendarMonth(2026, 3);
      const keyPhases = days.filter((d) => d.isKeyPhase);
      // Should have at least 2 key phases in any month
      expect(keyPhases.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('computeIllumination', () => {
    it('returns 0-100 range', () => {
      for (let i = 0; i < 30; i++) {
        const date = `2026-03-${String(i + 1).padStart(2, '0')}`;
        const illum = computeIllumination(date);
        expect(illum).toBeGreaterThanOrEqual(0);
        expect(illum).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('getKeyPhasesForMonth', () => {
    it('returns only key phase days', () => {
      const keys = getKeyPhasesForMonth(2026, 3);
      for (const day of keys) {
        expect(day.isKeyPhase).toBe(true);
        expect(['new_moon', 'first_quarter', 'full_moon', 'last_quarter']).toContain(day.moonPhase);
      }
    });
  });

  describe('getNextNewMoon / getNextFullMoon', () => {
    it('finds the next new and full moon after a given date', () => {
      const nextNewMoon = getNextNewMoon('2026-03-01');
      const nextFullMoon = getNextFullMoon('2026-03-01');

      expect(nextNewMoon).not.toBeNull();
      expect(nextFullMoon).not.toBeNull();
      expect(nextNewMoon!.date > '2026-03-01').toBe(true);
      expect(nextFullMoon!.date > '2026-03-01').toBe(true);
      expect(nextNewMoon!.moonPhase).toBe('new_moon');
      expect(nextFullMoon!.moonPhase).toBe('full_moon');
    });
  });

  describe('Moon Calendar CRUD', () => {
    it('caches and retrieves moon calendar data', () => {
      const days = computeMoonCalendarMonth(2026, 3);
      for (const day of days) {
        cacheMoonCalendarDay(testDb.adapter, `mc-${day.date}`, day);
      }

      const cached = getMoonCalendarMonth(testDb.adapter, 2026, 3);
      expect(cached).toHaveLength(31);
      expect(cached[0].date).toBe('2026-03-01');
    });
  });
});

// ── Friend Compatibility ─────────────────────────────────────────────

describe('Friend Compatibility', () => {
  describe('computeQuickMatch', () => {
    it('produces a valid analysis', () => {
      const result = computeQuickMatch('p1', 'p2', 'aries', 'leo');
      expect(result.overallScore).toBe(90); // same element
      expect(result.element1).toBe('fire');
      expect(result.element2).toBe('fire');
      expect(result.elementDescription).toBeTruthy();
      expect(result.analysisType).toBe('quick_match');
    });

    it('canonicalizes profile order', () => {
      const result = computeQuickMatch('z-profile', 'a-profile', 'aries', 'leo');
      expect(result.profileAId).toBe('a-profile');
      expect(result.profileBId).toBe('z-profile');
    });
  });

  describe('canonicalPair', () => {
    it('returns smaller id first', () => {
      expect(canonicalPair('b', 'a')).toEqual(['a', 'b']);
      expect(canonicalPair('a', 'b')).toEqual(['a', 'b']);
    });
  });

  describe('Compatibility CRUD', () => {
    beforeEach(() => {
      createBirthProfile(testDb.adapter, 'cp1', { name: 'Alice', birthDate: '1990-01-01', sunSign: 'capricorn' });
      createBirthProfile(testDb.adapter, 'cp2', { name: 'Bob', birthDate: '1992-06-15', sunSign: 'gemini' });
    });

    it('saves and retrieves a compatibility result', () => {
      saveCompatibilityResult(testDb.adapter, 'compat-1', 'cp1', 'cp2', 75, 'Earth + Air: unique blend');
      const result = getCompatibilityResult(testDb.adapter, 'cp1', 'cp2');
      expect(result).not.toBeNull();
      expect(result!.overallScore).toBe(75);
    });

    it('lists recent results', () => {
      saveCompatibilityResult(testDb.adapter, 'compat-2', 'cp1', 'cp2', 80, 'Fire + Air');
      const recent = getRecentCompatibilityResults(testDb.adapter);
      expect(recent).toHaveLength(1);
      expect(recent[0].overallScore).toBe(80);
    });

    it('cascade deletes on profile removal', () => {
      saveCompatibilityResult(testDb.adapter, 'compat-3', 'cp1', 'cp2', 60, 'Test');
      deleteBirthProfile(testDb.adapter, 'cp1');
      const result = getCompatibilityResult(testDb.adapter, 'cp1', 'cp2');
      expect(result).toBeNull();
    });
  });
});

// ── Zodiac Calendar ──────────────────────────────────────────────────

describe('Zodiac Calendar', () => {
  describe('computeSunIngresses', () => {
    it('detects sun sign changes over 90 days', () => {
      const events = computeSunIngresses('2026-01-01', 90);
      // Should find at least 2 sign changes in 90 days
      expect(events.length).toBeGreaterThanOrEqual(2);
      for (const e of events) {
        expect(e.eventType).toBe('sun_ingress');
        expect(e.category).toBe('season');
        expect(e.title).toBeTruthy();
      }
    });

    it('all events have from and to signs', () => {
      const events = computeSunIngresses('2026-01-01', 365);
      for (const e of events) {
        expect(e.fromSign).toBeTruthy();
        expect(e.toSign).toBeTruthy();
        expect(e.fromSign).not.toBe(e.toSign);
      }
    });

    it('produces 12 ingresses over a full year', () => {
      const events = computeSunIngresses('2026-01-01', 365);
      expect(events).toHaveLength(12);
    });
  });

  describe('filterEventsByCategory', () => {
    it('filters season events', () => {
      const events = computeZodiacEvents('2026-03-01');
      const seasons = filterEventsByCategory(events, 'season');
      for (const e of seasons) {
        expect(e.category).toBe('season');
      }
    });
  });

  describe('getEventsForRange', () => {
    it('combines ingresses, lunar events, eclipses, and retrograde stations', () => {
      const events = getEventsForRange('2026-02-15', '2026-03-10');
      expect(events.some((event) => event.eventType === 'eclipse')).toBe(true);
      expect(events.some((event) => event.eventType === 'retrograde_station')).toBe(true);
      expect(events.some((event) => event.eventType === 'new_moon' || event.eventType === 'full_moon')).toBe(true);
    });
  });

  describe('getEventPersonalImpact', () => {
    it('returns a targeted impact when an event matches a natal placement', () => {
      const event = getEventsForRange('2026-02-15', '2026-03-10').find(
        (candidate) => candidate.eventType === 'eclipse' && candidate.toSign != null,
      );

      expect(event).toBeTruthy();

      const impact = getEventPersonalImpact(event!, {
        sunSign: event!.toSign!,
        moonSign: 'pisces',
        risingSign: 'gemini',
      });

      expect(impact.level).toBe('high');
      expect(impact.affectedPlacements).toContain('sun sign');
    });
  });

  describe('Zodiac Events CRUD', () => {
    it('caches and retrieves events', () => {
      const events = computeSunIngresses('2026-01-01', 90);
      for (const e of events) {
        cacheZodiacEvent(testDb.adapter, e);
      }
      const cached = getZodiacEvents(testDb.adapter, '2026-01-01', '2026-12-31');
      expect(cached.length).toBe(events.length);
    });
  });
});

// ── Transit Tracking ─────────────────────────────────────────────────

describe('Transit Tracking', () => {
  describe('classifySignificance', () => {
    it('classifies outer planets as major', () => {
      expect(classifySignificance('saturn')).toBe('major');
      expect(classifySignificance('uranus')).toBe('major');
      expect(classifySignificance('neptune')).toBe('major');
      expect(classifySignificance('pluto')).toBe('major');
    });

    it('classifies inner planets as minor', () => {
      expect(classifySignificance('sun')).toBe('minor');
      expect(classifySignificance('moon')).toBe('minor');
      expect(classifySignificance('mercury')).toBe('minor');
      expect(classifySignificance('venus')).toBe('minor');
      expect(classifySignificance('mars')).toBe('minor');
    });
  });

  describe('detectTransitsForDate', () => {
    it('detects conjunction when signs match', () => {
      const events = detectTransitsForDate(
        'p1',
        [{ body: 'saturn', sign: 'aries' }],
        [{ body: 'sun', sign: 'aries' }],
        '2026-03-08',
      );
      const conjunctions = events.filter((e) => e.aspectType === 'conjunction');
      expect(conjunctions.length).toBeGreaterThanOrEqual(1);
      expect(conjunctions[0].significance).toBe('major');
    });

    it('does not generate transit for same body', () => {
      const events = detectTransitsForDate(
        'p1',
        [{ body: 'mars', sign: 'aries' }],
        [{ body: 'mars', sign: 'aries' }],
        '2026-03-08',
      );
      expect(events).toHaveLength(0);
    });
  });

  describe('filterBySignificance', () => {
    it('filters major only', () => {
      const events = detectTransitsForDate(
        'p1',
        [{ body: 'saturn', sign: 'aries' }, { body: 'venus', sign: 'taurus' }],
        [{ body: 'sun', sign: 'aries' }],
        '2026-03-08',
      );
      const major = filterBySignificance(events, 'major');
      for (const e of major) {
        expect(e.significance).toBe('major');
      }
    });
  });

  describe('Transit Events CRUD', () => {
    beforeEach(() => {
      createBirthProfile(testDb.adapter, 'tp1', { name: 'Transit User', birthDate: '1990-01-01' });
    });

    it('saves and retrieves transit events', () => {
      const events = detectTransitsForDate(
        'tp1',
        [{ body: 'saturn', sign: 'aries' }],
        [{ body: 'sun', sign: 'aries' }],
        '2026-03-08',
      );
      for (const e of events) saveTransitEvent(testDb.adapter, e);

      const cached = getTransitEventsByProfile(testDb.adapter, 'tp1', '2026-01-01', '2026-12-31');
      expect(cached.length).toBe(events.length);
    });

    it('cascade deletes on profile removal', () => {
      saveTransitEvent(testDb.adapter, {
        id: 'te-1', profileId: 'tp1', transitingBody: 'saturn', natalBody: 'sun',
        aspectType: 'conjunction', significance: 'major', currentOrb: 2,
        exactDate: '2026-03-08', isApplying: true, interpretationBrief: 'Test',
      });
      deleteBirthProfile(testDb.adapter, 'tp1');
      const cached = getTransitEventsByProfile(testDb.adapter, 'tp1', '2026-01-01', '2026-12-31');
      expect(cached).toHaveLength(0);
    });
  });
});

// ── Retrograde Tracker ───────────────────────────────────────────────

describe('Retrograde Tracker', () => {
  describe('computeRetrogradeStatuses', () => {
    it('returns status for all 8 planets', () => {
      const statuses = computeRetrogradeStatuses('2026-03-10');
      expect(statuses).toHaveLength(8);
      const bodies = statuses.map((s) => s.body);
      expect(bodies).toContain('mercury');
      expect(bodies).toContain('venus');
      expect(bodies).toContain('pluto');
    });

    it('detects Mercury retrograde during known period', () => {
      // Mercury Rx: 2026-02-25 to 2026-03-18
      const statuses = computeRetrogradeStatuses('2026-03-10');
      const mercury = statuses.find((s) => s.body === 'mercury');
      expect(mercury!.isRetrograde).toBe(true);
      expect(mercury!.retrogradeSign).toBe('pisces');
      expect(mercury!.progress).toBeGreaterThan(0);
      expect(mercury!.daysUntilStart).toBe(0);
    });

    it('detects Mercury direct outside retrograde period', () => {
      const statuses = computeRetrogradeStatuses('2026-04-15');
      const mercury = statuses.find((s) => s.body === 'mercury');
      expect(mercury!.isRetrograde).toBe(false);
    });
  });

  describe('computeRetrogradeBanner', () => {
    it('shows amber banner during Mercury Rx', () => {
      const statuses = computeRetrogradeStatuses('2026-03-10');
      const banner = computeRetrogradeBanner(statuses);
      expect(banner.color).toBe('amber');
      expect(banner.text).toContain('Mercury Retrograde');
    });

    it('shows green banner when no inner planets retrograde', () => {
      const statuses = computeRetrogradeStatuses('2026-04-15');
      const banner = computeRetrogradeBanner(statuses);
      expect(banner.color).toBe('green');
      expect(banner.text).toContain('All Clear');
    });
  });

  describe('getActiveRetrogrades / getUpcomingRetrogrades', () => {
    it('separates active from upcoming', () => {
      const statuses = computeRetrogradeStatuses('2026-03-10');
      const active = getActiveRetrogrades(statuses);
      const upcoming = getUpcomingRetrogrades(statuses);

      for (const s of active) expect(s.isRetrograde).toBe(true);
      for (const s of upcoming) expect(s.isRetrograde).toBe(false);
    });
  });

  describe('getRetrogradeTips', () => {
    it('returns tips for all planets', () => {
      const planets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
      for (const p of planets) {
        const tips = getRetrogradeTips(p);
        expect(tips.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('getYearRetrogrades', () => {
    it('returns retrograde windows that overlap the requested year', () => {
      const periods = getYearRetrogrades(2026);
      expect(periods.some((period) => period.body === 'mercury')).toBe(true);
      expect(periods.some((period) => period.body === 'jupiter')).toBe(true);
    });
  });

  describe('getRetrogradePersonalImpact', () => {
    it('builds placement and house guidance for active retrogrades', () => {
      const impacts = getRetrogradePersonalImpact(
        computeRetrogradeStatuses('2026-03-10'),
        {
          sunSign: 'pisces',
          moonSign: 'virgo',
          risingSign: 'sagittarius',
        },
      );

      const mercuryImpact = impacts.find((impact) => impact.body === 'mercury');
      expect(mercuryImpact).toBeTruthy();
      expect(mercuryImpact!.level).toBe('high');
      expect(mercuryImpact!.summary).toContain('Mercury retrograde');
      expect(mercuryImpact!.houseNumber).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Astrology Journal ────────────────────────────────────────────────

describe('Astrology Journal', () => {
  describe('captureAstrologicalContext', () => {
    it('captures context for a date', () => {
      const ctx = captureAstrologicalContext('2026-03-10');
      expect(ctx.date).toBe('2026-03-10');
      expect(ctx.moonPhase).toBeTruthy();
      expect(ctx.moonSign).toBeTruthy();
      expect(ctx.sunSign).toBe('pisces');
      expect(Array.isArray(ctx.retrogradePlanets)).toBe(true);
    });

    it('includes tarot card by default', () => {
      const ctx = captureAstrologicalContext('2026-03-10');
      expect(ctx.tarotCardName).toBeTruthy();
    });

    it('excludes tarot when disabled', () => {
      const ctx = captureAstrologicalContext('2026-03-10', [], false);
      expect(ctx.tarotCardName).toBeNull();
    });
  });

  describe('isValidMood', () => {
    it('accepts valid moods', () => {
      expect(isValidMood('inspired')).toBe(true);
      expect(isValidMood('calm')).toBe(true);
      expect(isValidMood('anxious')).toBe(true);
    });

    it('rejects invalid moods', () => {
      expect(isValidMood('happy')).toBe(false);
      expect(isValidMood('')).toBe(false);
    });
  });

  describe('validateJournalContent', () => {
    it('rejects empty content', () => {
      expect(validateJournalContent('').valid).toBe(false);
      expect(validateJournalContent('   ').valid).toBe(false);
    });

    it('accepts valid content', () => {
      expect(validateJournalContent('Today was meaningful.').valid).toBe(true);
    });

    it('rejects content over 5000 chars', () => {
      const long = 'x'.repeat(5001);
      expect(validateJournalContent(long).valid).toBe(false);
    });
  });

  describe('detectPatterns', () => {
    it('returns empty for fewer than 30 entries', () => {
      const entries = Array.from({ length: 20 }, () => ({
        mood: 'calm',
        moonPhase: 'full_moon',
        moonSign: 'aries',
        retrogradePlanets: null,
      }));
      expect(detectPatterns(entries)).toEqual([]);
    });
  });

  describe('getJournalPrompts', () => {
    it('builds a focused prompt set from the active sky', () => {
      const prompts = getJournalPrompts({
        moonPhase: 'full_moon',
        moonSign: 'virgo',
        sunSign: 'pisces',
        retrogradePlanets: ['mercury'],
        tarotCardName: 'The Hermit',
        transits: [
          {
            transitingBody: 'saturn',
            natalBody: 'moon',
            aspectType: 'opposition',
            interpretationBrief: 'Saturn highlights your emotional boundaries.',
            significance: 'major',
          },
        ],
      });

      expect(prompts.length).toBeGreaterThanOrEqual(4);
      expect(prompts[0]).toContain('Full Moon');
      expect(prompts.join(' ')).toContain('Saturn');
      expect(prompts.join(' ')).toMatch(/Mercury|The Hermit/);
    });
  });

  describe('Journal CRUD', () => {
    it('creates and retrieves journal entries', () => {
      const entry = createJournalEntry(testDb.adapter, 'je-1', {
        date: '2026-03-10',
        title: 'Cosmic Check-In',
        content: 'Feeling the cosmic energy today.',
        intention: 'gratitude',
        mood: 'inspired',
        moonPhase: 'waxing_crescent',
        moonSign: 'aries',
        sunSign: 'pisces',
        photoUris: ['file:///entry-1.png'],
      });
      expect(entry.id).toBe('je-1');
      expect(entry.title).toBe('Cosmic Check-In');
      expect(entry.content).toBe('Feeling the cosmic energy today.');
      expect(entry.intention).toBe('gratitude');
      expect(entry.photoUris).toEqual(['file:///entry-1.png']);

      const fetched = getJournalEntry(testDb.adapter, 'je-1');
      expect(fetched).not.toBeNull();
      expect(fetched!.mood).toBe('inspired');
      expect(fetched!.title).toBe('Cosmic Check-In');
      expect(fetched!.photoUris).toEqual(['file:///entry-1.png']);
    });

    it('lists entries by date descending', () => {
      createJournalEntry(testDb.adapter, 'je-2', {
        date: '2026-03-08', content: 'First', moonPhase: 'new_moon', moonSign: 'pisces', sunSign: 'pisces',
      });
      createJournalEntry(testDb.adapter, 'je-3', {
        date: '2026-03-10', content: 'Second', moonPhase: 'waxing_crescent', moonSign: 'aries', sunSign: 'pisces',
      });
      const entries = getJournalEntries(testDb.adapter);
      expect(entries).toHaveLength(2);
      expect(entries[0].date).toBe('2026-03-10');
    });

    it('searches entries by content', () => {
      createJournalEntry(testDb.adapter, 'je-4', {
        date: '2026-03-10', content: 'Mercury retrograde is wild', moonPhase: 'full_moon', moonSign: 'virgo', sunSign: 'pisces',
      });
      createJournalEntry(testDb.adapter, 'je-5', {
        date: '2026-03-11', title: 'Peace Log', content: 'Calm and peaceful', moonPhase: 'full_moon', moonSign: 'virgo', sunSign: 'pisces',
      });
      const results = searchJournalEntries(testDb.adapter, 'retrograde');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('je-4');
      expect(searchJournalEntries(testDb.adapter, 'Peace')[0].id).toBe('je-5');
    });

    it('deletes entries', () => {
      createJournalEntry(testDb.adapter, 'je-6', {
        date: '2026-03-10', content: 'Deletable', moonPhase: 'new_moon', moonSign: 'aries', sunSign: 'pisces',
      });
      deleteJournalEntry(testDb.adapter, 'je-6');
      expect(getJournalEntry(testDb.adapter, 'je-6')).toBeNull();
    });

    it('counts entries', () => {
      createJournalEntry(testDb.adapter, 'je-7', {
        date: '2026-03-10', content: 'One', moonPhase: 'new_moon', moonSign: 'aries', sunSign: 'pisces',
      });
      createJournalEntry(testDb.adapter, 'je-8', {
        date: '2026-03-11', content: 'Two', moonPhase: 'new_moon', moonSign: 'aries', sunSign: 'pisces',
      });
      expect(getJournalEntryCount(testDb.adapter)).toBe(2);
    });

    it('profile deletion sets profile_id to null', () => {
      createBirthProfile(testDb.adapter, 'jp1', { name: 'Journal Owner', birthDate: '1990-01-01' });
      createJournalEntry(testDb.adapter, 'je-9', {
        profileId: 'jp1',
        date: '2026-03-10', content: 'With profile', moonPhase: 'new_moon', moonSign: 'aries', sunSign: 'pisces',
      });
      deleteBirthProfile(testDb.adapter, 'jp1');
      const entry = getJournalEntry(testDb.adapter, 'je-9');
      expect(entry).not.toBeNull();
      expect(entry!.profileId).toBeNull();
    });
  });
});

// ── Solar Return Chart ───────────────────────────────────────────────

describe('Solar Return Chart', () => {
  describe('computeSolarReturn', () => {
    it('computes solar return for a given year', () => {
      const result = computeSolarReturn('p1', '1995-03-21', 2026);
      expect(result.returnYear).toBe(2026);
      expect(result.returnDate).toBe('2026-03-21');
      expect(result.sunSign).toBe('aries');
      expect(result.yearTheme).toBeTruthy();
    });

    it('throws for year outside range', () => {
      expect(() => computeSolarReturn('p1', '1995-03-21', 1800)).toThrow();
      expect(() => computeSolarReturn('p1', '1995-03-21', 2200)).toThrow();
    });

    it('handles leap year birthdays', () => {
      const result = computeSolarReturn('p1', '2000-02-29', 2026);
      // Feb has 28 days in 2026, so should use Feb 28
      expect(result.returnDate).toBe('2026-02-28');
    });
  });

  describe('computeSolarReturnRange', () => {
    it('produces correct range of results', () => {
      const results = computeSolarReturnRange('p1', '1995-03-21', 2026, 2, 1);
      expect(results).toHaveLength(4); // 2024, 2025, 2026, 2027
      expect(results[0].returnYear).toBe(2024);
      expect(results[3].returnYear).toBe(2027);
    });
  });

  describe('Solar Return CRUD', () => {
    beforeEach(() => {
      createBirthProfile(testDb.adapter, 'sr1', { name: 'Solar User', birthDate: '1995-03-21', sunSign: 'aries' });
    });

    it('saves and retrieves solar return', () => {
      const result = computeSolarReturn('sr1', '1995-03-21', 2026);
      saveSolarReturn(testDb.adapter, 'sr-2026', result);
      const cached = getSolarReturn(testDb.adapter, 'sr1', 2026);
      expect(cached).not.toBeNull();
      expect(cached!.returnYear).toBe(2026);
      expect(cached!.sunSign).toBe('aries');
    });

    it('cascade deletes on profile removal', () => {
      const result = computeSolarReturn('sr1', '1995-03-21', 2026);
      saveSolarReturn(testDb.adapter, 'sr-2026-b', result);
      deleteBirthProfile(testDb.adapter, 'sr1');
      expect(getSolarReturn(testDb.adapter, 'sr1', 2026)).toBeNull();
    });
  });
});

// ── Progressed Chart ─────────────────────────────────────────────────

describe('Progressed Chart', () => {
  describe('computeProgressedDate', () => {
    it('computes progressed date for age 30', () => {
      // 30 years old = 30 days after birth in progressions
      const result = computeProgressedDate('1996-01-01', '2026-01-01');
      // ~30 years = 30 days after birth
      const d = new Date(result + 'T00:00:00Z');
      const birth = new Date('1996-01-01T00:00:00Z');
      const diffDays = Math.round((d.getTime() - birth.getTime()) / 86400000);
      expect(diffDays).toBe(30); // 30 years -> 30 days
    });
  });

  describe('computeAgeInYears', () => {
    it('computes age correctly', () => {
      const age = computeAgeInYears('1996-01-01', '2026-01-01');
      expect(age).toBeCloseTo(30, 0);
    });
  });

  describe('forecastMoonSignChange', () => {
    it('forecasts sign change from mid-sign', () => {
      const result = forecastMoonSignChange('aries', 15);
      expect(result.yearsToChange).toBeGreaterThan(0);
      expect(result.nextSign).toBe('taurus');
    });

    it('handles end-of-sign position', () => {
      const result = forecastMoonSignChange('aries', 28);
      expect(result.yearsToChange).toBeLessThan(1);
    });

    it('wraps from pisces to aries', () => {
      const result = forecastMoonSignChange('pisces', 15);
      expect(result.nextSign).toBe('aries');
    });
  });

  describe('computeProgressedChart', () => {
    it('computes full progressed chart', () => {
      const result = computeProgressedChart('p1', '1996-01-01', '2026-03-10');
      expect(result.profileId).toBe('p1');
      expect(result.currentAgeYears).toBeGreaterThan(29);
      expect(result.moonSign).toBeTruthy();
      expect(result.sunSign).toBeTruthy();
      expect(result.moonInterpretation).toBeTruthy();
      expect(result.moonNextSignChangeYears).toBeGreaterThanOrEqual(0);
      expect(result.moonNextSign).toBeTruthy();
    });
  });

  describe('Progressed Chart CRUD', () => {
    beforeEach(() => {
      createBirthProfile(testDb.adapter, 'pg1', { name: 'Prog User', birthDate: '1996-01-01' });
    });

    it('saves and retrieves progressed chart', () => {
      const result = computeProgressedChart('pg1', '1996-01-01', '2026-03-10');
      saveProgressedChart(testDb.adapter, 'pc-1', result);
      const cached = getProgressedChart(testDb.adapter, 'pg1');
      expect(cached).not.toBeNull();
      expect(cached!.profileId).toBe('pg1');
      expect(cached!.moonSign).toBeTruthy();
    });

    it('enforces one-to-one via UNIQUE constraint (replaces on update)', () => {
      const result1 = computeProgressedChart('pg1', '1996-01-01', '2026-03-10');
      saveProgressedChart(testDb.adapter, 'pc-2', result1);
      const result2 = computeProgressedChart('pg1', '1996-01-01', '2026-06-15');
      saveProgressedChart(testDb.adapter, 'pc-3', result2);
      // Only one record should exist for the profile
      const cached = getProgressedChart(testDb.adapter, 'pg1');
      expect(cached).not.toBeNull();
    });

    it('cascade deletes on profile removal', () => {
      const result = computeProgressedChart('pg1', '1996-01-01', '2026-03-10');
      saveProgressedChart(testDb.adapter, 'pc-4', result);
      deleteBirthProfile(testDb.adapter, 'pg1');
      expect(getProgressedChart(testDb.adapter, 'pg1')).toBeNull();
    });
  });
});
