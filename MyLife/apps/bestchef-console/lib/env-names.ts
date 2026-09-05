/**
 * Single source of truth for the console's env var names. No `server-only`
 * marker so middleware and pages can import the NAMES (never the values)
 * without pulling server-module constraints.
 */

export const ENV_SUPABASE_URL = 'BESTCHEF_CONSOLE_SUPABASE_URL';
export const ENV_SUPABASE_ANON_KEY = 'BESTCHEF_CONSOLE_SUPABASE_ANON_KEY';
export const ENV_SERVICE_ROLE_KEY = 'BESTCHEF_CONSOLE_SUPABASE_SERVICE_ROLE_KEY';
export const ENV_MODERATOR_EMAILS = 'BESTCHEF_CONSOLE_MODERATOR_EMAILS';
export const ENV_ORIGIN = 'BESTCHEF_CONSOLE_ORIGIN';
