// Dependency-free EAS pre-install release gate for MyNews.
// Production builds must carry complete store, backend, legal, policy, and
// smoke evidence. Every failure names the exact environment or manifest key.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(APP_DIR, '../..');
const PLATFORM_PREFIX = { ios: 'appl_', android: 'goog_' };
/** Smoke checks that every production release must record as passing. */
const BASELINE_SMOKE_CHECKS = [
  'cloudConnection',
  'readerFeed',
  'subscriptionPurchase',
  'subscriptionRestore',
];
/**
 * Smoke checks that exercise the journalist support rail. They must be true when
 * the release ships payments live, and must be false when it does not: nobody
 * can smoke-test a rail that is switched off, and recording a pass for one would
 * be a fabricated receipt.
 */
const PAYMENT_SMOKE_CHECKS = [
  'supportCheckout',
  'paymentWebhook',
  'supportHistory',
  'journalistPayoutStatus',
];
const LEGAL_CONTACT_KEYS = ['support', 'legal', 'safety', 'privacy', 'dmca'];
/**
 * In-app legal contact env vars the app actually reads
 * (app/(root)/data/runtime-capabilities.ts). Without them the app's
 * emailContact capability is off and the legal screens publish no contact
 * channel, so a production build must carry all three and they must match the
 * manifest's controlled addresses.
 */
const LEGAL_CONTACT_ENV = [
  { env: 'EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL', manifestKey: 'legal' },
  { env: 'EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL', manifestKey: 'safety' },
  { env: 'EXPO_PUBLIC_MYNEWS_DMCA_EMAIL', manifestKey: 'dmca' },
];

function addError(errors, key, message) {
  errors.push(`${key}: ${message}`);
}

function isPlaceholder(value) {
  return /(placeholder|replace[-_ ]?me|example|your[-_]|changeme|todo)/i.test(String(value ?? ''));
}

function parseHttps(value) {
  if (typeof value !== 'string' || !value.trim() || isPlaceholder(value)) return null;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

function isControlledOrigin(value) {
  const parsed = parseHttps(value);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return (
    host !== 'mynews.app' &&
    !host.endsWith('.mynews.app') &&
    host !== 'localhost' &&
    !host.endsWith('.localhost') &&
    !host.endsWith('.example') &&
    !host.endsWith('.invalid') &&
    !host.endsWith('.test')
  );
}

function isProductionServiceUrl(value) {
  const parsed = parseHttps(value);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'mynews.app' ||
    host.endsWith('.mynews.app') ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.example') ||
    host.endsWith('.invalid') ||
    host.endsWith('.test') ||
    host.startsWith('project.')
  ) {
    return null;
  }
  return parsed;
}

function isControlledEmail(value) {
  if (typeof value !== 'string' || isPlaceholder(value)) return false;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const domain = email.split('@')[1];
  return (
    domain !== 'mynews.app' &&
    !domain.endsWith('.mynews.app') &&
    !domain.endsWith('.example') &&
    !domain.endsWith('.invalid') &&
    !domain.endsWith('.test')
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function currentTermsVersion(path) {
  const source = readFileSync(path, 'utf8');
  const match = source.match(/CURRENT_TERMS_VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (!match) throw new Error('CURRENT_TERMS_VERSION literal was not found');
  return match[1];
}

/* ------------------------- schema-driven shape gate ------------------------ */

/**
 * Minimal JSON Schema walker covering exactly the vocabulary
 * release-manifest.schema.json uses: type, const, required, properties,
 * additionalProperties: false, pattern, minLength, and the email/date-time/uri
 * formats. No new dependency, and the schema FILE stays the single source of the
 * manifest's shape: adding a required field there makes the gate demand it
 * without touching this function.
 */
function validateAgainstSchema(schema, value, path, errors) {
  const label = path || 'releaseManifest';

  if (schema.const !== undefined && value !== schema.const) {
    addError(errors, label, `must equal ${JSON.stringify(schema.const)}`);
    return;
  }

  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      addError(errors, label, 'must be an object');
      return;
    }
    for (const key of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        addError(errors, `${label}.${key}`, 'is required by release-manifest.schema.json');
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(schema.properties ?? {}, key)) {
          addError(errors, `${label}.${key}`, 'is not allowed by release-manifest.schema.json');
        }
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        validateAgainstSchema(childSchema, value[key], `${label}.${key}`, errors);
      }
    }
    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      addError(errors, label, 'must be a string');
      return;
    }
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) {
      addError(errors, label, `must be at least ${schema.minLength} characters`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      addError(errors, label, `must match ${schema.pattern}`);
    }
    if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      addError(errors, label, 'must be an email address');
    }
    if (schema.format === 'date-time' && !Number.isFinite(Date.parse(value))) {
      addError(errors, label, 'must be an ISO-8601 timestamp');
    }
    if (schema.format === 'uri' && !parseHttps(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      addError(errors, label, 'must be a URI');
    }
    return;
  }

  if (schema.type === 'boolean' && typeof value !== 'boolean') {
    addError(errors, label, 'must be a boolean');
  }
}

/**
 * Every path the schema marks required, in dotted form. Used by the checker's
 * own test to prove that removing any schema-required field fails the gate, so
 * the two can never drift apart silently.
 */
export function schemaRequiredPaths(schema, path = '') {
  if (!schema || schema.type !== 'object') return [];
  const paths = [];
  for (const key of schema.required ?? []) {
    const childPath = path ? `${path}.${key}` : key;
    paths.push(childPath);
    paths.push(...schemaRequiredPaths(schema.properties?.[key], childPath));
  }
  return paths;
}

export function readManifestSchema(schemaPath = resolve(APP_DIR, 'release-manifest.schema.json')) {
  return readJson(schemaPath);
}

function validateManifest(manifest, expected, errors) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    addError(errors, 'releaseManifest', 'must be a JSON object matching release-manifest.schema.json');
    return;
  }

  // Shape first, from the schema file itself. Value rules below add the things a
  // schema cannot express: cross-file pins, controlled domains, and the
  // capability consistency between manifest and build environment.
  let schema = null;
  try {
    schema = expected.schema ?? readManifestSchema();
  } catch (error) {
    addError(errors, 'apps/mynews/release-manifest.schema.json', `is missing or invalid JSON: ${String(error)}`);
  }
  if (schema) validateAgainstSchema(schema, manifest, '', errors);

  if (manifest.appVersion !== expected.appVersion) {
    addError(
      errors,
      'releaseManifest.appVersion',
      `must equal apps/mynews/app.json version ${expected.appVersion}`,
    );
  }
  if (
    typeof manifest.backendProjectRef !== 'string' ||
    !/^[a-z0-9]{20}$/.test(manifest.backendProjectRef) ||
    isPlaceholder(manifest.backendProjectRef)
  ) {
    addError(
      errors,
      'releaseManifest.backendProjectRef',
      'must be a non-placeholder 20-character backend project ref',
    );
  }
  if (!isControlledOrigin(manifest.controlledOrigin)) {
    addError(
      errors,
      'releaseManifest.controlledOrigin',
      'must be a controlled HTTPS origin and must not use the mynews.app placeholder',
    );
  }

  const contacts = manifest.legalContacts;
  if (contacts && typeof contacts === 'object' && !Array.isArray(contacts)) {
    for (const key of LEGAL_CONTACT_KEYS) {
      if (!isControlledEmail(contacts[key])) {
        addError(
          errors,
          `releaseManifest.legalContacts.${key}`,
          'must be a controlled non-placeholder email and must not use @mynews.app',
        );
      }
    }
  }

  const policies = manifest.policyVersions;
  if (policies && typeof policies === 'object' && !Array.isArray(policies)) {
    if (policies.terms !== expected.termsVersion) {
      addError(
        errors,
        'releaseManifest.policyVersions.terms',
        `must equal CURRENT_TERMS_VERSION ${expected.termsVersion}`,
      );
    }
    for (const key of ['privacy', 'guidelines']) {
      if (typeof policies[key] !== 'string' || !policies[key].trim() || isPlaceholder(policies[key])) {
        addError(errors, `releaseManifest.policyVersions.${key}`, 'must be a non-placeholder version');
      }
    }
  }

  const paymentsLive = manifest.paymentsLive === true;
  const checklist = manifest.smokeReceipt?.checklist;
  if (checklist && typeof checklist === 'object' && !Array.isArray(checklist)) {
    for (const key of BASELINE_SMOKE_CHECKS) {
      if (checklist[key] !== true) {
        addError(errors, `releaseManifest.smokeReceipt.checklist.${key}`, 'must equal true');
      }
    }
    for (const key of PAYMENT_SMOKE_CHECKS) {
      if (paymentsLive && checklist[key] !== true) {
        addError(
          errors,
          `releaseManifest.smokeReceipt.checklist.${key}`,
          'must equal true when releaseManifest.paymentsLive is true',
        );
      }
      if (!paymentsLive && checklist[key] !== false) {
        addError(
          errors,
          `releaseManifest.smokeReceipt.checklist.${key}`,
          'must equal false when releaseManifest.paymentsLive is false: a disabled support rail cannot be smoke-tested',
        );
      }
    }
  }

  // Deploy-side secrets live on the backend project and are invisible to an app
  // build, so the gate demands an explicit attestation instead of pretending to
  // verify them.
  const workerSecrets = manifest.deployAttestation?.workerSecrets;
  if (workerSecrets && typeof workerSecrets === 'object' && !Array.isArray(workerSecrets)) {
    for (const key of ['nciiWorker', 'supportWorker', 'paymentsWebhook', 'accountWorker']) {
      if (workerSecrets[key] !== true) {
        addError(
          errors,
          `releaseManifest.deployAttestation.workerSecrets.${key}`,
          'must equal true: the operator attests the backend secret is set (not checkable from the app environment)',
        );
      }
    }
  }
}

function validateCapabilityEnv(env, manifest, errors) {
  const paymentsLive = manifest?.paymentsLive === true;
  const enabled = env.EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED?.trim().toLowerCase() ?? '';
  const provider = env.EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER?.trim().toLowerCase() ?? '';

  if (paymentsLive) {
    if (enabled !== 'true') {
      addError(
        errors,
        'EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED',
        'must equal true because releaseManifest.paymentsLive is true',
      );
    }
    if (provider !== 'stripe') {
      addError(
        errors,
        'EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER',
        'must equal stripe because releaseManifest.paymentsLive is true',
      );
    }
  } else {
    if (enabled === 'true') {
      addError(
        errors,
        'EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED',
        'must not equal true because releaseManifest.paymentsLive is false',
      );
    }
    if (provider) {
      addError(
        errors,
        'EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER',
        'must be unset because releaseManifest.paymentsLive is false',
      );
    }
  }

  for (const { env: name, manifestKey } of LEGAL_CONTACT_ENV) {
    const value = env[name]?.trim();
    if (!isControlledEmail(value)) {
      addError(
        errors,
        name,
        'must be a controlled non-placeholder email: the in-app legal screens publish no contact channel without it',
      );
      continue;
    }
    const expectedContact = manifest?.legalContacts?.[manifestKey];
    if (
      typeof expectedContact === 'string' &&
      isControlledEmail(expectedContact) &&
      value.toLowerCase() !== expectedContact.trim().toLowerCase()
    ) {
      addError(
        errors,
        name,
        `must equal releaseManifest.legalContacts.${manifestKey} (${expectedContact})`,
      );
    }
  }
}

export function checkBuildEnv(env, options = {}) {
  const profile = env.EAS_BUILD_PROFILE ?? '';
  const platform = env.EAS_BUILD_PLATFORM ?? '';
  const errors = [];
  const warnings = [];

  if (profile !== 'production') {
    return { ok: true, errors, warnings, skipped: true };
  }

  const revenueCatKeyName =
    platform === 'ios'
      ? 'EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS'
      : platform === 'android'
        ? 'EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_ANDROID'
        : 'EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS/_ANDROID';
  const revenueCatKey =
    platform === 'ios'
      ? env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS?.trim()
      : platform === 'android'
        ? env.EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_ANDROID?.trim()
        : undefined;
  if (!revenueCatKey || isPlaceholder(revenueCatKey)) {
    addError(errors, revenueCatKeyName, 'is required for a production store build');
  } else if (!revenueCatKey.startsWith('appl_') && !revenueCatKey.startsWith('goog_')) {
    addError(errors, revenueCatKeyName, 'must be a public SDK key with an appl_ or goog_ prefix');
  } else if (PLATFORM_PREFIX[platform] && !revenueCatKey.startsWith(PLATFORM_PREFIX[platform])) {
    addError(errors, revenueCatKeyName, `must start with ${PLATFORM_PREFIX[platform]} for ${platform}`);
  }

  const supabaseUrlRaw = env.EXPO_PUBLIC_MYNEWS_SUPABASE_URL?.trim();
  const supabaseUrl = isProductionServiceUrl(supabaseUrlRaw);
  if (!supabaseUrl) {
    addError(
      errors,
      'EXPO_PUBLIC_MYNEWS_SUPABASE_URL',
      'must be a non-placeholder HTTPS URL',
    );
  }

  const anonKey = env.EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY?.trim();
  if (!anonKey || anonKey.length < 20 || isPlaceholder(anonKey)) {
    addError(
      errors,
      'EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY',
      'must be a non-placeholder public anon or publishable key',
    );
  }

  const functionsUrl = isProductionServiceUrl(env.EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL?.trim());
  if (!functionsUrl) {
    addError(
      errors,
      'EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL',
      'must be a non-placeholder HTTPS functions URL',
    );
  }

  if (env.EXPO_PUBLIC_MYNEWS_ENTITLEMENTS_TEST_MODE?.trim() === 'true') {
    addError(
      errors,
      'EXPO_PUBLIC_MYNEWS_ENTITLEMENTS_TEST_MODE',
      'must not equal true in production',
    );
  }

  const appJsonPath = options.appJsonPath ?? resolve(APP_DIR, 'app.json');
  const termsPath =
    options.termsPath ?? resolve(REPO_ROOT, 'modules/mynews/src/data/terms.ts');
  const manifestPath =
    options.manifestPath ||
    env.MYNEWS_RELEASE_MANIFEST_PATH?.trim() ||
    resolve(APP_DIR, 'release-manifest.json');

  let appVersion = null;
  try {
    appVersion = readJson(appJsonPath)?.expo?.version;
    if (typeof appVersion !== 'string' || !appVersion.trim()) {
      throw new Error('expo.version is missing');
    }
  } catch (error) {
    addError(errors, 'apps/mynews/app.json.expo.version', String(error));
  }

  let termsVersion = null;
  try {
    termsVersion = currentTermsVersion(termsPath);
  } catch (error) {
    addError(errors, 'CURRENT_TERMS_VERSION', String(error));
  }

  let manifest = null;
  try {
    manifest = readJson(manifestPath);
  } catch (error) {
    addError(errors, 'apps/mynews/release-manifest.json', `is missing or invalid JSON: ${String(error)}`);
  }

  if (manifest && appVersion && termsVersion) {
    validateManifest(manifest, { appVersion, termsVersion, schema: options.schema }, errors);
    if (
      supabaseUrl &&
      /^[a-z0-9]{20}$/.test(manifest.backendProjectRef ?? '') &&
      supabaseUrl.hostname.endsWith('.supabase.co') &&
      !supabaseUrl.hostname.startsWith(`${manifest.backendProjectRef}.`)
    ) {
      addError(
        errors,
        'releaseManifest.backendProjectRef',
        'must match EXPO_PUBLIC_MYNEWS_SUPABASE_URL',
      );
    }
  }
  validateCapabilityEnv(env, manifest, errors);

  return { ok: errors.length === 0, errors, warnings, skipped: false };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const result = checkBuildEnv(process.env);
  for (const warning of result.warnings) console.warn(`[check-build-env] WARN: ${warning}`);
  if (result.skipped) {
    process.stdout.write('[check-build-env] Non-production profile, skipping release checks.\n');
  } else if (result.ok) {
    process.stdout.write(
      '[check-build-env] Production release manifest and environment are valid.\n',
    );
  } else {
    for (const error of result.errors) console.error(`[check-build-env] FAIL: ${error}`);
    process.exit(1);
  }
}
