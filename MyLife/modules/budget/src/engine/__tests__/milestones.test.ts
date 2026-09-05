import { describe, it, expect } from 'vitest';
import { detectMilestones, ROUND_NUMBER_THRESHOLDS } from '../milestones';
import type { MilestoneType } from '../milestones';

describe('detectMilestones', () => {
  const today = '2026-03-15';

  it('detects first_positive when net worth crosses from negative to positive', () => {
    const result = detectMilestones(
      50000, // $500 net worth
      0,
      [-10000], // was negative
      [],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'first_positive')).toBe(true);
  });

  it('does not detect first_positive if already positive before', () => {
    const result = detectMilestones(
      50000,
      0,
      [10000], // was already positive
      [],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'first_positive')).toBe(false);
  });

  it('detects round_number at $10K threshold', () => {
    const result = detectMilestones(
      1_000_000, // $10,000
      0,
      [500_000],
      [],
      today,
    );
    const roundMilestones = result.filter((m) => m.milestoneType === 'round_number');
    expect(roundMilestones.some((m) => m.value === 1_000_000)).toBe(true);
  });

  it('detects multiple round_number thresholds crossed at once', () => {
    const result = detectMilestones(
      5_500_000, // $55,000 - crosses $1K, $5K, $10K, $25K, $50K
      0,
      [0],
      [],
      today,
    );
    const roundMilestones = result.filter((m) => m.milestoneType === 'round_number');
    expect(roundMilestones.length).toBe(5);
  });

  it('does not re-detect existing milestones', () => {
    const result = detectMilestones(
      1_000_000,
      0,
      [500_000],
      [{ milestoneType: 'round_number', value: 1_000_000 }],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'round_number' && m.value === 1_000_000)).toBe(false);
  });

  it('detects all_time_high when net worth exceeds previous max', () => {
    const result = detectMilestones(
      200_000,
      0,
      [100_000, 150_000],
      [],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'all_time_high')).toBe(true);
  });

  it('does not detect all_time_high when not exceeding previous max', () => {
    const result = detectMilestones(
      100_000,
      0,
      [200_000, 150_000],
      [],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'all_time_high')).toBe(false);
  });

  it('detects debt_free when liabilities reach 0', () => {
    const result = detectMilestones(
      500_000,
      0,
      [100_000],
      [],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'debt_free')).toBe(true);
  });

  it('does not detect debt_free when liabilities > 0', () => {
    const result = detectMilestones(
      500_000,
      10_000,
      [100_000],
      [],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'debt_free')).toBe(false);
  });

  it('does not re-detect debt_free if already achieved', () => {
    const result = detectMilestones(
      500_000,
      0,
      [100_000],
      [{ milestoneType: 'debt_free', value: 0 }],
      today,
    );
    expect(result.some((m) => m.milestoneType === 'debt_free')).toBe(false);
  });

  it('includes achievedAt in all detected milestones', () => {
    const result = detectMilestones(200_000, 0, [-50_000], [], today);
    for (const m of result) {
      expect(m.achievedAt).toBe(today);
    }
  });

  it('returns empty array for no new milestones', () => {
    const existing: { milestoneType: MilestoneType; value: number }[] = ROUND_NUMBER_THRESHOLDS.map((v) => ({
      milestoneType: 'round_number' as MilestoneType,
      value: v as number,
    }));
    existing.push({ milestoneType: 'first_positive' as MilestoneType, value: 0 });
    existing.push({ milestoneType: 'debt_free' as MilestoneType, value: 0 });

    const result = detectMilestones(
      50_000, // $500
      0,
      [100_000], // previously higher
      existing,
      today,
    );
    expect(result).toHaveLength(0);
  });
});
