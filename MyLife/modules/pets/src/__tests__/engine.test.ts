import { describe, expect, it } from 'vitest';
import {
  calculatePetAgeYears,
  calculateWeightTrend,
  calculateOwnershipCost,
  calculateAverageMonthlyCost,
  getReminderStatus,
  computeNextMedicationDueAt,
  collectVaccinationReminders,
  collectMedicationReminders,
} from '..';
import type { WeightEntry, PetExpense, Vaccination, Medication } from '../types';

// -----------------------------------------------------------------------
// Weight engine
// -----------------------------------------------------------------------

describe('calculatePetAgeYears', () => {
  it('returns null when birthDate is null', () => {
    expect(calculatePetAgeYears(null)).toBeNull();
  });

  it('returns age in years for a known date', () => {
    expect(calculatePetAgeYears('2023-03-08', '2026-03-08')).toBe(3);
  });

  it('returns fractional years for partial years', () => {
    const age = calculatePetAgeYears('2025-09-08', '2026-03-08');
    expect(age).toBeCloseTo(0.5, 0);
  });

  it('handles same-day birth and reference (zero age)', () => {
    expect(calculatePetAgeYears('2026-03-08', '2026-03-08')).toBe(0);
  });

  it('handles a very old pet (10+ years)', () => {
    const age = calculatePetAgeYears('2014-01-01', '2026-03-08');
    expect(age).toBeGreaterThan(12);
  });
});

describe('calculateWeightTrend', () => {
  function makeEntry(id: string, grams: number, date: string): WeightEntry {
    return {
      id,
      petId: 'pet-1',
      weightGrams: grams,
      bodyConditionScore: null,
      loggedAt: date,
      notes: null,
      createdAt: date,
    };
  }

  it('returns stable when there is only one entry', () => {
    const trend = calculateWeightTrend([makeEntry('w1', 5000, '2026-01-01T00:00:00Z')]);
    expect(trend.direction).toBe('stable');
    expect(trend.deltaGrams).toBe(0);
    expect(trend.latestWeightGrams).toBe(5000);
    expect(trend.previousWeightGrams).toBeNull();
  });

  it('returns stable when there are zero entries', () => {
    const trend = calculateWeightTrend([]);
    expect(trend.direction).toBe('stable');
    expect(trend.latestWeightGrams).toBeNull();
  });

  it('detects gaining trend (> 2% increase)', () => {
    const trend = calculateWeightTrend([
      makeEntry('w1', 10000, '2026-01-01T00:00:00Z'),
      makeEntry('w2', 10500, '2026-02-01T00:00:00Z'),
    ]);
    expect(trend.direction).toBe('gaining');
    expect(trend.deltaGrams).toBe(500);
    expect(trend.deltaPercent).toBe(5);
  });

  it('detects losing trend (> 2% decrease)', () => {
    const trend = calculateWeightTrend([
      makeEntry('w1', 10000, '2026-01-01T00:00:00Z'),
      makeEntry('w2', 9500, '2026-02-01T00:00:00Z'),
    ]);
    expect(trend.direction).toBe('losing');
    expect(trend.deltaGrams).toBe(-500);
  });

  it('reports stable for small fluctuations (< 2%)', () => {
    const trend = calculateWeightTrend([
      makeEntry('w1', 10000, '2026-01-01T00:00:00Z'),
      makeEntry('w2', 10100, '2026-02-01T00:00:00Z'),
    ]);
    expect(trend.direction).toBe('stable');
    expect(trend.deltaGrams).toBe(100);
  });

  it('sorts entries by loggedAt regardless of insertion order', () => {
    const trend = calculateWeightTrend([
      makeEntry('w2', 10800, '2026-03-01T00:00:00Z'),
      makeEntry('w1', 10000, '2026-01-01T00:00:00Z'),
    ]);
    expect(trend.latestWeightGrams).toBe(10800);
    expect(trend.previousWeightGrams).toBe(10000);
  });

  it('uses only the last two entries for trend calculation', () => {
    const trend = calculateWeightTrend([
      makeEntry('w1', 8000, '2026-01-01T00:00:00Z'),
      makeEntry('w2', 9000, '2026-02-01T00:00:00Z'),
      makeEntry('w3', 9050, '2026-03-01T00:00:00Z'),
    ]);
    // 9050 vs 9000 = 0.56% => stable
    expect(trend.direction).toBe('stable');
    expect(trend.latestWeightGrams).toBe(9050);
    expect(trend.previousWeightGrams).toBe(9000);
  });
});

describe('calculateOwnershipCost', () => {
  function makeExpense(id: string, cents: number): PetExpense {
    return {
      id,
      petId: 'pet-1',
      category: 'food',
      label: 'Food',
      amountCents: cents,
      spentOn: '2026-01-01',
      notes: null,
      createdAt: '2026-01-01T00:00:00Z',
    };
  }

  it('returns zero for empty expenses', () => {
    expect(calculateOwnershipCost([])).toBe(0);
  });

  it('sums all expense amounts', () => {
    expect(
      calculateOwnershipCost([makeExpense('e1', 3000), makeExpense('e2', 7000)]),
    ).toBe(10000);
  });
});

describe('calculateAverageMonthlyCost', () => {
  function makeExpense(id: string, cents: number): PetExpense {
    return {
      id,
      petId: 'pet-1',
      category: 'vet',
      label: 'Vet',
      amountCents: cents,
      spentOn: '2026-01-15',
      notes: null,
      createdAt: '2026-01-15T00:00:00Z',
    };
  }

  it('returns total when adoptionDate is null', () => {
    expect(calculateAverageMonthlyCost([makeExpense('e1', 12000)], null)).toBe(12000);
  });

  it('divides by months owned', () => {
    const cost = calculateAverageMonthlyCost(
      [makeExpense('e1', 12000)],
      '2026-01-01',
      '2026-03-01',
    );
    // ~2 months => 12000 / 2 = 6000
    expect(cost).toBe(6000);
  });

  it('uses minimum of 1 month for very recent adoption', () => {
    const cost = calculateAverageMonthlyCost(
      [makeExpense('e1', 5000)],
      '2026-03-07',
      '2026-03-08',
    );
    expect(cost).toBe(5000);
  });

  it('returns zero for empty expenses with a valid adoption date', () => {
    expect(calculateAverageMonthlyCost([], '2026-01-01', '2026-06-01')).toBe(0);
  });
});

// -----------------------------------------------------------------------
// Reminders engine
// -----------------------------------------------------------------------

describe('getReminderStatus', () => {
  it('returns overdue when past due date', () => {
    const result = getReminderStatus('2026-03-01', '2026-03-08', 30);
    expect(result.status).toBe('overdue');
    expect(result.daysUntilDue).toBe(-7);
  });

  it('returns due_soon when within warning window', () => {
    const result = getReminderStatus('2026-03-20', '2026-03-08', 30);
    expect(result.status).toBe('due_soon');
    expect(result.daysUntilDue).toBe(12);
  });

  it('returns current when beyond warning window', () => {
    const result = getReminderStatus('2026-12-31', '2026-03-08', 30);
    expect(result.status).toBe('current');
  });

  it('returns due_soon on the exact due date (0 days until due)', () => {
    const result = getReminderStatus('2026-03-08', '2026-03-08', 30);
    expect(result.status).toBe('due_soon');
    expect(result.daysUntilDue).toBe(0);
  });

  it('uses custom warning window', () => {
    // 7 days until due, window=5 -> 7 > 5 -> current
    const result = getReminderStatus('2026-03-15', '2026-03-08', 5);
    expect(result.status).toBe('current');

    // 7 days until due, window=7 -> 7 <= 7 -> due_soon
    const result2 = getReminderStatus('2026-03-15', '2026-03-08', 7);
    expect(result2.status).toBe('due_soon');

    // 7 days until due, window=3 -> 7 > 3 -> current
    const result3 = getReminderStatus('2026-03-15', '2026-03-08', 3);
    expect(result3.status).toBe('current');
  });
});

describe('computeNextMedicationDueAt', () => {
  const baseDate = '2026-03-08T09:00:00.000Z';

  it('adds 1 day for daily frequency', () => {
    const next = computeNextMedicationDueAt('daily', baseDate, null);
    expect(next).toBe('2026-03-09T09:00:00.000Z');
  });

  it('adds 12 hours for twice_daily frequency', () => {
    const next = computeNextMedicationDueAt('twice_daily', baseDate, null);
    expect(next).toBe('2026-03-08T21:00:00.000Z');
  });

  it('adds 7 days for weekly frequency', () => {
    const next = computeNextMedicationDueAt('weekly', baseDate, null);
    expect(next).toBe('2026-03-15T09:00:00.000Z');
  });

  it('adds 30 days for monthly frequency', () => {
    const next = computeNextMedicationDueAt('monthly', baseDate, null);
    expect(next).toBe('2026-04-07T09:00:00.000Z');
  });

  it('adds N days for every_n_days frequency', () => {
    const next = computeNextMedicationDueAt('every_n_days', baseDate, 14);
    expect(next).toBe('2026-03-22T09:00:00.000Z');
  });

  it('defaults to 1 day for every_n_days when intervalDays is null', () => {
    const next = computeNextMedicationDueAt('every_n_days', baseDate, null);
    expect(next).toBe('2026-03-09T09:00:00.000Z');
  });

  it('returns null for as_needed frequency', () => {
    expect(computeNextMedicationDueAt('as_needed', baseDate, null)).toBeNull();
  });
});

describe('collectVaccinationReminders', () => {
  const pets = [
    { id: 'pet-1', name: 'Milo' },
    { id: 'pet-2', name: 'Luna' },
  ];

  function makeVax(id: string, petId: string, name: string, dueDate: string | null): Vaccination {
    return {
      id,
      petId,
      name,
      dateGiven: '2025-03-01',
      nextDueDate: dueDate,
      veterinarian: null,
      lotNumber: null,
      notes: null,
      createdAt: '2025-03-01T00:00:00Z',
    };
  }

  it('returns empty array when no vaccinations have due dates', () => {
    const result = collectVaccinationReminders(
      pets,
      [makeVax('v1', 'pet-1', 'Rabies', null)],
      '2026-03-08',
    );
    expect(result).toHaveLength(0);
  });

  it('filters out vaccinations that are current (beyond warning window)', () => {
    const result = collectVaccinationReminders(
      pets,
      [makeVax('v1', 'pet-1', 'Rabies', '2027-01-01')],
      '2026-03-08',
      30,
    );
    expect(result).toHaveLength(0);
  });

  it('includes overdue vaccinations', () => {
    const result = collectVaccinationReminders(
      pets,
      [makeVax('v1', 'pet-1', 'Rabies', '2026-02-15')],
      '2026-03-08',
      30,
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('overdue');
    expect(result[0].petName).toBe('Milo');
  });

  it('includes due_soon vaccinations', () => {
    const result = collectVaccinationReminders(
      pets,
      [makeVax('v1', 'pet-2', 'FVRCP', '2026-03-20')],
      '2026-03-08',
      30,
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('due_soon');
    expect(result[0].petName).toBe('Luna');
  });

  it('sorts by daysUntilDue ascending (most overdue first)', () => {
    const result = collectVaccinationReminders(
      pets,
      [
        makeVax('v1', 'pet-1', 'Rabies', '2026-03-20'),
        makeVax('v2', 'pet-2', 'DHPP', '2026-02-15'),
      ],
      '2026-03-08',
      30,
    );
    expect(result).toHaveLength(2);
    expect(result[0].vaccineName).toBe('DHPP'); // overdue first
    expect(result[1].vaccineName).toBe('Rabies'); // due_soon second
  });

  it('handles unknown pet IDs gracefully', () => {
    const result = collectVaccinationReminders(
      pets,
      [makeVax('v1', 'pet-unknown', 'Rabies', '2026-03-01')],
      '2026-03-08',
      30,
    );
    expect(result).toHaveLength(1);
    expect(result[0].petName).toBe('Unknown Pet');
  });
});

describe('collectMedicationReminders', () => {
  const pets = [{ id: 'pet-1', name: 'Milo' }];

  function makeMed(
    id: string,
    active: boolean,
    nextDue: string | null,
  ): Medication {
    return {
      id,
      petId: 'pet-1',
      name: 'Heartgard',
      dosage: null,
      frequency: 'monthly',
      intervalDays: null,
      startsOn: '2026-01-01',
      endsOn: null,
      nextDueAt: nextDue,
      lastGivenAt: null,
      prescribedBy: null,
      notes: null,
      isActive: active,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
  }

  it('returns empty for inactive medications', () => {
    const result = collectMedicationReminders(
      pets,
      [makeMed('m1', false, '2026-03-08T09:00:00Z')],
      '2026-03-07T00:00:00Z',
      2,
    );
    expect(result).toHaveLength(0);
  });

  it('returns empty for medications without next due', () => {
    const result = collectMedicationReminders(
      pets,
      [makeMed('m1', true, null)],
      '2026-03-07T00:00:00Z',
      2,
    );
    expect(result).toHaveLength(0);
  });

  it('returns due_soon medication within window', () => {
    const result = collectMedicationReminders(
      pets,
      [makeMed('m1', true, '2026-03-09T09:00:00Z')],
      '2026-03-08T00:00:00Z',
      2,
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('due_soon');
    expect(result[0].medicationName).toBe('Heartgard');
  });

  it('returns overdue medication', () => {
    const result = collectMedicationReminders(
      pets,
      [makeMed('m1', true, '2026-03-05T09:00:00Z')],
      '2026-03-08T00:00:00Z',
      2,
    );
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('overdue');
  });

  it('filters out current (far future) medications', () => {
    const result = collectMedicationReminders(
      pets,
      [makeMed('m1', true, '2027-01-01T09:00:00Z')],
      '2026-03-08T00:00:00Z',
      2,
    );
    expect(result).toHaveLength(0);
  });

  it('returns multiple due medications sorted by daysUntilDue', () => {
    const result = collectMedicationReminders(
      pets,
      [
        makeMed('m1', true, '2026-03-10T09:00:00Z'),
        makeMed('m2', true, '2026-03-06T09:00:00Z'),
      ],
      '2026-03-08T00:00:00Z',
      5,
    );
    expect(result).toHaveLength(2);
    expect(result[0].medicationId).toBe('m2'); // overdue first
    expect(result[1].medicationId).toBe('m1'); // due_soon second
  });
});
