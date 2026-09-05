/**
 * Single source of truth for the console's env var names. No `server-only`
 * marker so middleware and pages can import the NAMES (never the values)
 * without pulling server-module constraints.
 */

export const ENV_SUPABASE_URL = 'MYNEWS_CONSOLE_SUPABASE_URL';
export const ENV_SUPABASE_ANON_KEY = 'MYNEWS_CONSOLE_SUPABASE_ANON_KEY';
export const ENV_SERVICE_ROLE_KEY = 'MYNEWS_CONSOLE_SUPABASE_SERVICE_ROLE_KEY';
export const ENV_MODERATOR_EMAILS = 'MYNEWS_CONSOLE_MODERATOR_EMAILS';
export const ENV_ORIGIN = 'MYNEWS_CONSOLE_ORIGIN';
