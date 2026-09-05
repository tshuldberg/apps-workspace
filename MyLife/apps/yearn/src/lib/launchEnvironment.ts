export interface YearnLaunchEnv {
  NODE_ENV?: string;
  EXPO_PUBLIC_YEARN_PUBLIC_BETA?: string;
  EXPO_PUBLIC_YEARN_CLOUD_ENV?: string;
  EXPO_PUBLIC_YEARN_ALLOW_STAGING_CLOUD_IN_PUBLIC_BETA?: string;
  EXPO_PUBLIC_YEARN_SUPABASE_URL?: string;
  EXPO_PUBLIC_YEARN_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_YEARN_AUTH_REDIRECT_URL?: string;
}

export type YearnCloudEnvironment =
  | 'development'
  | 'staging'
  | 'production'
  | 'unknown';

export type YearnCloudConfigResult =
  | {
      ok: true;
      config: {
        url: string;
        anonKey: string;
        environment: YearnCloudEnvironment;
        projectRef: string | null;
      };
    }
  | {
      ok: false;
      error: string | null;
    };

const YEARN_PRODUCTION_PROJECT_REFS = new Set(['kclsicgiutrtymjtuizq']);

function normalizeFlag(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeCloudEnvironment(
  value: string | undefined,
): YearnCloudEnvironment {
  const normalized = normalizeFlag(value);
  if (normalized === 'development' || normalized === 'dev') return 'development';
  if (normalized === 'staging' || normalized === 'stage' || normalized === 'preview') {
    return 'staging';
  }
  if (normalized === 'production' || normalized === 'prod') return 'production';
  return 'unknown';
}

export function isYearnPublicBetaBuild(
  env: YearnLaunchEnv = process.env,
): boolean {
  return env.EXPO_PUBLIC_YEARN_PUBLIC_BETA === '1' || env.NODE_ENV === 'production';
}

export function canShowYearnDevSurfaces(
  env: YearnLaunchEnv = process.env,
): boolean {
  return !isYearnPublicBetaBuild(env);
}

export function getYearnSupabaseProjectRef(url: string): string | null {
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
  explicitEnvironment: YearnCloudEnvironment,
  projectRef: string | null,
): YearnCloudEnvironment {
  if (explicitEnvironment !== 'unknown') return explicitEnvironment;
  if (projectRef && YEARN_PRODUCTION_PROJECT_REFS.has(projectRef)) return 'production';
  return 'unknown';
}

function isPublicCloudConfigAllowed(
  env: YearnLaunchEnv,
  environment: YearnCloudEnvironment,
): boolean {
  if (!isYearnPublicBetaBuild(env)) return true;
  if (environment === 'production') return true;

  const explicitPublicBeta = env.EXPO_PUBLIC_YEARN_PUBLIC_BETA === '1';
  const internalOverride =
    env.EXPO_PUBLIC_YEARN_ALLOW_STAGING_CLOUD_IN_PUBLIC_BETA === '1';
  return !explicitPublicBeta && internalOverride;
}

export function getYearnCloudConfig(
  env: YearnLaunchEnv = process.env,
): YearnCloudConfigResult {
  const url = env.EXPO_PUBLIC_YEARN_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_YEARN_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return { ok: false, error: null };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { ok: false, error: 'Yearn Supabase URL must use HTTPS.' };
    }
  } catch {
    return { ok: false, error: 'Yearn Supabase URL is invalid.' };
  }

  const projectRef = getYearnSupabaseProjectRef(url);
  const explicitEnvironment = normalizeCloudEnvironment(env.EXPO_PUBLIC_YEARN_CLOUD_ENV);
  const environment = inferCloudEnvironment(explicitEnvironment, projectRef);

  if (!isPublicCloudConfigAllowed(env, environment)) {
    return {
      ok: false,
      error: 'Public Yearn beta builds must use the production Supabase project.',
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
    return ['yearn:', 'https:', 'exp:', 'exps:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function getYearnAuthRedirectUrl(
  env: YearnLaunchEnv = process.env,
  fallback: (path: string) => string,
): string {
  const explicit = env.EXPO_PUBLIC_YEARN_AUTH_REDIRECT_URL?.trim();
  if (explicit && isAllowedAuthRedirectUrl(explicit)) return explicit;
  return fallback('/auth-callback');
}
