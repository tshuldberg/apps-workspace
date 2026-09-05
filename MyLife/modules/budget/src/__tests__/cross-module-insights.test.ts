import { describe, it, expect } from 'vitest';
import {
  checkSubscriptionUsage,
  checkSpendingHabitCorrelation,
  checkDiningVsGroceryRatio,
  projectGoalCompletion,
  generateInsights,
} from '../insights/cross-module-insights';

describe('checkSubscriptionUsage', () => {
  it('returns null for recently used subscription', () => {
    const result = checkSubscriptionUsage({
      subscriptionName: 'Gym',
      monthlyCostCents: 4999,
      daysSinceLastRelatedTransaction: 5,
      relatedModule: 'workouts',
    });
    expect(result).toBeNull();
  });

  it('returns suggestion for 30+ day gap', () => {
    const result = checkSubscriptionUsage({
      subscriptionName: 'Gym',
      monthlyCostCents: 4999,
      daysSinceLastRelatedTransaction: 35,
      relatedModule: 'workouts',
    });

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('suggestion');
    expect(result!.message).toContain('$49.99/mo');
    expect(result!.message).toContain('35 days');
    expect(result!.modules).toContain('workouts');
  });

  it('returns warning for 60+ day gap', () => {
    const result = checkSubscriptionUsage({
      subscriptionName: 'Gym',
      monthlyCostCents: 4999,
      daysSinceLastRelatedTransaction: 65,
      relatedModule: 'workouts',
    });

    expect(result!.severity).toBe('warning');
  });
});

describe('checkSpendingHabitCorrelation', () => {
  it('returns null when spending change is small', () => {
    const result = checkSpendingHabitCorrelation({
      categoryName: 'Dining Out',
      currentMonthCents: 11000,
      priorMonthCents: 10000,
      relatedHabitStreak: 0,
      habitName: 'meal prep',
    });
    expect(result).toBeNull(); // 10% increase, below 20% threshold
  });

  it('returns insight when spending up and habit streak broken', () => {
    const result = checkSpendingHabitCorrelation({
      categoryName: 'Dining Out',
      currentMonthCents: 34000,
      priorMonthCents: 20000,
      relatedHabitStreak: 0,
      habitName: 'meal prep',
    });

    expect(result).not.toBeNull();
    expect(result!.message).toContain('70%');
    expect(result!.message).toContain('meal prep');
    expect(result!.message).toContain('streak is at 0');
    expect(result!.modules).toContain('habits');
  });

  it('returns null when habit streak is healthy', () => {
    const result = checkSpendingHabitCorrelation({
      categoryName: 'Dining Out',
      currentMonthCents: 30000,
      priorMonthCents: 20000,
      relatedHabitStreak: 7,
      habitName: 'meal prep',
    });
    expect(result).toBeNull();
  });
});

describe('checkDiningVsGroceryRatio', () => {
  it('returns null when ratio is reasonable', () => {
    const result = checkDiningVsGroceryRatio({
      grocerySpendingCents: 40000,
      diningOutSpendingCents: 30000,
      nutritionScore: null,
    });
    expect(result).toBeNull(); // ratio 0.75
  });

  it('returns suggestion when dining exceeds groceries by 1.5x', () => {
    const result = checkDiningVsGroceryRatio({
      grocerySpendingCents: 20000,
      diningOutSpendingCents: 40000,
      nutritionScore: null,
    });

    expect(result).not.toBeNull();
    expect(result!.message).toContain('2.0x');
    expect(result!.severity).toBe('suggestion');
  });

  it('returns warning with low nutrition score', () => {
    const result = checkDiningVsGroceryRatio({
      grocerySpendingCents: 10000,
      diningOutSpendingCents: 35000,
      nutritionScore: 55,
    });

    expect(result).not.toBeNull();
    expect(result!.severity).toBe('warning');
    expect(result!.message).toContain('55/100');
    expect(result!.modules).toContain('nutrition');
  });
});

describe('projectGoalCompletion', () => {
  it('returns null when no goal', () => {
    const result = projectGoalCompletion({
      savingsRate: 0.2,
      monthlySurplusCents: 50000,
      goalName: null,
      goalRemainingCents: 0,
    });
    expect(result).toBeNull();
  });

  it('returns null when no surplus', () => {
    const result = projectGoalCompletion({
      savingsRate: 0,
      monthlySurplusCents: 0,
      goalName: 'Emergency Fund',
      goalRemainingCents: 500000,
    });
    expect(result).toBeNull();
  });

  it('projects completion date', () => {
    const result = projectGoalCompletion({
      savingsRate: 0.2,
      monthlySurplusCents: 100000, // $1,000/mo
      goalName: 'Emergency Fund',
      goalRemainingCents: 300000, // $3,000 remaining
    });

    expect(result).not.toBeNull();
    expect(result!.message).toContain('Emergency Fund');
    expect(result!.message).toContain('$3000');
    expect(result!.category).toBe('savings');
  });
});

describe('generateInsights', () => {
  it('runs all generators and filters nulls', () => {
    const results = generateInsights({
      subscriptionActivity: [
        {
          subscriptionName: 'Gym',
          monthlyCostCents: 4999,
          daysSinceLastRelatedTransaction: 45,
          relatedModule: 'workouts',
        },
        {
          subscriptionName: 'Spotify',
          monthlyCostCents: 999,
          daysSinceLastRelatedTransaction: 2,
          relatedModule: 'voice',
        },
      ],
      spendingHabits: [
        {
          categoryName: 'Dining Out',
          currentMonthCents: 30000,
          priorMonthCents: 20000,
          relatedHabitStreak: 0,
          habitName: 'meal prep',
        },
      ],
    });

    // Gym should produce an insight (45 days), Spotify should not (2 days)
    // Dining should produce an insight (50% up, streak 0)
    expect(results).toHaveLength(2);
    expect(results.some((i) => i.id.includes('gym'))).toBe(true);
    expect(results.some((i) => i.id.includes('dining'))).toBe(true);
  });

  it('returns empty array when no data provided', () => {
    const results = generateInsights({});
    expect(results).toHaveLength(0);
  });
});
