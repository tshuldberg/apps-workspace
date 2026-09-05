// Storage & Backup view-model core (Plan 41 WP-41B3). A pure, platform-neutral
// mapping from the real recorded read model (buildStorageDiagnostics over the
// mk_storage_* rows) + registry support into the sections the Storage & Backup
// screens render. It never invents durability, quota, or verification: every
// value here is folded from a persisted row, and any state that is not proven
// (a backup that is not `complete`, a destination that is not `ready`) is
// surfaced as its true, un-upgraded state (NC-41.2, NC-41.4, AC-41.4).
//
// This file is a BYTE-IDENTICAL twin across mobile and web (header comment
// aside). Both surfaces and the section tests consume it, so a copy or logic
// change on one surface cannot silently diverge from the other.

import type {
  StorageBackupDiagnostic,
  StorageDestinationDiagnostic,
  StorageDiagnostics,
  StorageDiagnosticIssueKind,
  StorageJobProgressDiagnostic,
  StoragePolicyDiagnostic,
} from '@mylife/sync/src/storage/diagnostics';
import type {
  StorageBackupState,
  StorageJobKind,
  StorageJobState,
} from '@mylife/sync/src/storage/schema';
import type { StorageDestinationKind } from '@mylife/sync/src/storage/types';
import type {
  RestoreControllerState,
  RestoreFailureReason,
  RestorePlan,
  RestoreStage,
} from '@mylife/sync/src/storage/restore-controller';

// The registry adds one Meerkat-only kind (`web_directory`) on top of the
// eleven shared protocol kinds. The UI catalog is keyed by this superset.
export type StorageUiDestinationKind = StorageDestinationKind | 'web_directory';

// The tone/status a chip carries. `chipTone` maps to a palette color on each
// surface; the tone itself is platform-neutral so the twin stays pure.
export type StorageChipTone = 'ok' | 'warn' | 'danger' | 'muted' | 'info';

// -----------------------------------------------------------------------------
// Destination catalog: what each kind is, and whether it is a native/direct
// connect flow, a token-source flow, a credential form, or platform-native.
// -----------------------------------------------------------------------------

export type StorageConnectFlow =
  | 'local' // immediate, on-device
  | 'native_apple' // iCloud / iOS Files, native module (UNVERIFIED until dev build)
  | 'native_android' // Android Storage Access Framework
  | 'web_directory' // File System Access API directory grant
  | 'oauth_token' // Google / Dropbox / OneDrive / Box, PKCE or broker
  | 'credential_form' // WebDAV / S3, SecureStore-backed
  | 'hosted' // first-party hosted storage
  | 'connected_server'; // signed storage:v1 descriptor

export interface StorageDestinationCatalogEntry {
  kind: StorageUiDestinationKind;
  name: string;
  blurb: string;
  flow: StorageConnectFlow;
  /** True when this kind can only ever be native to one platform family. */
  platformNative: boolean;
}

// Order is intentional: on-device first, then the personal cloud drives, then
// the generic OS/browser folder, then the self-managed endpoints, then hosted.
export const STORAGE_DESTINATION_CATALOG: readonly StorageDestinationCatalogEntry[] = [
  {
    kind: 'local_device',
    name: 'This device',
    blurb: 'Keep an encrypted copy in this app’s own storage. Verified by reading it back.',
    flow: 'local',
    platformNative: false,
  },
  {
    kind: 'icloud_drive',
    name: 'iCloud Drive',
    blurb: 'Automatic encrypted backups in your app’s iCloud container. Apple devices only.',
    flow: 'native_apple',
    platformNative: true,
  },
  {
    kind: 'google_drive',
    name: 'Google Drive',
    blurb: 'Encrypted objects in a Meerkat folder you grant. Meerkat cannot see the rest of your Drive.',
    flow: 'oauth_token',
    platformNative: false,
  },
  {
    kind: 'dropbox',
    name: 'Dropbox',
    blurb: 'Encrypted objects in an app folder Dropbox scopes to Meerkat.',
    flow: 'oauth_token',
    platformNative: false,
  },
  {
    kind: 'onedrive',
    name: 'OneDrive',
    blurb: 'Encrypted objects in a Meerkat folder on your OneDrive.',
    flow: 'oauth_token',
    platformNative: false,
  },
  {
    kind: 'box',
    name: 'Box',
    blurb: 'Encrypted objects in a Meerkat folder on your Box account.',
    flow: 'oauth_token',
    platformNative: false,
  },
  {
    kind: 'file_provider',
    name: 'Files provider',
    blurb: 'A folder you pick through your device’s file system, remembered for future backups.',
    flow: 'native_android',
    platformNative: true,
  },
  {
    kind: 'web_directory',
    name: 'Browser folder',
    blurb: 'A local folder you grant this browser. Persistence depends on the browser keeping the grant.',
    flow: 'web_directory',
    platformNative: true,
  },
  {
    kind: 'webdav',
    name: 'WebDAV',
    blurb: 'Your own WebDAV server over HTTPS. Credentials stay in this device’s secure storage.',
    flow: 'credential_form',
    platformNative: false,
  },
  {
    kind: 's3',
    name: 'S3-compatible',
    blurb: 'Any S3-compatible bucket. Credentials stay in this device’s secure storage.',
    flow: 'credential_form',
    platformNative: false,
  },
  {
    kind: 'hosted_storage',
    name: 'Meerkat hosted storage',
    blurb: 'Paid first-party storage that only ever holds your encrypted objects.',
    flow: 'hosted',
    platformNative: false,
  },
  {
    kind: 'connected_server',
    name: 'Connected server',
    blurb: 'A server you connect that advertises a signed storage capability.',
    flow: 'connected_server',
    platformNative: false,
  },
];

const CATALOG_BY_KIND: ReadonlyMap<StorageUiDestinationKind, StorageDestinationCatalogEntry> =
  new Map(STORAGE_DESTINATION_CATALOG.map((entry) => [entry.kind, entry]));

export function storageCatalogEntry(
  kind: StorageUiDestinationKind,
): StorageDestinationCatalogEntry {
  const entry = CATALOG_BY_KIND.get(kind);
  if (entry === undefined) {
    // A kind the router persisted that the catalog does not know. Render it
    // honestly rather than crashing: the id is the only truthful label we have.
    return {
      kind,
      name: kind,
      blurb: 'This destination kind is not described in this build.',
      flow: 'connected_server',
      platformNative: false,
    };
  }
  return entry;
}

// -----------------------------------------------------------------------------
// Add-destination picker rows. A kind the registry cannot serve on this device
// is NEVER a disabled tease (NC-41.8): it is an explanatory row that says why.
// -----------------------------------------------------------------------------

export interface StorageAddDestinationRow {
  kind: StorageUiDestinationKind;
  name: string;
  blurb: string;
  flow: StorageConnectFlow;
  /** True when the registry can build an adapter for this kind on this device. */
  supported: boolean;
  /** Present only when unsupported: the honest reason, shown instead of a CTA. */
  unavailableReason: string | null;
}

export interface BuildAddDestinationRowsInput {
  /** registry.supports(kind) for the running platform. */
  supports: (kind: StorageUiDestinationKind) => boolean;
  /** 'ios' | 'android' | 'web' | other. Drives the honest unavailable reason. */
  platform: string;
}

function unavailableReason(
  entry: StorageDestinationCatalogEntry,
  platform: string,
): string {
  if (entry.kind === 'icloud_drive') {
    return 'iCloud Drive is available on Apple devices only.';
  }
  if (entry.kind === 'file_provider') {
    return platform === 'web'
      ? 'A file-system folder provider is available in the mobile app.'
      : 'A file provider is not available on this device.';
  }
  if (entry.kind === 'web_directory') {
    return 'A granted browser folder is available in a supported desktop browser.';
  }
  if (entry.flow === 'oauth_token') {
    return 'This provider needs its sign-in to be set up in this build before it can connect.';
  }
  if (entry.kind === 'hosted_storage') {
    return 'Meerkat hosted storage connects once the hosted service is set up for this build.';
  }
  if (entry.kind === 'connected_server') {
    return 'Connect a server that advertises a signed storage capability to enable this.';
  }
  return 'This destination is not available on this device.';
}

export function buildAddDestinationRows(
  input: BuildAddDestinationRowsInput,
): readonly StorageAddDestinationRow[] {
  return STORAGE_DESTINATION_CATALOG.map((entry) => {
    const supported = input.supports(entry.kind);
    return {
      kind: entry.kind,
      name: entry.name,
      blurb: entry.blurb,
      flow: entry.flow,
      supported,
      unavailableReason: supported ? null : unavailableReason(entry, input.platform),
    };
  });
}

// -----------------------------------------------------------------------------
// Destination state chip. Reads destination.state AND its recorded health, and
// resolves to the single most important truth. `revoked`/auth beats degraded
// beats a clean ready. A destination with no health row yet reads as "Checking"
// only if it is otherwise ready; an errored destination never reads ready.
// -----------------------------------------------------------------------------

export type StorageDestinationChipState =
  | 'ready'
  | 'degraded'
  | 'auth_required'
  | 'revoked'
  | 'error'
  | 'authorizing'
  | 'unverified'; // native flow present but not yet proven on a real build

export interface StorageDestinationChip {
  state: StorageDestinationChipState;
  label: string;
  tone: StorageChipTone;
}

const HEALTH_ERROR_HINTS: Readonly<Record<string, string>> = {
  quota_exceeded: 'Storage full',
  destination_unavailable: 'Not available here',
  local_read_back_failed: 'Read-back failed',
  browser_storage_evictable: 'May be cleared by the browser',
  browser_storage_session_only: 'This session only',
};

function chipFor(
  state: StorageDestinationChipState,
  label: string,
  tone: StorageChipTone,
): StorageDestinationChip {
  return { state, label, tone };
}

export function buildDestinationChip(
  destination: StorageDestinationDiagnostic,
): StorageDestinationChip {
  // Revocation and auth are the loudest, actionable truths.
  if (destination.state === 'revoked' || destination.healthState === 'revoked') {
    return chipFor('revoked', 'Reconnect needed', 'danger');
  }
  if (destination.healthState === 'auth_required') {
    return chipFor('auth_required', 'Sign-in needed', 'warn');
  }
  if (destination.state === 'authorizing') {
    return chipFor('authorizing', 'Connecting', 'info');
  }
  if (destination.state === 'error' || destination.healthState === 'unreachable') {
    const hint = destination.healthErrorCode
      ? HEALTH_ERROR_HINTS[destination.healthErrorCode]
      : undefined;
    return chipFor('error', hint ?? 'Not reachable', 'danger');
  }
  if (destination.state === 'degraded' || destination.healthState === 'degraded') {
    const hint = destination.healthErrorCode
      ? HEALTH_ERROR_HINTS[destination.healthErrorCode]
      : undefined;
    return chipFor('degraded', hint ?? 'Degraded', 'warn');
  }
  if (destination.healthState === 'ok' && destination.verifiedReadWrite) {
    return chipFor('ready', 'Ready', 'ok');
  }
  // Ready state persisted, but no successful read/write probe recorded yet. For a
  // native flow that needs a real build, say so honestly rather than "Ready".
  const entry = storageCatalogEntry(destination.kind);
  if (destination.state === 'ready' && destination.healthState === null && entry.platformNative) {
    return chipFor('unverified', 'Not verified yet', 'muted');
  }
  if (destination.state === 'ready') {
    return chipFor('ready', 'Connected', 'ok');
  }
  return chipFor('degraded', 'Checking', 'muted');
}

// -----------------------------------------------------------------------------
// Quota + verification lines. All derived from recorded health/object rows.
// -----------------------------------------------------------------------------

export interface StorageQuotaLine {
  hasQuota: boolean;
  usedBytes: number | null;
  capBytes: number | null;
  /** 0..1 fraction when both used and cap are known, else null. */
  fraction: number | null;
}

export function buildQuotaLine(destination: StorageDestinationDiagnostic): StorageQuotaLine {
  const { usedBytes, capBytes } = destination;
  const fraction = usedBytes !== null && capBytes !== null && capBytes > 0
    ? Math.min(1, Math.max(0, usedBytes / capBytes))
    : null;
  return {
    hasQuota: usedBytes !== null || capBytes !== null,
    usedBytes,
    capBytes,
    fraction,
  };
}

/** The count of objects proven present by read-back or provider checksum. */
export function verifiedObjectCount(destination: StorageDestinationDiagnostic): number {
  return destination.objectCounts.verified;
}

/** Objects the router recorded as missing or errored at this destination. */
export function unhealthyObjectCount(destination: StorageDestinationDiagnostic): number {
  return destination.objectCounts.missing + destination.objectCounts.error;
}

// -----------------------------------------------------------------------------
// Job progress lines. Progress is completed/total OBJECTS and BYTES from the job
// row only. A running write reads "Backing up", a verify "Checking", etc.
// -----------------------------------------------------------------------------

const JOB_KIND_RUNNING_LABEL: Readonly<Record<StorageJobKind, string>> = {
  backup: 'Backing up',
  restore: 'Restoring',
  move: 'Moving',
  mirror: 'Copying to mirror',
  verify: 'Checking',
  delete: 'Removing',
  repair: 'Repairing',
};

const JOB_STATE_LABEL: Readonly<Record<StorageJobState, string>> = {
  queued: 'Queued',
  running: 'Running',
  paused: 'Paused',
  cancelled: 'Cancelled',
  succeeded: 'Done',
  partial: 'Partly done',
  failed: 'Failed',
};

export interface StorageJobLine {
  id: string;
  kind: StorageJobKind;
  title: string;
  stateLabel: string;
  tone: StorageChipTone;
  completedObjects: number;
  totalObjects: number;
  completedBytes: number;
  totalBytes: number;
  /** 0..1 by bytes when total>0, else by objects, else null. */
  fraction: number | null;
  errorCode: string | null;
}

function jobTone(state: StorageJobState): StorageChipTone {
  switch (state) {
    case 'succeeded':
      return 'ok';
    case 'failed':
      return 'danger';
    case 'partial':
      return 'warn';
    case 'paused':
      return 'warn';
    case 'cancelled':
      return 'muted';
    case 'running':
      return 'info';
    case 'queued':
      return 'muted';
  }
}

export function buildJobLine(job: StorageJobProgressDiagnostic): StorageJobLine {
  const fraction = job.totalBytes > 0
    ? Math.min(1, Math.max(0, job.completedBytes / job.totalBytes))
    : job.totalObjects > 0
      ? Math.min(1, Math.max(0, job.completedObjects / job.totalObjects))
      : null;
  return {
    id: job.id,
    kind: job.kind,
    title: JOB_KIND_RUNNING_LABEL[job.kind],
    stateLabel: JOB_STATE_LABEL[job.state],
    tone: jobTone(job.state),
    completedObjects: job.completedObjects,
    totalObjects: job.totalObjects,
    completedBytes: job.completedBytes,
    totalBytes: job.totalBytes,
    fraction,
    errorCode: job.errorCode,
  };
}

// -----------------------------------------------------------------------------
// Backup history lines. State is shown VERBATIM. A non-`complete` backup is
// never presented as done (NC-41.2): "writing" -> "Writing", "verifying" ->
// "Waiting for verification", "corrupt" -> "Corrupt", "deleted" -> "Deleted".
// -----------------------------------------------------------------------------

export interface StorageBackupLine {
  backupId: string;
  destinationId: string;
  state: StorageBackupState;
  stateLabel: string;
  tone: StorageChipTone;
  complete: boolean;
  objectCount: number;
  encryptedBytes: number;
  schemaVersion: number;
  completedAt: string | null;
  /** True only when the backup is `complete`: the only restorable state. */
  restorable: boolean;
}

const BACKUP_STATE_LABEL: Readonly<Record<StorageBackupState, string>> = {
  writing: 'Writing',
  verifying: 'Waiting for verification',
  complete: 'Backed up',
  corrupt: 'Corrupt',
  deleted: 'Deleted',
};

const BACKUP_STATE_TONE: Readonly<Record<StorageBackupState, StorageChipTone>> = {
  writing: 'info',
  verifying: 'warn',
  complete: 'ok',
  corrupt: 'danger',
  deleted: 'muted',
};

export function buildBackupLine(backup: StorageBackupDiagnostic): StorageBackupLine {
  return {
    backupId: backup.backupId,
    destinationId: backup.destinationId,
    state: backup.state,
    stateLabel: BACKUP_STATE_LABEL[backup.state],
    tone: BACKUP_STATE_TONE[backup.state],
    complete: backup.complete,
    objectCount: backup.objectCount,
    encryptedBytes: backup.encryptedBytes,
    schemaVersion: backup.schemaVersion,
    completedAt: backup.completedAt,
    restorable: backup.state === 'complete',
  };
}

// -----------------------------------------------------------------------------
// Issue list. The diagnostics fold already computes issues; this maps them to
// prominent, actionable copy for the hub top.
// -----------------------------------------------------------------------------

export interface StorageIssueLine {
  kind: StorageDiagnosticIssueKind;
  title: string;
  detail: string;
  tone: StorageChipTone;
  count: number;
  destinationIds: readonly string[];
  backupIds: readonly string[];
}

const ISSUE_COPY: Readonly<Record<StorageDiagnosticIssueKind, { title: string; detail: string; tone: StorageChipTone }>> = {
  auth_required: {
    title: 'Reconnect a destination',
    detail: 'A backup destination needs you to sign in again before it can keep a copy.',
    tone: 'warn',
  },
  quota: {
    title: 'A destination is full',
    detail: 'A destination has no room left. Free space there or add another destination.',
    tone: 'danger',
  },
  degraded: {
    title: 'A destination is not healthy',
    detail: 'A destination did not pass its last check. New backups there may not verify.',
    tone: 'warn',
  },
  'unverified-backup': {
    title: 'A backup is not verified',
    detail: 'A backup is still writing or waiting for verification. It is not a restorable copy yet.',
    tone: 'warn',
  },
};

export function buildIssueLines(
  diagnostics: StorageDiagnostics,
): readonly StorageIssueLine[] {
  return diagnostics.issues.map((issue) => {
    const copy = ISSUE_COPY[issue.kind];
    return {
      kind: issue.kind,
      title: copy.title,
      detail: copy.detail,
      tone: copy.tone,
      count: issue.count,
      destinationIds: issue.destinationIds,
      backupIds: issue.backupIds,
    };
  });
}

// -----------------------------------------------------------------------------
// Per-data-class policy summary. Reads the folded policy diagnostics and turns
// each into a plain sentence. The hosted destination is never a preselected
// default (NC-41.7): the policy summary reflects only what the user actually
// chose, and `hasAnyPolicy` gates the empty teaching state.
// -----------------------------------------------------------------------------

export interface StoragePolicyLine {
  dataClass: string;
  label: string;
  primaryLabel: string;
  primaryAvailable: boolean;
  mirrorLabel: string | null;
  mirrorAvailable: boolean;
}

const DATA_CLASS_LABEL: Readonly<Record<string, string>> = {
  encrypted_recovery_bundle: 'Recovery bundle',
  sqlite_snapshot: 'App database',
  attachment: 'Attachments',
  library_object: 'Library files',
  plaintext_download: 'Plain downloads',
};

export function dataClassLabel(dataClass: string): string {
  return DATA_CLASS_LABEL[dataClass] ?? dataClass;
}

function policyDestinationLabel(
  summary: StoragePolicyDiagnostic['primary'],
): string {
  if (summary.state === 'missing') return 'a removed destination';
  return summary.label ?? summary.id;
}

export function buildPolicyLines(
  diagnostics: StorageDiagnostics,
): readonly StoragePolicyLine[] {
  return diagnostics.policies.map((policy): StoragePolicyLine => ({
    dataClass: policy.dataClass,
    label: dataClassLabel(policy.dataClass),
    primaryLabel: policyDestinationLabel(policy.primary),
    primaryAvailable: policy.primary.availableForNewWrites,
    mirrorLabel: policy.mirror === null ? null : policyDestinationLabel(policy.mirror),
    mirrorAvailable: policy.mirror?.availableForNewWrites ?? false,
  }));
}

// -----------------------------------------------------------------------------
// Hub view model: the whole Storage & Backup landing folded in one pass.
// -----------------------------------------------------------------------------

export interface StorageDestinationSummary {
  id: string;
  kind: StorageUiDestinationKind;
  name: string; // catalog name
  label: string; // user/router label
  chip: StorageDestinationChip;
  quota: StorageQuotaLine;
  verifiedObjects: number;
  unhealthyObjects: number;
  lastVerificationAt: string | null;
  runningJobs: readonly StorageJobLine[];
  completeBackupCount: number;
}

export interface StorageHubViewModel {
  hasAnyDestination: boolean;
  hasAnyPolicy: boolean;
  destinations: readonly StorageDestinationSummary[];
  policies: readonly StoragePolicyLine[];
  issues: readonly StorageIssueLine[];
  runningJobs: readonly StorageJobLine[];
  /** Count of destinations with at least one `complete` backup. */
  backedUpDestinationCount: number;
}

export function buildStorageHubViewModel(
  diagnostics: StorageDiagnostics,
): StorageHubViewModel {
  const destinations = diagnostics.destinations.map((destination): StorageDestinationSummary => {
    const entry = storageCatalogEntry(destination.kind);
    const completeBackupCount = destination.backups.filter((backup) => backup.complete).length;
    return {
      id: destination.id,
      kind: destination.kind,
      name: entry.name,
      label: destination.label,
      chip: buildDestinationChip(destination),
      quota: buildQuotaLine(destination),
      verifiedObjects: verifiedObjectCount(destination),
      unhealthyObjects: unhealthyObjectCount(destination),
      lastVerificationAt: destination.lastVerificationAt,
      runningJobs: destination.runningJobs.map(buildJobLine),
      completeBackupCount,
    };
  });
  return {
    hasAnyDestination: destinations.length > 0,
    hasAnyPolicy: diagnostics.policies.length > 0,
    destinations,
    policies: buildPolicyLines(diagnostics),
    issues: buildIssueLines(diagnostics),
    runningJobs: diagnostics.runningJobs.map(buildJobLine),
    backedUpDestinationCount: destinations.filter((d) => d.completeBackupCount > 0).length,
  };
}

// -----------------------------------------------------------------------------
// Detail view model for one destination.
// -----------------------------------------------------------------------------

export interface StorageDestinationDetailViewModel {
  id: string;
  kind: StorageUiDestinationKind;
  name: string;
  label: string;
  blurb: string;
  flow: StorageConnectFlow;
  chip: StorageDestinationChip;
  quota: StorageQuotaLine;
  verifiedObjects: number;
  unhealthyObjects: number;
  totalObjects: number;
  lastVerificationAt: string | null;
  healthCheckedAt: string | null;
  activeJobs: readonly StorageJobLine[];
  backups: readonly StorageBackupLine[];
  /** True when the adapter can delete remote data on revoke (registry-driven). */
  canDeleteRemoteOnRevoke: boolean;
}

export interface BuildDestinationDetailInput {
  diagnostics: StorageDiagnostics;
  destinationId: string;
  /** Whether the resolved adapter supports remote deletion on revoke. */
  supportsRemoteDelete?: boolean;
}

export function buildDestinationDetailViewModel(
  input: BuildDestinationDetailInput,
): StorageDestinationDetailViewModel | null {
  const destination = input.diagnostics.destinations.find(
    (candidate) => candidate.id === input.destinationId,
  );
  if (destination === undefined) return null;
  const entry = storageCatalogEntry(destination.kind);
  return {
    id: destination.id,
    kind: destination.kind,
    name: entry.name,
    label: destination.label,
    blurb: entry.blurb,
    flow: entry.flow,
    chip: buildDestinationChip(destination),
    quota: buildQuotaLine(destination),
    verifiedObjects: verifiedObjectCount(destination),
    unhealthyObjects: unhealthyObjectCount(destination),
    totalObjects: destination.objectCounts.total,
    lastVerificationAt: destination.lastVerificationAt,
    healthCheckedAt: destination.healthCheckedAt,
    activeJobs: destination.activeJobs.map(buildJobLine),
    backups: destination.backups.map(buildBackupLine),
    canDeleteRemoteOnRevoke: input.supportsRemoteDelete ?? false,
  };
}

// -----------------------------------------------------------------------------
// Constant, product-law copy. Registered by the parity gate on both surfaces so
// neither can drop or reword an honesty-critical line.
// -----------------------------------------------------------------------------

export const STORAGE_UI_COPY = {
  hubTitle: 'Storage & Backup',
  emptyTitle: 'Nothing is backed up yet',
  emptyBody:
    'Nothing is backed up until a destination verifies a copy. Add a destination to keep an encrypted copy of your data somewhere you control.',
  addDestinationTitle: 'Add a destination',
  encryptBeforeLeaving:
    'Your data is encrypted on this device before it ever reaches a destination. A destination operator can see object sizes and timing, never your private content or keys.',
  notBackedUpUntilVerified:
    'A copy counts as backed up only after the destination confirms it by reading it back or matching a checksum.',
  hostedNotDefault:
    'No destination is chosen for you. Meerkat hosted storage is a paid option you pick, never a silent default.',
  disconnectConsequence:
    'Disconnecting removes this destination’s stored credentials from this device and stops all its jobs.',
  migrateExplanation:
    'Moving copies your existing encrypted data to the new destination and removes it from the old one only after the new copy verifies. Changing where new backups go does not move data already stored elsewhere.',
  restoreUntouchedOnFailure:
    'If a restore fails for any reason, your current data on this device is left exactly as it was.',
} as const;

export const STORAGE_RESTORE_COPY = {
  wizardTitle: 'Restore from a backup',
  remoteDiscovery:
    'Meerkat checks each connected destination for its non-secret backup locator. A fresh install can find and restore these backups with the recovery key and destination credentials.',
  identityReplacementWarning:
    'This backup includes your recovery identity. Restoring it replaces the identity on this device: the current identity, and anything sealed only under it, is discarded once the recovered keys verify.',
  summaryHeading: 'What will be restored',
  activationHeading: 'Activate the restored data',
  successTitle: 'Restore complete',
  rolledBackTitle: 'Restore rolled back',
  rolledBackBody:
    'Activation did not complete, so your previous data was put back. Nothing on this device changed.',
  failedTitle: 'Restore failed',
  failedUntouched: 'Your current data was not touched.',
} as const;

// -----------------------------------------------------------------------------
// Restore wizard view model. Folds a RestorePlan (which wraps the verified
// manifest) into the REQUIRED exact restore summary, and folds the restore
// controller stage into an honest step + a true report string per terminal
// state. Every failure carries its typed reason so the surface can show the
// exact cause (corrupt chunk id, wrong key, integrity failure).
// -----------------------------------------------------------------------------

export interface RestoreSummaryRow {
  label: string;
  detail: string;
}

export interface RestoreSummaryViewModel {
  backupId: string;
  createdAt: string;
  schemaVersion: number;
  appVersion: string;
  includesDatabase: boolean;
  includesObjects: boolean;
  includesIdentity: boolean;
  objectCount: number;
  totalEncryptedBytes: number;
  rows: readonly RestoreSummaryRow[];
  /** Present ONLY when the plan replaces identity. Verbatim honest warning. */
  identityReplacementWarning: string | null;
}

/** The exact restore summary required before staged verification begins. */
export function buildRestoreSummaryViewModel(plan: RestorePlan): RestoreSummaryViewModel {
  const manifest = plan.manifest;
  const rows: RestoreSummaryRow[] = [
    { label: 'Backup id', detail: manifest.backupId },
    { label: 'Created', detail: manifest.createdAt },
    { label: 'App database', detail: plan.includesDatabase ? 'Will be restored' : 'Not selected' },
    {
      label: 'Encrypted objects',
      detail: plan.includesObjects
        ? `${plan.selectedObjectIds.length} of ${manifest.objects.length} will be restored`
        : 'Not selected',
    },
    {
      label: 'Recovery identity',
      detail: manifest.identity === null
        ? 'Not in this backup'
        : plan.includesIdentity
          ? 'Will replace this device’s identity'
          : 'Present but not selected',
    },
    { label: 'Schema version', detail: String(manifest.schemaVersion) },
    { label: 'App version', detail: manifest.appVersion },
  ];
  return {
    backupId: manifest.backupId,
    createdAt: manifest.createdAt,
    schemaVersion: manifest.schemaVersion,
    appVersion: manifest.appVersion,
    includesDatabase: plan.includesDatabase,
    includesObjects: plan.includesObjects,
    includesIdentity: plan.includesIdentity,
    objectCount: plan.selectedObjectIds.length,
    totalEncryptedBytes: plan.totalEncryptedBytes,
    rows,
    identityReplacementWarning: plan.includesIdentity
      ? STORAGE_RESTORE_COPY.identityReplacementWarning
      : null,
  };
}

export type RestoreStepTone = 'pending' | 'active' | 'done' | 'danger';

export interface RestoreStepLine {
  stage: RestoreStage;
  label: string;
  tone: RestoreStepTone;
}

const RESTORE_STEP_ORDER: readonly { stage: RestoreStage; label: string }[] = [
  { stage: 'list_locators', label: 'Find the backup' },
  { stage: 'manifest_open', label: 'Open and verify the manifest' },
  { stage: 'chunks_verifying', label: 'Verify and stage every chunk' },
  { stage: 'migration_rehearsal', label: 'Check integrity and rehearse migrations' },
  { stage: 'awaiting_activation', label: 'Ready to activate' },
  { stage: 'activated', label: 'Activated' },
];

const STAGE_RANK: Readonly<Record<RestoreStage, number>> = {
  select: 0,
  list_locators: 1,
  manifest_open: 2,
  chunks_verifying: 3,
  staged_complete: 4,
  migration_rehearsal: 4,
  awaiting_activation: 5,
  activated: 6,
  rolled_back: 6,
  failed: 6,
};

export type RestoreOutcome = 'in_progress' | 'succeeded' | 'rolled_back' | 'failed';

export interface RestoreProgressViewModel {
  outcome: RestoreOutcome;
  steps: readonly RestoreStepLine[];
  /** Verified/required chunk counts, folded from controller state. */
  verifiedChunkCount: number;
  requiredChunkCount: number;
  /** Terminal report string, verbatim from the controller (never invented). */
  report: string | null;
  /** Present on failure/rollback: the exact typed reason. */
  failure: RestoreFailureReason | null;
  /** True on any terminal state that left active data untouched. */
  activeDataUntouched: boolean;
}

export function buildRestoreProgressViewModel(
  state: RestoreControllerState,
): RestoreProgressViewModel {
  const currentRank = STAGE_RANK[state.stage];
  const outcome: RestoreOutcome = state.stage === 'activated'
    ? 'succeeded'
    : state.stage === 'rolled_back'
      ? 'rolled_back'
      : state.stage === 'failed'
        ? 'failed'
        : 'in_progress';
  const steps = RESTORE_STEP_ORDER.map((step): RestoreStepLine => {
    const rank = STAGE_RANK[step.stage];
    if (outcome === 'failed' && state.failure !== null && rank >= currentRank) {
      return { stage: step.stage, label: step.label, tone: rank === currentRank ? 'danger' : 'pending' };
    }
    if (rank < currentRank) return { stage: step.stage, label: step.label, tone: 'done' };
    if (rank === currentRank) {
      return {
        stage: step.stage,
        label: step.label,
        tone: outcome === 'succeeded' ? 'done' : 'active',
      };
    }
    return { stage: step.stage, label: step.label, tone: 'pending' };
  });
  const report = state.activationReport
    ?? state.rollbackReport
    ?? (state.failure?.report ?? state.failure?.message ?? null);
  // Active data is untouched unless activation itself is confirmed AND the
  // rollback was not able to complete (activation_rollback_failed). Every other
  // terminal state, including wrong key, corrupt chunk, integrity failure, or
  // successful rollback, left the current install exactly as it was.
  const activeDataUntouched = outcome === 'succeeded'
    ? false
    : state.failure?.code !== 'activation_rollback_failed';
  return {
    outcome,
    steps,
    verifiedChunkCount: Object.keys(state.verifiedChunks).length,
    requiredChunkCount: state.plan.requiredChunks.length,
    report,
    failure: state.failure,
    activeDataUntouched,
  };
}
