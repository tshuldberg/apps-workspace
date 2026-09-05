// Web Push service-worker CORE (Plan 42 P6 / WP-42D), PURE. The service worker
// (public/push-sw.js) is plain JS with no bundler, so its DECISIONS live here as
// pure, unit-testable functions the tests exercise against a mocked
// ServiceWorkerGlobalScope, and the SW mirrors them verbatim.
//
// CLOSED-PAGE HONESTY (AC-42.10, the load-bearing limit):
//   A push that arrives while the app is fully closed can do exactly two things:
//     1. show a bounded, generic notification (a WAKE hint, never plaintext
//        content and never a delivery claim, NC-42.3/42.4), and
//     2. queue a drain-on-open marker so the page runs the real mailbox drain the
//        next time it opens.
//   It CANNOT open the SQLite database or apply any change: the DB lives in the
//   page, not the worker. The worker never fabricates applied state. When an
//   active client IS focused, the worker instead posts a WAKE message to it so the
//   page drains immediately; the notification is then suppressed to avoid a
//   double signal.

/** The message the SW posts to an active client to trigger an immediate drain. */
export const WEB_PUSH_WAKE_MESSAGE = 'meerkat-push-wake' as const;

/** The query flag the SW appends when it opens/focuses the app after a click. */
export const WEB_PUSH_OPEN_FLAG = 'push-wake';

/** The generic, content-free notification the SW shows for a closed-page wake. */
export interface WebPushNotificationPlan {
  title: string;
  body: string;
  tag: string;
  /** A path/URL to focus on click; always same-origin app root here. */
  targetPath: string;
}

/**
 * The generic wake notification. Deliberately content-free: the wake payload is
 * opaque and the worker cannot (and must not) decrypt or render message text
 * (NC-42.3). It is a "new activity" nudge that opens the app so the real drain can
 * run. The tag coalesces repeated wakes into one notification, never a count of
 * "delivered" messages (NC-42.4).
 */
export function buildWakeNotificationPlan(): WebPushNotificationPlan {
  return {
    title: 'Meerkat',
    body: 'New activity is waiting. Open Meerkat to catch up.',
    tag: 'meerkat-wake',
    targetPath: `/?${WEB_PUSH_OPEN_FLAG}=1`,
  };
}

/**
 * Decide what a 'push' event should do given whether any app client is currently
 * focused/visible. If a client is focused we post a wake to it (immediate,
 * in-page drain) and skip the notification. Otherwise we show the generic
 * notification and let the page drain when it next opens. Pure so the SW test can
 * assert both branches without a live browser.
 */
export function decidePushAction(input: {
  hasFocusedClient: boolean;
}): { showNotification: boolean; wakeClients: boolean } {
  if (input.hasFocusedClient) {
    return { showNotification: false, wakeClients: true };
  }
  return { showNotification: true, wakeClients: false };
}

/**
 * On notificationclick, decide whether to focus an already-open client or open a
 * fresh window. Returns the client URL to focus (when one is already open) or the
 * path to open. Pure: the SW passes in the list of client URLs.
 */
export function decideNotificationClick(input: {
  openClientUrls: readonly string[];
  targetPath: string;
}): { focusExistingUrl: string | null; openPath: string } {
  // Focus any already-open Meerkat client (same origin) rather than spawning a
  // duplicate tab; the page picks up the ?push-wake=1 flag on focus.
  const existing = input.openClientUrls.length > 0 ? input.openClientUrls[0]! : null;
  return { focusExistingUrl: existing, openPath: input.targetPath };
}

/** True when the current URL carries the SW's post-click wake flag. */
export function hasPendingPushWake(
  search: string = typeof location !== 'undefined' ? location.search : '',
): boolean {
  try {
    return new URLSearchParams(search).get(WEB_PUSH_OPEN_FLAG) === '1';
  } catch {
    return false;
  }
}
