export type HostedBoundaryState =
  | 'included'
  | 'local_only'
  | 'paid_required'
  | 'unavailable';

export type HostedBoundaryId =
  | 'hosted_backup'
  | 'hosted_history'
  | 'public_posts'
  | 'public_feed'
  | 'large_files'
  | 'always_on_node'
  | 'hosted_relay';

export interface HostedBoundaryInput {
  relayUrl: string | null;
  hostedRelayUrl?: string | null;
  hasHostedRelayEntitlement?: boolean;
  localStorageLabel: string;
  // Plan 19 (Public Social Layer) P7a: the public_posts / public_feed rows are
  // STATE-DRIVEN from a real directory probe + a real entitlement, never faked.
  /** A self-host / community public source URL is configured (from the P5a probe). */
  publicSourceConfigured?: boolean;
  /** That configured source actually responded (publicSourceResponded from the probe). */
  publicSourceResponded?: boolean;
  /**
   * A first-party hosted serving entitlement is present. Defaults to FALSE: the app
   * has no entitlement provider yet (founder-ops), so this only lights up when a real
   * hosted entitlement is wired. NEVER fabricated.
   */
  hasPublicHostedEntitlement?: boolean;
}

export interface HostedBoundaryItem {
  id: HostedBoundaryId;
  title: string;
  state: HostedBoundaryState;
  stateLabel: string;
  detail: string;
}

// Verbatim section 7.4 detail copy for the public-reach rows, shared by both rows.
const PUBLIC_SELF_SERVED_DETAIL =
  'Public reach is live through the host you configured. It is public only while that host is online; this is free self-hosting, not paid managed serving.';
const PUBLIC_HOSTED_DETAIL =
  'Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.';

/**
 * The state-driven public-reach row (section 7.4). Honest ladder:
 *  - a real hosted serving entitlement present -> 'included' / "Hosted"
 *  - a configured + responding self-host/community source -> 'local_only' / "Self-served"
 *  - otherwise -> 'unavailable' / "Hidden", with the row's unchanged copy.
 * The entitlement input defaults FALSE (no provider is wired yet), so in practice
 * the reachable states are unavailable -> local_only; 'included' only lights up when
 * a real entitlement is wired. Never faked.
 */
function publicReachItem(
  id: HostedBoundaryId,
  title: string,
  unavailableDetail: string,
  input: HostedBoundaryInput,
): HostedBoundaryItem {
  if (input.hasPublicHostedEntitlement) {
    return { id, title, state: 'included', stateLabel: 'Hosted', detail: PUBLIC_HOSTED_DETAIL };
  }
  if (input.publicSourceConfigured && input.publicSourceResponded) {
    return { id, title, state: 'local_only', stateLabel: 'Self-served', detail: PUBLIC_SELF_SERVED_DETAIL };
  }
  return { id, title, state: 'unavailable', stateLabel: 'Hidden', detail: unavailableDetail };
}

function normalizeUrl(value: string | null | undefined): string {
  return value?.trim().replace(/\/+$/u, '') ?? '';
}

function isHostedRelayUrl(relayUrl: string | null, hostedRelayUrl: string | null | undefined): boolean {
  const relay = normalizeUrl(relayUrl);
  const hosted = normalizeUrl(hostedRelayUrl);
  return relay.length > 0 && hosted.length > 0 && relay === hosted;
}

function hostedRelayItem(input: HostedBoundaryInput): HostedBoundaryItem {
  const relay = normalizeUrl(input.relayUrl);
  const isHosted = isHostedRelayUrl(input.relayUrl, input.hostedRelayUrl);
  if (isHosted && !input.hasHostedRelayEntitlement) {
    return {
      id: 'hosted_relay',
      title: 'Hosted connection server',
      state: 'paid_required',
      stateLabel: 'Paid access required',
      detail: 'Extra first-party hosted connection capacity (backup, public reach, always-on history) is a paid service; entitlement checks fail closed. The free zero-knowledge default connection server, your own server, and a community server still work without it.',
    };
  }
  if (isHosted) {
    return {
      id: 'hosted_relay',
      title: 'Hosted connection server',
      state: 'included',
      stateLabel: 'Entitlement present',
      detail: 'The first-party hosted connection server can be used because a hosted access token is present. It still carries encrypted data only.',
    };
  }
  if (relay.startsWith('ws')) {
    return {
      id: 'hosted_relay',
      title: 'Hosted connection server',
      state: 'local_only',
      stateLabel: 'Own or community',
      detail: 'This connection server is not first-party hosted access. Meerkat will try the URL you set, but it does not imply paid hosted backup, public reach, or always-on history.',
    };
  }
  return {
    id: 'hosted_relay',
    title: 'Hosted connection server',
    state: 'unavailable',
    stateLabel: 'Not configured',
    detail: 'Private local use still works. Connection setup, friend-code publishing, mailbox delivery, and hosted services need a connection server URL.',
  };
}

export function buildHostedBoundaryItems(input: HostedBoundaryInput): HostedBoundaryItem[] {
  return [
    {
      id: 'hosted_backup',
      title: 'Cloud backup',
      state: 'local_only',
      stateLabel: 'Not backed up',
      detail: 'Recovery key export is local. Hosted backup is a paid service and is not connected in this build.',
    },
    {
      id: 'hosted_history',
      title: 'Community history',
      state: 'local_only',
      stateLabel: 'Local history only',
      detail: 'This device shows messages saved here. Community owner pays for always-on history when hosted history is connected.',
    },
    publicReachItem(
      'public_posts',
      'Public posts',
      'Public posts use hosted storage and moderation. Public posting stays hidden until paid public reach is live.',
      input,
    ),
    publicReachItem(
      'public_feed',
      'Public feed',
      'Public feed inclusion is a paid hosted service. The Public feed stays hidden until a real hosted source exists.',
      input,
    ),
    {
      id: 'large_files',
      title: 'Large files',
      state: 'local_only',
      stateLabel: 'Device storage',
      detail: `Files use local device storage today (${input.localStorageLabel}). Paid hosted file storage is not connected; writes fail instead of pretending to upload.`,
    },
    {
      id: 'always_on_node',
      title: 'Always-on community history',
      state: 'unavailable',
      stateLabel: 'Owner paid',
      detail: 'Community owner pays for always-on history. No always-on hosted community history is configured in this build.',
    },
    hostedRelayItem(input),
  ];
}
