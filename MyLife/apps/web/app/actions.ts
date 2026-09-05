'use server';

import { revalidatePath } from 'next/cache';
import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  getModeConfig,
  saveModeConfig,
  getStoredEntitlement,
  saveEntitlement,
} from '@/lib/entitlements';
import {
  resolveCurrentApiBaseUrl,
  testSelfHostConnection,
  type SelfHostConnectionResult,
} from '@/lib/server-endpoint';
import {
  getEnabledModules,
  enableModule,
  disableModule,
  incrementAggregateEventCounter,
  listAggregateEventCounters,
  getPreference,
  setPreference,
  createBackup,
  restoreFromBackup,
  listBackups as dbListBackups,
  deleteBackup,
  getBackupConfig,
  setBackupConfig,
  type BackupMetadata,
  type BackupConfig,
  getAllSharingPreferences,
  getActiveSharingPreferences,
  getSharingConsent,
  recordSharingConsent,
  revokeSharingConsent,
  updateSharingPreference,
  revokeAllSharing,
  deleteAllSharingPreferences,
  deleteAllData,
  deleteModuleData,
  getModuleTableStats,
  CLOUD_STORAGE_MODULES,
  type ModuleDeletionResult,
  hasActiveHealthConsent,
  recordHealthConsent,
  withdrawHealthConsent,
  listAllHealthConsents,
  type SharingPreferenceView,
  type SharingConsent as SharingConsentType,
  type HealthConsent,
} from '@mylife/db';
import { exportAllModules, type HubExportData } from '@mylife/db/src/export';
import {
  createWebBackupOps,
  readBackupFile,
  saveUploadedBackup,
} from '@/lib/backup';
import type { Entitlements, PlanMode } from '@mylife/entitlements';
import {
  isWebSupportedModuleId,
  isWebVisibleModuleId,
  WEB_VISIBLE_MODULE_IDS,
} from '@/lib/modules';
import {
  MODULE_METADATA,
  aggregateDashboardData,
  aggregateActivityFeed,
  aggregateTodayCards,
  getDismissedCardIds,
  dismissCardToday,
  type ModuleId,
  type ModuleSummary,
  type ActivityItem,
  type TodayCard,
  type ModuleDefinition,
} from '@mylife/module-registry';
import { BOOKS_MODULE } from '@mylife/books';
import { BUDGET_MODULE } from '@mylife/budget';
import { HABITS_MODULE } from '@mylife/habits';
import { MEDS_MODULE } from '@mylife/meds';
import { WORKOUTS_MODULE } from '@mylife/workouts';
import { HOMES_MODULE } from '@mylife/homes';
import { JOURNAL_MODULE } from '@mylife/journal';
import { RSVP_MODULE } from '@mylife/rsvp';
import { TRAILS_MODULE } from '@mylife/trails';
import { HEALTH_MODULE } from '@mylife/health';
import { NUTRITION_MODULE } from '@mylife/nutrition';
// Dining + Manhattan definitions are imported by relative path, matching
// components/Providers.tsx: their package barrels are not web deps.
import { DINING_MODULE } from '../../../modules/dining/src/definition';
import { MANHATTAN_MODULE } from '../../../modules/manhattan/src/definition';

export type SelfHostConnectionMethod =
  | 'port_forward_tls'
  | 'dynamic_dns'
  | 'outbound_tunnel';

const SELF_HOST_CONNECTION_METHOD_KEY = 'self_host.connection_method';
const DEFAULT_SELF_HOST_CONNECTION_METHOD: SelfHostConnectionMethod = 'port_forward_tls';
const WEB_MODULE_BOOTSTRAP_PREF_KEY = 'web.bootstrap.enabled_modules.v5';

/** Get all enabled module IDs from SQLite. */
export async function getEnabledModuleIds(): Promise<string[]> {
  const db = getAdapter();
  const enabledIds = getEnabledModules(db)
    .map((row) => row.module_id)
    .filter(
      (moduleId): moduleId is ModuleId =>
        isWebSupportedModuleId(moduleId) && isWebVisibleModuleId(moduleId),
    );

  // One-time bootstrap for fresh/legacy DBs and older web installs.
  const bootstrapState = getPreference(db, WEB_MODULE_BOOTSTRAP_PREF_KEY);
  if (bootstrapState === '1') {
    return enabledIds;
  }

  const hasOnlyLegacyBooks = enabledIds.length === 1 && enabledIds[0] === 'books';
  const shouldBootstrapAll = enabledIds.length === 0 || hasOnlyLegacyBooks;
  const modulesToEnable = shouldBootstrapAll
    ? [...WEB_VISIBLE_MODULE_IDS]
    : WEB_VISIBLE_MODULE_IDS.filter((moduleId) => !enabledIds.includes(moduleId));

  if (modulesToEnable.length === 0) {
    setPreference(db, WEB_MODULE_BOOTSTRAP_PREF_KEY, '1');
    return enabledIds;
  }

  for (const moduleId of modulesToEnable) {
    enableModule(db, moduleId);
    ensureModuleMigrations(moduleId);
  }
  setPreference(db, WEB_MODULE_BOOTSTRAP_PREF_KEY, '1');

  const mergedEnabled = new Set<string>([...enabledIds, ...modulesToEnable]);
  return WEB_VISIBLE_MODULE_IDS.filter((moduleId) => mergedEnabled.has(moduleId));
}

/** Enable a module: persist to SQLite, run migrations. */
export async function enableModuleAction(moduleId: string): Promise<void> {
  if (!isWebSupportedModuleId(moduleId) || !isWebVisibleModuleId(moduleId)) return;
  const db = getAdapter();
  enableModule(db, moduleId);
  ensureModuleMigrations(moduleId);
}

/** Disable a module: remove from SQLite. */
export async function disableModuleAction(moduleId: string): Promise<void> {
  const db = getAdapter();
  disableModule(db, moduleId);
}

/** Get currently selected runtime mode and optional custom server URL. */
export async function getModeConfigAction(): Promise<{
  mode: PlanMode;
  serverUrl: string | null;
}> {
  return getModeConfig();
}

/** Persist mode selection and optional custom server URL. */
export async function setModeConfigAction(
  mode: PlanMode,
  serverUrl?: string | null,
): Promise<void> {
  saveModeConfig(mode, serverUrl ?? null);
  incrementAggregateEventCounter(getAdapter(), `mode_selected:${mode}`);
}

/** Return cached entitlement payload if one exists. */
export async function getStoredEntitlementAction(): Promise<Entitlements | null> {
  return getStoredEntitlement();
}

/** Refresh entitlement state from configured hosted/self-host endpoint. */
export async function refreshStoredEntitlementAction(): Promise<{
  ok: boolean;
  message: string;
}> {
  const resolved = resolveCurrentApiBaseUrl();
  if (!resolved.ok || !resolved.url) {
    return {
      ok: false,
      message: `No sync endpoint is configured for the current mode (${resolved.reason ?? 'unknown'}).`,
    };
  }

  const syncKey = process.env.MYLIFE_ENTITLEMENT_SYNC_KEY;
  let response: Response;
  try {
    response = await fetch(`${resolved.url}/api/entitlements/sync`, {
      method: 'GET',
      headers: syncKey
        ? {
            'x-entitlement-sync-key': syncKey,
          }
        : undefined,
      cache: 'no-store',
    });
  } catch {
    return {
      ok: false,
      message: 'Sync request failed. Check network connectivity and endpoint availability.',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      message: `Sync failed with HTTP ${response.status}.`,
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      message: 'Sync response was not valid JSON.',
    };
  }

  const token = (body as { token?: unknown })?.token;
  const entitlements = (body as { entitlements?: unknown })?.entitlements;
  if (typeof token !== 'string' || entitlements === undefined) {
    return {
      ok: false,
      message: 'Sync response is missing token or entitlements.',
    };
  }

  const saved = await saveEntitlement(token, entitlements);
  if (!saved.ok) {
    return {
      ok: false,
      message: `Entitlement save failed: ${saved.reason}.`,
    };
  }

  return {
    ok: true,
    message: 'Entitlement refreshed successfully.',
  };
}


/** Run connectivity checks for a self-host endpoint from the server runtime. */
export async function testSelfHostConnectionAction(
  serverUrl: string,
): Promise<SelfHostConnectionResult> {
  return testSelfHostConnection(serverUrl);
}

/** Record a privacy-safe operational counter (no user content, no user IDs). */
export async function recordOperationalEventAction(
  eventKey: 'setup_completed:self_host' | 'setup_completed:mode_switch',
): Promise<void> {
  incrementAggregateEventCounter(getAdapter(), eventKey);
}

/** Read preferred self-host connectivity method selection. */
export async function getSelfHostConnectionMethodAction(): Promise<SelfHostConnectionMethod> {
  const raw = getPreference(getAdapter(), SELF_HOST_CONNECTION_METHOD_KEY);
  if (
    raw === 'port_forward_tls'
    || raw === 'dynamic_dns'
    || raw === 'outbound_tunnel'
  ) {
    return raw;
  }

  return DEFAULT_SELF_HOST_CONNECTION_METHOD;
}

/** Persist preferred self-host connectivity method selection. */
export async function setSelfHostConnectionMethodAction(
  method: SelfHostConnectionMethod,
): Promise<void> {
  setPreference(getAdapter(), SELF_HOST_CONNECTION_METHOD_KEY, method);
}

/** Read aggregate operational counters for diagnostics/ops dashboards. */
export async function listOperationalCountersAction(input?: {
  prefix?: string;
  bucketDate?: string;
  limit?: number;
}) {
  return listAggregateEventCounters(getAdapter(), {
    eventKeyPrefix: input?.prefix,
    bucketDate: input?.bucketDate,
    limit: input?.limit,
  });
}

// ---------------------------------------------------------------------------
// Backup actions
// ---------------------------------------------------------------------------

/** Create a manual backup. */
export async function createBackupAction(label?: string): Promise<BackupMetadata> {
  const db = getAdapter();
  const ops = createWebBackupOps();
  const result = await createBackup(db, ops, {
    type: 'manual',
    label: label ?? 'Manual backup',
  });
  return result.backup;
}

/** Create an automatic backup (called by the auto-backup scheduler). */
export async function createAutoBackupAction(): Promise<BackupMetadata | null> {
  const db = getAdapter();
  const config = getBackupConfig(db);
  if (!config.autoEnabled) return null;

  const existing = dbListBackups(db).filter((b) => b.type === 'auto');
  if (existing.length > 0) {
    const lastTime = new Date(existing[0]!.createdAt).getTime();
    if (Date.now() - lastTime < 24 * 60 * 60 * 1000) return null;
  }

  const ops = createWebBackupOps();
  const result = await createBackup(db, ops, { type: 'auto' });
  return result.backup;
}

/** List all backups, most recent first. */
export async function listBackupsAction(): Promise<BackupMetadata[]> {
  return dbListBackups(getAdapter());
}

/** Delete a backup by ID. */
export async function deleteBackupAction(backupId: string): Promise<boolean> {
  const ops = createWebBackupOps();
  return deleteBackup(getAdapter(), ops, backupId);
}

/** Restore from a backup by ID. */
export async function restoreFromBackupAction(backupId: string): Promise<{
  ok: boolean;
  message: string;
}> {
  try {
    const db = getAdapter();
    const ops = createWebBackupOps();
    const result = await restoreFromBackup(db, ops, backupId);
    return {
      ok: true,
      message: `Restored from backup (${result.moduleCount} modules). Reload the page to apply.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Get backup configuration. */
export async function getBackupConfigAction(): Promise<BackupConfig> {
  return getBackupConfig(getAdapter());
}

/** Update backup configuration. */
export async function setBackupConfigAction(
  config: Partial<BackupConfig>,
): Promise<BackupConfig> {
  return setBackupConfig(getAdapter(), config);
}

/** Export a backup file as a base64-encoded string for download. */
export async function exportBackupFileAction(backupId: string): Promise<{
  ok: boolean;
  data?: string;
  filename?: string;
  message?: string;
}> {
  const db = getAdapter();
  const backups = dbListBackups(db);
  const backup = backups.find((b) => b.id === backupId);
  if (!backup) {
    return { ok: false, message: 'Backup not found' };
  }

  const buf = readBackupFile(backup.filePath);
  if (!buf) {
    return { ok: false, message: 'Backup file missing from disk' };
  }

  const dateStr = new Date(backup.createdAt)
    .toISOString()
    .slice(0, 10);
  return {
    ok: true,
    data: buf.toString('base64'),
    filename: `mylife-backup-${dateStr}.sqlite`,
  };
}

/** Upload and restore from a backup file. */
export async function uploadAndRestoreAction(
  base64Data: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const buf = Buffer.from(base64Data, 'base64');

    // Quick SQLite header check
    const header = buf.toString('ascii', 0, 16);
    if (!header.startsWith('SQLite format 3')) {
      return { ok: false, message: 'Invalid file: not a SQLite database' };
    }

    const id = `upload-${Date.now()}`;
    const filePath = saveUploadedBackup(id, buf);

    const db = getAdapter();
    const ops = createWebBackupOps();

    // Record the upload in the backups table
    db.execute(
      `INSERT INTO hub_backups (id, size_bytes, module_count, label, backup_type, file_path)
       VALUES (?, ?, 0, ?, 'manual', ?)`,
      [id, buf.length, 'Uploaded restore point', filePath],
    );

    await restoreFromBackup(db, ops, id);
    return {
      ok: true,
      message: 'Database restored from uploaded file. Reload the page to apply.',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Sharing actions
// ---------------------------------------------------------------------------

/** Get sharing consent status. */
export async function getSharingConsentAction(): Promise<SharingConsentType> {
  return getSharingConsent(getAdapter());
}

/** Record initial sharing consent. */
export async function recordSharingConsentAction(): Promise<void> {
  recordSharingConsent(getAdapter());
}

/** Revoke sharing consent and disable all sharing. */
export async function revokeSharingConsentAction(): Promise<void> {
  revokeSharingConsent(getAdapter());
}

/** Get all sharing preferences. */
export async function getAllSharingPreferencesAction(): Promise<SharingPreferenceView[]> {
  return getAllSharingPreferences(getAdapter());
}

/** Get count of actively shared data types. */
export async function getActiveSharingCountAction(): Promise<number> {
  return getActiveSharingPreferences(getAdapter()).length;
}

/** Toggle a sharing preference. */
export async function updateSharingPreferenceAction(
  moduleId: string,
  dataType: string,
  shared: boolean,
): Promise<void> {
  updateSharingPreference(getAdapter(), { moduleId, dataType, shared });
}

/** Disable all sharing. */
export async function revokeAllSharingAction(): Promise<number> {
  return revokeAllSharing(getAdapter());
}

/** Delete all sharing preferences and revoke consent. */
export async function deleteAllSharingAction(): Promise<void> {
  const db = getAdapter();
  deleteAllSharingPreferences(db);
  revokeSharingConsent(db);
}

// ---------------------------------------------------------------------------
// Dashboard aggregation actions
// ---------------------------------------------------------------------------

/** Modules that implement crossModule and can provide dashboard summaries. */
const DASHBOARD_MODULES = [
  BOOKS_MODULE,
  BUDGET_MODULE,
  HABITS_MODULE,
  MEDS_MODULE,
  WORKOUTS_MODULE,
];

/**
 * Modules that implement getTodayCards and can be imported safely into a web
 * server-action module graph. This is the Today dashboard's source roster:
 * a module missing here can never surface a Today card on web, even when
 * enabled, so add new getTodayCards implementers to this list.
 */
const TODAY_MODULES: ModuleDefinition[] = [
  HEALTH_MODULE,
  JOURNAL_MODULE,
  HOMES_MODULE,
  BUDGET_MODULE,
  RSVP_MODULE,
  TRAILS_MODULE,
  BOOKS_MODULE,
  WORKOUTS_MODULE,
  NUTRITION_MODULE,
  DINING_MODULE,
  MEDS_MODULE,
  MANHATTAN_MODULE,
];

const DEFAULT_PRIMARY_CLUSTERS = [
  'body',
  'mind',
  'home',
  'money',
  'social',
  'outdoor',
  'knowledge',
];

/** Read primary clusters from hub_preferences. Falls back to all seven. */
function readPrimaryClusters(db: ReturnType<typeof getAdapter>): string[] {
  const raw = getPreference(db, 'today.primary_clusters');
  if (!raw) return DEFAULT_PRIMARY_CLUSTERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string')) {
      return parsed;
    }
  } catch {
    /* fall through to default */
  }
  return DEFAULT_PRIMARY_CLUSTERS;
}

/** Fetch ranked Today cards contributed by every enabled TODAY_MODULES member. */
export async function fetchTodayCards(): Promise<TodayCard[]> {
  const db = getAdapter();
  const enabledIds = new Set(
    getEnabledModules(db).map((row) => row.module_id),
  );
  const enabledModules = TODAY_MODULES.filter((m) => enabledIds.has(m.id));
  for (const mod of enabledModules) {
    try {
      ensureModuleMigrations(mod.id);
    } catch {
      /* skip module whose migration fails; aggregateTodayCards also isolates errors */
    }
  }
  const now = new Date();
  const primaryClusters = readPrimaryClusters(db);
  const dismissedIds = getDismissedCardIds(db, now);
  return aggregateTodayCards(db, enabledModules, {
    now,
    primaryClusters,
    dismissedIds,
  });
}

/** Dismiss a Today card for the rest of today. */
export async function dismissTodayCardAction(cardId: string): Promise<void> {
  const db = getAdapter();
  dismissCardToday(db, cardId, new Date());
  revalidatePath('/');
}

/** Fetch the set of enabled module ids so the Today surface can filter quick actions. */
export async function fetchEnabledModuleIds(): Promise<string[]> {
  const db = getAdapter();
  return getEnabledModules(db).map((row) => row.module_id);
}

/** Read the user's primary clusters (for QuickActions rendering). */
export async function fetchPrimaryClusters(): Promise<string[]> {
  const db = getAdapter();
  return readPrimaryClusters(db);
}

/**
 * Persist the user's primary clusters from the web Today surface. Until now
 * only mobile onboarding could write this preference, which left the web
 * homepage permanently on the all-seven default.
 */
export async function savePrimaryClustersAction(clusters: string[]): Promise<string[]> {
  const valid = clusters.filter((c) => DEFAULT_PRIMARY_CLUSTERS.includes(c));
  const next = valid.length > 0 ? valid : DEFAULT_PRIMARY_CLUSTERS;
  const db = getAdapter();
  setPreference(db, 'today.primary_clusters', JSON.stringify(next));
  revalidatePath('/');
  return next;
}

/** Fetch data summaries from all modules with crossModule interface. */
export async function fetchDashboardSummaries(): Promise<
  Array<{ moduleId: string; summary: ModuleSummary }>
> {
  const db = getAdapter();
  // Ensure migrations for modules we'll query
  for (const mod of DASHBOARD_MODULES) {
    try {
      ensureModuleMigrations(mod.id);
    } catch {
      // Skip modules whose migrations fail
    }
  }
  const results = aggregateDashboardData(DASHBOARD_MODULES, db);
  return Array.from(results.entries()).map(([moduleId, summary]) => ({
    moduleId,
    summary,
  }));
}

/** Fetch recent activity feed from all modules. */
export async function fetchActivityFeed(
  sinceDays = 7,
): Promise<ActivityItem[]> {
  const db = getAdapter();
  for (const mod of DASHBOARD_MODULES) {
    try {
      ensureModuleMigrations(mod.id);
    } catch {
      // Skip
    }
  }
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return aggregateActivityFeed(DASHBOARD_MODULES, db, since).slice(0, 20);
}

// ---------------------------------------------------------------------------
// Privacy Dashboard
// ---------------------------------------------------------------------------

/** Delete all user data across all modules and reset hub state. */
export async function deleteAllDataAction(): Promise<{ tablesDropped: number }> {
  const db = getAdapter();
  return deleteAllData(db);
}

/**
 * Delete all data for a specific module and disable it.
 * R17.1: Deletes all local data. R17.3: Resets schema version.
 * R17.4: Returns hasCloudData flag for cloud modules.
 */
export async function deleteModuleDataAction(
  moduleId: string,
  tablePrefix: string,
): Promise<ModuleDeletionResult> {
  const db = getAdapter();
  return deleteModuleData(db, moduleId, tablePrefix);
}

/** Get row counts for tables matching a module prefix. */
export async function getModuleTableStatsAction(
  tablePrefix: string,
): Promise<{ tableName: string; rowCount: number }[]> {
  const db = getAdapter();
  return getModuleTableStats(db, tablePrefix);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

import {
  ensureSearchTables,
  indexAllModules,
  search as searchIndex,
  searchRecent as searchRecentIndex,
  type SearchResult,
  type SearchOptions,
} from '@mylife/search';

/** Modules that implement getSearchableContent. */
const SEARCHABLE_MODULES = [
  BOOKS_MODULE,
  BUDGET_MODULE,
  HABITS_MODULE,
  MEDS_MODULE,
  WORKOUTS_MODULE,
];

/** Ensure search index is populated. Called once on first search. */
export async function ensureSearchIndexAction(): Promise<void> {
  const db = getAdapter();
  ensureSearchTables(db);
  for (const mod of SEARCHABLE_MODULES) {
    try {
      ensureModuleMigrations(mod.id);
    } catch {
      // Skip modules whose migrations fail
    }
  }
  indexAllModules(db, SEARCHABLE_MODULES);
}

/** Search across all modules. */
export async function searchAction(
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  const db = getAdapter();
  ensureSearchTables(db);
  return searchIndex(db, query, options);
}

/** Get recent items across all modules (for empty query state). */
export async function searchRecentAction(
  options?: SearchOptions,
): Promise<SearchResult[]> {
  const db = getAdapter();
  ensureSearchTables(db);
  return searchRecentIndex(db, options);
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

import {
  OnboardingMachine,
  SqliteOnboardingStore,
  type OnboardingState,
} from '@mylife/onboarding';

function getOnboardingMachine() {
  const db = getAdapter();
  const store = new SqliteOnboardingStore(db);
  return new OnboardingMachine(store);
}

/** Check if onboarding has been completed. */
export async function isOnboardingCompleteAction(): Promise<boolean> {
  return getOnboardingMachine().isComplete();
}

/** Get the full onboarding state. */
export async function getOnboardingStateAction(): Promise<OnboardingState> {
  return getOnboardingMachine().getState();
}

/** Advance to the next onboarding step. */
export async function onboardingNextAction(): Promise<OnboardingState> {
  return getOnboardingMachine().next();
}

/** Skip the current onboarding step. */
export async function onboardingSkipAction(): Promise<OnboardingState> {
  return getOnboardingMachine().skip();
}

/** Go back to the previous onboarding step. */
export async function onboardingBackAction(): Promise<OnboardingState> {
  return getOnboardingMachine().back();
}

/** Update content preferences. */
export async function onboardingSetPrefsAction(
  prefs: Record<string, unknown>,
): Promise<OnboardingState> {
  const machine = getOnboardingMachine();
  machine.setContentPrefs(prefs);
  return machine.getState();
}

/** Set selected modules. */
export async function onboardingSetModulesAction(
  moduleIds: string[],
): Promise<OnboardingState> {
  const machine = getOnboardingMachine();
  machine.setSelectedModules(moduleIds);
  return machine.getState();
}

// ---------------------------------------------------------------------------
// Health data consent
// ---------------------------------------------------------------------------

/** Check if a module has active (non-withdrawn) health data consent. */
export async function hasActiveHealthConsentAction(
  moduleId: string,
): Promise<boolean> {
  const db = getAdapter();
  return hasActiveHealthConsent(db, moduleId);
}

/** Record affirmative health data consent for a module. */
export async function recordHealthConsentAction(
  moduleId: string,
  dataTypes: string[],
): Promise<void> {
  const db = getAdapter();
  recordHealthConsent(db, moduleId, dataTypes);
}

/** Withdraw health data consent for a module. */
export async function withdrawHealthConsentAction(
  moduleId: string,
): Promise<void> {
  const db = getAdapter();
  withdrawHealthConsent(db, moduleId);
}

/** List all health consent records. */
export async function listAllHealthConsentsAction(): Promise<HealthConsent[]> {
  const db = getAdapter();
  return listAllHealthConsents(db);
}

// ---------------------------------------------------------------------------
// Module lock actions
// ---------------------------------------------------------------------------

import {
  getModuleLock,
  getAllModuleLocks,
  enableModuleLock,
  disableModuleLock,
  verifyPin as verifyLockPin,
  resetLockFailedAttempts,
  incrementLockFailedAttempts,
  setLockLockedUntil,
  checkLockout,
  computeLockedUntil,
  LOCKOUT_MAX_ATTEMPTS,
} from '../../../packages/auth/src/module-lock';
import type { ModuleLockRow } from '../../../packages/auth/src/types';

/** Check if a module has an active lock. */
export async function isModuleLockedAction(moduleId: string): Promise<boolean> {
  const db = getAdapter();
  return getModuleLock(db, moduleId) !== null;
}

/** Get all module locks for the settings page. */
export async function getAllModuleLocksAction(): Promise<ModuleLockRow[]> {
  const db = getAdapter();
  return getAllModuleLocks(db);
}

/** Enable lock for a module with a PIN. */
export async function enableModuleLockAction(
  moduleId: string,
  pin: string,
): Promise<void> {
  const db = getAdapter();
  await enableModuleLock(db, moduleId, pin);
}

/** Disable lock for a module after PIN verification. */
export async function disableModuleLockAction(
  moduleId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = getAdapter();
  const lock = getModuleLock(db, moduleId);
  if (!lock) return { ok: true };

  const valid = await verifyLockPin(pin, lock.salt, lock.pinHash);
  if (!valid) return { ok: false, error: 'Incorrect PIN.' };

  disableModuleLock(db, moduleId);
  return { ok: true };
}

/** Verify PIN for a module lock (used to unlock module content). */
export async function verifyModuleLockPinAction(
  moduleId: string,
  pin: string,
): Promise<{ ok: boolean; error?: string; locked?: boolean; remainingSeconds?: number }> {
  const db = getAdapter();
  const lock = getModuleLock(db, moduleId);
  if (!lock) return { ok: true };

  // Check existing lockout
  const lockout = checkLockout(lock.failedAttempts, lock.lockedUntil);
  if (lockout.isLocked) {
    return {
      ok: false,
      locked: true,
      remainingSeconds: Math.ceil(lockout.remainingMs / 1000),
      error: 'Too many attempts. Try again later.',
    };
  }

  const valid = await verifyLockPin(pin, lock.salt, lock.pinHash);
  if (valid) {
    resetLockFailedAttempts(db, moduleId);
    return { ok: true };
  }

  const failCount = incrementLockFailedAttempts(db, moduleId);
  if (failCount >= LOCKOUT_MAX_ATTEMPTS) {
    const lockedUntil = computeLockedUntil();
    setLockLockedUntil(db, moduleId, lockedUntil);
    return {
      ok: false,
      locked: true,
      remainingSeconds: 60,
      error: 'Too many attempts.',
    };
  }

  return { ok: false, error: `Incorrect PIN (${failCount} of ${LOCKOUT_MAX_ATTEMPTS}).` };
}

// ---------------------------------------------------------------------------
// Data Export
// ---------------------------------------------------------------------------

/** Export all enabled module data as a JSON object. */
export async function exportAllModulesAction(): Promise<HubExportData> {
  const db = getAdapter();
  const enabledIds = getEnabledModules(db)
    .map((row) => row.module_id)
    .filter(isWebSupportedModuleId);

  const modules: { id: string; tablePrefix?: string }[] = [];
  for (const id of enabledIds) {
    const def = MODULE_METADATA[id as keyof typeof MODULE_METADATA];
    if (def) modules.push({ id: def.id, tablePrefix: def.tablePrefix });
  }

  return exportAllModules(db, modules);
}

// ---------------------------------------------------------------------------
// Goal-based onboarding (Phase 3b)
// ---------------------------------------------------------------------------

const ONBOARDING_PLEDGE_KEY = 'onboarding.pledge_accepted_at';
const ONBOARDING_COMPLETED_KEY = 'onboarding.completed_at';
const PRIMARY_CLUSTERS_KEY = 'today.primary_clusters';

const VALID_CLUSTERS = new Set([
  'body',
  'mind',
  'home',
  'money',
  'social',
  'outdoor',
  'knowledge',
]);

/** Cluster → first-action route used by {@link completeOnboardingAction}. */
const CLUSTER_FIRST_ACTION_ROUTE: Record<string, string> = {
  body: '/mood/log',
  mind: '/journal/new',
  home: '/',
  money: '/budget/transaction/new',
  social: '/',
  outdoor: '/',
  knowledge: '/books/search',
};

/**
 * Routes from CLUSTER_FIRST_ACTION_ROUTE that actually exist in the web app.
 * Any missing route falls back to '/' so we never surface a 404.
 */
const KNOWN_ROUTES = new Set(['/mood/log', '/books/search', '/']);

function resolveFirstActionRoute(clusters: string[]): string {
  const first = clusters.find((c) => VALID_CLUSTERS.has(c));
  if (!first) return '/';
  const target = CLUSTER_FIRST_ACTION_ROUTE[first] ?? '/';
  return KNOWN_ROUTES.has(target) ? target : '/';
}

/** Record that the user accepted the privacy pledge. */
export async function acceptPledgeAction(): Promise<void> {
  const db = getAdapter();
  setPreference(db, ONBOARDING_PLEDGE_KEY, new Date().toISOString());
}

/** Persist the user's selected primary clusters (1-3 from the 7 goals). */
export async function selectGoalsAction(clusters: string[]): Promise<void> {
  const filtered = clusters.filter((c) => VALID_CLUSTERS.has(c));
  if (filtered.length === 0) return;
  const db = getAdapter();
  setPreference(db, PRIMARY_CLUSTERS_KEY, JSON.stringify(filtered.slice(0, 3)));
}

/**
 * Enable selected modules, mark onboarding complete, and return a redirect URL
 * based on the user's first selected cluster. Missing target routes fall back
 * to the Today surface.
 */
export async function completeOnboardingAction(input: {
  clusters: string[];
  enabledModuleIds: string[];
}): Promise<{ redirectTo: string }> {
  const db = getAdapter();
  for (const moduleId of input.enabledModuleIds) {
    if (!isWebSupportedModuleId(moduleId) || !isWebVisibleModuleId(moduleId)) continue;
    enableModule(db, moduleId);
    try {
      ensureModuleMigrations(moduleId);
    } catch {
      // A single module's migrations failing must not block onboarding completion.
    }
  }
  setPreference(db, ONBOARDING_COMPLETED_KEY, new Date().toISOString());
  return { redirectTo: resolveFirstActionRoute(input.clusters) };
}

/** True once the user has completed the goal-based onboarding flow. */
export async function fetchOnboardingCompleted(): Promise<boolean> {
  const db = getAdapter();
  return typeof getPreference(db, ONBOARDING_COMPLETED_KEY) === 'string';
}

// ---------------------------------------------------------------------------
// Automations (Phase 5-core)
// ---------------------------------------------------------------------------

import {
  listRules,
  registerRule,
  logAutomationEvent,
} from '@mylife/automations';
import {
  receiptToBudgetRule,
  type ReceiptToBudgetInput,
  type ReceiptToBudgetResult,
} from '@mylife/budget';
import type { BudgetTransactionInsert } from '@mylife/budget';

let automationRulesRegistered = false;

/**
 * Ensure the in-process automation registry contains the receipt-to-budget
 * rule before any listRules() / getRule() call. Idempotent across request
 * boundaries so repeated server-action invocations are safe.
 */
function ensureAutomationRulesRegistered(): void {
  if (automationRulesRegistered) return;
  try {
    registerRule(receiptToBudgetRule);
  } catch (err) {
    // Another concurrent request may have registered it already. Only ignore
    // the "already registered" case; surface anything else loudly.
    if (!(err instanceof Error) || !err.message.includes('already registered')) {
      throw err;
    }
  }
  automationRulesRegistered = true;
}

interface AutomationRuleRow {
  id: string;
  enabled: number;
}

/** List all registered automation rules joined with their enabled state. */
export async function listAutomationRulesAction(): Promise<Array<{
  id: string;
  label: string;
  description: string;
  clusters: string[];
  enabled: boolean;
}>> {
  ensureAutomationRulesRegistered();
  const db = getAdapter();
  const rules = listRules();
  const rows = db.query<AutomationRuleRow>(
    `SELECT id, enabled FROM hub_automation_rules`,
  );
  const byId = new Map(rows.map((r) => [r.id, r.enabled === 1]));
  return rules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    description: rule.description,
    clusters: rule.clusters,
    enabled: byId.get(rule.id) ?? false,
  }));
}

/** Persist enabled state for a rule. Upserts into hub_automation_rules. */
export async function toggleAutomationRuleAction(
  ruleId: string,
  enabled: boolean,
): Promise<void> {
  ensureAutomationRulesRegistered();
  const db = getAdapter();
  db.execute(
    `INSERT INTO hub_automation_rules (id, enabled, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = datetime('now')`,
    [ruleId, enabled ? 1 : 0],
  );
  revalidatePath('/settings/automations');
}

/** Read the enabled flag for a single rule. */
export async function isAutomationRuleEnabledAction(
  ruleId: string,
): Promise<boolean> {
  ensureAutomationRulesRegistered();
  const db = getAdapter();
  const rows = db.query<AutomationRuleRow>(
    `SELECT id, enabled FROM hub_automation_rules WHERE id = ?`,
    [ruleId],
  );
  return rows[0]?.enabled === 1;
}

/**
 * Run the receipt-to-budget rule. The rule itself wraps writes in
 * db.transaction(), so we do not wrap again here. Failure surfaces the
 * error message to the caller and writes an 'error' audit entry (best
 * effort — a logging failure does not mask the original error).
 */
export async function applyReceiptToBudgetAction(input: {
  photoUri: string;
  photoMime: string;
  transactionDraft: BudgetTransactionInsert;
}): Promise<
  | { ok: true; transactionId: string; attachmentId: string }
  | { ok: false; error: string }
> {
  ensureAutomationRulesRegistered();
  const db = getAdapter();
  try {
    ensureModuleMigrations('budget');
  } catch {
    // Migration failures are surfaced by the rule call below.
  }
  const ruleInput: ReceiptToBudgetInput = {
    photoUri: input.photoUri,
    photoMime: input.photoMime,
    transactionDraft: input.transactionDraft,
  };
  const state = receiptToBudgetRule.check(db, ruleInput);
  if (!state) {
    return { ok: false, error: 'Receipt preview state could not be built.' };
  }
  try {
    const result = receiptToBudgetRule.apply(db, state) as ReceiptToBudgetResult;
    return {
      ok: true,
      transactionId: result.transactionId,
      attachmentId: result.attachmentId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      logAutomationEvent(db, {
        ruleId: receiptToBudgetRule.id,
        outcome: 'error',
        error: message,
      });
    } catch {
      // Log-write failures must not mask the original error.
    }
    return { ok: false, error: message };
  }
}

/** Record that the user dismissed a rule preview. */
export async function dismissAutomationAction(ruleId: string): Promise<void> {
  ensureAutomationRulesRegistered();
  const db = getAdapter();
  logAutomationEvent(db, { ruleId, outcome: 'dismissed' });
}

// ---------------------------------------------------------------------------
// Insights (Phase 4a)
// ---------------------------------------------------------------------------

import {
  getPermittedModules,
  queryCorrelation,
  queryTrends,
  discoverInsights,
  type CorrelationResult,
  type TrendResult,
  type InsightCard,
} from '@mylife/intelligence';

/**
 * Modules the Insights screen can query. Mirrors DASHBOARD_MODULES plus any
 * other module that exposes `crossModule.getCorrelationData`. Kept small and
 * explicit so the Insights surface cannot accidentally leak data from a
 * module whose schema is not yet migrated on the web.
 */
const INSIGHTS_MODULES: ModuleDefinition[] = [
  BOOKS_MODULE,
  BUDGET_MODULE,
  HABITS_MODULE,
  MEDS_MODULE,
  WORKOUTS_MODULE,
  NUTRITION_MODULE,
];

interface InsightsMetaModule {
  id: string;
  name: string;
  series: Array<{ metric: string; label: string; unit: string }>;
}

interface InsightsBootstrap {
  hasAIPermission: boolean;
  modules: InsightsMetaModule[];
  discoveries: InsightCard[];
}

/** Fetch AI permission state, available modules (w/ metric labels), and discovery cards. */
export async function fetchInsightsAction(): Promise<InsightsBootstrap> {
  const db = getAdapter();
  const permitted = new Set(getPermittedModules(db));
  if (permitted.size === 0) {
    return { hasAIPermission: false, modules: [], discoveries: [] };
  }
  for (const mod of INSIGHTS_MODULES) {
    try {
      ensureModuleMigrations(mod.id);
    } catch {
      // Isolated: a single module's migration failure must not kill Insights.
    }
  }
  const modules: InsightsMetaModule[] = [];
  for (const mod of INSIGHTS_MODULES) {
    if (!permitted.has(mod.id)) continue;
    const get = mod.crossModule?.getCorrelationData;
    if (!get) continue;
    try {
      const dataset = get(db);
      modules.push({
        id: mod.id,
        name: mod.name,
        series: dataset.series.map((s) => ({
          metric: s.metric,
          label: s.label,
          unit: s.unit,
        })),
      });
    } catch {
      // Module failed to produce a dataset; skip quietly to avoid blocking
      // the whole Insights screen on one module's data error.
    }
  }
  const discoveries = discoverInsights(db, INSIGHTS_MODULES);
  return { hasAIPermission: true, modules, discoveries };
}

/** Run a pairwise correlation between two modules using the on-device engine. */
export async function fetchCorrelationAction(
  moduleAId: string,
  moduleBId: string,
): Promise<CorrelationResult[]> {
  const db = getAdapter();
  return queryCorrelation(db, INSIGHTS_MODULES, moduleAId, moduleBId);
}

/** Fetch a 30-day trend series for a specific module/metric. */
export async function fetchTrendsAction(
  moduleId: string,
  metric: string,
): Promise<TrendResult | null> {
  const db = getAdapter();
  return queryTrends(db, INSIGHTS_MODULES, moduleId, metric, 30);
}
