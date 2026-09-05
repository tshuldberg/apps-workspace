#!/usr/bin/env node
// EAS pre-install guard (plan 33 Phase 0 Task 4): fail a production EAS build
// at BUILD time if it is not wired to the production Supabase project.
//
// Why: eas.json injects no env; production env lives only in the EAS dashboard,
// and the committed .env.local points at STAGING. Without this guard a
// misconfigured production build compiles fine and fails on device at runtime
// (getBestChefCloudConfig rejects non-production refs in public builds), which
// burns a TestFlight build number to discover. See errors_log 2026-05-08/05-11
// for the two builds this class of gap already cost.
//
// Runs via the package.json "eas-build-pre-install" hook on EAS build workers.
// Non-production profiles and local dev are never blocked.

export const PRODUCTION_SUPABASE_REF = 'zjxabnazbdocrqpyixgo';

export function evaluateEasProductionEnv(env) {
  const profile = env.EAS_BUILD_PROFILE ?? '';
  if (profile !== 'production') {
    return { ok: true, errors: [], warnings: [], skipped: true, profile };
  }

  const errors = [];
  const warnings = [];

  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (!url) {
    errors.push('EXPO_PUBLIC_SUPABASE_URL is not set on the production profile.');
  } else if (!url.includes(PRODUCTION_SUPABASE_REF)) {
    errors.push(
      `EXPO_PUBLIC_SUPABASE_URL does not reference the production project ${PRODUCTION_SUPABASE_REF} (got: ${url}). ` +
        'A public build wired to staging is rejected at runtime by getBestChefCloudConfig.',
    );
  }

  if (!env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set on the production profile.');
  }

  if (env.EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH !== '1') {
    warnings.push(
      'EXPO_PUBLIC_BESTCHEF_PUBLIC_LAUNCH is not "1". NODE_ENV=production also enables public-launch ' +
        'mode, but the explicit flag is the documented contract (see apps/bestchef/CLAUDE.md).',
    );
  }

  return { ok: errors.length === 0, errors, warnings, skipped: false, profile };
}

const isDirectRun =
  typeof process !== 'undefined' && process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isDirectRun) {
  const result = evaluateEasProductionEnv(process.env);
  if (result.skipped) {
    console.log(`assert-eas-production-env: profile "${result.profile || '(none)'}" is not production, skipping.`);
    process.exit(0);
  }
  for (const w of result.warnings) console.warn(`WARN: ${w}`);
  if (!result.ok) {
    for (const e of result.errors) console.error(`FAIL: ${e}`);
    console.error('assert-eas-production-env: production build env contract violated, aborting build.');
    process.exit(1);
  }
  console.log('assert-eas-production-env: production env contract satisfied.');
}
