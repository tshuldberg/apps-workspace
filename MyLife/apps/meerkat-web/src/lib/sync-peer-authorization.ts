import type { DatabaseAdapter } from '@mylife/db';
import { getPairedDevice, isDeviceRevoked, isSasVerified, personGroupDocFromRow, verifyPersonGroupDoc } from '@mylife/sync';

/** Friendship and safety verification alone never establish personal-device ownership. */
export function isMeerkatOwnSyncDevice(db: DatabaseAdapter, selfDeviceId: string, peerDeviceId: string): boolean {
  try {
    const peer = getPairedDevice(db, peerDeviceId);
    if (!peer?.isActive || isDeviceRevoked(db, peerDeviceId) || !isSasVerified(db, peerDeviceId)) return false;
    const own = db.query<{ identity_anchor: string; dh_public_key: string }>(
      'SELECT identity_anchor, dh_public_key FROM dm_own_devices WHERE device_id = ?', [peerDeviceId],
    )[0];
    if (!own || own.identity_anchor !== selfDeviceId || own.dh_public_key !== peer.dhPublicKey) return false;
    const stored = db.query<{ doc_json: string }>("SELECT doc_json FROM pi_person_group WHERE id = 'self'")[0];
    if (!stored) return true; // Explicit own-device link predating a mutually signed person group.
    const group = personGroupDocFromRow(stored);
    return group !== null && verifyPersonGroupDoc(group)
      && group.devices.some((d) => d.deviceId === selfDeviceId)
      && group.devices.some((d) => d.deviceId === peerDeviceId);
  } catch {
    return false; // Missing legacy ownership tables or malformed records confer no access.
  }
}
