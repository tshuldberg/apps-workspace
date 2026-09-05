// MessagesView (Plan 21 Phase 9): Messages = Chats + People, now with REAL direct
// messages. The web twin of the mobile messages.tsx + dm thread. The DM dead-end
// is gone: the "Chats" section lists real dm_ conversations, the People "Message"
// button opens a real 1:1 thread, and a header "New" menu creates a 1:1 or group
// DM. The thread/new/group panes are MessagesView panes (this is a single-pane
// SPA; the thread is not a URL route) -- route-vs-pane parity with mobile's Expo
// dm/[conversationId] route.
//
// HONESTY (NC-2): the conversation list shows only real dm_ rows (an empty store
// renders the honest empty state, never a fake chat); the last-outgoing chip + the
// unread count come from real dm_ rows only; nothing shows presence, a peer count,
// or a "friends online" claim.

import { useCallback, useMemo, useRef, useState } from 'react';
import type { DmGroupMember } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { DM_PERSON_LINKS_SCOPE } from '../../lib/person-identity-core';
import { resolvePersonName } from '../../lib/person-view-core';
import { buildFriendRows, type FriendRow } from '../../lib/friends-core';
import { resolveFriendAvatarImage } from '../../lib/meerkat-data';
import { Avatar } from '../kit/Avatar';
import { DM_MESSAGES_SURFACE_ENABLED } from '../../lib/dm-surface';
import {
  getDmDelivery,
  getDmUnreadCount,
  listDmConversations,
  listDmMessages,
  listDmOwnDevices,
  listDmParticipants,
} from '../../lib/dm-core';
import {
  buildDmListRow,
  compareDmHlc,
  ensureDirectConversation,
  sortDmListRows,
  DM_NO_CONVERSATIONS_EMPTY_STATE,
  type DmListRow,
} from '../../lib/dm-view-core';
import { startCallFailureCopy } from '../../lib/call-log-core';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { EmptyState } from '../shell/EmptyState';
import { DmThreadPane } from './DmThreadPane';
import { OwnDeviceLinkPanel } from './OwnDeviceLinkPanel';
import { CallHistoryView } from '../call/CallHistoryView';
import { useCall } from '../../lib/CallProvider';

type Pane =
  | { view: 'list' }
  | { view: 'thread'; conversationId: string }
  | { view: 'new-message' }
  | { view: 'new-group' }
  | { view: 'calls' };

export function MessagesView(): React.ReactElement {
  const m = useMeerkat();
  const revision = m.revision;
  const { dispatch } = useView();
  const [pane, setPane] = useState<Pane>({ view: 'list' });
  const [note, setNote] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  const openThread = useCallback((conversationId: string) => {
    setNewMenuOpen(false);
    setPane({ view: 'thread', conversationId });
  }, []);

  const friends = useMemo(() => {
    void revision;
    const paired = m.pairedDevices();
    return buildFriendRows(paired, {
      isPeerRevoked: m.isPeerRevoked,
      isPeerSasVerified: m.isPeerSasVerified,
    });
  }, [m, revision]);

  if (pane.view === 'thread') {
    return <DmThreadPane conversationId={pane.conversationId} onBack={() => setPane({ view: 'list' })} />;
  }
  if (pane.view === 'calls') {
    return <CallHistoryView onBack={() => setPane({ view: 'list' })} />;
  }
  if (pane.view === 'new-message') {
    return (
      <PickFriendPane
        title="New message"
        friends={friends.filter((f) => f.trustState !== 'blocked')}
        onCancel={() => setPane({ view: 'list' })}
        onPick={(deviceId) => {
          const paired = m.pairedDevices().find((d) => d.deviceId === deviceId);
          if (!paired) return;
          const conversationId = ensureDirectConversation(m.db, m.identity, {
            deviceId: paired.deviceId,
            dhPublicKey: paired.dhPublicKey,
          });
          void m.db.flush().catch(() => undefined);
          m.refresh();
          openThread(conversationId);
        }}
      />
    );
  }
  if (pane.view === 'new-group') {
    return (
      <NewGroupPane
        friends={friends.filter((f) => f.trustState !== 'blocked')}
        onCancel={() => setPane({ view: 'list' })}
        onCreate={async (title, deviceIds) => {
          const members: DmGroupMember[] = deviceIds
            .map((id) => m.pairedDevices().find((d) => d.deviceId === id))
            .filter((d): d is NonNullable<typeof d> => !!d)
            .map((d) => ({ deviceId: d.deviceId, dhPublicKey: d.dhPublicKey, role: 'member' as const }));
          if (members.length === 0) return 'Pick at least one paired friend.';
          try {
            const result = await m.createDmGroup(title.trim() || 'Group', members);
            openThread(result.conversationId);
            return null;
          } catch {
            return 'Could not create the group. Nothing was created.';
          }
        }}
      />
    );
  }

  return (
    <ListView
      friends={friends}
      note={note}
      setNote={setNote}
      newMenuOpen={newMenuOpen}
      setNewMenuOpen={setNewMenuOpen}
      onNewMessage={() => { setNewMenuOpen(false); setPane({ view: 'new-message' }); }}
      onNewGroup={() => { setNewMenuOpen(false); setPane({ view: 'new-group' }); }}
      onOpenThread={openThread}
      onOpenFriendThread={(deviceId) => {
        const paired = m.pairedDevices().find((d) => d.deviceId === deviceId);
        if (!paired) return;
        const conversationId = ensureDirectConversation(m.db, m.identity, {
          deviceId: paired.deviceId,
          dhPublicKey: paired.dhPublicKey,
        });
        void m.db.flush().catch(() => undefined);
        m.refresh();
        openThread(conversationId);
      }}
      onAddFriend={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'add-friend' } })}
      onOpenCalls={() => setPane({ view: 'calls' })}
    />
  );
}

function ListView({
  friends,
  note,
  setNote,
  newMenuOpen,
  setNewMenuOpen,
  onNewMessage,
  onNewGroup,
  onOpenThread,
  onOpenFriendThread,
  onAddFriend,
  onOpenCalls,
}: {
  friends: FriendRow[];
  note: string | null;
  setNote: (n: string | null) => void;
  newMenuOpen: boolean;
  setNewMenuOpen: (v: boolean) => void;
  onNewMessage: () => void;
  onNewGroup: () => void;
  onOpenThread: (conversationId: string) => void;
  onOpenFriendThread: (deviceId: string) => void;
  onAddFriend: () => void;
  onOpenCalls: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const { canCallPeer, startCall } = useCall();
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const selected = friends.find((f) => f.deviceId === openPerson) ?? null;
  const relayConfigured = m.relayUrl.startsWith('ws');

  // AC-9: a friend's signed community avatar for the People list (image -> initial
  // -> ?). A friend is not scoped to one community, so the first verified v2 avatar
  // among the communities they share is used; null falls back to the initial.
  const friendAvatars = useMemo(() => {
    const communityIds = m.listCommunities().map((community) => community.communityId);
    const map = new Map<string, string | null>();
    for (const friend of friends) {
      map.set(friend.deviceId, resolveFriendAvatarImage(m.db, communityIds, friend.deviceId));
    }
    return map;
  }, [friends, m]);

  // Plan 52 P4: resolve at PERSON granularity, so a peer's second device shows
  // that person's known name instead of a bare device id. Verified links only.
  const personLinkMap = useMemo(() => m.personLinks(DM_PERSON_LINKS_SCOPE), [m]);
  const pairedNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const device of m.pairedDevices()) {
      if (device.displayName) map.set(device.deviceId, device.displayName);
    }
    return map;
  }, [m]);

  const peerName = useCallback((deviceId: string): string => resolvePersonName(
    personLinkMap,
    deviceId,
    pairedNameMap,
    `${deviceId.slice(0, 6)}…${deviceId.slice(-4)}`,
  ), [personLinkMap, pairedNameMap]);

  const conversationRows = useMemo<DmListRow[]>(() => {
    const ownDeviceIds = new Set(listDmOwnDevices(m.db).map((d) => d.device_id));
    const rows = listDmConversations(m.db).map((conv) => {
      const messages = listDmMessages(m.db, conv.id);
      let last = messages[0] ?? null;
      for (const message of messages) {
        if (!last || compareDmHlc(message.hlc, last.hlc) > 0) last = message;
      }
      const participants = listDmParticipants(m.db, conv.id);
      const peer = participants.find((p) => p.is_self === 0);
      return buildDmListRow({
        conversationId: conv.id,
        kind: conv.kind,
        title: conv.title,
        updatedAt: conv.updated_at,
        selfDeviceId: m.identity.publicKey,
        peerName: peer ? peerName(peer.device_id) : 'Conversation',
        lastMessage: last,
        lastDelivery: last && last.authorDeviceId === m.identity.publicKey ? getDmDelivery(m.db, last.id) : [],
        ownDeviceIds,
        unreadCount: getDmUnreadCount(m.db, conv.id, m.identity.publicKey),
        memberCount: conv.kind === 'group' ? participants.length : null,
        relayConfigured,
      });
    });
    return sortDmListRows(rows);
  }, [m, peerName, relayConfigured]);

  const checkSafety = (name: string, deviceId: string): void => {
    const ok = m.confirmPeerSas(deviceId);
    setNote(ok ? `${name}'s safety code is marked checked on this device.` : 'Meerkat could not derive a safety code for this pairing.');
  };
  const blockPerson = (name: string, deviceId: string): void => {
    if (!window.confirm(`Block ${name}? This records a real local revocation so this browser can no longer connect with them here.`)) return;
    m.revokePeer(deviceId, 'blocked by user');
    setNote(`${name} is blocked on this device.`);
    setOpenPerson(null);
  };
  // A failed start must surface: silently dropping the result union is a dead click.
  const placeCall = (deviceId: string, media: 'voice' | 'video'): void => {
    setOpenPerson(null);
    void (async () => {
      try {
        const result = await startCall(deviceId, media);
        if (!result.ok) setNote(startCallFailureCopy(result.reason, 'browser'));
      } catch {
        setNote(startCallFailureCopy('unknown', 'browser'));
      }
    })();
  };

  return (
    <div className="mk-main-scroll mk-messages-view">
      <header className="mk-feed-hero">
        <div>
          <h1 className="mk-h1">Messages</h1>
          <p className="mk-muted">Private, end-to-end encrypted chats and the people you trust.</p>
        </div>
        <div className="mk-dm-header-actions">
          <Button variant="ghost" onClick={onOpenCalls}>Calls</Button>
          <div className="mk-dm-new-host">
            <Button variant="ghost" onClick={() => setNewMenuOpen(!newMenuOpen)} aria-expanded={newMenuOpen}>New</Button>
            {newMenuOpen ? (
              <div className="mk-chat-context-menu" role="menu">
                <button type="button" role="menuitem" className="mk-chat-menu-item" onClick={onNewMessage}>New message</button>
                <button type="button" role="menuitem" className="mk-chat-menu-item" onClick={onNewGroup}>New group</button>
              </div>
            ) : null}
          </div>
          <Button onClick={onAddFriend}>Add friend</Button>
        </div>
      </header>

      {note ? <div className="mk-box is-info" role="status">{note}</div> : null}

      <section className="mk-card" aria-label="Chats">
        <h2 className="mk-h2">Chats</h2>
        {conversationRows.length === 0 ? (
          <p className="mk-muted">{DM_NO_CONVERSATIONS_EMPTY_STATE}</p>
        ) : (
          <div className="mk-dm-conv-list">
            {conversationRows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="mk-dm-conv-row"
                aria-label={`Open chat with ${row.title}${row.unreadCount > 0 ? `, ${row.unreadCount} unread` : ''}`}
                onClick={() => onOpenThread(row.id)}
              >
                <div className="mk-dm-conv-avatar" aria-hidden>
                  {row.isGroup ? '#' : (row.title.trim().charAt(0).toUpperCase() || '?')}
                </div>
                <div className="mk-dm-conv-main">
                  <div className="mk-dm-conv-title-row">
                    <span className="mk-dm-conv-name">{row.title}{row.isGroup && row.memberCount ? ` · ${row.memberCount}` : ''}</span>
                    {row.unreadCount > 0 ? <span className="mk-dm-conv-unread">{row.unreadCount > 99 ? '99+' : row.unreadCount}</span> : null}
                  </div>
                  <div className="mk-dm-conv-preview">{row.subtitle}</div>
                  {row.chip ? <div className="mk-dm-conv-chip">{row.chip}</div> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <OwnDeviceLinkPanel />

      <section className="mk-friend-section" aria-label="People">
        <div className="mk-section-head">
          <div>
            <h2>People</h2>
            <p>People you have connected with and chosen to trust.</p>
          </div>
        </div>

        {friends.length === 0 ? (
          <EmptyState icon="P" title="No people yet">
            Add a friend using their code to start a private conversation.
          </EmptyState>
        ) : (
          <div className="mk-friend-list">
            {friends.map((friend) => (
              <button
                key={friend.deviceId}
                type="button"
                className="mk-friend-card mk-friend-card-button"
                onClick={() => { setNote(null); setOpenPerson(friend.deviceId); }}
              >
                <div className="mk-friend-head">
                  <div className="mk-friend-identity">
                    <Avatar
                      imageBase64={friendAvatars.get(friend.deviceId) ?? null}
                      initial={friend.displayName.trim().charAt(0).toUpperCase()}
                      size={40}
                    />
                    <div>
                      <div className="mk-friend-name">{friend.displayName}</div>
                      <div className="mk-mono">{friend.shortDeviceId}</div>
                    </div>
                  </div>
                  <span className={`mk-pill ${friend.trustState === 'checked' ? 'is-success' : friend.trustState === 'blocked' ? 'is-error' : 'is-warning'}`}>
                    {friend.safetyLabel}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <PersonSheet
          key={selected.deviceId}
          name={selected.displayName}
          shortId={selected.shortDeviceId}
          trustState={selected.trustState}
          safetyLabel={selected.safetyLabel}
          sas={selected.trustState === 'blocked' ? null : m.getPeerSas(selected.deviceId)?.emoji ?? null}
          canCall={canCallPeer(selected.deviceId)}
          onCheckSafety={() => checkSafety(selected.displayName, selected.deviceId)}
          onMessage={() => { setOpenPerson(null); onOpenFriendThread(selected.deviceId); }}
          onVoiceCall={() => placeCall(selected.deviceId, 'voice')}
          onVideoCall={() => placeCall(selected.deviceId, 'video')}
          onBlock={() => blockPerson(selected.displayName, selected.deviceId)}
          onClose={() => setOpenPerson(null)}
        />
      ) : null}
    </div>
  );
}

function PersonSheet({
  name,
  shortId,
  trustState,
  safetyLabel,
  sas,
  canCall,
  onCheckSafety,
  onMessage,
  onVoiceCall,
  onVideoCall,
  onBlock,
  onClose,
}: {
  name: string;
  shortId: string;
  trustState: 'checked' | 'unknown' | 'blocked';
  safetyLabel: string;
  sas: string[] | null;
  canCall: boolean;
  onCheckSafety: () => void;
  onMessage: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onBlock: () => void;
  onClose: () => void;
}): React.ReactElement {
  const messageEnabled = DM_MESSAGES_SURFACE_ENABLED && trustState !== 'blocked';
  // Calls are gated on a real media backend + trusted pairing (canCallPeer, NC-25.8).
  const callEnabled = canCall && trustState !== 'blocked';
  return (
    <div className="mk-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mk-modal" role="dialog" aria-modal aria-label={`${name} details`}>
        <div className="mk-modal-header">
          <div>
            <h2 className="mk-modal-title">{name}</h2>
            <div className="mk-mono">{shortId}</div>
          </div>
          <button className="mk-modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <span className={`mk-pill ${trustState === 'checked' ? 'is-success' : trustState === 'blocked' ? 'is-error' : 'is-warning'}`}>
          {safetyLabel}
        </span>
        {sas ? (
          <div className="mk-friend-safety">
            <span className="mk-label">Safety code</span>
            <span className="mk-friend-sas">{sas.join('  ')}</span>
            <p className="mk-muted" style={{ fontSize: 13 }}>Compare these five emoji in person or on a call.</p>
          </div>
        ) : null}
        <div className="mk-btn-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          {trustState === 'unknown' ? (
            <Button variant="ghost" small onClick={onCheckSafety}>Mark safety code checked</Button>
          ) : null}
          <Button small disabled={!messageEnabled} onClick={onMessage}>Message</Button>
          {callEnabled ? (
            <>
              <Button variant="ghost" small onClick={onVoiceCall}>Voice call</Button>
              <Button variant="ghost" small onClick={onVideoCall}>Video call</Button>
            </>
          ) : null}
          {trustState !== 'blocked' ? (
            <Button variant="danger" small onClick={onBlock}>Block</Button>
          ) : null}
        </div>
        {trustState === 'blocked' ? (
          <p className="mk-muted" style={{ fontSize: 13 }}>Unblock this person to message them.</p>
        ) : null}
      </div>
    </div>
  );
}

function PickFriendPane({
  title,
  friends,
  onCancel,
  onPick,
}: {
  title: string;
  friends: FriendRow[];
  onCancel: () => void;
  onPick: (deviceId: string) => void;
}): React.ReactElement {
  return (
    <div className="mk-main-scroll mk-messages-view">
      <header className="mk-dm-thread-head">
        <button type="button" className="mk-icon-btn" aria-label="Back to messages" onClick={onCancel}>←</button>
        <div className="mk-dm-thread-titles"><div className="mk-dm-thread-title">{title}</div></div>
      </header>
      <section className="mk-card">
        {friends.length === 0 ? (
          <p className="mk-muted">Pair a friend first to start a conversation.</p>
        ) : (
          <div className="mk-friend-list">
            {friends.map((friend) => (
              <button key={friend.deviceId} type="button" className="mk-friend-card mk-friend-card-button" onClick={() => onPick(friend.deviceId)}>
                <div className="mk-friend-head">
                  <div>
                    <div className="mk-friend-name">{friend.displayName}</div>
                    <div className="mk-mono">{friend.shortDeviceId}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function NewGroupPane({
  friends,
  onCancel,
  onCreate,
}: {
  friends: FriendRow[];
  onCancel: () => void;
  /** Resolves null on success (the parent navigates); an honest error line otherwise. */
  onCreate: (title: string, deviceIds: string[]) => Promise<string | null>;
}): React.ReactElement {
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous re-entrancy guard: two fast clicks must not mint two groups.
  const createInFlightRef = useRef(false);
  const toggle = (deviceId: string): void => {
    setSelectedIds((cur) => (cur.includes(deviceId) ? cur.filter((id) => id !== deviceId) : [...cur, deviceId]));
  };
  const canCreate = selectedIds.length >= 1;

  const submit = (): void => {
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    setCreating(true);
    setError(null);
    void (async () => {
      try {
        const failure = await onCreate(title, selectedIds);
        if (failure) setError(failure);
      } finally {
        createInFlightRef.current = false;
        setCreating(false);
      }
    })();
  };

  return (
    <div className="mk-main-scroll mk-messages-view">
      <header className="mk-dm-thread-head">
        <button type="button" className="mk-icon-btn" aria-label="Back to messages" onClick={onCancel}>←</button>
        <div className="mk-dm-thread-titles"><div className="mk-dm-thread-title">New group</div></div>
      </header>
      <section className="mk-card">
        <input
          className="mk-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Group name (optional)"
          aria-label="Group name"
        />
        <p className="mk-muted" style={{ marginTop: 8 }}>
          {friends.length === 0
            ? 'Pair a friend first to start a group.'
            : 'Choose the paired friends to include. A friend who is not paired cannot receive group messages.'}
        </p>
        <div className="mk-friend-list">
          {friends.map((friend) => {
            const checked = selectedIds.includes(friend.deviceId);
            return (
              <button
                key={friend.deviceId}
                type="button"
                className={`mk-friend-card mk-friend-card-button ${checked ? 'is-selected' : ''}`}
                aria-pressed={checked}
                onClick={() => toggle(friend.deviceId)}
              >
                <div className="mk-friend-head">
                  <div className="mk-friend-name">{friend.displayName}</div>
                  <span className="mk-pill">{checked ? 'Added' : 'Add'}</span>
                </div>
              </button>
            );
          })}
        </div>
        {error ? <div className="mk-box is-error" role="alert">{error}</div> : null}
        <div className="mk-btn-row" style={{ marginTop: 12 }}>
          <Button disabled={!canCreate || creating} onClick={submit}>
            {creating ? 'Creating…' : canCreate ? `Create group (${selectedIds.length})` : 'Choose at least one friend'}
          </Button>
        </div>
      </section>
    </div>
  );
}
