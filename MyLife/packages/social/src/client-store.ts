/**
 * @mylife/social -- SocialClient singleton store.
 *
 * Separated from hooks.ts so that server-side code (activity-emitter, etc.)
 * can access the client without pulling in React hook imports.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { SocialClient } from './client';

let _client: SocialClient | null = null;
let _clientVersion = 0;
const _clientListeners = new Set<() => void>();

export function notifyClientListeners(): void {
  _clientVersion++;
  for (const listener of _clientListeners) {
    listener();
  }
}

export function getClientVersion(): number {
  return _clientVersion;
}

export function subscribeClientListeners(listener: () => void): () => void {
  _clientListeners.add(listener);
  return () => _clientListeners.delete(listener);
}

/** Initialize the social client. Call during app startup. */
export function setSocialClient(supabase: SupabaseClient): void {
  _client = new SocialClient(supabase);
  notifyClientListeners();
}

/** Get the social client (for non-React code). */
export function getSocialClient(): SocialClient | null {
  return _client;
}

/** Reset the social client (for tests). */
export function resetSocialClient(): void {
  _client = null;
  notifyClientListeners();
}
