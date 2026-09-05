// The Stripe Checkout return (?unlock=success) must be confirmed against the
// hosted API; the query param is forgeable and never an unlock by itself.
// Before 2026-08-30 nothing consumed the param at all: a fresh buyer returned
// from Stripe still showing locked until they manually tapped Restore.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'settings', 'AppUnlockSection.tsx'), 'utf8');

describe('AppUnlockSection Stripe return handling', () => {
  it('consumes the unlock query param and strips it from the URL', () => {
    expect(source).toContain("params.get('unlock')");
    expect(source).toContain("params.delete('unlock')");
    expect(source).toContain('window.history.replaceState');
  });

  it('confirms success server-side and never unlocks from the param alone', () => {
    const handler = source.slice(source.indexOf("params.get('unlock')"), source.indexOf('const onCheckout'));
    expect(handler).toContain('fetchAppUnlockState(authorization)');
    // 2026-08-30: the section holds NO local unlocked state at all. The server
    // answer written by fetchAppUnlockState flows through the cache listeners
    // into the provider's validated machine; nothing here can set unlocked.
    expect(source).not.toContain('setUnlocked(');
    expect(source).toContain("m.appUnlock.status === 'unlocked'");
  });

  it('states the cancel outcome honestly', () => {
    expect(source).toContain('Checkout was canceled. Nothing was charged.');
  });
});
