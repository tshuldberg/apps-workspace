// delete-account-core.ts: the pure, testable half of the web "Delete my data"
// flow (Plan 23 B.2). Byte-identical logic twin of the mobile core. Apple and
// Google both require an in-app way to delete the account even though Meerkat
// has NO server account: identity lives only in this browser. This composes the
// existing destructive primitives into one auditable wipe that returns the app
// to a clean first-run.
//
// Honesty boundary (Critical): this deletes only what is IN THIS BROWSER. Records
// already replicated to peers (messages a paired device holds, a friend code
// already resolved) are NOT reachable from here; the UI copy says so plainly.
//
// Pure: takes a DatabaseAdapter, no browser APIs.

import type { DatabaseAdapter } from '@mylife/db';

/**
 * Table-name prefixes that hold this device's Meerkat data: mk_ (identity,
 * settings, pinned index, prefs), mp_ (synced pad), cm_ (communities/messages/
 * libraries), sync_ (engine sessions/audit/paired devices), dm_ (direct messages).
 */
export const MEERKAT_DATA_TABLE_PREFIXES = ['mk_', 'mp_', 'cm_', 'sync_', 'dm_'] as const;

/** List every existing table whose name starts with a Meerkat data prefix. */
export function listMeerkatDataTables(db: DatabaseAdapter): string[] {
  const likeClauses = MEERKAT_DATA_TABLE_PREFIXES.map(() => 'name LIKE ?').join(' OR ');
  const rows = db.query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND (${likeClauses}) ORDER BY name`,
    MEERKAT_DATA_TABLE_PREFIXES.map((p) => `${p}%`),
  );
  return rows.map((r) => r.name);
}

export interface WipeMeerkatDataResult {
  tablesCleared: string[];
}

/**
 * Collect every device secret-store ref that "Delete my data" must remove: this
 * device's identity private-key ref AND every paired device's pairwise shared
 * secret ref. MUST be called BEFORE {@link wipeMeerkatDeviceData}, because the
 * wipe drops the rows that hold these refs.
 */
export function collectSecretRefs(db: DatabaseAdapter, identityPrivateKeyRef?: string): string[] {
  const refs = new Set<string>();
  if (identityPrivateKeyRef) refs.add(identityPrivateKeyRef);
  try {
    const idRow = db.query<{ private_key_ref: string | null }>(
      "SELECT private_key_ref FROM mk_identity WHERE id = 'self' LIMIT 1",
    )[0];
    if (idRow?.private_key_ref) refs.add(idRow.private_key_ref);
  } catch {
    // mk_identity may not exist on a brand-new install; harmless.
  }
  try {
    const peers = db.query<{ shared_secret_ref: string | null }>(
      'SELECT shared_secret_ref FROM sync_paired_devices',
    );
    for (const peer of peers) {
      if (peer.shared_secret_ref) refs.add(peer.shared_secret_ref);
    }
  } catch {
    // sync_paired_devices may not exist yet; harmless.
  }
  // Plan 39: the public persona seed is a shared-secret ref stored under the public_persona
  // mk_settings row. Include it so a "Delete my data" wipe does not strand the persona key.
  try {
    const row = db.query<{ value: string | null }>(
      "SELECT value FROM mk_settings WHERE key = 'public_persona' LIMIT 1",
    )[0];
    if (row?.value) {
      const parsed = JSON.parse(row.value) as { privateKeyRef?: unknown };
      if (typeof parsed.privateKeyRef === 'string') refs.add(parsed.privateKeyRef);
    }
  } catch {
    // no persona or malformed row; harmless.
  }
  return [...refs];
}

/** Any non-empty persona row requires a remote delete attempt, even if malformed. */
export function hasPublicPersonaRecord(db: DatabaseAdapter): boolean {
  try {
    const row = db.query<{ value: string | null }>(
      "SELECT value FROM mk_settings WHERE key = 'public_persona' LIMIT 1",
    )[0];
    return typeof row?.value === 'string' && row.value.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Clear every row from every Meerkat data table. Leaves the SCHEMA intact so the
 * app boots clean into onboarding and re-mints a fresh identity. Idempotent.
 */
export function wipeMeerkatDeviceData(db: DatabaseAdapter): WipeMeerkatDataResult {
  const tables = listMeerkatDataTables(db);
  db.transaction(() => {
    for (const table of tables) db.execute(`DELETE FROM ${table}`);
  });
  return { tablesCleared: tables };
}

export interface DeleteMyDataDependencies {
  db: DatabaseAdapter;
  identityPrivateKeyRef: string;
  hasPublicPersona: boolean;
  deleteRemotePersona: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteStorageData: () => Promise<{
    complete: boolean;
    failures: readonly { destinationId: string | null; step: string }[];
  }>;
  clearNodeBytes: () => Promise<void>;
  clearBlobBytes: () => Promise<void>;
  deleteSecret: (ref: string) => void | Promise<void>;
  flushSecrets?: () => Promise<void>;
  createFreshIdentity: () => void | Promise<void>;
}

export type DeleteMyDataResult = { ok: true } | { ok: false; reason: string };

/** Web twin of the production remote-first deletion order. */
export async function runDeleteMyData(
  dependencies: DeleteMyDataDependencies,
): Promise<DeleteMyDataResult> {
  const refs = collectSecretRefs(dependencies.db, dependencies.identityPrivateKeyRef);
  if (dependencies.hasPublicPersona) {
    const remote = await dependencies.deleteRemotePersona();
    if (!remote.ok) return { ok: false, reason: `public_account_delete_failed:${remote.reason}` };
  }
  const storage = await dependencies.deleteStorageData();
  if (!storage.complete) {
    const reason = storage.failures
      .map((failure) => `${failure.destinationId ?? 'account'}:${failure.step}`)
      .join(',');
    return { ok: false, reason: `storage_account_delete_failed:${reason || 'unknown'}` };
  }
  try {
    await dependencies.clearNodeBytes();
    await dependencies.clearBlobBytes();
    const orderedRefs = refs
      .filter((ref) => ref !== dependencies.identityPrivateKeyRef)
      .concat(refs.includes(dependencies.identityPrivateKeyRef) ? [dependencies.identityPrivateKeyRef] : []);
    for (const ref of orderedRefs) await dependencies.deleteSecret(ref);
    await dependencies.flushSecrets?.();
    wipeMeerkatDeviceData(dependencies.db);
    await dependencies.createFreshIdentity();
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'local_delete_failed' };
  }
}

/** The single honest description of what "Delete my data" does and does not do. */
export const DELETE_MY_DATA_COPY = {
  sectionTitle: 'Delete my data',
  sectionHint:
    'Permanently delete every connected storage authorization and everything Meerkat stored in this browser.',
  buttonLabel: 'Delete my data',
  confirmBody:
    'Delete everything in this browser? Meerkat first deletes your registered public persona and public posts, revokes every storage destination, deletes broker vaults and hosted storage, then deletes your identity, raw files, content, communities, direct messages, and settings here. You can choose whether destination adapters also delete their encrypted backup objects. If a remote service cannot be reached, the local wipe pauses so your signing key remains available to retry. Anything already synced to another person or device stays on their device. This cannot be undone.',
  deleting: 'Deleting…',
  errorRetry: 'Could not finish deleting. Some completed deletion steps cannot be undone; reconnect and retry until the wipe completes.',
} as const;
