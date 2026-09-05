import { describe, it, expect } from 'vitest';
import { evaluateAlertRule, evaluateAlertRules } from '../alerts';
import type { AlertRule, AlertConditions } from '../../types';

// ── Helpers ──

function makeRule(overrides: Partial<AlertRule> & Pick<AlertRule, 'parameter' | 'operator' | 'value'>): AlertRule {
  return {
    joinWith: 'and',
    sortOrder: 0,
    ...overrides,
  } as AlertRule;
}

describe('evaluateAlertRule', () => {
  const conditions: AlertConditions = {
    swell_height_ft: 5,
    wind_speed_kts: 15,
    rating: 3,
    consistency: 70,
    energy_kj: 2.5,
    water_temp_f: 58,
  };

  // ── gt operator ──

  it('returns true for wave_height > 4 when value is 5', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 4 }),
        conditions,
      ),
    ).toBe(true);
  });

  it('returns false for wave_height > 5 when value is 5', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 5 }),
        conditions,
      ),
    ).toBe(false);
  });

  // ── gte operator ──

  it('returns true for wind_speed >= 15 when value is 15', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'wind_speed_kts', operator: 'gte', value: 15 }),
        conditions,
      ),
    ).toBe(true);
  });

  // ── lt operator ──

  it('returns true for wind_speed < 20 when value is 15', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'wind_speed_kts', operator: 'lt', value: 20 }),
        conditions,
      ),
    ).toBe(true);
  });

  it('returns false for wind_speed < 10 when value is 15', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'wind_speed_kts', operator: 'lt', value: 10 }),
        conditions,
      ),
    ).toBe(false);
  });

  // ── lte operator ──

  it('returns true for rating <= 3 when value is 3', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'rating', operator: 'lte', value: 3 }),
        conditions,
      ),
    ).toBe(true);
  });

  // ── eq operator ──

  it('returns true for rating eq 3 when value is 3', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'rating', operator: 'eq', value: 3 }),
        conditions,
      ),
    ).toBe(true);
  });

  it('returns false for rating eq 4 when value is 3', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'rating', operator: 'eq', value: 4 }),
        conditions,
      ),
    ).toBe(false);
  });

  // ── Missing parameter ──

  it('returns false when parameter is not present in conditions', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'wind_speed_mph', operator: 'gt', value: 0 }),
        conditions,
      ),
    ).toBe(false);
  });

  it('returns false for empty conditions', () => {
    expect(
      evaluateAlertRule(
        makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 0 }),
        {},
      ),
    ).toBe(false);
  });
});

describe('evaluateAlertRules', () => {
  const conditions: AlertConditions = {
    swell_height_ft: 5,
    wind_speed_kts: 8,
    rating: 4,
    consistency: 80,
  };

  // ── Empty rules ──

  it('returns false for empty rules array', () => {
    expect(evaluateAlertRules([], conditions)).toBe(false);
  });

  // ── Single rule ──

  it('returns true for a single passing rule', () => {
    const rules = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 3 }),
    ];
    expect(evaluateAlertRules(rules, conditions)).toBe(true);
  });

  it('returns false for a single failing rule', () => {
    const rules = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 10 }),
    ];
    expect(evaluateAlertRules(rules, conditions)).toBe(false);
  });

  // ── AND logic ──

  it('returns true when all AND rules pass', () => {
    const rules: AlertRule[] = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 3, sortOrder: 0 }),
      makeRule({ parameter: 'wind_speed_kts', operator: 'lt', value: 10, joinWith: 'and', sortOrder: 1 }),
    ];
    expect(evaluateAlertRules(rules, conditions)).toBe(true);
  });

  it('returns false when any AND rule fails', () => {
    const rules: AlertRule[] = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 3, sortOrder: 0 }),
      makeRule({ parameter: 'wind_speed_kts', operator: 'lt', value: 5, joinWith: 'and', sortOrder: 1 }),
    ];
    expect(evaluateAlertRules(rules, conditions)).toBe(false);
  });

  // ── OR logic ──

  it('returns true when any OR rule passes', () => {
    const rules: AlertRule[] = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 10, sortOrder: 0 }), // fails
      makeRule({ parameter: 'rating', operator: 'gte', value: 4, joinWith: 'or', sortOrder: 1 }), // passes
    ];
    expect(evaluateAlertRules(rules, conditions)).toBe(true);
  });

  it('returns false when all OR rules fail', () => {
    const rules: AlertRule[] = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 10, sortOrder: 0 }),
      makeRule({ parameter: 'rating', operator: 'gte', value: 5, joinWith: 'or', sortOrder: 1 }),
    ];
    expect(evaluateAlertRules(rules, conditions)).toBe(false);
  });

  // ── Mixed AND/OR chains ──

  it('evaluates mixed AND/OR chain correctly', () => {
    // (swell > 3) AND (wind < 10) OR (rating >= 5)
    // = ((swell > 3) AND (wind < 10)) OR (rating >= 5)
    const rules: AlertRule[] = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 3, sortOrder: 0 }),     // true
      makeRule({ parameter: 'wind_speed_kts', operator: 'lt', value: 10, joinWith: 'and', sortOrder: 1 }),  // true
      makeRule({ parameter: 'rating', operator: 'gte', value: 5, joinWith: 'or', sortOrder: 2 }),          // false
    ];
    // (true AND true) OR false = true
    expect(evaluateAlertRules(rules, conditions)).toBe(true);
  });

  it('evaluates left-to-right: (false AND true) OR true = true', () => {
    const rules: AlertRule[] = [
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 10, sortOrder: 0 }),    // false
      makeRule({ parameter: 'wind_speed_kts', operator: 'lt', value: 10, joinWith: 'and', sortOrder: 1 }), // true
      makeRule({ parameter: 'rating', operator: 'gte', value: 4, joinWith: 'or', sortOrder: 2 }),          // true
    ];
    // (false AND true) OR true = false OR true = true
    expect(evaluateAlertRules(rules, conditions)).toBe(true);
  });

  // ── Sort order ──

  it('respects sortOrder for evaluation order', () => {
    const rules: AlertRule[] = [
      makeRule({ parameter: 'rating', operator: 'gte', value: 5, joinWith: 'or', sortOrder: 2 }),          // evaluated 3rd
      makeRule({ parameter: 'swell_height_ft', operator: 'gt', value: 3, sortOrder: 0 }),                  // evaluated 1st
      makeRule({ parameter: 'wind_speed_kts', operator: 'lt', value: 10, joinWith: 'and', sortOrder: 1 }), // evaluated 2nd
    ];
    // After sorting: swell > 3 (true) AND wind < 10 (true) OR rating >= 5 (false) = true
    expect(evaluateAlertRules(rules, conditions)).toBe(true);
  });
});
