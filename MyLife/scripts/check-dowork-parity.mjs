#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.cwd());

let failures = 0;

function fail(message) {
  console.error(`FAIL ${message}`);
  failures += 1;
}

function ok(message) {
  console.log(`OK   ${message}`);
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

console.log('Checking DoWork standalone app artifacts...\n');

// P0 scaffolding
const requiredFiles = [
  'apps/dowork/package.json',
  'apps/dowork/app.json',
  'apps/dowork/eas.json',
  'apps/dowork/metro.config.js',
  'apps/dowork/tsconfig.json',
  'apps/dowork/shims/crypto.js',
  'apps/dowork/app/_layout.tsx',
  'apps/dowork/app/index.tsx',

  // P1 brand
  'apps/dowork/app/(root)/theme/tokens.ts',
  'apps/dowork/app/(root)/providers/AppThemeProvider.tsx',

  // P2 db + provider tree
  'apps/dowork/app/(root)/_layout.tsx',
  'apps/dowork/app/(root)/providers/DatabaseProvider.tsx',

  // P3 cloud foundation
  'apps/dowork/app/(root)/providers/DoWorkCloudProvider.tsx',
  'apps/dowork/app/(root)/data/launch-environment.ts',
  'apps/dowork/app/(root)/data/account.ts',
  'apps/dowork/app/(root)/auth-callback.tsx',
  'apps/dowork/app/(root)/components/ErrorBoundary.tsx',

  // P4 tab nav
  'apps/dowork/app/(root)/(tabs)/_layout.tsx',
  'apps/dowork/app/(root)/(tabs)/_screen-kit.tsx',
  'apps/dowork/app/(root)/(tabs)/index.tsx',
  'apps/dowork/app/(root)/(tabs)/explore.tsx',
  'apps/dowork/app/(root)/(tabs)/workouts.tsx',
  'apps/dowork/app/(root)/(tabs)/progress.tsx',
  'apps/dowork/app/(root)/(tabs)/settings.tsx',

  // Supabase migrations
  'supabase/migrations/20260428000001_dowork_bootstrap.sql',
  'supabase/migrations/20260428000002_dowork_workout_shares.sql',
  'supabase/migrations/20260428000003_dowork_trainer_videos.sql',
  'supabase/migrations/20260428000004_dowork_moderation.sql',

  // Edge function stubs
  'supabase/functions/dowork-upload-finalize/index.ts',
  'supabase/functions/dowork-delete-account/index.ts',

  // Runbook
  'docs/runbooks/dowork-supabase-setup.md',
];

console.log('\nP0-P4 + P3 cloud foundation files:\n');
for (const path of requiredFiles) {
  ensureFile(path);
}

// P5 — Foundation pre-work (kits + helpers)
const p5Foundation = [
  'apps/dowork/app/(root)/phase2-kit.tsx',
  'apps/dowork/app/(root)/phase3-kit.tsx',
  'apps/dowork/app/(root)/social-kit.tsx',
  'apps/dowork/lib/workouts/settings.ts',
  'apps/dowork/lib/workouts/social.ts',
  'apps/dowork/lib/workouts/phase3.ts',
  'apps/dowork/lib/uuid.ts',
];

console.log('\nP5 foundation (kits + helpers):\n');
for (const path of p5Foundation) {
  ensureFile(path);
}

const p5BatchA = [
  'apps/dowork/app/(root)/builder.tsx',
  'apps/dowork/app/(root)/session.tsx',
  'apps/dowork/app/(root)/exercises.tsx',
  'apps/dowork/app/(root)/exercise/[id].tsx',
  'apps/dowork/app/(root)/save-workout.tsx',
  'apps/dowork/app/(root)/superset.tsx',
  'apps/dowork/app/(root)/timer.tsx',
  'apps/dowork/app/(root)/warmup.tsx',
];

const p5BatchB = [
  'apps/dowork/app/(root)/programs.tsx',
  'apps/dowork/app/(root)/program/[id].tsx',
  'apps/dowork/app/(root)/program/create.tsx',
  'apps/dowork/app/(root)/plans.tsx',
  'apps/dowork/app/(root)/onboarding.tsx',
];

const p5BatchC = [
  'apps/dowork/app/(root)/one-rm.tsx',
  'apps/dowork/app/(root)/plate-loader.tsx',
  'apps/dowork/app/(root)/main-exercises.tsx',
];

const p5BatchD = [
  'apps/dowork/app/(root)/history.tsx',
  'apps/dowork/app/(root)/photos.tsx',
  'apps/dowork/app/(root)/measurements.tsx',
  'apps/dowork/app/(root)/recordings.tsx',
  'apps/dowork/app/(root)/monthly-report.tsx',
];

const p5BatchE = [
  'apps/dowork/app/(root)/generate.tsx',
  'apps/dowork/app/(root)/recovery.tsx',
  'apps/dowork/app/(root)/body-map.tsx',
  'apps/dowork/app/(root)/overload.tsx',
];

const p5BatchF = [
  'apps/dowork/app/(root)/gps.tsx',
];

const p5BatchG = ['apps/dowork/app/(root)/insights.tsx'];

const p5BatchH = [
  'apps/dowork/app/(root)/social.tsx',
  'apps/dowork/app/(root)/social-feed.tsx',
  'apps/dowork/app/(root)/share-workout.tsx',
];

const p5BatchSpec = [
  ['Batch A — Workout flow', p5BatchA],
  ['Batch B — Programs/plans', p5BatchB],
  ['Batch C — Tools/calculators', p5BatchC],
  ['Batch D — Tracking/analytics', p5BatchD],
  ['Batch E — AI/recovery', p5BatchE],
  ['Batch F — GPS/Watch', p5BatchF],
  ['Batch G — Insights', p5BatchG],
  ['Batch H — Social/Share', p5BatchH],
];

for (const [label, paths] of p5BatchSpec) {
  console.log(`\nP5 ${label}:\n`);
  for (const path of paths) {
    ensureFile(path);
  }
}

// P6 — Cloud-backed data helpers
const p6Helpers = [
  'apps/dowork/app/(root)/data/cloud-shares.ts',
  'apps/dowork/app/(root)/data/cloud-likes.ts',
  'apps/dowork/app/(root)/data/cloud-comments.ts',
  'apps/dowork/app/(root)/data/cloud-trainer-videos.ts',
  'apps/dowork/app/(root)/data/public-render-policy.ts',
  // P8 cloud completion (audit 2026-06-09)
  'apps/dowork/app/(root)/data/cloud-media.ts',
  'apps/dowork/app/(root)/data/cloud-trainers.ts',
  'apps/dowork/app/(root)/data/cloud-profiles.ts',
  'apps/dowork/app/(root)/data/cloud-blocks.ts',
  'apps/dowork/app/(root)/data/cloud-reports.ts',
  'apps/dowork/app/(root)/data/pending-queues.ts',
  'apps/dowork/app/(root)/post/[id].tsx',
  'apps/dowork/app/(root)/blocked-users.tsx',
  'supabase/migrations/20260609000003_dowork_user_blocks.sql',
];

console.log('\nP6 cloud-backed data helpers:\n');
for (const path of p6Helpers) {
  ensureFile(path);
}

// P7 — Security hardening (audit 2026-06-09)
const p7Security = [
  'apps/dowork/plugins/withSecurityHardening.js',
  'apps/dowork/plugins/withDataProtection.js',
  'apps/dowork/plugins/android-res/data_extraction_rules.xml',
  'apps/dowork/plugins/android-res/network_security_config.xml',
  'supabase/migrations/20260609000001_dowork_security_hardening.sql',
  'supabase/migrations/20260609000002_dowork_storage_policies.sql',
];

console.log('\nP7 security hardening artifacts:\n');
for (const path of p7Security) {
  ensureFile(path);
}

console.log('\nP7 security hardening contracts:\n');
const hardeningSql = readFileSync(
  resolve(root, 'supabase/migrations/20260609000001_dowork_security_hardening.sql'),
  'utf8',
);
if (!hardeningSql.includes('drop policy if exists dw_trainers_owner_modify')) {
  fail('security hardening migration must drop the dw_trainers FOR ALL owner policy');
} else {
  ok('dw_trainers self-verification policy dropped');
}
const storageSql = readFileSync(
  resolve(root, 'supabase/migrations/20260609000002_dowork_storage_policies.sql'),
  'utf8',
);
for (const bucket of ['dowork-avatars', 'dowork-share-media', 'dowork-trainer-videos']) {
  if (!storageSql.includes(`'${bucket}'`)) {
    fail(`storage policies migration missing bucket ${bucket}`);
  } else {
    ok(`bucket ${bucket}`);
  }
}

// Schema v2 (Plan 36) — trainer platform, coaching loop, push, view dedup.
const schemaV2Files = [
  'supabase/migrations/20260703000001_dowork_trainer_platform_v2.sql',
  'supabase/migrations/20260703000002_dowork_form_check_storage.sql',
];

console.log('\nSchema v2 (Plan 36) migration files:\n');
for (const path of schemaV2Files) {
  ensureFile(path);
}

console.log('\nSchema v2 contracts:\n');
const platformSql = readFileSync(
  resolve(root, 'supabase/migrations/20260703000001_dowork_trainer_platform_v2.sql'),
  'utf8',
);
const platformMarkers = [
  'dw_trainer_invites',
  'dw_trainer_subscriptions',
  'dw_purchase_events',
  'dw_client_links',
  'dw_form_checks',
  'dw_form_feedback',
  'dw_video_view_marks',
  'dw_push_tokens',
  'dw_redeem_client_invite',
  'dw_get_trainer_earnings',
  'dw_trainer_videos_select_entitled',
];
for (const marker of platformMarkers) {
  if (!platformSql.includes(marker)) {
    fail(`schema v2 migration missing ${marker}`);
  } else {
    ok(`schema v2 ${marker}`);
  }
}

const formCheckStorageSql = readFileSync(
  resolve(root, 'supabase/migrations/20260703000002_dowork_form_check_storage.sql'),
  'utf8',
);
if (!formCheckStorageSql.includes("'dowork-form-checks'")) {
  fail('form-check storage migration missing dowork-form-checks bucket');
} else {
  ok('bucket dowork-form-checks');
}
if (!formCheckStorageSql.includes('dw_link_participant')) {
  fail('form-check storage migration must gate uploads via dw_link_participant');
} else {
  ok('form-check upload gated by dw_link_participant');
}

// Phase 1.3 edge functions — the 4 new trainer-platform functions each ship an
// index.ts handler plus a vitest suite, and the 2 upgraded functions carry the
// new secret / bucket markers.
console.log('\nPhase 1.3 edge functions (index + tests):\n');
const newFunctionDirs = [
  'dowork-redeem-invite',
  'dowork-playback-url',
  'dowork-rc-webhook',
  'dowork-notify',
];
for (const dir of newFunctionDirs) {
  ensureFile(`supabase/functions/${dir}/index.ts`);
  ensureFile(`supabase/functions/${dir}/__tests__/index.test.ts`);
}

console.log('\nPhase 1.3 edge function contracts:\n');
const rcWebhookSource = readFileSync(
  resolve(root, 'supabase/functions/dowork-rc-webhook/index.ts'),
  'utf8',
);
if (!rcWebhookSource.includes('RC_WEBHOOK_SECRET')) {
  fail('dowork-rc-webhook must verify RC_WEBHOOK_SECRET');
} else {
  ok('dowork-rc-webhook verifies RC_WEBHOOK_SECRET');
}
const notifySource = readFileSync(
  resolve(root, 'supabase/functions/dowork-notify/index.ts'),
  'utf8',
);
if (!notifySource.includes('DOWORK_INTERNAL_SECRET')) {
  fail('dowork-notify must verify DOWORK_INTERNAL_SECRET');
} else {
  ok('dowork-notify verifies DOWORK_INTERNAL_SECRET');
}
if (!notifySource.includes('exp.host/--/api/v2/push/send')) {
  fail('dowork-notify must post to the Expo push endpoint');
} else {
  ok('dowork-notify targets the Expo push endpoint');
}
const uploadFinalizeSource = readFileSync(
  resolve(root, 'supabase/functions/dowork-upload-finalize/index.ts'),
  'utf8',
);
if (!uploadFinalizeSource.includes('dowork-form-checks')) {
  fail('dowork-upload-finalize must support the dowork-form-checks bucket (form_check kind)');
} else {
  ok('dowork-upload-finalize supports form_check uploads');
}
if (!uploadFinalizeSource.includes("'form_check'")) {
  fail('dowork-upload-finalize must handle the form_check upload kind');
} else {
  ok('dowork-upload-finalize handles the form_check kind');
}
const deleteAccountSource = readFileSync(
  resolve(root, 'supabase/functions/dowork-delete-account/index.ts'),
  'utf8',
);
for (const table of ['dw_trainer_subscriptions', 'dw_client_links', 'dw_push_tokens', 'dw_video_view_marks']) {
  if (!deleteAccountSource.includes(table)) {
    fail(`dowork-delete-account must cascade ${table}`);
  } else {
    ok(`dowork-delete-account cascades ${table}`);
  }
}
if (!deleteAccountSource.includes('DOWORK_FORM_CHECK_BUCKET')) {
  fail('dowork-delete-account must remove form-check storage objects');
} else {
  ok('dowork-delete-account removes form-check storage');
}

// Insights detector strip — DoWork must not import the cross-module
// detectors (mood / fasting / nutrition correlations) from
// `@mylife/workouts`. The detectors still exist in the module for the
// hub; DoWork just doesn't render them.
console.log('\nInsights detector strip (mood/fasting/nutrition):\n');
const insightsSource = readFileSync(
  resolve(root, 'apps/dowork/app/(root)/insights.tsx'),
  'utf8',
);
const forbiddenDetectors = [
  'detectMoodLiftCorrelation',
  'detectFastingPerformance',
  'detectProteinRecovery',
];
for (const detector of forbiddenDetectors) {
  if (insightsSource.includes(detector)) {
    fail(
      `apps/dowork/app/(root)/insights.tsx imports stripped detector ${detector} (must be removed for DoWork)`,
    );
  } else {
    ok(`${detector} stripped`);
  }
}

// Sanity: package.json declares the @mylife/workouts dependency
console.log('\nWorkspace dependencies:\n');
const pkgRaw = readFileSync(resolve(root, 'apps/dowork/package.json'), 'utf8');
const pkg = JSON.parse(pkgRaw);
const requiredDeps = [
  '@mylife/workouts',
  '@mylife/ui',
  '@mylife/db',
  '@mylife/auth',
  '@mylife/sync',
  '@mylife/module-registry',
  '@supabase/supabase-js',
  'expo',
  'expo-router',
  'expo-sqlite',
  'expo-secure-store',
];
for (const dep of requiredDeps) {
  if (!pkg.dependencies?.[dep]) {
    fail(`apps/dowork/package.json missing dependency ${dep}`);
  } else {
    ok(`dep ${dep}`);
  }
}

// Bundle id sanity
console.log('\napp.json bundle identifiers:\n');
const appJsonRaw = readFileSync(resolve(root, 'apps/dowork/app.json'), 'utf8');
const appJson = JSON.parse(appJsonRaw);
if (appJson.expo?.ios?.bundleIdentifier !== 'com.dowork.dowork') {
  fail(`apps/dowork/app.json iOS bundleIdentifier should be com.dowork.dowork`);
} else {
  ok('iOS bundleIdentifier = com.dowork.dowork');
}
if (appJson.expo?.android?.package !== 'com.dowork.dowork') {
  fail(`apps/dowork/app.json Android package should be com.dowork.dowork`);
} else {
  ok('Android package = com.dowork.dowork');
}
if (appJson.expo?.scheme !== 'dowork') {
  fail(`apps/dowork/app.json scheme should be dowork`);
} else {
  ok('scheme = dowork');
}
if (appJson.expo?.ios?.infoPlist?.ITSAppUsesNonExemptEncryption !== false) {
  fail('apps/dowork/app.json ITSAppUsesNonExemptEncryption must be false (TLS only)');
} else {
  ok('ITSAppUsesNonExemptEncryption = false');
}
for (const plugin of ['./plugins/withSecurityHardening', './plugins/withDataProtection']) {
  if (!appJson.expo?.plugins?.includes(plugin)) {
    fail(`apps/dowork/app.json plugins missing ${plugin}`);
  } else {
    ok(`plugin ${plugin}`);
  }
}

// Brand: confirm DoWork tokens override the base accent
console.log('\nBrand tokens:\n');
const tokens = readFileSync(
  resolve(root, 'apps/dowork/app/(root)/theme/tokens.ts'),
  'utf8',
);
if (!tokens.includes('DW_ACCENT')) {
  fail('apps/dowork tokens missing DW_ACCENT');
} else {
  ok('DW_ACCENT defined');
}
if (!tokens.includes('#FF6B00')) {
  fail('apps/dowork tokens missing iron orange #FF6B00');
} else {
  ok('iron orange #FF6B00 defined');
}

// Cloud: confirm DoWork uses its own dw_ prefix in migrations
console.log('\nCloud migration prefix:\n');
const cloudMigration = readFileSync(
  resolve(root, 'supabase/migrations/20260428000002_dowork_workout_shares.sql'),
  'utf8',
);
if (!cloudMigration.includes('dw_workout_shares')) {
  fail('DoWork cloud migrations missing dw_workout_shares table');
} else {
  ok('dw_workout_shares present');
}
if (cloudMigration.includes('bc_workout_shares')) {
  fail('DoWork cloud migrations leak BestChef bc_ prefix');
} else {
  ok('no bc_ prefix leakage');
}

// DatabaseProvider uses dowork.db and runs WORKOUTS_MODULE migrations
console.log('\nDatabase wiring:\n');
const dbProvider = readFileSync(
  resolve(root, 'apps/dowork/app/(root)/providers/DatabaseProvider.tsx'),
  'utf8',
);
if (!dbProvider.includes('dowork.db')) {
  fail('DoWork DatabaseProvider does not open dowork.db');
} else {
  ok('opens dowork.db');
}
if (!dbProvider.includes('WORKOUTS_MODULE')) {
  fail('DoWork DatabaseProvider does not run WORKOUTS_MODULE migrations');
} else {
  ok('runs WORKOUTS_MODULE migrations');
}

// Hub-only wrappers must not appear in DoWork screens. Scan every ported
// screen for the forbidden identifiers (the hub uses these via
// ModuleRegistry; DoWork bypasses that entirely).
console.log('\nHub wrappers absent from DoWork screens:\n');
const hubWrappers = ['ModuleLayoutWrapper', 'ModuleLockGuard', 'ModuleErrorBoundary'];
const allDoWorkScreens = [
  ...p5BatchA,
  ...p5BatchB,
  ...p5BatchC,
  ...p5BatchD,
  ...p5BatchE,
  ...p5BatchF,
  ...p5BatchG,
  ...p5BatchH,
];
for (const wrapper of hubWrappers) {
  let leakedIn = null;
  for (const screenPath of allDoWorkScreens) {
    const full = resolve(root, screenPath);
    if (!existsSync(full)) continue;
    const source = readFileSync(full, 'utf8');
    if (source.includes(wrapper)) {
      leakedIn = screenPath;
      break;
    }
  }
  if (leakedIn) {
    fail(`${leakedIn} contains forbidden hub wrapper ${wrapper}`);
  } else {
    ok(`${wrapper} absent`);
  }
}

// All P5 stack screens are registered in (root)/_layout.tsx so Expo
// Router can resolve them.
console.log('\nStack registrations in (root)/_layout.tsx:\n');
const rootLayout = readFileSync(
  resolve(root, 'apps/dowork/app/(root)/_layout.tsx'),
  'utf8',
);
const expectedRoutes = [
  '(tabs)',
  'auth-callback',
  'builder',
  'session',
  'exercises',
  'exercise/[id]',
  'save-workout',
  'superset',
  'timer',
  'warmup',
  'programs',
  'program/[id]',
  'program/create',
  'plans',
  'onboarding',
  'one-rm',
  'plate-loader',
  'main-exercises',
  'history',
  'photos',
  'measurements',
  'recordings',
  'monthly-report',
  'generate',
  'recovery',
  'body-map',
  'overload',
  'gps',
  'insights',
  'social',
  'social-feed',
  'share-workout',
  'post/[id]',
  'blocked-users',
];
for (const route of expectedRoutes) {
  if (!rootLayout.includes(`name="${route}"`)) {
    fail(`(root)/_layout.tsx missing Stack.Screen name="${route}"`);
  } else {
    ok(`route ${route}`);
  }
}

// Hub regression check: workouts module + (workouts) routes still exist
console.log('\nHub workouts surface still intact:\n');
const hubFiles = [
  'modules/workouts/src/definition.ts',
  'modules/workouts/src/index.ts',
  'apps/mobile/app/(workouts)/_layout.tsx',
  'apps/mobile/app/(workouts)/(tabs)/_layout.tsx',
  'apps/mobile/app/(workouts)/(tabs)/index.tsx',
];
for (const path of hubFiles) {
  ensureFile(path);
}

// Plan 36 Phase 3 - trainer platform UI (Trainers tab, public profile, Studio,
// invite onboarding, exercise trainer rail, data clients).
console.log('\nPlan 36 Phase 3 trainer platform UI files:\n');
const phase3Files = [
  'apps/dowork/app/(root)/(tabs)/trainers.tsx',
  'apps/dowork/app/(root)/trainer/[handle].tsx',
  'apps/dowork/app/(root)/studio.tsx',
  'apps/dowork/app/(root)/redeem-invite.tsx',
  'apps/dowork/app/(root)/data/cloud-invites.ts',
  'apps/dowork/app/(root)/components/studio/studio-kit.tsx',
  'apps/dowork/app/(root)/components/studio/UploadQueue.tsx',
  'apps/dowork/app/(root)/components/studio/ManageGrid.tsx',
  'apps/dowork/app/(root)/components/studio/ProfileEditor.tsx',
];
const phase3Sources = {};
for (const path of phase3Files) {
  phase3Sources[path] = ensureFile(path);
}

console.log('\nPlan 36 Phase 3 wiring + contracts:\n');
function assertContains(path, needle, label) {
  const source = phase3Sources[path] ?? (existsSync(resolve(root, path)) ? readFileSync(resolve(root, path), 'utf8') : '');
  if (!source.includes(needle)) {
    fail(`${path} missing ${label ?? needle}`);
  } else {
    ok(label ?? `${path} :: ${needle}`);
  }
}

// The Trainers tab is registered as the 6th bottom tab.
assertContains('apps/dowork/app/(root)/(tabs)/_layout.tsx', 'name="trainers"', 'trainers tab registered');
// Stack routes for the new (root) screens.
const rootLayoutSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/_layout.tsx'), 'utf8');
for (const route of ['trainer/[handle]', 'studio', 'redeem-invite']) {
  if (!rootLayoutSrc.includes(`name="${route}"`)) {
    fail(`(root)/_layout.tsx missing Stack.Screen name="${route}"`);
  } else {
    ok(`route ${route}`);
  }
}

// Directory filters verified trainers (belt) and reads through the cloud client.
assertContains('apps/dowork/app/(root)/(tabs)/trainers.tsx', 'listActiveTrainers', 'trainers tab reads listActiveTrainers');
const cloudTrainersSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/data/cloud-trainers.ts'), 'utf8');
for (const marker of ['getTrainerByHandle', 'updateMyTrainerProfile', 'TRAINER_PRICE_TIERS', "eq('is_verified', true)"]) {
  if (!cloudTrainersSrc.includes(marker)) {
    fail(`cloud-trainers.ts missing ${marker}`);
  } else {
    ok(`cloud-trainers ${marker}`);
  }
}

// Trainer-video client gains the manage/profile/rail helpers.
const cloudVideosSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/data/cloud-trainer-videos.ts'), 'utf8');
for (const marker of ['listTrainerVideos', 'listExerciseTrainerRail', 'listPublicTrainerVideos', 'updateTrainerVideoMeta', 'setTrainerVideoHidden']) {
  if (!cloudVideosSrc.includes(marker)) {
    fail(`cloud-trainer-videos.ts missing ${marker}`);
  } else {
    ok(`cloud-trainer-videos ${marker}`);
  }
}

// Invite client targets the redeem edge function; Studio is gated on trainer row.
assertContains('apps/dowork/app/(root)/data/cloud-invites.ts', 'dowork-redeem-invite', 'cloud-invites calls dowork-redeem-invite');
assertContains('apps/dowork/app/(root)/studio.tsx', 'getMyTrainerProfile', 'studio gated on trainer row');
assertContains('apps/dowork/app/(root)/redeem-invite.tsx', 'redeemTrainerInvite', 'redeem screen calls redeemTrainerInvite');
assertContains('apps/dowork/app/(root)/components/studio/UploadQueue.tsx', 'uploadTrainerVideoToCloud', 'upload queue uses the cloud pipeline');
assertContains('apps/dowork/app/(root)/components/studio/ProfileEditor.tsx', 'updateMyTrainerProfile', 'profile editor saves owner fields');

// Exercise detail surfaces the cloud trainer rail (real signed-playback path).
const exerciseDetailSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/exercise/[id].tsx'), 'utf8');
if (!exerciseDetailSrc.includes('listExerciseTrainerRail')) {
  fail('exercise/[id].tsx missing the cloud trainer rail (listExerciseTrainerRail)');
} else {
  ok('exercise detail trainer rail wired');
}

// Plan 36 Phase 4 - coaching loop UI (client roster, invite QR join,
// form-check exchange, my-trainer, offline feedback queue).
console.log('\nPlan 36 Phase 4 coaching loop UI files:\n');
const phase4Files = [
  'apps/dowork/app/(root)/clients.tsx',
  'apps/dowork/app/(root)/client-invite/index.tsx',
  'apps/dowork/app/(root)/client-invite/[code].tsx',
  'apps/dowork/app/(root)/my-trainer.tsx',
  'apps/dowork/app/(root)/form-check/[id].tsx',
  'apps/dowork/app/(root)/data/cloud-coaching.ts',
  'apps/dowork/app/(root)/components/coaching/coaching-kit.tsx',
  'apps/dowork/app/(root)/components/coaching/InviteShareSheet.tsx',
  'apps/dowork/app/(root)/components/coaching/pick-video.ts',
];
for (const path of phase4Files) {
  ensureFile(path);
}

console.log('\nPlan 36 Phase 4 wiring + contracts:\n');
const cloudCoachingSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/data/cloud-coaching.ts'), 'utf8');
for (const marker of [
  'dw_redeem_client_invite',
  'generateInviteCode',
  'uploadFormCheck',
  'uploadFeedbackReply',
  'flushPendingFeedback',
  'listTrainerLibrary',
]) {
  if (!cloudCoachingSrc.includes(marker)) {
    fail(`cloud-coaching.ts missing ${marker}`);
  } else {
    ok(`cloud-coaching ${marker}`);
  }
}

// Join flow stays non-enumerable: no invite_code lookup selects on dw_client_links.
if (cloudCoachingSrc.includes(".eq('invite_code'")) {
  fail('cloud-coaching.ts selects dw_client_links by invite_code (enumeration risk)');
} else {
  ok('cloud-coaching join goes through the redeem RPC only');
}

// Service-role-only tables never appear in the coaching data client.
for (const table of ['dw_trainer_invites', 'dw_purchase_events', 'dw_video_view_marks']) {
  if (cloudCoachingSrc.includes(`from('${table}'`)) {
    fail(`cloud-coaching.ts reads service-role-only table ${table}`);
  } else {
    ok(`cloud-coaching avoids ${table}`);
  }
}

assertContains('apps/dowork/app/(root)/form-check/[id].tsx', 'getPlaybackSource', 'form-check review plays through signed URLs');
assertContains('apps/dowork/app/(root)/components/coaching/InviteShareSheet.tsx', 'dowork://client-invite/', 'invite share QR encodes the deep link');
assertContains('apps/dowork/app/(root)/(tabs)/settings.tsx', 'my-trainer', 'settings links my-trainer');
assertContains('apps/dowork/app/(root)/(tabs)/index.tsx', 'my-trainer', 'home card links my-trainer');
assertContains('apps/dowork/app/(root)/data/pending-queues.ts', 'flushPendingFeedback', 'offline feedback queue wired into pending-queues');
assertContains('apps/dowork/package.json', 'react-native-qrcode-svg', 'QR dependency present');

// Plan 36 Phase 5 - monetization (RevenueCat paywall, server-truth entitlement,
// trainer earnings). purchases.ts is the ONLY file importing react-native-purchases.
console.log('\nPlan 36 Phase 5 monetization files:\n');
const phase5Files = [
  'apps/dowork/app/(root)/data/purchases.ts',
  'apps/dowork/app/(root)/data/cloud-subscriptions.ts',
  'apps/dowork/app/(root)/components/PaywallSheet.tsx',
  'apps/dowork/app/(root)/earnings.tsx',
];
for (const path of phase5Files) {
  ensureFile(path);
}

console.log('\nPlan 36 Phase 5 wiring + contracts:\n');

// react-native-purchases dependency present.
if (!pkg.dependencies?.['react-native-purchases']) {
  fail('apps/dowork/package.json missing react-native-purchases');
} else {
  ok('dep react-native-purchases');
}

// purchases.ts imports the native SDK, sets the trainer_id subscriber attribute
// before purchasing (webhook contract), and confirms entitlement server-side.
const purchasesSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/data/purchases.ts'), 'utf8');
if (!purchasesSrc.includes("from 'react-native-purchases'")) {
  fail('purchases.ts must import react-native-purchases');
} else {
  ok('purchases.ts imports react-native-purchases');
}
if (!/setAttributes\(\{\s*trainer_id/.test(purchasesSrc)) {
  fail('purchases.ts must set the trainer_id subscriber attribute (webhook contract)');
} else {
  ok('purchases.ts sets the trainer_id subscriber attribute before purchase');
}
if (!purchasesSrc.includes('waitForActiveSubscription')) {
  fail('purchases.ts must confirm entitlement via the server (waitForActiveSubscription)');
} else {
  ok('purchases.ts confirms entitlement server-side');
}

// Native code stays out of the test graph: only purchases.ts imports the SDK.
const rcImporters = [];
for (const rel of [
  'apps/dowork/app/(root)/components/PaywallSheet.tsx',
  'apps/dowork/app/(root)/earnings.tsx',
  'apps/dowork/app/(root)/trainer/[handle].tsx',
  'apps/dowork/app/(root)/(tabs)/settings.tsx',
  'apps/dowork/app/(root)/data/cloud-subscriptions.ts',
]) {
  const src = existsSync(resolve(root, rel)) ? readFileSync(resolve(root, rel), 'utf8') : '';
  if (src.includes("from 'react-native-purchases'")) rcImporters.push(rel);
}
if (rcImporters.length > 0) {
  fail(`react-native-purchases imported outside purchases.ts: ${rcImporters.join(', ')}`);
} else {
  ok('react-native-purchases confined to purchases.ts');
}

// Earnings reads the security-definer RPC, never the service-role-only ledger.
const cloudSubsSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/data/cloud-subscriptions.ts'), 'utf8');
if (!cloudSubsSrc.includes('dw_get_trainer_earnings')) {
  fail('cloud-subscriptions.ts must read earnings through dw_get_trainer_earnings');
} else {
  ok('cloud-subscriptions reads the dw_get_trainer_earnings RPC');
}
for (const rel of [
  'apps/dowork/app/(root)/data/cloud-subscriptions.ts',
  'apps/dowork/app/(root)/earnings.tsx',
  'apps/dowork/app/(root)/data/purchases.ts',
]) {
  const src = readFileSync(resolve(root, rel), 'utf8');
  if (src.includes("from('dw_purchase_events'")) {
    fail(`${rel} selects the service-role-only dw_purchase_events table`);
  } else {
    ok(`${rel.split('/').pop()} avoids dw_purchase_events`);
  }
}
assertContains('apps/dowork/app/(root)/earnings.tsx', 'getTrainerEarnings', 'earnings screen calls the earnings RPC client');

// Paywall discloses auto-renew terms, links the hosted legal pages, and drives
// the real purchase flow (no fake unlock).
const paywallSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/components/PaywallSheet.tsx'), 'utf8');
for (const marker of ['https://dowork.app/terms', 'https://dowork.app/privacy', 'auto-renewing']) {
  if (!paywallSrc.includes(marker)) {
    fail(`PaywallSheet missing ${marker}`);
  } else {
    ok(`PaywallSheet ${marker}`);
  }
}
if (!paywallSrc.includes('purchaseTrainerSubscription')) {
  fail('PaywallSheet must drive the real purchase flow');
} else {
  ok('PaywallSheet drives the real purchase flow');
}

// Studio + profile + settings + route wiring.
assertContains('apps/dowork/app/(root)/studio.tsx', "router.push('/(root)/earnings'", 'studio links the earnings screen');
assertContains('apps/dowork/app/(root)/trainer/[handle].tsx', 'PaywallSheet', 'trainer profile mounts the paywall');
assertContains('apps/dowork/app/(root)/(tabs)/settings.tsx', 'restoreTrainerPurchases', 'settings offers restore purchases');
assertContains('apps/dowork/app/(root)/(tabs)/settings.tsx', 'MANAGE_SUBSCRIPTION_URL', 'settings offers manage subscription');
const rootLayoutPhase5 = readFileSync(resolve(root, 'apps/dowork/app/(root)/_layout.tsx'), 'utf8');
if (!rootLayoutPhase5.includes('name="earnings"')) {
  fail('(root)/_layout.tsx missing Stack.Screen name="earnings"');
} else {
  ok('route earnings');
}

// Plan 36 Phase 6 (downloads + hardening half) - offline downloads, player
// local-file preference, settings storage meter + sign-out wipe + the contracted
// Notifications row, and the expo-av retirement. Honesty is enforced at the
// source level: entitlement is re-verified through the server and a revoked
// download is deleted; a local file is never faked.
console.log('\nPlan 36 Phase 6 downloads + hardening files:\n');
for (const path of [
  'apps/dowork/app/(root)/data/downloads.ts',
  'apps/dowork/app/(root)/data/__tests__/downloads.test.ts',
]) {
  ensureFile(path);
}

console.log('\nPlan 36 Phase 6 wiring + contracts:\n');

const downloadsSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/data/downloads.ts'), 'utf8');
for (const marker of [
  'getPlaybackSource',
  'resolveDownloadedVideo',
  'checkDownloadEntitlement',
  'wipeAllDownloads',
  "'dowork.downloads.index.v1'",
]) {
  if (!downloadsSrc.includes(marker)) {
    fail(`downloads.ts missing ${marker}`);
  } else {
    ok(`downloads ${marker}`);
  }
}
// Transport honesty: the three-way verdict distinguishes a real revoke (delete)
// from an offline check (keep the file), so entitlement is never faked.
for (const verdict of ["'entitled'", "'revoked'", "'offline'"]) {
  if (!downloadsSrc.includes(verdict)) {
    fail(`downloads.ts missing entitlement verdict ${verdict}`);
  } else {
    ok(`downloads verdict ${verdict}`);
  }
}

const playerSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/player.tsx'), 'utf8');
for (const marker of ['resolveDownloadedVideo', 'startVideoDownload', 'isVideoDownloaded', 'Downloaded']) {
  if (!playerSrc.includes(marker)) {
    fail(`player.tsx missing ${marker}`);
  } else {
    ok(`player ${marker}`);
  }
}
// Form checks are never downloadable: the affordance is gated on a trainer
// videoId only.
if (!playerSrc.includes('isDownloadable = Boolean(videoId)')) {
  fail('player.tsx must gate downloads to trainer videos (form checks never downloadable)');
} else {
  ok('player gates downloads to trainer videos (form checks not downloadable)');
}

const settingsSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/(tabs)/settings.tsx'), 'utf8');
for (const marker of ['listDownloads', 'Offline downloads', 'wipeAllDownloads', 'notification-preferences']) {
  if (!settingsSrc.includes(marker)) {
    fail(`settings.tsx missing ${marker}`);
  } else {
    ok(`settings ${marker}`);
  }
}

// expo-av retirement: exercise detail retired its local Video Carousel (the
// cloud Trainer Demos rail stays); the package no longer depends on expo-av.
// The standalone upload-video screen was cut (superseded by the Studio
// UploadQueue), so its expo-video contract now lives in that component.
const exerciseDetailP6 = readFileSync(resolve(root, 'apps/dowork/app/(root)/exercise/[id].tsx'), 'utf8');
if (exerciseDetailP6.includes('getExerciseVideos') || exerciseDetailP6.includes('Video Carousel')) {
  fail('exercise/[id].tsx must retire the local Video Carousel');
} else {
  ok('exercise/[id].tsx local Video Carousel retired');
}
if (!exerciseDetailP6.includes('listExerciseTrainerRail')) {
  fail('exercise/[id].tsx must keep the cloud Trainer Demos rail');
} else {
  ok('exercise/[id].tsx keeps the cloud Trainer Demos rail');
}
if (pkg.dependencies?.['expo-av']) {
  fail('apps/dowork/package.json must not depend on expo-av (retired)');
} else {
  ok('package.json free of expo-av');
}
if (!pkg.dependencies?.['expo-video']) {
  fail('apps/dowork/package.json must depend on expo-video');
} else {
  ok('dep expo-video');
}

// Plan 36 Phase 6 (push + deep-links half) - token lifecycle, server-enforced
// notification preferences, tap routing, trainer QR poster.
console.log('\nPlan 36 Phase 6 push + deep-link files:\n');
for (const path of [
  'apps/dowork/app/(root)/data/push.ts',
  'apps/dowork/app/(root)/data/__tests__/push.test.ts',
  'apps/dowork/app/(root)/notification-preferences.tsx',
  'apps/dowork/app/(root)/components/NotificationRouter.tsx',
  'apps/dowork/app/(root)/components/TrainerSharePoster.tsx',
  'apps/dowork/app/(root)/video/[id].tsx',
  'supabase/migrations/20260704000001_dowork_push_prefs.sql',
]) {
  ensureFile(path);
}

console.log('\nPlan 36 Phase 6 push wiring + contracts:\n');
const rootLayoutP6 = readFileSync(resolve(root, 'apps/dowork/app/(root)/_layout.tsx'), 'utf8');
for (const route of ['notification-preferences', 'video/[id]']) {
  if (!rootLayoutP6.includes(`name="${route}"`)) {
    fail(`(root)/_layout.tsx missing Stack.Screen name="${route}"`);
  } else {
    ok(`route ${route}`);
  }
}
if (!rootLayoutP6.includes('<NotificationRouter')) {
  fail('(root)/_layout.tsx must mount NotificationRouter (tap routing is dead otherwise)');
} else {
  ok('NotificationRouter mounted');
}
const notifyFnSrc = readFileSync(resolve(root, 'supabase/functions/dowork-notify/index.ts'), 'utf8');
for (const marker of ['dw_notification_prefs', 'getMarketingRecipients', 'filterByPreference']) {
  if (!notifyFnSrc.includes(marker)) {
    fail(`dowork-notify missing ${marker} (server-side preference enforcement)`);
  } else {
    ok(`dowork-notify ${marker}`);
  }
}
const pushSrc = readFileSync(resolve(root, 'apps/dowork/app/(root)/data/push.ts'), 'utf8');
for (const marker of ['not_provisioned', 'dw_push_tokens', 'dw_notification_prefs']) {
  if (!pushSrc.includes(marker)) {
    fail(`push.ts missing ${marker}`);
  } else {
    ok(`push.ts ${marker}`);
  }
}

// Plan 36 Phase 7 (code-side store ops) - build env guard + review/QA docs.
console.log('\nPlan 36 Phase 7 store-ops files:\n');
for (const path of [
  'apps/dowork/scripts/check-build-env.mjs',
  'apps/dowork/scripts/__tests__/check-build-env.test.mjs',
  'apps/dowork/Tickets/app-review-notes.md',
  'apps/dowork/Tickets/white-glove-qa-checklist.md',
]) {
  ensureFile(path);
}
if (!pkg.scripts?.['eas-build-pre-install']) {
  fail('apps/dowork/package.json must wire eas-build-pre-install to the env guard');
} else {
  ok('eas-build-pre-install wired');
}

// Onboarding entry gate (Plan 36 orphan sweep). app/index.tsx must gate the
// first-launch redirect on the completion flag onboarding.tsx writes, instead
// of dropping every user straight onto the tabs.
console.log('\nOnboarding entry gate:\n');
const appIndexSrc = readFileSync(resolve(root, 'apps/dowork/app/index.tsx'), 'utf8');
if (!appIndexSrc.includes('workouts.onboarding_complete')) {
  fail('app/index.tsx must read the workouts.onboarding_complete flag');
} else {
  ok('app/index.tsx reads workouts.onboarding_complete');
}
if (!appIndexSrc.includes('/(root)/onboarding')) {
  fail('app/index.tsx must redirect first launches to /(root)/onboarding');
} else {
  ok('app/index.tsx gates first launch into onboarding');
}

// Orphan-route guard (Plan 36 orphan sweep). Every route registered in
// (root)/_layout.tsx must have at least one inbound navigation reference
// (router.push/replace, <Link href>, <Redirect href>, or a dynamic-path
// prefix) somewhere under apps/dowork/app. This is the guard that would have
// caught the ~19 ported-but-unreachable screens. Tab-group and deep-link /
// param-only routes are explicitly allowlisted below.
console.log('\nEvery registered route is reachable:\n');
const REACHABILITY_ALLOWLIST = new Set([
  '(tabs)', // tab group root (redirect target, rendered by the tab bar)
  'auth-callback', // Supabase dowork:// auth deep link
  'player', // param-driven signed playback (also a deep-link target)
  'video/[id]', // push-notification deep link
  'client-invite/[code]', // QR / dowork:// invite deep link
  'client-invite/index', // reached via router.replace('/(root)/client-invite') (implicit index resolution)
]);

function collectAppSources(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...collectAppSources(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push({ path: full, src: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

const appRoot = resolve(root, 'apps/dowork/app');
const appSources = collectAppSources(appRoot);
const registeredRoutes = [...rootLayout.matchAll(/name="([^"]+)"/g)].map((match) => match[1]);

function routeIsReferenced(route) {
  const ownFile = resolve(appRoot, '(root)', `${route}.tsx`);
  if (route.includes('[')) {
    // Dynamic route: match the static path prefix before the [param] segment.
    const prefix = `/(root)/${route.replace(/\/\[[^\]]+\].*$/, '')}/`;
    return appSources.some(({ path, src }) => path !== ownFile && src.includes(prefix));
  }
  const base = `/(root)/${route}`;
  const boundary = new RegExp(
    base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + `(?:['"\`?)\\s]|$)`,
  );
  return appSources.some(({ path, src }) => path !== ownFile && boundary.test(src));
}

for (const route of registeredRoutes) {
  if (REACHABILITY_ALLOWLIST.has(route)) {
    ok(`route ${route} (allowlisted deep-link/param entry)`);
    continue;
  }
  if (routeIsReferenced(route)) {
    ok(`route ${route} reachable`);
  } else {
    fail(
      `(root)/_layout.tsx registers "${route}" but nothing navigates to it — wire an entry point or delete the route`,
    );
  }
}

// Reverse of the reachability guard above: every screen actually navigated
// to via router.push/router.replace must be a registered Stack.Screen (or an
// explicit deep-link / tab-group target), otherwise Expo Router falls back
// to default screenOptions and users see a white flash + native header
// (SH-1). This is the check that would have caught my-trainer, clients,
// client-invite/index, client-invite/[code], and form-check/[id] shipping
// unregistered.
console.log('\nEvery navigated-to screen is registered in (root)/_layout.tsx:\n');

// Routes that resolve outside (root)'s own Stack.Screen list: tab-group
// screens are reached through the "(tabs)" group entry, not by name.
const NAVIGATION_ALLOWLIST = new Set([...REACHABILITY_ALLOWLIST, '(tabs)']);

// Matches the literal "/(root)/(tabs)/..." prefix separately since the
// (tabs) segment's own parens would otherwise truncate the general capture
// below (which excludes ")" to stop at the closing quote/paren of the call).
const NAV_TABS_RE = /router\.(?:push|replace)\(\s*[`'"]\/\(root\)\/\(tabs\)/g;
const NAV_CALL_RE = /router\.(?:push|replace)\(\s*[`'"]\/\(root\)\/([^`'")?]+)/g;
const navigatedRoutes = new Set();
for (const { src } of appSources) {
  if (NAV_TABS_RE.test(src)) {
    navigatedRoutes.add('(tabs)');
  }
  for (const match of src.matchAll(NAV_CALL_RE)) {
    let route = match[1];
    if (route.startsWith('(tabs')) continue; // handled by NAV_TABS_RE above
    // Strip a trailing template-literal interpolation segment, e.g.
    // "form-check/${check.id}" -> "form-check", "trainer/${h.handle}" -> "trainer".
    // Static routes with no interpolation pass through unchanged.
    route = route.replace(/\/$/, '');
    if (route.includes('${') || route.includes('$')) {
      route = route.split('/').filter((seg) => !seg.includes('$')).join('/');
    }
    if (route) navigatedRoutes.add(route);
  }
}

function isRegistered(route) {
  if (rootLayout.includes(`name="${route}"`)) return true;
  // Dynamic routes: a stripped static prefix (e.g. "form-check") satisfies
  // its registered "form-check/[id]" counterpart.
  return registeredRoutes.some((r) => r.startsWith(`${route}/[`));
}

for (const route of navigatedRoutes) {
  if (NAVIGATION_ALLOWLIST.has(route)) {
    ok(`navigated route ${route} (allowlisted)`);
    continue;
  }
  if (isRegistered(route)) {
    ok(`navigated route ${route} registered`);
  } else {
    fail(
      `"${route}" is navigated to via router.push/replace but has no matching Stack.Screen in (root)/_layout.tsx — add the registration or the route will render with default screenOptions`,
    );
  }
}

// Explicit regression guard for the 5 coaching screens found unregistered
// (SH-1): assert each is present by name so this can't silently recur even
// if the generic scan above is ever weakened.
console.log('\nSH-1 regression guard: coaching screens explicitly registered:\n');
const sh1Routes = [
  'my-trainer',
  'clients',
  'client-invite/index',
  'client-invite/[code]',
  'form-check/[id]',
];
for (const route of sh1Routes) {
  if (!rootLayout.includes(`name="${route}"`)) {
    fail(`SH-1 regression: (root)/_layout.tsx missing Stack.Screen name="${route}"`);
  } else {
    ok(`SH-1 route ${route} registered`);
  }
}

console.log('\n----------------------------------------\n');
if (failures > 0) {
  console.error(`${failures} DoWork parity check(s) failed.`);
  process.exit(1);
}
console.log('All DoWork parity checks passed.');
