export interface BestChefLaunchEnv {
  NODE_ENV?: string;
  EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH?: string;
  EXPO_PUBLIC_BESTCHEF_ENABLE_MESH_SYNC?: string;
  EXPO_PUBLIC_BESTCHEF_CLOUD_ENV?: string;
  EXPO_PUBLIC_BESTCHEF_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD?: string;
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_BESTCHEF_AUTH_REDIRECT_URL?: string;
  EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS?: string;
}

export type BestChefProviderBrokerReason =
  | 'public_launch'
  | 'internal_beta_byo_disabled'
  | 'explicit_byo'
  | 'internal_beta_default';

export interface BestChefProviderBrokerPolicy {
  isPublicLaunch: boolean;
  shouldUseBroker: boolean;
  allowByoProviderKeys: boolean;
  reason: BestChefProviderBrokerReason;
}

export type BestChefCloudEnvironment = 'development' | 'staging' | 'production' | 'unknown';

export type BestChefCloudConfigResult =
  | {
      ok: true;
      config: {
        url: string;
        anonKey: string;
        environment: BestChefCloudEnvironment;
        projectRef: string | null;
      };
    }
  | {
      ok: false;
      error: string | null;
    };

const BESTCHEF_STAGING_PROJECT_REFS = new Set(['tcikvihyjetsfkjjpljv']);
const BESTCHEF_PRODUCTION_PROJECT_REFS = new Set(['zjxabnazbdocrqpyixgo']);

export function getBestChefLaunchEnv(): BestChefLaunchEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH: process.env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH,
    EXPO_PUBLIC_BESTCHEF_ENABLE_MESH_SYNC: process.env.EXPO_PUBLIC_BESTCHEF_ENABLE_MESH_SYNC,
    EXPO_PUBLIC_BESTCHEF_CLOUD_ENV: process.env.EXPO_PUBLIC_BESTCHEF_CLOUD_ENV,
    EXPO_PUBLIC_BESTCHEF_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD:
      process.env.EXPO_PUBLIC_BESTCHEF_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_BESTCHEF_AUTH_REDIRECT_URL: process.env.EXPO_PUBLIC_BESTCHEF_AUTH_REDIRECT_URL,
    EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS:
      process.env.EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS,
  };
}

function normalizeFlag(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeCloudEnvironment(value: string | undefined): BestChefCloudEnvironment {
  const normalized = normalizeFlag(value);
  if (normalized === 'development' || normalized === 'dev') return 'development';
  if (normalized === 'staging' || normalized === 'stage' || normalized === 'preview') return 'staging';
  if (normalized === 'production' || normalized === 'prod') return 'production';
  return 'unknown';
}

export function isBestChefPublicLaunchBuild(
  env: BestChefLaunchEnv = getBestChefLaunchEnv(),
): boolean {
  return env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH === '1' || env.NODE_ENV === 'production';
}

export function shouldEnableBestChefMeshSync(
  env: BestChefLaunchEnv = getBestChefLaunchEnv(),
): boolean {
  if (isBestChefPublicLaunchBuild(env)) return false;
  return env.EXPO_PUBLIC_BESTCHEF_ENABLE_MESH_SYNC !== '0';
}

export function getBestChefSupabaseProjectRef(url: string): string | null {
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
  explicitEnvironment: BestChefCloudEnvironment,
  projectRef: string | null,
): BestChefCloudEnvironment {
  if (explicitEnvironment !== 'unknown') return explicitEnvironment;
  if (projectRef && BESTCHEF_STAGING_PROJECT_REFS.has(projectRef)) return 'staging';
  if (projectRef && BESTCHEF_PRODUCTION_PROJECT_REFS.has(projectRef)) return 'production';
  return 'unknown';
}

function isPublicCloudConfigAllowed(
  env: BestChefLaunchEnv,
  environment: BestChefCloudEnvironment,
): boolean {
  if (!isBestChefPublicLaunchBuild(env)) return true;
  if (environment === 'production') return true;

  const explicitPublicLaunch = env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH === '1';
  const internalOverride =
    env.EXPO_PUBLIC_BESTCHEF_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD === '1';
  return !explicitPublicLaunch && internalOverride;
}

export function getBestChefCloudConfig(
  env: BestChefLaunchEnv = getBestChefLaunchEnv(),
): BestChefCloudConfigResult {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return { ok: false, error: null };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { ok: false, error: 'BestChef Supabase URL must use HTTPS.' };
    }
  } catch {
    return { ok: false, error: 'BestChef Supabase URL is invalid.' };
  }

  const projectRef = getBestChefSupabaseProjectRef(url);
  const explicitEnvironment = normalizeCloudEnvironment(env.EXPO_PUBLIC_BESTCHEF_CLOUD_ENV);
  const environment = inferCloudEnvironment(explicitEnvironment, projectRef);

  if (!isPublicCloudConfigAllowed(env, environment)) {
    return {
      ok: false,
      error: 'Public BestChef builds must use a production Supabase project.',
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
    return ['bestchef:', 'https:', 'exp:', 'exps:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function getBestChefProviderBrokerPolicy(
  env: BestChefLaunchEnv = getBestChefLaunchEnv(),
): BestChefProviderBrokerPolicy {
  const isPublicLaunch = isBestChefPublicLaunchBuild(env);
  const explicit = env.EXPO_PUBLIC_BESTCHEF_ALLOW_BYO_PROVIDER_KEYS;

  if (isPublicLaunch) {
    return {
      isPublicLaunch: true,
      shouldUseBroker: true,
      allowByoProviderKeys: false,
      reason: 'public_launch',
    };
  }

  if (explicit === '0') {
    return {
      isPublicLaunch: false,
      shouldUseBroker: true,
      allowByoProviderKeys: false,
      reason: 'internal_beta_byo_disabled',
    };
  }

  if (explicit === '1') {
    return {
      isPublicLaunch: false,
      shouldUseBroker: false,
      allowByoProviderKeys: true,
      reason: 'explicit_byo',
    };
  }

  return {
    isPublicLaunch: false,
    shouldUseBroker: false,
    allowByoProviderKeys: true,
    reason: 'internal_beta_default',
  };
}

export function shouldUseBestChefProviderBroker(
  env: BestChefLaunchEnv = getBestChefLaunchEnv(),
): boolean {
  return getBestChefProviderBrokerPolicy(env).shouldUseBroker;
}

export function shouldAllowBestChefByoProviderKeys(
  env: BestChefLaunchEnv = getBestChefLaunchEnv(),
): boolean {
  return getBestChefProviderBrokerPolicy(env).allowByoProviderKeys;
}

export function getBestChefAuthRedirectUrl(
  env: BestChefLaunchEnv = getBestChefLaunchEnv(),
  createUrl: (path: string) => string = () => 'bestchef://auth-callback',
): string {
  const configured = env.EXPO_PUBLIC_BESTCHEF_AUTH_REDIRECT_URL?.trim();
  if (configured) {
    if (!isAllowedAuthRedirectUrl(configured)) {
      throw new Error('BestChef auth redirect URL must use bestchef, https, exp, or exps.');
    }
    return configured;
  }

  return createUrl('auth-callback');
}
