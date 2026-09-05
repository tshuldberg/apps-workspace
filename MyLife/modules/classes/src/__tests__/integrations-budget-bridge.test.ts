import { describe, expect, it } from 'vitest';
import {
  costPerCreditHour,
  extractEducationExpenses,
  suggestEducationBudget,
  type EducationExpense,
} from '../integrations/budget-bridge';

const semester = { id: 's1', name: 'Spring 2026', credit_hours: 15 };

describe('extractEducationExpenses', () => {
  it('returns empty array (no cost fields on cs_classes today)', () => {
    expect(
      extractEducationExpenses(
        [{ id: 'c1', semester_id: 's1', name: 'Algorithms', credits: 3 }],
        [{ id: 's1', name: 'Spring 2026' }],
      ),
    ).toEqual([]);
  });

  it('returns empty on empty input', () => {
    expect(extractEducationExpenses([], [])).toEqual([]);
  });
});

describe('suggestEducationBudget', () => {
  it('returns zeroed envelope when no classes', () => {
    const out = suggestEducationBudget(semester, []);
    expect(out.envelope).toBe('Education');
    expect(out.total).toBe(0);
    expect(out.sub.tuition).toBe(0);
  });

  it('includes only the requested semester', () => {
    const out = suggestEducationBudget(semester, [
      { id: 'c1', semester_id: 's1', credits: 3 },
      { id: 'c2', semester_id: 'other', credits: 9 },
    ]);
    expect(out.envelope).toBe('Education');
    // With default per-credit = 0, total stays 0; structure must still be present
    expect(out.sub).toMatchObject({
      tuition: 0,
      textbooks: 0,
      supplies: 0,
      fees: 0,
    });
  });
});

describe('costPerCreditHour', () => {
  it('returns zeroed result on empty data', () => {
    const out = costPerCreditHour([], []);
    expect(out.avg_cost_per_credit).toBe(0);
    expect(out.by_semester).toEqual([]);
  });

  it('computes per-semester cost when expenses provided', () => {
    const expenses: EducationExpense[] = [
      {
        category: 'tuition',
        amount: 7500,
        label: 'Tuition',
        semesterId: 's1',
        classId: null,
      },
    ];
    const out = costPerCreditHour([semester], expenses);
    expect(out.by_semester[0].cost_per_credit).toBe(500); // 7500 / 15
    expect(out.avg_cost_per_credit).toBe(500);
  });

  it('handles semesters with zero credits gracefully', () => {
    const out = costPerCreditHour(
      [{ id: 's2', credit_hours: 0 }],
      [
        {
          category: 'fees',
          amount: 100,
          label: 'Fees',
          semesterId: 's2',
          classId: null,
        },
      ],
    );
    expect(out.by_semester[0].cost_per_credit).toBe(0);
    expect(out.avg_cost_per_credit).toBe(0);
  });
});
