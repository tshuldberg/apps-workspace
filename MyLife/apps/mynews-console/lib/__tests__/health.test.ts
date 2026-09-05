import { describe, expect, it } from 'vitest';

import type { ComponentStatus } from '@mylife/mynews';

import {
  COMPONENT_LABEL,
  ageLabel,
  componentLabel,
  depthLabel,
  levelBadgeClass,
  levelText,
  needsAttention,
  statusHeadline,
} from '../health';

function component(overrides: Partial<ComponentStatus> = {}): ComponentStatus {
  return {
    component: 'queue_report',
    kind: 'queue',
    level: 'ok',
    ageSeconds: 30,
    depth: 1,
    reason: 'inside threshold',
    ...overrides,
  };
}

describe('levels', () => {
  it('never renders an unknown component as OK', () => {
    expect(levelText('unknown')).toBe('UNKNOWN');
    expect(levelText('unknown')).not.toBe('OK');
    // And it does not borrow the healthy badge class either.
    expect(levelBadgeClass('unknown')).not.toContain('ok');
  });

  it('maps each level onto a badge class', () => {
    expect(levelBadgeClass('ok')).toBe('badge ok');
    expect(levelBadgeClass('warn')).toBe('badge warn');
    expect(levelBadgeClass('alarm')).toBe('badge warn');
  });

  it('labels every level distinctly', () => {
    const labels = (['ok', 'warn', 'alarm', 'unknown'] as const).map(levelText);
    expect(new Set(labels).size).toBe(4);
  });
});

describe('statusHeadline', () => {
  it('says a down snapshot is unavailable, not empty', () => {
    const headline = statusHeadline('down');
    expect(headline).toContain('could not be read');
    expect(headline).toContain('not as zero');
  });

  it('does not claim health for a degraded status', () => {
    expect(statusHeadline('degraded')).toContain('past a threshold');
    expect(statusHeadline('ok')).toContain('inside their thresholds');
  });
});

describe('ageLabel', () => {
  it('says nothing is waiting rather than printing a zero age', () => {
    expect(ageLabel(null)).toBe('nothing waiting');
  });

  it('scales the unit with the age', () => {
    expect(ageLabel(45)).toBe('45s');
    expect(ageLabel(90)).toBe('1m');
    expect(ageLabel(7_200)).toBe('2h');
    expect(ageLabel(172_800)).toBe('2d');
  });
});

describe('depthLabel', () => {
  it('reads the reconciliation queue as runs recorded, not as a backlog', () => {
    expect(
      depthLabel(component({ component: 'queue_support_reconciliation', depth: 0 })),
    ).toBe('no run recorded');
    expect(
      depthLabel(component({ component: 'queue_support_reconciliation', depth: 3 })),
    ).toBe('3 run(s) recorded');
  });

  it('reports an unknown depth as unknown rather than zero', () => {
    expect(depthLabel(component({ depth: null }))).toBe('unknown');
  });

  it('has no depth for a worker', () => {
    expect(depthLabel(component({ kind: 'worker', depth: null }))).toBe('n/a');
  });

  it('pluralizes a queue depth', () => {
    expect(depthLabel(component({ depth: 1 }))).toBe('1 item');
    expect(depthLabel(component({ depth: 4 }))).toBe('4 items');
  });
});

describe('componentLabel', () => {
  it('names every component the classifier can emit', () => {
    for (const key of [
      'queue_report',
      'queue_ncii',
      'queue_dmca',
      'queue_screening',
      'queue_deletion',
      'queue_support_reconciliation',
      'worker_mynews_ncii_worker',
      'worker_mynews_account_worker',
      'worker_mynews_support_worker',
    ]) {
      expect(COMPONENT_LABEL[key]).toBeTruthy();
    }
  });

  it('falls back to the raw key rather than hiding an unlabelled component', () => {
    expect(componentLabel('queue_brand_new')).toBe('queue_brand_new');
  });
});

describe('needsAttention', () => {
  it('surfaces every non-ok level, including unknown', () => {
    const components = [
      component({ component: 'a', level: 'ok' }),
      component({ component: 'b', level: 'warn' }),
      component({ component: 'c', level: 'alarm' }),
      component({ component: 'd', level: 'unknown' }),
    ];
    expect(needsAttention(components).map((c) => c.component)).toEqual(['b', 'c', 'd']);
  });
});
