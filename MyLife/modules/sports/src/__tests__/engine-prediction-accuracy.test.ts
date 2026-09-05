import { describe, expect, it } from 'vitest';
import {
  computePredictionAccuracy,
  type PredictionAccuracyReport,
} from '../engine/prediction-accuracy';
import type { Prediction, PredictionCategory } from '../types';

let idSeq = 0;
function fixture(
  overrides: Partial<Prediction> & { category: PredictionCategory },
): Prediction {
  idSeq += 1;
  const base: Prediction = {
    id: `pd_fixture_${idSeq}`,
    category: overrides.category,
    sport: 'nfl',
    league: 'nfl',
    season: '2024-25',
    prediction_text: 'example pick',
    reasoning_md: null,
    confidence: null,
    predicted_at: 1_000,
    locks_at: null,
    settled_at: null,
    was_correct: null,
    result_text: null,
    notes_md: null,
    created_at: 1_000,
    updated_at: 1_000,
  };
  return { ...base, ...overrides };
}

describe('computePredictionAccuracy', () => {
  it('empty input returns all-null report', () => {
    const report = computePredictionAccuracy([]);
    expect(report.overall).toBeNull();
    expect(report.byCategory).toEqual([]);
    expect(report.bySeasonByCategory).toEqual([]);
  });

  it('unsettled-only input returns all-null report (ignores unsettled rows)', () => {
    const rows = [
      fixture({ category: 'mvp' }),
      fixture({ category: 'champion' }),
    ];
    const report = computePredictionAccuracy(rows);
    expect(report.overall).toBeNull();
    expect(report.byCategory).toEqual([]);
    expect(report.bySeasonByCategory).toEqual([]);
  });

  it('single-category mix of settled + unsettled computes overall + per-category pct', () => {
    const rows = [
      fixture({ category: 'mvp', was_correct: true, settled_at: 1 }),
      fixture({ category: 'mvp', was_correct: false, settled_at: 1 }),
      fixture({ category: 'mvp', was_correct: true, settled_at: 1 }),
      fixture({ category: 'mvp' }), // unsettled, ignored
    ];
    const report = computePredictionAccuracy(rows);
    expect(report.overall).toEqual({
      category: 'custom',
      settled: 3,
      correct: 2,
      accuracyPct: 66.67,
    });
    expect(report.byCategory).toHaveLength(1);
    expect(report.byCategory[0]).toEqual({
      category: 'mvp',
      settled: 3,
      correct: 2,
      accuracyPct: 66.67,
    });
  });

  it('byCategory is sorted alphabetically', () => {
    const rows = [
      fixture({ category: 'mvp', was_correct: true, settled_at: 1 }),
      fixture({ category: 'champion', was_correct: true, settled_at: 1 }),
      fixture({ category: 'roty', was_correct: false, settled_at: 1 }),
      fixture({ category: 'division', was_correct: true, settled_at: 1 }),
    ];
    const report = computePredictionAccuracy(rows);
    const cats = report.byCategory.map((b) => b.category);
    expect(cats).toEqual(['champion', 'division', 'mvp', 'roty']);
  });

  it('multi-season grouping sorts seasons descending and nests alpha categories', () => {
    const rows = [
      fixture({
        category: 'champion',
        season: '2023-24',
        was_correct: true,
        settled_at: 1,
      }),
      fixture({
        category: 'mvp',
        season: '2023-24',
        was_correct: false,
        settled_at: 1,
      }),
      fixture({
        category: 'champion',
        season: '2025-26',
        was_correct: true,
        settled_at: 1,
      }),
      fixture({
        category: 'roty',
        season: '2024-25',
        was_correct: true,
        settled_at: 1,
      }),
    ];
    const report: PredictionAccuracyReport = computePredictionAccuracy(rows);

    expect(report.bySeasonByCategory.map((s) => s.season)).toEqual([
      '2025-26',
      '2024-25',
      '2023-24',
    ]);

    // 2023-24 should have champion before mvp (alpha).
    const olderSeason = report.bySeasonByCategory.find(
      (s) => s.season === '2023-24',
    );
    expect(olderSeason?.breakdowns.map((b) => b.category)).toEqual([
      'champion',
      'mvp',
    ]);
    expect(olderSeason?.breakdowns[0]?.accuracyPct).toBe(100);
    expect(olderSeason?.breakdowns[1]?.accuracyPct).toBe(0);
  });

  it('overall aggregates across categories + seasons + rounds to 2 dp', () => {
    const rows: Prediction[] = [];
    for (let i = 0; i < 7; i += 1) {
      rows.push(
        fixture({
          category: 'custom',
          was_correct: true,
          settled_at: 1,
        }),
      );
    }
    for (let i = 0; i < 3; i += 1) {
      rows.push(
        fixture({
          category: 'custom',
          was_correct: false,
          settled_at: 1,
        }),
      );
    }
    const report = computePredictionAccuracy(rows);
    expect(report.overall?.settled).toBe(10);
    expect(report.overall?.correct).toBe(7);
    expect(report.overall?.accuracyPct).toBe(70);
  });

  it('pure + referentially transparent -- same input returns equal shape', () => {
    const rows = [
      fixture({ category: 'mvp', was_correct: true, settled_at: 1 }),
      fixture({ category: 'mvp', was_correct: null }),
    ];
    const a = computePredictionAccuracy(rows);
    const b = computePredictionAccuracy(rows);
    expect(a).toEqual(b);
  });
});
