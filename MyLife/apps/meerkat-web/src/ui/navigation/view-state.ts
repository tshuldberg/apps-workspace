// In-app view state (no router). The web client is a single-origin SPA shell with
// no deep-linkable server content, so navigation is a reducer over view state,
// not URL routes. The selected community/channel persist to mk_settings so a
// reload restores the last place.

import { channelArchived, channelKind, communityLayout, type CommunityDescriptor } from '@mylife/sync';

export type OverlayKind =
  | 'onboarding'
  | 'settings'
  | 'create-community'
  | 'join-community'
  | 'invite'
  | 'add-channel'
  | 'publish'
  | 'sync'
  | 'share-inbox'
  // Plan 41 WP-41B3: the Storage & Backup surface (destinations, backup, restore).
  | 'storage'
  // Plan 31 P5: the relocated community admin surface (the web "gear" -> settings),
  // and the add-friend surface (zero-transport, Messages "+" People flow).
  | 'community-settings'
  // Plan 38 Phase 2 (G4): device-local Communities-list organization (pin,
  // manual order, folders). Never touches the signed descriptor.
  | 'organize-communities'
  | 'add-friend';

export interface OverlayState {
  kind: OverlayKind;
  /** Optional context for the overlay (e.g. communityId for invite/add-channel). */
  communityId?: string;
  /** Publish overlay: the channel to publish (omitted = channel picker). */
  channelId?: string;
  /** Publish overlay: a specific post to tag (kind 'post'); omitted = whole channel. */
  postId?: string;
}

export type MainPane = 'feed' | 'public' | 'discover' | 'friends' | 'messages' | 'channel' | 'files' | 'downloads' | 'library' | 'home' | 'pages' | 'canvas-page' | 'member-profile';

export interface MainView {
  communityId: string | null;
  channelId: string | null;
  postId: string | null;
  /** Plan 56: the open member-page canvas (pane 'canvas-page'). */
  canvasId?: string | null;
  /** Plan 56 C2: the member whose profile is open (pane 'member-profile'). */
  memberDeviceId?: string | null;
  pane: MainPane;
  // Plan 38 Phase 5 (library browse). The library surface is workspace-scoped
  // (a personal workspace OR a community); libraryChannelId selects one library,
  // libraryItemId opens item detail. Null on the "My Library" hub.
  libraryWorkspaceId?: string | null;
  libraryChannelId?: string | null;
  libraryItemId?: string | null;
}

export interface AppView {
  main: MainView;
  overlay: OverlayState | null;
}

export type ViewAction =
  | { type: 'OPEN_FEED' }
  | { type: 'OPEN_PUBLIC' }
  | { type: 'OPEN_DISCOVER' }
  | { type: 'OPEN_FRIENDS' }
  | { type: 'OPEN_MESSAGES' }
  | { type: 'SELECT_COMMUNITY'; communityId: string; channelId: string | null }
  // Composition Phase 1: the composed community home (a verified cm_layout doc).
  | { type: 'OPEN_COMMUNITY_HOME'; communityId: string }
  // Plan 56 C1: the Pages directory + a member page canvas.
  | { type: 'OPEN_COMMUNITY_PAGES'; communityId: string }
  | { type: 'OPEN_COMMUNITY_PAGE'; communityId: string; canvasId: string }
  // Plan 56 C2 (feature 54): a member's per-community profile.
  | { type: 'OPEN_MEMBER_PROFILE'; communityId: string; memberDeviceId: string }
  | { type: 'OPEN_CHANNEL'; communityId: string; channelId: string }
  | { type: 'OPEN_POST'; communityId: string; channelId: string; postId: string }
  | { type: 'OPEN_FILES'; communityId: string }
  | { type: 'OPEN_DOWNLOADS' }
  // Plan 38 Phase 5 (library browse). The hub lists a workspace's libraries;
  // OPEN_LIBRARY selects one; OPEN_LIBRARY_ITEM opens item detail.
  | { type: 'OPEN_LIBRARY_HOME'; workspaceId: string }
  | { type: 'OPEN_LIBRARY'; workspaceId: string; channelId: string }
  | { type: 'OPEN_LIBRARY_ITEM'; workspaceId: string; channelId: string; itemId: string }
  | { type: 'BACK_TO_CHANNEL' }
  | { type: 'SHOW_SIDEBAR' }
  | { type: 'OPEN_OVERLAY'; overlay: OverlayState }
  | { type: 'CLOSE_OVERLAY' };

export const INITIAL_VIEW: AppView = {
  main: { communityId: null, channelId: null, postId: null, pane: 'feed' },
  overlay: null,
};

/**
 * Plan 38 Phase 7 (G10/B.1): the action for opening a community, honoring its
 * signed presentation layout. A `library_first` community opens on its Libraries
 * home (Chat stays one tap away via the channel sidebar); every other community
 * opens on its first non-library channel, unchanged. Pure + total: unknown /
 * absent layout falls back to chat via communityLayout's own fail-safe.
 */
export function openCommunityAction(
  descriptor: CommunityDescriptor,
  hasComposedLayout = false,
): ViewAction {
  // Composition Phase 1: a community with a VERIFIED owner-signed layout
  // document opens on its composed home. The caller passes the real
  // resolution result (never a guess); legacy communities are unchanged.
  if (hasComposedLayout) {
    return { type: 'OPEN_COMMUNITY_HOME', communityId: descriptor.communityId };
  }
  if (communityLayout(descriptor) === 'library_first') {
    return { type: 'OPEN_LIBRARY_HOME', workspaceId: descriptor.communityId };
  }
  const firstChat =
    descriptor.channels.find((c) => channelKind(c) !== 'library' && !channelArchived(c)) ??
    descriptor.channels.find((c) => channelKind(c) !== 'library') ??
    descriptor.channels[0] ??
    null;
  return {
    type: 'SELECT_COMMUNITY',
    communityId: descriptor.communityId,
    channelId: firstChat?.id ?? null,
  };
}

export function viewReducer(state: AppView, action: ViewAction): AppView {
  switch (action.type) {
    case 'OPEN_FEED':
      return { ...state, main: { communityId: null, channelId: null, postId: null, pane: 'feed' } };
    case 'OPEN_PUBLIC':
      return { ...state, main: { communityId: null, channelId: null, postId: null, pane: 'public' } };
    case 'OPEN_DISCOVER':
      return { ...state, main: { communityId: null, channelId: null, postId: null, pane: 'discover' } };
    // Plan 31 P5: Friends folded into Messages (People panel). The action is kept
    // one release for old state/deep-links, but it now lands on Messages so there
    // is no separate Friends surface (mirrors the mobile friends -> /messages
    // redirect). NC-1 of the tab-merge decision: no dead Friends destination.
    case 'OPEN_FRIENDS':
      return { ...state, main: { communityId: null, channelId: null, postId: null, pane: 'messages' } };
    case 'OPEN_MESSAGES':
      return { ...state, main: { communityId: null, channelId: null, postId: null, pane: 'messages' } };
    case 'SELECT_COMMUNITY':
      return {
        ...state,
        main: { communityId: action.communityId, channelId: action.channelId, postId: null, pane: 'channel' },
      };
    case 'OPEN_COMMUNITY_HOME':
      return {
        ...state,
        main: { communityId: action.communityId, channelId: null, postId: null, pane: 'home' },
      };
    case 'OPEN_COMMUNITY_PAGES':
      return {
        ...state,
        main: { communityId: action.communityId, channelId: null, postId: null, pane: 'pages' },
      };
    case 'OPEN_COMMUNITY_PAGE':
      return {
        ...state,
        main: { communityId: action.communityId, channelId: null, postId: null, canvasId: action.canvasId, pane: 'canvas-page' },
      };
    case 'OPEN_MEMBER_PROFILE':
      return {
        ...state,
        main: { communityId: action.communityId, channelId: null, postId: null, memberDeviceId: action.memberDeviceId, pane: 'member-profile' },
      };
    case 'OPEN_CHANNEL':
      return {
        ...state,
        main: { communityId: action.communityId, channelId: action.channelId, postId: null, pane: 'channel' },
      };
    case 'OPEN_POST':
      return {
        ...state,
        main: {
          communityId: action.communityId,
          channelId: action.channelId,
          postId: action.postId,
          pane: 'channel',
        },
      };
    case 'OPEN_FILES':
      return { ...state, main: { ...state.main, communityId: action.communityId, postId: null, pane: 'files' } };
    case 'OPEN_DOWNLOADS':
      return { ...state, main: { communityId: null, channelId: null, postId: null, pane: 'downloads' } };
    case 'OPEN_LIBRARY_HOME':
      return {
        ...state,
        main: {
          communityId: null, channelId: null, postId: null, pane: 'library',
          libraryWorkspaceId: action.workspaceId, libraryChannelId: null, libraryItemId: null,
        },
      };
    case 'OPEN_LIBRARY':
      return {
        ...state,
        main: {
          communityId: null, channelId: null, postId: null, pane: 'library',
          libraryWorkspaceId: action.workspaceId, libraryChannelId: action.channelId, libraryItemId: null,
        },
      };
    case 'OPEN_LIBRARY_ITEM':
      return {
        ...state,
        main: {
          communityId: null, channelId: null, postId: null, pane: 'library',
          libraryWorkspaceId: action.workspaceId, libraryChannelId: action.channelId, libraryItemId: action.itemId,
        },
      };
    case 'BACK_TO_CHANNEL':
      return { ...state, main: { ...state.main, postId: null, pane: 'channel' } };
    // Narrow viewport only: clear the open channel/files pane so the shell shows
    // the rail + channel list again. Keeps the selected community so the user
    // lands back on its channel list, not the welcome screen.
    case 'SHOW_SIDEBAR':
      return { ...state, main: { ...state.main, channelId: null, postId: null, pane: 'channel' } };
    case 'OPEN_OVERLAY':
      return { ...state, overlay: action.overlay };
    case 'CLOSE_OVERLAY':
      return { ...state, overlay: null };
    default:
      return state;
  }
}
