// Regression locks for the 2026-08-30 founder freeze: reaching /upgrade through
// the create-community entitlement gate wedged iOS (tap did nothing, then the
// whole app froze). Cause: three actors in one commit raced the native view
// hierarchy: OnboardingGate's imperative router.replace('/upgrade'), AppStack
// swapping its whole <Stack> navigator for a <Redirect>, and the visible RN
// Modal being unmounted outright, leaving a stuck invisible modal window that
// swallowed every touch. These source locks pin the fixed shape.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '(root)');
const layout = readFileSync(join(root, '_layout.tsx'), 'utf8');
const gate = readFileSync(join(root, 'components', 'OnboardingGate.tsx'), 'utf8');
const upgrade = readFileSync(join(root, 'upgrade.tsx'), 'utf8');

describe('AppStack entitlement gate (single, navigator-stable authority)', () => {
  it('never swaps the Stack navigator for a <Redirect>', () => {
    expect(layout).not.toMatch(/<Redirect\s+href/u);
    expect(layout).not.toMatch(/import \{[^}]*\bRedirect\b[^}]*\} from 'expo-router'/u);
  });

  it('gates via an effect-driven replace that keeps the navigator mounted', () => {
    expect(layout).toMatch(/if \(shouldGate\) router\.replace\('\/upgrade'\)/u);
  });
});

describe('OnboardingGate modal-safe navigation', () => {
  it('never navigates imperatively to /upgrade (the AppStack gate owns it)', () => {
    expect(gate).not.toContain("router.replace('/upgrade')");
  });

  it('keeps the main modal mounted and toggles visibility instead of unmounting it', () => {
    expect(gate).toContain('visible={visible}');
    expect(gate).not.toMatch(/if \(complete\) return null/u);
  });

  it('defers every navigation until the modal has dismissed', () => {
    // All router calls live in the single flush; actions only queue PendingNav.
    expect(gate).toContain('onDismiss={flushPendingNav}');
    const imperativeNavs = gate.match(/router\.(?:push|replace)\(/gu) ?? [];
    expect(imperativeNavs).toHaveLength(2); // both inside flushPendingNav
    expect(gate).toMatch(/if \(pendingNav\.kind === 'push'\) router\.push\(pendingNav\.href\);\s*else router\.replace\(pendingNav\.href\);/u);
  });
});

describe('upgrade screen store actions', () => {
  it('guards re-entry and always leaves the busy phase via try/catch', () => {
    const guards = upgrade.match(/if \(isStoreActionBusy\(phase\)\) return;/gu) ?? [];
    expect(guards.length).toBe(2);
    const catches = upgrade.match(/\} catch \(error\) \{/gu) ?? [];
    expect(catches.length).toBeGreaterThanOrEqual(2);
  });

  it('back never dead-ends when the gate replace made this the only route', () => {
    expect(upgrade).toContain('router.canGoBack()');
    expect(upgrade).toMatch(/router\.replace\(phase === 'unlocked' \? '\/' : '\/discover'\)/u);
  });
});
