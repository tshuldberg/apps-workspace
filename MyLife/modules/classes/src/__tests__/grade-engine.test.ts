import { describe, expect, it } from 'vitest';
import {
  calculateClassGrade,
  calculateSemesterGPA,
  calculateTrend,
  gpaFromLetter,
  letterFromPercent,
  predictFinalGrade,
} from '../engine/grade-engine';
import type { AssignmentRow } from '../models/schemas';

function row(overrides: Partial<AssignmentRow>): AssignmentRow {
  return {
    id: 'a',
    class_id: 'c',
    title: 't',
    type: 'homework',
    description_md: null,
    due_at: null,
    submitted_at: null,
    graded_at: null,
    status: 'not_started',
    priority: 'medium',
    estimated_minutes: null,
    actual_minutes: null,
    grade: null,
    max_grade: 100,
    weight: null,
    is_recurring: 0,
    recurrence_rule: null,
    group_members: null,
    submission_notes: null,
    late_policy: null,
    depends_on: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('letterFromPercent', () => {
  it('standard scale: boundary 90 -> A, 89 -> B, 92 -> A', () => {
    expect(letterFromPercent(90, 'standard')).toBe('A');
    expect(letterFromPercent(92, 'standard')).toBe('A');
    expect(letterFromPercent(89, 'standard')).toBe('B');
    expect(letterFromPercent(80, 'standard')).toBe('B');
    expect(letterFromPercent(70, 'standard')).toBe('C');
    expect(letterFromPercent(59.9, 'standard')).toBe('F');
  });

  it('plus_minus scale resolves +/- correctly', () => {
    expect(letterFromPercent(97, 'plus_minus')).toBe('A+');
    expect(letterFromPercent(93, 'plus_minus')).toBe('A');
    expect(letterFromPercent(92, 'plus_minus')).toBe('A-');
    expect(letterFromPercent(90, 'plus_minus')).toBe('A-');
    expect(letterFromPercent(89, 'plus_minus')).toBe('B+');
    expect(letterFromPercent(80, 'plus_minus')).toBe('B-');
    expect(letterFromPercent(70, 'plus_minus')).toBe('C-');
  });

  it('strict scale: 90 still B, 93 = A', () => {
    expect(letterFromPercent(93, 'strict')).toBe('A');
    expect(letterFromPercent(92, 'strict')).toBe('B');
    expect(letterFromPercent(90, 'strict')).toBe('B');
    expect(letterFromPercent(85, 'strict')).toBe('B');
    expect(letterFromPercent(80, 'strict')).toBe('C');
    expect(letterFromPercent(77, 'strict')).toBe('C');
    expect(letterFromPercent(70, 'strict')).toBe('D');
  });

  it('defaults to standard scale', () => {
    expect(letterFromPercent(90)).toBe('A');
  });

  it('returns F for non-finite input', () => {
    expect(letterFromPercent(NaN)).toBe('F');
  });
});

describe('gpaFromLetter', () => {
  it('A+ caps at 4.0 (US convention)', () => {
    expect(gpaFromLetter('A+')).toBe(4.0);
    expect(gpaFromLetter('A')).toBe(4.0);
  });
  it('plus/minus values', () => {
    expect(gpaFromLetter('A-')).toBe(3.7);
    expect(gpaFromLetter('B+')).toBe(3.3);
    expect(gpaFromLetter('B')).toBe(3.0);
    expect(gpaFromLetter('C-')).toBe(1.7);
    expect(gpaFromLetter('D')).toBe(1.0);
    expect(gpaFromLetter('F')).toBe(0.0);
  });
  it('unknown letter -> 0', () => {
    expect(gpaFromLetter('Z')).toBe(0);
  });
  it('case-insensitive', () => {
    expect(gpaFromLetter('b+')).toBe(3.3);
  });
});

describe('calculateClassGrade', () => {
  it('returns null percent when no graded assignments', () => {
    const result = calculateClassGrade([], null);
    expect(result.percent).toBeNull();
    expect(result.letter).toBeNull();
    expect(result.graded_count).toBe(0);
  });

  it('mixed graded + ungraded: only graded count', () => {
    const assignments = [
      row({ id: '1', type: 'homework', grade: 90, max_grade: 100 }),
      row({ id: '2', type: 'homework', grade: null }),
      row({ id: '3', type: 'exam', grade: 80, max_grade: 100 }),
    ];
    const result = calculateClassGrade(assignments, null);
    expect(result.graded_count).toBe(2);
    // Unweighted: (90+80)/200 = 85
    expect(result.percent).toBeCloseTo(85, 5);
    expect(result.letter).toBe('B');
  });

  it('category weights summing to 100 produce weighted average', () => {
    // homework weight 50, exam weight 50; HW=100%, exam=80% -> 90
    const assignments = [
      row({ id: '1', type: 'homework', grade: 100, max_grade: 100 }),
      row({ id: '2', type: 'exam', grade: 80, max_grade: 100 }),
    ];
    const result = calculateClassGrade(assignments, { homework: 50, exam: 50 });
    expect(result.percent).toBeCloseTo(90, 5);
    expect(result.letter).toBe('A');
  });

  it('normalizes weights summing to 120', () => {
    const assignments = [
      row({ id: '1', type: 'homework', grade: 100, max_grade: 100 }),
      row({ id: '2', type: 'exam', grade: 80, max_grade: 100 }),
    ];
    // 60/120 + 60/120 = 50/50 -> 90
    const result = calculateClassGrade(assignments, { homework: 60, exam: 60 });
    expect(result.percent).toBeCloseTo(90, 5);
  });

  it('normalizes weights summing to 40 (still 50/50 share)', () => {
    const assignments = [
      row({ id: '1', type: 'homework', grade: 100, max_grade: 100 }),
      row({ id: '2', type: 'exam', grade: 80, max_grade: 100 }),
    ];
    const result = calculateClassGrade(assignments, { homework: 20, exam: 20 });
    expect(result.percent).toBeCloseTo(90, 5);
  });

  it('drops categories with no graded work and re-normalizes', () => {
    // exam category has no graded work -> homework should carry full 100%
    const assignments = [
      row({ id: '1', type: 'homework', grade: 90, max_grade: 100 }),
    ];
    const result = calculateClassGrade(assignments, {
      homework: 50,
      exam: 50,
    });
    expect(result.percent).toBeCloseTo(90, 5);
  });

  it('aggregates by_category correctly', () => {
    const assignments = [
      row({ id: '1', type: 'homework', grade: 80, max_grade: 100 }),
      row({ id: '2', type: 'homework', grade: 90, max_grade: 100 }),
      row({ id: '3', type: 'exam', grade: 70, max_grade: 100 }),
    ];
    const result = calculateClassGrade(assignments, null);
    expect(result.by_category.homework.earned).toBe(170);
    expect(result.by_category.homework.possible).toBe(200);
    expect(result.by_category.homework.percent).toBeCloseTo(85, 5);
    expect(result.by_category.exam.percent).toBeCloseTo(70, 5);
  });

  it('ignores assignments with max_grade <= 0', () => {
    const assignments = [
      row({ id: '1', type: 'homework', grade: 50, max_grade: 0 }),
      row({ id: '2', type: 'homework', grade: 80, max_grade: 100 }),
    ];
    const result = calculateClassGrade(assignments, null);
    expect(result.graded_count).toBe(1);
    expect(result.percent).toBeCloseTo(80, 5);
  });
});

describe('predictFinalGrade', () => {
  it('achievable target: required percent within 0-100', () => {
    // homework 50%, exam 50%; HW done at 100%, exam pending. Target 90.
    // Need exam = (0.9 - 0.5) / 0.5 = 80
    const assignments = [
      row({ id: '1', type: 'homework', grade: 100, max_grade: 100 }),
      row({ id: '2', type: 'exam', grade: null, max_grade: 100 }),
    ];
    const pred = predictFinalGrade(assignments, { homework: 50, exam: 50 }, 90);
    expect(pred.required_remaining_percent).toBeCloseTo(80, 5);
    expect(pred.achievable).toBe(true);
  });

  it('unachievable target flips achievable=false', () => {
    // HW at 50%, target 95 -> need exam = (0.95 - 0.25)/0.5 = 140
    const assignments = [
      row({ id: '1', type: 'homework', grade: 50, max_grade: 100 }),
      row({ id: '2', type: 'exam', grade: null, max_grade: 100 }),
    ];
    const pred = predictFinalGrade(assignments, { homework: 50, exam: 50 }, 95);
    expect(pred.required_remaining_percent).toBeGreaterThan(105);
    expect(pred.achievable).toBe(false);
  });

  it('no remaining work: achievable iff current >= target', () => {
    const assignments = [
      row({ id: '1', type: 'homework', grade: 92, max_grade: 100 }),
    ];
    const pred = predictFinalGrade(assignments, null, 90);
    expect(pred.required_remaining_percent).toBeNull();
    expect(pred.achievable).toBe(true);
    expect(pred.gap_points).toBeCloseTo(-2, 5);
  });

  it('no assignments at all -> not achievable', () => {
    const pred = predictFinalGrade([], null, 90);
    expect(pred.achievable).toBe(false);
    expect(pred.required_remaining_percent).toBeNull();
  });

  it('without category weights uses points share', () => {
    // 100 points done at 80%, 100 points remaining. Target 90 -> need 100.
    const assignments = [
      row({ id: '1', type: 'homework', grade: 80, max_grade: 100 }),
      row({ id: '2', type: 'exam', grade: null, max_grade: 100 }),
    ];
    const pred = predictFinalGrade(assignments, null, 90);
    expect(pred.required_remaining_percent).toBeCloseTo(100, 5);
    expect(pred.achievable).toBe(true);
  });
});

describe('calculateSemesterGPA', () => {
  it('credit-weighted across graded classes', () => {
    // 4cr A (4.0) + 3cr B (3.0) = (16 + 9) / 7 = 3.5714
    const result = calculateSemesterGPA([
      { credits: 4, letter: 'A' },
      { credits: 3, letter: 'B' },
    ]);
    expect(result.gpa).toBeCloseTo(25 / 7, 4);
    expect(result.credit_hours).toBe(7);
    expect(result.graded_credits).toBe(7);
  });

  it('excludes ungraded classes from GPA but counts credits', () => {
    const result = calculateSemesterGPA([
      { credits: 4, letter: 'A' },
      { credits: 3, letter: null },
    ]);
    expect(result.gpa).toBeCloseTo(4.0, 5);
    expect(result.credit_hours).toBe(7);
    expect(result.graded_credits).toBe(4);
  });

  it('returns null when no graded credits', () => {
    const result = calculateSemesterGPA([{ credits: 3, letter: null }]);
    expect(result.gpa).toBeNull();
    expect(result.graded_credits).toBe(0);
  });

  it('handles empty input', () => {
    const result = calculateSemesterGPA([]);
    expect(result.gpa).toBeNull();
    expect(result.credit_hours).toBe(0);
  });

  it('A+ caps at 4.0 (no grade inflation)', () => {
    const result = calculateSemesterGPA([{ credits: 3, letter: 'A+' }]);
    expect(result.gpa).toBe(4.0);
  });
});

describe('calculateTrend', () => {
  it('upward trend with high confidence (>=8 samples)', () => {
    const history = Array.from({ length: 8 }, (_, i) => ({
      date: new Date(2026, 0, 1 + i * 7).toISOString(),
      percent: 70 + i,
    }));
    const result = calculateTrend(history);
    expect(result.direction).toBe('up');
    expect(result.slope_per_week).toBeGreaterThan(0);
    expect(result.confidence).toBe('high');
  });

  it('downward trend medium confidence (4-7 samples)', () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      date: new Date(2026, 0, 1 + i * 7).toISOString(),
      percent: 95 - i * 2,
    }));
    const result = calculateTrend(history);
    expect(result.direction).toBe('down');
    expect(result.slope_per_week).toBeLessThan(0);
    expect(result.confidence).toBe('medium');
  });

  it('flat trend within epsilon', () => {
    const history = [
      { date: '2026-01-01T00:00:00.000Z', percent: 85 },
      { date: '2026-01-08T00:00:00.000Z', percent: 85 },
      { date: '2026-01-15T00:00:00.000Z', percent: 85 },
      { date: '2026-01-22T00:00:00.000Z', percent: 85 },
    ];
    const result = calculateTrend(history);
    expect(result.direction).toBe('flat');
    expect(result.slope_per_week).toBeCloseTo(0, 5);
    expect(result.confidence).toBe('medium');
  });

  it('insufficient data (< 2 samples) -> flat low', () => {
    const result = calculateTrend([
      { date: '2026-01-01T00:00:00.000Z', percent: 80 },
    ]);
    expect(result.direction).toBe('flat');
    expect(result.confidence).toBe('low');
  });

  it('low confidence with 2-3 samples', () => {
    const result = calculateTrend([
      { date: '2026-01-01T00:00:00.000Z', percent: 70 },
      { date: '2026-01-08T00:00:00.000Z', percent: 80 },
      { date: '2026-01-15T00:00:00.000Z', percent: 90 },
    ]);
    expect(result.direction).toBe('up');
    expect(result.confidence).toBe('low');
  });
});
