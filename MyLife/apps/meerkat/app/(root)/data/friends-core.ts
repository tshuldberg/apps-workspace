// friends-core.ts (mobile): the People rows behind the Messages surface. Plan 21
// removed the DM dead-end: the "Message" affordance now opens a real DM thread
// (messages.tsx), so this no longer carries a canMessage:false flag, a "Message
// unavailable" label, or an unavailable-reason string. Trust + block state remain;
// the Message enable/disable decision lives with the DM surface flag
// (DM_MESSAGES_SURFACE_AVAILABLE) at the call site, not here. Twin of the web
// friends-core.ts.

import type { PairedDevice } from '@mylife/sync';
import { shortHex } from '../theme/format';

export type FriendTrustState = 'checked' | 'unknown' | 'blocked';

export interface FriendRow {
  deviceId: string;
  displayName: string;
  shortDeviceId: string;
  relationshipLabel: 'Friend' | 'Blocked';
  trustState: FriendTrustState;
  safetyLabel: 'Safety code checked' | 'Check safety code' | 'Blocked';
}

export interface BuildFriendRowsOptions {
  isPeerSasVerified: (peerDeviceId: string) => boolean;
  isPeerRevoked: (peerDeviceId: string) => boolean;
}

export function buildFriendRows(
  pairedDevices: readonly PairedDevice[],
  options: BuildFriendRowsOptions,
): FriendRow[] {
  return pairedDevices
    .filter((device) => device.isActive || options.isPeerRevoked(device.deviceId))
    .map((device) => {
      const blocked = options.isPeerRevoked(device.deviceId);
      const checked = !blocked && options.isPeerSasVerified(device.deviceId);
      return {
        deviceId: device.deviceId,
        displayName: device.displayName || shortHex(device.deviceId),
        shortDeviceId: shortHex(device.deviceId),
        relationshipLabel: blocked ? 'Blocked' : 'Friend',
        trustState: blocked ? 'blocked' : checked ? 'checked' : 'unknown',
        safetyLabel: blocked ? 'Blocked' : checked ? 'Safety code checked' : 'Check safety code',
      };
    });
}
