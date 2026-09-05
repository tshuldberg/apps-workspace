// Plan 38 Phase 5/7 (personal-first, WEB): the auto-created personal workspace
// that backs the "My Library" hub. The mesh-sync design auto-creates a personal
// workspace at first launch (ensureSyncBootstrap does this against the sync
// device identity), but the Meerkat web node boots its own app identity in
// mk_identity and never ran that bootstrap, so no personal workspace row exists.
//
// This helper creates ONE personal workspace whose created_by_device_id is the
// APP identity's public key -- the key library configs are self-signed with and
// verified against (library-store libraryWorkspaceContext). It writes the
// sync_workspaces row + the single owner-membership row directly (the queries
// that ensureSyncBootstrap uses are not re-exported from @mylife/sync), and is
// idempotent: an existing personal workspace for this device is returned as-is.
// The epoch key is minted lazily on first ingest by the store's
// ensureWorkspaceEpoch, so nothing here fabricates key material.

import type { DatabaseAdapter } from '@mylife/db';
import {
  bytesToHex,
  generateSyncRandomBytes,
  type DeviceIdentity,
} from '@mylife/sync';

interface PersonalWorkspaceRow {
  id: string;
}

function newPersonalWorkspaceId(): string {
  return `ws_personal_${Date.now()}_${bytesToHex(generateSyncRandomBytes(6))}`;
}

/** The existing personal workspace id for this device, or null. */
export function getPersonalWorkspaceId(db: DatabaseAdapter, identity: DeviceIdentity): string | null {
  const rows = db.query<PersonalWorkspaceRow>(
    `SELECT id FROM sync_workspaces
       WHERE workspace_type = 'personal' AND created_by_device_id = ? AND archived_at IS NULL
       ORDER BY created_at ASC LIMIT 1`,
    [identity.publicKey],
  );
  return rows[0]?.id ?? null;
}

/**
 * Ensure the auto personal workspace exists for this device and return its id.
 * Idempotent. Also (re)asserts the owner membership row so the store's
 * author-allowed predicate (an active device of the workspace) passes.
 */
export function ensurePersonalWorkspace(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  now: string = new Date().toISOString(),
): string {
  const existing = getPersonalWorkspaceId(db, identity);
  const workspaceId = existing ?? newPersonalWorkspaceId();
  if (!existing) {
    db.execute(
      `INSERT INTO sync_workspaces
         (id, display_name, workspace_type, created_by_device_id, created_at, rotated_at, current_key_version, archived_at)
       VALUES (?, ?, 'personal', ?, ?, NULL, 1, NULL)`,
      [workspaceId, 'Personal Workspace', identity.publicKey, now],
    );
  }
  const members = db.query<{ removed_at: string | null }>(
    'SELECT removed_at FROM sync_workspace_members WHERE workspace_id = ? AND device_id = ? LIMIT 1',
    [workspaceId, identity.publicKey],
  );
  const activeMember = members.length > 0 && members[0]!.removed_at === null;
  if (!activeMember) {
    db.execute(
      `INSERT OR REPLACE INTO sync_workspace_members
         (workspace_id, device_id, role, invited_by_device_id, invited_at, removed_at)
       VALUES (?, ?, 'owner', ?, ?, NULL)`,
      [workspaceId, identity.publicKey, identity.publicKey, now],
    );
  }
  return workspaceId;
}
