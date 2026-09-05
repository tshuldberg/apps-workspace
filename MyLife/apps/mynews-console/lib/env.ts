import 'server-only';

import {
  ENV_MODERATOR_EMAILS,
  ENV_ORIGIN,
  ENV_SERVICE_ROLE_KEY,
  ENV_SUPABASE_ANON_KEY,
  ENV_SUPABASE_URL,
} from './env-names';

/**
 * Server-side env contract. Read at call time (not module scope) so
 * `next build` succeeds without secrets; misconfiguration surfaces on the
 * first request with a named error instead of a silent fallback.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`mynews-console: missing required env ${name}`);
  }
  return value.trim();
}

export function supabaseUrl(): string {
  return required(ENV_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required(ENV_SUPABASE_ANON_KEY);
}

export function supabaseServiceRoleKey(): string {
  return required(ENV_SERVICE_ROLE_KEY);
}

export function moderatorEmailsRaw(): string | undefined {
  return process.env[ENV_MODERATOR_EMAILS];
}

export function consoleOrigin(): string {
  return required(ENV_ORIGIN).replace(/\/$/, '');
}

/** Non-throwing presence check for pre-auth surfaces (login page banner). */
export function isConsoleConfigured(): boolean {
  return Boolean(
    process.env[ENV_SUPABASE_URL] &&
      process.env[ENV_SUPABASE_ANON_KEY] &&
      process.env[ENV_SERVICE_ROLE_KEY],
  );
}
