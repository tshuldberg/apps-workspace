/**
 * Pre-publication screening (plan 48 WP8). Pure, deterministic, data-driven.
 * Consumed by the edge functions through the Deno twin in
 * supabase/functions/_shared/mynews-screening.ts, which is drift-pinned against
 * this directory by screening/__tests__/edge-mirror.test.ts.
 */

export * from './types';
export * from './normalize';
export * from './lexicons';
export * from './matcher';
export * from './urls';
export * from './signature';
export * from './engine';
export * from './provider';
