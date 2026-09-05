import type { DatabaseAdapter } from '@mylife/db';
import type { PairedDevice } from '@mylife/sync';
import {
  getDmDelivery,
  listDmConversations,
  listDmMessages,
  listDmOwnDevices,
  type DmOwnDeviceRow,
} from './dm-core';

export type OwnDeviceConvergenceState =
  | 'no_link'
  | 'linked_waiting'
  | 'mirrored_rows'
  | 'mirrored_rows_and_receipts';

export type OwnDeviceStatusTone = 'idle' | 'warning' | 'success';

export interface OwnDeviceLinkEvidence {
  linkedDeviceIds: readonly string[];
  mirroredMessageAuthorIds: readonly string[];
  signedReceiptDeviceIds: readonly string[];
}

export interface OwnDeviceLinkStatus {
  state: OwnDeviceConvergenceState;
  tone: OwnDeviceStatusTone;
  linkedCount: number;
  mirroredMessageCount: number;
  signedReceiptCount: number;
  pillLabel: string;
  title: string;
  detail: string;
}

export interface OwnDeviceLinkCandidate {
  deviceId: string;
  displayName: string;
  dhPublicKey: string;
  shortDeviceId: string;
  linked: boolean;
  safetyChecked: boolean;
  blocked: boolean;
  active: boolean;
  canLink: boolean;
  disabledReason: string | null;
}

function countUnique(values: readonly string[]): number {
  return new Set(values.filter((value) => value.length > 0)).size;
}

function countLabel(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function summarizeOwnDeviceLinkStatus(evidence: OwnDeviceLinkEvidence): OwnDeviceLinkStatus {
  const linkedCount = countUnique(evidence.linkedDeviceIds);
  const mirroredMessageCount = evidence.mirroredMessageAuthorIds.length;
  const signedReceiptCount = evidence.signedReceiptDeviceIds.length;

  if (linkedCount === 0) {
    return {
      state: 'no_link',
      tone: 'idle',
      linkedCount,
      mirroredMessageCount: 0,
      signedReceiptCount: 0,
      pillLabel: 'Local only',
      title: 'Direct messages are local to this device',
      detail: 'No linked own device is recorded here. Conversations stay on this device until you link another paired device you own.',
    };
  }

  if (mirroredMessageCount === 0 && signedReceiptCount === 0) {
    return {
      state: 'linked_waiting',
      tone: 'warning',
      linkedCount,
      mirroredMessageCount,
      signedReceiptCount,
      pillLabel: 'Link active',
      title: 'Own-device link is active',
      detail: `${countLabel(linkedCount, 'linked device', 'linked devices')}. New outbound DMs and signed receipts will mirror through the existing paired-device mailbox. This device has not received mirrored DM rows or signed receipts from a linked own device yet.`,
    };
  }

  if (signedReceiptCount === 0) {
    return {
      state: 'mirrored_rows',
      tone: 'warning',
      linkedCount,
      mirroredMessageCount,
      signedReceiptCount,
      pillLabel: 'Rows arrived',
      title: 'Mirrored DM rows have arrived',
      detail: `${countLabel(mirroredMessageCount, 'mirrored DM row', 'mirrored DM rows')} from linked own devices are stored here. Signed receipts from linked own devices have not arrived yet, so convergence is not fully proven on this device.`,
    };
  }

  return {
    state: 'mirrored_rows_and_receipts',
    tone: 'success',
    linkedCount,
    mirroredMessageCount,
    signedReceiptCount,
    pillLabel: 'Converged here',
    title: 'Own-device convergence is proven here',
    detail: `${countLabel(mirroredMessageCount, 'mirrored DM row', 'mirrored DM rows')} and ${countLabel(signedReceiptCount, 'signed receipt', 'signed receipts')} from linked own devices are stored here. The proof comes from real mailbox rows and signed receipts, not a sync promise.`,
  };
}

export function readOwnDeviceLinkStatus(db: DatabaseAdapter, selfDeviceId: string): OwnDeviceLinkStatus {
  const linkedDevices = listDmOwnDevices(db).filter((device) => device.device_id !== selfDeviceId);
  const linkedIds = new Set(linkedDevices.map((device) => device.device_id));
  const mirroredMessageAuthorIds: string[] = [];
  const signedReceiptDeviceIds: string[] = [];

  if (linkedIds.size > 0) {
    for (const conversation of listDmConversations(db, { includeArchived: true })) {
      for (const message of listDmMessages(db, conversation.id)) {
        if (linkedIds.has(message.authorDeviceId)) {
          mirroredMessageAuthorIds.push(message.authorDeviceId);
        }
        for (const delivery of getDmDelivery(db, message.id)) {
          if (linkedIds.has(delivery.peer_device_id) && delivery.receipt_sig) {
            signedReceiptDeviceIds.push(delivery.peer_device_id);
          }
        }
      }
    }
  }

  return summarizeOwnDeviceLinkStatus({
    linkedDeviceIds: linkedDevices.map((device) => device.device_id),
    mirroredMessageAuthorIds,
    signedReceiptDeviceIds,
  });
}

export function buildOwnDeviceLinkCandidates(
  pairedDevices: readonly PairedDevice[],
  ownDevices: readonly DmOwnDeviceRow[],
  options: {
    isPeerSasVerified: (peerDeviceId: string) => boolean;
    isPeerRevoked: (peerDeviceId: string) => boolean;
    shortDeviceId: (deviceId: string) => string;
  },
): OwnDeviceLinkCandidate[] {
  const linkedIds = new Set(ownDevices.map((device) => device.device_id));
  return pairedDevices
    .filter((device) => device.isActive || linkedIds.has(device.deviceId) || options.isPeerRevoked(device.deviceId))
    .map((device) => {
      const linked = linkedIds.has(device.deviceId);
      const blocked = options.isPeerRevoked(device.deviceId);
      const safetyChecked = options.isPeerSasVerified(device.deviceId);
      const disabledReason = linked
        ? 'Already linked on this device.'
        : blocked
          ? 'Blocked devices cannot be linked.'
          : !device.isActive
            ? 'Inactive pairings cannot be linked.'
            : !safetyChecked
              ? 'Check this device safety code before linking it as your own device.'
              : null;
      return {
        deviceId: device.deviceId,
        displayName: device.displayName || options.shortDeviceId(device.deviceId),
        dhPublicKey: device.dhPublicKey,
        shortDeviceId: options.shortDeviceId(device.deviceId),
        linked,
        safetyChecked,
        blocked,
        active: device.isActive,
        canLink: disabledReason === null,
        disabledReason,
      };
    });
}
