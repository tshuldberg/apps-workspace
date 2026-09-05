import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isStoreActionBusy, phaseAfterStoreFailure, showsBuyAction, showsRestoreAction } from '../(root)/data/unlock-view-core';

describe('unlock screen fail-closed affordances', () => {
  it('routes a store failure back to unavailable when purchases are not configured', () => {
    expect(phaseAfterStoreFailure(false)).toBe('unavailable');
    expect(phaseAfterStoreFailure(true)).toBe('error');
  });

  it('never offers the buy button in a not-configured build', () => {
    // The dishonest combination from the 2026-08-30 TestFlight screenshot: an
    // enabled "Unlock for $4.99" next to "not available in this build".
    expect(showsBuyAction(phaseAfterStoreFailure(false))).toBe(false);
    expect(showsBuyAction('unavailable')).toBe(false);
    expect(showsBuyAction('loading')).toBe(false);
    expect(showsBuyAction('restoring')).toBe(false);
    expect(showsBuyAction('unlocked')).toBe(false);
    expect(showsBuyAction('ready')).toBe(true);
    expect(showsBuyAction('error')).toBe(true);
  });

  it('holds both actions while a store action is in flight (double-tap protection)', () => {
    expect(isStoreActionBusy('purchasing')).toBe(true);
    expect(isStoreActionBusy('restoring')).toBe(true);
    expect(isStoreActionBusy('ready')).toBe(false);
    expect(showsBuyAction('purchasing')).toBe(false);
    expect(showsRestoreAction('purchasing', true)).toBe(false);
  });

  it('offers restore in unavailable only when the purchases SDK is configured', () => {
    expect(showsRestoreAction('unavailable', false)).toBe(false);
    expect(showsRestoreAction('unavailable', true)).toBe(true);
    expect(showsRestoreAction('ready', false)).toBe(true);
    expect(showsRestoreAction('error', true)).toBe(true);
  });
});

describe('upgrade.tsx wiring guard', () => {
  const source = readFileSync(join(__dirname, '..', '(root)', 'upgrade.tsx'), 'utf8');

  it('routes purchase and restore failures through phaseAfterStoreFailure', () => {
    const matches = source.match(/phaseAfterStoreFailure\(isPurchasesConfigured\(\)\)/gu) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // Never an unconditional error phase right after a store error message; the
    // one remaining direct 'error' is the configured-store "no unlock
    // registered" path.
    expect(source).not.toMatch(/setMessage\((?:outcome|result)\.error\);\s*setPhase\('error'\)/u);
  });

  it('gates the unavailable-state restore button on the SDK being configured', () => {
    expect(source).toContain("showsRestoreAction('unavailable', isPurchasesConfigured())");
  });

  it('marks build blockers with a non-ready notice tone', () => {
    expect(source).toContain('tone="warning"');
  });
});
