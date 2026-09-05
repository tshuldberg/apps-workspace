#!/usr/bin/env node
/**
 * Generates apps/mynews/docs/ENV_MATRIX.md from the MyNews source tree.
 *
 * The variable list and the file references are DERIVED from source, so
 * the document cannot drift from the code. The three columns that source
 * cannot answer (required/optional, secret/public, purpose) live in the
 * hand-maintained ANNOTATIONS map below. A variable that the scan finds with
 * no annotation is rendered as UNANNOTATED and makes --check exit non-zero:
 * a new operational env var cannot be silently undocumented.
 *
 * Modes:
 *   node scripts/gen-mynews-env-matrix.mjs           write the file
 *   node scripts/gen-mynews-env-matrix.mjs --check   verify it is current
 *
 * Both modes exit non-zero when anything is unannotated.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..');
export const OUTPUT_REL = 'apps/mynews/docs/ENV_MATRIX.md';
export const UNANNOTATED_CELL = 'UNANNOTATED (add an annotation in scripts/gen-mynews-env-matrix.mjs)';

const GENERATOR_REL = 'scripts/gen-mynews-env-matrix.mjs';

/* -------------------------------------------------------------------------- */
/* Scan configuration                                                         */
/* -------------------------------------------------------------------------- */

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.expo',
  '.turbo',
  '.git',
  '__tests__',
  '__fixtures__',
  '__snapshots__',
  'e2e',
  'playwright-report',
  'test-results',
]);

/**
 * A test-only env read is not an operational requirement, so test sources and
 * test-runner configuration are excluded. This is a deliberate blind spot: if a
 * variable is genuinely needed at runtime it has to be read from non-test
 * source, or it will not appear in the matrix.
 */
function isTestFile(relPath) {
  const base = path.basename(relPath);
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(base)) return true;
  if (/^(playwright|vitest|jest)\.config\.[cm]?[jt]s$/.test(base)) return true;
  const segments = relPath.split(path.sep);
  return segments.includes('test') || segments.includes('tests') || segments.includes('e2e');
}

export const SURFACES = [
  {
    key: 'edge',
    title: 'Supabase Edge Functions (Deno)',
    blurb:
      'Server-side secrets. Set with `supabase secrets set` against the MyNews project, never committed. ' +
      'Reads inside `_shared/mynews-*.ts` apply to every `mynews-*` function that imports that module.',
    roots: [
      {
        dir: 'supabase/functions',
        exts: ['.ts'],
        // mynews-* function directories, plus the shared mynews-* modules.
        accept: (rel) => {
          const segments = rel.split(path.sep);
          if (segments[0] === '_shared') {
            return segments.length === 2 && segments[1].startsWith('mynews-');
          }
          return segments[0].startsWith('mynews-');
        },
      },
    ],
    expoBare: false,
  },
  {
    key: 'web',
    title: 'Public website (apps/mynews-web, Next.js)',
    blurb:
      'Server-side env for the public site. Nothing here is `NEXT_PUBLIC_`, so no value is inlined into the ' +
      'client bundle; the site reads them per request in Server Components, route handlers, and middleware.',
    roots: [{ dir: 'apps/mynews-web', exts: ['.ts', '.tsx'] }],
    expoBare: false,
  },
  {
    key: 'console',
    title: 'Moderation console (apps/mynews-console, Next.js)',
    blurb:
      'The console reads its env indirectly through the name constants in `lib/env-names.ts` ' +
      '(`process.env[ENV_SUPABASE_URL]`), so this scan resolves those constant values.',
    roots: [{ dir: 'apps/mynews-console', exts: ['.ts', '.tsx'] }],
    expoBare: false,
  },
  {
    key: 'app',
    title: 'Mobile app (apps/mynews, Expo)',
    blurb:
      'Every `EXPO_PUBLIC_*` value is embedded in the shipped binary and is therefore PUBLIC by construction. ' +
      'Never put a service-role key, worker secret, or HMAC salt behind an `EXPO_PUBLIC_` name.',
    roots: [
      { dir: 'apps/mynews', exts: ['.ts', '.tsx', '.mjs'] },
      { dir: 'apps/mynews', exts: ['.json'], accept: (rel) => rel === 'app.json' },
      {
        dir: 'apps/mynews',
        exts: ['.js', '.ts', '.mjs'],
        accept: (rel) => /^app\.config\.[cm]?[jt]s$/.test(rel),
      },
    ],
    expoBare: true,
  },
];

/**
 * Variables an operator sets for the ops scripts and CI only. No application
 * source reads them, so the scan cannot find them; they are listed by hand so
 * the release checklist is complete.
 */
const OPERATOR_ONLY = [
  {
    name: 'SUPABASE_PROJECT_REF',
    required: 'required for deploy',
    secrecy: 'public',
    purpose: 'Supabase project ref that scripts/mynews-deploy.sh links and deploys against.',
  },
  {
    name: 'SUPABASE_ACCESS_TOKEN',
    required: 'required for deploy',
    secrecy: 'secret',
    purpose: 'Supabase CLI personal access token used by scripts/mynews-deploy.sh and mynews-rollback.sh.',
  },
  {
    name: 'MYNEWS_SMOKE_ANON_KEY',
    required: 'required for smoke',
    secrecy: 'public',
    purpose:
      'Publishable anon key scripts/mynews-smoke.sh sends as `apikey` so the gateway reaches the function ' +
      'and returns the real 401 from the JWT gate instead of a gateway-level rejection.',
  },
];

/* -------------------------------------------------------------------------- */
/* Hand-maintained annotations                                                */
/* -------------------------------------------------------------------------- */

/**
 * `provided: 'supabase-platform'` means Supabase injects the value into every
 * edge function at runtime. An operator does not set it and must not try to:
 * `supabase secrets set` rejects the reserved SUPABASE_ prefix.
 */
export const ANNOTATIONS = {
  SUPABASE_URL: {
    required: 'required',
    secrecy: 'public',
    provided: 'supabase-platform',
    purpose:
      'Project REST base the mynews store, payments store, and worker-run recorder concatenate onto /rest/v1.',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: 'required',
    secrecy: 'secret',
    provided: 'supabase-platform',
    purpose:
      'Service-role credential for every mynews edge write and RPC call. Bypasses RLS, so it never leaves the function runtime.',
  },
  SUPABASE_ANON_KEY: {
    required: 'required',
    secrecy: 'public',
    provided: 'supabase-platform',
    purpose:
      'Publishable key the gateway uses. No mynews edge source reads it directly; clients send it as the apikey header.',
  },

  MYNEWS_ACCOUNT_WORKER_SECRET: {
    required: 'required',
    secrecy: 'secret',
    purpose:
      'Shared secret mynews-account-worker compares against the X-MyNews-Worker-Secret header. verify_jwt is off for this function, so an unset secret means the worker refuses every call (401) rather than running unauthenticated. The same value goes into nw_job_config key account_worker_secret for the pg_cron caller.',
  },
  MYNEWS_NCII_WORKER_SECRET: {
    required: 'required',
    secrecy: 'secret',
    purpose:
      'Shared secret mynews-ncii-worker compares against X-MyNews-Worker-Secret. Unset means the 24h/48h urgent-case backstop never runs, so treat it as launch-blocking. Mirrored into nw_job_config key ncii_worker_secret.',
  },
  MYNEWS_SUPPORT_WORKER_SECRET: {
    required: 'required',
    secrecy: 'secret',
    purpose:
      'Shared secret mynews-support-worker compares against X-MyNews-Worker-Secret before running support-ledger reconciliation. Mirrored into nw_job_config for the cron caller.',
  },
  MYNEWS_HEALTH_SECRET: {
    required: 'required for the detailed health payload',
    secrecy: 'secret',
    purpose:
      'Gates the DETAILED mynews-health payload (queue depths, ages, worker heartbeats) behind the X-MyNews-Worker-Secret header. The shallow {status, checkedAt} payload is public by design so an uptime probe and scripts/mynews-smoke.sh work without a credential. Unset makes the detailed payload UNAVAILABLE (503), never open: an unset secret must not read as "no authentication required".',
  },
  MYNEWS_DMCA_RATE_SALT: {
    required: 'required',
    secrecy: 'secret',
    purpose:
      'HMAC salt (at least 32 characters) used to hash the DMCA submitter email and signed platform IP into the durable nw_consume_dmca_rate_limit token-bucket keys, so the rate limiter never stores a raw identifier. The edge function and the web BFF route must hold the SAME value or the buckets split. Rotating it resets every in-flight bucket.',
  },

  MYNEWS_TRUSTED_CLIENT_IP_HEADER: {
    required: 'required for anonymous DMCA intake',
    secrecy: 'public',
    purpose:
      'Names the ONE inbound header the deployment guarantees its trusted edge sets and overwrites (Vercel: x-vercel-forwarded-for; Cloudflare: cf-connecting-ip; Fly: fly-client-ip). The mynews-web DMCA BFF reads only this header for the anonymous rate-limit IP and signs it for the edge. Unset means no trusted client IP can be derived, so anonymous DMCA submissions fail closed (503). It must name a header the proxy overwrites, or an attacker can spoof it; the app cannot verify that, so this is an operator responsibility.',
  },

  MYNEWS_PAYMENTS_PROVIDER: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Selects the support rail provider. Only the exact value `stripe` turns the live rail on; anything else, including unset, leaves the rail off and the capability detector reports payments as unavailable.',
  },
  MYNEWS_PAYMENTS_WEBHOOK_SECRET: {
    required: 'required when payments are enabled',
    secrecy: 'secret',
    purpose:
      'Stripe webhook signing secret. mynews-payments-webhook verifies every event signature against it and rejects the request when it is unset, so an unset secret means charges and payouts never reach the ledger.',
  },
  MYNEWS_STRIPE_SECRET_KEY: {
    required: 'required when payments are enabled',
    secrecy: 'secret',
    purpose: 'Stripe secret key mynews-support uses to open Checkout sessions and Connect onboarding links.',
  },
  MYNEWS_PAYMENTS_SUCCESS_URL: {
    required: 'required when payments are enabled',
    secrecy: 'public',
    purpose: 'Redirect target Stripe Checkout returns a reader to after a successful support charge.',
  },
  MYNEWS_PAYMENTS_CANCEL_URL: {
    required: 'required when payments are enabled',
    secrecy: 'public',
    purpose: 'Redirect target Stripe Checkout returns a reader to after an abandoned support charge.',
  },
  MYNEWS_PAYOUT_REFRESH_URL: {
    required: 'required when payments are enabled',
    secrecy: 'public',
    purpose: 'Stripe Connect onboarding refresh URL for a journalist whose onboarding link expired.',
  },
  MYNEWS_PAYOUT_RETURN_URL: {
    required: 'required when payments are enabled',
    secrecy: 'public',
    purpose: 'Stripe Connect onboarding return URL for a journalist who finished the payout setup flow.',
  },

  MYNEWS_PROCESSOR_CLEANUP_URL: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Processor-cleanup seam in mynews-account-worker/seams.ts. Unconfigured records the visible status skipped-unconfigured; it is never rewritten as done.',
  },
  MYNEWS_PROCESSOR_CLEANUP_SECRET: {
    required: 'optional, required when the cleanup URL is set',
    secrecy: 'secret',
    purpose:
      'Bearer secret for the processor-cleanup POST. Without it the seam stays skipped-unconfigured instead of calling an unauthenticated endpoint.',
  },
  MYNEWS_NCII_HASH_VENDOR_URL: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Hash-matching vendor endpoint (StopNCII or PhotoDNA class) in mynews-ncii-worker/seams.ts. Unconfigured routes the case to human review and never fabricates a match.',
  },
  MYNEWS_NCII_HASH_VENDOR_KEY: {
    required: 'optional, required when the hash vendor URL is set',
    secrecy: 'secret',
    purpose: 'API key for the NCII hash-matching vendor. Missing key leaves the seam unconfigured.',
  },
  MYNEWS_NCMEC_CYBERTIPLINE_URL: {
    required: 'optional, founder-ops',
    secrecy: 'public',
    purpose:
      'NCMEC CyberTipline submission endpoint. The vendor relationship is not onboarded, so this is unset today and the worker records a pending human-review state instead of inventing a report reference.',
  },
  MYNEWS_NCMEC_CYBERTIPLINE_CREDENTIALS: {
    required: 'optional, founder-ops',
    secrecy: 'secret',
    purpose:
      'NCMEC CyberTipline credentials. Unset today. Submission stays founder-ops until the relationship exists.',
  },
  MYNEWS_SCREENING_VENDOR_URL: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Optional escalate-only screening vendor called by _shared/mynews-screening-gate.ts. A vendor may only raise a class score, never clear a humanOnly class, and an absent vendor is the explicit unconfigured state rather than a verdict.',
  },
  MYNEWS_SCREENING_VENDOR_KEY: {
    required: 'optional, required when the screening vendor URL is set',
    secrecy: 'secret',
    purpose: 'API key for the screening vendor. Missing key leaves the vendor pass unconfigured.',
  },
  MYNEWS_SCREENING_VENDOR_NAME: {
    required: 'optional',
    secrecy: 'public',
    purpose: 'Vendor label recorded on screening decisions. Defaults to the literal string vendor.',
  },

  MYNEWS_SUPABASE_URL: {
    required: 'required',
    secrecy: 'public',
    purpose:
      'Supabase project base the public site reads articles through. Unset renders the honest not-connected state instead of an empty feed.',
  },
  MYNEWS_SUPABASE_ANON_KEY: {
    required: 'required',
    secrecy: 'public',
    purpose: 'Publishable anon key the site sends on its REST and functions calls.',
  },
  MYNEWS_PUBLIC_ORIGIN: {
    required: 'required for launch',
    secrecy: 'public',
    purpose:
      'Canonical origin for absolute URLs in RSS, sitemap, and OpenGraph tags. Unset falls back to the placeholder in lib/origin.ts, which would publish wrong canonical URLs, so set it before any public launch.',
  },
  MYNEWS_LEGAL_EMAIL: {
    required: 'required for launch',
    secrecy: 'public',
    purpose:
      'DSA contact address. Unset leaves the module placeholder, which the capability detector classifies as uncontrolled and which makes the legal bundle omit the contact line rather than publish a dead address.',
  },
  MYNEWS_SAFETY_EMAIL: {
    required: 'required for launch',
    secrecy: 'public',
    purpose: 'Safety and NCII reporting address published in the legal bundle. Same placeholder rule as the legal address.',
  },
  MYNEWS_DMCA_EMAIL: {
    required: 'required for launch',
    secrecy: 'public',
    purpose: 'Copyright and DMCA address published on /legal/dmca. Same placeholder rule as the legal address.',
  },
  MYNEWS_FUNCTIONS_URL: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Explicit functions origin override for the public site. Unset is normal: the cloud adapter and the capability detector both default to ${MYNEWS_SUPABASE_URL}/functions/v1, so an unset value is not treated as "no functions". Set it only when the functions host differs from the project host. scripts/mynews-smoke.sh reads the same name as its probe target.',
  },
  MYNEWS_PAYMENTS_ENABLED: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Affirmative support-rail flag for the public site. Missing, malformed, or placeholder values keep payments off, so the legal bundle never publishes the 2 percent platform-fee claim for a rail this deployment does not have.',
  },
  MYNEWS_WEB_REPORTING_ENABLED: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Affirmative flag for the web reporting surface. Anything other than an explicit truthy value keeps web reporting reported as unavailable.',
  },

  MYNEWS_CONSOLE_SUPABASE_URL: {
    required: 'required',
    secrecy: 'public',
    purpose:
      'Supabase project base for the moderation console. Unset makes middleware redirect every request to /login and the login page show the not-configured banner.',
  },
  MYNEWS_CONSOLE_SUPABASE_ANON_KEY: {
    required: 'required',
    secrecy: 'public',
    purpose: 'Publishable anon key for the console session client (magic-link sign-in and cookie refresh).',
  },
  MYNEWS_CONSOLE_SUPABASE_SERVICE_ROLE_KEY: {
    required: 'required',
    secrecy: 'secret',
    purpose:
      'Service-role key the console server actions use to read service-role-only tables (nw_ncii_cases, nw_dmca_notices, nw_moderation queue) and to call the enforcement RPCs. Server-only: lib/env.ts is marked server-only so it can never be imported into a client component.',
  },
  MYNEWS_CONSOLE_MODERATOR_EMAILS: {
    required: 'required',
    secrecy: 'public',
    purpose:
      'Comma-separated moderator allowlist. An empty or unset list authorizes NOBODY: middleware and requireModerator() both fail closed, so the console is unusable until it is set. That is the intended default.',
  },
  MYNEWS_CONSOLE_ORIGIN: {
    required: 'required',
    secrecy: 'public',
    purpose:
      'Console origin used to build magic-link redirect URLs. A wrong value sends moderators to a callback the Supabase project will not accept.',
  },

  NODE_ENV: {
    required: 'required',
    secrecy: 'public',
    provided: 'framework',
    purpose:
      'Set by the Next.js build and runtime, not by an operator. apps/mynews-web/middleware.ts relaxes one security header outside production based on it.',
  },
  EXPO_OS: {
    required: 'required',
    secrecy: 'public',
    provided: 'expo-runtime',
    purpose:
      'Injected by Expo Router at runtime. runtime-capabilities.ts reads it to pick the ios or android RevenueCat key. Not operator-set.',
  },

  EAS_BUILD_PROFILE: {
    required: 'required in EAS Build',
    secrecy: 'public',
    provided: 'eas-build',
    purpose:
      'Injected by EAS Build. apps/mynews/scripts/check-build-env.mjs enforces the full release env contract only when this is the production profile, and reports skipped otherwise. A local run with it unset therefore checks nothing, which is why the gate belongs in the EAS build step.',
  },
  EAS_BUILD_PLATFORM: {
    required: 'required in EAS Build',
    secrecy: 'public',
    provided: 'eas-build',
    purpose:
      'Injected by EAS Build. Tells check-build-env.mjs which RevenueCat key name (ios or android) must be present and prefix-valid for this build.',
  },
  MYNEWS_RELEASE_MANIFEST_PATH: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Overrides the release-manifest path check-build-env.mjs reads. Defaults to apps/mynews/release-manifest.json. Used by tests and by an operator checking a candidate manifest, not in normal builds.',
  },

  EXPO_PUBLIC_MYNEWS_SUPABASE_URL: {
    required: 'required',
    secrecy: 'public',
    purpose:
      'Supabase project base for the app. Unset makes every reader and composer surface render the honest not-connected state. check-build-env.mjs rejects a release build without it.',
  },
  EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY: {
    required: 'required',
    secrecy: 'public',
    purpose: 'Publishable anon key the fetch-based cloud adapter sends. Release builds are rejected without it.',
  },
  EXPO_PUBLIC_MYNEWS_FUNCTIONS_URL: {
    required: 'required',
    secrecy: 'public',
    purpose:
      'Edge functions origin. Optional at runtime because the adapter defaults to ${baseUrl}/functions/v1, but check-build-env.mjs requires an explicit production value for a release build.',
  },
  EXPO_PUBLIC_MYNEWS_LEGAL_EMAIL: {
    required: 'required',
    secrecy: 'public',
    purpose: 'DSA contact shown on the in-app legal screen and pinned against release-manifest.json by check-build-env.mjs.',
  },
  EXPO_PUBLIC_MYNEWS_SAFETY_EMAIL: {
    required: 'required',
    secrecy: 'public',
    purpose: 'Safety and NCII contact shown on the in-app legal screen and pinned against release-manifest.json.',
  },
  EXPO_PUBLIC_MYNEWS_DMCA_EMAIL: {
    required: 'required',
    secrecy: 'public',
    purpose: 'Copyright and DMCA contact shown on the in-app legal screen and pinned against release-manifest.json.',
  },
  EXPO_PUBLIC_MYNEWS_PAYMENTS_ENABLED: {
    required: 'optional',
    secrecy: 'public',
    purpose:
      'Affirmative support-rail flag. check-build-env.mjs requires it to agree with release-manifest.json in both directions, so a manifest that claims the rail is live fails the build when this is off, and the reverse also fails.',
  },
  EXPO_PUBLIC_MYNEWS_PAYMENTS_PROVIDER: {
    required: 'optional, required when payments are enabled',
    secrecy: 'public',
    purpose: 'Support-rail provider name for the app capability detector. Must agree with release-manifest.json.',
  },
  EXPO_PUBLIC_MYNEWS_WEB_REPORTING_ENABLED: {
    required: 'optional',
    secrecy: 'public',
    purpose: 'Affirmative flag telling the app that the website accepts reports, used for in-app reporting copy.',
  },
  EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_IOS: {
    required: 'required for iOS release',
    secrecy: 'public',
    purpose:
      'Public RevenueCat SDK key for the App Store build. Prefix-validated as appl_; a mismatched prefix disables subscriptions with honest copy instead of failing at purchase time.',
  },
  EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY_ANDROID: {
    required: 'required for Android release',
    secrecy: 'public',
    purpose: 'Public RevenueCat SDK key for the Play build. Prefix-validated as goog_.',
  },
  EXPO_PUBLIC_MYNEWS_REVENUECAT_API_KEY: {
    required: 'optional fallback',
    secrecy: 'public',
    purpose:
      'Single-key fallback used when the platform-specific key is absent. Still prefix-validated per platform, so one key cannot serve both stores.',
  },
  EXPO_PUBLIC_REVENUECAT_API_KEY: {
    required: 'optional fallback',
    secrecy: 'public',
    purpose:
      'Suite-wide RevenueCat key fallback, last in the resolution order after the MyNews-specific names.',
  },
  EXPO_PUBLIC_MYNEWS_ENTITLEMENTS_TEST_MODE: {
    required: 'must be unset for release',
    secrecy: 'public',
    purpose:
      'Development entitlement bypass. check-build-env.mjs fails a release build when it is the string true, so a build can never ship with paid features unlocked for everyone.',
  },
};

/* -------------------------------------------------------------------------- */
/* Extraction                                                                 */
/* -------------------------------------------------------------------------- */

const NAME_SHAPE = '[A-Z][A-Z0-9_]{2,}';

const LITERAL_PATTERNS = [
  new RegExp(`\\benv\\(\\s*['"\`](${NAME_SHAPE})['"\`]\\s*\\)`, 'g'),
  new RegExp(`\\bDeno\\.env\\.get\\(\\s*['"\`](${NAME_SHAPE})['"\`]\\s*\\)`, 'g'),
  new RegExp(`\\bprocess\\.env\\.(${NAME_SHAPE})\\b`, 'g'),
  new RegExp(`\\bprocess\\.env\\[\\s*['"\`](${NAME_SHAPE})['"\`]\\s*\\]`, 'g'),
  // Indirect reads through an `env` map parameter, which is how the web
  // capability detector and the app launch-environment policy read process.env.
  new RegExp(`\\benv\\.(${NAME_SHAPE})\\b`, 'g'),
  new RegExp(`\\benv\\[\\s*['"\`](${NAME_SHAPE})['"\`]\\s*\\]`, 'g'),
];

const CONSTANT_PATTERNS = [
  new RegExp(`\\benv\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\)`, 'g'),
  new RegExp(`\\bDeno\\.env\\.get\\(\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\)`, 'g'),
  new RegExp(`\\bprocess\\.env\\[\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\]`, 'g'),
  new RegExp(`\\benv\\[\\s*([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\]`, 'g'),
];

const EXPO_BARE_PATTERN = new RegExp(
  '\\b(EXPO_PUBLIC_(?:MYNEWS|REVENUECAT)_[A-Z0-9_]+)',
  'g',
);

const CONSTANT_DECLARATION = new RegExp(
  `(?:export\\s+)?const\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*(?::[^=]+)?=\\s*['"\`](${NAME_SHAPE})['"\`]`,
  'g',
);

function walk(absDir, relPrefix, out) {
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const rel = relPrefix ? path.join(relPrefix, entry.name) : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walk(path.join(absDir, entry.name), rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
}

/** Files a surface scans, as repo-relative paths, sorted. */
export function collectSurfaceFiles(repoRoot, surface) {
  const found = new Set();
  for (const root of surface.roots) {
    const absRoot = path.join(repoRoot, root.dir);
    if (!fs.existsSync(absRoot)) continue;
    const rels = [];
    walk(absRoot, '', rels);
    for (const rel of rels) {
      if (!root.exts.includes(path.extname(rel))) continue;
      if (root.accept && !root.accept(rel)) continue;
      if (isTestFile(rel)) continue;
      found.add(path.posix.join(root.dir, rel.split(path.sep).join('/')));
    }
  }
  return [...found].sort();
}

/** Maps identifier -> env var name for `export const X = 'MYNEWS_...'` forms. */
export function collectConstants(repoRoot, files) {
  const constants = new Map();
  for (const rel of files) {
    const text = readFileSafe(path.join(repoRoot, rel));
    if (text === null) continue;
    CONSTANT_DECLARATION.lastIndex = 0;
    let match;
    while ((match = CONSTANT_DECLARATION.exec(text)) !== null) {
      constants.set(match[1], match[2]);
    }
  }
  return constants;
}

function readFileSafe(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Scans one surface. Returns Map<varName, Array<file>> with references
 * deduplicated per file and sorted.
 *
 * File paths only, deliberately no line numbers. A line number is stale the
 * moment anyone inserts a line above the read, which would make the currency
 * gate fire on edits that changed nothing about the environment contract. A gate
 * that cries wolf is a gate people learn to regenerate without reading, and this
 * one exists so that a NEW variable cannot ship undocumented.
 */
export function scanSurface(repoRoot, surface, constants) {
  const files = collectSurfaceFiles(repoRoot, surface);
  const reads = new Map();

  const record = (name, file) => {
    if (!reads.has(name)) reads.set(name, new Set());
    reads.get(name).add(file);
  };

  for (const rel of files) {
    const text = readFileSafe(path.join(repoRoot, rel));
    if (text === null) continue;
    const lines = text.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      for (const pattern of LITERAL_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) record(match[1], rel);
      }
      for (const pattern of CONSTANT_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const resolved = constants.get(match[1]);
          if (resolved) record(resolved, rel);
        }
      }
      if (surface.expoBare) {
        EXPO_BARE_PATTERN.lastIndex = 0;
        let match;
        while ((match = EXPO_BARE_PATTERN.exec(line)) !== null) record(match[1], rel);
      }
    }
  }

  const result = new Map();
  for (const name of [...reads.keys()].sort()) {
    result.set(name, [...reads.get(name)].sort());
  }
  return result;
}

/** Full scan result: per-surface variables plus the unannotated name list. */
export function buildMatrix(repoRoot = REPO_ROOT) {
  const allFiles = new Set();
  for (const surface of SURFACES) {
    for (const rel of collectSurfaceFiles(repoRoot, surface)) allFiles.add(rel);
  }
  const constants = collectConstants(repoRoot, [...allFiles].sort());

  const surfaces = SURFACES.map((surface) => {
    const reads = scanSurface(repoRoot, surface, constants);
    return {
      key: surface.key,
      title: surface.title,
      blurb: surface.blurb,
      variables: [...reads.entries()].map(([name, refs]) => ({
        name,
        refs,
        annotation: ANNOTATIONS[name] ?? null,
      })),
    };
  });

  const unannotated = new Set();
  for (const surface of surfaces) {
    for (const variable of surface.variables) {
      if (!variable.annotation) unannotated.add(variable.name);
    }
  }

  return { surfaces, constants, unannotated: [...unannotated].sort() };
}

/* -------------------------------------------------------------------------- */
/* Rendering                                                                  */
/* -------------------------------------------------------------------------- */

function cell(value) {
  return String(value).replace(/\|/g, '\\|');
}

function refsCell(refs) {
  return refs.map((ref) => `\`${ref}\``).join('<br>');
}

export function renderMarkdown(matrix) {
  const lines = [];
  lines.push('# MyNews environment matrix');
  lines.push('');
  lines.push(
    `GENERATED FILE. Do not hand-edit. Produced by \`node ${GENERATOR_REL}\` and verified in CI by \`pnpm check:mynews-env-matrix\`.`,
  );
  lines.push('');
  lines.push(
    'Every variable name and every file reference below is extracted from source, so this table cannot drift from the code. Regenerate it whenever a MyNews source file adds or removes an environment read, or when a read moves to a different file. Line numbers are deliberately not recorded: they go stale on edits that change nothing about the environment contract. The verifier fails on a stale file and on any variable that has no annotation.',
  );
  lines.push('');
  lines.push('**How the three non-derivable columns work.** Source cannot say whether a variable is required, whether it is a secret, or what it is for. Those three columns come from a hand-maintained annotation map inside the generator. A variable the scan finds with no annotation renders as `UNANNOTATED` and makes the verifier exit non-zero, so a new operational variable cannot be added silently.');
  lines.push('');
  lines.push('**Scan roots.**');
  lines.push('');
  lines.push('- `supabase/functions/mynews-*/**/*.ts` and `supabase/functions/_shared/mynews-*.ts`, matching `env(\'NAME\')`, `Deno.env.get(\'NAME\')`, and reads through a resolved name constant such as `env(ENV_SCREENING_VENDOR_URL)`.');
  lines.push('- `apps/mynews-web/**/*.{ts,tsx}` and `apps/mynews-console/**/*.{ts,tsx}`, matching `process.env.NAME`, `process.env[\'NAME\']`, `process.env[CONST]`, and indirect reads through an `env` map parameter such as `env.MYNEWS_SUPABASE_URL`. Console constants come from `apps/mynews-console/lib/env-names.ts`.');
  lines.push('- `apps/mynews/**/*.{ts,tsx,mjs}` plus `app.json` and `app.config.*`, matching the patterns above and bare `EXPO_PUBLIC_MYNEWS_*` / `EXPO_PUBLIC_REVENUECAT_*` identifiers.');
  lines.push('');
  lines.push('**Exclusions.** `node_modules`, `dist`, `build`, `coverage`, `.next`, `.expo`, `.turbo`, `__tests__`, `__fixtures__`, `__snapshots__`, `playwright-report`, `test-results`, any `test/`, `tests/`, or `e2e/` directory, any `*.test.*` or `*.spec.*` file, and any `playwright.config.*` / `vitest.config.*` / `jest.config.*` file. A test-only environment read is not an operational requirement, so it is deliberately absent from this document, and so are the test-harness variables that only the Playwright and Vitest runners read. This is a known blind spot: if a variable is genuinely needed at runtime, it must be read from non-test source or it will not appear here.');
  lines.push('');

  for (const surface of matrix.surfaces) {
    lines.push(`## ${surface.title}`);
    lines.push('');
    lines.push(surface.blurb);
    lines.push('');
    if (surface.variables.length === 0) {
      lines.push('No environment reads found in this surface.');
      lines.push('');
      continue;
    }
    lines.push('| Variable | Required | Secret or public | Consumed by (file) | Purpose |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const variable of surface.variables) {
      const annotation = variable.annotation;
      const required = annotation ? annotation.required : UNANNOTATED_CELL;
      const secrecy = annotation
        ? annotation.secrecy === 'secret'
          ? 'secret'
          : 'public'
        : UNANNOTATED_CELL;
      const purpose = annotation
        ? annotation.provided
          ? `${annotation.purpose} (${providedLabel(annotation.provided)})`
          : annotation.purpose
        : UNANNOTATED_CELL;
      lines.push(
        `| \`${variable.name}\` | ${cell(required)} | ${cell(secrecy)} | ${refsCell(variable.refs)} | ${cell(purpose)} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Platform-injected variables (do not set these by hand)');
  lines.push('');
  lines.push(
    'These come from the platform, not from an operator. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are injected into every edge function runtime by Supabase, and `supabase secrets set` refuses the reserved `SUPABASE_` prefix, so there is nothing to configure. `NODE_ENV` comes from the Next.js build, `EXPO_OS` from the Expo runtime, and `EAS_BUILD_*` from EAS Build. If one of these looks wrong at runtime, the problem is the project link, the build profile, or the deployment, not a missing secret.',
  );
  lines.push('');
  lines.push('| Variable | Injected by | Read by MyNews source | Notes |');
  lines.push('| --- | --- | --- | --- |');
  const scanned = new Set();
  for (const surface of matrix.surfaces) {
    for (const variable of surface.variables) scanned.add(variable.name);
  }
  for (const [name, annotation] of Object.entries(ANNOTATIONS)) {
    if (!annotation.provided) continue;
    lines.push(
      `| \`${name}\` | ${cell(providedLabel(annotation.provided))} | ${scanned.has(name) ? 'yes' : 'no direct read'} | ${cell(annotation.purpose)} |`,
    );
  }
  lines.push('');

  lines.push('## Operator-only variables (no application source reads them)');
  lines.push('');
  lines.push(
    'These are set in the shell or CI environment that runs the release scripts. They are listed by hand because no scan root reads them, and they are part of the release checklist all the same. `scripts/mynews-smoke.sh` additionally reads `MYNEWS_FUNCTIONS_URL`, which is documented in the website table above because the site reads it too.',
  );
  lines.push('');
  lines.push('| Variable | Required | Secret or public | Purpose |');
  lines.push('| --- | --- | --- | --- |');
  for (const entry of OPERATOR_ONLY) {
    lines.push(
      `| \`${entry.name}\` | ${cell(entry.required)} | ${cell(entry.secrecy)} | ${cell(entry.purpose)} |`,
    );
  }
  lines.push('');

  if (matrix.unannotated.length > 0) {
    lines.push('## Unannotated variables');
    lines.push('');
    lines.push(
      'The scan found these variables with no annotation in the generator. `pnpm check:mynews-env-matrix` fails until each one is annotated.',
    );
    lines.push('');
    for (const name of matrix.unannotated) lines.push(`- \`${name}\``);
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function providedLabel(provided) {
  if (provided === 'supabase-platform') return 'injected by the Supabase edge runtime';
  if (provided === 'framework') return 'set by the Next.js build and runtime';
  if (provided === 'expo-runtime') return 'injected by the Expo runtime';
  if (provided === 'eas-build') return 'injected by EAS Build';
  return provided;
}

/* -------------------------------------------------------------------------- */
/* Diff + check                                                               */
/* -------------------------------------------------------------------------- */

/** Minimal line diff, enough to show an operator what went stale. */
export function unifiedishDiff(expected, actual) {
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const out = [];
  const max = Math.max(expectedLines.length, actualLines.length);
  for (let index = 0; index < max; index += 1) {
    const left = actualLines[index];
    const right = expectedLines[index];
    if (left === right) continue;
    if (left !== undefined) out.push(`- ${OUTPUT_REL}:${index + 1}: ${left}`);
    if (right !== undefined) out.push(`+ regenerated:${index + 1}: ${right}`);
  }
  return out.join('\n');
}

export function checkMatrix(repoRoot = REPO_ROOT) {
  const matrix = buildMatrix(repoRoot);
  const expected = renderMarkdown(matrix);
  const outPath = path.join(repoRoot, OUTPUT_REL);
  const onDisk = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
  const missing = onDisk === null;
  const stale = !missing && onDisk !== expected;
  return {
    ok: !missing && !stale && matrix.unannotated.length === 0,
    missing,
    stale,
    unannotated: matrix.unannotated,
    diff: missing ? '' : unifiedishDiff(expected, onDisk),
    expected,
    outPath,
  };
}

export function writeMatrix(repoRoot = REPO_ROOT) {
  const matrix = buildMatrix(repoRoot);
  const content = renderMarkdown(matrix);
  const outPath = path.join(repoRoot, OUTPUT_REL);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');
  return { outPath, matrix, content };
}

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

function main(argv) {
  const wantsCheck = argv.includes('--check');
  const wantsHelp = argv.includes('--help') || argv.includes('-h');

  if (wantsHelp) {
    process.stdout.write(
      [
        `Usage: node ${GENERATOR_REL} [--check]`,
        '',
        `  (no flags)  regenerate ${OUTPUT_REL}`,
        `  --check     regenerate in memory, diff against the committed file,`,
        '              print the diff and exit 1 if it is stale or missing',
        '',
        'Both modes exit 1 when the scan finds a variable with no annotation.',
        '',
      ].join('\n'),
    );
    return 0;
  }

  if (wantsCheck) {
    const result = checkMatrix();
    if (result.missing) {
      process.stderr.write(
        `FAILED: ${OUTPUT_REL} does not exist. Run: node ${GENERATOR_REL}\n`,
      );
      return 1;
    }
    if (result.stale) {
      process.stderr.write(`FAILED: ${OUTPUT_REL} is stale.\n\n${result.diff}\n\n`);
      process.stderr.write(`Run: node ${GENERATOR_REL}\n`);
      return 1;
    }
    if (result.unannotated.length > 0) {
      process.stderr.write(
        `FAILED: ${result.unannotated.length} environment variable(s) have no annotation:\n`,
      );
      for (const name of result.unannotated) process.stderr.write(`  ${name}\n`);
      process.stderr.write(`Add an annotation in ${GENERATOR_REL}, then regenerate.\n`);
      return 1;
    }
    process.stdout.write(`${OUTPUT_REL} is current and fully annotated.\n`);
    return 0;
  }

  const { outPath, matrix } = writeMatrix();
  const total = new Set();
  for (const surface of matrix.surfaces) {
    for (const variable of surface.variables) total.add(variable.name);
  }
  process.stdout.write(
    `wrote ${path.relative(REPO_ROOT, outPath)} (${total.size} variables across ${matrix.surfaces.length} surfaces)\n`,
  );
  if (matrix.unannotated.length > 0) {
    process.stderr.write(
      `FAILED: ${matrix.unannotated.length} variable(s) have no annotation and were written as UNANNOTATED:\n`,
    );
    for (const name of matrix.unannotated) process.stderr.write(`  ${name}\n`);
    return 1;
  }
  return 0;
}

/**
 * Compare REAL paths. A plain `import.meta.url === pathToFileURL(argv[1])`
 * check silently reports "not the entrypoint" whenever the script is invoked
 * through a symlinked directory (on macOS every path under /tmp and
 * /var/folders is one), which would make the CLI exit 0 without doing anything.
 * A verifier that exits 0 without verifying is exactly the lie this file exists
 * to prevent, so resolve both sides before comparing.
 */
function isEntrypoint() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isEntrypoint()) {
  process.exit(main(process.argv.slice(2)));
}
