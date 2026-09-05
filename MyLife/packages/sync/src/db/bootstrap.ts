import type { DatabaseAdapter } from '@mylife/db';
import type { DeviceIdentity, SyncEncryptionMode, SyncWorkspace } from '../types';
import {
  extractDhPrivateKeyHex,
  generateDeviceIdentity,
  migrateDeviceIdentityPrivateKeyRef,
} from '../identity/device-identity';
import { derivePairingSharedSecret } from '../identity/pairing';
import {
  getSharedSecretHex,
  isSharedSecretRef,
  storeSharedSecret,
} from '../secrets/sync-secret-store';
import { createSyncTables } from './schema';
import {
  addWorkspaceMember,
  createWorkspace,
  getDeviceIdentity,
  getPairedDevices,
  getSecurityPreference,
  getTransportPreferences,
  getWorkspaceMembers,
  getWorkspaces,
  setTransportPreferences,
  updatePairedDeviceSharedSecret,
  upsertDeviceIdentity,
  upsertSecurityPreference,
} from './queries';

export interface SyncBootstrapOptions {
  deviceDisplayName?: string;
  personalWorkspaceName?: string;
  defaultEncryptionMode?: SyncEncryptionMode;
  defaultDisappearingMessagesEnabled?: boolean;
  defaultDisappearAfterSeconds?: number | null;
  now?: () => Date;
  idFactory?: () => string;
}

export interface SyncBootstrapResult {
  identity: DeviceIdentity;
  personalWorkspace: SyncWorkspace;
  createdIdentity: boolean;
  createdPersonalWorkspace: boolean;
}

/** Relay-first defaults for new installs (MK-014, D1/D2): relay > LAN > direct > nearby; BLE stays wake-up-only. */
const DEFAULT_TRANSPORT_LAYERS = [5, 1, 4, 2, 3] as const;

/** The pre-MK-014 seeded order. Installs still on EXACTLY this get migrated. */
const LEGACY_TRANSPORT_LAYERS = [1, 2, 3, 4, 5] as const;

/**
 * One-shot ladder migration for existing installs (MK-029): an install whose
 * self-preferences are still EXACTLY the legacy v1 default ([1,2,3,4,5], all
 * enabled) is rewritten to the relay-first v2 order. Naturally one-shot: after
 * the rewrite the rows are no longer the legacy default, and an install the
 * user has customized never matches, so customizations are preserved.
 */
export function migrateTransportDefaultsToV2(
  db: DatabaseAdapter,
  deviceId: string,
  now: string = new Date().toISOString(),
): boolean {
  const prefs = getTransportPreferences(db, deviceId);
  if (prefs.length !== LEGACY_TRANSPORT_LAYERS.length) return false;
  const ranked = [...prefs].sort((a, b) => a.rank - b.rank);
  const isLegacyDefault = ranked.every(
    (pref, i) => pref.layerId === LEGACY_TRANSPORT_LAYERS[i] && pref.enabled,
  );
  if (!isLegacyDefault) return false;

  setTransportPreferences(
    db,
    deviceId,
    DEFAULT_TRANSPORT_LAYERS.map((layerId, index) => ({
      deviceId,
      layerId,
      rank: index + 1,
      enabled: true,
      updatedAt: now,
    })),
  );
  return true;
}

function createWorkspaceId(idFactory?: () => string): string {
  if (idFactory) return idFactory();
  return `ws_personal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isUsableSharedSecretRef(ref: string, peerDeviceId: string, peerDhPublicKey: string): boolean {
  if (isSharedSecretRef(ref)) {
    return getSharedSecretHex(ref) !== null;
  }

  const match = /^local:shared:([0-9a-f]{64})$/i.exec(ref);
  if (!match) return false;
  const secretHex = match[1]!.toLowerCase();
  return secretHex !== peerDeviceId.toLowerCase() && secretHex !== peerDhPublicKey.toLowerCase();
}

function migrateLegacySharedSecretRef(
  identity: DeviceIdentity,
  peerDeviceId: string,
  ref: string,
): string | null {
  const match = /^local:shared:([0-9a-f]{64})$/i.exec(ref);
  if (!match) return null;
  return storeSharedSecret(identity.publicKey, peerDeviceId, match[1]!);
}

export function repairPairedDeviceSharedSecrets(db: DatabaseAdapter, identity: DeviceIdentity): number {
  const localDhPrivateKeyHex = extractDhPrivateKeyHex(identity.privateKeyRef);
  if (!localDhPrivateKeyHex) return 0;

  let repaired = 0;
  for (const pairedDevice of getPairedDevices(db)) {
    if (!pairedDevice.isActive) continue;
    if (isUsableSharedSecretRef(
      pairedDevice.sharedSecretRef,
      pairedDevice.deviceId,
      pairedDevice.dhPublicKey,
    )) {
      const migratedRef = migrateLegacySharedSecretRef(
        identity,
        pairedDevice.deviceId,
        pairedDevice.sharedSecretRef,
      );
      if (migratedRef) {
        updatePairedDeviceSharedSecret(db, pairedDevice.deviceId, migratedRef);
        repaired += 1;
      }
      continue;
    }

    try {
      const sharedSecret = derivePairingSharedSecret(localDhPrivateKeyHex, pairedDevice.dhPublicKey);
      updatePairedDeviceSharedSecret(
        db,
        pairedDevice.deviceId,
        storeSharedSecret(identity.publicKey, pairedDevice.deviceId, sharedSecret),
      );
      repaired += 1;
    } catch {
      // Leave legacy rows untouched if the remote DH key is malformed.
    }
  }

  return repaired;
}

/**
 * Create sync tables, device identity, personal workspace, default transport
 * preferences, and baseline security preferences. Safe to call at app startup.
 */
export function ensureSyncBootstrap(
  db: DatabaseAdapter,
  options: SyncBootstrapOptions = {},
): SyncBootstrapResult {
  createSyncTables(db);

  const now = (options.now ?? (() => new Date()))().toISOString();
  let createdIdentity = false;
  let identity = getDeviceIdentity(db);
  if (!identity) {
    identity = generateDeviceIdentity(options.deviceDisplayName ?? 'This Device');
    upsertDeviceIdentity(db, identity);
    createdIdentity = true;
  } else {
    const migratedIdentity = migrateDeviceIdentityPrivateKeyRef(identity);
    if (migratedIdentity) {
      identity = migratedIdentity;
      upsertDeviceIdentity(db, identity);
    }
  }

  repairPairedDeviceSharedSecrets(db, identity);

  let createdPersonalWorkspace = false;
  let personalWorkspace = getWorkspaces(db).find((workspace) => (
    workspace.workspaceType === 'personal' && workspace.createdByDeviceId === identity.publicKey
  ));

  if (!personalWorkspace) {
    personalWorkspace = {
      id: createWorkspaceId(options.idFactory),
      displayName: options.personalWorkspaceName ?? 'Personal Workspace',
      workspaceType: 'personal',
      createdByDeviceId: identity.publicKey,
      createdAt: now,
      rotatedAt: null,
      currentKeyVersion: 1,
      archivedAt: null,
    };
    createWorkspace(db, personalWorkspace);
    createdPersonalWorkspace = true;
  }

  const members = getWorkspaceMembers(db, personalWorkspace.id);
  if (!members.some((member) => member.deviceId === identity.publicKey && member.removedAt === null)) {
    addWorkspaceMember(db, {
      workspaceId: personalWorkspace.id,
      deviceId: identity.publicKey,
      role: 'owner',
      invitedByDeviceId: identity.publicKey,
      invitedAt: now,
      removedAt: null,
    });
  }

  if (getTransportPreferences(db, identity.publicKey).length === 0) {
    setTransportPreferences(
      db,
      identity.publicKey,
      DEFAULT_TRANSPORT_LAYERS.map((layerId, index) => ({
        deviceId: identity.publicKey,
        layerId,
        rank: index + 1,
        enabled: true,
        updatedAt: now,
      })),
    );
  } else {
    // MK-029: existing installs still on the legacy v1 default move to the
    // relay-first v2 order, exactly once; customized rankings are untouched.
    migrateTransportDefaultsToV2(db, identity.publicKey, now);
  }

  const encryptionMode = options.defaultEncryptionMode ?? 'required';
  const disappearingMessagesEnabled = options.defaultDisappearingMessagesEnabled ?? false;
  const disappearAfterSeconds = disappearingMessagesEnabled
    ? options.defaultDisappearAfterSeconds ?? 7 * 24 * 60 * 60
    : null;

  if (!getSecurityPreference(db, 'default', 'default')) {
    upsertSecurityPreference(db, {
      subjectType: 'default',
      subjectId: 'default',
      encryptionMode,
      disappearingMessagesEnabled,
      disappearAfterSeconds,
      updatedAt: now,
    });
  }

  if (!getSecurityPreference(db, 'direct', 'default')) {
    upsertSecurityPreference(db, {
      subjectType: 'direct',
      subjectId: 'default',
      encryptionMode,
      disappearingMessagesEnabled,
      disappearAfterSeconds,
      updatedAt: now,
    });
  }

  return {
    identity,
    personalWorkspace,
    createdIdentity,
    createdPersonalWorkspace,
  };
}
