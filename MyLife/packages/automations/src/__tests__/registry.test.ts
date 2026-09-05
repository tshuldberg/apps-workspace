import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRegistryForTests,
  getRule,
  listRules,
  registerRule,
} from '../registry';
import type { AutomationRule } from '../types';

function makeRule(id: string): AutomationRule<unknown, unknown, unknown> {
  return {
    id,
    label: `Rule ${id}`,
    description: `Description for ${id}`,
    clusters: ['body'],
    check: () => null,
    previewCard: () => ({
      title: 'title',
      subtitle: 'subtitle',
      cta: { apply: 'Apply', dismiss: 'Dismiss' },
    }),
    apply: () => undefined,
  };
}

describe('automation registry', () => {
  afterEach(() => {
    clearRegistryForTests();
  });

  it('registers a rule and retrieves it by id', () => {
    const rule = makeRule('receipt-to-budget');
    registerRule(rule);
    expect(getRule('receipt-to-budget')).toBe(rule);
  });

  it('throws when registering a duplicate id', () => {
    registerRule(makeRule('dup'));
    expect(() => registerRule(makeRule('dup'))).toThrow(
      /already registered/i,
    );
  });

  it('listRules returns every registered rule', () => {
    const a = makeRule('a');
    const b = makeRule('b');
    registerRule(a);
    registerRule(b);
    const rules = listRules();
    expect(rules).toHaveLength(2);
    expect(rules).toContain(a);
    expect(rules).toContain(b);
  });

  it('clearRegistryForTests empties the registry', () => {
    registerRule(makeRule('will-clear'));
    expect(listRules()).toHaveLength(1);
    clearRegistryForTests();
    expect(listRules()).toHaveLength(0);
    expect(getRule('will-clear')).toBeUndefined();
  });

  it('getRule returns undefined for unknown ids', () => {
    expect(getRule('never-registered')).toBeUndefined();
  });
});
