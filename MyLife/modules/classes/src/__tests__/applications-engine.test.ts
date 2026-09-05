import { describe, expect, it } from 'vitest';
import {
  computeApplicationProgress,
  computeApplicationsTimeline,
  getDeadlineUrgency,
  groupApplicationsByStatus,
  superscoreFromTests,
} from '../engine/applications-engine';
import type {
  ApplicationRow,
  ApplicationTaskRow,
  StandardizedTestRow,
} from '../models/schemas';

const NOW = new Date('2026-04-20T00:00:00.000Z');

function makeApp(overrides: Partial<ApplicationRow> = {}): ApplicationRow {
  return {
    id: 'a-1',
    name: 'Stanford',
    institution: null,
    type: 'undergrad',
    program: null,
    deadline: null,
    early_deadline: null,
    decision_date: null,
    status: 'in_progress',
    application_url: null,
    portal_url: null,
    application_fee: null,
    fee_waiver_status: null,
    required_test_score_ids: null,
    required_essays_count: 0,
    essays_drafted: 0,
    essays_finalized: 0,
    recommenders_required: 0,
    recommenders_confirmed: 0,
    transcripts_requested: 0,
    transcripts_sent: 0,
    notes_md: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<ApplicationTaskRow> = {}): ApplicationTaskRow {
  return {
    id: 't-1',
    application_id: 'a-1',
    title: 'Task',
    kind: 'essay',
    due_at: null,
    completed_at: null,
    word_target: null,
    word_count: null,
    status: 'not_started',
    notes_md: null,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeTest(overrides: Partial<StandardizedTestRow> = {}): StandardizedTestRow {
  return {
    id: 't-1',
    name: 'SAT',
    category: 'undergrad',
    test_date: null,
    registration_deadline: null,
    location: null,
    score: null,
    max_score: null,
    percentile: null,
    section_scores: null,
    status: 'completed',
    superscore_eligible: 1,
    notes_md: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeApplicationProgress', () => {
  it('returns 100% with no components and no tasks', () => {
    const app = makeApp();
    const result = computeApplicationProgress(app, [], NOW);
    expect(result.percent_complete).toBe(100);
    expect(result.blocked_by).toEqual([]);
  });

  it('averages essay + recommender + transcript ratios', () => {
    const app = makeApp({
      required_essays_count: 4,
      essays_finalized: 2,
      recommenders_required: 2,
      recommenders_confirmed: 2,
      transcripts_requested: 1,
      transcripts_sent: 0,
    });
    const result = computeApplicationProgress(app, [], NOW);
    // (0.5 + 1 + 0) / 3 = 0.5
    expect(result.percent_complete).toBe(50);
  });

  it('counts skipped tasks as done', () => {
    const app = makeApp();
    const tasks = [
      makeTask({ id: 't1', status: 'done' }),
      makeTask({ id: 't2', status: 'skipped' }),
      makeTask({ id: 't3', status: 'not_started' }),
    ];
    const result = computeApplicationProgress(app, tasks, NOW);
    // 2 of 3 = 0.667 -> 67
    expect(result.percent_complete).toBe(67);
  });

  it('lists blocked_by reasons only when deadline < 30 days', () => {
    const app = makeApp({
      deadline: '2026-04-25T00:00:00.000Z', // 5 days away
      required_essays_count: 2,
      essays_drafted: 0,
      essays_finalized: 0,
      recommenders_required: 1,
      recommenders_confirmed: 0,
      transcripts_requested: 1,
      transcripts_sent: 0,
    });
    const result = computeApplicationProgress(app, [], NOW);
    expect(result.blocked_by).toContain('2 essays not drafted');
    expect(result.blocked_by).toContain('1 recommender not confirmed');
    expect(result.blocked_by).toContain('Transcript not sent');
  });

  it('does not list blocked_by when deadline far off', () => {
    const app = makeApp({
      deadline: '2027-04-25T00:00:00.000Z',
      required_essays_count: 2,
      essays_finalized: 0,
    });
    const result = computeApplicationProgress(app, [], NOW);
    expect(result.blocked_by).toEqual([]);
  });

  it('uses essays_drafted vs essays_finalized to label essay block precisely', () => {
    const app = makeApp({
      deadline: '2026-04-25T00:00:00.000Z',
      required_essays_count: 3,
      essays_drafted: 3,
      essays_finalized: 1,
    });
    const result = computeApplicationProgress(app, [], NOW);
    expect(result.blocked_by).toContain('2 essays not finalized');
  });

  it('only includes components present (skips zero-denominators)', () => {
    const app = makeApp({
      recommenders_required: 1,
      recommenders_confirmed: 1,
    });
    const result = computeApplicationProgress(app, [], NOW);
    expect(result.percent_complete).toBe(100);
  });
});

describe('getDeadlineUrgency', () => {
  it('returns none when no deadline', () => {
    expect(getDeadlineUrgency(makeApp(), NOW)).toBe('none');
  });

  it('returns overdue when deadline already passed', () => {
    const app = makeApp({ deadline: '2026-04-19T00:00:00.000Z' });
    expect(getDeadlineUrgency(app, NOW)).toBe('overdue');
  });

  it('returns critical for <= 7 days away', () => {
    const app = makeApp({ deadline: '2026-04-25T00:00:00.000Z' });
    expect(getDeadlineUrgency(app, NOW)).toBe('critical');
  });

  it('returns soon for <= 30 days', () => {
    const app = makeApp({ deadline: '2026-05-15T00:00:00.000Z' });
    expect(getDeadlineUrgency(app, NOW)).toBe('soon');
  });

  it('returns comfortable for <= 90 days', () => {
    const app = makeApp({ deadline: '2026-07-01T00:00:00.000Z' });
    expect(getDeadlineUrgency(app, NOW)).toBe('comfortable');
  });

  it('returns distant for > 90 days', () => {
    const app = makeApp({ deadline: '2026-12-01T00:00:00.000Z' });
    expect(getDeadlineUrgency(app, NOW)).toBe('distant');
  });
});

describe('groupApplicationsByStatus', () => {
  it('buckets every application by its status; empty buckets present', () => {
    const apps = [
      makeApp({ id: 'a', status: 'considering' }),
      makeApp({ id: 'b', status: 'considering' }),
      makeApp({ id: 'c', status: 'submitted' }),
    ];
    const groups = groupApplicationsByStatus(apps);
    expect(groups.considering).toHaveLength(2);
    expect(groups.submitted).toHaveLength(1);
    expect(groups.accepted).toEqual([]);
    expect(groups.rejected).toEqual([]);
  });
});

describe('computeApplicationsTimeline', () => {
  it('only includes applications with deadlines, sorted ascending by days_from_now', () => {
    const apps = [
      makeApp({ id: 'a', name: 'far', deadline: '2026-12-01T00:00:00.000Z' }),
      makeApp({ id: 'b', name: 'soon', deadline: '2026-05-01T00:00:00.000Z' }),
      makeApp({ id: 'c', name: 'no deadline' }),
      makeApp({ id: 'd', name: 'past', deadline: '2026-04-01T00:00:00.000Z' }),
    ];
    const timeline = computeApplicationsTimeline(apps, NOW);
    expect(timeline.map((t) => t.application_id)).toEqual(['d', 'b', 'a']);
    expect(timeline.find((t) => t.application_id === 'd')?.days_from_now).toBeLessThan(0);
  });

  it('returns empty array when no apps have deadlines', () => {
    expect(computeApplicationsTimeline([makeApp()], NOW)).toEqual([]);
  });
});

describe('superscoreFromTests', () => {
  it('returns empty array when no eligible tests', () => {
    const tests = [
      makeTest({ id: 'a', superscore_eligible: 0, section_scores: JSON.stringify({ math: 700 }) }),
      makeTest({ id: 'b', name: 'ACT', section_scores: JSON.stringify({ english: 30 }) }),
    ];
    expect(superscoreFromTests(tests, 'SAT')).toEqual([]);
  });

  it('takes the per-section maximum across eligible tests', () => {
    const tests = [
      makeTest({ id: 'a', section_scores: JSON.stringify({ math: 720, ebrw: 680 }) }),
      makeTest({ id: 'b', section_scores: JSON.stringify({ math: 700, ebrw: 720 }) }),
      makeTest({ id: 'c', section_scores: JSON.stringify({ math: 750, ebrw: 700 }) }),
    ];
    const result = superscoreFromTests(tests, 'SAT');
    expect(result).toEqual([
      { section: 'ebrw', best: 720 },
      { section: 'math', best: 750 },
    ]);
  });

  it('skips tests without parsed section_scores', () => {
    const tests = [
      makeTest({ id: 'a', section_scores: null }),
      makeTest({ id: 'b', section_scores: '{not-json' }),
      makeTest({ id: 'c', section_scores: JSON.stringify({ math: 700 }) }),
    ];
    const result = superscoreFromTests(tests, 'SAT');
    expect(result).toEqual([{ section: 'math', best: 700 }]);
  });

  it('only considers completed tests with the matching name', () => {
    const tests = [
      makeTest({ id: 'a', status: 'planned', section_scores: JSON.stringify({ math: 800 }) }),
      makeTest({ id: 'b', name: 'ACT', section_scores: JSON.stringify({ math: 750 }) }),
      makeTest({ id: 'c', section_scores: JSON.stringify({ math: 700 }) }),
    ];
    expect(superscoreFromTests(tests, 'SAT')).toEqual([{ section: 'math', best: 700 }]);
  });
});
