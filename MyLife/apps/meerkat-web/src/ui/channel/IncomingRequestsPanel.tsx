// IncomingRequestsPanel: the owner side of the re-send mailbox flow. Shows open
// incoming cm_file_requests for the open community; per request the file name +
// requester short id with Approve / Decline. Mirrors the native owner flow.
//
// Honesty boundary (Critical): approving re-sends only this device's local copy
// of the file through the protected connection path. The send is fire-and-forget; the
// owner side says "Re-sent through the connection server.", never "Delivered". The bytes are
// verified against the original before they are written on either side.

import { useCallback, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { shortDeviceId } from './InChannelFileCard';
import type { FileRequestRow } from '../../lib/meerkat-data';

// busy carries WHICH action is in flight so the Approve button never reads
// "Working…" while a Decline is running (and vice versa).
type RowState = { busy: 'approve' | 'decline' | null; result: string | null; tone: 'info' | 'success' | 'error' };

export function IncomingRequestsPanel({
  communityId,
  channelId,
}: {
  communityId: string;
  channelId?: string;
}): React.ReactElement | null {
  const m = useMeerkat();
  const revision = m.revision;
  void revision; // re-read after a drain/approve.
  const all = m.incomingFileRequests(communityId);
  const requests = channelId ? all.filter((r) => r.channel_id === channelId) : all;
  const [byId, setById] = useState<Record<string, RowState>>({});

  const fileName = useCallback((row: FileRequestRow): string => attachmentName(m, row), [m]);

  const setRow = (id: string, next: RowState): void => setById((s) => ({ ...s, [id]: next }));

  const onApprove = (row: FileRequestRow): void => {
    setRow(row.id, { busy: 'approve', result: null, tone: 'info' });
    void (async () => {
      try {
        const result = await m.approveFileRequest(row.id);
        if (result.ok) {
          setRow(row.id, { busy: null, result: 'Re-sent through the connection server.', tone: 'success' });
        } else {
          setRow(row.id, { busy: null, result: approveFailure(result.reason), tone: 'error' });
        }
      } catch (err) {
        // approveFileRequest can throw (blob reads inside the grant build);
        // without this catch the rejection left the row stuck on "Working…".
        setRow(row.id, { busy: null, result: err instanceof Error ? err.message : 'Could not complete that request.', tone: 'error' });
      }
    })();
  };

  const onDecline = (row: FileRequestRow): void => {
    setRow(row.id, { busy: 'decline', result: null, tone: 'info' });
    void (async () => {
      try {
        const result = await m.declineFileRequest(row.id);
        if (result.ok) {
          setRow(row.id, { busy: null, result: 'Declined.', tone: 'info' });
        } else {
          setRow(row.id, { busy: null, result: approveFailure(result.reason), tone: 'error' });
        }
      } catch (err) {
        setRow(row.id, { busy: null, result: err instanceof Error ? err.message : 'Could not complete that request.', tone: 'error' });
      }
    })();
  };

  if (requests.length === 0) return null;

  return (
    <div className="mk-requests-panel">
      <h2 className="mk-h2">File requests</h2>
      <HonestNotice>
        Approving re-sends only your local copy of this file to the requester through the protected
        connection path. The bytes are verified against the original before they are written on
        either side.
      </HonestNotice>
      <ul className="mk-requests-list">
        {requests.map((row) => {
          const state = byId[row.id];
          return (
            <li key={row.id} className="mk-request-row">
              <div className="mk-request-text">
                <div className="mk-request-name" title={fileName(row)}>{fileName(row)}</div>
                <div className="mk-request-from mk-mono">from {shortDeviceId(row.counterparty_device_id)}</div>
                {state?.result ? (
                  <div className={`mk-file-card-status is-${state.tone}`}>{state.result}</div>
                ) : null}
              </div>
              <div className="mk-request-actions">
                <Button small disabled={state?.busy != null} onClick={() => onApprove(row)}>
                  {state?.busy === 'approve' ? 'Working…' : 'Approve'}
                </Button>
                <Button variant="ghost" small disabled={state?.busy != null} onClick={() => onDecline(row)}>
                  {state?.busy === 'decline' ? 'Working…' : 'Decline'}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function attachmentName(m: ReturnType<typeof useMeerkat>, row: FileRequestRow): string {
  // The request row does not carry the file name; recover it from the signed
  // message attachment list. Falls back to a short hash if the message is gone.
  const events = m.listChannelMessages(row.community_id, row.channel_id);
  for (const event of events) {
    const att = (event.attachments ?? []).find((a) => a.id === row.attachment_id);
    if (att) return att.name;
  }
  return `file ${row.blob_hash.slice(0, 8)}`;
}

function approveFailure(
  reason:
    | 'not_found'
    | 'not_incoming'
    | 'not_paired'
    | 'no_relay'
    | 'revoked'
    | 'not_a_member'
    | 'owner_no_longer_has_file'
    | 'park_failed'
    | 'payment_required',
): string {
  switch (reason) {
    case 'not_found':
      return 'That request is no longer here.';
    case 'not_incoming':
      return 'That is not an incoming request.';
    case 'not_paired':
      return 'You can only re-send to a paired member.';
    case 'no_relay':
      return 'Set a connection server before re-sending files.';
    case 'revoked':
      return 'That member is revoked on this device.';
    case 'not_a_member':
      return 'The requester is no longer a member of this community.';
    case 'owner_no_longer_has_file':
      return 'You no longer have this file on this device.';
    case 'park_failed':
      return 'Could not reach the connection server. Try again when you are online.';
    case 'payment_required':
      return 'The hosted Meerkat connection server requires an active subscription. Use your own server or sign in to hosted access.';
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}
