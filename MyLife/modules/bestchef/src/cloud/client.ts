/**
 * BestChef Supabase client wrapper.
 *
 * Follows the lazy-init singleton pattern from @mylife/auth.
 * The shared Supabase client is obtained from @mylife/auth; this module
 * stores a reference so cloud operations can access it without prop-drilling.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export const BESTCHEF_PRODUCT_CACHE_TABLES = {
  records: 'bc_product_records',
  aliases: 'bc_product_aliases',
  nutrition: 'bc_product_nutrition',
  contributions: 'bc_product_contributions',
  evidence: 'bc_product_evidence',
} as const;

export const PRIVATE_PRODUCT_CONTRIBUTION_KEYS = [
  'pantry_quantity',
  'pantry_item_id',
  'pantry_batch_id',
  'receipt_import_id',
  'receipt_line_id',
  'receipt_attachment_id',
  'receipt_image_uri',
  'receipt_photo_uri',
  'source_image_uri',
  'source_photo_uri',
  'local_image_uri',
  'photo_uri',
  'image_base64',
  'crop_uri',
  'bounding_box',
  'raw_description',
  'candidate_json',
  'parsed_json',
  'redactions_json',
  'redacted_ocr_text',
  'raw_receipt_ocr_text',
  'raw_ocr_text',
] as const;

export type BestChefProductCacheTable =
  (typeof BESTCHEF_PRODUCT_CACHE_TABLES)[keyof typeof BESTCHEF_PRODUCT_CACHE_TABLES];

/**
 * Initialize the BestChef cloud client.
 * Call once during app startup after the shared Supabase client is ready.
 */
export function initBestChefClient(supabase: SupabaseClient): void {
  _supabase = supabase;
}

/**
 * Get the BestChef Supabase client.
 * Throws if `initBestChefClient` has not been called.
 */
export function getBestChefClient(): SupabaseClient {
  if (!_supabase) {
    throw new Error(
      'BestChef client not initialized. Call initBestChefClient() first.',
    );
  }
  return _supabase;
}

/** Reset the client (for tests). */
export function resetBestChefClient(): void {
  _supabase = null;
}

// ── Result helpers ─────────────────────────────────────────────────────

export type BestChefResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): BestChefResult<T> {
  return { ok: true, data };
}

export function err<T>(error: string): BestChefResult<T> {
  return { ok: false, error };
}
