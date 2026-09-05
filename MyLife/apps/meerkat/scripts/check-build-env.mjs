// EAS pre-install guard for Meerkat store builds.
//
// Runs before dependencies are installed, so this file uses no dependencies.
// Every store build must contain every public launch endpoint and store key.
// Runtime code still fails closed, but producing a permanently disconnected or
// unpurchasable store binary is a build error, not a warning.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUILD_PROFILES = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8')).build;

// No private-only release is enabled: public and purchase surfaces are present
// in every store profile. A narrower set requires matching runtime gates first.
const PLATFORM_PREFIX = { ios: 'appl_', android: 'goog_' };
const HTTPS_ENDPOINTS = [
  ['MEERKAT_HOSTED_API_URL', 'hosted billing and purchase linking'],
  ['MEERKAT_HUMANITY_SERVICE_URL', 'human verification'],
  ['MEERKAT_PERSONA_SERVICE_URL', 'public account rights'],
  ['MEERKAT_COMMONS_NODE_URL', 'The Commons'],
  ['MEERKAT_PRIVACY_POLICY_URL', 'privacy policy'],
  ['MEERKAT_TERMS_URL', 'Terms of Use'],
  ['MEERKAT_COMMUNITY_STANDARDS_URL', 'Community Standards'],
  ['MEERKAT_SUPPORT_URL', 'safety support and appeals'],
];

function isUrlWithProtocol(value, protocol) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === protocol && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function validateCommonsTopics(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every((topic) => (
      topic && typeof topic === 'object'
      && typeof topic.channelId === 'string' && topic.channelId.trim().length > 0
      && typeof topic.publicationId === 'string' && topic.publicationId.trim().length > 0
      && typeof topic.nodeKeyHex === 'string' && /^[0-9a-f]{64}$/iu.test(topic.nodeKeyHex)
    ));
  } catch {
    return false;
  }
}

export function checkBuildEnv(env) {
  const profile = env.EAS_BUILD_PROFILE ?? '';
  const platform = env.EAS_BUILD_PLATFORM ?? '';
  const errors = [];
  const warnings = [];

  // Local development has no EAS profile. Named profiles must resolve from the
  // checked-in configuration; unknown names and broken inheritance fail closed.
  if (!profile && !env.EAS_BUILD && !platform) {
    return { ok: true, errors, warnings, skipped: true };
  }
  let resolved = {};
  let current = profile;
  const visited = new Set();
  while (current) {
    const entry = Object.hasOwn(BUILD_PROFILES, current) ? BUILD_PROFILES[current] : null;
    if (!entry || visited.has(current) || visited.size >= 5) {
      errors.push('EAS_BUILD_PROFILE must resolve to known profiles without circular inheritance or more than five profiles.');
      break;
    }
    visited.add(current);
    resolved = {
      ...entry,
      ...resolved,
      env: { ...entry.env, ...resolved.env },
      ios: { ...entry.ios, ...resolved.ios },
      android: { ...entry.android, ...resolved.android },
    };
    current = entry.extends;
  }
  if (!profile) errors.push('EAS_BUILD_PROFILE is required for an EAS build.');
  const requiredPlatforms = platform === 'ios' || platform === 'android'
    ? [platform]
    : ['ios', 'android'];
  // EAS defaults distribution to store. Platform overrides take precedence.
  const storePlatforms = requiredPlatforms.filter((target) =>
    (resolved[target]?.distribution ?? resolved.distribution ?? 'store') !== 'internal');
  if (errors.length === 0 && storePlatforms.length === 0) {
    return { ok: true, errors, warnings, skipped: true };
  }

  const capabilities = env.MEERKAT_RELEASE_CAPABILITIES ?? resolved.env?.MEERKAT_RELEASE_CAPABILITIES;
  if (capabilities !== 'full-platform') {
    errors.push('Store profiles must declare MEERKAT_RELEASE_CAPABILITIES=full-platform. A private-only release is not supported until matching runtime gates are implemented.');
  }

  if (env.EXPO_PUBLIC_MEERKAT_TEST_MODE?.trim() === 'true') {
    errors.push('EXPO_PUBLIC_MEERKAT_TEST_MODE=true must never reach a store build.');
  }

  // Pilot unlock override (app/(root)/data/dev-unlock.ts). ANY value is a build
  // error here: a store binary must never ship an entitlement-gate bypass.
  if ((env.EXPO_PUBLIC_MEERKAT_DEV_UNLOCK ?? '').trim() !== '') {
    errors.push('EXPO_PUBLIC_MEERKAT_DEV_UNLOCK must never reach a store build (pilot testing override).');
  }

  for (const target of storePlatforms) {
    const keyName = target === 'ios'
      ? 'EXPO_PUBLIC_MEERKAT_RC_KEY_IOS'
      : 'EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID';
    const key = env[keyName]?.trim() ?? '';
    if (!key) errors.push(`${keyName} is required for a store ${target} build.`);
    else if (!key.startsWith(PLATFORM_PREFIX[target])) {
      errors.push(`${keyName} must be a ${PLATFORM_PREFIX[target]} RevenueCat public SDK key.`);
    }
  }

  for (const [name, capability] of HTTPS_ENDPOINTS) {
    const value = env[name]?.trim() ?? '';
    if (!isUrlWithProtocol(value, 'https:')) {
      errors.push(`${name} must be an https URL for store ${capability}.`);
    }
  }

  const relay = env.MEERKAT_DEFAULT_RELAY_URL?.trim() ?? '';
  if (!isUrlWithProtocol(relay, 'wss:')) {
    errors.push('MEERKAT_DEFAULT_RELAY_URL must be a wss URL in store builds.');
  }

  const hostedRelay = env.MEERKAT_HOSTED_RELAY_URL?.trim() ?? '';
  if (hostedRelay) {
    if (!isUrlWithProtocol(hostedRelay, 'wss:') || new URL(hostedRelay).username || new URL(hostedRelay).password || new URL(hostedRelay).hash) {
      errors.push('MEERKAT_HOSTED_RELAY_URL must be a wss URL without credentials or a fragment.');
    } else if (isUrlWithProtocol(relay, 'wss:') && new URL(hostedRelay).href === new URL(relay).href) {
      errors.push('MEERKAT_HOSTED_RELAY_URL must differ from the free MEERKAT_DEFAULT_RELAY_URL.');
    }
  }

  const humanityKey = env.MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY?.trim() ?? '';
  if (!/^[0-9a-f]{64}$/iu.test(humanityKey)) {
    errors.push('MEERKAT_HUMANITY_SERVICE_PUBLIC_KEY must be a 64-character Ed25519 public key.');
  }

  const topics = env.MEERKAT_COMMONS_TOPICS?.trim() ?? '';
  if (!validateCommonsTopics(topics)) {
    errors.push('MEERKAT_COMMONS_TOPICS must be a non-empty valid Commons topic array with pinned node keys.');
  }

  const turnUrl = env.MEERKAT_TURN_URL?.trim() ?? '';
  if (!isUrlWithProtocol(turnUrl, 'turns:')) {
    errors.push('MEERKAT_TURN_URL must be a turns URL so calls can cross restrictive NATs securely.');
  }
  if (!env.MEERKAT_TURN_USERNAME?.trim()) errors.push('MEERKAT_TURN_USERNAME is required in store builds.');
  if (!env.MEERKAT_TURN_CREDENTIAL?.trim()) errors.push('MEERKAT_TURN_CREDENTIAL is required in store builds.');

  return { ok: errors.length === 0, errors, warnings, skipped: false };
}

const invokedDirectly = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (invokedDirectly) {
  const result = checkBuildEnv(process.env);
  for (const warning of result.warnings) process.stderr.write(`[check-build-env] WARN: ${warning}\n`);
  if (result.skipped) {
    process.stdout.write('[check-build-env] Local or internal profile, skipping store env checks.\n');
  } else if (result.ok) {
    process.stdout.write('[check-build-env] Store env is complete.\n');
  } else {
    for (const error of result.errors) process.stderr.write(`[check-build-env] FAIL: ${error}\n`);
    process.exit(1);
  }
}
