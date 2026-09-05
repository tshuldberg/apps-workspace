import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { STARS_MODULE } from '../definition';
import {
  createBirthProfile,
  getBirthProfile,
  getBirthProfiles,
  updateBirthProfile,
  deleteBirthProfile,
  createTransit,
  getTransitsByProfile,
  getTransitsByDate,
  createDailyReading,
  getDailyReading,
  getDailyReadings,
  saveDailyReading,
  saveTarotReading,
  getTarotReading,
  getTarotReadings,
  updateTarotReadingNotes,
  deleteReading,
  createSavedChart,
  getSavedChartsByProfile,
  getStarsStats,
} from '../db/crud';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('stars', STARS_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

describe('Birth Profiles', () => {
  it('creates a birth profile with required fields', () => {
    const profile = createBirthProfile(testDb.adapter, 'p1', {
      name: 'Maya',
      birthDate: '1997-06-15',
    });
    expect(profile.id).toBe('p1');
    expect(profile.name).toBe('Maya');
    expect(profile.birthDate).toBe('1997-06-15');
    expect(profile.birthTime).toBeNull();
    expect(profile.sunSign).toBeNull();
    expect(profile.createdAt).toBeTruthy();
  });

  it('creates a profile with all optional fields', () => {
    const profile = createBirthProfile(testDb.adapter, 'p2', {
      name: 'Alex',
      birthDate: '1990-12-25',
      birthTime: '14:30',
      birthLat: 40.7128,
      birthLng: -74.006,
      birthPlace: 'New York, NY',
      sunSign: 'capricorn',
      moonSign: 'scorpio',
      risingSign: 'virgo',
    });
    expect(profile.birthTime).toBe('14:30');
    expect(profile.birthLat).toBe(40.7128);
    expect(profile.sunSign).toBe('capricorn');
    expect(profile.moonSign).toBe('scorpio');
    expect(profile.risingSign).toBe('virgo');
  });

  it('rejects profile with empty name', () => {
    expect(() =>
      createBirthProfile(testDb.adapter, 'bad', { name: '', birthDate: '2000-01-01' }),
    ).toThrow();
  });

  it('gets a profile by id', () => {
    createBirthProfile(testDb.adapter, 'p3', { name: 'Test', birthDate: '2000-01-01' });
    const found = getBirthProfile(testDb.adapter, 'p3');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Test');

    const notFound = getBirthProfile(testDb.adapter, 'nope');
    expect(notFound).toBeNull();
  });

  it('lists all profiles ordered by created_at DESC', () => {
    createBirthProfile(testDb.adapter, 'p4', { name: 'First', birthDate: '2000-01-01' });
    createBirthProfile(testDb.adapter, 'p5', { name: 'Second', birthDate: '2000-06-15' });
    createBirthProfile(testDb.adapter, 'p6', { name: 'Third', birthDate: '2000-12-31' });

    // Force distinct timestamps so ORDER BY created_at DESC is deterministic
    testDb.adapter.execute(`UPDATE st_birth_profiles SET created_at = '2024-01-01T00:00:00' WHERE id = 'p4'`);
    testDb.adapter.execute(`UPDATE st_birth_profiles SET created_at = '2024-01-02T00:00:00' WHERE id = 'p5'`);
    testDb.adapter.execute(`UPDATE st_birth_profiles SET created_at = '2024-01-03T00:00:00' WHERE id = 'p6'`);

    const profiles = getBirthProfiles(testDb.adapter);
    expect(profiles).toHaveLength(3);
    // Most recently created should be first
    expect(profiles[0].name).toBe('Third');
  });

  it('updates a profile', () => {
    createBirthProfile(testDb.adapter, 'p7', {
      name: 'Old Name',
      birthDate: '1995-03-21',
      sunSign: 'aries',
    });

    const updated = updateBirthProfile(testDb.adapter, 'p7', {
      name: 'New Name',
      moonSign: 'pisces',
    });

    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('New Name');
    expect(updated!.moonSign).toBe('pisces');
    expect(updated!.sunSign).toBe('aries'); // unchanged
  });

  it('returns null when updating non-existent profile', () => {
    const result = updateBirthProfile(testDb.adapter, 'nope', { name: 'X' });
    expect(result).toBeNull();
  });

  it('returns existing profile when update has no changes', () => {
    createBirthProfile(testDb.adapter, 'p8', { name: 'Static', birthDate: '2000-01-01' });
    const result = updateBirthProfile(testDb.adapter, 'p8', {});
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Static');
  });

  it('deletes a profile', () => {
    createBirthProfile(testDb.adapter, 'p9', { name: 'Temp', birthDate: '2000-01-01' });
    expect(getBirthProfile(testDb.adapter, 'p9')).not.toBeNull();

    deleteBirthProfile(testDb.adapter, 'p9');
    expect(getBirthProfile(testDb.adapter, 'p9')).toBeNull();
  });

  it('cascades delete to transits', () => {
    createBirthProfile(testDb.adapter, 'p10', { name: 'Cascade', birthDate: '2000-01-01' });
    createTransit(testDb.adapter, 't1', {
      profileId: 'p10',
      date: '2026-03-08',
      planet: 'Mars',
      sign: 'aries',
    });

    expect(getTransitsByProfile(testDb.adapter, 'p10')).toHaveLength(1);
    deleteBirthProfile(testDb.adapter, 'p10');
    expect(getTransitsByProfile(testDb.adapter, 'p10')).toHaveLength(0);
  });
});

describe('Transits', () => {
  beforeEach(() => {
    createBirthProfile(testDb.adapter, 'tp1', { name: 'Transit User', birthDate: '1990-01-01' });
  });

  it('creates a transit', () => {
    const transit = createTransit(testDb.adapter, 't2', {
      profileId: 'tp1',
      date: '2026-03-08',
      planet: 'Venus',
      sign: 'taurus',
      aspect: 'trine',
      description: 'Harmonious energy',
    });
    expect(transit.planet).toBe('Venus');
    expect(transit.sign).toBe('taurus');
    expect(transit.aspect).toBe('trine');
  });

  it('gets transits by profile', () => {
    createTransit(testDb.adapter, 't3', {
      profileId: 'tp1',
      date: '2026-03-07',
      planet: 'Mars',
      sign: 'aries',
    });
    createTransit(testDb.adapter, 't4', {
      profileId: 'tp1',
      date: '2026-03-08',
      planet: 'Venus',
      sign: 'taurus',
    });

    const transits = getTransitsByProfile(testDb.adapter, 'tp1');
    expect(transits).toHaveLength(2);
    // Ordered by date DESC
    expect(transits[0].date).toBe('2026-03-08');
  });

  it('gets transits by date', () => {
    createTransit(testDb.adapter, 't5', {
      profileId: 'tp1',
      date: '2026-03-08',
      planet: 'Mars',
      sign: 'aries',
    });
    createTransit(testDb.adapter, 't6', {
      profileId: 'tp1',
      date: '2026-03-08',
      planet: 'Venus',
      sign: 'taurus',
    });
    createTransit(testDb.adapter, 't7', {
      profileId: 'tp1',
      date: '2026-03-09',
      planet: 'Jupiter',
      sign: 'gemini',
    });

    const march8 = getTransitsByDate(testDb.adapter, '2026-03-08');
    expect(march8).toHaveLength(2);
    // Ordered by planet ASC
    expect(march8[0].planet).toBe('Mars');
    expect(march8[1].planet).toBe('Venus');
  });
});

describe('Daily Readings', () => {
  beforeEach(() => {
    createBirthProfile(testDb.adapter, 'dr1', { name: 'Reader', birthDate: '1995-05-21' });
  });

  it('creates a daily reading', () => {
    const reading = createDailyReading(testDb.adapter, 'r1', {
      profileId: 'dr1',
      date: '2026-03-08',
      moonPhase: 'full_moon',
      moonSign: 'virgo',
      summary: 'A day of clarity and completion.',
      tarotCard: 'The Star',
    });
    expect(reading.moonPhase).toBe('full_moon');
    expect(reading.moonSign).toBe('virgo');
    expect(reading.tarotCard).toBe('The Star');
  });

  it('gets a daily reading by profile and date', () => {
    createDailyReading(testDb.adapter, 'r2', {
      profileId: 'dr1',
      date: '2026-03-08',
      moonPhase: 'waxing_crescent',
    });

    const found = getDailyReading(testDb.adapter, 'dr1', '2026-03-08');
    expect(found).not.toBeNull();
    expect(found!.moonPhase).toBe('waxing_crescent');

    const notFound = getDailyReading(testDb.adapter, 'dr1', '2026-03-09');
    expect(notFound).toBeNull();
  });

  it('enforces unique profile+date constraint', () => {
    createDailyReading(testDb.adapter, 'r3', {
      profileId: 'dr1',
      date: '2026-03-08',
      moonPhase: 'new_moon',
    });

    expect(() =>
      createDailyReading(testDb.adapter, 'r4', {
        profileId: 'dr1',
        date: '2026-03-08',
        moonPhase: 'full_moon',
      }),
    ).toThrow();
  });

  it('upserts a daily reading with tarot metadata', () => {
    saveDailyReading(testDb.adapter, 'r5', {
      profileId: 'dr1',
      date: '2026-03-08',
      moonPhase: 'full_moon',
      tarotCard: 'The Star',
      tarotCardId: 'major-star',
      tarotIsReversed: false,
      journalPrompt: 'What restores my faith?',
    });

    saveDailyReading(testDb.adapter, 'r6', {
      profileId: 'dr1',
      date: '2026-03-08',
      moonPhase: 'full_moon',
      tarotCard: 'The Moon',
      tarotCardId: 'major-moon',
      tarotIsReversed: true,
      journalPrompt: 'What is still hidden?',
    });

    const reading = getDailyReading(testDb.adapter, 'dr1', '2026-03-08');
    const history = getDailyReadings(testDb.adapter, 'dr1');

    expect(reading).not.toBeNull();
    expect(reading!.tarotCardId).toBe('major-moon');
    expect(reading!.tarotIsReversed).toBe(true);
    expect(reading!.journalPrompt).toBe('What is still hidden?');
    expect(history).toHaveLength(1);
  });
});

describe('Tarot Readings', () => {
  beforeEach(() => {
    createBirthProfile(testDb.adapter, 'tr1', { name: 'Tarot User', birthDate: '1991-04-19' });
  });

  it('saves and retrieves a tarot spread reading', () => {
    saveTarotReading(testDb.adapter, 'tarot-1', {
      profileId: 'tr1',
      readingDate: '2026-03-08',
      spreadType: 'three_card',
      title: 'Past Present Future',
      question: 'What is unfolding?',
      narrative: 'A bridge between endings and beginnings.',
      cards: [
        {
          cardId: 'major-star',
          cardName: 'The Star',
          positionLabel: 'Past',
          positionMeaning: 'What brought you here.',
          reversed: false,
          interpretation: 'Hope carried you into this season.',
        },
        {
          cardId: 'major-moon',
          cardName: 'The Moon',
          positionLabel: 'Present',
          positionMeaning: 'What is active now.',
          reversed: true,
          interpretation: 'Uncertainty is lifting.',
        },
        {
          cardId: 'major-sun',
          cardName: 'The Sun',
          positionLabel: 'Future',
          positionMeaning: 'What is coming next.',
          reversed: false,
          interpretation: 'Clarity is approaching.',
        },
      ],
    });

    const reading = getTarotReading(testDb.adapter, 'tarot-1');
    const archive = getTarotReadings(testDb.adapter, 'tr1');

    expect(reading).not.toBeNull();
    expect(reading!.cards).toHaveLength(3);
    expect(reading!.cards[1].reversed).toBe(true);
    expect(archive).toHaveLength(1);
    expect(archive[0].spreadType).toBe('three_card');
  });

  it('updates tarot notes and deletes through the shared helper', () => {
    saveTarotReading(testDb.adapter, 'tarot-2', {
      profileId: 'tr1',
      readingDate: '2026-03-09',
      spreadType: 'one_card',
      title: 'Single pull',
      question: null,
      narrative: null,
      cards: [
        {
          cardId: 'major-fool',
          cardName: 'The Fool',
          positionLabel: 'Insight',
          positionMeaning: 'The central message.',
          reversed: false,
          interpretation: 'Trust the leap.',
        },
      ],
    });

    const updated = updateTarotReadingNotes(testDb.adapter, 'tarot-2', 'Journal follow-up');
    expect(updated?.notes).toBe('Journal follow-up');

    deleteReading(testDb.adapter, 'tarot', 'tarot-2');
    expect(getTarotReading(testDb.adapter, 'tarot-2')).toBeNull();
  });
});

describe('Saved Charts', () => {
  beforeEach(() => {
    createBirthProfile(testDb.adapter, 'sc1', { name: 'Chart User', birthDate: '1990-01-01' });
  });

  it('creates and retrieves a saved chart', () => {
    const chart = createSavedChart(
      testDb.adapter,
      'c1',
      'sc1',
      'natal',
      'My Natal Chart',
      '{"planets":[]}',
    );
    expect(chart.chartType).toBe('natal');
    expect(chart.title).toBe('My Natal Chart');

    const charts = getSavedChartsByProfile(testDb.adapter, 'sc1');
    expect(charts).toHaveLength(1);
    expect(charts[0].data).toBe('{"planets":[]}');
  });
});

describe('Stats', () => {
  it('returns zero counts for empty database', () => {
    const stats = getStarsStats(testDb.adapter);
    expect(stats.totalProfiles).toBe(0);
    expect(stats.totalTransits).toBe(0);
    expect(stats.totalReadings).toBe(0);
    expect(stats.totalSavedCharts).toBe(0);
    expect(stats.currentMoonPhase).toBeNull();
  });

  it('returns correct counts with data', () => {
    createBirthProfile(testDb.adapter, 's1', { name: 'A', birthDate: '2000-01-01' });
    createBirthProfile(testDb.adapter, 's2', { name: 'B', birthDate: '2000-06-15' });
    createTransit(testDb.adapter, 'st1', {
      profileId: 's1',
      date: '2026-03-08',
      planet: 'Mars',
      sign: 'aries',
    });
    createDailyReading(testDb.adapter, 'sr1', {
      profileId: 's1',
      date: '2026-03-08',
      moonPhase: 'waxing_gibbous',
    });
    saveTarotReading(testDb.adapter, 'str1', {
      profileId: 's1',
      readingDate: '2026-03-08',
      spreadType: 'one_card',
      title: 'Single pull',
      cards: [
        {
          cardId: 'major-sun',
          cardName: 'The Sun',
          positionLabel: 'Insight',
          positionMeaning: 'The central message.',
          reversed: false,
          interpretation: 'Joy arrives.',
        },
      ],
    });
    createSavedChart(testDb.adapter, 'sc1', 's1', 'natal', 'Test', '{}');

    const stats = getStarsStats(testDb.adapter);
    expect(stats.totalProfiles).toBe(2);
    expect(stats.totalTransits).toBe(1);
    expect(stats.totalReadings).toBe(2);
    expect(stats.totalSavedCharts).toBe(1);
    expect(stats.currentMoonPhase).toBe('waxing_gibbous');
  });
});
