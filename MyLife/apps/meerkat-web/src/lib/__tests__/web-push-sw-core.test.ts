// Web Push service-worker core (Plan 42 P6 / WP-42D). The pure decisions the
// plain-JS service worker mirrors: closed-page notification plan, focused-client
// wake routing, and click focus-or-open. Closed-page honesty (AC-42.10) is
// asserted here: the plan is content-free and the worker never claims a mutation.

import { describe, expect, it } from 'vitest';
import {
  buildWakeNotificationPlan,
  decideNotificationClick,
  decidePushAction,
  hasPendingPushWake,
  WEB_PUSH_OPEN_FLAG,
  WEB_PUSH_WAKE_MESSAGE,
} from '../web-push-sw-core';

describe('buildWakeNotificationPlan (closed-page honesty)', () => {
  const plan = buildWakeNotificationPlan();

  it('is a generic, content-free "new activity" nudge (no message text, no count)', () => {
    expect(plan.title).toBe('Meerkat');
    expect(plan.body.toLowerCase()).toContain('new activity');
    // No delivery/count claim (NC-42.4) and no plaintext content (NC-42.3).
    expect(plan.body).not.toMatch(/\d+ (new )?messages?/i);
    expect(plan.body).not.toMatch(/from /i);
  });

  it('targets the app root with the push-wake flag so the page drains on open', () => {
    expect(plan.targetPath).toBe(`/?${WEB_PUSH_OPEN_FLAG}=1`);
    expect(plan.tag).toBe('meerkat-wake');
  });
});

describe('decidePushAction', () => {
  it('wakes the focused client and suppresses the notification when a client is open', () => {
    expect(decidePushAction({ hasFocusedClient: true })).toEqual({
      showNotification: false,
      wakeClients: true,
    });
  });

  it('shows the notification and defers the drain when no client is focused', () => {
    expect(decidePushAction({ hasFocusedClient: false })).toEqual({
      showNotification: true,
      wakeClients: false,
    });
  });
});

describe('decideNotificationClick', () => {
  it('focuses an already-open Meerkat client rather than opening a duplicate', () => {
    const result = decideNotificationClick({
      openClientUrls: ['https://app.example/feed'],
      targetPath: '/?push-wake=1',
    });
    expect(result.focusExistingUrl).toBe('https://app.example/feed');
    expect(result.openPath).toBe('/?push-wake=1');
  });

  it('opens a fresh window when nothing is open', () => {
    const result = decideNotificationClick({ openClientUrls: [], targetPath: '/?push-wake=1' });
    expect(result.focusExistingUrl).toBeNull();
    expect(result.openPath).toBe('/?push-wake=1');
  });
});

describe('hasPendingPushWake', () => {
  it('detects the SW post-click flag on the URL', () => {
    expect(hasPendingPushWake('?push-wake=1')).toBe(true);
    expect(hasPendingPushWake('?other=1')).toBe(false);
    expect(hasPendingPushWake('')).toBe(false);
  });
});

describe('shared constants', () => {
  it('exposes the wake message + open flag the page listener keys off', () => {
    expect(WEB_PUSH_WAKE_MESSAGE).toBe('meerkat-push-wake');
    expect(WEB_PUSH_OPEN_FLAG).toBe('push-wake');
  });
});
