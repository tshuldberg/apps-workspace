export type AlphaReadinessState = 'ready' | 'needs_action' | 'manual' | 'blocked';

export interface AlphaReadinessInput {
  relayUrl: string | null;
  pairedDeviceCount: number;
  verifiedPeerCount: number;
  completedSessionCount: number;
  pendingChanges: number;
  /**
   * Whether a real save destination exists for downloaded files. On Android a
   * persisted SAF folder must be chosen (the verified write target). On iOS the
   * OS share sheet is always available, so pass true there. Drives the 'files'
   * readiness item instead of a hardcoded 'manual'.
   */
  fileSaveDestinationConfigured: boolean;
  /** The platform the readiness check is running on, for honest 'files' copy. */
  platformOS?: 'ios' | 'android' | string;
}

export interface AlphaReadinessItem {
  id: string;
  label: string;
  detail: string;
  state: AlphaReadinessState;
}

export interface AlphaDiagnosticsInput extends AlphaReadinessInput {
  generatedAt: string;
  deviceName: string;
  deviceShortId: string;
  engineState: string;
  recentSessionCount: number;
  rungSummaries: readonly string[];
  pinnedCount: number;
  blockCount: number;
  storedBytes: string;
}

function hasRelayUrl(relayUrl: string | null): boolean {
  return relayUrl?.trim().startsWith('ws') ?? false;
}

export function buildAlphaReadinessItems(input: AlphaReadinessInput): AlphaReadinessItem[] {
  const relayReady = hasRelayUrl(input.relayUrl);
  const hasPair = input.pairedDeviceCount > 0;
  const hasVerifiedPeer = input.verifiedPeerCount > 0;
  const hasCompletedSession = input.completedSessionCount > 0;

  return [
    {
      id: 'relay',
      label: 'Connection server configured',
      detail: relayReady
        ? 'A connection server URL is saved for manual sessions and mailbox delivery.'
        : 'Add a connection server URL on the Sync screen before testing friends or offline delivery.',
      state: relayReady ? 'ready' : 'needs_action',
    },
    {
      id: 'pairing',
      label: 'Device paired',
      detail: hasPair
        ? `${input.pairedDeviceCount} paired device${input.pairedDeviceCount === 1 ? '' : 's'} on this node.`
        : 'Pair another device or a friend by signed payload or friend code.',
      state: hasPair ? 'ready' : 'needs_action',
    },
    {
      id: 'sas',
      label: 'SAS verified',
      detail: hasVerifiedPeer
        ? `${input.verifiedPeerCount} pairing${input.verifiedPeerCount === 1 ? '' : 's'} verified out of band.`
        : hasPair
          ? 'Compare the five emoji before testing shared community data.'
          : 'Pair a device first, then compare the five emoji.',
      state: hasVerifiedPeer ? 'ready' : hasPair ? 'needs_action' : 'blocked',
    },
    {
      id: 'session',
      label: 'Session proven',
      detail: hasCompletedSession
        ? `${input.completedSessionCount} completed session${input.completedSessionCount === 1 ? '' : 's'} recorded locally.`
        : 'Run Listen on one device and Sync now on the other; this must be physically verified.',
      state: hasCompletedSession ? 'ready' : 'manual',
    },
    {
      id: 'pending',
      label: 'Pending changes',
      detail: input.pendingChanges === 0
        ? 'No local changes are waiting in the engine queue.'
        : `${input.pendingChanges} local change${input.pendingChanges === 1 ? '' : 's'} still need a session.`,
      state: input.pendingChanges === 0 ? 'ready' : 'manual',
    },
    buildFilesReadinessItem(input),
  ];
}

function buildFilesReadinessItem(input: AlphaReadinessInput): AlphaReadinessItem {
  const isAndroid = input.platformOS === 'android';
  if (isAndroid) {
    return {
      id: 'files',
      label: 'File receive/save',
      detail: input.fileSaveDestinationConfigured
        ? 'A default Android folder is set. Saved files are written there and verified on disk before they count as saved.'
        : 'Choose a default Android folder in Settings so downloaded files save somewhere you can find them.',
      state: input.fileSaveDestinationConfigured ? 'ready' : 'needs_action',
    };
  }
  // iOS / other: the OS share sheet ("Save to Files") is always available, so
  // the capability is ready; we just cannot confirm where the user filed it.
  return {
    id: 'files',
    label: 'File receive/save',
    detail: input.fileSaveDestinationConfigured
      ? 'Saving opens the iOS share sheet so you can send a downloaded file to Files or another app.'
      : 'Saving opens the OS share sheet so you can send a downloaded file to Files or another app.',
    state: 'ready',
  };
}

export function buildAlphaDiagnostics(input: AlphaDiagnosticsInput): string {
  const relayReady = hasRelayUrl(input.relayUrl);
  const lines = [
    'Meerkat alpha diagnostics',
    `Generated: ${input.generatedAt}`,
    `Device: ${input.deviceName} (${input.deviceShortId})`,
    `Engine: ${input.engineState}`,
    `Relay configured: ${relayReady ? 'yes' : 'no'}`,
    `Paired devices: ${input.pairedDeviceCount}`,
    `SAS verified peers: ${input.verifiedPeerCount}`,
    `Recent sessions: ${input.recentSessionCount}`,
    `Completed sessions: ${input.completedSessionCount}`,
    `Pending changes: ${input.pendingChanges}`,
    `Pinned content: ${input.pinnedCount} manifests, ${input.blockCount} blocks, ${input.storedBytes}`,
    `Transport rungs: ${input.rungSummaries.length > 0 ? input.rungSummaries.join('; ') : 'none recorded'}`,
    'Limitations: manual relay/LAN only, no background auto-sync. Share-link host discovery works only with a relay configured and a reachable seeder that has announced the content; this app never announces its own pins (no inbound HTTP), and automatic peer discovery is still pending.',
  ];
  return lines.join('\n');
}
