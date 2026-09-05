// DoWork launch environment policy.
//
// Mirrors apps/bestchef/.../data/launch-environment.ts but DoWork has no
// BYO-provider-key concept, no mesh sync (server-backed only for v1), and
// keeps the cloud env decoupled from BestChef's Supabase project.

export interface DoWorkLaunchEnv {
  NODE_ENV?: string;
  EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH?: string;
  EXPO_PUBLIC_DOWORK_CLOUD_ENV?: string;
  EXPO_PUBLIC_DOWORK_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD?: string;
  EXPO_PUBLIC_DOWORK_SUPABASE_URL?: string;
  EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL?: string;
}

export type DoWorkCloudEnvironment =
  | 'development'
  | 'staging'
  | 'production'
  | 'unknown';

export type DoWorkCloudConfigResult =
  | {
      ok: true;
      config: {
        url: string;
        anonKey: string;
        environment: DoWorkCloudEnvironment;
        projectRef: string | null;
      };
    }
  | {
      ok: false;
      error: string | null;
    };

const DOWORK_STAGING_PROJECT_REFS = new Set<string>([]);

function normalizeFlag(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeCloudEnvironment(
  value: string | undefined,
): DoWorkCloudEnvironment {
  const normalized = normalizeFlag(value);
  if (normalized === 'development' || normalized === 'dev') return 'development';
  if (normalized === 'staging' || normalized === 'stage' || normalized === 'preview') return 'staging';
  if (normalized === 'production' || normalized === 'prod') return 'production';
  return 'unknown';
}

export function isDoWorkPublicLaunchBuild(
  env: DoWorkLaunchEnv = process.env,
): boolean {
  return env.EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH === '1' || env.NODE_ENV === 'production';
}

export function getDoWorkSupabaseProjectRef(url: string): string | null {
  try {
    const parsed = new URL(url);
    const suffix = '.supabase.co';
    if (!parsed.hostname.endsWith(suffix)) return null;
    return parsed.hostname.slice(0, -suffix.length) || null;
  } catch {
    return null;
  }
}

function inferCloudEnvironment(
  explicitEnvironment: DoWorkCloudEnvironment,
  projectRef: string | null,
): DoWorkCloudEnvironment {
  if (explicitEnvironment !== 'unknown') return explicitEnvironment;
  if (projectRef && DOWORK_STAGING_PROJECT_REFS.has(projectRef)) return 'staging';
  return 'unknown';
}

function isPublicCloudConfigAllowed(
  env: DoWorkLaunchEnv,
  environment: DoWorkCloudEnvironment,
): boolean {
  if (!isDoWorkPublicLaunchBuild(env)) return true;
  if (environment === 'production') return true;

  const explicitPublicLaunch = env.EXPO_PUBLIC_DOWORK_PUBLIC_LAUNCH === '1';
  const internalOverride =
    env.EXPO_PUBLIC_DOWORK_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD === '1';
  return !explicitPublicLaunch && internalOverride;
}

export function getDoWorkCloudConfig(
  env: DoWorkLaunchEnv = process.env,
): DoWorkCloudConfigResult {
  const url = env.EXPO_PUBLIC_DOWORK_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    // Missing config is an expected build state, not an error: screens render
    // their own "not configured" copy (see earnings.tsx's null fallback).
    return { ok: false, error: null };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { ok: false, error: 'DoWork Supabase URL must use HTTPS.' };
    }
  } catch {
    return { ok: false, error: 'DoWork Supabase URL is invalid.' };
  }

  const projectRef = getDoWorkSupabaseProjectRef(url);
  const explicitEnvironment = normalizeCloudEnvironment(env.EXPO_PUBLIC_DOWORK_CLOUD_ENV);
  const environment = inferCloudEnvironment(explicitEnvironment, projectRef);

  if (!isPublicCloudConfigAllowed(env, environment)) {
    return {
      ok: false,
      error: 'Public DoWork builds must use a production Supabase project.',
    };
  }

  return {
    ok: true,
    config: {
      url,
      anonKey,
      environment,
      projectRef,
    },
  };
}

function isAllowedAuthRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['dowork:', 'https:', 'exp:', 'exps:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function getDoWorkAuthRedirectUrl(
  env: DoWorkLaunchEnv = process.env,
  fallback: (path: string) => string,
): string {
  const explicit = env.EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL?.trim();
  if (explicit && isAllowedAuthRedirectUrl(explicit)) return explicit;
  return fallback('/auth-callback');
}
