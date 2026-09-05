import {
  createLegalContent,
  detectMyNewsCapabilities,
  type LegalContentBundle,
  type MyNewsCapabilities,
} from '@mylife/mynews';

export const MYNEWS_PAYMENTS_UNAVAILABLE_COPY =
  'Journalist support is not available in this build.';

export interface MyNewsPaymentsRuntimeConfig {
  baseUrl: string;
  anonKey: string;
  functionsUrl: string;
}

export type MyNewsPaymentsRuntimeConfigResult =
  | { ok: true; config: MyNewsPaymentsRuntimeConfig }
  | { ok: false; reason: string };

function platformName(env: Record<string, string | undefined>): 'ios' | 'android' {
  return env.EXPO_OS === 'android' ? 'android' : 'ios';
}

function revenueCatKey(
  env: Record<string, string | undefined>,
  platform: 'ios' | 'android',
): string | undefined {
  return (
    (platform === 'ios'
      ? env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS
      : env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_ANDROID) ??
    env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY ??
    env.EXPO_PUBLIC_REVENUECAT_API_KEY
  );
}

export function getMyNewsRuntimeCapabilities(
  env: Record<string, string | undefined> = process.env,
  platform: 'ios' | 'android' = platformName(env),
): MyNewsCapabilities {
  return detectMyNewsCapabilities({
    paymentsEnabled: env.EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED,
    paymentProvider: env.EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER,
    supabaseUrl: env.EXPO_PUBLIC_MYNEWS_SUPABASE_URL,
    supabaseAnonKey: env.EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY,
    functionsUrl: env.EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL,
    revenueCatApiKey: revenueCatKey(env, platform),
    subscriptionPlatform: platform,
    contactEmails: [
      env.EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL,
      env.EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL,
      env.EXPO_PUBLIC_MYNEWS_DMCA_EMAIL,
    ],
    webReportingEnabled: env.EXPO_PUBLIC_MYNEWS_WEB_REPORTING_ENABLED,
  });
}

export function getMyNewsPaymentsRuntimeConfig(
  env: Record<string, string | undefined> = process.env,
): MyNewsPaymentsRuntimeConfigResult {
  if (!getMyNewsRuntimeCapabilities(env).payments) {
    return { ok: false, reason: MYNEWS_PAYMENTS_UNAVAILABLE_COPY };
  }
  return {
    ok: true,
    config: {
      baseUrl: env.EXPO_PUBLIC_MYNEWS_SUPABASE_URL!.trim().replace(/\/+$/, ''),
      anonKey: env.EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY!.trim(),
      functionsUrl: env.EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL!.trim().replace(/\/+$/, ''),
    },
  };
}

export function getMyNewsRuntimeLegalContent(
  env: Record<string, string | undefined> = process.env,
): LegalContentBundle {
  const capabilities = getMyNewsRuntimeCapabilities(env);
  return createLegalContent(capabilities, {
    dsaContactEmail: env.EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL?.trim() ?? '',
    safetyEmail: env.EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL?.trim() ?? '',
    dmcaEmail: env.EXPO_PUBLIC_MYNEWS_DMCA_EMAIL?.trim() ?? '',
  });
}
