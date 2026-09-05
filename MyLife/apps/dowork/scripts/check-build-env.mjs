// EAS pre-install guard for DoWork store builds.
//
// Runs as `eas-build-pre-install`, which executes BEFORE dependencies are
// installed, so this file must stay dependency-free (node builtins only) and
// cannot import the TS launch-environment module. The rules below mirror
// data/purchases.ts (RevenueCat key resolution) and data/launch-environment.ts
// (cloud config) and are covered by scripts/__tests__/check-build-env.test.mjs.
//
// Why: a production build without a RevenueCat key ships a permanently locked,
// dead paywall, and a production build without the Supabase env ships a dead
// trainer platform. Failing the build at the first step is cheaper than
// discovering either in App Review (Manhattan pattern, 2026-06-09 eval gap #3).

const PLATFORM_PREFIX = { ios: 'appl_', android: 'goog_' };

export function checkBuildEnv(env) {
  const profile = env.EAS_BUILD_PROFILE ?? '';
  const platform = env.EAS_BUILD_PLATFORM ?? '';
  const errors = [];
  const warnings = [];

  if (profile !== 'production') {
    return { ok: true, errors, warnings, skipped: true };
  }

  const key =
    platform === 'ios'
      ? env.EXPO_PUBLIC_DOWORK_RC_KEY_IOS?.trim()
      : platform === 'android'
        ? env.EXPO_PUBLIC_DOWORK_RC_KEY_ANDROID?.trim()
        : undefined;

  if (!key) {
    errors.push(
      `Production ${platform || 'store'} build has no RevenueCat key. ` +
        'Set EXPO_PUBLIC_DOWORK_RC_KEY' +
        (platform ? `_${platform.toUpperCase()}` : '_IOS/_ANDROID') +
        ' or the build ships a dead paywall.',
    );
  } else if (!key.startsWith('appl_') && !key.startsWith('goog_')) {
    errors.push('RevenueCat key must be a public SDK key (appl_/goog_), not a secret.');
  } else if (PLATFORM_PREFIX[platform] && !key.startsWith(PLATFORM_PREFIX[platform])) {
    errors.push(
      `RevenueCat key prefix does not match the ${platform} build; ` +
        `expected ${PLATFORM_PREFIX[platform]}*.`,
    );
  }

  const supabaseUrl = env.EXPO_PUBLIC_DOWORK_SUPABASE_URL?.trim();
  const supabaseKey = env.EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    errors.push(
      'Production build needs both EXPO_PUBLIC_DOWORK_SUPABASE_URL and ' +
        'EXPO_PUBLIC_DOWORK_SUPABASE_ANON_KEY; without them the trainer platform is dead.',
    );
  } else if (!supabaseUrl.startsWith('https://')) {
    errors.push('EXPO_PUBLIC_DOWORK_SUPABASE_URL must be https in a production build.');
  }

  if (env.EXPO_PUBLIC_DOWORK_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD?.trim() === '1') {
    errors.push(
      'EXPO_PUBLIC_DOWORK_ALLOW_STAGING_CLOUD_IN_INTERNAL_BUILD=1 must never reach a production build.',
    );
  }

  if (!env.EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL?.trim()) {
    warnings.push(
      'EXPO_PUBLIC_DOWORK_AUTH_REDIRECT_URL is unset; auth deep links fall back to the dowork:// scheme default.',
    );
  }

  return { ok: errors.length === 0, errors, warnings, skipped: false };
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(
  process.argv[1].split('/').pop(),
);

if (invokedDirectly) {
  const result = checkBuildEnv(process.env);
  for (const warning of result.warnings) {
    console.warn(`[check-build-env] WARN: ${warning}`);
  }
  if (result.skipped) {
    console.log('[check-build-env] Non-production profile, skipping store env checks.');
  } else if (result.ok) {
    console.log('[check-build-env] Production store env looks sane.');
  } else {
    for (const error of result.errors) {
      console.error(`[check-build-env] FAIL: ${error}`);
    }
    process.exit(1);
  }
}
