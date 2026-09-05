// PublicJoinRequests (Plan 19 FF3 app UI): the owner-only "Requests to join"
// panel. Lists queued cm_public_join_requests rows for this community (recorded
// by the mailbox dispatcher's publicJoinRequest handler, PART 1 / a5a2f512) and
// lets the OWNER approve (adds the member + parks the epoch-key grant through
// the real @mylife/sync engine call) or decline (row-only, silent, no network,
// the sender is never notified) each one. Owner-only: only the owner's
// signature can approve, so this panel is absent for admins.
//
// Honesty: a pending row never reads as "joined" or "member". Approve shows a
// confirmation ONLY after the engine reports ok:true; a not_parked failure (no
// connection server reachable right now) says so plainly and leaves the row
// pending for a retry, it never claims the person was added.

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { DatabaseAdapter } from '@mylife/db';
import { listPendingPublicJoinRequests, type PublicJoinRequestRow } from '../data/community-core';
import { useSync } from '../providers/SyncProvider';
import { Button, HonestNotice, SectionHeader } from './kit';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import { useMkStyles } from '../providers/AppThemeProvider';

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

export function PublicJoinRequests({
  db,
  communityId,
}: {
  db: DatabaseAdapter;
  communityId: string;
}): React.ReactElement {
  const styles = useMkStyles(makeStyles);
  const { approvePublicJoinRequestById, declinePublicJoinRequestById } = useSync();
  const [rows, setRows] = useState<PublicJoinRequestRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorByRow, setErrorByRow] = useState<Record<string, string>>({});

  const reload = useCallback(() => {
    setRows(listPendingPublicJoinRequests(db, communityId));
  }, [db, communityId]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

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
        const result = await approvePublicJoinRequestById(row.publication_id, row.sender_device_id);
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
  }, [approvePublicJoinRequestById, reload]);

  const onDecline = useCallback((row: PublicJoinRequestRow) => {
    declinePublicJoinRequestById(row.publication_id, row.sender_device_id);
    reload();
  }, [declinePublicJoinRequestById, reload]);

  return (
    <View style={styles.panel}>
      <SectionHeader title={PUBLIC_JOIN_REQUESTS_COPY.sectionTitle} hint={PUBLIC_JOIN_REQUESTS_COPY.hint} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>{PUBLIC_JOIN_REQUESTS_COPY.empty}</Text>
      ) : (
        rows.map((row) => {
          const key = rowKey(row);
          const isBusy = busyKey === key;
          const error = errorByRow[key];
          return (
            <View key={key} style={styles.requestBlock}>
              <View style={styles.requestRow}>
                <View style={styles.requestText}>
                  <Text style={styles.requestTitle} numberOfLines={1}>{shortHex(row.sender_device_id)}</Text>
                  <Text style={styles.requestMeta} numberOfLines={1}>
                    Requested {new Date(row.created_at).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.requestActions}>
                  <Button
                    title={PUBLIC_JOIN_REQUESTS_COPY.declineAction}
                    variant="danger"
                    disabled={isBusy}
                    onPress={() => onDecline(row)}
                    style={styles.actionButton}
                  />
                  <Button
                    title={PUBLIC_JOIN_REQUESTS_COPY.approveAction}
                    variant="primary"
                    disabled={isBusy}
                    onPress={() => onApprove(row)}
                    style={styles.actionButton}
                  />
                </View>
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          );
        })
      )}
      <HonestNotice text="Approve mints an epoch key and adds them as a member; it only finishes once a connection server carries the grant. Decline only clears this request from your queue and never notifies the sender." />
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  panel: {
    padding: 12,
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    gap: 8,
  },
  notice: { color: c.accent, fontSize: 13 },
  emptyText: { color: c.textTertiary, fontSize: 12 },
  requestBlock: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  requestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  requestText: { flex: 1, minWidth: 0, gap: 2 },
  requestTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  requestMeta: { color: c.textTertiary, fontSize: 12 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionButton: { paddingHorizontal: 14, paddingVertical: 8 },
  errorText: { color: c.danger, fontSize: 12 },
});
