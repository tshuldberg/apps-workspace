import { describe, it, expect } from 'vitest';
import { checkCompatibility, getCompanions, getAntagonists, searchCompanionPlants, getAllCompanionPlants } from '../engine/companion';
import { matchSymptoms, getAllSymptoms } from '../engine/diagnosis-db';
import { classifyLight, averageLux } from '../engine/light';
import { isValidStageTransition, getNextStages, calculateSuccessRate } from '../engine/propagation';
import { getSeasonalTasksForCategory, inferCategory } from '../engine/seasonal-data';
import { lookupZone, calculateCountdown, getCurrentFrostPhase, getPlantingCalendar } from '../engine/frost';

// ── Companion Engine ────────────────────────────────────────────────────

describe('Companion Engine', () => {
  it('returns companion relationship for known pair', () => {
    const result = checkCompatibility('tomato', 'basil');
    expect(result.relationship).toBe('companion');
    expect(result.benefit).toContain('aphids');
  });

  it('returns antagonist for known pair', () => {
    const result = checkCompatibility('tomato', 'fennel');
    expect(result.relationship).toBe('antagonist');
  });

  it('returns neutral for unknown pair', () => {
    const result = checkCompatibility('tomato', 'pineapple');
    expect(result.relationship).toBe('neutral');
  });

  it('is case-insensitive and order-independent', () => {
    const r1 = checkCompatibility('Basil', 'TOMATO');
    const r2 = checkCompatibility('tomato', 'basil');
    expect(r1.relationship).toBe(r2.relationship);
  });

  it('gets companions for a plant', () => {
    const companions = getCompanions('tomato');
    expect(companions.length).toBeGreaterThan(3);
    expect(companions.every((c) => c.relationship === 'companion')).toBe(true);
  });

  it('gets antagonists for a plant', () => {
    const antagonists = getAntagonists('tomato');
    expect(antagonists.length).toBeGreaterThan(0);
    expect(antagonists.every((c) => c.relationship === 'antagonist')).toBe(true);
  });

  it('searches companion plants', () => {
    const results = searchCompanionPlants('tom');
    expect(results).toContain('tomato');
  });

  it('lists all companion plants', () => {
    const all = getAllCompanionPlants();
    expect(all.length).toBeGreaterThan(20);
    expect(all).not.toContain('most_plants'); // filtered out
  });
});

// ── Diagnosis Engine ────────────────────────────────────────────────────

describe('Diagnosis Engine', () => {
  it('matches symptoms to root rot', () => {
    const results = matchSymptoms(['soft_stems', 'yellowing_leaves', 'foul_smell']);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entry.name).toBe('Root Rot');
    expect(results[0].confidence).toBeGreaterThan(0.5);
  });

  it('matches symptoms to aphids', () => {
    const results = matchSymptoms(['sticky_residue', 'aphids_visible']);
    const aphidResult = results.find((r) => r.entry.name === 'Aphids');
    expect(aphidResult).toBeDefined();
    expect(aphidResult!.confidence).toBeGreaterThan(0.5);
  });

  it('returns empty for no symptoms', () => {
    expect(matchSymptoms([])).toHaveLength(0);
  });

  it('returns sorted by confidence', () => {
    const results = matchSymptoms(['yellowing_leaves', 'stunted_growth']);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].confidence).toBeLessThanOrEqual(results[i - 1].confidence);
    }
  });

  it('lists all known symptoms', () => {
    const symptoms = getAllSymptoms();
    expect(symptoms.length).toBeGreaterThan(10);
    expect(symptoms).toContain('yellowing_leaves');
    expect(symptoms).toContain('sticky_residue');
  });
});

// ── Light Engine ────────────────────────────────────────────────────────

describe('Light Classification', () => {
  it('classifies low light', () => {
    expect(classifyLight(100)).toBe('low');
    expect(classifyLight(499)).toBe('low');
  });

  it('classifies medium light', () => {
    expect(classifyLight(500)).toBe('medium');
    expect(classifyLight(2499)).toBe('medium');
  });

  it('classifies bright indirect', () => {
    expect(classifyLight(2500)).toBe('bright_indirect');
    expect(classifyLight(9999)).toBe('bright_indirect');
  });

  it('classifies direct light', () => {
    expect(classifyLight(10000)).toBe('direct');
    expect(classifyLight(50000)).toBe('direct');
  });

  it('calculates average lux', () => {
    expect(averageLux([1000, 3000, 5000])).toBe(3000);
  });

  it('returns null for empty readings', () => {
    expect(averageLux([])).toBeNull();
  });
});

// ── Propagation Engine ──────────────────────────────────────────────────

describe('Propagation Engine', () => {
  it('validates forward transitions', () => {
    expect(isValidStageTransition('started', 'rooting')).toBe(true);
    expect(isValidStageTransition('started', 'ready')).toBe(true);
    expect(isValidStageTransition('rooting', 'growing')).toBe(true);
  });

  it('rejects backward transitions', () => {
    expect(isValidStageTransition('rooting', 'started')).toBe(false);
    expect(isValidStageTransition('growing', 'callusing')).toBe(false);
  });

  it('allows failed from any active stage', () => {
    expect(isValidStageTransition('started', 'failed')).toBe(true);
    expect(isValidStageTransition('rooting', 'failed')).toBe(true);
    expect(isValidStageTransition('ready', 'failed')).toBe(true);
  });

  it('allows potted from earlier stages via forward skip', () => {
    expect(isValidStageTransition('ready', 'potted')).toBe(true);
    expect(isValidStageTransition('started', 'potted')).toBe(true);
  });

  it('rejects transitions from terminal states', () => {
    expect(isValidStageTransition('potted', 'started')).toBe(false);
    expect(isValidStageTransition('failed', 'started')).toBe(false);
  });

  it('gets next stages', () => {
    expect(getNextStages('started')).toEqual(['callusing', 'rooting', 'growing', 'ready', 'potted']);
    expect(getNextStages('ready')).toEqual(['potted']);
    expect(getNextStages('potted')).toEqual([]);
    expect(getNextStages('failed')).toEqual([]);
  });

  it('calculates success rate', () => {
    expect(calculateSuccessRate(10, 7)).toBe(70);
    expect(calculateSuccessRate(0, 0)).toBe(0);
    expect(calculateSuccessRate(3, 1)).toBeCloseTo(33.3, 0);
  });
});

// ── Seasonal Data Engine ────────────────────────────────────────────────

describe('Seasonal Data', () => {
  it('returns tasks for tropical plants in spring', () => {
    const tasks = getSeasonalTasksForCategory('tropical', 'spring');
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.some((t) => t.taskType === 'increase_watering')).toBe(true);
  });

  it('returns tasks for succulents in winter', () => {
    const tasks = getSeasonalTasksForCategory('succulent', 'winter');
    expect(tasks.some((t) => t.taskType === 'decrease_watering')).toBe(true);
  });

  it('returns empty for unknown category', () => {
    expect(getSeasonalTasksForCategory('alien_plant', 'spring')).toHaveLength(0);
  });

  it('infers plant category from species', () => {
    expect(inferCategory('Cherry Tomato')).toBe('vegetable');
    expect(inferCategory('Sweet Basil')).toBe('herb');
    expect(inferCategory(null)).toBe('tropical'); // default
    expect(inferCategory('Echeveria elegans')).toBe('succulent');
    expect(inferCategory('Rose bush')).toBe('flower');
    expect(inferCategory('Red Oak')).toBe('tree');
  });
});

// ── Frost Engine ────────────────────────────────────────────────────────

describe('Frost Engine', () => {
  it('looks up frost dates for known zone', () => {
    const dates = lookupZone('7a');
    expect(dates).not.toBeNull();
    expect(dates!.avgLastFrost).toBe('04-05');
    expect(dates!.avgFirstFrost).toBe('10-25');
  });

  it('returns null for unknown zone', () => {
    expect(lookupZone('99z')).toBeNull();
  });

  it('calculates countdown to a future date', () => {
    const days = calculateCountdown('06-15', '2026-03-22');
    expect(days).toBeGreaterThan(80);
  });

  it('wraps countdown to next year if date has passed', () => {
    const days = calculateCountdown('01-01', '2026-03-22');
    expect(days).toBeGreaterThan(200); // wraps to 2027-01-01
  });

  it('determines frost phase - growing season', () => {
    const phase = getCurrentFrostPhase('04-01', '10-25', '2026-07-15');
    expect(phase.phase).toBe('growing');
    expect(phase.daysUntilEvent).toBeGreaterThan(90);
  });

  it('determines frost phase - pre season', () => {
    const phase = getCurrentFrostPhase('04-01', '10-25', '2026-02-15');
    expect(phase.phase).toBe('pre_season');
    expect(phase.daysUntilEvent).toBeGreaterThan(0);
  });

  it('determines frost phase - pre frost', () => {
    const phase = getCurrentFrostPhase('04-01', '10-25', '2026-10-10');
    expect(phase.phase).toBe('pre_frost');
    expect(phase.daysUntilEvent).toBeLessThanOrEqual(30);
  });

  it('returns planting calendar data', () => {
    const calendar = getPlantingCalendar();
    expect(calendar.length).toBeGreaterThan(10);
    const tomato = calendar.find((c) => c.crop === 'Tomato');
    expect(tomato).toBeDefined();
    expect(tomato!.indoorStartWeeksBefore).toBe(8);
    expect(tomato!.directSow).toBe(false);
  });
});
