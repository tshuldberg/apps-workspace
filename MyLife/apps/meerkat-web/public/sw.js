// Meerkat PWA service worker. ONE service worker, TWO jobs (both real, both
// capability-gated). It never precaches an app shell and claims NO offline
// capability -- there is no fetch-through cache.
//
// Job 1 -- Web Share Target receive path (Plan 20, Phase 10 web): it intercepts
// the multipart POST the OS share sheet sends to /share-target, stashes the
// shared text + files into the Cache API, and redirects the SPA to
// /?share-target=1. The SPA drains that stash on boot (web-share-target.ts) and
// stages it DEVICE-LOCALLY through the real @mylife/sync share-intake engine. A
// staged item is never "sent"; that only happens when the user routes it into a
// real channel/files message in the app.
//
// Job 2 -- Web Push wake path (Plan 42 P6 / WP-42D): it listens for 'push'
// events a paired peer triggered through the push gateway and, for a CLOSED page,
// shows a bounded generic "new activity" notification and lets the page run the
// real mailbox drain on open. For an OPEN page it posts a wake message so the
// page drains immediately. CLOSED-PAGE HONESTY (AC-42.10): this worker CANNOT
// mutate the SQLite database -- the DB lives in the page. It never decrypts the
// opaque wake payload, never renders message content (NC-42.3), and never claims
// delivery (NC-42.4). The pure decisions it mirrors live in
// src/lib/web-push-sw-core.ts (unit-tested); this file is the plain-JS twin.
//
// Both jobs are added to the SAME registration so enabling push never clobbers
// the share-target handler and vice versa.

const SHARE_CACHE = 'mk-web-share-v1';
const SHARE_MANIFEST_URL = '/__mk_share_manifest__';

// Kept byte-identical with src/lib/web-push-sw-core.ts.
const WEB_PUSH_WAKE_MESSAGE = 'meerkat-push-wake';
const WEB_PUSH_OPEN_FLAG = 'push-wake';
const WEB_PUSH_TARGET_PATH = `/?${WEB_PUSH_OPEN_FLAG}=1`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith(handleShareTarget(event.request));
  }
  // Every other request falls through to the network untouched (no caching).
});

async function handleShareTarget(request) {
  try {
    const form = await request.formData();
    const cache = await caches.open(SHARE_CACHE);

    const rawFiles = form.getAll('files');
    const fileKeys = [];
    let index = 0;
    for (const entry of rawFiles) {
      if (!entry || typeof entry === 'string' || typeof entry.arrayBuffer !== 'function') continue;
      const key = `/__mk_share_file__/${index}`;
      fileKeys.push({ key, name: entry.name || `file-${index}`, type: entry.type || '' });
      await cache.put(
        key,
        new Response(entry, {
          headers: { 'content-type': entry.type || 'application/octet-stream' },
        }),
      );
      index += 1;
    }

    const manifest = {
      title: String(form.get('title') || ''),
      text: String(form.get('text') || ''),
      url: String(form.get('url') || ''),
      files: fileKeys,
      at: Date.now(),
    };
    await cache.put(
      SHARE_MANIFEST_URL,
      new Response(JSON.stringify(manifest), {
        headers: { 'content-type': 'application/json' },
      }),
    );
  } catch (err) {
    // Fall through to the redirect even on failure; the SPA drains nothing.
  }
  // 303 See Other so the browser re-issues a GET for the SPA.
  return Response.redirect('/?share-target=1', 303);
}

// --- Job 2: Web Push wake (Plan 42 P6) --------------------------------------

self.addEventListener('push', (event) => {
  event.waitUntil(handlePushWake());
});

async function handlePushWake() {
  // If a Meerkat client is already focused, post a wake to it so the PAGE runs
  // the real mailbox drain immediately, and suppress the notification (no double
  // signal). Otherwise show the generic content-free notification and let the
  // page drain on open. The worker never touches the DB here.
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  const focused = clientList.find((c) => c.focused || c.visibilityState === 'visible');
  if (focused) {
    focused.postMessage({ type: WEB_PUSH_WAKE_MESSAGE });
    return;
  }
  // No focused client: show ONE generic wake notification. The wake payload is
  // opaque; we deliberately render no message content (NC-42.3) and no count
  // (NC-42.4). If notifications are somehow unavailable, this is a silent no-op.
  if (!self.registration || !self.registration.showNotification) return;
  await self.registration.showNotification('Meerkat', {
    body: 'New activity is waiting. Open Meerkat to catch up.',
    tag: 'meerkat-wake',
    renotify: false,
    data: { targetPath: WEB_PUSH_TARGET_PATH },
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath =
    (event.notification.data && event.notification.data.targetPath) || WEB_PUSH_TARGET_PATH;
  event.waitUntil(focusOrOpen(targetPath));
});

async function focusOrOpen(targetPath) {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  // Focus an already-open Meerkat tab (same origin) rather than duplicating it;
  // the page reads ?push-wake=1 on focus and drains. Fall back to a fresh window.
  for (const client of clientList) {
    if ('focus' in client) {
      client.postMessage({ type: WEB_PUSH_WAKE_MESSAGE });
      return client.focus();
    }
  }
  if (self.clients.openWindow) return self.clients.openWindow(targetPath);
}

// pushsubscriptionchange fires when the browser rotates this subscription. The SW
// cannot re-register with the gateway on its own (it has no registration secret),
// so it wakes any open client to re-subscribe + re-register through the page
// (web-push-registration.ts). If nothing is open, the page re-subscribes on its
// next boot. The worker never fabricates a rotated registration.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(notifyClientsOfSubscriptionChange());
});

async function notifyClientsOfSubscriptionChange() {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  for (const client of clientList) {
    client.postMessage({ type: WEB_PUSH_WAKE_MESSAGE, reason: 'subscriptionchange' });
  }
}
