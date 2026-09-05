// MyNews launch environment policy.
//
// MyNews is server-canonical: the reader and composer only come alive once a
// founder-provisioned Supabase project is configured. Until then every surface
// renders an honest not-connected state. Publishing auth is signature-based, so
// no anon session or supabase-js client is needed here, only the REST base and
// anon key that the fetch-based cloud adapter reads.

export interface MyNewsCloudConfig {
  /** Supabase project base, e.g. https://abc.supabase.co (no trailing slash). */
  baseUrl: string;
  anonKey: string;
  /** Optional override; the adapter defaults to `${baseUrl}/functions/v1`. */
  functionsUrl?: string;
}

export interface MyNewsSubscriptionConfig {
  revenueCatApiKey: string;
}

export type MyNewsSubscriptionPlatform = 'ios' | 'android';

export type MyNewsSubscriptionConfigResult =
  | { ok: true; config: MyNewsSubscriptionConfig }
  | { ok: false; reason: string };

export const MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY =
  'Subscriptions are not available in this build.';

const REVENUECAT_PREFIX: Record<MyNewsSubscriptionPlatform, 'appl_' | 'goog_'> = {
  ios: 'appl_',
  android: 'goog_',
};

export type MyNewsCloudConfigResult =
  | { ok: true; config: MyNewsCloudConfig }
  | { ok: false; reason: string };

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Reads the MyNews cloud config from the environment. Pure and unit-testable:
 * pass an explicit env in tests. Values are trimmed, non-https URLs are
 * rejected, and trailing slashes are stripped so the adapter can concatenate
 * paths safely.
 */
export function getMyNewsCloudConfig(
  env: Record<string, string | undefined> = process.env,
): MyNewsCloudConfigResult {
  const rawUrl = env.EXPO_PUBLIC_MYNEWS_SUPABASE_URL?.trim();
  const rawAnonKey = env.EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY?.trim();
  const rawFunctionsUrl = env.EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL?.trim();

  if (!rawUrl || !rawAnonKey) {
    return { ok: false, reason: 'Not connected to a MyNews server yet.' };
  }
  if (!isHttpsUrl(rawUrl)) {
    return { ok: false, reason: 'The MyNews server URL must use HTTPS.' };
  }
  if (rawFunctionsUrl && !isHttpsUrl(rawFunctionsUrl)) {
    return { ok: false, reason: 'The MyNews functions URL must use HTTPS.' };
  }

  const config: MyNewsCloudConfig = {
    baseUrl: stripTrailingSlash(rawUrl),
    anonKey: rawAnonKey,
  };
  if (rawFunctionsUrl) {
    config.functionsUrl = stripTrailingSlash(rawFunctionsUrl);
  }
  return { ok: true, config };
}

/** Resolves and prefix-validates the public RevenueCat SDK key for this store. */
export function getMyNewsSubscriptionConfig(
  env: Record<string, string | undefined> = process.env,
  platform: MyNewsSubscriptionPlatform,
): MyNewsSubscriptionConfigResult {
  const platformKey =
    platform === 'ios'
      ? env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS?.trim()
      : env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_ANDROID?.trim();
  const revenueCatApiKey =
    platformKey ||
    env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY?.trim() ||
    env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim();

  if (!revenueCatApiKey) return { ok: false, reason: MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY };
  if (/(placeholder|replace[-_ ]?me|changeme)/i.test(revenueCatApiKey)) {
    return { ok: false, reason: MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY };
  }
  const expected = REVENUECAT_PREFIX[platform];
  if (!revenueCatApiKey.startsWith(expected)) {
    return {
      ok: false,
      reason: `${MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY} The RevenueCat key does not match ${platform}.`,
    };
  }
  return { ok: true, config: { revenueCatApiKey } };
}
