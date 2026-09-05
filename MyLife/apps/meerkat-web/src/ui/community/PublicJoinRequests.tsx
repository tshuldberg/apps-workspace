// PublicJoinRequests (Plan 19 FF3 app UI, web twin of the mobile component):
// the owner-only "Requests to join" panel. Lists queued cm_public_join_requests
// rows for this community (recorded by the mailbox dispatcher's
// publicJoinRequest handler, PART 1 / a5a2f512) and lets the OWNER approve
// (adds the member + parks the epoch-key grant through the real @mylife/sync
// engine call) or decline (row-only, silent, no network, the sender is never
// notified) each one. Owner-only: only the owner's signature can approve, so
// this panel is absent for admins.
//
// Honesty: a pending row never reads as "joined" or "member". Approve shows a
// confirmation ONLY after the engine reports ok:true; a not_parked failure (no
// connection server reachable right now) says so plainly and leaves the row
// pending for a retry, it never claims the person was added.

import { useCallback, useEffect, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { listPendingPublicJoinRequests, type PublicJoinRequestRow } from '../../lib/meerkat-data';
import { Button } from '../shell/Button';
import { shortHex } from '../format';

export const PUBLIC_JOIN_REQUESTS_COPY = {
  sectionTitle: 'Requests to join',
  hint: 'People who asked to join through a public invite link. Approve to add them to the community.',
  empty: 'No requests to join right now.',
  approveAction: 'Approve',
  declineAction: 'Decline',
  approvedNotice: 'Added to the community.',
  notParked: 'Saved. It will be sent when a connection server is available.',
  grantStale: 'This request used an old invite. Ask them to request again.',
  genericFail: 'Could not approve this request.',
};

type ApproveFailureReason =
  | 'not_owner'
  | 'publication_invalid'
  | 'community_mismatch'
  | 'grant_stale'
  | 'bundle_invalid'
  | 'not_parked';

function rowKey(row: PublicJoinRequestRow): string {
  return `${row.publication_id}:${row.sender_device_id}`;
}

function failureCopy(reason: ApproveFailureReason): string {
  if (reason === 'not_parked') return PUBLIC_JOIN_REQUESTS_COPY.notParked;
  if (reason === 'grant_stale') return PUBLIC_JOIN_REQUESTS_COPY.grantStale;
  return `${PUBLIC_JOIN_REQUESTS_COPY.genericFail} (${reason})`;
}

export function PublicJoinRequests({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const db = m.db;

  const [rows, setRows] = useState<PublicJoinRequestRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorByRow, setErrorByRow] = useState<Record<string, string>>({});

  const reload = useCallback(() => {
    setRows(listPendingPublicJoinRequests(db, communityId));
  }, [db, communityId]);

  useEffect(() => { reload(); }, [reload]);

  const onApprove = useCallback((row: PublicJoinRequestRow) => {
    const key = rowKey(row);
    setBusyKey(key);
    setNotice(null);
    setErrorByRow((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    void (async () => {
      try {
        const result = await m.approvePublicJoinRequestById(row.publication_id, row.sender_device_id);
        if (result.ok) {
          setNotice(PUBLIC_JOIN_REQUESTS_COPY.approvedNotice);
          return;
        }
        if (result.reason === 'not_found') return;
        setErrorByRow((prev) => ({ ...prev, [key]: failureCopy(result.reason) }));
      } catch {
        // A thrown approve (network / engine error) must never leave the button
        // stuck: surface the honest generic failure and always clear busy below.
        setErrorByRow((prev) => ({ ...prev, [key]: PUBLIC_JOIN_REQUESTS_COPY.genericFail }));
      } finally {
        setBusyKey(null);
        reload();
      }
    })();
  }, [m, reload]);

  const onDecline = useCallback((row: PublicJoinRequestRow) => {
    m.declinePublicJoinRequestById(row.publication_id, row.sender_device_id);
    reload();
  }, [m, reload]);

  return (
    <section className="mk-public-join-requests" aria-label={PUBLIC_JOIN_REQUESTS_COPY.sectionTitle}>
      <h2 className="mk-h2">{PUBLIC_JOIN_REQUESTS_COPY.sectionTitle}</h2>
      <p className="mk-muted" style={{ fontSize: 12 }}>{PUBLIC_JOIN_REQUESTS_COPY.hint}</p>
      {notice ? <div className="mk-box is-success">{notice}</div> : null}
      {rows.length === 0 ? (
        <p className="mk-muted">{PUBLIC_JOIN_REQUESTS_COPY.empty}</p>
      ) : (
        rows.map((row) => {
          const key = rowKey(row);
          const isBusy = busyKey === key;
          const error = errorByRow[key];
          return (
            <div key={key} className="mk-public-join-request-row">
              <div className="mk-review-row">
                <div>
                  <div className="mk-member-name">{shortHex(row.sender_device_id)}</div>
                  <div className="mk-muted" style={{ fontSize: 12 }}>
                    Requested {new Date(row.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="mk-public-join-request-actions">
                  <Button variant="danger" small disabled={isBusy} onClick={() => onDecline(row)}>
                    {PUBLIC_JOIN_REQUESTS_COPY.declineAction}
                  </Button>
                  <Button variant="primary" small disabled={isBusy} onClick={() => onApprove(row)}>
                    {PUBLIC_JOIN_REQUESTS_COPY.approveAction}
                  </Button>
                </div>
              </div>
              {error ? <p className="mk-public-join-request-error">{error}</p> : null}
            </div>
          );
        })
      )}
      <p className="mk-muted" style={{ fontSize: 12 }}>
        Approve mints an epoch key and adds them as a member; it only finishes once a connection server carries the
        grant. Decline only clears this request from your queue and never notifies the sender.
      </p>
    </section>
  );
}
