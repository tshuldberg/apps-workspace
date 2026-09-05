// capability-status.ts (web twin of apps/meerkat/app/(root)/data/capability-status.ts).
// The single source of truth for "What works today" on web (Plan 31 Phase 4).
// Honesty by construction: DM + default-server statuses derive from the real
// web flags/substrate, so no entry can claim "live" for a capability that is off.
// Kept in lockstep with the mobile list (check-meerkat-parity.mjs).

import { DEFAULT_RELAY_URL } from './relay';
import { DM_MESSAGES_SURFACE_ENABLED } from './dm-surface';
import { ADD_FRIEND_IN_PERSON_WEB_LINE } from './add-friend-core';

export type CapabilityLevel = 'live' | 'partial' | 'pending';

export interface CapabilityEntry {
  id: string;
  title: string;
  status: CapabilityLevel;
  line: string;
}

/** The capability list, computed from the real flags so it cannot overclaim. */
export function getCapabilityStatus(): CapabilityEntry[] {
  const dmLive = DM_MESSAGES_SURFACE_ENABLED;
  const hasDefaultServer = DEFAULT_RELAY_URL.length > 0;
  return [
    {
      id: 'community_chat',
      title: 'Community chat',
      status: 'live',
      line: 'Signed channel messages sync between members over a relay or the same Wi-Fi. While the app is open, parked messages from paired members arrive on their own over the connection server; manual sync sessions and Automatic connections (opt-in) remain for full catch-up. Scheduled background sync is still pending.',
    },
    {
      id: 'live_delivery',
      title: 'Messages arrive while the app is open',
      status: 'live',
      line: 'This device holds an open connection to the configured connection server and applies parked messages the moment they arrive. Requires a reachable connection server; nothing is shown that was not really received.',
    },
    {
      id: 'person_identity',
      title: 'Your devices as one person',
      status: 'live',
      line: 'Link your own devices and they show up as one person under one name instead of as separate members; expanding a person shows each device with its own id. Linking needs the other device to confirm, and removing a device generates a new key it does not have. Nothing is grouped without a signature from every device involved.',
    },
    {
      id: 'community_name',
      title: 'A different name per community',
      status: 'live',
      line: 'Choose the name you use in each community when you join, and change or clear it later in that community\'s settings. Your linked devices all use the same name there. Each community sees a different, unlinkable identifier for you, so two communities cannot tell you are the same person.',
    },
    {
      id: 'posts',
      title: 'Posts and threads',
      status: 'live',
      line: 'Longer posts with replies live inside a community channel.',
    },
    {
      id: 'reactions',
      title: 'Reactions',
      status: 'live',
      line: 'Emoji reactions on messages and posts.',
    },
    {
      id: 'file_sharing',
      title: 'File sharing',
      status: 'live',
      line: 'Attach files in a channel; each device keeps its own verified copy.',
    },
    {
      id: 'public_viewing',
      title: 'Public reading',
      status: 'partial',
      line: 'You can read a published channel from a reachable host; a durable public archive is still pending.',
    },
    {
      id: 'dms',
      title: 'Direct messages',
      status: dmLive ? 'live' : 'pending',
      line: dmLive
        ? 'Private one-to-one messages between friends.'
        : 'Private one-to-one messages are not built yet.',
    },
    {
      // Plan 53: a browser has no nearby radio, so this surface states the
      // mobile-only reality plainly (same single-sourced line as Add friend)
      // and never implies proximity adding is possible here (AC-6).
      id: 'in_person_add',
      title: 'Add friends in person',
      status: 'partial',
      line: ADD_FRIEND_IN_PERSON_WEB_LINE,
    },
    {
      id: 'calls',
      title: 'Voice and video calls',
      status: 'pending',
      line: 'Voice, video, and community rooms are built but not available yet: placing or joining one needs the full app build and a connection server.',
    },
    {
      id: 'background_sync',
      title: 'Background catch-up',
      status: 'partial',
      line: 'The manual "Run background sync now" drain works today; scheduled background runs need a dev build.',
    },
    {
      id: 'self_host',
      title: 'Self-hosting a server',
      status: 'live',
      line: 'You can point Meerkat at your own connection server from Advanced connection.',
    },
    {
      id: 'default_server',
      title: 'Free default server',
      status: hasDefaultServer ? 'partial' : 'pending',
      line: hasDefaultServer
        ? 'A default connection server is configured; Meerkat still health-checks it before use.'
        : 'No free default server is configured yet. Pair on the same Wi-Fi or set your own server.',
    },
    {
      id: 'library_availability',
      title: 'Library file availability',
      status: 'partial',
      line: 'Community library files are available from members who have them during a sync; there is no always-on seeding yet.',
    },
    {
      id: 'photo_timeline',
      title: 'Photo timeline',
      status: 'live',
      line: 'A photo library groups its photos by their EXIF capture date; photos with no readable date sit in a "No capture date" section.',
    },
    {
      id: 'photo_map',
      title: 'Photo map (offline)',
      status: 'partial',
      line: 'The offline photo map is a mobile-only feature (a dev build with a downloaded map pack); the web app has no map.',
    },
  ];
}
