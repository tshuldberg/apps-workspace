// PWA Web Share Target (Plan 20, Phase 10 web), CAPABILITY-GATED. The web analog
// of the iOS Share Extension / Android ACTION_SEND: it lets OTHER apps share INTO
// the installed Meerkat PWA. It is entirely OPTIONAL and feature-detected. When
// the browser cannot support it (no service worker, no Cache API, insecure
// context) EVERYTHING here is a no-op and the UI entry is ABSENT -- never a faked
// always-rendered button.
//
// Flow (real, but device-QA-only -- needs HTTPS + an installed PWA, founder-ops):
//   1. manifest.webmanifest declares share_target -> POST /share-target.
//   2. sw.js intercepts that POST, stashes the shared text/files in the Cache API,
//      and redirects the SPA to /?share-target=1.
//   3. the SPA drains the stash on boot (drainWebShareTarget) and stages it
//      device-locally through the real @mylife/sync share-intake engine.
// The Cache API is the ONLY thing this SW touches; it claims no offline capability.

import type { WebShareItemInput } from './share-route';

export const WEB_SHARE_TARGET_FLAG = 'share-target';
export const WEB_SHARE_TARGET_ACTION = '/share-target';
const SERVICE_WORKER_URL = '/sw.js';
const SHARE_CACHE = 'mk-web-share-v1';
const SHARE_MANIFEST_URL = '/__mk_share_manifest__';

interface ShareManifest {
  title?: string;
  text?: string;
  url?: string;
  files?: { key: string; name: string; type: string }[];
}

/** The globals the capability gate reads, injectable so it is unit-testable. */
export interface WebShareTargetScope {
  navigator?: { serviceWorker?: unknown } | undefined;
  caches?: unknown;
}

/**
 * True ONLY when this browser can actually host a Web Share Target: a service
 * worker (to handle the share POST) AND the Cache API (to stash the payload).
 * When false the registration + drain are no-ops and the UI entry is hidden.
 */
export function isWebShareTargetSupported(
  scope: WebShareTargetScope = globalThis as WebShareTargetScope,
): boolean {
  const nav = scope.navigator as { serviceWorker?: unknown } | undefined;
  return Boolean(nav && 'serviceWorker' in nav && typeof scope.caches !== 'undefined');
}

/** Register the share-target service worker. No-op (returns false) when unsupported. */
export async function registerWebShareTarget(): Promise<boolean> {
  if (!isWebShareTargetSupported()) return false;
  try {
    const nav = navigator as unknown as {
      serviceWorker: { register: (u: string) => Promise<unknown> };
    };
    await nav.serviceWorker.register(SERVICE_WORKER_URL);
    return true;
  } catch {
    return false;
  }
}

/** Whether the current URL carries the share-target redirect flag. */
export function hasPendingWebShare(
  search: string = typeof location !== 'undefined' ? location.search : '',
): boolean {
  try {
    return new URLSearchParams(search).get(WEB_SHARE_TARGET_FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Drain the payload the service worker stashed for a Web Share Target POST, if
 * any, and clear it. Returns the items ready for stageWebShare, or null when
 * unsupported or nothing is stashed. Bytes are read back raw so stageWebShare
 * re-sniffs the real MIME (the declared type is only a hint).
 */
export async function drainWebShareTarget(): Promise<WebShareItemInput[] | null> {
  if (!isWebShareTargetSupported()) return null;
  const cacheApi = (globalThis as unknown as { caches?: CacheStorage }).caches;
  if (!cacheApi) return null;
  const cache = await cacheApi.open(SHARE_CACHE);
  const manifestRes = await cache.match(SHARE_MANIFEST_URL);
  if (!manifestRes) return null;

  let manifest: ShareManifest;
  try {
    manifest = (await manifestRes.json()) as ShareManifest;
  } catch {
    await cache.delete(SHARE_MANIFEST_URL);
    return null;
  }

  const items: WebShareItemInput[] = [];
  const textParts = [manifest.title, manifest.text, manifest.url]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  if (textParts.length > 0) items.push({ text: textParts.join(' ') });

  for (const file of manifest.files ?? []) {
    const res = await cache.match(file.key);
    if (!res) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    items.push({ bytes, declaredMime: file.type, filename: file.name });
    await cache.delete(file.key);
  }
  await cache.delete(SHARE_MANIFEST_URL);
  return items.length > 0 ? items : null;
}
