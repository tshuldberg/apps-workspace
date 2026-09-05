// Manhattan launch environment policy.
//
// Manhattan is standalone-first: cloud sync is optional. When the Supabase
// env vars are absent the app runs local-only (the default, no-login path).

export interface ManhattanCloudConfig {
  url: string;
  anonKey: string;
}

export interface ManhattanBillingConfig {
  revenueCatApiKey: string;
}

export type ManhattanCloudConfigResult =
  | { ok: true; config: ManhattanCloudConfig }
  | { ok: false; error: string | null };

export type ManhattanBillingConfigResult =
  | { ok: true; config: ManhattanBillingConfig }
  | { ok: false; error: string | null };

export function getManhattanCloudConfig(
  env: NodeJS.ProcessEnv = process.env,
): ManhattanCloudConfigResult {
  const url = env.EXPO_PUBLIC_MANHATTAN_SUPABASE_URL?.trim();
  const anonKey = env.EXPO_PUBLIC_MANHATTAN_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return { ok: false, error: null };
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return { ok: false, error: 'Manhattan Supabase URL must use HTTPS.' };
    }
  } catch {
    return { ok: false, error: 'Manhattan Supabase URL is invalid.' };
  }

  return { ok: true, config: { url, anonKey } };
}

export type ManhattanBillingPlatform = 'ios' | 'android';

const PLATFORM_KEY_PREFIX: Record<ManhattanBillingPlatform, 'appl_' | 'goog_'> = {
  ios: 'appl_',
  android: 'goog_',
};

// One env cannot carry both store keys through a single variable, so dual-store
// builds inject EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_IOS/_ANDROID and the
// provider passes Platform.OS. The platformless generic vars remain supported
// for single-store setups and existing callers.
export function getManhattanBillingConfig(
  env: NodeJS.ProcessEnv = process.env,
  platform?: ManhattanBillingPlatform,
): ManhattanBillingConfigResult {
  const platformKey = platform === 'ios'
    ? env.EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_IOS?.trim()
    : platform === 'android'
      ? env.EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_ANDROID?.trim()
      : undefined;

  const revenueCatApiKey = platformKey
    || env.EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY?.trim()
    || env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim();

  if (!revenueCatApiKey) {
    return { ok: false, error: null };
  }

  if (!revenueCatApiKey.startsWith('appl_') && !revenueCatApiKey.startsWith('goog_')) {
    return {
      ok: false,
      error: 'Manhattan RevenueCat public SDK key must start with appl_ or goog_.',
    };
  }

  if (platform) {
    const expected = PLATFORM_KEY_PREFIX[platform];
    if (!revenueCatApiKey.startsWith(expected)) {
      const actual = revenueCatApiKey.startsWith('appl_') ? 'appl_*' : 'goog_*';
      const article = expected === 'appl_' ? 'an appl_' : 'a goog_';
      return {
        ok: false,
        error: `Manhattan RevenueCat key ${actual} does not match the ${platform} build; expected ${article} key.`,
      };
    }
  }

  return { ok: true, config: { revenueCatApiKey } };
}

export function shouldEnableManhattanEntitlementsTestMode(
  env: NodeJS.ProcessEnv = process.env,
  isDev: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false,
): boolean {
  if (!isDev) return false;
  return env.EXPO_PUBLIC_MANHATTAN_ENTITLEMENTS_TEST_MODE?.trim() === 'true';
}
