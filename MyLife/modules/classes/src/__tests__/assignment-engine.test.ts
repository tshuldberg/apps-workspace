import { describe, expect, it } from 'vitest';
import {
  calculateLatePenalty,
  generateRecurringInstances,
  getDependencyChain,
  getOverdueAssignments,
  isBlocked,
  type RecurringTemplate,
} from '../engine/assignment-engine';
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

describe('generateRecurringInstances', () => {
  it('expands weekly recurrence across a 16-week semester', () => {
    const template: RecurringTemplate = {
      class_id: 'c-cs',
      title: 'Weekly homework',
      type: 'homework',
      due_at: '2026-01-12T23:59:00.000Z',
      recurrence_rule: { frequency: 'weekly', interval: 1 },
    };
    const instances = generateRecurringInstances(template, {
      start_date: '2026-01-12',
      end_date: '2026-05-03', // ~16 weeks (Jan 12 + 15 weeks = Apr 27, +week = May 4)
    });
    // Jan 12, 19, 26, Feb 2, 9, 16, 23, Mar 2, 9, 16, 23, 30, Apr 6, 13, 20, 27 = 16
    expect(instances.length).toBe(16);
    expect(instances[0].due_at).toBe('2026-01-12T23:59:00.000Z');
    expect(instances[15].due_at).toBe('2026-04-27T23:59:00.000Z');
    expect(instances.every((i) => i.is_recurring === false)).toBe(true);
  });

  it('honors rule.until earlier than semester end', () => {
    const template: RecurringTemplate = {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      due_at: '2026-01-12T23:59:00.000Z',
      recurrence_rule: {
        frequency: 'weekly',
        interval: 1,
        until: '2026-02-09',
      },
    };
    const instances = generateRecurringInstances(template, {
      start_date: '2026-01-12',
      end_date: '2026-05-03',
    });
    // Jan 12, 19, 26, Feb 2, 9 = 5
    expect(instances.length).toBe(5);
  });

  it('honors biweekly cadence', () => {
    const template: RecurringTemplate = {
      class_id: 'c-cs',
      title: 'X',
      type: 'homework',
      due_at: '2026-01-12T23:59:00.000Z',
      recurrence_rule: { frequency: 'biweekly', interval: 1 },
    };
    const instances = generateRecurringInstances(template, {
      start_date: '2026-01-12',
      end_date: '2026-02-23',
    });
    // Jan 12, Jan 26, Feb 9, Feb 23 = 4
    expect(instances.length).toBe(4);
  });
});

describe('getOverdueAssignments', () => {
  const now = new Date('2026-04-25T00:00:00.000Z');

  it('filters past-due not_started + in_progress and computes days_overdue', () => {
    const list = [
      row({ id: 'a', due_at: '2026-04-20T00:00:00.000Z' }),
      row({
        id: 'b',
        due_at: '2026-04-22T00:00:00.000Z',
        status: 'in_progress',
      }),
      row({
        id: 'c',
        due_at: '2026-04-19T00:00:00.000Z',
        status: 'submitted',
      }),
      row({ id: 'd', due_at: '2026-05-01T00:00:00.000Z' }),
      row({ id: 'e', due_at: null }),
    ];
    const overdue = getOverdueAssignments(list, now);
    expect(overdue.map((o) => o.assignment.id)).toEqual(['a', 'b']);
    expect(overdue[0].days_overdue).toBe(5); // Apr 25 - Apr 20
    expect(overdue[1].days_overdue).toBe(3); // Apr 25 - Apr 22
  });

  it('returns empty when nothing is overdue', () => {
    const list = [row({ id: 'a', due_at: '2026-05-01T00:00:00.000Z' })];
    expect(getOverdueAssignments(list, now)).toEqual([]);
  });
});

describe('getDependencyChain', () => {
  it('returns BFS-ordered blockers excluding the start node', () => {
    const list = [
      row({ id: 'a', depends_on: JSON.stringify(['b', 'c']) }),
      row({ id: 'b', depends_on: JSON.stringify(['d']) }),
      row({ id: 'c', depends_on: JSON.stringify(['d', 'e']) }),
      row({ id: 'd' }),
      row({ id: 'e' }),
    ];
    const chain = getDependencyChain('a', list);
    expect(chain.map((r) => r.id)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('returns empty for a node with no dependencies', () => {
    const list = [row({ id: 'a' })];
    expect(getDependencyChain('a', list)).toEqual([]);
  });

  it('tolerates cycles by visiting each node once', () => {
    const list = [
      row({ id: 'a', depends_on: JSON.stringify(['b']) }),
      row({ id: 'b', depends_on: JSON.stringify(['a']) }),
    ];
    const chain = getDependencyChain('a', list);
    expect(chain.map((r) => r.id)).toEqual(['b']);
  });

  it('returns empty for a missing start id', () => {
    expect(getDependencyChain('missing', [row({ id: 'a' })])).toEqual([]);
  });
});

describe('calculateLatePenalty', () => {
  const policy = { percent_per_day: 10, max_days: 3 };

  it('returns 0 penalty for on-time submission (0 days late)', () => {
    const result = calculateLatePenalty(
      { due_at: '2026-04-22T12:00:00.000Z', late_policy: JSON.stringify(policy) },
      '2026-04-22T12:00:00.000Z',
    );
    expect(result).toEqual({ penalty_percent: 0, capped: false });
  });

  it('charges one day penalty when 1 day late', () => {
    const result = calculateLatePenalty(
      { due_at: '2026-04-22T12:00:00.000Z', late_policy: JSON.stringify(policy) },
      '2026-04-23T12:00:00.000Z',
    );
    expect(result).toEqual({ penalty_percent: 10, capped: false });
  });

  it('caps penalty at max_days when one day past max', () => {
    const result = calculateLatePenalty(
      { due_at: '2026-04-22T12:00:00.000Z', late_policy: JSON.stringify(policy) },
      '2026-04-26T12:00:00.000Z', // 4 days late, max=3
    );
    expect(result).toEqual({ penalty_percent: 30, capped: true });
  });

  it('caps penalty at max_days when many days past', () => {
    const result = calculateLatePenalty(
      { due_at: '2026-04-22T12:00:00.000Z', late_policy: JSON.stringify(policy) },
      '2026-05-22T12:00:00.000Z',
    );
    expect(result).toEqual({ penalty_percent: 30, capped: true });
  });

  it('returns 0 when no policy is provided and assignment has none', () => {
    const result = calculateLatePenalty(
      { due_at: '2026-04-22T12:00:00.000Z', late_policy: null },
      '2026-04-30T12:00:00.000Z',
    );
    expect(result).toEqual({ penalty_percent: 0, capped: false });
  });

  it('lets explicit policy override stored late_policy', () => {
    const result = calculateLatePenalty(
      { due_at: '2026-04-22T12:00:00.000Z', late_policy: JSON.stringify(policy) },
      '2026-04-23T12:00:00.000Z',
      { percent_per_day: 25, max_days: 1 },
    );
    expect(result).toEqual({ penalty_percent: 25, capped: false });
  });

  it('returns 0 when due_at is null', () => {
    const result = calculateLatePenalty(
      { due_at: null, late_policy: JSON.stringify(policy) },
      '2026-05-01T12:00:00.000Z',
    );
    expect(result).toEqual({ penalty_percent: 0, capped: false });
  });
});

describe('isBlocked', () => {
  const dep = (id: string, status: AssignmentRow['status']): AssignmentRow =>
    row({ id, status });

  it('returns false when there are no dependencies', () => {
    expect(isBlocked({ depends_on: null }, [])).toBe(false);
    expect(isBlocked({ depends_on: JSON.stringify([]) }, [])).toBe(false);
  });

  it('returns false when all dependencies are submitted or graded', () => {
    const all = [dep('b', 'submitted'), dep('c', 'graded')];
    expect(isBlocked({ depends_on: JSON.stringify(['b', 'c']) }, all)).toBe(false);
  });

  it('returns true when any dependency is not_started', () => {
    const all = [dep('b', 'submitted'), dep('c', 'not_started')];
    expect(isBlocked({ depends_on: JSON.stringify(['b', 'c']) }, all)).toBe(true);
  });

  it('returns true when any dependency is in_progress', () => {
    const all = [dep('b', 'in_progress')];
    expect(isBlocked({ depends_on: JSON.stringify(['b']) }, all)).toBe(true);
  });

  it('returns true when a dependency row is missing', () => {
    expect(isBlocked({ depends_on: JSON.stringify(['missing']) }, [])).toBe(true);
  });
});
