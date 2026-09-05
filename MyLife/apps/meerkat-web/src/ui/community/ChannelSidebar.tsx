// ChannelSidebar: the middle pane -- the community's CHANNEL LIST (Plan 31 P5).
// Header = the selected community name + a compact action row (Add channel for
// owner, Files for all) and a gear that opens the relocated admin surface
// (CommunitySettings). ALL administration (profile editor, members + block, owner
// review, public reports, Make public, invite share, mute, leave, requests-to-
// join) now lives behind that gear, matching the mobile community screen -> gear
// -> settings IA. With no community selected it shows a muted hint + the footer.

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { ChannelRow } from './ChannelRow';
import { UnreadBadge } from './UnreadBadge';
import { IdentityFooter } from './IdentityFooter';
import { CommunityIdentityHeader } from './CommunityIdentityHeader';
import { CommunityThemeBoundary } from './CommunityThemeBoundary';
import { buildSidebarModel } from '../../lib/community-organization-core';

export function ChannelSidebar(): React.ReactElement {
  const m = useMeerkat();
  const { view, dispatch } = useView();
  const [showArchived, setShowArchived] = useState(false);
  // In a community's library_first view the main pane is the Libraries home, but
  // the sidebar still belongs to that community so Chat stays one tap away. Fall
  // back to the library workspace id when it names a community (never the
  // personal hub, which is not in listCommunities).
  const communityId =
    view.main.communityId ??
    (view.main.pane === 'library' ? view.main.libraryWorkspaceId ?? null : null);
  const community = communityId
    ? m.listCommunities().find((c) => c.communityId === communityId) ?? null
    : null;

  if (!community) {
    return (
      <>
        <div className="mk-sidebar-scroll">
          <div className="mk-muted" style={{ fontSize: 13, padding: 'var(--mk-space-sm)' }}>
            Select or create a community.
          </div>
        </div>
        <IdentityFooter />
      </>
    );
  }

  const d = community.descriptor;
  const isOwner = community.myRole === 'owner';
  // Read m.revision so unread counts refresh after a send/sync/mark-read.
  void m.revision;
  const unreadByChannel = m.communityUnreadCounts(d.communityId);
  const muted = m.isCommunityMuted(d.communityId);

  // Adjusted per-channel unread (muted channel -> 0, active channel -> 0). The
  // sidebar model rolls THIS map up per category so the group badge and the
  // per-channel badges always agree.
  const adjustedUnread: Record<string, number> = {};
  for (const channel of d.channels) {
    adjustedUnread[channel.id] = m.isChannelMuted(d.communityId, channel.id)
      ? 0
      : view.main.channelId === channel.id
        ? 0
        : unreadByChannel[channel.id] ?? 0;
  }
  const model = buildSidebarModel(d, adjustedUnread);

  return (
    <CommunityThemeBoundary communityId={d.communityId} contents>
      <CommunityIdentityHeader communityId={d.communityId} />
      <div className="mk-sidebar-header">
        <div className="mk-sidebar-title" title={d.name}>
          {d.name}
          {muted ? <span className="mk-muted" style={{ fontSize: 12, marginLeft: 6 }}>muted</span> : null}
        </div>
        <div className="mk-sidebar-actions">
          {isOwner && (
            <Button
              variant="ghost"
              small
              onClick={() =>
                dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'add-channel', communityId: d.communityId } })
              }
            >
              Add channel
            </Button>
          )}
          {m.communityLayoutEvent(d.communityId) !== null ? (
            <Button
              variant="ghost"
              small
              onClick={() => dispatch({ type: 'OPEN_COMMUNITY_HOME', communityId: d.communityId })}
            >
              Home
            </Button>
          ) : null}
          <Button
            variant="ghost"
            small
            onClick={() => dispatch({ type: 'OPEN_LIBRARY_HOME', workspaceId: d.communityId })}
          >
            Libraries
          </Button>
          <Button
            variant="ghost"
            small
            onClick={() => dispatch({ type: 'OPEN_COMMUNITY_PAGES', communityId: d.communityId })}
          >
            Pages
          </Button>
          <Button
            variant="ghost"
            small
            onClick={() => dispatch({ type: 'OPEN_FILES', communityId: d.communityId })}
          >
            Files
          </Button>
          <Button
            variant="ghost"
            small
            aria-label="Community settings"
            onClick={() =>
              dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'community-settings', communityId: d.communityId } })
            }
          >
            Settings
          </Button>
        </div>
      </div>
      <div className="mk-sidebar-scroll">
        {model.groups.map((group) => {
          if (group.channels.length === 0 && group.category !== null) return null;
          const headingId = group.category ? `cat-${group.category.id}` : 'channels';
          return (
            <div key={headingId} className="mk-sidebar-group">
              <div className="mk-sidebar-group-head">
                <h2 className="mk-h2">{group.category ? group.category.name : 'Channels'}</h2>
                <UnreadBadge count={group.unread} />
              </div>
              {group.channels.map((channel) => {
                const channelMuted = m.isChannelMuted(d.communityId, channel.id);
                const unread = adjustedUnread[channel.id] ?? 0;
                return (
                  <div key={channel.id} className="mk-sidebar-row-wrap">
                    <ChannelRow
                      name={channel.name}
                      active={view.main.channelId === channel.id}
                      unread={unread}
                      onClick={() =>
                        dispatch({ type: 'OPEN_CHANNEL', communityId: d.communityId, channelId: channel.id })
                      }
                    />
                    <Button
                      variant="ghost"
                      small
                      onClick={() =>
                        m.setChannelMuted(d.communityId, channel.id, !channelMuted, `#${channel.name}`)
                      }
                    >
                      {channelMuted ? 'Muted' : 'Mute'}
                    </Button>
                  </div>
                );
              })}
            </div>
          );
        })}

        {model.archived.length > 0 ? (
          <div className="mk-sidebar-group mk-sidebar-archived">
            <button
              type="button"
              className="mk-sidebar-group-head mk-sidebar-archived-toggle"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              <h2 className="mk-h2">Archived</h2>
              <span className="mk-muted" style={{ fontSize: 12 }}>{showArchived ? 'Hide' : `${model.archived.length}`}</span>
            </button>
            {showArchived ? (
              <>
                <p className="mk-muted" style={{ fontSize: 12, padding: '0 var(--mk-space-sm)' }}>
                  Archived channel. Content is preserved and read-only here.
                </p>
                {model.archived.map((channel) => (
                  <div key={channel.id} className="mk-sidebar-row-wrap">
                    <ChannelRow
                      name={channel.name}
                      active={view.main.channelId === channel.id}
                      unread={0}
                      onClick={() =>
                        dispatch({ type: 'OPEN_CHANNEL', communityId: d.communityId, channelId: channel.id })
                      }
                    />
                  </div>
                ))}
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mk-sidebar-members-row">
          <Button
            variant="ghost"
            small
            onClick={() =>
              dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'community-settings', communityId: d.communityId } })
            }
          >
            {d.members.length} member{d.members.length === 1 ? '' : 's'} · Manage in settings
          </Button>
        </div>
      </div>
      <IdentityFooter />
    </CommunityThemeBoundary>
  );
}
