// DmGroupInfoPane (Plan 21 Phase 9): the web twin of the mobile GroupInfoSheet.
// Members list + admin-only add/remove (real epoch commits via the shared
// dm-provider-core) + an honest "Leave" that archives the conversation locally.
//
// HONESTY: removing a member rotates the group key immediately (dmGroupRemoveMember
// mints a new epoch wrapped for everyone except the removed device); the copy never
// claims instant network-wide removal. "Leave" is a LOCAL archive -- there is no
// self-remove protocol, so the note says the other members keep the thread.

import { useCallback, useMemo, useState } from 'react';
import type { DmGroupMember } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  getDmConversation,
  listDmParticipants,
  setDmConversationArchived,
} from '../../lib/dm-core';

export function DmGroupInfoPane({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const db = m.db;
  const selfDeviceId = m.identity.publicKey;
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const rev = revision + m.revision;
  const conversation = useMemo(() => {
    void rev;
    return getDmConversation(db, conversationId);
  }, [db, conversationId, rev]);
  const participants = useMemo(() => {
    void rev;
    return listDmParticipants(db, conversationId);
  }, [db, conversationId, rev]);
  const adminDeviceId = conversation?.admin_device_id ?? null;
  const iAmAdmin = adminDeviceId === selfDeviceId;

  const resolveName = useCallback((deviceId: string): string => {
    if (deviceId === selfDeviceId) return 'You';
    const paired = m.pairedDevices().find((d) => d.deviceId === deviceId);
    return paired?.displayName || `${deviceId.slice(0, 6)}…${deviceId.slice(-4)}`;
  }, [selfDeviceId, m]);

  const memberIds = useMemo(() => new Set(participants.map((p) => p.device_id)), [participants]);
  const addable = useMemo(
    () => {
      void rev;
      return m.pairedDevices().filter((d) => d.isActive && !m.isPeerRevoked(d.deviceId) && !memberIds.has(d.deviceId));
    },
    [m, memberIds, rev],
  );

  const addMember = useCallback((deviceId: string, dhPublicKey: string) => {
    void (async () => {
      setBusy(true);
      setNote(null);
      try {
        const member: DmGroupMember = { deviceId, dhPublicKey, role: 'member' };
        const result = await m.dmGroupAddMember(conversationId, member);
        if (!result.ok) setNote('Only the group admin can change membership.');
        bump();
      } catch {
        setNote('Could not add that member. The change did not complete in this browser; nothing was changed.');
      } finally {
        setBusy(false);
      }
    })();
  }, [conversationId, m, bump]);

  const removeMember = useCallback((deviceId: string) => {
    if (!window.confirm('Remove member? This rotates the group key so messages sent after removal cannot be read by this member.')) return;
    void (async () => {
      setBusy(true);
      setNote(null);
      try {
        const result = await m.dmGroupRemoveMember(conversationId, deviceId);
        if (!result.ok) setNote('Only the group admin can change membership.');
        bump();
      } catch {
        setNote('Could not remove that member. The change did not complete in this browser; nothing was changed.');
      } finally {
        setBusy(false);
      }
    })();
  }, [conversationId, m, bump]);

  const leaveGroup = useCallback(() => {
    if (!window.confirm('Leave this group on this device? It disappears from your Messages here. The other members keep the conversation; there is no network-wide leave.')) return;
    setDmConversationArchived(db, conversationId, true);
    void db.flush().catch(() => undefined);
    onBack();
  }, [db, conversationId, onBack]);

  return (
    <div className="mk-main-scroll mk-dm-group-info">
      <header className="mk-dm-thread-head">
        <button type="button" className="mk-icon-btn" aria-label="Back to conversation" onClick={onBack}>←</button>
        <div className="mk-dm-thread-titles">
          <div className="mk-dm-thread-title">{conversation?.title?.trim() || 'Group'}</div>
          <div className="mk-muted mk-dm-thread-sub">{participants.length} member{participants.length === 1 ? '' : 's'}</div>
        </div>
      </header>

      {note ? <div className="mk-box is-info" role="status">{note}</div> : null}

      <section className="mk-card">
        <h2 className="mk-h2">Members</h2>
        <div className="mk-friend-list">
          {participants.map((member) => {
            const isAdmin = member.device_id === adminDeviceId;
            const isSelf = member.device_id === selfDeviceId;
            return (
              <div key={member.device_id} className="mk-friend-card">
                <div className="mk-friend-head">
                  <div>
                    <div className="mk-friend-name">{isSelf ? 'You' : resolveName(member.device_id)}</div>
                    <div className="mk-muted" style={{ fontSize: 12 }}>{isAdmin ? 'Admin' : 'Member'}</div>
                  </div>
                  {iAmAdmin && !isSelf ? (
                    <button type="button" className="mk-btn is-danger is-small" disabled={busy} onClick={() => removeMember(member.device_id)}>Remove</button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {iAmAdmin ? (
        <section className="mk-card">
          <h2 className="mk-h2">Add a paired friend</h2>
          {addable.length === 0 ? (
            <p className="mk-muted">Everyone you have paired is already in this group.</p>
          ) : (
            <div className="mk-friend-list">
              {addable.map((device) => (
                <button
                  key={device.deviceId}
                  type="button"
                  className="mk-friend-card mk-friend-card-button"
                  disabled={busy}
                  onClick={() => addMember(device.deviceId, device.dhPublicKey)}
                >
                  <div className="mk-friend-name">{device.displayName || `${device.deviceId.slice(0, 6)}…`}</div>
                </button>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <p className="mk-muted" style={{ fontSize: 13 }}>
        Removing a member rotates the group key immediately. A new invite is delivered when the member's device
        next connects; Meerkat shows only the real signed group membership.
      </p>

      <button type="button" className="mk-btn is-danger" onClick={leaveGroup}>Leave group</button>
    </div>
  );
}
