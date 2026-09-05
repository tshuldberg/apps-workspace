#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

let failures = 0;

function out(line) {
  process.stdout.write(`${line}\n`);
}

function err(line) {
  process.stderr.write(`${line}\n`);
}

function fail(message) {
  err(`FAIL ${message}`);
  failures += 1;
}

function ok(message) {
  out(`OK   ${message}`);
}

function ensureFile(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    fail(`${path} is missing`);
    return '';
  }
  ok(path);
  return readFileSync(full, 'utf8');
}

function ensureContains(path, contents, needle, label) {
  if (!contents) return; // file missing already reported
  if (contents.includes(needle)) {
    ok(`${path} ${label}`);
  } else {
    fail(`${path} ${label} (expected to contain ${JSON.stringify(needle)})`);
  }
}

out('Checking MyNews standalone app artifacts...\n');

// Module package + engines
const modulePkg = ensureFile('modules/mynews/package.json');
ensureContains('modules/mynews/package.json', modulePkg, '"@mylife/mynews"', 'is the module package');
const definition = ensureFile('modules/mynews/src/definition.ts');
ensureContains('modules/mynews/src/definition.ts', definition, "tablePrefix: 'nw_'", 'declares the nw_ prefix');
ensureContains('modules/mynews/src/definition.ts', definition, 'shareable: false', 'keeps P0 sync private');
ensureFile('modules/mynews/src/engines/diff.ts');
ensureFile('modules/mynews/src/engines/credibility.ts');
ensureFile('modules/mynews/src/engines/fees.ts');

// Phase 1: signing contract + data layer + the RSC-safe subpath
ensureFile('modules/mynews/src/signing/canonical.ts');
ensureFile('modules/mynews/src/signing/__fixtures__/signing-vectors.json');
ensureFile('modules/mynews/src/data/cloud-fetch.ts');
ensureContains('modules/mynews/package.json', modulePkg, '"./cloud-fetch"', 'exposes the web-safe subpath');

// Phase 1: edge functions + their canonicalization twin
ensureFile('supabase/functions/_shared/mynews-signing.ts');
ensureFile('supabase/functions/mynews-publish/index.ts');
ensureFile('supabase/functions/mynews-suggest/index.ts');
ensureFile('supabase/functions/mynews-review/index.ts');
ensureFile('supabase/migrations/20260703000002_mynews_rpcs.sql');

// Track 0.5: pubkey proof-of-possession. The register-key function is the only
// path to a non-empty pubkey_ed25519; the migration adds the client-write guard
// trigger + the service-role binder RPC. The canonical twins must agree on the
// versioned key-possession domain.
const registerKeyFn = ensureFile('supabase/functions/mynews-register-key/index.ts');
ensureContains(
  'supabase/functions/mynews-register-key/index.ts',
  registerKeyFn,
  'canonicalKeyPossessionBytes',
  'verifies the key-possession proof',
);
const popMigration = ensureFile('supabase/migrations/20260705000003_mynews_pubkey_pop.sql');
ensureContains(
  'supabase/migrations/20260705000003_mynews_pubkey_pop.sql',
  popMigration,
  'nw_profiles_guard_client_update',
  'guards client pubkey writes',
);
ensureContains(
  'supabase/migrations/20260705000003_mynews_pubkey_pop.sql',
  popMigration,
  'nw_set_profile_pubkey',
  'binds the key under the service role',
);
const moduleSigning = ensureFile('supabase/functions/_shared/mynews-signing.ts');
ensureContains(
  'supabase/functions/_shared/mynews-signing.ts',
  moduleSigning,
  'mylife-mynews-key-possession-v1',
  'edge twin declares the key-possession domain',
);
const moduleCanonical = ensureFile('modules/mynews/src/signing/canonical.ts');
ensureContains(
  'modules/mynews/src/signing/canonical.ts',
  moduleCanonical,
  'mylife-mynews-key-possession-v1',
  'module declares the key-possession domain',
);

// Track 0.5: signed article metadata. nw_article_meta writes must be author-
// signed over the article-meta canonical bytes and verified by the mynews-set-meta
// function; the migration replaces the client FOR-ALL write policy with a client-
// write guard trigger + the service-role signed-upsert RPC. The canonical twins
// must agree on the versioned article-meta domain.
const setMetaFn = ensureFile('supabase/functions/mynews-set-meta/index.ts');
ensureContains(
  'supabase/functions/mynews-set-meta/index.ts',
  setMetaFn,
  'canonicalArticleMetaBytes',
  'verifies the article-meta signature',
);
const signedMetaMigration = ensureFile('supabase/migrations/20260705000004_mynews_signed_meta.sql');
ensureContains(
  'supabase/migrations/20260705000004_mynews_signed_meta.sql',
  signedMetaMigration,
  'nw_article_meta_guard_client_write',
  'guards client metadata writes',
);
ensureContains(
  'supabase/migrations/20260705000004_mynews_signed_meta.sql',
  signedMetaMigration,
  'nw_upsert_article_meta',
  'upserts signed metadata under the service role',
);
ensureContains(
  'supabase/migrations/20260705000004_mynews_signed_meta.sql',
  signedMetaMigration,
  'drop policy if exists nw_article_meta_owner_all',
  'retires the client FOR-ALL write policy',
);
ensureContains(
  'supabase/functions/_shared/mynews-signing.ts',
  moduleSigning,
  'mylife-mynews-article-meta-v1',
  'edge twin declares the article-meta domain',
);
ensureContains(
  'modules/mynews/src/signing/canonical.ts',
  moduleCanonical,
  'mylife-mynews-article-meta-v1',
  'module declares the article-meta domain',
);

// Track 1 P1: content reporting (Apple Guideline 1.2). The mynews-report edge
// function is the only write path to nw_reports; the migration drops the client
// insert policy, adds the client-write guard trigger, the one-open-per-target
// unique index, and the service-role insert RPC. The port method + the app and
// web report surfaces round out the end-to-end wiring.
const reportFn = ensureFile('supabase/functions/mynews-report/index.ts');
ensureContains(
  'supabase/functions/mynews-report/index.ts',
  reportFn,
  "jsonError('not-signed-in'",
  'requires a session (closes anonymous flooding)',
);
ensureContains(
  'supabase/functions/mynews-report/index.ts',
  reportFn,
  "jsonError('rate-limited'",
  'rate-limits per reporter',
);
ensureContains(
  'supabase/functions/mynews-report/index.ts',
  reportFn,
  "jsonError('bad-target'",
  'validates the report target exists',
);
const reportMigration = ensureFile('supabase/migrations/20260705000005_mynews_report_intake.sql');
ensureContains(
  'supabase/migrations/20260705000005_mynews_report_intake.sql',
  reportMigration,
  'drop policy if exists nw_reports_reporter_insert',
  'retires the client insert policy',
);
ensureContains(
  'supabase/migrations/20260705000005_mynews_report_intake.sql',
  reportMigration,
  'nw_reports_guard_client_insert',
  'guards client report writes',
);
ensureContains(
  'supabase/migrations/20260705000005_mynews_report_intake.sql',
  reportMigration,
  'nw_insert_report',
  'inserts the report under the service role',
);
const reportOrchestrator = ensureFile('modules/mynews/src/data/report.ts');
ensureContains(
  'modules/mynews/src/data/report.ts',
  reportOrchestrator,
  'reportErrorMessage',
  'maps typed report errors to honest copy',
);
ensureContains('modules/mynews/src/data/cloud.ts', ensureFile('modules/mynews/src/data/cloud.ts'), 'submitReport', 'port exposes submitReport');
// App report surfaces
ensureFile('apps/mynews/app/(root)/components/ReportCard.tsx');
ensureFile('apps/mynews/app/(root)/lib/report-errors.ts');
// Web report surfaces
ensureFile('apps/mynews-web/app/api/report/route.ts');
const webReportButton = ensureFile('apps/mynews-web/app/components/ReportButton.tsx');
ensureContains(
  'apps/mynews-web/app/components/ReportButton.tsx',
  webReportButton,
  '@mylife/mynews/cloud-fetch',
  'uses the RSC-safe subpath',
);

// Hub contract
const registry = ensureFile('packages/module-registry/src/constants.ts');
ensureContains('packages/module-registry/src/constants.ts', registry, 'mynews:', 'registers metadata');
const releases = ensureFile('packages/module-registry/src/release-states.ts');
ensureContains('packages/module-registry/src/release-states.ts', releases, "'mynews'", 'has a release state');
const billing = ensureFile('packages/billing-config/src/index.ts');
ensureContains('packages/billing-config/src/index.ts', billing, 'mylife_mynews_unlock', 'sells the unlock');

// Expo app shell
const appPkg = ensureFile('apps/mynews/package.json');
ensureContains('apps/mynews/package.json', appPkg, '"@mylife/mynews"', 'app consumes the module');
const appJson = ensureFile('apps/mynews/app.json');
ensureContains('apps/mynews/app.json', appJson, 'com.mylife.mynews', 'uses the suite bundle id');
ensureFile('apps/mynews/eas.json');
ensureFile('apps/mynews/metro.config.js');
ensureFile('apps/mynews/tsconfig.json');
ensureFile('apps/mynews/scripts/check-build-env.mjs');
ensureFile('apps/mynews/app/_layout.tsx');
ensureFile('apps/mynews/app/index.tsx');
ensureFile('apps/mynews/app/(root)/(tabs)/_layout.tsx');
ensureFile('apps/mynews/app/(root)/(tabs)/index.tsx');
ensureFile('apps/mynews/app/(root)/(tabs)/discover.tsx');
ensureFile('apps/mynews/app/(root)/(tabs)/desk.tsx');
ensureFile('apps/mynews/app/(root)/(tabs)/support.tsx');
ensureFile('apps/mynews/app/(root)/(tabs)/me.tsx');
ensureFile('apps/mynews/app/(root)/theme/tokens.ts');
ensureFile('apps/mynews/app/(root)/article/[slug].tsx');
ensureFile('apps/mynews/app/(root)/journalist/[handle].tsx');
ensureFile('apps/mynews/app/(root)/compose.tsx');
ensureFile('apps/mynews/app/(root)/providers/IdentityProvider.tsx');

// Phase 2: editing-desk module surface (engines, orchestrators, RSC-safe engines subpath, server twins)
ensureFile('modules/mynews/src/engines/dupes.ts');
ensureFile('modules/mynews/src/engines/__fixtures__/dupe-vectors.json');
ensureFile('modules/mynews/src/data/review.ts');
ensureFile('modules/mynews/src/engines-public.ts');
ensureContains('modules/mynews/package.json', modulePkg, '"./engines"', 'exposes the engines subpath');
ensureFile('supabase/functions/_shared/mynews-cred.ts');
ensureFile('supabase/functions/_shared/mynews-dupes.ts');

// Phase 2: editing-desk Expo surfaces (auth, registration, desk, newsrooms)
ensureFile('apps/mynews/app/(root)/providers/AuthProvider.tsx');
ensureFile('apps/mynews/app/(root)/register.tsx');
ensureFile('apps/mynews/app/(root)/credibility/[handle].tsx');
ensureFile('apps/mynews/app/(root)/suggest/[slug].tsx');
ensureFile('apps/mynews/app/(root)/suggestion/[id].tsx');
ensureFile('apps/mynews/app/(root)/review-batch/[articleId].tsx');
ensureFile('apps/mynews/app/(root)/newsrooms.tsx');
ensureFile('apps/mynews/app/(root)/newsroom/[id].tsx');

// Web app shell
const webPkg = ensureFile('apps/mynews-web/package.json');
ensureContains('apps/mynews-web/package.json', webPkg, '"@mylife/mynews"', 'web consumes the module');
ensureContains('apps/mynews-web/package.json', webPkg, '"next"', 'is a Next.js app');
ensureFile('apps/mynews-web/app/layout.tsx');
ensureFile('apps/mynews-web/app/page.tsx');
ensureFile('apps/mynews-web/app/a/[slug]/page.tsx');
ensureFile('apps/mynews-web/app/j/[handle]/page.tsx');
ensureFile('apps/mynews-web/app/feed.xml/route.ts');
ensureFile('apps/mynews-web/app/sitemap.ts');
const webCloud = ensureFile('apps/mynews-web/lib/cloud.ts');
ensureContains('apps/mynews-web/lib/cloud.ts', webCloud, "@mylife/mynews/cloud-fetch", 'uses the RSC-safe subpath');

// Phase 2: editing-desk web surfaces (read-only, engines subpath for public math)
ensureFile('apps/mynews-web/app/a/[slug]/suggestions/page.tsx');
ensureFile('apps/mynews-web/app/e/[handle]/page.tsx');
ensureFile('apps/mynews-web/app/about/editing/page.tsx');
const webEditing = ensureFile('apps/mynews-web/lib/editing.ts');
ensureContains('apps/mynews-web/lib/editing.ts', webEditing, "@mylife/mynews/engines", 'computes public math via the engines subpath');

// Canonical record
ensureFile('supabase/migrations/20260703000001_mynews_bootstrap.sql');
ensureFile('supabase/migrations/20260703000003_mynews_editing_desk.sql');

// Track 1 P2: block / mute list (self-scoped, nw_follows-style RLS) + app surface
const blocksMigration = ensureFile('supabase/migrations/20260705000006_mynews_blocks.sql');
ensureContains(
  'supabase/migrations/20260705000006_mynews_blocks.sql',
  blocksMigration,
  'nw_blocks_self_all',
  'gives the blocker self-scoped ownership',
);
ensureFile('modules/mynews/src/data/blocks.ts');
ensureFile('apps/mynews/app/(root)/blocked.tsx');
ensureFile('apps/mynews/app/(root)/components/BlockCard.tsx');

// Track 1 P3 (Plan 39 T8): moderation console + enforcement. The migration adds
// the suspension signal (service-role-only), the audit table (service-role-only),
// and the four enforcement RPCs; the store gains isProfileSuspended + queue read +
// the RPC callers; publish/suggest/report enforce suspension; a focused
// service-role console (@mylife/mynews-console) drives the queue.
const modMigration = ensureFile('supabase/migrations/20260705000007_mynews_moderation.sql');
ensureContains(
  'supabase/migrations/20260705000007_mynews_moderation.sql',
  modMigration,
  'suspended_until timestamptz',
  'adds the suspension signal',
);
ensureContains(
  'supabase/migrations/20260705000007_mynews_moderation.sql',
  modMigration,
  'nw_profiles_guard_suspension_write',
  'guards client suspension writes',
);
ensureContains(
  'supabase/migrations/20260705000007_mynews_moderation.sql',
  modMigration,
  'create table if not exists public.nw_moderation_actions',
  'creates the moderation audit trail',
);
for (const rpc of [
  'nw_moderate_hide_article',
  'nw_moderate_hide_suggestion',
  'nw_moderate_suspend_profile',
  'nw_moderate_resolve_report',
]) {
  ensureContains(
    'supabase/migrations/20260705000007_mynews_moderation.sql',
    modMigration,
    `create or replace function public.${rpc}`,
    `defines the ${rpc} enforcement RPC`,
  );
  ensureContains(
    'supabase/migrations/20260705000007_mynews_moderation.sql',
    modMigration,
    `grant execute on function public.${rpc}`,
    `grants ${rpc} to service_role`,
  );
}
ensureContains(
  'supabase/migrations/20260705000007_mynews_moderation.sql',
  modMigration,
  'from anon, authenticated',
  'revokes the enforcement RPCs from clients',
);

// Store: suspension read + queue read + enforcement RPC callers.
const store = ensureFile('supabase/functions/_shared/mynews-store.ts');
ensureContains('supabase/functions/_shared/mynews-store.ts', store, 'isProfileSuspended', 'store reads suspension');
ensureContains('supabase/functions/_shared/mynews-store.ts', store, 'getOpenReportQueue', 'store reads the report queue with context');
ensureContains('supabase/functions/_shared/mynews-store.ts', store, 'moderateHideArticle', 'store calls the hide-article RPC');
ensureContains('supabase/functions/_shared/mynews-store.ts', store, 'moderateSuspendProfile', 'store calls the suspend RPC');

// Suspension enforcement on the three actor edge paths. Publish and suggest
// block a suspended actor outright; report (plan 48 WP1) preserves the safety
// path for suspended users behind the stricter suspended-tier throttle instead
// of a blanket 403.
for (const fn of ['mynews-publish', 'mynews-suggest', 'mynews-report']) {
  const src = ensureFile(`supabase/functions/${fn}/index.ts`);
  ensureContains(
    `supabase/functions/${fn}/index.ts`,
    src,
    'isProfileSuspended',
    'checks suspension',
  );
  if (fn === 'mynews-report') {
    ensureContains(
      `supabase/functions/${fn}/index.ts`,
      src,
      'SUSPENDED_RATE_MAX_IN_WINDOW',
      'suspended reporters keep the safety path behind the stricter throttle',
    );
  } else {
    ensureContains(`supabase/functions/${fn}/index.ts`, src, "jsonError('suspended'", 'blocks a suspended actor');
  }
}

// Moderation migration + store structural tests.
ensureFile('modules/mynews/src/data/moderation-migration.test.ts');
ensureFile('supabase/functions/_shared/__tests__/mynews-moderation-store.test.ts');

// Focused service-role console app.
const consolePkg = ensureFile('apps/mynews-console/package.json');
ensureContains('apps/mynews-console/package.json', consolePkg, '"@mylife/mynews-console"', 'is the console package');
const consoleAdmin = ensureFile('apps/mynews-console/lib/supabase-admin.ts');
ensureContains('apps/mynews-console/lib/supabase-admin.ts', consoleAdmin, "import 'server-only'", 'keeps the service role server-only');
const consoleQueue = ensureFile('apps/mynews-console/lib/queue.ts');
ensureContains('apps/mynews-console/lib/queue.ts', consoleQueue, 'nw_moderate_hide_article', 'console calls the enforcement RPCs');
ensureFile('apps/mynews-console/lib/moderation.ts');
ensureFile('apps/mynews-console/app/queue/page.tsx');
ensureFile('apps/mynews-console/app/queue/actions.ts');
ensureFile('apps/mynews-console/middleware.ts');
// The console must never introduce a public (client-shipped) env var: that is
// the whole reason it is a separate service-role app.
const consoleEnvNames = ensureFile('apps/mynews-console/lib/env-names.ts');
if (consoleEnvNames.includes('NEXT_PUBLIC_')) {
  fail('apps/mynews-console/lib/env-names.ts must not declare a NEXT_PUBLIC_ env var');
} else {
  ok('apps/mynews-console/lib/env-names.ts keeps every secret server-side');
}

// Track 1 P4 (Plan 39 T9): DMCA notice intake + repeat-infringer policy. The
// migration adds the notice table (service-role-only), the copyright_strikes
// counter (client-write-guarded), the notice-insert RPC, and the strike-and-
// maybe-suspend teeth. The mynews-dmca function is the anonymous intake; the
// store gains the notice + strike callers; the console can strike; app + web
// publish the takedown/contact info.
const dmcaMigration = ensureFile('supabase/migrations/20260705000008_mynews_dmca.sql');
ensureContains(
  'supabase/migrations/20260705000008_mynews_dmca.sql',
  dmcaMigration,
  'create table if not exists public.nw_dmca_notices',
  'creates the DMCA notice table',
);
ensureContains(
  'supabase/migrations/20260705000008_mynews_dmca.sql',
  dmcaMigration,
  'add column if not exists copyright_strikes integer not null default 0',
  'adds the copyright-strike counter',
);
ensureContains(
  'supabase/migrations/20260705000008_mynews_dmca.sql',
  dmcaMigration,
  'constraint nw_dmca_attested check (good_faith and accuracy_under_penalty)',
  'enforces both DMCA attestations at the schema level',
);
for (const rpc of ['nw_submit_dmca_notice', 'nw_moderate_strike_and_maybe_suspend']) {
  ensureContains(
    'supabase/migrations/20260705000008_mynews_dmca.sql',
    dmcaMigration,
    `create or replace function public.${rpc}`,
    `defines the ${rpc} RPC`,
  );
  ensureContains(
    'supabase/migrations/20260705000008_mynews_dmca.sql',
    dmcaMigration,
    `grant execute on function public.${rpc}`,
    `grants ${rpc} to service_role`,
  );
}
ensureContains(
  'supabase/migrations/20260705000008_mynews_dmca.sql',
  dmcaMigration,
  'alter table public.nw_dmca_notices enable row level security',
  'locks the notice table to the service role (RLS on, no client policy)',
);

// Anonymous DMCA intake function + validation twin.
const dmcaFn = ensureFile('supabase/functions/mynews-dmca/index.ts');
ensureContains(
  'supabase/functions/mynews-dmca/index.ts',
  dmcaFn,
  'submitDmcaTakedown',
  'inserts takedown notices through the transactional service-role RPC',
);
ensureContains(
  'supabase/functions/mynews-dmca/index.ts',
  dmcaFn,
  'submitDmcaCounterNotice',
  'inserts counter-notices through their distinct transactional RPC',
);
ensureContains(
  'supabase/functions/mynews-dmca/index.ts',
  dmcaFn,
  'consumeDmcaRateLimit',
  'uses the durable fail-closed rate counter',
);
ensureFile('supabase/functions/mynews-dmca/__tests__/index.test.ts');

// Pure DMCA orchestrator (validation + honest error copy + published facts).
const dmcaOrchestrator = ensureFile('modules/mynews/src/data/dmca.ts');
ensureContains(
  'modules/mynews/src/data/dmca.ts',
  dmcaOrchestrator,
  'validateDmcaNotice',
  'validates the 512(c)(3) elements',
);
ensureContains(
  'modules/mynews/src/data/dmca.ts',
  dmcaOrchestrator,
  'DMCA_REPEAT_INFRINGER_THRESHOLD',
  'publishes the repeat-infringer threshold',
);
ensureContains(
  'modules/mynews/src/data/cloud-fetch.ts',
  ensureFile('modules/mynews/src/data/cloud-fetch.ts'),
  'validateDmcaNotice',
  'exposes DMCA validation on the web-safe subpath',
);

// Store: notice insert + strike caller.
ensureContains(
  'supabase/functions/_shared/mynews-store.ts',
  store,
  'submitDmcaTakedown',
  'store inserts DMCA takedown notices',
);
ensureContains(
  'supabase/functions/_shared/mynews-store.ts',
  store,
  'submitDmcaCounterNotice',
  'store inserts distinct DMCA counter-notices',
);
ensureContains(
  'supabase/functions/_shared/mynews-store.ts',
  store,
  'moderateStrikeAndMaybeSuspend',
  'store calls the strike RPC',
);

// Console can strike (retract + copyright strike) and read the linked notice.
ensureContains(
  'apps/mynews-console/lib/queue.ts',
  consoleQueue,
  'nw_moderate_strike_and_maybe_suspend',
  'console calls the strike RPC',
);
ensureFile('apps/mynews-console/app/queue/actions.ts');

// DMCA + strike structural tests.
ensureFile('modules/mynews/src/data/dmca-migration.test.ts');
ensureFile('modules/mynews/src/data/dmca.test.ts');
ensureFile('supabase/functions/_shared/__tests__/mynews-dmca-store.test.ts');

// Web legal surfaces publish the takedown/contact info.
ensureFile('apps/mynews-web/app/api/dmca/route.ts');
ensureFile('apps/mynews-web/app/legal/dmca/DmcaForm.tsx');
// T11 restructure: /legal is the hub; the copyright policy detail (agent,
// SLA, repeat-infringer) lives on /legal/dmca alongside the notice form.
const webDmcaPage = ensureFile('apps/mynews-web/app/legal/dmca/page.tsx');
ensureContains(
  'apps/mynews-web/app/legal/dmca/page.tsx',
  webDmcaPage,
  'in the process of registering',
  'states the agent process honestly (no fabricated registration)',
);

// In-app copyright / DMCA surface (now a sub-screen under the legal hub).
const appDmca = ensureFile('apps/mynews/app/(root)/legal/dmca.tsx');
ensureContains(
  'apps/mynews/app/(root)/legal/dmca.tsx',
  appDmca,
  'DMCA_DESIGNATED_AGENT_EMAIL',
  'app copyright screen publishes the takedown contact',
);

// Track 1 P5 (Plan 39 T10): NCII / TAKE IT DOWN 48h SLA pipeline. The migration
// adds the case table (service-role-only), the take-down-first intake RPC, the
// fail-closed enforce RPC, and the pg_cron worker invocation. The worker function
// is verify_jwt=false + worker-secret-gated (config.toml). The store gains the
// case callers; the intake wires ncii; the console surfaces the case queue.
const nciiMigration = ensureFile('supabase/migrations/20260705000009_mynews_ncii.sql');
ensureContains(
  'supabase/migrations/20260705000009_mynews_ncii.sql',
  nciiMigration,
  'create table if not exists public.nw_ncii_cases',
  'creates the NCII case table',
);
ensureContains(
  'supabase/migrations/20260705000009_mynews_ncii.sql',
  nciiMigration,
  'alter table public.nw_ncii_cases enable row level security',
  'locks the case table to the service role (RLS on, no client policy)',
);
ensureContains(
  'supabase/migrations/20260705000009_mynews_ncii.sql',
  nciiMigration,
  "'TAKE IT DOWN: automatic NCII takedown pending human review'",
  'intake is take-down-first (immediate hold + audit)',
);
ensureContains(
  'supabase/migrations/20260705000009_mynews_ncii.sql',
  nciiMigration,
  "return 'clear-not-allowed'",
  'the automated worker can never clear a case (fail-closed)',
);
for (const rpc of ['nw_open_ncii_case', 'nw_ncii_enforce', 'nw_run_ncii_worker']) {
  ensureContains(
    'supabase/migrations/20260705000009_mynews_ncii.sql',
    nciiMigration,
    `create or replace function public.${rpc}`,
    `defines the ${rpc} function`,
  );
  ensureContains(
    'supabase/migrations/20260705000009_mynews_ncii.sql',
    nciiMigration,
    `grant execute on function public.${rpc}`,
    `grants ${rpc} to service_role`,
  );
}
ensureContains(
  'supabase/migrations/20260705000009_mynews_ncii.sql',
  nciiMigration,
  "'X-MyNews-Worker-Secret', v_secret",
  'the cron invocation passes the worker secret header (no JWT)',
);
ensureContains(
  'supabase/migrations/20260705000009_mynews_ncii.sql',
  nciiMigration,
  "select 1 from pg_extension where extname = 'pg_cron'",
  'schedules the worker guarded so it no-ops without pg_cron',
);

// Worker function: verify_jwt=false + worker-secret-gated, with the hash + NCMEC
// seams (safe defaults, never fabricated).
const nciiWorker = ensureFile('supabase/functions/mynews-ncii-worker/index.ts');
ensureContains(
  'supabase/functions/mynews-ncii-worker/index.ts',
  nciiWorker,
  'X-MyNews-Worker-Secret',
  'worker checks the shared secret header',
);
ensureContains(
  'supabase/functions/mynews-ncii-worker/index.ts',
  nciiWorker,
  'MYNEWS_NCII_WORKER_SECRET',
  'worker gates on the env secret',
);
const nciiSeams = ensureFile('supabase/functions/mynews-ncii-worker/seams.ts');
ensureContains(
  'supabase/functions/mynews-ncii-worker/seams.ts',
  nciiSeams,
  'matchNciiHash',
  'exposes the hash-match vendor seam',
);
ensureContains(
  'supabase/functions/mynews-ncii-worker/seams.ts',
  nciiSeams,
  'reportCsamToNcmec',
  'exposes the NCMEC CyberTipline seam',
);
ensureContains(
  'supabase/functions/mynews-ncii-worker/seams.ts',
  nciiSeams,
  "kind: 'unconfigured'",
  'hash seam safe default is unconfigured (human review, never auto-clear)',
);
ensureFile('supabase/functions/mynews-ncii-worker/__tests__/index.test.ts');

// The worker must be in the verify_jwt=false list in config.toml (server-only,
// secret-gated). User-facing mynews functions must NOT be there.
const configToml = ensureFile('supabase/config.toml');
ensureContains(
  'supabase/config.toml',
  configToml,
  '[functions.mynews-ncii-worker]\nverify_jwt = false',
  'the NCII worker is verify_jwt=false (secret-gated, no user JWT)',
);

// Store: ncii intake + enforce + due/open reads, and the intake path wires them.
ensureContains('supabase/functions/_shared/mynews-store.ts', store, 'openNciiCase', 'store opens NCII cases (take-down-first)');
ensureContains('supabase/functions/_shared/mynews-store.ts', store, 'enforceNciiCase', 'store enforces NCII cases (fail-closed)');
ensureContains('supabase/functions/_shared/mynews-store.ts', store, 'getDueNciiCases', 'store reads due NCII cases (worker SLA scan)');
// Plan 48 WP1: report intake is one atomic RPC (nw_submit_report) whose SQL
// performs the take-down-first NCII branch inside the same transaction, so the
// edge function no longer calls openNciiCase separately.
ensureContains(
  'supabase/functions/mynews-report/index.ts',
  reportFn,
  'submitReport',
  'report intake goes through the atomic submit RPC',
);
ensureContains(
  'supabase/functions/_shared/mynews-store.ts',
  store,
  'nw_submit_report',
  'store wires the atomic report intake RPC',
);

// Console surfaces the NCII case queue with deadline + enforce actions.
ensureContains('apps/mynews-console/lib/queue.ts', consoleQueue, 'nw_ncii_enforce', 'console calls the NCII enforce RPC');
// Plan 48 WP9 replaced the unpaginated fetchOpenNciiCases with a keyset-paginated
// page read; the fact being pinned is that the console reads the open queue, not
// which helper name it uses.
ensureContains(
  'apps/mynews-console/lib/queue.ts',
  consoleQueue,
  'fetchNciiQueuePage',
  'console reads the open NCII case queue',
);
ensureFile('apps/mynews-console/app/ncii/page.tsx');
ensureFile('apps/mynews-console/app/ncii/actions.ts');
ensureContains(
  'apps/mynews-console/lib/moderation.ts',
  ensureFile('apps/mynews-console/lib/moderation.ts'),
  'nciiDeadlineLabel',
  'console formats the 48h SLA countdown',
);

// NCII structural + semantics tests.
ensureFile('modules/mynews/src/data/ncii-migration.test.ts');
ensureFile('supabase/functions/_shared/__tests__/mynews-ncii-store.test.ts');

// Track 1 P6 (T11): DSA notice-and-action + legal docs + terms-acceptance gate.
// The terms version is the single source of truth, mirrored in the edge; the
// publish/suggest edge functions enforce the gate; the statement-of-reasons read
// is a service-role-only SECURITY DEFINER RPC scoped to the caller's content.
const termsModule = ensureFile('modules/mynews/src/data/terms.ts');
ensureContains(
  'modules/mynews/src/data/terms.ts',
  termsModule,
  "CURRENT_TERMS_VERSION = '2026-07-05'",
  'pins the current terms version',
);
const termsEdge = ensureFile('supabase/functions/_shared/mynews-terms.ts');
ensureContains(
  'supabase/functions/_shared/mynews-terms.ts',
  termsEdge,
  "EDGE_CURRENT_TERMS_VERSION = '2026-07-05'",
  'edge mirror pins the same terms version',
);
// The version literals must match verbatim (no drift between module + edge).
{
  const moduleVer = /CURRENT_TERMS_VERSION = '([^']+)'/.exec(termsModule)?.[1];
  const edgeVer = /EDGE_CURRENT_TERMS_VERSION = '([^']+)'/.exec(termsEdge)?.[1];
  if (moduleVer && edgeVer && moduleVer === edgeVer) {
    ok('terms version matches across module + edge');
  } else {
    fail(`terms version drift: module ${moduleVer} vs edge ${edgeVer}`);
  }
}

// The publish + suggest edge functions enforce the terms gate with the typed error.
for (const fn of ['mynews-publish', 'mynews-suggest']) {
  const src = ensureFile(`supabase/functions/${fn}/index.ts`);
  ensureContains(`supabase/functions/${fn}/index.ts`, src, 'hasAcceptedTerms', `${fn} calls the terms gate`);
  ensureContains(
    `supabase/functions/${fn}/index.ts`,
    src,
    "jsonError('terms-not-accepted', 403",
    `${fn} rejects with the typed terms error`,
  );
}

// DSA Art 17 statement-of-reasons: scoped SECURITY DEFINER read RPC + edge fn.
const dsaMigration = ensureFile('supabase/migrations/20260705000010_mynews_dsa_reasons.sql');
ensureContains(
  'supabase/migrations/20260705000010_mynews_dsa_reasons.sql',
  dsaMigration,
  'create or replace function public.nw_get_my_moderation_notices',
  'defines the scoped statement-of-reasons RPC',
);
ensureContains(
  'supabase/migrations/20260705000010_mynews_dsa_reasons.sql',
  dsaMigration,
  'security definer',
  'the notices RPC is security definer',
);
ensureContains(
  'supabase/migrations/20260705000010_mynews_dsa_reasons.sql',
  dsaMigration,
  'grant execute on function public.nw_get_my_moderation_notices(uuid) to service_role',
  'the notices RPC is service-role only',
);
const myNoticesFn = ensureFile('supabase/functions/mynews-my-notices/index.ts');
ensureContains(
  'supabase/functions/mynews-my-notices/index.ts',
  myNoticesFn,
  'getMyModerationNotices',
  'the my-notices function reads the scoped notices',
);
ensureFile('supabase/functions/mynews-my-notices/__tests__/index.test.ts');

// Legal documents: shared content module (single source for app + web).
const legalContent = ensureFile('modules/mynews/src/data/legal-content.ts');
for (const doc of ['TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'COMMUNITY_GUIDELINES']) {
  ensureContains('modules/mynews/src/data/legal-content.ts', legalContent, doc, `defines ${doc}`);
}

// Web legal hub: the four document routes + DSA section on the hub.
const webLegalHub = ensureFile('apps/mynews-web/app/legal/page.tsx');
ensureContains('apps/mynews-web/app/legal/page.tsx', webLegalHub, 'Digital Services Act', 'web legal hub publishes the DSA section');
ensureContains('apps/mynews-web/app/legal/page.tsx', webLegalHub, 'Statement of reasons', 'web legal hub explains statement of reasons');
ensureFile('apps/mynews-web/app/legal/terms/page.tsx');
ensureFile('apps/mynews-web/app/legal/privacy/page.tsx');
ensureFile('apps/mynews-web/app/legal/guidelines/page.tsx');
ensureFile('apps/mynews-web/app/legal/dmca/page.tsx');

// App legal hub + doc screens + terms gate + notices screen.
ensureFile('apps/mynews/app/(root)/legal.tsx');
ensureFile('apps/mynews/app/(root)/legal/terms.tsx');
ensureFile('apps/mynews/app/(root)/legal/privacy.tsx');
ensureFile('apps/mynews/app/(root)/legal/guidelines.tsx');
ensureFile('apps/mynews/app/(root)/legal/dmca.tsx');
ensureFile('apps/mynews/app/(root)/notices.tsx');
const termsGate = ensureFile('apps/mynews/app/(root)/providers/TermsGateProvider.tsx');
ensureContains(
  'apps/mynews/app/(root)/providers/TermsGateProvider.tsx',
  termsGate,
  'acceptTerms',
  'the app terms gate records acceptance',
);
const composeSrc = ensureFile('apps/mynews/app/(root)/compose.tsx');
ensureContains('apps/mynews/app/(root)/compose.tsx', composeSrc, 'ensureTermsAccepted', 'compose gates publish on terms');

// T11 structural tests.
ensureFile('modules/mynews/src/data/terms.test.ts');
ensureFile('modules/mynews/src/data/dsa-reasons-migration.test.ts');

// Plan 48 WP4: comment boundary + canonical bounds. The comment path must stay
// behind the edge function, and the canonical bounds must stay mirrored across
// the module, the edge, and SQL.
const boundsModule = ensureFile('modules/mynews/src/data/bounds.ts');
ensureContains(
  'modules/mynews/src/data/bounds.ts',
  boundsModule,
  'export const MYNEWS_BOUNDS',
  'is the canonical bounds source of truth',
);
const boundsEdge = ensureFile('supabase/functions/_shared/mynews-bounds.ts');
ensureContains(
  'supabase/functions/_shared/mynews-bounds.ts',
  boundsEdge,
  'export const EDGE_MYNEWS_BOUNDS',
  'mirrors the canonical bounds for the edge',
);
ensureFile('modules/mynews/src/data/bounds.test.ts');
ensureFile('modules/mynews/src/data/bounds-migration.test.ts');
ensureFile('supabase/functions/_shared/__tests__/mynews-bounds.test.ts');

const commentFn = ensureFile('supabase/functions/mynews-comment/index.ts');
for (const [needle, label] of [
  ['parseJwtSub', 'resolves the commenter from the JWT'],
  ['isProfileSuspended', 'blocks a suspended commenter'],
  ['EDGE_CURRENT_TERMS_VERSION', 'requires current terms'],
  ['countRecentSuggestionComments', 'applies the durable comment throttle'],
  ['checkCommentBody', 'bounds the comment body'],
  ["jsonError('comment-unavailable', 503", 'fails closed when the throttle read fails'],
]) {
  ensureContains('supabase/functions/mynews-comment/index.ts', commentFn, needle, label);
}
ensureFile('supabase/functions/mynews-comment/__tests__/index.test.ts');

const commentMigration = ensureFile(
  'supabase/migrations/20260730000003_mynews_comment_boundary.sql',
);
for (const [needle, label] of [
  [
    'drop policy if exists nw_suggestion_events_actor_insert',
    'closes the direct client comment insert',
  ],
  ['nw_suggestion_events_insert_guard', 'guards nw_suggestion_events against client writes'],
  ['nw_insert_suggestion_comment', 'exposes the service-role comment RPC'],
]) {
  ensureContains(
    'supabase/migrations/20260730000003_mynews_comment_boundary.sql',
    commentMigration,
    needle,
    label,
  );
}

const cloudFetchComment = ensureFile('modules/mynews/src/data/cloud-fetch.ts');
ensureContains(
  'modules/mynews/src/data/cloud-fetch.ts',
  cloudFetchComment,
  "invokeFunction<{ suggestionId: string }>('mynews-comment'",
  'posts comments through the edge function, not PostgREST',
);

// Account lifecycle: deletion with a disclosed grace period + full data export
// (plan 48 WP5). The app, the public web page, and the privacy policy must all
// describe the same behaviour, and the worker must stay server-only.
const accountLifecycleMigration = ensureFile(
  'supabase/migrations/20260730000006_mynews_account_lifecycle.sql',
);
for (const [needle, label] of [
  ['create table if not exists public.nw_deletion_requests', 'creates the deletion request table'],
  ['create table if not exists public.nw_export_jobs', 'creates the export audit table'],
  ["interval '7 days'", 'sets the disclosed 7-day grace window'],
  ['nw_account_deletion_dispose', 'exposes the one-transaction content disposition'],
  ['nw_account_export_bundle', 'exposes the full export bundle RPC'],
  ['on delete set null', 'detaches a retained profile from auth.users instead of cascading it'],
  ["'Deleted account'", 'anonymizes the retained public record'],
]) {
  ensureContains(
    'supabase/migrations/20260730000006_mynews_account_lifecycle.sql',
    accountLifecycleMigration,
    needle,
    label,
  );
}

const accountFn = ensureFile('supabase/functions/mynews-account/index.ts');
for (const [needle, label] of [
  ["'DELETE MY ACCOUNT'", 'requires the typed confirmation phrase'],
  ['reauth-required', 'requires a fresh session before opening a deletion request'],
  ['MAX_EXPORT_BYTES', 'bounds the export response'],
]) {
  ensureContains('supabase/functions/mynews-account/index.ts', accountFn, needle, label);
}

const accountWorker = ensureFile('supabase/functions/mynews-account-worker/index.ts');
ensureContains(
  'supabase/functions/mynews-account-worker/index.ts',
  accountWorker,
  'MYNEWS_ACCOUNT_WORKER_SECRET',
  'gates the worker behind its shared secret',
);
ensureContains(
  'supabase/functions/mynews-account-worker/index.ts',
  accountWorker,
  "'skipped-unconfigured'",
  'records an unconfigured side effect honestly',
);

const supabaseConfig = ensureFile('supabase/config.toml');
ensureContains(
  'supabase/config.toml',
  supabaseConfig,
  '[functions.mynews-account-worker]\nverify_jwt = false',
  'keeps the account worker off gateway JWT verification',
);
if (supabaseConfig && supabaseConfig.includes('[functions.mynews-account]')) {
  fail(
    'supabase/config.toml must NOT list [functions.mynews-account]: it is user-facing and needs gateway JWT verification',
  );
} else if (supabaseConfig) {
  ok('supabase/config.toml keeps the user-facing mynews-account on gateway JWT verification');
}

const accountData = ensureFile('modules/mynews/src/data/account.ts');
for (const [needle, label] of [
  ['ACCOUNT_DELETION_RETAINED', 'publishes the retained-data disclosure'],
  ['ACCOUNT_DELETION_REMOVED', 'publishes the deleted-data disclosure'],
  ['ACCOUNT_DELETION_GRACE_DAYS = 7', 'mirrors the 7-day grace window'],
]) {
  ensureContains('modules/mynews/src/data/account.ts', accountData, needle, label);
}

const accountLegalContent = ensureFile('modules/mynews/src/data/legal-content.ts');
ensureContains(
  'modules/mynews/src/data/legal-content.ts',
  accountLegalContent,
  'Deleting your account',
  'discloses account deletion in the privacy policy',
);
ensureContains(
  'modules/mynews/src/data/legal-content.ts',
  accountLegalContent,
  'Exporting your data',
  'discloses the export right in the privacy policy',
);

ensureFile('apps/mynews/app/(root)/account-delete.tsx');
ensureFile('apps/mynews/app/(root)/account-export.tsx');
const accountWebPage = ensureFile('apps/mynews-web/app/account/delete/page.tsx');
ensureContains(
  'apps/mynews-web/app/account/delete/page.tsx',
  accountWebPage,
  'inside the MyNews app',
  'states honestly where deletion happens while the web has no sign-in',
);
if (accountWebPage && /<form|<input|<textarea/.test(accountWebPage)) {
  fail(
    'apps/mynews-web/app/account/delete/page.tsx must not ship a deletion form: the site cannot verify who the visitor is yet',
  );
} else if (accountWebPage) {
  ok('apps/mynews-web/app/account/delete/page.tsx ships no unverifiable deletion form');
}

// ---------------------------------------------------------------------------
// Plan 48 WP6: key custody and authorship continuity.
//
// These pin the guarantees that are easy to erode by accident, because each one
// looks like a harmless simplification in isolation:
//   * the no-kit recovery path stays HARD-DISABLED until a notification provider
//     ships (a confirmed_at with nothing behind it re-opens finding C-1),
//   * the frozen initial-bind path from 20260705000003 stays frozen,
//   * signature validity never depends on a wall-clock key window (finding C-2),
//   * a revoked signer gets the typed 'key-revoked', not a misleading
//     'no-profile' or a false 'bad-signature'.
// ---------------------------------------------------------------------------

const custodyMigration = ensureFile(
  'supabase/migrations/20260730000008_mynews_key_custody.sql',
);
if (custodyMigration) {
  for (const [needle, label] of [
    ['create table if not exists public.nw_profile_keys', 'creates the public key chain'],
    ['idx_nw_profile_keys_active_pubkey', 'enforces one globally active pubkey'],
    ['create table if not exists public.nw_key_nonces', 'creates single-use proof nonces'],
    ["'notification-channel-required'", 'hard-gates no-kit recovery on a confirmed channel'],
    ["'pubkey-not-precommitted'", 'enforces the pre-committed recovery key'],
    ["'use-rotation-for-primary'", 'refuses a bare revoke of the active primary'],
    ["'revoke-precedence'", 'enforces revocation precedence'],
    ['nw_profiles_sync_key_chain', 'keeps the head and the chain in agreement'],
    ['add column if not exists verified_key_id uuid', 'records which key verified each write'],
  ]) {
    ensureContains(
      'supabase/migrations/20260730000008_mynews_key_custody.sql',
      custodyMigration,
      needle,
      label,
    );
  }

  // The frozen paths stay frozen: the design makes nw_set_profile_pubkey, its
  // already-set guard, and the client-write trigger the ONLY initial-bind path.
  if (/function public\.nw_set_profile_pubkey|nw_profiles_guard_client_update/.test(custodyMigration)) {
    fail(
      'supabase/migrations/20260730000008_mynews_key_custody.sql must not redefine the frozen initial-bind path (nw_set_profile_pubkey / nw_profiles_guard_client_update)',
    );
  } else {
    ok('20260730000008 leaves the frozen initial-bind path untouched');
  }

  // Nothing may confirm a notification channel until a provider ships.
  if (/(insert into|update) public\.nw_key_notify_channels/.test(custodyMigration)) {
    fail(
      'supabase/migrations/20260730000008_mynews_key_custody.sql writes to nw_key_notify_channels: a confirmed channel with no delivery behind it turns the fail-closed no-kit gate into a fabricated capability',
    );
  } else {
    ok('20260730000008 ships no way to confirm a notification channel (gate stays fail-closed)');
  }

  // The raw cancel token must never be storable.
  if (/cancel_token text/.test(custodyMigration)) {
    fail(
      'supabase/migrations/20260730000008_mynews_key_custody.sql must store only cancel_token_hash: a stored token lets a database read cancel the legitimate owner’s recovery',
    );
  } else {
    ok('20260730000008 stores only the cancel-token hash');
  }
}

const keyResolver = ensureFile('supabase/functions/_shared/mynews-key-verify.ts');
if (keyResolver) {
  ensureContains(
    'supabase/functions/_shared/mynews-key-verify.ts',
    keyResolver,
    "KEY_REVOKED_ERROR = 'key-revoked'",
    'types the revoked-key rejection',
  );
}

// Every signature-verifying handler routes through the chain resolver. A handler
// that goes back to the head-only lookup silently loses device keys and reports
// a revoked signer as unregistered.
for (const fn of [
  'supabase/functions/mynews-publish/index.ts',
  'supabase/functions/mynews-suggest/index.ts',
  'supabase/functions/mynews-review/index.ts',
  'supabase/functions/mynews-set-meta/index.ts',
]) {
  const source = ensureFile(fn);
  if (source) {
    // The CALL, not the identifier: a handler that keeps the import but drops
    // the call has silently reverted to the head-only lookup.
    ensureContains(
      fn,
      source,
      'resolveSigningKey(deps.store',
      'resolves its signer through the key chain',
    );
  }
}

const readerVerify = ensureFile('modules/mynews/src/signing/reader-verify.ts');
if (readerVerify) {
  // Wall-clock must never gate validity (finding C-2): a client controls
  // createdAt, so a time-window verifier can be talked into a forgery. Any
  // ORDERING comparison against validFrom/revokedAt is the hazard shape,
  // whatever the other operand is called; equality against revokedAt is fine
  // (that is a null check for "is this key retired"), and the behavioural tests
  // in reader-verify.test.ts are the primary guard. This is the cheap tripwire.
  const wallClockGate = /(validFrom|revokedAt)\s*[<>]|[<>]=?\s*[\w.]*\b(validFrom|revokedAt)\b/;
  if (wallClockGate.test(readerVerify)) {
    fail(
      'modules/mynews/src/signing/reader-verify.ts orders a timestamp against a key window (validFrom/revokedAt): validity must be chain membership, never wall-clock',
    );
  } else {
    ok('reader verifier never gates validity on a wall-clock key window');
  }
  ensureContains(
    'modules/mynews/src/signing/reader-verify.ts',
    readerVerify,
    "'chain-unrecorded'",
    'reports an unrecorded write honestly instead of passing it',
  );
}

const appKeysLib = ensureFile('apps/mynews/app/(root)/lib/keys.ts');
if (appKeysLib) {
  ensureContains(
    'apps/mynews/app/(root)/lib/keys.ts',
    appKeysLib,
    'notificationChannelConfirmed',
    'gates the no-kit recovery copy on the server capability',
  );
}
ensureFile('apps/mynews/app/(root)/keys.tsx');
ensureFile('modules/mynews/src/signing/recovery-kit.ts');
ensureFile('modules/mynews/src/data/key-custody.ts');

// ---------------------------------------------------------------------------
// Plan 48 WP8: pre-publication screening, report taxonomy, verification center.
//
// The parity risk here is not a missing file, it is a surface that screens and a
// surface that does not. Every write edge must call the gate, the edge twin must
// be generated rather than hand-copied, and the four copies of the SLA table
// (module, edge, SQL seed, console) must agree.
// ---------------------------------------------------------------------------

ensureFile('modules/mynews/src/taxonomy.ts');
ensureFile('modules/mynews/src/screening/engine.ts');
ensureFile('modules/mynews/src/screening/lexicons.ts');
ensureFile('modules/mynews/src/engines/rings.ts');
ensureFile('modules/mynews/src/screening/__fixtures__/corpus.ts');
ensureFile('supabase/functions/_shared/mynews-screening-gate.ts');
ensureFile('supabase/functions/mynews-screening/index.ts');
ensureFile('supabase/functions/mynews-verification/index.ts');
ensureFile('apps/mynews-console/app/screening/page.tsx');
ensureFile('apps/mynews-console/app/verification/page.tsx');
ensureFile('apps/mynews/app/(root)/held.tsx');
ensureFile('apps/mynews/app/(root)/verification.tsx');

// Every write edge screens before its store write.
for (const fn of ['mynews-publish', 'mynews-suggest', 'mynews-review', 'mynews-comment']) {
  const path = `supabase/functions/${fn}/index.ts`;
  const src = ensureFile(path);
  if (src) {
    ensureContains(path, src, 'runScreeningGate', 'runs pre-publication screening');
    ensureContains(path, src, "'screening-unavailable'", 'fails closed when screening cannot run');
    ensureContains(path, src, "'screening-quarantined'", 'tells the author honestly when held');
  }
}

// The edge twin is generated. A hand edit or a stale twin is a hard failure,
// because the deployed engine would then score differently from the tested one.
const twinGenerator = ensureFile('scripts/gen-mynews-screening-twin.mjs');
const twin = ensureFile('supabase/functions/_shared/mynews-screening.ts');
if (twinGenerator && twin) {
  if (twin.startsWith('// GENERATED FILE. Do not edit.')) {
    ok('screening edge twin is marked generated');
  } else {
    fail('supabase/functions/_shared/mynews-screening.ts must be generated, not hand-edited');
  }
}

// SLA routing agreement across all four copies.
const taxonomy = ensureFile('modules/mynews/src/taxonomy.ts');
const edgeStore = ensureFile('supabase/functions/_shared/mynews-store.ts');
const consoleModeration = ensureFile('apps/mynews-console/lib/moderation.ts');
const screeningMigration = ensureFile(
  'supabase/migrations/20260730000009_mynews_screening_taxonomy.sql',
);
if (taxonomy && edgeStore && consoleModeration && screeningMigration) {
  const slaRows = [
    ['child-safety', 24, 'urgent'],
    ['ncii', 48, 'urgent'],
    ['threats', 24, 'standard'],
    ['violence', 24, 'standard'],
    ['self-harm', 24, 'standard'],
    ['doxxing-privacy', 48, 'standard'],
    ['hate', 72, 'standard'],
    ['harassment', 72, 'standard'],
    ['impersonation', 72, 'standard'],
    ['fraud-scam', 72, 'standard'],
    ['copyright', 240, 'standard'],
    ['spam', 168, 'standard'],
    ['other', 168, 'standard'],
  ];
  let slaOk = true;
  for (const [reason, hours, lane] of slaRows) {
    if (!screeningMigration.includes(`('${reason}', ${hours}, '${lane}')`)) {
      fail(`nw_report_sla seed is missing or wrong for ${reason} (${hours}h, ${lane})`);
      slaOk = false;
    }
    const key = /^[a-z]+$/.test(reason) ? reason : `'${reason}'`;
    for (const [label, src] of [
      ['modules/mynews/src/taxonomy.ts', taxonomy],
      ['supabase/functions/_shared/mynews-store.ts', edgeStore],
      ['apps/mynews-console/lib/moderation.ts', consoleModeration],
    ]) {
      if (!src.includes(`${key}: ${hours}`)) {
        fail(`${label} SLA table disagrees for ${reason} (expected ${hours}h)`);
        slaOk = false;
      }
    }
  }
  if (slaOk) ok('report SLA routing agrees across module, edge, SQL seed, and console');

  // child-safety shares the urgent lane with ncii on all sides.
  ensureContains(
    'modules/mynews/src/taxonomy.ts',
    taxonomy,
    "REPORT_URGENT_REASONS = ['child-safety', 'ncii']",
    'declares the urgent lane',
  );
  ensureContains(
    'supabase/functions/_shared/mynews-store.ts',
    edgeStore,
    "EDGE_REPORT_URGENT_REASONS: readonly ReportReason[] = ['child-safety', 'ncii']",
    'mirrors the urgent lane at the edge',
  );
  ensureContains(
    'supabase/migrations/20260730000009_mynews_screening_taxonomy.sql',
    screeningMigration,
    'nw_reconcile_urgent_case',
    'generalizes the urgent case lane instead of forking it',
  );
  ensureContains(
    'supabase/migrations/20260730000009_mynews_screening_taxonomy.sql',
    screeningMigration,
    "check (case_class in ('ncii', 'child-safety'))",
    'labels which urgent lane opened a case',
  );

  // Held content must never be publishable: the three tightened public policies.
  for (const policy of [
    'drop policy if exists nw_article_revisions_public_select',
    'drop policy if exists nw_edit_suggestions_public_select',
    'drop policy if exists nw_suggestion_events_public_select',
  ]) {
    ensureContains(
      'supabase/migrations/20260730000009_mynews_screening_taxonomy.sql',
      screeningMigration,
      policy,
      'tightens a public read policy for held content',
    );
  }
}

// ---------------------------------------------------------------- verify_jwt
//
// Every mynews function's gateway-verification setting, pinned in one place
// (plan 48 WP11). Three of these were previously unpinned, which meant CI would
// happily run and pass on a flip: gateway verification is the outermost gate on
// a user-facing function, and losing it is invisible in a diff review of
// config.toml unless something asserts.
//
// Both directions matter. Turning verification ON for a machine-called function
// 401s the caller before its secret check ever runs (that is why the workers are
// off it). Turning it OFF for a user-facing function removes the gate that stops
// a forged token from reaching handler code.
const verifyJwtConfig = ensureFile('supabase/config.toml');

/**
 * Parse config.toml PER BLOCK rather than per adjacent line pair.
 *
 * The obvious regex, matching `[functions.X]` immediately followed by
 * `verify_jwt = ...`, silently misses a block whose verify_jwt is not the first
 * key. TOML key order is arbitrary and Supabase blocks routinely carry
 * `entrypoint` or `import_map`, so `[functions.mynews-publish]` with entrypoint
 * first and `verify_jwt = false` second would never be seen. That direction
 * fails OPEN for a newly added function, which is exactly the case the set check
 * below exists to catch, so the parse has to be indifferent to key order and to
 * interleaved comments.
 *
 * Returns Map<functionName, boolean> for mynews blocks that declare a value.
 */
// Returns { declared: Map<fn, boolean>, unreadable: string[] }.
//
// Fail-CLOSED by construction. Two earlier versions of this parser missed a
// mynews function block on an unanticipated shape (verify_jwt not first key;
// then a comment or whitespace on the header line) and each miss failed OPEN,
// because a silently-skipped block never enters the map and an added
// verify_jwt=false slips past the set check. Rather than patch the header
// regex a third time and leave round four available, invert the default: any
// section whose header LOOSELY names a mynews function but does NOT strictly
// parse into a readable function name is collected as `unreadable`, and the
// caller fails on it. A readable header that merely omits verify_jwt is NOT an
// error: it inherits the safe gateway default. A future TOML shape this parser
// cannot read at all lands in the safe direction instead of vanishing.
function parseMyNewsVerifyJwt(toml) {
  const declared = new Map();
  const unreadable = [];
  if (!toml) return { declared, unreadable };
  // Split on section headers, keeping each header with its body.
  const sections = toml.split(/^(?=\[)/m);
  for (const section of sections) {
    const headerLine = section.split('\n')[0] ?? '';
    // Loose gate, deliberately permissive. It must match ANY table header that
    // mentions both `functions` and `mynews`, because a gate that assumes the
    // bare dotted form silently skips legal TOML: `[functions."mynews-x"]`
    // (quoted key) and `[functions . mynews-x]` (whitespace around the dot) are
    // both valid and both evaded the previous gate. A too-strict DETECTOR
    // reintroduces the very fail-open shape this inversion exists to end, one
    // layer up.
    if (!/^\[[^\]]*functions[^\]]*mynews[^\]]*\]/.test(headerLine)) continue;
    // Strict extraction: tolerant of inner whitespace, quoted keys, and a
    // trailing comment, but the function NAME must be readable.
    const header = /^\[\s*functions\s*\.\s*"?(mynews-[a-z0-9-]+)"?\s*\]\s*(?:#.*)?$/.exec(
      headerLine,
    );
    if (!header) {
      // Shape we cannot read at all. Fail loudly rather than skip: an
      // unreadable header means we do not know which function it is or what
      // gateway posture it declares.
      unreadable.push(headerLine.trim());
      continue;
    }
    const value = /^\s*verify_jwt\s*=\s*(true|false)\s*(?:#.*)?$/m.exec(section);
    // A readable block with NO verify_jwt line is not an error. It inherits the
    // gateway default (verify_jwt = true), which is the safe direction, and
    // declaring only `import_map` or `entrypoint` is a legitimate thing to do.
    // Treating it as unreadable would cry wolf, and a check that cries wolf
    // retires attention just as surely as one that silently misses. It stays out
    // of `declared`, so the table below still reports one of the pinned
    // functions losing its line, and the exempt-set check correctly does not
    // treat it as exempt.
    if (value) declared.set(header[1], value[1] === 'true');
  }
  return { declared, unreadable };
}

const { declared: declaredVerifyJwt, unreadable: unreadableVerifyJwt } =
  parseMyNewsVerifyJwt(verifyJwtConfig);

// Fail closed on any mynews function block whose HEADER the parser cannot read,
// so an unrecognised shape can never silently drop a block out of the checks
// below. This is the inversion that ends the class: every previous round of this
// bug was a parser gap that skipped a section quietly, and now a gap is loud.
for (const headerLine of unreadableVerifyJwt) {
  fail(
    `supabase/config.toml has a mynews function block whose header the verify_jwt parser ` +
      `cannot read: ${JSON.stringify(headerLine)}. Give it a [functions.mynews-NAME] header ` +
      `so its gateway posture can be pinned rather than assumed.`,
  );
}

for (const [fn, setting, why] of [
  // Machine callers: pg_cron, Stripe, or an uptime probe, none of which can
  // present a user JWT. Each authenticates inside the handler instead.
  ['mynews-ncii-worker', false, 'secret-gated, called by pg_cron with no user JWT'],
  ['mynews-account-worker', false, 'secret-gated, called by pg_cron with no user JWT'],
  ['mynews-support-worker', false, 'secret-gated, called by cron or an operator'],
  ['mynews-payments-webhook', false, 'Stripe cannot send a Supabase JWT; HMAC-verified instead'],
  // mynews-health serves an uptime probe and scripts/mynews-smoke.sh, so it
  // cannot require a session. Its shallow payload is public BY DESIGN and
  // deliberately carries no queue depths, ages, or component names; the detailed
  // payload is gated in-handler on MYNEWS_HEALTH_SECRET. That split is what makes
  // verify_jwt = false safe here, and it is pinned by the endpoint suite
  // (supabase/functions/mynews-health/__tests__/index.test.ts asserts the exact
  // shallow key set and scans it for leaked internals). Do not widen the shallow
  // payload without changing that test on purpose.
  ['mynews-health', false, 'an uptime probe has no session; detail is secret-gated in-handler'],
  // User-facing: the gateway must refuse a forged token before handler code runs.
  ['mynews-support', true, 'user-facing, resolves the caller from the verified JWT'],
  ['mynews-screening', true, 'user-facing, scopes held content to the caller'],
  ['mynews-verification', true, 'user-facing, files a claim as the caller'],
]) {
  const actual = declaredVerifyJwt.get(fn);
  if (actual === undefined) {
    fail(
      `supabase/config.toml no longer declares [functions.${fn}] with a verify_jwt value ` +
        `(expected ${setting}: ${why})`,
    );
  } else if (actual !== setting) {
    fail(
      `supabase/config.toml sets ${fn} verify_jwt = ${actual}, expected ${setting} (${why})`,
    );
  } else {
    ok(`supabase/config.toml pins ${fn} verify_jwt = ${setting} (${why})`);
  }
}

// The table above pins the VALUE of a block that already exists, so it catches a
// flip. It cannot catch an ADDITION: adding `[functions.mynews-publish]` with
// verify_jwt = false is a new section, not a changed value, and every assertion
// above still passes. Nine user-facing functions currently rely on the safe
// default (mynews-comment, dmca, my-notices, publish, register-key, report,
// review, set-meta, suggest), and nothing protected them.
//
// So derive the exempt set from the file instead of listing it. Requiring set
// EQUALITY closes the whole class in one assertion: it catches an addition, a
// removal, and a flip, and a mynews function added next year is covered without
// anyone remembering to edit this file. This generalizes the single negative pin
// that already guarded mynews-account.
const GATEWAY_EXEMPT = new Set([
  'mynews-ncii-worker',
  'mynews-account-worker',
  'mynews-support-worker',
  'mynews-payments-webhook',
  'mynews-health',
]);
if (verifyJwtConfig) {
  // Reuses parseMyNewsVerifyJwt above, which splits on table headers rather than
  // matching an adjacent line pair. Two independent parsers for the same file
  // would be two things to keep correct, and the whole point of this check is
  // that it cannot quietly stop seeing a block.
  const declaredExempt = new Set(
    [...declaredVerifyJwt.entries()].filter(([, verify]) => verify === false).map(([fn]) => fn),
  );
  const unexpected = [...declaredExempt].filter((fn) => !GATEWAY_EXEMPT.has(fn)).sort();
  const missing = [...GATEWAY_EXEMPT].filter((fn) => !declaredExempt.has(fn)).sort();
  if (unexpected.length > 0) {
    fail(
      `supabase/config.toml exempts ${unexpected.join(', ')} from gateway JWT verification. ` +
        'A user-facing mynews function must keep verify_jwt on so a forged token is refused ' +
        'before handler code runs. If this is a genuine machine caller, add it to GATEWAY_EXEMPT ' +
        'in scripts/check-mynews-parity.mjs with the reason, and give it an in-handler credential check.',
    );
  }
  if (missing.length > 0) {
    fail(
      `supabase/config.toml no longer exempts ${missing.join(', ')}. ` +
        'These are machine callers (pg_cron, Stripe, an uptime probe) that cannot present a user ' +
        'JWT, so gateway verification 401s them before their own secret check ever runs.',
    );
  }
  if (unexpected.length === 0 && missing.length === 0) {
    ok(
      `supabase/config.toml exempts exactly the ${GATEWAY_EXEMPT.size} machine-caller mynews functions from gateway JWT verification`,
    );
  }
}

{
  // WP11 health endpoint (Wave 5): mynews-health is deliberately public at the
  // gateway so uptime probes need no credential. The ONLY thing between a caller
  // and queue internals is the in-handler secret gate, so that gate is pinned
  // here. The verify_jwt = false config line itself is pinned once, in the
  // verify_jwt table above, alongside the other eight functions rather than
  // asserted twice with two different labels.
  const healthFn = ensureFile('supabase/functions/mynews-health/index.ts');
  ensureContains(
    'supabase/functions/mynews-health/index.ts',
    healthFn,
    'MYNEWS_HEALTH_SECRET',
    'detailed health payload gates on the deploy-side secret',
  );
  ensureContains(
    'supabase/functions/mynews-health/index.ts',
    healthFn,
    'detail-unavailable',
    'an unset health secret reads as unavailable, never as open detail',
  );
}

if (failures > 0) {
  err(`\n${failures} MyNews parity failure(s).`);
  process.exit(1);
}
out('\nMyNews parity OK.');
