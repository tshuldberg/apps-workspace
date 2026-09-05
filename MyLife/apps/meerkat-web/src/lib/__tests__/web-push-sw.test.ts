// Service worker behavioral test (Plan 42 P6 / WP-42D). Loads the REAL public/sw.js
// inside a mocked ServiceWorkerGlobalScope and drives the push, notificationclick,
// and pushsubscriptionchange listeners. Proves the closed-page honesty contract
// (AC-42.10): a closed-page push shows ONE generic notification and NEVER mutates
// a database (there is no DB handle in the worker at all); a focused-client push
// posts a wake instead; a click focuses/opens; a rotation wakes clients to
// re-register. It also confirms the share-target fetch handler still exists so the
// push additions did not clobber Job 1.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeClient {
  url: string;
  focused: boolean;
  visibilityState: string;
  focus: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
}

interface Listeners {
  [event: string]: ((event: unknown) => void) | undefined;
}

function loadServiceWorker(clients: FakeClient[]) {
  const swPath = fileURLToPath(new URL('../../../public/sw.js', import.meta.url));
  const source = readFileSync(swPath, 'utf8');

  const listeners: Listeners = {};
  const showNotification = vi.fn(
    async (_title: string, _options: { body: string; tag: string; data: { targetPath: string } }) =>
      undefined,
  );
  const openWindow = vi.fn(async (url: string) => ({ url }));
  const matchAll = vi.fn(async () => clients);

  const self: Record<string, unknown> = {
    addEventListener: (event: string, listener: (e: unknown) => void) => {
      listeners[event] = listener;
    },
    skipWaiting: vi.fn(),
    registration: { showNotification },
    clients: { matchAll, claim: vi.fn(), openWindow },
    caches: { open: vi.fn() },
  };

  const context = vm.createContext({ self, URL, Response, caches: self.caches, console });
  vm.runInContext(source, context);

  return { listeners, showNotification, openWindow, matchAll };
}

/** Await the event.waitUntil promise a handler passes so async work settles. */
async function dispatch(listener: ((e: unknown) => void) | undefined, event: Record<string, unknown>) {
  let waited: Promise<unknown> | undefined;
  const withWaitUntil = {
    ...event,
    waitUntil: (p: Promise<unknown>) => {
      waited = p;
    },
  };
  listener?.(withWaitUntil);
  if (waited) await waited;
}

describe('sw.js Web Push handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers push, notificationclick, pushsubscriptionchange AND the share-target fetch', () => {
    const { listeners } = loadServiceWorker([]);
    expect(typeof listeners.push).toBe('function');
    expect(typeof listeners.notificationclick).toBe('function');
    expect(typeof listeners.pushsubscriptionchange).toBe('function');
    // Job 1 (share target) must still be wired.
    expect(typeof listeners.fetch).toBe('function');
  });

  it('closed page: shows ONE generic notification and mutates no database', async () => {
    const { listeners, showNotification } = loadServiceWorker([]); // no clients => closed
    await dispatch(listeners.push, {});
    expect(showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = showNotification.mock.calls[0]!;
    expect(title).toBe('Meerkat');
    // Content-free (NC-42.3) and no delivery/count claim (NC-42.4).
    expect(String(options.body).toLowerCase()).toContain('new activity');
    expect(String(options.body)).not.toMatch(/\d+ messages?/i);
    expect(options.tag).toBe('meerkat-wake');
    // The worker never had a DB handle: the closed-page limit is structural.
    expect(options.data.targetPath).toBe('/?push-wake=1');
  });

  it('focused client: posts a wake message and shows NO notification', async () => {
    const client: FakeClient = {
      url: 'https://app.example/feed',
      focused: true,
      visibilityState: 'visible',
      focus: vi.fn(),
      postMessage: vi.fn(),
    };
    const { listeners, showNotification } = loadServiceWorker([client]);
    await dispatch(listeners.push, {});
    expect(showNotification).not.toHaveBeenCalled();
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'meerkat-push-wake' });
  });

  it('notificationclick: focuses an open client and posts a wake', async () => {
    const client: FakeClient = {
      url: 'https://app.example/feed',
      focused: false,
      visibilityState: 'hidden',
      focus: vi.fn(async () => undefined),
      postMessage: vi.fn(),
    };
    const { listeners, openWindow } = loadServiceWorker([client]);
    const close = vi.fn();
    await dispatch(listeners.notificationclick, {
      notification: { close, data: { targetPath: '/?push-wake=1' } },
    });
    expect(close).toHaveBeenCalled();
    expect(client.focus).toHaveBeenCalled();
    expect(client.postMessage).toHaveBeenCalledWith({ type: 'meerkat-push-wake' });
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('notificationclick with no open client opens a fresh window at the target', async () => {
    const { listeners, openWindow } = loadServiceWorker([]);
    const close = vi.fn();
    await dispatch(listeners.notificationclick, {
      notification: { close, data: { targetPath: '/?push-wake=1' } },
    });
    expect(openWindow).toHaveBeenCalledWith('/?push-wake=1');
  });

  it('pushsubscriptionchange wakes clients to re-register (SW cannot re-register itself)', async () => {
    const client: FakeClient = {
      url: 'https://app.example/feed',
      focused: false,
      visibilityState: 'hidden',
      focus: vi.fn(),
      postMessage: vi.fn(),
    };
    const { listeners } = loadServiceWorker([client]);
    await dispatch(listeners.pushsubscriptionchange, {});
    expect(client.postMessage).toHaveBeenCalledWith({
      type: 'meerkat-push-wake',
      reason: 'subscriptionchange',
    });
  });
});
