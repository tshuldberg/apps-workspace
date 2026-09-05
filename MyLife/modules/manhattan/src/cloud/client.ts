/**
 * Manhattan Supabase client wrapper.
 *
 * Follows the lazy-init singleton pattern from @mylife/auth.
 * The shared Supabase client is obtained from @mylife/auth; this module
 * stores a reference so cloud operations can access it without prop-drilling.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

/**
 * Initialize the Manhattan cloud client.
 * Call once during app startup after the shared Supabase client is ready.
 */
export function initManhattanClient(supabase: SupabaseClient): void {
  _supabase = supabase;
}

/**
 * Get the Manhattan Supabase client.
 * Throws if `initManhattanClient` has not been called.
 */
export function getManhattanClient(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      'Manhattan client not initialized. Call initManhattanClient() first.',
    );
  }
  return _supabase;
}

/** Reset the client (for tests). */
export function resetManhattanClient(): void {
  _supabase = null;
}

/** Whether the Manhattan cloud client has been initialized. */
export function hasManhattanClient(): boolean {
  return _supabase !== null;
}
