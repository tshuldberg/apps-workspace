// EAS pre-install guard for Manhattan store builds.
//
// Runs as `eas-build-pre-install`, which executes BEFORE dependencies are
// installed, so this file must stay dependency-free (node builtins only) and
// cannot import the TS launch-environment module. The prefix rules below
// mirror getManhattanBillingConfig and are covered by their own tests.
//
// Why: a production build without a RevenueCat key ships a permanently locked,
// dead paywall (2026-06-09 production eval, gap #3). Failing the build at the
// first step is cheaper than discovering it in App Review.

const PLATFORM_PREFIX = { ios: 'appl_', android: 'goog_' };

export function checkBuildEnv(env) {
  const profile = env.EAS_BUILD_PROFILE ?? '';
  const platform = env.EAS_BUILD_PLATFORM ?? '';
  const errors = [];
  const warnings = [];

  if (profile !== 'production') {
    return { ok: true, errors, warnings, skipped: true };
  }

  const platformKey = platform === 'ios'
    ? env.EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_IOS?.trim()
    : platform === 'android'
      ? env.EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY_ANDROID?.trim()
      : undefined;
  const key = platformKey
    || env.EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY?.trim()
    || env.EXPO_PUBLIC_REVENUECAT_API_KEY?.trim();

  if (!key) {
    errors.push(
      `Production ${platform || 'store'} build has no RevenueCat key. ` +
      'Set EXPO_PUBLIC_MANHATTAN_REVENUECAT_API_KEY' +
      (platform ? `_${platform.toUpperCase()}` : '') +
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

  if (env.EXPO_PUBLIC_MANHATTAN_ENTITLEMENTS_TEST_MODE?.trim() === 'true') {
    errors.push(
      'EXPO_PUBLIC_MANHATTAN_ENTITLEMENTS_TEST_MODE=true must never reach a production build.',
    );
  }

  const supabaseUrl = env.EXPO_PUBLIC_MANHATTAN_SUPABASE_URL?.trim();
  const supabaseKey = env.EXPO_PUBLIC_MANHATTAN_SUPABASE_ANON_KEY?.trim();
  if (Boolean(supabaseUrl) !== Boolean(supabaseKey)) {
    warnings.push(
      'Only one of EXPO_PUBLIC_MANHATTAN_SUPABASE_URL/_ANON_KEY is set; cloud stays disabled.',
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
    console.log('[check-build-env] Non-production profile, skipping billing env checks.');
  } else if (result.ok) {
    console.log('[check-build-env] Production billing env looks sane.');
  } else {
    for (const error of result.errors) {
      console.error(`[check-build-env] FAIL: ${error}`);
    }
    process.exit(1);
  }
}
