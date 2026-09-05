import { describe, it, expect } from 'vitest';
import {
  calculateDifficultyScore,
  calculateDifficulty,
  difficultyColor,
} from '../engine/difficulty-calculator';

describe('calculateDifficultyScore', () => {
  it('short flat gentle trail is easy', () => {
    const r = calculateDifficultyScore(1000, 50, 5);
    expect(r.distanceScore).toBe(0);
    expect(r.elevationScore).toBe(0);
    expect(r.gradeScore).toBe(0);
    expect(r.suggestedDifficulty).toBe('easy');
  });

  it('medium distance, moderate elevation, steep grade is hard', () => {
    const r = calculateDifficultyScore(10000, 500, 18);
    expect(r.distanceScore).toBe(2);
    expect(r.elevationScore).toBe(2);
    expect(r.gradeScore).toBe(2);
    expect(r.suggestedDifficulty).toBe('hard');
  });

  it('long, extreme elevation, technical grade is expert', () => {
    const r = calculateDifficultyScore(20000, 1500, 30);
    expect(r.distanceScore).toBe(3);
    expect(r.elevationScore).toBe(3);
    expect(r.gradeScore).toBe(3);
    expect(r.suggestedDifficulty).toBe('expert');
  });

  it('short but extreme elevation and grade is hard', () => {
    // 500m = score 0, 900m elev = score 3, 40% grade = score 3, total 6 = hard
    const r = calculateDifficultyScore(500, 900, 40);
    expect(r.suggestedDifficulty).toBe('hard');
  });

  it('zero-length trail is easy', () => {
    expect(calculateDifficulty(0, 0, 0)).toBe('easy');
  });

  it('without grade data uses 2-factor scoring', () => {
    const r = calculateDifficultyScore(5000, 200, null);
    expect(r.gradeScore).toBeNull();
    expect(r.distanceScore).toBe(1);
    expect(r.elevationScore).toBe(1);
    expect(r.suggestedDifficulty).toBe('moderate');
  });

  it('without grade, high distance+elevation is expert', () => {
    expect(calculateDifficulty(20000, 1000, null)).toBe('expert');
  });

  it('boundary: exactly 3km is score 1', () => {
    const r = calculateDifficultyScore(3000, 0, null);
    expect(r.distanceScore).toBe(1);
  });

  it('boundary: exactly 8km is score 2', () => {
    const r = calculateDifficultyScore(8000, 0, null);
    expect(r.distanceScore).toBe(2);
  });
});

describe('difficultyColor', () => {
  it('easy is green', () => {
    expect(difficultyColor('easy')).toBe('#30D158');
  });

  it('moderate is warm gold', () => {
    expect(difficultyColor('moderate')).toBe('#FFB877');
  });

  it('hard is soft coral', () => {
    expect(difficultyColor('hard')).toBe('#FFB4AB');
  });

  it('expert is violet', () => {
    expect(difficultyColor('expert')).toBe('#A78BFA');
  });
});
