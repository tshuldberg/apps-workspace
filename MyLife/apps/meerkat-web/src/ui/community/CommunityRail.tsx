// CommunityRail: the left-most rail. A brand avatar at top, one CommunityAvatar
// per joined community, a "+" add avatar, and the user's initial avatar last.
// Selecting a community dispatches SELECT_COMMUNITY with that community's first
// channel id.
//
// Plan 38 Phase 2 (G4): the community avatars are ordered + grouped from the
// DEVICE-LOCAL mk_community_prefs (pin floats to the top, folders group,
// manual sort), resolved by the pure orderCommunitiesForRail. With no prefs the
// rail is the pre-Plan-38 flat list in default order. An "organize" affordance
// opens the device-local Communities organizer.

import { useDeviceLayout } from '../onboarding/useDeviceLayout';
import { useMemo } from 'react';
import { NavigationIcon } from '../shell/NavigationIcon';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { CommunityAvatar } from './CommunityAvatar';
import { orderCommunitiesForRail } from '../../lib/community-organization-core';
import { openCommunityAction } from '../navigation/view-state';
import type { CommunityPrefRow } from '../../lib/community-prefs';

export function CommunityRail(): React.ReactElement {
  const m = useMeerkat();
  const deviceLayout = useDeviceLayout(m.db);
  const { view, dispatch } = useView();
  // Read m.revision so unread dots refresh after a send/sync/mark-read.
  void m.revision;
  const communities = m.listCommunities();
  const communityById = new Map(communities.map((c) => [c.communityId, c] as const));
  const prefsMap = useMemo<Record<string, CommunityPrefRow>>(() => {
    const map: Record<string, CommunityPrefRow> = {};
    for (const p of m.communityPrefs()) map[p.communityId] = p;
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.revision]);
  const railGroups = orderCommunitiesForRail(communities.map((c) => c.communityId), prefsMap);
  const initial = (m.displayName || 'M').trim().charAt(0).toUpperCase();
  const totalUnread = (communityId: string): number =>
    Object.values(m.communityUnreadCounts(communityId)).reduce((sum, n) => sum + n, 0);

  const renderCommunity = (communityId: string): React.ReactElement | null => {
    const community = communityById.get(communityId);
    if (!community) return null;
    const identity = m.communityIdentity(community.communityId);
    return (
      <CommunityAvatar
        key={community.communityId}
        name={community.descriptor.name}
        title={community.descriptor.name}
        active={
          view.main.communityId === community.communityId ||
          view.main.libraryWorkspaceId === community.communityId
        }
        unread={totalUnread(community.communityId)}
        iconImage={identity?.iconImage ?? null}
        accent={identity?.accentColor ?? null}
        onClick={() => dispatch(openCommunityAction(
          community.descriptor,
          deviceLayout.choice !== 'community' || m.communityLayoutEvent(community.communityId) !== null,
        ))}
      />
    );
  };

  return (
    <>
      <button
        type="button"
        className={`mk-avatar mk-avatar-brand ${view.main.pane === 'feed' ? 'is-active' : ''}`}
        title="Feed"
        aria-label="Feed"
        onClick={() => dispatch({ type: 'OPEN_FEED' })}
      >
        <NavigationIcon name="feed" />
      </button>
      <button
        type="button"
        className={`mk-avatar ${view.main.pane === 'messages' ? 'is-active' : ''}`}
        title="Messages"
        aria-label="Messages"
        onClick={() => dispatch({ type: 'OPEN_MESSAGES' })}
      >
        <NavigationIcon name="messages" />
      </button>
      <button
        type="button"
        className={`mk-avatar ${view.main.pane === 'public' ? 'is-active' : ''}`}
        title="Public"
        aria-label="Public"
        onClick={() => dispatch({ type: 'OPEN_PUBLIC' })}
      >
        <NavigationIcon name="public" />
      </button>
      <button
        type="button"
        className={`mk-avatar ${view.main.pane === 'discover' ? 'is-active' : ''}`}
        title="Discover"
        aria-label="Discover"
        onClick={() => dispatch({ type: 'OPEN_DISCOVER' })}
      >
        <NavigationIcon name="discover" />
      </button>
      <button
        type="button"
        className={`mk-avatar ${view.main.pane === 'library' ? 'is-active' : ''}`}
        title="My Library"
        aria-label="My Library"
        disabled={!m.personalWorkspaceId}
        onClick={() =>
          m.personalWorkspaceId &&
          dispatch({ type: 'OPEN_LIBRARY_HOME', workspaceId: m.personalWorkspaceId })
        }
      >
        <NavigationIcon name="library" />
      </button>
      <div className="mk-rail-sep" aria-hidden />
      {railGroups.map((group) => (
        <div key={group.kind === 'folder' ? `folder:${group.folder}` : group.kind} className="mk-rail-group">
          {group.kind === 'pinned' ? (
            <div className="mk-rail-group-label" aria-hidden title="Pinned">Pinned</div>
          ) : null}
          {group.kind === 'folder' ? (
            <div className="mk-rail-group-label" title={group.folder ?? undefined}>{group.folder}</div>
          ) : null}
          {group.communityIds.map(renderCommunity)}
        </div>
      ))}
      <button
        type="button"
        className="mk-avatar mk-avatar-add"
        title="Add a community"
        aria-label="Add a community"
        onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'create-community' } })}
      >
        <NavigationIcon name="add" />
      </button>
      {communities.length > 0 ? (
        <button
          type="button"
          className="mk-avatar mk-avatar-organize"
          title="Organize communities"
          aria-label="Organize communities"
          onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'organize-communities' } })}
        >
          <NavigationIcon name="organize" />
        </button>
      ) : null}
      <div className="mk-rail-spacer" />
      <button type="button" className="mk-avatar" title={m.displayName} aria-label="My profile and settings"
        onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}>
        {initial}
      </button>
    </>
  );
}
